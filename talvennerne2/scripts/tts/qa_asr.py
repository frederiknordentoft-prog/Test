#!/usr/bin/env python3
"""ASR på de sammensatte udsagn fra scripts/voice/render.ts (SPEC §10.4). Kører i /opt/tv2-asr.

  /opt/tv2-asr/bin/python scripts/tts/qa_asr.py META.jsonl OUT.jsonl [--threads 2] [--no-whisper]

Hver linje i META er et renderet udsagn: {"key", "kind": "number"|"template", "n", "expected",
"parts": [[klip-id, tekst], …], "wav"}. Kriterier:

  number    talfølgen (da_numbers.py) i ASR-teksten er præcis [n]
  template  ordret: ASR-teksten er lig den forventede tekst (toDanishText) efter normalisering
            (små bogstaver, tal som ord, ingen tegnsætning, ingen mellemrum)

Fejler roest-wav2vec2, får whisper-1.5b ordet som second opinion. Et udsagn, der stadig fejler, får
de klip, hvis tegn ASR hørte forkert, som "blamed" (samme regel som generate.py).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import asr_check  # noqa: E402
from da_numbers import parse_numbers  # noqa: E402
from da_text import squash  # noqa: E402

BLAME_RATE = 0.15


def judge(item: dict, asr: str) -> dict:
    res = asr_check.check(item["expected"], asr)
    nums = parse_numbers(asr)
    verbatim = squash(item["expected"]) == squash(asr)
    if item["kind"] == "number":
        ok = nums == [item["n"]]
    else:
        ok = verbatim
    return {"asr": asr, "cer": res["cer"], "nums": nums, "nums_ok": res["nums_ok"], "verbatim": verbatim,
            "pass": res["pass"], "ok": ok}


def blamed(parts: list[list[str]], asr: str) -> list[str]:
    att = asr_check.attribute([(p[0], p[1]) for p in parts], asr)
    bad = [i for i, a in att.items() if a["errors"] >= 2 or (a["chars"] and a["errors"] / a["chars"] >= BLAME_RATE)]
    if not bad:
        worst = max((a["errors"] for a in att.values()), default=0)
        bad = [i for i, a in att.items() if a["errors"] == worst and worst > 0]
    return bad


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("meta")
    ap.add_argument("out")
    ap.add_argument("--threads", type=int, default=2)
    ap.add_argument("--no-whisper", action="store_true")
    a = ap.parse_args()
    items = [json.loads(line) for line in Path(a.meta).read_text(encoding="utf-8").splitlines() if line.strip()]
    asr_check.load_asr(a.threads)
    use_whisper = not a.no_whisper
    t0 = time.perf_counter()
    out = []
    for k, item in enumerate(items, 1):
        x16 = asr_check.read_16k(item["wav"])
        w2v = asr_check.transcribe(x16)
        r = judge(item, w2v)
        r.update(key=item["key"], kind=item["kind"], engine="wav2vec2", asr_w2v=w2v, ok_w2v=r["ok"])
        if not r["ok"] and use_whisper:
            try:
                asr_check.load_whisper(a.threads)
                w = asr_check.transcribe_whisper(x16)
                rw = judge(item, w)
                r["asr_whisper"] = w
                if rw["ok"]:
                    r.update(rw, engine="whisper")
            except Exception as err:  # noqa: BLE001 – whisper not downloaded: no second opinion
                print(f"whisper kan ikke bruges ({err}); ingen second opinion", flush=True)
                use_whisper = False
        if not r["ok"]:
            r["blamed"] = blamed(item["parts"], w2v)
        out.append(r)
        if k % 100 == 0 or k == len(items):
            print(f"qa_asr: {k}/{len(items)} ({time.perf_counter() - t0:.0f} s)", flush=True)
    Path(a.out).write_text("".join(json.dumps(o, ensure_ascii=False) + "\n" for o in out), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
