// ================================================================================================
// NORDLYS · SOLSTORM G5 — OUTCOME ENGINE.  NORMATIVE RULE SPEC (every rule has a test in tests/math.*)
// ================================================================================================
//
// R1  GRID. Base 6×6 (cols×rows), Solstorm 8×8. Column-major idx = col·rows + row, row 0 = top.
//     Symbols per types.ts SYM: L1..L4 (0..3, low), H1..H3 (4..6, high), WILD (7), SUN (8).
//
// R2  DRAWS. Every cell is an independent weighted draw over Sym 0..7 (weights in CONFIG, never SUN):
//     sym = first k with rng.u32() < thr[k], thr[k] = round(2^32·Σ_{j≤k} w_j/Σw), thr[7] = 2^32.
//
// R3  SUNS (scatter). Initial drop only. After all cells are drawn, for col = 0..cols-1:
//     if rng.u32() < round(p·2^32) (p = pSun base/perk, pSunStorm storm) → row = rng.int(rows) and
//     that cell becomes SUN (replacing the drawn symbol). ≤1 sun per column. Suns are never part of
//     clusters, never removed, fall with gravity like other survivors; refills never contain suns.
//
// R4  CLUSTERS. For each paying s = 0..6: orthogonal components over cells that are s or WILD,
//     containing ≥1 real s. Size ≥ 5 pays paytable[s][bucket(size)], buckets 5,6,7,8,9-10,11-12,13-15,16+.
//     A WILD may count in clusters of several symbols. Pure-wild groups never pay.
//
// R5  MARKS ("reading A"). Marks belong to POSITIONS. Ladder 0 → 1 (frost, glow only) → 2 → 4 → … → cap
//     (base cap 32, storm cap 128). A cluster's multiplier uses marks BEFORE this step's upgrade:
//     mult = max(1, Σ over the cluster's cells of marks ≥ 2)   (additive).
//     After a step is evaluated, every cell in the union of winning clusters goes up ONE level; a cell
//     holding a WILD that was part of a win goes up TWO levels. Base marks reset every spin (perk spins
//     start with 4 random x2); storm marks persist for the whole storm.
//
// R6  PAY (integer øre, one rounding rule everywhere). For every cluster:
//       unit     = round(paytable[s][b] · scale · 10 000)          (scale = payScale or stormPayScale;
//                                                                   "pay units" = 1/10 000 of stake)
//       winOre   = floor((unit · mult · stakeOre + 5 000) / 10 000)   ← round half up, exact integers
//     Cluster.payX = unit / 10 000 (the effective × stake before multiplier).
//
// R7  CASCADE. Remove the union of winning cells (wilds included), survivors fall (per column, reported
//     as moves from → to, same column), then refill from the top with fresh weighted draws (R2, no suns).
//     Draw order of a cascade: for col = 0..cols-1 → compact survivors downward, then draw the empty
//     rows top → bottom (row 0 first). Repeat until no cluster; the final Step has clusters = [],
//     removed = [], markChanges = [], moves = [], refill = [], charge = 0.
//
// R8  SPIN TOTAL. T = Σ cluster winOre + sunPayOre, capped at maxWinX·stake (capped = true). The cascade
//     always resolves completely (the presentation still shows it); only the total is capped.
//     clusterWinOre = T − sunPayOre.
//
// R9  CHARGE (base & perk spins only; storm = 0). Every removal of a cell gives low 1 / high 2 / wild 3
//     (per removal event, so a refilled cell can pay charge again). Exactly 3 suns → +sunCharge (150)
//     and a sunPayX (3×) stake pay. 4+ suns → triggers.stormB only (no sun pay, no sun charge).
//
// R10 ANTICIPATION (fixed, logged). Base/perk only: the first k (1 ≤ k < cols) such that columns 0..k-1
//     hold exactly 3 suns in total → anticipation = { fromCol: k } (columns ≥ k slow down). Else null.
//     Storm spins: always null.
//
// R11 PERK "Ladet spin". When the meter crosses a tier with perk = true (Kp 3, 5, 7) the game grants a
//     free spin at the LOCKED stake: before the grid is drawn, 4 distinct cells are picked with
//     rng.int(36) (rejecting repeats) and start at x2. Perk spins accrue charge at the locked stake and
//     may trigger route B. Domain 'perk'.
//
// R12 METER / ROUTES (meter.ts). Meter = { charge, stakeSumOre }, stakeSumOre += charge_i·stake_i.
//     lockedStake = floor(stakeSumOre / charge) (default stake when charge = 0).
//     Route A: charge ≥ K → storm at the locked stake, then the meter resets to 0.
//     Route B: 4+ suns in a base/perk spin → storm at that spin's stake, meter kept.
//     A and B on the same spin → ONE storm at the spin's stake and the meter resets.
//     Triggers are evaluated after the spin (after addCharge).
//
// R13 STORM (storm.ts). 10 spins on 8×8 with stormWeights / pSunStorm / stormPayScale, mark cap 128.
//     createStorm places stormStartMarks = 6 distinct x2 marks (rng.int(64), rejecting repeats).
//     Stormbølge: BEFORE every 4th storm spin (0-based index 3, 7, 11, 15, 19) every mark ≥ 2 doubles
//     (cap 128) → meta.wave. 3+ suns in a storm spin → +retriggerSpins (3), total ≤ maxStormSpins (20).
//     Storm suns never pay and give no charge. The storm's running win is capped at maxWinX·stake; when
//     the cap is reached the storm ends after that spin. finishStorm: guaranteeOre =
//     max(0, min(guaranteeX, maxWinX)·stake − winOre), shown on its own line (never lifts past the max win).
//
// R14 RNG (rng.ts). rng = spinRng(sessionSeed, domain, idx) = xoshiro128** whose 4 state words are the
//     outputs 4·idx+1 … 4·idx+4 of the splitmix32 stream started at (sessionSeed ^ DOMAIN[domain]) >>> 0
//     (DOMAIN = BASE/STOR/PERK/DEMO as ASCII words, see rng.ts). Draw primitives: u32(); next() = u32/2^32;
//     int(n) = Lemire multiply-shift with rejection.
//     BASE / PERK spin: one fresh rng per spin (domain 'base' or 'perk', idx = that domain's counter).
//       call order: [perk: 4 × int(36) mark picks, repeats re-drawn] → 36 cell draws (col-major, R2)
//       → per column c = 0..5: u32() < sunThr ? int(rows) (R3) → cascade refills (R7), step by step.
//     STORM: ONE rng for the whole storm (domain 'storm', or 'demo' for the demo storm):
//       createStorm: 6 × int(64) start-mark picks (repeats re-drawn); then every stormSpin in order
//       continues the SAME stream: [wave: no draws] → 64 cell draws → 8 sun Bernoullis → refills.
//       Replaying a storm = re-running createStorm + stormSpin × k on a fresh spinRng with the same
//       (seed, domain, idx) — bit-identical (tested). The game uses idx = 100000 + storm counter.
//     spinId = NL-<seed hex8>-<B|S|P|D><idx 6 digits> (makeSpinId). spinBase defaults to the id of the
//     spinRng it was given when opts.spinId is omitted.
// ================================================================================================
import { SYM, type Mark, type Mode, type SpinResult, type Step, type Sym } from './types.ts';
import { CONFIG, type MathConfig } from './config.ts';
import { BUCKET_OF, MAX_CELLS, bernoulliThreshold, drawSym, geometry, thresholdsFromWeights, type Geometry } from './grid.ts';
import { findClusters, newClusterScratch, type ClusterScratch } from './cluster.ts';
import type { Rng } from './rng.ts';

