// NORDLYS · SOLSTORM G5 — audio engine (raw WebAudio; CONTRACTS.md §5, PLAN.md §7).
//
// Graph:  voices ─┬─ sfx{dry,room,hall} ─ vol ─┐
//                 └─ ui ────────────────── vol ─┤
//         base/storm sessions ─ music vol ─ musicLP ─ duck ─ dip ─┤→ master(mute) → HP 35 Hz → limiter (−1 dBFS)
//         (room/hall/ui/music sends) → HP/LP → [base IR 2.8 s | storm IR 1.6 s] ─┘        → ceiling → out
//
// Music is pre-rendered loopable stems (see music.ts) played as looping AudioBufferSourceNodes that all
// share one start time, so layers are sample-locked; layer gains change only on bar boundaries via a
// look-ahead scheduler (25 ms timer, 120 ms horizon). SFX are pre-rendered one-shots (see sfx.ts) played
// with crand jitter. Before unlock() nothing makes sound and nothing throws; now() runs on
// performance.now()/1000 until the context runs, then it IS ctx.currentTime (so `when` values may be
// derived from either now() or ctx.currentTime).
import { crand } from '../core/cosmeticRng.ts';
import { TIER_SECS } from '../present/schedule.ts';
import { makeIR, dbToGain } from './dsp.ts';
import { renderAsset, allAssetIds, baseAssetIds, isStormAsset, isGateAsset, baseLayerIds, STORM_CORE, STORM_EXTRA, GATE_SET, BED_ASSETS } from './assets.ts';
import { LAND_ZONES, CHIME_LADDER, CHIME_ZONES, LEVEL_SEMIS, BELL_1948, nearestZone } from './sfx.ts';
import { barFrames, BASE_BPM, STORM_BPM, LAND_BASE, LAND_STORM } from './music.ts';
import { POLAR_ID } from './polar.ts';

/** Base bed: the "Polar Night" recording (default) or the procedural pad (base0). */
export type MusicSource = 'polar' | 'code';

export type Sfx = 'tap' | 'stakeUp' | 'stakeDown' | 'spin' | 'land' | 'chime' | 'shatter' | 'returnTick' | 'nettoCross'
  | 'markUp' | 'mote' | 'levelUp' | 'sun' | 'anticipation' | 'countTick' | 'win' | 'bigWin'
  | 'stormSwell' | 'stormRiser' | 'impact' | 'glassXL' | 'drop808' | 'letterSlam' | 'waveBoom' | 'reform' | 'summary' | 'fade'
  // Terningen: the award, the storm pop/hold, the year bells (level 1–4 = 1-9-4-8, 5–8 an octave up) …
  | 'dieBirth' | 'dieLand' | 'dieQuench' | 'dieHold' | 'bell1948' | 'diePulse'
  // … and the gate ceremony (lazy set: prepareGate / releaseGate)
  | 'gateDrone' | 'tileShimmer' | 'keystone' | 'sealCrack' | 'gateBreath' | 'lightPad';

export interface PlayOpts { col?: number; step?: number; level?: number; when?: number; gain?: number }

/** Calm mode plays every dice and gate sound 3 dB softer (setCalm). */
export const CALM_GAIN = 0.7;

type Verb = 'dry' | 'room' | 'hall';
interface Cfg {
  db: number;      // voice peak level (dBFS at volume 1, before opts.gain)
  verb: Verb;      // reverb class (dry = none)
  ui?: boolean;    // UI bus
  cents: number;   // ± playbackRate jitter
  jdb: number;     // ± level jitter (dB)
  max: number;     // max simultaneous voices of this name
  gap: number;     // min seconds between two triggers (rate limit)
}

/** THE mix table. Everything that repeats per spin is soft; cinematic weight only in the storm set. */
const CFG: Record<Sfx, Cfg> = {
  tap:          { db: -26, verb: 'room', ui: true, cents: 18, jdb: 0.8, max: 3, gap: 0.03 },
  stakeUp:      { db: -23, verb: 'room', ui: true, cents: 4, jdb: 0.5, max: 3, gap: 0.04 },
  stakeDown:    { db: -23, verb: 'room', ui: true, cents: 4, jdb: 0.5, max: 3, gap: 0.04 },
  spin:         { db: -25, verb: 'room', cents: 60, jdb: 1, max: 2, gap: 0.1 },
  land:         { db: -15, verb: 'hall', cents: 4, jdb: 1, max: 12, gap: 0.018 },
  chime:        { db: -11, verb: 'hall', cents: 3, jdb: 0.5, max: 6, gap: 0.05 },
  shatter:      { db: -17, verb: 'room', cents: 35, jdb: 1, max: 6, gap: 0.03 },
  returnTick:   { db: -18, verb: 'dry', cents: 20, jdb: 0.4, max: 3, gap: 0.05 },
  nettoCross:   { db: -16, verb: 'hall', cents: 0, jdb: 0, max: 2, gap: 0.2 },
  markUp:       { db: -17, verb: 'room', cents: 3, jdb: 0.5, max: 6, gap: 0.03 },
  mote:         { db: -27, verb: 'room', cents: 80, jdb: 1.5, max: 4, gap: 0.05 },
  levelUp:      { db: -10, verb: 'hall', cents: 0, jdb: 0, max: 2, gap: 0.15 },
  sun:          { db: -11, verb: 'hall', cents: 2, jdb: 0, max: 5, gap: 0.05 },
  anticipation: { db: -15, verb: 'room', cents: 0, jdb: 0, max: 1, gap: 0.2 },
  countTick:    { db: -27, verb: 'room', cents: 10, jdb: 0.5, max: 30, gap: 0.04 },
  win:          { db: -12, verb: 'hall', cents: 3, jdb: 0.5, max: 2, gap: 0.2 },
  bigWin:       { db: -8, verb: 'hall', cents: 0, jdb: 0, max: 1, gap: 0.3 },
  stormSwell:   { db: -7, verb: 'room', cents: 0, jdb: 0, max: 1, gap: 0.3 },
  stormRiser:   { db: -7, verb: 'room', cents: 0, jdb: 0, max: 1, gap: 0.3 },
  impact:       { db: -3, verb: 'hall', cents: 0, jdb: 0, max: 2, gap: 0.1 },
  glassXL:      { db: -8, verb: 'hall', cents: 0, jdb: 0, max: 2, gap: 0.1 },
  drop808:      { db: -5, verb: 'dry', cents: 0, jdb: 0, max: 2, gap: 0.1 },
  letterSlam:   { db: -13, verb: 'room', cents: 6, jdb: 0.5, max: 8, gap: 0.03 },
  waveBoom:     { db: -6, verb: 'room', cents: 0, jdb: 0, max: 2, gap: 0.2 },
  reform:       { db: -11, verb: 'room', cents: 0, jdb: 0, max: 1, gap: 0.2 },
  summary:      { db: -10, verb: 'hall', cents: 0, jdb: 0, max: 1, gap: 0.3 },
  fade:         { db: -11, verb: 'hall', cents: 0, jdb: 0, max: 1, gap: 0.3 },
  // dice: the award sounds sit ≥ 6 dB under the 'win' stinger; the ceremony's are its own moment
  dieBirth:     { db: -20, verb: 'hall', cents: 3, jdb: 0, max: 1, gap: 0.3 },
  dieLand:      { db: -22, verb: 'room', ui: true, cents: 3, jdb: 0, max: 3, gap: 0.05 },
  dieQuench:    { db: -24, verb: 'room', cents: 0, jdb: 0, max: 2, gap: 0.05 },
  dieHold:      { db: -26, verb: 'room', cents: 0, jdb: 0, max: 3, gap: 0.05 },
  bell1948:     { db: -14, verb: 'hall', cents: 0, jdb: 0, max: 4, gap: 0.1 },
  diePulse:     { db: -17, verb: 'room', cents: 0, jdb: 0, max: 1, gap: 0.3 },
  gateDrone:    { db: -18, verb: 'room', cents: 0, jdb: 0, max: 1, gap: 0.5 },
  tileShimmer:  { db: -22, verb: 'hall', cents: 0, jdb: 0, max: 1, gap: 0.5 },
  keystone:     { db: -14, verb: 'hall', cents: 0, jdb: 0, max: 1, gap: 0.3 },
  sealCrack:    { db: -14, verb: 'room', cents: 0, jdb: 0, max: 1, gap: 0.3 },
  gateBreath:   { db: -18, verb: 'room', cents: 0, jdb: 0, max: 1, gap: 0.3 },
  lightPad:     { db: -18, verb: 'hall', cents: 0, jdb: 0, max: 1, gap: 0.5 },
};
/** Sounds that calm mode softens (CALM_GAIN). */
const DICE_SFX = new Set<Sfx>(['dieBirth', 'dieLand', 'dieQuench', 'dieHold', 'bell1948', 'diePulse', 'gateDrone', 'tileShimmer', 'keystone', 'sealCrack', 'gateBreath', 'lightPad']);

