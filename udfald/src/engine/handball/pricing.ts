/**
 * Pricing for Hallen (Aalborg–GOG).
 *
 * The goal difference X_t (AaH − GOG) is priced as a Brownian motion with drift μ and volatility σ,
 * both derived analytically from the possession chain (no simulation inside the pricer):
 *
 *  - The match is a renewal-reward process whose cycle is one AaH possession followed by one GOG
 *    possession. A possession is a geometric run of attacks (a suspension keeps the ball) that ends
 *    in a goal (reward ±1) or a turnover. With R = Y_A − Y_G the cycle reward and S the cycle length,
 *      μ = E[R] / E[S],   σ² = Var(R − μ S) / E[S]   (renewal-reward CLT),
 *    computed from exact moments of the tabulated attack length, the passive-play sub-chain and the
 *    7 m delay. Power play enters mean-field: the share of first attacks played 6-vs-5 raises p, and
 *    a compound-Poisson term adds the variance of the suspension draws.
 *  - State awareness (possessionLegs): the possession in progress is resolved explicitly. With
 *    probability G = nextAttackGoal(state) it ends in a goal (d ± 1), otherwise without one, and the
 *    other team then starts a fresh possession; before halftime the possession may also be cut by
 *    the buzzer. Each leg continues as a Brownian motion from x = d' + β(team that starts), where β
 *    is the renewal offset of a fresh cycle (≈ ±0.3 goals: the team with the ball is half an attack
 *    ahead). Crossing halftime adds β(GOG) once more (GOG throws off the second half), and a power
 *    play that is already running adds its expected extra goals.
 *
 * Win prices (Stern with continuity correction), per leg, τ = minutes left, m = μτ + extras:
 *   P(AaH) = Φ((x − ½ + m)/(σ√τ)),  P(GOG) = Φ((−x − ½ − m)/(σ√τ)),  P(X) = rest.
 * With no possession in progress (x = d, no extras) this is exactly Φ((d − ½ + μτ)/(σ√τ)).
 * Trigger (first passage of level a before the deadline), per leg, with h = |a − x| − ½ and drift ν
 * signed toward the level:
 *   P = Φ((ντ − h)/(σ√τ)) + exp(2νh/σ²)·Φ((−ντ − h)/(σ√τ)),
 * plus a documented lattice calibration (TRIGGER_CAL: h += ¼) for the ±1-goal jumps of the real
 * process. Both are cross-checked against Monte Carlo of the chain itself (mcWinProbs, mcTriggerProb).
 */
import { powerAsks } from '../lib/quote';
import { attackP, ChainState, conversions, derived, runPath } from './chain';
import { FIXTURE, HandballParams, HB_PARAMS, K_END, K_HALF, K_PER_MIN, kOf, SUBSTEP_S, Team } from './params';

// ---------- normal CDF ----------

/** Complementary error function (Numerical Recipes erfcc, |relative error| < 1.2e-7). */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Standard normal CDF Φ. */
export function Phi(x: number): number {
  return 0.5 * erfc(-x / Math.SQRT2);
}

// ---------- analytic chain statistics ----------

interface AttackMoments {
  EY: number;
  EL: number;
  EL2: number;
  EYL: number;
}

export interface TeamStats {
  /** Mean-field goal probability of a possession's first attack (power-play share included). */
  pFirst: number;
  /** Goal probability of an attack restarted after a suspension (always 6-vs-5). */
  pPP: number;
  /** P(possession ends in a goal). */
  EY: number;
  /** Possession length: mean, variance (substeps) and E[Y·S]. */
  ES: number;
  VS: number;
  EYS: number;
  /** Share of first attacks played with an extra player. */
  ppShare: number;
  /** Suspensions this team receives per substep. */
  suspRate: number;
}

export interface ChainStats {
  team: [TeamStats, TeamStats];
  /** Mean cycle length (one possession each), substeps. */
  cycleK: number;
  /** Drift of X per minute (AaH). */
  mu: number;
  /** Variance of X per minute and its square root. */
  sigma2: number;
  sigma: number;
  /** Renewal offset of a fresh cycle that starts with a possession of team i. */
  beta: [number, number];
  /** Mean attack length in game seconds (all attacks, incl. those cut short by a suspension). */
  attackMeanS: number;
  /** Expected goals and AaH margin over 60 minutes (incl. the halftime and full-time buzzer cuts). */
  goalsPerMatch: number;
  marginPerMatch: number;
  suspensionsPerTeam: number;
  /** Passive play: expected substeps until the attack ends, from the start of the stage with n passes left (n = 0..4). */
  passiveRestK: number[];
}

