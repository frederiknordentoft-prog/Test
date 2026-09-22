// ============================================================
// NORDLYS · SOLSTORM G5 feature (rules R13 in engine.ts).
// ============================================================
import type { Mark, SpinResult, StormSpinMeta, StormSummary } from './types.ts';
import { DEFAULT_MODEL, OUT, WAVE_EVERY, buildResult, runSpinCore, type Model, type Recorder } from './engine.ts';
import { MAX_CELLS } from './grid.ts';
import { Xoshiro128ss, makeSpinId, type Domain, type Rng } from './rng.ts';

export interface StormState { stakeOre: number; spinsTotal: number; spinIndex: number; marks: number[]; winOre: number; maxMark: number; capped: boolean }

/** True if a Stormbølge hits before the storm spin with this 0-based index (3, 7, 11, 15, 19). */
export function waveBefore(index: number): boolean {
  return index > 0 && (index + 1) % WAVE_EVERY === 0;
}

/** Stormbølge: every mark ≥ 2 doubles (cap). In place on a typed array. */
export function applyWave(marks: Uint8Array | number[], n: number, cap: number): void {
  for (let i = 0; i < n; i++) {
    const m = marks[i];
    if (m >= 2) marks[i] = m * 2 > cap ? cap : m * 2;
  }
}

function placeStartMarks(rng: Rng, marks: Uint8Array | number[], n: number, count: number): void {
  let placed = 0;
  while (placed < count) {
    const c = rng.int(n);
    if (marks[c] === 0) {
      marks[c] = 2;
      placed++;
    }
  }
}

/** Places stormStartMarks random x2 marks. Consumes `rng` (use its own spinRng index). */
export function createStorm(rng: Rng, stakeOre: number, model: Model = DEFAULT_MODEL): StormState {
  const cfg = model.cfg, n = model.storm.geo.n;
  if (!(Number.isInteger(stakeOre) && stakeOre > 0)) throw new Error('stakeOre must be a positive integer');
  const marks: number[] = new Array(n).fill(0);
  placeStartMarks(rng, marks, n, cfg.stormStartMarks);
  return { stakeOre, spinsTotal: cfg.stormSpins, spinIndex: 0, marks, winOre: 0, maxMark: cfg.stormStartMarks > 0 ? 2 : 0, capped: false };
}

export function stormDone(state: StormState): boolean {
  return state.capped || state.spinIndex >= state.spinsTotal;
}

const tmpMarks = new Uint8Array(MAX_CELLS);

function maxOf(a: Uint8Array, n: number): number {
  let m = 0;
  for (let i = 0; i < n; i++) if (a[i] > m) m = a[i];
  return m;
}

/** Plays the next storm spin. Mutates `state`. */
export function stormSpin(state: StormState, rng: Rng, spinId: string, model: Model = DEFAULT_MODEL): { result: SpinResult; meta: StormSpinMeta } {
  const cfg = model.cfg, mm = model.storm, n = mm.geo.n;
  if (stormDone(state)) throw new Error('storm is finished');
  const index = state.spinIndex;
  let wave: StormSpinMeta['wave'] = null;
  if (waveBefore(index)) {
    const before = state.marks.slice();
    applyWave(state.marks, n, mm.markCap);
    wave = { before, after: state.marks.slice() };
  }
  const marks = new Uint8Array(n);
  for (let i = 0; i < n; i++) marks[i] = state.marks[i];
  const marksBefore: Mark[] = state.marks.slice();
  const rec: Recorder = { initial: [], steps: [], sunCells: [] };
  const capOre = cfg.maxWinX * state.stakeOre - state.winOre;
  runSpinCore(mm, cfg, rng, state.stakeOre, marks, capOre, rec);
  const added = Math.min(OUT.retrigger, cfg.maxStormSpins - state.spinsTotal);
  const result = buildResult('storm', mm, spinId, state.stakeOre, marksBefore, marks, rec, false, Math.max(0, added));
  advanceState(state, marks, n, Math.max(0, added));
  return { result, meta: { index, total: state.spinsTotal, wave } };
}

