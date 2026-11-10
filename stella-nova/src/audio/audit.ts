/**
 * Measurement bench. Nobody on the build can hear the game, so every sound is
 * rendered on an OfflineAudioContext through the real engine and judged by
 * numbers: level, loudness, spectrum, onsets, tails.
 *
 * Imported by the sandbox page only; the game bundle never sees this file.
 */
import type { MusicState, SfxName, SfxParams } from '../core/types';
import { AudioCore, MUSIC_STATES, type EngineStats } from './index';

export const AUDIT_RATE = 48000;
/** The offline stand-in for the live 40 ms timer. Must stay below the scheduler's look-ahead. */
const PUMP = 0.1;

// ───────────────────────────── Offline rendering ─────────────────────────────

export type Schedule = (time: number, fn: () => void) => void;
export type Script = (core: AudioCore, at: Schedule) => void;

export interface Render {
  buffer: AudioBuffer;
  stats: EngineStats;
  /** Errors thrown by the script's actions (a cue that throws is a bug). */
  errors: string[];
}

/**
 * Render `seconds` of the engine while `script` plays it. Actions run at their
 * time on the context clock (the render is suspended there), and the core is
 * pumped ten times a second exactly as the live timer would.
 */
export async function renderOffline(seconds: number, script: Script, rate = AUDIT_RATE): Promise<Render> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
  const core = new AudioCore(ctx);
  const actions: { time: number; fn: () => void; done: boolean }[] = [];
  const errors: string[] = [];
  script(core, (time, fn) => actions.push({ time, fn, done: false }));
  actions.sort((a, b) => a.time - b.time);

  const run = (now: number) => {
    for (const a of actions) {
      if (a.done || a.time > now + 1e-6) continue;
      a.done = true;
      try {
        a.fn();
      } catch (err) {
        errors.push(String(err));
      }
    }
    try {
      core.pump();
    } catch (err) {
      errors.push(`pump: ${String(err)}`);
    }
  };

  // Suspend points: the pump grid plus every action time, one per render quantum.
  const frames = new Set<number>();
  const quantum = (time: number) => Math.ceil((time * rate) / 128) * 128;
  for (let k = 1; k * PUMP < seconds; k++) frames.add(quantum(k * PUMP));
  for (const a of actions) if (a.time > 0 && a.time < seconds) frames.add(quantum(a.time));
  const total = Math.ceil(seconds * rate);
  for (const f of frames) {
    if (f <= 0 || f >= total) continue;
    void ctx.suspend(f / rate).then(() => {
      run(ctx.currentTime);
      void ctx.resume();
    });
  }
  run(0);
  const buffer = await ctx.startRendering();
  const stats = { ...core.engine.stats };
  return { buffer, stats, errors };
}

// ───────────────────────────── Analysis ─────────────────────────────

export interface Metrics {
  /** Seconds from the start of the render until the level last exceeds −60 dBFS. */
  dur: number;
  onset: number;
  peakDb: number;
  rmsDb: number;
  /** Loudest 200 ms, K-weighted (LKFS-like). The "how loud does it feel" figure. */
  loudDb: number;
  /** K-weighted loudness over the whole active stretch. */
  lufs: number;
  /** Spectral centroid, Hz. */
  centroid: number;
  dc: number;
  /** Share of energy per band: <120, 120–500, 500–2k, 2k–8k, >8k Hz. */
  bands: number[];
  /** |sample| at the first / last audible sample. Large = the sound starts or ends with a step. */
  startStep: number;
  endStep: number;
  /** Still audible at the end of the render. */
  cut: boolean;
  nan: boolean;
  /** Longest silent gap inside the active stretch, seconds. */
  gap: number;
  /** Peak difference between the channels' correlation: 1 = mono, 0 = fully wide. */
  correlation: number;
}

const toDb = (x: number): number => (x > 1e-10 ? 20 * Math.log10(x) : -200);

