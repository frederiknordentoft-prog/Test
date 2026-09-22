// Low-level DSP helpers for offline (OfflineAudioContext) synthesis: deterministic noise, envelopes,
// oscillators, saturation curves, the code-generated reverb IR and buffer post-processing
// (loop folding, normalisation, trimming). No runtime state; safe to import anywhere.
//
// Note on randomness: signal noise here is DSP, not cosmetic randomness — it uses a private seeded
// PRNG so renders are bit-identical and never consume the shared cosmetic stream (crand), which would
// otherwise make the visual screenshots depend on audio render timing.

export type Ctx = BaseAudioContext;

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const dbToGain = (db: number): number => Math.pow(10, db / 20);
export const gainToDb = (g: number): number => 20 * Math.log10(Math.max(1e-12, g));

/** mulberry32 → [0,1) */
export function prng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ buffers
const noiseCache = new WeakMap<Ctx, Map<string, AudioBuffer>>();
/** Seeded white-noise buffer (cached per context). */
export function noiseBuf(ctx: Ctx, seconds = 4, seed = 1, ch = 1): AudioBuffer {
  let m = noiseCache.get(ctx);
  if (!m) { m = new Map(); noiseCache.set(ctx, m); }
  const key = `${seconds}:${seed}:${ch}`;
  let b = m.get(key);
  if (!b) {
    const n = Math.max(1, Math.floor(seconds * ctx.sampleRate));
    b = ctx.createBuffer(ch, n, ctx.sampleRate);
    for (let c = 0; c < ch; c++) {
      const r = prng(seed * 7919 + c * 104729);
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    }
    m.set(key, b);
  }
  return b;
}

/** Looping noise source started at t0 (random offset), stopped at t1. */
export function noise(ctx: Ctx, t0: number, t1: number, seed = 1, seconds = 4, ch = 1): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf(ctx, seconds, seed, ch);
  s.loop = true;
  const off = (seed * 0.61803) % 1 * seconds;
  s.start(Math.max(0, t0), off);
  s.stop(Math.max(t0 + 0.001, t1));
  return s;
}

export function osc(ctx: Ctx, type: OscillatorType, f: number, t0: number, t1: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = detune;
  o.start(Math.max(0, t0));
  o.stop(Math.max(t0 + 0.001, t1));
  return o;
}

export function gain(ctx: Ctx, v = 1): GainNode {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

export function filt(ctx: Ctx, type: BiquadFilterType, f: number, Q = 0.707, gainDb = 0): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = Q;
  b.gain.value = gainDb;
  return b;
}

export function pan(ctx: Ctx, p: number): StereoPannerNode {
  const n = ctx.createStereoPanner();
  n.pan.value = Math.max(-1, Math.min(1, p));
  return n;
}

/** Chain nodes left→right; returns the last. */
export function chain(...nodes: AudioNode[]): AudioNode {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

// ------------------------------------------------------------------ envelopes
/** Percussive: 0 → peak (linear, `a` s) → exponential decay with time-constant `tau`. */
export function perc(p: AudioParam, t: number, peak: number, a: number, tau: number): void {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setTargetAtTime(0, t + a, tau);
}

/** Sustained: smooth attack (time-constant a), hold until t+dur, smooth release (time-constant r). */
export function swell(p: AudioParam, t: number, dur: number, peak: number, a: number, r: number): void {
  p.setValueAtTime(0, t);
  p.setTargetAtTime(peak, t, a);
  p.setTargetAtTime(0, t + dur, r);
}

/** Piecewise-linear envelope from [time, value] points (absolute times). */
export function lin(p: AudioParam, pts: [number, number][]): void {
  p.setValueAtTime(pts[0][1], pts[0][0]);
  for (let i = 1; i < pts.length; i++) p.linearRampToValueAtTime(pts[i][1], pts[i][0]);
}

/** Exponential glide of a frequency param from f0 to f1 over [t, t+d]. */
export function glide(p: AudioParam, t: number, f0: number, f1: number, d: number): void {
  p.setValueAtTime(f0, t);
  p.exponentialRampToValueAtTime(Math.max(1e-3, f1), t + Math.max(1e-3, d));
}

// ------------------------------------------------------------------ shaping
const curveCache = new Map<string, Float32Array<ArrayBuffer>>();
/** Normalised tanh saturation curve. drive 1 = gentle, 4 = hot. */
export function satCurve(drive: number, n = 2048): Float32Array<ArrayBuffer> {
  const key = `t${drive}:${n}`;
  let c = curveCache.get(key);
  if (!c) {
    c = new Float32Array(n);
    const k = Math.tanh(drive);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(x * drive) / k;
    }
    curveCache.set(key, c);
  }
  return c;
}
export function shaper(ctx: Ctx, drive: number, over: OverSampleType = '2x'): WaveShaperNode {
  const w = ctx.createWaveShaper();
  w.curve = satCurve(drive);
  w.oversample = over;
  return w;
}

