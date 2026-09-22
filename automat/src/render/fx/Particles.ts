// NORDLYS · pooled additive particles (CONTRACTS.md §7).
//
// One Pixi v8 ParticleContainer + a fixed pool of Particle objects (created once in the constructor).
// Live particles are kept compact at the front of `particleChildren` (swap-remove on death), so the
// GPU upload and the draw cover exactly the live count. All kinds share one procedural 2-channel atlas
// (parts/atlas.ts) and a custom shader: G = tinted body, R = white-hot core scaled by per-particle heat.
//
// Kinds (public):  spark    streak oriented along velocity, drag + light gravity, hot core cools fast
//                  ember    hot dot, motion-stretched, flicker + turbulence; buoyant unless `gravity` given
//                  snow     tiny ice flakes (landing dust): puff, drift, settle
//                  dust     soft bokeh specks, slow
//                  shardlet spinning glass slivers with specular flashes, heavy gravity
//                  glint    4-point star twinkle (sun / wins)
// Internal kinds (emitFx): flash (soft bloom pop), ring (expanding shock ring), spike (anamorphic streak).
//
// update(dt) is allocation-free; dt = 0 (hit-stop) freezes everything exactly.
// Cost: ~0.25 µs/particle CPU (SwiftShader-independent), one draw call, upload = live × 128 B.
import { Container, Particle, ParticleContainer, type Texture } from 'pixi.js';
import { crand } from '../../core/cosmeticRng.ts';
import { ATLAS_SLOTS, atlasFrame } from './parts/atlas.ts';
import { createParticleShader } from './parts/particleShader.ts';
import { packRGBA } from './parts/gl.ts';

export type ParticleKind = 'spark' | 'ember' | 'snow' | 'dust' | 'shardlet' | 'glint';
/** Superset used internally by the shatter systems. */
export type FxKind = ParticleKind | 'flash' | 'ring' | 'spike';

export interface EmitOptions {
  color?: number; speed?: number; spread?: number; angle?: number; life?: number; gravity?: number; size?: number;
}
/** Extra knobs for internal emitters. */
export interface EmitFxOptions extends EmitOptions {
  /** Initial velocity added to the random one (px/s). */
  vx?: number; vy?: number;
  /** Random position jitter radius (px). */
  jitter?: number;
  /** Core (white-hot) multiplier. */
  heat?: number;
  /** Body intensity multiplier. */
  intensity?: number;
  /** Drag override (1/s). */
  drag?: number;
  /** Spawn delay in seconds (particle is invisible until then). */
  delay?: number;
}

const K = { spark: 0, ember: 1, snow: 2, dust: 3, shardlet: 4, glint: 5, flash: 6, ring: 7, spike: 8 } as const;
type KindId = (typeof K)[keyof typeof K];

interface KindDef {
  slot: number; size: number; aspect: number;
  speed: number; spread: number; angle: number; life: number; gravity: number; drag: number;
  color: number; heat: number; intensity: number; spin: number; jitter: number;
}
const TAU = Math.PI * 2;
const DEF: KindDef[] = [];
DEF[K.spark] = { slot: ATLAS_SLOTS.streak, size: 24, aspect: 0.3, speed: 240, spread: TAU, angle: -Math.PI / 2, life: 0.5, gravity: 260, drag: 2.4, color: 0xeaf8ff, heat: 1.0, intensity: 1.0, spin: 0, jitter: 3 };
DEF[K.ember] = { slot: ATLAS_SLOTS.ember, size: 11, aspect: 1, speed: 120, spread: TAU, angle: -Math.PI / 2, life: 1.0, gravity: -26, drag: 1.1, color: 0xff6a00, heat: 0.9, intensity: 1.0, spin: 0, jitter: 3 };
DEF[K.snow] = { slot: ATLAS_SLOTS.flake, size: 16, aspect: 1, speed: 60, spread: 1.4, angle: -Math.PI / 2, life: 0.7, gravity: 34, drag: 3.2, color: 0xeaf8ff, heat: 0.6, intensity: 0.9, spin: 2.5, jitter: 6 };
DEF[K.dust] = { slot: ATLAS_SLOTS.bokeh, size: 12, aspect: 1, speed: 30, spread: TAU, angle: -Math.PI / 2, life: 1.4, gravity: -6, drag: 1.4, color: 0x9cc9ff, heat: 0, intensity: 0.4, spin: 0, jitter: 8 };
DEF[K.shardlet] = { slot: ATLAS_SLOTS.shard, size: 11, aspect: 1, speed: 260, spread: TAU, angle: -Math.PI / 2, life: 0.8, gravity: 900, drag: 0.8, color: 0xeaf8ff, heat: 0.45, intensity: 1.0, spin: 14, jitter: 4 };
DEF[K.glint] = { slot: ATLAS_SLOTS.glint, size: 34, aspect: 1, speed: 160, spread: TAU, angle: -Math.PI / 2, life: 0.9, gravity: 0, drag: 3.4, color: 0xffd36b, heat: 1.0, intensity: 1.25, spin: 0.8, jitter: 4 };
DEF[K.flash] = { slot: ATLAS_SLOTS.flash, size: 90, aspect: 1, speed: 0, spread: 0, angle: 0, life: 0.18, gravity: 0, drag: 0, color: 0xfff4e0, heat: 0.9, intensity: 0.75, spin: 0, jitter: 0 };
DEF[K.ring] = { slot: ATLAS_SLOTS.ring, size: 70, aspect: 1, speed: 0, spread: 0, angle: 0, life: 0.32, gravity: 0, drag: 0, color: 0xeaf8ff, heat: 0.6, intensity: 0.8, spin: 0, jitter: 0 };
DEF[K.spike] = { slot: ATLAS_SLOTS.spike, size: 120, aspect: 0.16, speed: 0, spread: 0, angle: 0, life: 0.22, gravity: 0, drag: 0, color: 0xfff4e0, heat: 0.8, intensity: 0.6, spin: 0, jitter: 0 };

