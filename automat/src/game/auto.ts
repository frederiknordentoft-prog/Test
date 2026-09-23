// Autospin: the pure run rules (no DOM, no Pixi, no timers). The Game always spins through spin() (the 3,0 s floor
// holds, there is no turbo), never refills, never resumes after a reload, and stops at every die, at a Ladet spin,
// at Solstorm and BEFORE a spin that could take the round's loss past the limit.
export const AUTO_COUNTS = [10, 25, 50, 100] as const;
/** The loss limit as × stake (shown in kr). */
export const AUTO_LIMIT_X = [10, 25, 50, 100] as const;
/** Game seconds between idle and the next press. */
export const AUTO_GAP = 0.6;

export interface AutoRun {
  total: number;
  left: number;
  stakeOre: number;
  startBalanceOre: number;
  lossLimitOre: number;
}
export type AutoStop = 'done' | 'player' | 'die' | 'perk' | 'storm' | 'loss' | 'balance' | 'menu' | 'hidden' | 'demo' | 'chamber' | 'card' | 'offer' | 'stake' | 'reset';

/** The loss limits (øre) offered for a run of `spins` at `stakeOre`: a limit above the run's whole stake could never
 *  bind, so the choice is the × stake steps up to the run length (10 spin: 10×; 100 spin: all four). */
export function autoLimits(stakeOre: number, spins: number): number[] {
  if (!(stakeOre > 0)) return [];
  return AUTO_LIMIT_X.filter((x) => x <= spins).map((x) => x * stakeOre);
}
export const validAuto = (spins: number, limitOre: number, stakeOre: number): boolean =>
  (AUTO_COUNTS as readonly number[]).includes(spins) && autoLimits(stakeOre, spins).includes(limitOre);

/** Why the run must stop at this idle (null: the next spin may be pressed). Checked in this order. */
export function autoStopReason(a: AutoRun, o: { balanceOre: number; stakeOre: number; perksPending: number; gambleOpen: boolean; momentDue: boolean }): AutoStop | null {
  if (a.left <= 0) return 'done';
  if (o.gambleOpen) return 'offer';
  if (o.perksPending > 0) return 'perk';
  if (o.momentDue) return 'card';
  if (o.stakeOre !== a.stakeOre) return 'stake';
  if (o.balanceOre < o.stakeOre) return 'balance';
  // before a spin that could take the round's loss past the limit (the next stake counts as lost in the worst case)
  if (a.startBalanceOre - o.balanceOre + o.stakeOre > a.lossLimitOre) return 'loss';
  return null;
}
