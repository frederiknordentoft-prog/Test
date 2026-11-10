/**
 * The mixing desk. One graph, built against BaseAudioContext so the exact same
 * code runs live (AudioContext) and under measurement (OfflineAudioContext).
 *
 *   sfx voices ──► sfxIn ──► sfxFader ──────────────────────┐
 *              └─► sfxSend ─► sfxFader' ──► reverb ─────────┤
 *   music layers ► musicIn ─► duck ─► musicFader ───────────┤
 *              └─► musicSend ► duck' ► musicFader' ► reverb │
 *              └─► musicEcho ► ping-pong delay ► musicIn    │
 *                                                           ▼
 *        sum ► DC block ► bus compressor ► trim ► soft limiter ► master ► mute ► out
 *
 * Reverb sends are taken after the faders, so turning a bus down (or ducking
 * the music) takes its tail down with it.
 */
import { Rng } from '../core/rng';

export type Wave = OscillatorType | PeriodicWave;
export type NoiseKind = 'white' | 'pink' | 'brown';

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
/** A finite number, or the fallback. Parameters arrive from game code and must never poison the graph with NaN. */
export const num = (x: unknown, fallback: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : fallback);
export const dB = (d: number): number => Math.pow(10, d / 20);
/** Oscillator-safe frequency. */
export const hz = (f: number): number => clamp(num(f, 440), 8, 19000);

/**
 * Cues are scheduled this far ahead of "now". The audio thread runs a few
 * milliseconds in front of what the main thread can see, so an attack that
 * starts exactly at currentTime may already be half over when it is heard,
 * and a half-skipped attack is a click.
 */
export const LEAD = 0.006;

/** Wet level of the shared room, calibrated by measurement (tools/audio-audit.cjs). */
const REVERB_RETURN = 0.9;
/**
 * The browser's compressor adds its own make-up gain. This trim sets where the
 * loudest moments land against the limiter's knee.
 */
const POST_COMP_TRIM = 0.82;

// ───────────────────────────── Envelopes ─────────────────────────────

/** Silent → peak over `attack`, then an exponential fall to −60 dB over `decay`. Returns the time it reaches silence. */
export function perc(p: AudioParam, t: number, peak: number, attack: number, decay: number): number {
  const a = Math.max(0.0005, attack);
  const d = Math.max(0.004, decay);
  p.setValueAtTime(0, t);
  if (!(peak > 1e-6)) return t + a + d;
  p.linearRampToValueAtTime(peak, t + a);
  p.exponentialRampToValueAtTime(peak * 0.001, t + a + d);
  p.linearRampToValueAtTime(0, t + a + d + 0.004);
  return t + a + d + 0.004;
}

/** Attack, hold, exponential release. Returns the time it reaches silence. */
export function ahr(p: AudioParam, t: number, peak: number, attack: number, hold: number, release: number): number {
  const a = Math.max(0.0005, attack);
  const r = Math.max(0.004, release);
  p.setValueAtTime(0, t);
  if (!(peak > 1e-6)) return t + a + hold + r;
  p.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) p.setValueAtTime(peak, t + a + hold);
  p.exponentialRampToValueAtTime(peak * 0.001, t + a + hold + r);
  p.linearRampToValueAtTime(0, t + a + hold + r + 0.004);
  return t + a + hold + r + 0.004;
}

/** Exponential glide between two positive values. */
export function sweep(p: AudioParam, t: number, from: number, to: number, dur: number): void {
  p.setValueAtTime(Math.max(1e-4, from), t);
  p.exponentialRampToValueAtTime(Math.max(1e-4, to), t + Math.max(0.001, dur));
}

/** Linear glide. */
export function slide(p: AudioParam, t: number, from: number, to: number, dur: number): void {
  p.setValueAtTime(from, t);
  p.linearRampToValueAtTime(to, t + Math.max(0.001, dur));
}

// ───────────────────────────── Generated sample data ─────────────────────────────

/** Raw sample data is context-independent, so it is generated once per sample rate. */
const dataCache = new Map<string, Float32Array<ArrayBuffer>[]>();

function cached(key: string, make: () => Float32Array<ArrayBuffer>[]): Float32Array<ArrayBuffer>[] {
  let d = dataCache.get(key);
  if (!d) {
    d = make();
    dataCache.set(key, d);
  }
  return d;
}

