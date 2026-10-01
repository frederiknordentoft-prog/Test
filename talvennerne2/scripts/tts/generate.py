#!/usr/bin/env python3
"""Produktionsgenerering af stemmen (SPEC §10.3, strategi D i docs/voice.md). Kører i /opt/tv2-tts.

  nice -n 19 /opt/tv2-tts/bin/python scripts/tts/generate.py --wave 1 --threads 2 --max-minutes 100
  … --pack core,n0-20          kun disse pakker
  … --ids n.end.7,op.plus      kun disse klip (eller --ids-file fil med ét id pr. linje)
  … --retake-from voice/qa.json   nye takes for klip, som sammensætningstesten pegede på
  … --status                   status uden at generere
  … --dry-run                  vis kaldene uden at indlæse modellen

Idempotent og genoptagelig. Et klip er færdigt, når voice/masters/index.json har dets hash fra
voice/inventory.json. Rå takes, kandidater og tilstanden (state.jsonl) ligger uden for git i
voice/probe/takes/pipeline/. En afbrudt kørsel fortsætter, hvor den slap. Rå lyd fra et kald, der
blev genereret før afbrydelsen, bruges igen (samme seed giver samme lyd).

Generering (strategi D):
  carrier   talord og runde hundreder i "Tallet er X," / "Tallet er X." (ca. 10 pr. kald)
  head      hundrede-hoveder i "Tallet er tre hundrede og syvogfyrre." (ca. 10 pr. kald)
  sentence  hele sætninger, 4 pr. kald
  single    alt andet, ét kald pr. klip; delte fragmenter (frag.*, op.*) får 2 takes fra start
Alle udklip laves med forced alignment (align.py) og efterbehandles (post.py, −18 LUFS).

Tjek pr. take (asr_check.py, roest-wav2vec2, talfølge med da_numbers.py):
  - efterbehandling: −18 ± 1 LU, true peak ≤ −1 dBTP, ingen clipping
  - varighed: [0,4; 2,2] gange forventet (sætninger [0,35; 2,0], hoveder [0,3; 2,2])
  - klip med ≥ 3 stavelser: ASR alene, CER ≤ 0,05 og eksakte talord
  - talord og hoveder: ASR på bæresætningen; talfølgen og selve ordet skal være rigtige
  - whisper-1.5b som second opinion i grænsetilfælde (CER ≤ 0,20)
Sammensætning (efter alle takes): korte klip, talord, hoveder og alle delte fragmenter sættes sammen
med andre klip præcis som appen gør (sequence.py) og ASR-tjekkes. Fejler en sammensætning, får det
klip skylden, hvis tegn ASR hørte forkert. Det får en ny take (højst 4 nye takes i alt).
Klip, der stadig fejler, får den bedste take som master og markeres "pass": false.

Exitkoder: 0 alt valgt er færdigt, 3 tidsbudgettet er brugt (kør igen), 4 ingen fremdrift (klip venter
på partnere, der ikke kommer), 1 fejl.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import pipeline as P  # noqa: E402
from da_text import expected_duration, number_words, syllables  # noqa: E402

log = logging.getLogger("generate")

# Every failed ASR check goes to whisper as second opinion: wav2vec2 without a language model writes
# numbers ≥ 100 as glued digits ("1104" for "et hundrede og fire") and spells colloquial forms
# phonetically ("finn tallet", "va er"), so a CER threshold would keep exactly those from whisper.
WHISPER_MAX_CER = 1.0
QUIET_DB = -42.0               # a pause at the normalised level (prepare(): −18 LUFS)
QUIET_END_MS = 25              # the clip ends in the first pause this long after its last character …
QUIET_START_MS = 20            # … and starts after the last pause this long before its first one
BLAME_RATE = 0.15              # andel forkerte tegn, der giver et klip skylden for en sammensætning
MAX_COMP_ROUNDS = 8
DUR_WINDOW = {"sentence": (0.35, 2.0), "head": (0.3, 2.2), "default": (0.4, 2.2)}
MID_PARTNERS = [7, 3, 12, 4, 9, 15, 2, 6, 8, 5, 11, 13]
END_PARTNERS = [5, 4, 9, 6, 8, 3, 2, 7, 12, 11, 14, 10]
TAIL_PARTNERS = [47, 25, 38, 62, 19, 84, 56, 73, 91, 5, 4, 9, 6, 8, 3, 12, 15, 17]


# ─── State ────────────────────────────────────────────────────────────────────

@dataclass
class Take:
    id: str
    hash: str
    take: int
    method: str
    job: str
    seed: int
    cand: str                      # candidate WAV, relative to WORK
    text: str                      # model text of the call
    dur: float = 0.0
    exp_dur: float = 0.0
    lufs: float = 0.0
    tp: float = 0.0
    post_ok: bool = False
    dur_ok: bool = False
    check: str = "none"            # alone | carrier | none (short clips: composition only)
    asr: str | None = None
    asr_expected: str | None = None
    cer: float | None = None
    nums_ok: bool | None = None
    engine: str | None = None
    asr_w2v: str | None = None     # wav2vec2's transcript when whisper decided
    asr_whisper: str | None = None # whisper's transcript when it was asked
    pass_a: bool = False
    reason: str = ""
    cpu_s: float = 0.0
    wall_s: float = 0.0
    comp_fail: bool = False
    qa_fail: bool = False


_FIELDS = set(Take.__dataclass_fields__)


class State:
    """Append-only log of takes (WORK/state.jsonl), grouped by clip and hash."""

    def __init__(self, path: Path):
        self.path = path
        self.takes: dict[tuple[str, str], list[Take]] = {}
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                r = json.loads(line)
                kind = r.pop("kind", "take")
                key = (r["id"], r["hash"])
                if kind == "take":
                    lst = self.takes.setdefault(key, [])
                    lst[:] = [t for t in lst if t.take != r["take"]] + [Take(**{k: v for k, v in r.items() if k in _FIELDS})]
                elif kind in ("comp_fail", "qa_fail"):
                    for t in self.takes.get(key, []):
                        if t.take == r["take"]:
                            setattr(t, kind, True)

    def _append(self, rec: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    def add(self, t: Take) -> None:
        lst = self.takes.setdefault((t.id, t.hash), [])
        lst[:] = [x for x in lst if x.take != t.take] + [t]
        self._append({"kind": "take", **asdict(t)})

    def mark(self, t: Take, kind: str) -> None:
        setattr(t, kind, True)
        self._append({"kind": kind, "id": t.id, "hash": t.hash, "take": t.take})

    def of(self, clip: dict) -> list[Take]:
        return sorted(self.takes.get((clip["id"], clip["hash"]), []), key=lambda t: t.take)


# ─── Jobs ─────────────────────────────────────────────────────────────────────

@dataclass
class Item:
    clip: dict
    clip_group: int                # word group that becomes the clip
    ctx: tuple[int, int]           # word groups of the carrier segment (inclusive) for ASR
    parts: list[tuple[str, str]]   # (owner, text) of the carrier segment; owner "clip" is the clip
    check_text: str                # expected text of the clip


@dataclass
class Job:
    key: str
    method: str
    take: int
    text: str
    groups: list[int]
    items: list[Item] = field(default_factory=list)

    @property
    def seed(self) -> int:
        return P.seed_for(self.key, self.take if len(self.items) == 1 else 0)


def _n(text: str) -> int:
    return len(P.words_of(text))


def carrier_job(clips: list[dict], form: str, take: int) -> Job:
    words = [P.bare(c["genText"]) for c in clips]
    if form == "mid":
        text = ", ".join(f"tallet er {w}" for w in words) + ","
    else:
        text = " ".join(f"Tallet er {w}." for w in words)
    groups, items = [], []
    for c, w in zip(clips, words):
        groups += [2, _n(w)]
        g = len(groups) - 1
        items.append(Item(c, g, (g - 1, g), [("prefix", "tallet er"), ("clip", w)], w))
    key = clips[0]["id"] if len(clips) == 1 else "carrier:" + "|".join(c["id"] for c in clips)
    return Job(key, "carrier", take, text[0].upper() + text[1:], groups, items)


def head_job(clips: list[dict], take: int) -> Job:
    groups, items, phrases = [], [], []
    for c in clips:
        head, tail = P.head_parts(c, take)
        tw = number_words(tail)
        phrases.append(f"Tallet er {head} {tw}.")
        groups += [2, _n(head), _n(tw)]
        g = len(groups) - 2
        items.append(Item(c, g, (g - 1, g + 1), [("prefix", "tallet er"), ("clip", head), ("tail", tw)], head))
    key = clips[0]["id"] if len(clips) == 1 else "head:" + "|".join(c["id"] for c in clips)
    return Job(key, "head", take, " ".join(phrases), groups, items)


def sentence_job(clips: list[dict], take: int) -> Job:
    texts = [P.model_text(c) for c in clips]
    groups = [_n(t) for t in texts]
    items = [Item(c, i, (i, i), [("clip", c["text"])], c["text"]) for i, c in enumerate(clips)]
    key = clips[0]["id"] if len(clips) == 1 else "sentence:" + "|".join(c["id"] for c in clips)
    return Job(key, "sentence", take, " ".join(texts), groups, items)


def single_job(clip: dict, take: int) -> Job:
    m = P.method_of(clip)
    if m == "carrier":
        return carrier_job([clip], P.form_of(clip), take)
    if m == "head":
        return head_job([clip], take)
    if m == "sentence":
        return sentence_job([clip], take)
    text = P.model_text(clip)
    return Job(clip["id"], "single", take, text, [_n(text)], [Item(clip, 0, (0, 0), [("clip", clip["text"])], clip["text"])])


def _even_chunks(xs: list, k: int) -> list[list]:
    """Consecutive chunks of at most k with sizes as equal as possible (21 → 7, 7, 7)."""
    if not xs:
        return []
    nb = math.ceil(len(xs) / k)
    size, extra = divmod(len(xs), nb)
    out, i = [], 0
    for b in range(nb):
        n = size + (b < extra)
        out.append(xs[i:i + n])
        i += n
    return out


def _round_robin(clips: list[dict], k: int, max_syll: int) -> list[list[dict]]:
    """Batches of ≤ k that spread similar ids (q.add:0+…) over different calls."""
    if not clips:
        return []
    nb = math.ceil(len(clips) / k)
    batches: list[list[dict]] = [[] for _ in range(nb)]
    for i, c in enumerate(clips):
        batches[i % nb].append(c)
    out: list[list[dict]] = []
    for b in batches:  # split a batch that is too long for one call
        cur: list[dict] = []
        for c in b:
            if cur and sum(syllables(x["genText"]) for x in cur) + syllables(c["genText"]) > max_syll:
                out.append(cur)
                cur = []
            cur.append(c)
        out.append(cur)
    return out


def initial_jobs(clips: list[dict]) -> list[Job]:
    """Take 0 (and take 1 for shared fragments) of clips that have no takes yet, in a fixed order:
    numbers and heads first (they are the partners of every composition), then shared fragments,
    then other single calls and finally the sentence batches."""
    by_method: dict[str, list[dict]] = {"carrier": [], "head": [], "sentence": [], "single": []}
    for c in sorted(clips, key=lambda c: (c["pack"], c["id"])):
        by_method[P.method_of(c)].append(c)
    jobs: list[Job] = []
    for form in ("mid", "end"):
        group = [c for c in by_method["carrier"] if P.form_of(c) == form]
        jobs += [carrier_job(ch, form, 0) for ch in _even_chunks(group, P.CARRIER_K)]
    jobs += [head_job(ch, 0) for ch in _even_chunks(by_method["head"], P.CARRIER_K)]
    shared = [c for c in by_method["single"] if c["id"].startswith(("frag.", "op."))]
    for c in shared:
        jobs += [single_job(c, 0), single_job(c, 1)]
    jobs += [single_job(c, 0) for c in by_method["single"] if c not in shared]
    packs: dict[str, list[dict]] = {}
    for c in by_method["sentence"]:
        packs.setdefault(c["pack"], []).append(c)
    for pack in sorted(packs):
        jobs += [sentence_job(b, 0) for b in _round_robin(packs[pack], P.SENTENCE_K, P.SENTENCE_MAX_SYLL)]
    return jobs


def tighten(x, s: int, e: int, first_s: float, last_e: float, sr: int = P.SR) -> tuple[int, int]:
    """Move a cut into the nearest pause around the clip's aligned characters.

    The cut between two neighbours lies in their quietest point, but when the next phrase follows
    closely ("… seksten. Tallet er …") the tail can keep the onset of the next word, and a number can
    start with the end of "er". The clip therefore ends in the first stretch of QUIET_END_MS below
    QUIET_DB after its last character (+30 ms for the decay CTC does not see) and starts after the
    last stretch of QUIET_START_MS before its first character (−20 ms for the onset). Without such a
    pause the cut stays where it was.
    """
    import numpy as np

    hop = max(1, int(0.0025 * sr))
    win = 2 * hop
    seg = np.asarray(x[s:e], dtype=np.float64)
    if len(seg) < 2 * win:
        return s, e
    c = np.concatenate([[0.0], np.cumsum(seg * seg)])
    starts = np.arange(0, len(seg) - win, hop)
    db = 10 * np.log10((c[starts + win] - c[starts]) / win + 1e-12)
    quiet = db < QUIET_DB
    n_end, n_start = max(1, QUIET_END_MS * sr // 1000 // hop), max(1, QUIET_START_MS * sr // 1000 // hop)
    f_last = max(0, int(((last_e + 0.03) * sr - s) // hop))
    f_first = int(((first_s - 0.02) * sr - s) // hop)
    new_e, new_s = e, s
    run = 0
    for k in range(f_last, len(quiet)):
        run = run + 1 if quiet[k] else 0
        if run >= n_end:
            new_e = s + (k - run + 1) * hop + win + int(0.01 * sr)
            break
    run = 0
    for k in range(min(f_first, len(quiet) - 1), -1, -1):
        run = run + 1 if quiet[k] else 0
        if run >= n_start:
            new_s = s + (k + run) * hop - int(0.005 * sr)
            break
    new_s, new_e = max(s, new_s), min(e, new_e)
    return (new_s, new_e) if new_e - new_s > int(0.05 * sr) else (s, e)


# ─── Engines (loaded lazily) ─────────────────────────────────────────────────

class Engines:
    def __init__(self, cfg: dict, threads: int, whisper: bool):
        self.cfg = cfg
        self.threads = threads
        self.use_whisper = whisper
        self._tts = None
        self._np = None

    @property
    def np(self):
        if self._np is None:
            import numpy as np
            self._np = np
        return self._np

    def tts(self):
        if self._tts is None:
            import probe
            if probe.PROMPTS[self.cfg["voice"]] != self.cfg["prompt"] or probe.MODEL_REV != self.cfg["modelRev"]:
                raise SystemExit("voice/config.json og probe.py er uenige om stemmeprompt eller modelrevision")
            t0 = time.perf_counter()
            self._tts = probe.Engine(self.threads)
            self._tts.use_voice(self.cfg["voice"])
            log.info(f"model indlæst på {time.perf_counter() - t0:.0f} s ({self.threads} tråde)")
        return self._tts

    def synth(self, text: str, seed: int):
        import random

        import torch

        eng = self.tts()
        np = self.np
        random.seed(seed)
        np.random.seed(seed % (2**32))
        torch.manual_seed(seed)
        c0, t0 = time.process_time(), time.perf_counter()
        wav = eng.m.generate(text, **self.cfg["settings"])
        x = wav.squeeze(0).detach().cpu().numpy().astype(np.float32)
        return x, time.process_time() - c0, time.perf_counter() - t0

    def asr(self, x24) -> str:
        import align
        import asr_check
        asr_check.load_asr(self.threads)
        return asr_check.transcribe(align.to16k(x24))

    def whisper(self, x24) -> str | None:
        if not self.use_whisper:
            return None
        import align
        import asr_check
        try:
            asr_check.load_whisper(self.threads)
        except Exception as err:  # noqa: BLE001 – not downloaded: no second opinion
            log.info(f"whisper kan ikke indlæses ({err}); ingen second opinion")
            self.use_whisper = False
            return None
        return asr_check.transcribe_whisper(align.to16k(x24))


# ─── The generator ───────────────────────────────────────────────────────────

class Generator:
    def __init__(self, args, inv: dict, clips: list[dict]):
        import numpy as np
        self.np = np
        self.args = args
        self.inv = inv
        self.by_id = {c["id"]: c for c in inv["clips"]}
        self.selected = clips
        self.sel_ids = {c["id"] for c in clips}
        self.state = State(P.WORK / "state.jsonl")
        self.index = P.load_index()
        self.eng = Engines(P.config(), args.threads, not args.no_whisper)
        self.deadline = time.monotonic() + args.max_minutes * 60
        self.audio_cache: dict[str, object] = {}
        self.comp_cache: dict[tuple, dict] = {}
        self.avoid: dict[str, set[str]] = {}
        self.choice: dict[str, Take | None] = {}
        self.stats = {"calls": 0, "cpu_s": 0.0, "wall_s": 0.0, "takes": 0, "final": 0, "failed": 0, "copied": 0}
        self.by_hash: dict[str, list[str]] = {}
        for c in inv["clips"]:
            self.by_hash.setdefault(c["hash"], []).append(c["id"])
        self.followers: dict[str, str] = {}

    # --- helpers ---
    def time_left(self) -> bool:
        return time.monotonic() < self.deadline

    def final(self, cid: str) -> dict | None:
        e = self.index["clips"].get(cid)
        clip = self.by_id.get(cid)
        return e if e and clip and e.get("hash") == clip["hash"] else None

    def takes(self, clip: dict) -> list[Take]:
        return self.state.of(clip)

    def next_take(self, clip: dict) -> int | None:
        used = [t.take for t in self.takes(clip)]
        nxt = max(used) + 1 if used else 0
        return nxt if nxt <= P.MAX_TAKE else None

    def load_cand(self, t: Take):
        key = f"{t.id}@{t.hash}@{t.take}"
        if key not in self.audio_cache:
            import soundfile as sf
            x, _sr = sf.read(str(P.WORK / t.cand), dtype="float32")
            self.audio_cache[key] = x
        return self.audio_cache[key]

    def load_master(self, cid: str):
        key = f"{cid}@master"
        if key not in self.audio_cache:
            import soundfile as sf
            x, _sr = sf.read(str(P.MASTERS / self.index["clips"][cid]["file"]), dtype="float32")
            self.audio_cache[key] = x
        return self.audio_cache[key]

    # --- phase A: generate, cut, check ---
    def run_job(self, job: Job) -> list[Take]:
        import soundfile as sf

        import align
        import post

        np = self.np
        tag = hashlib.sha1(job.key.encode("utf-8")).hexdigest()[:10]
        raw_path = P.WORK / "raw" / f"{P.safe_name(job.items[0].clip['id'])[:60]}-{tag}.t{job.take}.raw.wav"
        side = raw_path.with_suffix(".json")
        if raw_path.exists() and side.exists() and json.loads(side.read_text())["text"] == job.text:
            raw, _ = post.read(str(raw_path))
            meta = json.loads(side.read_text())
            cpu, wall = meta["cpu_s"], meta["wall_s"]
        else:
            raw, cpu, wall = self.eng.synth(job.text, job.seed)
            raw_path.parent.mkdir(parents=True, exist_ok=True)
            sf.write(str(raw_path), raw, P.SR, subtype="FLOAT")
            side.write_text(json.dumps({"text": job.text, "seed": job.seed, "cpu_s": round(cpu, 2),
                                        "wall_s": round(wall, 2)}))
            self.stats["calls"] += 1
            self.stats["cpu_s"] += cpu
            self.stats["wall_s"] += wall
        raw_dur = len(raw) / P.SR
        log.info(f"kald {job.method} k={len(job.items)} t{job.take} '{job.text[:70]}': {wall:.1f} s for {raw_dur:.2f} s lyd")
        x = align.prepare(raw, P.SR)
        out: list[Take] = []
        try:
            words = align.align_words(align.to16k(x), job.text)
            segs = align.segment(x, P.SR, words, job.groups)
        except Exception as err:  # noqa: BLE001 – audio too short or garbled to align
            log.info(f"  alignment fejlede: {err}")
            words, segs = None, None
        starts = [sum(job.groups[:g]) for g in range(len(job.groups))]
        for it in job.items:
            c = it.clip
            t = Take(c["id"], c["hash"], job.take, job.method, job.key, job.seed,
                     f"cand/{c['pack']}/{P.safe_name(c['id'])}.t{job.take}.wav", job.text,
                     cpu_s=round(cpu / len(job.items), 2), wall_s=round(wall / len(job.items), 2))
            if segs is None:
                t.reason = "alignment"
                self.state.add(t)
                out.append(t)
                continue

            def span(g0: int, g1: int):
                w0, w1 = words[starts[g0]], words[starts[g1] + job.groups[g1] - 1]
                s = max(segs[g0][0], int((w0[1] - align.MAX_HEAD_S) * P.SR))
                e = min(segs[g1][1], int((w1[2] + align.MAX_TAIL_S) * P.SR))
                return max(0, s), min(len(x), max(e, s + 1))

            s, e = span(it.clip_group, it.clip_group)
            g = it.clip_group
            s, e = tighten(x, s, e, words[starts[g]][1], words[starts[g] + job.groups[g] - 1][2])
            y, st = post.process(x[s:e], P.SR, hp=False)
            cand = P.WORK / t.cand
            cand.parent.mkdir(parents=True, exist_ok=True)
            sf.write(str(cand), y, P.SR, subtype="FLOAT")
            t.dur, t.lufs, t.tp, t.post_ok = st.dur, st.lufs, st.true_peak_db, st.ok
            t.exp_dur = round(expected_duration(it.check_text), 3)
            lo, hi = DUR_WINDOW.get(job.method, DUR_WINDOW["default"])
            t.dur_ok = lo <= st.dur / max(t.exp_dur, 1e-3) <= hi
            if job.method in ("carrier", "head"):
                cs, ce = span(*it.ctx)
                self.check_carrier(t, x[cs:ce], it.parts)
            elif P.checked_alone(c):
                self.check_alone(t, y, c["text"])
            t.pass_a = t.post_ok and t.dur_ok and (t.check == "none" or bool(t.nums_ok and t.cer is not None
                                                                              and t.cer <= P.CER_MAX))
            if not t.pass_a:
                t.reason = ",".join(r for r, bad in (("efterbehandling", not t.post_ok),
                                                     ("varighed", not t.dur_ok),
                                                     ("asr", t.check != "none" and not (t.nums_ok and (t.cer or 0) <= P.CER_MAX)))
                                    if bad)
            self.state.add(t)
            self.stats["takes"] += 1
            out.append(t)
            log.info(f"  {c['id']} t{t.take}: {t.dur:.2f} s (forhold {t.dur / max(t.exp_dur, 1e-3):.2f}) "
                     f"{t.lufs} LUFS, {t.check}: '{t.asr}' CER {t.cer} ({t.engine}"
                     + (f", wav2vec2: '{t.asr_w2v}'" if t.asr_w2v else "")
                     + (f", whisper: '{t.asr_whisper}'" if t.asr_whisper and t.engine != "whisper" else "")
                     + f") → {'ok' if t.pass_a else 'FEJL ' + t.reason}")
        return out

    def _judge(self, expected: str, asr: str, parts=None) -> tuple[float, bool, dict]:
        import asr_check
        res = asr_check.check(expected, asr)
        cer = res["cer"]
        if parts is not None:  # carrier: only the clip's own characters count, plus the number sequence
            att = asr_check.attribute(parts, asr)["clip"]
            cer = round(att["errors"] / max(att["chars"], 1), 4)
        return cer, res["nums_ok"], res

    def check_alone(self, t: Take, y, text: str) -> None:
        t.check, t.asr_expected = "alone", text
        asr = self.eng.asr(y)
        t.cer, t.nums_ok, _ = self._judge(text, asr)
        t.asr, t.engine = asr, "wav2vec2"
        if not (t.nums_ok and t.cer <= P.CER_MAX) and t.cer <= WHISPER_MAX_CER:
            w = self.eng.whisper(y)
            if w is not None:
                t.asr_whisper = w
                cer, ok, _ = self._judge(text, w)
                if ok and cer <= P.CER_MAX:
                    t.asr_w2v = t.asr
                    t.cer, t.nums_ok, t.asr, t.engine = cer, ok, w, "whisper"

    def check_carrier(self, t: Take, seg, parts) -> None:
        expected = " ".join(p for _o, p in parts)
        t.check, t.asr_expected = "carrier", expected
        asr = self.eng.asr(seg)
        t.cer, t.nums_ok, _ = self._judge(expected, asr, parts)
        t.asr, t.engine = asr, "wav2vec2"
        if not (t.nums_ok and t.cer <= P.CER_MAX) and t.cer <= WHISPER_MAX_CER:
            w = self.eng.whisper(seg)
            if w is not None:
                t.asr_whisper = w
                cer, ok, _ = self._judge(expected, w, parts)
                if ok and cer <= P.CER_MAX:
                    t.asr_w2v = t.asr
                    t.cer, t.nums_ok, t.asr, t.engine = cer, ok, w, "whisper"

    # --- finalizing ---
    def best(self, clip: dict, takes: list[Take] | None = None) -> Take | None:
        takes = [t for t in (takes if takes is not None else self.takes(clip)) if not t.qa_fail and t.post_ok]
        if not takes:
            return None
        return min(takes, key=lambda t: (not t.pass_a, t.comp_fail, not t.dur_ok, t.cer if t.cer is not None else 0.0,
                                         t.take))

    def finalize(self, clip: dict, t: Take, passed: bool, comp: dict | None = None, reason: str = "") -> None:
        import soundfile as sf
        rel = P.master_rel(clip)
        path = P.MASTERS / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        y = self.load_cand(t)
        sf.write(str(path), y, P.SR, subtype="PCM_16", format="FLAC")
        takes = self.takes(clip)
        entry = {
            "file": rel, "hash": clip["hash"], "pack": clip["pack"], "wave": clip["wave"], "take": t.take,
            "method": t.method, "dur": round(t.dur, 3), "lufs": t.lufs, "tp": t.tp, "check": t.check,
            "asr": t.asr, "asrExpected": t.asr_expected, "cer": t.cer, "engine": t.engine, "asrWav2vec2": t.asr_w2v,
            "pass": passed,
            "takes": len(takes), "cpuS": round(sum(x.cpu_s for x in takes), 1),
            "wallS": round(sum(x.wall_s for x in takes), 1),
        }
        if comp:
            entry["comp"] = comp
            if t.check == "none" and comp.get("asr") is not None:
                entry.update(check="comp", asr=comp["asr"], asrExpected=comp["expected"], cer=comp["cer"],
                             engine=comp.get("engine"), asrWav2vec2=comp.get("asrWav2vec2"))
        if not passed:
            entry["reason"] = reason or t.reason or "sammensætning"
        self.index["clips"][clip["id"]] = entry
        P.save_index(self.index)
        self.stats["final"] += 1
        self.stats["failed"] += not passed
        log.info(f"  ✓ master {clip['id']} t{t.take} ({'bestået' if passed else 'IKKE bestået: ' + entry['reason']})")

    def master_for_hash(self, h: str, not_id: str) -> str | None:
        """Another clip with the same hash (same generator text) that already has a master."""
        for cid in self.by_hash.get(h, []):
            e = self.final(cid)
            if cid != not_id and e is not None and e.get("file") and not e.get("copyOf"):
                return cid
        return None

    def copy_master(self, clip: dict, src: str) -> None:
        """Same text, same voice, same settings: reuse the master of `src` instead of generating."""
        import shutil
        e = dict(self.index["clips"][src])
        rel = P.master_rel(clip)
        (P.MASTERS / rel).parent.mkdir(parents=True, exist_ok=True)
        if (P.MASTERS / e["file"]).resolve() != (P.MASTERS / rel).resolve():
            shutil.copyfile(P.MASTERS / e["file"], P.MASTERS / rel)
        e.update(file=rel, pack=clip["pack"], wave=clip["wave"], copyOf=src, cpuS=0.0, wallS=0.0)
        self.index["clips"][clip["id"]] = e
        P.save_index(self.index)
        self.stats["final"] += 1
        self.stats["copied"] += 1
        log.info(f"  ✓ master {clip['id']} = kopi af {src} (samme tekst)")

    def finalize_missing(self, clip: dict) -> None:
        """No take could even be cut (alignment failed every time): recorded without a master."""
        takes = self.takes(clip)
        self.index["clips"][clip["id"]] = {
            "file": None, "hash": clip["hash"], "pack": clip["pack"], "wave": clip["wave"], "pass": False,
            "takes": len(takes), "reason": "ingen brugbar take", "cpuS": round(sum(t.cpu_s for t in takes), 1),
            "wallS": round(sum(t.wall_s for t in takes), 1),
        }
        P.save_index(self.index)
        self.stats["final"] += 1
        self.stats["failed"] += 1
        log.info(f"  ✗ {clip['id']}: ingen brugbar take efter {len(takes)} forsøg")

    # --- compositions ---
    def usable(self, cid: str) -> bool:
        """A partner for compositions: a passed master, or a selected clip with a passing take."""
        e = self.final(cid)
        if e is not None and cid not in self.pending_ids:
            return bool(e.get("pass"))
        clip = self.by_id.get(cid)
        if clip is None or cid not in self.sel_ids:
            return False
        return any(t.pass_a and not t.comp_fail and not t.qa_fail for t in self.takes(clip))

    def waiting(self, cid: str) -> bool:
        """True when the clip is selected, not final and could still become usable."""
        return cid in self.pending_ids and not self.usable(cid)

    def partner_audio(self, cid: str):
        e = self.final(cid)
        if e is not None and cid not in self.pending_ids:
            return self.load_master(cid)
        return self.load_cand(self.choice[cid])

    def pick(self, ids: list[str], exclude: set[str] = frozenset()) -> str | None | bool:
        """First usable id; False when one of them may still become usable (wait); None if never."""
        wait = False
        for cid in ids:
            if cid in exclude or cid not in self.by_id:
                continue
            if self.usable(cid):
                return cid
            wait = wait or self.waiting(cid)
        return False if wait else None

    def comps_for(self, clip: dict) -> list[list[str]] | None:
        """Test compositions for a clip, built like the runtime's sentences; None means "wait for
        partners", [] means no partner will ever exist. Partners in self.avoid[clip] are skipped."""
        cid = clip["id"]
        mid = [f"n.mid.{n}" for n in MID_PARTNERS]
        end = [f"n.end.{n}" for n in END_PARTNERS]
        own = {cid} | self.avoid.get(cid, set())
        out: list[list[str]] = []
        waits = False

        def need(*cands, exclude=()):
            nonlocal waits
            r = self.pick(list(cands), own | set(exclude))
            if r is False:
                waits = True
            return r or None

        m = P.method_of(clip)
        if m == "carrier":
            hv, op = need("frag.hvad_er"), need("op.plus")
            if P.form_of(clip) == "mid":
                b = need(*end)
                if b:
                    out.append([x for x in (hv, cid, op, b) if x])
            else:
                a = need(*mid)
                if a:
                    out.append([x for x in (hv, a, op, cid) if x])
                # "plus" ends in s and can hide a weak s at the start of the number ("[s]eksten"):
                # end forms are also heard after "Find tallet" (or "Det er").
                lead = need("frag.find_tallet", "frag.det_er")
                if lead:
                    out.append([lead, cid])
        elif m == "head":
            hv, op, a = need("frag.hvad_er"), need("op.plus"), need(*mid)
            t1 = need(*[f"n.end.{n}" for n in TAIL_PARTNERS])
            t2 = need(*[f"n.end.{n}" for n in TAIL_PARTNERS], exclude={t1 or ""})
            if t1:
                out.append([cid, t1])
                if a and op:
                    out.append([x for x in (hv, a, op, cid, t2 or t1) if x])
        elif cid.startswith("op."):
            a, b = need(*mid), need(*end)
            if a and b:
                out.append([a, cid, b])
                if cid in ("op.plus", "op.minus"):
                    hv = need("frag.hvad_er")
                    a2, b2 = need(*mid, exclude={a}), need(*end, exclude={b})
                    if hv and a2 and b2:
                        out.append([hv, a2, cid, b2])
        elif cid == "frag.hvad_er":
            a, b, op = need(*mid), need(*end), need("op.plus")
            a2, b2, op2 = need(*mid, exclude={a or ""}), need(*end, exclude={b or ""}), need("op.minus")
            if a and b and op:
                out.append([cid, a, op, b])
            if a2 and b2 and op2:
                out.append([cid, a2, op2, b2])
        elif cid.startswith("frag."):
            if clip["opens"]:
                b = need(*end)
                b2 = need(*end, exclude={b or ""})
                out += [[cid, x] for x in (b, b2) if x]
            else:
                a, b = need(*mid), need(*end)
                if a and b:
                    out.append([a, cid, b])
        else:
            det = need("frag.det_er")
            if det:
                out.append([det, cid])
            else:
                a = need(*mid)
                if a:
                    out.append([a, cid])
        if out:
            return out
        return None if waits else []

    def eval_comp(self, ids: list[str], audio: dict) -> dict:
        import asr_check
        import sequence
        key = tuple((i, id(audio[i])) for i in ids)
        if key in self.comp_cache:
            return self.comp_cache[key]
        y = sequence.compose(ids, self.by_id, audio, P.SR)
        expected = " ".join(self.by_id[i]["text"] for i in ids)
        parts = [(i, self.by_id[i]["text"]) for i in ids]
        asr = w2v = self.eng.asr(y)
        res = asr_check.check(expected, asr)
        engine = "wav2vec2"
        blame_text = w2v
        w = None
        if not res["pass"] and res["cer"] <= WHISPER_MAX_CER:
            w = self.eng.whisper(y)
            if w is not None:
                rw = asr_check.check(expected, w)
                if rw["pass"]:
                    res, asr, engine = rw, w, "whisper"
                elif rw["cer"] < res["cer"]:
                    blame_text = w  # blame from the transcript that heard the most
        att = asr_check.attribute(parts, asr if res["pass"] else blame_text)
        out = {"ids": ids, "expected": expected, "asr": asr, "cer": res["cer"], "pass": res["pass"],
               "nums_ok": res["nums_ok"], "att": att, "engine": engine, "asr_w2v": w2v}
        self.comp_cache[key] = out
        log.info(f"  sammensat {' + '.join(ids)}: '{asr}' CER {res['cer']:.3f} ({engine}"
                 + (f", wav2vec2: '{w2v}'" if engine != "wav2vec2" else "")
                 + (f", whisper: '{w}'" if w is not None and engine != "whisper" else "")
                 + f") → {'ok' if res['pass'] else 'FEJL'}")
        return out

    @staticmethod
    def blamed(res: dict) -> set[str]:
        """Clips the failure of a composition is attributed to."""
        if res["pass"]:
            return set()
        att = res["att"]
        bad = {i for i, a in att.items() if a["errors"] >= 2 or (a["chars"] and a["errors"] / a["chars"] >= BLAME_RATE)}
        if not bad:
            worst = max(att.values(), key=lambda a: a["errors"])["errors"]
            bad = {i for i, a in att.items() if a["errors"] == worst and worst > 0}
        return bad or set(att)

    def usable_takes(self, clip: dict) -> list[Take]:
        return [t for t in self.takes(clip) if t.pass_a and not t.comp_fail and not t.qa_fail]

    def evaluate(self, clip: dict, t: Take, comps: list[list[str]]) -> list[dict]:
        cid = clip["id"]
        return [self.eval_comp(ids, {i: (self.load_cand(t) if i == cid else self.partner_audio(i)) for i in ids})
                for ids in comps]

    def composition_stage(self, subjects: list[dict]) -> None:
        """Check subjects in compositions and retake what the compositions blame.

        Every failing composition marks someone: the subject's take when ASR misheard the subject's
        own characters, otherwise the partner's take (a partner from an earlier run cannot be
        changed and is avoided instead). Marked clips get a new take, so the loop ends when every
        subject has passed or used its takes.
        """
        pending = {c["id"]: c for c in subjects}
        verdict: dict[str, tuple[Take, dict]] = {}
        for rnd in range(1, MAX_COMP_ROUNDS + 1):
            # partners play the take their own check chose (verdict), otherwise their best take
            self.choice = {cid: verdict[cid][0] if cid in verdict else self.best(self.by_id[cid])
                           for cid in self.sel_ids if self.takes(self.by_id[cid])}
            changed = False
            for cid, clip in sorted(pending.items()):
                if cid in verdict:
                    continue
                comps = self.comps_for(clip)
                cands = self.usable_takes(clip)
                if not comps or not cands:
                    continue  # partners not ready, none will ever exist, or a new take is needed first
                scored = []
                for t in cands:
                    results = self.evaluate(clip, t, comps)
                    n_ok = sum(r["pass"] for r in results)
                    scored.append((n_ok == len(results), n_ok, -sum(r["cer"] for r in results), -t.take, t, results))
                scored.sort(key=lambda x: x[:4], reverse=True)
                if scored[0][0]:
                    verdict[cid] = (scored[0][4], self.comp_summary(scored[0][5]))
                    self.choice[cid] = scored[0][4]
                    continue
                for rank, (_ok, _n, _c, _t, tk, results) in enumerate(scored):
                    own_fault = False
                    for r in results:
                        bad = self.blamed(r)
                        own_fault |= cid in bad
                        if rank > 0 or cid in bad:
                            continue
                        for p in bad:  # only the partners are blamed for this composition
                            cur = self.choice.get(p)
                            if p in self.pending_ids and cur is not None and not cur.comp_fail:
                                log.info(f"  {p} t{cur.take} får skylden i {' + '.join(r['ids'])}")
                                self.state.mark(cur, "comp_fail")
                                verdict.pop(p, None)
                                changed = True
                            elif p not in self.pending_ids:
                                log.info(f"  master {p} får skylden i {' + '.join(r['ids'])}; {cid} prøver en anden partner")
                                self.avoid.setdefault(cid, set()).add(p)
                                changed = True
                    if own_fault:
                        self.state.mark(tk, "comp_fail")
                        changed = True
            for cid in list(verdict):
                if verdict[cid][0].comp_fail:  # blamed later as somebody's partner
                    del verdict[cid]
            for cid in sorted(pending):  # new takes for subjects without a usable take
                clip = self.by_id[cid]
                if cid in verdict or self.usable_takes(clip):
                    continue
                nt = self.next_take(clip)
                if nt is not None and self.time_left():
                    self.run_job(single_job(clip, nt))
                    changed = True
            log.info(f"sammensætning runde {rnd}: {len(verdict)} af {len(pending)} bestået")
            if not changed:
                break
        for cid, clip in sorted(pending.items()):
            if cid in verdict:
                t, summary = verdict[cid]
                self.finalize(clip, t, True, summary)
                self.pending_ids.discard(cid)
                continue
            comps = self.comps_for(clip)
            if comps == []:  # no partner will ever exist (a lone --ids run): phase A decides
                t = self.best(clip)
                if t is not None and (t.pass_a or self.next_take(clip) is None):
                    self.finalize(clip, t, t.pass_a, {"n": 0, "note": "ingen partnere"}, t.reason)
                    self.pending_ids.discard(cid)
                continue
            if self.next_take(clip) is None and not self.usable_takes(clip):
                t = self.best_by_comp(clip, comps)
                if t is None:
                    self.finalize_missing(clip)
                else:
                    results = self.evaluate(clip, t, comps) if comps else []
                    self.finalize(clip, t, False, self.comp_summary(results) if results else None,
                                  "sammensætning" if t.pass_a else t.reason)
                self.pending_ids.discard(cid)

    def best_by_comp(self, clip: dict, comps) -> Take | None:
        takes = [t for t in self.takes(clip) if t.post_ok and not t.qa_fail]
        if not takes or not comps:
            return self.best(clip)
        scored = []
        for t in takes:
            res = [self.eval_comp(ids, {i: (self.load_cand(t) if i == clip["id"] else self.partner_audio(i)) for i in ids})
                   for ids in comps]
            scored.append((sum(r["pass"] for r in res), -sum(r["cer"] for r in res), t.pass_a, -t.take, t))
        return max(scored, key=lambda s: s[:4])[-1]

    @staticmethod
    def comp_summary(results: list[dict]) -> dict:
        first = results[0]
        return {"n": len(results), "pass": sum(r["pass"] for r in results),
                "cer": round(sum(r["cer"] for r in results) / len(results), 4),
                "asr": first["asr"], "expected": first["expected"], "ids": first["ids"],
                "engine": first["engine"], "asrWav2vec2": first["asr_w2v"] if first["engine"] != "wav2vec2" else None}

    # --- main loop ---
    def run(self) -> int:
        todo = [c for c in self.selected if self.final(c["id"]) is None]
        log.info(f"{len(self.selected)} klip valgt, {len(self.selected) - len(todo)} færdige, {len(todo)} at lave")
        # Clips with the same generator text share one master ("guld" is the gold colour of 17 species).
        rest, leaders = [], {}
        for c in todo:
            src = self.master_for_hash(c["hash"], c["id"])
            if src is not None:
                if not self.args.dry_run:
                    self.copy_master(c, src)
            elif c["hash"] in leaders:
                self.followers[c["id"]] = leaders[c["hash"]]
            else:
                leaders[c["hash"]] = c["id"]
                rest.append(c)
        todo = rest
        self.pending_ids = {c["id"] for c in todo}
        fresh = [c for c in todo if not self.takes(c)]
        queue = initial_jobs(fresh)
        # resume: clips with takes but no usable one get their next take
        for c in todo:
            if self.takes(c) and not any(t.pass_a and not t.comp_fail and not t.qa_fail for t in self.takes(c)):
                nt = self.next_take(c)
                if nt is not None:
                    queue.append(single_job(c, nt))
        if self.args.dry_run:
            for j in queue:
                print(f"{j.method:8} t{j.take} k={len(j.items):2}  {j.text}")
            print(f"{len(queue)} kald")
            return 0
        while queue and self.time_left():
            job = queue.pop(0)
            for t in self.run_job(job):
                clip = self.by_id[t.id]
                if t.pass_a and not P.needs_composition(clip):
                    if t.id in self.pending_ids:
                        self.finalize(clip, t, True)
                        self.pending_ids.discard(t.id)
                elif not t.pass_a and not any(x.pass_a for x in self.takes(clip)):
                    nt = self.next_take(clip)
                    if nt is not None and not any(j.items[0].clip["id"] == t.id for j in queue if len(j.items) == 1):
                        queue.append(single_job(clip, nt))
                    elif nt is None and not P.needs_composition(clip):
                        b = self.best(clip)
                        if b is None:
                            self.finalize_missing(clip)
                        else:
                            self.finalize(clip, b, False, reason=b.reason)
                        self.pending_ids.discard(t.id)
        # clips that passed earlier (before a restart) but were never finalized
        for cid in sorted(self.pending_ids):
            clip = self.by_id[cid]
            t = self.best(clip)
            if t is not None and t.pass_a and not P.needs_composition(clip):
                self.finalize(clip, t, True)
                self.pending_ids.discard(cid)
        subjects = [self.by_id[cid] for cid in sorted(self.pending_ids) if P.needs_composition(self.by_id[cid])]
        if subjects and not queue:
            self.composition_stage(subjects)
        for cid, leader in sorted(self.followers.items()):
            if self.final(leader) is not None and self.final(leader).get("file"):
                self.copy_master(self.by_id[cid], leader)
            else:
                self.pending_ids.add(cid)
        left = len(self.pending_ids)
        s = self.stats
        log.info(f"færdig: {s['final']} nye mastere ({s['failed']} ikke bestået, {s['copied']} kopier), {s['calls']} modelkald, "
                 f"{s['wall_s'] / 60:.1f} min generering (CPU {s['cpu_s'] / 3600:.2f} t), {left} klip mangler")
        if left == 0:
            return 0
        return 3 if (s["takes"] or s["final"]) else 4