// ------------------------------------------------------------------ voices
export interface BellOpts {
  ratio?: number;   // modulator ratio (3.5 = inharmonic glass)
  index?: number;   // peak FM index
  itau?: number;    // index decay time-constant
  tau?: number;     // amplitude decay time-constant
  body?: number;    // pure-sine fundamental level
  tine?: number;    // high tine partial level
  strike?: number;  // mallet noise level
  lp?: number;      // output low-pass
  seed?: number;
  detune?: number;  // cents
}
/** FM bell / glass voice (sine carrier, sine modulator at ratio × f). Mono into `out`. */
export function bell(ctx: Ctx, out: AudioNode, t: number, f: number, amp: number, o: BellOpts = {}): void {
  const ratio = o.ratio ?? 3.5, index = o.index ?? 1.6, itau = o.itau ?? 0.16, tau = o.tau ?? 0.55;
  const end = t + tau * 7 + 0.05;
  const lp = filt(ctx, 'lowpass', o.lp ?? 9000, 0.5);
  lp.connect(out);
  // FM pair
  const car = osc(ctx, 'sine', f, t, end, o.detune ?? 0);
  const mod = osc(ctx, 'sine', f * ratio, t, end, (o.detune ?? 0) + 1.5);
  const mg = gain(ctx, 0);
  const dev = index * f * ratio;
  mg.gain.setValueAtTime(dev, t);
  mg.gain.setTargetAtTime(dev * 0.12, t + 0.002, itau);
  mod.connect(mg).connect(car.frequency);
  const ag = gain(ctx, 0);
  perc(ag.gain, t, amp, 0.0025, tau);
  car.connect(ag).connect(lp);
  // warm body (pure fundamental rings longer)
  const body = o.body ?? 0.45;
  if (body > 0) {
    const b = osc(ctx, 'sine', f, t, end, o.detune ?? 0);
    const bg = gain(ctx, 0);
    perc(bg.gain, t, amp * body, 0.004, tau * 1.5);
    b.connect(bg).connect(lp);
  }
  // tine: glass-bar partial (2.756 ×) decays fast
  const tine = o.tine ?? 0.12;
  if (tine > 0 && f * 2.756 < ctx.sampleRate * 0.45) {
    const x = osc(ctx, 'sine', f * 2.756, t, t + 1.2);
    const xg = gain(ctx, 0);
    perc(xg.gain, t, amp * tine, 0.0015, tau * 0.3);
    x.connect(xg).connect(lp);
  }
  // soft mallet
  const strike = o.strike ?? 0.05;
  if (strike > 0) {
    const n = noise(ctx, t, t + 0.03, o.seed ?? 3);
    const hp = filt(ctx, 'bandpass', Math.min(ctx.sampleRate * 0.4, f * 4), 0.8);
    const ng = gain(ctx, 0);
    perc(ng.gain, t, amp * strike, 0.0008, 0.004);
    n.connect(hp).connect(ng).connect(lp);
  }
}

/** Additive glass-bar chime (free–free bar partials) with a short FM sparkle. */
export function chimeVoice(ctx: Ctx, out: AudioNode, t: number, f: number, amp: number, tau = 0.9): void {
  const lp = filt(ctx, 'lowpass', 11000, 0.5);
  lp.connect(out);
  const parts: [number, number, number][] = [[1, 1, 1], [2.756, 0.5, 0.45], [5.404, 0.26, 0.22], [2.0, 0.18, 0.7]];
  for (const [r, a, d] of parts) {
    if (f * r > ctx.sampleRate * 0.45) continue;
    for (const det of [-2.5, 2.5]) {
      const o = osc(ctx, 'sine', f * r, t, t + tau * d * 7 + 0.05, det);
      const g = gain(ctx, 0);
      perc(g.gain, t, amp * a * 0.5, 0.0015, tau * d);
      o.connect(g).connect(lp);
    }
  }
  // sparkle
  const car = osc(ctx, 'sine', f * 2, t, t + 0.6);
  const mod = osc(ctx, 'sine', f * 7, t, t + 0.6);
  const mg = gain(ctx, 0);
  mg.gain.setValueAtTime(f * 7 * 1.2, t);
  mg.gain.setTargetAtTime(0, t, 0.05);
  mod.connect(mg).connect(car.frequency);
  const ag = gain(ctx, 0);
  perc(ag.gain, t, amp * 0.16, 0.001, 0.08);
  car.connect(ag).connect(lp);
}