/** In-place radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** BS.1770 K-weighting at 48 kHz: a high shelf, then a high-pass. */
function kWeight(x: Float32Array): Float32Array {
  const y = new Float32Array(x.length);
  const stages = [
    { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] },
    { b: [1.0, -2.0, 1.0], a: [-1.99004745483398, 0.99007225036621] },
  ];
  let src: Float32Array = x;
  for (const s of stages) {
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < src.length; i++) {
      const xi = src[i];
      const yi = s.b[0] * xi + s.b[1] * x1 + s.b[2] * x2 - s.a[0] * y1 - s.a[1] * y2;
      x2 = x1;
      x1 = xi;
      y2 = y1;
      y1 = yi;
      y[i] = yi;
    }
    src = y;
  }
  return y;
}

export function analyse(buffer: AudioBuffer): Metrics {
  const L = buffer.getChannelData(0);
  const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
  const n = L.length;
  const sr = buffer.sampleRate;
  const AUDIBLE = 0.001;

  let nan = false;
  let peak = 0;
  let first = -1;
  let last = -1;
  let sumL = 0;
  let sumR = 0;
  for (let i = 0; i < n; i++) {
    const l = L[i];
    const r = R[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) {
      nan = true;
      continue;
    }
    const a = Math.max(Math.abs(l), Math.abs(r));
    if (a > peak) peak = a;
    if (a > AUDIBLE) {
      if (first < 0) first = i;
      last = i;
    }
    sumL += l;
    sumR += r;
  }
  const empty: Metrics = { dur: 0, onset: 0, peakDb: toDb(peak), rmsDb: -200, loudDb: -200, lufs: -200, centroid: 0, dc: 0, bands: [0, 0, 0, 0, 0], startStep: 0, endStep: 0, cut: false, nan, gap: 0, correlation: 1 };
  if (nan || first < 0) return empty;

  // RMS, correlation and the longest gap over the active stretch.
  let sq = 0;
  let ll = 0;
  let rr = 0;
  let lr = 0;
  let quiet = 0;
  let gap = 0;
  for (let i = first; i <= last; i++) {
    const l = L[i];
    const r = R[i];
    sq += l * l + r * r;
    ll += l * l;
    rr += r * r;
    lr += l * r;
    if (Math.max(Math.abs(l), Math.abs(r)) < AUDIBLE) {
      quiet++;
      if (quiet > gap) gap = quiet;
    } else quiet = 0;
  }
  const count = last - first + 1;
  const rms = Math.sqrt(sq / (2 * count));

  // K-weighted loudness: loudest 200 ms window and the whole active stretch.
  const kl = kWeight(L);
  const kr = R === L ? kl : kWeight(R);
  const acc = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) acc[i + 1] = acc[i] + kl[i] * kl[i] + kr[i] * kr[i];
  const win = Math.floor(sr * 0.2);
  const hop = Math.floor(sr * 0.02);
  let best = 0;
  for (let i = 0; i + win <= n; i += hop) {
    const e = (acc[i + win] - acc[i]) / win;
    if (e > best) best = e;
  }
  if (n < win) best = acc[n] / win;
  const whole = (acc[last + 1] - acc[first]) / count;
  const lk = (meanSquare: number) => (meanSquare > 1e-12 ? -0.691 + 10 * Math.log10(meanSquare) : -200);

  // Average spectrum (mono mix, Hann, 4096) for the centroid and the band shares.
  const N = 4096;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const power = new Float64Array(N / 2);
  const start = Math.max(0, Math.min(first, n - N));
  const stop = Math.max(start + 1, last - N / 2);
  for (let pos = start; pos < stop; pos += N / 2) {
    for (let i = 0; i < N; i++) {
      const j = pos + i;
      const s = j < n ? (L[j] + R[j]) * 0.5 : 0;
      re[i] = s * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 1; k < N / 2; k++) power[k] += re[k] * re[k] + im[k] * im[k];
  }
  let pSum = 0;
  let fSum = 0;
  const bands = [0, 0, 0, 0, 0];
  const edges = [120, 500, 2000, 8000];
  for (let k = 1; k < N / 2; k++) {
    const f = (k * sr) / N;
    pSum += power[k];
    fSum += power[k] * f;
    let b = 0;
    while (b < edges.length && f >= edges[b]) b++;
    bands[b] += power[k];
  }

  return {
    dur: (last + 1) / sr,
    onset: first / sr,
    peakDb: toDb(peak),
    rmsDb: toDb(rms),
    loudDb: lk(best),
    lufs: lk(whole),
    centroid: pSum > 0 ? fSum / pSum : 0,
    dc: Math.max(Math.abs(sumL / n), Math.abs(sumR / n)),
    bands: bands.map((b) => (pSum > 0 ? b / pSum : 0)),
    startStep: Math.max(Math.abs(L[first]), Math.abs(R[first])),
    endStep: Math.max(Math.abs(L[last]), Math.abs(R[last])),
    cut: last >= n - Math.floor(sr * 0.005),
    nan,
    gap: gap / sr,
    correlation: ll > 0 && rr > 0 ? lr / Math.sqrt(ll * rr) : 1,
  };
}

