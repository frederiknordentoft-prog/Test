// Music: pre-rendered loopable stems (OfflineAudioContext), composed in code.
//  BASE  84 BPM, D dorian, Dm9 – Bbmaj9 – Fmaj9 – C6/9 (one chord per bar).
//        L0 pad + wind (4 bars) · L1 glass arp (8 bars, A/B phrase) · L2 heartbeat pulse bass (4 bars)
//        L3 soft percussion (4 bars) · L4 tension ostinato + aurora crackle (4 bars)
//  STORM 140 BPM, D phrygian, Dm – Eb – Dm – Cm.
//        core: kick 150→45 Hz, synthetic breaks, reese bass, dark pad, sidechain pump (8 bars)
//        stabs (x≥8) supersaw · hats (x≥32) double-time · choir (x≥128) formant "aah" (4 bars each)
// Every stem's length is an exact whole number of bars in frames (8-bar = 2 × 4-bar), so stems that are
// started together stay sample-locked forever. Tails past the loop end are folded onto the start, and
// every modulation runs a whole number of cycles per loop, so loops are seamless.
//
// Render-cost rule: no filter-frequency automation on long voices (Chrome recomputes biquad coefficients
// per sample while a param is automated). Brightness envelopes are two STATIC filters crossfaded by gains;
// slowly swept noise beds are generated in JS.
import {
  type Ctx, mtof, osc, gain, filt, pan, noise, perc, swell, shaper, bell, aah, prng, eqPowerCurve, loopHz, newBuffer,
} from './dsp.ts';

export const BASE_BPM = 84;
export const STORM_BPM = 140;
/**
 * Frames per bar for a buffer rendered at `sr = full / div` (div ∈ 1, 2, 4). The bar is quantised on a
 * quarter-rate grid, so its length in SECONDS is identical for every divisor: stems rendered at different
 * rates (bandwidth-limited stems use lower rates to save memory) stay sample-locked forever.
 */
export const barFrames = (bpm: number, sr: number, div = 1): number =>
  Math.round(((sr * div) / 4) * (240 / bpm)) * (4 / div);

export interface Grid { sr: number; bar: number; beat: number; s16: number; loop: number; bars: number; end: number }
export function grid(bpm: number, sr: number, bars: number, tail = 0, div = 1): Grid {
  const bf = barFrames(bpm, sr, div);
  const bar = bf / sr;
  return { sr, bar, beat: bar / 4, s16: bar / 16, loop: (bf * bars) / sr, bars, end: (bf * bars) / sr + tail };
}

export interface StemDef {
  id: string;
  group: 'base' | 'storm';
  layer: number;         // base: 0..4 (L0..L4) · storm: 0 core, 1 stabs, 2 hats, 3 choir
  bars: number;
  ch: 1 | 2;
  tail: number;          // seconds rendered past the loop end (folded back)
  rmsDb: number;         // loudness target after folding
  div?: 1 | 2 | 4;       // render at full/div (bandwidth hint; saves memory + render time)
  build(ctx: Ctx, out: AudioNode, g: Grid): void;
}

// ------------------------------------------------------------------ harmony
// Base (D dorian) chords, voiced for the pad (MIDI).
// Open voicings, no semitone clusters; top line A4 – A4 – G4 – A4 (common-tone voice leading).
export const BASE_PAD: number[][] = [
  [50, 53, 60, 64, 69], // Dm9    D3 F3 C4 E4 A4
  [46, 53, 60, 62, 69], // Bbmaj9 Bb2 F3 C4 D4 A4
  [41, 48, 57, 64, 67], // Fmaj9  F2 C3 A3 E4 G4
  [48, 55, 62, 64, 69], // C6/9   C3 G3 D4 E4 A4
];
export const BASE_ROOT = [38, 34, 41, 36]; // D2 Bb1 F2 C2
// Storm (D phrygian): Dm – Eb – Dm – Cm
export const STORM_ROOT = [38, 39, 38, 36]; // D2 Eb2 D2 C2
export const STORM_TRIAD: number[][] = [
  [62, 65, 69], [63, 67, 70], [62, 65, 69], [60, 63, 67],
];

