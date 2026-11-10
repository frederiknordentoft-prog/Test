/**
 * VFX: every particle, beam, trail and blast in Stella Nova.
 *
 * All positions passed in are world space; keep `group` at the scene origin.
 * Everything here is additive light over the dark instrument and blooms
 * through the stage's shared pipeline. Motion lives in shaders on the shared
 * clock (stage.uTime); the few things that need a timeline use `anim`.
 *
 * Draw calls: 0 at rest with ambient off, 1 with ambient on. In flight:
 * particles 1, beams + ghosts 1, shooting-star tails 1, trails 1 per whirling
 * ring, shockwave 1, comet 1.
 */
import * as THREE from 'three';
import { anim } from '../core/anim';
import { FIT_RADIUS, PALETTE, STAR_Y, SYM, SYMBOL_Y, SYMBOLS } from '../core/config';
import type { Stage } from './stage';
import { BeamField, type BeamHandle } from './vfx/beams';
import { Comet } from './vfx/comet';
import { light } from './vfx/common';
import { Motes } from './vfx/motes';
import { P_DUST, P_FLASH, P_GLINT, P_GLOW, P_HEAD, P_RING, P_SHARD, P_SPARK, ParticlePool } from './vfx/particles';
import { ShockRing } from './vfx/shock';
import { STREAK_EASE, StarStreaks } from './vfx/streaks';
import { RingTrails } from './vfx/trails';

export type { BeamHandle } from './vfx/beams';

const TAU = Math.PI * 2;
/** Gravity for things that should feel like glass and metal on a table-top instrument. */
const GRAVITY = 11;
/** Fountain emission per second by tier. */
const SPRAY_RATE = [0, 210, 360, 430] as const;
/** Colours the fountain and fireworks draw from: gold first, then the jewels. */
const FESTIVE = [
  PALETTE.gold,
  PALETTE.starCore,
  PALETTE.starWarm,
  PALETTE.comet,
  SYMBOLS[SYM.RUBY].color,
  SYMBOLS[SYM.SAPPHIRE].color,
  SYMBOLS[SYM.EMERALD].color,
  SYMBOLS[SYM.AMETHYST].color,
] as const;

export class Vfx {
  readonly group = new THREE.Group();

  private readonly stage: Stage;
  private readonly pool: ParticlePool;
  private readonly beams: BeamField;
  private readonly trails: RingTrails;
  private readonly streaks: StarStreaks;
  private readonly shock: ShockRing;
  private readonly comet: Comet;
  private readonly motes: Motes;

  /** FESTIVE as linear light, three floats per colour. */
  private readonly festive = new Float32Array(FESTIVE.length * 3);
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();

  private ambientLevel = 0;
  private tier: 0 | 1 | 2 | 3 = 0;
  private sprayAcc = 0;
  private burstIn = 0;
  private fireworkIn = 0;
  private glitterAcc = 0;

  constructor(stage: Stage) {
    this.stage = stage;
    this.group.name = 'vfx';
    this.pool = new ParticlePool(stage);
    this.beams = new BeamField(stage);
    this.trails = new RingTrails(stage);
    this.streaks = new StarStreaks(stage);
    this.shock = new ShockRing(stage);
    this.comet = new Comet(stage, this.shedGlitter);
    this.motes = new Motes(stage);
    this.group.add(this.trails.group, this.motes.points, this.beams.mesh, this.streaks.mesh, this.pool.mesh, this.shock.mesh, this.comet.mesh);
    for (let i = 0; i < FESTIVE.length; i++) {
      const c = light(FESTIVE[i], 1, 0.1);
      this.festive.set([c.r, c.g, c.b], i * 3);
    }
  }

  private get now(): number {
    return this.stage.uTime.value;
  }

  /** Particle-count scale for the device and the motion preference. */
  private get density(): number {
    const q = this.stage.quality;
    return (q === 'low' ? 0.55 : q === 'medium' ? 0.8 : 1) * (this.stage.reducedMotion ? 0.5 : 1);
  }

  /** Shader clocks run on stage time, promises on anim time: this converts a duration between them. */
  private get clockScale(): number {
    return anim.speed > 0 ? 1 / anim.speed : 1;
  }

