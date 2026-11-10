/**
 * View assembly: owns the Stage and composes Sky + Orrery + SymbolFactory + Vfx
 * into the IGameView the director plays beats through.
 *
 * How the pieces are kept from fighting each other:
 *  - Rings: one small state machine per ring (rest, wind-up, whirl, coast,
 *    stop). The whirl is integrated in update(); everything else is a tween.
 *  - Camera: features never write stage.rig directly. They tween plain numbers
 *    in `cam`, and update() multiplies them into zoom / tilt / azimuth, so a
 *    win push, a nova pull and a big-win orbit can overlap.
 *  - Ring glow is composed the same way (stop pulse + drag + hint + nova).
 *  - Every tween carries this view's group, so dispose() can resolve them all.
 */
import * as THREE from 'three';
import { anim, type TweenHandle, type TweenOptions } from '../core/anim';
import {
  BEZEL_INNER,
  PALETTE,
  RINGS,
  RING_DIR,
  RING_RADII,
  RING_WIDTH,
  RING_Y,
  SPOKES,
  STAR_Y,
  STEP_ANGLE,
  SYM,
  SYMBOLS,
  TIMING,
  TURBO_SCALE,
  cellXZ,
  cellY,
  type SymbolId,
} from '../core/config';
import { clamp01, damp, inCubic, inOutCubic, inOutSine, outBack, outBackSoft, outCubic, outQuad, type Ease } from '../core/ease';
import type {
  BeatCascade,
  BigWinTier,
  Cell,
  GameMode,
  Grid,
  IGameView,
  LineWin,
  NudgeChoice,
  Quality,
  ScreenPoint,
  SpinStopOptions,
  ViewCue,
  ViewLayout,
} from '../core/types';
import { Orrery } from './orrery';
import { Sky } from './sky';
import { Stage } from './stage';
import { SymbolFactory, type SymbolView } from './symbols';
import { Vfx, type BeamHandle } from './vfx';

const TAU = Math.PI * 2;
const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Whirl speed per ring, rad/s. Slower outward, so the rims pass at a similar pace. */
const WHIRL_SPEED = [10, 9, 8, 7] as const;
const SPIN_UP = 0.3;
const STOP_TIME = 0.55;

// Ring stop: linear deceleration into the notch (it arrives with a little
// speed left), then a damped overshoot. STOP_A is where the detent catches.
const STOP_A = 0.74;
const STOP_RHO = 0.2;
const STOP_V0 = 2 / (STOP_A * (1 + STOP_RHO));
const STOP_V1 = STOP_V0 * STOP_RHO;
const STOP_OVER = (STOP_V1 * (1 - STOP_A)) / Math.PI;
const stopEase: Ease = (t) => {
  if (t < STOP_A) return STOP_V0 * t - ((STOP_V0 - STOP_V1) * t * t) / (2 * STOP_A);
  const u = (t - STOP_A) / (1 - STOP_A);
  return 1 + STOP_OVER * Math.sin(Math.PI * u) * (1 - u);
};
/** Speed during the stop as a fraction of the entry speed. */
const stopSpeed = (t: number) => (t < STOP_A ? 1 - ((1 - STOP_RHO) * t) / STOP_A : 0);

// Clockwork tick: a hair of wind-back, a slam into the notch, a small spring.
const TICK_A = 0.64;
const tickEase: Ease = (t) => {
  if (t < TICK_A) {
    const u = t / TICK_A;
    return 2.2 * u * u * u - 1.2 * u * u;
  }
  const u = (t - TICK_A) / (1 - TICK_A);
  return 1 + 0.05 * Math.sin(Math.PI * u) * (1 - u);
};

/** Scale of a symbol landing: 0 → 1.15 → 1. */
const popScale = (t: number) => (t < 0.55 ? 1.15 * outCubic(t / 0.55) : 1.15 - 0.15 * inOutSine((t - 0.55) / 0.45));
/** 0 → 1 → 0, fast up and slow down. */
const punchCurve = (t: number) => (t < 0.3 ? outCubic(t / 0.3) : 1 - inOutSine((t - 0.3) / 0.7));
/** Fraction of the shockwave's duration at which its front reaches a radius (mirrors vfx/shock.ts, maxRadius 13). */
const frontTime = (radius: number) => 1 - Math.pow(1 - radius / 13, 1 / 2.4);

const REST = 0;
const WINDUP = 1;
const WHIRL = 2;
const COAST = 3;
const STOP = 4;

const HINT_PERIOD = 1.6;
/** Glow a winning symbol holds after its flash. Higher and the beam's nodes wash the symbol out. */
const WIN_GLOW = 0.42;
/** Rise to a flash, then fall back to the hold level. */
const glowCurve = (t: number) => (t < 0.25 ? 0.9 * (t / 0.25) : 0.9 - (0.9 - WIN_GLOW) * inOutSine((t - 0.25) / 0.75));
/** Level of the orrery's unlocked look while a nudge is on offer; at 1 the dragged ring's own glow drowns. */
const UNLOCKED = 0.55;
const PICK_Y = (RING_Y[0] + RING_Y[1] + RING_Y[2] + RING_Y[3]) / 4;
const RING_PITCH = RING_RADII[1] - RING_RADII[0];

interface RingState {
  phase: number;
  /** Angular speed, rad/s, always positive (the direction is RING_DIR). */
  speed: number;
  /** Angle the stop is aiming for, in the whirl's unwrapped angle space. */
  target: number;
  /** Distance the deceleration needs at the entry speed. */
  decel: number;
  stopTime: number;
  nextK: number;
  cometSpoke: number;
  heat: number;
  antic: number;
  anticOn: boolean;
  pulse: number;
  drag: number;
  offset: number;
  busy: boolean;
  done: (() => void) | null;
}

function resolved(): TweenHandle {
  const p = Promise.resolve() as TweenHandle;
  p.cancel = () => {};
  p.finish = () => {};
  return p;
}

let viewSeq = 0;

export class GameView implements IGameView {
  private stage!: Stage;
  private sky!: Sky;
  private orrery!: Orrery;
  private symbols!: SymbolFactory;
  private vfx!: Vfx;
  private ready = false;
  private dead = false;
  private readonly group = `view#${++viewSeq}`;
  private readonly listeners: ((cue: ViewCue) => void)[] = [];
  private readonly keyed = new Map<string, TweenHandle>();

