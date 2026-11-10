/**
 * Symbols: the ten hero assets, pooled.
 *
 * A symbol is `object` (the choreography's: it tweens position / scale /
 * rotation) → `frame` (ours: unit space scaled to the ring's symbol size and
 * yawed into the right frame) → meshes.
 *
 * Unit space: footprint diameter 1 in XZ, +Y up, −Z radially outward, +X the
 * clockwise tangent. Gems, the wild and the comet live in that radial frame.
 * Celestial bodies live in an upright frame that counter-rotates with the
 * ring, so the Moon's crescent and Saturn's tilt look the same in every cell.
 *
 * Both frames are derived from the socket the symbol is parented to (its
 * position and yaw inside the ring group), so a socket may be rotated to face
 * outward or not: the result is the same.
 *
 * Every material is its own instance (per-symbol uniforms) of a handful of
 * RawShaderMaterial programs, compiled once in warmup().
 */
import * as THREE from 'three';
import { PALETTE, SYM, SYMBOLS, SYMBOL_COUNT, SYMBOL_DIAMETER, type SymbolId } from '../core/config';
import type { Stage } from './stage';
import { COMET_HEAD, createCometMaterial, createRaysMaterial } from './symbols/aura';
import {
  SATURN_RADIUS,
  SATURN_RING_NORMAL,
  type BodyMaterial,
  createJupiterMaterial,
  createMoonMaterial,
  createSaturnMaterial,
  createSaturnRingMaterial,
  createSunMaterial,
  quadGeometry,
  ringGeometry,
  sphereGeometry,
} from './symbols/bodies';
import { TRILLION_SHIFT_Z, brilliantGeometry, emeraldGeometry, lozengeGeometry, nucleusGeometry, starGeometry, trillionGeometry } from './symbols/cuts';
import { type GemLook, createGemMaterial } from './symbols/gem';

export interface SymbolView {
  readonly id: SymbolId;
  /** Origin at the symbol centre, +Y up, sized for its ring. Choreography tweens position/scale/rotation of this object. */
  readonly object: THREE.Object3D;
  /** 0..1 win highlight: brighter core, faster sparkle. */
  glow: number;
  /** 0..1 pushed back: darker, desaturated. */
  dim: number;
  /** Clockwise angle of the ring this symbol rides. Celestial bodies counter-rotate to stay upright. */
  ringAngle: number;
}

const MOON_RADIUS = 0.4;
const JUPITER_RADIUS = 0.43;
/** Saturn rides high so the far side of its tilted ring clears the enamel. */
const SATURN_LIFT = 0.17;
const NUCLEUS_SCALE = 0.72;
/** Play-camera tilt from vertical used for thumbnails, radians. */
const THUMB_TILT = 0.38;
const THUMB_HALF = 0.62;

const crystal = { metal: 0, hot: 0, hotRadius: 0.1, tiers: 3 };
const gemLook = (id: SymbolId, o: Omit<GemLook, 'color' | 'accent' | 'metal' | 'hot' | 'hotRadius' | 'tiers'>): GemLook => ({
  color: SYMBOLS[id].color,
  accent: SYMBOLS[id].accent,
  ...crystal,
  ...o,
});

