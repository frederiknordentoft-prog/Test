// Audio harness: buttons for every SFX + music transport, a post-limiter spectrum/peak meter, and an
// automated QA suite (#check) that renders every asset and several full-mix scenarios offline.
import { GameAudio, audio, type Sfx, type PlayOpts, type SchedLog } from '../src/audio/audio.ts';
import { renderAsset, allAssetIds, isStem, stemDef, stemLoopFrames, assetRate, isStormAsset, RENDER_STATS } from '../src/audio/assets.ts';
import { barFrames, grid, BASE_BPM, STORM_BPM } from '../src/audio/music.ts';

const $ = (id: string) => document.getElementById(id)!;
const out = $('out');
const log = (s: string) => { out.textContent += s + '\n'; };

// ------------------------------------------------------------------ interactive UI
function btn(parent: HTMLElement, label: string, fn: () => void, cls = ''): void {
  const b = document.createElement('button');
  b.textContent = label;
  if (cls) b.className = cls;
  b.onclick = fn;
  parent.appendChild(b);
}
function section(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  const r = document.createElement('div');
  r.className = 'row';
  $('ui').append(h, r);
  return r;
}

const A = audio;
const P = (name: Sfx, o: PlayOpts = {}) => () => A.play(name, o);

function buildUI(): void {
  let r = section('Music');
  btn(r, 'startBase', () => A.startBase());
  for (let n = 1; n <= 5; n++) btn(r, `layers ${n}`, () => A.setBaseLayers(n));
  btn(r, 'time-lapse 1→5 (2.4 s)', () => {
    for (let k = 0; k <= 24; k++) setTimeout(() => A.setBaseLayers(1 + Math.floor((k / 24) * 4.999)), k * 100);
  });
  btn(r, 'duck −40 / 0.06', () => A.duck(-40, 0.06));
  btn(r, 'duck 0', () => A.duck(0, 0.3));
  r = section('Storm');
  btn(r, 'prepareStorm()', () => { const t = performance.now(); void A.prepareStorm().then(() => log(`storm core ready in ${Math.round(performance.now() - t)} ms`)); }, 'storm');
  btn(r, 'releaseStorm()', () => A.releaseStorm(), 'storm');
  btn(r, 'startStorm(now+1)', () => A.startStorm(A.now() + 1), 'storm');
  for (const x of [2, 8, 32, 128]) btn(r, `stormLevel ×${x}`, () => A.stormLevel(x), 'storm');
  btn(r, 'stopStorm → fade → startBase(3 s)', () => { A.stopStorm(); A.play('fade'); setTimeout(() => A.startBase(), 3000); }, 'storm');
  btn(r, '▶ Solstorm cinematic (7.2 s)', () => cinematic(A), 'storm');
  btn(r, '▶ Stormbølge', () => A.play('waveBoom'), 'storm');
  r = section('Spin sequences');
  btn(r, '▶ spin: LDW return', () => spinSeq(A, false));
  btn(r, '▶ spin: WIN cascade', () => spinSeq(A, true));
  btn(r, '▶ storm spin (8 cols)', () => { for (let c = 0; c < 8; c++) A.play('land', { col: c, gain: 0.9, when: A.now() + 0.6 + c * 0.25 }); });
  r = section('land (col)');
  for (let c = 0; c < 8; c++) btn(r, `col ${c}`, P('land', { col: c, gain: 0.8 }));
  r = section('chime (step) · markUp (level) · sun · win');
  for (let s = 0; s < 8; s++) btn(r, `chime ${s}`, P('chime', { step: s }));
  for (let l = 1; l <= 7; l++) btn(r, `markUp ${l}`, P('markUp', { level: l }));
  for (let l = 1; l <= 3; l++) btn(r, `sun ${l}`, P('sun', { level: l }));
  for (let l = 1; l <= 2; l++) btn(r, `win ${l}`, () => { A.play('win', { level: l }); setTimeout(() => A.play('countTick'), 300); });
  for (let l = 3; l <= 5; l++) btn(r, `bigWin ${l}`, () => { A.play('bigWin', { level: l }); setTimeout(() => A.play('countTick'), 300); });
  btn(r, 'stopCount()', () => A.stopCount());
  for (let l = 1; l <= 8; l++) btn(r, `levelUp ${l}`, P('levelUp', { level: l }));
  r = section('Other SFX');
  for (const n of ['tap', 'stakeUp', 'stakeDown', 'spin', 'shatter', 'returnTick', 'nettoCross', 'mote', 'anticipation', 'countTick',
    'stormSwell', 'stormRiser', 'impact', 'glassXL', 'drop808', 'letterSlam', 'waveBoom', 'reform', 'summary', 'fade'] as Sfx[]) btn(r, n, P(n));
  r = section('Settings');
  btn(r, 'mute', () => A.setMuted(true));
  btn(r, 'unmute', () => A.setMuted(false));
  btn(r, 'vol 0.7/0.85', () => A.setVolumes(0.7, 0.85));
  btn(r, 'music 0', () => A.setVolumes(0, 0.85));
  btn(r, 'suspend', () => A.suspend());
  btn(r, 'resume', () => A.resume());
}

/** Exactly the SFX schedule of src/present/cinematics/solstorm.ts (full variant). */
function cinematic(g: GameAudio): void {
  const t0 = g.now() + 0.06;
  const at = (n: Sfx, t: number, o: PlayOpts = {}) => g.play(n, { ...o, when: t0 + t });
  at('stormSwell', 0);
  g.startStorm(t0 + 5.6);
  setTimeout(() => g.duck(-40, 0.06), 16);
  at('stormRiser', 1.2);
  at('impact', 2.2); at('drop808', 2.2); at('glassXL', 2.24);
  at('reform', 3.4);
  for (let i = 0; i < 8; i++) at('letterSlam', 3.75 + i * 0.07, { gain: 0.8 });
  for (let c = 0; c < 8; c++) at('land', 4.6 + c * 0.04 + 7 * 0.025, { col: c, gain: 0.5 });
  at('markUp', 5.35, { level: 1 });
}