const SEND_DB = { room: -16, hall: -9, ui: -20, music: -13 };
const HORIZON = 0.12;   // scheduler look-ahead (s)
const TICK_MS = 25;
const MAX_VOICES = 48;
const STORM_IDS = ['storm0', 'storm1', 'storm2', 'storm3'];
const STORM_AT = [0, 8, 32, 128]; // stormLevel thresholds per storm layer
const STORM_CINE = ['storm0', 'stormSwell', 'stormRiser', 'impact', 'drop808', 'glassXL', 'reform', 'letterSlam0', 'letterSlam1', 'land74a', 'markUp'];
const BED_TAU = 0.3;  // live bed switch: crossfade time constant (s): old bed −29 dB after 1 s, stopped after 10τ
const BED_WAIT = 4;   // s startBase() waits for the Polar decode before starting on the procedural bed

interface Voice { src: AudioBufferSourceNode; g: GainNode; name: Sfx; t: number; end: number; dead: boolean }
interface Session {
  kind: 'base' | 'storm';
  ids: string[];      // asset per layer (base: baseLayerIds(bed) — layer 0 is the bed, 1/2/4 follow its chords)
  group: GainNode;
  layers: GainNode[];
  src: (AudioBufferSourceNode | null)[];
  start: number;      // ctx time of loop position 0
  bar: number;        // seconds per bar
  committed: boolean[];
  pendAt: number[];   // time of the scheduled (not yet reached) boundary change, −1 = none
  pendOn: boolean[];
  stopped: boolean;
  alive: number;      // started sources not yet ended
  sg: (GainNode | null)[]; // base only: each layer's source behind its own gain (a bed switch crossfades them)
}
interface Nodes {
  master: GainNode; out: AudioNode;
  music: GainNode; musicLP: BiquadFilterNode; duck: GainNode; dip: GainNode;
  sfx: Record<Verb, GainNode>; sfxVol: GainNode[]; ui: GainNode; uiVol: GainNode;
  sendBase: GainNode; sendStorm: GainNode;
}
interface Deferred { name: Sfx; id: string; t: number; rate: number; amp: number; pan: number }
export interface SchedLog { t: number; kind: 'base' | 'storm'; layer: number; on: boolean; at: number }

const perfNow = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const noop = (): void => {};

/** Brick-wall safety ceiling after the limiter: identity to 0.88, soft knee, never above 0.985. */
function ceilingCurve(): Float32Array<ArrayBuffer> {
  const n = 8193, k = 0.88, c = 0.985;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
    const y = a <= k ? a : k + (c - k) * Math.tanh((a - k) / (c - k));
    out[i] = Math.sign(x) * y;
  }
  return out;
}

export class GameAudio {
  private _ctx: BaseAudioContext | null = null;
  private realtime = true;
  private everRan = false;
  private lastNow = 0;
  private stormPendingPerf = false;
  private rawT = -1;
  private rawPerf = 0;
  private lat = -1;
  private wantRunning = false;
  private muted = false;
  private volMusic = 0.7;
  private volSfx = 0.85;
  private n: Nodes | null = null;
  private assets = new Map<string, AudioBuffer>();
  private queue: string[] = [];
  private rendering = false;
  private failed = new Set<string>();
  private bedPref: MusicSource = 'polar';
  private bedWait = -1;       // ctx time until which startBase() waits for the Polar decode (−1 = not waiting)
  private polarLoading = false;
  private hwRate = 48000;     // context sample rate (the bar grid is defined on it)
  private lite = false;       // low-memory device (≤ 2 GB or iOS): long stems render at reduced rates
  private stormPrepared = false;
  private stormPromise: Promise<void> | null = null;
  private stormResolve: (() => void) | null = null;
  private releasePending = false;
  private gatePrepared = false;
  private gatePromise: Promise<void> | null = null;
  private gateResolve: (() => void) | null = null;
  private calm = false;
  private voices: Voice[] = [];
  private lastAt: Partial<Record<Sfx, number>> = {};
  private deferred: Deferred[] = [];
  private baseS: Session | null = null;
  private stormS: Session | null = null;
  private baseWanted = false;
  private stormPending = -1;  // startStorm() requested while the context was not running
  private baseLayers = 1;
  private stormX = 0;
  private inStorm = false;
  private duckReleaseAt = -1;
  private rr: Record<string, number> = {};
  private slamIdx = 0;
  private slamLast = -9;
  private lastWin = { level: 1, t: -9 };
  private anticip: Voice | null = null;
  private roll: Voice[] = [];
  private rattleV: Voice[] = [];
  private gestureArmed = false;
  private tap: AnalyserNode | null = null;
  /** Scheduler decisions (for QA); null disables logging. */
  schedLog: SchedLog[] | null = null;
  /** Asset ids actually voiced (for QA); null disables logging. */
  playLog: string[] | null = null;

  /** The live AudioContext (null before unlock()). */
  get ctx(): AudioContext | null {
    return this.realtime ? (this._ctx as AudioContext | null) : null;
  }