/**
 * The room: about 2.8 s of decaying noise whose top end dies first, so the
 * tail goes dark and warm instead of hissing. A few early taps give it walls.
 */
function makeImpulse(sr: number, seconds: number): Float32Array<ArrayBuffer>[] {
  const n = Math.floor(sr * seconds);
  const pre = Math.floor(sr * 0.014);
  const out = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    const rng = new Rng(0x1572 + c * 7919);
    const d = out[c];
    let lp1 = 0;
    let lp2 = 0;
    let hpIn = 0;
    let hpOut = 0;
    const hpA = Math.exp((-2 * Math.PI * 150) / sr);
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const white = rng.next() * 2 - 1;
      const cutoff = 650 + 9800 * Math.exp(-t * 2.3);
      const a = 1 - Math.exp((-2 * Math.PI * cutoff) / sr);
      lp1 += a * (white - lp1);
      lp2 += a * (lp1 - lp2);
      // One-pole high-pass: keeps mud and DC out of the tail.
      hpOut = lp2 - hpIn + hpA * hpOut;
      hpIn = lp2;
      const build = 1 - Math.exp(-t / 0.006);
      const env = 0.7 * Math.exp((-6.91 * t) / 2.75) + 0.3 * Math.exp((-6.91 * t) / 0.55);
      d[i] = hpOut * env * build;
    }
    const taps = c === 0 ? [0.0113, 0.0191, 0.0297, 0.0431, 0.0613] : [0.0137, 0.0223, 0.0331, 0.0479, 0.0677];
    taps.forEach((time, k) => {
      const i = Math.floor(time * sr);
      const g = 0.5 * Math.pow(0.72, k) * (k % 2 ? -1 : 1);
      // A tap is three samples wide: a single-sample spike would ring every bright transient.
      d[i - 1] += g * 0.5;
      d[i] += g;
      d[i + 1] += g * 0.5;
    });
    const fade = Math.floor(sr * 0.08);
    for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
  }
  return out;
}

function makeNoise(sr: number, kind: NoiseKind, seconds: number): Float32Array<ArrayBuffer>[] {
  const n = Math.floor(sr * seconds);
  const out = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    const rng = new Rng(0xbeef + c * 104729 + kind.length * 31);
    const d = out[c];
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    let brown = 0;
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const w = rng.next() * 2 - 1;
      let y = w;
      if (kind === 'pink') {
        // Paul Kellet's economy pink filter.
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        y = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      } else if (kind === 'brown') {
        brown = (brown + 0.02 * w) / 1.02;
        y = brown;
      }
      d[i] = y;
      if (Math.abs(y) > peak) peak = Math.abs(y);
    }
    // Loop seam: cross-fade the end into the start so a looping source never ticks.
    const seam = Math.floor(sr * 0.03);
    for (let i = 0; i < seam; i++) {
      const k = i / seam;
      d[n - seam + i] = d[n - seam + i] * (1 - k) + d[i] * k;
    }
    const norm = 0.95 / (peak || 1);
    for (let i = 0; i < n; i++) d[i] *= norm;
  }
  return out;
}

/** Dry ratchet click: three inharmonic partials that die within a couple of milliseconds, plus a breath of noise. */
function makeClick(sr: number): Float32Array<ArrayBuffer>[] {
  const n = Math.floor(sr * 0.016);
  const d = new Float32Array(n);
  const rng = new Rng(0xc11c);
  const parts = [
    { f: 2140, tau: 0.0016, g: 0.55 },
    { f: 3390, tau: 0.0011, g: 0.42 },
    { f: 5270, tau: 0.0007, g: 0.3 },
    { f: 880, tau: 0.0024, g: 0.25 },
  ];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let y = 0;
    for (const p of parts) y += Math.sin(2 * Math.PI * p.f * t) * Math.exp(-t / p.tau) * p.g;
    y += (rng.next() * 2 - 1) * Math.exp(-t / 0.0005) * 0.3 * Math.min(1, i / 6);
    d[i] = y * Math.min(1, (n - i) / (sr * 0.002));
  }
  return [d];
}

/** Count-up blip at a 1 kHz reference pitch; the playback rate tunes it. */
function makeBlip(sr: number): Float32Array<ArrayBuffer>[] {
  const n = Math.floor(sr * 0.06);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const y = Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t / 0.009) + Math.sin(2 * Math.PI * 3000 * t) * Math.exp(-t / 0.0025) * 0.22;
    d[i] = y * Math.min(1, i / (sr * 0.0006)) * Math.min(1, (n - i) / (sr * 0.004));
  }
  return [d];
}

