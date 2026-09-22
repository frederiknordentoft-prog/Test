// Bloom: threshold → ¼-res dual-Kawase pyramid → full-res soft-add composite. CONTRACTS.md §6.
//
// Used as the FIRST filter on `world` ([bloom, uber]). As a Filter it runs at resolution 'inherit' on purpose:
// Pixi renders a filter stack at the MIN resolution of its filters, so a 0.25-res bloom filter would drag the
// UberPost (and the whole scene) down to ¼ res. Instead the ¼-res work happens inside apply() on persistent
// render targets owned by this filter:
//
//   prefilter  full → ¼ res   (4 taps, soft-knee threshold, Karis average)          ≈ 1/16 px × 4 taps
//   down ×(n−1)               (dual filter, 5 taps)                                  ≈ 1/64 + 1/256 + …
//   up   ×(n−1)               (dual filter 8 taps + 3×3 tent of the finer level)
//   composite  full res       (scene + bloom, 2 taps)                                1 full-res pass
//
// n is chosen so the coarsest texel is ≈ 16–40 css px (halo radius ≈ 3× that) regardless of DPR / screen size.
// Zero allocations per frame; render targets are resized only when the screen size / resolution changes.
import { Filter, GlProgram, RenderTexture, UniformGroup, type FilterSystem, type RenderSurface, type Texture } from 'pixi.js';
import { CHAIN_VERT } from './post/glsl.ts';
import { COMPOSITE_FRAG, DOWN_FRAG, PREFILTER_FRAG, UP_FRAG } from './post/bloomShaders.ts';

const MAX_LEVELS = 6;
/** Base pyramid level relative to the input (render) resolution. */
const BASE_SCALE = 0.25;
/** House gain applied to `strength` (tuned so strength 1.0 is the base look). */
const GAIN = 3.8;

const prog = (frag: string, name: string) => GlProgram.from({ vertex: CHAIN_VERT, fragment: frag, name, preferredFragmentPrecision: 'highp' });

function makeRT(): RenderTexture {
  return RenderTexture.create({ width: 1, height: 1, resolution: 1, antialias: false, scaleMode: 'linear' });
}

export class BloomFilter extends Filter {
  /** Max-channel brightness where bloom starts (soft knee around it). Dark UI glass (< ~0.35) never blooms. */
  threshold = 0.6;
  /** Soft-knee half width. */
  knee = 0.32;
  /** 1.0 base, 1.6 storm, up to ~1.8 in the cinematic. 0 = pass-through (chain skipped). */
  strength = 1;
  /** 0..1: 0 = tight glow on the emitter only, 1 = all energy in the widest halo. */
  scatter = 0.55;
  /** 0..1: how much already-bright pixels are shielded from their own glow (keeps gems saturated). */
  protect = 0.8;

  private readonly pre: Filter;
  private readonly down: Filter;
  private readonly ups: Filter[] = [];
  private readonly L: RenderTexture[] = [];
  private readonly U: RenderTexture[] = [];
  private readonly preU: { uThreshold: Float32Array };
  private readonly upU: { uCurrMap: Float32Array; uCurrClamp: Float32Array; uScatter: number }[] = [];
  private readonly cu: { uBloomMap: Float32Array; uBloomClamp: Float32Array; uBloomMix: Float32Array };
  private n = 0;
  private allocW = 0;
  private allocH = 0;
  private allocRes = 0;
  private readonly res: number[] = [];