  /** Notch offset per ring: socket j sits at spoke (j + k) mod 8. */
  private readonly k = [0, 0, 0, 0];
  /** views[ring][socket] */
  private readonly views: (SymbolView | null)[][] = [];
  /** Trail colour per socket, kept in step with `views`. */
  private readonly trailColors: number[][] = [];
  private readonly ring: RingState[] = [];
  private spinToken = 0;
  private spinning = false;
  private spinT0 = 0;
  private spinScale = 1;
  private cometCount = 0;

  private readonly spokeGlow = [0, 0, 0, 0, 0, 0, 0, 0];
  private readonly ghosts: (BeamHandle | null)[] = [null, null, null, null, null, null, null, null];
  private readonly ghostKey = [0, 0, 0, 0, 0, 0, 0, 0];
  private readonly ghostWant = [0, 0, 0, 0, 0, 0, 0, 0];
  private hint: NudgeChoice | null = null;
  private hintT = 0;

  private readonly cam = { attract: 0, attractAz: 0, win: 0, nova: 1, big: 0, bigAz: 0 };
  private attractOn = false;
  private bigOn = false;
  private bigTier = 0;
  private skyNova = 0;
  private novaGlow = 0;
  private mode: GameMode = 'base';
  private modeBlend = 0;
  private baseAberration = 0.0012;

  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();

  constructor() {
    for (let r = 0; r < RINGS; r++) {
      this.views.push([null, null, null, null, null, null, null, null]);
      this.trailColors.push([0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff]);
      this.ring.push({
        phase: REST, speed: 0, target: 0, decel: 0, stopTime: STOP_TIME, nextK: 0, cometSpoke: -1,
        heat: 0, antic: 0, anticOn: false, pulse: 0, drag: 0, offset: 0, busy: false, done: null,
      });
    }
  }

  get canvas(): HTMLCanvasElement {
    return this.stage.canvas;
  }

  // ───────────────────────────── Lifecycle ─────────────────────────────