const TEXW = 63; // atlas frame width (64 − 2 × 0.5 inset)

class FxParticle extends Particle {
  kind: KindId = 0;
  vx = 0; vy = 0;
  age = 0; life = 1; delay = 0;
  base = 10; aspect = 1;
  drag = 0; grav = 0; spin = 0; seed = 0;
  r = 1; g = 1; b = 1;
  heat = 1; inten = 1;
}

export class Particles extends Container {
  readonly pc: ParticleContainer;
  private all: FxParticle[] = [];
  private live: FxParticle[];
  private n = 0;
  private budget: number;
  private steal = 0;
  private textures: Texture[] = [];

  constructor(max: number) {
    super();
    this.label = 'fx-particles';
    const cap = Math.max(16, Math.floor(max));
    for (let k = 0; k < DEF.length; k++) this.textures[k] = atlasFrame(DEF[k].slot);
    for (let i = 0; i < cap; i++) {
      const p = new FxParticle({ texture: this.textures[0], anchorX: 0.5, anchorY: 0.5 });
      this.all.push(p);
    }
    this.budget = cap;
    this.pc = new ParticleContainer({
      dynamicProperties: { position: true, vertex: true, rotation: true, color: true, uvs: true },
      shader: createParticleShader(),
      texture: this.textures[0],
    });
    this.pc.blendMode = 'add';
    this.live = this.pc.particleChildren as FxParticle[];
    this.addChild(this.pc);
    this.pc.visible = false;
  }

  /** Live particle count. */
  get count(): number { return this.n; }
  get capacity(): number { return this.all.length; }

  /** Quality tier: cap the live count (≤ constructor max). Excess live particles are dropped. */
  setBudget(max: number): void {
    this.budget = Math.max(0, Math.min(this.all.length, Math.floor(max)));
    while (this.n > this.budget) this.kill(this.n - 1);
    this.live.length = this.n;
    if (this.n === 0) this.pc.visible = false;
  }

  /**
   * Contract API. Note: Container is an EventEmitter and already has `emit(event, ...args)`; this overload set
   * keeps Particles assignable to Container (so it can be added anywhere) — particle kinds are handled here,
   * any other event name is forwarded to the base emitter unchanged.
   */
  emit(kind: ParticleKind, x: number, y: number, n: number, o?: EmitOptions): boolean;
  emit(event: string | symbol, ...args: any[]): boolean;
  emit(kind: string | symbol, ...args: any[]): boolean {
    if (typeof kind === 'string' && Object.prototype.hasOwnProperty.call(K, kind) && typeof args[0] === 'number') {
      this.emitFx(kind as FxKind, args[0], args[1], args[2], args[3] as EmitFxOptions | undefined);
      return true;
    }
    return (super.emit as (e: string | symbol, ...a: unknown[]) => boolean).call(this, kind, ...args);
  }

