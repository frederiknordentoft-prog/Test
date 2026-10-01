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
from probe_sets import EXPR10, SETS, batch_sets, expr_plan, expr_text  # noqa: E402

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


def patch_short_text_bug():
    """chatterbox-tts 0.1.7 crasher på meget korte tekster (≤ 3 teksttokens, fx "En.").

    AlignmentStreamAnalyzer.step evaluerer A[..., :-5].max(dim=1), som er tom, når
    tekstudsnittet S har ≤ 5 tokens (inkl. start/stop) → IndexError. Lappen tilføjer
    kun vagten "S > 5" i netop den linje (der findes ingen tidligere tokens at gentage);
    for alle længere tekster er opførslen uændret. Fejler højlydt, hvis kilden ændres.
    """
    import inspect
    import textwrap

    from chatterbox.models.t3.inference import alignment_stream_analyzer as asa

    cls = asa.AlignmentStreamAnalyzer
    if getattr(cls, "_tv2_patched", False):
        return
    src = textwrap.dedent(inspect.getsource(cls.step))
    old = "alignment_repetition = self.complete and (A[self.completed_at:, :-5].max(dim=1).values.sum() > 5)"
    if src.count(old) != 1:
        raise RuntimeError("chatterbox-kilden har ændret sig; lappen i probe.py skal gennemses")
    src = src.replace(old, old.replace("self.complete and (", "self.complete and S > 5 and ("))
    ns: dict = {}
    exec(compile(src, asa.__file__, "exec"), asa.__dict__, ns)
    cls.step = ns["step"]
    cls._tv2_patched = True


