/**
 * Implied probability sum and margin, computed from the odds the user sees
 * (already rounded to 2 decimals). Users can check this line by hand.
 */
export function factLine(odds: number[]): { impliedPct: number; marginPct: number } {
  const impliedPct = odds.reduce((sum, o) => sum + 1 / o, 0) * 100;
  return { impliedPct, marginPct: impliedPct - 100 };
}