export interface GongOpts { tau?: number; bright?: number; strike?: number; sub?: number; seed?: number }
/** Inharmonic gong / tuned tam: beating partial pairs + noise strike. */
export function gong(ctx: Ctx, out: AudioNode, t: number, f: number, amp: number, o: GongOpts = {}): void {
  const tau = o.tau ?? 1.2, bright = o.bright ?? 1;
  const lp = filt(ctx, 'lowpass', 2500 + 5000 * bright, 0.5);
  lp.connect(out);
  const parts: [number, number, number][] = [
    [1, 1, 1], [1.505, 0.55, 0.8], [2.0, 0.45, 0.75], [2.76, 0.32 * bright, 0.55], [3.52, 0.22 * bright, 0.42], [4.32, 0.14 * bright, 0.32], [5.41, 0.1 * bright, 0.25],
  ];
  const r = prng(o.seed ?? 11);
  for (const [ratio, a, d] of parts) {
    const fr = f * ratio;
    if (fr > ctx.sampleRate * 0.45) continue;
    for (const det of [-3 - r() * 3, 3 + r() * 3]) {
      const x = osc(ctx, 'sine', fr, t, t + tau * d * 7 + 0.1, det);
      const g = gain(ctx, 0);
      perc(g.gain, t, amp * a * 0.5, 0.004 + r() * 0.004, tau * d);
      x.connect(g).connect(lp);
    }
  }
  const sub = o.sub ?? 0.3;
  if (sub > 0) {
    const s = osc(ctx, 'sine', f / 2, t, t + tau * 6);
    const g = gain(ctx, 0);
    perc(g.gain, t, amp * sub, 0.01, tau * 0.9);
    s.connect(g).connect(lp);
  }
  const st = o.strike ?? 0.25;
  if (st > 0) {
    const n = noise(ctx, t, t + 0.12, o.seed ?? 5);
    const bp = filt(ctx, 'bandpass', f * 3, 0.9);
    const g = gain(ctx, 0);
    perc(g.gain, t, amp * st, 0.001, 0.02);
    n.connect(bp).connect(g).connect(lp);
  }
}

export interface BrassOpts { a?: number; r?: number; bright?: number; det?: number; pan?: number; scoop?: number }
/**
 * Brass-like saw stack (3 detuned saws, pitch scoop). The filter "blat" is two STATIC low-passes
 * (bright + body) crossfaded by gain envelopes — cheap (no per-sample biquad coefficient updates).
 */
export function brass(ctx: Ctx, out: AudioNode, t: number, dur: number, f: number, amp: number, o: BrassOpts = {}): void {
  const a = o.a ?? 0.05, r = o.r ?? 0.35, bright = o.bright ?? 1, det = o.det ?? 7;
  const end = t + dur + r * 6;
  const src = gain(ctx, 1);
  const peakF = Math.min(ctx.sampleRate * 0.4, (900 + f * 5) * bright);
  const lpB = filt(ctx, 'lowpass', peakF, 0.9);
  const lpD = filt(ctx, 'lowpass', Math.min(ctx.sampleRate * 0.4, f * 2.4 + 250), 0.7);
  const gB = gain(ctx, 0), gD = gain(ctx, 0);
  // bright path blooms then settles (the "blat"); body path sustains
  gB.gain.setValueAtTime(0, t);
  gB.gain.linearRampToValueAtTime(0.75, t + a + 0.05);
  gB.gain.linearRampToValueAtTime(0.3, t + a + 0.4);
  gB.gain.linearRampToValueAtTime(0, t + dur + r);
  gD.gain.setValueAtTime(0.25, t);
  gD.gain.linearRampToValueAtTime(0.8, t + a + 0.3);
  src.connect(lpB).connect(gB);
  src.connect(lpD).connect(gD);
  const g = gain(ctx, 0);
  swell(g.gain, t, dur, amp, a / 2.5, r / 3);
  const pn = pan(ctx, o.pan ?? 0);
  gB.connect(g); gD.connect(g);
  g.connect(pn).connect(out);
  const scoop = o.scoop ?? -35;
  for (const d of [-det, 0, det]) {
    const x = osc(ctx, 'sawtooth', f, t, end, d + scoop);
    x.detune.setValueAtTime(d + scoop, t);
    x.detune.linearRampToValueAtTime(d, t + 0.07);
    const xg = gain(ctx, 0.33);
    x.connect(xg).connect(src);
  }
}

