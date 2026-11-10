/**
 * The allocation-free spin kernel: the rules of GDD section 3 on typed arrays.
 *
 * The simulator runs on it, and the engine uses it to search for demo-rig
 * outcomes. It draws from an sfc32 stream that is bit-identical to core/rng.ts
 * and in exactly the order the engine draws, so the same seed gives the same
 * spins in both (src/math/sim.test.ts holds them to that).
 *
 * Wins are counted in tenths of the bet, which keeps every sum an integer.
 */
import { SYM } from '../core/config.ts';
import { COMET_DEN, KIND_FREE_INIT, KIND_FREE_REFILL, KIND_INIT, KIND_REFILL, NO_LINE } from './model.ts';
import type { CompiledModel } from './model.ts';

// Result of the last playSpin, in Kernel.out.
export const OUT_WIN = 0;
export const OUT_COMETS = 1;
/** Free spins awarded by this spin's comets. */
export const OUT_AWARD = 2;
/** 1 when a winning nudge existed at the dead point (the engine would emit awaitNudge). */
export const OUT_OFFERED = 3;
export const OUT_NOVA = 4;
/** Winning evaluations in a row from the stop, before any Nova or nudge. */
export const OUT_INITIAL_CHAIN = 5;
/** Winning evaluations in the whole spin. */
export const OUT_EVALS = 6;
export const OUT_CAPPED = 7;
export const OUT_SIZE = 8;

// Running totals, in Kernel.acc.
export const ACC_WIN_BASE = 0;
export const ACC_WIN_NUDGE = 1;
export const ACC_WIN_NOVA = 2;
export const ACC_WIN_FREE = 3;
export const ACC_NOVA_BASE = 4;
export const ACC_NOVA_FREE = 5;
export const ACC_OFFER_BASE = 6;
export const ACC_OFFER_FREE = 7;
export const ACC_TRIG3 = 8;
export const ACC_TRIG4 = 9;
export const ACC_RETRIG2 = 10;
export const ACC_RETRIG3 = 11;
export const ACC_FREE_SPINS = 12;
export const ACC_CAPPED = 13;
/** Base spins that paid anything on their own (free spins not counted). */
export const ACC_BASE_SPIN_HITS = 14;
export const ACC_FREE_SPIN_HITS = 15;
export const ACC_BURST = 16;
/** Base spins whose very first evaluation paid. */
export const ACC_INITIAL_HITS = 17;
/** Spins by number of winning evaluations 0..7+ (8 slots each). */
export const ACC_CHAIN_BASE = 24;
export const ACC_CHAIN_FREE = 32;
/** Winning evaluations by ladder index 0..7+ (8 slots each). */
export const ACC_LADDER_BASE = 40;
export const ACC_LADDER_FREE = 48;
/** Lines by (count - 3) * 9 + line symbol 0..8 (18 slots each): how many, and tenths won after the multiplier. */
export const ACC_LINE_COUNT = 56;
export const ACC_LINE_WIN = 74;
export const ACC_SIZE = 92;

const SRC_BASE = ACC_WIN_BASE;
const SRC_NUDGE = ACC_WIN_NUDGE;
const SRC_NOVA = ACC_WIN_NOVA;

export interface Kernel {
  /** sfc32 state a, b, c, d. */
  readonly rng: Int32Array;
  /** 32 cells, ring * 8 + spoke. */
  readonly grid: Uint8Array;
  readonly out: Int32Array;
  readonly acc: Float64Array;
  /** Same expansion as `new Rng(seed)`. */
  seed(seed: number): void;
  getCharge(): number;
  setCharge(v: number): void;
  /** One spin. Returns the win in tenths of the bet; details in `out`. */
  playSpin(free: boolean, greedy: boolean): number;
  /** One paid spin and every free spin it leads to. Returns the round's win in tenths of the bet. */
  playRound(greedy: boolean): number;
}