/**
 * Land-bell arpeggios per chord (MIDI), all ascending so every spin is an upward sweep.
 * Base notes are drawn only from the D-dorian pentatonic set {D E F A C}; storm notes from D phrygian.
 */
export const LAND_BASE: number[][] = [
  [69, 74, 77, 81, 84, 88],  // Dm9:    A4 D5 F5 A5 C6 E6
  [69, 74, 77, 81, 84, 86],  // Bbmaj9: A4 D5 F5 A5 C6 D6
  [69, 72, 76, 81, 84, 88],  // Fmaj9:  A4 C5 E5 A5 C6 E6
  [72, 74, 76, 81, 84, 86],  // C6/9:   C5 D5 E5 A5 C6 D6
];
export const LAND_STORM: number[][] = [
  [69, 74, 77, 81, 84, 86, 89, 93], // Dm: A4 D5 F5 A5 C6 D6 F6 A6
  [67, 70, 75, 79, 82, 86, 91, 94], // Eb: G4 Bb4 Eb5 G5 Bb5 D6 G6 Bb6
  [69, 74, 77, 81, 84, 86, 89, 93], // Dm
  [67, 72, 75, 79, 82, 84, 87, 91], // Cm: G4 C5 Eb5 G5 Bb5 C6 Eb6 G6
];

// ------------------------------------------------------------------ helpers
/** Time wrapped into the loop (events scheduled "before 0" land at the end and fold back). */
const wrap = (t: number, g: Grid) => ((t % g.loop) + g.loop) % g.loop;

/** Pad voice: 2 detuned saws + octave triangle through a static low-pass; slow swell. */
function padVoice(ctx: Ctx, out: AudioNode, t: number, dur: number, m: number, amp: number, p: number, det: number): void {
  const f = mtof(m);
  const end = t + dur + 3.5;
  const lp = filt(ctx, 'lowpass', Math.min(2400, 480 + f * 2.0), 0.35);
  const g = gain(ctx, 0);
  swell(g.gain, t, dur, amp, 0.42, 0.55);
  lp.connect(g).connect(pan(ctx, p)).connect(out);
  const a = osc(ctx, 'sawtooth', f, t, end, -det);
  const b = osc(ctx, 'sawtooth', f, t, end, det * 0.8);
  const air = osc(ctx, 'triangle', f * 2, t, end, det * 0.5);
  a.connect(gain(ctx, 0.4)).connect(lp);
  b.connect(gain(ctx, 0.4)).connect(lp);
  air.connect(gain(ctx, 0.12)).connect(lp);
}

/**
 * Wind bed generated in JS: stereo white noise through a Chamberlin state-variable band-pass whose
 * centre sweeps slowly (whole cycles per loop), with gusts; equal-power fade-in over [0,F] and fade-out
 * over [loop, loop+F], so folding the tail makes a seamless crossfade.
 */
function windBuffer(ctx: Ctx, g: Grid, F: number, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.ceil((g.loop + F) * sr);
  const b = newBuffer(2, n, sr);
  const sweepHz = loopHz(0.09, g.loop), gustHz = loopHz(0.17, g.loop), gust2Hz = loopHz(0.41, g.loop);
  const fin = eqPowerCurve(1024, true), fout = eqPowerCurve(1024, false);
  const hpA = 1 - Math.exp(-2 * Math.PI * 250 / sr);
  for (let c = 0; c < 2; c++) {
    const r = prng(seed + c * 1013);
    const d = b.getChannelData(c);
    const side = c ? 1 : -1;
    let low = 0, band = 0, hpS = 0, f = 0.1, k = 1;
    const q = 1 / 0.8;
    for (let i = 0; i < n; i++) {
      if ((i & 31) === 0) {
        // control rate (every 32 samples): filter centre, gusts, loop crossfade
        const t = i / sr;
        const fc = 900 + 420 * side * Math.sin(2 * Math.PI * sweepHz * t) + 180 * Math.sin(2 * Math.PI * gust2Hz * t + c);
        f = 2 * Math.sin(Math.PI * Math.min(fc, sr / 6) / sr);
        let env = 1;
        if (t < F) env = fin[Math.min(1023, Math.floor((t / F) * 1023))];
        else if (t >= g.loop) env = fout[Math.min(1023, Math.floor(((t - g.loop) / F) * 1023))];
        k = (1 + 0.35 * Math.sin(2 * Math.PI * gustHz * t + c * 0.7)) * env;
      }
      const x = r() * 2 - 1;
      low += f * band;
      const high = x - low - q * band;
      band += f * high;
      hpS += hpA * (band - hpS);
      d[i] = (band - hpS) * k;
    }
  }
  return b;
}

