// Terningen · the gate's 1948 ice tiles and their per-player fill order. Pure: no DOM, no Pixi.
// Normalised gate units, y down: the opening is 1 wide and GATE_H = 1.32 tall, a half-circle arch of radius 0.5
// (centre (0.5, 0.5)) on straight jambs; the two leaves meet at the centre seam x = 0.5. Layout-independent, so
// the lit pattern is identical on every device. The keystone is not a tile.
export const GATE_H = 1.32;
export const TILES = 1948;
export const PER_LEAF = 974;
/** Hex-lattice pitch (gate units): ≈ 4,6 px on a 176 px phone gate, ≈ 12 px on a 460 px desktop gate. */
export const SPACING = 0.0261;

export interface Lattice {
  /** Tile centres in gate units; tiles 0–973 are the left leaf, 974–1947 the right leaf (its mirror). */
  x: Float32Array;
  y: Float32Array;
  leaf: Uint8Array;
  spacing: number;
}

/** Distance to the left leaf's border: the arch / left jamb, the bottom and the centre seam. */
function borderDist(x: number, y: number): number {
  const side = y < 0.5 ? 0.5 - Math.sqrt((x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5)) : x;
  return Math.min(side, 0.5 - x, GATE_H - y);
}

let lattice: Lattice | null = null;
/** A hex lattice anchored at the seam and the bottom; points closer than half a pitch to the border or the seam
 *  are dropped, and each leaf keeps exactly the 974 points farthest from its border (the right leaf mirrors). */
export function gateLattice(): Lattice {
  if (lattice) return lattice;
  const s = SPACING, h = (s * Math.sqrt(3)) / 2;
  const pts: { x: number; y: number; d: number }[] = [];
  for (let r = 0; ; r++) {
    const y = GATE_H - s / 2 - r * h;
    if (y < 0) break;
    for (let c = 0; ; c++) {
      const x = 0.5 - s / 2 - c * s - (r & 1 ? s / 2 : 0);
      if (x < 0) break;
      const d = borderDist(x, y);
      if (d >= s / 2) pts.push({ x, y, d });
    }
  }
  if (pts.length < PER_LEAF) throw new Error(`gate lattice: ${pts.length} < ${PER_LEAF}`);
  pts.sort((a, b) => b.d - a.d || a.y - b.y || a.x - b.x);
  const keep = pts.slice(0, PER_LEAF).sort((a, b) => a.y - b.y || a.x - b.x);
  const L: Lattice = { x: new Float32Array(TILES), y: new Float32Array(TILES), leaf: new Uint8Array(TILES), spacing: s };
  keep.forEach((p, i) => {
    L.x[i] = p.x; L.y[i] = p.y;
    L.x[i + PER_LEAF] = 1 - p.x; L.y[i + PER_LEAF] = p.y; L.leaf[i + PER_LEAF] = 1;
  });
  return (lattice = L);
}

/** Integer hash → [0, 1) (seed, index). */
export function hash01(seed: number, i: number): number {
  let h = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const orders = new Map<number, Uint16Array>();
/**
 * The per-player fill order: a progressive blue-noise permutation of all 1948 tiles. Farthest-point sampling from a
 * seeded random start, each candidate's distance to the lit set scored × (1 + 0.15·hash(seed, i)). Early dice spread
 * over both leaves, late dice fill the gaps: no front line, and the last tile is a seed-dependent interior tile.
 * `lit = order.slice(0, min(count, 1948))`. Cached per seed (a few entries); ≈ 10 ms.
 */
export function gateOrder(seed: number): Uint16Array {
  seed >>>= 0;
  const hit = orders.get(seed);
  if (hit) return hit;
  const L = gateLattice(), n = TILES;
  const jit = new Float64Array(n), d2 = new Float64Array(n).fill(Infinity), score = new Float64Array(n);
  for (let i = 0; i < n; i++) jit[i] = 1 + 0.15 * hash01(seed, i);
  const used = new Uint8Array(n), order = new Uint16Array(n);
  let cur = Math.min(n - 1, Math.floor(hash01(seed, 0x51ed) * n));
  for (let k = 0; k < n; k++) {
    order[k] = cur;
    used[cur] = 1;
    const cx = L.x[cur], cy = L.y[cur];
    let best = -1, bs = -1;
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const dx = L.x[i] - cx, dy = L.y[i] - cy, q = dx * dx + dy * dy;
      if (q < d2[i]) { d2[i] = q; score[i] = Math.sqrt(q) * jit[i]; }
      if (score[i] > bs) { bs = score[i]; best = i; }
    }
    cur = best;
  }
  if (orders.size >= 8) orders.delete(orders.keys().next().value as number);
  orders.set(seed, order);
  return order;
}