# ─── Selection, retakes and status ───────────────────────────────────────────

def select(inv: dict, args) -> list[dict]:
    clips = inv["clips"]
    if args.wave:
        clips = [c for c in clips if c["wave"] == args.wave]
    if args.pack:
        packs = set(args.pack.split(","))
        clips = [c for c in clips if c["pack"] in packs]
    ids: set[str] = set()
    if args.ids:
        ids |= {i.strip() for i in args.ids.split(",") if i.strip()}
    if args.ids_file:
        ids |= {line.strip() for line in Path(args.ids_file).read_text().splitlines() if line.strip()}
    if ids:
        known = {c["id"] for c in inv["clips"]}
        unknown = sorted(ids - known)
        if unknown:
            raise SystemExit(f"ukendte klip-id'er: {', '.join(unknown[:10])}")
        clips = [c for c in clips if c["id"] in ids]
    return clips


def apply_retakes(inv: dict, path: str) -> list[str]:
    """Clips the composition test (voice/qa.json "retake") blamed: their master take is marked and
    the clip is generated again, while takes remain."""
    qa = json.loads(Path(path).read_text(encoding="utf-8"))
    ids = qa.get("retake", [])
    by_id = {c["id"]: c for c in inv["clips"]}
    state = State(P.WORK / "state.jsonl")
    index = P.load_index()
    retaken: list[str] = []
    # a copy is retaken through the clip it copies; every copy of a retaken master is made again
    ids = list(dict.fromkeys(index["clips"].get(i, {}).get("copyOf") or i for i in ids))
    for cid in ids:
        for other, oe in list(index["clips"].items()):
            if oe.get("copyOf") == cid:
                del index["clips"][other]
                retaken.append(other)
    for cid in ids:
        clip, e = by_id.get(cid), index["clips"].get(cid)
        if clip is None or e is None or e.get("hash") != clip["hash"]:
            continue
        takes = state.of(clip)
        cur = next((t for t in takes if t.take == e["take"]), None)
        if cur is None or max(t.take for t in takes) >= P.MAX_TAKE:
            log.info(f"{cid}: ingen takes tilbage til en ny take")
            continue
        state.mark(cur, "qa_fail")
        del index["clips"][cid]
        retaken.append(cid)
        log.info(f"{cid}: take {cur.take} afvist af sammensætningstesten, genereres igen")
    P.save_index(index)
    return retaken


