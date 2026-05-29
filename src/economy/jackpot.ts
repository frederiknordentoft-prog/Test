// ============================================================
// Progressive jackpot with random trigger, persisted in
// localStorage so it grows across sessions.
//
// Two trigger models (chosen in the UI):
//  A — pure random on any paid game (skill-independent, clean
//      separation of skill vs. chance). Default 1 in 50,000.
//  B — requires a solved game AND a random factor (1 in 15,000
//      among solved games).
//
// Accounting tracks contributions in, seed top-ups in, and
// payouts out, so jackpot-RTP ≈ contributions + seed (the pool
// is conserved, not free money).
// ============================================================

import { mulberry32 } from '../engine/rng';

export type JackpotModel = 'A' | 'B';

export interface JackpotConfig {
  model: JackpotModel;
  contributionRate: number; // fraction of each stake added to the pool
  seed: number; // pool resets to this after a hit (operator-funded)
  oddsA: number; // 1-in-N on any paid game
  oddsB: number; // 1-in-N among solved games
}

export interface JackpotState {
  pool: number;
  // accounting (cumulative, money units)
  contributionsIn: number;
  seedIn: number;
  paidOut: number;
  hits: number;
  gamesSinceHit: number;
}

export const DEFAULT_JACKPOT_CONFIG: JackpotConfig = {
  model: 'A',
  contributionRate: 0.06,
  seed: 5000,
  oddsA: 50000,
  oddsB: 15000,
};

const STORAGE_KEY = 'kabale.jackpot.v1';

export function initialJackpotState(cfg: JackpotConfig): JackpotState {
  return {
    pool: cfg.seed,
    contributionsIn: 0,
    seedIn: cfg.seed, // initial seeding is operator-funded
    paidOut: 0,
    hits: 0,
    gamesSinceHit: 0,
  };
}

export function loadJackpot(cfg: JackpotConfig): JackpotState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as JackpotState;
  } catch {
    /* ignore */
  }
  return initialJackpotState(cfg);
}

export function saveJackpot(state: JackpotState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export interface JackpotOutcome {
  state: JackpotState;
  hit: boolean;
  amountWon: number;
}

/**
 * Process one paid game's interaction with the jackpot.
 * `rngFloat` is a 0..1 random draw (passed in so callers can seed it).
 */
export function processJackpot(
  state: JackpotState,
  cfg: JackpotConfig,
  stake: number,
  solved: boolean,
  rngFloat: number,
): JackpotOutcome {
  // Contribution from the stake.
  const contribution = stake * cfg.contributionRate;
  let next: JackpotState = {
    ...state,
    pool: state.pool + contribution,
    contributionsIn: state.contributionsIn + contribution,
    gamesSinceHit: state.gamesSinceHit + 1,
  };

  // Trigger check.
  let triggered = false;
  if (cfg.model === 'A') {
    triggered = rngFloat < 1 / cfg.oddsA;
  } else {
    triggered = solved && rngFloat < 1 / cfg.oddsB;
  }

  if (!triggered) {
    return { state: next, hit: false, amountWon: 0 };
  }

  const amountWon = next.pool;
  next = {
    ...next,
    paidOut: next.paidOut + amountWon,
    hits: next.hits + 1,
    gamesSinceHit: 0,
    // reset to seed (operator-funded top-up)
    pool: cfg.seed,
    seedIn: next.seedIn + cfg.seed,
  };
  return { state: next, hit: true, amountWon };
}

export function resetJackpot(cfg: JackpotConfig): JackpotState {
  return initialJackpotState(cfg);
}

/** Convenience RNG draw for the trigger (any 32-bit-ish input). */
export function jackpotRng(salt: number): number {
  return mulberry32((salt ^ Date.now()) >>> 0)();
}
