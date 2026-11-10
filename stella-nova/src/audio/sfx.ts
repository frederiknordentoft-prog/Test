/**
 * Every sound effect in the game, one recipe per SfxName.
 *
 * Pitched material stays on the D minor pentatonic so it agrees with whatever
 * chord the music is on. The exception is the nova, which lands in D major
 * while the music holds its breath.
 *
 * LEVEL holds one trim per effect (dB). The recipes set the internal balance;
 * the table sets how loud each effect sits in the mix, and is tuned against
 * the audit (tools/audio-audit.cjs), not by guesswork.
 */
import { SYMBOLS } from '../core/config';
import type { SfxName, SfxParams } from '../core/types';
import { ahr, clamp, dB, LEAD, num, perc, slide, sweep, type Engine, type Voice, type VoiceOpts } from './engine';
import { bell, burst, click, glass, kick, metal, ping, sparkle, stab, wood } from './instruments';
import { mtof, NOTE, penta } from './theory';

interface Cue {
  e: Engine;
  /** Start time on the context clock. */
  t: number;
  index: number;
  /** True when the caller passed an index. */
  hasIndex: boolean;
  tier: number;
  pan: number;
  symbol: number;
  /** New voice at this effect's mix level. */
  voice(o?: VoiceOpts): Voice;
}

type Recipe = (c: Cue) => void;

interface Def {
  /** 0 expendable · 1 normal · 2 feature. */
  priority: number;
  /** Voices the recipe opens. */
  voices: number;
  /** Minimum seconds between two of these. Faster calls are dropped. */
  minGap?: number;
  play: Recipe;
}

/** Mix trims in dB. Tuned against the audit. */
const LEVEL: Record<SfxName, number> = {
  uiTap: -17,
  uiToggle: -17,
  uiOpen: -15,
  uiClose: -15,
  betUp: -15,
  betDown: -15,
  hint: -15,
  error: -14,
  spinStart: -6,
  ringNotch: -22,
  ringStop: -5,
  scatterLand: -7,
  beamFire: -8,
  lineWin: -7,
  gemBurst: -8,
  stardust: -10,
  refillLand: -9,
  tick: -3,
  multiplierUp: -7,
  nudgeReady: -8,
  nudgeDetent: -8,
  nudgeCommit: -6,
  nudgeCancel: -12,
  novaCharge: -9,
  novaReady: -6,
  novaSwell: -3,
  novaFlash: 0,
  novaShockwave: -2,
  wildTransform: -11,
  cometPass: -3,
  freeSpinsTrigger: -2,
  freeSpinsStart: -1,
  freeSpinsEnd: -3,
  bigWinStart: -1,
  countTick: -20,
  countEnd: -5,
  smallWin: -10,
  noWin: -14,
};

const RING_BELLS = [NOTE.D4, NOTE.F4, NOTE.A4, NOTE.D5];

/** Notes shared by D major (the nova's tail) and D Dorian: 16 wilds in a row climb through them twice. */
const WILD_STEPS = [74, 76, 81, 83, 86, 88, 93, 95, 76, 81, 83, 86, 88, 93, 95, 98];

/** High notes for glints and shards. */
const SPARK_NOTES = [98, 101, 105, 108, 110];
const NOVA_SPARK_NOTES = [98, 102, 105, 110, 114];

type Tint = 'gem' | 'celestial' | 'wild' | 'scatter' | 'none';
function tintOf(symbol: number): Tint {
  const meta = SYMBOLS[symbol];
  return meta ? meta.kind : 'none';
}

// ───────────────────────────── Recipes ─────────────────────────────

const uiBlip = (c: Cue, notes: number[], gap: number): void => {
  const v = c.voice({ send: 0.05 });
  notes.forEach((m, i) => wood(v, v.out, c.t + i * gap, mtof(m), 0.6, 0.05));
  click(v, v.out, c.t, 0.25, 1.3);
};

const uiSheet = (c: Cue, up: boolean): void => {
  const v = c.voice({ send: 0.16 });
  const notes = up ? [NOTE.A5, NOTE.D6] : [NOTE.D6, NOTE.A5];
  notes.forEach((m, i) => glass(v, v.out, c.t + i * 0.065, mtof(m), { gain: 0.5, decay: 0.3, bright: 0.6 }));
  burst(v, v.out, c.t, { freq: up ? 1100 : 3800, freqTo: up ? 4200 : 900, q: 1.4, gain: 0.22, attack: 0.05, decay: 0.16 });
};

const betStep = (c: Cue, up: boolean): void => {
  const v = c.voice({ send: 0.12 });
  const i = clamp(c.hasIndex ? c.index : 3, 0, 9);
  const grace = penta(i + (up ? -1 : 1), NOTE.D5);
  glass(v, v.out, c.t, mtof(grace), { gain: 0.3, decay: 0.12, bright: 0.5 });
  glass(v, v.out, c.t + 0.05, mtof(penta(i, NOTE.D5)), { gain: 0.6, decay: 0.3, bright: 0.8 });
};

/** A few ratchet clicks in a row: the gear train settling or winding. */
function rattle(v: Voice, t: number, gaps: number[], gain: number, rate: number, rateStep: number): void {
  let at = t;
  gaps.forEach((gap, i) => {
    at += gap;
    const p = v.pan((v.e.rng.next() - 0.5) * 0.7);
    p.connect(v.out);
    click(v, p, at, gain * Math.pow(0.8, i), rate + rateStep * i);
  });
}

/** Rising brass figure used by the fanfares: quick pickup notes into the chord. */
function pickup(v: Voice, t: number, notes: number[], gap: number, gain: number): void {
  notes.forEach((m, i) => {
    stab(v, v.out, t + i * gap, [m, m + 12], {
      gain: gain * (0.7 + (0.3 * i) / notes.length),
      attack: 0.012,
      hold: gap * 0.5,
      release: 0.16,
      cutoff: 900,
      cutoffPeak: 3200,
      wave: v.e.waves.brass,
      width: 0.3,
    });
  });
}

