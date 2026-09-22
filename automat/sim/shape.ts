// Paytable shape (PLAN.md §5) and rounding rules used by the tuner.

/** Base shape (× stake before scaling). L1 and H3 rows are PLAN.md §5; the rows between are interpolated. */
export const SHAPE0: number[][] = [
  [0.3, 0.4, 0.5, 0.7, 1, 1.5, 3, 8],       // L1 Trekant
  [0.3, 0.4, 0.55, 0.75, 1.1, 1.6, 3.2, 9], // L2 Kvadrat
  [0.35, 0.45, 0.6, 0.8, 1.2, 1.8, 3.5, 10], // L3 Sekskant
  [0.4, 0.5, 0.65, 0.9, 1.3, 2, 4, 12],     // L4 Dråbe
  [0.6, 0.8, 1.1, 1.5, 2.5, 4, 10, 40],     // H1 Måne
  [0.8, 1, 1.5, 2, 3.5, 6, 15, 80],         // H2 Polarstjerne
  [1.5, 2, 3, 5, 8, 15, 40, 200],           // H3 Rav
];

/**
 * Shape knob φ ("low-level floor"): lifts the small low-symbol clusters (sizes 6–8) relative to the rest,
 * which moves single 6/7-clusters across the 1× line (net-win) once the table is re-normalised by s.
 */
export function shapeAt(phi: number): number[][] {
  return SHAPE0.map((row, s) => row.map((v, b) => (s <= 3 && b >= 1 && b <= 3 ? v * (1 + phi * (b === 1 ? 1 : b === 2 ? 0.6 : 0.3)) : v)));
}

/** Step for "nice" rounding: 0.1 below 10, 1 below 100, 5 above. All are multiples of 0.1 (exact øre at every stake). */
export function stepOf(x: number): number {
  return x < 10 ? 0.1 : x < 100 ? 1 : 5;
}
export function roundNice(x: number): number {
  const st = stepOf(x);
  let r = Math.round(x / st) * st;
  r = Math.round(r * 10) / 10;
  if (r < 0.1) r = 0.1;
  // never exactly 1.0× for a plain cluster (T = stake would be neither a win nor an LDW)
  if (Math.abs(r - 1) < 1e-9) r = x >= 1 ? 1.1 : 0.9;
  return r;
}
export function stepUp(x: number): number {
  const r = Math.round((x + stepOf(x)) * 10) / 10;
  return Math.abs(r - 1) < 1e-9 ? 1.1 : r;
}
export function stepDown(x: number): number {
  const st = x <= 10 ? 0.1 : x <= 100 ? 1 : 5;
  const r = Math.round((x - st) * 10) / 10;
  return Math.abs(r - 1) < 1e-9 ? 0.9 : Math.max(0.1, r);
}

/** Enforces non-decreasing pays along buckets (per symbol) and along symbols (per bucket). */
export function isMonotone(pt: number[][]): boolean {
  for (let s = 0; s < pt.length; s++) for (let b = 1; b < 8; b++) if (pt[s][b] < pt[s][b - 1]) return false;
  for (let b = 0; b < 8; b++) for (let s = 1; s < pt.length; s++) if (pt[s][b] < pt[s - 1][b]) return false;
  return true;
}
