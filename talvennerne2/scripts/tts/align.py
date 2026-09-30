#!/usr/bin/env python3
"""Klip ytringer ud med forced alignment (roest-v3-wav2vec2-315m). Kører i /opt/tv2-asr.

To brugsmåder, samme maskine:

  carrier  Prototype for SPEC §10.3-beslutningsreglen: talordet klippes ud af
           bæresætningen "Tallet er X." / "Tallet er X,".
             align.py carrier --src carrier --voice nic --tag carrier-cut
  batch    Flere klip genereret i ét kald (probe.py gen-batch) klippes ud enkeltvis.
             align.py batch --src batch --voice nic --tag batch-cut

Fremgangsmåde:
1. Rå lyd → highpass 70 Hz → gain til −18 LUFS (ingen trim), så tærskler er ens.
2. wav2vec2-emissioner (16 kHz); teksten "a|b|c" tvangsalignes med
   torchaudio.functional.forced_align og samles til ord med merge_tokens (20 ms/frame).
3. Mellem to naboklip lægges snittet i det stilleste 5 ms-vindue mellem sidste tegn i
   det ene og første tegn i det næste (±20 ms).
4. Hvert udklip efterbehandles med post.process (trim −45 dBFS 20/40 ms, fade, −18 LUFS,
   limiter −1,5 dBTP).

Kvalitetsmål pr. udklip: alignment-score (middel-sandsynlighed for klippets tegn),
stilhed omkring snittene (ms under −45 dBFS) og niveau i snitpunktet. Et snit med
niveau over −30 dBFS og under 10 ms stilhed markeres som risiko for klik/afkapning.

Output: voice/probe/takes/<tag>/<stemme>/<klip-id>.t<take>.wav + meta.jsonl, som
asr_check.py og `probe.py compose` kan bruge.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import numpy as np  # noqa: E402

import post  # noqa: E402
from asr_check import ASR_SR, ROOT, check, emissions, load_asr, transcribe  # noqa: E402
from da_text import expected_duration, normalize  # noqa: E402

TAKES = ROOT / "voice" / "probe" / "takes"
FRAME_S = 0.02            # wav2vec2: 320 samples ved 16 kHz
SIL_DB = -45.0            # samme tærskel som trim
RISK_CUT_DB = -30.0       # snit i tale, hvis niveauet er højere end dette …
RISK_SIL_MS = 10.0        # … og der er mindre stilhed end dette om snittet


def prepare(raw: np.ndarray, sr: int) -> np.ndarray:
    """Highpass og gain til −18 LUFS, uden trim (tider i lyden bevares)."""
    x = post.highpass(post.resample(raw, sr, post.SR), post.SR)
    loud = post.lufs(x)
    if math.isfinite(loud):
        x = x * 10 ** ((post.TARGET_LUFS - loud) / 20)
    return x


def to16k(x24: np.ndarray) -> np.ndarray:
    import torch
    import torchaudio.functional as AF

    return AF.resample(torch.from_numpy(x24.astype(np.float32)), post.SR, ASR_SR).numpy()


def align_words(x16: np.ndarray, text: str):
    """[(ord, start_s, slut_s, score)] for teksten i lyden."""
    import torch
    import torchaudio.functional as AF

    _model, _fe, tok = load_asr()
    em, pad = emissions(x16)
    words = normalize(text).split()
    delim = tok.convert_tokens_to_ids("|")
    targets, owner = [], []
    for wi, w in enumerate(words):
        if wi:
            targets.append(delim)
            owner.append(None)
        for ch in w:
            targets.append(tok.convert_tokens_to_ids(ch))
            owner.append(wi)
    ali, scores = AF.forced_align(em[None], torch.tensor([targets], dtype=torch.int32),
                                  blank=tok.pad_token_id)
    spans = AF.merge_tokens(ali[0], scores[0].exp())
    assert len(spans) == len(targets), (len(spans), len(targets))
    off = pad / ASR_SR
    out = []
    for wi, w in enumerate(words):
        sp = [s for s, o in zip(spans, owner) if o == wi]
        out.append((w, round(sp[0].start * FRAME_S - off, 3), round(sp[-1].end * FRAME_S - off, 3),
                    round(float(np.mean([s.score for s in sp])), 3)))
    return out


def _rms_db(x: np.ndarray, sr: int, win_ms: float = 5.0) -> np.ndarray:
    win = max(1, int(sr * win_ms / 1000))
    c = np.concatenate([[0.0], np.cumsum(x.astype(np.float64) ** 2)])
    n = len(x)
    idx = np.arange(n)
    lo = np.clip(idx - win // 2, 0, n)
    hi = np.clip(idx + win // 2 + 1, 0, n)
    return 10 * np.log10((c[hi] - c[lo]) / np.maximum(hi - lo, 1) + 1e-12)


def segment(x: np.ndarray, sr: int, words, groups: list[int]):
    """Del lyden i len(groups) klip (groups = antal ord pr. klip).

    Returnerer [(start, slut, info)] i samples; snit i stilleste punkt mellem klip.
    """
    env = _rms_db(x, sr)
    bounds, k = [], 0
    for g in groups:
        bounds.append((k, k + g - 1))
        k += g
    assert k == len(words), (k, len(words))
    cuts = [0]
    cut_info = []
    quiet = env < SIL_DB
    for (_a0, a1), (b0, _b1) in zip(bounds, bounds[1:]):
        end_prev, start_next = words[a1][2], words[b0][1]
        lo = max(0, int((min(end_prev, start_next) - 0.02) * sr))
        hi = min(len(x) - 1, int((max(end_prev, start_next) + 0.02) * sr))
        hi = max(hi, lo + 1)
        c = lo + int(np.argmin(env[lo:hi]))
        i, j = c, c  # sammenhængende stilhed omkring snittet
        while i > 0 and quiet[i - 1]:
            i -= 1
        while j < len(x) - 1 and quiet[j + 1]:
            j += 1
        sil_ms = (j - i + 1) / sr * 1000 if quiet[c] else 0.0
        cuts.append(c)
        cut_info.append({"cut_s": round(c / sr, 3), "cut_db": round(float(env[c]), 1),
                         "sil_ms": round(sil_ms, 1), "gap_align_ms": round((start_next - end_prev) * 1000)})
    cuts.append(len(x))
    segs = []
    for n, (s, e) in enumerate(zip(cuts, cuts[1:])):
        before = cut_info[n - 1] if n > 0 else None
        after = cut_info[n] if n < len(cut_info) else None
        near = [ci for ci in (before, after) if ci]
        risk = any(ci["cut_db"] > RISK_CUT_DB and ci["sil_ms"] < RISK_SIL_MS for ci in near)
        segs.append((s, e, {"cut_before": before, "cut_after": after,
                            "cut_db_max": max((ci["cut_db"] for ci in near), default=None),
                            "sil_ms_min": min((ci["sil_ms"] for ci in near), default=None),
                            "cut_risk": risk}))
    return segs


def _load(meta: Path) -> list[dict]:
    return [json.loads(line) for line in meta.read_text().splitlines() if line.strip()]


def _write(tag: str, name: str, rows: list[dict]):
    with open(TAKES / tag / name, "w") as f:
        for o in rows:
            f.write(json.dumps(o, ensure_ascii=False) + "\n")


def cmd_carrier(a):
    """Talordet klippes ud af "Tallet er X."; kun klippet efter "tallet er" gemmes."""
    out = []
    (TAKES / a.tag / a.voice).mkdir(parents=True, exist_ok=True)
    for r in _load(TAKES / a.src / "meta.jsonl"):
        if r["voice"] != a.voice:
            continue
        raw, sr = post.read(str(ROOT / r["raw"]))
        x = prepare(raw, sr)
        words = align_words(to16k(x), r["expected"])
        s, e, info = segment(x, post.SR, words, [2, len(words) - 2])[1]
        y, st = post.process(x[s:e], post.SR, hp=False)
        cid = r["id"][2:] if r["id"].startswith("c.") else r["id"]
        wav = TAKES / a.tag / a.voice / f"{cid}.t{r['take']}.wav"
        post.write(str(wav), y)
        target = " ".join(w for w, *_ in words[2:])
        out.append({
            "set": "carrier-cut", "id": cid, "voice": a.voice, "take": r["take"], "expected": target,
            "carrier": r["text"], "words": words,
            "align_score": round(float(np.mean([w[3] for w in words[2:]])), 3), **info,
            "dur": st.dur, "speech_dur": st.speech_dur, "exp_dur": round(expected_duration(target), 3),
            "lufs": st.lufs, "tp": st.true_peak_db, "post_ok": st.ok, "wav": str(wav.relative_to(ROOT)),
            "cpu_per_clip": r.get("t_total"),
        })
        print(f"{cid} t{r['take']}: '{target}' {st.dur:.2f}s (forventet {out[-1]['exp_dur']:.2f}s) "
              f"snit {info['cut_before']}", flush=True)
    _write(a.tag, "meta.jsonl", out)
    print(f"[{a.tag}] {len(out)} talklip skåret ud")


def cmd_batch(a):
    """Hvert klip i en batch-ytring klippes ud; hele ytringen ASR-tjekkes også."""
    out, whole = [], []
    (TAKES / a.tag / a.voice).mkdir(parents=True, exist_ok=True)
    for r in _load(TAKES / a.src / "meta.jsonl"):
        if r["voice"] != a.voice:
            continue
        raw, sr = post.read(str(ROOT / r["raw"]))
        x = prepare(raw, sr)
        x16 = to16k(x)
        items = r["items"]
        full = " ".join(t for _c, t, _f in items)
        wres = check(full, transcribe(x16))
        whole.append({"id": r["id"], "voice": a.voice, "take": r["take"], "k": r["k"],
                      "cpu_s": r["t_total"], "raw_dur": r["raw_dur"], **wres})
        words = align_words(x16, full)
        groups = [len(normalize(t).split()) for _c, t, _f in items]
        segs = segment(x, post.SR, words, groups)
        k = 0
        n_risk = 0
        for (cid, text, form), (s, e, info), g in zip(items, segs, groups):
            y, st = post.process(x[s:e], post.SR, hp=False)
            wav = TAKES / a.tag / a.voice / f"{cid}.t{r['take']}.wav"
            post.write(str(wav), y)
            iw = words[k:k + g]
            k += g
            n_risk += info["cut_risk"]
            out.append({
                "set": "batch-cut", "id": cid, "voice": a.voice, "take": r["take"], "expected": text,
                "form": form, "batch": r["id"], "k": r["k"], "cpu_per_clip": r["cpu_per_clip"],
                "align_score": round(float(np.mean([w[3] for w in iw])), 3), **info,
                "dur": st.dur, "speech_dur": st.speech_dur, "exp_dur": round(expected_duration(text), 3),
                "lufs": st.lufs, "tp": st.true_peak_db, "post_ok": st.ok, "wav": str(wav.relative_to(ROOT)),
            })
        print(f"{r['id']} t{r['take']}: hel ytring CER {wres['cer']:.3f} ('{wres['asr']}'), "
              f"{n_risk} risikable snit", flush=True)
    _write(a.tag, "meta.jsonl", out)
    _write(a.tag, "whole.jsonl", whole)
    print(f"[{a.tag}] {len(out)} klip skåret ud af {len(whole)} batch-ytringer")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, src, tag in (("carrier", "carrier", "carrier-cut"), ("batch", "batch", "batch-cut")):
        p = sub.add_parser(name)
        p.add_argument("--src", default=src)
        p.add_argument("--voice", required=True)
        p.add_argument("--tag", default=tag)
        p.add_argument("--threads", type=int, default=2)
    a = ap.parse_args()
    load_asr(a.threads)
    {"carrier": cmd_carrier, "batch": cmd_batch}[a.cmd](a)


if __name__ == "__main__":
    main()