// ───────────────────────────── Cases ─────────────────────────────

/**
 * Roles: effects that do the same job must sit at the same loudness.
 * Windows are in dB of "loudest 200 ms, K-weighted" for effects and of
 * integrated loudness for music.
 */
export type Role = 'micro' | 'soft' | 'ui' | 'cascade' | 'mech' | 'notify' | 'feature' | 'bed' | 'music' | 'hush' | 'mix';

export const ROLE_WINDOW: Record<Role, [number, number]> = {
  micro: [-52, -40],
  soft: [-40, -31],
  ui: [-36, -30],
  cascade: [-29, -23],
  mech: [-25, -19],
  notify: [-27, -21],
  feature: [-17, -11],
  bed: [-34, -24],
  music: [-33, -22],
  hush: [-75, -45],
  mix: [-30, -8],
};

export interface Case {
  name: string;
  role: Role;
  seconds: number;
  script: Script;
  /** Time the sound is expected to be over by (beds: after release). */
  endBy?: number;
  /** Music: a longer silent gap than this means the scheduler stalled. */
  maxGap?: number;
}

const one =
  (name: SfxName, p?: SfxParams): Script =>
  (core) =>
    core.sfx(name, p);

function sfxCases(): Case[] {
  const c = (name: SfxName, role: Role, seconds: number, p?: SfxParams, label?: string): Case => ({
    name: label ?? name + (p ? ` ${describe(p)}` : ''),
    role,
    seconds,
    script: one(name, p),
  });
  return [
    c('uiTap', 'ui', 3),
    c('uiToggle', 'ui', 3),
    c('uiToggle', 'ui', 3, { index: 0 }),
    c('uiOpen', 'ui', 3),
    c('uiClose', 'ui', 3),
    c('betUp', 'ui', 3, { index: 0 }),
    c('betUp', 'ui', 3, { index: 7 }),
    c('betDown', 'ui', 3, { index: 3 }),
    c('hint', 'ui', 4),
    c('error', 'ui', 3),
    c('spinStart', 'mech', 4),
    c('ringNotch', 'micro', 2),
    c('ringNotch', 'micro', 2, { index: 3 }),
    c('ringStop', 'mech', 5, { index: 0 }),
    c('ringStop', 'mech', 5, { index: 1 }),
    c('ringStop', 'mech', 5, { index: 2 }),
    c('ringStop', 'mech', 5, { index: 3 }),
    c('ringStop', 'mech', 5, { index: 3, tier: 1 }),
    c('scatterLand', 'notify', 5, { index: 0 }),
    c('scatterLand', 'notify', 5, { index: 1 }),
    c('scatterLand', 'notify', 5, { index: 2 }),
    c('scatterLand', 'notify', 5, { index: 3 }),
    c('beamFire', 'cascade', 4, { index: 0, symbol: 0 }),
    c('beamFire', 'cascade', 4, { index: 3, symbol: 5 }),
    c('beamFire', 'cascade', 4, { index: 6, symbol: 8, tier: 1 }),
    c('lineWin', 'notify', 4, { index: 0, tier: 0 }),
    c('lineWin', 'notify', 4, { index: 5, tier: 1 }),
    c('lineWin', 'notify', 5, { index: 2, tier: 2 }),
    c('lineWin', 'feature', 6, { index: 0, tier: 3 }),
    c('gemBurst', 'cascade', 4, { symbol: 0 }),
    c('gemBurst', 'cascade', 4, { symbol: 3, index: 2 }),
    c('gemBurst', 'cascade', 4, { symbol: 6 }),
    c('stardust', 'cascade', 4),
    c('refillLand', 'cascade', 3, { index: 0 }),
    c('refillLand', 'cascade', 3, { index: 9 }),
    c('tick', 'mech', 4),
    c('multiplierUp', 'notify', 5, { index: 0 }),
    c('multiplierUp', 'notify', 5, { index: 3 }),
    c('multiplierUp', 'notify', 5, { index: 6 }),
    c('nudgeReady', 'notify', 5),
    c('nudgeDetent', 'mech', 2),
    c('nudgeCommit', 'mech', 4, { index: 1 }),
    c('nudgeCancel', 'soft', 3),
    c('novaCharge', 'cascade', 4, { index: 0 }),
    c('novaCharge', 'cascade', 4, { index: 8 }),
    c('novaReady', 'notify', 5),
    c('novaSwell', 'feature', 4),
    c('novaFlash', 'feature', 8),
    c('novaShockwave', 'feature', 8),
    c('wildTransform', 'cascade', 4, { index: 0 }),
    c('wildTransform', 'cascade', 4, { index: 15 }),
    c('cometPass', 'feature', 6),
    c('freeSpinsTrigger', 'feature', 7),
    c('freeSpinsStart', 'feature', 8),
    c('freeSpinsEnd', 'feature', 8),
    c('bigWinStart', 'feature', 7, { tier: 1 }),
    c('bigWinStart', 'feature', 8, { tier: 2 }),
    c('bigWinStart', 'feature', 8, { tier: 3 }),
    c('countTick', 'micro', 2, { index: 0 }),
    c('countTick', 'micro', 2, { index: 14 }),
    c('countEnd', 'notify', 6, { tier: 0 }),
    c('countEnd', 'notify', 6, { tier: 3 }),
    c('smallWin', 'notify', 4),
    c('noWin', 'soft', 3),
  ];
}

