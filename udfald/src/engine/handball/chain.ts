/**
 * Possession Markov chain for men's handball.
 *
 * One attack = a normal phase of random length D (tabulated in substeps), then one of:
 *  - suspension (prob pSuspension): the defending team gets 2:00, the attacking team keeps the ball
 *    and starts a fresh attack (now in power play);
 *  - passive play (prob pPassive): the arm goes up, the team has at most 4 passes (one every
 *    2–4 game seconds), may shoot after each, and loses the ball if the passes run out;
 *  - direct finish: a 7 m throw (prob p7m, thrown sevenDelayK later) or a shot from play.
 * The conversions are solved so that P(goal | attack does not end in a suspension) = p exactly
 * (below the conversion caps, which only bind for p above ≈ 0.84).
 *
 * Every random number is hash01(seed, kNow, channel, 2 * path + team), where kNow is the substep at
 * which the plan is drawn (the attack start for the live sim). So a plan is a pure function of
 * (seed, path, team, kNow, p, resume state), and the attack *timing* never depends on p: changing a
 * goal probability (bias, naturalGoals: false) only flips goals to misses and back.
 * The live sim uses path 0; Monte Carlo uses paths 1..n.
 */
import { hash01 } from '../lib/rng';
import { HandballParams, K_END, K_HALF, SUBSTEP_S, Team } from './params';

const CH_DUR = 1;
const CH_CAT = 2;
const CH_7M = 3;
const CH_GOAL = 4;
const CH_G7 = 5;
const CH_PG = 6;
const CH_PT = 10; // + passes left: pass interval
const CH_PA = 20; // + passes left: shoot or pass

export type Via = 'play' | '7m' | 'passive';
export type EndResult = 'goal' | 'turnover' | 'suspension';

/** One micro-event of an attack plan. The last event is always 'end'. */
export type PlanEv =
  | { k: number; t: 'passive' }
  | { k: number; t: 'pass' }
  | { k: number; t: '7m' }
  /** m = natural goal draw / conversion threshold (< 1 means a goal); Infinity if no goal was possible. */
  | { k: number; t: 'end'; r: EndResult; via: Via; m: number };

export type Phase = 'play' | 'passive' | '7m';

/** Where to resume an attack that is already under way (Monte Carlo from a live state). */
export interface Resume {
  phase: Phase;
  /** play: substeps since the attack started; passive: substeps since the warning or the last pass. */
  elapsedK: number;
  passesLeft: number;
  sevenAtK: number;
}

export interface Derived {
  /** P(D = j substeps) for the normal phase. */
  pmf: Float64Array;
  /** P(D <= j). */
  cum: Float64Array;
  meanD: number;
  varD: number;
  /** Shoot probability at each passes-left stage (index 0..4), independent of p. */
  shoot: number[];
}

const derivedCache = new WeakMap<HandballParams, Derived>();

function triCdf(x: number, a: number, c: number, b: number): number {
  if (x <= a) return 0;
  if (x >= b) return 1;
  if (x <= c) return ((x - a) * (x - a)) / ((b - a) * (c - a));
  return 1 - ((b - x) * (b - x)) / ((b - a) * (b - c));
}

function uniCdf(x: number, a: number, b: number): number {
  return x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
}

export function derived(params: HandballParams): Derived {
  const hit = derivedCache.get(params);
  if (hit) return hit;
  const s = params.duration;
  const cdfS = (x: number) =>
    s.fastShare * uniCdf(x, s.fastMinS, s.fastMaxS) + (1 - s.fastShare) * triCdf(x, s.setMinS, s.setModeS, s.setMaxS);
  const maxJ = Math.ceil(Math.max(s.fastMaxS, s.setMaxS) / SUBSTEP_S) + 1;
  const pmf = new Float64Array(maxJ + 1);
  for (let j = 1; j <= maxJ; j++) pmf[j] = Math.max(0, cdfS((j + 0.5) * SUBSTEP_S) - cdfS((j - 0.5) * SUBSTEP_S));
  let tot = 0;
  for (let j = 0; j <= maxJ; j++) tot += pmf[j];
  const cum = new Float64Array(maxJ + 1);
  let acc = 0;
  let m1 = 0;
  let m2 = 0;
  for (let j = 0; j <= maxJ; j++) {
    pmf[j] /= tot;
    acc += pmf[j];
    cum[j] = acc;
    m1 += j * pmf[j];
    m2 += j * j * pmf[j];
  }
  cum[maxJ] = 1;
  const rho = params.passiveRho;
  const eps = params.passiveEff;
  const shoot = [rho[0] / eps];
  for (let n = 1; n <= 4; n++) shoot.push((rho[n] - rho[n - 1]) / (eps - rho[n - 1]));
  const out: Derived = { pmf, cum, meanD: m1, varD: m2 - m1 * m1, shoot };
  derivedCache.set(params, out);
  return out;
}