function spinSeq(g: GameAudio, win: boolean): void {
  const t = g.now() + 0.05;
  g.play('spin', { when: t });
  for (let c = 0; c < 6; c++) g.play('land', { col: c, gain: 0.8, when: t + 0.6 + c * 0.25 });
  if (!win) { g.play('returnTick', { when: t + 2.35 }); return; }
  for (let k = 0; k < 3; k++) {
    const s = t + 2.35 + k * 1.18;
    g.play('chime', { step: k, when: s });
    g.play('shatter', { step: k, when: s + 0.42 });
    g.play('markUp', { level: k + 1, when: s + 0.6 });
    if (k === 1) g.play('nettoCross', { when: s + 0.52 });
    g.play('land', { col: (k * 2) % 6, gain: 0.35, when: s + 0.79 });
  }
  setTimeout(() => { g.play('win', { level: 2 }); setTimeout(() => g.play('countTick'), 300); }, 6.0 * 1000);
}

function scope(): void {
  const cv = $('scope') as HTMLCanvasElement;
  const x = cv.getContext('2d')!;
  let peakHold = 0;
  const f = () => {
    requestAnimationFrame(f);
    const an = A.analyser();
    const s = A.stats();
    const pos = A.position();
    $('status').textContent = `state ${s.state} · sr ${s.sampleRate}${s.lite ? " (lite)" : ""} · assets ${s.rendered}/${s.total} (${s.mb.toFixed(1)} MB, storm ${s.stormMb.toFixed(1)} MB, failed ${s.failed})\n` +
      `now ${A.now().toFixed(3)} · latency ${(A.latency() * 1000).toFixed(1)} ms · voices ${s.voices} · base ${s.base} L${s.layers} · storm ${s.storm} ×${s.stormX}` +
      (pos ? ` · ${pos.kind} bar ${pos.bar} beat ${pos.beat + 1}` : '');
    x.fillStyle = '#030814'; x.fillRect(0, 0, cv.width, cv.height);
    if (!an) return;
    const bins = new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(bins);
    const td = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(td);
    let pk = 0;
    for (const v of td) pk = Math.max(pk, Math.abs(v));
    peakHold = Math.max(pk, peakHold * 0.97);
    const W = cv.width - 40, H = cv.height;
    for (let i = 0; i < W; i++) {
      const f0 = 20 * Math.pow(1000, i / W); // 20 Hz .. 20 kHz log
      const bin = Math.min(bins.length - 1, Math.round((f0 / (an.context.sampleRate / 2)) * bins.length));
      const v = bins[bin] / 255;
      x.fillStyle = `hsl(${160 + v * 60},80%,${30 + v * 40}%)`;
      x.fillRect(i, H - v * H, 1, v * H);
    }
    const db = 20 * Math.log10(Math.max(1e-6, peakHold));
    const hgt = Math.max(0, (db + 60) / 60) * H;
    x.fillStyle = peakHold > 0.95 ? '#ff2a4d' : '#3dffb0';
    x.fillRect(cv.width - 30, H - hgt, 20, hgt);
  };
  f();
}

$('unlock').onclick = async () => { await A.unlock(); A.startBase(); A.setBaseLayers(1); };
$('runCheck').onclick = () => { void runCheck(); };
buildUI();
scope();

// ------------------------------------------------------------------ QA suite
interface Row { [k: string]: string | number | boolean }
const SR = 48000;
const dB = (v: number) => (v > 0 ? 20 * Math.log10(v) : -200);

function fftMag(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

const BANDS: [string, number, number][] = [['sub', 0, 40], ['bass', 40, 160], ['lowmid', 160, 600], ['mid', 600, 2500], ['pres', 2500, 6000], ['air', 6000, 24000]];
/** Welch power spectrum → % energy per band + spectral centroid (Hz). */
function spectrum(ch: Float32Array[], sr: number): { bands: number[]; centroid: number } {
  const N = 4096, hop = 2048;
  const pow = new Float64Array(N / 2);
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const len = ch[0].length;
  const re = new Float64Array(N), im = new Float64Array(N);
  let frames = 0;
  for (let s = 0; s + N <= Math.max(len, N); s += hop) {
    for (const d of ch) {
      re.fill(0); im.fill(0);
      for (let i = 0; i < N; i++) re[i] = (d[s + i] ?? 0) * win[i];
      fftMag(re, im);
      for (let k = 0; k < N / 2; k++) pow[k] += re[k] * re[k] + im[k] * im[k];
    }
    frames++;
    if (frames > 400) break;
  }
  const bands = BANDS.map(() => 0);
  let tot = 0, cen = 0;
  for (let k = 1; k < N / 2; k++) {
    const f = (k * sr) / N;
    tot += pow[k]; cen += pow[k] * f;
    for (let b = 0; b < BANDS.length; b++) if (f >= BANDS[b][1] && f < BANDS[b][2]) bands[b] += pow[k];
  }
  return { bands: bands.map((v) => (tot > 0 ? (100 * v) / tot : 0)), centroid: tot > 0 ? cen / tot : 0 };
}

/** Welch power spectrum (bins of sr/N). */
function welch(ch: Float32Array[], sr: number, N = 4096): { pow: Float64Array; df: number } {
  const hop = N / 2, pow = new Float64Array(N / 2), win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const re = new Float64Array(N), im = new Float64Array(N);
  const len = ch[0].length;
  for (let s = 0; s + N <= Math.max(len, N); s += hop) {
    for (const d of ch) {
      re.fill(0); im.fill(0);
      for (let i = 0; i < N; i++) re[i] = (d[s + i] ?? 0) * win[i];
      fftMag(re, im);
      for (let k = 0; k < N / 2; k++) pow[k] += re[k] * re[k] + im[k] * im[k];
    }
  }
  return { pow, df: sr / N };
}
/** % of energy above `hz`. */
function bandShare(ch: Float32Array[], sr: number, hz: number): number {
  const { pow, df } = welch(ch, sr);
  let tot = 0, hi = 0;
  for (let k = 1; k < pow.length; k++) { tot += pow[k]; if (k * df >= hz) hi += pow[k]; }
  return tot > 0 ? (100 * hi) / tot : 0;
}
/**
 * ⅓-octave spectral error (spectra normalised below fmax), level-aware: bands within 15 dB of the loudest
 * band may differ by ≤ 1.5 dB, 15–25 dB below by ≤ 3 dB, 25–35 dB below by ≤ 6 dB (quieter bands are
 * masked and contribute little). Returns the band with the largest excess over its allowance.
 */
function thirdOctErr(a: Float32Array[], asr: number, b: Float32Array[], bsr: number, fmax: number): { worst: number; at: number; below: number; allowed: number; excess: number } {
  // radix-2 FFT: same N for both; bands integrate energy by Hz, spectra are normalised, so the
  // different bin widths do not matter
  const A = welch(a, asr, 4096), B = welch(b, bsr, 4096);
  const bands: number[] = [];
  for (let f = 63; f * 1.12 <= fmax; f *= Math.pow(2, 1 / 3)) bands.push(f);
  const lvl = (P: { pow: Float64Array; df: number }) => {
    const e = bands.map((fc) => { let s = 0; for (let k = 1; k < P.pow.length; k++) { const f = k * P.df; if (f >= fc / 1.122 && f < fc * 1.122) s += P.pow[k]; } return s; });
    const tot = e.reduce((x, y) => x + y, 0) || 1;
    return e.map((x) => 10 * Math.log10(x / tot + 1e-15));
  };
  const la = lvl(A), lb = lvl(B);
  const top = Math.max(...la);
  let worst = 0, at = 0, below = 0, allowed = 0, excess = -Infinity;
  la.forEach((v, i) => {
    const bl = top - v;
    if (bl > 35) return;
    const al = bl <= 15 ? 1.5 : bl <= 25 ? 3 : 6;
    const d = Math.abs(v - lb[i]);
    if (d - al > excess) { excess = d - al; worst = d; at = bands[i]; below = bl; allowed = al; }
  });
  return { worst, at, below, allowed, excess };
}
function diffRms(a: AudioBuffer, b: AudioBuffer, t0: number, t1: number): number {
  let e = 0, n = 0;
  const i0 = Math.floor(t0 * a.sampleRate), i1 = Math.min(a.length, Math.floor(t1 * a.sampleRate));
  for (let c = 0; c < a.numberOfChannels; c++) {
    const x = a.getChannelData(c), y = b.getChannelData(c);
    for (let i = i0; i < i1; i++) { const d = x[i] - y[i]; e += d * d; n++; }
  }
  return Math.sqrt(e / Math.max(1, n));
}

function stats(b: AudioBuffer): { peak: number; rms: number; nan: number; dc: number } {
  let peak = 0, e = 0, nan = 0, sum = 0, n = 0;
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (!Number.isFinite(v)) { nan++; continue; }
      const a = Math.abs(v);
      if (a > peak) peak = a;
      e += v * v; sum += v; n++;
    }
  }
  return { peak, rms: Math.sqrt(e / Math.max(1, n)), nan, dc: sum / Math.max(1, n) };
}

