/**
 * Handball (Hallen) fixture, clock and chain parameters.
 *
 * Clock: the simulation advances in substeps of 0.75 game seconds, so one game minute is 80
 * substeps. The UI runs one substep per 100 ms of real time (1 game minute = 8 s).
 * The substep index k is the time base everywhere; t = k * 0.75 / 60 minutes.
 */
import { hashSeed } from '../lib/rng';

export type Team = 0 | 1;

export const SUBSTEP_S = 0.75;
export const K_PER_MIN = 80;
/** Halftime marker (30:00). The attack in progress is cut and GOG throws off the second half. */
export const K_HALF = 30 * K_PER_MIN;
/** Full time (60:00). */
export const K_END = 60 * K_PER_MIN;

export const tOf = (k: number): number => (k * SUBSTEP_S) / 60;
export const kOf = (tMin: number): number => Math.round(tMin * K_PER_MIN);

export const FIXTURE = {
  home: 'Aalborg Håndbold',
  away: 'GOG',
  short: ['AaH', 'GOG'] as const,
  seed: hashSeed('AaH-GOG·2026'),
};

/** Shape of the normal-phase attack length (game seconds): a fast-break share plus a set attack. */
export interface DurationShape {
  fastShare: number;
  fastMinS: number;
  fastMaxS: number;
  setMinS: number;
  setModeS: number;
  setMaxS: number;
}

export interface HandballParams {
  /** P(goal | possession) at even strength, before any passive warning: [AaH, GOG]. */
  pGoal: readonly [number, number];
  /** Added to the attacking team's goal probability when it has more players on court. */
  ppBonus: number;
  /** Upper bound for any per-attack goal probability. */
  pCap: number;
  /** P(the defending team gets a 2-minute suspension) per attack. The attacking team keeps the ball. */
  pSuspension: number;
  /** Suspension length in substeps (2:00 game time). */
  suspensionK: number;
  /** P(referee raises the arm for passive play) per attack. */
  pPassive: number;
  /** P(7 m throw | the attack ends in a direct finish). */
  p7m: number;
  /** 7 m conversion at the team's base strength. */
  conv7m: number;
  /** Substeps from the 7 m award to the throw. */
  sevenDelayK: number;
  /** Pass interval in substeps once the arm is up (uniform over the list). */
  passK: readonly number[];
  /**
   * Goal probability in passive play relative to the attack's goal probability p,
   * indexed by passes left (0..4). With p = 0.595 this gives ≈ 58 → 49 → 41 → 30 % (and 15 % at 0).
   */
  passiveRho: readonly [number, number, number, number, number];
  /** Shot conversion in passive play relative to p (the shoot-or-pass decisions follow from rho). */
  passiveEff: number;
  duration: DurationShape;
}

/**
 * Calibration (tests/handball.test.ts): 200 seeded matches give a mean total of 61.8 goals, AaH wins
 * 58 %, 3.4 suspensions per team and 32 s per attack. The analytic chain gives 61.8 goals, AaH +2.07,
 * σ = 0.654 goals/√min (simulated 0.658) and 32.4 s per attack. The set-attack length was tuned to
 * reach ~61 goals; the goal probabilities are the brief's 0.60 / 0.55, nudged to a +2 margin.
 */
export const HB_PARAMS: HandballParams = {
  pGoal: [0.595, 0.555],
  ppBonus: 0.15,
  pCap: 0.95,
  pSuspension: 0.06,
  suspensionK: 2 * K_PER_MIN,
  pPassive: 0.1,
  p7m: 0.1,
  conv7m: 0.75,
  sevenDelayK: 8,
  passK: [3, 4, 5],
  passiveRho: [0.25, 0.504, 0.689, 0.824, 0.975],
  passiveEff: 1.15,
  duration: { fastShare: 0.14, fastMinS: 6, fastMaxS: 14, setMinS: 16, setModeS: 29, setMaxS: 59 },
};