  async init(container: HTMLElement, opts: { quality: Quality; reducedMotion: boolean }): Promise<void> {
    const stage = (this.stage = new Stage(container, opts));
    this.sky = new Sky(stage);
    stage.scene.add(this.sky.group);
    this.orrery = new Orrery(stage);
    stage.scene.add(this.orrery.group);
    this.vfx = new Vfx(stage);
    stage.scene.add(this.vfx.group);
    this.symbols = new SymbolFactory(stage);
    this.symbols.warmup();
    this.vfx.ambient = 0.5;
    // The stage's default grain speckles the saturated gems in close-up.
    stage.final.uniforms.uGrain.value = 0.018;
    this.baseAberration = stage.fx.aberration;
    stage.setLayout({
      width: container.clientWidth || 1,
      height: container.clientHeight || 1,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    this.ready = true;
  }

  setLayout(layout: ViewLayout): void {
    if (this.ready && !this.dead) this.stage.setLayout(layout);
  }

  setQuality(q: Quality): void {
    if (!this.ready || this.dead || q === this.stage.quality) return;
    this.stage.setQuality(q);
    // The stage changes the composer targets' sample count in place. three only
    // honours that on a rebuild, and renders into a missing MSAA buffer otherwise.
    this.stage.composer.renderTarget1.dispose();
    this.stage.composer.renderTarget2.dispose();
  }

  setReducedMotion(on: boolean): void {
    if (this.ready && !this.dead) this.stage.reducedMotion = on;
  }

  onCue(cb: (cue: ViewCue) => void): void {
    this.listeners.push(cb);
  }

  update(dt: number): void {
    if (!this.ready || this.dead) return;
    const { orrery, vfx, stage } = this;
    const dtA = dt * anim.speed;
    const rm = stage.reducedMotion;
    const h = this.hint;
    if (h) this.hintT += dt;
    let antic = 0;

    // Ring motion first, so the sub-modules below see this frame's angles.
    for (let r = 0; r < RINGS; r++) {
      const st = this.ring[r];
      const rig = orrery.rings[r];
      const dir = RING_DIR[r];
      const top = WHIRL_SPEED[r];
      if (st.phase === WHIRL || st.phase === COAST) {
        const want = top * (1 + 0.18 * st.antic);
        st.speed = Math.min(want, st.speed + (top / (SPIN_UP * this.spinScale)) * dtA);
        const a = rig.angle + dir * st.speed * dtA;
        this.setAngle(r, a);
        vfx.setTrail(r, Math.min(1, st.speed / top), this.trailColors[r], a, dir);
        if (st.phase === COAST && dir * (st.target - a) <= st.decel) this.startDecel(r);
      }
      const moving = st.phase >= WHIRL;
      const heatTarget = moving ? Math.min(1, (0.65 + 0.35 * st.antic) * Math.min(1, st.speed / top)) : 0;
      st.heat = damp(st.heat, heatTarget, 0.06, dt);
      rig.heat = st.heat < 0.002 ? 0 : st.heat;

      let hintGlow = 0;
      if (h && h.ring === r && st.phase === REST && !st.busy && st.offset === 0) {
        const p = (this.hintT % HINT_PERIOD) / HINT_PERIOD;
        if (!rm) {
          const rock = p < 0.6 ? Math.sin((Math.PI * p) / 0.6) : 0;
          this.setAngle(r, this.k[r] * STEP_ANGLE + h.dir * 0.05 * rock * rock);
        }
        hintGlow = 0.22 + 0.3 * (0.5 - 0.5 * Math.cos(TAU * p));
      }
      const glow = st.pulse + st.drag + hintGlow + this.novaGlow;
      rig.glow = glow > 1 ? 1 : glow;
      if (st.antic > antic) antic = st.antic;
    }
    if (antic > 0) {
      const e = 0.25 + 0.95 * antic;
      if (orrery.star.energy < e) orrery.star.energy = e;
    }

    const c = this.cam;
    if (this.attractOn) {
      if (!rm) c.attractAz += dt * 0.1;
    } else if (c.attractAz !== 0) {
      c.attractAz = damp(c.attractAz, 0, 0.22, dt);
      if (Math.abs(c.attractAz) < 1e-4) c.attractAz = 0;
    }
    if (this.bigOn) {
      if (!rm) c.bigAz += dt * 0.16 * c.big;
    } else if (c.bigAz !== 0) {
      c.bigAz = damp(c.bigAz, 0, 0.3, dt);
      if (Math.abs(c.bigAz) < 1e-4) c.bigAz = 0;
    }

    orrery.update(dt);
    this.symbols.update(dt);
    vfx.update(dt);
    const skyE = Math.max(this.skyNova, c.big * (0.4 + 0.2 * this.bigTier), 0.4 * antic);
    this.sky.energy = skyE > 1 ? 1 : skyE;
    this.sky.update(dt);

    // Reduced motion keeps the camera's punctuation but shortens every move.
    const m = rm ? 0.4 : 1;
    const cr = stage.rig;
    cr.zoom = (1 + 0.3 * c.attract) * (1 - c.win * m) * (1 + (c.nova - 1) * m) * (1 + 0.07 * c.big * m) * (1 - 0.025 * antic * m);
    cr.tiltOffset = 0.3 * c.attract + 0.05 * c.big * m;
    cr.azimuth = c.attractAz + c.bigAz;
    stage.update(dt);
  }

  render(): void {
    if (this.ready && !this.dead) this.stage.render();
  }

  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    anim.cancelGroup(this.group);
    this.keyed.clear();
    for (const st of this.ring) {
      const d = st.done;
      st.done = null;
      d?.();
    }
    this.listeners.length = 0;
    if (!this.ready) return;
    for (let s = 0; s < SPOKES; s++) {
      this.ghosts[s]?.dispose();
      this.ghosts[s] = null;
    }
    for (const row of this.views) {
      for (let j = 0; j < SPOKES; j++) {
        const v = row[j];
        if (v) this.symbols.release(v);
        row[j] = null;
      }
    }
    this.symbols.dispose();
    this.vfx.dispose();
    this.orrery.dispose();
    this.sky.dispose();
    this.stage.dispose();
  }

  /** Draw calls and triangles of one whole frame, all composer passes. Renders a frame (dev tool). */
  stats(): { calls: number; triangles: number } {
    const info = this.stage.renderer.info;
    const auto = info.autoReset;
    info.autoReset = false;
    info.reset();
    this.stage.render();
    const out = { calls: info.render.calls, triangles: info.render.triangles };
    info.autoReset = auto;
    return out;
  }

  // ───────────────────────────── Helpers ─────────────────────────────

  private emit(cue: ViewCue): void {
    for (let i = 0; i < this.listeners.length; i++) this.listeners[i](cue);
  }

  private scale(turbo: boolean): number {
    return turbo ? TURBO_SCALE : 1;
  }

  private tw(opts: TweenOptions): TweenHandle {
    if (this.dead) return resolved();
    opts.group = this.group;
    return anim.tween(opts);
  }

  private wait(seconds: number): TweenHandle {
    return this.tw({ duration: Math.max(0, seconds) });
  }

  /** A tween that replaces the previous one under the same key. */
  private keyedTw(key: string, opts: TweenOptions): TweenHandle {
    this.keyed.get(key)?.cancel();
    const h = this.tw(opts);
    this.keyed.set(key, h);
    return h;
  }

  /** Run now when there is no delay, so the first beat of a sequence lands in the calling frame. */
  private at(delay: number, fn: () => void): void {
    if (delay <= 0) fn();
    else this.tw({ duration: 0, delay, onComplete: fn });
  }

  /** A sub-module promise, but never longer than `max` seconds of anim time. */
  private settle(p: Promise<void>, max: number): Promise<void> {
    return Promise.race([p, this.wait(max)]);
  }

  private camTo(key: 'attract' | 'win' | 'nova' | 'big', target: number, duration: number, ease: Ease): TweenHandle {
    const c = this.cam;
    const from = c[key];
    return this.keyedTw('cam.' + key, { duration, ease, onUpdate: (e) => (c[key] = from + (target - from) * e) });
  }

  private setAngle(r: number, a: number): void {
    this.orrery.rings[r].angle = a;
    const row = this.views[r];
    for (let j = 0; j < SPOKES; j++) {
      const v = row[j];
      if (v) v.ringAngle = a;
    }
  }

  private cellPos(ring: number, spoke: number, out: THREE.Vector3): THREE.Vector3 {
    const p = cellXZ(ring, spoke);
    return out.set(p.x, cellY(ring), p.z);
  }

  private socketOf(ring: number, spoke: number): number {
    return mod(spoke - this.k[ring], SPOKES);
  }

  private viewAt(ring: number, spoke: number): SymbolView | null {
    return this.views[ring][this.socketOf(ring, spoke)];
  }

  private clearSocket(r: number, j: number): void {
    const v = this.views[r][j];
    if (v) this.symbols.release(v);
    this.views[r][j] = null;
  }

  private putInSocket(r: number, j: number, id: SymbolId, keepSame = false): SymbolView {
    const old = this.views[r][j];
    if (old && keepSame && old.id === id) return old;
    if (old) this.symbols.release(old);
    const v = this.symbols.acquire(id, r);
    this.orrery.rings[r].sockets[j].add(v.object);
    v.ringAngle = this.orrery.rings[r].angle;
    this.views[r][j] = v;
    this.trailColors[r][j] = SYMBOLS[id].color;
    return v;
  }

  private place(ring: number, spoke: number, id: SymbolId): SymbolView {
    return this.putInSocket(ring, this.socketOf(ring, spoke), id);
  }

  /** Make the board show `grid` without ceremony (safety net after a choreography). */
  private syncGrid(grid: Grid): void {
    for (let r = 0; r < RINGS; r++) {
      for (let s = 0; s < SPOKES; s++) {
        const v = this.viewAt(r, s);
        if (!v || v.id !== grid[r][s]) this.place(r, s, grid[r][s]);
      }
    }
  }

  private bumpStar(amount: number): void {
    const star = this.orrery.star;
    star.energy = Math.min(2, star.energy + amount);
  }

  private punch(v: SymbolView, peak: number, duration: number, delay = 0, glow = false): void {
    this.tw({
      duration,
      delay,
      onUpdate: (_e, t) => {
        v.object.scale.setScalar(1 + (peak - 1) * punchCurve(t));
        if (glow) v.glow = glowCurve(t);
      },
    });
  }

  private pulse(r: number, peak: number, duration: number): void {
    const st = this.ring[r];
    this.keyedTw('pulse' + r, { duration, onUpdate: (_e, t) => (st.pulse = peak * (1 - t) * (1 - t)) });
  }

  private spokeGlowTo(spoke: number, target: number, duration: number): void {
    const from = this.spokeGlow[spoke];
    this.keyedTw('spoke' + spoke, {
      duration,
      onUpdate: (e) => {
        const v = from + (target - from) * e;
        this.spokeGlow[spoke] = v;
        this.orrery.setSpokeGlow(spoke, v);
      },
    });
  }

  /** Sparks where a ring's rim meets `count` of the spoke lines. */
  private rimSparks(radius: number, y: number, count: number, each: number, speed: number): void {
    const start = this.stage.rng.int(SPOKES);
    const stride = count >= 4 ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const a = ((start + i * stride) % SPOKES) * STEP_ANGLE;
      this.v1.set(Math.sin(a) * radius, y, -Math.cos(a) * radius);
      this.vfx.sparks(this.v1, PALETTE.brassLight, each, speed);
    }
  }

