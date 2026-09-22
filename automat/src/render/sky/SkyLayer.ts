// SkyLayer — the hero backdrop and the progression bar (CONTRACTS.md §3, PLAN.md §6).
//
// Render graph (all passes are one screen quad; see skyShaders.ts):
//   bake (once per resize / context change, full res):  static RT (stars, twinkle phase, Milky Way)
//                                                        land RT   (Møns Klint coverage, chalk mask, depth, rim)
//   live (every frame, 0.5× res):                        aurora RT (3 curtains + plasma sun + CME front)
//   composite (every frame, full res, in the scene):     gradient + stars + MW + aurora + lit land + mirrored sea + haze + dither
//
// The RT passes run lazily from the renderer's `prerender` runner, so update() can be called any number
// of times per displayed frame (headless stepping) and the aurora is still drawn exactly once per frame.
import { Container, Geometry, GlProgram, Mesh, RenderTexture, Shader, Texture, UniformGroup, type Renderer, type DestroyOptions } from 'pixi.js';
import { TIERS } from '../../game/tiers.ts';
import { PAL } from '../../core/palette.ts';
import { SKY_VERT, STATIC_FRAG, LAND_FRAG, AURORA_FRAG, COMP_FRAG } from './skyShaders.ts';

export interface SkyParams {
  kp: number;        // continuous 0..9 → tiers.skyAt()
  storm: number;     // 0..1 blend to the Solstorm sky (crimson void + plasma sun)
  glow: number;      // 0..1 charge-glow envelope (≤10 % luminance lift at 1; shaders output sRGB-encoded values → ×1.04)
  cme: number;       // 0..1 CME plasma front progress (top → bottom) during the cinematic, 0 = off
  sun: number;       // 0..1 plasma sun rising in the storm void
  time: number;      // seconds
}

type RGB = [number, number, number];
type U = { value: number | Float32Array; type: 'f32' | 'vec2<f32>' | 'vec3<f32>' | 'vec4<f32>' };

/** Overscan (CSS px) around the screen so camera shake / rotation never exposes an edge. */
const MARGIN = 20;
/** Time is wrapped before it reaches the GPU (float precision); one discontinuity per hour. */
const TIME_WRAP = 3600;

