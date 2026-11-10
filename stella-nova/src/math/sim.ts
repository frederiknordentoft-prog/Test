/**
 * Monte Carlo simulator over the same rules as the engine (via kernel.ts).
 *
 *   simulate()         one blocking run, for Node and tests
 *   createSimulator()  the same run in time-sliced chunks, for the browser's maths lab
 *
 * A "spin" here is a paid spin together with every free spin it leads to, so
 * the return, the hit frequency and the variance are all per paid spin.
 */
import { entropySeed } from '../core/rng.ts';
import type { SimProgress, Simulator } from '../core/types.ts';
import {
  ACC_BASE_SPIN_HITS,
  ACC_BURST,
  ACC_CAPPED,
  ACC_CHAIN_BASE,
  ACC_CHAIN_FREE,
  ACC_FREE_SPINS,
  ACC_FREE_SPIN_HITS,
  ACC_INITIAL_HITS,
  ACC_LADDER_BASE,
  ACC_LADDER_FREE,
  ACC_LINE_COUNT,
  ACC_LINE_WIN,
  ACC_NOVA_BASE,
  ACC_NOVA_FREE,
  ACC_OFFER_BASE,
  ACC_OFFER_FREE,
  ACC_RETRIG2,
  ACC_RETRIG3,
  ACC_SIZE,
  ACC_TRIG3,
  ACC_TRIG4,
  ACC_WIN_BASE,
  ACC_WIN_FREE,
  ACC_WIN_NOVA,
  ACC_WIN_NUDGE,
  createKernel,
} from './kernel.ts';
import type { Kernel } from './kernel.ts';
import { compileModel, PARAMS } from './model.ts';
import type { ModelParams } from './model.ts';

export type SimPolicy = 'greedy' | 'none';

export interface SimOptions {
  spins: number;
  seed: number;
  /** 'greedy' takes the best nudge every time it is offered, 'none' always passes. */
  policy: SimPolicy;
  /** øre. Only scales the money figures: the maths does not depend on the bet. */
  bet?: number;
  /** Defaults to the shipped model. Used by calibration and tests. */
  model?: ModelParams;
}

/**
 * Win buckets by multiple of the bet: bucket i holds wins x with
 * BUCKET_EDGES[i - 1] <= x < BUCKET_EDGES[i]; bucket 0 is "no win".
 * Edges are in tenths of the bet.
 */
export const BUCKET_EDGES_TENTHS = [1, 5, 10, 20, 50, 100, 250, 600, 1000, 2500, 10000, 50000] as const;
export const BUCKET_LABELS = [
  '0',
  '0,1–0,5×',
  '0,5–1×',
  '1–2×',
  '2–5×',
  '5–10×',
  '10–25×',
  '25–60×',
  '60–100×',
  '100–250×',
  '250–1.000×',
  '1.000–5.000×',
  '≥ 5.000×',
] as const;
export const BUCKETS = BUCKET_LABELS.length;

/** Raw sums of one run. Two runs with different seeds merge by adding them up. */
export interface SimTotals {
  policy: SimPolicy;
  spins: number;
  /** Sum of the per-spin win, in tenths of the bet. */
  sumWin: number;
  /** Sum of the squared per-spin win, in tenths squared. */
  sumWinSq: number;
  /** Largest per-paid-spin win seen (free spins included), tenths. */
  maxWin: number;
  hits: number;
  hitsAtLeastBet: number;
  bucketCount: number[];
  bucketWin: number[];
  /** kernel.acc, see the ACC_* indices. */
  acc: number[];
  /** Largest single Kometnat round, tenths. */
  maxFreeRound: number;
  /** Sum of squared Kometnat round wins, tenths squared. */
  sumFreeRoundSq: number;
  seeds: number[];
  elapsedMs: number;
}

export interface SimBucket {
  label: string;
  count: number;
  /** Share of paid spins. */
  share: number;
  /** Part of the RTP paid out in this bucket. */
  rtp: number;
}

export interface SimLineStat {
  /** 0..7 paying symbol, 8 = wild-only line. */
  symbol: number;
  count: 3 | 4;
  hits: number;
  /** One in N paid spins. */
  every: number;
  /** Part of the RTP won on these lines (multiplier included). */
  rtp: number;
}

