/**
 * STELLA NOVA — the maths model.
 *
 * Everything that decides an outcome lives in PARAMS: symbol weights per ring,
 * comet chances, the paytable, the multiplier ladder, the awards, the Nova
 * threshold and the cap. The engine (engine.ts) and the simulator (kernel.ts,
 * sim.ts) both run on the tables compiled from it, so there is one model and
 * two readers.
 *
 * This file is executed directly by Node (type stripping), hence the explicit
 * .ts extensions and erasable-only syntax.
 */
import { RINGS, SYM } from '../core/config.ts';
import type { ModelInfo, ModelStats, PaytableEntry, SymbolId } from '../core/types.ts';

/** Weight tables are indexed by symbol id 0..8 (eight paying symbols, then the wild). */
export const WEIGHT_SYMBOLS = 9;
/** Comet chances are stated per COMET_DEN ring stops. */
export const COMET_DEN = 10000;

export interface ModelParams {
  name: string;
  version: string;
  /** Base game, initial stop: weights[ring][symbol 0..8]. */
  initWeights: number[][];
  /** Base game, refills after a burst. No comets in refills. */
  refillWeights: number[][];
  /** Kometnat, initial stop. Ring 0 is unused there: it is the wreath of wilds. */
  freeInitWeights: number[][];
  /** Kometnat, refills. Ring 0 never bursts there. */
  freeRefillWeights: number[][];
  /** Chance per COMET_DEN that a ring stops with its one comet, base game. */
  cometChance: number[];
  /** Same during Kometnat. Ring 0 must be 0. */
  freeCometChance: number[];
  /** Pays in tenths of the total bet, by symbol id 0..7. Wild-only lines pay as the Sun. */
  pay3: number[];
  pay4: number[];
  /** Multiplier by cascade index. The last value repeats. */
  ladder: number[];
  novaThreshold: number;
  freeSpinsAward: { 3: number; 4: number };
  retriggerAward: { 2: number; 3: number };
  maxWinMultiple: number;
}

// Symbol order in every row: Safir, Smaragd, Ametyst, Rubin, Måne, Jupiter, Saturn, Sol, Stella Nova.
//
// The rings are deliberately unlike each other. Ring 1 is the planet ring and
// ring 2 the gem ring, so a spoke rarely agrees with itself by accident: that
// leaves room for the player's own move to be worth something. Ring 2 decides
// what a Nova pays (rings 0 and 1 turn wild), so gems there keep the Nova a
// mid-sized event. Ring 3 is gem-heavy with few Suns: four of a kind is common
// for gems and rare for the top planets, which is where the big pays sit.
const INIT_WEIGHTS: number[][] = [
  [130, 130, 130, 130, 115, 105, 95, 85, 10],
  [65, 65, 65, 65, 170, 160, 150, 140, 10],
  [180, 180, 180, 180, 42, 38, 33, 28, 10],
  [170, 170, 170, 170, 60, 50, 34, 19, 12],
];

// Kometnat: ring 0 is all wild, so only rings 1 and 2 have to agree, and every
// tick deals all eight spokes a fresh pair. The two rings are pushed further
// apart here to keep the chains from running away.
const FREE_WEIGHTS: number[][] = [
  INIT_WEIGHTS[0],
  [34, 34, 34, 34, 210, 200, 190, 180, 10],
  [200, 200, 200, 200, 39, 35, 31, 27, 10],
  INIT_WEIGHTS[3],
];

export const PARAMS: ModelParams = {
  name: 'Stella Nova',
  version: '1.0.0',
  initWeights: INIT_WEIGHTS,
  refillWeights: INIT_WEIGHTS,
  freeInitWeights: FREE_WEIGHTS,
  freeRefillWeights: FREE_WEIGHTS,
  cometChance: [1200, 1200, 1200, 1200],
  freeCometChance: [0, 800, 800, 800],
  pay3: [2, 2, 3, 4, 5, 8, 12, 20],
  pay4: [5, 6, 8, 10, 40, 60, 150, 500],
  ladder: [1, 2, 3, 5, 8, 12, 20],
  novaThreshold: 180,
  freeSpinsAward: { 3: 8, 4: 12 },
  retriggerAward: { 2: 2, 3: 5 },
  maxWinMultiple: 5000,
};

// ───────────────────────────── Compiled tables ─────────────────────────────

/** Weight table kinds, used as `kind * RINGS + ring`. */
export const KIND_INIT = 0;
export const KIND_REFILL = 1;
export const KIND_FREE_INIT = 2;
export const KIND_FREE_REFILL = 3;

/** TRI value for "the first three cells do not match". */
export const NO_LINE = 255;

