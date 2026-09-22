// Isfont — procedural display type for NORDLYS · SOLSTORM G5.
//
//   installIsfont(renderer)   builds the CPU SDF atlas (once) and pre-warms the shader.
//   new IsText({ text, size, style, tracking?, align? })
//
// One IsText = one Mesh (one draw call) with one quad per glyph, all sharing the atlas
// texture and a single GlProgram. `letters` are lightweight Containers (one per visible
// glyph, pivot = glyph centre) whose transform/alpha is folded into the vertex buffer on
// render — tween letter.scale / rotation / alpha / position freely. Changing `.text`
// rewrites the quads in place (no allocation unless the text grows past its capacity).
import {
  Buffer, BufferUsage, Container, Geometry, Mesh, Rectangle, RenderTexture, Shader, UniformGroup,
  type DestroyOptions, type Renderer,
} from 'pixi.js';
import { getAtlas, type IsAtlas } from './atlas.ts';
import { CAP } from './glyphs.ts';
import {
  isProgram, writeStyle, N_VEC, U_GLOW, U_SWEEP, U_REVEAL, U_TIME, U_TEXTW, U_REVK, U_SLITY, U_SLITW, U_REFLECT, U_HORIZON, type IsStyle,
} from './shader.ts';

export type { IsStyle } from './shader.ts';
export type IsAlign = 'center' | 'left' | 'right';

export interface IsTextOptions {
  text: string;
  /** cap height in CSS px */
  size: number;
  style: IsStyle;
  /** extra letter spacing as a fraction of the cap height (e.g. 0.14) */
  tracking?: number;
  align?: IsAlign;
  /** logo ornaments (star glint) for display words; default true */
  decor?: boolean;
}

/**
 * Logo lockups: display words get a signature treatment when set at ≥ 22 px —
 * a horizon slit through every letter (reflection tint below it), a horizon light
 * streak running through the slit past both ends, and a star glint on the O.
 */
interface Lockup { slitY: number; slitW: number; reflect: number; glint: string; gx: number; gy: number; gs: number; streak: number }
const LOCKUPS: Record<string, Lockup> = {
  NORDLYS: { slitY: 4.1, slitW: 0.62, reflect: 1, glint: 'O', gx: 0.86, gy: 13.0, gs: 12, streak: 1.5 },
  SOLSTORM: { slitY: 4.1, slitW: 0.62, reflect: 0.7, glint: 'O', gx: 0.86, gy: 13.0, gs: 12, streak: 1.3 },
};

/** Line box height as a multiple of the cap height (what .height reports). */
export const LINE = 1.38;

const FLOATS = 10;           // per vertex: pos2 uv2 text2 misc4
const STRIDE = FLOATS * 4;
const QUAD = FLOATS * 4;     // floats per quad

let clockFn: () => number = () => performance.now() / 1000;
/** Override the shader clock (seconds) — deterministic screenshots / the game's clock. */
export function setIsfontClock(fn: () => number): void { clockFn = fn; }

/** Build the CPU SDF atlas and pre-warm the program + texture upload. Idempotent. */
let warmed: Renderer | null = null;
export function installIsfont(renderer: Renderer): void {
  getAtlas();
  if (warmed === renderer) return;
  warmed = renderer;
  try {
    const rt = RenderTexture.create({ width: 4, height: 4 });
    const t = new IsText({ text: 'NORDLYS 0', size: 4, style: 'ice' });
    renderer.render({ container: t, target: rt, clear: true });
    t.destroy();
    rt.destroy(true);
  } catch (e) {
    console.warn('isfont prewarm failed', e);
  }
}

/** Atlas stats (dev / diagnostics). */
export function isfontStats(): { ms: number; width: number; height: number; glyphs: number } {
  const a = getAtlas();
  return { ms: a.ms, width: a.width, height: a.height, glyphs: a.glyphs.length };
}

