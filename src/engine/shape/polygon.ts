// Polygon pipeline: raw pointer points → simulation-ready closed CCW polygon,
// plus mass properties (shoelace) and frontal height D(θ).

import { ASPECT } from '../types';

export interface MassProperties {
  /** Area in tunnel units². */
  area: number;
  centroid: [number, number];
  /** Second polar moment about the given pivot, tunnel units⁴ (per unit density). */
  polarMoment: number;
}

const MIN_AREA = 0.002; // tunnel units² (≈ 40 cells² at 256 height… scaled at raster)

export function resample(points: number[], spacing: number): number[] {
  if (points.length < 6) return points.slice();
  const out: number[] = [points[0], points[1]];
  let px = points[0], py = points[1];
  let acc = 0;
  for (let i = 2; i < points.length; i += 2) {
    const x = points[i], y = points[i + 1];
    let seg = Math.hypot(x - px, y - py);
    while (acc + seg >= spacing) {
      const t = (spacing - acc) / seg;
      px = px + (x - px) * t;
      py = py + (y - py) * t;
      out.push(px, py);
      seg = Math.hypot(x - px, y - py);
      acc = 0;
    }
    acc += seg;
    px = x;
    py = y;
  }
  return out;
}

/** Chaikin corner-cutting on a CLOSED polygon. */
export function chaikinClosed(points: number[], iterations: number): number[] {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const n = pts.length / 2;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = pts[i * 2], y0 = pts[i * 2 + 1];
      const x1 = pts[j * 2], y1 = pts[j * 2 + 1];
      out.push(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1);
      out.push(0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1);
    }
    pts = out;
  }
  return pts;
}

/** Douglas-Peucker simplification on a closed polygon (split at two extreme points). */
export function simplifyClosed(points: number[], epsilon: number): number[] {
  const n = points.length / 2;
  if (n < 8) return points.slice();
  const keep = new Uint8Array(n);
  const dp = (i0: number, i1: number) => {
    let maxD = -1, maxI = -1;
    const ax = points[i0 * 2], ay = points[i0 * 2 + 1];
    const bx = points[i1 * 2], by = points[i1 * 2 + 1];
    const abx = bx - ax, aby = by - ay;
    const len = Math.hypot(abx, aby) || 1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = Math.abs((points[i * 2] - ax) * aby - (points[i * 2 + 1] - ay) * abx) / len;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > epsilon && maxI > 0) {
      keep[maxI] = 1;
      dp(i0, maxI);
      dp(maxI, i1);
    }
  };
  const half = Math.floor(n / 2);
  keep[0] = keep[half] = 1;
  dp(0, half);
  dp(half, n - 1);
  keep[n - 1] = 1;
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i * 2], points[i * 2 + 1]);
  return out;
}

export function signedArea(points: ArrayLike<number>): number {
  const n = points.length / 2;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += points[i * 2] * points[j * 2 + 1] - points[j * 2] * points[i * 2 + 1];
  }
  return a / 2;
}

export function ensureCCW(points: number[]): number[] {
  if (signedArea(points) >= 0) return points;
  const out: number[] = [];
  for (let i = points.length - 2; i >= 0; i -= 2) out.push(points[i], points[i + 1]);
  return out;
}

/** Shoelace-based mass properties (per unit density) about `pivot`. */
export function massProperties(points: ArrayLike<number>, pivot: [number, number]): MassProperties {
  const n = points.length / 2;
  let a = 0, cx = 0, cy = 0, ixx = 0, iyy = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = points[i * 2] - pivot[0], y0 = points[i * 2 + 1] - pivot[1];
    const x1 = points[j * 2] - pivot[0], y1 = points[j * 2 + 1] - pivot[1];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
    ixx += (y0 * y0 + y0 * y1 + y1 * y1) * cross;
    iyy += (x0 * x0 + x0 * x1 + x1 * x1) * cross;
  }
  a /= 2;
  const area = Math.abs(a);
  const centroid: [number, number] = a !== 0 ? [pivot[0] + cx / (6 * a), pivot[1] + cy / (6 * a)] : [pivot[0], pivot[1]];
  // I_z about pivot = Ixx + Iyy (sign follows a; take abs)
  const polarMoment = Math.abs(ixx / 12 + iyy / 12);
  return { area, centroid, polarMoment };
}

/** Frontal projected height (y-extent) of the polygon rotated by theta about pivot, tunnel units. */
export function frontalHeight(points: ArrayLike<number>, pivot: [number, number], theta: number): number {
  const c = Math.cos(theta), s = Math.sin(theta);
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i] - pivot[0], y = points[i + 1] - pivot[1];
    const yr = s * x + c * y;
    if (yr < ymin) ymin = yr;
    if (yr > ymax) ymax = yr;
  }
  return Math.max(0, ymax - ymin);
}

export interface BuildResult {
  points: Float32Array;
  centroid: [number, number];
  ok: boolean;
  reason?: 'too-small' | 'too-few-points';
}

/** Full freehand pipeline. Input: raw points in tunnel coords. */
export function buildFreehand(raw: number[]): BuildResult {
  if (raw.length < 8) return { points: new Float32Array(0), centroid: [0, 0], ok: false, reason: 'too-few-points' };
  let pts = resample(raw, 0.02);
  pts = chaikinClosed(pts, 2);
  pts = simplifyClosed(pts, 0.004);
  pts = ensureCCW(pts);
  const area = Math.abs(signedArea(pts));
  if (area < MIN_AREA || pts.length < 8) {
    return { points: new Float32Array(pts), centroid: [0, 0], ok: false, reason: 'too-small' };
  }
  const mp = massProperties(pts, [0, 0]);
  return { points: new Float32Array(pts), centroid: mp.centroid, ok: true };
}

/** Clamp polygon into the tunnel with a margin. */
export function clampToTunnel(points: Float32Array, margin = 0.04): Float32Array {
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 2) {
    out[i] = Math.min(ASPECT - margin, Math.max(margin, points[i]));
    out[i + 1] = Math.min(1 - margin, Math.max(margin, points[i + 1]));
  }
  return out;
}
