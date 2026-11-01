/**
 * Look-dev model for the future fan (F0). A small, honest version of the F1/F2 engine:
 * - DP over (step, goal difference) with score-dependent intensities gives fair 1X2 prices.
 * - Counter-hashed Monte Carlo (common random numbers) simulates the rest of the match.
 * - 100 strands are chosen by stable stratified selection, so the tally at full time
 *   equals the fair price exactly ("54 af 100 fremtider").
 * Pressure, crowd flow and halts are not modelled here; the history line is a seeded mock.
 */
import { hash01, hash32, hashSeed } from '../engine/lib/rng';
import { largestRemainder, powerAsks } from '../engine/lib/quote';

export const STEP = 0.25; // game minutes per step (15 game seconds)
export const D = 8; // goal-difference bound
export const END = 93; // full time incl. 3 minutes of stoppage (mock)
export const I_END = Math.round(END / STEP);
const W = 2 * D + 1;

export interface Fixture { lamH: number; lamA: number; seed: number }
export const DERBY: Fixture = { lamH: 1.6, lamA: 1.1, seed: hashSeed('FCK-BIF·Parken·2026·retur') };

export interface Goal { t: number; team: 0 | 1 }
export interface Scenario { id: string; label: string; now: number; goals: Goal[]; cause: string }
/** The scripted derby: BIF scores at 31', FCK equalises at 64'. Scenarios only set the starting minute. */
export const SCRIPT_GOALS: Goal[] = [{ t: 31, team: 1 }, { t: 64, team: 0 }];
export const SCENARIOS: Scenario[] = [
  { id: '27', label: '27′ · 0–0', now: 27, goals: SCRIPT_GOALS, cause: '' },
  { id: '70', label: '70′ · 1–1', now: 70, goals: SCRIPT_GOALS, cause: '' },
];

/** Goal intensity per game minute for team 0 (FCK) or 1 (BIF) at time t with goal difference d (FCK minus BIF). */
export function rate(team: 0 | 1, t: number, d: number, f: Fixture): number {
  const base = team === 0 ? f.lamH / 90 : f.lamA / 90;
  const s = (0.85 + 0.4 * Math.min(t, 90) / 90) / 1.05;
  const lead = team === 0 ? d : -d;
  const m = lead < 0 ? 1.18 : lead > 0 ? 0.9 : 1;
  return base * s * m;
}

export interface Table { win: Float64Array; draw: Float64Array }

/** Backward DP: P(FCK wins) and P(draw) for every (step, d). */
export function buildTable(f: Fixture): Table {
  const win = new Float64Array((I_END + 1) * W);
  const draw = new Float64Array((I_END + 1) * W);
  for (let d = -D; d <= D; d++) {
    win[I_END * W + d + D] = d > 0 ? 1 : 0;
    draw[I_END * W + d + D] = d === 0 ? 1 : 0;
  }
  for (let i = I_END - 1; i >= 0; i--) {
    const t = i * STEP;
    for (let d = -D; d <= D; d++) {
      const h = rate(0, t, d, f) * STEP;
      const a = rate(1, t, d, f) * STEP;
      const up = Math.min(d + 1, D) + D;
      const dn = Math.max(d - 1, -D) + D;
      const n = (i + 1) * W;
      win[i * W + d + D] = h * win[n + up] + a * win[n + dn] + (1 - h - a) * win[n + d + D];
      draw[i * W + d + D] = h * draw[n + up] + a * draw[n + dn] + (1 - h - a) * draw[n + d + D];
    }
  }
  return { win, draw };
}

export function fair(tab: Table, i: number, d: number): [number, number, number] {
  const k = Math.min(I_END, Math.max(0, i)) * W + Math.max(-D, Math.min(D, d)) + D;
  const w = tab.win[k];
  const x = tab.draw[k];
  return [w, x, Math.max(0, 1 - w - x)];
}

export function scoreAt(goals: Goal[], t: number): { h: number; a: number } {
  let h = 0;
  let a = 0;
  for (const g of goals) if (g.t <= t) (g.team === 0 ? h++ : a++);
  return { h, a };
}

/** Pressure: an Ornstein–Uhlenbeck process in game time (FCK minus BIF), per simulated path. */
export const PRESS = { theta: 0.2, sigma: 0.3, beta: 0.55, clip: 0.9 };

