// Pure presentation schedule: SpinResult → timed Beat list.
// Testable in Node: enforces the 3.0 s floor and the WIN / RETURN effect profiles (LDW rule).
import type { SpinResult } from '../math/types.ts';

export type Profile = 'win' | 'return' | 'push' | 'none';

/** Classify on the FINAL total T before the first step is shown. */
export function profileOf(totalOre: number, stakeOre: number): Profile {
  if (totalOre <= 0) return 'none';
  if (totalOre > stakeOre) return 'win';
  if (totalOre === stakeOre) return 'push';
  return 'return';
}

export const TIER_NAMES = ['', 'GEVINST', 'FLOT GEVINST', 'STOR GEVINST', 'MEGA GEVINST', 'EPISK GEVINST'] as const;
export const TIER_SECS = [0, 0.8, 1.6, 3, 6, 9];
/** Terningen: the die is born inside the celebration after the count-up (never during the title slam, 0,05–0,60 s)
 *  — tier 2 at 1,50 s (count-up end); tiers 3–5 when expo.out already shows ≥ 99,6 % of the amount. */
export const dieBirthAt = (tier: number) => 0.3 + Math.max(0.6, TIER_SECS[tier] - 0.4) - (tier >= 3 ? 0.4 : 0);
/** Auto-close of a celebration that carries a die (tier 2: 2,70 s instead of 2,20; tier 3: 3,70 s instead of 3,60). */
export const celebrateEndWithDie = (tier: number) => Math.max(TIER_SECS[tier] + 0.6, dieBirthAt(tier) + 1.2);
export function winTier(totalOre: number, stakeOre: number): number {
  if (totalOre <= stakeOre) return 0;
  const x = totalOre / stakeOre;
  return x >= 500 ? 5 : x >= 100 ? 4 : x >= 20 ? 3 : x >= 5 ? 2 : 1;
}

export const T = {
  dropOut: 0.5,     // old symbols fall out
  firstLand: 0.6,   // first column impact (s after press)
  colGap: 0.25,
  antic: 0.6,       // extra per column after anticipation starts
  fall: 0.32,       // fall duration before impact
  glint: 0.55,
  floor: 3.0,       // minimum press → result (SCP.07.03 §5.1.1.5)
  highlight: 0.42,
  stepGap: 1.18,    // step to step
  fallAfter: 0.74,  // survivors fall, relative to step start
};

export type BeatKind =
  | 'dropOut' | 'land' | 'sun' | 'anticipation' | 'glint'
  | 'highlight' | 'shatter' | 'winPopup' | 'motes' | 'markUp' | 'fall' | 'refill'
  | 'chime' | 'ping' | 'returnTick' | 'nettoCross' | 'sunPay' | 'result';

export interface Beat {
  t: number;
  kind: BeatKind;
  col?: number;
  step?: number;
  cluster?: number;
  level?: number;
  warm?: boolean;   // WIN-palette effect (never true when T ≤ stake)
  running?: number; // running total øre after this step (for the strip)
}

/** Effect kinds that are reserved for the WIN profile (LDW whitelist test). */
export const WIN_ONLY: BeatKind[] = ['chime', 'ping', 'nettoCross'];

export function landTimes(cols: number, anticipation: { fromCol: number } | null): number[] {
  const out: number[] = [];
  for (let c = 0; c < cols; c++) {
    let t = T.firstLand + c * T.colGap;
    if (anticipation && c >= anticipation.fromCol) t += (c - anticipation.fromCol + 1) * T.antic;
    out.push(t);
  }
  return out;
}

/** `paidOre` = what the player actually paid for this spin (0 for a free Ladet spin / storm spin). */
export function schedule(r: SpinResult, paidOre: number = r.stakeOre): { beats: Beat[]; resultAt: number; profile: Profile } {
  const profile = profileOf(r.totalOre, paidOre);
  const netto = r.mode === 'base' && paidOre > 0; // the Netto line only exists for paid base spins
  const warm = profile === 'win';
  const beats: Beat[] = [];
  beats.push({ t: 0, kind: 'dropOut' });
  const lands = landTimes(r.cols, r.anticipation);
  let suns = 0;
  for (let c = 0; c < r.cols; c++) {
    beats.push({ t: lands[c], kind: 'land', col: c });
    for (const s of r.sunCells) if (Math.floor(s / r.rows) === c) beats.push({ t: lands[c], kind: 'sun', col: c, level: ++suns });
    if (r.anticipation && c === r.anticipation.fromCol) beats.push({ t: lands[c] - T.antic - T.fall, kind: 'anticipation', col: c });
  }
  const lastLand = lands[lands.length - 1];
  beats.push({ t: lastLand + 0.12, kind: 'glint' });
  let t = Math.max(lastLand + 0.55, 2.35);
  let running = 0;
  let crossed = false;
  r.steps.forEach((st, k) => {
    if (!st.clusters.length) return;
    beats.push({ t, kind: 'highlight', step: k, warm });
    if (warm) beats.push({ t, kind: 'chime', step: k });
    else beats.push({ t, kind: 'returnTick', step: k });
    beats.push({ t: t + T.highlight, kind: 'shatter', step: k, warm });
    if (warm) beats.push({ t: t + T.highlight, kind: 'ping', step: k });
    st.clusters.forEach((_, ci) => beats.push({ t: t + T.highlight + ci * 0.06, kind: 'winPopup', step: k, cluster: ci, warm }));
    running += st.stepWinOre;
    beats.push({ t: t + T.highlight + 0.05, kind: 'motes', step: k });
    beats.push({ t: t + T.highlight + 0.18, kind: 'markUp', step: k, warm });
    if (warm && netto && !crossed && running > paidOre) { crossed = true; beats.push({ t: t + T.highlight + 0.1, kind: 'nettoCross', step: k, running }); }
    beats.push({ t: t + T.fallAfter, kind: 'fall', step: k, running });
    beats.push({ t: t + T.fallAfter + 0.05, kind: 'refill', step: k });
    t += T.stepGap;
  });
  if (r.sunPayOre > 0) {
    beats.push({ t, kind: 'sunPay', warm });
    if (warm && netto && !crossed && r.totalOre > paidOre) { crossed = true; beats.push({ t: t + 0.1, kind: 'nettoCross', running: r.totalOre }); }
    t += 0.9;
  }
  const resultAt = Math.max(T.floor, t + 0.05);
  beats.push({ t: resultAt, kind: 'result' });
  beats.sort((a, b) => a.t - b.t);
  return { beats, resultAt, profile };
}