export interface SimResult {
  policy: SimPolicy;
  spins: number;
  seeds: number[];
  bet: number;
  /** øre */
  totalBet: number;
  totalWin: number;
  rtp: number;
  /** Contribution to the RTP by source. Sums to rtp. */
  breakdown: { base: number; nudge: number; nova: number; freeSpins: number };
  /** Share of paid spins that return anything, free spins included. */
  hitFrequency: number;
  hitFrequencyAtLeastBet: number;
  /** Share of paid spins that pay on their own board (their free spins not counted). */
  baseHitFrequency: number;
  /** Share of paid spins whose first evaluation already pays, before any nudge or Nova. */
  initialHitFrequency: number;
  /** Per-spin variance and standard deviation, in bets. */
  variance: number;
  stdDev: number;
  /** Standard error of the RTP estimate and its 95 % interval. */
  standardError: number;
  ci95: [number, number];
  maxMultiple: number;
  cappedSpins: number;
  freeSpins: {
    triggers: number;
    triggers3: number;
    triggers4: number;
    /** One in N paid spins. */
    every: number;
    retriggers2: number;
    retriggers3: number;
    spinsPlayed: number;
    avgSpinsPerRound: number;
    /** Mean and standard deviation of a round's win, in bets. */
    avgRoundMultiple: number;
    roundStdDev: number;
    maxRoundMultiple: number;
    /** Share of free spins that pay. */
    hitFrequency: number;
    /** Mean win of one free spin, in bets. */
    avgSpinMultiple: number;
    novas: number;
  };
  nova: {
    /** Novas fired in paid (base) spins. */
    count: number;
    every: number;
    /** Novas fired during Kometnat. */
    inFreeSpins: number;
    /** One in N paid spins, counting both. */
    everyAll: number;
    /** Mean win from the Nova onward in the spin, in bets (base game). */
    avgMultiple: number;
  };
  nudge: {
    /** Paid spins in which a winning move existed. */
    offered: number;
    offeredShare: number;
    offeredInFreeSpins: number;
    offeredShareOfFreeSpins: number;
  };
  /** Paid spins by number of winning evaluations 0..7+. */
  chainBase: number[];
  chainFree: number[];
  /** Winning evaluations by ladder index 0..7+. */
  ladderBase: number[];
  ladderFree: number[];
  lines: SimLineStat[];
  avgBurstPerSpin: number;
  buckets: SimBucket[];
  elapsedMs: number;
  spinsPerSecond: number;
  totals: SimTotals;
}

function emptyTotals(policy: SimPolicy): SimTotals {
  return {
    policy,
    spins: 0,
    sumWin: 0,
    sumWinSq: 0,
    maxWin: 0,
    hits: 0,
    hitsAtLeastBet: 0,
    bucketCount: new Array<number>(BUCKETS).fill(0),
    bucketWin: new Array<number>(BUCKETS).fill(0),
    acc: new Array<number>(ACC_SIZE).fill(0),
    maxFreeRound: 0,
    sumFreeRoundSq: 0,
    seeds: [],
    elapsedMs: 0,
  };
}

export function mergeTotals(parts: SimTotals[]): SimTotals {
  if (parts.length === 0) throw new Error('nothing to merge');
  const t = emptyTotals(parts[0].policy);
  for (const p of parts) {
    if (p.policy !== t.policy) throw new Error('cannot merge runs with different policies');
    t.spins += p.spins;
    t.sumWin += p.sumWin;
    t.sumWinSq += p.sumWinSq;
    t.maxWin = Math.max(t.maxWin, p.maxWin);
    t.hits += p.hits;
    t.hitsAtLeastBet += p.hitsAtLeastBet;
    for (let i = 0; i < BUCKETS; i++) {
      t.bucketCount[i] += p.bucketCount[i];
      t.bucketWin[i] += p.bucketWin[i];
    }
    for (let i = 0; i < ACC_SIZE; i++) t.acc[i] += p.acc[i];
    t.maxFreeRound = Math.max(t.maxFreeRound, p.maxFreeRound);
    t.sumFreeRoundSq += p.sumFreeRoundSq;
    t.seeds.push(...p.seeds);
    // Parts run side by side, so the wall time is the longest one.
    t.elapsedMs = Math.max(t.elapsedMs, p.elapsedMs);
  }
  return t;
}

/** Wins below 100 bets (1000 tenths) find their bucket by table. */
const SMALL = 1000;
const SMALL_BUCKET = new Uint8Array(SMALL);
for (let w = 0; w < SMALL; w++) {
  let b = 0;
  while (b < BUCKET_EDGES_TENTHS.length && w >= BUCKET_EDGES_TENTHS[b]) b++;
  SMALL_BUCKET[w] = b;
}

function bucketOf(win: number): number {
  if (win < SMALL) return SMALL_BUCKET[win];
  let b = SMALL_BUCKET[SMALL - 1];
  while (b < BUCKET_EDGES_TENTHS.length && win >= BUCKET_EDGES_TENTHS[b]) b++;
  return b;
}

/** A run that can be advanced in pieces. simulate() and the browser simulator both drive it. */
export interface SimRun {
  readonly kernel: Kernel;
  readonly done: number;
  /** Play `count` more paid spins. */
  step(count: number): void;
  totals(): SimTotals;
}

