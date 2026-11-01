/**
 * Pure bet-slip maths. Demo only: nothing here places a bet.
 * Combined odds assume independent legs. Correlation is not modelled.
 */
export interface SlipSelection {
  id: string;
  marketId: string;
  label: string;
  odds: number;
  prob: number;
}

export function combinedOdds(legs: SlipSelection[]): number {
  return legs.reduce((acc, l) => acc * l.odds, 1);
}

/** Product of leg probabilities. Assumes independent legs, so it is a simplification. */
export function combinedProb(legs: SlipSelection[]): number {
  return legs.reduce((acc, l) => acc * l.prob, 1);
}

export function potentialReturn(stake: number, legs: SlipSelection[]): number {
  return Math.round(stake * combinedOdds(legs) * 100) / 100;
}

/**
 * Demo cash-out offer for a single open bet: the expected value of holding it at the
 * current probability, less a visible cash-out margin. At placement it is below the stake.
 */
export function cashOutOffer(stake: number, odds: number, currentProb: number, cashOutMargin = 0.05): number {
  return Math.round(stake * odds * currentProb * (1 - cashOutMargin) * 100) / 100;
}