def status(inv: dict, clips: list[dict]) -> None:
    index = P.load_index()["clips"]
    rows: dict[int, list[int]] = {}
    cpu = wall = 0.0
    for c in clips:
        e = index.get(c["id"])
        r = rows.setdefault(c["wave"], [0, 0, 0, 0])
        r[0] += 1
        if e and e.get("hash") == c["hash"]:
            r[1 if e.get("pass") else 2] += 1
            cpu += e.get("cpuS", 0.0)
            wall += e.get("wallS", 0.0)
        else:
            r[3] += 1
    for w, (n, ok, bad, left) in sorted(rows.items()):
        print(f"bølge {w}: {n} klip — {ok} bestået, {bad} ikke bestået (bedste take), {left} mangler")
    print(f"generering for de færdige klip: {wall / 3600:.2f} t (CPU {cpu / 3600:.2f} t)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--wave", type=int, default=0)
    ap.add_argument("--pack", default="")
    ap.add_argument("--ids", default="")
    ap.add_argument("--ids-file", default="")
    ap.add_argument("--max-minutes", type=float, default=100.0)
    ap.add_argument("--threads", type=int, choices=[2, 4], default=2)
    ap.add_argument("--no-whisper", action="store_true", help="ingen second opinion")
    ap.add_argument("--retake-from", default="", help="voice/qa.json: klip som sammensætningstesten pegede på")
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    inv = P.inventory()
    clips = select(inv, args)
    if args.status:
        status(inv, clips)
        return 0
    # Background work: lowest priority and a fixed thread count, also when started without nice.
    try:
        os.nice(19 - os.nice(0))
    except OSError:
        pass
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    os.environ.setdefault("TQDM_DISABLE", "1")
    for var in ("OMP_NUM_THREADS", "MKL_NUM_THREADS"):
        os.environ[var] = str(args.threads)
    logfile = P.setup_logging("generate", to_file=not args.dry_run)
    log.info(f"generate.py {' '.join(sys.argv[1:])}" + (f" (log: {logfile})" if logfile else ""))
    if args.retake_from:
        retaken = set(apply_retakes(inv, args.retake_from))
        # a blamed clip may belong to an earlier wave: it is generated again in this run
        clips += [c for c in inv["clips"] if c["id"] in retaken and c not in clips]
    if not clips:
        log.info("ingen klip valgt")
        return 0
    return Generator(args, inv, clips).run()


if __name__ == "__main__":
    sys.exit(main())