function passiveMoments(params: HandballParams, e: number) {
  const dv = derived(params);
  const pk = params.passK;
  const md = pk.reduce((s, x) => s + x, 0) / pk.length;
  const vd = pk.reduce((s, x) => s + (x - md) * (x - md), 0) / pk.length;
  let reach = 1;
  let EP = 0;
  let EP2 = 0;
  let EYP = 0;
  let PY = 0;
  for (let j = 0; j <= 4; j++) {
    const n = 4 - j;
    const cnt = j + 1;
    const m = cnt * md;
    const m2 = cnt * vd + m * m;
    const res = n > 0 ? reach * dv.shoot[n] : reach;
    const gy = n > 0 ? e : dv.shoot[0] * e;
    EP += res * m;
    EP2 += res * m2;
    EYP += res * gy * m;
    PY += res * gy;
    reach -= res;
  }
  return { EP, EP2, EYP, PY, md };
}

/** Moments of an attack that does not end in a suspension (goal indicator Y, length L in substeps). */
function lastAttack(params: HandballParams, p: number, pBase: number): AttackMoments {
  const dv = derived(params);
  const cv = conversions(params, p, pBase);
  const u = params.pSuspension;
  const w = params.pPassive;
  const m7 = params.p7m;
  const dl = params.sevenDelayK;
  const pm = passiveMoments(params, cv.e);
  const wP = w / (1 - u);
  const w7 = ((1 - u - w) * m7) / (1 - u);
  const wD = ((1 - u - w) * (1 - m7)) / (1 - u);
  const ED = dv.meanD;
  const ED2 = dv.varD + ED * ED;
  const EY = wP * pm.PY + w7 * cv.c7 + wD * cv.a;
  const ext = wP * pm.EP + w7 * dl;
  return {
    EY,
    EL: ED + ext,
    EL2: ED2 + 2 * ED * ext + wP * pm.EP2 + w7 * dl * dl,
    EYL: EY * ED + wP * pm.EYP + w7 * cv.c7 * dl,
  };
}

function possession(params: HandballParams, team: Team, pFirst: number) {
  const dv = derived(params);
  const u = params.pSuspension;
  const base = params.pGoal[team];
  const pPP = attackP(params, team, true);
  const f = lastAttack(params, pFirst, base);
  const g = lastAttack(params, pPP, base);
  const mix = (x: number, y: number) => (1 - u) * x + u * y;
  const EY = mix(f.EY, g.EY);
  const EL = mix(f.EL, g.EL);
  const EL2 = mix(f.EL2, g.EL2);
  const EYL = mix(f.EYL, g.EYL);
  const en = u / (1 - u);
  const vn = u / ((1 - u) * (1 - u));
  const ES = en * dv.meanD + EL;
  const VS = en * dv.varD + vn * dv.meanD * dv.meanD + (EL2 - EL * EL);
  const EYS = dv.meanD * en * g.EY + EYL;
  return { pPP, EY, ES, VS, EYS };
}

const statsCache = new WeakMap<HandballParams, ChainStats>();

