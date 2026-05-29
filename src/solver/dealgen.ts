// ============================================================
// Deal generation. Produces deals from seeds and (optionally)
// verifies solvability via the solver before handing them out.
// ============================================================

import { Deal } from '../engine/types';
import { deal } from '../engine/klondike';
import { randomSeed } from '../engine/rng';
import { solve } from './solver';

/** Build a deal object from a specific seed (no solvability check). */
export function dealFromSeed(seed: number): Deal {
  return { seed, state: deal(seed) };
}

/**
 * Generate a verified-solvable deal, attempting random seeds until one
 * solves within the node budget. Returns undefined if none found in
 * `maxAttempts` (caller can retry later).
 */
export function generateSolvableDeal(nodeBudget: number, maxAttempts = 40): Deal | undefined {
  for (let i = 0; i < maxAttempts; i++) {
    const seed = randomSeed();
    const state = deal(seed);
    const res = solve(state, nodeBudget);
    if (res.status === 'solvable') {
      return { seed, state, minRounds: res.minRounds };
    }
  }
  return undefined;
}

/** Generate a random deal regardless of solvability, but record the benchmark if cheaply known. */
export function generateAnyDeal(nodeBudget: number): Deal {
  const seed = randomSeed();
  const state = deal(seed);
  const res = solve(state, nodeBudget);
  return { seed, state, minRounds: res.status === 'solvable' ? res.minRounds : undefined };
}
