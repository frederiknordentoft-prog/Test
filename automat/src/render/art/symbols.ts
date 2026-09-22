// NORDLYS · procedural symbol + cell-fx baker (CONTRACTS.md §2). PUBLIC ENTRY of src/render/art.
//
// Everything is painted by full-quad shader meshes into RenderTextures — no bitmaps, no fonts.
//   · one program per symbol family (gem / moon / star / amber / wild / sun / fx), compiled once and cached;
//   · the edition is a compile-time define (STORM_ED → const uStorm), the crystals reflect the 3 `env` aurora colours;
//   · every texture is rendered at 2× and box-downsampled (exact 2×2 bilinear tap) → clean facet creases;
//   · every call returns NEW textures (idempotent, safe to call again after context loss); the caller owns them.
//
// Costs (one bake = 9 symbols + 1 glow): 10 shader draws of (2·cellPx)² + 10 blits; e.g. cellPx 160 → 1 M fragments.
// GPU memory per set = 10 · cellPx² · 4 B (256 px → 2.6 MB) + one shared scratch RT of (2·cellPx)².
import { Container, Geometry, GlProgram, Mesh, RenderTexture, Shader, Sprite, UniformGroup, Texture, type Renderer } from 'pixi.js';
import { ART_VERT } from './glsl.ts';
import { GEM_DEFS, GEM_FRAG, MAX_POLY, gemSparkles } from './gems.ts';
import { MOON_FRAG, STAR_FRAG, SUN_FRAG } from './celestial.ts';
import { AMBER_FRAG, WILD_FRAG } from './amberWild.ts';
import { FX_FRAG, FX_KIND } from './cellFx.ts';

export type Edition = 'base' | 'storm';
export interface SymbolSet {
  edition: Edition; cellPx: number;       // texture px size of one cell (square)
  textures: Texture[];                    // length 9, index = Sym; transparent bg, symbol fills ~86% of cell
  glow: Texture;                          // soft additive glow, same size (tint per symbol at runtime)
}
export interface CellFx {
  cellBg: Texture;     // subtle glass cell backdrop (base)
  frost: Texture;      // frost-mark overlay (mark = 1): icy rime + inner glow
  markRing: Texture;   // multiplier ring/pill backdrop for x2..x32 (text drawn by the game) — aspect 0.62 : 0.30 of a cell
  plasmaBg: Texture;   // storm lava cell backdrop (mark ≥ 2 in storm)
  stormBg: Texture;    // obsidian storm cell backdrop
}
export type EnvColors = [number, number, number][];
export interface BakeOptions { edition: Edition; cellPx: number; env: EnvColors }

/** Symbol count (index = Sym). */
export const ART_SYMBOLS = 9;
/** Default env if the caller passes fewer than 3 colours: the base green → teal → violet ramp. */
export const DEFAULT_ENV: EnvColors = [[0.24, 1.0, 0.69], [0.10, 0.89, 0.84], [0.54, 0.36, 1.0]];
/** The storm-edition env the game uses (crimson, molten, magenta). */
export const STORM_ENV: EnvColors = [[1, 0.12, 0.24], [1, 0.42, 0], [1, 0.17, 0.84]];

// ───────────────────────────────────────────── programs ─────────────────────────────────────────────
type U = { value: unknown; type: 'f32' | 'i32' | 'vec2<f32>' | 'vec3<f32>' | 'vec4<f32>'; size?: number };
const common = (): Record<string, U> => ({
  uPx: { value: 2 / 128, type: 'f32' },
  uSeed: { value: 0, type: 'f32' },
  uEnv0: { value: new Float32Array(3), type: 'vec3<f32>' },
  uEnv1: { value: new Float32Array(3), type: 'vec3<f32>' },
  uEnv2: { value: new Float32Array(3), type: 'vec3<f32>' },
  uAspect: { value: 1, type: 'f32' },
});