const quadIndex = (cap: number): Uint16Array => {
  const ix = new Uint16Array(cap * 6);
  for (let q = 0; q < cap; q++) {
    const v = q * 4, o = q * 6;
    ix[o] = v; ix[o + 1] = v + 1; ix[o + 2] = v + 2; ix[o + 3] = v; ix[o + 4] = v + 2; ix[o + 5] = v + 3;
  }
  return ix;
};

type Tickable = Container & { _didContainerChangeTick: number };

export class IsText extends Container {
  /** One container per visible glyph (spaces excluded); pivot = glyph centre. */
  readonly letters: Container[] = [];
  private readonly _pool: Container[] = [];
  private _text = '';
  private _style: IsStyle;
  private _size: number;
  private _tracking: number;
  private _align: IsAlign;
  private _decor: boolean;
  private _pxu: number;           // px per unit
  private _textW = 0;               // units
  private _atlas: IsAtlas;
  private _mesh: Mesh<Geometry, Shader>;
  private _geom: Geometry;
  private _vbuf: Buffer;
  private _ibuf: Buffer;
  private _v: Float32Array;
  private _cap = 0;                 // quad capacity
  private _used = 0;                // quads written (letters + decor)
  private _prevUsed = 0;
  private _shader: Shader;
  private _uni: UniformGroup;
  private _u: Float32Array;
  // per letter (index = letter slot)
  private _gid = new Int16Array(8);
  private _gx = new Float32Array(8);    // glyph origin x (units, text space)
  private _tick = new Int32Array(8);
  private _under = 0;                   // decor quads drawn beneath the glyphs (streak)
  private _over = 0;                    // decor quads drawn above (glint)
  private _glintOf = 0;                 // letter the glint follows
  private _lock: Lockup | null = null;
  private _inkL = 0;                    // ink extent (units, after alignment offset)
  private _inkR = 0;
  private _dirty = false;
  private _bounds = new Rectangle();

  constructor(opts: IsTextOptions) {
    super();
    this._atlas = getAtlas();
    this._style = opts.style ?? 'ice';
    this._size = Math.max(1, opts.size);
    this._tracking = opts.tracking ?? 0;
    this._align = opts.align ?? 'center';
    this._decor = opts.decor ?? true;
    this._pxu = this._size / CAP;
    this._u = new Float32Array(N_VEC * 4);
    writeStyle(this._u, this._style, this._size);
    this._u[U_GLOW] = 1;
    this._u[U_SWEEP] = -0.2;
    this._u[U_REVEAL] = 1;
    this._u[U_TIME] = clockFn();
    this._u[U_REVK] = 1.1;
    this._uni = new UniformGroup({ uS: { value: this._u, type: 'vec4<f32>', size: N_VEC } });
    this._shader = new Shader({
      glProgram: isProgram(this._atlas.width, this._atlas.height),
      resources: { uTexture: this._atlas.source, isUniforms: this._uni },
    });
    const cap = Math.max(4, opts.text.length + 1);
    this._v = new Float32Array(cap * QUAD);
    this._cap = cap;
    this._vbuf = new Buffer({ data: this._v, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST, label: 'isfont-v' });
    this._ibuf = new Buffer({ data: quadIndex(cap), usage: BufferUsage.INDEX | BufferUsage.COPY_DST, label: 'isfont-i' });
    this._geom = new Geometry({
      attributes: {
        aPosition: { buffer: this._vbuf, format: 'float32x2', stride: STRIDE, offset: 0 },
        aUV: { buffer: this._vbuf, format: 'float32x2', stride: STRIDE, offset: 8 },
        aText: { buffer: this._vbuf, format: 'float32x2', stride: STRIDE, offset: 16 },
        aMisc: { buffer: this._vbuf, format: 'float32x4', stride: STRIDE, offset: 24 },
      },
      indexBuffer: this._ibuf,
    });
    this._mesh = new Mesh({ geometry: this._geom, shader: this._shader });
    this.addChild(this._mesh);
    this.boundsArea = this._bounds;
    this.onRender = this._sync;
    this.text = opts.text;
  }

