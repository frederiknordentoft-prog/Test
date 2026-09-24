// Autospin: the pure run rules (no DOM, no Pixi, no timers). The Game always spins through spin() (the 3,0 s floor
// holds, there is no turbo), never refills, never resumes after a reload, and stops at every die, at a Ladet spin,
// at Solstorm and BEFORE a spin that could take the round's loss past the limit.
export const AUTO_COUNTS = [10, 25, 50, 100] as const;
/** The loss limit as × stake (shown in kr). 5× is the lowest step, so every run length has a limit that can bind. */
export const AUTO_LIMIT_X = [5, 10, 25, 50] as const;
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

/** The four loss-limit steps (øre) for a run of `spins` at `stakeOre`, each with `ok`: can it bind? A limit of the run's
 *  whole stake or more never can (after n − 1 lost spins, the last stake brings the loss to exactly n × stake, which is
 *  not above it), so only the steps BELOW the run length are offered (10 spin: 5×; 100 spin: all four). The sheet shows
 *  all four and dims the ones this run length cannot use. */
export function autoLimitSteps(stakeOre: number, spins: number): { ore: number; ok: boolean }[] {
  if (!(stakeOre > 0)) return [];
  return AUTO_LIMIT_X.map((x) => ({ ore: x * stakeOre, ok: x < spins }));
}
/** The loss limits (øre) that can be chosen: the steps that can bind (every one below spins × stake). */
export function autoLimits(stakeOre: number, spins: number): number[] {
  return autoLimitSteps(stakeOre, spins).filter((l) => l.ok).map((l) => l.ore);
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