  update(dt: number): void {
    this.pool.update();
    this.streaks.update();
    this.motes.update();
    if (this.tier > 0) this.emitFountain(dt);
  }

  // ───────────────────────────── One-shots ─────────────────────────────

  /** Gem shatter: shards, sparks, a bloom pop. */
  burst(pos: THREE.Vector3, color: THREE.ColorRepresentation, power = 1): void {
    const p = this.pool;
    const rng = this.stage.rng;
    const now = this.now;
    const k = this.density;
    const pw = Math.min(2, Math.max(0.4, power));
    const sq = Math.sqrt(pw);
    const x = pos.x;
    const y = pos.y;
    const z = pos.z;
    const floorY = y - SYMBOL_Y + 0.02;

    let c = light(color, 1, 0.1);
    const cr = c.r, cg = c.g, cb = c.b;
    c = light(color, 1, 0.5);
    const wr = c.r, wg = c.g, wb = c.b;
    c = light(color, 3.2 * sq, 0.42);

    // Hot core, coloured falloff, a ripple on the enamel.
    p.emit(P_FLASH, x, y + 0.05, z, 0, 0, 0, 0, 0, 0, now, 0.22, c.r, c.g, c.b, 0.82 * sq, rng.next(), 1, 0);
    p.emit(P_GLOW, x, y, z, 0, 0, 0, 0, 1, 0, now, 0.46, cr * 1.7, cg * 1.7, cb * 1.7, 0.8 * sq, rng.next(), 1.7, 0);
    p.emit(P_RING, x, floorY, z, 0, 0, 0, 0, 0, 0, now, 0.4, cr * 2.2, cg * 2.2, cb * 2.2, 0.95 * sq, rng.next(), 0.22, 0);

    // Shards: thrown up and out, they tumble, land on the board and skid.
    const shards = Math.round(Math.min(40, Math.max(20, 30 * pw)) * k);
    for (let i = 0; i < shards; i++) {
      const a = rng.range(0, TAU);
      const sa = Math.sin(a);
      const ca = Math.cos(a);
      const h = rng.range(0.35, 1.75) * sq;
      const pale = rng.next() < 0.25;
      const gain = rng.range(1.2, 2.2);
      p.emit(
        P_SHARD,
        x + sa * 0.12, y + rng.range(-0.04, 0.12), z + ca * 0.12,
        sa * h, rng.range(1.3, 3.7) * sq, ca * h,
        GRAVITY, 0, floorY,
        now, rng.range(0.55, 0.95),
        (pale ? wr : cr) * gain, (pale ? wg : cg) * gain, (pale ? wb : cb) * gain,
        rng.range(0.08, 0.17), rng.next(), 0, rng.range(7, 19) * (rng.next() < 0.5 ? -1 : 1),
      );
    }

    this.spray(x, y, z, wr, wg, wb, Math.round(16 * pw * k), 4.2 * sq, now);

    // Glitter that outlives the flash: the tail of the event.
    const glints = Math.round(8 * pw * k);
    for (let i = 0; i < glints; i++) {
      const a = rng.range(0, TAU);
      const h = rng.range(0.3, 1.3);
      const gain = rng.range(1.8, 3.0);
      p.emit(
        P_GLINT,
        x, y + 0.1, z,
        Math.sin(a) * h, rng.range(0.6, 1.8), Math.cos(a) * h,
        1.4, 2.4, 0,
        now + rng.range(0, 0.08), rng.range(0.55, 0.95),
        wr * gain, wg * gain, wb * gain,
        rng.range(0.08, 0.14), rng.next(), rng.range(16, 30), 0,
      );
    }
  }

  /** Small metal sparks (ring stop, detent). */
  sparks(pos: THREE.Vector3, color: THREE.ColorRepresentation, count = 12, speed = 3): void {
    const c = light(color, 1, 0.3);
    const r = c.r, g = c.g, b = c.b;
    const now = this.now;
    this.spray(pos.x, pos.y, pos.z, r, g, b, Math.max(1, Math.round(count * this.density)), speed, now);
    const s = Math.min(1.6, 0.5 + speed / 6);
    this.pool.emit(P_FLASH, pos.x, pos.y, pos.z, 0, 0, 0, 0, 0, 0, now, 0.13, r * 2.4, g * 2.4, b * 2.4, 0.3 * s, this.stage.rng.next(), 0.5, 0);
  }

