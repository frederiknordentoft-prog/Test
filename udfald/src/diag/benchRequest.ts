import { DERBY_PARAMS } from '../engine/football/params';

/** A fixed Monte Carlo request for the diagnostics benchmark. */
export function benchRequest(n: number, now: number) {
  return {
    id: 1,
    seed: 7,
    params: DERBY_PARAMS,
    state: { t: now, end: 93, h: 0, a: 0, pi: 0, excite: [0, 0] as [number, number], red: [0, 0] as [number, number], zone: 4, goals: [] },
    n,
    probs: [0.48, 0.27, 0.25] as [number, number, number],
    focus: 0 as const,
    askNow: 49,
  };
}