/** Transparent below the knee, then a tanh shoulder to the ceiling. An odd length keeps zero at zero (no DC). */
function softClipCurve(knee: number, ceiling: number): Float32Array<ArrayBuffer> {
  const n = 4097;
  const c = new Float32Array(n);
  const span = ceiling - knee;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + span * Math.tanh((a - knee) / span);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

// ───────────────────────────── Voice ─────────────────────────────

export interface VoiceOpts {
  /** Linear level of the whole voice. */
  gain?: number;
  /** −1..1 */
  pan?: number;
  /** 0..1 reverb send (sfx voices only; music layers carry their own). */
  send?: number;
  /** Start time. Defaults to now + LEAD. */
  at?: number;
  /** 0 expendable · 1 normal · 2 feature · 3 bed (never stolen by anything smaller). */
  priority?: number;
  /** Music-layer input. Its presence makes this a music voice. */
  dest?: AudioNode;
  /** Featherweight: no panner, no send. For cues that fire many times a second. */
  micro?: boolean;
}

/**
 * Every node of one sounding event. A voice knows when it ends, can be faded
 * and stopped early (stealing, beds switched off) and disconnects all of its
 * nodes when it is swept.
 */
export class Voice {
  readonly out: GainNode;
  end: number;
  releasing = false;
  dead = false;
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];

  constructor(
    readonly e: Engine,
    readonly t: number,
    readonly priority: number,
  ) {
    this.out = e.ctx.createGain();
    this.nodes.push(this.out);
    this.end = t;
  }

  /** Oscillator. A non-finite `stop` leaves it running until the voice is released. */
  osc(type: Wave, freq: number, start: number, stop: number, detune = 0): OscillatorNode {
    const o = this.e.ctx.createOscillator();
    if (typeof type === 'object') o.setPeriodicWave(type);
    else o.type = type;
    o.frequency.value = hz(freq);
    if (detune) o.detune.value = num(detune, 0);
    o.start(start);
    this.addSource(o, stop);
    return o;
  }

  /** Looping noise from a random point in the shared buffer (stereo, decorrelated). */
  noise(kind: NoiseKind, start: number, stop: number, rate = 1): AudioBufferSourceNode {
    const s = this.e.ctx.createBufferSource();
    const buf = this.e.buffers[kind];
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = clamp(num(rate, 1), 0.05, 8);
    s.start(start, this.e.rng.next() * (buf.duration - 0.1));
    this.addSource(s, stop);
    return s;
  }

  /** One-shot sample. */
  sample(buffer: AudioBuffer, start: number, rate = 1): AudioBufferSourceNode {
    const s = this.e.ctx.createBufferSource();
    const r = clamp(num(rate, 1), 0.05, 8);
    s.buffer = buffer;
    s.playbackRate.value = r;
    s.start(start);
    this.addSource(s, start + buffer.duration / r + 0.005);
    return s;
  }

  private addSource(s: AudioScheduledSourceNode, stop: number): void {
    if (Number.isFinite(stop)) s.stop(stop);
    this.sources.push(s);
    this.nodes.push(s);
    if (stop > this.end) this.end = stop;
  }

  gain(value = 0): GainNode {
    const g = this.e.ctx.createGain();
    g.gain.value = value;
    this.nodes.push(g);
    return g;
  }

  filter(type: BiquadFilterType, freq: number, q = 0.707, gainDb = 0): BiquadFilterNode {
    const f = this.e.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = clamp(num(freq, 1000), 10, 20000);
    f.Q.value = q;
    if (gainDb) f.gain.value = gainDb;
    this.nodes.push(f);
    return f;
  }

  pan(value: number): StereoPannerNode {
    const p = this.e.ctx.createStereoPanner();
    p.pan.value = clamp(num(value, 0), -1, 1);
    this.nodes.push(p);
    return p;
  }

  /** Move the stop time of every source (pads whose length is only known when the next chord arrives). */
  stopAt(time: number): void {
    for (const s of this.sources) {
      try {
        s.stop(time);
      } catch {
        /* already ended */
      }
    }
    this.end = time;
  }

  /** Fade out and stop early. Used by voice stealing and by beds when they are switched off. */
  release(at: number, fade = 0.012): void {
    if (this.releasing || this.dead) return;
    this.releasing = true;
    const g = this.out.gain;
    g.cancelScheduledValues(at);
    g.setTargetAtTime(0, at, fade / 4);
    this.stopAt(at + fade * 2 + 0.01);
  }

  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        /* never connected */
      }
    }
    this.nodes.length = 0;
    this.sources.length = 0;
  }
}