  /** Bring every ring to rest at its notch and resolve whatever was waiting on it. */
  private forceRest(): void {
    this.spinToken++;
    this.keyed.get('tick')?.finish();
    for (let r = 0; r < RINGS; r++) {
      this.keyed.get('ring' + r)?.finish();
      this.keyed.get('nudge' + r)?.finish();
      const st = this.ring[r];
      if (st.phase !== REST) {
        st.phase = REST;
        this.vfx.setTrail(r, 0, this.trailColors[r], 0, RING_DIR[r]);
      }
      st.speed = 0;
      st.antic = 0;
      st.anticOn = false;
      st.offset = 0;
      st.drag = 0;
      st.busy = false;
      const d = st.done;
      st.done = null;
      d?.();
      this.setAngle(r, this.k[r] * STEP_ANGLE);
    }
    this.spinning = false;
  }

  // ───────────────────────────── Board ─────────────────────────────

  setGrid(grid: Grid): void {
    if (!this.ready || this.dead) return;
    this.forceRest();
    for (let r = 0; r < RINGS; r++) {
      for (let j = 0; j < SPOKES; j++) this.clearSocket(r, j);
      for (let s = 0; s < SPOKES; s++) this.place(r, s, grid[r][s]);
    }
  }

  spinStart(opts: { turbo: boolean }): void {
    if (!this.ready || this.dead) return;
    this.forceRest();
    const sc = this.scale(opts.turbo);
    const token = this.spinToken;
    this.spinning = true;
    this.spinT0 = anim.time;
    this.spinScale = sc;
    for (let r = 0; r < RINGS; r++) {
      const st = this.ring[r];
      const dir = RING_DIR[r];
      const rest = this.k[r] * STEP_ANGLE;
      st.phase = WINDUP;
      st.speed = 0;
      this.keyedTw('ring' + r, {
        duration: 0.15 * sc,
        ease: outQuad,
        onUpdate: (e) => this.setAngle(r, rest - dir * 0.1 * e),
        onComplete: () => {
          if (token !== this.spinToken) return;
          st.phase = WHIRL;
          if (r === 0) this.emit({ type: 'whirlStart' });
        },
      });
    }
  }

  async spinStop(grid: Grid, opts: SpinStopOptions): Promise<void> {
    if (!this.ready || this.dead) return;
    if (!this.spinning) this.spinStart({ turbo: opts.turbo });
    const token = this.spinToken;
    const sc = this.scale(opts.turbo);
    const remain = TIMING.whirlMin * sc - (anim.time - this.spinT0);
    if (remain > 0) await this.wait(remain);
    this.cometCount = 0;
    const stops: Promise<void>[] = [];
    for (let r = 0; r < RINGS; r++) {
      if (r > 0) await this.wait(TIMING.ringStopGap * sc);
      if (this.dead || token !== this.spinToken) return;
      const st = this.ring[r];
      if (opts.anticipation?.[r]) {
        this.emit({ type: 'anticipation', ring: r, on: true });
        st.anticOn = true;
        await this.tw({ duration: TIMING.anticipationExtra * sc, onUpdate: (e) => (st.antic = e) });
        if (this.dead || token !== this.spinToken) return;
      }
      stops.push(this.beginStop(r, grid[r], opts.scatters ?? [], sc));
    }
    await Promise.all(stops);
    if (!this.dead && token === this.spinToken) this.spinning = false;
  }

  /**
   * Pick the notch this ring will land on, load the outcome into the sockets
   * that will sit on the right spokes there, and let the ring coast until the
   * deceleration distance is exactly what is left.
   */
  private beginStop(r: number, row: SymbolId[], scatters: Cell[], sc: number): Promise<void> {
    const st = this.ring[r];
    const dir = RING_DIR[r];
    if (st.phase !== WHIRL) {
      this.keyed.get('ring' + r)?.cancel();
      st.phase = WHIRL;
    }
    if (st.speed < WHIRL_SPEED[r] * 0.6) st.speed = WHIRL_SPEED[r];
    st.stopTime = STOP_TIME * sc;
    st.decel = (st.speed * st.stopTime) / STOP_V0;
    const n = Math.ceil((dir * this.orrery.rings[r].angle + st.decel) / STEP_ANGLE - 1e-6);
    st.target = dir * n * STEP_ANGLE;
    st.nextK = mod(dir * n, SPOKES);
    for (let s = 0; s < SPOKES; s++) this.putInSocket(r, mod(s - st.nextK, SPOKES), row[s], true);
    st.cometSpoke = -1;
    for (const c of scatters) if (c.ring === r) st.cometSpoke = c.spoke;
    st.phase = COAST;
    return new Promise<void>((res) => (st.done = res));
  }