function pumpEnv(p: AudioParam, kicks: number[], depth = 0.22, rec = 0.085): void {
  p.setValueAtTime(1, 0);
  for (const k of kicks) {
    p.setValueAtTime(1, Math.max(0, k - 0.004));
    p.linearRampToValueAtTime(depth, k + 0.004);
    p.setTargetAtTime(1, k + 0.012, rec);
  }
}

// ------------------------------------------------------------------ BASE stems
const L0: StemDef = {
  id: 'base0', group: 'base', layer: 0, bars: 4, ch: 2, tail: 5, rmsDb: -21, div: 2,
  build(ctx, out, g) {
    const bus = gain(ctx, 1);
    bus.connect(out);
    for (let b = 0; b < 4; b++) {
      const t = wrap(b * g.bar - 0.3, g);
      const ch = BASE_PAD[b];
      ch.forEach((m, i) => {
        const p = (i / (ch.length - 1) - 0.5) * 0.7 * (i % 2 ? 1 : -1);
        padVoice(ctx, bus, t, g.bar + 0.1, m, i === 0 ? 0.05 : 0.04, p, 4 + i * 1.3);
      });
    }
    const F = 2.5;
    const w = ctx.createBufferSource();
    w.buffer = windBuffer(ctx, g, F, 101);
    w.connect(gain(ctx, 0.05)).connect(bus);
    w.start(0);
  },
};

const ARP_POOL: number[][] = [
  [74, 76, 77, 81, 84, 86], // Dm9:    D5 E5 F5 A5 C6 D6
  [74, 77, 81, 84, 86, 89], // Bbmaj9: D5 F5 A5 C6 D6 F6
  [72, 76, 79, 81, 84, 88], // Fmaj9:  C5 E5 G5 A5 C6 E6
  [72, 74, 76, 79, 81, 86], // C6/9:   C5 D5 E5 G5 A5 D6
];
const ARP_A = [0, 3, 1, 4, 2, 5, 3, 1];
const ARP_B = [5, -1, 4, 2, 3, -1, 1, 0];
const ARP_VEL = [1, 0.55, 0.75, 0.6, 0.9, 0.55, 0.7, 0.5];

const L1: StemDef = {
  id: 'base1', group: 'base', layer: 1, bars: 8, ch: 2, tail: 5, rmsDb: -25,
  build(ctx, out, g) {
    // dotted-8th ping-pong echo with a dark feedback path
    const dry = gain(ctx, 1);
    const dl = ctx.createDelay(2), dr = ctx.createDelay(2);
    dl.delayTime.value = g.beat * 0.75; dr.delayTime.value = g.beat * 0.75;
    const fb = gain(ctx, 0.3), fb2 = gain(ctx, 0.3);
    const dlp = filt(ctx, 'lowpass', 3800, 0.4), dhp = filt(ctx, 'highpass', 500, 0.5);
    const send = gain(ctx, 0.42);
    const merger = ctx.createChannelMerger(2);
    dry.connect(out);
    dry.connect(send).connect(dhp).connect(dlp).connect(dl);
    dl.connect(fb).connect(dr);
    dr.connect(fb2).connect(dl);
    dl.connect(merger, 0, 0);
    dr.connect(merger, 0, 1);
    merger.connect(gain(ctx, 0.8)).connect(out);
    const pL = pan(ctx, -0.28), pR = pan(ctx, 0.28);
    pL.connect(dry); pR.connect(dry);
    const rnd = prng(77);
    for (let b = 0; b < 8; b++) {
      const pool = ARP_POOL[b % 4];
      const pat = b < 4 ? ARP_A : ARP_B;
      for (let s = 0; s < 8; s++) {
        const k = pat[s];
        if (k < 0) continue;
        // phrase endings breathe: last bar of each half drops the final two notes
        if ((b === 3 || b === 7) && s >= 6) continue;
        const t = wrap(b * g.bar + s * (g.beat / 2) + 0.004 + (rnd() - 0.5) * 0.006, g);
        const v = ARP_VEL[s] * (b >= 4 ? 0.92 : 1);
        bell(ctx, s % 2 ? pR : pL, t, mtof(pool[k]), 0.2 * v, { ratio: 3.5, index: 0.9 + 0.5 * v, itau: 0.12, tau: 0.42, body: 0.55, tine: 0.08, strike: 0, lp: 7000, seed: 900 + b * 8 + s });
      }
    }
  },
};

