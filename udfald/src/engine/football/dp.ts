/**
 * Closed-form-style pricer: dynamic programming over (DP step, goal difference) with
 * score-dependent intensities, expected pressure, excitation from goals that have happened,
 * and a short ball-zone lift. Everything the market shows for 1X2, next goal, goal windows
 * and branches comes from here. Monte Carlo (mc/) uses the same intensities.
 */
import { baseRate, D, DP_STEP, ouExpect, W, zoneFactor, type FootballParams } from './params';

export interface PriceState {
  t: number; // match minute now
  end: number; // full time incl. stoppage (e.g. 93)
  d: number; // FCK minus BIF
  pi: number; // pressure now
  excite: readonly [number, number]; // excitation amplitudes now (decay with tauE)
  red: readonly [number, number];
  zone: number;
}

/** Per-step goal probabilities from `t` to `end`, for every d. Index [k*W + d + D]. */
export interface RateGrid {
  t0: number;
  n: number; // number of DP steps
  h: Float64Array;
  a: Float64Array;
}

// Scratch buffers: the pricer runs many times per tick; reuse memory instead of allocating.
let scratchH = new Float64Array(0);
let scratchA = new Float64Array(0);

/** Rate grid. With `fresh` the arrays are new; otherwise shared scratch (valid until the next call). */
export function rateGrid(p: FootballParams, s: PriceState, fresh = false): RateGrid {
  const n = Math.max(0, Math.ceil((s.end - s.t) / DP_STEP - 1e-9));
  if (!fresh && scratchH.length < n * W) {
    scratchH = new Float64Array(Math.max(n * W, 400 * W));
    scratchA = new Float64Array(Math.max(n * W, 400 * W));
  }
  const h = fresh ? new Float64Array(n * W) : scratchH;
  const a = fresh ? new Float64Array(n * W) : scratchA;
  for (let k = 0; k < n; k++) {
    const t = s.t + k * DP_STEP;
    const dt = Math.min(DP_STEP, s.end - t);
    const ahead = k * DP_STEP + dt / 2;
    const mF = ouExpect(p, s.pi, ahead, 0.5);
    const mB = ouExpect(p, s.pi, ahead, -0.5);
    const decay = Math.exp(-ahead / p.tauE);
    const eF = 1 + s.excite[0] * decay;
    const eB = 1 + s.excite[1] * decay;
    // The ball zone matters only for the next half minute.
    const zF = ahead < 0.5 ? zoneFactor(p, 0, s.zone) : 1;
    const zB = ahead < 0.5 ? zoneFactor(p, 1, s.zone) : 1;
    for (let d = -D; d <= D; d++) {
      h[k * W + d + D] = Math.min(0.45, baseRate(p, 0, t, d, s.red) * mF * eF * zF * dt);
      a[k * W + d + D] = Math.min(0.45, baseRate(p, 1, t, d, s.red) * mB * eB * zB * dt);
    }
  }
  return { t0: s.t, n, h, a };
}

/** P(FCK wins), P(draw), P(BIF wins) from a state. */
export function price1x2(p: FootballParams, s: PriceState, grid?: RateGrid): [number, number, number] {
  const g = grid ?? rateGrid(p, s);
  let win = new Float64Array(W);
  let draw = new Float64Array(W);
  let nw = new Float64Array(W);
  let nd = new Float64Array(W);
  for (let d = -D; d <= D; d++) {
    win[d + D] = d > 0 ? 1 : 0;
    draw[d + D] = d === 0 ? 1 : 0;
  }
  for (let k = g.n - 1; k >= 0; k--) {
    for (let d = -D; d <= D; d++) {
      const i = k * W + d + D;
      const hh = g.h[i];
      const aa = g.a[i];
      const up = Math.min(d + 1, D) + D;
      const dn = Math.max(d - 1, -D) + D;
      nw[d + D] = hh * win[up] + aa * win[dn] + (1 - hh - aa) * win[d + D];
      nd[d + D] = hh * draw[up] + aa * draw[dn] + (1 - hh - aa) * draw[d + D];
    }
    [win, nw] = [nw, win];
    [draw, nd] = [nd, draw];
  }
  const dd = Math.max(-D, Math.min(D, s.d)) + D;
  const w = win[dd];
  const x = draw[dd];
  return [w, x, Math.max(0, 1 - w - x)];
}