  /** Additive pop. */
  flash(pos: THREE.Vector3, color: THREE.ColorRepresentation, size = 1): void {
    const rng = this.stage.rng;
    const now = this.now;
    let c = light(color, 4.6, 0.6);
    this.pool.emit(P_FLASH, pos.x, pos.y, pos.z, 0, 0, 0, 0, 0, 0, now, 0.26, c.r, c.g, c.b, 1.25 * size, rng.next(), 1, 0);
    c = light(color, 0.85, 0.1);
    this.pool.emit(P_GLOW, pos.x, pos.y, pos.z, 0, 0, 0, 0, 1, 0, now, 0.32, c.r, c.g, c.b, 1.6 * size, rng.next(), 1.5, 0);
  }

  /**
   * Dust that curls from a cell into the star. Resolves after `duration`,
   * when the head of the stream reaches the star; the rest keeps pouring in
   * for about 40 percent as long again.
   */
  stardust(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, opts?: { count?: number; duration?: number }): Promise<void> {
    const p = this.pool;
    const rng = this.stage.rng;
    const now = this.now;
    const duration = opts?.duration ?? 0.55;
    const D = duration * this.clockScale;
    const n = Math.max(6, Math.round((opts?.count ?? 30) * this.density));

    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    // Far cells swing wider and arc higher; the hub's neighbours barely need to.
    const reach = Math.min(1, dist / 4.25);

    let c = light(color, 1, 0.06);
    const cr = c.r, cg = c.g, cb = c.b;
    c = light(color, 1, 0.42);
    const wr = c.r, wg = c.g, wb = c.b;

    for (let i = 0; i < n; i++) {
      const f = i / n;
      const ja = rng.range(0, TAU);
      const jr = rng.range(0, 0.2);
      const pale = rng.next() < 0.35;
      // A few larger sparkles carry the glitter; the rest is fine dust.
      const hero = rng.next() < 0.16;
      const gain = hero ? rng.range(2.4, 3.6) : rng.range(1.5, 2.8);
      p.emit(
        P_DUST,
        from.x + Math.sin(ja) * jr, from.y + rng.range(-0.06, 0.1), from.z + Math.cos(ja) * jr,
        (1.0 + 0.9 * reach) * rng.range(0.85, 1.15), (0.35 + 0.75 * reach) * rng.range(0.7, 1.3), rng.range(0.15, 0.5),
        to.x + rng.range(-0.04, 0.04), to.y + rng.range(-0.04, 0.04), to.z + rng.range(-0.04, 0.04),
        now + (f * 0.4 + rng.range(0, 0.03)) * D, D * rng.range(0.88, 1.0),
        (pale ? wr : cr) * gain, (pale ? wg : cg) * gain, (pale ? wb : cb) * gain,
        hero ? rng.range(0.18, 0.26) : rng.range(0.07, 0.13), rng.next(), rng.range(1.65, 2.2), rng.range(0.04, 0.11),
      );
    }
    // The cell breathes out as the dust leaves it.
    p.emit(P_GLOW, from.x, from.y, from.z, 0, 0, 0, 0, 1, 0, now, 0.4 * D, cr * 0.9, cg * 0.9, cb * 0.9, 0.6, rng.next(), 1.6, 0);
    return anim.wait(duration);
  }