let quad: Geometry | null = null;
function quadGeometry(): Geometry {
  if (!quad) {
    quad = new Geometry({
      attributes: {
        aPosition: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        aUV: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      },
      indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
  }
  return quad;
}

class Program {
  readonly root = new Container();
  readonly mesh: Mesh<Geometry, Shader>;
  readonly u: Record<string, unknown>;
  constructor(name: string, frag: string, extra: Record<string, U> = {}) {
    const group = new UniformGroup({ ...common(), ...extra });
    const shader = new Shader({ glProgram: GlProgram.from({ vertex: ART_VERT, fragment: frag, name: 'nordlys-art-' + name }), resources: { artUniforms: group } });
    this.mesh = new Mesh<Geometry, Shader>({ geometry: quadGeometry(), shader });
    this.root.addChild(this.mesh);
    this.u = group.uniforms as Record<string, unknown>;
  }
  setEnv(env: EnvColors): void {
    for (let i = 0; i < 3; i++) {
      const src = env[i] ?? DEFAULT_ENV[i];
      const dst = this.u['uEnv' + i] as Float32Array;
      for (let c = 0; c < 3; c++) dst[c] = Math.min(1.5, Math.max(0, src[c] ?? 0));
    }
  }
  /** Render the full-quad program into `target` (w × h px). */
  draw(renderer: Renderer, target: RenderTexture, w: number, h: number): void {
    this.mesh.scale.set(w, h);
    this.u.uPx = 2 / h;
    this.u.uAspect = w / h;
    renderer.render({ container: this.root, target, clear: true, clearColor: [0, 0, 0, 0] });
  }
}

// Programs are compiled per edition (STORM_ED define): smaller shaders, and the storm set only compiles when
// the storm edition is first baked (the async pre-bake), never at boot.
const programs = new Map<string, Program>();
function prog(name: string, frag: string, storm: boolean, extra?: Record<string, U>): Program {
  const key = name + (storm ? '-storm' : '-base');
  let p = programs.get(key);
  if (!p) {
    const src = frag.replace('precision highp float;', 'precision highp float;\n#define STORM_ED ' + (storm ? 1 : 0));
    p = new Program(key, src, extra);
    programs.set(key, p);
  }
  return p;
}
const v3 = (): U => ({ value: new Float32Array(3), type: 'vec3<f32>' });
const v4 = (): U => ({ value: new Float32Array(4), type: 'vec4<f32>' });
const gemProg = (storm: boolean) => prog('gem', GEM_FRAG, storm, {
  uPoly: { value: new Float32Array(MAX_POLY * 2), type: 'vec2<f32>', size: MAX_POLY },
  uN: { value: 3, type: 'i32' },
  uCenter: { value: new Float32Array(2), type: 'vec2<f32>' },
  uTable: { value: 0.5, type: 'f32' }, uMid: { value: 0.8, type: 'f32' }, uCrownH: { value: 0.3, type: 'f32' },
  uRound: { value: 0, type: 'f32' }, uScale: { value: 1, type: 'f32' },
  uHue: v3(), uDeep: v3(), uVein: v3(), uVeinCore: v3(), uSpark: v4(), uSpark2: v4(),
});
const fxProg = () => prog('fx', FX_FRAG, false, { uKind: { value: 0, type: 'i32' } });
const simpleProg = (sym: number, storm: boolean): Program => {
  switch (sym) {
    case 4: return prog('moon', MOON_FRAG, storm);
    case 5: return prog('star', STAR_FRAG, storm);
    case 6: return prog('amber', AMBER_FRAG, storm);
    case 7: return prog('wild', WILD_FRAG, storm);
    default: return prog('sun', SUN_FRAG, storm);
  }
};

// ───────────────────────────────────────────── helpers ──────────────────────────────────────────────
const setRgb = (dst: Float32Array, hex: number) => { dst[0] = ((hex >> 16) & 255) / 255; dst[1] = ((hex >> 8) & 255) / 255; dst[2] = (hex & 255) / 255; };

let scratch: RenderTexture | null = null;
const blitRoot = new Container();
const blitSprite = new Sprite();
blitRoot.addChild(blitSprite);

function newTarget(w: number, h: number): RenderTexture {
  return RenderTexture.create({ width: w, height: h, resolution: 1, antialias: false, scaleMode: 'linear' });
}

/** Supersample factor: every bake is painted at 2× and box-filtered → facet creases, bevels and text stay clean. */
const ssFor = (px: number) => (px <= 512 ? 2 : 1);

/** Paint program `p` into a fresh w×h texture (with ss× supersampling + exact 2×2 box downsample). */
function paint(renderer: Renderer, p: Program, w: number, h: number): RenderTexture {
  const out = newTarget(w, h);
  const ss = ssFor(Math.max(w, h));
  if (ss === 1) { p.draw(renderer, out, w, h); return out; }
  const sw = w * ss, sh = h * ss;
  if (!scratch || scratch.width < sw || scratch.height < sh || scratch.destroyed) {
    // Unbind before destroying: the blit sprite still references the old scratch (Pixi warns otherwise).
    if (scratch) { blitSprite.texture = Texture.EMPTY; scratch.destroy(true); }
    const s = Math.max(sw, sh, 256);
    scratch = newTarget(s, s);
  }
  // draw into the top-left sw×sh of the scratch, then blit it at 1/ss (sample points land on texel corners → 2×2 mean)
  p.mesh.scale.set(sw, sh);
  p.u.uPx = 2 / sh;
  p.u.uAspect = sw / sh;
  renderer.render({ container: p.root, target: scratch, clear: true, clearColor: [0, 0, 0, 0] });
  blitSprite.texture = scratch;
  blitSprite.scale.set(1 / ss);
  renderer.render({ container: blitRoot, target: out, clear: true, clearColor: [0, 0, 0, 0] });
  blitSprite.texture = RenderTexture.EMPTY;
  return out;
}

/** Bake one symbol (index = Sym) for an edition. */
export function bakeSymbol(renderer: Renderer, sym: number, opts: BakeOptions): RenderTexture {
  const px = Math.max(16, Math.round(opts.cellPx));
  const storm = opts.edition === 'storm';
  let p: Program;
  if (sym <= 3) {
    p = gemProg(storm);
    const def = GEM_DEFS[sym];
    const poly = p.u.uPoly as Float32Array;
    poly.fill(0);
    def.poly.forEach(([x, y], i) => { poly[i * 2] = x; poly[i * 2 + 1] = y; });
    p.u.uN = def.poly.length;
    const c = p.u.uCenter as Float32Array; c[0] = def.center[0]; c[1] = def.center[1];
    p.u.uTable = def.table; p.u.uMid = def.mid; p.u.uCrownH = def.crownH; p.u.uRound = def.round; p.u.uScale = def.scale;
    setRgb(p.u.uHue as Float32Array, def.hue);
    setRgb(p.u.uDeep as Float32Array, def.deep);
    setRgb(p.u.uVein as Float32Array, def.vein);
    setRgb(p.u.uVeinCore as Float32Array, def.veinCore);
    const sp = gemSparkles(def);
    (p.u.uSpark as Float32Array).set(sp.a);
    (p.u.uSpark2 as Float32Array).set(sp.b);
    p.u.uSeed = def.seed;
  } else {
    p = simpleProg(sym, storm);
    p.u.uSeed = sym * 1.618;
  }
  p.setEnv(opts.env);
  return paint(renderer, p, px, px);
}

/** The generic soft glow (white, tinted per symbol at runtime by the grid). */
export function bakeGlow(renderer: Renderer, cellPx: number): RenderTexture {
  const p = fxProg();
  p.u.uKind = FX_KIND.glow;
  const px = Math.max(16, Math.round(cellPx));
  return paint(renderer, p, px, px);
}

// ───────────────────────────────────────────── public API ───────────────────────────────────────────
export function bakeSymbols(renderer: Renderer, opts: BakeOptions): SymbolSet {
  const textures: Texture[] = [];
  for (let s = 0; s < ART_SYMBOLS; s++) textures.push(bakeSymbol(renderer, s, opts));
  return { edition: opts.edition, cellPx: Math.round(opts.cellPx), textures, glow: bakeGlow(renderer, opts.cellPx) };
}

/** One symbol per animation frame (falls back to a macrotask while the page is hidden, so it never stalls). */
export function bakeSymbolsAsync(renderer: Renderer, opts: BakeOptions): Promise<SymbolSet> {
  const o: BakeOptions = { edition: opts.edition, cellPx: opts.cellPx, env: opts.env.map((c) => [c[0], c[1], c[2]] as [number, number, number]) };
  return new Promise<SymbolSet>((resolve, reject) => {
    const textures: Texture[] = [];
    const next = (fn: () => void) => {
      if (typeof document !== 'undefined' && document.hidden) setTimeout(fn, 0);
      else requestAnimationFrame(() => fn());
    };
    const step = () => {
      try {
        if (textures.length < ART_SYMBOLS) {
          textures.push(bakeSymbol(renderer, textures.length, o));
          next(step);
        } else {
          resolve({ edition: o.edition, cellPx: Math.round(o.cellPx), textures, glow: bakeGlow(renderer, o.cellPx) });
        }
      } catch (e) {
        for (const t of textures) t.destroy(true);
        reject(e);
      }
    };
    next(step);
  });
}

export function bakeCellFx(renderer: Renderer, cellPx: number): CellFx {
  const p = fxProg();
  p.setEnv(DEFAULT_ENV);
  const px = Math.max(16, Math.round(cellPx));
  const k = (kind: number, w = px, h = px) => { p.u.uKind = kind; return paint(renderer, p, w, h); };
  return {
    cellBg: k(FX_KIND.cellBg),
    frost: k(FX_KIND.frost),
    markRing: k(FX_KIND.markRing, Math.round(px * 0.62), Math.round(px * 0.3)),
    plasmaBg: k(FX_KIND.plasmaBg),
    stormBg: k(FX_KIND.stormBg),
  };
}

/** Destroy every texture of a set (GPU memory). */
export function destroySymbolSet(set: SymbolSet): void {
  for (const t of set.textures) t.destroy(true);
  set.glow.destroy(true);
}
export function destroyCellFx(fx: CellFx): void {
  fx.cellBg.destroy(true); fx.frost.destroy(true); fx.markRing.destroy(true); fx.plasmaBg.destroy(true); fx.stormBg.destroy(true);
}

/**
 * Re-bake hook for WebGL context restore: RenderTexture contents do not survive a lost context, so the owner
 * of the sets should re-run bakeSymbols/bakeCellFx (and swap them in) when this fires. Returns an unsubscribe.
 * Programs, geometry and the scratch target need no handling — Pixi re-creates their GPU objects lazily.
 */
export function onArtContextRestored(renderer: Renderer, rebake: () => void): () => void {
  // deferred one frame: every GL system must have processed the restore before we render into targets again
  const hook = { contextChange: () => { requestAnimationFrame(() => rebake()); } };
  renderer.runners.contextChange.add(hook);
  return () => { renderer.runners.contextChange.remove(hook); };
}
