// Isfont — CPU signed-distance atlas.
//
// Each glyph is compiled from its skeleton (glyphs.ts) into distance primitives:
//   line   capsule distance to a segment (terminals may be extended + cut by a plane)
//   arc    distance to a circular fillet arc
//   ring   distance to a full circle (Å)
//   poly   convex mitre kite that squares off sharp outer corners
// and baked into one RGBA8 texture (BufferImageSource → survives context loss):
//   R  signed distance, SD_MIN..SD_MIN+SD_RANGE units (negative = inside the stroke)
//   G  normalised arc length along the glyph's drawing order (stroke reveal)
//   B,A  outward unit gradient of the distance field (x, y-up), for the bevel normal
import { BufferImageSource } from 'pixi.js';
import { CAP, R0, OV, GLYPHS, KERN, type StrokeDef, type GlyphDef, type CapKind } from './glyphs.ts';

export const PPU = 5;          // atlas texels per unit (cap height = 70 texels)
export const MARGIN = 4;       // distance-field margin around the ink (units) — glow room
export const SD_MIN = -2;
export const SD_RANGE = 6;
const ATLAS_W = 1024;
const GUTTER = 2;
const CUT = (12 * Math.PI) / 180;
const FAR = 1.8; // beyond this distance (units) the far field is interpolated from a 2× coarser grid
const CUT_C = Math.cos(CUT), CUT_S = Math.sin(CUT);

export interface GlyphInfo {
  ch: string;
  w: number; l: number; r: number; adv: number;
  /** cell rect in atlas texels */
  px: number; py: number; pw: number; ph: number;
  /** cell rect in glyph units: left x, top y (y up), width, height */
  ux: number; uy: number; uw: number; uh: number;
  /** measured ink box (units) */
  ix0: number; iy0: number; ix1: number; iy1: number;
}

export interface IsAtlas {
  source: BufferImageSource;
  width: number; height: number;
  glyphs: GlyphInfo[];
  /** char code → glyph index; -2 space, -3 thin space, -1 unknown */
  lut: Int16Array;
  kern: Float32Array;   // [a * n + b]
  n: number;
  ms: number;
  /** compiled skeletons (pen position for the reveal tip) */
  skel: CGlyph[];
}

/** Pen position (glyph units) at normalised arc length t along glyph gi → out[0], out[1]. */
export function penAt(a: IsAtlas, gi: number, t: number, out: Float32Array): void {
  const g = a.skel[gi];
  const target = Math.max(0, Math.min(1, t)) * g.total;
  let last: Piece | null = null;
  for (let si = 0; si < g.strokes.length; si++) {
    const ps = g.strokes[si].pieces;
    for (let pi = 0; pi < ps.length; pi++) {
      const p = ps[pi];
      if (p.t === T_POLY) continue;
      last = p;
      if (target > p.s1) continue;
      const f = p.s1 > p.s0 ? Math.max(0, (target - p.s0) / (p.s1 - p.s0)) : 0;
      if (p.t === T_LINE) { out[0] = p.oax + (p.obx - p.oax) * f; out[1] = p.oay + (p.oby - p.oay) * f; }
      else if (p.t === T_ARC) { const an = p.a0 + p.sw * f; out[0] = p.cx + Math.cos(an) * p.rad; out[1] = p.cy + Math.sin(an) * p.rad; }
      else { const an = Math.PI / 2 + f * 2 * Math.PI; out[0] = p.cx + Math.cos(an) * p.rad; out[1] = p.cy + Math.sin(an) * p.rad; }
      return;
    }
  }
  if (last) { out[0] = last.t === T_LINE ? last.obx : last.bx; out[1] = last.t === T_LINE ? last.oby : last.by; }
}

// ------------------------------------------------------------------ primitives
const T_LINE = 0, T_ARC = 1, T_RING = 2, T_POLY = 3;

