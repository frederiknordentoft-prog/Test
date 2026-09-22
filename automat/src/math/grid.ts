// ============================================================
// NORDLYS · grid geometry, weighted draws, gravity/refill.
// Column-major: idx = col * rows + row, row 0 = top.
// ============================================================
import type { Rng } from './rng.ts';

export const MAX_CELLS = 64;
export const TWO32 = 4294967296;

/** Size buckets: 5,6,7,8,9-10,11-12,13-15,16+ → 0..7 ; <5 → -1 */
export const BUCKET_OF: Int8Array = (() => {
  const b = new Int8Array(MAX_CELLS + 1).fill(-1);
  for (let s = 5; s <= MAX_CELLS; s++) b[s] = s <= 8 ? s - 5 : s <= 10 ? 4 : s <= 12 ? 5 : s <= 15 ? 6 : 7;
  return b;
})();
export const BUCKET_LABELS = ['5', '6', '7', '8', '9-10', '11-12', '13-15', '16+'] as const;
export function bucketOf(size: number): number {
  return size > MAX_CELLS ? 7 : BUCKET_OF[size];
}

export interface Geometry {
  cols: number;
  rows: number;
  n: number;
  /** 4 neighbour slots per cell (up, down, left, right); -1 = none. */
  nb: Int16Array;
}

const geoCache = new Map<number, Geometry>();
export function geometry(cols: number, rows: number): Geometry {
  const key = cols * 100 + rows;
  let g = geoCache.get(key);
  if (g) return g;
  const n = cols * rows;
  if (n > MAX_CELLS) throw new Error('grid too large');
  const nb = new Int16Array(n * 4).fill(-1);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const i = c * rows + r;
      if (r > 0) nb[i * 4] = i - 1;
      if (r < rows - 1) nb[i * 4 + 1] = i + 1;
      if (c > 0) nb[i * 4 + 2] = i - rows;
      if (c < cols - 1) nb[i * 4 + 3] = i + rows;
    }
  }
  g = { cols, rows, n, nb };
  geoCache.set(key, g);
  return g;
}

export const idxOf = (col: number, row: number, rows: number): number => col * rows + row;

/**
 * Cumulative u32 thresholds for a weighted draw: sym = first k with u32 < thr[k].
 * thr[k] = round(2^32 · Σ_{j≤k} w_j / Σ w); the last entry is exactly 2^32.
 * Symbols with weight 0 get an empty interval.
 */
export function thresholdsFromWeights(weights: readonly number[]): Float64Array {
  let tot = 0;
  for (const w of weights) {
    if (!(w >= 0)) throw new Error('bad weight');
    tot += w;
  }
  const thr = new Float64Array(weights.length);
  let acc = 0;
  for (let k = 0; k < weights.length; k++) {
    acc += weights[k];
    thr[k] = k === weights.length - 1 ? TWO32 : Math.round((acc / tot) * TWO32);
  }
  return thr;
}

/** Bernoulli(p) ⇔ u32() < round(p · 2^32). */
export function bernoulliThreshold(p: number): number {
  return Math.round(Math.min(1, Math.max(0, p)) * TWO32);
}

export function drawSym(rng: Rng, thr: Float64Array): number {
  const u = rng.u32();
  let k = 0;
  while (u >= thr[k]) k++;
  return k;
}

/** Exact per-symbol probabilities implied by the thresholds (for closed forms / reports). */
export function probsFromThresholds(thr: Float64Array): number[] {
  const p: number[] = [];
  let prev = 0;
  for (let k = 0; k < thr.length; k++) {
    p.push((thr[k] - prev) / TWO32);
    prev = thr[k];
  }
  return p;
}
