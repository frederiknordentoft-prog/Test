/**
 * Power-method margin: ask_i = p_i^k with k < 1 chosen so the asks sum to 1 + overround.
 * Favourites get a smaller share of the margin than long shots, as in real books.
 */
export function powerAsks(probs: number[], overround: number): number[] {
  const target = 1 + overround;
  const sum = (k: number) => probs.reduce((s, p) => s + Math.pow(Math.max(p, 1e-9), k), 0);
  let lo = 0.5;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (sum(mid) > target) lo = mid;
    else hi = mid;
  }
  const k = (lo + hi) / 2;
  return probs.map((p) => Math.min(0.99, Math.pow(Math.max(p, 1e-9), k)));
}

/** Largest-remainder rounding of shares to integers that sum exactly to `total`. */
export function largestRemainder(shares: number[], total: number): number[] {
  const raw = shares.map((s) => s * total);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let i = 0; rest > 0 && i < order.length; i++, rest--) out[order[i][1]]++;
  return out;
}