const LOOKS: Partial<Record<SymbolId, GemLook>> = {
  [SYM.SAPPHIRE]: gemLook(SYM.SAPPHIRE, {
    halfX: 0.47, halfZ: 0.47, girdleY: -0.035, depth: 0.3, ior: 1.77, dispersion: 0.03,
    sectors: 8, phase: 0.5, split: true, f0: 0.09, interior: 1.05, density: 0.7,
    core: 1.25, coreRadius: 0.15, sparkle: 1.9, edge: 0.6, fill: 0.66,
  }),
  [SYM.EMERALD]: gemLook(SYM.EMERALD, {
    halfX: 0.455, halfZ: 0.335, girdleY: -0.03, depth: 0.26, ior: 1.58, dispersion: 0.02,
    sectors: 4, phase: 0.5, split: false, f0: 0.07, interior: 0.72, density: 1.1,
    core: 1.0, coreRadius: 0.12, sparkle: 1.3, edge: 0.6, fill: 0.4,
  }),
  [SYM.AMETHYST]: gemLook(SYM.AMETHYST, {
    halfX: 0.45, halfZ: 0.45, centreZ: TRILLION_SHIFT_Z, girdleY: -0.03, depth: 0.28, ior: 1.55, dispersion: 0.03,
    sectors: 6, phase: 0, split: false, f0: 0.07, interior: 1.05, density: 0.75,
    core: 1.25, coreRadius: 0.15, sparkle: 1.8, edge: 0.6, fill: 0.58,
  }),
  [SYM.RUBY]: gemLook(SYM.RUBY, {
    halfX: 0.375, halfZ: 0.5, girdleY: -0.03, depth: 0.27, ior: 1.76, dispersion: 0.025,
    sectors: 4, phase: 0, split: false, f0: 0.09, interior: 1.0, density: 0.75,
    core: 1.25, coreRadius: 0.15, sparkle: 1.8, edge: 0.6, fill: 0.58,
  }),
  // Crystal-gold: the body is the palette's gold, the heart the wild's own white gold.
  [SYM.WILD]: {
    color: PALETTE.gold, accent: SYMBOLS[SYM.WILD].color,
    halfX: 0.5, halfZ: 0.5, girdleY: -0.03, depth: 0.22, ior: 1.6, dispersion: 0.035,
    sectors: 16, phase: 0, tiers: 2, split: false, f0: 0.3, metal: 0.8, interior: 1.25, density: 0.6,
    core: 1.0, coreRadius: 0.2, hot: 1.8, hotRadius: 0.085, sparkle: 2.0, edge: 1.0, fill: 0.55,
  },
  [SYM.SCATTER]: gemLook(SYM.SCATTER, {
    halfX: 0.16, halfZ: 0.14, girdleY: 0, depth: 0.12, ior: 1.31, dispersion: 0.02,
    sectors: 5, phase: 0, split: false, f0: 0.06, interior: 1.4, density: 0.4,
    core: 1.1, coreRadius: 0.5, sparkle: 2.0, edge: 0.8, fill: 0.8,
  }),
};

class View implements SymbolView {
  readonly object = new THREE.Group();
  /** Unit space. */
  readonly frame = new THREE.Group();
  /** One vector for all of this symbol's materials: glow, dim, sparkle clock, idle clock. */
  readonly state = new THREE.Vector4();
  glow = 0;
  dim = 0;
  ringAngle = 0;
  idle: number;
  sparkle: number;
  live = false;
  /** A cut stone that rocks a few degrees so its facets take turns catching the lights. */
  rock: THREE.Object3D | null = null;
  tumble: THREE.Object3D | null = null;

