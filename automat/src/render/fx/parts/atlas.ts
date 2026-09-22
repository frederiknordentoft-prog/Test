// Procedural particle atlas, generated once on the CPU (survives context loss: the canvas is the resource).
//
// Two-channel encoding, read by the fx particle shader (parts/particleShader.ts):
//   R = hot core (rendered white, scaled by the particle's "heat")
//   G = body / halo (rendered in the particle tint)
// The canvas is fully opaque (A = 255), so premultiplication never touches the masks. 4×4 slots of 64 px,
// content kept inside ~0.9 of each slot, black gutters → mipmap bleeding only darkens (additive-safe).
import { CanvasSource, Rectangle, Texture } from 'pixi.js';

export const SLOT = 64;
const GRID = 4;
export const ATLAS_SLOTS = {
  dot: 0, streak: 1, flake: 2, ember: 3, glint: 4, shard: 5, bokeh: 6, ring: 7, flash: 8, spike: 9,
} as const;
export type AtlasSlot = keyof typeof ATLAS_SLOTS;

const exp = Math.exp, abs = Math.abs, sqrt = Math.sqrt;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Signed distance to triangle abc (negative inside). */
function sdTri(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const seg = (x0: number, y0: number, x1: number, y1: number) => {
    const ex = x1 - x0, ey = y1 - y0, wx = px - x0, wy = py - y0;
    const h = Math.min(1, Math.max(0, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
    const dx = wx - ex * h, dy = wy - ey * h;
    return dx * dx + dy * dy;
  };
  const d = Math.min(seg(ax, ay, bx, by), seg(bx, by, cx, cy), seg(cx, cy, ax, ay));
  const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  const inside = (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  return inside ? -sqrt(d) : sqrt(d);
}

/** Per-slot painters: (x, y) in [-1, 1]² → [core, body]. Every painter is windowed to 0 at the slot border. */
const PAINT: ((x: number, y: number, r: number) => [number, number])[] = [];
const winR = (r: number) => 1 - smooth(0.72, 1.0, r);
const winXY = (x: number, y: number) => (1 - smooth(0.8, 1.0, abs(x))) * (1 - smooth(0.7, 1.0, abs(y)));
PAINT[ATLAS_SLOTS.dot] = (_x, _y, r) => [exp(-r * r * 22), (exp(-r * r * 3.4) * 0.85 + exp(-r * r * 14) * 0.35) * winR(r)];
PAINT[ATLAS_SLOTS.streak] = (x, y) => {
  // head at +x, long soft tail to -x
  const along = smooth(-0.98, 0.3, x) * (1 - smooth(0.6, 0.95, x));
  const tailBias = 0.3 + 0.7 * smooth(-1, 0.55, x);
  const body = along * tailBias * exp(-(y * y) / (0.46 * 0.46));
  const core = along * along * tailBias * exp(-(y * y) / (0.15 * 0.15));
  return [core * winXY(x, y), body * winXY(x, y)];
};
PAINT[ATLAS_SLOTS.flake] = (x, y, r) => {
  const th = Math.atan2(y, x);
  const arms = Math.pow(abs(Math.cos(3 * th)), 10) * exp(-r * 1.7) * (1 - smooth(0.6, 0.95, r));
  const sub = Math.pow(abs(Math.cos(3 * th + Math.PI / 2)), 16) * exp(-r * 4) * (1 - smooth(0.3, 0.55, r));
  const body = exp(-r * r * 7) * 0.75 + arms * 0.85 + sub * 0.4;
  return [exp(-r * r * 30) + arms * 0.3, body * winR(r)];
};
PAINT[ATLAS_SLOTS.ember] = (_x, _y, r) => [exp(-r * r * 11), (exp(-r * r * 4.2) + exp(-r * r * 1.6) * 0.22) * winR(r)];
PAINT[ATLAS_SLOTS.glint] = (x, y, r) => {
  const ax = abs(x), ay = abs(y);
  const fall = (u: number) => Math.pow(Math.max(0, 1 - u / 0.96), 1.8);
  const spikes = exp(-ay * 15) * fall(ax) + exp(-ax * 15) * fall(ay);
  const d1 = abs(x + y) * 0.7071, d2 = abs(x - y) * 0.7071;
  const diag = (exp(-d1 * 22) * fall(d2 * 1.9) + exp(-d2 * 22) * fall(d1 * 1.9)) * 0.5;
  const thin = exp(-ay * 48) * fall(ax) + exp(-ax * 48) * fall(ay);
  return [(thin * 0.85 + exp(-r * r * 45)) * winR(r), (spikes * 0.8 + diag + exp(-r * r * 6) * 0.6) * winR(r)];
};
PAINT[ATLAS_SLOTS.shard] = (x, y) => {
  // glass sliver with a bright leading facet edge
  const d = sdTri(x, y, -0.86, -0.4, 0.9, -0.08, -0.46, 0.66);
  const fill = smooth(0.05, -0.04, d);
  const shade = 0.5 + 0.5 * smooth(-0.6, 0.7, x * 0.6 - y * 0.8);
  // edge highlight on the long bottom edge (a→b)
  const ex = 0.9 + 0.86, ey = -0.08 + 0.4;
  const el = sqrt(ex * ex + ey * ey);
  const dist = abs((x + 0.86) * ey - (y + 0.4) * ex) / el;
  const edge = exp(-(dist * dist) / (0.07 * 0.07)) * smooth(0.08, -0.02, d);
  const glow = exp(-Math.max(0, d) * 7) * 0.3 * (1 - fill);
  return [(edge * 0.9 + fill * 0.15) * winXY(x, y), (fill * shade * 0.9 + glow) * winXY(x, y)];
};
PAINT[ATLAS_SLOTS.bokeh] = (_x, _y, r) => {
  const disc = 1 - smooth(0.74, 0.88, r);
  const rim = exp(-((r - 0.8) * (r - 0.8)) / (0.05 * 0.05));
  return [0, (disc * 0.3 + rim * 0.4 + exp(-r * r * 3) * 0.15) * winR(r)];
};
PAINT[ATLAS_SLOTS.ring] = (_x, _y, r) => {
  const d = r - 0.7;
  return [exp(-(d * d) / (0.035 * 0.035)) * 0.8, (exp(-(d * d) / (0.1 * 0.1)) + exp(-r * r * 4) * 0.08) * winR(r)];
};
PAINT[ATLAS_SLOTS.flash] = (_x, _y, r) => [exp(-r * r * 10) * 0.9, (exp(-r * r * 3.6) * 0.8 + exp(-r * r * 9) * 0.25) * winR(r)];
PAINT[ATLAS_SLOTS.spike] = (x, y) => {
  // long anamorphic lens streak (horizontal)
  const ax = abs(x), ay = abs(y);
  const along = Math.pow(Math.max(0, 1 - ax / 0.97), 1.6);
  return [exp(-ay * 30) * along * along * winXY(x, y), exp(-(ay * ay) / 0.05) * along * 0.7 * winXY(x, y)];
};

let atlasSource: CanvasSource | null = null;
const frames = new Map<number, Texture>();

function build(): CanvasSource {
  const size = SLOT * GRID;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(size, size);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) { px[i + 3] = 255; }
  const inner = 0.9; // content radius inside the slot
  for (let s = 0; s < GRID * GRID; s++) {
    const paint = PAINT[s];
    if (!paint) continue;
    const ox = (s % GRID) * SLOT, oy = Math.floor(s / GRID) * SLOT;
    for (let j = 0; j < SLOT; j++) {
      for (let i = 0; i < SLOT; i++) {
        const x = ((i + 0.5) / SLOT * 2 - 1) / inner;
        const y = ((j + 0.5) / SLOT * 2 - 1) / inner;
        const r = sqrt(x * x + y * y);
        let [c, b] = paint(x, y, r);
        // outside the content square: hard zero (gutter)
        if (abs(x) > 1.02 || abs(y) > 1.02) { c = 0; b = 0; }
        // triangular dither against 8-bit banding on long additive falloffs
        const h1 = Math.sin((i + ox) * 12.9898 + (j + oy) * 78.233) * 43758.5453;
        const h2 = Math.sin((i + ox) * 39.3468 + (j + oy) * 11.135) * 24634.6345;
        const dth = (h1 - Math.floor(h1)) + (h2 - Math.floor(h2)) - 1;
        const k = ((oy + j) * size + ox + i) * 4;
        px[k] = Math.max(0, Math.min(255, Math.round(Math.min(1, c) * 255 + (c > 0.002 ? dth * 0.5 : 0))));
        px[k + 1] = Math.max(0, Math.min(255, Math.round(Math.min(1, b) * 255 + (b > 0.002 ? dth * 0.5 : 0))));
      }
    }
  }
  g.putImageData(img, 0, 0);
  return new CanvasSource({ resource: cv, autoGenerateMipmaps: true, scaleMode: 'linear', alphaMode: 'premultiplied-alpha', label: 'fx-particle-atlas' });
}

/** Shared atlas source (lazy, once). */
export function atlasSourceOnce(): CanvasSource {
  if (!atlasSource) atlasSource = build();
  return atlasSource;
}

/** Sub-texture for an atlas slot (cached). */
export function atlasFrame(slot: number): Texture {
  let t = frames.get(slot);
  if (!t) {
    const src = atlasSourceOnce();
    const inset = 0.5; // half-texel inset keeps bilinear taps inside the slot
    t = new Texture({ source: src, frame: new Rectangle((slot % GRID) * SLOT + inset, Math.floor(slot / GRID) * SLOT + inset, SLOT - inset * 2, SLOT - inset * 2), label: 'fx-atlas-' + slot });
    frames.set(slot, t);
  }
  return t;
}
