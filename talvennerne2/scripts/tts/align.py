#!/usr/bin/env python3
"""Prototype (SPEC §10.3-beslutningsreglen): klip talord ud af bæresætningen
"Tallet er X." / "Tallet er X," med forced alignment. Kører i /opt/tv2-asr.

  /opt/tv2-asr/bin/python align.py --src carrier --voice nic --tag carrier-cut

For hver take i voice/probe/takes/<src>/meta.jsonl:
1. wav2vec2-emissioner (roest-v3-wav2vec2-315m) for den efterbehandlede bæresætning.
2. "tallet|er|x" tvangsalignes med torchaudio.functional.forced_align; tokens
   samles til ord med merge_tokens (20 ms pr. frame).
3. Snittet lægges i det stilleste 5 ms-vindue mellem sidste tegn i "er" og første
   tegn i talordet; talordet står sidst, så klippet går til bæresætningens slut.
4. Udklippet efterbehandles med post.process (trim −45 dBFS, fade, −18 LUFS, limiter).

Output: voice/probe/takes/<tag>/<voice>/<clip_id>.t<take>.wav + meta.jsonl, som
`probe.py compose --numbers-from <tag>` bruger til sammensætning.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import numpy as np  # noqa: E402

import post  # noqa: E402
from asr_check import ASR_SR, ROOT, emissions, load_asr, read_16k  # noqa: E402
from da_text import expected_duration, normalize  # noqa: E402

TAKES = ROOT / "voice" / "probe" / "takes"
FRAME_S = 0.02            # wav2vec2: 320 samples ved 16 kHz
CARRIER_WORDS = 2         # "tallet er"


def align_words(x16: np.ndarray, text: str):
    """[(ord, start_s, slut_s, score)] for teksten i lyden (tider i sekunder)."""
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
    blank = tok.pad_token_id
    ali, scores = AF.forced_align(em[None], torch.tensor([targets], dtype=torch.int32), blank=blank)
    spans = AF.merge_tokens(ali[0], scores[0].exp())
    assert len(spans) == len(targets), (len(spans), len(targets))
    out = []
    off = pad / ASR_SR
    for wi, w in enumerate(words):
        sp = [s for s, o in zip(spans, owner) if o == wi]
        start = sp[0].start * FRAME_S - off
        end = sp[-1].end * FRAME_S - off
        score = float(np.mean([s.score for s in sp]))
        out.append((w, round(start, 3), round(end, 3), round(score, 3)))
    return out


def cut_point(x: np.ndarray, sr: int, lo_s: float, hi_s: float) -> int:
    """Sample med mindst energi (5 ms-RMS) i [lo_s, hi_s]."""
    lo = max(0, int(lo_s * sr))
    hi = min(len(x), max(int(hi_s * sr), lo + 1))
    win = int(0.005 * sr)
    seg = x[max(0, lo - win): hi + win]
    c = np.concatenate([[0.0], np.cumsum(seg.astype(np.float64) ** 2)])
    rms = np.sqrt((c[2 * win:] - c[: -2 * win]) / (2 * win)) if len(seg) > 2 * win else np.array([0.0])
    i = int(np.argmin(rms[: max(1, hi - lo)]))
    return lo + i


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", default="carrier")
    ap.add_argument("--voice", required=True)
    ap.add_argument("--tag", default="carrier-cut")
    ap.add_argument("--threads", type=int, default=2)
    a = ap.parse_args()
    load_asr(a.threads)
    src_meta = TAKES / a.src / "meta.jsonl"
    recs = [json.loads(line) for line in src_meta.read_text().splitlines() if line.strip()]
    out_dir = TAKES / a.tag / a.voice
    out_dir.mkdir(parents=True, exist_ok=True)
    out = []
    for r in recs:
        if r["voice"] != a.voice:
            continue
        x24, sr = post.read(str(ROOT / r["wav"]))
        words = align_words(read_16k(str(ROOT / r["wav"])), r["expected"])
        er_end = words[CARRIER_WORDS - 1][2]
        num_start = words[CARRIER_WORDS][1]
        lo, hi = min(er_end, num_start), max(er_end, num_start)
        cut = cut_point(x24, sr, lo - 0.01, hi + 0.01)
        y, st = post.process(x24[cut:], sr)
        clip_id = r["id"][2:] if r["id"].startswith("c.") else r["id"]
        wav = out_dir / f"{clip_id}.t{r['take']}.wav"
        post.write(str(wav), y)
        target = " ".join(w for w, *_ in words[CARRIER_WORDS:])
        out.append({
            "set": "carrier-cut", "id": clip_id, "voice": a.voice, "take": r["take"],
            "expected": target, "carrier": r["text"], "words": words,
            "cut_s": round(cut / sr, 3), "dur": st.dur, "speech_dur": st.speech_dur,
            "exp_dur": round(expected_duration(target), 3), "lufs": st.lufs,
            "tp": st.true_peak_db, "post_ok": st.ok, "wav": str(wav.relative_to(ROOT)),
        })
        print(f"{clip_id} t{r['take']}: snit {cut / sr:.3f}s, '{target}' {st.dur:.2f}s "
              f"(forventet {out[-1]['exp_dur']:.2f}s), ord: {words}", flush=True)
    with open(TAKES / a.tag / "meta.jsonl", "w") as f:
        for o in out:
            f.write(json.dumps(o, ensure_ascii=False) + "\n")
    print(f"[{a.tag}] {len(out)} talklip skåret ud")


if __name__ == "__main__":
    main()