  private startDecel(r: number): void {
    const st = this.ring[r];
    const dir = RING_DIR[r];
    const from = this.orrery.rings[r].angle;
    const rem = Math.max(0.02, dir * (st.target - from));
    const w0 = st.speed;
    const top = WHIRL_SPEED[r];
    const finalNotch = Math.round((dir * st.target) / STEP_ANGLE);
    let lastNotch = Math.floor((dir * from) / STEP_ANGLE + 1e-6);
    let clicked = false;
    st.phase = STOP;
    this.keyedTw('ring' + r, {
      // Scaled by what is left, so the speed is continuous where the tween takes over.
      duration: (st.stopTime * rem) / st.decel,
      ease: stopEase,
      onUpdate: (e, t) => {
        const a = from + dir * rem * e;
        this.setAngle(r, a);
        st.speed = w0 * stopSpeed(t);
        if (clicked) return;
        if (t >= STOP_A) {
          clicked = true;
          this.vfx.setTrail(r, 0, this.trailColors[r], a, dir);
          this.ringClick(r);
          return;
        }
        this.vfx.setTrail(r, Math.min(1, st.speed / top), this.trailColors[r], a, dir);
        const notch = Math.floor((dir * a) / STEP_ANGLE + 1e-6);
        if (notch !== lastNotch && notch < finalNotch) this.emit({ type: 'ringNotch', ring: r, speed: clamp01(st.speed / top) });
        lastNotch = notch;
      },
      onComplete: () => {
        st.phase = REST;
        st.speed = 0;
        this.k[r] = st.nextK;
        this.setAngle(r, st.nextK * STEP_ANGLE);
        const d = st.done;
        st.done = null;
        d?.();
      },
    });
  }

  /** The detent catches the ring: everything the stop is felt by happens here. */
  private ringClick(r: number): void {
    const st = this.ring[r];
    this.emit({ type: 'ringStop', ring: r, isLast: r === RINGS - 1 });
    this.stage.rig.shake(0.12);
    this.rimSparks(RING_RADII[r] + RING_WIDTH / 2, RING_Y[r] + 0.06, 3, 5, 2.4);
    this.pulse(r, 0.55, 0.35);
    if (st.anticOn) {
      st.anticOn = false;
      this.emit({ type: 'anticipation', ring: r, on: false });
    }
    if (st.antic > 0) {
      const a0 = st.antic;
      this.tw({ duration: 0.3, onUpdate: (e) => (st.antic = a0 * (1 - e)) });
    }
    if (st.cometSpoke >= 0) {
      const cell = { ring: r, spoke: st.cometSpoke };
      this.cometCount++;
      this.emit({ type: 'scatterLand', cell, countSoFar: this.cometCount });
      this.vfx.flash(this.cellPos(r, cell.spoke, this.v1), SYMBOLS[SYM.SCATTER].color, 1.1);
      const v = this.views[r][mod(cell.spoke - st.nextK, SPOKES)];
      if (v) this.punch(v, 1.25, 0.4);
    }
  }

  async showWins(lines: LineWin[], opts: { multiplier: number; ladderIndex: number; turbo: boolean }): Promise<void> {
    if (!this.ready || this.dead || !lines.length) return;
    const sc = this.scale(opts.turbo);
    const n = lines.length;
    const winners: SymbolView[] = [];
    const losers: SymbolView[] = [];
    for (let r = 0; r < RINGS; r++) {
      for (let s = 0; s < SPOKES; s++) {
        const v = this.viewAt(r, s);
        if (!v) continue;
        const wins = lines.some((l) => l.cells.some((c) => c.ring === r && c.spoke === s));
        (wins ? winners : losers).push(v);
      }
    }
    this.tw({
      duration: 0.18 * sc,
      ease: outCubic,
      onUpdate: (e) => {
        for (const v of losers) v.dim = 0.65 * e;
      },
    });

    const beams: BeamHandle[] = [];
    const stagger = Math.min(0.09, 0.45 / n) * sc;
    lines.forEach((line, i) =>
      this.at(i * stagger, () => {
        beams.push(this.vfx.beam(line.spoke, line.count, SYMBOLS[line.symbol].color));
        this.spokeGlowTo(mod(line.spoke, SPOKES), 1, 0.12 * sc);
        this.emit({ type: 'beamFire', spoke: line.spoke, count: line.count, symbol: line.symbol, index: i, of: n });
        this.bumpStar(0.35);
        // The punch runs outward with the beam.
        line.cells.forEach((c, j) => {
          const v = this.viewAt(c.ring, c.spoke);
          if (v) this.punch(v, 1.24, 0.36 * sc, j * 0.045 * sc, true);
        });
      }),
    );
    void this.camTo('win', Math.min(0.08, 0.04 + 0.012 * (n - 1)), 0.3 * sc, outCubic);

    const fade = 0.25 * sc;
    await this.wait((n - 1) * stagger + Math.max(0.1, TIMING.winShow * sc - fade));
    if (this.dead) return;
    for (const b of beams) void b.fadeOut(fade);
    for (const line of lines) this.spokeGlowTo(mod(line.spoke, SPOKES), 0, fade);
    void this.camTo('win', 0, 0.4 * sc, inOutSine);
    await this.tw({
      duration: fade,
      onUpdate: (e) => {
        for (const v of losers) v.dim = 0.65 * (1 - e);
        for (const v of winners) {
          v.glow = WIN_GLOW * (1 - e);
          v.object.scale.setScalar(1);
        }
      },
    });
  }