export const PERK_MARKS = 4;
export const PERK_MARK_VALUE = 2;
export const WAVE_EVERY = 4;
export const PAY_UNIT = 10000;

const WILD = SYM.WILD;
const SUN = SYM.SUN;

// ------------------------------------------------------------------------------------------------
// Compiled model
// ------------------------------------------------------------------------------------------------
export interface ModeModel {
  mode: Mode;
  geo: Geometry;
  thr: Float64Array;       // symbol draw thresholds (R2)
  sunThr: number;          // sun Bernoulli threshold (R3)
  payUnits: Float64Array;  // [sym*8 + bucket] integer pay units (R6)
  markCap: number;
}
export interface Model {
  cfg: MathConfig;
  base: ModeModel;
  storm: ModeModel;
}

function payUnitsOf(cfg: MathConfig, scale: number): Float64Array {
  const u = new Float64Array(7 * 8);
  for (let s = 0; s < 7; s++) for (let b = 0; b < 8; b++) u[s * 8 + b] = Math.round(cfg.paytable[s][b] * scale * PAY_UNIT);
  return u;
}

export function compileModel(cfg: MathConfig): Model {
  return {
    cfg,
    base: {
      mode: 'base', geo: geometry(cfg.cols, cfg.rows), thr: thresholdsFromWeights(cfg.weights),
      sunThr: bernoulliThreshold(cfg.pSun), payUnits: payUnitsOf(cfg, cfg.payScale), markCap: cfg.baseMarkCap,
    },
    storm: {
      mode: 'storm', geo: geometry(cfg.stormCols, cfg.stormRows), thr: thresholdsFromWeights(cfg.stormWeights),
      sunThr: bernoulliThreshold(cfg.pSunStorm), payUnits: payUnitsOf(cfg, cfg.stormPayScale), markCap: cfg.stormMarkCap,
    },
  };
}