export function chainStats(params: HandballParams = HB_PARAMS): ChainStats {
  const hit = statsCache.get(params);
  if (hit) return hit;
  const u = params.pSuspension;
  const sk = params.suspensionK;
  const nAtt = 1 / (1 - u);
  let share: [number, number] = [0, 0];
  let A = possession(params, 0, params.pGoal[0]);
  let G = possession(params, 1, params.pGoal[1]);
  let cyc = A.ES + G.ES;
  let rate: [number, number] = [0, 0];
  for (let it = 0; it < 4; it++) {
    // suspensions against team j happen in the other team's attacks
    rate = [(u * nAtt) / cyc, (u * nAtt) / cyc];
    const cover = rate.map((r) => 1 - Math.exp(-r * sk));
    share = [cover[1] * (1 - cover[0]), cover[0] * (1 - cover[1])];
    A = possession(params, 0, Math.min(params.pCap, params.pGoal[0] + params.ppBonus * share[0]));
    G = possession(params, 1, Math.min(params.pCap, params.pGoal[1] + params.ppBonus * share[1]));
    cyc = A.ES + G.ES;
  }
  const ER = A.EY - G.EY;
  const muK = ER / cyc;
  const varPart = (Y: typeof A, sgn: number) =>
    Y.EY * (1 - Y.EY) - 2 * sgn * muK * (Y.EYS - Y.EY * Y.ES) + muK * muK * Y.VS;
  let s2K = (varPart(A, 1) + varPart(G, -1)) / cyc;
  // compound-Poisson variance of the suspension draws: each one gives the other team ≈ nPoss
  // possessions with the power-play bonus
  const nPoss = [1 + Math.max(0, sk - A.ES - G.ES / 2) / cyc, 1 + Math.max(0, sk - G.ES - A.ES / 2) / cyc];
  s2K += rate[1] * (params.ppBonus * nPoss[0]) ** 2 + rate[0] * (params.ppBonus * nPoss[1]) ** 2;
  const EL2 = A.VS + G.VS + cyc * cyc;
  // renewal offsets: E[reward in (0, t]] = (E R / E S)·t + β for a cycle that starts at 0, with
  // β = −E[Σ reward·time of reward]/E S + E R·E[S²]/(2 E S²)
  const beta0 = -(A.EYS - (G.EY * A.ES + G.EYS)) / cyc + (ER * EL2) / (2 * cyc * cyc);
  const beta1 = -(-G.EYS + (A.EY * G.ES + A.EYS)) / cyc + (ER * EL2) / (2 * cyc * cyc);
  // the same for total goals (both rewards +1), per half: AaH throws off the first, GOG the second
  const ET = A.EY + G.EY;
  const tot0 = -(A.EYS + G.EY * A.ES + G.EYS) / cyc + (ET * EL2) / (2 * cyc * cyc);
  const tot1 = -(G.EYS + A.EY * G.ES + A.EYS) / cyc + (ET * EL2) / (2 * cyc * cyc);
  const dv = derived(params);
  const md = params.passK.reduce((s, x) => s + x, 0) / params.passK.length;
  const rest = [md];
  for (let n = 1; n <= 4; n++) rest.push(md + (1 - dv.shoot[n]) * rest[n - 1]);
  const mkTeam = (Y: typeof A, i: Team): TeamStats => ({
    pFirst: Math.min(params.pCap, params.pGoal[i] + params.ppBonus * share[i]),
    pPP: Y.pPP,
    EY: Y.EY,
    ES: Y.ES,
    VS: Y.VS,
    EYS: Y.EYS,
    ppShare: share[i],
    suspRate: rate[i],
  });
  const out: ChainStats = {
    team: [mkTeam(A, 0), mkTeam(G, 1)],
    cycleK: cyc,
    mu: muK * K_PER_MIN,
    sigma2: s2K * K_PER_MIN,
    sigma: Math.sqrt(s2K * K_PER_MIN),
    beta: [beta0, beta1],
    attackMeanS: (cyc / (2 * nAtt)) * SUBSTEP_S,
    goalsPerMatch: (ET * K_END) / cyc + tot0 + tot1,
    marginPerMatch: muK * K_END + beta0 + beta1,
    suspensionsPerTeam: rate[0] * K_END,
    passiveRestK: rest,
  };
  statsCache.set(params, out);
  return out;
}

/** Per-minute standard deviation of the goal difference, derived analytically from the chain. */
export function sigmaPerMinute(params: HandballParams = HB_PARAMS): number {
  return chainStats(params).sigma;
}

// ---------- state-aware pieces ----------

/** P(the team in possession scores before it loses the ball). Passive-play and power-play aware. */
export function nextAttackGoal(state: ChainState, params: HandballParams = HB_PARAMS): number {
  if (state.phase === 'over' || state.k >= K_END) return 0;
  const team = state.possession;
  const p = attackP(params, team, state.attackPowerplay);
  const base = params.pGoal[team];
  if (state.phase === 'passive') return conversions(params, p, base).G[Math.max(0, Math.min(4, state.passesLeft))];
  if (state.phase === '7m') return conversions(params, p, base).c7;
  const u = params.pSuspension;
  return (1 - u) * p + u * attackP(params, team, true);
}

