// "Polar Night" (Suno) — measured cut of the base-bed loop. Source: assets-src/polar-night.mp3 (188.06 s,
// 48 kHz stereo MPEG-1 L3 ≈ 178 kbps VBR, LAME/Lavc tag: 576 delay, 1344 padding). The bundled file
// src/audio/assets/polar-night-loop.mp3 is original MPEG frames [3767, 5902) copied verbatim (no ID3, no
// Xing/LAME frame): 1 bar of pre-roll (decoder priming: bit reservoir + MDCT overlap settle after 2 frames)
// + 16 bars + 1 bar of tail.
//
// Measurement (headless Chromium decode, harmonic + onset analysis):
//  · Chord-change grid from bass/treble chroma (homogeneity fit over the whole track): 85.18 BPM. The
//    harmonic rhythm is 1–2 bars per chord (D aeolian: Dm C F C/E Gm Dm C C Dm C F Gm Dm Am B♭ C in the
//    loop), not the one-chord-per-bar Dm9–B♭maj9–Fmaj9–C6/9 cycle of the prompt.
//  · Downbeats: the track has soft note attacks on most bar lines. Regression of 15 downbeat onsets over
//    the loop section: T = 2.81685 ± 0.00028 s/bar → 85.202 ± 0.008 BPM, residual 6 ms (whole track:
//    85.225 BPM). The attack starts ≈ 6 ms after the fitted bar line, so the loop seam sits just before it.
//  · Section: original 93.4719 – 138.5415 s (bars 33–48 of the track; bar 33 = Dm, bar 49 = Dm again),
//    chosen for the steadiest level (16 bars within 1.9 dB, 400 ms K-weighted) and its B♭–C–Dm cadence
//    back into the loop start.
// Times below are seconds within the cut file as decoded (cut sample 0 = original 90.384979 s).
export const POLAR_LOOP = {
  /** Cut-file frames decoded by Chromium at 48 kHz (2135 MPEG frames × 1152, nothing trimmed). */
  decodedFrames: 2459520,
  decodedRate: 48000,
  bars: 16,
  /** Measured tempo of the section (the engine's BASE_BPM is rounded from this). */
  bpm: 85.202,
  /** Downbeat of loop bar 1 (Dm) = cut frame 148172 @ 48 kHz. */
  loopStart: 3.086917,
  /** Downbeat of bar 17 (Dm, the recording's own continuation) = cut frame 2311513 @ 48 kHz. The runtime
   *  loop is exactly `bars` engine bars long (1.06 ms longer than this at BASE_BPM 85.2), so it never drifts
   *  from the scheduler grid. */
  loopEnd: 48.156521,
  /** Equal-power crossfade (s) ending at the wrap: the last beat of bar 16 blends into the pre-roll (the
   *  recording's own lead-in to bar 1), so the seam is sample-continuous and the bar-1 attack stays intact. */
  xfade: 0.7,
  /** Level trim to the procedural base0 bed it replaces, matched as played (bed + reverb send, K-weighted):
   *  the dry loop is −16.5 LUFS (base0 −18.5); the recording's heavier low end feeds the 240 Hz high-passed
   *  reverb send less, so it sits 0.8 dB above a dry match. Peak after trim −6.9 dBFS. */
  gainDb: -1.2,
} as const;
