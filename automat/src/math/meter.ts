// ============================================================
// NORDLYS · Kp meter with locked stake (rule R12 in engine.ts).
// ============================================================
import { TIERS, kpFromCharge } from '../game/tiers.ts';
import { CONFIG, type MathConfig } from './config.ts';

export interface MeterState { charge: number; stakeSumOre: number }

export function newMeter(): MeterState {
  return { charge: 0, stakeSumOre: 0 };
}

/** Continuous Kp 0..9. */
export function kpOf(m: MeterState, cfg: MathConfig = CONFIG): number {
  return kpFromCharge(m.charge, cfg.K);
}

/** floor(stakeSumOre / charge) in whole øre; default stake when the meter is empty. */
export function lockedStakeOre(m: MeterState, cfg: MathConfig = CONFIG): number {
  if (m.charge <= 0) return cfg.defaultStakeOre;
  return Math.max(1, Math.floor(m.stakeSumOre / m.charge));
}

/** Charge needed to reach Kp t (1..9). */
export function tierCharge(t: number, cfg: MathConfig = CONFIG): number {
  return TIERS[t].frac * cfg.K;
}

/** Tiers (Kp 1..9) whose threshold lies in (before, after]. */
export function tiersBetween(before: number, after: number, K: number, out: number[] = []): number[] {
  for (let t = 1; t < TIERS.length; t++) {
    const th = TIERS[t].frac * K;
    if (before < th && after >= th) out.push(t);
  }
  return out;
}

/** True if any of the tiers is a "Ladet spin" perk tier. */
export function perkCount(tiers: readonly number[]): number {
  let c = 0;
  for (const t of tiers) if (TIERS[t].perk) c++;
  return c;
}

/**
 * Adds charge earned at `stakeOre`. Mutates the meter. stormA = the meter reached K (route A).
 * The caller decides the storm (see R12) and calls resetMeter after a route-A storm is granted.
 */
export function addCharge(m: MeterState, charge: number, stakeOre: number, cfg: MathConfig = CONFIG): { kpBefore: number; kpAfter: number; tiersCrossed: number[]; stormA: boolean } {
  const before = m.charge;
  const kpBefore = kpFromCharge(before, cfg.K);
  if (charge > 0) {
    m.charge += charge;
    m.stakeSumOre += charge * stakeOre;
  }
  const tiersCrossed = tiersBetween(before, m.charge, cfg.K);
  return { kpBefore, kpAfter: kpFromCharge(m.charge, cfg.K), tiersCrossed, stormA: m.charge >= cfg.K };
}

export function resetMeter(m: MeterState): void {
  m.charge = 0;
  m.stakeSumOre = 0;
}

/** R12 helper: which storm (if any) a finished base/perk spin grants. Call AFTER addCharge. */
export function stormDecision(m: MeterState, spinStakeOre: number, stormA: boolean, stormB: boolean, cfg: MathConfig = CONFIG): { route: 'A' | 'B' | 'AB'; stakeOre: number; resetMeter: boolean } | null {
  if (stormA && stormB) return { route: 'AB', stakeOre: spinStakeOre, resetMeter: true };
  if (stormA) return { route: 'A', stakeOre: lockedStakeOre(m, cfg), resetMeter: true };
  if (stormB) return { route: 'B', stakeOre: spinStakeOre, resetMeter: false };
  return null;
}