/** Expected substeps until the current possession ends. */
function restOfPossession(params: HandballParams, state: ChainState): number {
  const st = chainStats(params);
  if (state.phase === '7m') return Math.max(1, state.sevenAtK - state.k);
  if (state.phase === 'passive') {
    const n = Math.max(0, Math.min(4, state.passesLeft));
    return Math.max(1, st.passiveRestK[n] - (state.k - state.stageStartK));
  }
  const dv = derived(params);
  const e = Math.max(0, state.k - state.attackStartK);
  let mass = 0;
  let acc = 0;
  for (let j = e + 1; j < dv.pmf.length; j++) {
    mass += dv.pmf[j];
    acc += (j - e) * dv.pmf[j];
  }
  const restD = mass > 1e-12 ? acc / mass : 1;
  const u = params.pSuspension;
  const w = params.pPassive;
  const ext = w * st.passiveRestK[4] + (1 - u - w) * params.p7m * params.sevenDelayK;
  return restD + ext + u * st.team[state.possession].ES;
}

/** Probability that the current possession is over within T substeps. */
function resolvedWithin(params: HandballParams, state: ChainState, T: number): number {
  if (T <= 0) return 0;
  if (state.phase === '7m') return state.sevenAtK - state.k <= T ? 1 : 0;
  const st = chainStats(params);
  if (state.phase === 'passive') return 1 - Math.exp(-T / restOfPossession(params, state));
  const cum = derived(params).cum;
  const last = cum.length - 1;
  const e = Math.max(0, Math.min(last, Math.floor(state.k - state.attackStartK)));
  const tail = 1 - cum[e];
  // P(rest of the normal phase <= t | it has lasted e substeps)
  const F = (t: number) => (t < 1 ? 0 : tail <= 1e-12 ? 1 : (cum[Math.min(last, e + Math.floor(t))] - cum[e]) / tail);
  const u = params.pSuspension;
  const w = params.pPassive;
  const m7 = params.p7m;
  const direct = 1 - u - w;
  return (
    direct * (1 - m7) * F(T) +
    direct * m7 * F(T - params.sevenDelayK) +
    w * F(T - st.passiveRestK[4]) +
    u * F(T - st.team[state.possession].ES)
  );
}

/**
 * One branch of the explicit possession step. The possession in progress ends (with or without a
 * goal) and `team` starts a fresh possession at kStart, or it is still running at the horizon
 * (then nothing more happens, or, before halftime, GOG throws off the second half at 30:00).
 */
export interface PossessionLeg {
  w: number;
  /** Goal difference after the possession in progress. */
  d: number;
  /** Substep at which the next fresh possession starts (≥ kEnd: no time left). */
  kStart: number;
  /** Team that starts that possession. */
  team: Team;
}

/** Resolve the possession in progress: up to three legs (goal, no goal, still running). */
export function possessionLegs(state: ChainState, kEnd: number, params: HandballParams = HB_PARAMS): PossessionLeg[] {
  const k = state.k;
  const d = state.d;
  const i = state.possession;
  const j: Team = i === 0 ? 1 : 0;
  const kCut = k < K_HALF && kEnd > K_HALF ? K_HALF : kEnd;
  const Tc = kCut - k;
  const pRes = resolvedWithin(params, state, Tc);
  const R = restOfPossession(params, state);
  const kRes = k + (R * Tc) / (R + Tc);
  const G = nextAttackGoal(state, params);
  const legs: PossessionLeg[] = [
    { w: pRes * G, d: d + (i === 0 ? 1 : -1), kStart: kRes, team: j },
    { w: pRes * (1 - G), d, kStart: kRes, team: j },
  ];
  if (pRes < 1) legs.push({ w: 1 - pRes, d, kStart: kCut, team: kCut < kEnd ? 1 : i });
  return legs;
}

/** Expected extra goals (AaH positive) from a power play already running, over T substeps. */
function powerplayExtra(params: HandballParams, state: ChainState, T: number): number {
  if (!state.suspensions.length || T <= 0) return 0;
  const st = chainStats(params);
  const k = state.k;
  const active = state.suspensions.filter((x) => x.untilK > k).sort((x, y) => x.untilK - y.untilK);
  let extra = 0;
  for (const team of [0, 1] as Team[]) {
    // window during which `team` has more players on court
    let adv = 0;
    for (const x of active) adv += x.team === team ? -1 : 1;
    if (adv <= 0) continue;
    let until = k;
    for (const x of active) {
      adv += x.team === team ? 1 : -1;
      until = x.untilK;
      if (adv <= 0) break;
    }
    const W = Math.min(until - k, T);
    const rest = restOfPossession(params, state);
    const other = team === 0 ? 1 : 0;
    // possessions of `team` that start inside the window, after the one in progress
    const o = state.possession === team ? rest + st.team[other].ES : rest;
    const n = Math.max(0, (W - o) / st.cycleK + 0.5);
    extra += (team === 0 ? 1 : -1) * params.ppBonus * n * (1 - st.team[team].ppShare);
  }
  return extra;
}

