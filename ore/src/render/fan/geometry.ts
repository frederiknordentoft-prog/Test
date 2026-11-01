/**
 * Fan geometry. X: smooth log warp around NU (same slope on both sides, no kinks).
 * Y: smooth tanh fisheye around a centre price (≈3× magnification near the price).
 */
export interface Geo { w: number; h: number; left: number; nowX: number; right: number; top: number; bottom: number; now: number; end: number; center: number; tl: number }

export const GUTTER = 66;
const T0 = 6;

export function makeGeo(w: number, h: number, now: number, end: number, center: number, nowFrac = 0.36): Geo {
  const left = 10;
  const right = w - GUTTER;
  const g: Geo = { w, h, left, nowX: Math.round(left + (right - left) * nowFrac), right, top: 30, bottom: h - 24, now, end, center, tl: 1e6 };
  // Solve the left warp so the slope just left of NU equals the slope just right of it.
  const R = Math.max(0.01, end - now);
  const slope = (right - g.nowX) / (T0 * Math.log(1 + R / T0));
  const L = Math.max(0.01, now);
  const spanL = g.nowX - left;
  if (spanL / slope < L) {
    let lo = 1e-3;
    let hi = 1e5;
    for (let i = 0; i < 50; i++) {
      const mid = Math.sqrt(lo * hi);
      if (mid * Math.log(1 + L / mid) < spanL / slope) lo = mid;
      else hi = mid;
    }
    g.tl = Math.sqrt(lo * hi);
  }
  return g;
}

export function xOf(g: Geo, t: number): number {
  if (t >= g.now) {
    const R = Math.max(0.01, g.end - g.now);
    return g.nowX + ((g.right - g.nowX) * Math.log(1 + Math.min(t - g.now, R) / T0)) / Math.log(1 + R / T0);
  }
  const L = Math.max(0.01, g.now);
  return g.nowX - ((g.nowX - g.left) * Math.log(1 + (g.now - t) / g.tl)) / Math.log(1 + L / g.tl);
}

/** Inverse of xOf on the history side (for scrubbing). */
export function tOfX(g: Geo, x: number): number {
  if (x >= g.nowX) return g.now;
  const L = Math.max(0.01, g.now);
  const frac = (g.nowX - x) / (g.nowX - g.left);
  return Math.max(0, g.now - g.tl * (Math.exp(frac * Math.log(1 + L / g.tl)) - 1));
}

const A = 2.2;
const SD = 14;
export function yOf(g: Geo, p: number): number {
  const gg = (q: number) => q + A * SD * Math.tanh((q - g.center) / SD);
  const F = (gg(p) - gg(0)) / (gg(100) - gg(0));
  return g.bottom - F * (g.bottom - g.top);
}

/** Inverse of yOf (for dragging a price level). */
export function pOfY(g: Geo, y: number): number {
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (yOf(g, m) > y) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