  async cascade(beat: BeatCascade, opts: { turbo: boolean }): Promise<void> {
    if (!this.ready || this.dead) return;
    const sc = this.scale(opts.turbo);
    const star = this.orrery.star;
    const removed = beat.removed;
    let arrived = false;

    const burstGap = Math.min(0.03, 0.2 / Math.max(1, removed.length)) * sc;
    removed.forEach((cell, i) =>
      this.at(i * burstGap, () => {
        const j = this.socketOf(cell.ring, cell.spoke);
        const v = this.views[cell.ring][j];
        if (!v) return;
        const pos = this.cellPos(cell.ring, cell.spoke, new THREE.Vector3());
        const color = SYMBOLS[v.id].color;
        this.vfx.burst(pos, color, 0.8);
        this.emit({ type: 'gemBurst', cell, symbol: v.id, index: i });
        // The slot is free at once; the object itself lives until it has shrunk away.
        this.views[cell.ring][j] = null;
        this.tw({
          duration: 0.1 * sc,
          ease: inCubic,
          onUpdate: (e) => v.object.scale.setScalar(Math.max(0.001, 1 - e)),
          onComplete: () => this.symbols.release(v),
        });
        void this.settle(this.vfx.stardust(pos, star.position, color, { count: 22, duration: 0.5 * sc }), 0.5 * sc + 0.3).then(() => {
          if (this.dead) return;
          if (!arrived) {
            arrived = true;
            this.emit({ type: 'stardustArrive', amount: removed.length });
            this.bumpStar(0.7);
          } else this.bumpStar(0.15);
        });
      }),
    );
    await this.wait(TIMING.burst * sc);
    if (this.dead) return;

    const refills = beat.refills;
    const flight = (TIMING.refill - 0.09) * sc;
    const refillGap = Math.min(0.05, 0.16 / Math.max(1, refills.length - 1)) * sc;
    const landings: Promise<void>[] = [];
    refills.forEach((rf, i) => {
      landings.push(
        this.wait(i * refillGap).then(async () => {
          if (this.dead) return;
          const { ring, spoke } = rf.cell;
          const pos = this.cellPos(ring, spoke, new THREE.Vector3());
          await this.settle(this.vfx.shootingStar(pos, SYMBOLS[rf.symbol].color, { duration: flight }), flight + 0.3);
          if (this.dead) return;
          const v = this.place(ring, spoke, rf.symbol);
          v.object.scale.setScalar(0.001);
          this.tw({ duration: 0.24 * sc, onUpdate: (_e, t) => v.object.scale.setScalar(popScale(t)) });
          this.emit({ type: 'refillLand', cell: rf.cell, symbol: rf.symbol, index: i });
        }),
      );
    });
    await Promise.all(landings);
    if (refills.length) await this.wait(0.09 * sc);
    if (this.dead) return;
    this.syncGrid(beat.gridAfterRefill);

    await this.tickRings(beat.tick, TIMING.tick * sc);
  }

  /** The clockwork tick: every ring turns its notches together and slams home. */
  private tickRings(notches: number[], duration: number): Promise<void> {
    if (this.dead || !notches.some((n) => n !== 0)) return Promise.resolve();
    let hit = false;
    const impact = () => {
      hit = true;
      this.emit({ type: 'tick' });
      this.stage.rig.shake(0.18);
      this.rimSparks(BEZEL_INNER - 0.02, RING_Y[3] + 0.08, 4, 6, 2.8);
      for (let r = 0; r < RINGS; r++) if (notches[r]) this.pulse(r, 0.4, 0.3);
    };
    for (const st of this.ring) st.busy = true;
    return this.keyedTw('tick', {
      duration,
      onUpdate: (_e, t) => {
        const e = tickEase(t);
        for (let r = 0; r < RINGS; r++) if (notches[r]) this.setAngle(r, (this.k[r] + notches[r] * e) * STEP_ANGLE);
        if (!hit && t >= TICK_A) impact();
      },
      onComplete: () => {
        if (!hit) impact();
        for (let r = 0; r < RINGS; r++) {
          this.k[r] = mod(this.k[r] + (notches[r] || 0), SPOKES);
          this.setAngle(r, this.k[r] * STEP_ANGLE);
          this.ring[r].busy = false;
        }
      },
    });
  }

  async nova(converted: Cell[], grid: Grid, opts: { turbo: boolean }): Promise<void> {
    if (!this.ready || this.dead) return;
    const sc = this.scale(opts.turbo);
    const rm = this.stage.reducedMotion;
    const star = this.orrery.star;
    const fx = this.stage.fx;
    const c = this.cam;
    const charge0 = star.charge;
    const aber = this.baseAberration;

    // Swell: the star takes everything in.
    this.emit({ type: 'novaCharge' });
    this.keyed.get('charge')?.cancel();
    this.keyed.get('cam.nova')?.cancel();
    await this.keyedTw('nova', {
      duration: (rm ? 0.45 : 0.9) * sc,
      onUpdate: (_e, t) => {
        const e = inOutSine(t);
        star.energy = Math.max(star.energy, 2 * t);
        star.charge = charge0 + (1 - charge0) * e;
        c.nova = 1 - 0.1 * e;
        this.skyNova = e;
        this.novaGlow = 0.22 * t * t;
        fx.aberration = aber + 0.0045 * e;
      },
    });
    // The held breath.
    await this.tw({ duration: 0.12 * sc, onUpdate: () => (star.energy = 2) });
    if (this.dead) return;

    this.emit({ type: 'novaFlash' });
    this.stage.rig.shake(0.9);
    const flashPeak = rm ? 0.7 : 1.4;
    fx.flash = flashPeak;
    // The star has spent itself: it must not keep whiting out the rings that are about to turn wild.
    star.energy = 1;
    this.keyedTw('flash', {
      duration: 0.5 * sc,
      onUpdate: (_e, t) => (fx.flash = flashPeak * Math.pow(1 - t, 4)),
      onComplete: () => (fx.flash = 0),
    });
    const chargeTop = star.charge;
    const settle = this.keyedTw('nova', {
      duration: 1.0 * sc,
      onUpdate: (_e, t) => {
        // Snap out, then ease home.
        c.nova = t < 0.1 ? 0.9 + 0.22 * outCubic(t / 0.1) : 1.12 - 0.12 * inOutCubic((t - 0.1) / 0.9);
        this.skyNova = 1 - inOutSine(t);
        this.novaGlow = 0.35 * (1 - t) * (1 - t);
        fx.aberration = aber + 0.0045 * (1 - outCubic(t));
        star.charge = chargeTop * (1 - outCubic(Math.min(1, t / 0.3)));
      },
      onComplete: () => {
        c.nova = 1;
        this.skyNova = 0;
        this.novaGlow = 0;
        fx.aberration = aber;
      },
    });

    // A beat after the flash, so the front's own wash does not stack on the whiteout.
    await this.wait(0.08 * sc);
    if (this.dead) return;
    this.emit({ type: 'novaShockwave' });
    const shockTime = 1.1 * sc;
    const shock = this.settle(this.vfx.shockwave(star.position, { duration: shockTime }), shockTime + 0.3);

    const order = [...converted].sort((a, b) => a.ring - b.ring || a.spoke - b.spoke);
    const seen = [0, 0, 0, 0];
    let last = 0;
    order.forEach((cell, index) => {
      const delay = frontTime(RING_RADII[cell.ring]) * shockTime + (0.05 + cell.ring * 0.12 + seen[cell.ring]++ * 0.02) * sc;
      last = Math.max(last, delay);
      this.at(delay, () => {
        const v = this.place(cell.ring, cell.spoke, SYM.WILD);
        v.object.scale.setScalar(0.3);
        this.tw({ duration: 0.3 * sc, onUpdate: (_e, t) => v.object.scale.setScalar(0.3 + 0.7 * popScale(t) + 0.1 * punchCurve(t)) });
        this.vfx.flash(this.cellPos(cell.ring, cell.spoke, this.v1), PALETTE.gold, 0.55);
        this.emit({ type: 'wildTransform', cell, index });
      });
    });

    await Promise.all([shock, settle, this.wait(last + 0.32 * sc)]);
    if (this.dead) return;
    this.syncGrid(grid);
  }