export interface CompiledModel {
  params: ModelParams;
  /** All pick tables back to back: PICK[OFF[k] + i] for i in 0..TOTAL[k]-1 is a symbol id. */
  PICK: Uint8Array;
  OFF: Int32Array;
  TOTAL: Int32Array;
  /** TOTAL[k] / 2^32, so `u32 * SCALE[k] | 0` is the same integer as Rng.int(TOTAL[k]). */
  SCALE: Float64Array;
  /** Comet chance per COMET_DEN, same indexing as OFF (refill kinds are 0). */
  COMET: Int32Array;
  /**
   * First three cells of a spoke → line symbol. Index a | b << 4 | c << 8.
   * 0..7 = that symbol, 8 = wilds only, NO_LINE = no match.
   */
  TRI: Uint8Array;
  /** Line symbol and the fourth cell → pay in tenths. Index t | d << 4. */
  PAYT: Int32Array;
  /** Same index → 3 or 4. */
  CNT: Uint8Array;
  /** Same index → paying symbol id as reported on a LineWin (SYM.WILD for wild-only lines). */
  LINESYM: Uint8Array;
  LADDER: Int32Array;
  ladderLast: number;
  threshold: number;
  /** Cap in tenths of the bet. */
  capTenths: number;
  /** Free spins awarded by comet count 0..4, base game. */
  AWARD_BASE: Int32Array;
  /** Extra spins by comet count 0..4, Kometnat. */
  AWARD_FREE: Int32Array;
}

function assertWeights(rows: number[][], label: string): void {
  if (rows.length !== RINGS) throw new Error(`${label}: expected ${RINGS} rings`);
  for (const row of rows) {
    if (row.length !== WEIGHT_SYMBOLS) throw new Error(`${label}: expected ${WEIGHT_SYMBOLS} weights per ring`);
    let total = 0;
    for (const w of row) {
      if (!Number.isInteger(w) || w < 0) throw new Error(`${label}: weights must be non-negative integers`);
      total += w;
    }
    if (total <= 0 || total > 1 << 20) throw new Error(`${label}: bad weight total ${total}`);
  }
}

export function validateParams(p: ModelParams): void {
  assertWeights(p.initWeights, 'initWeights');
  assertWeights(p.refillWeights, 'refillWeights');
  assertWeights(p.freeInitWeights, 'freeInitWeights');
  assertWeights(p.freeRefillWeights, 'freeRefillWeights');
  if (p.cometChance.length !== RINGS || p.freeCometChance.length !== RINGS) throw new Error('comet chances: one per ring');
  for (const c of [...p.cometChance, ...p.freeCometChance]) {
    if (!Number.isInteger(c) || c < 0 || c > COMET_DEN) throw new Error('comet chance out of range');
  }
  if (p.freeCometChance[0] !== 0) throw new Error('ring 0 carries no comet during Kometnat');
  if (p.pay3.length !== 8 || p.pay4.length !== 8) throw new Error('paytable: eight paying symbols');
  for (let i = 0; i < 8; i++) {
    if (!Number.isInteger(p.pay3[i]) || !Number.isInteger(p.pay4[i]) || p.pay3[i] <= 0) throw new Error('pays are whole tenths');
    if (p.pay4[i] <= p.pay3[i]) throw new Error('four of a kind must pay more than three');
    if (i > 0 && (p.pay3[i] < p.pay3[i - 1] || p.pay4[i] < p.pay4[i - 1])) throw new Error('paytable must rise with symbol rank');
  }
  if (p.ladder.length === 0 || p.ladder[0] !== 1) throw new Error('ladder starts at x1');
  for (let i = 1; i < p.ladder.length; i++) {
    if (!Number.isInteger(p.ladder[i]) || p.ladder[i] <= p.ladder[i - 1]) throw new Error('ladder must rise');
  }
  if (!Number.isInteger(p.novaThreshold) || p.novaThreshold < 1) throw new Error('bad Nova threshold');
}