const L2: StemDef = {
  id: 'base2', group: 'base', layer: 2, bars: 4, ch: 1, tail: 2, rmsDb: -24, div: 4,
  build(ctx, out, g) {
    const lp = filt(ctx, 'lowpass', 850, 0.5);
    const sat = shaper(ctx, 2.2);
    const hp = filt(ctx, 'highpass', 38, 0.6);
    lp.connect(sat).connect(hp).connect(out);
    for (let b = 0; b < 4; b++) {
      const f = mtof(BASE_ROOT[b]);
      for (const beat of [0, 2]) {
        for (const [dt, v, tau] of [[0, 1, 0.2], [0.19, 0.55, 0.14]] as const) {
          const t = b * g.bar + beat * g.beat + dt + 0.001;
          const o = osc(ctx, 'sine', f, t, t + 1.2);
          o.frequency.setValueAtTime(f * 1.35, t);
          o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
          const h = osc(ctx, 'triangle', f * 2, t, t + 1.2);
          const h3 = osc(ctx, 'sine', f * 3, t, t + 0.5);
          const e = gain(ctx, 0);
          perc(e.gain, t, 0.55 * v, 0.006, tau);
          o.connect(e); h.connect(gain(ctx, 0.35)).connect(e); h3.connect(gain(ctx, 0.12)).connect(e);
          e.connect(lp);
        }
      }
    }
  },
};

const L3: StemDef = {
  id: 'base3', group: 'base', layer: 3, bars: 4, ch: 1, tail: 1.5, rmsDb: -28,
  build(ctx, out, g) {
    const r = prng(303);
    const kickLp = filt(ctx, 'lowpass', 1400, 0.5);
    kickLp.connect(out);
    // felt kick: 1 and the "and" of 3; pickup in bar 4
    for (let b = 0; b < 4; b++) {
      const steps = b === 3 ? [0, 10, 14] : [0, 10];
      for (const s of steps) {
        const t = b * g.bar + s * g.s16 + 0.001;
        const o = osc(ctx, 'sine', 96, t, t + 0.6);
        o.frequency.setValueAtTime(96, t);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
        const e = gain(ctx, 0);
        perc(e.gain, t, s === 0 ? 0.7 : 0.5, 0.004, 0.11);
        o.connect(e).connect(out);
        const n = noise(ctx, t, t + 0.03, 31 + s);
        const ne = gain(ctx, 0);
        perc(ne.gain, t, 0.06, 0.001, 0.006);
        n.connect(ne).connect(kickLp);
      }
    }
    // shaker 16ths (one noise source, gated)
    const shHp = filt(ctx, 'highpass', 5200, 0.6);
    const shBp = filt(ctx, 'bandpass', 8200, 0.9);
    shHp.connect(shBp).connect(pan(ctx, 0.3)).connect(out);
    const sh = noise(ctx, 0, g.loop + 0.5, 404, 5);
    const she = gain(ctx, 0);
    sh.connect(she).connect(shHp);
    she.gain.setValueAtTime(0, 0);
    const acc = [0.55, 0.22, 0.38, 0.24];
    for (let b = 0; b < 4; b++) {
      for (let s = 0; s < 16; s++) {
        const t = b * g.bar + s * g.s16 + 0.002 + Math.abs(r() - 0.5) * 0.008;
        let v = acc[s % 4] * (0.85 + r() * 0.3);
        if (b === 3 && s >= 12) v *= 1 + (s - 11) * 0.25; // small crescendo into the loop
        she.gain.setValueAtTime(0, t);
        she.gain.linearRampToValueAtTime(v * 0.5, t + 0.006);
        she.gain.setTargetAtTime(0, t + 0.006, 0.028);
      }
    }
    // soft woody tick on 2 and 4
    const wbp = filt(ctx, 'bandpass', 1700, 3);
    const wp = pan(ctx, -0.22);
    wbp.connect(wp);
    wp.connect(out);
    for (let b = 0; b < 4; b++) {
      for (const s of [4, 12]) {
        const t = b * g.bar + s * g.s16;
        const n = noise(ctx, t, t + 0.06, 505 + s + b);
        const e = gain(ctx, 0);
        perc(e.gain, t, 0.22, 0.0008, 0.018);
        const o = osc(ctx, 'sine', 820, t, t + 0.1);
        const oe = gain(ctx, 0);
        perc(oe.gain, t, 0.08, 0.001, 0.02);
        n.connect(e).connect(wbp);
        o.connect(oe).connect(wp);
      }
    }
  },
};

