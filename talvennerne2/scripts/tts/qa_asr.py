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

Genoptagelig: hvert resultat skrives straks til cachen (--cache, standard OUT.cache.jsonl) med en nøgle af lydens bytes, udsagnets
nøgle og den forventede tekst. Et udsagn, hvis lyd er byte for byte den samme, hentes derfra i stedet
for at blive hørt igen, så en genstart af containeren ikke taber det, der allerede er hørt.
"""
from __future__ import annotations

import argparse
import hashlib
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
    ap.add_argument("--cache", default=None, help="hørte udsagn (standard: OUT.cache.jsonl); læg den uden for en mappe, der ryddes")
    a = ap.parse_args()
    items = [json.loads(line) for line in Path(a.meta).read_text(encoding="utf-8").splitlines() if line.strip()]
    asr_check.load_asr(a.threads)
    use_whisper = not a.no_whisper
    t0 = time.perf_counter()
    out = []
    cache_path = Path(a.cache) if a.cache else Path(a.out + ".cache.jsonl")
    cache: dict[str, dict] = {}
    if cache_path.exists():
        for line in cache_path.read_text(encoding="utf-8").splitlines():
            try:
                row = json.loads(line)
                cache[row["fp"]] = row["r"]
            except (ValueError, KeyError):
                continue  # a line cut off by a restart
    cache_file = cache_path.open("a", encoding="utf-8")
    reused = 0
    for k, item in enumerate(items, 1):
        fp = hashlib.sha1(Path(item["wav"]).read_bytes() + f"\0{item['key']}\0{item['expected']}".encode()).hexdigest()
        if fp in cache:
            out.append(cache[fp])
            reused += 1
            if k % 100 == 0 or k == len(items):
                print(f"qa_asr: {k}/{len(items)} ({time.perf_counter() - t0:.0f} s, {reused} fra cachen)", flush=True)
            continue
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
            # blame from the transcript that heard the most (wav2vec2 spells "find" as "finn")
            w = r.get("asr_whisper")
            heard = w if w is not None and judge(item, w)["cer"] < judge(item, w2v)["cer"] else w2v
            r["blamed"] = blamed(item["parts"], heard)
        out.append(r)
        cache_file.write(json.dumps({"fp": fp, "r": r}, ensure_ascii=False) + "\n")
        cache_file.flush()
        if k % 100 == 0 or k == len(items):
            print(f"qa_asr: {k}/{len(items)} ({time.perf_counter() - t0:.0f} s, {reused} fra cachen)", flush=True)
    cache_file.close()
    Path(a.out).write_text("".join(json.dumps(o, ensure_ascii=False) + "\n" for o in out), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
