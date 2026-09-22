// UberPost: the single full-screen post pass on `world` (after Bloom). CONTRACTS.md §6.
//
// Two compiled programs share one uniform group: BASE (CA, grade, flash, vignette, grain) and CINEMATIC
// (+ radial zoom, shock rings, glitch, heat haze). `cinematic = true/false` swaps `glProgram`; Pixi caches
// program data and uniform-sync functions per program key, so the swap is a pointer change — never a recompile.
// Both programs are pre-warmed (compiled, linked and drawn once into a 1×1 target) on the first apply and again
// after a WebGL context change, so the first cinematic frame does not hitch.
//
// All public fields are plain numbers/arrays (gsap-tweenable). They are copied into the uniform arrays once per
// frame in apply(); nothing is allocated per frame.
import { Filter, GlProgram, TexturePool, UniformGroup, type FilterSystem, type RenderSurface, type Texture } from 'pixi.js';
import { PAL, rgb } from '../../core/palette.ts';
import { POST_VERT } from './post/glsl.ts';
import { uberFrag } from './post/uberFrag.ts';
import { GRADE_BASE, GRADE_STORM, blendGrade } from './post/grade.ts';

let progBase: GlProgram | null = null;
let progCine: GlProgram | null = null;
function programs(): [GlProgram, GlProgram] {
  progBase ??= GlProgram.from({ vertex: POST_VERT, fragment: uberFrag(false), name: 'uber-post-base', preferredFragmentPrecision: 'highp' });
  progCine ??= GlProgram.from({ vertex: POST_VERT, fragment: uberFrag(true), name: 'uber-post-cine', preferredFragmentPrecision: 'highp' });
  return [progBase, progCine];
}

type U = {
  uMap: Float32Array; uScreen: Float32Array; uFx: Float32Array; uFx2: Float32Array;
  uLift: Float32Array; uInvGamma: Float32Array; uGain: Float32Array; uTone: Float32Array; uVigTint: Float32Array; uFlash: Float32Array;
  uCine: Float32Array; uZoomCenter: Float32Array; uRings: Float32Array;
};

/** Grain amplitude (display units) at `grain = 1`. */
const GRAIN_AMP = 0.07;
const TIME_WRAP = 600;

interface ActiveFilterData { bounds: { minX: number; minY: number } }
const tinyReq = { width: 1, height: 1, resolution: 1, antialias: false };

export class UberPost extends Filter {
  /** Chromatic aberration in css px at the screen corners (0 in the central 20 %). 0.5 base, 2.5 storm, ≤ 8 cinematic. */
  ca = 0.5;
  /** 0..1 corner darkening (tinted navy in base, crimson-black in storm). */
  vignette = 0.55;
  /** 0..1 film grain (1 ≈ 7 % amplitude in the mids). Storm boosts it ×1.5 internally. */
  grain = 0.28;
  /** 0..1 flash toward white-hot #FFF4E0 (drive for 33–50 ms, FlashBudget is the caller's job). */
  exposure = 0;
  /** 0..1 grade blend: Nordlys (cool) → Solstorm (crimson / molten). */
  storm = 0;
  /** Cinematic only: 0..~0.35 radial zoom-blur length as a fraction of the distance to zoomCenter. */
  zoom = 0;
  /** Cinematic only: zoom centre in 0..1 screen uv. */
  zoomCenter: [number, number] = [0.5, 0.45];
  /** Cinematic only: 0..1 glitch bands (slice offsets + RGB split). Spikes of ~60 ms. */
  glitch = 0;
  /** Cinematic only: 0..1 heat haze in the top 25 % of the screen. */
  heat = 0;
  /** Seconds (any clock). Drives grain, heat and glitch. */
  time = 0;
  /** 3 rings × (x, y, radius, strength). x/y in 0..1 screen uv; radius in units of the screen's SHORT side
   *  (1.2 clears the corners of a phone in portrait); strength 0 = off. Cinematic only. */
  rings = new Float32Array(12);

  private _cinematic = false;
  private readonly u: U;
  private _warm = false;
  private _runner: { add(i: unknown): unknown; remove(i: unknown): unknown } | null = null;
  /** renderer.runners.contextChange listener: programs are gone after a context restore → pre-warm again. */
  private readonly _ctx = { contextChange: () => { this._warm = false; } };