export function createRun(opts: { seed: number; policy: SimPolicy; model?: ModelParams }): SimRun {
  const kernel = createKernel(compileModel(opts.model ?? PARAMS));
  kernel.seed(opts.seed);
  const greedy = opts.policy === 'greedy';
  const acc = kernel.acc;
  const bucketCount = new Float64Array(BUCKETS);
  const bucketWin = new Float64Array(BUCKETS);
  let spins = 0;
  let sumWin = 0;
  let sumWinSq = 0;
  let maxWin = 0;
  let hits = 0;
  let hitsAtLeastBet = 0;
  let maxFreeRound = 0;
  let sumFreeRoundSq = 0;

  function step(count: number): void {
    for (let i = 0; i < count; i++) {
      const freeBefore = acc[ACC_WIN_FREE];
      const w = kernel.playRound(greedy);
      if (w === 0) {
        bucketCount[0]++;
        continue;
      }
      sumWin += w;
      sumWinSq += w * w;
      hits++;
      if (w >= 10) hitsAtLeastBet++;
      if (w > maxWin) maxWin = w;
      const b = w < SMALL ? SMALL_BUCKET[w] : bucketOf(w);
      bucketCount[b]++;
      bucketWin[b] += w;
      const freeWin = acc[ACC_WIN_FREE] - freeBefore;
      if (freeWin > 0) {
        sumFreeRoundSq += freeWin * freeWin;
        if (freeWin > maxFreeRound) maxFreeRound = freeWin;
      }
    }
    spins += count;
  }

  return {
    kernel,
    get done() {
      return spins;
    },
    step,
    totals(): SimTotals {
      return {
        policy: opts.policy,
        spins,
        sumWin,
        sumWinSq,
        maxWin,
        hits,
        hitsAtLeastBet,
        bucketCount: Array.from(bucketCount),
        bucketWin: Array.from(bucketWin),
        acc: Array.from(acc),
        maxFreeRound,
        sumFreeRoundSq,
        seeds: [opts.seed >>> 0],
        elapsedMs: 0,
      };
    },
  };
}

const ratio = (a: number, b: number): number => (b > 0 ? a / b : 0);

export function finalize(t: SimTotals, bet = 100): SimResult {
  const n = t.spins;
  const a = t.acc;
  // Tenths of a bet per spin → bets per spin.
  const perBet = (tenths: number): number => ratio(tenths, n) / 10;
  const rtp = perBet(t.sumWin);
  const meanSq = ratio(t.sumWinSq, n) / 100;
  const variance = Math.max(0, meanSq - rtp * rtp);
  const stdDev = Math.sqrt(variance);
  const standardError = n > 0 ? stdDev / Math.sqrt(n) : 0;

  const triggers = a[ACC_TRIG3] + a[ACC_TRIG4];
  const freeMean = ratio(a[ACC_WIN_FREE], triggers) / 10;
  const freeMeanSq = ratio(t.sumFreeRoundSq, triggers) / 100;

  const lines: SimLineStat[] = [];
  for (let c = 0; c < 2; c++) {
    for (let sym = 0; sym < 9; sym++) {
      const hits = a[ACC_LINE_COUNT + c * 9 + sym];
      lines.push({
        symbol: sym,
        count: c === 0 ? 3 : 4,
        hits,
        every: ratio(n, hits),
        rtp: perBet(a[ACC_LINE_WIN + c * 9 + sym]),
      });
    }
  }

  const buckets: SimBucket[] = [];
  for (let i = 0; i < BUCKETS; i++) {
    buckets.push({
      label: BUCKET_LABELS[i],
      count: t.bucketCount[i],
      share: ratio(t.bucketCount[i], n),
      rtp: perBet(t.bucketWin[i]),
    });
  }

  const slice = (from: number): number[] => a.slice(from, from + 8);

  return {
    policy: t.policy,
    spins: n,
    seeds: [...t.seeds],
    bet,
    totalBet: n * bet,
    totalWin: Math.round((t.sumWin * bet) / 10),
    rtp,
    breakdown: {
      base: perBet(a[ACC_WIN_BASE]),
      nudge: perBet(a[ACC_WIN_NUDGE]),
      nova: perBet(a[ACC_WIN_NOVA]),
      freeSpins: perBet(a[ACC_WIN_FREE]),
    },
    hitFrequency: ratio(t.hits, n),
    hitFrequencyAtLeastBet: ratio(t.hitsAtLeastBet, n),
    baseHitFrequency: ratio(a[ACC_BASE_SPIN_HITS], n),
    initialHitFrequency: ratio(a[ACC_INITIAL_HITS], n),
    variance,
    stdDev,
    standardError,
    ci95: [rtp - 1.96 * standardError, rtp + 1.96 * standardError],
    maxMultiple: t.maxWin / 10,
    cappedSpins: a[ACC_CAPPED],
    freeSpins: {
      triggers,
      triggers3: a[ACC_TRIG3],
      triggers4: a[ACC_TRIG4],
      every: ratio(n, triggers),
      retriggers2: a[ACC_RETRIG2],
      retriggers3: a[ACC_RETRIG3],
      spinsPlayed: a[ACC_FREE_SPINS],
      avgSpinsPerRound: ratio(a[ACC_FREE_SPINS], triggers),
      avgRoundMultiple: freeMean,
      roundStdDev: Math.sqrt(Math.max(0, freeMeanSq - freeMean * freeMean)),
      maxRoundMultiple: t.maxFreeRound / 10,
      hitFrequency: ratio(a[ACC_FREE_SPIN_HITS], a[ACC_FREE_SPINS]),
      avgSpinMultiple: ratio(a[ACC_WIN_FREE], a[ACC_FREE_SPINS]) / 10,
      novas: a[ACC_NOVA_FREE],
    },
    nova: {
      count: a[ACC_NOVA_BASE],
      every: ratio(n, a[ACC_NOVA_BASE]),
      inFreeSpins: a[ACC_NOVA_FREE],
      everyAll: ratio(n, a[ACC_NOVA_BASE] + a[ACC_NOVA_FREE]),
      avgMultiple: ratio(a[ACC_WIN_NOVA], a[ACC_NOVA_BASE]) / 10,
    },
    nudge: {
      offered: a[ACC_OFFER_BASE],
      offeredShare: ratio(a[ACC_OFFER_BASE], n),
      offeredInFreeSpins: a[ACC_OFFER_FREE],
      offeredShareOfFreeSpins: ratio(a[ACC_OFFER_FREE], a[ACC_FREE_SPINS]),
    },
    chainBase: slice(ACC_CHAIN_BASE),
    chainFree: slice(ACC_CHAIN_FREE),
    ladderBase: slice(ACC_LADDER_BASE),
    ladderFree: slice(ACC_LADDER_FREE),
    lines,
    avgBurstPerSpin: ratio(a[ACC_BURST], n),
    buckets,
    elapsedMs: t.elapsedMs,
    spinsPerSecond: t.elapsedMs > 0 ? (n / t.elapsedMs) * 1000 : 0,
    totals: t,
  };
}

