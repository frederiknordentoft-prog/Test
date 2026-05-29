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

export const DEFAULT_PAYTABLE: Paytable = {
  1: 5,
  2: 2,
  3: 1,
  4: 0.5,
  5: 0.2,
  '6plus': 0.2,
  fail: 0,
};

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
