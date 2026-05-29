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

// Tuned from `npm run simulate` (solver as optimal player over 600 solvable
// deals): optimal-play RTP ≈ 96.5%, i.e. < 100% so the game can't be beaten by
// perfect play. Real human RTP lands lower (players use more rounds) — re-tune
// against real play data. Fully editable live in the control panel.
export const DEFAULT_PAYTABLE: Paytable = {
  1: 2.7,
  2: 1.1,
  3: 0.55,
  4: 0.27,
  5: 0.11,
  '6plus': 0.11,
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