export const DEFAULT_MODEL: Model = compileModel(CONFIG);

/** R6: integer win for one cluster. */
export function clusterWinOre(unit: number, mult: number, stakeOre: number): number {
  return Math.floor((unit * mult * stakeOre + PAY_UNIT / 2) / PAY_UNIT);
}

/** R5: one mark level up. */
export function markUp(m: number, levels: number, cap: number): number {
  for (let l = 0; l < levels; l++) m = m === 0 ? 1 : m === 1 ? 2 : m * 2 > cap ? cap : m * 2;
  return m;
}

// ------------------------------------------------------------------------------------------------
// Kernel (allocation-free unless recording)
// ------------------------------------------------------------------------------------------------
/** Output of the last runSpinCore call (module-level, reused). */
export const OUT = {
  totalOre: 0,
  clusterWinOre: 0,
  rawClusterOre: 0,   // Σ cluster wins before cap
  sunPayOre: 0,
  capped: false,
  charge: 0,          // incl. sun charge
  sunCount: 0,
  stormB: false,
  retrigger: 0,       // storm: 3+ suns (caller clamps to the max)
  anticipation: -1,
  winSteps: 0,        // number of steps with ≥1 cluster
  removedCells: 0,
};

/**
 * Simulator hook (off in the game). The cascade never depends on the pays, so a sample of
 * (sym·8 + bucket, mult) pairs prices ANY paytable exactly:
 *   on = 1 → append every paying cluster's pair to sb/mult (tuner: non-linear metrics such as net-win)
 *   on = 2 → only accumulate acc[sym·8 + bucket] += mult (tuner: linear cluster-RTP weights, no memory)
 */
export const PAIR_SINK = { on: 0, sb: new Uint8Array(0), mult: new Uint16Array(0), n: 0, acc: new Float64Array(56) };

/** Optional recorder for the public API (allocates). */
export interface Recorder {
  initial: Sym[];
  steps: Step[];
  sunCells: number[];
}

const scratch: { grid: Uint8Array; removed: Uint8Array; scr: ClusterScratch } = {
  grid: new Uint8Array(MAX_CELLS),
  removed: new Uint8Array(MAX_CELLS),
  scr: newClusterScratch(),
};

/**
 * Plays one spin (base, perk or storm) from the marks in `marks` (mutated to marksAfter).
 * capOre = the most this spin may add (maxWinX·stake in base; the remaining storm budget in storm).
 */
