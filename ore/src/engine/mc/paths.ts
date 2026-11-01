/**
 * Monte Carlo of the rest of the match, with the same intensities as the DP pricer (dp.ts):
 * score-dependent base rates, sampled OU pressure (exact update once per game minute),
 * decaying excitation from goals that have happened, a half-minute zone lift.
 * Uniforms are counter-hashed by (seed, path, absolute DP step, channel): common random numbers,
 * so refreshes as the clock moves reuse the same futures and the fan stays stable.
 */
import { hash01, hash32 } from '../lib/rng';
import { largestRemainder } from '../lib/quote';
import { baseRate, D as D_, DP_STEP as STEP_, zoneFactor, type FootballParams } from '../football/params';
import { baseTable, type BaseTable } from '../football/dp';

const D = D_;
const STEP = STEP_;

export interface McState { t: number; end: number; h: number; a: number; pi: number; excite: [number, number]; red: [number, number]; zone: number; goals: { t: number; team: 0 | 1 }[] }
export type Leg =
  | { kind: 'udfald'; o: 0 | 1 | 2 }
  | { kind: 'maal'; n: number } // at least n goals in total
  | { kind: 'btts' }
  | { kind: 'vindue'; a: number; b: number }; // a goal in [a, b)

export interface McRequest {
  id: number;
  seed: number;
  params: FootballParams;
  state: McState;
  n: number;
  /** Displayed 1X2 probabilities (mid), used to stratify 100 strands so the tally equals the price. */
  probs: [number, number, number];
  focus: 0 | 1 | 2;
  /** Focused ask (raw, øre) right now; strands start exactly there. */
  askNow: number;
  legs?: Leg[];
}

export interface Strand {
  id: number;
  outcome: 0 | 1 | 2;
  v: Float32Array; // focused price (øre) per point
  d: Int8Array; // goal difference per point
  goalT: number[]; // future goal times on this path
  goalTeam: (0 | 1)[];
  cell: number; // Byg: bitmask of legs that hit
}

export interface McResult {
  id: number;
  t0: number; // time of the first point
  tPts: Float32Array; // time of every point (first point is t0, then the DP grid)
  strands: Strand[];
  counts: [number, number, number];
  mcShares: [number, number, number];
  byg: null | { legP: number[]; joint: number; cellCounts: number[] };
  ms: number;
}

const baseCache = new Map<string, BaseTable>();
function base(p: FootballParams, end: number, red: [number, number]): BaseTable {
  const key = `${p.lamF}|${p.lamB}|${end}|${red.join(',')}`;
  let t = baseCache.get(key);
  if (!t) {
    t = baseTable(p, end, red);
    baseCache.set(key, t);
  }
  return t;
}

let permCache: { seed: number; n: number; perm: Uint32Array } | null = null;
function permutation(seed: number, n: number): Uint32Array {
  if (permCache && permCache.seed === seed && permCache.n === n) return permCache.perm;
  const keys = Array.from({ length: n }, (_, j) => [hash32(seed, j, 0, 7), j] as const);
  keys.sort((x, y) => x[0] - y[0]);
  permCache = { seed, n, perm: Uint32Array.from(keys.map((k) => k[1])) };
  return permCache.perm;
}