class Piece {
  t = T_LINE;
  ax = 0; ay = 0; bx = 0; by = 0;          // line geometry (possibly extended)
  oax = 0; oay = 0; obx = 0; oby = 0;      // original line ends (arc-length mapping)
  s0 = 0; s1 = 0;                          // arc length at the original ends / arc ends
  cx = 0; cy = 0; rad = 0; a0 = 0; sw = 0; // arc / ring (arc ends stored in ax..by)
  u0x = 0; u0y = 0; u1x = 0; u1y = 0;      // arc start / end directions
  poly: number[] = [];
  planes: number[] = [];                   // nx, ny, px, py …
  x0 = 0; y0 = 0; x1 = 0; y1 = 0;          // skeleton bbox (for pruning)
  e0 = 0; e1 = 0;                          // line ends: 0 plain, 1 extended to a clip line, 2 cut by a plane
}

interface CStroke { pieces: Piece[]; lo: number; hi: number }
interface CGlyph { strokes: CStroke[]; total: number }

function bboxLine(p: Piece): void {
  p.x0 = Math.min(p.ax, p.bx); p.x1 = Math.max(p.ax, p.bx);
  p.y0 = Math.min(p.ay, p.by); p.y1 = Math.max(p.ay, p.by);
}

function lineP(ax: number, ay: number, bx: number, by: number, s0: number, s1: number): Piece {
  const p = new Piece();
  p.t = T_LINE;
  p.ax = p.oax = ax; p.ay = p.oay = ay; p.bx = p.obx = bx; p.by = p.oby = by;
  p.s0 = s0; p.s1 = s1;
  bboxLine(p);
  return p;
}

function resolveCap(c: CapKind | undefined, y: number): 'line' | 'cut' | 'flat' | 'round' {
  const k = c ?? 'auto';
  if (k !== 'auto') return k;
  return y <= 0.001 || y >= CAP - 0.001 ? 'line' : 'cut';
}

/** Apply a terminal to the first (end = 0) or last (end = 1) line piece of a stroke. */
function terminal(pieces: Piece[], end: 0 | 1, kind: 'line' | 'cut' | 'flat' | 'round', sEnd: number): void {
  if (kind === 'round') return;
  const p = end === 0 ? pieces[0] : pieces[pieces.length - 1];
  if (p.t !== T_LINE) return;
  // outward tangent t at the terminal
  let tx = end === 0 ? p.oax - p.obx : p.obx - p.oax;
  let ty = end === 0 ? p.oay - p.oby : p.oby - p.oay;
  const tl = Math.hypot(tx, ty) || 1;
  tx /= tl; ty /= tl;
  const ex = end === 0 ? p.oax : p.obx, ey = end === 0 ? p.oay : p.oby;
  let ext: number;
  if (kind === 'line') ext = R0 / Math.max(Math.abs(ty), 0.25) + 0.08;
  else ext = R0 * 1.25;
  if (end === 0) { p.ax = ex + tx * ext; p.ay = ey + ty * ext; p.e0 = kind === 'line' ? 1 : 2; } else { p.bx = ex + tx * ext; p.by = ey + ty * ext; p.e1 = kind === 'line' ? 1 : 2; }
  bboxLine(p);
  if (kind === 'line') return; // the stroke's y clip squares it off
  let nx: number, ny: number;
  if (kind === 'flat') { nx = tx; ny = ty; } else {
    // one global blade direction: near-horizontal cut (rising 12°) for vertical-ish ends,
    // near-vertical cut (leaning right 12°) for horizontal-ish ends
    const cx = Math.abs(ty) >= Math.abs(tx) ? CUT_C : CUT_S;
    const cy = Math.abs(ty) >= Math.abs(tx) ? CUT_S : CUT_C;
    nx = cy; ny = -cx;
    if (nx * tx + ny * ty < 0) { nx = -nx; ny = -ny; }
  }
  // cut every piece whose arc length lies within ~2r of this terminal
  for (const q of pieces) {
    const near = end === 0 ? Math.min(q.s0, q.s1) - sEnd < 2 * R0 : sEnd - Math.max(q.s0, q.s1) < 2 * R0;
    if (near && q.t !== T_POLY) q.planes.push(nx, ny, ex, ey);
  }
}