/** Formant "aah" voice: detuned saws with vibrato through three vocal formant band-passes. */
export function aah(ctx: Ctx, out: AudioNode, t: number, dur: number, f: number, amp: number, pn = 0, a = 0.18, r = 0.4, vowel: 'a' | 'o' = 'a'): void {
  const end = t + dur + r * 6;
  const F = vowel === 'a' ? [[730, 1, 6], [1150, 0.55, 7], [2650, 0.28, 9]] : [[520, 1, 6], [900, 0.5, 7], [2400, 0.18, 9]];
  const sum = gain(ctx, 1);
  const g = gain(ctx, 0);
  swell(g.gain, t, dur, amp, a, r / 3);
  const p = pan(ctx, pn);
  sum.connect(g).connect(p).connect(out);
  const src = gain(ctx, 1);
  for (const [ff, fa, q] of F) {
    const bp = filt(ctx, 'bandpass', ff, q);
    const bg = gain(ctx, fa * 2.2);
    src.connect(bp).connect(bg).connect(sum);
  }
  const vib = osc(ctx, 'sine', 5.1, t, end);
  const vg = gain(ctx, 0);
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(14, t + Math.min(0.6, dur));
  vib.connect(vg);
  for (const d of [-9, 0, 8]) {
    const x = osc(ctx, 'sawtooth', f, t, end, d);
    vg.connect(x.detune);
    const xg = gain(ctx, 0.33);
    x.connect(xg).connect(src);
  }
}

// ------------------------------------------------------------------ reverb IR
export interface IROpts { seconds: number; rt60: number; damp: number; pre: number; seed: number; er?: number; width?: number }
/**
 * Code-generated stereo IR: pre-delay, sparse early reflections, then decorrelated exponentially
 * decaying noise with frequency-dependent decay (high band decays `damp` × faster), energy-normalised
 * to unit power per channel (so send levels map directly to reverb loudness).
 */
export function makeIR(ctx: Ctx, o: IROpts): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(o.seconds * sr);
  const buf = ctx.createBuffer(2, n, sr);
  const pre = Math.floor(o.pre * sr);
  const a1 = 1 - Math.exp(-2 * Math.PI * 700 / sr);    // low/high split
  const a2 = 1 - Math.exp(-2 * Math.PI * 9000 / sr);   // gentle top roll-off
  const kLo = -6.9078 / (o.rt60 * sr);
  const kHi = -6.9078 / (o.rt60 * o.damp * sr);
  for (let c = 0; c < 2; c++) {
    const r = prng(o.seed * 31 + c * 977);
    const d = buf.getChannelData(c);
    let lp = 0, top = 0;
    for (let i = 0; i < n; i++) {
      const j = i - pre;
      if (j < 0) continue;
      const x = r() * 2 - 1;
      top += a2 * (x - top);
      lp += a1 * (top - lp);
      const hi = top - lp;
      const build = j < 0.03 * sr ? j / (0.03 * sr) : 1; // diffusion build-up
      d[i] = (lp * 1.6 * Math.exp(kLo * j) + hi * Math.exp(kHi * j)) * build;
    }
    // early reflections (distinct per channel → width)
    const er = o.er ?? 9;
    for (let k = 0; k < er; k++) {
      const tt = pre + Math.floor((0.006 + r() * 0.07) * sr);
      if (tt >= n - 3) continue;
      const amp = (0.9 - k * 0.07) * (r() < 0.5 ? -1 : 1) * 0.25;
      d[tt] += amp; d[tt + 1] += amp * 0.5; d[tt + 2] += amp * 0.2;
    }
    // fade the very end
    const fade = Math.floor(0.05 * sr);
    for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
    let e = 0;
    for (let i = 0; i < n; i++) e += d[i] * d[i];
    const s = 1 / Math.sqrt(Math.max(1e-12, e));
    for (let i = 0; i < n; i++) d[i] *= s;
  }
  // optional width control: mid/side blend
  const w = o.width ?? 1;
  if (w !== 1) {
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    for (let i = 0; i < n; i++) {
      const m = (L[i] + R[i]) * 0.5, sd = (L[i] - R[i]) * 0.5 * w;
      L[i] = m + sd; R[i] = m - sd;
    }
  }
  return buf;
}