function describe(p: SfxParams): string {
  const parts: string[] = [];
  if (p.index !== undefined) parts.push(`i${p.index}`);
  if (p.tier !== undefined) parts.push(`t${p.tier}`);
  if (p.symbol !== undefined) parts.push(`s${p.symbol}`);
  if (p.pan !== undefined) parts.push(`p${p.pan}`);
  return parts.join(' ');
}

/** Rapid sequences, beds and whole-mix scenarios: the ways the game actually leans on the engine. */
function scenarioCases(): Case[] {
  const repeat =
    (name: SfxName, count: number, gap: number, p: (i: number) => SfxParams): Script =>
    (core, at) => {
      for (let i = 0; i < count; i++) at(i * gap, () => core.sfx(name, p(i)));
    };
  return [
    { name: 'seq ringNotch ×40 @40ms', role: 'mix', seconds: 3, script: repeat('ringNotch', 40, 0.04, (i) => ({ index: i % 4 })) },
    { name: 'seq gemBurst ×12 @25ms', role: 'mix', seconds: 4, script: repeat('gemBurst', 12, 0.025, (i) => ({ index: i, symbol: i % 4, pan: (i % 5) / 2 - 1 })) },
    { name: 'seq refillLand ×12 @45ms', role: 'mix', seconds: 4, script: repeat('refillLand', 12, 0.045, (i) => ({ index: i, pan: (i % 5) / 2 - 1 })) },
    { name: 'seq wildTransform ×16 @55ms', role: 'mix', seconds: 5, script: repeat('wildTransform', 16, 0.055, (i) => ({ index: i, pan: (i % 8) / 4 - 0.9 })) },
    { name: 'seq beamFire ×8 @90ms', role: 'mix', seconds: 5, script: repeat('beamFire', 8, 0.09, (i) => ({ index: i, symbol: i, pan: (i % 4) / 2 - 0.75 })) },
    {
      name: 'seq countTick ×90 + countEnd',
      role: 'mix',
      seconds: 7,
      script: (core, at) => {
        for (let i = 0; i < 90; i++) at(i * 0.03, () => core.sfx('countTick', { index: Math.floor(i / 6) }));
        at(2.75, () => core.sfx('countEnd', { tier: 1 }));
      },
    },
    {
      name: 'bed whirl up/down/off',
      role: 'bed',
      seconds: 5,
      endBy: 3.5,
      script: (core, at) => {
        // Per-frame calls, as the view makes them: ramp up, hold, slow down, stop.
        for (let f = 0; f < 150; f++) {
          const time = f / 60;
          const i = time < 0.4 ? 0.2 + 2 * time : time < 1.6 ? 1 : Math.max(0.15, 1 - (time - 1.6) * 0.9);
          at(time, () => core.whirl(true, i));
        }
        at(2.5, () => core.whirl(false));
      },
    },
    {
      name: 'bed tension hold 2.5s + release',
      role: 'bed',
      seconds: 6,
      endBy: 3.2,
      script: (core, at) => {
        at(0, () => core.tension(true));
        at(2.5, () => core.tension(false));
      },
    },
    {
      name: 'storm 500 cues in 2s',
      role: 'mix',
      seconds: 8,
      script: (core, at) => {
        const names: SfxName[] = ['gemBurst', 'refillLand', 'beamFire', 'wildTransform', 'ringStop', 'tick', 'lineWin', 'stardust', 'scatterLand', 'multiplierUp', 'novaFlash', 'bigWinStart'];
        for (let i = 0; i < 500; i++) {
          const name = names[(i * 7) % names.length];
          at((i * 2) / 500, () => core.sfx(name, { index: i % 9, tier: i % 4, pan: ((i * 13) % 20) / 10 - 1, symbol: i % 10 }));
        }
        // Hostile parameters must be shrugged off, not propagated.
        at(0.5, () => core.sfx('ringStop', { index: Number.NaN, tier: Number.POSITIVE_INFINITY, pan: Number.NaN, gain: Number.NaN }));
        at(0.6, () => core.sfx('lineWin', { index: -5, tier: 99, pan: 7, gain: -3 }));
        at(0.7, () => core.sfx('nope' as SfxName));
        at(0.8, () => core.whirl(true, Number.NaN));
        at(1.2, () => core.whirl(false));
      },
    },
    { name: 'session: spin → chain → nova → big win', role: 'mix', seconds: 34, script: sessionScript },
  ];
}