/** Next goal: P(FCK scores next), P(no more goals), P(BIF scores next). */
export function nextGoal(p: FootballParams, s: PriceState, grid?: RateGrid): [number, number, number] {
  const g = grid ?? rateGrid(p, s);
  let surv = 1;
  let pf = 0;
  let pb = 0;
  const dd = Math.max(-D, Math.min(D, s.d)) + D;
  for (let k = 0; k < g.n; k++) {
    const hh = g.h[k * W + dd];
    const aa = g.a[k * W + dd];
    pf += surv * hh;
    pb += surv * aa;
    surv *= 1 - hh - aa;
  }
  return [pf, surv, pb];
}

/**
 * P(at least one goal in [a, b)) where a ≥ now. The goal-difference distribution is rolled
 * forward to a (it can change before the window starts), then survival is applied per d.
 */
export function windowGoal(p: FootballParams, s: PriceState, a: number, b: number, grid?: RateGrid): number {
  const g = grid ?? rateGrid(p, s);
  const ka = Math.max(0, Math.round((Math.max(a, s.t) - s.t) / DP_STEP));
  const kb = Math.min(g.n, Math.round((b - s.t) / DP_STEP));
  if (kb <= ka) return 0;
  let dist = new Float64Array(W);
  dist[Math.max(-D, Math.min(D, s.d)) + D] = 1;
  for (let k = 0; k < ka; k++) {
    const nd = new Float64Array(W);
    for (let d = -D; d <= D; d++) {
      const m = dist[d + D];
      if (m === 0) continue;
      const hh = g.h[k * W + d + D];
      const aa = g.a[k * W + d + D];
      nd[Math.min(d + 1, D) + D] += m * hh;
      nd[Math.max(d - 1, -D) + D] += m * aa;
      nd[d + D] += m * (1 - hh - aa);
    }
    dist = nd;
  }
  let none = 0;
  for (let d = -D; d <= D; d++) {
    if (dist[d + D] === 0) continue;
    let surv = 1;
    for (let k = ka; k < kb; k++) surv *= 1 - g.h[k * W + d + D] - g.a[k * W + d + D];
    none += dist[d + D] * surv;
  }
  return 1 - none;
}

/** Share of the next goal that is FCK's within [a, b) at the current difference (for bar colouring). */
export function windowShare(p: FootballParams, s: PriceState, a: number, b: number, grid?: RateGrid): number {
  const g = grid ?? rateGrid(p, s);
  const ka = Math.max(0, Math.round((Math.max(a, s.t) - s.t) / DP_STEP));
  const kb = Math.min(g.n, Math.round((b - s.t) / DP_STEP));
  const dd = Math.max(-D, Math.min(D, s.d)) + D;
  let f = 0;
  let tot = 0;
  for (let k = ka; k < kb; k++) {
    f += g.h[k * W + dd];
    tot += g.h[k * W + dd] + g.a[k * W + dd];
  }
  return tot > 0 ? f / tot : 0.5;
}

/** Base price table without pressure or excitation, for strand prices on simulated paths. */
export interface BaseTable { t0: number; n: number; win: Float64Array; draw: Float64Array }

export function baseTable(p: FootballParams, end: number, red: readonly [number, number]): BaseTable {
  const n = Math.ceil(end / DP_STEP - 1e-9);
  const win = new Float64Array((n + 1) * W);
  const draw = new Float64Array((n + 1) * W);
  for (let d = -D; d <= D; d++) {
    win[n * W + d + D] = d > 0 ? 1 : 0;
    draw[n * W + d + D] = d === 0 ? 1 : 0;
  }
  for (let k = n - 1; k >= 0; k--) {
    const t = k * DP_STEP;
    const dt = Math.min(DP_STEP, end - t);
    for (let d = -D; d <= D; d++) {
      const hh = baseRate(p, 0, t, d, red) * dt * Math.exp(((p.sigma * p.sigma) / (2 * p.theta)) / 8);
      const aa = baseRate(p, 1, t, d, red) * dt * Math.exp(((p.sigma * p.sigma) / (2 * p.theta)) / 8);
      const up = Math.min(d + 1, D) + D;
      const dn = Math.max(d - 1, -D) + D;
      const nx = (k + 1) * W;
      win[k * W + d + D] = hh * win[nx + up] + aa * win[nx + dn] + (1 - hh - aa) * win[nx + d + D];
      draw[k * W + d + D] = hh * draw[nx + up] + aa * draw[nx + dn] + (1 - hh - aa) * draw[nx + d + D];
    }
  }
  return { t0: 0, n, win, draw };
}

