// Music: pre-rendered loopable stems (OfflineAudioContext), composed in code.
//  BASE  84 BPM, D dorian, Dm9 – Bbmaj9 – Fmaj9 – C6/9 (one chord per bar).
//        L0 pad + wind (4 bars) · L1 glass arp (8 bars, A/B phrase) · L2 heartbeat pulse bass (4 bars)
//        L3 soft percussion (4 bars) · L4 tension ostinato + aurora crackle (4 bars)
//  STORM 140 BPM, D phrygian, Dm – Eb – Dm – Cm.
//        core: kick 150→45 Hz, synthetic breaks, reese bass, dark pad, sidechain pump (8 bars)
//        stabs (x≥8) supersaw · hats (x≥32) double-time · choir (x≥128) formant "aah" (4 bars each)
// Every stem's length is an exact whole number of bars in frames (8-bar = 2 × 4-bar), so stems that are
// started together stay sample-locked forever. Tails past the loop end are folded onto the start.
import {
  type Ctx, mtof, osc, gain, filt, pan, noise, perc, swell, shaper, bell, aah, prng, eqPowerCurve, loopHz, newBuffer,
} from './dsp.ts';

export const BASE_BPM = 84;
export const STORM_BPM = 140;
/** Frames per bar at `bpm` (rounded; the rounded value IS the tempo grid everywhere). */
export const barFrames = (bpm: number, sr: number): number => Math.round((sr * 240) / bpm);

export interface Grid { sr: number; bar: number; beat: number; s16: number; loop: number; bars: number; end: number }
export function grid(bpm: number, sr: number, bars: number, tail = 0): Grid {
  const bf = barFrames(bpm, sr);
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
  build(ctx: Ctx, out: AudioNode, g: Grid): void;
}