/** One eventful spin, cue for cue, over the running score. */
function sessionScript(core: AudioCore, at: Schedule): void {
  at(0, () => core.music('base'));
  at(4.0, () => {
    core.sfx('uiTap');
    core.sfx('spinStart');
    core.music('spin');
  });
  for (let f = 0; f < 130; f++) {
    const time = 4.0 + f / 60;
    at(time, () => core.whirl(true, Math.min(1, (time - 4.0) * 3)));
    if (f % 3 === 0) at(time, () => core.sfx('ringNotch', { index: f % 4 }));
  }
  [0, 1].forEach((r) => at(5.2 + r * 0.34, () => core.sfx('ringStop', { index: r, pan: 0 })));
  at(5.9, () => {
    core.tension(true);
    core.music('tension');
    core.sfx('scatterLand', { index: 1 });
  });
  at(7.15, () => core.sfx('ringStop', { index: 2 }));
  at(8.4, () => {
    core.tension(false);
    core.whirl(false);
    core.sfx('ringStop', { index: 3, tier: 1 });
    core.music('base');
  });
  // Wins, then three links of chain reaction.
  for (let link = 0; link < 3; link++) {
    const t0 = 8.9 + link * 2.3;
    for (let b = 0; b < 2; b++) at(t0 + b * 0.12, () => core.sfx('beamFire', { index: b + link, symbol: b + 2, pan: b - 0.5 }));
    at(t0 + 0.3, () => core.sfx('lineWin', { index: link, tier: Math.min(2, link) }));
    for (let g = 0; g < 7; g++) at(t0 + 0.95 + g * 0.03, () => core.sfx('gemBurst', { index: g, symbol: g % 4, pan: g / 3 - 1 }));
    at(t0 + 1.2, () => core.sfx('stardust'));
    for (let g = 0; g < 4; g++) at(t0 + 1.3 + g * 0.05, () => core.sfx('novaCharge', { index: link * 4 + g }));
    for (let g = 0; g < 7; g++) at(t0 + 1.45 + g * 0.05, () => core.sfx('refillLand', { index: g, pan: g / 3 - 1 }));
    at(t0 + 1.9, () => core.sfx('tick'));
    at(t0 + 2.0, () => core.sfx('multiplierUp', { index: link + 1 }));
  }
  at(15.9, () => core.sfx('novaReady'));
  at(16.6, () => {
    core.music('nova');
    core.sfx('novaSwell');
  });
  at(17.5, () => core.sfx('novaFlash'));
  at(17.62, () => core.sfx('novaShockwave'));
  for (let i = 0; i < 16; i++) at(18.0 + i * 0.055, () => core.sfx('wildTransform', { index: i, pan: (i % 8) / 4 - 0.9 }));
  at(19.6, () => core.sfx('nudgeReady'));
  at(20.6, () => core.sfx('nudgeDetent'));
  at(20.75, () => core.sfx('nudgeCommit', { index: 2 }));
  at(21.2, () => {
    core.music('bigwin');
    core.sfx('bigWinStart', { tier: 2 });
  });
  for (let i = 0; i < 150; i++) at(22.0 + i * 0.03, () => core.sfx('countTick', { index: Math.floor(i / 8) }));
  at(26.6, () => core.sfx('countEnd', { tier: 2 }));
  at(27.4, () => core.music('base'));
}