  /** A shooting star from the sky into a cell. Resolves on impact. */
  shootingStar(to: THREE.Vector3, color: THREE.ColorRepresentation, opts?: { duration?: number }): Promise<void> {
    const p = this.pool;
    const rng = this.stage.rng;
    const now = this.now;
    const k = this.density;
    const duration = opts?.duration ?? 0.4;
    const D = duration * this.clockScale;
    const x2 = to.x;
    const y2 = to.y;
    const z2 = to.z;

    // From high above and behind the instrument, on a slightly bowed fall.
    const x0 = x2 + rng.range(-3.4, 3.4);
    const y0 = y2 + rng.range(7.5, 10.5);
    const z0 = z2 - rng.range(6, 10);
    const x1 = (x0 + x2) * 0.5 + rng.range(-0.8, 0.8);
    const y1 = (y0 + y2) * 0.5 + rng.range(0.4, 1.4);
    const z1 = (z0 + z2) * 0.5;

    let c = light(color, 1, 0.12);
    const cr = c.r, cg = c.g, cb = c.b;
    c = light(color, 1, 0.5);
    const hr = c.r, hg = c.g, hb = c.b;
    const seed = rng.next();

    this.streaks.launch(x0, y0, z0, x1, y1, z1, x2, y2, z2, now, D, cr, cg, cb, 0.12, seed);
    p.emit(P_HEAD, x0, y0, z0, x1, y1, z1, x2, y2, z2, now, D, hr * 3.0, hg * 3.0, hb * 3.0, 0.27, seed, STREAK_EASE, 0);

    // Glitter shed along the last stretch of the fall.
    const shed = Math.round(9 * k);
    for (let i = 0; i < shed; i++) {
      const s = rng.range(0.3, 0.97);
      const inv = 1 - s;
      const gain = rng.range(1.8, 3.2);
      p.emit(
        P_GLINT,
        x0 * inv * inv + x1 * 2 * inv * s + x2 * s * s + rng.range(-0.08, 0.08),
        y0 * inv * inv + y1 * 2 * inv * s + y2 * s * s + rng.range(-0.08, 0.08),
        z0 * inv * inv + z1 * 2 * inv * s + z2 * s * s + rng.range(-0.08, 0.08),
        rng.range(-0.4, 0.4), rng.range(-0.6, 0.1), rng.range(-0.4, 0.4),
        0.8, 2, 0,
        now + Math.pow(s, 1 / STREAK_EASE) * D, rng.range(0.28, 0.6),
        hr * gain, hg * gain, hb * gain,
        rng.range(0.07, 0.12), rng.next(), rng.range(18, 32), 0,
      );
    }

    // Impact, scheduled on the same clock as the fall so it can never miss the head.
    const hit = now + D;
    p.emit(P_FLASH, x2, y2 + 0.05, z2, 0, 0, 0, 0, 0, 0, hit, 0.2, hr * 2.9, hg * 2.9, hb * 2.9, 0.62, rng.next(), 1, 0);
    p.emit(P_GLOW, x2, y2, z2, 0, 0, 0, 0, 1, 0, hit, 0.36, cr * 1.2, cg * 1.2, cb * 1.2, 0.6, rng.next(), 1.6, 0);
    p.emit(P_RING, x2, y2 - SYMBOL_Y + 0.02, z2, 0, 0, 0, 0, 0, 0, hit, 0.38, cr * 1.8, cg * 1.8, cb * 1.8, 0.72, rng.next(), 0.2, 0);
    this.spray(x2, y2, z2, hr, hg, hb, Math.round(7 * k), 2.8, hit);
    return anim.wait(duration);
  }

  /** World-space ring plus stage.fx.shock* refraction. */
  shockwave(center: THREE.Vector3, opts?: { duration?: number; maxRadius?: number; color?: THREE.ColorRepresentation }): Promise<void> {
    const p = this.pool;
    const rng = this.stage.rng;
    const now = this.now;
    const color = opts?.color ?? PALETTE.starWarm;
    let c = light(color, 6.5, 0.7);
    p.emit(P_FLASH, center.x, center.y, center.z, 0, 0, 0, 0, 0, 0, now, 0.34, c.r, c.g, c.b, 2.7, rng.next(), 1, 0);

    if (!this.stage.reducedMotion) {
      // Embers torn off by the front: fast radial streaks that die around the bezel.
      c = light(color, 1, 0.4);
      const r = c.r, g = c.g, b = c.b;
      const n = Math.round(64 * this.density);
      for (let i = 0; i < n; i++) {
        const a = ((i + rng.next()) / n) * TAU;
        const sp = rng.range(8, 21);
        const gain = rng.range(2.2, 4.2);
        const streak = rng.next() < 0.62;
        p.emit(
          streak ? P_SPARK : P_GLINT,
          center.x + Math.sin(a) * 0.5, center.y - rng.range(0.05, 0.3), center.z + Math.cos(a) * 0.5,
          Math.sin(a) * sp, rng.range(0.2, 1.6), Math.cos(a) * sp,
          1.6, 2.7, 0,
          now + rng.range(0, 0.05), rng.range(0.5, 1.0),
          r * gain, g * gain, b * gain,
          streak ? rng.range(0.035, 0.06) : rng.range(0.09, 0.15), rng.next(), streak ? 0.32 : rng.range(16, 30), 0,
        );
      }
    }
    return this.shock.fire(center, opts);
  }