function gauss(seed: number, j: number, i: number, ch: number): number {
  const u1 = hash01(seed, j, i, ch) || 1e-12;
  const u2 = hash01(seed, j, i, ch + 1);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Probabilities on a path at minute t: base table tilted by the path's pressure. */
export function strandProbs(p: FootballParams, bt: BaseTable, t: number, end: number, d: number, pi: number): [number, number, number] {
  if (t >= end - 1e-9) return d > 0 ? [1, 0, 0] : d === 0 ? [0, 1, 0] : [0, 0, 1];
  const k = Math.min(bt.n, Math.max(0, Math.round(t / STEP)));
  const idx = k * (2 * D + 1) + Math.max(-D, Math.min(D, d)) + D;
  const w = bt.win[idx];
  const x = bt.draw[idx];
  const l = Math.max(0, 1 - w - x);
  const tilt = p.beta * pi * Math.min(1, (end - t) / 30);
  const lg = (q: number) => Math.log(Math.min(0.999999, Math.max(1e-6, q)) / (1 - Math.min(0.999999, Math.max(1e-6, q))));
  const sg = (z: number) => 1 / (1 + Math.exp(-z));
  const w2 = w <= 1e-9 || w >= 1 - 1e-9 ? w : sg(lg(w) + tilt);
  const l2 = l <= 1e-9 || l >= 1 - 1e-9 ? l : sg(lg(l) - tilt);
  const s = w2 + l2;
  if (s > 1) return [w2 / s, 0, l2 / s];
  return [w2, 1 - s, l2];
}

interface PathOut { h: number; a: number; goalT: number[]; goalTeam: (0 | 1)[]; d?: Int8Array; pi?: Float32Array }

/** One path. Points: t0, then every DP grid time up to end. */
function runPath(req: McRequest, j: number, record: boolean, nPts: number, firstDt: number, i0: number): PathOut {
  const p = req.params;
  const s = req.state;
  let h = s.h;
  let a = s.a;
  let pi = s.pi;
  let eh = Math.exp(pi / 2);
  let ea = 1 / eh;
  const goalT: number[] = [];
  const goalTeam: (0 | 1)[] = [];
  const dArr = record ? new Int8Array(nPts) : undefined;
  const piArr = record ? new Float32Array(nPts) : undefined;
  if (dArr && piArr) {
    dArr[0] = Math.max(-D, Math.min(D, h - a));
    piArr[0] = pi;
  }
  const ouDecay = Math.exp(-p.theta);
  const ouSd = p.sigma * Math.sqrt((1 - Math.exp(-2 * p.theta)) / (2 * p.theta));
  const zF = zoneFactor(p, 0, s.zone);
  const zB = zoneFactor(p, 1, s.zone);
  let t = s.t;
  for (let k = 1; k < nPts; k++) {
    const dt = k === 1 ? firstDt : Math.min(STEP, s.end - t);
    if (dt <= 0) break;
    const ahead = t - s.t + dt / 2;
    const decay = Math.exp(-ahead / p.tauE);
    const d = h - a;
    let hh = baseRate(p, 0, t, d, s.red) * eh * (1 + s.excite[0] * decay) * (ahead < 0.5 ? zF : 1) * dt;
    let aa = baseRate(p, 1, t, d, s.red) * ea * (1 + s.excite[1] * decay) * (ahead < 0.5 ? zB : 1) * dt;
    hh = Math.min(0.45, hh);
    aa = Math.min(0.45, aa);
    const step = i0 + k; // absolute DP step index: same draws whatever NU is
    const u = hash01(req.seed, j, step, 1);
    if (u < hh) {
      h++;
      goalT.push(t + dt * 0.5);
      goalTeam.push(0);
    } else if (u < hh + aa) {
      a++;
      goalT.push(t + dt * 0.5);
      goalTeam.push(1);
    }
    t += dt;
    if (step % 4 === 0) {
      pi = Math.max(-p.clip, Math.min(p.clip, pi * ouDecay + ouSd * gauss(req.seed, j, step, 2)));
      eh = Math.exp(pi / 2);
      ea = 1 / eh;
    }
    if (dArr && piArr) {
      dArr[k] = Math.max(-D, Math.min(D, h - a));
      piArr[k] = pi;
    }
  }
  return { h, a, goalT, goalTeam, d: dArr, pi: piArr };
}

function legHits(leg: Leg, s: McState, out: PathOut): boolean {
  const total = out.h + out.a;
  switch (leg.kind) {
    case 'udfald':
      return (out.h > out.a ? 0 : out.h === out.a ? 1 : 2) === leg.o;
    case 'maal':
      return total >= leg.n;
    case 'btts':
      return out.h >= 1 && out.a >= 1;
    case 'vindue': {
      if (s.goals.some((g) => g.t >= leg.a && g.t < leg.b)) return true;
      return out.goalT.some((g) => g >= leg.a && g < leg.b);
    }
  }
}

/** Runs the request. `yieldEvery` lets the main-thread fallback slice the work. */
export async function runMc(req: McRequest, yieldFn?: () => Promise<void>): Promise<McResult> {
  const t0 = performance.now();
  const s = req.state;
  const grid0 = Math.ceil(s.t / STEP - 1e-9);
  const firstDt = Math.max(1e-6, Math.min(grid0 * STEP, s.end) - s.t) || STEP;
  const i0 = grid0 - 1;
  const nPts = 1 + Math.max(1, Math.ceil((s.end - s.t) / STEP - 1e-9) + 1);
  const tPts = new Float32Array(nPts);
  tPts[0] = s.t;
  for (let k = 1; k < nPts; k++) tPts[k] = Math.min(s.end, k === 1 ? s.t + firstDt : tPts[k - 1] + STEP);

  const outcomes = new Uint8Array(req.n);
  const legs = req.legs ?? [];
  const cells = new Uint16Array(req.n);
  const legHit = legs.map(() => 0);
  let slice = performance.now();
  for (let j = 0; j < req.n; j++) {
    const out = runPath(req, j, false, nPts, firstDt, i0);
    outcomes[j] = out.h > out.a ? 0 : out.h === out.a ? 1 : 2;
    if (legs.length) {
      let c = 0;
      legs.forEach((leg, li) => {
        if (legHits(leg, s, out)) {
          c |= 1 << li;
          legHit[li]++;
        }
      });
      cells[j] = c;
    }
    if (yieldFn && performance.now() - slice > 4) {
      await yieldFn();
      slice = performance.now();
    }
  }
  const mcCounts = [0, 0, 0];
  outcomes.forEach((o) => mcCounts[o]++);
  const perm = permutation(req.seed, req.n);

  // Stratified selection: by 1X2 outcome normally, by leg cell when building.
  const strands: Strand[] = [];
  let counts: [number, number, number] = [0, 0, 0];
  let byg: McResult['byg'] = null;
  const bt = base(req.params, s.end, s.red);
  let pick: { j: number; cell: number }[] = [];
  if (legs.length) {
    const nCells = 1 << legs.length;
    const cellN = new Array(nCells).fill(0);
    cells.forEach((c) => cellN[c]++);
    const want = largestRemainder(cellN.map((v) => v / req.n), 100);
    const got = new Array(nCells).fill(0);
    for (let q = 0; q < perm.length; q++) {
      const j = perm[q];
      if (got[cells[j]] < want[cells[j]]) {
        got[cells[j]]++;
        pick.push({ j, cell: cells[j] });
      }
    }
    const all = (1 << legs.length) - 1;
    byg = { legP: legHit.map((v) => v / req.n), joint: cellN[all] / req.n, cellCounts: want };
  } else {
    const want = largestRemainder(req.probs, 100) as [number, number, number];
    counts = want;
    const got = [0, 0, 0];
    for (let q = 0; q < perm.length; q++) {
      const j = perm[q];
      const o = outcomes[j];
      if (got[o] < want[o]) {
        got[o]++;
        pick.push({ j, cell: 0 });
      }
    }
    pick = pick.sort((x, y) => outcomes[x.j] - outcomes[y.j]);
  }

  const startProbs = strandProbs(req.params, bt, s.t, s.end, s.h - s.a, s.pi);
  const delta = req.askNow - startProbs[req.focus] * 100;
  for (const { j, cell } of pick) {
    const out = runPath(req, j, true, nPts, firstDt, i0);
    const v = new Float32Array(nPts);
    const dArr = out.d as Int8Array;
    const piArr = out.pi as Float32Array;
    for (let k = 0; k < nPts; k++) {
      const t = tPts[k];
      const pr = strandProbs(req.params, bt, t, s.end, dArr[k], piArr[k])[req.focus] * 100;
      const fade = s.end - s.t > 1e-6 ? (s.end - t) / (s.end - s.t) : 0;
      v[k] = k === nPts - 1 ? pr : Math.max(0, Math.min(100, pr + delta * fade));
    }
    const outcome = (out.h > out.a ? 0 : out.h === out.a ? 1 : 2) as 0 | 1 | 2;
    strands.push({ id: j, outcome, v, d: dArr, goalT: out.goalT, goalTeam: out.goalTeam, cell });
  }
  return {
    id: req.id,
    t0: s.t,
    tPts,
    strands,
    counts,
    mcShares: [mcCounts[0] / req.n, mcCounts[1] / req.n, mcCounts[2] / req.n],
    byg,
    ms: performance.now() - t0,
  };
}