  setNovaCharge(v01: number, opts?: { animate?: boolean }): void {
    if (!this.ready || this.dead) return;
    const star = this.orrery.star;
    const v = clamp01(v01);
    this.keyed.get('charge')?.cancel();
    if (!opts?.animate) {
      star.charge = v;
      return;
    }
    const from = star.charge;
    this.keyedTw('charge', { duration: 0.5, ease: outCubic, onUpdate: (e) => (star.charge = from + (v - from) * e) });
  }

  // ───────────────────────────── Nudge ─────────────────────────────

  pickRing(clientX: number, clientY: number): { ring: number; angle: number } | null {
    if (!this.ready || this.dead) return null;
    const p = this.stage.pickPlane(clientX, clientY, PICK_Y, this.v2);
    if (!p) return null;
    const radius = Math.hypot(p.x, p.z);
    // Half the gap between bands as tolerance; a little more on the outer edge for fingers.
    if (radius < RING_RADII[0] - RING_WIDTH / 2 - 0.03 || radius > RING_RADII[RINGS - 1] + RING_WIDTH / 2 + 0.1) return null;
    const ring = Math.max(0, Math.min(RINGS - 1, Math.round((radius - RING_RADII[0]) / RING_PITCH)));
    let angle = Math.atan2(p.x, -p.z);
    if (angle < 0) angle += TAU;
    return { ring, angle };
  }

  setNudgeActive(active: boolean): void {
    if (!this.ready || this.dead) return;
    const o = this.orrery;
    const from = o.unlocked;
    const to = active ? UNLOCKED : 0;
    this.keyedTw('unlock', { duration: 0.3, ease: outCubic, onUpdate: (e) => (o.unlocked = from + (to - from) * e) });
  }

  setRingOffset(ring: number, offsetRad: number): void {
    if (!this.ready || this.dead) return;
    const st = this.ring[ring];
    if (st.phase !== REST || st.busy) return;
    const before = Math.abs(st.offset);
    const now = Math.abs(offsetRad);
    st.offset = offsetRad;
    this.setAngle(ring, this.k[ring] * STEP_ANGLE + offsetRad);
    st.drag = now > 0 ? 0.3 + 0.7 * Math.min(1, now / STEP_ANGLE) : 0;
    if (before < STEP_ANGLE / 2 && now >= STEP_ANGLE / 2) this.emit({ type: 'nudgeDetent', ring, dir: offsetRad > 0 ? 1 : -1 });
  }

  releaseRing(ring: number, dir: 0 | 1 | -1): Promise<void> {
    if (!this.ready || this.dead) return Promise.resolve();
    const st = this.ring[ring];
    if (st.phase !== REST) return Promise.resolve();
    this.keyed.get('nudge' + ring)?.finish();
    const rest = this.k[ring] * STEP_ANGLE;
    const from = st.offset;
    const to = dir * STEP_ANGLE;
    const drag0 = st.drag;
    let hit = false;
    const commit = () => {
      hit = true;
      if (!dir) return;
      this.emit({ type: 'nudgeCommit', ring, dir });
      this.stage.rig.shake(0.1);
      this.rimSparks(RING_RADII[ring] + RING_WIDTH / 2, RING_Y[ring] + 0.06, 3, 6, 2.6);
      this.pulse(ring, 0.6, 0.4);
    };
    st.busy = true;
    if (!dir) this.emit({ type: 'nudgeCancel', ring });
    return this.keyedTw('nudge' + ring, {
      duration: TIMING.nudgeSnap,
      ease: dir ? outBack : outBackSoft,
      onUpdate: (e, t) => {
        st.offset = from + (to - from) * e;
        this.setAngle(ring, rest + st.offset);
        st.drag = drag0 * (1 - t);
        if (!hit && e >= 1) commit();
      },
      onComplete: () => {
        if (!hit) commit();
        if (dir) this.k[ring] = mod(this.k[ring] + dir, SPOKES);
        st.offset = 0;
        st.drag = 0;
        st.busy = false;
        this.setAngle(ring, this.k[ring] * STEP_ANGLE);
      },
    });
  }

  async applyNudge(choice: NudgeChoice): Promise<void> {
    if (!this.ready || this.dead) return;
    const st = this.ring[choice.ring];
    if (st.phase !== REST) return;
    this.keyed.get('nudge' + choice.ring)?.finish();
    const rest = this.k[choice.ring] * STEP_ANGLE;
    st.busy = true;
    // A short wind-up against the move, as a hand would take hold of the ring.
    await this.tw({
      duration: 0.09,
      ease: outQuad,
      onUpdate: (e) => {
        st.offset = -choice.dir * 0.07 * e;
        st.drag = 0.4 * e;
        this.setAngle(choice.ring, rest + st.offset);
      },
    });
    st.busy = false;
    await this.releaseRing(choice.ring, choice.dir);
  }