export interface Conversions {
  /** P(goal | direct finish). */
  q: number;
  /** P(goal | shot from play) in a direct finish. */
  a: number;
  /** 7 m conversion. */
  c7: number;
  /** Shot conversion in passive play. */
  e: number;
  /** P(goal in the rest of the attack | passive play with n passes left), n = 0..4. */
  G: number[];
}

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

function directQ(params: HandballParams, p: number, G4: number): number {
  const u = params.pSuspension;
  const w = params.pPassive;
  return clamp((p * (1 - u) - w * G4) / (1 - u - w), 0, 0.98);
}

function passiveG(dv: Derived, e: number): number[] {
  const G = [dv.shoot[0] * e];
  for (let n = 1; n <= 4; n++) G.push(dv.shoot[n] * e + (1 - dv.shoot[n]) * G[n - 1]);
  return G;
}

/** Conversions for an attack with goal probability p by a team whose even-strength base is pBase. */
export function conversions(params: HandballParams, p: number, pBase: number): Conversions {
  const dv = derived(params);
  const e = clamp(params.passiveEff * p, 0, 0.97);
  const G = passiveG(dv, e);
  const q = directQ(params, p, G[4]);
  const eb = clamp(params.passiveEff * pBase, 0, 0.97);
  const qb = directQ(params, pBase, passiveG(dv, eb)[4]);
  const c7 = qb > 0 ? params.conv7m * Math.min(1, q / qb) : 0;
  const m7 = params.p7m;
  const a = clamp((q - m7 * c7) / (1 - m7), 0, 1);
  return { q, a, c7, e, G };
}

/** Normal-phase length given that elapsedK substeps have already passed (inverse CDF on the table). */
export function sampleDur(dv: Derived, elapsedK: number, u: number): number {
  const cum = dv.cum;
  const n = cum.length;
  const fe = elapsedK < n ? (elapsedK >= 0 ? cum[elapsedK] : 0) : 1;
  if (fe >= 1 - 1e-12) return elapsedK + 1;
  const target = fe + u * (1 - fe);
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] >= target) hi = mid;
    else lo = mid + 1;
  }
  return Math.max(lo, elapsedK + 1);
}

function samplePass(passK: readonly number[], elapsedK: number, u: number): number {
  let n = 0;
  for (const x of passK) if (x > elapsedK) n++;
  if (n === 0) return elapsedK + 1;
  let idx = Math.min(n - 1, Math.floor(u * n));
  for (const x of passK) {
    if (x <= elapsedK) continue;
    if (idx === 0) return x;
    idx--;
  }
  return elapsedK + 1;
}

/**
 * Draw the (rest of the) attack for `team` from substep kNow.
 * p is the attack's goal probability (power play and bias already applied), pBase the team's
 * even-strength base (it scales the 7 m conversion down when p is suppressed).
 */
export function planAttack(
  params: HandballParams,
  seed: number,
  path: number,
  team: Team,
  kNow: number,
  p: number,
  pBase: number,
  resume?: Resume,
): PlanEv[] {
  const dv = derived(params);
  const cv = conversions(params, p, pBase);
  const lane = path * 2 + team;
  const R = (ch: number) => hash01(seed, kNow, ch, lane);
  const out: PlanEv[] = [];

  const passive = (passesLeft: number, elapsedK: number, kStage: number) => {
    let k = kStage;
    let el = elapsedK;
    for (let n = passesLeft; n >= 0; n--) {
      k += samplePass(params.passK, el, R(CH_PT + n)) - el;
      el = 0;
      if (R(CH_PA + n) < dv.shoot[n]) {
        const ug = R(CH_PG);
        out.push({ k, t: 'end', r: ug < cv.e ? 'goal' : 'turnover', via: 'passive', m: cv.e > 0 ? ug / cv.e : Infinity });
        return;
      }
      if (n === 0) {
        out.push({ k, t: 'end', r: 'turnover', via: 'passive', m: Infinity });
        return;
      }
      out.push({ k, t: 'pass' });
    }
  };

  const seven = (kThrow: number) => {
    const ug = R(CH_G7);
    out.push({ k: kThrow, t: 'end', r: ug < cv.c7 ? 'goal' : 'turnover', via: '7m', m: cv.c7 > 0 ? ug / cv.c7 : Infinity });
  };

  const phase: Phase = resume?.phase ?? 'play';
  if (phase === 'passive' && resume) {
    passive(resume.passesLeft, resume.elapsedK, kNow);
    return out;
  }
  if (phase === '7m' && resume) {
    seven(Math.max(kNow + 1, resume.sevenAtK));
    return out;
  }
  const el = resume?.elapsedK ?? 0;
  const k = kNow + sampleDur(dv, el, R(CH_DUR)) - el;
  const uc = R(CH_CAT);
  const u = params.pSuspension;
  if (uc < u) {
    out.push({ k, t: 'end', r: 'suspension', via: 'play', m: Infinity });
  } else if (uc < u + params.pPassive) {
    out.push({ k, t: 'passive' });
    passive(4, 0, k);
  } else if (R(CH_7M) < params.p7m) {
    out.push({ k, t: '7m' });
    seven(k + params.sevenDelayK);
  } else {
    const ug = R(CH_GOAL);
    out.push({ k, t: 'end', r: ug < cv.a ? 'goal' : 'turnover', via: 'play', m: cv.a > 0 ? ug / cv.a : Infinity });
  }
  return out;
}