const OST_POOL: number[][] = [
  [62, 69, 64, 65], // D4 A4 E4 F4
  [58, 65, 62, 69], // Bb3 F4 D4 A4
  [57, 64, 60, 65], // A3 E4 C4 F4
  [55, 64, 60, 62], // G3 E4 C4 D4
];
const OST_PAT = [0, 1, 2, 1, 0, 1, 3, 1, 0, 1, 2, 1, 0, 3, 2, 1];

/** JS-generated aurora crackle: sparse resonant micro-clicks, stereo, wrapping at the loop length. */
function crackleBuffer(ctx: Ctx, seconds: number, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(seconds * sr);
  const b = newBuffer(2, n, sr);
  const L = b.getChannelData(0), R = b.getChannelData(1);
  const r = prng(seed);
  let t = 0;
  for (;;) {
    t += -Math.log(1 - r()) / 7; // ~7 events / s
    const i0 = Math.floor(t * sr);
    if (i0 >= n) break;
    const f = 1500 + r() * 4500;
    const w = 2 * Math.PI * f / sr;
    const len = Math.floor((0.002 + r() * 0.006) * sr);
    const amp = 0.15 + r() * r() * 0.85;
    const p = r();
    const gl = Math.cos(p * Math.PI / 2), gr = Math.sin(p * Math.PI / 2);
    for (let k = 0; k < len; k++) {
      const v = Math.sin(w * k) * Math.exp(-k / (len * 0.25)) * amp * (r() * 0.6 + 0.4);
      const idx = (i0 + k) % n;
      L[idx] += v * gl; R[idx] += v * gr;
    }
  }
  return b;
}

const L4: StemDef = {
  id: 'base4', group: 'base', layer: 4, bars: 4, ch: 2, tail: 1.5, rmsDb: -29, div: 2,
  build(ctx, out, g) {
    // muted pluck: bright path (fast decay) + dark resonant path; 4 static filters, L/R alternating
    const chains = [-0.25, 0.25].map((p) => {
      const pn = pan(ctx, p);
      pn.connect(out);
      const bright = filt(ctx, 'lowpass', 2600, 0.8);
      const dark = filt(ctx, 'lowpass', 430, 2.5);
      bright.connect(pn); dark.connect(pn);
      return { bright, dark };
    });
    for (let b = 0; b < 4; b++) {
      const pool = OST_POOL[b];
      for (let s = 0; s < 16; s++) {
        const t = b * g.bar + s * g.s16 + 0.001;
        const f = mtof(pool[OST_PAT[s]]);
        const acc = s % 4 === 0 ? 1 : s % 2 === 0 ? 0.7 : 0.5;
        const ch = chains[s % 2];
        const src = gain(ctx, 1);
        osc(ctx, 'sawtooth', f, t, t + 0.6, -4).connect(src);
        osc(ctx, 'square', f, t, t + 0.6, 5).connect(gain(ctx, 0.35)).connect(src);
        const eb = gain(ctx, 0), ed = gain(ctx, 0);
        perc(eb.gain, t, 0.09 * acc * acc, 0.002, 0.035);
        perc(ed.gain, t, 0.12 * acc, 0.003, 0.085);
        src.connect(eb).connect(ch.bright);
        src.connect(ed).connect(ch.dark);
      }
    }
    const cr = ctx.createBufferSource();
    cr.buffer = crackleBuffer(ctx, g.loop, 4242);
    cr.connect(filt(ctx, 'highpass', 900, 0.5)).connect(gain(ctx, 0.05)).connect(out);
    cr.start(0);
  },
};

