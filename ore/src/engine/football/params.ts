/**
 * Football model parameters. All rates and constants are in GAME time (minutes) unless noted.
 * One simulation substep = 1.5 game seconds = 0.025 game minutes; at ×1 one substep runs per
 * 100 ms of real time, so one game minute lasts 4 real seconds.
 */
export const SUB = 0.025; // game minutes per substep
export const SUBS_PER_MIN = 40;
export const DP_STEP = 0.25; // DP / MC resolution: 15 game seconds
export const D = 8; // goal-difference bound
export const W = 2 * D + 1;

export interface FootballParams {
  lamF: number; // FCK base scale; realised goals also include pressure and excitation (~2.7 total)
  lamB: number; // BIF base scale
  trailing: number; // m_score for the trailing team
  leading: number; // m_score for the leading team
  redOwn: number;
  redOpp: number;
  /** Pressure OU (FCK minus BIF), in game minutes. */
  theta: number;
  sigma: number;
  clip: number;
  kickCorner: number;
  kickChance: number;
  kickShotOnTarget: number;
  /** Excitation after a goal: +kappa on both teams, decaying with tauE minutes. */
  kappa: number;
  tauE: number;
  /** Ball zone: mean dwell (game minutes) and xT goal multipliers for FCK attacking zones 1..6. */
  zoneDwell: number;
  zoneMult: number[];
  cornerRate: number; // per game minute, both teams
  chanceRate: number;
  shotRate: number;
  /** Strand price tilt per unit pressure (logit). */
  beta: number;
}

export const DERBY_PARAMS: FootballParams = {
  lamF: 1.4,
  lamB: 0.965,
  trailing: 1.18,
  leading: 0.9,
  redOwn: 0.7,
  redOpp: 1.18,
  theta: 0.2,
  sigma: 0.3,
  clip: 0.9,
  kickCorner: 0.08,
  kickChance: 0.12,
  kickShotOnTarget: 0.05,
  kappa: 0.6,
  tauE: 3,
  zoneDwell: 0.12, // ≈ 7 game seconds
  // Zones 1..6 seen from FCK: 1 = own box, 6 = BIF's box. Mean = 1.0 under a uniform zone distribution.
  zoneMult: [0, 0, 0.3, 0.9, 1.9, 2.9],
  cornerRate: 0.115,
  chanceRate: 0.07,
  shotRate: 0.27,
  beta: 0.55,
};

/** Time shape of scoring: more goals late. Mean over 0..90 is 1. */
export function timeShape(t: number): number {
  return (0.85 + (0.4 * Math.min(t, 90)) / 90) / 1.05;
}

/** Base intensity per game minute for team 0 (FCK) or 1 (BIF) at minute t, goal difference d, red cards. */
export function baseRate(p: FootballParams, team: 0 | 1, t: number, d: number, red: readonly [number, number]): number {
  const base = team === 0 ? p.lamF / 90 : p.lamB / 90;
  const lead = team === 0 ? d : -d;
  const m = lead < 0 ? p.trailing : lead > 0 ? p.leading : 1;
  const own = red[team];
  const opp = red[team === 0 ? 1 : 0];
  return base * timeShape(t) * m * Math.pow(p.redOwn, own) * Math.pow(p.redOpp, opp);
}

/** Goal multiplier from ball zone for each team (FCK attacks towards zone 6, BIF towards zone 1). */
export function zoneFactor(p: FootballParams, team: 0 | 1, zone: number): number {
  const z = Math.max(1, Math.min(6, Math.round(zone)));
  return team === 0 ? p.zoneMult[z - 1] : p.zoneMult[6 - z];
}

/** E[exp(c·π_s) | π_0] for the OU pressure process after s minutes. */
export function ouExpect(p: FootballParams, pi0: number, s: number, c: number): number {
  const mu = pi0 * Math.exp(-p.theta * s);
  const v = (p.sigma * p.sigma * (1 - Math.exp(-2 * p.theta * s))) / (2 * p.theta);
  return Math.exp(c * mu + (c * c * v) / 2);
}