// ───────────────────────────────────────── colour helpers (allocation-free) ─────────────────────────────────────────
const hex = (n: number): RGB => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
const C = {
  green: hex(PAL.green), teal: hex(PAL.teal), violet: hex(PAL.violet), redTop: hex(PAL.redTop),
  crimson: hex(PAL.crimson), magenta: hex(PAL.magenta), molten: hex(PAL.molten), whiteHot: hex(PAL.whiteHot),
  seamWhite: [0.80, 1.0, 0.90] as RGB, airglow: hex(PAL.airglow), void1: hex(PAL.void1),
};
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055);
const LA = new Float64Array(3);
const LB = new Float64Array(3);
function oklab(c: RGB, o: Float64Array): void {
  const r = toLin(c[0]), g = toLin(c[1]), b = toLin(c[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  o[0] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  o[1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  o[2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}
/** out = OKLab mix of a and b (PLAN §6: palettes blend in OKLab). out may alias a. */
function mixOk(a: RGB, b: RGB, t: number, out: RGB): RGB {
  if (t <= 0) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return out; }
  if (t >= 1) { out[0] = b[0]; out[1] = b[1]; out[2] = b[2]; return out; }
  oklab(a, LA); oklab(b, LB);
  const L = LA[0] + (LB[0] - LA[0]) * t, A = LA[1] + (LB[1] - LA[1]) * t, B = LA[2] + (LB[2] - LA[2]) * t;
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  out[0] = clamp01(toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s));
  out[1] = clamp01(toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s));
  out[2] = clamp01(toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s));
  return out;
}
function mixRgb(a: RGB, b: RGB, t: number, out: RGB): RGB {
  out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const set3 = (dst: Float32Array, c: RGB, k = 1) => { dst[0] = c[0] * k; dst[1] = c[1] * k; dst[2] = c[2] * k; };

/** Allocation-free equivalent of tiers.skyAt(kp) (same table, same interpolation). */
interface SkyTier { intensity: number; speed: number; fold: number; red: number; violet: number; stars: number; crackle: number }
function skyInto(kp: number, o: SkyTier): SkyTier {
  const i = Math.max(0, Math.min(8, Math.floor(kp)));
  const t = Math.max(0, Math.min(1, kp - i));
  const a = TIERS[i].sky, b = TIERS[Math.min(9, i + 1)].sky;
  o.intensity = a.intensity + (b.intensity - a.intensity) * t;
  o.speed = a.speed + (b.speed - a.speed) * t;
  o.fold = a.fold + (b.fold - a.fold) * t;
  o.red = a.red + (b.red - a.red) * t;
  o.violet = a.violet + (b.violet - a.violet) * t;
  o.stars = a.stars + (b.stars - a.stars) * t;
  o.crackle = a.crackle + (b.crackle - a.crackle) * t;
  return o;
}

// ───────────────────────────────────────── passes ─────────────────────────────────────────
let quadGeo: Geometry | null = null;
function quad(): Geometry {
  if (!quadGeo) {
    quadGeo = new Geometry({
      attributes: {
        aPosition: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        aUV: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      },
      indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
  }
  return quadGeo;
}
const v2 = (): U => ({ value: new Float32Array(2), type: 'vec2<f32>' });
const v3 = (): U => ({ value: new Float32Array(3), type: 'vec3<f32>' });
const v4 = (): U => ({ value: new Float32Array(4), type: 'vec4<f32>' });

class Pass {
  readonly root = new Container();
  readonly mesh: Mesh<Geometry, Shader>;
  readonly shader: Shader;
  readonly u: Record<string, Float32Array | number>;
  constructor(name: string, frag: string, extra: Record<string, U>, textures?: Record<string, Texture>) {
    const group = new UniformGroup({ uOrigin: v2(), uExt: v2(), uScr: v4(), ...extra });
    const resources: Record<string, unknown> = { skyUniforms: group };
    if (textures) for (const k in textures) resources[k] = textures[k].source;
    this.shader = new Shader({ glProgram: GlProgram.from({ vertex: SKY_VERT, fragment: frag, name: 'nordlys-sky-' + name }), resources });
    this.mesh = new Mesh<Geometry, Shader>({ geometry: quad(), shader: this.shader });
    this.root.addChild(this.mesh);
    this.u = group.uniforms as Record<string, Float32Array | number>;
  }
  /** Map the quad onto the CSS rect (x, y, w, h); `devPx` = device px per CSS px of the target. */
  frame(x: number, y: number, w: number, h: number, sw: number, sh: number, hy: number, devPx: number): void {
    const o = this.u.uOrigin as Float32Array, e = this.u.uExt as Float32Array, s = this.u.uScr as Float32Array;
    o[0] = x; o[1] = y; e[0] = w; e[1] = h;
    s[0] = sw; s[1] = sh; s[2] = hy; s[3] = devPx;
  }
  // reused render options (no per-frame allocation on our side)
  private readonly opts: { container: Container; target: RenderTexture | null; clear: boolean; clearColor: number[] } =
    { container: this.root, target: null, clear: true, clearColor: [0, 0, 0, 1] };
  /** Clear colour for this pass (the aurora pass clears alpha to 0: its alpha carries the CME mask). */
  setClear(r: number, g: number, b: number, a: number): void { const c = this.opts.clearColor; c[0] = r; c[1] = g; c[2] = b; c[3] = a; }
  draw(renderer: Renderer, target: RenderTexture, w: number, h: number): void {
    this.mesh.position.set(0, 0);
    this.mesh.scale.set(w, h);
    this.opts.target = target;
    renderer.render(this.opts as unknown as Parameters<Renderer['render']>[0]);
  }
  destroy(): void {
    this.root.destroy({ children: true });
    this.shader.destroy();
  }
}

export class SkyLayer extends Container {
  /** Fraction of the canvas resolution used for the live aurora pass. */
  auroraScale = 0.5;
  /** Draw the live aurora every N-th displayed frame (1 = 60 Hz, 2 = 30 Hz on low tiers). */
  auroraEvery = 1;
  /**
   * Calm mode (game's "Rolig tilstand"): no shimmer at all, curtain / ray / fold motion at ×0.5,
   * softer travelling surges and a dimmer, slower CME front. Safe to toggle at any time.
   */
  calm = false;

  private readonly r: Renderer;
  private readonly comp: Pass;
  private readonly aur: Pass;
  private readonly stat: Pass;
  private readonly land: Pass;
  private rtStatic: RenderTexture | null = null;
  private rtLand: RenderTexture | null = null;
  private rtAur: RenderTexture | null = null;
  private w = 0; private h = 0; private hy = 0; private res = 0;
  private focus: { x: number; y: number; size: number } | null = null;
  private dirtyStatic = true; private dirtyLand = true; private dirtyAur = true;
  private busy = false;
  private frameN = 0;
  private phase = 0; private fast = 0; private foldPh = 0; private lastT = Number.NaN;
  private stormS = 0; private cmePrev = 0; private cmeAfter = 0;
  private readonly tier: SkyTier = { intensity: 0, speed: 0, fold: 0, red: 0, violet: 0, stars: 0, crackle: 0 };
  private readonly env: RGB[] = [[0.24, 1, 0.69], [0.1, 0.89, 0.84], [0.1, 0.89, 0.84]];
  // scratch colours
  private readonly cSeam: RGB = [0, 0, 0]; private readonly cBody: RGB = [0, 0, 0];
  private readonly cTop: RGB = [0, 0, 0]; private readonly cFringe: RGB = [0, 0, 0];
  private readonly tA: RGB = [0, 0, 0];
  private readonly bSeam: RGB = [0, 0, 0]; private readonly bBody: RGB = [0, 0, 0];
  private readonly bTop: RGB = [0, 0, 0]; private readonly bFringe: RGB = [0, 0, 0];
  // Solstorm set (constant)
  private readonly sSeam: RGB = mixRgb(C.crimson, C.whiteHot, 0.42, [0, 0, 0]);
  private readonly sBody: RGB = [C.crimson[0], C.crimson[1], C.crimson[2]];
  private readonly sTop: RGB = mixOk(C.crimson, C.magenta, 0.45, [0, 0, 0]);
  private readonly sFringe: RGB = [C.magenta[0], C.magenta[1], C.magenta[2]];
  private readonly hooks = {
    prerender: () => this.flush(),
    contextChange: () => { this.dirtyStatic = this.dirtyLand = this.dirtyAur = true; },
  };

  constructor(renderer: Renderer) {
    super();
    this.label = 'sky';
    this.r = renderer;
    this.stat = new Pass('static', STATIC_FRAG, {});
    this.land = new Pass('land', LAND_FRAG, { uL: v4(), uL2: v4() });
    this.aur = new Pass('aurora', AURORA_FRAG, {
      uP: v4(), uA: v4(), uB: v4(), uC: v4(), uQ: v4(), uFx: v4(), uSeam: v4(), uCSeam: v3(), uCBody: v3(), uCTop: v3(), uCFringe: v3(), uSSeam: v3(), uSBody: v3(), uSTop: v3(), uSFringe: v3(), uSun: v4(), uCme: v4(),
    });
    this.aur.setClear(0, 0, 0, 0);
    this.comp = new Pass('composite', COMP_FRAG, {
      uK: v4(), uK2: v4(), uLight: v3(), uHaze: v3(), uGlowC: v3(), uSun: v4(), uCme: v4(), uL: v4(),
    }, { uStatic: Texture.WHITE, uLand: Texture.EMPTY, uAur: Texture.EMPTY });
    this.addChild(this.comp.mesh);
    renderer.runners.prerender.add(this.hooks);
    renderer.runners.contextChange.add(this.hooks);
    this.update({ kp: 0, storm: 0, glow: 0, cme: 0, sun: 0, time: 0 });
  }

  /** CSS px; horizonY = y of the sea horizon. RT reallocation only when the size / resolution changes. */
  resize(w: number, h: number, horizonY: number): void {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const hy = Math.round(Math.max(h * 0.2, Math.min(h * 0.95, horizonY)) * 2) / 2;
    const res = this.r.resolution;
    if (w !== this.w || h !== this.h || res !== this.res) {
      this.w = w; this.h = h; this.res = res;
      this.allocate();
      this.dirtyStatic = this.dirtyLand = true;
    }
    if (hy !== this.hy) { this.hy = hy; this.dirtyLand = true; }
    this.layoutPasses();
    this.dirtyAur = true;
  }

  /**
   * Optional (extra API): the grid rect in CSS px. The near curtain's seam and the plasma sun are composed
   * around the grid top; without this the rect is estimated from horizonY exactly as world.layout() derives it.
   */
  setFocus(x: number, y: number, size: number): void {
    this.focus = { x, y, size };
    this.layoutPasses();
  }

  /** Per frame, allocation-free. Only sets uniforms; the GPU passes run on the next render. */
  update(p: SkyParams): void {
    const T = skyInto(p.kp, this.tier);
    const t = p.time;
    const dt = t - this.lastT;
    const resync = !(dt >= 0 && dt < 0.5);
    // photosensitivity: `storm` is rate-limited (≤ 2.5 /s) so the impact jump 0.35 → 1 is a ~0.25 s blend, and
    // when the CME is cut (cme → 0 at impact) the swept plasma fades out over ~0.7 s instead of vanishing.
    const stormIn = clamp01(p.storm);
    this.stormS = resync ? stormIn : this.stormS + Math.max(-dt * 2.5, Math.min(dt * 2.5, stormIn - this.stormS));
    const cmeIn = clamp01(p.cme);
    if (resync) this.cmeAfter = 0;
    else if (cmeIn < 0.02 && this.cmePrev >= 0.3) this.cmeAfter = 1;
    else this.cmeAfter = Math.max(0, this.cmeAfter - dt / 0.7);
    if (cmeIn >= 0.02) this.cmeAfter = 0;
    this.cmePrev = cmeIn;
    const storm = this.stormS, glow = clamp01(p.glow), sun = Math.max(0, p.sun);
    const after = this.cmeAfter * this.cmeAfter * (3 - 2 * this.cmeAfter);
    const cme = cmeIn >= 0.02 ? cmeIn : after > 0 ? 1 : 0;
    // motion phase is integrated so speed changes never make the curtains lurch
    // photosensitivity: all brightness modulation is slow (< 1 Hz) and small; the storm is violent through
    // motion and shape (speed, folds, turbulence), never through strobing. Crackle does not drive any flicker.
    const calm = this.calm;
    const speed = T.speed * (1 + 0.9 * storm) * (calm ? 0.5 : 1);
    const fastSpeed = calm ? 0 : 0.6;
    const foldSpeed = T.speed * (1 + 0.3 * storm) * (calm ? 0.5 : 1);  // folds evolve slowly even in the storm
    if (resync) { this.phase = t * speed; this.fast = t * fastSpeed; this.foldPh = t * foldSpeed; }
    else { this.phase += dt * speed; this.fast += dt * fastSpeed; this.foldPh += dt * foldSpeed; }
    this.lastT = t;
    this.phase %= 20000; this.fast %= 20000; this.foldPh %= 20000;

    // ---- colours: base (tier) set and Solstorm set; blended in OKLab for the CPU-side mix ----
    const red = T.red, violet = T.violet;
    mixRgb(C.green, C.seamWhite, 0.42, this.bSeam);
    mixRgb(C.green, C.green, 0, this.bBody);
    mixOk(C.teal, C.violet, clamp01(violet * 1.7), this.tA);
    mixOk(this.tA, C.redTop, smooth(0, 0.75, red), this.bTop);
    mixOk(C.teal, C.violet, clamp01(violet * 2.0), this.tA);
    mixOk(this.tA, C.redTop, smooth(0.3, 1, red) * 0.5, this.bFringe);
    mixOk(this.bSeam, this.sSeam, storm, this.cSeam);
    mixOk(this.bBody, this.sBody, storm, this.cBody);
    mixOk(this.bTop, this.sTop, storm, this.cTop);
    mixOk(this.bFringe, this.sFringe, storm, this.cFringe);
    const topMix = Math.min(1, Math.max(0.3 + 0.7 * red, 0.25 + violet * 0.6) + storm);
    const inten = T.intensity * (1 + 0.3 * storm);

    // ---- env colours for crystal reflections / frame tint (cached array, mutated in place) ----
    const ek = 0.8 + 0.2 * T.intensity;
    mixRgb(this.cBody, this.cBody, 0, this.env[0]);
    mixOk(this.cTop, this.cTop, 0, this.env[1]);
    mixOk(this.cFringe, C.molten, storm, this.env[2]);
    for (let i = 0; i < 3; i++) { const e = this.env[i]; e[0] *= ek; e[1] *= ek; e[2] *= ek; }

    // ---- aurora pass uniforms ----
    const a = this.aur.u;
    const P = a.uP as Float32Array; P[0] = this.phase; P[1] = this.fast; P[2] = t % TIME_WRAP; P[3] = storm;
    const A = a.uA as Float32Array; A[0] = inten; A[1] = Math.min(1.2, T.fold + 0.25 * storm); A[2] = topMix; A[3] = Math.min(1, violet + storm);
    const B = a.uB as Float32Array; B[0] = Math.min(1, T.crackle * 0.6 + storm * 0.7); B[1] = 1.15 + 0.5 * T.fold + 0.4 * storm; B[2] = 1 + 0.04 * glow; B[3] = storm * 0.9 + T.crackle * 0.3;
    (a.uQ as Float32Array)[0] = this.foldPh;
    const Fx = a.uFx as Float32Array;
    Fx[0] = calm ? 0 : 0.035 * Math.min(1, T.crackle + storm);          // shimmer: ±3.5 % encoded ≈ ±8 % luminance
    Fx[1] = (0.3 - 0.18 * storm) * (calm ? 0.5 : 1);                     // travelling surge amplitude
    Fx[2] = calm ? 0.55 : 1;                                             // CME brightness
    Fx[3] = calm ? 0.4 : 1;                                              // CME turbulence speed
    const Cc = a.uC as Float32Array; Cc[0] = smooth(0, 0.8, red) * (1 - 0.35 * storm) + 0.35 * storm; Cc[1] = T.crackle * (1 - storm);
    set3(a.uCSeam as Float32Array, this.bSeam);
    set3(a.uCBody as Float32Array, this.bBody);
    set3(a.uCTop as Float32Array, this.bTop);
    set3(a.uCFringe as Float32Array, this.bFringe);
    set3(a.uSSeam as Float32Array, this.sSeam);
    set3(a.uSBody as Float32Array, this.sBody);
    set3(a.uSTop as Float32Array, this.sTop);
    set3(a.uSFringe as Float32Array, this.sFringe);
    const S = a.uSun as Float32Array;
    this.sunGeom(sun, S);
    const M = a.uCme as Float32Array; M[0] = cme; M[1] = cmeIn >= 0.02 ? smooth(0, 0.06, cmeIn) : after;

    // ---- composite uniforms ----
    const c = this.comp.u;
    const K = c.uK as Float32Array;
    const cmeVis = cmeIn >= 0.02 ? cmeIn : after;
    K[0] = T.stars * (1 - 0.8 * storm) * (1 - 0.35 * cmeVis); K[1] = 0.2 * T.stars * (1 - 0.85 * storm); K[2] = storm; K[3] = t % TIME_WRAP;
    const K2 = c.uK2 as Float32Array; K2[0] = inten; K2[1] = glow; K2[2] = 1; K2[3] = S[3];
    // light on the chalk: aurora ambient (+ the plasma sun in the storm)
    const L = c.uLight as Float32Array;
    const lk = inten * 0.27 * (1 + 0.04 * glow) * (1 - 0.65 * storm);
    for (let i = 0; i < 3; i++) {
      const aur = (this.cBody[i] * 0.6 + this.cTop[i] * 0.25 * topMix + this.cFringe[i] * 0.15) * lk;
      L[i] = aur + (C.crimson[i] * 0.55 + C.molten[i] * 0.45) * S[3] * 0.08;
    }
    const Hz = c.uHaze as Float32Array;
    for (let i = 0; i < 3; i++) {
      const base = C.airglow[i] * 0.55 + this.cBody[i] * inten * 0.07;
      const st = C.void1[i] * 0.9 + C.crimson[i] * 0.05 + C.molten[i] * S[3] * 0.16;
      Hz[i] = base + (st - base) * storm;
    }
    const G = c.uGlowC as Float32Array;
    for (let i = 0; i < 3; i++) G[i] = ((this.cBody[i] * 0.7 + this.cTop[i] * 0.3 * topMix) * inten * 0.018 + C.redTop[i] * red * T.crackle * 0.022 * (1 - storm)) * (1 + 0.04 * glow) + C.crimson[i] * cmeVis * 0.05;
    const CS = c.uSun as Float32Array; CS[0] = S[0]; CS[1] = S[1]; CS[2] = S[2]; CS[3] = S[3];
    const CM = c.uCme as Float32Array; CM[0] = M[0]; CM[1] = M[1];
    this.dirtyAur = true;
  }

  /** The 3 dominant aurora colours right now (0..1). Cached array — do not mutate. */
  envColors(): [number, number, number][] { return this.env; }

  /** Force the GPU passes now (normally they run from the renderer's prerender runner). */
  flush(): void {
    if (this.busy || this.destroyed || this.w === 0) return;
    if (this.r.resolution !== this.res) { this.res = this.r.resolution; this.allocate(); this.layoutPasses(); this.dirtyStatic = this.dirtyLand = true; }
    if (!this.rtStatic || !this.rtLand || !this.rtAur) return;
    this.busy = true;
    try {
      const W = this.w + MARGIN * 2, H = this.h + MARGIN * 2;
      if (this.dirtyStatic) { this.stat.draw(this.r, this.rtStatic, W, H); this.dirtyStatic = false; }
      if (this.dirtyLand) { this.land.draw(this.r, this.rtLand, W, H); this.dirtyLand = false; }
      if (this.dirtyAur && (this.frameN++ % Math.max(1, this.auroraEvery) === 0)) {
        this.aur.draw(this.r, this.rtAur, W, H);
        this.dirtyAur = false;
      }
    } finally {
      this.busy = false;
    }
  }

  override destroy(options?: DestroyOptions): void {
    this.r.runners.prerender.remove(this.hooks);
    this.r.runners.contextChange.remove(this.hooks);
    this.rtStatic?.destroy(true); this.rtLand?.destroy(true); this.rtAur?.destroy(true);
    this.rtStatic = this.rtLand = this.rtAur = null;
    this.stat.destroy(); this.land.destroy(); this.aur.destroy();
    const mesh = this.comp.mesh;
    super.destroy(options);
    if (!mesh.destroyed) mesh.destroy();
    this.comp.shader.destroy();
  }

  // ───────────────────────────────────────── internals ─────────────────────────────────────────
  private allocate(): void {
    const W = this.w + MARGIN * 2, H = this.h + MARGIN * 2, res = this.res;
    this.rtStatic?.destroy(true); this.rtLand?.destroy(true); this.rtAur?.destroy(true);
    const mk = (r: number) => RenderTexture.create({ width: W, height: H, resolution: r, antialias: false, scaleMode: 'linear' });
    this.rtStatic = mk(res);
    this.rtLand = mk(res);
    this.rtAur = mk(this.auroraRes());
    const R = this.comp.shader.resources as Record<string, unknown>;
    R.uStatic = this.rtStatic.source;
    R.uLand = this.rtLand.source;
    R.uAur = this.rtAur.source;
  }

  private layoutPasses(): void {
    const w = this.w, h = this.h, hy = this.hy, res = this.res;
    const W = w + MARGIN * 2, H = h + MARGIN * 2;
    // RT passes: quad covers the RT; composite: quad covers screen + margin in the scene
    this.stat.frame(-MARGIN, -MARGIN, W, H, w, h, hy, res);
    this.land.frame(-MARGIN, -MARGIN, W, H, w, h, hy, res);
    this.aur.frame(-MARGIN, -MARGIN, W, H, w, h, hy, this.auroraRes());
    this.comp.frame(-MARGIN, -MARGIN, W, H, w, h, hy, res);
    this.comp.mesh.position.set(-MARGIN, -MARGIN);
    this.comp.mesh.scale.set(W, H);
    // Møns Klint composition: near chalk coast from the left edge receding to a vanishing point,
    // low far headlands on the right, a hazy distant shore on the horizon.
    const portrait = w / h < 1.1;
    const sea = h - hy;
    const L = this.land.u.uL as Float32Array, L2 = this.land.u.uL2 as Float32Array;
    if (portrait) {
      L[0] = 0.6; L[1] = sea * 0.82; L[2] = Math.min(sea * 0.82 * 1.3, hy * 0.6); L[3] = 8;
      L2[0] = 0.72; L2[1] = Math.max(10, hy * 0.05); L2[2] = 0.86; L2[3] = Math.max(2, h * 0.004);
    } else {
      L[0] = 0.37; L[1] = sea * 0.92; L[2] = Math.min(sea * 0.92 * 1.3, hy * 0.62); L[3] = 8;
      L2[0] = 0.75; L2[1] = Math.max(10, hy * 0.06); L2[2] = 0.64; L2[3] = Math.max(2, h * 0.004);
    }
    (this.comp.u.uL as Float32Array).set(L);
    // curtain seams: the near one hangs just above the grid so its bright lower border frames the board
    const sv = this.aur.u.uSeam as Float32Array;
    const top = this.gridTop();
    sv[0] = 0.11; sv[1] = 0.37;
    sv[2] = Math.max(0.5, Math.min(0.82, 1 - (top + 0.012 * h) / hy));
  }

  /** Aurora RT resolution: auroraScale × canvas resolution, capped at 1 texel per CSS px. */
  private auroraRes(): number { return Math.max(0.25, Math.min(1, this.res * this.auroraScale)); }

  /** Grid top (CSS px): from setFocus(), else estimated like world.layout() (portrait: horizon = top + 0.86·size, size ≈ 0.93·w). */
  private gridTop(): number {
    if (this.focus) return this.focus.y;
    const w = this.w || 1, h = this.h || 1, hy = this.hy || h * 0.66;
    return w / h < 1.1 ? Math.max(h * 0.1, hy - 0.86 * 0.93 * w) : h * 0.25;
  }

  /** Plasma sun: rises from behind the sea horizon; at sun = 0.62 it sits on the grid top. */
  private sunGeom(sun: number, out: Float32Array): void {
    const w = this.w || 1, h = this.h || 1, hy = this.hy || h * 0.66;
    const portrait = w / h < 1.1;
    const R = portrait ? Math.min(w * 0.3, h * 0.17) : Math.min(h * 0.2, w * 0.14);
    const gridTop = this.gridTop();
    const target = gridTop + R * 0.05;
    const start = hy + R * 1.25;
    const k = sun / 0.62;
    out[0] = this.focus ? this.focus.x + this.focus.size * 0.5 : w * 0.5;
    out[1] = start + (target - start) * k;
    out[2] = R;
    out[3] = clamp01(sun * 5);
  }
}