// ------------------------------------------------------------------ post
export function newBuffer(ch: number, length: number, sampleRate: number): AudioBuffer {
  return new AudioBuffer({ numberOfChannels: ch, length: Math.max(1, length), sampleRate });
}

export function peakOf(b: AudioBuffer): number {
  let p = 0;
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > p) p = v; }
  }
  return p;
}
export function rmsOf(b: AudioBuffer): number {
  let e = 0, n = 0;
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < d.length; i++) e += d[i] * d[i];
    n += d.length;
  }
  return Math.sqrt(e / Math.max(1, n));
}
export function scale(b: AudioBuffer, k: number): void {
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
}

/**
 * One-shot post: remove DC, normalise to `peak`, trim trailing audio below `floorDb` (relative to peak)
 * and apply a short fade so the trimmed end is click-free.
 */
export function finishOneShot(b: AudioBuffer, peak: number, floorDb = -64): AudioBuffer {
  const ch = b.numberOfChannels, sr = b.sampleRate;
  // DC
  for (let c = 0; c < ch; c++) {
    const d = b.getChannelData(c);
    let m = 0;
    for (let i = 0; i < d.length; i++) m += d[i];
    m /= d.length;
    if (Math.abs(m) > 1e-6) for (let i = 0; i < d.length; i++) d[i] -= m;
  }
  const p = peakOf(b);
  if (p < 1e-9) return b;
  scale(b, peak / p);
  const thr = peak * Math.pow(10, floorDb / 20);
  let last = 0;
  for (let c = 0; c < ch; c++) {
    const d = b.getChannelData(c);
    for (let i = d.length - 1; i > last; i--) if (Math.abs(d[i]) > thr) { last = i; break; }
  }
  // Decayed below the floor → short 30 ms fade after the last audible sample; otherwise the render was
  // cut while still ringing → long (≤ 300 ms, ≤ 15 %) fade so the cut is a natural-sounding decay.
  const short = Math.floor(0.03 * sr);
  const ringing = last >= b.length - short - 1;
  const fade = ringing ? Math.min(Math.floor(0.3 * sr), Math.floor(b.length * 0.15)) : short;
  const len = Math.min(b.length, last + (ringing ? 0 : fade) + 1);
  const out = newBuffer(ch, len, sr);
  for (let c = 0; c < ch; c++) {
    const src = b.getChannelData(c).subarray(0, len);
    const d = out.getChannelData(c);
    d.set(src);
    for (let i = 0; i < fade && i < len; i++) d[len - 1 - i] *= i / fade;
  }
  return out;
}

/**
 * Loop post: fold everything past `loopFrames` back onto the start (so tails of the last bar ring into
 * the first), remove DC, normalise to `rmsDb` (capped so the peak stays ≤ maxPeak).
 */
export function finishLoop(b: AudioBuffer, loopFrames: number, rmsDb: number, maxPeak = 0.9): AudioBuffer {
  const ch = b.numberOfChannels, sr = b.sampleRate;
  const out = newBuffer(ch, loopFrames, sr);
  const tailFade = Math.floor(0.08 * sr);
  for (let c = 0; c < ch; c++) {
    const src = b.getChannelData(c);
    const d = out.getChannelData(c);
    const n = src.length;
    for (let i = 0; i < n; i++) {
      let v = src[i];
      if (i > n - tailFade) v *= (n - i) / tailFade;
      d[i % loopFrames] += v;
    }
    let m = 0;
    for (let i = 0; i < loopFrames; i++) m += d[i];
    m /= loopFrames;
    for (let i = 0; i < loopFrames; i++) d[i] -= m;
  }
  const r = rmsOf(out);
  if (r > 1e-9) {
    let k = dbToGain(rmsDb) / r;
    const p = peakOf(out) * k;
    if (p > maxPeak) k *= maxPeak / p;
    scale(out, k);
  }
  return out;
}

/** Complementary equal-power fade curves (for noise beds that must loop seamlessly). */
export function eqPowerCurve(n: number, fadeIn: boolean): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    c[i] = fadeIn ? Math.sin(x * Math.PI / 2) : Math.cos(x * Math.PI / 2);
  }
  return c;
}

/** LFO rate snapped to a whole number of cycles per loop (seamless modulation). */
export const loopHz = (desired: number, loopSec: number): number => Math.max(1, Math.round(desired * loopSec)) / loopSec;