/** Loop seam: jump across the wrap vs. the 99.9th percentile of in-buffer sample deltas. */
function seam(b: AudioBuffer): { jump: number; p999: number; ratio: number } {
  let jump = 0;
  const deltas: number[] = [];
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c);
    jump = Math.max(jump, Math.abs(d[0] - d[d.length - 1]));
    for (let i = 1; i < d.length; i += 7) deltas.push(Math.abs(d[i] - d[i - 1]));
  }
  deltas.sort((a, c) => a - c);
  const p999 = deltas[Math.floor(deltas.length * 0.999)] || 1e-9;
  return { jump, p999, ratio: jump / p999 };
}

/** Tile a loop to `frames` (simulated looping). */
function tile(b: AudioBuffer, frames: number): AudioBuffer {
  const o = new AudioBuffer({ numberOfChannels: b.numberOfChannels, length: frames, sampleRate: b.sampleRate });
  for (let c = 0; c < b.numberOfChannels; c++) {
    const s = b.getChannelData(c), d = o.getChannelData(c);
    for (let i = 0; i < frames; i++) d[i] = s[i % s.length];
  }
  return o;
}

type At = (t: number, fn: () => void) => void;
async function scenario(seconds: number, shared: GameAudio | null, setup: (g: GameAudio, at: At) => void, opts: { bypassMaster?: boolean; log?: boolean } = {}): Promise<{ buf: AudioBuffer; g: GameAudio; ms: number }> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR);
  const g = new GameAudio();
  if (shared) g.adoptAssets(shared);
  await g.attachOffline(ctx, opts);
  if (opts.log) g.schedLog = [];
  const Q = 128 / SR;
  const acts = new Map<number, (() => void)[]>();
  const at: At = (t, fn) => {
    const k = Math.round(t / Q);
    const a = acts.get(k);
    if (a) a.push(fn); else acts.set(k, [fn]);
  };
  setup(g, at);
  for (let t = 0; t < seconds - 0.03; t += 0.025) at(t, () => g.tick());
  for (const [k, fns] of acts) {
    if (k === 0) { fns.forEach((f) => f()); continue; }
    const t = k * Q;
    if (t >= seconds) continue;
    void ctx.suspend(t).then(() => { fns.forEach((f) => f()); void ctx.resume(); });
  }
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  return { buf, g, ms: performance.now() - t0 };
}

function firstAbove(b: AudioBuffer, thr: number, from = 0): number {
  for (let i = from; i < b.length; i++) {
    for (let c = 0; c < b.numberOfChannels; c++) if (Math.abs(b.getChannelData(c)[i]) > thr) return i;
  }
  return -1;
}
function firstDiff(a: AudioBuffer, b: AudioBuffer, thr: number): number {
  for (let i = 0; i < a.length; i++) {
    for (let c = 0; c < a.numberOfChannels; c++) if (Math.abs(a.getChannelData(c)[i] - b.getChannelData(c)[i]) > thr) return i;
  }
  return -1;
}
function windowRms(b: AudioBuffer, t0: number, t1: number): number {
  let e = 0, n = 0;
  const i0 = Math.max(0, Math.floor(t0 * b.sampleRate)), i1 = Math.min(b.length, Math.floor(t1 * b.sampleRate));
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c);
    for (let i = i0; i < i1; i++) { e += d[i] * d[i]; n++; }
  }
  return Math.sqrt(e / Math.max(1, n));
}
function overCount(b: AudioBuffer, thr: number): number {
  let n = 0;
  for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > thr) n++; }
  return n;
}

