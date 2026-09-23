// Kvit eller dobbelt: the pure gamble rule for newly awarded dice (never money, never dice already in the chamber).
// One fair six-sided throw per choice: double pays 2× on 4–6 (3/6), triple pays 3× on 5–6 (2/6), so the expected
// payout equals the stake exactly for both bets. A code constant, not part of CONFIG: modelHash and REPORT are untouched.
// Pure TS: its only import is a type import of ./rng.ts.
import type { Rng } from './rng.ts';

export type GambleBet = 'double' | 'triple';
export const GAMBLE_SIDES = 6;
/** pip = face+1 wins when pip ≥ from: double 4–6 (3/6 × 2 = 1), triple 5–6 (2/6 × 3 = 1). EV = stake, exactly. */
export const GAMBLE_BETS = { double: { mult: 2, from: 4 }, triple: { mult: 3, from: 5 } } as const;

/** The face (0..5) of one throw: the first draw of a fresh per-idx rng (Lemire int(n) with rejection: unbiased). */
export const gambleFace = (rng: Rng): number => rng.int(GAMBLE_SIDES);

/** The settled outcome of a bet on `stake` dice. Throws on a bad face or bet (never a silent default). */
export function resolveGamble(bet: GambleBet, stake: number, face: number): { pip: number; win: boolean; payout: number } {
  const b = GAMBLE_BETS[bet];
  if (!b) throw new RangeError(`bad bet ${String(bet)}`);
  if (!Number.isInteger(face) || face < 0 || face >= GAMBLE_SIDES) throw new RangeError(`bad face ${face}`);
  const pip = face + 1, win = pip >= b.from;
  return { pip, win, payout: win ? stake * b.mult : 0 };
}

/** The winning pips of a bet, ascending (copy builds its pip lists from these, never from literals). */
export const winPips = (bet: GambleBet): number[] => {
  const out: number[] = [];
  for (let p = GAMBLE_BETS[bet].from; p <= GAMBLE_SIDES; p++) out.push(p);
  return out;
};