/** FCK-win price (0..1) on a simulated path at minute t with difference d and pressure pi. */
export function strandWin(p: FootballParams, bt: BaseTable, t: number, d: number, pi: number, end: number): number {
  if (t >= end - 1e-9) return d > 0 ? 1 : 0;
  const k = Math.min(bt.n, Math.max(0, Math.round(t / DP_STEP)));
  const w = bt.win[k * W + Math.max(-D, Math.min(D, d)) + D];
  if (w <= 1e-9 || w >= 1 - 1e-9) return w;
  const z = Math.log(w / (1 - w)) + p.beta * pi * Math.min(1, (end - t) / 30);
  return 1 / (1 + Math.exp(-z));
}

// ---------------------------------------------------------------------------------------------
// Totals and final scores. Same rate grid as 1X2, so the numbers are one model.
// ---------------------------------------------------------------------------------------------

export const GRID_MAX = 10; // extra goals per team; mass beyond is lumped at 10, never dropped
const GM = GRID_MAX + 1;

/**
 * Forward DP over the goals still to come for each team (f, b), with rates looked up at the
 * current goal difference d = (h0 + f) − (a0 + b). Returns P[f * 11 + b] for the extra goals.
 * 1X2 from this grid equals price1x2 (the ±8 clamp is exact: rates depend only on the sign of d).
 */
export function scoreGrid(p: FootballParams, s: PriceState, h0: number, a0: number, grid?: RateGrid): Float64Array {
  const g = grid ?? rateGrid(p, s);
  let cur = new Float64Array(GM * GM);
  let nxt = new Float64Array(GM * GM);
  cur[0] = 1;
  for (let k = 0; k < g.n; k++) {
    nxt.fill(0);
    for (let f = 0; f < GM; f++) {
      for (let b = 0; b < GM; b++) {
        const m = cur[f * GM + b];
        if (m === 0) continue;
        const d = Math.max(-D, Math.min(D, h0 + f - (a0 + b)));
        const hh = g.h[k * W + d + D];
        const aa = g.a[k * W + d + D];
        nxt[Math.min(f + 1, GRID_MAX) * GM + b] += m * hh;
        nxt[f * GM + Math.min(b + 1, GRID_MAX)] += m * aa;
        nxt[f * GM + b] += m * (1 - hh - aa);
      }
    }
    [cur, nxt] = [nxt, cur];
  }
  return cur;
}

/** 1X2 and P(total > line) read off a score grid. */
export function fromGrid(gridP: Float64Array, h0: number, a0: number): { x12: [number, number, number]; over: (line: number) => number; cell: (h: number, a: number) => number } {
  let w = 0;
  let x = 0;
  let l = 0;
  for (let f = 0; f < GM; f++) {
    for (let b = 0; b < GM; b++) {
      const m = gridP[f * GM + b];
      const d = h0 + f - (a0 + b);
      if (d > 0) w += m;
      else if (d === 0) x += m;
      else l += m;
    }
  }
  return {
    x12: [w, x, l],
    over: (line: number) => {
      let s = 0;
      for (let f = 0; f < GM; f++) for (let b = 0; b < GM; b++) if (h0 + a0 + f + b > line) s += gridP[f * GM + b];
      return s;
    },
    // Final score (h, a); 5 means "5 or more" for that team, as on the score map.
    cell: (h: number, a: number) => {
      let s = 0;
      for (let f = 0; f < GM; f++) {
        for (let b = 0; b < GM; b++) {
          const fh = Math.min(5, h0 + f);
          const fa = Math.min(5, a0 + b);
          if (fh === h && fa === a) s += gridP[f * GM + b];
        }
      }
      return s;
    },
  };
}