  constructor() {
    const [base] = programs();
    const f4 = () => ({ value: new Float32Array(4), type: 'vec4<f32>' as const });
    const f3 = () => ({ value: new Float32Array(3), type: 'vec3<f32>' as const });
    const group = new UniformGroup({
      uMap: { value: new Float32Array([1, 1, 0, 0]), type: 'vec4<f32>' },
      uScreen: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
      uFx: f4(), uFx2: f4(),
      uLift: f3(), uInvGamma: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' }, uGain: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
      uTone: { value: new Float32Array([1, 1, 0.5]), type: 'vec3<f32>' }, uVigTint: f3(), uFlash: { value: new Float32Array(rgb(PAL.whiteHot)), type: 'vec3<f32>' },
      uCine: f4(),
      uZoomCenter: { value: new Float32Array([0.5, 0.45]), type: 'vec2<f32>' },
      uRings: { value: new Float32Array(12), type: 'vec4<f32>', size: 3 },
    });
    super({ glProgram: base, resources: { uberUniforms: group }, resolution: 'inherit', antialias: 'inherit' });
    this.u = group.uniforms as unknown as U;
  }

  get cinematic(): boolean { return this._cinematic; }
  set cinematic(v: boolean) {
    v = !!v;
    if (v === this._cinematic) return;
    this._cinematic = v;
    const [base, cine] = programs();
    this.glProgram = v ? cine : base;
  }

  /** Force a pre-warm of the inactive variant on the next frame (apply() does it on the first frame and after a
   *  WebGL context restore by itself). */
  resetWarm(): void { this._warm = false; }

  override apply(fm: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    this.sync(fm, input);
    if (!this._runner) {
      this._runner = fm.renderer.runners.contextChange as unknown as UberPost['_runner'];
      this._runner!.add(this._ctx);
    }
    if (!this._warm) {
      this._warm = true;
      const [base, cine] = programs();
      const cur = this.glProgram;
      const tiny = TexturePool.getOptimalTexture(tinyReq);
      this.glProgram = cur === base ? cine : base;
      fm.applyFilter(this, input, tiny, true);
      this.glProgram = cur;
      TexturePool.returnTexture(tiny);
    }
    fm.applyFilter(this, input, output, clearMode);
  }

  /** Programs are shared module-wide (GlProgram.from cache), so they are never destroyed here. */
  override destroy(): void {
    this._runner?.remove(this._ctx);
    this._runner = null;
    super.destroy(false);
  }

  private sync(fm: FilterSystem, input: Texture): void {
    const u = this.u;
    const rts = fm.renderer.renderTarget;
    const rootRes = rts.rootRenderTarget.colorTexture.source.resolution || 1;
    const vp = rts.rootViewPort;
    const sw = Math.max(1, vp.width / rootRes);
    const sh = Math.max(1, vp.height / rootRes);
    const fd = (fm as unknown as { _activeFilterData?: ActiveFilterData })._activeFilterData;
    const bx = fd ? fd.bounds.minX : 0;
    const by = fd ? fd.bounds.minY : 0;
    u.uMap[0] = input.source.width / sw; u.uMap[1] = input.source.height / sh;
    u.uMap[2] = bx / sw; u.uMap[3] = by / sh;
    u.uScreen[0] = sw; u.uScreen[1] = sh; u.uScreen[2] = 1 / sw; u.uScreen[3] = 1 / sh;

    const storm = clamp01(this.storm);
    const boost = blendGrade(GRADE_BASE, GRADE_STORM, storm, u.uLift, u.uInvGamma, u.uGain, u.uTone, u.uVigTint);
    const t = (((this.time || 0) % TIME_WRAP) + TIME_WRAP) % TIME_WRAP;
    u.uFx[0] = Math.max(0, this.ca || 0);
    u.uFx[1] = clamp01(this.vignette * boost.vigBoost);
    u.uFx[2] = Math.max(0, this.grain || 0) * boost.grainBoost * GRAIN_AMP;
    u.uFx[3] = clamp01(this.exposure);
    u.uFx2[0] = t; u.uFx2[1] = storm; u.uFx2[2] = Math.floor(t * 24) % 211; u.uFx2[3] = rootRes;

    u.uCine[0] = Math.max(0, this.zoom || 0); u.uCine[1] = clamp01(this.glitch); u.uCine[2] = clamp01(this.heat);
    u.uZoomCenter[0] = this.zoomCenter[0] ?? 0.5; u.uZoomCenter[1] = this.zoomCenter[1] ?? 0.45;
    const src = this.rings, dst = u.uRings;
    for (let i = 0; i < 12; i++) dst[i] = src[i] || 0;
  }
}

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x || 0; }