function musicCases(): Case[] {
  const cases: Case[] = MUSIC_STATES.map((state: MusicState) => ({
    name: `music ${state}`,
    role: state === 'nova' ? 'hush' : 'music',
    seconds: 30,
    maxGap: state === 'nova' ? 99 : state === 'splash' ? 1.5 : 0.6,
    script: (core) => core.music(state),
  }));
  cases.push({
    name: 'music all transitions',
    role: 'music',
    seconds: 40,
    maxGap: 1.6,
    script: (core, at) => {
      const order: MusicState[] = ['splash', 'base', 'spin', 'tension', 'base', 'spin', 'free', 'tension', 'free', 'nova', 'bigwin', 'base'];
      order.forEach((state, i) => at(i * 3.3, () => core.music(state)));
    },
  });
  return cases;
}

// ───────────────────────────── Verdicts ─────────────────────────────

export interface Row extends Metrics {
  name: string;
  role: Role;
  seconds: number;
  flags: string[];
  stats: EngineStats;
}

export interface Report {
  rows: Row[];
  /** Median loudness per role, for the cross-role checks. */
  medians: Partial<Record<Role, number>>;
  checks: { name: string; ok: boolean; detail: string }[];
  ok: boolean;
  sampleRate: number;
}

const CEILING_DB = -1;

function judge(c: Case, m: Metrics, r: Render): string[] {
  const flags: string[] = [];
  if (m.nan) flags.push('NaN');
  for (const e of r.errors) flags.push(`THROW(${e})`);
  if (m.peakDb > CEILING_DB) flags.push(`CLIP(${m.peakDb.toFixed(1)})`);
  if (c.role !== 'hush' && m.peakDb < -60) flags.push('SILENT');
  if (m.startStep > 0.02) flags.push(`CLICK-START(${m.startStep.toFixed(3)})`);
  if (m.endStep > 0.02) flags.push(`CLICK-END(${m.endStep.toFixed(3)})`);
  if (m.cut && c.role !== 'music' && c.role !== 'hush') flags.push('TAIL-CUT');
  if (m.dc > 0.002) flags.push(`DC(${m.dc.toFixed(4)})`);
  if (r.stats.late > 0) flags.push(`LATE(${r.stats.late})`);
  if (c.endBy !== undefined && m.dur > c.endBy) flags.push(`HANGS(${m.dur.toFixed(2)}s)`);
  if (c.maxGap !== undefined && m.gap > c.maxGap) flags.push(`GAP(${m.gap.toFixed(2)}s)`);
  const [lo, hi] = ROLE_WINDOW[c.role];
  const loud = c.role === 'music' || c.role === 'hush' ? m.lufs : m.loudDb;
  if (loud < lo) flags.push(`QUIET(${loud.toFixed(1)}<${lo})`);
  if (loud > hi) flags.push(`LOUD(${loud.toFixed(1)}>${hi})`);
  return flags;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : Number.NaN;
};