  /** Superset of emit(): internal kinds + extra knobs. */
  emitFx(kind: FxKind, x: number, y: number, n: number, o?: EmitFxOptions): void {
    const id = K[kind];
    const d = DEF[id];
    const cnt = Math.max(0, Math.floor(n));
    const col = o?.color ?? d.color;
    const cr = ((col >> 16) & 255) / 255, cg = ((col >> 8) & 255) / 255, cb = (col & 255) / 255;
    const speed = o?.speed ?? d.speed;
    const spread = o?.spread ?? d.spread;
    const angle = o?.angle ?? d.angle;
    const life = o?.life ?? d.life;
    const grav = o?.gravity ?? d.gravity;
    const size = (o?.size ?? 1) * d.size;
    const jit = o?.jitter ?? d.jitter;
    const heat = d.heat * (o?.heat ?? 1);
    const inten = d.intensity * (o?.intensity ?? 1);
    const drag = o?.drag ?? d.drag;
    const bvx = o?.vx ?? 0, bvy = o?.vy ?? 0;
    const delay = o?.delay ?? 0;
    for (let i = 0; i < cnt; i++) {
      const p = this.alloc();
      if (!p) return;
      const a = angle + (crand() - 0.5) * spread;
      // broad speed spread + per-particle drag variance: bursts read as a volume, never as a flat ring
      const s = speed * (0.14 + 0.86 * Math.pow(crand(), 0.8));
      const ja = crand() * TAU, jr = jit * Math.sqrt(crand());
      p.kind = id;
      p.texture = this.textures[id];
      p.x = x + Math.cos(ja) * jr;
      p.y = y + Math.sin(ja) * jr;
      p.vx = Math.cos(a) * s + bvx;
      p.vy = Math.sin(a) * s + bvy;
      p.age = 0;
      // glints twinkle in over ~60 ms instead of all popping on the same frame
      p.delay = delay + (id === K.glint ? crand() * 0.06 : 0);
      p.life = life * (0.62 + 0.38 * crand());
      p.base = size * (0.6 + 0.6 * crand());
      p.aspect = d.aspect;
      p.drag = drag * (0.7 + 0.6 * crand());
      p.grav = grav;
      p.spin = (crand() * 2 - 1) * d.spin;
      p.seed = crand();
      p.rotation = crand() * TAU;
      // slight per-particle colour temperature spread (keeps bursts from looking flat)
      const tw = 0.9 + 0.2 * crand();
      p.r = Math.min(1, cr * tw); p.g = Math.min(1, cg * tw); p.b = Math.min(1, cb * (2 - tw));
      p.heat = heat;
      p.inten = inten;
      p.scaleX = p.scaleY = 0;
      p.color = 0;
    }
    if (this.n > 0) this.pc.visible = true;
  }

  /** @internal Pre-warm helper: one deterministic, visible particle — consumes no cosmetic RNG. */
  primeForPrewarm(): void {
    const p = this.alloc();
    if (!p) return;
    p.kind = K.flash; p.texture = this.textures[K.flash];
    p.x = 1; p.y = 1; p.vx = 0; p.vy = 0; p.age = 0; p.delay = 0; p.life = 1;
    p.base = 2; p.aspect = 1; p.drag = 0; p.grav = 0; p.spin = 0; p.seed = 0;
    p.r = 1; p.g = 1; p.b = 1; p.heat = 1; p.inten = 1; p.rotation = 0;
    p.scaleX = p.scaleY = 2 / TEXW; p.color = packRGBA(1, 1, 1, 1);
    this.pc.visible = true;
  }

  /** Remove everything immediately. */
  clear(): void {
    this.n = 0;
    this.live.length = 0;
    this.pc.visible = false;
  }

  private alloc(): FxParticle | null {
    if (this.budget <= 0) return null;
    if (this.n < this.budget) {
      // invariant: all[0..n) === live[0..n) (same order); all[n..cap) are free
      const p = this.all[this.n];
      this.live[this.n] = p;
      this.n++;
      return p;
    }
    // at budget: recycle round-robin (≈ oldest first, since spawns append)
    return this.live[this.steal++ % this.n];
  }

  /** Swap-remove live index i (caller fixes live.length). */
  private kill(i: number): void {
    const last = this.n - 1;
    const dead = this.all[i];
    if (i !== last) {
      const mv = this.all[last];
      this.all[i] = mv; this.all[last] = dead; this.live[i] = mv;
    }
    this.n = last;
  }

