#!/usr/bin/env python3
"""S1-probe: genererer probeklip med CoRal Chatterbox og måler tid. Kører i /opt/tv2-tts.

  nice -n 19 /opt/tv2-tts/bin/python probe.py gen --set probe12 --voices mic,nic --takes 2
  nice -n 19 /opt/tv2-tts/bin/python probe.py gen --set probe12 --voices mic --limit 5 --threads 4 --tag probe12-t4
  /opt/tv2-tts/bin/python probe.py compose --voice nic   # sammensatte regnestykker af fragment-takes

Output (uden for git): talvennerne2/voice/probe/takes/<tag>/<stemme>/<id>.t<take>[.raw].wav
og en linje pr. take i talvennerne2/voice/probe/takes/<tag>/meta.jsonl.
Seed pr. take = int(sha1(id)[:8], 16) + take, så alle takes kan genskabes.
Kørslen er idempotent: takes der allerede står i meta.jsonl springes over.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import sys
import time
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")          # ingen netværkskald under generering
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("TQDM_DISABLE", "1")                # ingen "Sampling"-statuslinjer i logs

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402

import post  # noqa: E402
from da_text import expected_duration, syllables  # noqa: E402
from probe_sets import EXPR10, SETS, expr_plan, expr_text  # noqa: E402

ROOT = HERE.parents[1]                       # talvennerne2/
TAKES = ROOT / "voice" / "probe" / "takes"
MODEL_REPO = "CoRal-project/roest-v3-chatterbox-500m"
MODEL_REV = "7ce205cea6b3b36d9f60f18abb88ff21fa04ea0d"
SR = 24000

# Modelkortets "rolige" indstillinger (audio_samples/01_*: t0.6 p0.95 e0.5 c0.3 m0.05 r2.0).
SETTINGS = dict(
    language_id="da",
    temperature=0.6,
    top_p=0.95,
    min_p=0.05,
    repetition_penalty=2.0,
    cfg_weight=0.3,
    exaggeration=0.5,  # standardværdi; modelkortet: exaggeration understøttes ikke af finetunen
)

# Stemmeprompts: Københavnssætningen fra modelkortet (kunst-lyd-teknik §5.1).
PROMPTS = {
    "mic": "audio_samples/00_mic_01_t0.8_p0.95_e0.5_c0.5_m0.05_r2.0.wav",
    "nic": "audio_samples/00_nic_01_t0.8_p0.95_e0.5_c0.5_m0.05_r2.0.wav",
}
CONDS_CACHE = Path(os.environ.get("TV2_TTS_CACHE", Path.home() / ".cache" / "tv2-tts"))


def seed_for(clip_id: str, take: int) -> int:
    return int(hashlib.sha1(clip_id.encode("utf-8")).hexdigest()[:8], 16) + take


class Engine:
    """Indlæser modellen én gang og cacher stemme-conditionals pr. stemme."""

    def __init__(self, threads: int):
        import torch
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS

        from download_models import fetch

        torch.set_num_threads(threads)
        self.torch = torch
        self.threads = threads
        self.dir = Path(fetch("tts", local_only=True))
        t0 = time.perf_counter()
        self.m = ChatterboxMultilingualTTS.from_local(self.dir, device="cpu")
        self.load_s = time.perf_counter() - t0
        self.timers: dict[str, float] = {}
        self.n_tokens = 0
        self.conds: dict = {}
        self.cond_s: dict[str, float] = {}
        self._instrument()

    def _instrument(self):
        m = self.m

        def timed(name, fn):
            def wrapper(*a, **k):
                t0 = time.perf_counter()
                r = fn(*a, **k)
                self.timers[name] = self.timers.get(name, 0.0) + time.perf_counter() - t0
                if name == "t3":
                    self.n_tokens = int(r.shape[-1])
                return r
            return wrapper

        m.t3.inference = timed("t3", m.t3.inference)
        m.s3gen.inference = timed("s3gen", m.s3gen.inference)
        m.watermarker.apply_watermark = timed("wm", m.watermarker.apply_watermark)

    def use_voice(self, voice: str):
        from chatterbox.mtl_tts import Conditionals

        if voice not in self.conds:
            CONDS_CACHE.mkdir(parents=True, exist_ok=True)
            cache = CONDS_CACHE / f"conds-{voice}-{MODEL_REV[:8]}.pt"
            t0 = time.perf_counter()
            if cache.exists():
                conds = Conditionals.load(cache)
            else:
                self.m.prepare_conditionals(str(self.dir / PROMPTS[voice]), exaggeration=0.5)
                conds = self.m.conds
                conds.save(cache)
            self.cond_s[voice] = time.perf_counter() - t0
            self.conds[voice] = conds
        self.m.conds = self.conds[voice]

    def generate(self, text: str, seed: int):
        random.seed(seed)
        np.random.seed(seed % (2**32))
        self.torch.manual_seed(seed)
        self.timers = {}
        t0 = time.perf_counter()
        wav = self.m.generate(text, **SETTINGS)
        total = time.perf_counter() - t0
        x = wav.squeeze(0).detach().cpu().numpy().astype(np.float32)
        tm = {"t_total": round(total, 3)}
        tm.update({f"t_{k}": round(v, 3) for k, v in self.timers.items()})
        tm["n_tokens"] = self.n_tokens
        return x, tm


def _done_keys(meta: Path) -> set:
    keys = set()
    if meta.exists():
        for line in meta.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                keys.add((r["id"], r["voice"], r["take"]))
    return keys


def cmd_gen(a):
    items = SETS[a.set]()
    if a.only:
        want = set(a.only.split(","))
        items = [it for it in items if it[0] in want]
    if a.limit:
        items = items[: a.limit]
    tag = a.tag or a.set
    out = TAKES / tag
    out.mkdir(parents=True, exist_ok=True)
    meta = out / "meta.jsonl"
    done = _done_keys(meta)
    voices = a.voices.split(",")
    todo = [(take, it, v) for take in range(a.take0, a.take0 + a.takes) for it in items for v in voices
            if (it[0], v, take) not in done]
    if not todo:
        print(f"[{tag}] intet at lave ({len(done)} takes findes)")
        return
    eng = Engine(a.threads)
    sess = {"tag": tag, "threads": a.threads, "load_s": round(eng.load_s, 2), "time": time.time()}
    for v in voices:
        eng.use_voice(v)
        sess[f"cond_s_{v}"] = round(eng.cond_s[v], 2)
    if not a.no_warmup:  # første kald bærer engangsomkostninger; tæller ikke med
        eng.use_voice(voices[0])
        _, tm = eng.generate("Hej.", 1)
        sess["warmup_s"] = tm["t_total"]
    with open(out / "session.jsonl", "a") as f:
        f.write(json.dumps(sess) + "\n")
    print(f"[{tag}] model {eng.load_s:.1f}s, {len(todo)} takes, {a.threads} tråde", flush=True)
    for n, (take, (cid, text, expected), v) in enumerate(todo, 1):
        eng.use_voice(v)
        seed = seed_for(cid, take)
        load = os.getloadavg()[0]
        x, tm = eng.generate(text, seed)
        vdir = out / v
        vdir.mkdir(exist_ok=True)
        raw = vdir / f"{cid}.t{take}.raw.wav"
        wav = vdir / f"{cid}.t{take}.wav"
        sf.write(raw, x, SR, subtype="FLOAT")
        y, st = post.process(x, SR)
        post.write(str(wav), y)
        rec = {
            "set": a.set, "id": cid, "voice": v, "take": take, "seed": seed, "text": text,
            "expected": expected, "threads": a.threads, **tm,
            "raw_dur": round(len(x) / SR, 3), "dur": st.dur, "speech_dur": st.speech_dur,
            "syll": syllables(expected), "exp_dur": round(expected_duration(expected), 3),
            "lufs": st.lufs, "tp": st.true_peak_db, "limited_db": st.limited_db, "post_ok": st.ok,
            "load1": round(load, 2), "wav": str(wav.relative_to(ROOT)), "raw": str(raw.relative_to(ROOT)),
        }
        with open(meta, "a") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        rtf = tm["t_total"] / max(rec["raw_dur"], 1e-3)
        print(f"[{tag}] {n}/{len(todo)} {v} {cid} t{take}: {tm['t_total']:.1f}s for {rec['raw_dur']:.2f}s "
              f"(RTF {rtf:.1f}; t3 {tm.get('t_t3', 0):.1f} s3gen {tm.get('t_s3gen', 0):.1f} "
              f"wm {tm.get('t_wm', 0):.2f}) {st.lufs} LUFS", flush=True)
    print(f"[{tag}] DONE", flush=True)


def cmd_repost(a):
    """Kør efterbehandlingen igen på rå takes (efter ændringer i post.py)."""
    for tag in a.tags.split(","):
        meta = TAKES / tag / "meta.jsonl"
        recs = [json.loads(line) for line in meta.read_text().splitlines() if line.strip()]
        for r in recs:
            x, sr = post.read(str(ROOT / r["raw"]))
            y, st = post.process(x, sr)
            post.write(str(ROOT / r["wav"]), y)
            r.update({"dur": st.dur, "speech_dur": st.speech_dur, "lufs": st.lufs,
                      "tp": st.true_peak_db, "limited_db": st.limited_db, "post_ok": st.ok})
        with open(meta, "w") as f:
            for r in recs:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"[{tag}] {len(recs)} takes efterbehandlet igen, "
              f"{sum(r['post_ok'] for r in recs)} opfylder loudness-/peak-kravet")


def cmd_compose(a):
    """Sæt de 10 regnestykker sammen af fragment-takes (SPEC §10.2-mellemrum)."""
    src = TAKES / a.frags_tag
    out = TAKES / a.tag
    out.mkdir(parents=True, exist_ok=True)
    meta = out / "meta.jsonl"
    recs = []
    for take in range(a.take0, a.take0 + a.takes):
        for eid, x, op, y in EXPR10:
            seq, gaps = expr_plan(x, op, y)
            clips = []
            for cid, _text, _kind in seq:
                p = src / a.voice / f"{cid}.t{take}.wav"
                if a.numbers_from and cid.startswith(("n.", "h.")):
                    p = TAKES / a.numbers_from / a.voice / f"{cid}.t{take}.wav"
                clips.append(post.read(str(p))[0])
            comp = post.concat(clips, gaps)
            vdir = out / a.voice
            vdir.mkdir(exist_ok=True)
            wav = vdir / f"q.{eid}.t{take}.wav"
            post.write(str(wav), comp)
            st = post.measure(comp)
            recs.append({
                "set": "composed", "id": f"q.{eid}", "voice": a.voice, "take": take,
                "expected": expr_text(x, op, y), "clips": [c[0] for c in seq], "gaps_ms": gaps,
                "dur": st.dur, "lufs": st.lufs, "tp": st.true_peak_db,
                "wav": str(wav.relative_to(ROOT)),
            })
    with open(meta, "w") as f:
        for r in recs:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"[{a.tag}] {len(recs)} sammensatte udsagn skrevet")


def _best_take(tag: str, voice: str, cid: str) -> Path:
    """Take med lavest CER (ASR-resultat), ved lighed laveste take-nummer."""
    asr = TAKES / tag / "asr.jsonl"
    rows = [json.loads(line) for line in asr.read_text().splitlines() if line.strip()] if asr.exists() else []
    rows = [r for r in rows if r["voice"] == voice and r["id"] == cid]
    take = min(rows, key=lambda r: (r["cer"], r["take"]))["take"] if rows else 0
    return TAKES / tag / voice / f"{cid}.t{take}.wav"


def cmd_listen(a):
    """Lytteprøver til brugeren (24 kHz mono 16-bit, ≤ 45 s hver)."""
    probe_dir = ROOT / "voice" / "probe"
    pause = np.zeros(int(0.4 * SR), dtype=np.float32)
    clips = []
    for cid, _t, _e in SETS["probe12"]():
        clips += [post.read(str(_best_take("probe12", a.voice, cid)))[0].astype(np.float32), pause]
    demo = np.concatenate(clips[:-1])
    p1 = probe_dir / f"stemmeproeve-{a.voice}.wav"
    post.write(str(p1), demo)
    parts = []
    pair_gap = np.zeros(int(0.9 * SR), dtype=np.float32)
    for eid in a.exprs.split(","):
        whole = post.read(str(_best_take("whole10", a.voice, f"q.{eid}")))[0]
        comp = post.read(str(TAKES / a.composed_tag / a.voice / f"q.{eid}.t0.wav"))[0]
        parts += [whole.astype(np.float32), pause, comp.astype(np.float32), pair_gap]
    cmp_wav = np.concatenate(parts[:-1])
    p2 = probe_dir / "sammensat-vs-hel.wav"
    post.write(str(p2), cmp_wav)
    for p, x in ((p1, demo), (p2, cmp_wav)):
        print(f"{p.relative_to(ROOT)}: {len(x) / SR:.1f} s, {p.stat().st_size / 1e6:.2f} MB")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("gen")
    g.add_argument("--set", required=True, choices=sorted(SETS))
    g.add_argument("--voices", default="mic,nic")
    g.add_argument("--takes", type=int, default=1)
    g.add_argument("--take0", type=int, default=0)
    g.add_argument("--threads", type=int, default=2)
    g.add_argument("--limit", type=int, default=0)
    g.add_argument("--only", default="")
    g.add_argument("--tag", default="")
    g.add_argument("--no-warmup", action="store_true")
    c = sub.add_parser("compose")
    c.add_argument("--voice", required=True)
    c.add_argument("--frags-tag", default="frags")
    c.add_argument("--numbers-from", default="", help="tag med udklippede tal (align.py)")
    c.add_argument("--tag", default="composed")
    c.add_argument("--takes", type=int, default=1)
    c.add_argument("--take0", type=int, default=0)
    r = sub.add_parser("repost")
    r.add_argument("--tags", required=True, help="kommasepareret liste af tags")
    li = sub.add_parser("listen")
    li.add_argument("--voice", required=True)
    li.add_argument("--exprs", default="e01,e05,e06,e07,e10")
    li.add_argument("--composed-tag", default="composed")
    a = ap.parse_args()
    {"gen": cmd_gen, "compose": cmd_compose, "repost": cmd_repost, "listen": cmd_listen}[a.cmd](a)


if __name__ == "__main__":
    main()