// ------------------------------------------------------------------ STORM stems
const KICKS: number[][] = [[0, 10], [0, 7, 10], [0, 10], [0, 3, 10, 14]];

function stormKickTimes(g: Grid): number[] {
  const out: number[] = [];
  for (let b = 0; b < g.bars; b++) for (const s of KICKS[b % 4]) out.push(b * g.bar + s * g.s16);
  return out;
}

function kick(ctx: Ctx, out: AudioNode, t: number, v: number): void {
  const o = osc(ctx, 'sine', 150, t, t + 0.7);
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
  const e = gain(ctx, 0);
  perc(e.gain, t, v, 0.0015, 0.15);
  o.connect(e).connect(out);
  const n = noise(ctx, t, t + 0.02, 61);
  const ne = gain(ctx, 0);
  perc(ne.gain, t, v * 0.12, 0.0005, 0.004);
  n.connect(ne).connect(out);
}

function snare(ctx: Ctx, body: AudioNode, nz: AudioNode, t: number, v: number, seed: number): void {
  const o = osc(ctx, 'triangle', 190, t, t + 0.4);
  o.frequency.setValueAtTime(190, t);
  o.frequency.exponentialRampToValueAtTime(160, t + 0.12);
  const oe = gain(ctx, 0);
  perc(oe.gain, t, v * 0.5, 0.001, 0.055);
  o.connect(oe).connect(body);
  const n = noise(ctx, t, t + 0.5, seed);
  const ne = gain(ctx, 0);
  perc(ne.gain, t, v * 0.55, 0.0008, 0.09);
  n.connect(ne).connect(nz);
}

function hat(ctx: Ctx, out: AudioNode, t: number, v: number, open: boolean, seed: number): void {
  const n = noise(ctx, t, t + (open ? 0.6 : 0.12), seed, 3);
  const e = gain(ctx, 0);
  perc(e.gain, t, v, 0.0006, open ? 0.075 : 0.018);
  n.connect(e).connect(out);
}

/** Shared static hat filter chain → out. */
function hatBus(ctx: Ctx, out: AudioNode, p: number): AudioNode {
  const hp = filt(ctx, 'highpass', 7200, 0.7);
  const pk = filt(ctx, 'peaking', 10500, 1.2, 4);
  hp.connect(pk).connect(pan(ctx, p)).connect(out);
  return hp;
}