  update(dt: number): void {
    if (this.n === 0) { if (this.pc.visible) this.pc.visible = false; return; }
    if (dt <= 0) return; // hit-stop: frozen
    const live = this.live;
    let i = 0;
    while (i < this.n) {
      const p = live[i];
      if (p.delay > 0) {
        p.delay -= dt;
        if (p.delay > 0) { i++; continue; }
      }
      p.age += dt;
      if (p.age >= p.life) { this.kill(i); continue; }
      const a = p.age / p.life;
      const k = 1 - Math.min(1, p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.grav * dt;
      let inten = p.inten, heat = p.heat, sx = p.base, sy = p.base * p.aspect;
      switch (p.kind) {
        case K.spark: {
          const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          p.rotation = Math.atan2(p.vy, p.vx);
          sx = p.base * (0.45 + Math.min(2.2, sp * 0.0045));
          const f = 1 - a;
          inten *= f * (0.6 + 0.4 * f);
          heat *= f * f * f;
          break;
        }
        case K.ember: {
          p.vx += Math.sin(p.age * 7.3 + p.seed * 40) * 55 * dt;
          const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (sp > 30) p.rotation = Math.atan2(p.vy, p.vx);
          const st = 1 + Math.min(1.8, sp * 0.004);
          const shrink = 1 - 0.45 * a;
          sx = p.base * st * shrink; sy = p.base * shrink / Math.sqrt(st);
          const flick = 0.72 + 0.28 * Math.sin(p.age * 31 + p.seed * 17) * Math.sin(p.age * 13.7 + p.seed * 5);
          const fin = Math.min(1, p.age * 25);
          inten *= fin * Math.pow(1 - a, 1.1) * flick;
          heat *= fin * Math.pow(1 - a, 1.8) * flick;
          break;
        }
        case K.snow: {
          p.vx += Math.sin(p.age * 5 + p.seed * 30) * 18 * dt;
          p.rotation += p.spin * dt;
          const fin = Math.min(1, p.age * 14);
          const f = Math.pow(1 - a, 1.3) * fin;
          inten *= f; heat *= f * (0.7 + 0.3 * Math.sin(p.age * 18 + p.seed * 9));
          break;
        }
        case K.dust: {
          const env = Math.sin(Math.PI * a);
          inten *= env * env;
          sx = sy = p.base * (0.8 + 0.4 * a);
          break;
        }
        case K.shardlet: {
          p.rotation += p.spin * dt;
          const spec = Math.pow(Math.abs(Math.cos(p.rotation * 1.7 + p.seed * 6)), 6);
          const f = 1 - a * a;
          inten *= f * (0.65 + 0.55 * spec);
          heat *= f * (0.25 + 2.0 * spec);
          // fake tumble: foreshorten one axis
          sy = p.base * (0.35 + 0.65 * Math.abs(Math.sin(p.age * (5 + p.seed * 6) + p.seed * 9)));
          break;
        }
        case K.glint: {
          p.rotation += p.spin * dt;
          const pop = Math.min(1, a * 7);
          const env = pop * pop * (3 - 2 * pop) * (1 - a);
          const tw = 0.8 + 0.2 * Math.sin(p.age * 38 + p.seed * 20);
          sx = sy = p.base * (0.45 + 0.75 * env) * tw;
          inten *= env; heat *= env;
          break;
        }
        case K.flash: {
          const f = 1 - a;
          sx = sy = p.base * (0.7 + 0.5 * a);
          inten *= f * f; heat *= f * f * f;
          break;
        }
        case K.ring: {
          const e = 1 - (1 - a) * (1 - a) * (1 - a);
          sx = sy = p.base * (0.25 + 1.3 * e);
          const f = 1 - a;
          inten *= f * f; heat *= f * f * f;
          break;
        }
        case K.spike: {
          const f = 1 - a;
          sx = p.base * (0.7 + 0.6 * a); sy = p.base * p.aspect * f;
          inten *= f * f; heat *= f * f;
          break;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.scaleX = sx / TEXW;
      p.scaleY = sy / TEXW;
      p.color = packRGBA(p.r * inten, p.g * inten, p.b * inten, heat);
      i++;
    }
    if (live.length !== this.n) live.length = this.n;
    if (this.n === 0) this.pc.visible = false;
  }
}