  previewLines(lines: { spoke: number; count: 3 | 4; symbol: SymbolId }[] | null): void {
    if (!this.ready || this.dead) return;
    const want = this.ghostWant;
    want.fill(0);
    if (lines) for (const l of lines) want[mod(l.spoke, SPOKES)] = 1 + l.count * 16 + l.symbol;
    for (let s = 0; s < SPOKES; s++) {
      if (want[s] === this.ghostKey[s]) continue;
      this.ghosts[s]?.dispose();
      this.ghosts[s] = null;
      this.ghostKey[s] = want[s];
      if (want[s]) {
        const key = want[s] - 1;
        this.ghosts[s] = this.vfx.ghostBeam(s, (key >> 4) as 3 | 4, SYMBOLS[key & 15].color);
      }
    }
  }

  setHint(choice: NudgeChoice | null): void {
    if (!this.ready || this.dead) return;
    const old = this.hint;
    if (old && (!choice || choice.ring !== old.ring)) {
      const st = this.ring[old.ring];
      if (st.phase === REST && !st.busy && st.offset === 0) this.setAngle(old.ring, this.k[old.ring] * STEP_ANGLE);
    }
    this.hint = choice ? { ring: choice.ring, dir: choice.dir } : null;
    this.hintT = 0;
  }

  // ───────────────────────────── Modes & celebrations ─────────────────────────────

  private blendTo(target: number, duration: number): TweenHandle {
    const from = this.modeBlend;
    return this.keyedTw('mode', {
      duration,
      ease: inOutSine,
      onUpdate: (e) => {
        const v = from + (target - from) * e;
        this.modeBlend = v;
        this.sky.modeBlend = v;
        this.orrery.modeBlend = v;
      },
    });
  }

  async setMode(mode: GameMode, opts?: { animate?: boolean }): Promise<void> {
    if (!this.ready || this.dead) return;
    const changed = mode !== this.mode;
    const target = mode === 'free' ? 1 : 0;
    this.mode = mode;
    if (!opts?.animate || !changed) {
      this.blendTo(target, 0).finish();
      if (changed) this.emit({ type: 'modeShift', mode });
      return;
    }
    if (mode === 'free') {
      // The comet crosses first; the world turns in its wake.
      this.emit({ type: 'cometPass' });
      const pass = this.settle(this.vfx.cometPass({ duration: 1.6 }), 2.2);
      await this.wait(0.7);
      if (this.dead || this.mode !== mode) return;
      this.emit({ type: 'modeShift', mode });
      await Promise.all([pass, this.blendTo(target, 2)]);
      return;
    }
    this.emit({ type: 'modeShift', mode });
    await this.blendTo(target, 2);
  }

  async celebrateScatters(cells: Cell[]): Promise<void> {
    if (!this.ready || this.dead || !cells.length) return;
    const lit: SymbolView[] = [];
    const meta = SYMBOLS[SYM.SCATTER];
    cells.forEach((cell, i) =>
      this.at(i * 0.25, () => {
        const v = this.viewAt(cell.ring, cell.spoke);
        if (!v) return;
        lit.push(v);
        this.cellPos(cell.ring, cell.spoke, this.v1);
        this.vfx.flash(this.v1, meta.color, 1.3);
        this.vfx.sparks(this.v1, meta.accent, 10, 2.6);
        this.punch(v, 1.35, 0.45, 0, true);
        this.bumpStar(0.3);
      }),
    );
    await this.wait((cells.length - 1) * 0.25 + 0.5);
    await this.tw({
      duration: 0.25,
      onUpdate: (e) => {
        for (const v of lit) v.glow = WIN_GLOW * (1 - e);
      },
    });
  }

  bigWin(tier: BigWinTier | null): void {
    if (!this.ready || this.dead) return;
    this.vfx.fountain(tier ?? 0);
    this.bigOn = tier !== null;
    if (tier) this.bigTier = tier;
    // Unwind the short way round when the orbit ends.
    else this.cam.bigAz = mod(this.cam.bigAz + Math.PI, TAU) - Math.PI;
    void this.camTo('big', tier ? 1 : 0, tier ? 1.4 : 1.2, inOutSine);
  }

  attract(on: boolean): void {
    if (!this.ready || this.dead) return;
    this.attractOn = on;
    if (on) {
      // At boot there is nothing to move from: start in the splash framing.
      if (this.stage.time < 0.05) this.camTo('attract', 1, 0, outCubic).finish();
      else void this.camTo('attract', 1, 1.2, inOutCubic);
      return;
    }
    this.cam.attractAz = mod(this.cam.attractAz + Math.PI, TAU) - Math.PI;
    void this.camTo('attract', 0, 1.0, inOutCubic);
  }

  async intro(): Promise<void> {
    if (!this.ready || this.dead) return;
    this.attractOn = false;
    const c = this.cam;
    c.attractAz = mod(c.attractAz + Math.PI, TAU) - Math.PI;
    const from = c.attract;
    let pulsed = false;
    await this.keyedTw('cam.attract', {
      duration: this.stage.reducedMotion ? 0.6 : 1.6,
      ease: inOutCubic,
      onUpdate: (e, t) => {
        c.attract = from * (1 - e);
        if (!pulsed && t >= 0.6) {
          pulsed = true;
          this.bumpStar(1.2);
        }
      },
    });
  }

  shake(amount: number): void {
    if (this.ready && !this.dead) this.stage.rig.shake(amount);
  }

  thumbnail(id: SymbolId, sizePx: number): string {
    return this.symbols.thumbnail(id, sizePx);
  }

  // ───────────────────────────── Screen anchors ─────────────────────────────

  cellScreen(cell: Cell): ScreenPoint {
    return this.stage.project(this.cellPos(cell.ring, cell.spoke, this.v2));
  }

  spokeTipScreen(spoke: number): ScreenPoint {
    const a = spoke * STEP_ANGLE;
    return this.stage.project(this.v2.set(Math.sin(a) * BEZEL_INNER, RING_Y[RINGS - 1] + 0.05, -Math.cos(a) * BEZEL_INNER));
  }

  starScreen(): ScreenPoint {
    // The fixed centre, not star.position: that one carries the tremor.
    return this.stage.project(this.v2.set(0, STAR_Y, 0));
  }
}

export function createGameView(): IGameView {
  return new GameView();
}