function advanceState(state: StormState, marks: Uint8Array, n: number, added: number): void {
  for (let i = 0; i < n; i++) state.marks[i] = marks[i];
  state.winOre += OUT.totalOre;
  state.spinsTotal += added;
  state.spinIndex++;
  const mx = maxOf(marks, n);
  if (mx > state.maxMark) state.maxMark = mx;
  if (OUT.capped) {
    state.capped = true;
    state.spinsTotal = state.spinIndex; // max win ends the storm
  }
}

/** Applies the 30× guarantee (as its own line). */
export function finishStorm(state: StormState, model: Model = DEFAULT_MODEL): StormSummary {
  const floorOre = model.cfg.guaranteeX * state.stakeOre;
  return {
    stakeOre: state.stakeOre,
    spins: state.spinIndex,
    winOre: state.winOre,
    guaranteeOre: state.winOre < floorOre ? floorOre - state.winOre : 0,
    maxMark: state.maxMark,
    capped: state.capped,
  };
}

// ------------------------------------------------------------------------------------------------
// Whole-storm helpers (replay / tests / demo)
// ------------------------------------------------------------------------------------------------
/** Plays a complete storm with the recommended index convention (create = startIdx, spins = startIdx+1…). */
export function playStorm(sessionSeed: number, domain: Domain, startIdx: number, stakeOre: number, model: Model = DEFAULT_MODEL): {
  spins: { result: SpinResult; meta: StormSpinMeta }[]; summary: StormSummary; nextIdx: number;
} {
  const rng = new Xoshiro128ss();
  const state = createStorm(rng.seedSpin(sessionSeed, domain, startIdx), stakeOre, model);
  let idx = startIdx + 1;
  const spins: { result: SpinResult; meta: StormSpinMeta }[] = [];
  while (!stormDone(state)) {
    spins.push(stormSpin(state, new Xoshiro128ss().seedSpin(sessionSeed, domain, idx), makeSpinId(sessionSeed, domain, idx), model));
    idx++;
  }
  return { spins, summary: finishStorm(state, model), nextIdx: idx };
}

// ------------------------------------------------------------------------------------------------
// Simulator fast path (identical rules, no SpinResult, no allocation)
// ------------------------------------------------------------------------------------------------
export const STORM_OUT = { winOre: 0, spins: 0, maxMark: 0, capped: false, retriggers: 0 };
const simMarks = new Uint8Array(MAX_CELLS);

/** Full storm; rng is reseeded per spin exactly like playStorm (create = startIdx, spins startIdx+1…). */
export function simStorm(model: Model, rng: Xoshiro128ss, sessionSeed: number, domain: Domain, startIdx: number, stakeOre: number): void {
  const cfg = model.cfg, mm = model.storm, n = mm.geo.n, cap = mm.markCap;
  simMarks.fill(0, 0, n);
  rng.seedSpin(sessionSeed, domain, startIdx);
  placeStartMarks(rng, simMarks, n, cfg.stormStartMarks);
  let total = cfg.stormSpins, i = 0, win = 0, maxMark = cfg.stormStartMarks > 0 ? 2 : 0, capped = false, retr = 0;
  const capAll = cfg.maxWinX * stakeOre;
  while (i < total) {
    if (waveBefore(i)) applyWave(simMarks, n, cap);
    rng.seedSpin(sessionSeed, domain, startIdx + 1 + i);
    runSpinCore(mm, cfg, rng, stakeOre, simMarks, capAll - win, null);
    win += OUT.totalOre;
    if (OUT.retrigger > 0 && total < cfg.maxStormSpins) {
      total = Math.min(cfg.maxStormSpins, total + OUT.retrigger);
      retr++;
    }
    i++;
    const mx = maxOf(simMarks, n);
    if (mx > maxMark) maxMark = mx;
    if (OUT.capped) {
      capped = true;
      break;
    }
  }
  STORM_OUT.winOre = win;
  STORM_OUT.spins = i;
  STORM_OUT.maxMark = maxMark;
  STORM_OUT.capped = capped;
  STORM_OUT.retriggers = retr;
}
