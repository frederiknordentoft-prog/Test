// ============================================================
// Paytable + payout logic. The paytable is keyed by the number
// of talon rounds used to solve. RTP is driven entirely by this
// table (placeholder values — re-tune after simulating the real
// round distribution for solvable deals).
// ============================================================

export interface Paytable {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  '6plus': number;
  fail: number;
}

// Two mode-specific default tables (the active one is chosen by `solvableOnly`).
// Both are placeholders — re-tune against real play data. Editable live.

// SOLVABLE-ONLY mode: every dealt deal is winnable, so optimal play wins 100%.
// Tuned so optimal-play RTP ≈ 96% (< 100%, i.e. can't be beaten by perfect play).
export const DEFAULT_PAYTABLE_SOLVABLE: Paytable = {
  1: 2.7,
  2: 1.1,
  3: 0.55,
  4: 0.27,
  5: 0.11,
  '6plus': 0.11,
  fail: 0,
};

// NATURAL-MIX mode: ~20% of deals are impossible (guaranteed losses for any
// player), which holds optimal-RTP down, so this table is more generous.
export const DEFAULT_PAYTABLE_MIX: Paytable = {
  1: 2.56,
  2: 1.18,
  3: 0.87,
  4: 0.56,
  5: 0.41,
  '6plus': 0.31,
  fail: 0,
};

/** Back-compat alias (solvable-only default). */
export const DEFAULT_PAYTABLE = DEFAULT_PAYTABLE_SOLVABLE;

/** Multiplier for a given outcome. `solved=false` => loss (fail). */
export function payoutMultiplier(pt: Paytable, solved: boolean, rounds: number): number {
  if (!solved) return pt.fail;
  if (rounds <= 1) return pt[1];
  if (rounds === 2) return pt[2];
  if (rounds === 3) return pt[3];
  if (rounds === 4) return pt[4];
  if (rounds === 5) return pt[5];
  return pt['6plus'];
}

/** The bucket label used by stats/paytable for a given round count. */
export function roundBucket(rounds: number): keyof Paytable {
  if (rounds <= 1) return 1;
  if (rounds === 2) return 2;
  if (rounds === 3) return 3;
  if (rounds === 4) return 4;
  if (rounds === 5) return 5;
  return '6plus';
}

export function computePayout(pt: Paytable, stake: number, solved: boolean, rounds: number): number {
  return stake * payoutMultiplier(pt, solved, rounds);
}
