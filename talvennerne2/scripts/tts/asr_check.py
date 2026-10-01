#!/usr/bin/env python3
"""Udtaletjek med CoRal roest-v3-wav2vec2-315m (SPEC §10.4). Kører i /opt/tv2-asr.

  /opt/tv2-asr/bin/python asr_check.py voice/probe/takes/probe12/meta.jsonl [...]
  /opt/tv2-asr/bin/python asr_check.py --wav klip.wav --text "Hvad er syv plus fem?"

For hver linje i en meta.jsonl (felterne "wav" og "expected") transskriberes WAV'en
med grådig CTC-afkodning (ingen sprogmodel), begge sider normaliseres (små bogstaver,
tal som danske ord, ingen tegnsætning, ingen mellemrum), og CER beregnes.
Resultatet skrives som asr.jsonl ved siden af meta.jsonl.

Bestået = CER ≤ 0,05 og samme talfølge i forventet tekst og ASR (eksakt talord-match).

Second opinion (valgfri, kræver setup.sh --whisper): --engine whisper bruger
CoRal roest-v3-whisper-1.5b og skriver asr-whisper.jsonl.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402

from da_text import cer_counts, normalize, parse_numbers  # noqa: E402

ROOT = HERE.parents[1]
ASR_SR = 16000
CER_MAX = 0.05

_MODEL = None


def load_asr(threads: int = 2):
    """(model, feature_extractor, tokenizer) for roest-v3-wav2vec2-315m, grådig CTC."""
    global _MODEL
    if _MODEL is None:
        import torch
        from transformers import Wav2Vec2CTCTokenizer, Wav2Vec2FeatureExtractor, Wav2Vec2ForCTC
        from transformers.utils import logging as hf_logging

        hf_logging.disable_progress_bar()

        from download_models import fetch

        torch.set_num_threads(threads)
        d = fetch("asr", local_only=True)
        tok = Wav2Vec2CTCTokenizer.from_pretrained(d)
        fe = Wav2Vec2FeatureExtractor.from_pretrained(d)
        model = Wav2Vec2ForCTC.from_pretrained(d, dtype=torch.float32).eval()
        _MODEL = (model, fe, tok)
    return _MODEL


_WHISPER = None


def load_whisper(threads: int = 2):
    """roest-v3-whisper-1.5b (second opinion). bf16 for fart på CPU."""
    global _WHISPER
    if _WHISPER is None:
        import torch
        from transformers import WhisperForConditionalGeneration, WhisperProcessor
        from transformers.utils import logging as hf_logging

        hf_logging.disable_progress_bar()

        from download_models import fetch

        torch.set_num_threads(threads)
        d = fetch("whisper", local_only=True)
        proc = WhisperProcessor.from_pretrained(d)
        model = WhisperForConditionalGeneration.from_pretrained(d, dtype=torch.bfloat16).eval()
        _WHISPER = (model, proc)
    return _WHISPER


def transcribe_whisper(x16: np.ndarray) -> str:
    import torch

    model, proc = load_whisper()
    feats = proc(x16, sampling_rate=ASR_SR, return_tensors="pt").input_features.to(torch.bfloat16)
    with torch.inference_mode():
        ids = model.generate(feats, language="da", task="transcribe", max_new_tokens=128)
    return proc.batch_decode(ids, skip_special_tokens=True)[0].strip()


def read_16k(path: str) -> np.ndarray:
    import torch
    import torchaudio.functional as AF

    x, sr = sf.read(path, dtype="float32", always_2d=False)
    if x.ndim == 2:
        x = x.mean(axis=1)
    if sr != ASR_SR:
        x = AF.resample(torch.from_numpy(x), sr, ASR_SR).numpy()
    return x


def emissions(x16: np.ndarray):
    """Log-sandsynligheder (T, V) fra wav2vec2 for 16 kHz-lyd."""
    import torch

    model, fe, _tok = load_asr()
    pad = np.zeros(int(0.1 * ASR_SR), dtype=np.float32)  # lidt stilhed om korte klip
    inp = fe(np.concatenate([pad, x16, pad]), sampling_rate=ASR_SR, return_tensors="pt")
    with torch.inference_mode():
        logits = model(inp.input_values).logits[0]
    return torch.log_softmax(logits, dim=-1), len(pad)


def transcribe(x16: np.ndarray) -> str:
    _model, _fe, tok = load_asr()
    em, _ = emissions(x16)
    ids = em.argmax(dim=-1).tolist()
    return tok.decode(ids).strip()


def check(expected: str, asr: str) -> dict:
    edits, n = cer_counts(expected, asr)
    ne, na = parse_numbers(expected), parse_numbers(asr)
    c = edits / n
    return {
        "asr": asr,
        "asr_norm": normalize(asr),
        "exp_norm": normalize(expected),
        "cer": round(c, 4),
        "edits": edits,
        "ref_len": n,
        "nums_exp": ne,
        "nums_asr": na,
        "nums_ok": ne == na,
        "pass": c <= CER_MAX and ne == na,
    }


def run_meta(meta: Path, out_name: str = "asr.jsonl", engine: str = "wav2vec2") -> list[dict]:
    recs = [json.loads(line) for line in meta.read_text().splitlines() if line.strip()]
    out = []
    t0 = time.perf_counter()
    fn = transcribe_whisper if engine == "whisper" else transcribe
    for r in recs:
        x = read_16k(str(ROOT / r["wav"]))
        res = check(r["expected"], fn(x))
        out.append({k: r[k] for k in ("id", "voice", "take", "wav", "expected") if k in r} | res)
    dt = time.perf_counter() - t0
    with open(meta.parent / out_name, "w") as f:
        for o in out:
            f.write(json.dumps(o, ensure_ascii=False) + "\n")
    n_pass = sum(o["pass"] for o in out)
    e = sum(o["edits"] for o in out)
    n = sum(o["ref_len"] for o in out)
    print(f"{meta.parent.name}: {len(out)} klip, samlet CER {e / max(n, 1):.4f}, "
          f"bestået {n_pass}/{len(out)}, {dt / max(len(out), 1):.2f} s/klip")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("meta", nargs="*", help="meta.jsonl-filer")
    ap.add_argument("--wav")
    ap.add_argument("--text")
    ap.add_argument("--out", default="")
    ap.add_argument("--threads", type=int, default=2)
    ap.add_argument("--engine", choices=["wav2vec2", "whisper"], default="wav2vec2")
    ap.add_argument("--rescore", action="store_true",
                    help="genberegn CER fra gemte ASR-tekster (asr*.jsonl) efter ændret normalisering")
    a = ap.parse_args()
    if a.rescore:
        for m in a.meta:
            p = Path(m)
            rows = [json.loads(line) for line in p.read_text().splitlines() if line.strip()]
            rows = [{k: r[k] for k in ("id", "voice", "take", "wav", "expected") if k in r}
                    | check(r["expected"], r["asr"]) for r in rows]
            p.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))
            print(f"{p}: {len(rows)} genberegnet")
        return
    if a.engine == "whisper":
        load_whisper(a.threads)
    else:
        load_asr(a.threads)
    fn = transcribe_whisper if a.engine == "whisper" else transcribe
    if a.wav:
        res = check(a.text or "", fn(read_16k(a.wav)))
        print(json.dumps(res, ensure_ascii=False, indent=1))
        return
    out = a.out or ("asr-whisper.jsonl" if a.engine == "whisper" else "asr.jsonl")
    for m in a.meta:
        run_meta(Path(m), out, a.engine)


if __name__ == "__main__":
    main()
