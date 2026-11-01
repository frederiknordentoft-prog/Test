/**
 * Mock odds model. Independent Poisson goals per team, conditioned on the
 * current score and the expected goals still to come. Mock values only.
 */
export const MAX_GOALS = 10;
export const FULL_MINUTES = 90;

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

export interface Probs {
  home: number;
  draw: number;
  away: number;
  over25: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
}

/**
 * Probabilities for the final result, given the score now (h0, a0) and the
 * expected goals still to come (lamH, lamA). Truncated at MAX_GOALS and
 * renormalised, so every pair sums to exactly 1.
 */
export function probsFromState(h0: number, a0: number, lamH: number, lamA: number): Probs {
  const ph = Array.from({ length: MAX_GOALS + 1 }, (_, i) => poissonPmf(i, lamH));
  const pa = Array.from({ length: MAX_GOALS + 1 }, (_, j) => poissonPmf(j, lamA));
  const out: Probs = { home: 0, draw: 0, away: 0, over25: 0, under25: 0, bttsYes: 0, bttsNo: 0 };
  let total = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = ph[i] * pa[j];
      total += p;
      const fh = h0 + i;
      const fa = a0 + j;
      if (fh > fa) out.home += p;
      else if (fh === fa) out.draw += p;
      else out.away += p;
      if (fh + fa >= 3) out.over25 += p;
      else out.under25 += p;
      if (fh >= 1 && fa >= 1) out.bttsYes += p;
      else out.bttsNo += p;
    }
  }
  for (const key of Object.keys(out) as (keyof Probs)[]) out[key] /= total;
  return out;
}

/** Best-of-three: probability that a team wins two maps first, given map win prob p. */
export function bo3Win(p: number): number {
  return p * p * (3 - 2 * p);
}

/** Decimal odds from a fair probability and a proportional margin (overround). */
export function roundOdds(decimal: number): number {
  return Math.max(1.01, Math.round(decimal * 100) / 100);
}

export function priceFromProb(p: number, margin: number): number {
  const implied = Math.min(0.995, p * (1 + margin));
  return roundOdds(1 / implied);
}

/** Sum of implied probabilities for a set of decimal odds (the book's overround as 1 + margin). */
export function impliedSum(odds: number[]): number {
  return odds.reduce((sum, o) => sum + 1 / o, 0);
}