  // ------------------------------------------------------------------ public API
  get text(): string { return this._text; }
  set text(v: string) {
    if (this.destroyed) return;
    v = v ?? '';
    if (v === this._text) return;
    this._text = v;
    this._layout();
  }

  get style(): IsStyle { return this._style; }
  set style(s: IsStyle) {
    if (s === this._style) return;
    this._style = s;
    writeStyle(this._u, s, this._size);
  }

  /** Cap height in CSS px (re-lays out; cheap). */
  get size(): number { return this._size; }
  set size(v: number) {
    if (this.destroyed) return;
    v = Math.max(1, v);
    if (v === this._size) return;
    this._size = v;
    this._pxu = v / CAP;
    writeStyle(this._u, this._style, v);
    this._layout();
  }

  get tracking(): number { return this._tracking; }
  set tracking(v: number) { if (v !== this._tracking && !this.destroyed) { this._tracking = v; this._layout(); } }

  get align(): IsAlign { return this._align; }
  set align(v: IsAlign) { if (v !== this._align && !this.destroyed) { this._align = v; this._layout(); } }

  /** 0..1 stroke reveal along each glyph's drawing order (letters staggered). */
  get reveal(): number { return this._u[U_REVEAL]; }
  set reveal(v: number) { this._u[U_REVEAL] = v < 0 ? 0 : v > 1 ? 1 : v; }

  /** Outer glow multiplier, 0..2 (1 = style default). */
  get glow(): number { return this._u[U_GLOW]; }
  set glow(v: number) { this._u[U_GLOW] = v < 0 ? 0 : v; }

  /** Light-sweep position: −0.2 (off, left) … 1.2 (off, right). */
  get sweep(): number { return this._u[U_SWEEP]; }
  set sweep(v: number) { this._u[U_SWEEP] = v; }

  /** Visual width of the laid-out text in local px (tracking included, scale excluded). */
  get textWidth(): number { return this._textW * this._pxu; }

  // ------------------------------------------------------------------ layout
  private _ensure(quads: number, letters: number): void {
    if (quads > this._cap) {
      let cap = this._cap;
      while (cap < quads) cap *= 2;
      const v = new Float32Array(cap * QUAD);
      v.set(this._v);
      this._v = v;
      this._cap = cap;
      this._vbuf.data = v;
      this._ibuf.data = quadIndex(cap);
      this._prevUsed = cap; // force full upload
    }
    if (letters > this._gid.length) {
      let n = this._gid.length;
      while (n < letters) n *= 2;
      const gid = new Int16Array(n); gid.set(this._gid); this._gid = gid;
      const gx = new Float32Array(n); gx.set(this._gx); this._gx = gx;
      const tk = new Int32Array(n); tk.set(this._tick); this._tick = tk;
    }
    while (this._pool.length < letters) {
      const L = new Container();
      L.visible = false;
      this._pool.push(L);
      this.addChild(L);
    }
  }