  /** A great comet crossing the whole frame. */
  cometPass(opts?: { duration?: number }): Promise<void> {
    return this.comet.pass(opts?.duration ?? 1.6);
  }

  // ───────────────────────────── Persistent ─────────────────────────────

  /** Light from the star out along a spoke through `count` rings. */
  beam(spoke: number, count: 3 | 4, color: THREE.ColorRepresentation): BeamHandle {
    return this.beams.create(spoke, count, color, false);
  }

  /** Faint preview of a beam. */
  ghostBeam(spoke: number, count: 3 | 4, color: THREE.ColorRepresentation): BeamHandle {
    return this.beams.create(spoke, count, color, true);
  }

  /** Star-trail arcs behind a whirling ring's symbols. speed01 = 0 hides them. angle = the ring's current angle. */
  setTrail(ring: number, speed01: number, colors: THREE.ColorRepresentation[], angle: number, dir: 1 | -1): void {
    this.trails.set(ring, speed01, colors, angle, dir);
  }

  /** Big-win fountain of stars and gold. 0 stops. */
  fountain(tier: 0 | 1 | 2 | 3): void {
    if (tier === this.tier) return;
    const rising = tier > this.tier;
    this.tier = tier;
    if (tier === 0) return;
    if (rising) {
      // Each step up opens with a punch so the escalation is felt.
      this.fountainBurst(0.7 + tier * 0.25);
      this.burstIn = 0.55;
      this.fireworkIn = 0.12;
    }
  }

  /** 0..1 density of the dust motes drifting in the star's light. */
  get ambient(): number {
    return this.ambientLevel;
  }
  set ambient(v: number) {
    this.ambientLevel = v < 0 ? 0 : v > 1 ? 1 : v;
    this.motes.amount = this.ambientLevel;
  }

  dispose(): void {
    this.tier = 0;
    this.group.removeFromParent();
    this.pool.dispose();
    this.beams.dispose();
    this.trails.dispose();
    this.streaks.dispose();
    this.shock.dispose();
    this.comet.dispose();
    this.motes.dispose();
  }

  // ───────────────────────────── Internals ─────────────────────────────

