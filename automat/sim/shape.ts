// Paytable shape (PLAN.md §5) and rounding rules used by the tuner.

/**
 * Base shape (× stake). PLAN §5 gives L1 0.3/0.4/0.5/0.7/1/1.5/3/8 and H3 1.5/2/3/5/8/15/40/200 at s ≈ 2.
 * On 6×6 with these weights ~55 % of all clusters are low size-5 and ~25 % low size-6, so net-win is a step
 * function of whether a lone low 6-cluster pays more than the stake: PLAN's shape at s ≈ 2 (6-cluster 0.8×)
 * gives net-win ≈ 22 % < 25 %. This shape is PLAN's with the φ-knob (low sizes 6–8 lifted) already applied
 * and pre-rounded: min win 0.4×, every low 6-cluster ≥ 1.1× (a net win), smooth growth afterwards.
 * The tuner still scales it by s for the exact cluster-RTP target and re-rounds.
 */
export const SHAPE0: number[][] = [
  [0.4, 1.1, 1.3, 1.6, 2.2, 3.5, 7, 20],     // L1 Trekantkrystal
  [0.5, 1.1, 1.4, 1.7, 2.5, 4, 8, 25],       // L2 Kvadratkrystal
  [0.5, 1.2, 1.5, 1.9, 2.8, 4.5, 9, 30],     // L3 Sekskantkrystal
  [0.6, 1.3, 1.6, 2.1, 3, 5, 10, 40],        // L4 Dråbekrystal
  [1.2, 1.8, 2.6, 3.8, 6, 10, 25, 80],       // H1 Månen
  [1.6, 2.5, 3.6, 5.5, 9, 15, 40, 120],      // H2 Polarstjernen
  [2.5, 4, 6, 9, 15, 25, 60, 250],           // H3 Rav
];

/** Shape knob φ ("low-level floor"): lifts the low symbols' sizes 6–8 relative to the rest (net-win knob). */
export function shapeAt(phi: number): number[][] {
  return SHAPE0.map((row, s) => row.map((v, b) => (s <= 3 && b >= 1 && b <= 3 ? v * (1 + phi * (b === 1 ? 1 : b === 2 ? 0.6 : 0.3)) : v)));
}

/**
 * "Nice" steps: 0.1 below 5×, 0.5 below 10×, 1 below 30×, 5 below 100×, 10 above. Every value is a multiple
 * of 0.1×, so every pay is an exact whole-øre amount at every stake on the ladder (min 50 øre → 5 øre).
 */
export function stepOf(x: number): number {
  return x < 5 - 1e-9 ? 0.1 : x < 10 - 1e-9 ? 0.5 : x < 30 - 1e-9 ? 1 : x < 100 - 1e-9 ? 5 : 10;
}
const r10 = (x: number) => Math.round(x * 10) / 10;
export function roundNice(x: number): number {
  const st = stepOf(x);
  let r = r10(Math.round(x / st) * st);
  if (r < 0.1) r = 0.1;
  // never exactly 1.0× for a plain cluster (T = stake would be neither a win nor a return)
  if (Math.abs(r - 1) < 1e-9) r = x >= 1 ? 1.1 : 0.9;
  return r;
}
export function stepUp(x: number): number {
  const r = r10(x + stepOf(x));
  return Math.abs(r - 1) < 1e-9 ? 1.1 : r;
}
export function stepDown(x: number): number {
  const r = r10(x - stepOf(x - 1e-6));
  return Math.abs(r - 1) < 1e-9 ? 0.9 : Math.max(0.1, r);
}

/** Pays strictly increase with cluster size and never decrease from L1 up to H3 (per bucket). */
export function isMonotone(pt: number[][]): boolean {
  for (let s = 0; s < pt.length; s++) for (let b = 1; b < 8; b++) if (pt[s][b] <= pt[s][b - 1]) return false;
  for (let b = 0; b < 8; b++) for (let s = 1; s < pt.length; s++) if (pt[s][b] < pt[s - 1][b]) return false;
  return true;
}

/**
 * Rounds a continuous table to nice steps, then (only if the rounding moved the cluster RTP by more than
 * `tol`) applies single-step moves that bring it back — always the move that stays closest (in log terms)
 * to the continuous table, never breaking monotonicity. `w` = linear pricing weights (Σ mult per spin).
 */
export function roundTable(cont: number[][], w: Float64Array, target: number, tol: number): { pt: number[][]; moves: number } {
  const pt = cont.map((r) => r.map(roundNice));
  for (let pass = 0; pass < 8 && !isMonotone(pt); pass++) {
    for (let s = 0; s < 7; s++) for (let b = 1; b < 8; b++) if (pt[s][b] <= pt[s][b - 1]) pt[s][b] = stepUp(pt[s][b - 1]);
    for (let b = 0; b < 8; b++) for (let s = 1; s < 7; s++) if (pt[s][b] < pt[s - 1][b]) pt[s][b] = pt[s - 1][b];
  }
  const rtp = () => { let x = 0; for (let k = 0; k < 56; k++) x += pt[k >> 3][k & 7] * w[k]; return x; };
  let err = rtp() - target, moves = 0;
  while (Math.abs(err) > tol && moves < 200) {
    let bestK = -1, bestV = 0, bestDev = Infinity;
    for (let k = 0; k < 56; k++) {
      const s = k >> 3, b = k & 7, v0 = pt[s][b];
      const v1 = err < 0 ? stepUp(v0) : stepDown(v0);
      const e1 = err + (v1 - v0) * w[k];
      if (Math.abs(e1) >= Math.abs(err)) continue;
      pt[s][b] = v1;
      const ok = isMonotone(pt);
      pt[s][b] = v0;
      if (!ok) continue;
      const dev = Math.abs(Math.log(v1 / cont[s][b]));
      if (dev < bestDev) { bestDev = dev; bestK = k; bestV = v1; }
    }
    if (bestK < 0) break;
    err += (bestV - pt[bestK >> 3][bestK & 7]) * w[bestK];
    pt[bestK >> 3][bestK & 7] = bestV;
    moves++;
  }
  return { pt, moves };
}