// ───────────────────────────── Engine ─────────────────────────────

export interface EngineOptions {
  maxSfxVoices?: number;
  maxMusicVoices?: number;
  /** Adds an AnalyserNode on the output (live meters). */
  analyser?: boolean;
}

export interface EngineStats {
  started: number;
  stolen: number;
  dropped: number;
  /** Events that were due before "now" when they were scheduled. Must stay 0. */
  late: number;
  peakSfxVoices: number;
  peakMusicVoices: number;
}

export class Engine {
  readonly ctx: BaseAudioContext;
  readonly sr: number;
  /** Cosmetic variation only (detune, pan jitter, noise offsets). */
  readonly rng = new Rng(0x57e11a ^ 0xa0d10);

  readonly sfxIn: GainNode;
  readonly sfxSend: GainNode;
  readonly musicIn: GainNode;
  readonly musicSend: GainNode;
  readonly musicEcho: GainNode;
  readonly analyser: AnalyserNode | null = null;

  readonly waves: { warm: PeriodicWave; glass: PeriodicWave; brass: PeriodicWave };
  readonly buffers: { white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer; click: AudioBuffer; blip: AudioBuffer };

  readonly stats: EngineStats = { started: 0, stolen: 0, dropped: 0, late: 0, peakSfxVoices: 0, peakMusicVoices: 0 };

  private readonly sfxPool: Voice[] = [];
  private readonly musicPool: Voice[] = [];
  private readonly maxSfx: number;
  private readonly maxMusic: number;

  private readonly sfxFaders: GainNode[];
  private readonly musicFaders: GainNode[];
  private readonly duckers: GainNode[];
  private readonly master: GainNode;
  private readonly muteGain: GainNode;
  private readonly echoDelays: DelayNode[];
  private readonly fixed: AudioNode[] = [];

  private duckDepth = 1;
  private duckUntil = 0;