export function allCases(): Case[] {
  return [...sfxCases(), ...scenarioCases(), ...musicCases()];
}

export interface AuditOptions {
  /** Only cases whose name contains this. */
  only?: string;
  onRow?: (row: Row) => void;
}

export async function runAudit(opts: AuditOptions = {}): Promise<Report> {
  const cases = allCases().filter((c) => !opts.only || c.name.includes(opts.only));
  const rows: Row[] = [];
  for (const c of cases) {
    const r = await renderOffline(c.seconds, c.script);
    const m = analyse(r.buffer);
    const row: Row = { ...m, name: c.name, role: c.role, seconds: c.seconds, flags: judge(c, m, r), stats: r.stats };
    rows.push(row);
    opts.onRow?.(row);
  }

  const medians: Partial<Record<Role, number>> = {};
  for (const role of Object.keys(ROLE_WINDOW) as Role[]) {
    const of = rows.filter((r) => r.role === role);
    if (of.length) medians[role] = median(of.map((r) => (role === 'music' || role === 'hush' ? r.lufs : r.loudDb)));
  }

  // The mix as a whole: who sits above whom.
  const checks: Report['checks'] = [];
  const order = (lower: Role, upper: Role, margin: number) => {
    const a = medians[lower];
    const b = medians[upper];
    if (a === undefined || b === undefined) return;
    checks.push({ name: `${lower} at least ${margin} dB under ${upper}`, ok: b - a >= margin, detail: `${a.toFixed(1)} vs ${b.toFixed(1)} (Δ ${(b - a).toFixed(1)})` });
  };
  order('ui', 'cascade', 3);
  order('ui', 'feature', 12);
  order('micro', 'ui', 3);
  order('cascade', 'feature', 6);
  order('notify', 'feature', 5);
  order('mech', 'feature', 3);
  // Music sits under the effects: compared like for like (integrated music vs loudest 200 ms of an effect).
  const musicRows = rows.filter((r) => r.role === 'music' && !r.name.includes('transitions'));
  const loudestMusic = musicRows.length ? Math.max(...musicRows.map((r) => r.loudDb)) : undefined;
  const base = rows.find((r) => r.name === 'music base');
  if (base && medians.cascade !== undefined) checks.push({ name: 'base music under cascade effects', ok: medians.cascade - base.lufs >= 1.5, detail: `${base.lufs.toFixed(1)} vs ${medians.cascade.toFixed(1)}` });
  if (loudestMusic !== undefined && medians.feature !== undefined) checks.push({ name: 'loudest music moment under feature effects', ok: medians.feature - loudestMusic >= 2, detail: `${loudestMusic.toFixed(1)} vs ${medians.feature.toFixed(1)}` });
  for (const role of ['ui', 'cascade', 'mech', 'notify', 'feature'] as Role[]) {
    const of = rows.filter((r) => r.role === role).map((r) => r.loudDb);
    if (of.length < 2) continue;
    const spread = Math.max(...of) - Math.min(...of);
    checks.push({ name: `${role} effects within 6 dB of each other`, ok: spread <= 6, detail: `spread ${spread.toFixed(1)} dB` });
  }
  const totals = rows.reduce((a, r) => ({ late: a.late + r.stats.late, dropped: a.dropped + r.stats.dropped, stolen: a.stolen + r.stats.stolen }), { late: 0, dropped: 0, stolen: 0 });
  checks.push({ name: 'nothing scheduled in the past', ok: totals.late === 0, detail: `${totals.late} late events` });
  const storm = rows.find((r) => r.name.startsWith('storm'));
  if (storm) checks.push({ name: 'voice cap holds under a storm', ok: storm.stats.peakSfxVoices <= 64 && storm.stats.stolen + storm.stats.dropped > 0, detail: `peak ${storm.stats.peakSfxVoices} voices, ${storm.stats.stolen} stolen, ${storm.stats.dropped} dropped of ${storm.stats.started + storm.stats.dropped}` });

  const ok = rows.every((r) => r.flags.length === 0) && checks.every((c) => c.ok);
  return { rows, medians, checks, ok, sampleRate: AUDIT_RATE };
}

