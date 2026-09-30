#!/usr/bin/env python3
"""Efterbehandling af TTS-klip (SPEC §10.3, kunst-lyd-teknik §5.5).

Kæde: highpass 70 Hz → trim ved −45 dBFS (20 ms før, 40 ms efter) → fade 5/10 ms →
loudness efter BS.1770 (klip under 0,4 s polstres kun til målingen) → gain til
−18 LUFS → true-peak-limiter ved −1,5 dBTP. Output: 24 kHz mono.

Accept: −18 ± 1 LU, true peak ≤ −1,0 dBTP, ingen clipping.

Afhænger kun af numpy, scipy og pyloudnorm (findes i både /opt/tv2-tts og
/opt/tv2-asr). Brug som modul (`process`, `measure`, `concat`) eller fra CLI:

  python post.py IND.wav UD.wav        # efterbehandl ét klip
  python post.py --measure A.wav ...   # mål LUFS/true peak/varighed
"""
from __future__ import annotations

import json
import math
import sys
from dataclasses import asdict, dataclass

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.ndimage import minimum_filter1d
from scipy.signal import butter, resample_poly, sosfiltfilt

SR = 24000
HP_HZ = 70.0
TRIM_DBFS = -45.0
TRIM_PRE_MS = 20.0
TRIM_POST_MS = 40.0
FADE_IN_MS = 5.0
FADE_OUT_MS = 10.0
TARGET_LUFS = -18.0
LIMIT_DBTP = -1.5
MIN_MEASURE_S = 0.4
ACCEPT_LU = 1.0
ACCEPT_TP = -1.0


@dataclass
class Stats:
    dur: float          # sekunder efter efterbehandling
    speech_dur: float   # varighed mellem første og sidste sample over trim-tærsklen
    lufs: float
    true_peak_db: float
    sample_peak_db: float
    gain_db: float
    limited_db: float   # største gain-reduktion i limiteren
    clipped: bool
    ok: bool