// ------------------------------------------------------------------ harmony
// Base (D dorian) chords, voiced for the pad (MIDI).
export const BASE_PAD: number[][] = [
  [50, 57, 60, 64, 65], // Dm9    D3 A3 C4 E4 F4
  [46, 53, 57, 60, 62], // Bbmaj9 Bb2 F3 A3 C4 D4
  [41, 48, 57, 64, 67], // Fmaj9  F2 C3 A3 E4 G4
  [48, 55, 57, 62, 64], // C6/9   C3 G3 A3 D4 E4
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

function padVoice(ctx: Ctx, out: AudioNode, t: number, dur: number, m: number, amp: number, p: number, lfoA: AudioNode, lfoB: AudioNode): void {
  const f = mtof(m);
  const end = t + dur + 4;
  const lp = filt(ctx, 'lowpass', 700, 0.35);
  const cut = Math.min(2600, 520 + f * 2.2);
  lp.frequency.setValueAtTime(cut * 0.45, t);
  lp.frequency.setTargetAtTime(cut, t, 0.9);
  lp.frequency.setTargetAtTime(cut * 0.5, t + dur, 0.8);
  const g = gain(ctx, 0);
  swell(g.gain, t, dur, amp, 0.42, 0.55);
  const pn = pan(ctx, p);
  lp.connect(g).connect(pn).connect(out);
  const a = osc(ctx, 'sawtooth', f, t, end, -6);
  const b = osc(ctx, 'sawtooth', f, t, end, 6);
  lfoA.connect(a.detune); lfoB.connect(b.detune);
  const air = osc(ctx, 'triangle', f * 2, t, end, 3);
  const ga = gain(ctx, 0.4), gb = gain(ctx, 0.4), gair = gain(ctx, 0.12);
  a.connect(ga).connect(lp); b.connect(gb).connect(lp); air.connect(gair).connect(lp);
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
  id: 'base0', group: 'base', layer: 0, bars: 4, ch: 2, tail: 5.5, rmsDb: -21,
  build(ctx, out, g) {
    const bus = gain(ctx, 1);
    bus.connect(out);
    // slow ensemble detune — whole cycles per loop so the fold is seamless
    const la = osc(ctx, 'sine', loopHz(0.13, g.loop), 0, g.end);
    const lb = osc(ctx, 'sine', loopHz(0.21, g.loop), 0, g.end);
    const lga = gain(ctx, 4), lgb = gain(ctx, -4);
    la.connect(lga); lb.connect(lgb);
    for (let b = 0; b < 4; b++) {
      const t = wrap(b * g.bar - 0.3, g);
      const ch = BASE_PAD[b];
      ch.forEach((m, i) => {
        const p = (i / (ch.length - 1) - 0.5) * 0.7 * (i % 2 ? 1 : -1);
        padVoice(ctx, bus, t, g.bar + 0.1, m, i === 0 ? 0.05 : 0.04, p, lga, lgb);
      });
    }
    // wind: two decorrelated noise beds, slowly swept band-pass, gusts; equal-power loop crossfade.
    const F = 2.5;
    for (const side of [-1, 1]) {
      const n = noise(ctx, 0, g.loop + F + 0.01, side < 0 ? 101 : 202, 9);
      const bp = filt(ctx, 'bandpass', 900, 0.8);
      const sw = osc(ctx, 'sine', loopHz(0.09, g.loop), 0, g.loop + F + 0.01);
      const swg = gain(ctx, 420 * side);
      sw.connect(swg).connect(bp.frequency);
      const gust = osc(ctx, 'sine', loopHz(0.17, g.loop), 0, g.loop + F + 0.01);
      const gg = gain(ctx, 0.35);
      const amp = gain(ctx, 1);
      gust.connect(gg).connect(amp.gain);
      const xf = gain(ctx, 0);
      const nC = 256;
      xf.gain.setValueCurveAtTime(eqPowerCurve(nC, true), 0, F);
      xf.gain.setValueAtTime(1, g.loop);
      xf.gain.setValueCurveAtTime(eqPowerCurve(nC, false), g.loop, F);
      const lvl = gain(ctx, 0.022);
      const hp = filt(ctx, 'highpass', 250, 0.5);
      n.connect(bp).connect(hp).connect(amp).connect(xf).connect(lvl).connect(pan(ctx, side * 0.8)).connect(bus);
    }
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
    const wet = gain(ctx, 0.8);
    merger.connect(wet).connect(out);
    const rnd = prng(77);
    for (let b = 0; b < 8; b++) {
      const pool = ARP_POOL[b % 4];
      const pat = b < 4 ? ARP_A : ARP_B;
      for (let s = 0; s < 8; s++) {
        const k = pat[s];
        if (k < 0) continue;
        // phrase endings breathe: last bar of each half drops the final two notes
        if ((b === 3 || b === 7) && s >= 6) continue;
        const t = b * g.bar + s * (g.beat / 2) + (rnd() - 0.5) * 0.006;
        const m = pool[k];
        const v = ARP_VEL[s] * (b >= 4 ? 0.92 : 1);
        const p = pan(ctx, ((s % 2) ? 0.28 : -0.28) + (rnd() - 0.5) * 0.1);
        p.connect(dry);
        bell(ctx, p, t, mtof(m), 0.2 * v, { ratio: 3.5, index: 0.9 + 0.5 * v, itau: 0.12, tau: 0.42, body: 0.55, tine: 0.08, strike: 0.02, lp: 7000, seed: 900 + b * 8 + s });
      }
    }
  },
};

const L2: StemDef = {
  id: 'base2', group: 'base', layer: 2, bars: 4, ch: 1, tail: 2, rmsDb: -24,
  build(ctx, out, g) {
    const lp = filt(ctx, 'lowpass', 520, 0.5);
    const sat = shaper(ctx, 1.6);
    const hp = filt(ctx, 'highpass', 38, 0.6);
    lp.connect(sat).connect(hp).connect(out);
    for (let b = 0; b < 4; b++) {
      const f = mtof(BASE_ROOT[b]);
      for (const beat of [0, 2]) {
        for (const [dt, v, tau] of [[0, 1, 0.2], [0.19, 0.55, 0.14]] as const) {
          const t = b * g.bar + beat * g.beat + dt;
          const o = osc(ctx, 'sine', f, t, t + 1.2);
          o.frequency.setValueAtTime(f * 1.35, t);
          o.frequency.setTargetAtTime(f, t, 0.012);
          const h = osc(ctx, 'triangle', f * 2, t, t + 1.2);
          const hg = gain(ctx, 0.22);
          const e = gain(ctx, 0);
          perc(e.gain, t, 0.55 * v, 0.006, tau);
          o.connect(e); h.connect(hg).connect(e);
          e.connect(lp);
        }
      }
    }
  },
};

const L3: StemDef = {
  id: 'base3', group: 'base', layer: 3, bars: 4, ch: 2, tail: 1.5, rmsDb: -28,
  build(ctx, out, g) {
    const r = prng(303);
    // felt kick: 1 and the "and" of 3; pickup in bar 4
    for (let b = 0; b < 4; b++) {
      const steps = b === 3 ? [0, 10, 14] : [0, 10];
      for (const s of steps) {
        const t = b * g.bar + s * g.s16;
        const o = osc(ctx, 'sine', 95, t, t + 0.6);
        o.frequency.setValueAtTime(96, t);
        o.frequency.setTargetAtTime(50, t, 0.035);
        const e = gain(ctx, 0);
        perc(e.gain, t, s === 0 ? 0.7 : 0.5, 0.004, 0.11);
        o.connect(e).connect(out);
        const n = noise(ctx, t, t + 0.03, 31 + s);
        const nl = filt(ctx, 'lowpass', 1400, 0.5);
        const ne = gain(ctx, 0);
        perc(ne.gain, t, 0.06, 0.001, 0.006);
        n.connect(nl).connect(ne).connect(out);
      }
    }
    // shaker 16ths
    const shHp = filt(ctx, 'highpass', 5200, 0.6);
    const shBp = filt(ctx, 'bandpass', 8200, 0.9);
    const shP = pan(ctx, 0.3);
    shHp.connect(shBp).connect(shP).connect(out);
    const sh = noise(ctx, 0, g.loop + 0.5, 404, 5);
    const she = gain(ctx, 0);
    sh.connect(she).connect(shHp);
    she.gain.setValueAtTime(0, 0);
    const acc = [0.55, 0.22, 0.38, 0.24];
    for (let b = 0; b < 4; b++) {
      for (let s = 0; s < 16; s++) {
        const t = b * g.bar + s * g.s16 + (r() - 0.5) * 0.008;
        let v = acc[s % 4] * (0.85 + r() * 0.3);
        if (b === 3 && s >= 12) v *= 1 + (s - 11) * 0.25; // small crescendo into the loop
        she.gain.setValueAtTime(0, t);
        she.gain.linearRampToValueAtTime(v * 0.5, t + 0.006);
        she.gain.setTargetAtTime(0, t + 0.006, 0.028);
      }
    }
    // soft woody tick on 2 and 4
    for (let b = 0; b < 4; b++) {
      for (const s of [4, 12]) {
        const t = b * g.bar + s * g.s16;
        const n = noise(ctx, t, t + 0.06, 505 + s + b);
        const bp = filt(ctx, 'bandpass', 1700, 3);
        const e = gain(ctx, 0);
        perc(e.gain, t, 0.22, 0.0008, 0.018);
        const o = osc(ctx, 'sine', 820, t, t + 0.1);
        const oe = gain(ctx, 0);
        perc(oe.gain, t, 0.08, 0.001, 0.02);
        const p = pan(ctx, -0.22);
        n.connect(bp).connect(e).connect(p);
        o.connect(oe).connect(p);
        p.connect(out);
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

/** JS-generated aurora crackle: sparse resonant micro-clicks, stereo. */
function crackleBuffer(ctx: Ctx, seconds: number, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(seconds * sr);
  const b = newBuffer(2, n, sr);
  const L = b.getChannelData(0), R = b.getChannelData(1);
  const r = prng(seed);
  let t = 0;
  while (true) {
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
  id: 'base4', group: 'base', layer: 4, bars: 4, ch: 2, tail: 1.5, rmsDb: -29,
  build(ctx, out, g) {
    for (let b = 0; b < 4; b++) {
      const pool = OST_POOL[b];
      for (let s = 0; s < 16; s++) {
        const t = b * g.bar + s * g.s16;
        const f = mtof(pool[OST_PAT[s]]);
        const acc = s % 4 === 0 ? 1 : s % 2 === 0 ? 0.7 : 0.5;
        const lp = filt(ctx, 'lowpass', 400, 2.5);
        lp.frequency.setValueAtTime(2600 * acc, t);
        lp.frequency.setTargetAtTime(420, t, 0.045);
        const e = gain(ctx, 0);
        perc(e.gain, t, 0.13 * acc, 0.002, 0.075);
        const p = pan(ctx, s % 2 ? 0.25 : -0.25);
        const a = osc(ctx, 'sawtooth', f, t, t + 0.6, -4);
        const c = osc(ctx, 'square', f, t, t + 0.6, 5);
        const cg = gain(ctx, 0.35);
        a.connect(lp); c.connect(cg).connect(lp);
        lp.connect(e).connect(p).connect(out);
      }
    }
    const cr = ctx.createBufferSource();
    cr.buffer = crackleBuffer(ctx, g.loop, 4242);
    const hp = filt(ctx, 'highpass', 900, 0.5);
    const cg = gain(ctx, 0.05);
    cr.connect(hp).connect(cg).connect(out);
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
  o.frequency.setTargetAtTime(45, t, 0.028);
  const e = gain(ctx, 0);
  perc(e.gain, t, v, 0.0015, 0.15);
  const sat = shaper(ctx, 2.2);
  o.connect(e).connect(sat).connect(out);
  const n = noise(ctx, t, t + 0.02, 61);
  const hp = filt(ctx, 'highpass', 2800, 0.7);
  const ne = gain(ctx, 0);
  perc(ne.gain, t, v * 0.25, 0.0005, 0.004);
  n.connect(hp).connect(ne).connect(out);
}

function snare(ctx: Ctx, out: AudioNode, t: number, v: number, seed: number): void {
  const o = osc(ctx, 'triangle', 190, t, t + 0.4);
  o.frequency.setTargetAtTime(160, t, 0.05);
  const oe = gain(ctx, 0);
  perc(oe.gain, t, v * 0.5, 0.001, 0.055);
  o.connect(oe).connect(out);
  const n = noise(ctx, t, t + 0.5, seed);
  const hp = filt(ctx, 'highpass', 1100, 0.6);
  const bp = filt(ctx, 'peaking', 3600, 0.8, 5);
  const ne = gain(ctx, 0);
  perc(ne.gain, t, v * 0.55, 0.0008, 0.09);
  n.connect(hp).connect(bp).connect(ne).connect(out);
}

function hat(ctx: Ctx, out: AudioNode, t: number, v: number, open: boolean, seed: number): void {
  const n = noise(ctx, t, t + (open ? 0.6 : 0.12), seed, 3);
  const hp = filt(ctx, 'highpass', open ? 6500 : 7800, 0.7);
  const pk = filt(ctx, 'peaking', 10500, 1.2, 4);
  const e = gain(ctx, 0);
  perc(e.gain, t, v, 0.0006, open ? 0.075 : 0.018);
  n.connect(hp).connect(pk).connect(e).connect(out);
}

const CORE: StemDef = {
  id: 'storm0', group: 'storm', layer: 0, bars: 8, ch: 2, tail: 2.5, rmsDb: -15,
  build(ctx, out, g) {
    const kicks = stormKickTimes(g);
    const drums = gain(ctx, 1);
    drums.connect(out);
    kicks.forEach((t, i) => kick(ctx, drums, t, i % 3 === 0 ? 1 : 0.9));
    const sn = pan(ctx, 0.05);
    sn.connect(drums);
    for (let b = 0; b < 8; b++) {
      snare(ctx, sn, b * g.bar + 4 * g.s16, 0.9, 700 + b);
      snare(ctx, sn, b * g.bar + 12 * g.s16, 0.95, 720 + b);
      if (b !== 7) {
        snare(ctx, sn, b * g.bar + 7 * g.s16, 0.22, 740 + b);
        snare(ctx, sn, b * g.bar + 15 * g.s16, b % 2 ? 0.3 : 0.18, 760 + b);
      }
      // 8th hats, softer on the beat
      for (let s = 0; s < 16; s += 2) {
        const hp = pan(ctx, s % 4 ? 0.3 : -0.2);
        hp.connect(drums);
        hat(ctx, hp, b * g.bar + s * g.s16, s % 4 ? 0.2 : 0.1, false, 800 + b * 16 + s);
      }
    }
    // bar 8: snare roll crescendo + noise riser into the downbeat
    for (let s = 8; s < 16; s++) snare(ctx, sn, 7 * g.bar + s * g.s16, 0.25 + (s - 8) * 0.09, 900 + s);
    snare(ctx, sn, 7 * g.bar + 4 * g.s16, 0.9, 930);
    {
      const t0 = 7 * g.bar + 8 * g.s16, t1 = 8 * g.bar;
      const n = noise(ctx, t0, t1 + 0.02, 950, 4, 2);
      const bp = filt(ctx, 'bandpass', 800, 1.2);
      bp.frequency.setValueAtTime(700, t0);
      bp.frequency.exponentialRampToValueAtTime(7000, t1);
      const e = gain(ctx, 0);
      e.gain.setValueAtTime(0, t0);
      e.gain.linearRampToValueAtTime(0.16, t1 - 0.01);
      e.gain.linearRampToValueAtTime(0, t1);
      n.connect(bp).connect(e).connect(drums);
    }
    // --- pumped tonal bus (reese + dark pad)
    const pump = gain(ctx, 1);
    pumpEnv(pump.gain, kicks.concat(kicks.map((k) => k + g.loop)));
    pump.connect(out);
    const rlp = filt(ctx, 'lowpass', 480, 1.6);
    const lfo = osc(ctx, 'sine', loopHz(0.28, g.loop), 0, g.end);
    const lg = gain(ctx, 260);
    lfo.connect(lg).connect(rlp.frequency);
    const rsat = shaper(ctx, 1.8);
    const rhp = filt(ctx, 'highpass', 36, 0.7);
    rlp.connect(rsat).connect(rhp).connect(pump);
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
        const sub = osc(ctx, 'sine', f, t, t + d + 0.05);
        const sg = gain(ctx, 0.9);
        sub.connect(sg).connect(e);
        e.connect(rlp);
      }
    }
    const plp = filt(ctx, 'lowpass', 1100, 0.4);
    const pg = gain(ctx, 1);
    plp.connect(pg).connect(pump);
    for (let b = 0; b < 8; b++) {
      const t = b * g.bar;
      STORM_TRIAD[b % 4].forEach((m, i) => {
        const e = gain(ctx, 0);
        swell(e.gain, t, g.bar - 0.05, 0.035, 0.06, 0.08);
        const p = pan(ctx, (i - 1) * 0.5);
        for (const det of [-7, 7]) osc(ctx, 'sawtooth', mtof(m - 12), t, t + g.bar + 0.6, det).connect(e);
        e.connect(p).connect(plp);
      });
    }
  },
};

const STABS: StemDef = {
  id: 'storm1', group: 'storm', layer: 1, bars: 4, ch: 2, tail: 1.5, rmsDb: -22,
  build(ctx, out, g) {
    const kicks = stormKickTimes(g);
    const pump = gain(ctx, 1);
    pumpEnv(pump.gain, kicks.concat(kicks.map((k) => k + g.loop)), 0.35, 0.07);
    pump.connect(out);
    const hits = [0, 3, 6, 10, 12];
    for (let b = 0; b < 4; b++) {
      const triad = STORM_TRIAD[b % 4];
      const voicing = [triad[0], triad[1], triad[2], triad[0] + 12];
      const lp = filt(ctx, 'lowpass', 1200, 1.1);
      const gate = gain(ctx, 0);
      lp.connect(gate).connect(pump);
      const t0 = b * g.bar, t1 = t0 + g.bar + 0.3;
      for (const s of hits) {
        const t = t0 + s * g.s16;
        const len = s === 12 ? g.s16 * 2.4 : g.s16 * 1.1;
        gate.gain.setValueAtTime(0, t);
        gate.gain.linearRampToValueAtTime(0.1, t + 0.003);
        gate.gain.setTargetAtTime(0.06, t + 0.003, 0.05);
        gate.gain.setTargetAtTime(0, t + len, 0.025);
        lp.frequency.setValueAtTime(5200, t);
        lp.frequency.setTargetAtTime(1300, t, 0.06);
      }
      voicing.forEach((m, vi) => {
        const f = mtof(m);
        for (let k = 0; k < 5; k++) {
          const det = (k - 2) * 11;
          const x = osc(ctx, 'sawtooth', f, t0, t1, det + vi * 0.7);
          const p = pan(ctx, ((k - 2) / 2) * 0.7);
          const xg = gain(ctx, 0.2);
          x.connect(xg).connect(p).connect(lp);
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
    for (let b = 0; b < 4; b++) {
      for (let s = 0; s < 16; s++) {
        const t = b * g.bar + s * g.s16 + (r() - 0.5) * 0.004;
        const p = pan(ctx, s % 2 ? 0.38 : -0.32);
        p.connect(out);
        const open = s % 4 === 2 && !(b === 3 && s > 8);
        hat(ctx, p, t, open ? 0.3 : vel[s % 4] * (0.85 + r() * 0.3), open, 1300 + b * 16 + s);
        if (b === 3 && s >= 12) hat(ctx, p, t + g.s16 / 2, 0.18, false, 1400 + s); // 32nd flourish
      }
    }
  },
};

const CHOIR: StemDef = {
  id: 'storm3', group: 'storm', layer: 3, bars: 4, ch: 2, tail: 3.2, rmsDb: -23,
  build(ctx, out, g) {
    const kicks = stormKickTimes(g);
    const pump = gain(ctx, 1);
    pumpEnv(pump.gain, kicks.concat(kicks.map((k) => k + g.loop)), 0.6, 0.1);
    pump.connect(out);
    const V: number[][] = [[62, 69, 74, 77], [63, 70, 75, 79], [62, 69, 74, 77], [60, 67, 72, 75]];
    for (let b = 0; b < 4; b++) {
      V[b].forEach((m, i) => {
        aah(ctx, pump, b * g.bar - 0.02 + (b === 0 ? g.loop : 0), g.bar - 0.1, mtof(m), 0.05, (i - 1.5) * 0.4, 0.12, 0.35, i < 2 ? 'o' : 'a');
      });
    }
  },
};

export const STEMS: StemDef[] = [L0, L1, L2, L3, L4, CORE, STABS, HATS, CHOIR];
export const STEM_BY_ID: Record<string, StemDef> = Object.fromEntries(STEMS.map((s) => [s.id, s]));