function gauss(seed: number, j: number, i: number, ch: number): number {
  const u1 = hash01(seed, j, i, ch) || 1e-12;
  const u2 = hash01(seed, j, i, ch + 1);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Per-step goal probabilities for every (step, d), precomputed once per fixture. */
interface Rates { h: Float64Array; a: Float64Array }
const rateCache = new Map<number, Rates>();
function rates(f: Fixture): Rates {
  let r = rateCache.get(f.seed);
  if (r) return r;
  const W = 2 * D + 1;
  r = { h: new Float64Array((I_END + 1) * W), a: new Float64Array((I_END + 1) * W) };
  for (let i = 0; i <= I_END; i++) {
    for (let d = -D; d <= D; d++) {
      r.h[i * W + d + D] = rate(0, i * STEP, d, f) * STEP;
      r.a[i * W + d + D] = rate(1, i * STEP, d, f) * STEP;
    }
  }
  rateCache.set(f.seed, r);
  return r;
}

const MIN_STEPS = Math.round(1 / STEP); // pressure updates once per game minute
const OU_DECAY = Math.exp(-PRESS.theta * 1);
const OU_SD = PRESS.sigma * Math.sqrt((1 - Math.exp(-2 * PRESS.theta)) / (2 * PRESS.theta));

/**
 * Simulates one path from iNow. Uniforms come from (seed, path, absolute step, channel), so the
 * same future draws are reused whatever NU is (common random numbers). Pressure tilts the
 * intensities and follows an exact OU update once per game minute.
 */
function runPath(f: Fixture, j: number, iNow: number, d0: number, pi0: number, outD?: Int8Array, outPi?: Float32Array): number {
  const r = rates(f);
  const W = 2 * D + 1;
  let d = d0;
  let pi = pi0;
  let eh = Math.exp(pi / 2);
  let ea = 1 / eh;
  if (outD && outPi) {
    outD[0] = d;
    outPi[0] = pi;
  }
  for (let i = iNow; i < I_END; i++) {
    const k = i * W + d + D;
    const h = r.h[k] * eh;
    const a = r.a[k] * ea;
    const u = hash01(f.seed, j, i, 1);
    if (u < h) d = Math.min(d + 1, D);
    else if (u < h + a) d = Math.max(d - 1, -D);
    if ((i + 1) % MIN_STEPS === 0) {
      pi = Math.max(-PRESS.clip, Math.min(PRESS.clip, pi * OU_DECAY + OU_SD * gauss(f.seed, j, i, 2)));
      eh = Math.exp(pi / 2);
      ea = 1 / eh;
    }
    if (outD && outPi) {
      outD[i - iNow + 1] = d;
      outPi[i - iNow + 1] = pi;
    }
  }
  return d;
}

/** Outcome per path: 0 = FCK wins, 1 = draw, 2 = BIF wins. */
export function simulateOutcomes(f: Fixture, iNow: number, d0: number, n: number, pi0 = 0): Uint8Array {
  const out = new Uint8Array(n);
  for (let j = 0; j < n; j++) {
    const d = runPath(f, j, iNow, d0, pi0);
    out[j] = d > 0 ? 0 : d === 0 ? 1 : 2;
  }
  return out;
}

/** Goal difference and pressure per step from iNow to I_END (inclusive) for one path. */
export function simulatePath(f: Fixture, iNow: number, d0: number, j: number, pi0 = 0): { d: Int8Array; pi: Float32Array } {
  const d = new Int8Array(I_END - iNow + 1);
  const pi = new Float32Array(I_END - iNow + 1);
  runPath(f, j, iNow, d0, pi0, d, pi);
  // Pressure is drawn once per game minute; interpolate between those knots so prices glide.
  let k0 = 0;
  for (let k = 1; k < pi.length; k++) {
    if ((iNow + k) % MIN_STEPS === 0 || k === pi.length - 1) {
      const a = pi[k0];
      const b = pi[k];
      for (let m = k0 + 1; m < k; m++) pi[m] = a + ((b - a) * (m - k0)) / (k - k0);
      k0 = k;
    }
  }
  return { d, pi };
}

/** Price (øre) of "FCK vinder" on a path: DP price tilted by the path's pressure, weaker as time runs out. */
export function strandPrice(tab: Table, i: number, d: number, pi: number): number {
  if (i >= I_END) return d > 0 ? 100 : 0;
  const w = fair(tab, i, d)[0];
  if (w <= 1e-9 || w >= 1 - 1e-9) return w * 100;
  const remaining = (I_END - i) * STEP;
  const z = Math.log(w / (1 - w)) + PRESS.beta * pi * Math.min(1, remaining / 30);
  return 100 / (1 + Math.exp(-z));
}

/** A fixed permutation of path indices, so selection is stable across refreshes. */
export function permutation(seed: number, n: number): Uint32Array {
  const keys = Array.from({ length: n }, (_, j) => [hash32(seed, j, 0, 7), j] as const);
  keys.sort((x, y) => x[0] - y[0]);
  return Uint32Array.from(keys.map((k) => k[1]));
}

export interface Selection { ids: number[]; counts: [number, number, number] }

/** Stratified selection: for each outcome o, the first round(n·p_o) paths (in permutation order) that end in o. */
export function selectStrands(outcomes: Uint8Array, perm: Uint32Array, probs: [number, number, number], n = 100): Selection {
  const want = largestRemainder(probs, n) as [number, number, number];
  const ids: number[] = [];
  const counts: [number, number, number] = [0, 0, 0];
  for (let o = 0; o < 3; o++) {
    for (let k = 0; k < perm.length && counts[o] < want[o]; k++) {
      const j = perm[k];
      if (outcomes[j] === o) {
        ids.push(j);
        counts[o]++;
      }
    }
  }
  return { ids, counts };
}

/** Seeded mock history of the FCK ask (øre) per step, with jumps at goals and smooth flow noise. */
export function mockHistory(f: Fixture, tab: Table, sc: Scenario): Float32Array {
  const iNow = Math.round(sc.now / STEP);
  const out = new Float32Array(iNow + 1);
  let x = 0;
  for (let i = 0; i <= iNow; i++) {
    const t = i * STEP;
    const s = scoreAt(sc.goals, t);
    const p = fair(tab, i, s.h - s.a);
    const ask = powerAsks(p, 0.03)[0];
    // OU in logit space: mean reversion ~3 game minutes, sd ~0.08 logit.
    const u1 = hash01(f.seed, i, 3, 9) || 1e-9;
    const u2 = hash01(f.seed, i, 4, 9);
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    x += -x * (STEP / 4) + 0.045 * Math.sqrt(2 * STEP / 4) * z;
    const pressure = sc.id === '27' && t > 20 ? 0.18 * Math.min(1, (t - 20) / 6) : 0;
    const lg = Math.log(ask / (1 - ask)) + x + pressure;
    out[i] = 100 / (1 + Math.exp(-lg));
  }
  return out;
}

export interface Branch { label: string; price: number; weight: number; team: 0 | 1 | null }
export interface Window { from: number; to: number; p: number; fckShare: number }

export interface FanFrame {
  now: number;
  iNow: number;
  d: number;
  score: { h: number; a: number };
  fair: [number, number, number];
  asks: [number, number, number]; // øre, FCK ask includes the history's flow offset
  history: Float32Array;
  /** Strand price (øre) per step from iNow to I_END; ends at exactly 100 or 0. */
  strands: { id: number; outcome: 0 | 1 | 2; d: Int8Array; v: Float32Array }[];
  counts: [number, number, number];
  branches: Branch[];
  horizon: number;
  windows: Window[];
  headline: string;
  cause: string;
  goals: Goal[];
}

const PATHS = 5000;
let permCache: { seed: number; perm: Uint32Array } | null = null;

export function computeFrame(f: Fixture, tab: Table, sc: Scenario, nowOverride?: number): FanFrame {
  const now = nowOverride ?? sc.now;
  const scn = { ...sc, now };
  const iNow = Math.round(now / STEP);
  const score = scoreAt(sc.goals, now);
  const d = score.h - score.a;
  const pDP = fair(tab, iNow, d);
  const history = mockHistory(f, tab, scn);
  // The live price carries pressure and flow that the DP table does not. Carry the same logit
  // offset into the displayed probabilities, so "X af 100 fremtider" always matches the price.
  const logit = (q: number) => Math.log(q / (1 - q));
  const sig = (z: number) => 1 / (1 + Math.exp(-z));
  const askW = history[history.length - 1] / 100;
  const off = logit(askW) - logit(powerAsks(pDP, 0.03)[0]);
  const pw = sig(logit(Math.max(1e-6, pDP[0])) + off);
  const rest = pDP[1] + pDP[2] || 1;
  const p: [number, number, number] = [pw, ((1 - pw) * pDP[1]) / rest, ((1 - pw) * pDP[2]) / rest];
  const base = powerAsks(p, 0.03).map((v) => v * 100) as [number, number, number];
  const asks: [number, number, number] = [askW * 100, base[1], base[2]];

  // Today's pressure state, read off the price: the part of the ask the DP table does not explain.
  const rem = Math.max(1e-6, Math.min(1, ((I_END - iNow) * STEP) / 30));
  const pi0 = Math.max(-PRESS.clip, Math.min(PRESS.clip, off / (PRESS.beta * rem)));

  if (!permCache || permCache.seed !== f.seed) permCache = { seed: f.seed, perm: permutation(f.seed, PATHS) };
  const outcomes = simulateOutcomes(f, iNow, d, PATHS, pi0);
  const sel = selectStrands(outcomes, permCache.perm, p);
  // Strand price = path price + the small remaining ask offset (margin, flow), fading to 0 at full time.
  const delta = asks[0] - strandPrice(tab, iNow, d, pi0);
  const span = I_END - iNow || 1;
  const strands = sel.ids.map((j) => {
    const path = simulatePath(f, iNow, d, j, pi0);
    const v = new Float32Array(path.d.length);
    for (let k = 0; k < path.d.length; k++) {
      const i = iNow + k;
      v[k] = i >= I_END ? (path.d[k] > 0 ? 100 : 0) : Math.max(0, Math.min(100, strandPrice(tab, i, path.d[k], path.pi[k]) + (delta * (I_END - i)) / span));
    }
    return { id: j, outcome: outcomes[j] as 0 | 1 | 2, d: path.d, v };
  });

  // Branches: price of "FCK vinder" right after each first event within the horizon.
  const horizon = Math.max(1, Math.min(10, (END - now) / 2));
  let lf = 0;
  let lb = 0;
  for (let t = now; t < now + horizon; t += STEP) {
    lf += rate(0, t, d, f) * STEP;
    lb += rate(1, t, d, f) * STEP;
  }
  const l = lf + lb;
  const none = Math.exp(-l);
  const askOf = (pp: [number, number, number]) => powerAsks(pp, 0.03)[0] * 100;
  const branches: Branch[] = [
    { label: 'Mål FCK', price: askOf(fair(tab, iNow, d + 1)), weight: (lf / l) * (1 - none), team: 0 },
    { label: `Intet mål ${Math.round(horizon)}′`, price: askOf(fair(tab, iNow + Math.round(horizon / STEP), d)), weight: none, team: null },
    { label: 'Mål BIF', price: askOf(fair(tab, iNow, d - 1)), weight: (lb / l) * (1 - none), team: 1 },
  ];

  // Målvejret: P(goal) per remaining 5-minute window at the current score.
  const windows: Window[] = [];
  let start = now;
  while (start < END - 0.01) {
    let to = (Math.floor(start / 5 + 1e-9) + 1) * 5;
    if (to >= 90) to = END;
    let wf = 0;
    let wb = 0;
    for (let t = start; t < to; t += STEP) {
      wf += rate(0, t, d, f) * STEP;
      wb += rate(1, t, d, f) * STEP;
    }
    windows.push({ from: start, to, p: 1 - Math.exp(-(wf + wb)), fckShare: wf / (wf + wb) });
    start = to;
  }
  let surv = 1;
  let headline = '';
  for (const w of windows) {
    surv *= 1 - w.p;
    if (1 - surv >= 0.5) {
      headline = `Et mål er sandsynligt inden ${w.to >= 90 ? '90' : w.to}′ (${Math.round((1 - surv) * 100)} %)`;
      break;
    }
  }
  if (!headline) headline = `Mål resten af kampen: ${Math.round((1 - surv) * 100)} %`;

  return { now, iNow, d, score, fair: p, asks, history, strands, counts: sel.counts, branches, horizon, windows, headline, cause: causeText(sc, now, history), goals: sc.goals.filter((g) => g.t <= now) };
}

/** Mock cause chip, but with numbers read from the same history the line draws. */
function causeText(sc: Scenario, now: number, hist: Float32Array): string {
  const iNow = hist.length - 1;
  const arrow = (v: number) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(v))} øre`;
  const past = sc.goals.filter((g) => g.t <= now);
  const last = past[past.length - 1];
  if (last && now - last.t < 6) {
    const i = Math.ceil(last.t / STEP);
    return `${arrow(hist[i] - hist[i - 1])}: mål ${last.team === 0 ? 'FCK' : 'BIF'} ${last.t}′`;
  }
  if (now > 20 && now < 31) return `${arrow(hist[iNow] - hist[Math.max(0, iNow - 16)])}: 3 hjørnespark på 4 kampmin`;
  const dv = hist[iNow] - hist[Math.max(0, iNow - 8)];
  if (Math.abs(dv) < 1) return 'Rolig handel · under 1 øre på 2 kampmin';
  return `${arrow(dv)}: tiden løber (${scoreAt(sc.goals, now).h}–${scoreAt(sc.goals, now).a})`;
}