  // ================================================================ lifecycle
  /**
   * Call from the first user gesture (iOS-safe): creates the context synchronously inside the gesture,
   * starts a silent buffer, resumes, and kicks off background rendering of the BASE assets (storm assets
   * render on prepareStorm() / startStorm()). Resolves within
   * ~0.6 s even if the browser refuses to start audio (then it retries on the next gesture). Never throws.
   */
  async unlock(): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      if (!this._ctx) {
        const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
        const AC = w.AudioContext ?? w.webkitAudioContext;
        if (!AC) return;
        let c: AudioContext;
        try { c = new AC({ latencyHint: 'interactive' }); } catch { c = new AC(); }
        this._ctx = c;
        this.realtime = true;
        // Low-memory devices render long stems at reduced rates (see assets.ts). Safari has no
        // deviceMemory, so iOS/iPadOS counts as low-memory.
        const nav = navigator as Navigator & { deviceMemory?: number };
        const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
        this.hwRate = c.sampleRate;
        this.lite = (nav.deviceMemory ?? (ios ? 2 : 8)) <= 2;
        this.build(c);
        c.addEventListener('statechange', () => this.onState());
        setInterval(() => this.tick(), TICK_MS); // lives as long as the page (singleton)
        this.queue = baseAssetIds(this.bedPref);
        void this.pump();
      }
      const c = this._ctx as AudioContext;
      if (!this.realtime) return;
      this.wantRunning = true;
      this.kick(c);
      await Promise.race([c.resume().catch(noop), sleep(600)]);
      this.onState();
      if ((c.state as string) !== 'running') this.armGesture();
    } catch { /* never throw */ }
  }

  /** Pause audio (tab hidden). The audio clock freezes; now() holds still. */
  suspend(): void {
    const c = this._ctx;
    if (!c || !this.realtime) return;
    this.wantRunning = false;
    try { (c as AudioContext).suspend().catch(noop); } catch { /* */ }
  }

  /** Resume after suspend() (tab visible). If the OS refuses (iOS), retries on the next user gesture. */
  resume(): void {
    const c = this._ctx as AudioContext | null;
    if (!c || !this.realtime) return;
    this.wantRunning = true;
    try {
      c.resume().then(() => this.onState(), () => this.armGesture());
      setTimeout(() => { if (this.wantRunning && (c.state as string) !== 'running') this.armGesture(); }, 400);
    } catch { /* */ }
  }

  private onState(): void {
    const c = this._ctx as AudioContext | null;
    if (!c || !this.realtime) return;
    const st = c.state as string;
    if (st === 'running') {
      if (!this.everRan) {
        this.everRan = true;
        this.rawT = -1;
        this.lastNow = 0;
        // A downbeat requested on the pre-run performance clock → same moment on the audio clock.
        if (this.stormPending >= 0 && this.stormPendingPerf) this.stormPending -= perfNow() - c.currentTime;
        this.stormPendingPerf = false;
      }
      this.disarmGesture();
      if (this.stormPending >= 0) this.startStorm(Math.max(this.stormPending, this.now()));
      else if (this.baseWanted && !this.baseS && !this.stormS) this.startBase();
      this.syncBed();
    } else if (this.wantRunning && st !== 'closed') {
      // 'interrupted' (iOS call/Siri) or an OS suspend: try now, else on the next gesture.
      c.resume().catch(noop);
      this.armGesture();
    }
  }

  private kick(c: AudioContext): void {
    try {
      const b = c.createBuffer(1, 1, c.sampleRate);
      const s = c.createBufferSource();
      s.buffer = b;
      s.connect(c.destination);
      s.start(0);
    } catch { /* */ }
  }

  private readonly onGesture = (): void => {
    const c = this._ctx as AudioContext | null;
    if (!c || !this.wantRunning) return;
    this.kick(c);
    c.resume().then(() => this.onState(), noop);
  };
  private armGesture(): void {
    if (this.gestureArmed || typeof window === 'undefined') return;
    this.gestureArmed = true;
    for (const e of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(e, this.onGesture, { capture: true, passive: true });
  }
  private disarmGesture(): void {
    if (!this.gestureArmed) return;
    this.gestureArmed = false;
    for (const e of ['pointerdown', 'touchend', 'keydown', 'click']) window.removeEventListener(e, this.onGesture, { capture: true });
  }

  /** True when sound can actually be produced right now. */
  private live(): boolean {
    const c = this._ctx;
    if (!c || !this.n) return false;
    if (!this.realtime) return true;
    return this.everRan && (c as AudioContext).state === 'running';
  }

  // ================================================================ clock
  /**
   * Audio clock in seconds = AudioContext time. Before the context has ever run (no unlock yet, or the
   * browser refused to start audio) it is performance.now()/1000 so visual timelines keep moving; it
   * switches to ctx.currentTime once, when the context first runs (nothing is audio-anchored across
   * unlock in the game). While running it is extrapolated between audio callbacks (≤ 50 ms) so visuals
   * slaved to it move smoothly, and monotonic. Frozen while suspended.
   */
  now(): number {
    const c = this._ctx;
    if (!c || !this.everRan) return perfNow();
    if (!this.realtime) return c.currentTime;
    const raw = c.currentTime, p = perfNow();
    if (raw !== this.rawT) { this.rawT = raw; this.rawPerf = p; }
    const extra = (c as AudioContext).state === 'running' ? Math.min(Math.max(0, p - this.rawPerf), 0.05) : 0;
    let t = raw + extra;
    if (t < this.lastNow) t = this.lastNow; // extrapolation overshoot: hold, never step back
    this.lastNow = t;
    return t;
  }

  /** Output latency in seconds (base + hardware), smoothed. 0 before unlock. */
  latency(): number {
    const c = this._ctx as AudioContext | null;
    if (!c || !this.realtime || !this.everRan) return 0;
    const raw = clamp((c.baseLatency || 0) + (c.outputLatency || 0), 0, 0.5);
    this.lat = this.lat < 0 ? raw : this.lat + (raw - this.lat) * 0.05;
    return this.lat;
  }

  /** now()-domain → AudioContext time (identity once the context has run; kept for clarity). */
  toCtxTime(t: number): number { return t; }

  // ================================================================ graph
  private build(c: BaseAudioContext, bypassMaster = false): void {
    const G = (v = 1): GainNode => { const g = c.createGain(); g.gain.value = v; return g; };
    const master = G(this.muted ? 0 : 1);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 35; hp.Q.value = 0.707;
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -1; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
    const ceil = c.createWaveShaper();
    ceil.curve = ceilingCurve();
    ceil.oversample = 'none'; // identity below 0.88 → no aliasing unless it engages (rare); zero CPU
    if (bypassMaster) master.connect(c.destination); // QA timing probes only
    else master.connect(hp).connect(lim).connect(ceil).connect(c.destination);

    // Reverb: two convolvers, crossfaded on their SENDS so tails always ring out naturally and a silent
    // convolver idles. IRs are generated in code once; buffers are never swapped live.
    const verbIn = G(1);
    const vhp = c.createBiquadFilter(); vhp.type = 'highpass'; vhp.frequency.value = 240; vhp.Q.value = 0.6;
    const vlp = c.createBiquadFilter(); vlp.type = 'lowpass'; vlp.frequency.value = 9500; vlp.Q.value = 0.5;
    const sendBase = G(1), sendStorm = G(0);
    const convBase = c.createConvolver(), convStorm = c.createConvolver();
    convBase.normalize = false; convStorm.normalize = false;
    convBase.buffer = makeIR(c, { seconds: 3.4, rt60: 2.8, damp: 0.42, pre: 0.02, seed: 1, width: 1.15 });
    convStorm.buffer = makeIR(c, { seconds: 2.0, rt60: 1.6, damp: 0.32, pre: 0.008, seed: 2 });
    const verbOut = G(1);
    verbIn.connect(vhp).connect(vlp);
    vlp.connect(sendBase).connect(convBase).connect(verbOut);
    vlp.connect(sendStorm).connect(convStorm).connect(verbOut);
    verbOut.connect(master);

    const music = G(this.volMusic * this.volMusic), duck = G(1), dip = G(1);
    // music low-pass (setMusicFilter): at rest its cutoff sits at Nyquist, where the biquad is the identity
    const musicLP = c.createBiquadFilter();
    musicLP.type = 'lowpass'; musicLP.Q.value = 0.5; musicLP.frequency.value = c.sampleRate / 2;
    music.connect(musicLP).connect(duck).connect(dip).connect(master);
    dip.connect(G(dbToGain(SEND_DB.music))).connect(verbIn);

    const sv = this.volSfx * this.volSfx;
    const sfx = { dry: G(1), room: G(1), hall: G(1) } as Record<Verb, GainNode>;
    const sfxVol: GainNode[] = [];
    for (const k of ['dry', 'room', 'hall'] as Verb[]) {
      const v = G(sv);
      sfx[k].connect(v).connect(master);
      if (k !== 'dry') v.connect(G(dbToGain(SEND_DB[k]))).connect(verbIn);
      sfxVol.push(v);
    }
    const ui = G(1), uiVol = G(sv);
    ui.connect(uiVol).connect(master);
    uiVol.connect(G(dbToGain(SEND_DB.ui))).connect(verbIn);
    this.n = { master, out: ceil, music, musicLP, duck, dip, sfx, sfxVol, ui, uiVol, sendBase, sendStorm };
  }

  /** Post-limiter analyser for meters/QA (not connected to the output). */
  analyser(): AnalyserNode | null {
    if (!this._ctx || !this.n) return null;
    if (!this.tap) {
      this.tap = this._ctx.createAnalyser();
      this.tap.fftSize = 2048;
      this.tap.smoothingTimeConstant = 0.7;
      this.n.out.connect(this.tap);
    }
    return this.tap;
  }

  // ================================================================ asset pipeline
  private async pump(): Promise<void> {
    if (this.rendering || !this._ctx) return;
    this.rendering = true;
    try {
      while (this.queue.length) {
        const id = this.queue.shift()!;
        if (this.assets.has(id) || this.failed.has(id)) continue;
        if (id === POLAR_ID) { this.loadPolar(); continue; } // decodes off-thread; don't hold up the renders
        const storm = isStormAsset(id), gate = isGateAsset(id);
        if ((storm && !this.stormPrepared) || (gate && !this.gatePrepared)) continue; // released while queued
        if (BED_ASSETS.has(id) && !this.keepSet().has(id)) continue; // a layer of the bed nobody plays (any more)
        try {
          const b = await renderAsset(id, this.hwRate, { lite: this.lite });
          if ((!storm || this.stormPrepared) && (!gate || this.gatePrepared)) { // drop renders that finished after a release
            this.assets.set(id, b);
            this.onAsset(id);
          }
        } catch {
          this.failed.add(id);
        }
        if (storm) this.checkStormReady();
        if (gate) this.checkGateReady();
        if (this.realtime) await sleep(0); // yield: one small offline render per task
      }
    } finally {
      this.rendering = false;
    }
  }

  /** Move ids to the front of the render queue (asking for any storm/gate asset prepares that set). */
  private bump(ids: string[]): void {
    if (!this._ctx) return;
    if (!this.stormPrepared && ids.some(isStormAsset)) void this.prepareStorm();
    if (!this.gatePrepared && ids.some(isGateAsset)) void this.prepareGate();
    for (let i = ids.length - 1; i >= 0; i--) {
      const id = ids[i];
      if (this.assets.has(id) || this.failed.has(id)) continue;
      const k = this.queue.indexOf(id);
      if (k >= 0) this.queue.splice(k, 1);
      this.queue.unshift(id);
    }
    void this.pump();
  }

  private onAsset(id: string): void {
    if ((id === 'base0' || id === POLAR_ID) && this.baseWanted && !this.baseS) this.startBase();
    if (BED_ASSETS.has(id)) this.syncBed();
    if (this.live()) this.tick();
  }

  /** Decode the Polar Night bed (only while it is the chosen source); failure keeps the procedural bed. */
  private loadPolar(): void {
    if (this.polarLoading || !this._ctx || this.bedPref !== 'polar' || this.assets.has(POLAR_ID) || this.failed.has(POLAR_ID)) return;
    this.polarLoading = true;
    renderAsset(POLAR_ID, this.hwRate, { lite: this.lite }).then((b) => {
      this.polarLoading = false;
      if (this.bedPref === 'polar') { this.assets.set(POLAR_ID, b); this.onAsset(POLAR_ID); }
    }, () => {
      this.polarLoading = false;
      this.failed.add(POLAR_ID);
      this.onAsset(POLAR_ID);
    });
  }

  /**
   * Asset id of the bed startBase() should start on, or null while it is not ready (its render/decode
   * was requested). The Polar decode gets BED_WAIT seconds; after that (or if it failed) the base starts
   * on the procedural pad and crossfades to the recording once it arrives.
   */
  private bedFor(now: number): string | null {
    if (this.bedPref === 'polar' && !this.failed.has(POLAR_ID)) {
      if (this.assets.has(POLAR_ID)) return POLAR_ID;
      this.bump([POLAR_ID]);
      if (this.bedWait < 0) this.bedWait = now + BED_WAIT;
      if (now < this.bedWait) return null;
    }
    if (this.assets.has('base0')) return 'base0';
    this.bump(['base0']);
    return null;
  }

  /**
   * Keep a running base session on the chosen bed (live crossfade, together with the layers that follow the
   * bed's chords — once those that are audible are rendered); free the bed-dependent assets nothing uses.
   */
  private syncBed(): void {
    const s = this.baseS;
    if (s && !s.stopped && this.live()) {
      const want = this.bedPref === 'polar' && this.assets.has(POLAR_ID) ? POLAR_ID : 'base0';
      if (want !== s.ids[0] && this.assets.has(want)) {
        const need = baseLayerIds(want).slice(1, this.baseLayers);
        if (need.every((id) => this.assets.has(id) || this.failed.has(id))) this.switchBed(s, want, this._ctx!.currentTime);
        else this.bump(need);
      }
    }
    const keep = this.keepSet();
    for (const id of BED_ASSETS) if (!keep.has(id)) this.assets.delete(id);
  }

  /**
   * Bed-dependent assets worth holding: the chosen bed's layers, the procedural ones as the fallback until
   * the recording is decoded, and whatever the running base session plays.
   */
  private keepSet(): Set<string> {
    const rec = this.bedPref === 'polar' && !this.failed.has(POLAR_ID);
    const k = new Set(baseLayerIds(rec ? POLAR_ID : 'base0'));
    if (rec && !this.assets.has(POLAR_ID)) for (const id of baseLayerIds('base0')) k.add(id);
    const s = this.baseS;
    if (s && !s.stopped) for (const id of s.ids) k.add(id);
    return k;
  }

  /** Asset ids of the base layers: the running session's, else those of the bed it would start on. */
  private layerIds(): string[] {
    const s = this.baseS;
    if (s && !s.stopped) return s.ids;
    return baseLayerIds(this.bedPref === 'polar' && !this.failed.has(POLAR_ID) ? POLAR_ID : 'base0');
  }

  /**
   * Switch a base session to `bed`: every layer whose asset differs (the bed, and the layers that follow its
   * chords) crossfades, started at once but phase-locked to the grid. A layer whose new asset is not
   * rendered yet goes quiet and is attached on a bar line when it arrives.
   */
  private switchBed(s: Session, bed: string, now: number): void {
    const c = this._ctx!, ids = baseLayerIds(bed);
    const t = Math.max(now + 0.03, s.start);
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] === s.ids[i]) continue;
      const old = s.src[i], og = s.sg[i]!;
      og.gain.cancelScheduledValues(t);
      og.gain.setTargetAtTime(0, t, BED_TAU);
      if (old) {
        try { old.stop(t + BED_TAU * 10); } catch { /* */ }
        old.addEventListener('ended', () => { try { og.disconnect(); } catch { /* */ } });
      } else {
        try { og.disconnect(); } catch { /* */ }
      }
      const g = c.createGain();
      g.gain.value = old ? 0 : 1;
      g.connect(s.layers[i]);
      if (old) g.gain.setTargetAtTime(1, t, BED_TAU);
      s.sg[i] = g;
      s.ids[i] = ids[i];
      const buf = this.assets.get(ids[i]);
      s.src[i] = buf ? this.loopSrc(s, buf, g, t) : null;
    }
  }

  // ================================================================ scheduler
  /** Look-ahead service: attach late stems, apply layer changes on the next bar line, flush deferred SFX. */
  tick(): void {
    const c = this._ctx;
    if (!c || !this.live()) return;
    try {
      const now = c.currentTime;
      if (this.baseWanted && !this.baseS && !this.stormS && this.bedWait >= 0 && now >= this.bedWait) this.startBase();
      if (this.baseS) this.service(this.baseS, now, (i) => i < this.baseLayers);
      if (this.stormS) this.service(this.stormS, now, (i) => this.stormX >= STORM_AT[i]);
      if (this.duckReleaseAt >= 0 && this.duckReleaseAt < now) this.duckReleaseAt = -1;
      for (let i = this.deferred.length - 1; i >= 0; i--) {
        const d = this.deferred[i];
        if (d.t < now - 0.03) { this.deferred.splice(i, 1); continue; }
        const buf = this.assets.get(d.id);
        if (!buf) continue;
        this.deferred.splice(i, 1);
        this.voice(d.name, buf, Math.max(d.t, now), d.rate, d.amp, d.pan);
      }
    } catch { /* never throw from the timer */ }
  }

  private newSession(kind: 'base' | 'storm', start: number, bed = 'base0'): Session {
    const c = this._ctx!;
    const ids = kind === 'base' ? baseLayerIds(bed) : STORM_IDS.slice();
    const bpm = kind === 'base' ? BASE_BPM : STORM_BPM;
    const group = c.createGain();
    group.gain.value = 0;
    group.connect(this.n!.music);
    const layers = ids.map(() => { const g = c.createGain(); g.gain.value = 0; g.connect(group); return g; });
    const sg = layers.map((l) => { if (kind !== 'base') return null; const g = c.createGain(); g.connect(l); return g; });
    return {
      kind, ids, group, layers, src: ids.map(() => null), start,
      bar: barFrames(bpm, this.hwRate) / this.hwRate, // identical for every render divisor
      committed: ids.map(() => false), pendAt: ids.map(() => -1), pendOn: ids.map(() => false),
      stopped: false, alive: 0, sg,
    };
  }

  /** Start any rendered-but-unattached stems of a session, phase-locked, on a bar line. */
  private attach(s: Session, now: number): void {
    for (let i = 0; i < s.ids.length; i++) {
      if (s.src[i]) continue;
      const buf = this.assets.get(s.ids[i]);
      if (!buf) continue;
      let t = s.start;
      if (now + 0.03 > s.start) t = s.start + Math.ceil((now + 0.03 - s.start) / s.bar) * s.bar;
      s.src[i] = this.loopSrc(s, buf, s.sg[i] ?? s.layers[i], t);
    }
  }

  /** Looping source started at `t` (≥ s.start) at its phase on the session grid. */
  private loopSrc(s: Session, buf: AudioBuffer, dest: AudioNode, t: number): AudioBufferSourceNode {
    const src = this._ctx!.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(dest);
    src.start(t, ((t - s.start) % buf.duration + buf.duration) % buf.duration);
    s.alive++;
    src.onended = () => {
      if (--s.alive <= 0 && s.stopped) { try { s.group.disconnect(); } catch { /* */ } }
    };
    return src;
  }

  private service(s: Session, now: number, want: (i: number) => boolean): void {
    if (s.stopped) return;
    this.attach(s, now);
    const k = Math.max(0, Math.ceil((now + 0.004 - s.start) / s.bar));
    const b = s.start + k * s.bar;
    if (b - now > HORIZON) return;
    for (let i = 0; i < s.ids.length; i++) {
      if (s.pendAt[i] >= 0 && s.pendAt[i] <= now) { s.committed[i] = s.pendOn[i]; s.pendAt[i] = -1; }
      const w = want(i);
      const cur = s.pendAt[i] >= 0 ? s.pendOn[i] : s.committed[i];
      if (w === cur) continue;
      const g = s.layers[i].gain;
      if (s.pendAt[i] >= 0) {
        if (s.pendAt[i] - now < 0.035) continue; // too late to revoke; next bar decides
        g.cancelScheduledValues(s.pendAt[i] - 0.035);
        s.pendAt[i] = -1;
        this.schedLog?.push({ t: now, kind: s.kind, layer: i, on: s.committed[i], at: -1 });
        if (w === s.committed[i]) continue;
      }
      if (b - now < 0.035) continue;
      g.cancelScheduledValues(b - 0.035);
      if (w) g.setTargetAtTime(1, b - 0.03, 0.012);
      else g.setTargetAtTime(0, b, 0.35);
      s.pendAt[i] = b;
      s.pendOn[i] = w;
      this.schedLog?.push({ t: now, kind: s.kind, layer: i, on: w, at: b });
    }
  }

  private stopSession(s: Session, t: number, dur: number): void {
    if (s.stopped) return;
    s.stopped = true;
    const g = s.group.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, Math.max(0.01, dur / 4));
    const end = t + dur * 2 + 0.05;
    for (const src of s.src) if (src) { try { src.stop(end); } catch { /* */ } }
    if (s.alive === 0) { try { s.group.disconnect(); } catch { /* */ } }
  }

  private xfadeVerb(to: 'base' | 'storm', t: number, dur: number): void {
    const n = this.n!;
    for (const [p, v] of [[n.sendBase.gain, to === 'base' ? 1 : 0], [n.sendStorm.gain, to === 'storm' ? 1 : 0]] as const) {
      p.cancelScheduledValues(t);
      p.setTargetAtTime(v, t, dur / 3);
    }
  }

  /** Release duck() and any held win/summary dip. */
  private releaseDuck(t: number, tau: number): void {
    for (const p of [this.n!.duck.gain, this.n!.dip.gain]) {
      p.cancelScheduledValues(t);
      p.setTargetAtTime(1, t, tau);
    }
  }

  private musicDip(db: number, hold: number, release: number): void {
    const c = this._ctx!, p = this.n!.dip.gain, now = c.currentTime;
    p.cancelScheduledValues(now);
    p.setTargetAtTime(dbToGain(db), now, 0.05);
    p.setTargetAtTime(1, now + hold, release / 3);
  }

  // ================================================================ storm assets (lazy)
  /**
   * Render the storm set in the background (idempotent). Resolves when the storm core loop + the
   * cinematic one-shots are ready (or failed); the later storm layers/stingers keep rendering after that.
   * Before unlock() it resolves immediately (nothing to render yet). startStorm() calls this itself.
   */
  prepareStorm(): Promise<void> {
    if (!this._ctx) return Promise.resolve();
    this.releasePending = false;
    if (!this.stormPrepared || !this.stormPromise) {
      this.stormPrepared = true;
      this.stormPromise = new Promise<void>((r) => { this.stormResolve = r; });
      this.bump(STORM_CORE);
      for (const id of STORM_EXTRA) if (!this.assets.has(id) && !this.queue.includes(id)) this.queue.push(id);
      void this.pump();
    }
    this.checkStormReady();
    return this.stormPromise;
  }

  private checkStormReady(): void {
    if (!this.stormResolve) return;
    if (STORM_CORE.every((id) => this.assets.has(id) || this.failed.has(id))) {
      const r = this.stormResolve;
      this.stormResolve = null;
      r();
    }
  }

  /**
   * Free the storm set (call after the storm outro). If a storm is still playing the release happens
   * when it stops. Buffers still held by voices that are fading out are freed when those voices end.
   */
  releaseStorm(): void {
    if (!this._ctx) return;
    if (this.stormS || this.stormPending >= 0) { this.releasePending = true; return; }
    this.releasePending = false;
    this.stormPrepared = false;
    this.stormPromise = null;
    if (this.stormResolve) { const r = this.stormResolve; this.stormResolve = null; r(); }
    this.queue = this.queue.filter((id) => !isStormAsset(id));
    this.deferred = this.deferred.filter((d) => !isStormAsset(d.id));
    for (const id of [...STORM_CORE, ...STORM_EXTRA]) { this.assets.delete(id); this.failed.delete(id); }
  }

  // ================================================================ gate assets (lazy)
  /**
   * Render the gate ceremony's set in the background (idempotent): gateDrone, tileShimmer, keystone,
   * sealCrack, gateBreath, lightPad. Resolves when all six are ready (or failed); before unlock() at once.
   * Call when the Terningekammeret opens and when a ceremony is requested (race it against ~2 s). A gate
   * sound played before it is ready renders on demand and, if scheduled ahead, plays when it lands in time.
   */
  prepareGate(): Promise<void> {
    if (!this._ctx) return Promise.resolve();
    if (!this.gatePrepared || !this.gatePromise) {
      this.gatePrepared = true;
      this.gatePromise = new Promise<void>((r) => { this.gateResolve = r; });
      this.bump(GATE_SET);
    }
    this.checkGateReady();
    return this.gatePromise;
  }

  private checkGateReady(): void {
    if (!this.gateResolve) return;
    if (GATE_SET.every((id) => this.assets.has(id) || this.failed.has(id))) {
      const r = this.gateResolve;
      this.gateResolve = null;
      r();
    }
  }

  /**
   * Free the gate set (after the ceremony, or when the chamber closes; ~7 MB). Voices still sounding keep
   * their buffers until they end; a pending prepareGate() resolves.
   */
  releaseGate(): void {
    if (!this._ctx) return;
    this.gatePrepared = false;
    this.gatePromise = null;
    if (this.gateResolve) { const r = this.gateResolve; this.gateResolve = null; r(); }
    this.queue = this.queue.filter((id) => !isGateAsset(id));
    this.deferred = this.deferred.filter((d) => !isGateAsset(d.id));
    for (const id of GATE_SET) { this.assets.delete(id); this.failed.delete(id); }
  }

  /**
   * Terningen's throw: a dice rattle of `count` glass ticks, `every` seconds apart from `when` (now()-domain), the
   * existing dieLand / dieHold voices alternating at ONE constant pitch (playbackRate 1) and a constant tempo; only the
   * level (±1 dB) and the pan move, like the count-up roll. Never escalating. Silent before unlock or before the dice
   * set is rendered. Calm: CALM_GAIN.
   */
  rattle(when: number, count: number, every: number, gain = 1): void {
    if (this.muted || !this.live()) return;
    try {
      const land = this.assets.get('dieLand'), hold = this.assets.get('dieHold');
      if (!land || !hold) { this.bump(['dieLand', 'dieHold']); return; }
      const c = this._ctx!, now = c.currentTime;
      const t0 = Math.max(now, this.toCtxTime(when));
      this.stopRattle();
      const k = this.calm ? CALM_GAIN : 1;
      for (let i = 0; i < count; i++) {
        const odd = i % 2 === 1;
        const cfg = odd ? CFG.dieHold : CFG.dieLand;
        const amp = dbToGain(cfg.db) * gain * k * (odd ? 0.8 : 0.55) * this.jdb(1);
        const v = this.voice(odd ? 'dieHold' : 'dieLand', odd ? hold : land, t0 + i * every, 1, amp, (odd ? 0.18 : -0.18) + (crand() - 0.5) * 0.2);
        if (v) this.rattleV.push(v);
      }
    } catch { /* never throw */ }
  }
  /** Cancel a rattle's ticks that have not sounded yet. */
  stopRattle(): void {
    const c = this._ctx;
    if (!c || !this.n) return;
    const now = c.currentTime;
    for (const v of this.rattleV) if (!v.dead && v.t > now) this.fadeVoice(v, now, 0.004);
    this.rattleV = [];
  }

  /** Stop the celebration count-up tick roll immediately (skipped celebration). */
  stopCount(): void {
    const c = this._ctx;
    if (!c || !this.n) return;
    const now = c.currentTime;
    for (const v of this.roll) if (!v.dead) this.fadeVoice(v, now, 0.004);
    this.roll = [];
  }

  // ================================================================ music API
  /** Start the base bed (idempotent). Fades in from bar 1; stops a running storm. */
  startBase(): void {
    if (!this._ctx) return;                                   // before unlock(): silent no-op
    if (!this.live()) { if (!this.stormS) this.baseWanted = true; return; } // starts once running
    this.baseWanted = true;
    try {
      if (this.stormS) this.stopStorm();
      if (this.baseS && !this.baseS.stopped) return;
      const c = this._ctx!, now = c.currentTime;
      const bed = this.bedFor(now);
      if (!bed) return; // starts when the bed is rendered/decoded (onAsset, or tick() after BED_WAIT)
      const S = now + 0.08;
      const s = this.baseS = this.newSession('base', S, bed);
      for (let i = 0; i < s.ids.length; i++) {
        const on = i < this.baseLayers;
        s.layers[i].gain.setValueAtTime(on ? 1 : 0, S);
        s.committed[i] = on;
      }
      s.group.gain.setValueAtTime(0, now);
      s.group.gain.setTargetAtTime(1, S, 0.7);
      this.attach(s, now);
      this.duckReleaseAt = -1;
      this.releaseDuck(S, 0.15);
      this.xfadeVerb('base', now, 2.5);
      this.inStorm = false;
      this.bump(s.ids.slice(0, this.baseLayers));
    } catch { /* */ }
  }

  /** Target number of base layers (1..5). Changes land on the next bar line; rapid calls collapse. */
  setBaseLayers(n: number): void {
    const v = clamp(Math.round(Number.isFinite(n) ? n : 1), 1, 5);
    this.baseLayers = v;
    if (!this.live()) return;
    this.bump(this.layerIds().slice(0, v));
    this.tick();
  }

  /**
   * Base bed source (setting "Musik"): the Polar Night recording or the procedural pad. A running base
   * crossfades (~1 s, phase-locked) as soon as the chosen bed and its audible layers are ready — under the
   * recording the bells, bass and ostinato follow its chords (base1p/2p/4p), under the pad its cycle;
   * choosing 'code' frees the decoded recording and its layers, choosing 'polar' decodes it again.
   */
  setMusicSource(src: MusicSource): void {
    const v: MusicSource = src === 'code' ? 'code' : 'polar';
    if (v === this.bedPref) return;
    this.bedPref = v;
    this.bedWait = -1;
    if (!this._ctx) return;
    const ids = baseLayerIds(v === 'polar' ? POLAR_ID : 'base0');
    this.bump(ids.slice(0, this.baseLayers));
    for (const id of ids) if (!this.assets.has(id) && !this.queue.includes(id)) this.queue.push(id);
    void this.pump();
    this.syncBed();
  }

  /**
   * Start the 140 BPM storm loop exactly at `atCtxTime` (now()-domain; the cinematic downbeat).
   * Also fades the base bed out, releases any duck() at the downbeat and crossfades to the storm reverb.
   */
  startStorm(atCtxTime: number): void {
    if (!this._ctx) return;
    if (!this.live()) {
      this.stormPending = Number.isFinite(atCtxTime) ? atCtxTime : 0;
      this.stormPendingPerf = !this.everRan;
      void this.prepareStorm();
      this.inStorm = true;
      this.baseWanted = false;
      return;
    }
    this.stormPending = -1;
    try {
      const c = this._ctx!, now = c.currentTime;
      let S = this.toCtxTime(atCtxTime);
      if (!(S > now + 0.01)) S = now + 0.01;
      if (this.stormS && !this.stormS.stopped) {
        if (this.stormS.start <= now + 0.02) return;   // already running
        this.stopSession(this.stormS, now, 0.01);        // downbeat not reached yet: move it
        this.stormS = null;
      }
      this.bump(STORM_CINE);
      this.inStorm = true;
      this.stormX = 0;
      this.baseWanted = false;
      const s = this.stormS = this.newSession('storm', S);
      s.layers[0].gain.setValueAtTime(1, S);
      s.committed[0] = true;
      s.group.gain.setValueAtTime(1, S);
      this.attach(s, now);
      if (this.baseS) { this.stopSession(this.baseS, now, clamp(S - now, 0.15, 1.5)); this.baseS = null; }
      this.duckReleaseAt = S;
      const d = this.n!.duck.gain;
      d.cancelScheduledValues(S);
      d.setValueAtTime(1, S);
      this.xfadeVerb('storm', now, 1.5);
    } catch { /* */ }
  }

  /** Storm intensity = current max mark: stabs at ≥ ×8, double-time hats at ≥ ×32, choir at ≥ ×128. */
  stormLevel(x: number): void {
    this.stormX = Number.isFinite(x) ? x : 0;
    if (!this.live()) return;
    this.bump(STORM_IDS.filter((_, i) => this.stormX >= STORM_AT[i]));
    this.tick();
  }

  /** Fade the storm out (~2 s) and return to the base reverb. Call startBase() afterwards. */
  stopStorm(): void {
    this.inStorm = false;
    this.stormPending = -1;
    try {
      const s = this.stormS;
      if (s && this._ctx) {
        const now = this._ctx.currentTime;
        // Running: musical 2 s fade. Suspended/interrupted: stop at once (nothing is audible anyway).
        this.stopSession(s, now, this.live() ? 2.2 : 0.02);
        this.stormS = null;
        this.duckReleaseAt = -1;
        this.releaseDuck(now, 0.15);
        this.xfadeVerb('base', now, 2.5);
      }
    } catch { /* */ }
    if (this.releasePending) this.releaseStorm();
  }

  /**
   * Duck the music bus to `db` (≤ 0), reaching it with time `seconds`. The duck holds until the next
   * transport event releases it — the startStorm() downbeat (even if scheduled before this call),
   * startBase(), stopStorm() — or until duck(0, s). Win stingers/summary dip the music by themselves.
   */
  duck(db: number, seconds: number): void {
    if (!this.live()) return;
    try {
      const c = this._ctx!, now = c.currentTime;
      const target = dbToGain(clamp(Number.isFinite(db) ? db : 0, -80, 0));
      const tc = Math.max(0.004, (Number.isFinite(seconds) ? seconds : 0.1) / 3);
      const p = this.n!.duck.gain;
      p.cancelScheduledValues(now);
      p.setTargetAtTime(target, now, tc);
      if (this.duckReleaseAt > now) p.setValueAtTime(1, this.duckReleaseAt);
    } catch { /* */ }
  }

  /**
   * Low-pass the music bus (music → musicLP → duck → dip; SFX untouched) to `hz` (clamped 200 Hz … 20 kHz;
   * 20 kHz = open, exactly transparent), gliding in log-frequency so it arrives in `seconds`. Holds until
   * the next call: nothing releases it by itself. Terningekammeret: 4500 on open, 20000 on close (none in
   * the open state after the unlock); the gate ceremony: 900 in bar 1, 20000 from bar 5; skip: 20000 in 0.3 s.
   */
  setMusicFilter(hz: number, seconds: number): void {
    const c = this._ctx;
    if (!c || !this.n) return;
    try {
      const now = c.currentTime, nyq = c.sampleRate / 2, p = this.n.musicLP.frequency;
      const h = clamp(Number.isFinite(hz) ? hz : 20000, 200, 20000);
      const f = h >= 20000 ? nyq : Math.min(h, nyq);
      const d = Math.max(0.005, Number.isFinite(seconds) ? seconds : 0.1);
      const hold = (p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam }).cancelAndHoldAtTime;
      if (typeof hold === 'function') hold.call(p, now);
      else { const v = p.value; p.cancelScheduledValues(now); p.setValueAtTime(v, now); }
      p.exponentialRampToValueAtTime(f, now + d);
    } catch { /* */ }
  }

  /**
   * Fade every voice of `name` (sounding, or scheduled and not started) to silence: −35 dB after `seconds`,
   * stopped after 2×. The gate drone and light pad on a skip (0.3 s) and at the ceremony end (4 s).
   */
  fadeOut(name: Sfx, seconds: number): void {
    const c = this._ctx;
    if (!c || !this.n) return;
    try {
      const now = c.currentTime, tau = Math.max(0.002, (Number.isFinite(seconds) ? seconds : 0.3) / 4);
      for (const v of this.voices) if (!v.dead && v.name === name) this.fadeVoice(v, now, tau);
      this.deferred = this.deferred.filter((d) => d.name !== name);
    } catch { /* */ }
  }

  /** Calm mode: every dice and gate sound plays at CALM_GAIN (−3 dB). Callers never apply it themselves. */
  setCalm(on: boolean): void { this.calm = !!on; }

  /**
   * First bar line of the running music at or after `t` (now()-domain), or `t` itself when no music runs.
   * The gate ceremony's T0 = nextBar(now() + 0.9): it rides the loop, bar 1 of the ceremony on a bar line.
   */
  nextBar(t: number): number {
    const s = this.stormS ?? this.baseS;
    if (!s || s.stopped || !Number.isFinite(t)) return t;
    return s.start + Math.max(0, Math.ceil((t - s.start) / s.bar - 1e-9)) * s.bar;
  }

  setMuted(b: boolean): void {
    this.muted = !!b;
    if (!this.n || !this._ctx) return;
    try {
      const p = this.n.master.gain;
      const now = this._ctx.currentTime;
      p.cancelScheduledValues(now);
      p.setTargetAtTime(this.muted ? 0 : 1, now, 0.015);
    } catch { /* */ }
  }

  /** Settings sliders 0..1 (perceptual: gain = v²). */
  setVolumes(music: number, sfx: number): void {
    this.volMusic = clamp(Number.isFinite(music) ? music : 0.7, 0, 1);
    this.volSfx = clamp(Number.isFinite(sfx) ? sfx : 0.85, 0, 1);
    if (!this.n || !this._ctx) return;
    try {
      const now = this._ctx.currentTime;
      const set = (p: AudioParam, v: number) => { p.cancelScheduledValues(now); p.setTargetAtTime(v, now, 0.03); };
      set(this.n.music.gain, this.volMusic * this.volMusic);
      const s = this.volSfx * this.volSfx;
      for (const v of this.n.sfxVol) set(v.gain, s);
      set(this.n.uiVol.gain, s);
    } catch { /* */ }
  }

  // ================================================================ SFX
  /** Fire-and-forget SFX. `when` (now()-domain) schedules sample-accurately. Silent no-op before unlock. */
  play(name: Sfx, opts: PlayOpts = {}): void {
    if (name === 'countTick' && opts.level === 0) { this.stopCount(); return; } // skip → stop the roll
    if (this.muted || !this.live()) return;
    try { this.playImpl(name, opts); } catch { /* never throw */ }
  }

  private jit(cents: number): number { return cents ? Math.pow(2, ((crand() * 2 - 1) * cents) / 1200) : 1; }
  private jdb(db: number): number { return db ? dbToGain((crand() * 2 - 1) * db) : 1; }
  private next(key: string, n: number): number { const v = ((this.rr[key] ?? -1) + 1) % n; this.rr[key] = v; return v; }

  private playImpl(name: Sfx, o: PlayOpts): void {
    const cfg = CFG[name];
    if (!cfg) return;
    const c = this._ctx!, now = c.currentTime;
    let t = o.when !== undefined && Number.isFinite(o.when) ? this.toCtxTime(o.when) : now;
    if (t < now) { if (t < now - 0.3) return; t = now; }
    if (t > now + 60) return;
    const last = this.lastAt[name];
    if (last !== undefined && Math.abs(t - last) < cfg.gap) return;
    this.lastAt[name] = t;
    const og = o.gain ?? 1;
    if (!(og > 0)) return;
    let id: string = name, rate = this.jit(cfg.cents), db = cfg.db, pn = 0;

    switch (name) {
      case 'land': {
        const table = this.landTable(t);
        const col = clamp(Math.round(o.col ?? 0), 0, table.length - 1);
        const m = table[col];
        const z = nearestZone(m, LAND_ZONES);
        id = `land${z}${this.next('land', 2) ? 'b' : 'a'}`;
        rate *= Math.pow(2, (m - z) / 12);
        pn = (col / (table.length - 1) - 0.5) * 0.7;
        break;
      }
      case 'chime': {
        const m = CHIME_LADDER[clamp(Math.round(o.step ?? 0), 0, CHIME_LADDER.length - 1)];
        const z = nearestZone(m, CHIME_ZONES);
        id = `chime${z}`;
        rate *= Math.pow(2, (m - z) / 12);
        pn = (crand() - 0.5) * 0.25;
        break;
      }
      case 'shatter':
        id = `shatter${this.next('shatter', 3)}`;
        rate *= Math.pow(2, (clamp(o.step ?? 0, 0, 6) * 0.5) / 12);
        pn = (crand() - 0.5) * 0.7;
        break;
      case 'spin': id = `spin${this.next('spin', 3)}`; break;
      case 'returnTick': id = `returnTick${this.next('rt', 2)}`; break;
      case 'mote': id = `mote${this.next('mote', 2)}`; pn = (crand() - 0.5) * 1.0; break;
      case 'markUp': rate *= Math.pow(2, clamp(Math.round(o.level ?? 1), 0, 12) / 12); pn = (crand() - 0.5) * 0.4; break;
      case 'levelUp': {
        const L = clamp(Math.round(o.level ?? 1), 1, LEVEL_SEMIS.length - 1);
        const semis = LEVEL_SEMIS[L];
        const z = semis <= 7 ? 62 : 74;
        id = `levelUp${z}`;
        rate *= Math.pow(2, (62 + semis - z) / 12);
        this.musicDip(-3, 1.2, 1.0);
        break;
      }
      case 'sun': {
        const L = clamp(Math.round(o.level ?? 1), 1, 6);
        id = `sun${Math.min(3, L)}`;
        if (L > 3) rate *= Math.pow(2, [0, 5, 7, 12][L - 3] / 12);
        db -= (3 - Math.min(3, L)) * 1.5;
        break;
      }
      case 'anticipation':
        if (this.anticip && !this.anticip.dead) this.fadeVoice(this.anticip, t, 0.06);
        break;
      case 'countTick':
        this.countRoll(t, og);
        return;
      case 'win': {
        const L = clamp(Math.round(o.level ?? 1), 1, 5);
        if (L >= 3) { this.lastAt.bigWin = undefined; this.playImpl('bigWin', { ...o, level: L }); return; }
        this.lastWin = { level: L, t };
        if (this.inStorm) { id = 'stormWin'; db -= 3; this.musicDip(-8, 2.2, 1.2); break; }
        id = L === 1 ? `win1${this.next('win1', 2) ? 'b' : 'a'}` : 'win2';
        if (L === 1) db -= 2;
        if (L === 2) this.musicDip(-4, 1.2, 1.0);
        break;
      }
      case 'bigWin': {
        const L = clamp(Math.round(o.level ?? 3), 3, 5);
        id = this.inStorm ? 'stormWin' : `bigWin${L}`;
        db += (L - 3) * 1;
        this.lastWin = { level: L, t };
        this.musicDip(this.inStorm ? -9 : -7, 1.6 + (L - 3) * 0.8, 1.4);
        break;
      }
      case 'letterSlam':
        if (t >= this.slamLast && t - this.slamLast < 0.15) this.slamIdx++; else this.slamIdx = 0;
        this.slamLast = t;
        id = `letterSlam${this.slamIdx % 2}`;
        rate *= Math.pow(2, Math.min(this.slamIdx, 11) / 12);
        break;
      case 'stormSwell':
        // "The storm is coming": the base bed recedes under the swell (the calm cinematic has no duck).
        if (this.baseS) { this.stopSession(this.baseS, t, 1.6); this.baseS = null; }
        this.baseWanted = false;
        break;
      // Summary card waits for "Fortsæt": the storm loop steps back and stays back until stopStorm().
      case 'summary': this.musicDip(-6, 600, 1.2); break;
      case 'bell1948': { // the year motif: level 1–4 = 1-9-4-8 = D3 E4 G3 D4, 5–8 the same an octave up
        const L = clamp(Math.round(o.level ?? 1), 1, 8);
        const [z, semis] = BELL_1948[(L - 1) % 4];
        id = `bell1948${z}`;
        rate *= Math.pow(2, (semis + (L > 4 ? 12 : 0)) / 12);
        break;
      }
      default: break;
    }

    const amp = dbToGain(db) * og * this.jdb(cfg.jdb) * (this.calm && DICE_SFX.has(name) ? CALM_GAIN : 1);
    const buf = this.assets.get(id);
    if (!buf) {
      // Not rendered yet: render it next; if it was scheduled ahead, play it when it lands in time.
      this.bump([id]);
      if (t > now + 0.03 && this.deferred.length < 64) this.deferred.push({ name, id, t, rate, amp, pan: pn });
      return;
    }
    const v = this.voice(name, buf, t, rate, amp, pn);
    this.playLog?.push(id);
    if (name === 'anticipation') this.anticip = v;
  }

  private landTable(t: number): number[] {
    const S = this.stormS, B = this.baseS;
    if (this.inStorm) {
      const k = S && t >= S.start ? Math.floor((t - S.start) / S.bar + 0.06) : 0;
      return LAND_STORM[k % 4];
    }
    const k = B && !B.stopped && t >= B.start ? Math.floor((t - B.start) / B.bar + 0.06) : 0;
    return LAND_BASE[k % 4];
  }

  /** Count-up roll: soft ticks spaced like the celebration's counter easing, ≥ 40 ms apart, ≤ 2.4 s. */
  private countRoll(t: number, og: number): void {
    const buf = this.assets.get('countTick');
    if (!buf) { this.bump(['countTick']); return; }
    const now = this._ctx!.currentTime;
    for (const v of this.roll) if (!v.dead && v.t > now) this.fadeVoice(v, now, 0.005);
    this.roll = [];
    const L = this.lastWin.t > t - 2.5 ? this.lastWin.level : 1;
    const D = Math.max(0.6, (TIER_SECS[L] ?? 1) - 0.4);
    const expo = L >= 3;
    const cfg = CFG.countTick;
    const N = 26;
    let prev = -1;
    for (let k = 0; k <= N; k++) {
      const x = k / N;
      const u = expo ? Math.min(1, -Math.log2(1 - x * 0.999) / 10) : 1 - Math.sqrt(1 - x);
      const dt = u * D;
      if (dt > Math.min(D, 2.4)) break;
      if (prev >= 0 && dt - prev < cfg.gap) continue;
      prev = dt;
      const amp = dbToGain(cfg.db) * og * (1 - 0.45 * x) * this.jdb(cfg.jdb);
      const v = this.voice('countTick', buf, t + dt, this.jit(cfg.cents) * (1 + 0.22 * x), amp, (crand() - 0.5) * 0.3);
      if (v) this.roll.push(v);
    }
  }

  private voice(name: Sfx, buf: AudioBuffer, t: number, rate: number, amp: number, pn: number): Voice | null {
    const c = this._ctx!, n = this.n!;
    const cfg = CFG[name];
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = amp;
    src.connect(g);
    let tail: AudioNode = g;
    if (pn !== 0) {
      const p = c.createStereoPanner();
      p.pan.value = clamp(pn, -1, 1);
      g.connect(p);
      tail = p;
    }
    tail.connect(cfg.ui ? n.ui : n.sfx[cfg.verb]);
    src.start(t);
    const v: Voice = { src, g, name, t, end: t + buf.duration / rate, dead: false };
    this.voices.push(v);
    src.onended = () => {
      v.dead = true;
      const k = this.voices.indexOf(v);
      if (k >= 0) this.voices.splice(k, 1);
      try { tail.disconnect(); } catch { /* */ }
    };
    // voice caps: per name, then global (steal oldest). Only voices that sound while this one does count
    // (a motif scheduled ahead with `when` is not a pile-up), and a stolen voice stops when this one starts.
    const from = Math.max(c.currentTime, t);
    let same = 0, all = 0;
    for (let i = this.voices.length - 1; i >= 0; i--) {
      const w = this.voices[i];
      if (w.dead || w.end < from || w.t > v.end) continue;
      all++;
      if (w.name === name) same++;
      if ((w.name === name && same > cfg.max) || all > MAX_VOICES) this.fadeVoice(w, Math.max(from, w.t), 0.01);
    }
    return v;
  }

  private fadeVoice(v: Voice, t: number, tau: number): void {
    if (v.dead) return;
    v.dead = true;
    try {
      const at = Math.max(t, this._ctx!.currentTime);
      v.g.gain.cancelScheduledValues(at);
      v.g.gain.setTargetAtTime(0, at, tau);
      v.src.stop(at + tau * 8);
    } catch { /* */ }
  }

  /**
   * Extra (not in the contract): silence every SFX that was scheduled with `when` but has not started
   * yet — e.g. when a cinematic is skipped. Follow with startStorm(newDownbeat) to move the downbeat.
   */
  cancelScheduled(): void {
    const c = this._ctx;
    if (!c) return;
    const now = c.currentTime;
    for (const v of this.voices) if (!v.dead && v.t > now + 0.005) this.fadeVoice(v, now, 0.005);
    this.deferred.length = 0;
  }

  // ================================================================ QA / harness
  /**
   * Runtime stats for harness/QA (mb = all rendered buffers; stormMb / gateMb = the lazy sets' share of it;
   * total = what the pipeline holds when done: the chosen bed's base set + the prepared lazy sets).
   */
  stats(): { state: string; sampleRate: number; lite: boolean; rendered: number; total: number; failed: number; mb: number; stormMb: number; stormPrepared: boolean; gateMb: number; gatePrepared: boolean; voices: number; base: boolean; storm: boolean; layers: number; stormX: number; bed: string | null; bedMb: number } {
    let bytes = 0, storm = 0, gate = 0;
    for (const [id, b] of this.assets) {
      const n = b.length * b.numberOfChannels * 4;
      bytes += n;
      if (isStormAsset(id)) storm += n;
      if (isGateAsset(id)) gate += n;
    }
    const keep = this.keepSet();
    const total = baseAssetIds(this.bedPref).filter((id) => !BED_ASSETS.has(id) || keep.has(id)).length
      + (this.stormPrepared ? STORM_CORE.length + STORM_EXTRA.length : 0) + (this.gatePrepared ? GATE_SET.length : 0);
    const pb = this.assets.get(POLAR_ID);
    return {
      state: this._ctx ? (this.realtime ? ((this._ctx as AudioContext).state as string) : 'offline') : 'locked',
      sampleRate: this._ctx?.sampleRate ?? 0, lite: this.lite,
      rendered: this.assets.size, total, failed: this.failed.size, mb: bytes / 1048576, stormMb: storm / 1048576,
      stormPrepared: this.stormPrepared, gateMb: gate / 1048576, gatePrepared: this.gatePrepared,
      voices: this.voices.length, base: !!this.baseS, storm: !!this.stormS, layers: this.baseLayers, stormX: this.stormX,
      bed: this.baseS?.ids[0] ?? null, bedMb: pb ? (pb.length * pb.numberOfChannels * 4) / 1048576 : 0,
    };
  }

  /** The running session's bar grid (ctx time of loop position 0, seconds per bar) and base bed. */
  grid(): { kind: 'base' | 'storm'; start: number; bar: number; bed: string | null } | null {
    const s = this.stormS ?? this.baseS;
    return s ? { kind: s.kind, start: s.start, bar: s.bar, bed: s.kind === 'base' ? s.ids[0] : null } : null;
  }

  /** Current bar position (for harness displays): {kind, bar, beat} or null. */
  position(): { kind: 'base' | 'storm'; bar: number; beat: number } | null {
    const c = this._ctx;
    const s = this.stormS ?? this.baseS;
    if (!c || !s) return null;
    const p = (c.currentTime - s.start) / s.bar;
    if (p < 0) return { kind: s.kind, bar: -1, beat: 0 };
    return { kind: s.kind, bar: Math.floor(p), beat: Math.floor((p % 1) * 4) };
  }

  /**
   * QA: drive the engine on an OfflineAudioContext (no timer — call tick() yourself, e.g. from
   * ctx.suspend() checkpoints). Renders every asset first.
   */
  async attachOffline(ctx: OfflineAudioContext, opts: { bypassMaster?: boolean } = {}): Promise<void> {
    this._ctx = ctx;
    this.realtime = false;
    this.everRan = true;
    this.hwRate = ctx.sampleRate;
    this.build(ctx, !!opts.bypassMaster);
    this.stormPrepared = true;
    this.gatePrepared = true;
    for (const id of allAssetIds()) {
      if (!this.assets.has(id)) this.assets.set(id, await renderAsset(id, ctx.sampleRate));
    }
  }
  /** QA: pre-seed rendered assets (share renders between offline scenarios). */
  adoptAssets(from: GameAudio): void { for (const [k, v] of from.assets) this.assets.set(k, v); }
  /** QA: look up a rendered asset. */
  asset(id: string): AudioBuffer | undefined { return this.assets.get(id); }
}

/** The game-wide singleton. */
export const audio = new GameAudio();