const CORE: StemDef = {
  id: 'storm0', group: 'storm', layer: 0, bars: 8, ch: 2, tail: 2.5, rmsDb: -15,
  build(ctx, out, g) {
    const kicks = stormKickTimes(g);
    const drums = gain(ctx, 1);
    drums.connect(out);
    const kb = shaper(ctx, 2.2);
    kb.connect(drums);
    kicks.forEach((t, i) => kick(ctx, kb, t + 0.0005, i % 3 === 0 ? 1 : 0.9));
    // snare: shared body + noise filters
    const sp = pan(ctx, 0.05);
    sp.connect(drums);
    const snHp = filt(ctx, 'highpass', 1100, 0.6), snPk = filt(ctx, 'peaking', 3600, 0.8, 5);
    snHp.connect(snPk).connect(sp);
    const sn = (t: number, v: number, seed: number) => snare(ctx, sp, snHp, t, v, seed);
    const hL = hatBus(ctx, drums, -0.2), hR = hatBus(ctx, drums, 0.3);
    for (let b = 0; b < 8; b++) {
      sn(b * g.bar + 4 * g.s16, 0.9, 700 + b);
      sn(b * g.bar + 12 * g.s16, 0.95, 720 + b);
      if (b !== 7) {
        sn(b * g.bar + 7 * g.s16, 0.22, 740 + b);
        sn(b * g.bar + 15 * g.s16, b % 2 ? 0.3 : 0.18, 760 + b);
      }
      for (let s = 0; s < 16; s += 2) hat(ctx, s % 4 ? hR : hL, b * g.bar + s * g.s16, s % 4 ? 0.2 : 0.1, false, 800 + b * 16 + s);
    }
    // bar 8: snare roll crescendo + noise riser into the downbeat
    for (let s = 8; s < 16; s++) sn(7 * g.bar + s * g.s16, 0.25 + (s - 8) * 0.09, 900 + s);
    {
      const t0 = 7 * g.bar + 8 * g.s16, t1 = 8 * g.bar;
      const n = noise(ctx, t0, t1 + 0.02, 950, 4, 2);
      const bp = filt(ctx, 'bandpass', 2400, 0.7);
      const e = gain(ctx, 0);
      e.gain.setValueAtTime(0, t0);
      e.gain.linearRampToValueAtTime(0.16, t1 - 0.01);
      e.gain.linearRampToValueAtTime(0, t1);
      n.connect(bp).connect(e).connect(drums);
    }
    // --- pumped tonal bus: reese through two static low-passes crossfaded by an LFO (filter movement)
    const pump = gain(ctx, 1);
    pumpEnv(pump.gain, kicks.concat(kicks.map((k) => k + g.loop)));
    pump.connect(out);
    const rIn = gain(ctx, 1);
    const lpA = filt(ctx, 'lowpass', 300, 1.6), lpB = filt(ctx, 'lowpass', 950, 1.3);
    const gA = gain(ctx, 0.5), gB = gain(ctx, 0.5);
    const lfo = osc(ctx, 'sine', loopHz(0.28, g.loop), 0, g.end);
    lfo.connect(gain(ctx, 0.45)).connect(gA.gain);
    lfo.connect(gain(ctx, -0.45)).connect(gB.gain);
    const rsat = shaper(ctx, 1.8);
    const rhp = filt(ctx, 'highpass', 36, 0.7);
    rIn.connect(lpA).connect(gA).connect(rsat);
    rIn.connect(lpB).connect(gB).connect(rsat);
    rsat.connect(rhp).connect(pump);
    for (let b = 0; b < 8; b++) {
      const root = STORM_ROOT[b % 4];
      const notes: [number, number, number][] = b === 7
        ? [[0, 8, root], [8, 4, root + 12], [12, 4, root + 10]]
        : [[0, 16, root]];
      for (const [s, len, m] of notes) {
        const t = b * g.bar + s * g.s16;
        const d = len * g.s16;
        const f = mtof(m);
        const e = gain(ctx, 0);
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(0.32, t + 0.006);
        e.gain.setValueAtTime(0.32, t + d - 0.012);
        e.gain.linearRampToValueAtTime(0, t + d + 0.004);
        for (const det of [-16, 14]) osc(ctx, 'sawtooth', f, t, t + d + 0.05, det).connect(e);
        osc(ctx, 'sine', f, t, t + d + 0.05).connect(gain(ctx, 0.9)).connect(e);
        e.connect(rIn);
      }
    }
    const plp = filt(ctx, 'lowpass', 1100, 0.4);
    plp.connect(pump);
    for (let b = 0; b < 8; b++) {
      const t = b * g.bar;
      STORM_TRIAD[b % 4].forEach((m, i) => {
        const e = gain(ctx, 0);
        swell(e.gain, t, g.bar - 0.05, 0.035, 0.06, 0.08);
        for (const det of [-7, 7]) osc(ctx, 'sawtooth', mtof(m - 12), t, t + g.bar + 0.6, det).connect(e);
        e.connect(pan(ctx, (i - 1) * 0.5)).connect(plp);
      });
    }
  },
};