  constructor(
    readonly id: SymbolId,
    readonly upright: boolean,
    readonly seed: number,
  ) {
    this.idle = seed * 60;
    this.sparkle = seed * 37;
    this.object.name = `symbol:${SYMBOLS[id].key}`;
    this.object.add(this.frame);
  }
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export class SymbolFactory {
  private readonly geo: {
    cut: Partial<Record<SymbolId, THREE.BufferGeometry>>;
    nucleus: THREE.BufferGeometry;
    moon: THREE.BufferGeometry;
    jupiter: THREE.BufferGeometry;
    saturn: THREE.BufferGeometry;
    ring: THREE.BufferGeometry;
    quad: THREE.BufferGeometry;
  };
  private readonly materials: THREE.Material[] = [];
  private readonly pool: View[][] = [];
  private readonly live: View[] = [];
  private readonly ringQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), SATURN_RING_NORMAL);
  private readonly ringToBody = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(this.ringQuat));
  private readonly thumbScene = new THREE.Scene();
  private readonly thumbCamera = new THREE.OrthographicCamera(-THUMB_HALF, THUMB_HALF, THUMB_HALF, -THUMB_HALF, 0.1, 12);
  private readonly tmpColor = new THREE.Color();
  private warm = false;

  constructor(private readonly stage: Stage) {
    this.geo = {
      cut: {
        [SYM.SAPPHIRE]: brilliantGeometry(),
        [SYM.EMERALD]: emeraldGeometry(),
        [SYM.AMETHYST]: trillionGeometry(),
        [SYM.RUBY]: lozengeGeometry(),
        [SYM.WILD]: starGeometry(),
      },
      nucleus: nucleusGeometry(),
      moon: sphereGeometry(MOON_RADIUS),
      jupiter: sphereGeometry(JUPITER_RADIUS),
      saturn: sphereGeometry(SATURN_RADIUS),
      ring: ringGeometry(),
      quad: quadGeometry(),
    };
    for (let i = 0; i < SYMBOL_COUNT; i++) this.pool.push([]);
    this.thumbCamera.position.set(0, Math.cos(THUMB_TILT) * 5, Math.sin(THUMB_TILT) * 5);
    this.thumbCamera.lookAt(0, 0.03, 0);
  }

  /** Compile programs and build geometries up front so the first spin does not hitch. */
  warmup(): void {
    if (this.warm) return;
    this.warm = true;
    const scene = new THREE.Scene();
    const views: View[] = [];
    for (let id = 0; id < SYMBOL_COUNT; id++) {
      const v = this.take(id as SymbolId);
      scene.add(v.object);
      views.push(v);
    }
    // Raw programs are keyed by source alone, so compiling them in an empty scene is compiling them for the game.
    this.stage.renderer.compile(scene, this.stage.camera);
    for (const v of views) {
      scene.remove(v.object);
      this.pool[v.id].push(v);
    }
    // A full board, the nova's sixteen wilds and a comet per ring without a single allocation mid-spin.
    const lean = this.stage.quality === 'low';
    for (let id = 0; id < SYMBOL_COUNT; id++) {
      const kind = SYMBOLS[id].kind;
      const want = kind === 'gem' ? 10 : kind === 'wild' ? 16 : kind === 'scatter' ? 4 : 6;
      while (this.pool[id].length < (lean ? want >> 1 : want)) this.pool[id].push(this.build(id as SymbolId));
    }
  }

  acquire(id: SymbolId, ring: number): SymbolView {
    const v = this.take(id);
    const r = Math.max(0, Math.min(SYMBOL_DIAMETER.length - 1, ring | 0));
    v.frame.scale.setScalar(SYMBOL_DIAMETER[r]);
    v.live = true;
    this.live.push(v);
    this.tick(v, 0);
    return v;
  }

  release(view: SymbolView): void {
    const v = view as View;
    if (!v.live) return;
    v.live = false;
    const i = this.live.indexOf(v);
    if (i >= 0) {
      this.live[i] = this.live[this.live.length - 1];
      this.live.pop();
    }
    v.object.removeFromParent();
    this.pool[v.id].push(v);
  }

  /** Idle life for all live symbols. */
  update(dt: number): void {
    for (let i = 0; i < this.live.length; i++) this.tick(this.live[i], dt);
  }

  /**
   * The symbol alone on a transparent background, as a PNG data URL. Rendered
   * with the stage's renderer into an offscreen target; all renderer state is
   * put back. The game's ACES curve and a little bloom are applied on the CPU
   * so the icon matches what the board shows.
   */
  thumbnail(id: SymbolId, sizePx: number): string {
    const size = Math.max(16, Math.min(512, Math.round(sizePx)));
    const ss = size <= 256 ? 2 : 1;
    const n = size * ss;
    const v = this.take(id);
    v.frame.scale.setScalar(1);
    v.frame.rotation.y = 0;
    v.state.set(0, 0, v.sparkle, v.idle);
    this.thumbScene.add(v.object);

    const r = this.stage.renderer;
    const rt = new THREE.WebGLRenderTarget(n, n, { type: THREE.HalfFloatType, depthBuffer: true });
    const prevTarget = r.getRenderTarget();
    const prevAlpha = r.getClearAlpha();
    const prevAuto = r.autoClear;
    r.getClearColor(this.tmpColor);
    const half = new Uint16Array(n * n * 4);
    try {
      r.setRenderTarget(rt);
      r.setClearColor(0x000000, 0);
      r.autoClear = true;
      r.render(this.thumbScene, this.thumbCamera);
      r.readRenderTargetPixels(rt, 0, 0, n, n, half);
    } finally {
      r.setRenderTarget(prevTarget);
      r.setClearColor(this.tmpColor, prevAlpha);
      r.autoClear = prevAuto;
      rt.dispose();
      this.thumbScene.remove(v.object);
      this.pool[id].push(v);
    }
    return developThumbnail(half, n, size);
  }

  dispose(): void {
    for (const v of this.live) v.object.removeFromParent();
    this.live.length = 0;
    for (const list of this.pool) list.length = 0;
    for (const m of this.materials) m.dispose();
    this.materials.length = 0;
    const g = this.geo;
    for (const k in g.cut) g.cut[k as unknown as SymbolId]?.dispose();
    for (const x of [g.nucleus, g.moon, g.jupiter, g.saturn, g.ring, g.quad]) x.dispose();
  }

  /** A reset view from the pool, not yet live. */
  private take(id: SymbolId): View {
    const v = this.pool[id].pop() ?? this.build(id);
    v.glow = 0;
    v.dim = 0;
    v.ringAngle = 0;
    v.object.position.set(0, 0, 0);
    v.object.rotation.set(0, 0, 0);
    v.object.scale.setScalar(1);
    v.object.visible = true;
    if (v.rock) v.rock.rotation.set(0, 0, 0);
    return v;
  }

  private tick(v: View, dt: number): void {
    const glow = clamp01(v.glow);
    v.idle += dt;
    v.sparkle += dt * (1 + 2.4 * glow);
    v.state.set(glow, clamp01(v.dim), v.sparkle, v.idle);

    // Where the socket sits in its ring gives the radial direction; its own yaw is whatever the orrery chose.
    let socketYaw = 0;
    let radial = 0;
    const parent = v.object.parent;
    if (parent) {
      const q = parent.quaternion;
      socketYaw = Math.atan2(2 * (q.w * q.y - q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
      const p = parent.position;
      if (p.x * p.x + p.z * p.z > 1e-4) radial = Math.atan2(-p.x, -p.z) - socketYaw;
    }
    v.frame.rotation.y = v.upright ? v.ringAngle - socketYaw : radial;

    const still = this.stage.reducedMotion;
    if (v.rock && !still) {
      const amp = 0.045 + 0.035 * glow;
      const ph = v.seed * 6.2832;
      v.rock.rotation.x = Math.sin(v.idle * 0.83 + ph) * amp;
      v.rock.rotation.z = Math.sin(v.idle * 0.61 + ph * 2.3) * amp;
    }
    if (v.tumble) {
      const k = still ? 0.25 : 1;
      v.tumble.rotation.x = v.idle * 0.31 * k;
      v.tumble.rotation.y = v.idle * 0.47 * k;
    }
  }

  private mesh(v: View, parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: BodyMaterial, shadow: boolean): THREE.Mesh {
    mat.uniforms.uState.value = v.state;
    this.materials.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow;
    parent.add(m);
    return m;
  }

  private build(id: SymbolId): View {
    const meta = SYMBOLS[id];
    const stage = this.stage;
    const seed = stage.rng.next();
    const v = new View(id, meta.kind === 'celestial', seed);
    const g = this.geo;
    const f = v.frame;
    switch (id) {
      case SYM.MOON:
        this.mesh(v, f, g.moon, createMoonMaterial(stage, meta.color, meta.accent, seed), true);
        break;
      case SYM.JUPITER:
        this.mesh(v, f, g.jupiter, createJupiterMaterial(stage, meta.color, meta.accent, seed), true);
        break;
      case SYM.SATURN: {
        const body = new THREE.Group();
        body.position.y = SATURN_LIFT;
        f.add(body);
        this.mesh(v, body, g.saturn, createSaturnMaterial(stage, meta.color, meta.accent, seed), true);
        const ring = this.mesh(v, body, g.ring, createSaturnRingMaterial(meta.color, meta.accent, seed, this.ringToBody), false);
        ring.quaternion.copy(this.ringQuat);
        break;
      }
      case SYM.SUN:
        // A light source: it casts no shadow.
        this.mesh(v, f, g.quad, createSunMaterial(meta.color, meta.accent, seed), false);
        break;
      case SYM.WILD: {
        v.rock = this.mesh(v, f, g.cut[SYM.WILD]!, createGemMaterial(stage, LOOKS[SYM.WILD]!, seed), true);
        const rays = this.mesh(v, f, g.quad, createRaysMaterial(meta.color, meta.accent, seed), false);
        rays.position.y = 0.06;
        break;
      }
      case SYM.SCATTER: {
        this.mesh(v, f, g.quad, createCometMaterial(meta.color, meta.accent, seed), false);
        const nucleus = this.mesh(v, f, g.nucleus, createGemMaterial(stage, LOOKS[SYM.SCATTER]!, seed), false);
        nucleus.position.set(COMET_HEAD.x, 0, COMET_HEAD.y);
        nucleus.scale.setScalar(NUCLEUS_SCALE);
        v.tumble = nucleus;
        break;
      }
      default:
        v.rock = this.mesh(v, f, g.cut[id]!, createGemMaterial(stage, LOOKS[id]!, seed), true);
    }
    return v;
  }
}

// ───────────────────────── thumbnail development (CPU) ─────────────────────────

/** Two box passes each way: close enough to a Gaussian for a 64 px icon. `a` is blurred in place, `b` is scratch. */
function blur3(a: Float32Array, b: Float32Array, n: number, r: number): void {
  const inv = 1 / (2 * r + 1);
  for (let pass = 0; pass < 4; pass++) {
    const across = pass % 2 === 0;
    const src = across ? a : b;
    const dst = across ? b : a;
    const step = across ? 3 : n * 3;
    const line = across ? n * 3 : 3;
    for (let l = 0; l < n; l++) {
      for (let c = 0; c < 3; c++) {
        const base = l * line + c;
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += src[base + Math.max(0, Math.min(n - 1, k)) * step];
        for (let i = 0; i < n; i++) {
          dst[base + i * step] = sum * inv;
          sum += src[base + Math.min(n - 1, i + r + 1) * step] - src[base + Math.max(0, i - r) * step];
        }
      }
    }
  }
}

/** The RRT/ODT fit three.js uses for ACESFilmicToneMapping, then the sRGB curve. */
const aces = (v: number) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
const srgb = (v: number) => {
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
};

function developThumbnail(half: Uint16Array, n: number, size: number): string {
  const px = n * n;
  const lin = new Float32Array(px * 3);
  const bloom = new Float32Array(px * 3);
  const scratch = new Float32Array(px * 3);
  const from = THREE.DataUtils.fromHalfFloat;
  for (let i = 0; i < px; i++) {
    for (let c = 0; c < 3; c++) {
      const x = from(half[i * 4 + c]);
      lin[i * 3 + c] = x;
      bloom[i * 3 + c] = Math.min(Math.max(x - 1, 0), 6);
    }
  }
  blur3(bloom, scratch, n, Math.max(1, Math.round(n * 0.03)));

  const image = new ImageData(n, n);
  const out = image.data;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (n - 1 - y) * n + x;
      const o = (y * n + x) * 4;
      // Exposure 1 / 0.6 as in three's ACES.
      const r = (lin[i * 3] + bloom[i * 3] * 0.35) / 0.6;
      const g = (lin[i * 3 + 1] + bloom[i * 3 + 1] * 0.35) / 0.6;
      const b = (lin[i * 3 + 2] + bloom[i * 3 + 2] * 0.35) / 0.6;
      const ar = aces(0.59719 * r + 0.35458 * g + 0.04823 * b);
      const ag = aces(0.076 * r + 0.90834 * g + 0.01566 * b);
      const ab = aces(0.0284 * r + 0.13383 * g + 0.83777 * b);
      const sr = srgb(1.60475 * ar - 0.53108 * ag - 0.07367 * ab);
      const sg = srgb(-0.10208 * ar + 1.10813 * ag - 0.00605 * ab);
      const sb = srgb(-0.00327 * ar - 0.07276 * ag + 1.07602 * ab);
      // Glow has no coverage of its own: it is as opaque as it is bright, which is exact over black.
      const a = Math.max(clamp01(from(half[i * 4 + 3])), sr, sg, sb);
      const k = a > 1e-4 ? 255 / a : 0;
      out[o] = sr * k;
      out[o + 1] = sg * k;
      out[o + 2] = sb * k;
      out[o + 3] = a * 255;
    }
  }
  const big = document.createElement('canvas');
  big.width = big.height = n;
  big.getContext('2d')!.putImageData(image, 0, 0);
  if (n === size) return big.toDataURL('image/png');
  const small = document.createElement('canvas');
  small.width = small.height = size;
  const ctx = small.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(big, 0, 0, size, size);
  return small.toDataURL('image/png');
}
