// Terningen · "Terningens øjeblik": canvas-baked textures for the big die moment and the throw (made once per app,
// shared by every moment, never destroyed: a fixed set, so repeated awards never grow the texture count).
// White / neutral art that the sprites tint (aurora teal / violet / magenta, ice); nothing here is red.
// Deterministic: a local LCG for the frost and the crack lines (never Math.random, never the outcome RNG).
import { Texture, type Texture as Tex } from 'pixi.js';

const cache = new Map<string, Texture>();
function bake(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): Texture {
  const c = cache.get(key);
  if (c && !c.destroyed) return c;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  draw(g, w, h);
  const t = Texture.from(cv);
  cache.set(key, t);
  return t;
}
const lcg = (seed: number) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

/** One corona ray: a soft wedge whose tip is at the bottom centre (anchor 0.5, 1): narrow at the centre, widening
 *  outwards; transparent under the die (d < 0.18), bright from d ≈ 0.3 to 0.45, then a long fade to the outer end. */
export const rayTex = () => bake('ray3', 64, 256, (g, w, h) => {
  const img = g.createImageData(w, h);
  const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < h; y++) {
    const d = (h - 1 - y) / (h - 1);                  // 0 at the tip (bottom), 1 at the outer end (top)
    const half = 0.05 + 0.45 * d;                     // half-width as a fraction of the texture width
    const along = ss(0.16, 0.32, d) * Math.pow(1 - ss(0.42, 1.0, d), 1.2);
    for (let x = 0; x < w; x++) {
      const u = Math.abs(x / (w - 1) - 0.5) / half;
      const a = u >= 1 ? 0 : along * Math.pow(1 - u * u, 2);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * a);
    }
  }
  g.putImageData(img, 0, 0);
});

/** A flat-topped dark vignette (the moment's local dim): full to 35 % of the radius, then a long soft fall. */
export const vignetteTex = () => bake('vignette', 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.92)');
  gr.addColorStop(0.62, 'rgba(255,255,255,0.5)');
  gr.addColorStop(0.85, 'rgba(255,255,255,0.14)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});

/** A thin soft ring (radius 0.84 of the half size). */
export const ringTex = () => bake('ring', 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0)');
  gr.addColorStop(0.8, 'rgba(255,255,255,0.35)');
  gr.addColorStop(0.84, 'rgba(255,255,255,1)');
  gr.addColorStop(0.88, 'rgba(255,255,255,0.3)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});

/** An aurora curtain: a soft horizontal band made of vertical streaks, fading at both ends and to the top. */
export const ribbonTex = () => bake('ribbon', 256, 96, (g, w, h) => {
  const r = lcg(1948);
  const img = g.createImageData(w, h);
  const streak = new Float32Array(w);
  for (let k = 0; k < 9; k++) { const c = r() * w, s = 3 + r() * 10, a = 0.35 + r() * 0.65; for (let x = 0; x < w; x++) streak[x] += a * Math.exp(-((x - c) ** 2) / (2 * s * s)); }
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    // the curtain: bright lower hem, soft fade upwards
    const vert = Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.1)), 1.4) * (0.35 + 0.65 * v);
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const ends = Math.pow(Math.sin(Math.PI * u), 1.3);
      const a = Math.min(1, vert * ends * (0.45 + 0.55 * Math.min(1, streak[x])));
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * a);
    }
  }
  g.putImageData(img, 0, 0);
});

/** A 4-point star (motes and the win glints). */
export const starTex = () => bake('star', 64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[64, 4], [4, 64]] as const) {
    const lg = w > h ? g.createLinearGradient(0, 0, 64, 0) : g.createLinearGradient(0, 0, 0, 64);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.9)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect((64 - w) / 2, (64 - h) / 2, w, h);
  }
});

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
/** An ice tablet with `pip` pips (1–6): frosted glass, a bright rim, white pips. Neutral: the sprite tint and the
 *  glow behind it carry the state (dim ice / lit aurora / drawn). */