class Engine:
    """Indlæser modellen én gang og cacher stemme-conditionals pr. stemme."""

    def __init__(self, threads: int, bf16: bool = False, s3_prompt_s: float = 0.0):
        import torch
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS

        from download_models import fetch

        torch.set_num_threads(threads)
        patch_short_text_bug()
        self.torch = torch
        self.threads = threads
        self.bf16 = bf16                # forsøg: bf16-autocast (AMX) – ikke standard
        self.s3_prompt_s = s3_prompt_s  # forsøg: kortere S3Gen-reference – ikke standard
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

        t3_inf = m.t3.inference
        if self.bf16:  # kun T3 (Llama); HiFiGAN's iSTFT tåler ikke bf16
            torch = self.torch

            def t3_inf(*a, _f=m.t3.inference, **k):
                with torch.autocast("cpu", dtype=torch.bfloat16):
                    return _f(*a, **k)
        m.t3.inference = timed("t3", t3_inf)
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
            if self.s3_prompt_s:
                conds = self._short_s3_prompt(voice, conds)
            self.cond_s[voice] = time.perf_counter() - t0
            self.conds[voice] = conds
        self.m.conds = self.conds[voice]

    def _short_s3_prompt(self, voice: str, conds):
        """Erstat S3Gen-referencen med de første ca. s3_prompt_s sekunder af prompten
        (snit i en pause); T3-conditioning og speaker-embedding til T3 er uændrede."""
        import librosa
        from chatterbox.models.s3gen import S3GEN_SR

        from chatterbox.mtl_tts import Conditionals

        wav, _ = librosa.load(str(self.dir / PROMPTS[voice]), sr=S3GEN_SR)
        n = int(self.s3_prompt_s * S3GEN_SR)
        lo, hi = max(1, n - S3GEN_SR // 2), min(len(wav), n + S3GEN_SR // 2)
        win = int(0.02 * S3GEN_SR)
        e = np.convolve(wav[lo - 1:hi] ** 2, np.ones(win), mode="same")
        cut = lo + int(np.argmin(e))
        gen = self.m.s3gen.embed_ref(wav[:cut], S3GEN_SR, device="cpu")
        return Conditionals(conds.t3, gen)

    def generate(self, text: str, seed: int):
        random.seed(seed)
        np.random.seed(seed % (2**32))
        self.torch.manual_seed(seed)
        self.timers = {}
        t0 = time.perf_counter()
        c0 = time.process_time()
        wav = self.m.generate(text, **SETTINGS)
        total = time.perf_counter() - t0
        cpu = time.process_time() - c0  # CPU-tid for alle tråde (mindre følsom for andres last)
        x = wav.squeeze(0).detach().cpu().numpy().astype(np.float32)
        tm = {"t_total": round(total, 3), "cpu_s": round(cpu, 3)}
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
    eng = Engine(a.threads, a.bf16, a.s3_prompt_s)
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
            "expected": expected, "threads": a.threads, "bf16": a.bf16, "s3_prompt_s": a.s3_prompt_s, **tm,
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


def cmd_gen_batch(a):
    """Flere klip i ét kald (batch); align.py batch klipper dem ud bagefter."""
    batches = batch_sets()
    if a.only:
        want = set(a.only.split(","))
        batches = [b for b in batches if b[0] in want or any(b[0].startswith(w) for w in want)]
    out = TAKES / a.tag
    out.mkdir(parents=True, exist_ok=True)
    meta = out / "meta.jsonl"
    done = _done_keys(meta)
    voices = a.voices.split(",")
    todo = [(take, b, v) for take in range(a.take0, a.take0 + a.takes) for b in batches for v in voices
            if (b[0], v, take) not in done]
    if not todo:
        print(f"[{a.tag}] intet at lave ({len(done)} batches findes)")
        return
    eng = Engine(a.threads, a.bf16, a.s3_prompt_s)
    for v in voices:
        eng.use_voice(v)
    if not a.no_warmup:
        eng.use_voice(voices[0])
        eng.generate("Hej.", 1)
    print(f"[{a.tag}] {len(todo)} batch-kald, {a.threads} tråde", flush=True)
    for n, (take, (bid, text, items), v) in enumerate(todo, 1):
        eng.use_voice(v)
        seed = seed_for(bid, take)
        load = os.getloadavg()[0]
        x, tm = eng.generate(text, seed)
        vdir = out / v
        vdir.mkdir(exist_ok=True)
        raw = vdir / f"{bid}.t{take}.raw.wav"
        sf.write(raw, x, SR, subtype="FLOAT")
        expected = " ".join(f"{pre} {t}" if pre else t for _c, t, _f, pre in items)
        rec = {
            "set": "batch", "id": bid, "voice": v, "take": take, "seed": seed, "text": text,
            "expected": expected, "items": items, "k": len(items), "threads": a.threads,
            "bf16": a.bf16, "s3_prompt_s": a.s3_prompt_s, **tm,
            "raw_dur": round(len(x) / SR, 3), "cpu_per_clip": round(tm["t_total"] / len(items), 3),
            "load1": round(load, 2), "raw": str(raw.relative_to(ROOT)),
        }
        with open(meta, "a") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        print(f"[{a.tag}] {n}/{len(todo)} {v} {bid} t{take} (k={len(items)}): {tm['t_total']:.1f}s for "
              f"{rec['raw_dur']:.2f}s → {rec['cpu_per_clip']:.1f}s/klip (t3 {tm.get('t_t3', 0):.1f} "
              f"s3gen {tm.get('t_s3gen', 0):.1f}, {tm['n_tokens']} tokens)", flush=True)
    print(f"[{a.tag}] DONE", flush=True)


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
    g.add_argument("--bf16", action="store_true", help="forsøg: bf16-autocast")
    g.add_argument("--s3-prompt-s", type=float, default=0.0, help="forsøg: kortere S3Gen-reference (s)")
    c = sub.add_parser("compose")
    c.add_argument("--voice", required=True)
    c.add_argument("--frags-tag", default="frags")
    c.add_argument("--numbers-from", default="", help="tag med udklippede tal (align.py)")
    c.add_argument("--tag", default="composed")
    c.add_argument("--takes", type=int, default=1)
    c.add_argument("--take0", type=int, default=0)
    r = sub.add_parser("repost")
    r.add_argument("--tags", required=True, help="kommasepareret liste af tags")
    gb = sub.add_parser("gen-batch")
    gb.add_argument("--voices", default="nic")
    gb.add_argument("--only", default="", help="batch-id'er eller præfikser, kommasepareret")
    gb.add_argument("--takes", type=int, default=1)
    gb.add_argument("--take0", type=int, default=0)
    gb.add_argument("--threads", type=int, default=2)
    gb.add_argument("--tag", default="batch")
    gb.add_argument("--no-warmup", action="store_true")
    gb.add_argument("--bf16", action="store_true", help="forsøg: bf16-autocast")
    gb.add_argument("--s3-prompt-s", type=float, default=0.0, help="forsøg: kortere S3Gen-reference (s)")
    li = sub.add_parser("listen")
    li.add_argument("--voice", required=True)
    li.add_argument("--exprs", default="e01,e05,e06,e07,e10")
    li.add_argument("--composed-tag", default="composed")
    a = ap.parse_args()
    {"gen": cmd_gen, "gen-batch": cmd_gen_batch, "compose": cmd_compose, "repost": cmd_repost,
     "listen": cmd_listen}[a.cmd](a)


if __name__ == "__main__":
    main()