  private _layout(): void {
    const A = this._atlas;
    const lut = A.lut, G = A.glyphs, kern = A.kern, n = A.n;
    const s = this._text;
    // pass 1: count glyphs
    let count = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < lut.length && lut[c] >= 0) count++;
    }
    // logo lockup (display words only)
    const lock = this._decor && this._size >= 22 ? LOCKUPS[s] ?? null : null;
    this._lock = lock;
    this._under = lock && lock.streak > 0 ? 1 : 0;
    this._over = lock && lock.glint ? 1 : 0;
    this._ensure(this._under + count + this._over, count);
    // pass 2: pen positions
    const track = this._tracking * CAP;
    let pen = 0, prev = -1, k = 0;
    let inkL = 0, inkR = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      const gi = c < lut.length ? lut[c] : -1;
      if (gi === -1 || gi === -2) { pen += 4.0 + (prev >= 0 ? track : 0); prev = -1; continue; }
      if (gi === -3) { pen += 2.0; prev = -1; continue; }
      const g = G[gi];
      if (k > 0) pen += track + (prev >= 0 ? kern[prev * n + gi] : 0);
      // tabular figures centre their ink in the fixed advance
      const x0 = g.adv !== g.l + g.w + g.r ? pen + (g.adv - g.w) / 2 : pen + g.l;
      if (k === 0) inkL = x0;
      inkR = x0 + g.w;
      this._gid[k] = gi;
      this._gx[k] = x0;
      pen += g.adv;
      prev = gi;
      k++;
    }
    const W = count > 0 ? inkR - inkL : 0;
    this._textW = W;
    const sc = this._pxu;
    const off = this._align === 'left' ? -inkL : this._align === 'right' ? -inkR : -(inkL + W / 2);
    // letters
    this.letters.length = 0;
    for (let j = 0; j < this._pool.length; j++) {
      const L = this._pool[j];
      if (j < count) {
        const g = G[this._gid[j]];
        this._gx[j] += off;
        L.visible = true;
        L.position.set((this._gx[j] + g.w / 2) * sc, 0);
        this.letters.push(L);
      } else if (L.visible) L.visible = false;
    }
    this._inkL = inkL + off;
    this._inkR = inkR + off;
    if (lock) {
      let li = 0;
      for (let i = 0, kk = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c < lut.length && lut[c] >= 0) { if (s[i] === lock.glint) { li = kk; break; } kk++; }
      }
      this._glintOf = li;
    }
    this._u[U_SLITY] = lock ? lock.slitY : 0;
    this._u[U_SLITW] = lock ? lock.slitW : 0;
    this._u[U_REFLECT] = lock ? lock.reflect : 0;
    this._u[U_HORIZON] = lock ? lock.slitY / CAP : 0.5;
    // text-space uniforms
    this._u[U_TEXTW] = W;
    // bounds: ink width × line box (cap height + room for glow / extrusion), centred on
    // the cap-height middle → .width = ink width, .height = LINE × cap height
    const bx = (inkL + off) * sc;
    this._bounds.x = count > 0 ? bx : 0;
    this._bounds.y = (-CAP * LINE * sc) / 2;
    this._bounds.width = W * sc;
    this._bounds.height = CAP * LINE * sc;
    // write every quad
    for (let j = 0; j < count; j++) this._writeQuad(j);
    this._writeDecor();
    const used = this._under + count + this._over;
    if (this._prevUsed > used) this._v.fill(0, used * QUAD, this._prevUsed * QUAD);
    this._used = used;
    this._upload(Math.max(used, this._prevUsed));
    this._prevUsed = used;
  }

  private _upload(quads: number): void {
    this._vbuf.update(Math.max(1, quads) * QUAD * 4);
    this._dirty = false;
  }

  private _writeQuad(j: number): void {
    const A = this._atlas;
    const g = A.glyphs[this._gid[j]];
    const L = this._pool[j] as Tickable;
    L.updateLocalTransform();
    this._tick[j] = L._didContainerChangeTick;
    const m = L.localTransform;
    const alpha = L.visible ? L.alpha : 0;
    const sc = this._pxu;
    const cx = g.w / 2, cy = CAP / 2;               // pivot: glyph centre (units)
    const phase = this.letters.length > 1 ? j / (this.letters.length - 1) : 0;
    const v = this._v;
    let o = (this._under + j) * QUAD;
    const u0 = g.px / A.width, v0 = g.py / A.height;
    const u1 = (g.px + g.pw) / A.width, v1 = (g.py + g.ph) / A.height;
    const gx = this._gx[j];
    for (let c = 0; c < 4; c++) {
      const right = c === 1 || c === 2, bottom = c >= 2;
      const ux = g.ux + (right ? g.uw : 0);
      const uy = g.uy - (bottom ? g.uh : 0);
      const lx = (ux - cx) * sc, ly = (cy - uy) * sc;
      v[o] = m.a * lx + m.c * ly + m.tx;
      v[o + 1] = m.b * lx + m.d * ly + m.ty;
      v[o + 2] = right ? u1 : u0;
      v[o + 3] = bottom ? v1 : v0;
      v[o + 4] = gx - this._inkL + ux; // text space: 0 at the left ink edge
      v[o + 5] = uy;
      v[o + 6] = alpha;
      v[o + 7] = phase;
      v[o + 8] = 0;
      v[o + 9] = 0;
      o += FLOATS;
    }
  }

  /** Streak (under the glyphs, follows the whole word) and glint (over, follows its letter). */
  private _writeDecor(): void {
    const lock = this._lock;
    if (!lock) return;
    const v = this._v, sc = this._pxu, n = this.letters.length;
    const du = 0.5 / this._atlas.width, dv = 0.5 / this._atlas.height; // dummy uv (gutter texel)
    if (this._under) {
      let a = 0;
      for (let j = 0; j < n; j++) { const L = this._pool[j]; a += L.visible ? L.alpha : 0; }
      a = n ? a / n : 1;
      const ext = lock.streak * CAP;
      const x0 = (this._inkL - ext) * sc, x1 = (this._inkR + ext) * sc;
      const yc = (CAP / 2 - lock.slitY) * sc, hh = 2.8 * sc;
      let o = 0;
      for (let c = 0; c < 4; c++) {
        const right = c === 1 || c === 2, bottom = c >= 2;
        v[o] = right ? x1 : x0; v[o + 1] = yc + (bottom ? hh : -hh);
        v[o + 2] = du; v[o + 3] = dv;
        v[o + 4] = right ? 1 : -1; v[o + 5] = bottom ? -1 : 1;
        v[o + 6] = a; v[o + 7] = 0.5; v[o + 8] = 2; v[o + 9] = 0;
        o += FLOATS;
      }
    }
    if (this._over && n > 0) {
      const li = this._glintOf;
      const L = this._pool[li] as Tickable;
      L.updateLocalTransform();
      const m = L.localTransform;
      const g = this._atlas.glyphs[this._gid[li]];
      const px = g.w * lock.gx, py = lock.gy, hs = lock.gs;
      const cx = g.w / 2, cy = CAP / 2;
      const alpha = L.visible ? L.alpha : 0;
      const phase = n > 1 ? li / (n - 1) : 0;
      let o = (this._under + n) * QUAD;
      for (let c = 0; c < 4; c++) {
        const right = c === 1 || c === 2, bottom = c >= 2;
        const qx = right ? 1 : -1, qy = bottom ? -1 : 1;
        const lx = (px + qx * hs - cx) * sc, ly = (cy - (py + qy * hs * 0.75)) * sc;
        v[o] = m.a * lx + m.c * ly + m.tx;
        v[o + 1] = m.b * lx + m.d * ly + m.ty;
        v[o + 2] = du; v[o + 3] = dv;
        v[o + 4] = qx; v[o + 5] = qy;
        v[o + 6] = alpha; v[o + 7] = phase; v[o + 8] = 1; v[o + 9] = 0.37;
        o += FLOATS;
      }
    }
  }

  /** Per-frame (onRender): fold changed letter transforms into the buffer, tick the clock. */
  private _sync = (): void => {
    this._u[U_TIME] = clockFn();
    const n = this.letters.length;
    let dirty = this._dirty;
    for (let j = 0; j < n; j++) {
      if ((this._pool[j] as Tickable)._didContainerChangeTick !== this._tick[j]) {
        this._writeQuad(j);
        dirty = true;
      }
    }
    if (dirty) {
      this._writeDecor();
      this._upload(this._used);
    }
  };

  override destroy(options?: DestroyOptions): void {
    if (this.destroyed) return;
    this.onRender = null;
    this._shader.destroy(false);
    this._geom.destroy(true);
    super.destroy({ children: true, ...(typeof options === 'object' ? options : {}) });
  }
}
