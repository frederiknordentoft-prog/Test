"""Sammensætning af klip som i appen: Python-udgave af `src/audio/sequence.ts` og mellemrummene fra
`src/speech/compile.ts` (GAP_MS). Ren numpy, så modulet virker i både /opt/tv2-tts og /opt/tv2-asr.

generate.py bruger den til at tjekke korte klip og delte fragmenter i sammensætning, mens de
genereres. Den endelige kontrol (`scripts/voice/render.ts`) bruger selve TypeScript-koden; de to
sammenlignes i valideringen (docs/voice.md).

Klippets hørbare grænser er første og sidste sample ≥ −45 dBFS. Mellemrummet mellem to klip er
stilheden mellem det ene klips hørbare slutning og det næstes hørbare start. Hver kilde starter
PRE_MS før sin hørbare start og stopper POST_MS efter sin hørbare slutning.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

THRESHOLD_DBFS = -45.0
SEARCH_MS = 60.0
PRE_MS = 4.0
POST_MS = 8.0
GAP_MS = {"seam": 20, "bound": 30, "phrase": 40, "mid": 120, "sentence": 250}


def _round(x: float) -> int:
    """JavaScript Math.round (halves round up), so sample positions match the TypeScript code."""
    return int(math.floor(x + 0.5))


@dataclass
class Bounds:
    onset_ms: float
    offset_ms: float


@dataclass
class PlannedClip:
    id: str
    start_ms: float
    buffer_offset_ms: float
    dur_ms: float
    onset_ms: float
    offset_ms: float


def find_bounds(samples: np.ndarray, sr: int, start_ms: float, end_ms: float, lead_ms: float = 20.0,
                tail_ms: float = 40.0, search_ms: float = SEARCH_MS,
                threshold_dbfs: float = THRESHOLD_DBFS) -> Bounds:
    """Port of findBounds(): audible bounds within ±search_ms of the nominal span."""
    thr = 10 ** (threshold_dbfs / 20)
    n = len(samples)

    def to_index(ms: float) -> int:
        return min(n, max(0, _round(ms * sr / 1000)))

    def to_ms(i: int) -> float:
        return i * 1000 / sr

    nominal_onset = start_ms + lead_ms
    nominal_offset = max(nominal_onset, end_ms - tail_ms)
    loud = np.abs(np.asarray(samples)) >= thr

    onset = nominal_onset
    a, b = to_index(start_ms - search_ms), to_index(min(nominal_onset + search_ms, nominal_offset))
    if b > a:
        hit = np.flatnonzero(loud[a:b])
        if len(hit):
            onset = to_ms(a + int(hit[0]))

    offset = nominal_offset
    hi, lo = to_index(end_ms + search_ms), to_index(max(nominal_offset - search_ms, onset))
    if hi > lo:
        hit = np.flatnonzero(loud[lo:hi])
        if len(hit):
            offset = to_ms(lo + int(hit[-1]) + 1)
    return Bounds(onset, max(onset, offset))


def plan_sequence(ids: list[str], bounds: list[Bounds], gaps_ms: list[float],
                  pre_ms: float = PRE_MS, post_ms: float = POST_MS) -> tuple[list[PlannedClip], float]:
    """Port of planSequence(): clip i+1's onset is clip i's offset plus gaps_ms[i]."""
    clips: list[PlannedClip] = []
    onset = 0.0
    for i, (cid, b) in enumerate(zip(ids, bounds)):
        pre = min(pre_ms, b.onset_ms)
        if i == 0:
            onset = pre
        audible = max(0.0, b.offset_ms - b.onset_ms)
        clips.append(PlannedClip(cid, onset - pre, b.onset_ms - pre, pre + audible + post_ms, onset, onset + audible))
        onset += audible + (gaps_ms[i] if i < len(gaps_ms) else 0)
    total = clips[-1].start_ms + clips[-1].dur_ms if clips else 0.0
    return clips, total


def render_sequence(clips: list[PlannedClip], total_ms: float, source, sr: int) -> np.ndarray:
    """Port of renderSequence(): mixes the plan into one mono buffer."""
    out = np.zeros(int(math.ceil(total_ms * sr / 1000)), dtype=np.float32)
    for c in clips:
        src = np.asarray(source(c.id), dtype=np.float32)
        at = _round(c.start_ms * sr / 1000)
        frm = _round(c.buffer_offset_ms * sr / 1000)
        n = _round(c.dur_ms * sr / 1000)
        k0 = max(0, -frm)  # j = frm + k must be ≥ 0
        k1 = min(n, len(src) - frm, len(out) - at)
        if k1 > k0:
            out[at + k0:at + k1] += src[frm + k0:frm + k1]
    return out


def gap_after(prev: dict, nxt: dict) -> int:
    """compile.ts gapAfter() from the inventory fields `cls` and `opens` of two clips."""
    cls = prev["cls"]
    if cls == "seam":
        return GAP_MS["seam"]
    if cls == "end" or nxt["opens"]:
        return GAP_MS["sentence"]
    if nxt["id"].startswith("noun."):
        return GAP_MS["bound"]
    return GAP_MS["mid"] if cls == "mid" else GAP_MS["phrase"]


def compose(ids: list[str], inventory: dict[str, dict], audio: dict[str, np.ndarray], sr: int = 24000,
            lead_ms: float = 20.0, tail_ms: float = 40.0) -> np.ndarray:
    """Render a clip sequence from standalone clip buffers exactly as the runtime plans it."""
    gaps = [gap_after(inventory[a], inventory[b]) for a, b in zip(ids, ids[1:])]
    bounds = [find_bounds(audio[i], sr, 0.0, len(audio[i]) * 1000 / sr, lead_ms, tail_ms) for i in ids]
    clips, total = plan_sequence(ids, bounds, gaps)
    return render_sequence(clips, total, lambda cid: audio[cid], sr)


def _selftest() -> None:
    sr = 24000

    def tone(total_ms, on_ms, off_ms, amp=0.3, hz=440.0):
        out = np.zeros(_round(total_ms * sr / 1000), dtype=np.float32)
        a, b = _round(on_ms * sr / 1000), _round(off_ms * sr / 1000)
        i = np.arange(a, b)
        out[a:b] = amp * np.sin(2 * np.pi * hz * (i - a) / sr + np.pi / 2)
        return out

    clips, total = plan_sequence(["a", "b", "c"], [Bounds(20, 520), Bounds(1000, 1300), Bounds(2000, 2100)], [20, 250])
    assert clips[0].start_ms == 0 and clips[0].onset_ms == PRE_MS and clips[0].buffer_offset_ms == 16
    assert clips[1].onset_ms == clips[0].offset_ms + 20 and clips[2].onset_ms == clips[1].offset_ms + 250
    assert clips[2].dur_ms == PRE_MS + 100 + POST_MS and total == clips[2].offset_ms + POST_MS
    b = find_bounds(tone(1000, 120, 660), sr, 100, 700)
    assert abs(b.onset_ms - 120) < 0.5 and abs(b.offset_ms - 660) < 0.5, b
    for shift in (-50, -20, 0, 25, 47, 58):
        b = find_bounds(tone(1200, 220 + shift, 760 + shift), sr, 200, 800)
        assert abs(b.onset_ms - 220 - shift) < 0.5 and abs(b.offset_ms - 760 - shift) < 0.5, (shift, b)
    b = find_bounds(np.zeros(sr, dtype=np.float32), sr, 100, 700)
    assert (b.onset_ms, b.offset_ms) == (120, 660)
    src = {"a": tone(800, 20, 520, hz=300), "b": tone(800, 20, 320, hz=500)}
    bounds = [find_bounds(src["a"], sr, 0, 560), find_bounds(src["b"], sr, 0, 360)]
    clips, total = plan_sequence(["a", "b"], bounds, [120])
    out = render_sequence(clips, total, lambda i: src[i], sr)
    loud = np.flatnonzero(np.abs(out) >= 10 ** (-45 / 20))
    assert abs(loud[0] * 1000 / sr - clips[0].onset_ms) < 0.5 and abs((loud[-1] + 1) * 1000 / sr - clips[1].offset_ms) < 0.5
    print("sequence ok")


if __name__ == "__main__":
    _selftest()