  constructor(ctx: BaseAudioContext, opts: EngineOptions = {}) {
    this.ctx = ctx;
    this.sr = ctx.sampleRate;
    this.maxSfx = opts.maxSfxVoices ?? 30;
    this.maxMusic = opts.maxMusicVoices ?? 40;

    const g = (v = 1) => {
      const n = ctx.createGain();
      n.gain.value = v;
      this.fixed.push(n);
      return n;
    };

    // Waveforms. Raw saws and squares are what "cheap synth" sounds like; these
    // roll the harmonics off so the filters have something musical to shape.
    const wave = (amp: (n: number) => number, count: number) => {
      const real = new Float32Array(count + 1);
      const imag = new Float32Array(count + 1);
      for (let n = 1; n <= count; n++) imag[n] = amp(n);
      return ctx.createPeriodicWave(real, imag);
    };
    this.waves = {
      warm: wave((n) => (n % 2 ? 1 : 0.62) / Math.pow(n, 1.45), 40),
      glass: wave((n) => [0, 1, 0.34, 0.1, 0.16, 0.03, 0.07, 0.01, 0.03][n] ?? 0, 8),
      brass: wave((n) => (1 / n) * (1 + 0.9 * Math.exp(-Math.pow((n - 4) / 2.2, 2))), 48),
    };

    const sr = this.sr;
    const toBuffer = (chans: Float32Array<ArrayBuffer>[]) => {
      const b = ctx.createBuffer(chans.length, chans[0].length, sr);
      chans.forEach((c, i) => b.copyToChannel(c, i));
      return b;
    };
    this.buffers = {
      white: toBuffer(cached(`white@${sr}`, () => makeNoise(sr, 'white', 2.5))),
      pink: toBuffer(cached(`pink@${sr}`, () => makeNoise(sr, 'pink', 2.5))),
      brown: toBuffer(cached(`brown@${sr}`, () => makeNoise(sr, 'brown', 3))),
      click: toBuffer(cached(`click@${sr}`, () => makeClick(sr))),
      blip: toBuffer(cached(`blip@${sr}`, () => makeBlip(sr))),
    };

    // Buses.
    this.sfxIn = g();
    this.sfxSend = g();
    this.musicIn = g();
    this.musicSend = g();
    this.musicEcho = g();
    const sfxFader = g();
    const sfxFaderWet = g();
    const duck = g();
    const duckWet = g();
    const musicFader = g();
    const musicFaderWet = g();
    this.sfxFaders = [sfxFader, sfxFaderWet];
    this.musicFaders = [musicFader, musicFaderWet];
    this.duckers = [duck, duckWet];

    // Reverb: one shared space for everything.
    const reverb = ctx.createConvolver();
    reverb.buffer = toBuffer(cached(`ir@${sr}`, () => makeImpulse(sr, 2.8)));
    const reverbIn = g();
    const reverbTone = ctx.createBiquadFilter();
    reverbTone.type = 'highshelf';
    reverbTone.frequency.value = 5200;
    reverbTone.gain.value = -3;
    const reverbReturn = g(REVERB_RETURN);
    this.fixed.push(reverb, reverbTone);

    // Ping-pong echo for the melodic music layers (celesta, arpeggio, bells).
    const dl = ctx.createDelay(1.5);
    const dr = ctx.createDelay(1.5);
    dl.delayTime.value = 0.625;
    dr.delayTime.value = 0.625;
    this.echoDelays = [dl, dr];
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 2600;
    echoTone.Q.value = 0.5;
    const echoFeedback = g(0.36);
    const echoPanL = ctx.createStereoPanner();
    const echoPanR = ctx.createStereoPanner();
    echoPanL.pan.value = -0.62;
    echoPanR.pan.value = 0.62;
    const echoOut = g(0.85);
    this.fixed.push(dl, dr, echoTone, echoPanL, echoPanR);
    this.musicEcho.connect(echoTone).connect(dl);
    dl.connect(dr);
    dr.connect(echoFeedback).connect(echoTone);
    dl.connect(echoPanL).connect(echoOut);
    dr.connect(echoPanR).connect(echoOut);
    echoOut.connect(this.musicIn);
    const echoToVerb = g(0.3);
    echoOut.connect(echoToVerb).connect(this.musicSend);

    // Master chain.
    const sum = g();
    const dcBlock = ctx.createBiquadFilter();
    dcBlock.type = 'highpass';
    dcBlock.frequency.value = 22;
    dcBlock.Q.value = 0.707;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -21;
    comp.knee.value = 18;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.008;
    comp.release.value = 0.22;
    const trim = g(POST_COMP_TRIM);
    const limiter = ctx.createWaveShaper();
    limiter.curve = softClipCurve(0.68, 0.875);
    limiter.oversample = 'none';
    this.master = g();
    this.muteGain = g();
    this.fixed.push(dcBlock, comp, limiter);

    this.sfxIn.connect(sfxFader).connect(sum);
    this.sfxSend.connect(sfxFaderWet).connect(reverbIn);
    this.musicIn.connect(duck).connect(musicFader).connect(sum);
    this.musicSend.connect(duckWet).connect(musicFaderWet).connect(reverbIn);
    reverbIn.connect(reverb).connect(reverbTone).connect(reverbReturn).connect(sum);
    sum.connect(dcBlock).connect(comp).connect(trim).connect(limiter).connect(this.master).connect(this.muteGain).connect(ctx.destination);

    if (opts.analyser) {
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      an.smoothingTimeConstant = 0.6;
      this.muteGain.connect(an);
      this.fixed.push(an);
      this.analyser = an;
    }
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  // ── Voices ──

  /**
   * Make room for `need` new voices at this priority. Steals the oldest of the
   * least important voices; returns false (drop the cue) when everything
   * sounding matters more than the newcomer, or when a storm is in progress.
   */
  admit(priority: number, music = false, need = 1): boolean {
    const pool = music ? this.musicPool : this.sfxPool;
    const cap = music ? this.maxMusic : this.maxSfx;
    const now = this.now;
    this.sweep(now);
    if (pool.length > cap * 2) {
      this.stats.dropped++;
      return false;
    }
    let live = 0;
    for (const v of pool) if (!v.releasing) live++;
    while (live + need > cap) {
      let pick: Voice | null = null;
      for (const v of pool) {
        if (v.releasing || v.priority > priority) continue;
        if (!pick || v.priority < pick.priority || (v.priority === pick.priority && v.t < pick.t)) pick = v;
      }
      if (!pick) {
        this.stats.dropped++;
        return false;
      }
      pick.release(now, 0.012);
      this.stats.stolen++;
      live--;
    }
    return true;
  }

  voice(o: VoiceOpts = {}): Voice {
    const now = this.now;
    let t = num(o.at, now + LEAD);
    if (t < now) {
      // Never schedule in the past: count it, then play it now.
      this.stats.late++;
      t = now + 0.002;
    }
    const v = new Voice(this, t, o.priority ?? 1);
    v.out.gain.value = clamp(num(o.gain, 1), 0, 8);
    const music = !!o.dest;
    if (o.micro) {
      v.out.connect(o.dest ?? this.sfxIn);
    } else {
      const p = v.pan(num(o.pan, 0));
      v.out.connect(p);
      p.connect(o.dest ?? this.sfxIn);
      const send = clamp(num(o.send, 0), 0, 1.5);
      if (!music && send > 0) {
        const s = v.gain(send);
        p.connect(s);
        s.connect(this.sfxSend);
      }
    }
    const pool = music ? this.musicPool : this.sfxPool;
    pool.push(v);
    this.stats.started++;
    if (music) this.stats.peakMusicVoices = Math.max(this.stats.peakMusicVoices, pool.length);
    else this.stats.peakSfxVoices = Math.max(this.stats.peakSfxVoices, pool.length);
    return v;
  }

  /** Disconnect every voice that has finished sounding. */
  sweep(now = this.now): void {
    for (const pool of [this.sfxPool, this.musicPool]) {
      let w = 0;
      for (let i = 0; i < pool.length; i++) {
        const v = pool[i];
        if (v.end + 0.05 < now) v.dispose();
        else pool[w++] = v;
      }
      pool.length = w;
    }
  }

  get voiceCounts(): { sfx: number; music: number } {
    return { sfx: this.sfxPool.length, music: this.musicPool.length };
  }

  // ── Mix controls ──

  /**
   * Dip the music under a big moment and let it come back.
   * depth = level during the dip (0..1), hold = seconds at the bottom.
   */
  duck(depth: number, hold: number, release = 0.9, attack = 0.05): void {
    const now = this.now;
    let d = clamp(num(depth, 1), 0, 1);
    let until = now + Math.max(0, num(hold, 0));
    // A shallow dip arriving during a deep one must not lift the music early.
    if (now < this.duckUntil) {
      d = Math.min(d, this.duckDepth);
      until = Math.max(until, this.duckUntil);
    }
    this.duckDepth = d;
    this.duckUntil = until;
    for (const n of this.duckers) {
      n.gain.cancelScheduledValues(now);
      n.gain.setTargetAtTime(d, now, Math.max(0.005, attack / 3));
      n.gain.setTargetAtTime(1, until, Math.max(0.02, release / 3));
    }
  }

  setVolume(bus: 'master' | 'music' | 'sfx', v01: number): void {
    const v = clamp(num(v01, 1), 0, 1);
    // Squared: a fader that feels linear to the ear.
    const g = v * v;
    const now = this.now;
    const nodes = bus === 'master' ? [this.master] : bus === 'music' ? this.musicFaders : this.sfxFaders;
    for (const n of nodes) n.gain.setTargetAtTime(g, now, 0.03);
  }

  setMuted(muted: boolean): void {
    this.muteGain.gain.setTargetAtTime(muted ? 0 : 1, this.now, 0.02);
  }

  /** Echo time follows the tempo (three sixteenths: a dotted eighth). */
  setEchoTime(seconds: number, at: number): void {
    const s = clamp(num(seconds, 0.6), 0.05, 1.4);
    for (const d of this.echoDelays) d.delayTime.setTargetAtTime(s, at, 0.25);
  }

  /** Stop and disconnect everything. The context itself belongs to the caller. */
  dispose(): void {
    const now = this.now;
    for (const pool of [this.sfxPool, this.musicPool]) {
      for (const v of pool) {
        v.stopAt(now);
        v.dispose();
      }
      pool.length = 0;
    }
    for (const n of this.fixed) {
      try {
        n.disconnect();
      } catch {
        /* not connected */
      }
    }
  }
}