export const tabletTex = (pip: number) => bake('tab' + pip, 128, 128, (g) => {
  roundRect(g, 8, 8, 112, 112, 22);
  const body = g.createLinearGradient(0, 8, 0, 120);
  body.addColorStop(0, 'rgba(236,248,255,0.42)');
  body.addColorStop(0.5, 'rgba(170,215,255,0.20)');
  body.addColorStop(1, 'rgba(200,230,255,0.34)');
  g.fillStyle = body; g.fill();
  g.lineWidth = 4; g.strokeStyle = 'rgba(240,250,255,0.9)'; g.stroke();
  // frost sheen along the top edge
  roundRect(g, 16, 14, 96, 28, 14);
  const sh = g.createLinearGradient(0, 14, 0, 42);
  sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sh; g.fill();
  for (const [px, py] of PIPS[pip] ?? []) {
    const x = 64 + px * 28, y = 64 + py * 28;
    const pg = g.createRadialGradient(x - 3, y - 3, 1, x, y, 11);
    pg.addColorStop(0, 'rgba(255,255,255,1)'); pg.addColorStop(0.75, 'rgba(236,248,255,0.95)'); pg.addColorStop(1, 'rgba(160,210,255,0.6)');
    g.fillStyle = pg;
    g.beginPath(); g.arc(x, y, 10.5, 0, Math.PI * 2); g.fill();
  }
});

/** The pip plate behind the big numeral: a frosted rounded square with a double rim. */
export const plateTex = () => bake('plate', 192, 192, (g) => {
  roundRect(g, 10, 10, 172, 172, 36);
  const body = g.createRadialGradient(96, 70, 10, 96, 96, 120);
  body.addColorStop(0, 'rgba(24,44,86,0.92)'); body.addColorStop(1, 'rgba(6,12,32,0.92)');
  g.fillStyle = body; g.fill();
  g.lineWidth = 5; g.strokeStyle = 'rgba(234,248,255,0.85)'; g.stroke();
  roundRect(g, 22, 22, 148, 148, 26);
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(156,201,255,0.55)'; g.stroke();
});

/** A dark hairline band (the demo label): black-ish, soft top and bottom edges. */
export const bandTex = () => bake('band', 8, 64, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(2,4,12,0)'); gr.addColorStop(0.2, 'rgba(2,4,12,0.78)'); gr.addColorStop(0.8, 'rgba(2,4,12,0.78)'); gr.addColorStop(1, 'rgba(2,4,12,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 64);
});

type Drawable = CanvasImageSource & { width: number; height: number };
const drawable = (t: Tex): Drawable | null => {
  const r = (t.source as unknown as { resource?: unknown }).resource;
  return r && typeof r === 'object' && 'width' in (r as object) ? (r as Drawable) : null;
};
/** The die frozen in ice (a Kvit eller dobbelt loss): the artwork desaturated and tinted ice blue, with a frost
 *  grain; baked from the die texture once per artwork (the art may land after the first bake: keyed on its uid). */
export function frozenDieTex(die: Tex): Tex {
  const src = drawable(die);
  if (!src) return die;
  return bake('frozen' + die.uid, 256, 256, (g) => {
    g.drawImage(src, 0, 0, 256, 256);
    const img = g.getImageData(0, 0, 256, 256), d = img.data, r = lcg(20260923);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue; // getImageData is straight (unpremultiplied) RGBA
      const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const l = Math.min(255, 70 + y * 0.8 + (r() - 0.5) * 26);   // lifted, grainy
      d[i] = Math.round(l * 0.74); d[i + 1] = Math.round(l * 0.88); d[i + 2] = Math.round(Math.min(255, l * 1.04 + 12));
    }
    g.putImageData(img, 0, 0);
  });
}
/** Fine crack lines (white, transparent ground), clipped to the die silhouette. */
export function crackTex(die: Tex): Tex {
  const src = drawable(die);
  return bake('crack' + (src ? die.uid : 0), 256, 256, (g) => {
    const r = lcg(1948 * 7);
    g.strokeStyle = 'rgba(245,252,255,0.95)';
    g.lineCap = 'round';
    const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
      let px = x, py = y;
      g.lineWidth = w;
      g.beginPath(); g.moveTo(px, py);
      const n = 5 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        a += (r() - 0.5) * 0.9;
        px += Math.cos(a) * (len / n); py += Math.sin(a) * (len / n);
        g.lineTo(px, py);
        if (depth > 0 && r() < 0.35) { g.stroke(); branch(px, py, a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.6), len * 0.45, w * 0.6, depth - 1); g.lineWidth = w; g.beginPath(); g.moveTo(px, py); }
      }
      g.stroke();
    };
    for (let k = 0; k < 7; k++) branch(128 + (r() - 0.5) * 30, 128 + (r() - 0.5) * 30, (k / 7) * Math.PI * 2 + r() * 0.5, 70 + r() * 50, 2.2, 2);
    if (src) { g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0, 256, 256); }
  });
}
