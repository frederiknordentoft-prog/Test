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
export function generateSolvableDeal(nodeBudget: number, maxRounds = 0, maxAttempts = 40): Deal | undefined {
  for (let i = 0; i < maxAttempts; i++) {
    const seed = randomSeed();
    const state = deal(seed);
    const res = solve(state, nodeBudget, maxRounds);
    if (res.status === 'solvable') {
      return {
        seed,
        state,
        status: 'solvable',
        minRounds: res.minRounds,
        minRoundsProven: res.minRoundsProven,
      };
    }
  }
  return undefined;
}

/**
 * Generate a random deal regardless of solvability (natural mix). The solver
 * classifies it (solvable / unsolvable / unknown) and records the round
 * benchmark when solvable. All deals are kept and dealt as real games.
 */
export function generateAnyDeal(nodeBudget: number, maxRounds = 0): Deal {
  const seed = randomSeed();
  const state = deal(seed);
  const res = solve(state, nodeBudget, maxRounds);
  return {
    seed,
    state,
    status: res.status,
    minRounds: res.status === 'solvable' ? res.minRounds : undefined,
    minRoundsProven: res.minRoundsProven,
  };
}