export function compileModel(p: ModelParams = PARAMS): CompiledModel {
  validateParams(p);
  const kinds = [p.initWeights, p.refillWeights, p.freeInitWeights, p.freeRefillWeights];
  const n = kinds.length * RINGS;
  const OFF = new Int32Array(n);
  const TOTAL = new Int32Array(n);
  const SCALE = new Float64Array(n);
  const COMET = new Int32Array(n);
  let size = 0;
  for (let k = 0; k < kinds.length; k++) {
    for (let r = 0; r < RINGS; r++) {
      let total = 0;
      for (const w of kinds[k][r]) total += w;
      OFF[k * RINGS + r] = size;
      TOTAL[k * RINGS + r] = total;
      SCALE[k * RINGS + r] = total / 4294967296;
      size += total;
    }
  }
  const PICK = new Uint8Array(size);
  for (let k = 0; k < kinds.length; k++) {
    for (let r = 0; r < RINGS; r++) {
      let at = OFF[k * RINGS + r];
      const row = kinds[k][r];
      for (let sym = 0; sym < WEIGHT_SYMBOLS; sym++) {
        for (let i = 0; i < row[sym]; i++) PICK[at++] = sym;
      }
    }
  }
  for (let r = 0; r < RINGS; r++) {
    COMET[KIND_INIT * RINGS + r] = p.cometChance[r];
    COMET[KIND_FREE_INIT * RINGS + r] = p.freeCometChance[r];
  }

  const WILD = SYM.WILD;
  const SCATTER = SYM.SCATTER;
  const TRI = new Uint8Array(4096).fill(NO_LINE);
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      for (let c = 0; c <= 9; c++) {
        if (a === SCATTER || b === SCATTER || c === SCATTER) continue;
        const first = a !== WILD ? a : b !== WILD ? b : c;
        const ok = (a === WILD || a === first) && (b === WILD || b === first) && (c === WILD || c === first);
        if (ok) TRI[a | (b << 4) | (c << 8)] = first;
      }
    }
  }
  const PAYT = new Int32Array(256);
  const CNT = new Uint8Array(256);
  const LINESYM = new Uint8Array(256);
  for (let t = 0; t <= 8; t++) {
    for (let d = 0; d <= 9; d++) {
      const i = t | (d << 4);
      if (t < 8) {
        const four = d === t || d === WILD;
        PAYT[i] = four ? p.pay4[t] : p.pay3[t];
        CNT[i] = four ? 4 : 3;
        LINESYM[i] = t;
      } else if (d === SCATTER) {
        PAYT[i] = p.pay3[SYM.SUN];
        CNT[i] = 3;
        LINESYM[i] = WILD;
      } else if (d === WILD) {
        PAYT[i] = p.pay4[SYM.SUN];
        CNT[i] = 4;
        LINESYM[i] = WILD;
      } else {
        // Three wilds and a symbol: the line's symbol is the first non-wild one, on ring 3.
        PAYT[i] = p.pay4[d];
        CNT[i] = 4;
        LINESYM[i] = d;
      }
    }
  }

  return {
    params: p,
    PICK,
    OFF,
    TOTAL,
    SCALE,
    COMET,
    TRI,
    PAYT,
    CNT,
    LINESYM,
    LADDER: Int32Array.from(p.ladder),
    ladderLast: p.ladder.length - 1,
    threshold: p.novaThreshold,
    capTenths: p.maxWinMultiple * 10,
    AWARD_BASE: Int32Array.from([0, 0, 0, p.freeSpinsAward[3], p.freeSpinsAward[4]]),
    AWARD_FREE: Int32Array.from([0, 0, p.retriggerAward[2], p.retriggerAward[3], p.retriggerAward[3]]),
  };
}

export function paytableOf(p: ModelParams): PaytableEntry[] {
  const rows: PaytableEntry[] = [];
  for (let i = 0; i < 8; i++) rows.push({ symbol: i as SymbolId, pay3: p.pay3[i] / 10, pay4: p.pay4[i] / 10 });
  return rows;
}

/**
 * Measured figures from the confirmation run (see docs/PAR.md): 100 million
 * paid spins per policy, seeds 20261110 and 20261111. Regenerate with
 * `npm run sim -- --spins=100000000 --seed=20261110 --workers=2 --par` and
 * paste the block the CLI prints.
 */
export const STATS: ModelStats = {
  rtp: 0.95927,
  rtpNoNudge: 0.23716,
  hitFrequency: 0.4709,
  hitFrequencyAtLeastBet: 0.1627,
  stdDev: 5.92,
  freeSpinsEvery: 159.1,
  novaEvery: 74.9,
  breakdown: { base: 0.10904, nudge: 0.46864, nova: 0.13589, freeSpins: 0.2457 },
  sampleSize: 100000000,
  maxObservedMultiple: 2053.8,
};

export function modelInfoOf(p: ModelParams, stats: ModelStats): ModelInfo {
  return {
    name: p.name,
    version: p.version,
    paytable: paytableOf(p),
    ladder: [...p.ladder],
    freeSpinsAward: { 3: p.freeSpinsAward[3], 4: p.freeSpinsAward[4] },
    retriggerAward: { 2: p.retriggerAward[2], 3: p.retriggerAward[3] },
    maxWinMultiple: p.maxWinMultiple,
    novaThreshold: p.novaThreshold,
    stats,
  };
}

export const MODEL: ModelInfo = modelInfoOf(PARAMS, STATS);
