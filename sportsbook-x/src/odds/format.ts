export type OddsFormat = 'decimal' | 'fraction' | 'american';

/**
 * Best rational approximation of x (x ≥ 0) with denominator up to maxDen.
 * Very small x (odds close to 1) get a larger denominator, so 0.01 is 1/100, not 0/1.
 */
export function bestFraction(x: number, maxDen = 20): [number, number] {
  if (Math.round(x * maxDen) === 0) return [1, Math.round(1 / x)];
  let bestN = Math.round(x);
  let bestD = 1;
  let bestErr = Math.abs(x - bestN);
  for (let d = 1; d <= maxDen; d++) {
    const n = Math.round(x * d);
    const err = Math.abs(x - n / d);
    if (err < bestErr - 1e-12) {
      bestErr = err;
      bestN = n;
      bestD = d;
    }
  }
  return [bestN, bestD];
}

export function formatOdds(decimal: number, format: OddsFormat): string {
  if (format === 'decimal') return decimal.toFixed(2).replace('.', ',');
  if (format === 'fraction') {
    const [n, d] = bestFraction(decimal - 1);
    return `${n}/${d}`;
  }
  // American: favourites negative, underdogs positive.
  if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`;
  return `${Math.round(-100 / (decimal - 1))}`;
}