const STABS: StemDef = {
  id: 'storm1', group: 'storm', layer: 1, bars: 4, ch: 2, tail: 1.5, rmsDb: -22, div: 2,
  build(ctx, out, g) {
    const kicks = stormKickTimes(g);
    const pump = gain(ctx, 1);
    pumpEnv(pump.gain, kicks.concat(kicks.map((k) => k + g.loop)), 0.35, 0.07);
    pump.connect(out);
    // two static filters: bright attack path + body path, gated per hit
    const lpBright = filt(ctx, 'lowpass', 5200, 0.9), lpBody = filt(ctx, 'lowpass', 1300, 1.1);
    lpBright.connect(pump); lpBody.connect(pump);
    const hits = [0, 3, 6, 10, 12];
    for (let b = 0; b < 4; b++) {
      const triad = STORM_TRIAD[b % 4];
      const voicing = [triad[0], triad[1], triad[2], triad[0] + 12];
      const sum = gain(ctx, 1);
      const gBr = gain(ctx, 0), gBo = gain(ctx, 0);
      sum.connect(gBr).connect(lpBright);
      sum.connect(gBo).connect(lpBody);
      const t0 = b * g.bar, t1 = t0 + g.bar + 0.3;
      for (const s of hits) {
        const t = t0 + s * g.s16 + 0.001;
        const len = s === 12 ? g.s16 * 2.4 : g.s16 * 1.1;
        gBo.gain.setValueAtTime(0, t);
        gBo.gain.linearRampToValueAtTime(0.09, t + 0.003);
        gBo.gain.setTargetAtTime(0.055, t + 0.003, 0.05);
        gBo.gain.setTargetAtTime(0, t + len, 0.025);
        gBr.gain.setValueAtTime(0, t);
        gBr.gain.linearRampToValueAtTime(0.07, t + 0.002);
        gBr.gain.setTargetAtTime(0, t + 0.002, 0.03);
      }
      voicing.forEach((m, vi) => {
        const f = mtof(m);
        for (let k = 0; k < 5; k++) {
          const x = osc(ctx, 'sawtooth', f, t0, t1, (k - 2) * 11 + vi * 0.7);
          x.connect(gain(ctx, 0.2)).connect(pan(ctx, ((k - 2) / 2) * 0.7)).connect(sum);
        }
      });
    }
  },
};

const HATS: StemDef = {
  id: 'storm2', group: 'storm', layer: 2, bars: 4, ch: 2, tail: 1, rmsDb: -27,
  build(ctx, out, g) {
    const r = prng(1212);
    const vel = [0.5, 0.22, 0.35, 0.25];
    const hL = hatBus(ctx, out, -0.32), hR = hatBus(ctx, out, 0.38);
    for (let b = 0; b < 4; b++) {
      for (let s = 0; s < 16; s++) {
        const t = b * g.bar + s * g.s16 + 0.002 + Math.abs(r() - 0.5) * 0.004;
        const bus = s % 2 ? hR : hL;
        const open = s % 4 === 2 && !(b === 3 && s > 8);
        hat(ctx, bus, t, open ? 0.3 : vel[s % 4] * (0.85 + r() * 0.3), open, 1300 + b * 16 + s);
        if (b === 3 && s >= 12) hat(ctx, bus, t + g.s16 / 2, 0.18, false, 1400 + s); // 32nd flourish
      }
    }
  },
};

const CHOIR: StemDef = {
  id: 'storm3', group: 'storm', layer: 3, bars: 4, ch: 2, tail: 3.2, rmsDb: -23, div: 2,
  build(ctx, out, g) {
    const kicks = stormKickTimes(g);
    const pump = gain(ctx, 1);
    pumpEnv(pump.gain, kicks.concat(kicks.map((k) => k + g.loop)), 0.6, 0.1);
    pump.connect(out);
    const V: number[][] = [[62, 69, 74, 77], [63, 70, 75, 79], [62, 69, 74, 77], [60, 67, 72, 75]];
    for (let b = 0; b < 4; b++) {
      V[b].forEach((m, i) => {
        aah(ctx, pump, wrap(b * g.bar - 0.02, g), g.bar - 0.1, mtof(m), 0.05, (i - 1.5) * 0.4, 0.12, 0.35, i < 2 ? 'o' : 'a');
      });
    }
  },
};

export const STEMS: StemDef[] = [L0, L1, L2, L3, L4, CORE, STABS, HATS, CHOIR];
export const STEM_BY_ID: Record<string, StemDef> = Object.fromEntries(STEMS.map((s) => [s.id, s]));