export function runSpinCore(mm: ModeModel, cfg: MathConfig, rng: Rng, stakeOre: number, marks: Uint8Array, capOre: number, rec: Recorder | null): void {
  const geo = mm.geo, n = geo.n, rows = geo.rows, cols = geo.cols, thr = mm.thr, pay = mm.payUnits, cap = mm.markCap;
  const grid = scratch.grid, removed = scratch.removed, scr = scratch.scr;
  const isStorm = mm.mode === 'storm';

  // R2 initial drop
  for (let i = 0; i < n; i++) grid[i] = drawSym(rng, thr);
  // R3 suns
  let sunCount = 0, antic = -1;
  const sunThr = mm.sunThr;
  for (let c = 0; c < cols; c++) {
    if (rng.u32() < sunThr) {
      const cell = c * rows + rng.int(rows);
      grid[cell] = SUN;
      sunCount++;
      if (rec) rec.sunCells.push(cell);
      // R10: first k with exactly 3 suns in columns 0..k-1, k < cols
      if (sunCount === 3 && !isStorm && c + 1 < cols) antic = c + 1;
    }
  }
  if (rec) for (let i = 0; i < n; i++) rec.initial.push(grid[i] as Sym);

  let raw = 0, charge = 0, winSteps = 0, removedCells = 0;
  for (;;) {
    const k = findClusters(grid, geo, scr);
    let step: Step | null = null;
    if (rec) {
      const g: Sym[] = new Array(n);
      for (let i = 0; i < n; i++) g[i] = grid[i] as Sym;
      step = { grid: g, clusters: [], stepWinOre: 0, removed: [], markChanges: [], charge: 0, moves: [], refill: [] };
      rec.steps.push(step);
    }
    if (k === 0) break;
    winSteps++;
    removed.fill(0, 0, n);
    let stepWin = 0;
    const cells = scr.cells;
    for (let c = 0; c < k; c++) {
      const sym = scr.clSym[c], start = scr.clStart[c], size = scr.clSize[c];
      let sum = 0;
      for (let j = start, e = start + size; j < e; j++) {
        const cell = cells[j];
        const m = marks[cell];
        if (m >= 2) sum += m;
        removed[cell] = 1;
      }
      const mult = sum > 1 ? sum : 1;
      const sb = sym * 8 + BUCKET_OF[size];
      const unit = pay[sb];
      const win = Math.floor((unit * mult * stakeOre + 5000) / 10000);
      stepWin += win;
      if (PAIR_SINK.on !== 0) {
        if (PAIR_SINK.on === 1) {
          PAIR_SINK.sb[PAIR_SINK.n] = sb;
          PAIR_SINK.mult[PAIR_SINK.n] = mult > 65535 ? 65535 : mult;
          PAIR_SINK.n++;
        } else PAIR_SINK.acc[sb] += mult;
      }
      if (step) {
        const cl: number[] = [];
        for (let j = start, e = start + size; j < e; j++) cl.push(cells[j]);
        step.clusters.push({ sym: sym as Sym, cells: cl, size, payX: unit / PAY_UNIT, mult, winOre: win });
      }
    }
    // union → charge + mark upgrades (R5, R9)
    let stepCharge = 0;
    for (let i = 0; i < n; i++) {
      if (removed[i] === 0) continue;
      removedCells++;
      const g = grid[i];
      if (!isStorm) stepCharge += g <= 3 ? 1 : g === WILD ? 3 : 2;
      const m0 = marks[i];
      const m1 = markUp(m0, g === WILD ? 2 : 1, cap);
      marks[i] = m1;
      if (step) {
        step.removed.push(i);
        if (m1 !== m0) step.markChanges.push({ cell: i, from: m0, to: m1 });
      }
    }
    charge += stepCharge;
    raw += stepWin;
    // R7 gravity + refill
    for (let c = 0; c < cols; c++) {
      const base = c * rows;
      let w = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        const i = base + r;
        if (removed[i] === 0) {
          if (w !== r) {
            grid[base + w] = grid[i];
            if (step) step.moves.push({ from: i, to: base + w });
          }
          w--;
        }
      }
      for (let r = 0; r <= w; r++) {
        const s = drawSym(rng, thr);
        grid[base + r] = s;
        if (step) step.refill.push({ cell: base + r, sym: s as Sym });
      }
    }
    if (step) {
      step.stepWinOre = stepWin;
      step.charge = stepCharge;
    }
  }

  // R9 suns / triggers
  let sunPay = 0, stormB = false, retrig = 0;
  if (isStorm) {
    if (sunCount >= 3) retrig = cfg.retriggerSpins;
  } else if (sunCount === 3) {
    sunPay = cfg.sunPayX * stakeOre;
    charge += cfg.sunCharge;
  } else if (sunCount >= 4) {
    stormB = true;
  }
  // R8 cap
  let total = raw + sunPay, capped = false;
  if (total > capOre) {
    total = capOre;
    capped = true;
  }
  OUT.totalOre = total;
  OUT.clusterWinOre = total - sunPay;
  OUT.rawClusterOre = raw;
  OUT.sunPayOre = sunPay;
  OUT.capped = capped;
  OUT.charge = charge;
  OUT.sunCount = sunCount;
  OUT.stormB = stormB;
  OUT.retrigger = retrig;
  OUT.anticipation = antic;
  OUT.winSteps = winSteps;
  OUT.removedCells = removedCells;
}