// ───────────────────────────── Pictures ─────────────────────────────

/**
 * Waveform over a log-frequency spectrogram. For the people (and the model)
 * who have to judge a sound without hearing it: sweeps, partials and tails
 * are all visible.
 */
export function drawSpectrogram(canvas: HTMLCanvasElement, buffer: AudioBuffer, title: string): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const W = canvas.width;
  const H = canvas.height;
  const waveH = Math.floor(H * 0.24);
  const specTop = waveH + 4;
  const specH = H - specTop;
  const L = buffer.getChannelData(0);
  const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
  const n = L.length;
  const sr = buffer.sampleRate;
  g.fillStyle = '#03050d';
  g.fillRect(0, 0, W, H);

  // Waveform: left above the centre line, right below.
  g.fillStyle = '#e8c66a';
  const mid = waveH / 2;
  for (let x = 0; x < W; x++) {
    const a = Math.floor((x / W) * n);
    const b = Math.max(a + 1, Math.floor(((x + 1) / W) * n));
    let pl = 0;
    let pr = 0;
    for (let i = a; i < b; i++) {
      pl = Math.max(pl, Math.abs(L[i]));
      pr = Math.max(pr, Math.abs(R[i]));
    }
    g.fillRect(x, mid - pl * mid, 1, pl * mid);
    g.fillStyle = '#6fe7ff';
    g.fillRect(x, mid, 1, pr * mid);
    g.fillStyle = '#e8c66a';
  }

  const N = 2048;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const img = g.createImageData(W, specH);
  const fMin = 40;
  const fMax = 20000;
  const col = new Float64Array(N / 2);
  for (let x = 0; x < W; x++) {
    const centre = Math.floor(((x + 0.5) / W) * n);
    for (let i = 0; i < N; i++) {
      const j = centre - N / 2 + i;
      const s = j >= 0 && j < n ? (L[j] + R[j]) * 0.5 : 0;
      re[i] = s * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < N / 2; k++) col[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / (N / 4);
    for (let y = 0; y < specH; y++) {
      const f = fMin * Math.pow(fMax / fMin, 1 - y / specH);
      const k = Math.min(N / 2 - 1, (f * N) / sr);
      const k0 = Math.floor(k);
      const mag = col[k0] + (col[Math.min(N / 2 - 1, k0 + 1)] - col[k0]) * (k - k0);
      const v = Math.max(0, Math.min(1, (toDb(mag) + 96) / 84));
      const o = (y * W + x) * 4;
      // Night blue → teal → gold → white.
      img.data[o] = Math.floor(255 * Math.max(0, Math.min(1, v * 2.2 - 0.9)));
      img.data[o + 1] = Math.floor(255 * Math.max(0, Math.min(1, v * 1.5 - 0.25)));
      img.data[o + 2] = Math.floor(255 * Math.max(0, Math.min(1, 0.12 + v * 1.1 - Math.max(0, v - 0.55) * 1.2 + Math.max(0, v - 0.85) * 4)));
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, specTop);

  g.font = '11px ui-monospace, monospace';
  g.fillStyle = 'rgba(244,236,216,0.85)';
  g.fillText(`${title}   ${(n / sr).toFixed(2)} s`, 6, 12);
  for (const f of [100, 200, 500, 1000, 2000, 5000, 10000]) {
    const y = specTop + specH * (1 - Math.log(f / fMin) / Math.log(fMax / fMin));
    g.fillStyle = 'rgba(244,236,216,0.25)';
    g.fillRect(0, y, W, 1);
    g.fillStyle = 'rgba(244,236,216,0.8)';
    g.fillText(f >= 1000 ? `${f / 1000}k` : String(f), 4, y - 2);
  }
  const secs = n / sr;
  for (let s = 1; s < secs; s++) {
    g.fillStyle = 'rgba(244,236,216,0.25)';
    g.fillRect((s / secs) * W, specTop, 1, specH);
  }
}