/**
 * P(total goals > line) by a backward DP over (d, extra goals so far), the needed count absorbing.
 * Shares the 1X2 rate grid.
 */
export function totalsBack(p: FootballParams, s: PriceState, goalsSoFar: number, line: number, grid?: RateGrid): number {
  const need = Math.floor(line) + 1 - goalsSoFar;
  if (need <= 0) return 1;
  const g = grid ?? rateGrid(p, s);
  // v[m * W + d]: P(cross) with m more goals already scored since now; m = need is absorbing (= 1).
  let v = new Float64Array(W * (need + 1));
  let nv = new Float64Array(W * (need + 1));
  v.fill(1, need * W);
  nv.fill(1, need * W);
  const gh = g.h;
  const ga = g.a;
  for (let k = g.n - 1; k >= 0; k--) {
    const base = k * W;
    for (let m = 0; m < need; m++) {
      const cur = m * W;
      const nxt = cur + W;
      for (let di = 0; di < W; di++) {
        const hh = gh[base + di];
        const aa = ga[base + di];
        const up = di === W - 1 ? di : di + 1;
        const dn = di === 0 ? 0 : di - 1;
        nv[cur + di] = hh * v[nxt + up] + aa * v[nxt + dn] + (1 - hh - aa) * v[cur + di];
      }
    }
    const tmp = v;
    v = nv;
    nv = tmp;
  }
  return v[Math.max(-D, Math.min(D, s.d)) + D];
}

/** Base table for strand prices of "total > line": (step, d, goals so far capped at nCap). */
export interface TotalsTable { n: number; line: number; nCap: number; v: Float64Array }

export function totalsTable(p: FootballParams, end: number, red: readonly [number, number], line: number): TotalsTable {
  const n = Math.ceil(end / DP_STEP - 1e-9);
  const need = Math.floor(line) + 1;
  const nCap = need; // absorbing once the line is crossed
  const NC = nCap + 1;
  const v = new Float64Array((n + 1) * W * NC);
  for (let d = 0; d < W; d++) v[(n * W + d) * NC + nCap] = 1;
  const jensen = Math.exp(((p.sigma * p.sigma) / (2 * p.theta)) / 8);
  for (let k = n - 1; k >= 0; k--) {
    const t = k * DP_STEP;
    const dt = Math.min(DP_STEP, end - t);
    for (let d = -D; d <= D; d++) {
      const hh = baseRate(p, 0, t, d, red) * dt * jensen;
      const aa = baseRate(p, 1, t, d, red) * dt * jensen;
      const up = Math.min(d + 1, D) + D;
      const dn = Math.max(d - 1, -D) + D;
      const nx = (k + 1) * W;
      for (let c = 0; c < nCap; c++) {
        v[(k * W + d + D) * NC + c] = hh * v[(nx + up) * NC + c + 1] + aa * v[(nx + dn) * NC + c + 1] + (1 - hh - aa) * v[(nx + d + D) * NC + c];
      }
      v[(k * W + d + D) * NC + nCap] = 1;
    }
  }
  return { n, line, nCap, v };
}

/**
 * Price (0..1) of "total > line" on a simulated path: base table, tilted by the path's pressure
 * through the change in total intensity (pressure on either side means more goals).
 */
export function strandOver(p: FootballParams, tt: TotalsTable, t: number, d: number, goals: number, pi: number, end: number, red: readonly [number, number]): number {
  if (goals > tt.line) return 1;
  if (t >= end - 1e-9) return 0;
  const k = Math.min(tt.n, Math.max(0, Math.round(t / DP_STEP)));
  const NC = tt.nCap + 1;
  const dd = Math.max(-D, Math.min(D, d)) + D;
  const v = tt.v[(k * W + dd) * NC + Math.min(goals, tt.nCap)];
  if (v <= 1e-9 || v >= 1 - 1e-9) return v;
  const lf = baseRate(p, 0, t, d, red);
  const lb = baseRate(p, 1, t, d, red);
  const mult = (lf * Math.exp(pi / 2) + lb * Math.exp(-pi / 2)) / (lf + lb);
  const z = Math.log(v / (1 - v)) + 2 * Math.log(mult) * Math.min(1, (end - t) / 30);
  return 1 / (1 + Math.exp(-z));
}