/**
 * Expected drift of the goal difference per minute for AaH. The base μ is the chain's long-run
 * drift; a running power play adds its expected extra goals spread over the horizon
 * (default: the rest of the match). The possession head start is not a drift: see possessionLegs.
 */
export function drift(params: HandballParams, state: ChainState, horizonMin?: number): number {
  const st = chainStats(params);
  const T = Math.max(0, (horizonMin ?? (K_END - state.k) / K_PER_MIN) * K_PER_MIN);
  if (T <= 0) return st.mu;
  return st.mu + powerplayExtra(params, state, T) / (T / K_PER_MIN);
}

/**
 * Lattice calibration of the first-passage formula (a documented deviation from the plain formula).
 * X moves in ±1 jumps, and for a skip-free walk the reflection principle gives
 * P(max ≥ a) ≈ P(X ≥ a) + P(X ≥ a + 1): the effective boundary sits about ½ goal further out than
 * for a continuous path, so the plain ½-goal correction overprices triggers by 3–12 pp against
 * Monte Carlo of the chain. Three changes fix it:
 *  1. the possession in progress is resolved explicitly (possessionLegs), so the jump that is about
 *     to happen is priced as a jump, not as a shifted start;
 *  2. the boundary distance gets an extra quarter goal: h = |a − x| − ½ + boundaryShift;
 *  3. a running power play's extra goals shift the start instead of the drift (they arrive in the
 *     first two minutes, not spread over the horizon).
 * Over 44 cases (fresh, power-play, passive-play and 7 m states; levels 1–5 away on both sides;
 * deadlines 2–25 min, some across halftime) the result is within ±3 pp of 6 000-path Monte Carlo,
 * mean error −0.7 pp.
 */
export const TRIGGER_CAL = { boundaryShift: 0.25 } as const;

interface LegGauss {
  /** Brownian start (goal difference plus the renewal offset of the starting possession). */
  x: number;
  /** Expected drift over the leg: μτ plus the halftime restart. */
  m: number;
  tau: number;
}

function legGauss(params: HandballParams, leg: PossessionLeg, kEnd: number): LegGauss {
  const st = chainStats(params);
  const T = kEnd - leg.kStart;
  if (T <= 0) return { x: leg.d, m: 0, tau: 0 };
  const scale = st.cycleK / 2;
  let x = leg.d;
  let m = (st.mu * T) / K_PER_MIN;
  if (leg.kStart < K_HALF && kEnd > K_HALF) {
    x += st.beta[leg.team] * (1 - Math.exp(-(K_HALF - leg.kStart) / scale));
    m += st.beta[1] * (1 - Math.exp(-(kEnd - K_HALF) / scale));
  } else {
    x += st.beta[leg.team] * (1 - Math.exp(-T / scale));
  }
  return { x, m, tau: T / K_PER_MIN };
}

// ---------- prices ----------

/**
 * Stern-style Brownian prices [AaH, draw, GOG] with continuity correction, mixed over the
 * possession legs: P(AaH) = Σ w·Φ((x − ½ + m)/(σ√τ)), P(GOG) = Σ w·Φ((−x − ½ − m)/(σ√τ)).
 */
export function winProbs(state: ChainState, params: HandballParams = HB_PARAMS): [number, number, number] {
  const T = K_END - state.k;
  const d = state.d;
  if (state.phase === 'over' || T <= 0) return d > 0 ? [1, 0, 0] : d < 0 ? [0, 0, 1] : [0, 1, 0];
  const st = chainStats(params);
  const ppx = powerplayExtra(params, state, T);
  let pH = 0;
  let pA = 0;
  for (const leg of possessionLegs(state, K_END, params)) {
    if (leg.w <= 0) continue;
    const g = legGauss(params, leg, K_END);
    if (g.tau <= 0) {
      pH += leg.d > 0 ? leg.w : 0;
      pA += leg.d < 0 ? leg.w : 0;
      continue;
    }
    const sd = st.sigma * Math.sqrt(g.tau);
    const xm = g.x + g.m + ppx;
    pH += leg.w * Phi((xm - 0.5) / sd);
    pA += leg.w * Phi((-xm - 0.5) / sd);
  }
  return [pH, Math.max(0, 1 - pH - pA), pA];
}