export function createKernel(cm: CompiledModel): Kernel {
  const S = new Int32Array(4);
  const g = new Uint8Array(32);
  const out = new Int32Array(OUT_SIZE);
  const acc = new Float64Array(ACC_SIZE);
  const winSpoke = new Uint8Array(8);
  const winKey = new Uint8Array(8);
  let nWins = 0;
  let charge = 0;

  const PICK = cm.PICK;
  const OFF = cm.OFF;
  const SCALE = cm.SCALE;
  const COMET = cm.COMET;
  const TRI = cm.TRI;
  const PAYT = cm.PAYT;
  const CNT = cm.CNT;
  const LINESYM = cm.LINESYM;
  const LADDER = cm.LADDER;
  const LADDER_LAST = cm.ladderLast;
  const THRESHOLD = cm.threshold;
  const CAP = cm.capTenths;
  const AWARD_BASE = cm.AWARD_BASE;
  const AWARD_FREE = cm.AWARD_FREE;
  const COMET_SCALE = COMET_DEN / 4294967296;
  const WILD = SYM.WILD;
  const SCATTER = SYM.SCATTER;

  // sfc32 on int32 lanes: the same bits as Rng.u32().
  function u32(): number {
    const b = S[1];
    const c = S[2];
    const d = S[3];
    const t = (S[0] + b + d) | 0;
    S[3] = d + 1;
    S[0] = b ^ (b >>> 9);
    S[1] = c + (c << 3);
    S[2] = ((c << 21) | (c >>> 11)) + t;
    return t >>> 0;
  }

  function seed(value: number): void {
    let s = value >>> 0;
    for (let i = 0; i < 4; i++) {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      S[i] = (z ^ (z >>> 16)) >>> 0;
    }
    for (let i = 0; i < 15; i++) u32();
  }

  /** Eight weighted symbols, then the ring's one possible comet. Returns the comet count (0 or 1). */
  function fillRing(k: number, base: number): number {
    const off = OFF[k];
    const scale = SCALE[k];
    for (let s = 0; s < 8; s++) g[base + s] = PICK[off + ((u32() * scale) | 0)];
    if (((u32() * COMET_SCALE) | 0) < COMET[k]) {
      g[base + (u32() >>> 29)] = SCATTER;
      return 1;
    }
    return 0;
  }

  /** Sum of the line pays (tenths) on the board as it stands; the lines go to winSpoke / winKey. */
  function evaluate(): number {
    let n = 0;
    let sum = 0;
    for (let s = 0; s < 8; s++) {
      const t = TRI[g[s] | (g[8 + s] << 4) | (g[16 + s] << 8)];
      if (t !== NO_LINE) {
        const k = t | (g[24 + s] << 4);
        sum += PAYT[k];
        winSpoke[n] = s;
        winKey[n] = k;
        n++;
      }
    }
    nWins = n;
    return sum;
  }

  /** What the board would pay with rings 0..2 rotated by o0..o2 notches. */
  function optionPay(o0: number, o1: number, o2: number): number {
    let sum = 0;
    for (let s = 0; s < 8; s++) {
      const t = TRI[g[(s - o0) & 7] | (g[8 + ((s - o1) & 7)] << 4) | (g[16 + ((s - o2) & 7)] << 8)];
      if (t !== NO_LINE) sum += PAYT[t | (g[24 + s] << 4)];
    }
    return sum;
  }

  /** +1 notch moves the symbol at spoke s to spoke s + 1. */
  function rotate(base: number, dir: number): void {
    if (dir > 0) {
      const t = g[base + 7];
      g[base + 7] = g[base + 6];
      g[base + 6] = g[base + 5];
      g[base + 5] = g[base + 4];
      g[base + 4] = g[base + 3];
      g[base + 3] = g[base + 2];
      g[base + 2] = g[base + 1];
      g[base + 1] = g[base];
      g[base] = t;
    } else {
      const t = g[base];
      g[base] = g[base + 1];
      g[base + 1] = g[base + 2];
      g[base + 2] = g[base + 3];
      g[base + 3] = g[base + 4];
      g[base + 4] = g[base + 5];
      g[base + 5] = g[base + 6];
      g[base + 6] = g[base + 7];
      g[base + 7] = t;
    }
  }

  function playSpin(free: boolean, greedy: boolean): number {
    let comets = 0;
    if (free) {
      for (let s = 0; s < 8; s++) g[s] = WILD;
      comets += fillRing(KIND_FREE_INIT * 4 + 1, 8);
      comets += fillRing(KIND_FREE_INIT * 4 + 2, 16);
      comets += fillRing(KIND_FREE_INIT * 4 + 3, 24);
    } else {
      comets += fillRing(KIND_INIT * 4, 0);
      comets += fillRing(KIND_INIT * 4 + 1, 8);
      comets += fillRing(KIND_INIT * 4 + 2, 16);
      comets += fillRing(KIND_INIT * 4 + 3, 24);
    }
    const refillKind = (free ? KIND_FREE_REFILL : KIND_REFILL) * 4;
    const firstBurstRing = free ? 1 : 0;

    let ladder = 0;
    let total = 0;
    let evals = 0;
    let initialChain = 0;
    let novaUsed = false;
    let nudgeUsed = false;
    let offered = 0;
    let capped = 0;
    let source = SRC_BASE;
    let beforeDeadPoint = true;

    for (;;) {
      const pay = evaluate();
      if (pay > 0) {
        const li = ladder < LADDER_LAST ? ladder : LADDER_LAST;
        const mult = LADDER[li];
        let step = pay * mult;
        if (total + step >= CAP) {
          step = CAP - total;
          capped = 1;
        }
        total += step;
        if (!free) acc[source] += step;
        acc[(free ? ACC_LADDER_FREE : ACC_LADDER_BASE) + (ladder < 7 ? ladder : 7)]++;
        evals++;
        if (beforeDeadPoint) initialChain++;

        // Burst and refill in line order: spokes ascending, ring 0 outward.
        let burst = 0;
        for (let i = 0; i < nWins; i++) {
          const s = winSpoke[i];
          const k = winKey[i];
          const cnt = CNT[k];
          const li2 = (cnt - 3) * 9 + (LINESYM[k] === WILD ? 8 : LINESYM[k]);
          acc[ACC_LINE_COUNT + li2]++;
          acc[ACC_LINE_WIN + li2] += PAYT[k] * mult;
          for (let r = firstBurstRing; r < cnt; r++) {
            const kk = refillKind + r;
            g[(r << 3) + s] = PICK[OFF[kk] + ((u32() * SCALE[kk]) | 0)];
            burst++;
          }
        }
        charge += burst;
        acc[ACC_BURST] += burst;

        rotate(0, 1);
        rotate(8, -1);
        rotate(16, 1);
        rotate(24, -1);
        ladder++;
        if (capped) break;
        continue;
      }

      beforeDeadPoint = false;
      if (charge >= THRESHOLD && !novaUsed) {
        for (let i = 0; i < 16; i++) if (g[i] !== SCATTER) g[i] = WILD;
        charge = 0;
        novaUsed = true;
        source = SRC_NOVA;
        acc[free ? ACC_NOVA_FREE : ACC_NOVA_BASE]++;
        continue;
      }
      if (nudgeUsed) break;
      nudgeUsed = true;

      // Greedy best: highest pay, ties to the lowest ring, then clockwise.
      // Ring 3 cannot make a dead board pay, and in Kometnat ring 0 is all wild.
      let best = 0;
      let bestRing = 0;
      let bestDir = 0;
      let p = 0;
      if (!free) {
        p = optionPay(1, 0, 0);
        if (p > best) { best = p; bestRing = 0; bestDir = 1; }
        p = optionPay(-1, 0, 0);
        if (p > best) { best = p; bestRing = 0; bestDir = -1; }
      }
      p = optionPay(0, 1, 0);
      if (p > best) { best = p; bestRing = 1; bestDir = 1; }
      p = optionPay(0, -1, 0);
      if (p > best) { best = p; bestRing = 1; bestDir = -1; }
      p = optionPay(0, 0, 1);
      if (p > best) { best = p; bestRing = 2; bestDir = 1; }
      p = optionPay(0, 0, -1);
      if (p > best) { best = p; bestRing = 2; bestDir = -1; }
      if (best === 0) break;
      offered = 1;
      acc[free ? ACC_OFFER_FREE : ACC_OFFER_BASE]++;
      if (!greedy) break;
      rotate(bestRing << 3, bestDir);
      source = SRC_NUDGE;
    }

    let award = 0;
    if (free) {
      acc[ACC_WIN_FREE] += total;
      acc[ACC_FREE_SPINS]++;
      if (total > 0) acc[ACC_FREE_SPIN_HITS]++;
      acc[ACC_CHAIN_FREE + (evals < 7 ? evals : 7)]++;
      award = AWARD_FREE[comets];
      if (comets === 2) acc[ACC_RETRIG2]++;
      else if (comets >= 3) acc[ACC_RETRIG3]++;
    } else {
      if (total > 0) acc[ACC_BASE_SPIN_HITS]++;
      if (initialChain > 0) acc[ACC_INITIAL_HITS]++;
      acc[ACC_CHAIN_BASE + (evals < 7 ? evals : 7)]++;
      award = AWARD_BASE[comets];
      if (comets === 3) acc[ACC_TRIG3]++;
      else if (comets === 4) acc[ACC_TRIG4]++;
    }
    if (capped) acc[ACC_CAPPED]++;

    out[OUT_WIN] = total;
    out[OUT_COMETS] = comets;
    out[OUT_AWARD] = award;
    out[OUT_OFFERED] = offered;
    out[OUT_NOVA] = novaUsed ? 1 : 0;
    out[OUT_INITIAL_CHAIN] = initialChain;
    out[OUT_EVALS] = evals;
    out[OUT_CAPPED] = capped;
    return total;
  }

  function playRound(greedy: boolean): number {
    let total = playSpin(false, greedy);
    let remaining = out[OUT_AWARD];
    while (remaining > 0) {
      remaining--;
      total += playSpin(true, greedy);
      remaining += out[OUT_AWARD];
    }
    return total;
  }

  return {
    rng: S,
    grid: g,
    out,
    acc,
    seed,
    getCharge: () => charge,
    setCharge: (v: number) => {
      charge = v;
    },
    playSpin,
    playRound,
  };
}