function compileStroke(sd: StrokeDef, g: GlyphDef, sStart: number): { st: CStroke; len: number } {
  const clip = sd.clip ?? (g.ov ? [-OV, CAP + OV] : [0, CAP]);
  const r = R0;
  const pieces: Piece[] = [];
  if (sd.ring) {
    const p = new Piece();
    p.t = T_RING; p.cx = sd.p[0]; p.cy = sd.p[1]; p.rad = sd.ring;
    const len = 2 * Math.PI * sd.ring;
    p.s0 = sStart; p.s1 = sStart + len;
    p.x0 = p.cx - p.rad; p.x1 = p.cx + p.rad; p.y0 = p.cy - p.rad; p.y1 = p.cy + p.rad;
    return { st: { pieces: [p], lo: clip[0], hi: clip[1] }, len };
  }
  const n = sd.p.length / 2;
  const P = (i: number) => [sd.p[i * 2], sd.p[i * 2 + 1]] as const;
  const fil = (i: number) => (Array.isArray(sd.f) ? sd.f[i - 1] ?? 0 : sd.f ?? 0);
  let s = sStart;
  let [curx, cury] = P(0);
  const kites: { vx: number; vy: number; i: number; s: number }[] = [];
  for (let i = 1; i < n; i++) {
    const [px, py] = P(i);
    const f = i < n - 1 ? fil(i) : 0;
    if (i < n - 1 && f > 0) {
      const [qx, qy] = P(i + 1);
      let dix = px - sd.p[(i - 1) * 2], diy = py - sd.p[(i - 1) * 2 + 1];
      let dox = qx - px, doy = qy - py;
      const li = Math.hypot(dix, diy), lo = Math.hypot(dox, doy);
      dix /= li; diy /= li; dox /= lo; doy /= lo;
      const cosp = Math.max(-1, Math.min(1, dix * dox + diy * doy));
      const phi = Math.acos(cosp);
      if (phi < 1e-3) { pieces.push(lineP(curx, cury, px, py, s, s + Math.hypot(px - curx, py - cury))); s = pieces[pieces.length - 1].s1; curx = px; cury = py; continue; }
      // clamp the fillet so it fits both legs
      const nextF = i + 1 < n - 1 ? fil(i + 1) : 0;
      const avail = Math.min(Math.hypot(px - curx, py - cury), nextF > 0 ? lo / 2 : lo) * 0.999;
      let t = f * Math.tan(phi / 2);
      let rad = f;
      if (t > avail) { t = avail; rad = t / Math.tan(phi / 2); }
      const t1x = px - dix * t, t1y = py - diy * t;
      const t2x = px + dox * t, t2y = py + doy * t;
      const cross = dix * doy - diy * dox;
      const nx = cross > 0 ? -diy : diy, ny = cross > 0 ? dix : -dix;
      const cx = t1x + nx * rad, cy = t1y + ny * rad;
      const l1 = Math.hypot(t1x - curx, t1y - cury);
      if (l1 > 1e-4) { pieces.push(lineP(curx, cury, t1x, t1y, s, s + l1)); s += l1; }
      const a = new Piece();
      a.t = T_ARC; a.cx = cx; a.cy = cy; a.rad = rad;
      a.a0 = Math.atan2(t1y - cy, t1x - cx);
      a.sw = cross > 0 ? phi : -phi;
      a.ax = t1x; a.ay = t1y; a.bx = t2x; a.by = t2y;
      a.u0x = (t1x - cx) / rad; a.u0y = (t1y - cy) / rad; a.u1x = (t2x - cx) / rad; a.u1y = (t2y - cy) / rad;
      a.s0 = s; a.s1 = s + rad * phi; s = a.s1;
      a.x0 = Math.min(t1x, t2x, cx) - 0.01; a.x1 = Math.max(t1x, t2x, cx) + 0.01;
      a.y0 = Math.min(t1y, t2y, cy) - 0.01; a.y1 = Math.max(t1y, t2y, cy) + 0.01;
      // include the arc's extreme (it bulges past the chord) — conservative: circle bbox ∩ is fine
      a.x0 = Math.min(a.x0, cx - rad); a.x1 = Math.max(a.x1, cx + rad);
      a.y0 = Math.min(a.y0, cy - rad); a.y1 = Math.max(a.y1, cy + rad);
      pieces.push(a);
      curx = t2x; cury = t2y;
    } else {
      const l = Math.hypot(px - curx, py - cury);
      if (l > 1e-4) { pieces.push(lineP(curx, cury, px, py, s, s + l)); s += l; }
      if (i < n - 1) kites.push({ vx: px, vy: py, i, s });
      curx = px; cury = py;
    }
  }
  // mitre kites at sharp joints
  for (const k of kites) {
    const [ax, ay] = P(k.i - 1), [qx, qy] = P(k.i + 1);
    let dix = k.vx - ax, diy = k.vy - ay, dox = qx - k.vx, doy = qy - k.vy;
    const li = Math.hypot(dix, diy), lo = Math.hypot(dox, doy);
    dix /= li; diy /= li; dox /= lo; doy /= lo;
    const cross = dix * doy - diy * dox;
    if (Math.abs(cross) < 0.02 && dix * dox + diy * doy > 0) continue; // straight
    // outer side normals
    const n1x = cross > 0 ? diy : -diy, n1y = cross > 0 ? -dix : dix;
    const n2x = cross > 0 ? doy : -doy, n2y = cross > 0 ? -dox : dox;
    let mx = n1x + n2x, my = n1y + n2y;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-4) continue;
    mx /= ml; my /= ml;
    const ch = mx * n1x + my * n1y; // cos(half turn)
    const miterLen = r / Math.max(ch, 1e-4);
    const lim = (sd.miter ?? 2.5) * r;
    const A = [k.vx + n1x * r, k.vy + n1y * r], B = [k.vx + n2x * r, k.vy + n2y * r];
    const poly: number[] = [k.vx, k.vy, A[0], A[1]];
    if (miterLen <= lim) {
      poly.push(k.vx + mx * miterLen, k.vy + my * miterLen);
    } else {
      const sa = (lim - (n1x * r * mx + n1y * r * my)) / Math.max(dix * mx + diy * my, 1e-4);
      const sb = (lim - (n2x * r * mx + n2y * r * my)) / Math.max(-(dox * mx + doy * my), 1e-4);
      poly.push(A[0] + dix * sa, A[1] + diy * sa, B[0] - dox * sb, B[1] - doy * sb);
    }
    poly.push(B[0], B[1]);
    const p = new Piece();
    p.t = T_POLY; p.poly = poly; p.s0 = p.s1 = k.s;
    p.x0 = Infinity; p.y0 = Infinity; p.x1 = -Infinity; p.y1 = -Infinity;
    for (let j = 0; j < poly.length; j += 2) {
      p.x0 = Math.min(p.x0, poly[j]); p.x1 = Math.max(p.x1, poly[j]);
      p.y0 = Math.min(p.y0, poly[j + 1]); p.y1 = Math.max(p.y1, poly[j + 1]);
    }
    pieces.push(p);
  }
  const [sx0, sy0] = P(0), [sx1, sy1] = P(n - 1);
  terminal(pieces, 0, resolveCap(sd.c0, sy0), sStart);
  const lastLine = pieces.filter((q) => q.t !== T_POLY);
  terminal(lastLine, 1, resolveCap(sd.c1, sy1), s);
  void sx0; void sx1;
  return { st: { pieces, lo: clip[0], hi: clip[1] }, len: s - sStart };
}