/** First passage of Brownian motion with drift nu toward a boundary h away (h ≤ 0: already there). */
export function firstPassage(h: number, nu: number, sigma2: number, tau: number): number {
  if (h <= 0) return 1;
  if (tau <= 0) return 0;
  const sd = Math.sqrt(sigma2 * tau);
  const p1 = Phi((nu * tau - h) / sd);
  const p2 = Math.exp((2 * nu * h) / sigma2) * Phi((-nu * tau - h) / sd);
  return Math.max(0, Math.min(1, p1 + (Number.isFinite(p2) ? p2 : 0)));
}

/**
 * P(the AaH lead X hits `level` at least once at or before deadlineMin). A level above the current
 * difference is hit when X rises to it ("Aalborg +4"), a level below when X falls to it
 * ("føringsskifte" from +1 is level −1). 1 if X is already at the level, 0 after the deadline.
 */
export function triggerProb(state: ChainState, level: number, deadlineMin: number, params: HandballParams = HB_PARAMS): number {
  const d = state.d;
  const lv = Math.round(level);
  if (lv === d) return 1;
  const up = lv > d;
  if (state.phase === 'over') return 0;
  const kD = Math.min(K_END, kOf(deadlineMin));
  if (kD <= state.k) return 0;
  const st = chainStats(params);
  const ppx = powerplayExtra(params, state, kD - state.k);
  const dir = up ? 1 : -1;
  let p = 0;
  for (const leg of possessionLegs(state, kD, params)) {
    if (leg.w <= 0) continue;
    if (up ? leg.d >= lv : leg.d <= lv) {
      p += leg.w;
      continue;
    }
    const g = legGauss(params, leg, kD);
    if (g.tau <= 0) continue;
    const h = dir * (lv - g.x - ppx) - 0.5 + TRIGGER_CAL.boundaryShift;
    p += leg.w * firstPassage(h, (dir * g.m) / g.tau, st.sigma2, g.tau);
  }
  return Math.max(0, Math.min(1, p));
}

// ---------- Monte Carlo of the chain (deterministic) ----------

export const MC_DEFAULT_PATHS = 4000;

/** Monte Carlo [AaH, draw, GOG] from state, paths 1..n of the chain (the live sim is path 0). */
export function mcWinProbs(
  state: ChainState,
  n: number = MC_DEFAULT_PATHS,
  params: HandballParams = HB_PARAMS,
  seed: number = FIXTURE.seed,
): [number, number, number] {
  const c = [0, 0, 0];
  for (let i = 1; i <= n; i++) {
    const r = runPath(params, seed, i, state, K_END);
    const d = r.h - r.a;
    c[d > 0 ? 0 : d === 0 ? 1 : 2]++;
  }
  return [c[0] / n, c[1] / n, c[2] / n];
}

/** Monte Carlo P(the AaH lead hits `level` at or before deadlineMin). */
export function mcTriggerProb(
  state: ChainState,
  level: number,
  deadlineMin: number,
  n: number = MC_DEFAULT_PATHS,
  params: HandballParams = HB_PARAMS,
  seed: number = FIXTURE.seed,
): number {
  const lv = Math.round(level);
  if (lv === state.d) return 1;
  const up = lv > state.d;
  const stopK = Math.min(K_END, kOf(deadlineMin));
  if (stopK <= state.k) return 0;
  let hits = 0;
  for (let i = 1; i <= n; i++) {
    const r = runPath(params, seed, i, state, stopK, (_k, _t, h, a) => (up ? h - a >= lv : h - a <= lv));
    if (r.stopped) hits++;
  }
  return hits / n;
}

// ---------- quotes in øre ----------

const ore = (x: number) => Math.max(0, Math.min(100, Math.round(x * 100)));

/** Asks in øre for [AaH, X, GOG]: power-method margin, 4 % overround. */
export function quotes(state: ChainState, params: HandballParams = HB_PARAMS): [number, number, number] {
  const a = powerAsks(winProbs(state, params), 0.04);
  return [ore(a[0]), ore(a[1]), ore(a[2])];
}

/** Ask in øre for the Ja side of "AaH lead hits `level` before deadlineMin": power method, 8 % margin. */
export function triggerQuote(state: ChainState, level: number, deadlineMin: number, params: HandballParams = HB_PARAMS): number {
  const p = triggerProb(state, level, deadlineMin, params);
  if (p >= 1) return 100;
  if (p <= 0) return 0;
  return ore(powerAsks([p, 1 - p], 0.08)[0]);
}