  /** Velocity-aligned sparks thrown up and out from a point, born at `birth`. */
  private spray(x: number, y: number, z: number, r: number, g: number, b: number, count: number, speed: number, birth: number): void {
    const p = this.pool;
    const rng = this.stage.rng;
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, TAU);
      const up = rng.range(0.1, 0.95);
      const h = Math.sqrt(1 - up * up);
      const sp = speed * rng.range(0.45, 1.25);
      const gain = rng.range(3.0, 5.5);
      p.emit(
        P_SPARK,
        x, y, z,
        Math.sin(a) * h * sp, up * sp, Math.cos(a) * h * sp,
        GRAVITY * 0.85, 2.3, 0,
        birth, rng.range(0.16, 0.42),
        r * gain, g * gain, b * gain,
        rng.range(0.024, 0.044), rng.next(), 0.5, 0,
      );
    }
  }

  private emitFountain(dt: number): void {
    const rng = this.stage.rng;
    const now = this.now;
    this.sprayAcc += SPRAY_RATE[this.tier] * this.density * dt;
    // A long frame must not dump a second's worth of stars at once.
    let n = Math.min(40, Math.floor(this.sprayAcc));
    this.sprayAcc -= Math.floor(this.sprayAcc);
    while (n-- > 0) this.sprayStar(now + rng.range(0, dt), 1);

    if (this.tier >= 2) {
      this.burstIn -= dt;
      if (this.burstIn <= 0) {
        this.burstIn = rng.range(0.5, 0.8);
        this.fountainBurst(this.tier === 3 ? 1.15 : 0.9);
      }
    }
    if (this.tier >= 3) {
      this.fireworkIn -= dt;
      if (this.fireworkIn <= 0) {
        this.fireworkIn = rng.range(0.26, 0.48);
        this.firework();
      }
    }
  }

  /** One star of the fountain: up out of the star, over the rings, down toward the rim. */
  private sprayStar(birth: number, power: number): void {
    const p = this.pool;
    const rng = this.stage.rng;
    const a = rng.range(0, TAU);
    const tilt = rng.range(0.1, 0.56);
    const sp = rng.range(6.4, 9.2) * power;
    const h = Math.sin(tilt) * sp;
    const pick = rng.next();
    const o = (pick < 0.5 ? 0 : pick < 0.78 ? 1 : 2) * 3;
    const gain = rng.range(1.8, 3.4);
    const f = this.festive;
    const sa = Math.sin(a);
    const ca = Math.cos(a);
    const streak = rng.next() < 0.45;
    p.emit(
      streak ? P_SPARK : P_GLINT,
      sa * 0.18, STAR_Y + 0.25, ca * 0.18,
      sa * h, Math.cos(tilt) * sp, ca * h,
      9.5, 0.42, 0,
      birth, rng.range(1.15, 1.75),
      f[o] * gain, f[o + 1] * gain, f[o + 2] * gain,
      streak ? rng.range(0.03, 0.05) : rng.range(0.07, 0.13), rng.next(), streak ? 0.3 : rng.range(12, 30), 0,
    );
  }

  /** A crown: a hollow cone of faster stars and a pop at the star. */
  private fountainBurst(power: number): void {
    const p = this.pool;
    const rng = this.stage.rng;
    const now = this.now;
    const f = this.festive;
    const n = Math.round(70 * power * this.density);
    for (let i = 0; i < n; i++) {
      const a = ((i + rng.next()) / n) * TAU;
      const tilt = rng.range(0.42, 0.62);
      const sp = rng.range(8.6, 10.4) * (0.85 + 0.15 * power);
      const h = Math.sin(tilt) * sp;
      const o = (rng.next() < 0.6 ? 0 : 1) * 3;
      const gain = rng.range(2.4, 4.0);
      const streak = rng.next() < 0.6;
      p.emit(
        streak ? P_SPARK : P_GLINT,
        0, STAR_Y + 0.25, 0,
        Math.sin(a) * h, Math.cos(tilt) * sp, Math.cos(a) * h,
        9.5, 0.5, 0,
        now + rng.range(0, 0.04), rng.range(1.0, 1.5),
        f[o] * gain, f[o + 1] * gain, f[o + 2] * gain,
        streak ? rng.range(0.035, 0.055) : rng.range(0.09, 0.15), rng.next(), streak ? 0.3 : rng.range(14, 30), 0,
      );
    }
    p.emit(P_FLASH, 0, STAR_Y + 0.2, 0, 0, 0, 0, 0, 0, 0, now, 0.28, f[0] * 4.2, f[1] * 4.2, f[2] * 4.2, 1.5 * power, rng.next(), 1, 0);
  }

  /** A firework star burst somewhere in the free frame around the instrument. */
  private firework(): void {
    const p = this.pool;
    const rng = this.stage.rng;
    const cam = this.stage.camera;
    const now = this.now;
    const f = this.festive;

    // Find a spot on screen that is not over the board, then lift it into the air above the rim.
    const centre = this.tmpA.set(0, 0, 0).project(cam);
    const cx = centre.x;
    const cy = centre.y;
    const edge = this.tmpB.setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(FIT_RADIUS).project(cam);
    const boardR = Math.hypot((edge.x - cx) * cam.aspect, edge.y - cy) * 0.86;
    let nx = 0;
    let ny = 0;
    for (let tries = 0; tries < 10; tries++) {
      nx = rng.range(-0.9, 0.9);
      ny = rng.range(-0.85, 0.9);
      if (Math.hypot((nx - cx) * cam.aspect, ny - cy) > boardR) break;
    }
    const dir = this.tmpC.set(nx, ny, 0.5).unproject(cam).sub(cam.position);
    const planeY = rng.range(1.4, 2.6);
    const t = dir.y < -1e-4 ? (planeY - cam.position.y) / dir.y : 20;
    const x = cam.position.x + dir.x * t;
    const y = cam.position.y + dir.y * t;
    const z = cam.position.z + dir.z * t;

    const o = rng.int(FESTIVE.length) * 3;
    const r = f[o], g = f[o + 1], b = f[o + 2];
    const n = Math.round(rng.range(54, 78) * this.density);
    const speed = rng.range(3.6, 5.2);
    for (let i = 0; i < n; i++) {
      // Uniform on the sphere, so from above it opens as a round dandelion.
      const u = rng.range(-1, 1);
      const a = rng.range(0, TAU);
      const h = Math.sqrt(1 - u * u);
      const sp = speed * rng.range(0.82, 1.0);
      const gain = rng.range(2.6, 4.4);
      p.emit(
        P_SPARK,
        x, y, z,
        Math.cos(a) * h * sp, u * sp, Math.sin(a) * h * sp,
        1.8, 2.6, 0,
        now, rng.range(0.7, 1.05),
        r * gain, g * gain, b * gain,
        rng.range(0.035, 0.05), rng.next(), 0.42, 0,
      );
    }
    const glints = Math.round(14 * this.density);
    for (let i = 0; i < glints; i++) {
      const u = rng.range(-1, 1);
      const a = rng.range(0, TAU);
      const h = Math.sqrt(1 - u * u);
      const sp = speed * rng.range(0.3, 0.9);
      p.emit(
        P_GLINT,
        x, y, z,
        Math.cos(a) * h * sp, u * sp, Math.sin(a) * h * sp,
        1.2, 2.4, 0,
        now + rng.range(0.1, 0.4), rng.range(0.7, 1.2),
        (r * 0.6 + 0.4) * 2.6, (g * 0.6 + 0.4) * 2.6, (b * 0.6 + 0.4) * 2.6,
        rng.range(0.09, 0.15), rng.next(), rng.range(16, 30), 0,
      );
    }
    p.emit(P_FLASH, x, y, z, 0, 0, 0, 0, 0, 0, now, 0.24, (r * 0.4 + 0.6) * 4.5, (g * 0.4 + 0.6) * 4.5, (b * 0.4 + 0.6) * 4.5, 1.25, rng.next(), 1, 0);
  }

  /** Sparkle the comet leaves hanging in the air behind its head. */
  private readonly shedGlitter = (x: number, y: number, z: number, tx: number, ty: number, tz: number, dt: number): void => {
    const p = this.pool;
    const rng = this.stage.rng;
    const now = this.now;
    const f = this.festive;
    this.glitterAcc += 190 * this.density * dt;
    let n = Math.min(28, Math.floor(this.glitterAcc));
    this.glitterAcc -= Math.floor(this.glitterAcc);
    while (n-- > 0) {
      const back = rng.range(0, 1.8);
      const white = rng.range(0.1, 0.7);
      const gain = rng.range(1.6, 3.4);
      p.emit(
        P_GLINT,
        x - tx * back + rng.range(-0.3, 0.3), y - ty * back + rng.range(-0.3, 0.3), z - tz * back + rng.range(-0.3, 0.3),
        tx * 1.4 + rng.range(-0.4, 0.4), rng.range(-0.5, 0.1), tz * 1.4 + rng.range(-0.4, 0.4),
        0.35, 2.6, 0,
        now, rng.range(0.8, 1.7),
        (f[9] * (1 - white) + white) * gain, (f[10] * (1 - white) + white) * gain, (f[11] * (1 - white) + white) * gain,
        rng.range(0.07, 0.15), rng.next(), rng.range(12, 28), 0,
      );
    }
  };
}