/** R11: place PERK_MARKS distinct x2 marks (consumes rng before the grid draw). */
export function placePerkMarks(rng: Rng, marks: Uint8Array, n: number): void {
  let placed = 0;
  while (placed < PERK_MARKS) {
    const c = rng.int(n);
    if (marks[c] === 0) {
      marks[c] = PERK_MARK_VALUE;
      placed++;
    }
  }
}

const baseMarks = new Uint8Array(MAX_CELLS);

/** Fast path for the simulator: same rules, no SpinResult. Results in OUT. */
export function simBaseSpin(model: Model, rng: Rng, stakeOre: number, perk: boolean): void {
  const mm = model.base, n = mm.geo.n;
  baseMarks.fill(0, 0, n);
  if (perk) placePerkMarks(rng, baseMarks, n);
  runSpinCore(mm, model.cfg, rng, stakeOre, baseMarks, model.cfg.maxWinX * stakeOre, null);
}

// ------------------------------------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------------------------------------
function toMarks(a: Uint8Array, n: number): Mark[] {
  const o: Mark[] = new Array(n);
  for (let i = 0; i < n; i++) o[i] = a[i];
  return o;
}

/** Builds a SpinResult from OUT + recorder (shared by base and storm). */
export function buildResult(mode: Mode, mm: ModeModel, spinId: string, stakeOre: number, before: Mark[], after: Uint8Array, rec: Recorder, perk: boolean, retriggerSpins: number): SpinResult {
  const n = mm.geo.n;
  return {
    mode,
    spinId,
    stakeOre,
    cols: mm.geo.cols,
    rows: mm.geo.rows,
    initial: rec.initial,
    marksBefore: before,
    steps: rec.steps,
    marksAfter: toMarks(after, n),
    sunCells: rec.sunCells,
    sunPayOre: OUT.sunPayOre,
    clusterWinOre: OUT.clusterWinOre,
    totalOre: OUT.totalOre,
    capped: OUT.capped,
    chargeGained: OUT.charge,
    triggers: { stormB: OUT.stormB, retriggerSpins },
    anticipation: OUT.anticipation >= 0 ? { fromCol: OUT.anticipation } : null,
    perk,
  };
}

/** Base spin (also the perk "Ladet spin" with opts.perk). Pure: all randomness from `rng`. */
export function spinBase(rng: Rng, stakeOre: number, opts?: { perk?: boolean; spinId?: string; model?: Model }): SpinResult {
  const model = opts?.model ?? DEFAULT_MODEL;
  const perk = !!opts?.perk;
  const mm = model.base, n = mm.geo.n;
  if (!(Number.isInteger(stakeOre) && stakeOre > 0)) throw new Error('stakeOre must be a positive integer');
  const marks = new Uint8Array(n);
  if (perk) placePerkMarks(rng, marks, n);
  const before = toMarks(marks, n);
  const rec: Recorder = { initial: [], steps: [], sunCells: [] };
  runSpinCore(mm, model.cfg, rng, stakeOre, marks, model.cfg.maxWinX * stakeOre, rec);
  return buildResult('base', mm, opts?.spinId ?? (rng as { spinId?: string }).spinId ?? '', stakeOre, before, marks, rec, perk, 0);
}

/** Smallest possible non-zero cluster win (× stake), for the rules screen. */
export function minWinX(model: Model = DEFAULT_MODEL): number {
  let m = Infinity;
  for (let s = 0; s < 7; s++) m = Math.min(m, model.base.payUnits[s * 8] / PAY_UNIT);
  return m;
}