export interface Suspension {
  team: Team;
  untilK: number;
}

/** Players-on-court advantage of `team` at substep k (> 0 means power play). */
export function advantage(team: Team, k: number, susp: readonly Suspension[]): number {
  let adv = 0;
  for (const s of susp) if (s.untilK > k) adv += s.team === team ? -1 : 1;
  return adv;
}

/** The chain state the pricing functions and Monte Carlo need (a HandballSnapshot is one). */
export interface ChainState {
  k: number;
  h: number;
  a: number;
  d: number;
  possession: Team;
  phase: Phase | 'over';
  /** Substep at which the current attack started. */
  attackStartK: number;
  /** Passive play: substep of the warning or the last pass. */
  stageStartK: number;
  passesLeft: number;
  /** 7 m: substep of the throw. */
  sevenAtK: number;
  /** Did the attacking team have more players on court when the attack started? */
  attackPowerplay: boolean;
  /** Suspensions still running at k. */
  suspensions: readonly Suspension[];
}

/** A clean state at substep k: a fresh attack for `possession`, nobody suspended. */
export function stateAt(k: number, h: number, a: number, possession: Team = 0): ChainState {
  return {
    k,
    h,
    a,
    d: h - a,
    possession,
    phase: k >= K_END ? 'over' : 'play',
    attackStartK: k,
    stageStartK: k,
    passesLeft: 0,
    sevenAtK: 0,
    attackPowerplay: false,
    suspensions: [],
  };
}

export function resumeOf(st: ChainState): Resume | undefined {
  if (st.phase === 'play') return { phase: 'play', elapsedK: st.k - st.attackStartK, passesLeft: 0, sevenAtK: 0 };
  if (st.phase === 'passive') return { phase: 'passive', elapsedK: st.k - st.stageStartK, passesLeft: st.passesLeft, sevenAtK: 0 };
  if (st.phase === '7m') return { phase: '7m', elapsedK: 0, passesLeft: 0, sevenAtK: st.sevenAtK };
  return undefined;
}

export function attackP(params: HandballParams, team: Team, powerplay: boolean): number {
  return clamp(params.pGoal[team] + (powerplay ? params.ppBonus : 0), 0, params.pCap);
}

export interface PathResult {
  h: number;
  a: number;
  /** Substep at which the run stopped (stopK, full time, or the substep onGoal asked to stop). */
  k: number;
  stopped: boolean;
}

/**
 * Run one Monte Carlo path of the chain (no director timeline) from `st` up to and including stopK.
 * onGoal is called after every goal with (k, team, h, a); returning true stops the path.
 */
export function runPath(
  params: HandballParams,
  seed: number,
  path: number,
  st: ChainState,
  stopK: number,
  onGoal?: (k: number, team: Team, h: number, a: number) => boolean,
): PathResult {
  let k = st.k;
  let h = st.h;
  let a = st.a;
  let team = st.possession;
  if (st.phase === 'over' || k >= K_END) return { h, a, k, stopped: false };
  let susp: Suspension[] = st.suspensions.filter((s) => s.untilK > k).map((s) => ({ team: s.team, untilK: s.untilK }));
  let resume = resumeOf(st);
  let p = attackP(params, team, st.attackPowerplay);
  const end = Math.min(stopK, K_END - 1);
  for (;;) {
    const plan = planAttack(params, seed, path, team, k, p, params.pGoal[team], resume);
    resume = undefined;
    const fin = plan[plan.length - 1] as Extract<PlanEv, { t: 'end' }>;
    const cut = k < K_HALF ? K_HALF : K_END;
    if (fin.k >= cut) {
      if (cut === K_END || cut > end) return { h, a, k: end, stopped: false };
      k = K_HALF;
      team = 1;
    } else {
      if (fin.k > end) return { h, a, k: end, stopped: false };
      k = fin.k;
      const other: Team = team === 0 ? 1 : 0;
      if (fin.r === 'goal') {
        if (team === 0) h++;
        else a++;
        if (onGoal && onGoal(k, team, h, a)) return { h, a, k, stopped: true };
        team = other;
      } else if (fin.r === 'turnover') {
        team = other;
      } else {
        if (susp.length > 4) susp = susp.filter((s) => s.untilK > k);
        susp.push({ team: other, untilK: k + params.suspensionK });
      }
    }
    p = attackP(params, team, advantage(team, k, susp) > 0);
  }
}

/** Kick-off state: AaH throws off at 0:00. */
export const KICKOFF: ChainState = stateAt(0, 0, 0, 0);