function impact(c: Cue, gain: number, send = 0.25): void {
  const v = c.voice({ send, priority: 2 });
  kick(v, v.out, c.t, { gain: gain, from: 118, to: 36, drop: 0.4, decay: 1.1, click: 0.3 });
  burst(v, v.out, c.t, { type: 'highpass', freq: 1400, gain: gain * 0.55, attack: 0.0008, decay: 0.1 });
  burst(v, v.out, c.t, { type: 'lowpass', freq: 9000, freqTo: 1400, q: 0.5, gain: gain * 0.3, attack: 0.002, decay: 0.9 });
}

const RECIPES: Record<SfxName, Def> = {
  // ── UI: small, clean, one family ──
  uiTap: { priority: 1, voices: 1, play: (c) => uiBlip(c, [NOTE.D6], 0) },
  uiToggle: {
    priority: 1,
    voices: 1,
    // index 0 = switched off (falls), anything else = on (rises).
    play: (c) => uiBlip(c, c.hasIndex && c.index === 0 ? [NOTE.D6, NOTE.A5] : [NOTE.A5, NOTE.D6], 0.055),
  },
  uiOpen: { priority: 1, voices: 1, play: (c) => uiSheet(c, true) },
  uiClose: { priority: 1, voices: 1, play: (c) => uiSheet(c, false) },
  betUp: { priority: 1, voices: 1, play: (c) => betStep(c, true) },
  betDown: { priority: 1, voices: 1, play: (c) => betStep(c, false) },
  hint: {
    priority: 1,
    voices: 1,
    play: (c) => {
      const v = c.voice({ send: 0.4 });
      bell(v, v.out, c.t, mtof(NOTE.A5), { gain: 0.5, decay: 0.7, bright: 0.5, spread: 0.3 });
      bell(v, v.out, c.t + 0.2, mtof(NOTE.D6), { gain: 0.3, decay: 0.8, bright: 0.4, spread: 0.5 });
    },
  },
  error: {
    priority: 1,
    voices: 1,
    play: (c) => {
      const v = c.voice({ send: 0.06 });
      const lp = v.filter('lowpass', 720, 0.8);
      lp.connect(v.out);
      [NOTE.D4, NOTE.A3].forEach((m, i) => {
        const t = c.t + i * 0.11;
        const o = v.osc(c.e.waves.warm, mtof(m), t, t + 0.14);
        const g = v.gain();
        ahr(g.gain, t, 0.7, 0.004, 0.03, 0.08);
        o.connect(g).connect(lp);
      });
    },
  },

  // ── Spin ──
  spinStart: {
    priority: 1,
    voices: 1,
    play: (c) => {
      const v = c.voice({ send: 0.2 });
      const t = c.t;
      kick(v, v.out, t, { gain: 0.6, from: 150, to: 52, drop: 0.07, decay: 0.22, click: 0.25 });
      // The wind-up: air and a rising tone, pulling into the whirl.
      burst(v, v.out, t, { kind: 'pink', freq: 260, freqTo: 2400, q: 0.9, gain: 0.55, attack: 0.28, hold: 0.02, decay: 0.24 });
      const lp = v.filter('lowpass', 500, 1.2);
      sweep(lp.frequency, t, 420, 2600, 0.4);
      const g = v.gain();
      ahr(g.gain, t, 0.3, 0.2, 0.06, 0.2);
      for (const cents of [-9, 9]) {
        const o = v.osc(c.e.waves.warm, mtof(NOTE.D3), t, t + 0.5, cents);
        sweep(o.frequency, t, mtof(NOTE.D3), mtof(NOTE.D4), 0.36);
        o.connect(lp);
      }
      lp.connect(g).connect(v.out);
      rattle(v, t + 0.02, [0.0, 0.07, 0.056, 0.044, 0.034, 0.026], 0.3, 0.8, 0.08);
    },
  },
  ringNotch: {
    priority: 0,
    voices: 1,
    minGap: 0.03,
    play: (c) => {
      // Two nodes, dry: this can fire more than twenty times a second.
      const v = c.voice({ micro: true, priority: 0 });
      const ring = clamp(c.index, 0, 3);
      const s = v.sample(c.e.buffers.click, c.t, 1.2 - ring * 0.08 + (c.e.rng.next() - 0.5) * 0.08);
      s.connect(v.out);
    },
  },
  ringStop: {
    priority: 1,
    voices: 2,
    play: (c) => {
      const i = clamp(Math.round(c.index), 0, 3);
      const f = mtof(RING_BELLS[i]);
      const b = c.voice({ send: 0.34 });
      bell(b, b.out, c.t, f, { gain: 0.5, decay: 1.5 + i * 0.12, bright: 0.85, hum: 0.3, spread: 0.35 });
      if (c.tier >= 1) bell(b, b.out, c.t + 0.012, f * 2, { gain: 0.16, decay: 1.2, bright: 0.6, spread: 0.6 });
      // The clunk under the bell: the ring dropping into its detent.
      const m = c.voice({ send: 0.08 });
      kick(m, m.out, c.t, { gain: 0.5, from: 150 - i * 8, to: 62, drop: 0.05, decay: 0.12 });
      click(m, m.out, c.t, 0.5, 0.66);
      burst(m, m.out, c.t, { freq: 2300, q: 1.6, gain: 0.2, decay: 0.022 });
      click(m, m.out, c.t + 0.04, 0.2, 1.15);
    },
  },
  scatterLand: {
    priority: 1,
    voices: 1,
    play: (c) => {
      // Urgency grows with every comet already on the board.
      const i = clamp(Math.round(c.index), 0, 3);
      const v = c.voice({ send: 0.45 });
      const run = [
        [81, 86, 93],
        [84, 89, 96],
        [86, 93, 98],
        [89, 96, 101],
      ][i];
      const gap = 0.07 - i * 0.012;
      run.forEach((m, k) => {
        bell(v, v.out, c.t + k * gap, mtof(m), { gain: 0.26 + k * 0.07 + i * 0.03, decay: 0.7 + k * 0.25, bright: 0.7 + i * 0.12, ratio: 5.19, spread: 0.6 });
      });
      // Ice: a breath of very high noise, and a rising glint.
      burst(v, v.out, c.t, { type: 'highpass', freq: 6800, gain: 0.07 + i * 0.02, attack: 0.03, decay: 0.3 });
      const zing = v.osc('sine', mtof(run[0]), c.t, c.t + gap * 3 + 0.1);
      sweep(zing.frequency, c.t, mtof(run[0]), mtof(run[2] + 12), gap * 3);
      const zg = v.gain();
      ahr(zg.gain, c.t, 0.05 + i * 0.02, gap * 2.5, 0, 0.08);
      zing.connect(zg).connect(v.out);
    },
  },
  beamFire: {
    priority: 1,
    voices: 1,
    play: (c) => {
      // "Laser harp": a plucked string that opens into breath.
      const tint = tintOf(c.symbol);
      const octave = tint === 'celestial' ? NOTE.D3 : NOTE.D4;
      const f = mtof(penta(clamp(c.index, 0, 9), octave));
      const v = c.voice({ send: 0.42 });
      const t = c.t;
      const lp = v.filter('lowpass', f * 2, 5);
      lp.frequency.setValueAtTime(f * 1.5, t);
      lp.frequency.exponentialRampToValueAtTime(Math.min(f * 10, 9000), t + 0.16);
      lp.frequency.exponentialRampToValueAtTime(f * 2.5, t + 0.75);
      const g = v.gain();
      ahr(g.gain, t, 0.3, 0.07, 0.1, 0.6);
      for (const side of [-1, 1]) {
        const o = v.osc(c.e.waves.warm, f, t, t + 0.85, side * 9);
        o.connect(v.pan(side * 0.5)).connect(lp);
      }
      lp.connect(g).connect(v.out);
      // Breath riding on the string's upper harmonics.
      burst(v, v.out, t, { freq: Math.min(f * 6, 9000), q: 7, gain: 0.3, attack: 0.09, hold: 0.08, decay: 0.5 });
      // The zap that makes it a beam rather than a pad.
      const zap = v.osc('sine', f * 4, t, t + 0.12);
      sweep(zap.frequency, t, f * 4, f, 0.07);
      const zg = v.gain();
      perc(zg.gain, t, 0.16, 0.002, 0.09);
      zap.connect(zg).connect(v.out);
      glass(v, v.out, t, f * 2, { gain: 0.26, decay: 0.45, bright: tint === 'gem' ? 1.2 : 0.7 });
      if (tint === 'wild') ping(v, v.out, t + 0.03, f * 3, 0.1, 0.5);
      if (c.tier >= 1) ping(v, v.out, t + 0.05, f * 4, 0.07, 0.6);
    },
  },
  lineWin: {
    priority: 1,
    voices: 2,
    play: (c) => {
      const tier = clamp(Math.round(c.tier), 0, 3);
      const i = clamp(c.index, 0, 9);
      const v = c.voice({ send: 0.36 + tier * 0.05 });
      const steps = [
        [0, 2],
        [0, 2, 4],
        [0, 2, 4, 5],
        [0, 2, 4, 5, 7, 9],
      ][tier];
      const gap = tier === 3 ? 0.07 : 0.082;
      steps.forEach((s, k) => {
        const f = mtof(penta(i + s, NOTE.D5));
        const last = k === steps.length - 1;
        const t = c.t + k * gap;
        glass(v, v.out, t, f, { gain: 0.34 + k * 0.03, decay: last ? 0.7 + tier * 0.25 : 0.4, bright: 0.9 });
        if (last && tier >= 1) bell(v, v.out, t, f, { gain: 0.2 + tier * 0.06, decay: 0.9 + tier * 0.4, bright: 0.8, spread: 0.6 });
      });
      if (tier >= 2) {
        const end = c.t + (steps.length - 1) * gap;
        const w = c.voice({ send: 0.45 });
        const root = penta(i, NOTE.D4);
        stab(w, w.out, end, [root - 12, root, root + 7, root + 12], { gain: 0.3 + (tier - 2) * 0.16, attack: 0.012, hold: 0.12, release: 0.7 + (tier - 2) * 0.6, cutoff: 800, cutoffPeak: 3600 });
        sparkle(w, w.out, end, { count: tier === 3 ? 9 : 5, span: 0.5, notes: SPARK_NOTES, gain: 0.07, decay: 0.2 });
        if (tier === 3) kick(w, w.out, end, { gain: 0.6, from: 110, to: 42, drop: 0.12, decay: 0.5 });
      }
    },
  },

  // ── Chain reaction ──
  gemBurst: {
    priority: 1,
    voices: 1,
    play: (c) => {
      const tint = tintOf(c.symbol);
      // Each gem breaks at its own pitch; planets break lower and rounder.
      const shift = tint === 'gem' ? [0.9, 1, 1.12, 1.25][c.symbol] : tint === 'celestial' ? 0.55 : 1.05;
      const v = c.voice({ send: 0.26 });
      const t = c.t;
      const src = v.noise('white', t, t + 0.3);
      const crack = v.filter('highpass', 1900 * shift, 0.7);
      const cg = v.gain();
      perc(cg.gain, t, 0.5, 0.0008, 0.055);
      src.connect(crack).connect(cg).connect(v.out);
      const sg = v.gain();
      perc(sg.gain, t, 1.3, 0.001, 0.24);
      for (const [f, q] of [
        [3100, 9],
        [5600, 12],
      ]) {
        const bp = v.filter('bandpass', f * shift, q);
        src.connect(bp).connect(sg);
      }
      sg.connect(v.out);
      const left = v.pan(-0.6);
      const right = v.pan(0.6);
      left.connect(v.out);
      right.connect(v.out);
      const k0 = Math.floor(clamp(c.index, 0, 64)) % SPARK_NOTES.length;
      [0, 0.014, 0.031, 0.052].forEach((dt, k) => {
        const m = SPARK_NOTES[(k0 + k * 2) % SPARK_NOTES.length] + (tint === 'celestial' ? -12 : 0);
        ping(v, k % 2 ? left : right, t + dt, mtof(m), 0.2 * Math.pow(0.8, k), 0.1 + k * 0.035);
      });
      kick(v, v.out, t, { gain: tint === 'celestial' ? 0.45 : 0.25, from: 230 * shift, to: 90, drop: 0.035, decay: 0.07 });
    },
  },
  stardust: {
    priority: 1,
    voices: 1,
    play: (c) => {
      const v = c.voice({ send: 0.4 });
      const left = v.pan(-0.5);
      const right = v.pan(0.5);
      left.connect(v.out);
      right.connect(v.out);
      const start = 4 + (Math.floor(clamp(c.index, 0, 20)) % 3);
      for (let k = 0; k < 7; k++) {
        const g = 0.2 * Math.sin(((k + 1) / 8) * Math.PI) + 0.08;
        ping(v, k % 2 ? left : right, c.t + k * 0.027, mtof(penta(start + k, NOTE.D5)), g, 0.09 + k * 0.012);
      }
      burst(v, v.out, c.t, { freq: 5200, freqTo: 10500, q: 2, gain: 0.16, attack: 0.1, decay: 0.16 });
    },
  },
  refillLand: {
    priority: 1,
    voices: 1,
    play: (c) => {
      const v = c.voice({ send: 0.24 });
      const i = Math.floor(clamp(c.index, 0, 400)) % 10;
      glass(v, v.out, c.t, mtof(penta(i, NOTE.D5)), { gain: 0.42, decay: 0.34, bright: 0.7 });
      kick(v, v.out, c.t, { gain: 0.2, from: 320, to: 170, drop: 0.025, decay: 0.05 });
    },
  },
  tick: {
    priority: 2,
    voices: 2,
    play: (c) => {
      // The signature: the whole mechanism advancing one notch.
      const t = c.t;
      const v = c.voice({ send: 0.1, priority: 2 });
      kick(v, v.out, t, { gain: 0.95, from: 108, to: 44, drop: 0.075, decay: 0.26, click: 0.2 });
      // A tuned body (D3) so the clonk belongs to the key.
      const body = v.osc('triangle', mtof(NOTE.D3), t, t + 0.36);
      const bg = v.gain();
      perc(bg.gain, t, 0.3, 0.003, 0.3);
      const blp = v.filter('lowpass', 620, 0.7);
      body.connect(blp).connect(bg).connect(v.out);
      metal(v, v.out, t, 1870, 0.2, 0.05);
      burst(v, v.out, t, { freq: 3200, q: 1.2, gain: 0.34, attack: 0.0006, decay: 0.03 });
      click(v, v.out, t, 0.6, 0.6);
      // Gear train settling, a little to each side.
      const r = c.voice({ send: 0.16, priority: 2 });
      rattle(r, t + 0.02, [0.03, 0.026, 0.03, 0.036, 0.044], 0.34, 0.92, -0.05);
      ping(r, r.out, t, mtof(NOTE.D5), 0.045, 0.5);
    },
  },
  multiplierUp: {
    priority: 1,
    voices: 1,
    play: (c) => {
      const i = clamp(c.index, 0, 9);
      const f = mtof(penta(i, NOTE.D5));
      const v = c.voice({ send: 0.42 });
      const t = c.t;
      const zip = v.osc('sine', f / 2, t, t + 0.16);
      sweep(zip.frequency, t, f / 2, f, 0.08);
      const zg = v.gain();
      perc(zg.gain, t, 0.2, 0.01, 0.12);
      zip.connect(zg).connect(v.out);
      bell(v, v.out, t + 0.07, f, { gain: 0.42, decay: 0.95, bright: 1 + i * 0.07, spread: 0.5 });
      if (i >= 2) bell(v, v.out, t + 0.12, f * 1.4983, { gain: 0.16, decay: 0.8, bright: 0.7, spread: 0.7 });
      if (i >= 4) ping(v, v.out, t + 0.16, f * 2, 0.08, 0.7);
      burst(v, v.out, t, { type: 'highpass', freq: 3000, freqTo: 9000, gain: 0.05 + i * 0.008, attack: 0.07, decay: 0.16 });
    },
  },

  // ── The player's move ──
  nudgeReady: {
    priority: 1,
    voices: 1,
    play: (c) => {
      // A rising fifth that does not resolve: an invitation, not an alarm.
      const v = c.voice({ send: 0.45 });
      bell(v, v.out, c.t, mtof(NOTE.D5), { gain: 0.36, decay: 0.8, bright: 0.6, spread: 0.3 });
      bell(v, v.out, c.t + 0.14, mtof(NOTE.A5), { gain: 0.42, decay: 1.1, bright: 0.7, spread: 0.5 });
      glass(v, v.out, c.t + 0.42, mtof(NOTE.A5), { gain: 0.14, decay: 0.6, bright: 0.5 });
    },
  },
  nudgeDetent: {
    priority: 1,
    voices: 1,
    minGap: 0.02,
    play: (c) => {
      const v = c.voice({ send: 0.05 });
      click(v, v.out, c.t, 1, 0.78);
      kick(v, v.out, c.t, { gain: 0.5, from: 250, to: 150, drop: 0.02, decay: 0.035 });
      metal(v, v.out, c.t, 2900, 0.14, 0.022);
    },
  },
  nudgeCommit: {
    priority: 1,
    voices: 2,
    play: (c) => {
      const m = c.voice({ send: 0.08 });
      click(m, m.out, c.t, 0.9, 0.62);
      kick(m, m.out, c.t, { gain: 0.55, from: 140, to: 66, drop: 0.045, decay: 0.11 });
      burst(m, m.out, c.t, { freq: 2600, q: 1.4, gain: 0.16, decay: 0.02 });
      const b = c.voice({ send: 0.36 });
      const ring = clamp(Math.round(c.hasIndex ? c.index : 2), 0, 3);
      bell(b, b.out, c.t + 0.012, mtof(RING_BELLS[ring] + 12), { gain: 0.3, decay: 0.75, bright: 0.7, spread: 0.4 });
    },
  },
  nudgeCancel: {
    priority: 1,
    voices: 1,
    play: (c) => {
      const v = c.voice({ send: 0.14 });
      const o = v.osc('sine', mtof(NOTE.F5), c.t, c.t + 0.3);
      sweep(o.frequency, c.t, mtof(NOTE.F5), mtof(NOTE.D5), 0.12);
      const g = v.gain();
      perc(g.gain, c.t, 0.4, 0.012, 0.22);
      o.connect(g).connect(v.out);
      kick(v, v.out, c.t + 0.08, { gain: 0.3, from: 150, to: 88, drop: 0.03, decay: 0.06 });
    },
  },

  // ── Stella Nova ──
  novaCharge: {
    priority: 1,
    voices: 1,
    play: (c) => {
      // A warm pulse of hum that swells up into its note, a step higher each time.
      const f = mtof(penta(clamp(c.index, 0, 14), NOTE.D3));
      const v = c.voice({ send: 0.32 });
      const t = c.t;
      const lp = v.filter('lowpass', 500, 1.5);
      lp.frequency.setValueAtTime(420, t);
      lp.frequency.exponentialRampToValueAtTime(1700, t + 0.14);
      lp.frequency.exponentialRampToValueAtTime(520, t + 0.5);
      const g = v.gain();
      ahr(g.gain, t, 0.5, 0.1, 0.04, 0.34);
      for (const cents of [-8, 8]) {
        const o = v.osc(c.e.waves.warm, f, t, t + 0.55, cents);
        sweep(o.frequency, t, f * 0.749, f, 0.15);
        o.connect(lp);
      }
      lp.connect(g).connect(v.out);
      ping(v, v.out, t + 0.1, f * 4, 0.05, 0.3);
    },
  },
  novaReady: {
    priority: 2,
    voices: 1,
    play: (c) => {
      const v = c.voice({ send: 0.55, priority: 2 });
      const t = c.t;
      // Two bright pulses, then a shimmer that will not sit still.
      bell(v, v.out, t, mtof(NOTE.D6), { gain: 0.3, decay: 1.0, bright: 1.2, spread: 0.6 });
      bell(v, v.out, t, mtof(NOTE.A6), { gain: 0.22, decay: 1.0, bright: 1.0, spread: 0.8 });
      bell(v, v.out, t + 0.17, mtof(NOTE.D6), { gain: 0.32, decay: 1.3, bright: 1.2, spread: 0.6 });
      bell(v, v.out, t + 0.17, mtof(NOTE.D7), { gain: 0.2, decay: 1.2, bright: 0.9, spread: 0.8 });
      const trem = v.gain();
      const lfo = v.osc('sine', 11, t, t + 1.3);
      const depth = v.gain(0.5);
      trem.gain.value = 0.5;
      lfo.connect(depth).connect(trem.gain);
      const sg = v.gain();
      ahr(sg.gain, t, 0.13, 0.08, 0.3, 0.8);
      for (const m of [NOTE.D7, NOTE.A6 + 12]) v.osc('sine', mtof(m), t, t + 1.3, (c.e.rng.next() - 0.5) * 14).connect(sg);
      sg.connect(trem).connect(v.out);
      burst(v, v.out, t, { type: 'highpass', freq: 7000, gain: 0.05, attack: 0.05, decay: 0.5 });
    },
  },
  novaSwell: {
    priority: 2,
    voices: 1,
    play: (c) => {
      // 0.9 s inhale: rising, tightening, then cut to nothing.
      const D = 0.9;
      const t = c.t;
      const end = t + D;
      const v = c.voice({ send: 0.22, priority: 2 });
      const cut = (p: AudioParam, peak: number) => {
        p.setValueAtTime(peak * 0.03, t);
        p.exponentialRampToValueAtTime(peak, end - 0.03);
        p.linearRampToValueAtTime(0, end);
      };
      // Air, wide at first, drawn to the centre as it rises.
      for (const side of [-1, 1]) {
        const src = v.noise('white', t, end + 0.03);
        const bp = v.filter('bandpass', 300, 0.8);
        sweep(bp.frequency, t, 280, 5600, D);
        slide(bp.Q, t, 0.8, 5, D);
        const g = v.gain();
        cut(g.gain, 0.55);
        const p = v.pan(side * 0.95);
        slide(p.pan, t, side * 0.95, 0, D);
        src.connect(bp).connect(g).connect(p).connect(v.out);
      }
      // A chord of fifths sliding up an octave under it.
      const lp = v.filter('lowpass', 300, 2);
      sweep(lp.frequency, t, 280, 4200, D);
      const tg = v.gain();
      cut(tg.gain, 0.34);
      for (const m of [NOTE.D3, NOTE.A3, NOTE.D4]) {
        const o = v.osc(c.e.waves.warm, mtof(m), t, end + 0.03, (c.e.rng.next() - 0.5) * 16);
        sweep(o.frequency, t, mtof(m), mtof(m + 12), D);
        o.connect(lp);
      }
      lp.connect(tg).connect(v.out);
      const sub = v.osc('sine', 55, t, end + 0.03);
      sweep(sub.frequency, t, 55, 110, D);
      const sg = v.gain();
      cut(sg.gain, 0.5);
      sub.connect(sg).connect(v.out);
    },
  },
  novaFlash: {
    priority: 2,
    voices: 3,
    play: (c) => {
      const t = c.t;
      c.e.duck(0.06, 2.2, 1.8, 0.02);
      // The hit: sub drop and a crack of noise.
      const hit = c.voice({ send: 0.22, priority: 2 });
      kick(hit, hit.out, t, { gain: 1.0, from: 124, to: 33, drop: 0.55, decay: 1.7, click: 0.3 });
      const sub2 = hit.osc('triangle', 248, t, t + 0.9);
      sweep(sub2.frequency, t, 248, 66, 0.55);
      const s2g = hit.gain();
      perc(s2g.gain, t, 0.22, 0.003, 0.8);
      const s2lp = hit.filter('lowpass', 400, 0.7);
      sub2.connect(s2lp).connect(s2g).connect(hit.out);
      burst(hit, hit.out, t, { type: 'highpass', freq: 1200, gain: 0.8, attack: 0.0006, decay: 0.12 });
      burst(hit, hit.out, t, { type: 'lowpass', freq: 12000, freqTo: 1300, q: 0.5, gain: 0.34, attack: 0.002, decay: 1.4 });
      // D major, as wide as the room.
      const chord = c.voice({ send: 0.6, priority: 2 });
      stab(chord, chord.out, t, [38, 50, 57, 62, 66, 69, 74, 78], { gain: 1.25, attack: 0.004, hold: 0.3, release: 2.6, cutoff: 1100, cutoffPeak: 9000, detune: 11, width: 0.9 });
      const bells = c.voice({ send: 0.7, priority: 2 });
      [74, 78, 81, 86].forEach((m, k) => bell(bells, bells.out, t + k * 0.012, mtof(m), { gain: 0.3, decay: 2.6, bright: 1.1, spread: 0.9, hum: 0.2 }));
      sparkle(bells, bells.out, t + 0.1, { count: 12, span: 1.6, notes: NOVA_SPARK_NOTES, gain: 0.05, decay: 0.3 });
    },
  },
  novaShockwave: {
    priority: 2,
    voices: 2,
    play: (c) => {
      const t = c.t;
      c.e.duck(0.3, 1.3, 1.6);
      const v = c.voice({ send: 0.5, priority: 2 });
      // The wave passes outward: from the centre to both edges, falling in pitch.
      for (const side of [-1, 1]) {
        const src = v.noise('pink', t, t + 2.4);
        const bp = v.filter('bandpass', 2600, 0.9);
        sweep(bp.frequency, t, 2800, 170, 1.9);
        const g = v.gain();
        ahr(g.gain, t, 0.85, 0.22, 0.1, 1.9);
        const p = v.pan(0);
        slide(p.pan, t, 0, side * 0.95, 1.3);
        src.connect(bp).connect(g).connect(p).connect(v.out);
      }
      burst(v, v.out, t, { kind: 'brown', type: 'lowpass', freq: 120, gain: 3.2, attack: 0.3, hold: 0.3, decay: 2.2 });
      for (const [f, gain] of [
        [mtof(NOTE.D1), 0.5],
        [mtof(NOTE.A1), 0.3],
      ]) {
        const o = v.osc('sine', f, t, t + 2.9);
        const g = v.gain();
        ahr(g.gain, t, gain, 0.2, 0.2, 2.4);
        o.connect(g).connect(v.out);
      }
      // What is left in the air afterwards.
      const tail = c.voice({ send: 0.75, priority: 2 });
      [86, 90, 93, 98, 102].forEach((m, k) => {
        const o = tail.osc('sine', mtof(m), t, t + 3.1, (c.e.rng.next() - 0.5) * 12);
        const trem = tail.gain(0.5);
        const lfo = tail.osc('sine', 4.5 + c.e.rng.next() * 5, t, t + 3.1);
        const depth = tail.gain(0.5);
        lfo.connect(depth).connect(trem.gain);
        const g = tail.gain();
        ahr(g.gain, t, 0.075, 0.5, 0.2, 2.4);
        o.connect(g).connect(trem).connect(tail.pan((k / 4) * 1.6 - 0.8)).connect(tail.out);
      });
    },
  },
  wildTransform: {
    priority: 1,
    voices: 1,
    play: (c) => {
      const i = Math.floor(clamp(c.index, 0, 1000)) % WILD_STEPS.length;
      const f = mtof(WILD_STEPS[i]);
      const v = c.voice({ send: 0.42 });
      bell(v, v.out, c.t, f, { gain: 0.42, decay: 0.75, bright: 1.25, ratio: 3.5, spread: 0.5 });
      ping(v, v.out, c.t, Math.min(f * 3, 12000), 0.06, 0.12);
      burst(v, v.out, c.t, { type: 'highpass', freq: 7500, gain: 0.07, attack: 0.002, decay: 0.07 });
    },
  },
  cometPass: {
    priority: 2,
    voices: 2,
    play: (c) => {
      const t = c.t;
      const D = 1.6;
      const dir = c.pan < 0 ? -1 : 1;
      const mid = t + D * 0.52;
      c.e.duck(0.55, 1.0, 1.0);
      // One panner carries the whole comet across the frame.
      const v = c.voice({ send: 0.45, priority: 2, pan: 0 });
      const p = v.pan(-0.9 * dir);
      slide(p.pan, t, -0.9 * dir, 0.9 * dir, D);
      p.connect(v.out);
      const src = v.noise('white', t, t + D + 0.5);
      const bp = v.filter('bandpass', 500, 1.3);
      bp.frequency.setValueAtTime(480, t);
      bp.frequency.exponentialRampToValueAtTime(3600, mid);
      bp.frequency.exponentialRampToValueAtTime(360, t + D + 0.3);
      const g = v.gain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + D * 0.25);
      g.gain.exponentialRampToValueAtTime(1.0, mid);
      g.gain.exponentialRampToValueAtTime(0.001, t + D + 0.4);
      g.gain.linearRampToValueAtTime(0, t + D + 0.42);
      src.connect(bp).connect(g).connect(p);
      // Doppler: the comet's own note drops a minor third (A to F) as it passes.
      const lp = v.filter('lowpass', 2400, 1);
      const tg = v.gain();
      tg.gain.setValueAtTime(0, t);
      tg.gain.linearRampToValueAtTime(0.03, t + D * 0.25);
      tg.gain.exponentialRampToValueAtTime(0.2, mid);
      tg.gain.exponentialRampToValueAtTime(0.0005, t + D + 0.3);
      tg.gain.linearRampToValueAtTime(0, t + D + 0.32);
      for (const cents of [-10, 10]) {
        const o = v.osc(c.e.waves.warm, mtof(NOTE.A5), t, t + D + 0.4, cents);
        o.frequency.setValueAtTime(mtof(NOTE.A5), t);
        o.frequency.setTargetAtTime(mtof(NOTE.F5), mid - 0.08, 0.09);
        o.connect(lp);
      }
      lp.connect(tg).connect(p);
      // Ice shed along the tail.
      const ice = c.voice({ send: 0.6, priority: 2, pan: 0.2 * dir });
      sparkle(ice, ice.out, t + D * 0.3, { count: 12, span: D * 0.9, notes: SPARK_NOTES, gain: 0.09, decay: 0.22, width: 0.7 });
      burst(ice, ice.out, mid - 0.1, { type: 'highpass', freq: 7200, gain: 0.08, attack: 0.1, decay: 0.9 });
    },
  },

  // ── Kometnat ──
  freeSpinsTrigger: {
    priority: 2,
    voices: 3,
    play: (c) => {
      const t = c.t;
      c.e.duck(0.3, 1.6, 1.2);
      const run = [62, 69, 74, 77, 81, 86];
      const gap = 0.075;
      const hitAt = t + (run.length - 1) * gap;
      const b = c.voice({ send: 0.55, priority: 2 });
      run.forEach((m, k) => {
        const last = k === run.length - 1;
        bell(b, b.out, t + k * gap, mtof(m), { gain: 0.26 + k * 0.035, decay: last ? 2.2 : 0.9, bright: 0.9 + k * 0.05, spread: 0.3 + k * 0.1 });
        glass(b, b.out, t + k * gap, mtof(m + 12), { gain: 0.12, decay: 0.4 });
      });
      const w = c.voice({ send: 0.5, priority: 2 });
      burst(w, w.out, t, { type: 'highpass', freq: 2500, freqTo: 8000, gain: 0.2, attack: hitAt - t, hold: 0.01, decay: 0.5 });
      stab(w, w.out, hitAt, [50, 57, 62, 65, 69, 76], { gain: 0.95, attack: 0.015, hold: 0.45, release: 1.7, cutoff: 800, cutoffPeak: 4600, width: 0.8 });
      sparkle(w, w.out, hitAt + 0.05, { count: 12, span: 1.2, notes: SPARK_NOTES, gain: 0.07, decay: 0.25 });
      c.t = hitAt;
      impact(c, 0.7);
    },
  },
  freeSpinsStart: {
    priority: 2,
    voices: 3,
    play: (c) => {
      // B♭ → C → Dm: the night opens.
      const t = c.t;
      c.e.duck(0.3, 2.0, 1.2);
      const w = c.voice({ send: 0.5, priority: 2 });
      const chords: [number, number[], number][] = [
        [0, [46, 58, 62, 65, 70, 74], 0.24],
        [0.38, [48, 60, 64, 67, 72, 76], 0.24],
        [0.76, [50, 57, 62, 65, 69, 74, 81], 1.1],
      ];
      chords.forEach(([dt, notes, hold], k) => {
        const last = k === chords.length - 1;
        stab(w, w.out, t + dt, notes, { gain: 0.8 + k * 0.12, attack: 0.02, hold, release: last ? 1.9 : 0.22, cutoff: 850, cutoffPeak: last ? 5200 : 3600, wave: last ? c.e.waves.warm : c.e.waves.brass, width: 0.8 });
        kick(w, w.out, t + dt, { gain: 0.5 + k * 0.1, from: 110, to: 48, drop: 0.1, decay: 0.3 });
      });
      burst(w, w.out, t, { kind: 'pink', freq: 400, freqTo: 5000, q: 1, gain: 0.4, attack: 0.72, hold: 0.02, decay: 0.3 });
      const b = c.voice({ send: 0.6, priority: 2 });
      [
        [0, 86],
        [0.38, 88],
        [0.76, 89],
        [0.9, 93],
      ].forEach(([dt, m]) => bell(b, b.out, t + dt, mtof(m), { gain: 0.3, decay: 1.8, bright: 1, spread: 0.7 }));
      sparkle(b, b.out, t + 0.8, { count: 14, span: 1.5, notes: SPARK_NOTES, gain: 0.06, decay: 0.26 });
      c.t = t + 0.76;
      impact(c, 0.65);
    },
  },
  freeSpinsEnd: {
    priority: 2,
    voices: 2,
    play: (c) => {
      // F → C → Dm, unhurried: coming home.
      const t = c.t;
      c.e.duck(0.45, 1.8, 1.2);
      const w = c.voice({ send: 0.5, priority: 2 });
      const chords: [number, number[], number, number][] = [
        [0, [53, 60, 65, 69, 72], 0.3, 0.5],
        [0.5, [48, 55, 64, 67, 72], 0.3, 0.5],
        [1.0, [50, 57, 62, 65, 69, 74], 0.6, 2.2],
      ];
      chords.forEach(([dt, notes, hold, release]) => {
        stab(w, w.out, t + dt, notes, { gain: 0.9, attack: 0.06, hold, release, cutoff: 700, cutoffPeak: 2600, width: 0.8 });
      });
      kick(w, w.out, t + 1.0, { gain: 0.6, from: 96, to: 37, drop: 0.3, decay: 1.2 });
      const b = c.voice({ send: 0.6, priority: 2 });
      [
        [0, 93],
        [0.25, 91],
        [0.5, 88],
        [0.75, 84],
        [1.0, 86],
        [1.0, 74],
      ].forEach(([dt, m]) => bell(b, b.out, t + dt, mtof(m), { gain: 0.28, decay: dt >= 1 ? 2.4 : 1.2, bright: 0.8, spread: 0.6 }));
    },
  },

  // ── Wins ──
  bigWinStart: {
    priority: 2,
    voices: 4,
    play: (c) => {
      const tier = clamp(Math.round(c.tier) || 1, 1, 3);
      const t = c.t;
      c.e.duck(0.25, 1.2 + tier * 0.3, 1.0);
      impact(c, 0.75 + tier * 0.08, 0.3);
      const w = c.voice({ send: 0.5, priority: 2 });
      const brass = c.e.waves.brass;
      // Pickup run into the chords. Every tier adds a chord and an octave.
      const run = tier === 1 ? [62, 65, 69] : [62, 65, 69, 72];
      pickup(w, t + 0.04, run, 0.085, 0.5);
      const first = t + 0.04 + run.length * 0.085;
      const chords: [number, number[]][] =
        tier === 1
          ? [[0, [50, 57, 62, 65, 69, 74]]]
          : [
              [0, [46, 53, 58, 62, 65, 70]],
              [0.32, [48, 55, 60, 64, 67, 72]],
              [0.64, tier === 3 ? [38, 50, 57, 62, 69, 74, 76, 81] : [50, 57, 62, 69, 74, 76]],
            ];
      const b = c.voice({ send: 0.6, priority: 2 });
      chords.forEach(([dt, notes], k) => {
        const last = k === chords.length - 1;
        stab(w, w.out, first + dt, notes, { gain: 0.85 + k * 0.1, attack: 0.018, hold: last ? 0.5 + tier * 0.15 : 0.2, release: last ? 1.2 + tier * 0.3 : 0.16, cutoff: 900, cutoffPeak: 4200 + tier * 500, wave: brass, width: 0.85 });
        kick(w, w.out, first + dt, { gain: 0.5, from: 105, to: 46, drop: 0.1, decay: 0.32 });
        const top = notes[notes.length - 1] + 12;
        bell(b, b.out, first + dt, mtof(top), { gain: 0.3, decay: last ? 2.0 : 0.9, bright: 1.1, spread: 0.7 });
        if (tier >= 2) bell(b, b.out, first + dt + 0.012, mtof(top - 5), { gain: 0.18, decay: 1.2, bright: 0.9, spread: 0.9 });
      });
      const lastAt = first + chords[chords.length - 1][0];
      const s = c.voice({ send: 0.6, priority: 2 });
      sparkle(s, s.out, lastAt, { count: 8 + tier * 5, span: 1.0 + tier * 0.4, notes: SPARK_NOTES, gain: 0.065, decay: 0.26 });
      if (tier === 3) burst(s, s.out, t, { type: 'highpass', freq: 2000, freqTo: 9000, gain: 0.22, attack: lastAt - t, hold: 0.01, decay: 0.8 });
    },
  },
  countTick: {
    priority: 0,
    voices: 1,
    minGap: 0.028,
    play: (c) => {
      const v = c.voice({ micro: true, priority: 0 });
      const i = Math.floor(clamp(c.index, 0, 100000)) % 15;
      const s = v.sample(c.e.buffers.blip, c.t, mtof(penta(i, NOTE.D5)) / 1000);
      s.connect(v.out);
    },
  },
  countEnd: {
    priority: 2,
    voices: 2,
    play: (c) => {
      const tier = clamp(Math.round(c.tier), 0, 3);
      const t = c.t;
      c.e.duck(0.6, 0.7, 0.8);
      const b = c.voice({ send: 0.55, priority: 2 });
      const notes = tier >= 2 ? [74, 81, 86, 89, 93, 98] : [74, 81, 86, 89];
      notes.forEach((m, k) => bell(b, b.out, t + k * 0.018, mtof(m), { gain: 0.3, decay: 1.7 + tier * 0.2, bright: 0.9, spread: 0.3 + k * 0.12, hum: k === 0 ? 0.3 : 0 }));
      const w = c.voice({ send: 0.45, priority: 2 });
      stab(w, w.out, t, [50, 57, 62, 65, 69], { gain: 0.7, attack: 0.01, hold: 0.2, release: 1.3, cutoff: 750, cutoffPeak: 3200, width: 0.8 });
      kick(w, w.out, t, { gain: 0.6, from: 96, to: 44, drop: 0.12, decay: 0.5 });
      if (tier >= 2) sparkle(w, w.out, t + 0.05, { count: 8, span: 0.8, notes: SPARK_NOTES, gain: 0.06, decay: 0.22 });
    },
  },
  smallWin: {
    priority: 1,
    voices: 1,
    play: (c) => {
      // Modest on purpose: a win below the bet is confirmed, not celebrated.
      const v = c.voice({ send: 0.3 });
      glass(v, v.out, c.t, mtof(NOTE.F5), { gain: 0.42, decay: 0.4, bright: 0.6 });
      glass(v, v.out, c.t + 0.11, mtof(NOTE.A5), { gain: 0.46, decay: 0.55, bright: 0.6 });
    },
  },
  noWin: {
    priority: 0,
    voices: 1,
    play: (c) => {
      const v = c.voice({ send: 0.2, priority: 0 });
      const o = v.osc('sine', mtof(NOTE.A2), c.t, c.t + 0.5);
      sweep(o.frequency, c.t, mtof(NOTE.A2), mtof(NOTE.D2), 0.26);
      const g = v.gain();
      ahr(g.gain, c.t, 0.8, 0.04, 0.03, 0.36);
      o.connect(g).connect(v.out);
      burst(v, v.out, c.t, { kind: 'pink', type: 'lowpass', freq: 420, gain: 0.5, attack: 0.05, decay: 0.3 });
    },
  },
};

// ───────────────────────────── Player ─────────────────────────────

export const SFX_NAMES = Object.keys(RECIPES) as SfxName[];

export class SfxPlayer {
  private readonly last = new Map<SfxName, number>();

  constructor(private readonly e: Engine) {}

  play(name: SfxName, p: SfxParams = {}): void {
    const def = RECIPES[name];
    if (!def) return;
    const e = this.e;
    const now = e.now;
    if (def.minGap) {
      const last = this.last.get(name);
      if (last !== undefined && now - last < def.minGap) return;
      this.last.set(name, now);
    }
    if (!e.admit(def.priority, false, def.voices)) return;
    const level = dB(LEVEL[name]) * clamp(num(p.gain, 1), 0, 2);
    const pan = clamp(num(p.pan, 0), -1, 1);
    const cue: Cue = {
      e,
      t: now + LEAD,
      index: num(p.index, 0),
      hasIndex: typeof p.index === 'number' && Number.isFinite(p.index),
      tier: num(p.tier, 0),
      pan,
      symbol: num(p.symbol, -1),
      voice: (o: VoiceOpts = {}) => e.voice({ priority: def.priority, pan, ...o, at: cue.t, gain: level * (o.gain ?? 1) }),
    };
    def.play(cue);
  }
}
