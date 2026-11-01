/**
 * Director timelines for Hallen.
 *
 * HALLEN20 is a full-match timeline for the 20-second demo segment:
 *  - at 38:00 the score is exactly AaH 21–20 GOG;
 *  - from 38:00 Aalborg scores three possessions in a row, GOG turns the ball over in between,
 *    and the third goal (Aalborg +4) lands as close to 43:00 as the attack ends allow (always in
 *    42:00–44:00);
 *  - after that goal the match runs naturally.
 *
 * How it stays natural and deterministic: attack timing never depends on goal probabilities
 * (see chain.ts), so the natural match and any biased version of it have the same attacks ending at
 * the same substeps. The builder runs the natural match once, then
 *  1. suppresses natural goals for both teams until the +4 goal (bias −1),
 *  2. replays the first 38 minutes with forced goals on exactly 21 AaH and 20 GOG attack ends,
 *     chosen as the attacks closest to scoring naturally (the natural goals first),
 *  3. forces goals on three consecutive AaH attack ends after 38:00, the last one nearest 43:00.
 * A forced goal at the substep where the attack ends anyway changes nothing else, so the trace up
 * to 38:00 is the natural match with its score nudged to 21–20.
 *
 * Fast-forward: fastForwardTo(k) builds a HandballSim on HALLEN20 and steps it to k
 * (default HALLEN20_START_K = 38:00). It is just stepTo, so it is deterministic and cheap (~3 000 steps).
 */
import { FIXTURE, K_PER_MIN, Team } from './params';
import { AttackRecord, HandballSim, TimelineEntry } from './sim';

export const HALLEN20_START_K = 38 * K_PER_MIN;
export const HALLEN20_START_SCORE = { h: 21, a: 20 } as const;
/** The +4 goal is placed on the AaH attack end nearest this substep, within [42:00, 44:00). */
export const HALLEN20_TARGET_K = 43 * K_PER_MIN;
export const HALLEN20_WINDOW_K: readonly [number, number] = [42 * K_PER_MIN, 44 * K_PER_MIN];

const scoreable = (r: AttackRecord) => r.result !== 'suspension' && r.result !== 'cut';

export function buildHallen20(seed: number = FIXTURE.seed): TimelineEntry[] {
  const nat = new HandballSim({ seed });
  nat.stepTo(HALLEN20_WINDOW_K[1] + K_PER_MIN);
  const log = nat.attacks().filter(scoreable);

  // 1–2: exactly 21–20 at 38:00, on the attack ends closest to a natural goal
  const goals: { k: number; team: Team }[] = [];
  const need: [number, number] = [HALLEN20_START_SCORE.h, HALLEN20_START_SCORE.a];
  for (const team of [0, 1] as Team[]) {
    const cand = log
      .filter((r) => r.team === team && r.endK <= HALLEN20_START_K)
      .sort((x, y) => x.m - y.m || x.endK - y.endK);
    if (cand.length < need[team]) throw new Error('HALLEN20: not enough attacks before 38:00');
    for (const r of cand.slice(0, need[team])) goals.push({ k: r.endK, team });
  }

  // 3: three AaH possessions in a row after 38:00, the third nearest 43:00
  const aah = log.filter((r) => r.team === 0 && r.endK > HALLEN20_START_K);
  let best = -1;
  for (let i = 2; i < aah.length; i++) {
    const k = aah[i].endK;
    if (k < HALLEN20_WINDOW_K[0] || k >= HALLEN20_WINDOW_K[1] || aah[i - 2].endK <= HALLEN20_START_K) continue;
    if (best < 0 || Math.abs(k - HALLEN20_TARGET_K) < Math.abs(aah[best].endK - HALLEN20_TARGET_K)) best = i;
  }
  if (best < 0) throw new Error('HALLEN20: no AaH attack end in 42:00–44:00');
  for (let i = best - 2; i <= best; i++) goals.push({ k: aah[i].endK, team: 0 });
  const plusFourK = aah[best].endK;

  goals.sort((x, y) => x.k - y.k);
  return [
    { type: 'bias', fromK: 0, toK: plusFourK, team: 0, amount: -1 },
    { type: 'bias', fromK: 0, toK: plusFourK, team: 1, amount: -1 },
    ...goals.map((g): TimelineEntry => ({ k: g.k, type: 'goal', team: g.team })),
  ];
}

export const HALLEN20: readonly TimelineEntry[] = buildHallen20();

/** A HandballSim on `timeline` (default HALLEN20), stepped to k (default 38:00, score 21–20). */
export function fastForwardTo(
  k: number = HALLEN20_START_K,
  timeline: readonly TimelineEntry[] = HALLEN20,
  seed: number = FIXTURE.seed,
): HandballSim {
  const sim = new HandballSim({ seed, timeline });
  sim.stepTo(k);
  return sim;
}
