// ============================================================
// Threshold-based progress payout.
//
// When a game ends WITHOUT a solve (give up / max-rounds bust),
// pay a partial amount based on how many cards reached the
// foundations — but only above a threshold, and not linearly
// from 0. A linear-from-0 curve would invite a grind exploit
// (deliberately reach ~50% and give up for a guaranteed return);
// the threshold makes low progress worth nothing.
// ============================================================

export interface ProgressConfig {
  progressThreshold: number; // foundation fraction below which payout is 0 (e.g. 0.70)
  progressMax: number; // multiplier (× stake) approached near 100% (e.g. 0.5)
  progressExponent: number; // curve shape over [threshold, 1] (1.0 = linear)
}

export const DEFAULT_PROGRESS: ProgressConfig = {
  progressThreshold: 0.7,
  progressMax: 0.5,
  progressExponent: 1.0,
};

/**
 * Partial payout for an unsolved game.
 * 0 below the threshold, rising to `progressMax × stake` as the foundation
 * fraction approaches 1.0.
 */
export function progressPayout(
  foundationFraction: number,
  stake: number,
  cfg: ProgressConfig,
): number {
  const { progressThreshold: t, progressMax: m, progressExponent: e } = cfg;
  if (foundationFraction < t) return 0;
  if (t >= 1) return foundationFraction >= 1 ? stake * m : 0;
  const x = (foundationFraction - t) / (1 - t); // 0..1 over [t, 1]
  return stake * m * Math.pow(x, e);
}

/** Progress multiplier (× stake), for display. */
export function progressMultiplier(foundationFraction: number, cfg: ProgressConfig): number {
  return progressPayout(foundationFraction, 1, cfg);
}