  constructor() {
    const L: RenderTexture[] = [];
    const U: RenderTexture[] = [];
    for (let i = 0; i < MAX_LEVELS; i++) { L.push(makeRT()); if (i < MAX_LEVELS - 1) U.push(makeRT()); }
    const composite = new UniformGroup({
      uBloomMap: { value: new Float32Array([1, 1, 0, 0]), type: 'vec4<f32>' },
      uBloomClamp: { value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>' },
      uBloomMix: { value: new Float32Array(4), type: 'vec4<f32>' },
    });
    super({
      glProgram: prog(COMPOSITE_FRAG, 'bloom-composite'),
      resources: { bloomUniforms: composite, uBloomTex: U[0].source },
      resolution: 'inherit',
      antialias: 'inherit',
    });
    this.L.push(...L);
    this.U.push(...U);
    this.cu = composite.uniforms as unknown as BloomFilter['cu'];

    const preGroup = new UniformGroup({ uThreshold: { value: new Float32Array(4), type: 'vec4<f32>' } });
    this.pre = new Filter({ glProgram: prog(PREFILTER_FRAG, 'bloom-prefilter'), resources: { preUniforms: preGroup } });
    this.preU = preGroup.uniforms as unknown as BloomFilter['preU'];
    this.down = new Filter({ glProgram: prog(DOWN_FRAG, 'bloom-down'), resources: {} });
    const upProg = prog(UP_FRAG, 'bloom-up');
    for (let i = 0; i < MAX_LEVELS - 1; i++) {
      const g = new UniformGroup({
        uCurrMap: { value: new Float32Array([1, 1, 0, 0]), type: 'vec4<f32>' },
        uCurrClamp: { value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>' },
        uScatter: { value: 0.6, type: 'f32' },
      });
      this.ups.push(new Filter({ glProgram: upProg, resources: { upUniforms: g, uCurr: L[i].source } }));
      this.upU.push(g.uniforms as unknown as BloomFilter['upU'][number]);
    }
  }

  /** Number of pyramid levels currently in use (for diagnostics). */
  get levels(): number { return this.n; }

  override apply(fm: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    const cu = this.cu;
    const k = (this.strength || 0) * GAIN;
    if (!(k > 0.001)) {
      cu.uBloomMix[0] = 0;
      fm.applyFilter(this, input, output, clearMode);
      return;
    }
    const w = input.frame.width, h = input.frame.height;
    this.ensure(w, h, input.source.resolution || 1);
    const n = this.n, L = this.L, U = this.U;
    for (let i = 0; i < n; i++) { setFrame(L[i], w, h); if (i < n - 1) setFrame(U[i], w, h); }

    // 1. threshold + ¼-res downsample
    const kn = Math.max(1e-3, this.knee || 0);
    const th = this.preU.uThreshold;
    th[0] = this.threshold || 0; th[1] = kn; th[2] = 1 / (4 * kn);
    fm.applyFilter(this.pre, input, L[0], true);
    // 2. down the pyramid
    for (let i = 1; i < n; i++) fm.applyFilter(this.down, L[i - 1], L[i], true);
    // 3. back up, accumulating every radius
    const sc = Math.min(1, Math.max(0, this.scatter || 0));
    for (let i = n - 2; i >= 0; i--) {
      const src = i === n - 2 ? L[n - 1] : U[i + 1];
      const cur = L[i];
      const uu = this.upU[i];
      uu.uCurrMap[0] = src.source.width / cur.source.width;
      uu.uCurrMap[1] = src.source.height / cur.source.height;
      uu.uCurrMap[2] = 0.5 / cur.source.pixelWidth;
      uu.uCurrMap[3] = 0.5 / cur.source.pixelHeight;
      validClamp(cur, w, h, this.res[i], uu.uCurrClamp);
      uu.uScatter = sc;
      fm.applyFilter(this.ups[i], src, U[i], true);
    }
    // 4. composite at full res
    const b = U[0];
    cu.uBloomMap[0] = input.source.width / b.source.width;
    cu.uBloomMap[1] = input.source.height / b.source.height;
    validClamp(b, w, h, this.res[0], cu.uBloomClamp);
    cu.uBloomMix[0] = k;
    cu.uBloomMix[1] = Math.min(1, Math.max(0, this.protect || 0));
    fm.applyFilter(this, input, output, clearMode);
  }

  /** (Re)size the pyramid when the filter frame outgrows it, shrinks a lot, or the resolution changes. */
  private ensure(w: number, h: number, inRes: number): void {
    if (inRes === this.allocRes && w <= this.allocW && h <= this.allocH && w >= this.allocW * 0.7 && h >= this.allocH * 0.7 && this.n) return;
    this.allocW = w; this.allocH = h; this.allocRes = inRes;
    const base = inRes * BASE_SCALE;
    // coarsest texel ≈ 16 css px on phones, up to ~40 on big desktop screens
    const target = 16 * Math.min(2.5, Math.max(1, Math.min(w, h) / 420));
    let n = 2;
    while (n < MAX_LEVELS && 2 ** (n - 1) / base < target * 0.75 && Math.min(w, h) * base / 2 ** n >= 6) n++;
    this.n = n;
    for (let i = 0; i < n; i++) {
      const r = base / 2 ** i;
      this.res[i] = r;
      const pw = Math.max(1, Math.round(w * r));
      const ph = Math.max(1, Math.round(h * r));
      this.L[i].resize(pw / r, ph / r, r);
      if (i < n - 1) this.U[i].resize(pw / r, ph / r, r);
    }
  }
}

function setFrame(t: RenderTexture, w: number, h: number): void {
  const f = t.frame;
  if (f.width === w && f.height === h && f.x === 0 && f.y === 0) return;
  f.x = 0; f.y = 0; f.width = w; f.height = h;
  t.updateUvs();
}

/** uv rect of the texels a pass actually wrote (viewport = round(frame · res)), inset by ½ texel. */
function validClamp(t: RenderTexture, w: number, h: number, r: number, out: Float32Array): void {
  const pw = t.source.pixelWidth, ph = t.source.pixelHeight;
  const vw = Math.min(pw, Math.max(1, Math.round(w * r)));
  const vh = Math.min(ph, Math.max(1, Math.round(h * r)));
  out[0] = 0.5 / pw; out[1] = 0.5 / ph;
  out[2] = (vw - 0.5) / pw; out[3] = (vh - 0.5) / ph;
}

/** ~quarter-res bloom for the world container. Order on world: [bloom, uber]. */
export function createBloom(): BloomFilter {
  return new BloomFilter();
}