def _mono(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 2:
        x = x.mean(axis=1)
    return x


def resample(x: np.ndarray, sr_in: int, sr_out: int = SR) -> np.ndarray:
    if sr_in == sr_out:
        return x
    g = math.gcd(sr_in, sr_out)
    return resample_poly(x, sr_out // g, sr_in // g)


def highpass(x: np.ndarray, sr: int = SR, fc: float = HP_HZ) -> np.ndarray:
    sos = butter(2, fc, btype="highpass", fs=sr, output="sos")
    if len(x) <= 30:
        return x
    return sosfiltfilt(sos, x)


def _rms_env(x: np.ndarray, sr: int, win_ms: float = 5.0) -> np.ndarray:
    win = max(1, int(sr * win_ms / 1000))
    half = win // 2
    c = np.concatenate([[0.0], np.cumsum(x * x)])
    n = len(x)
    idx = np.arange(n)
    lo = np.clip(idx - half, 0, n)
    hi = np.clip(idx + half + 1, 0, n)
    return np.sqrt((c[hi] - c[lo]) / np.maximum(hi - lo, 1))


def speech_bounds(x: np.ndarray, sr: int = SR, thresh_db: float = TRIM_DBFS):
    """(første, sidste+1) sample hvor 5 ms-RMS er over tærsklen, ellers None."""
    env = _rms_env(x, sr)
    above = np.nonzero(env > 10 ** (thresh_db / 20))[0]
    if len(above) == 0:
        return None
    return int(above[0]), int(above[-1]) + 1


def trim(x: np.ndarray, sr: int = SR, thresh_db: float = TRIM_DBFS,
         pre_ms: float = TRIM_PRE_MS, post_ms: float = TRIM_POST_MS) -> np.ndarray:
    b = speech_bounds(x, sr, thresh_db)
    if b is None:
        return x
    s = max(0, b[0] - int(sr * pre_ms / 1000))
    e = min(len(x), b[1] + int(sr * post_ms / 1000))
    return x[s:e]


def fade(x: np.ndarray, sr: int = SR, in_ms: float = FADE_IN_MS,
         out_ms: float = FADE_OUT_MS) -> np.ndarray:
    x = x.copy()
    nin = min(len(x), int(sr * in_ms / 1000))
    nout = min(len(x), int(sr * out_ms / 1000))
    if nin:
        x[:nin] *= np.sin(0.5 * np.pi * (np.arange(nin) + 0.5) / nin) ** 2
    if nout:
        x[-nout:] *= np.cos(0.5 * np.pi * (np.arange(nout) + 0.5) / nout) ** 2
    return x


def lufs(x: np.ndarray, sr: int = SR) -> float:
    """Integreret loudness (BS.1770-4). Korte klip polstres med stilhed til 0,4 s."""
    need = int(math.ceil(MIN_MEASURE_S * sr)) + 1
    if len(x) < need:
        x = np.concatenate([x, np.zeros(need - len(x))])
    return float(pyln.Meter(sr).integrated_loudness(x))


def true_peak_db(x: np.ndarray, os: int = 4) -> float:
    if len(x) == 0:
        return -math.inf
    y = resample_poly(x, os, 1)
    return float(20 * np.log10(max(np.max(np.abs(y)), 1e-12)))


def limit(x: np.ndarray, sr: int = SR, ceiling_db: float = LIMIT_DBTP, os: int = 4,
          lookahead_ms: float = 1.5, release_ms: float = 60.0):
    """Look-ahead true-peak-limiter. Returnerer (signal, største reduktion i dB)."""
    ceil = 10 ** (ceiling_db / 20)
    worst = 0.0
    for _ in range(4):
        up = resample_poly(x, os, 1)
        env = np.abs(up[: len(x) * os]).reshape(-1, os).max(axis=1)
        g = np.minimum(1.0, ceil / np.maximum(env, 1e-12))
        if g.min() >= 0.9999:
            break
        L = max(1, int(sr * lookahead_ms / 1000))
        gm = minimum_filter1d(g, size=2 * L + 1, mode="nearest")
        k = np.ones(2 * L + 1) / (2 * L + 1)
        gb = np.convolve(np.pad(gm, L, mode="edge"), k, mode="valid")
        a = 1.0 - math.exp(-1.0 / (sr * release_ms / 1000))
        gs = np.empty_like(gb)
        cur = 1.0
        for i, v in enumerate(gb):  # øjeblikkelig attack (via look-ahead), jævn release
            cur = v if v < cur else cur + (min(v, 1.0) - cur) * a
            gs[i] = cur
        worst = min(worst, float(20 * np.log10(max(gs.min(), 1e-12))))
        x = x * gs
        ceil *= 0.995  # lille ekstra margen, hvis endnu en runde er nødvendig
    return x, -worst


def process(x: np.ndarray, sr: int, *, trim_silence: bool = True, hp: bool = True):
    """Hele kæden. Returnerer (float32-signal ved 24 kHz, Stats).

    hp=False springer highpass over (når signalet allerede er filtreret, fx udklip
    fra en batch der er filtreret samlet).
    """
    x = _mono(x)
    x = resample(x, sr, SR)
    if hp:
        x = highpass(x, SR)
    # Trim-tærsklen gælder det loudness-normaliserede niveau (samme niveau som
    # masteren), så resultatet ikke afhænger af generatorens råniveau.
    pre = lufs(x)
    g0 = 10 ** ((TARGET_LUFS - pre) / 20) if math.isfinite(pre) else 1.0
    if trim_silence:
        b = speech_bounds(x * g0, SR)
        if b is not None:
            s = max(0, b[0] - int(SR * TRIM_PRE_MS / 1000))
            e = min(len(x), b[1] + int(SR * TRIM_POST_MS / 1000))
            x = x[s:e]
    x = fade(x, SR)
    loud = lufs(x)
    gain_db = TARGET_LUFS - loud if math.isfinite(loud) else 0.0
    # Talesyntese har typisk 17–21 dB fra loudness til peak, mens −18 LUFS/−1,5 dBTP
    # kun giver plads til 16,5 dB. Limiteren tager derfor lidt af niveauet; gain
    # efterjusteres, til loudness efter limiteren rammer målet (±0,2 LU).
    y, red = x, 0.0
    for _ in range(6):
        y, red = limit(x * 10 ** (gain_db / 20), SR)
        after = lufs(y)
        if not math.isfinite(after) or abs(after - TARGET_LUFS) <= 0.2:
            break
        gain_db += TARGET_LUFS - after
    y = np.clip(y, -1.0, 1.0)
    st = measure(y, SR)
    st.gain_db = round(gain_db, 2)
    st.limited_db = round(red, 2)
    return y.astype(np.float32), st


def measure(x: np.ndarray, sr: int = SR) -> Stats:
    x = _mono(x)
    L = lufs(x, sr)
    tp = true_peak_db(x)
    sp = float(20 * np.log10(max(np.max(np.abs(x)), 1e-12))) if len(x) else -math.inf
    clipped = bool(np.any(np.abs(x) >= 0.9999))
    b = speech_bounds(x, sr)
    sd = (b[1] - b[0]) / sr if b else 0.0
    ok = abs(L - TARGET_LUFS) <= ACCEPT_LU and tp <= ACCEPT_TP and not clipped
    return Stats(dur=round(len(x) / sr, 4), speech_dur=round(sd, 4), lufs=round(L, 2),
                 true_peak_db=round(tp, 2), sample_peak_db=round(sp, 2), gain_db=0.0,
                 limited_db=0.0, clipped=clipped, ok=ok)


def concat(clips: list[np.ndarray], gaps_ms: list[float], sr: int = SR) -> np.ndarray:
    """Sæt klip sammen med stilhed imellem (len(gaps_ms) == len(clips) - 1)."""
    assert len(gaps_ms) == max(len(clips) - 1, 0)
    parts: list[np.ndarray] = []
    for i, c in enumerate(clips):
        parts.append(np.asarray(c, dtype=np.float32))
        if i < len(gaps_ms):
            parts.append(np.zeros(int(round(sr * gaps_ms[i] / 1000)), dtype=np.float32))
    return np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)


def read(path: str):
    x, sr = sf.read(path, dtype="float64", always_2d=False)
    return _mono(x), sr


def write(path: str, x: np.ndarray, sr: int = SR) -> None:
    sf.write(path, np.asarray(x, dtype=np.float32), sr, subtype="PCM_16")


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "--measure":
        for p in argv[1:]:
            x, sr = read(p)
            print(p, json.dumps(asdict(measure(x, sr))))
        return 0
    if len(argv) != 2:
        print(__doc__)
        return 2
    x, sr = read(argv[0])
    y, st = process(x, sr)
    write(argv[1], y)
    print(json.dumps(asdict(st)))
    return 0 if st.ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