async function runCheck(): Promise<void> {
  const res: { assets: Row[]; stems: Row[]; audit: Row[]; scen: Row[]; checks: Row[]; fail: string[]; done: boolean } = { assets: [], stems: [], audit: [], scen: [], checks: [], fail: [], done: false };
  (window as unknown as { __audioCheck: typeof res }).__audioCheck = res;
  const fail = (m: string) => { res.fail.push(m); log('FAIL ' + m); };
  const check = (name: string, ok: boolean, detail: string) => { res.checks.push({ name, ok, detail }); if (!ok) fail(`${name}: ${detail}`); };
  try {
    // ---------------- 1. every asset, rendered in isolation
    const shared = new GameAudio();
    const ids = allAssetIds();
    let totalBytes = 0, totalMs = 0;
    for (const id of ids) {
      const t0 = performance.now();
      const b = await renderAsset(id, SR);
      const ms = performance.now() - t0;
      totalMs += ms;
      totalBytes += b.length * b.numberOfChannels * 4;
      (shared as unknown as { assets: Map<string, AudioBuffer> }).assets.set(id, b);
      if (isStem(id)) {
        const def = stemDef(id)!;
        const div = assetRate(id, SR).div, bsr = b.sampleRate;
        const bf = barFrames(def.group === 'base' ? BASE_BPM : STORM_BPM, bsr, div);
        const t8 = tile(b, bf * 8);
        const s = stats(t8);
        const sm = seam(b);
        const sp = spectrum([t8.getChannelData(0)], bsr);
        const secPerBar = bf / bsr, ref = barFrames(def.group === 'base' ? BASE_BPM : STORM_BPM, SR) / SR;
        const exact = b.length === stemLoopFrames(def, bsr, div) && b.length % bf === 0 && Math.abs(secPerBar - ref) < 1e-12;
        const phoneDb = dB(s.rms) + 10 * Math.log10(Math.max(1e-9, (sp.bands[2] + sp.bands[3] + sp.bands[4] + sp.bands[5]) / 100));
        const row: Row = { id, phoneRmsDb: +phoneDb.toFixed(1), bars: def.bars, ch: b.numberOfChannels, rate: bsr, sec: +(b.length / bsr).toFixed(3), exactBars: exact, rmsDb: +dB(s.rms).toFixed(1), peakDb: +dB(s.peak).toFixed(1), nan: s.nan, seamJump: +sm.jump.toFixed(5), seamRatio: +sm.ratio.toFixed(2), centroid: Math.round(sp.centroid), ...Object.fromEntries(BANDS.map((bd, i) => [bd[0], +sp.bands[i].toFixed(1)])), ms: Math.round(ms), buildMs: Math.round(RENDER_STATS.get(id)!.build), postMs: Math.round(RENDER_STATS.get(id)!.post) };
        res.stems.push(row);
        if (!(s.rms > 0.003)) fail(`${id} silent (rms ${dB(s.rms).toFixed(1)} dB)`);
        if (s.peak > 0.99) fail(`${id} peak ${s.peak}`);
        if (s.nan) fail(`${id} NaN ${s.nan}`);
        if (!exact) fail(`${id} length ${b.length} not a whole number of bars (${bf})`);
        if (sm.ratio > 3 && sm.jump > 0.002) fail(`${id} loop seam jump ${sm.jump.toFixed(4)} (${sm.ratio.toFixed(1)}× p99.9)`);
        if (sp.bands[2] + sp.bands[3] + sp.bands[4] + sp.bands[5] < 10) fail(`${id} not phone-audible (${(sp.bands[2] + sp.bands[3] + sp.bands[4] + sp.bands[5]).toFixed(1)} % above 160 Hz)`);
      } else {
        const s = stats(b);
        const sec = b.length / b.sampleRate;
        const sp = spectrum(Array.from({ length: b.numberOfChannels }, (_, c) => b.getChannelData(c)), b.sampleRate);
        const head = Math.abs(b.getChannelData(0)[0]);
        let tailMax = 0;
        for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = Math.max(0, d.length - Math.floor(0.005 * b.sampleRate)); i < d.length; i++) tailMax = Math.max(tailMax, Math.abs(d[i])); }
        const row: Row = { id, ch: b.numberOfChannels, rate: b.sampleRate, sec: +sec.toFixed(3), rmsDb: +dB(s.rms).toFixed(1), peakDb: +dB(s.peak).toFixed(1), nan: s.nan, head: +head.toFixed(4), tail: +tailMax.toFixed(4), centroid: Math.round(sp.centroid), ...Object.fromEntries(BANDS.map((bd, i) => [bd[0], +sp.bands[i].toFixed(1)])), ms: Math.round(ms), buildMs: Math.round(RENDER_STATS.get(id)!.build), postMs: Math.round(RENDER_STATS.get(id)!.post) };
        res.assets.push(row);
        if (!(s.rms > 0.0015)) fail(`${id} silent (rms ${dB(s.rms).toFixed(1)} dB)`);
        if (s.peak > 0.99) fail(`${id} peak ${s.peak}`);
        if (s.nan) fail(`${id} NaN`);
        if (!(sec > 0.03 && sec < 8)) fail(`${id} duration ${sec}`);
        if (head > 0.05) fail(`${id} starts with a click (${head})`);
        if (tailMax > 0.01) fail(`${id} ends abruptly (${tailMax})`);
        if (Math.abs(s.dc) > 0.002) fail(`${id} DC ${s.dc}`);
        // spectral sanity: per-spin sounds must not be harsh or rumbly; big hits must reach phone speakers
        const above160 = sp.bands[2] + sp.bands[3] + sp.bands[4] + sp.bands[5];
        if (/^(land|chime|tap|spin|returnTick|mote|markUp|nettoCross|countTick|stake|shatter)/.test(id) && (sp.bands[0] > 1 || (sp.bands[5] > 12 && !id.startsWith('shatter')) || sp.bands[5] > 45))
          fail(`${id} spectral balance (sub ${sp.bands[0].toFixed(1)} %, air ${sp.bands[5].toFixed(1)} %)`);
        if (/^(impact|waveBoom|stormSwell|glassXL|stormRiser|letterSlam|reform|win|bigWin|stormWin|sun|levelUp)/.test(id) && above160 < 10)
          fail(`${id} not phone-audible: only ${above160.toFixed(1)} % energy above 160 Hz`);
      }
      log(`rendered ${id} (${ms.toFixed(0)} ms)`);
    }
    check('asset memory (all)', totalBytes < 64 * 1048576, `${(totalBytes / 1048576).toFixed(1)} MB @${SR} Hz (${ids.length} assets, ${totalMs.toFixed(0)} ms total offline render)`);
    // memory split: base (eager) vs storm (prepareStorm), normal vs lite (≤ 2 GB / iOS) rate policy
    const mem = { base: 0, storm: 0, baseLite: 0, stormLite: 0 };
    for (const id of ids) {
      const b = shared.asset(id)!;
      const bytes = b.length * b.numberOfChannels * 4;
      const lite = bytes * assetRate(id, SR, true).sr / assetRate(id, SR).sr;
      if (isStormAsset(id)) { mem.storm += bytes; mem.stormLite += lite; } else { mem.base += bytes; mem.baseLite += lite; }
    }
    const MB = (x: number) => (x / 1048576).toFixed(1);
    check('memory: base only (eager)', mem.base < 32 * 1048576, `${MB(mem.base)} MB normal · ${MB(mem.baseLite)} MB lite/iOS @${SR} Hz`);
    res.checks.push({ name: 'memory: with storm prepared', ok: true, detail: `${MB(mem.base + mem.storm)} MB normal (storm +${MB(mem.storm)}) · ${MB(mem.baseLite + mem.stormLite)} MB lite/iOS (storm +${MB(mem.stormLite)})` });

    // ---------------- 1b. reduced-rate audit: every asset rendered below hw rate (normal or lite) vs its
    // full-rate render: energy lost above the reduced Nyquist + worst ⅓-octave error below it.
    for (const id of ids) {
      const divs = [...new Set([assetRate(id, SR).div, assetRate(id, SR, true).div])].filter((d) => d > 1);
      if (!divs.length) continue;
      const full = await renderAsset(id, SR, { div: 1 });
      const fch = Array.from({ length: full.numberOfChannels }, (_, c) => full.getChannelData(c));
      for (const d of divs) {
        const red = await renderAsset(id, SR, { div: d });
        const rsr = SR / d;
        const lost = bandShare(fch, SR, rsr * 0.45);
        const err = thirdOctErr(fch, SR, Array.from({ length: red.numberOfChannels }, (_, c) => red.getChannelData(c)), rsr, rsr * 0.4);
        const mode = d === assetRate(id, SR).div ? 'normal' : 'lite';
        res.audit.push({ id, mode, rate: Math.round(rsr), lostAbovePct: +lost.toFixed(3), maxBandErrDb: +err.worst.toFixed(2), atHz: Math.round(err.at), bandBelowTopDb: +err.below.toFixed(1), allowedDb: err.allowed, excessDb: +err.excess.toFixed(2) });
        if (lost > 0.5 || err.excess > 0) fail(`${id} @${Math.round(rsr)} Hz (${mode}) not transparent: ${lost.toFixed(2)} % lost; ${err.worst.toFixed(2)} dB at ${Math.round(err.at)} Hz (${err.below.toFixed(0)} dB below peak band, allowed ${err.allowed})`);
      }
    }

    // ---------------- 2. storm downbeat accuracy + bar-aligned stormLevel (master bypassed = pure timing)
    const at1 = 1.25; // exact frame 60000
    const ref = await scenario(4.2, shared, (g, at) => { at(0, () => g.startStorm(at1)); }, { bypassMaster: true });
    const first = firstAbove(ref.buf, 1e-7);
    const expect = Math.round(at1 * SR);
    check('startStorm exact downbeat', Math.abs(first - expect) <= 1, `first sample ${first}, expected ${expect} (Δ ${first - expect} frames)`);
    const lvl = await scenario(4.2, shared, (g, at) => { at(0, () => g.startStorm(at1)); at(1.9, () => g.stormLevel(8)); }, { bypassMaster: true });
    const sbar = barFrames(STORM_BPM, SR) / SR;
    const nb = at1 + Math.ceil((1.9 - at1) / sbar) * sbar; // next storm bar after the call
    const d = firstDiff(ref.buf, lvl.buf, 1e-6) / SR;
    check('stormLevel lands on bar line', d >= nb - 0.031 && d <= nb + 0.01, `stabs enter at ${d.toFixed(4)} s, bar line ${nb.toFixed(4)} s`);
    // fractional start time
    const at2 = 0.73331;
    const fr = await scenario(1.5, shared, (g, at) => { at(0, () => g.startStorm(at2)); }, { bypassMaster: true });
    const f2 = firstAbove(fr.buf, 1e-7);
    check('startStorm fractional time', Math.abs(f2 - at2 * SR) <= 1.01, `first sample ${f2}, expected ${(at2 * SR).toFixed(2)}`);

    // downbeat moved before it happens (e.g. cinematic skip): cancelScheduled + startStorm(new time)
    const mv = await scenario(3, shared, (g, at) => {
      at(0, () => { g.startStorm(2.5); g.play('impact', { when: 1.0 }); });
      at(0.5, () => { g.cancelScheduled(); g.startStorm(1.5); });
    }, { bypassMaster: true });
    const fm = firstAbove(mv.buf, 1e-7);
    check('startStorm reschedules a pending downbeat', Math.abs(fm - 1.5 * SR) <= 1, `first sample ${fm} (expected ${1.5 * SR}; cancelled impact at ${SR} must be silent)`);
    // storm stinger routing
    const sw2 = await scenario(2, shared, (g, at) => {
      g.playLog = [];
      at(0, () => { g.startStorm(0.5); });
      at(0.2, () => g.play('bigWin', { level: 4 }));
      at(1.0, () => { g.stopStorm(); g.play('bigWin', { level: 4 }); g.play('win', { level: 1 }); g.play('win', { level: 1 }); });
    });
    check('storm uses B♭ stinger, base uses F stingers', sw2.g.playLog!.join(',') === 'stormWin,bigWin4,win1a', `played ${sw2.g.playLog!.join(',')} (2nd win1 rate-limited)`);

    // skipped celebration: stopCount() / play('countTick', {level: 0}) cut the tick roll at once
    const roll = (stop: 0 | 1 | 2) => scenario(2.8, shared, (g, at) => {
      at(0.05, () => g.play('bigWin', { level: 4 }));
      at(0.35, () => g.play('countTick'));
      if (stop === 1) at(0.8, () => g.stopCount());
      if (stop === 2) at(0.8, () => g.play('countTick', { level: 0 }));
    }, { bypassMaster: true });
    const base = await scenario(2.8, shared, (g, at) => { at(0.05, () => g.play('bigWin', { level: 4 })); }, { bypassMaster: true });
    const [rA, rB, rC] = [await roll(0), await roll(1), await roll(2)];
    // count tick onsets after the skip in (render − stinger-only): a jump of > 6 dB between 20 ms windows
    const onsets = (x: AudioBuffer) => {
      let n = 0, prev = -200;
      // from 150 ms after the skip (early reflections of the last tick)
      for (let t = 0.95; t < 2.6; t += 0.02) { const v = dB(diffRms(x, base.buf, t, t + 0.02)); if (v > prev + 6 && v > -75) n++; prev = v; }
      return n;
    };
    const [oA, oB, oC] = [onsets(rA.buf), onsets(rB.buf), onsets(rC.buf)];
    check('stopCount cuts the tick roll', oA >= 5 && oB === 0 && oC === 0, `tick onsets after the skip: roll ${oA} → stopCount ${oB} · countTick level 0 ${oC}`);

    // ---------------- 3. base layers: bar-aligned entry, rapid sweep collapses (no stacking)
    const b1 = await scenario(9, shared, (g, at) => { at(0, () => { g.setBaseLayers(1); g.startBase(); }); }, { bypassMaster: true });
    const b2 = await scenario(9, shared, (g, at) => { at(0, () => { g.setBaseLayers(1); g.startBase(); }); at(1.0, () => g.setBaseLayers(3)); }, { bypassMaster: true });
    const bbar = barFrames(BASE_BPM, SR) / SR;
    const S = Math.round(0.08 * SR) / SR; // startBase starts 80 ms after call (at t=0)
    const bd = firstDiff(b1.buf, b2.buf, 1e-6) / SR;
    const nbb = 0.08 + bbar; // next bar after t=1.0
    check('setBaseLayers lands on bar line', bd >= nbb - 0.031 && bd <= nbb + 0.01, `layers enter at ${bd.toFixed(4)} s, bar line ${nbb.toFixed(4)} s`);
    void S;
    const sw = await scenario(12, shared, (g, at) => {
      at(0, () => { g.setBaseLayers(1); g.startBase(); });
      // demo time-lapse: 1→5 in 2.4 s with 40 calls incl. jitter back-and-forth, then back to 2 briefly
      for (let k = 0; k < 40; k++) at(0.5 + (k / 40) * 2.4, () => g.setBaseLayers(1 + Math.floor((k / 39) * 4.0) - (k % 7 === 3 ? 1 : 0)));
      at(2.9, () => g.setBaseLayers(5));
    }, { log: true });
    const L = sw.g.schedLog as SchedLog[];
    const perBoundary = new Map<string, number>();
    let misaligned = 0;
    for (const e of L) {
      if (e.at < 0) continue;
      const k = `${e.layer}@${e.at.toFixed(6)}`;
      perBoundary.set(k, (perBoundary.get(k) ?? 0) + 1);
      const ph = (e.at - 0.08) / bbar;
      if (Math.abs(ph - Math.round(ph)) > 1e-6) misaligned++;
    }
    const maxStack = Math.max(0, ...perBoundary.values());
    const revokes = L.filter((e) => e.at < 0).length;
    check('rapid sweep: ≤1 change per layer per bar', maxStack <= 1, `max ${maxStack} events at one boundary; ${L.length} log entries, ${revokes} revokes`);
    check('rapid sweep: all changes on bar lines', misaligned === 0, `${misaligned} misaligned`);
    const swS = stats(sw.buf);
    check('rapid sweep: clean output', swS.nan === 0 && swS.peak <= 0.99, `peak ${dB(swS.peak).toFixed(1)} dBFS`);
    res.scen.push({ id: 'base sweep 1→5', sec: 12, rmsDb: +dB(swS.rms).toFixed(1), peakDb: +dB(swS.peak).toFixed(1), over088: overCount(sw.buf, 0.88), renderMs: Math.round(sw.ms) });

    // ---------------- 4. LDW: returnTick is dry (no reverb tail), chime is wet
    const ldw = await scenario(3, shared, (g, at) => { at(0.5, () => g.play('returnTick')); at(1.8, () => g.play('chime', { step: 2 })); });
    const tickTail = windowRms(ldw.buf, 0.5 + 0.15, 0.5 + 1.0);
    const tickBody = windowRms(ldw.buf, 0.5, 0.52);
    const chimeTail = windowRms(ldw.buf, 1.8 + 0.9, 1.8 + 1.15);
    check('returnTick dry (LDW)', dB(tickTail) < -90, `tail ${dB(tickTail).toFixed(1)} dBFS after 150 ms (body ${dB(tickBody).toFixed(1)} dBFS)`);
    check('chime has hall tail', dB(chimeTail) > -70, `tail ${dB(chimeTail).toFixed(1)} dBFS at +0.9 s`);
    const rtPeak = stats(ldw.buf).peak;
    void rtPeak;

    // ---------------- 5. full mixes through the real master chain
    const spinMix = await scenario(16, shared, (g, at) => {
      at(0, () => { g.setBaseLayers(5); g.startBase(); });
      const T = 3;
      at(T, () => g.play('spin'));
      for (let c = 0; c < 6; c++) at(T + 0.6 + c * 0.25, () => g.play('land', { col: c, gain: 0.8 }));
      at(T + 0.6, () => g.play('sun', { level: 1 })); at(T + 1.1, () => g.play('sun', { level: 2 })); at(T + 1.85, () => g.play('sun', { level: 3 }));
      for (let k = 0; k < 4; k++) {
        const s = T + 2.35 + k * 1.18;
        at(s, () => g.play('chime', { step: k }));
        at(s + 0.42, () => g.play('shatter', { step: k }));
        at(s + 0.47, () => g.play('mote'));
        at(s + 0.6, () => g.play('markUp', { level: k + 1 }));
        if (k === 1) at(s + 0.52, () => g.play('nettoCross'));
        at(s + 0.79, () => g.play('land', { col: (k * 2) % 6, gain: 0.35 }));
      }
      at(T + 7.2, () => g.play('levelUp', { level: 6 }));
      at(T + 7.6, () => g.play('bigWin', { level: 5 }));
      at(T + 7.9, () => g.play('countTick'));
    });
    const sm = stats(spinMix.buf);
    res.scen.push({ id: 'base L5 + win cascade + bigWin5', sec: 16, rmsDb: +dB(sm.rms).toFixed(1), peakDb: +dB(sm.peak).toFixed(1), over088: overCount(spinMix.buf, 0.88), renderMs: Math.round(spinMix.ms) });
    check('spin mix never clips', sm.peak <= 0.99 && sm.nan === 0, `peak ${sm.peak.toFixed(4)}`);
    const musicOnly = windowRms(spinMix.buf, 0.5, 2.9);
    const withLands = windowRms(spinMix.buf, 3.6, 5.1);
    res.checks.push({ name: 'balance: base L5 music vs lands window', ok: true, detail: `music ${dB(musicOnly).toFixed(1)} dBFS rms → with lands ${dB(withLands).toFixed(1)} dBFS rms` });

    const cine = await scenario(29, shared, (g, at) => {
      at(0, () => { g.setBaseLayers(3); g.startBase(); });
      const T0 = 2.0, t0 = T0 + 0.06;
      at(T0, () => {
        g.play('stormSwell', { when: t0 });
        g.play('stormRiser', { when: t0 + 1.2 });
        g.play('impact', { when: t0 + 2.2 }); g.play('drop808', { when: t0 + 2.2 }); g.play('glassXL', { when: t0 + 2.24 });
        g.play('reform', { when: t0 + 3.4 });
        for (let i = 0; i < 8; i++) g.play('letterSlam', { when: t0 + 3.75 + i * 0.07, gain: 0.8 });
        g.startStorm(t0 + 5.6);
      });
      at(T0 + 0.02, () => g.duck(-40, 0.06));
      for (let c = 0; c < 8; c++) at(T0 + 4.6 + c * 0.04 + 0.175, () => g.play('land', { col: c, gain: 0.5 }));
      at(T0 + 5.35, () => g.play('markUp', { level: 1 }));
      at(T0 + 9, () => g.stormLevel(8));
      at(T0 + 10.5, () => g.play('waveBoom'));
      at(T0 + 12, () => g.stormLevel(32));
      at(T0 + 14, () => g.stormLevel(128));
      at(T0 + 15, () => { for (let c = 0; c < 8; c++) g.play('land', { col: c, gain: 0.9, when: T0 + 15 + c * 0.25 }); });
      at(T0 + 17.5, () => { g.play('bigWin', { level: 4 }); });
      at(T0 + 19, () => g.play('summary'));
      at(T0 + 20.5, () => { g.stopStorm(); g.play('fade'); });
      at(T0 + 23.5, () => { g.startBase(); g.setBaseLayers(2); });
    });
    const cs = stats(cine.buf);
    res.scen.push({ id: 'Solstorm cinematic → storm ×128 → outro', sec: 29, rmsDb: +dB(cs.rms).toFixed(1), peakDb: +dB(cs.peak).toFixed(1), over088: overCount(cine.buf, 0.88), renderMs: Math.round(cine.ms) });
    check('cinematic mix never clips', cs.peak <= 0.99 && cs.nan === 0, `peak ${cs.peak.toFixed(4)}`);
    const ducked = windowRms(cine.buf, 2.3, 2.9), preDuck = windowRms(cine.buf, 1.2, 1.95);
    res.checks.push({ name: 'cinematic: base ducked at hit-stop', ok: true, detail: `base ${dB(preDuck).toFixed(1)} → ${dB(ducked).toFixed(1)} dBFS (swell rising)` });
    const stormBody = windowRms(cine.buf, 2.06 + 5.7, 2.06 + 8.5);
    check('cinematic: storm music plays after downbeat', dB(stormBody) > -35, `storm rms ${dB(stormBody).toFixed(1)} dBFS`);
    const outroBase = windowRms(cine.buf, 27, 29);
    check('outro: base returns', dB(outroBase) > -60, `base rms ${dB(outroBase).toFixed(1)} dBFS`);
    // loudness timeline (1 s windows)
    const tl: string[] = [];
    for (let s = 0; s < 29; s += 1) tl.push(dB(windowRms(cine.buf, s, s + 1)).toFixed(0));
    res.checks.push({ name: 'cinematic loudness timeline (dBFS rms / s)', ok: true, detail: tl.join(' ') });

    // ---------------- 6. pre-unlock contract: silent no-ops, never throw, clock advances
    const pre = new GameAudio();
    let threw = 0;
    const tryIt = (f: () => void) => { try { f(); } catch { threw++; } };
    const n0 = pre.now();
    for (const n of ['land', 'chime', 'win', 'bigWin', 'countTick', 'stormSwell', 'letterSlam'] as Sfx[]) tryIt(() => pre.play(n, { col: 3, step: 2, level: 4, when: pre.now() + 1, gain: 0.5 }));
    tryIt(() => pre.play('land', { col: NaN, when: NaN, gain: -1 }));
    tryIt(() => pre.setBaseLayers(4)); tryIt(() => pre.startBase()); tryIt(() => pre.startStorm(NaN)); tryIt(() => pre.stormLevel(128));
    tryIt(() => pre.stopStorm()); tryIt(() => pre.duck(-40, 0.06)); tryIt(() => pre.setMuted(true)); tryIt(() => pre.setVolumes(0.5, NaN));
    tryIt(() => pre.suspend()); tryIt(() => pre.resume());
    await new Promise((r) => setTimeout(r, 120));
    const n1 = pre.now();
    check('pre-unlock: no throws', threw === 0, `${threw} throws`);
    check('pre-unlock: now() advances', n1 - n0 > 0.09 && n1 - n0 < 0.5, `advanced ${(n1 - n0).toFixed(3)} s; ctx ${pre.ctx}; latency ${pre.latency()}`);

    // ---------------- 7. real-time context (headless autoplay): unlock, clock continuity, pipeline, suspend
    const rt = new GameAudio();
    const before = rt.now();
    const u0 = performance.now();
    await rt.unlock();
    const uMs = performance.now() - u0;
    const after = rt.now();
    check('unlock resolves fast', uMs < 800, `${uMs.toFixed(0)} ms, state ${rt.ctx?.state}`);
    const ct = rt.ctx?.currentTime ?? -1;
    check('now() is AudioContext time once running', after - ct >= -0.001 && after - ct < 0.06, `now ${after.toFixed(4)} vs ctx.currentTime ${ct.toFixed(4)} (pre-unlock perf clock was ${before.toFixed(2)})`);
    let mono = true, prevT = rt.now();
    for (let k = 0; k < 120; k++) { await new Promise((r) => setTimeout(r, 2)); const x = rt.now(); if (x < prevT) mono = false; prevT = x; }
    check('now() monotonic while running', mono, `sampled 120× over ~300 ms`);
    let longest = 0;
    let po: PerformanceObserver | null = null;
    try { po = new PerformanceObserver((l) => { for (const e of l.getEntries()) longest = Math.max(longest, e.duration); }); po.observe({ type: 'longtask', buffered: false }); } catch { /* */ }
    const p0 = performance.now();
    const ready: Record<string, number> = {};
    const watch = ['land74a', 'base0', 'base1', 'base4', 'bigWin5'];
    while (rt.stats().rendered + rt.stats().failed < rt.stats().total && performance.now() - p0 < 60000) {
      for (const id of watch) if (ready[id] === undefined && rt.asset(id)) ready[id] = performance.now() - p0 + uMs;
      await new Promise((r) => setTimeout(r, 20));
    }
    const pipeMs = performance.now() - p0 + uMs;
    res.checks.push({ name: 'time-to-ready after unlock (ms)', ok: true, detail: watch.map((id) => `${id} ${Math.round(ready[id] ?? pipeMs)}`).join(' · ') });
    po?.disconnect();
    const st = rt.stats();
    check('base pipeline renders everything, no storm', st.failed === 0 && st.rendered === st.total && st.stormMb === 0 && !st.stormPrepared, `${st.rendered}/${st.total} in ${(pipeMs / 1000).toFixed(2)} s wall, ${st.mb.toFixed(1)} MB @ ${st.sampleRate} Hz (lite ${st.lite}), longest main-thread task ${longest.toFixed(0)} ms`);
    // lazy storm set
    const pz0 = performance.now();
    const pA = rt.prepareStorm(), pB = rt.prepareStorm();
    await pA;
    const coreMs = performance.now() - pz0;
    check('prepareStorm idempotent + resolves on core', pA === pB && !!rt.asset('storm0') && !!rt.asset('impact'), `core ready in ${Math.round(coreMs)} ms`);
    while (rt.stats().rendered + rt.stats().failed < rt.stats().total && performance.now() - pz0 < 60000) await new Promise((r) => setTimeout(r, 20));
    const sp2 = rt.stats();
    res.checks.push({ name: 'memory realtime: base → storm prepared', ok: true, detail: `${st.mb.toFixed(1)} MB → ${sp2.mb.toFixed(1)} MB (storm ${sp2.stormMb.toFixed(1)} MB, all in ${Math.round(performance.now() - pz0)} ms) @ ${sp2.sampleRate} Hz` });
    rt.releaseStorm();
    const sp3 = rt.stats();
    check('releaseStorm frees the storm set', sp3.stormMb === 0 && Math.abs(sp3.mb - st.mb) < 0.01 && !sp3.stormPrepared, `${sp3.mb.toFixed(1)} MB after release`);
    const pre2 = new GameAudio();
    let preResolved = false;
    await Promise.race([pre2.prepareStorm().then(() => { preResolved = true; }), new Promise((r) => setTimeout(r, 50))]);
    check('prepareStorm before unlock resolves (no-op)', preResolved, `resolved ${preResolved}`);
    if (rt.ctx?.state === 'running') {
      rt.startBase(); rt.setBaseLayers(5);
      const a0 = rt.now();
      await new Promise((r) => setTimeout(r, 300));
      const a1 = rt.now();
      check('now() tracks audio clock', a1 - a0 > 0.2 && a1 - a0 < 0.45, `+${(a1 - a0).toFixed(3)} s over 300 ms`);
      rt.suspend();
      await new Promise((r) => setTimeout(r, 150));
      const s0 = rt.now();
      await new Promise((r) => setTimeout(r, 200));
      const s1 = rt.now();
      check('suspend freezes clock', s1 - s0 < 0.06, `state ${rt.ctx.state}, +${(s1 - s0).toFixed(3)} s while suspended`);
      rt.resume();
      await new Promise((r) => setTimeout(r, 200));
      check('resume', rt.ctx.state === 'running', `state ${rt.ctx.state}`);
      for (let k = 0; k < 6; k++) rt.play('land', { col: k, when: rt.now() + 0.1 + k * 0.25 });
      rt.play('bigWin', { level: 5 });
      await new Promise((r) => setTimeout(r, 400));
      check('voices alive in realtime', rt.stats().voices > 0, `${rt.stats().voices} voices`);
      rt.suspend();
    }
    // startBase() after unlock() but before the context runs must not be lost
    const rt2 = new GameAudio();
    await rt2.unlock();
    rt2.suspend();
    await new Promise((r) => setTimeout(r, 100));
    rt2.startBase();
    const lostBefore = rt2.stats().base;
    rt2.resume();
    const q0 = performance.now();
    while (!rt2.stats().base && performance.now() - q0 < 8000) await new Promise((r) => setTimeout(r, 50));
    check('startBase intent survives a non-running context', !lostBefore && rt2.stats().base, `base running after resume: ${rt2.stats().base} (${Math.round(performance.now() - q0)} ms)`);
    rt2.suspend();
    void grid;
  } catch (e) {
    fail('exception ' + (e as Error).stack);
  }
  res.done = true;
  log(`done · ${res.fail.length} failures`);
}

if (location.hash.includes('check')) void runCheck();

// diagnostics hook for ad-hoc QA scripts
(window as unknown as { __audioDev: unknown }).__audioDev = { GameAudio, RENDER_STATS };