const now = (): number => globalThis.performance.now();

export function simulateTotals(opts: SimOptions): SimTotals {
  const spins = Math.max(0, Math.floor(opts.spins));
  const run = createRun(opts);
  const t0 = now();
  run.step(spins);
  const totals = run.totals();
  totals.elapsedMs = now() - t0;
  return totals;
}

export function simulate(opts: SimOptions): SimResult {
  return finalize(simulateTotals(opts), opts.bet ?? 100);
}

/** Milliseconds of simulation per slice before the browser gets the thread back. */
const SLICE_MS = 8;
/** Spins between looks at the clock. */
const SLICE_BATCH = 1024;
const REPORT_MS = 60;

/**
 * The maths lab's simulator: greedy policy, about 8 ms of work at a time, then
 * a yield. This is the one timer in the outcome code, and it never touches a result.
 */
export function createSimulator(opts: { seed?: number; model?: ModelParams } = {}): Simulator {
  return (spins: number, onProgress: (p: SimProgress) => void) => {
    const target = Math.max(0, Math.floor(spins));
    const run = createRun({ seed: opts.seed ?? entropySeed(), policy: 'greedy', model: opts.model });
    const acc = run.kernel.acc;
    let cancelled = false;
    let lastReport = -Infinity;

    const report = (done: boolean): void => {
      const t = run.totals();
      onProgress({
        spins: t.spins,
        target,
        rtp: t.spins > 0 ? t.sumWin / t.spins / 10 : 0,
        hitFrequency: t.spins > 0 ? t.hits / t.spins : 0,
        freeSpinsTriggers: acc[ACC_TRIG3] + acc[ACC_TRIG4],
        novaTriggers: acc[ACC_NOVA_BASE] + acc[ACC_NOVA_FREE],
        maxMultiple: t.maxWin / 10,
        done,
      });
    };

    const slice = (): void => {
      if (cancelled) return;
      const start = now();
      while (run.done < target && now() - start < SLICE_MS) {
        run.step(Math.min(SLICE_BATCH, target - run.done));
      }
      if (run.done >= target) {
        report(true);
        return;
      }
      if (start - lastReport >= REPORT_MS) {
        lastReport = start;
        report(false);
      }
      setTimeout(slice, 0);
    };

    setTimeout(slice, 0);
    return {
      cancel(): void {
        cancelled = true;
      },
    };
  };
}