/** Conservative ink box of a compiled stroke (units), clipped to its y range. */
function strokeInk(st: CStroke, box: number[]): void {
  const r = R0;
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    box[0] = Math.min(box[0], x0); box[2] = Math.max(box[2], x1);
    box[1] = Math.min(box[1], Math.max(y0, st.lo)); box[3] = Math.max(box[3], Math.min(y1, st.hi));
  };
  for (const p of st.pieces) {
    if (p.t === T_LINE) {
      const pad0 = p.e0 === 2 ? r + 0.3 : r, pad1 = p.e1 === 2 ? r + 0.3 : r;
      const ax = p.e0 === 1 ? p.ax : p.oax, ay = p.e0 === 1 ? p.ay : p.oay;
      const bx = p.e1 === 1 ? p.bx : p.obx, by = p.e1 === 1 ? p.by : p.oby;
      add(ax - pad0, ay - pad0, ax + pad0, ay + pad0);
      add(bx - pad1, by - pad1, bx + pad1, by + pad1);
    } else if (p.t === T_ARC) {
      let x0 = Math.min(p.ax, p.bx), x1 = Math.max(p.ax, p.bx), y0 = Math.min(p.ay, p.by), y1 = Math.max(p.ay, p.by);
      for (let q = 0; q < 4; q++) {
        const ang = (q * Math.PI) / 2;
        let rel = (ang - p.a0) * (p.sw >= 0 ? 1 : -1);
        rel = ((rel % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (rel <= Math.abs(p.sw)) {
          const x = p.cx + Math.cos(ang) * p.rad, y = p.cy + Math.sin(ang) * p.rad;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
      }
      add(x0 - r, y0 - r, x1 + r, y1 + r);
    } else if (p.t === T_RING) {
      add(p.cx - p.rad - r, p.cy - p.rad - r, p.cx + p.rad + r, p.cy + p.rad + r);
    } else add(p.x0, p.y0, p.x1, p.y1);
  }
}

function compileGlyph(g: GlyphDef): CGlyph {
  const strokes: CStroke[] = [];
  let s = 0;
  for (const sd of g.s) {
    const { st, len } = compileStroke(sd, g, s);
    strokes.push(st);
    s += len;
  }
  return { strokes, total: s };
}

// ------------------------------------------------------------------ evaluation
// out-params in a typed array: module-level `let` doubles would be boxed on every write
const OUT = new Float64Array(2); // [0] piece arc length, [1] glyph arc length

/** Distance of (x, y) to piece p; the arc-length param is only resolved when d < best. */
function evalPiece(p: Piece, x: number, y: number, best: number): number {
  let d: number;
  if (p.t === T_LINE) {
    const dx = p.bx - p.ax, dy = p.by - p.ay;
    const L2 = dx * dx + dy * dy;
    let h = L2 > 0 ? ((x - p.ax) * dx + (y - p.ay) * dy) / L2 : 0;
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const qx = p.ax + h * dx - x, qy = p.ay + h * dy - y;
    d = Math.sqrt(qx * qx + qy * qy) - R0;
  } else if (p.t === T_ARC) {
    const vx = x - p.cx, vy = y - p.cy;
    const sg = p.sw >= 0 ? 1 : -1;
    const inside = sg * (p.u0x * vy - p.u0y * vx) >= 0 && sg * (vx * p.u1y - vy * p.u1x) >= 0;
    if (inside) d = Math.abs(Math.sqrt(vx * vx + vy * vy) - p.rad) - R0;
    else {
      const ax = x - p.ax, ay = y - p.ay, bx = x - p.bx, by = y - p.by;
      d = Math.sqrt(Math.min(ax * ax + ay * ay, bx * bx + by * by)) - R0;
    }
  } else if (p.t === T_RING) {
    const vx = x - p.cx, vy = y - p.cy;
    d = Math.abs(Math.sqrt(vx * vx + vy * vy) - p.rad) - R0;
  } else {
    // convex polygon SDF (iq)
    const v = p.poly;
    const N = v.length / 2;
    let dd = (x - v[0]) * (x - v[0]) + (y - v[1]) * (y - v[1]);
    let sgn = 1;
    for (let i = 0, j = N - 1; i < N; j = i, i++) {
      const vix = v[i * 2], viy = v[i * 2 + 1], vjx = v[j * 2], vjy = v[j * 2 + 1];
      const ex = vjx - vix, ey = vjy - viy;
      const wx = x - vix, wy = y - viy;
      const ee = ex * ex + ey * ey;
      let h = ee > 0 ? (wx * ex + wy * ey) / ee : 0;
      h = h < 0 ? 0 : h > 1 ? 1 : h;
      const bx = wx - ex * h, by = wy - ey * h;
      dd = Math.min(dd, bx * bx + by * by);
      const c1 = y >= viy, c2 = y < vjy, c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) sgn = -sgn;
    }
    d = sgn * Math.sqrt(dd);
  }
  const pl = p.planes;
  for (let i = 0; i < pl.length; i += 4) {
    const dp = (x - pl[i + 2]) * pl[i] + (y - pl[i + 3]) * pl[i + 1];
    if (dp > d) d = dp;
  }
  if (d < best) {
    if (p.t === T_LINE) {
      const ox = p.obx - p.oax, oy = p.oby - p.oay;
      const O2 = ox * ox + oy * oy;
      let ho = O2 > 0 ? ((x - p.oax) * ox + (y - p.oay) * oy) / O2 : 0;
      ho = ho < 0 ? 0 : ho > 1 ? 1 : ho;
      OUT[0] = p.s0 + (p.s1 - p.s0) * ho;
    } else if (p.t === T_ARC) {
      const vx = x - p.cx, vy = y - p.cy;
      let rel = (Math.atan2(vy, vx) - p.a0) * (p.sw >= 0 ? 1 : -1);
      rel = ((rel % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const asw = Math.abs(p.sw);
      if (rel > asw) rel = rel - asw < 2 * Math.PI - rel ? asw : 0;
      OUT[0] = p.s0 + (p.s1 - p.s0) * (rel / asw);
    } else if (p.t === T_RING) {
      let a = Math.atan2(y - p.cy, x - p.cx) - Math.PI / 2; // start at the top, counter-clockwise
      a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      OUT[0] = p.s0 + (p.s1 - p.s0) * (a / (2 * Math.PI));
    } else OUT[0] = p.s0;
  }
  return d;
}

function evalGlyph(g: CGlyph, x: number, y: number, bound0: number): number {
  let best = bound0, bestS = 1;
  // inside the ink the reveal param is the EARLIEST arc length of any stroke covering the
  // texel, so a later stroke overlapping an earlier one never notches it during the reveal
  let coverS = 1e9;
  const strokes = g.strokes;
  for (let si = 0; si < strokes.length; si++) {
    const st = strokes[si];
    const clip = st.lo - y > y - st.hi ? st.lo - y : y - st.hi;
    if (clip >= (best > 0 ? best : 0)) continue;
    let sd = 1e9, ss = 0, cs = 1e9;
    const pieces = st.pieces;
    for (let pi = 0; pi < pieces.length; pi++) {
      const p = pieces[pi];
      // lower bound from the skeleton bbox (keep candidates that may still cover the texel)
      const bx = x < p.x0 ? p.x0 - x : x > p.x1 ? x - p.x1 : 0;
      const by = y < p.y0 ? p.y0 - y : y > p.y1 ? y - p.y1 : 0;
      let bound = sd < best ? sd : best;
      if (bound < 0) bound = 0;
      const lb = bx * bx + by * by;
      if (lb > 0) {
        const lim = bound + R0 + 0.01;
        if (lb >= lim * lim) continue;
      }
      const d = evalPiece(p, x, y, sd < 0 ? 0 : sd);
      if (d < 0 && OUT[0] < cs) cs = OUT[0];
      if (d < sd) { sd = d; ss = OUT[0]; }
    }
    if (sd >= 1e9) continue;
    if (clip > sd) sd = clip;
    if (sd < 0 && cs < coverS) coverS = cs;
    if (sd < best) { best = sd; bestS = ss; }
  }
  OUT[1] = best < 0 && coverS < 1e9 ? coverS : bestS;
  return best;
}

function sample(cg: CGlyph, g: GlyphInfo, i: number, j: number, field: Float32Array, arcs: Float32Array, cull: number): void {
  let d = evalGlyph(cg, g.ux + (i + 0.5) / PPU, g.uy - (j + 0.5) / PPU, cull);
  const sdMax = SD_MIN + SD_RANGE;
  if (d > sdMax) d = sdMax;
  const k = j * g.pw + i;
  field[k] = d;
  arcs[k] = cg.total > 0 ? OUT[1] / cg.total : 0;
}

function bakeGlyph(cg: CGlyph, g: GlyphInfo, field: Float32Array, arcs: Float32Array, data: Uint8Array, W: number, cull: number): void {
  const pw = g.pw, ph = g.ph;
  // coarse pass on even texels (+ last row / column)
  for (let j = 0; j < ph; j = j + 2 < ph || j === ph - 1 ? j + 2 : ph - 1) {
    for (let i = 0; i < pw; i = i + 2 < pw || i === pw - 1 ? i + 2 : pw - 1) sample(cg, g, i, j, field, arcs, cull);
  }
  // fine pass: interpolate 2×2 blocks that are far from any ink, evaluate the rest
  for (let j = 0; j < ph; j++) {
    const j0 = j & 1 ? j - 1 : j, j1 = Math.min(j0 + 2, ph - 1);
    const jo = j !== j0 && j !== j1;
    for (let i = 0; i < pw; i++) {
      const i0 = i & 1 ? i - 1 : i, i1 = Math.min(i0 + 2, pw - 1);
      const io = i !== i0 && i !== i1;
      if (!io && !jo) continue; // coarse sample already
      const a = field[j0 * pw + i0], b = field[j0 * pw + i1], c = field[j1 * pw + i0], d = field[j1 * pw + i1];
      if (a > FAR && b > FAR && c > FAR && d > FAR) {
        const fx = (i - i0) / Math.max(1, i1 - i0), fy = (j - j0) / Math.max(1, j1 - j0);
        field[j * pw + i] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
        const sa = arcs[j0 * pw + i0], sb = arcs[j0 * pw + i1], sc = arcs[j1 * pw + i0], sd = arcs[j1 * pw + i1];
        arcs[j * pw + i] = (sa * (1 - fx) + sb * fx) * (1 - fy) + (sc * (1 - fx) + sd * fx) * fy;
      } else sample(cg, g, i, j, field, arcs, cull);
    }
  }
  // encode + gradient
  for (let j = 0; j < ph; j++) {
    const ju = j > 0 ? j - 1 : 0, jd = j < ph - 1 ? j + 1 : ph - 1;
    let o = ((g.py + j) * W + g.px) * 4;
    for (let i = 0; i < pw; i++, o += 4) {
      const k = j * pw + i;
      const d = field[k];
      const xl = field[j * pw + (i > 0 ? i - 1 : 0)], xr = field[j * pw + (i < pw - 1 ? i + 1 : pw - 1)];
      let gx = xr - xl, gy = field[ju * pw + i] - field[jd * pw + i]; // y up
      const gl = Math.sqrt(gx * gx + gy * gy);
      if (gl > 1e-5) { gx /= gl; gy /= gl; } else { gx = 0; gy = 0; }
      let e = (d - SD_MIN) / SD_RANGE;
      e = e < 0 ? 0 : e > 1 ? 1 : e;
      let t = arcs[k];
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      data[o] = (e * 255 + 0.5) | 0;
      data[o + 1] = (t * 255 + 0.5) | 0;
      data[o + 2] = ((gx * 0.5 + 0.5) * 255 + 0.5) | 0;
      data[o + 3] = ((gy * 0.5 + 0.5) * 255 + 0.5) | 0;
    }
  }
}

// ------------------------------------------------------------------ bake
let atlas: IsAtlas | null = null;

export function getAtlas(): IsAtlas {
  if (!atlas) atlas = buildAtlas();
  return atlas;
}

export function buildAtlas(): IsAtlas {
  const t0 = performance.now();
  const chars = Object.keys(GLYPHS);
  const compiled = chars.map((c) => compileGlyph(GLYPHS[c]));
  const cull = SD_MIN + SD_RANGE + 0.05; // distances beyond the encodable range are clamped anyway
  const tMeasure = performance.now();
  // analytic (slightly conservative) ink boxes
  const infos: GlyphInfo[] = chars.map((ch, gi) => {
    const g = GLYPHS[ch];
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const st of compiled[gi].strokes) strokeInk(st, box);
    const [ix0, iy0, ix1, iy1] = box;
    const ux = Math.floor((ix0 - MARGIN) * PPU) / PPU;
    const uy = Math.ceil((iy1 + MARGIN) * PPU) / PPU;
    const pw = Math.ceil((ix1 + MARGIN - ux) * PPU);
    const ph = Math.ceil((uy - (iy0 - MARGIN)) * PPU);
    return {
      ch, w: g.w, l: g.l, r: g.r, adv: g.adv ?? g.l + g.w + g.r,
      px: 0, py: 0, pw, ph, ux, uy, uw: pw / PPU, uh: ph / PPU,
      ix0, iy0, ix1, iy1,
    };
  });
  const msMeasure = performance.now() - tMeasure;
  // shelf packing, tallest first
  const order = infos.map((_, i) => i).sort((a, b) => infos[b].ph - infos[a].ph || infos[b].pw - infos[a].pw);
  let x = GUTTER, y = GUTTER, rowH = 0;
  for (const i of order) {
    const g = infos[i];
    if (x + g.pw + GUTTER > ATLAS_W) { x = GUTTER; y += rowH + GUTTER; rowH = 0; }
    g.px = x; g.py = y;
    x += g.pw + GUTTER;
    rowH = Math.max(rowH, g.ph);
  }
  const H = Math.ceil((y + rowH + GUTTER) / 4) * 4;
  const W = ATLAS_W;
  const data = new Uint8Array(W * H * 4);
  new Uint32Array(data.buffer).fill(0x8080ffff); // R=255 (far), G=255, B=A=128 (zero gradient), little-endian
  let maxN = 0;
  for (const gi of infos) maxN = Math.max(maxN, gi.pw * gi.ph);
  const field = new Float32Array(maxN), arcs = new Float32Array(maxN);
  for (let gi = 0; gi < infos.length; gi++) bakeGlyph(compiled[gi], infos[gi], field, arcs, data, W, cull);
  const source = new BufferImageSource({
    resource: data, width: W, height: H, format: 'rgba8unorm', alphaMode: 'no-premultiply-alpha',
    scaleMode: 'linear', addressMode: 'clamp-to-edge', autoGenerateMipmaps: false, label: 'isfont-atlas',
  });
  // lookup tables
  const lut = new Int16Array(0x2400).fill(-1);
  chars.forEach((c, i) => {
    lut[c.charCodeAt(0)] = i;
    const lc = c.toLowerCase();
    if (lc !== c && lc.length === 1 && lc.charCodeAt(0) < lut.length) lut[lc.charCodeAt(0)] = i;
  });
  lut[0x20] = -2; lut[0xa0] = -2; lut[0x202f] = -3; lut[0x2009] = -3; lut[0x200a] = -3;
  lut[0x2212] = chars.indexOf('−');
  lut[0x2013] = chars.indexOf('-'); lut[0x2010] = chars.indexOf('-'); lut[0x2011] = chars.indexOf('-');
  lut[0x2022] = chars.indexOf('·'); lut[0x2219] = chars.indexOf('·');
  const n = chars.length;
  const kern = new Float32Array(n * n);
  for (const k in KERN) {
    const a = chars.indexOf(k[0]), b = chars.indexOf(k[1]);
    if (a >= 0 && b >= 0) kern[a * n + b] = KERN[k];
  }
  const ms = performance.now() - t0;
  if (typeof window !== 'undefined') (window as unknown as { __isfontMs?: unknown }).__isfontMs = { total: +ms.toFixed(1), measure: +msMeasure.toFixed(1) };
  return { source, width: W, height: H, glyphs: infos, lut, kern, n, ms, skel: compiled };
}
