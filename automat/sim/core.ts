// ============================================================
// NORDLYS · simulator kernels (run inside worker_threads; also callable directly).
// Every kernel uses the SAME engine code paths as the game (src/math) with recording disabled.
// Sim convention (replayable): spin i of a job = spinRng(seed, domain, from + i).
// ============================================================
import { OUT, PAIR_SINK, compileModel, simBaseSpin, type Model } from '../src/math/engine.ts';
import { STORM_OUT, simStorm } from '../src/math/storm.ts';
import { Xoshiro128ss } from '../src/math/rng.ts';
import type { MathConfig } from '../src/math/config.ts';
import { TIERS } from '../src/game/tiers.ts';
import { HIST_BINS, histBin } from './stats.ts';

export const STORM_IDX_BLOCK = 21; // 1 (createStorm) + maxStormSpins
export const TIER_MAX_SPINS = 12000;

export type Job =
  | { kind: 'hit'; cfg: MathConfig; seed: number; from: number; count: number }
  | { kind: 'record'; cfg: MathConfig; seed: number; from: number; count: number; stake: number; perk: boolean }
  | { kind: 'stormW'; cfg: MathConfig; seed: number; from: number; count: number; stake: number }
  | { kind: 'base'; cfg: MathConfig; seed: number; from: number; count: number; stake: number; perkFrom: number }
  | { kind: 'storm'; cfg: MathConfig; seed: number; from: number; count: number; stake: number }
  | { kind: 'e2e'; cfg: MathConfig; seed: number; from: number; count: number; stake: number; perkFrom: number; stormFrom: number }
  | { kind: 'adv'; cfg: MathConfig; seed: number; from: number; count: number; strategy: Strategy; ES: number; perkFrom: number };

export type Strategy = 'const' | 'lowHigh' | 'highLow' | 'random' | 'perkHunt' | 'quitEarly';

// ------------------------------------------------------------------------------------------------
export function jobHit(j: Extract<Job, { kind: 'hit' }>) {
  const model = compileModel(j.cfg);
  const rng = new Xoshiro128ss();
  let hits = 0, sun3 = 0, sun4 = 0, clusters = 0;
  for (let i = 0; i < j.count; i++) {
    rng.seedSpin(j.seed, 'base', j.from + i);
    simBaseSpin(model, rng, 100, false);
    if (OUT.winSteps > 0 || OUT.sunCount === 3) hits++;
    if (OUT.sunCount === 3) sun3++;
    else if (OUT.sunCount >= 4) sun4++;
    clusters += OUT.winSteps;
  }
  return { n: j.count, hits, sun3, sun4, clusters };
}

// ------------------------------------------------------------------------------------------------
/** Records every spin's (sym·8+bucket, mult) pairs so any paytable can be priced exactly later. */
export function jobRecord(j: Extract<Job, { kind: 'record' }>) {
  const model = compileModel(j.cfg);
  const rng = new Xoshiro128ss();
  let cap = Math.max(1024, Math.ceil(j.count * 1.2));
  PAIR_SINK.sb = new Uint8Array(cap);
  PAIR_SINK.mult = new Uint16Array(cap);
  PAIR_SINK.n = 0;
  PAIR_SINK.on = true;
  const off = new Int32Array(j.count + 1);
  const sun = new Uint8Array(j.count);
  const charge = new Uint16Array(j.count);
  const domain = j.perk ? 'perk' : 'base';
  for (let i = 0; i < j.count; i++) {
    if (PAIR_SINK.n > cap - 4096) {
      const ncap = cap * 2;
      const sb = new Uint8Array(ncap); sb.set(PAIR_SINK.sb);
      const mu = new Uint16Array(ncap); mu.set(PAIR_SINK.mult);
      PAIR_SINK.sb = sb; PAIR_SINK.mult = mu; cap = ncap;
    }
    off[i] = PAIR_SINK.n;
    rng.seedSpin(j.seed, domain, j.from + i);
    simBaseSpin(model, rng, j.stake, j.perk);
    sun[i] = OUT.sunCount;
    charge[i] = Math.min(65535, OUT.charge);
  }
  off[j.count] = PAIR_SINK.n;
  PAIR_SINK.on = false;
  const n = PAIR_SINK.n;
  const sb = PAIR_SINK.sb.slice(0, n), mult = PAIR_SINK.mult.slice(0, n);
  PAIR_SINK.sb = new Uint8Array(0);
  PAIR_SINK.mult = new Uint16Array(0);
  return { n: j.count, off, sun, charge, sb, mult };
}

// ------------------------------------------------------------------------------------------------
/** Storm totals (× stake) — run with the cfg as given (the tuner passes stormPayScale = 1, no cap). */
export function jobStormW(j: Extract<Job, { kind: 'stormW' }>) {
  const model = compileModel(j.cfg);
  const rng = new Xoshiro128ss();
  const w = new Float64Array(j.count);
  let spins = 0, retr = 0;
  for (let i = 0; i < j.count; i++) {
    simStorm(model, rng, j.seed, 'storm', (j.from + i) * STORM_IDX_BLOCK, j.stake);
    w[i] = STORM_OUT.winOre / j.stake;
    spins += STORM_OUT.spins;
    if (STORM_OUT.retriggers > 0) retr++;
  }
  return { n: j.count, w, spins, retr };
}

// ------------------------------------------------------------------------------------------------
/** Meter bookkeeping shared by the base / e2e / adversary kernels (constant K from cfg). */
class MeterSim {
  charge = 0;
  stakeSum = 0;
  perkQueue = 0;
  readonly K: number;
  readonly th: Float64Array;
  readonly perkTier: Uint8Array;
  readonly defaultStake: number;
  constructor(cfg: MathConfig) {
    this.K = cfg.K;
    this.defaultStake = cfg.defaultStakeOre;
    this.th = new Float64Array(10);
    this.perkTier = new Uint8Array(10);
    for (let t = 1; t <= 9; t++) {
      this.th[t] = TIERS[t].frac * cfg.K;
      this.perkTier[t] = TIERS[t].perk ? 1 : 0;
    }
  }
  locked(): number {
    return this.charge > 0 ? Math.max(1, Math.floor(this.stakeSum / this.charge)) : this.defaultStake;
  }
  kp(): number {
    const f = this.charge / this.K;
    if (f >= 1) return 9;
    for (let i = 1; i < TIERS.length; i++) if (f < TIERS[i].frac) return i - 1 + (f - TIERS[i - 1].frac) / (TIERS[i].frac - TIERS[i - 1].frac);
    return 9;
  }
  /** Adds charge; returns bitmask of tiers crossed (bit t). Queues perks. */
  add(c: number, stake: number): number {
    const before = this.charge;
    this.charge += c;
    this.stakeSum += c * stake;
    let mask = 0;
    if (c > 0) {
      for (let t = 1; t <= 9; t++) {
        const th = this.th[t];
        if (before < th && this.charge >= th) {
          mask |= 1 << t;
          if (this.perkTier[t]) this.perkQueue++;
        }
      }
    }
    return mask;
  }
  reset(): void {
    this.charge = 0;
    this.stakeSum = 0;
  }
}

export interface BaseStats {
  n: number; stake: number;
  sumX: number; sumX2: number; sumCluster: number; sumSun: number;
  hits: number; net: number; eq: number; ldw: number; capped: number; sun3: number; sun4: number;
  hist: Float64Array;
  sumC: number; sumC2: number;
  cyclesA: number; cycleSpins: number; cycleSpins2: number; overshoot: number; cycleCharge: number;
  stormA: number; stormB: number; stormAB: number; stormBperk: number;
  perkSpins: number; perkSumX: number; perkSumX2: number; perkCharge: number; perkHits: number;
  tierHist: Float64Array;   // [t-1][spins] paid spins from cycle start until Kp t is reached
  tiersBy150: Float64Array; // [#tiers reached after 150 paid spins]
}

export function newBaseStats(stake: number): BaseStats {
  return {
    n: 0, stake, sumX: 0, sumX2: 0, sumCluster: 0, sumSun: 0,
    hits: 0, net: 0, eq: 0, ldw: 0, capped: 0, sun3: 0, sun4: 0,
    hist: new Float64Array(HIST_BINS),
    sumC: 0, sumC2: 0,
    cyclesA: 0, cycleSpins: 0, cycleSpins2: 0, overshoot: 0, cycleCharge: 0,
    stormA: 0, stormB: 0, stormAB: 0, stormBperk: 0,
    perkSpins: 0, perkSumX: 0, perkSumX2: 0, perkCharge: 0, perkHits: 0,
    tierHist: new Float64Array(9 * TIER_MAX_SPINS), tiersBy150: new Float64Array(10),
  };
}

/** Decomposition kernel: paid base spins with a persistent meter and perk spins; storms counted, not played. */
export function jobBase(j: Extract<Job, { kind: 'base' }>): BaseStats {
  const model = compileModel(j.cfg);
  const rng = new Xoshiro128ss();
  const st = newBaseStats(j.stake);
  const stake = j.stake;
  const meter = new MeterSim(j.cfg);
  const K = j.cfg.K;
  let perkIdx = j.perkFrom, cycleStart = 0, tiersReached = 0;
  const onCharge = (c: number, spinStake: number, stormB: boolean, fromPerk: boolean, spinNo: number): void => {
    const before = meter.charge;
    const mask = meter.add(c, spinStake);
    if (mask) {
      const since = spinNo - cycleStart;
      for (let t = 1; t <= 9; t++) {
        if (mask & (1 << t)) {
          tiersReached++;
          st.tierHist[(t - 1) * TIER_MAX_SPINS + Math.min(TIER_MAX_SPINS - 1, since)]++;
        }
      }
    }
    const a = meter.charge >= K;
    if (a) {
      if (stormB) st.stormAB++;
      else st.stormA++;
      st.overshoot += meter.charge - K;
      st.cycleCharge += meter.charge;
      meter.reset();
      meter.perkQueue = 0;
      st.cyclesA++;
      const len = spinNo - cycleStart;
      st.cycleSpins += len;
      st.cycleSpins2 += len * len;
      cycleStart = spinNo;
      tiersReached = 0;
    } else if (stormB) {
      st.stormB++;
      if (fromPerk) st.stormBperk++;
    }
    void before;
  };
  for (let i = 0; i < j.count; i++) {
    rng.seedSpin(j.seed, 'base', j.from + i);
    simBaseSpin(model, rng, stake, false);
    const T = OUT.totalOre, x = T / stake;
    st.n++;
    st.sumX += x;
    st.sumX2 += x * x;
    st.sumCluster += OUT.clusterWinOre / stake;
    st.sumSun += OUT.sunPayOre / stake;
    if (T > 0) {
      st.hits++;
      if (T > stake) st.net++;
      else if (T === stake) st.eq++;
      else st.ldw++;
    }
    if (OUT.capped) st.capped++;
    if (OUT.sunCount === 3) st.sun3++;
    else if (OUT.sunCount >= 4) st.sun4++;
    st.hist[histBin(x)]++;
    const c = OUT.charge;
    st.sumC += c;
    st.sumC2 += c * c;
    onCharge(c, stake, OUT.stormB, false, i + 1);
    while (meter.perkQueue > 0) {
      meter.perkQueue--;
      const ls = meter.locked();
      rng.seedSpin(j.seed, 'perk', perkIdx++);
      simBaseSpin(model, rng, ls, true);
      const px = OUT.totalOre / stake;
      st.perkSpins++;
      st.perkSumX += px;
      st.perkSumX2 += px * px;
      st.perkCharge += OUT.charge;
      if (OUT.totalOre > 0) st.perkHits++;
      onCharge(OUT.charge, ls, OUT.stormB, true, i + 1);
    }
    if (i + 1 - cycleStart === 150) st.tiersBy150[Math.min(9, tiersReached)]++;
  }
  return st;
}

// ------------------------------------------------------------------------------------------------
export interface StormStats {
  n: number; stake: number;
  sumW: number; sumW2: number; sumG: number; sumS2: number; guarUsed: number; capped: number;
  spins: number; retr: number;
  hist: Float64Array;       // W (before guarantee) × stake
  histS: Float64Array;      // W + guarantee
  maxMarkHist: Float64Array; // index = log2(maxMark) 0..7
}
export function newStormStats(stake: number): StormStats {
  return {
    n: 0, stake, sumW: 0, sumW2: 0, sumG: 0, sumS2: 0, guarUsed: 0, capped: 0, spins: 0, retr: 0,
    hist: new Float64Array(HIST_BINS), histS: new Float64Array(HIST_BINS), maxMarkHist: new Float64Array(8),
  };
}

export function jobStorm(j: Extract<Job, { kind: 'storm' }>): StormStats {
  const model = compileModel(j.cfg);
  const rng = new Xoshiro128ss();
  const st = newStormStats(j.stake);
  const G = j.cfg.guaranteeX;
  for (let i = 0; i < j.count; i++) {
    simStorm(model, rng, j.seed, 'storm', (j.from + i) * STORM_IDX_BLOCK, j.stake);
    const w = STORM_OUT.winOre / j.stake;
    const gOre = STORM_OUT.winOre < G * j.stake ? G * j.stake - STORM_OUT.winOre : 0;
    const g = gOre / j.stake;
    st.n++;
    st.sumW += w;
    st.sumW2 += w * w;
    st.sumG += g;
    st.sumS2 += (w + g) * (w + g);
    if (g > 0) st.guarUsed++;
    if (STORM_OUT.capped) st.capped++;
    st.spins += STORM_OUT.spins;
    if (STORM_OUT.retriggers > 0) st.retr++;
    st.hist[histBin(w)]++;
    st.histS[histBin(w + g)]++;
    st.maxMarkHist[Math.max(0, Math.min(7, Math.round(Math.log2(Math.max(1, STORM_OUT.maxMark)))))]++;
  }
  return st;
}

// ------------------------------------------------------------------------------------------------
export interface E2EStats {
  n: number; stake: number;
  sumX: number; sumX2: number; hist: Float64Array;   // per paid spin incl. its perks and storms
  storms: number; stormsA: number; stormsB: number;
  // regenerative (route-A) cycles
  cycles: number; cW: number; cN: number; cW2: number; cN2: number; cWN: number;
}

/** End-to-end player: everything inline (perks, route A/B storms with guarantee), constant stake. */
export function jobE2E(j: Extract<Job, { kind: 'e2e' }>): E2EStats {
  const model = compileModel(j.cfg);
  const rng = new Xoshiro128ss();
  const stake = j.stake, K = j.cfg.K, G = j.cfg.guaranteeX;
  const meter = new MeterSim(j.cfg);
  const st: E2EStats = { n: 0, stake, sumX: 0, sumX2: 0, hist: new Float64Array(HIST_BINS), storms: 0, stormsA: 0, stormsB: 0, cycles: 0, cW: 0, cN: 0, cW2: 0, cN2: 0, cWN: 0 };
  let perkIdx = j.perkFrom, stormIdx = j.stormFrom;
  let curW = 0, curN = 0; // current cycle
  let spinRet = 0;
  const playStormAt = (stakeOre: number): number => {
    simStorm(model, rng, j.seed, 'storm', stormIdx, stakeOre);
    stormIdx += STORM_IDX_BLOCK;
    st.storms++;
    const w = STORM_OUT.winOre;
    return w < G * stakeOre ? G * stakeOre : w;
  };
  let cycleEnded = false;
  const after = (c: number, spinStake: number, stormB: boolean): void => {
    meter.add(c, spinStake);
    const a = meter.charge >= K;
    if (a || stormB) {
      const sStake = stormB ? spinStake : meter.locked();
      if (a) {
        meter.reset();
        meter.perkQueue = 0;
        st.stormsA++;
        cycleEnded = true;
      } else st.stormsB++;
      spinRet += playStormAt(sStake);
    }
  };
  for (let i = 0; i < j.count; i++) {
    rng.seedSpin(j.seed, 'base', j.from + i);
    simBaseSpin(model, rng, stake, false);
    spinRet = OUT.totalOre;
    cycleEnded = false;
    after(OUT.charge, stake, OUT.stormB);
    while (meter.perkQueue > 0) {
      meter.perkQueue--;
      const ls = meter.locked();
      rng.seedSpin(j.seed, 'perk', perkIdx++);
      simBaseSpin(model, rng, ls, true);
      spinRet += OUT.totalOre;
      after(OUT.charge, ls, OUT.stormB);
    }
    const x = spinRet / stake;
    st.n++;
    st.sumX += x;
    st.sumX2 += x * x;
    st.hist[histBin(x)]++;
    curW += x;
    curN += 1;
    if (cycleEnded) {
      st.cycles++;
      st.cW += curW; st.cN += curN; st.cW2 += curW * curW; st.cN2 += curN * curN; st.cWN += curW * curN;
      curW = 0; curN = 0;
    }
  }
  return st;
}

// ------------------------------------------------------------------------------------------------
/** Stake-switch adversary: storms credited at E[S]·stake (variance reduction); returns totals in øre. */
export function jobAdv(j: Extract<Job, { kind: 'adv' }>) {
  const model = compileModel(j.cfg);
  const rng = new Xoshiro128ss();
  const cfg = j.cfg, K = cfg.K;
  const minS = cfg.stakesOre[0], maxS = cfg.stakesOre[cfg.stakesOre.length - 1], defS = cfg.defaultStakeOre;
  const meter = new MeterSim(cfg);
  let perkIdx = j.perkFrom;
  let staked = 0, returned = 0, stormEV = 0, storms = 0;
  let ret = 0;
  const after = (c: number, spinStake: number, stormB: boolean): void => {
    meter.add(c, spinStake);
    const a = meter.charge >= K;
    if (a || stormB) {
      const sStake = stormB ? spinStake : meter.locked();
      if (a) {
        meter.reset();
        meter.perkQueue = 0;
      }
      storms++;
      stormEV += j.ES * sStake;
    }
  };
  let seg = 0;
  for (let i = 0; i < j.count; i++) {
    const kp = meter.kp();
    let stake = defS;
    switch (j.strategy) {
      case 'const': stake = defS; break;
      case 'lowHigh': stake = kp >= 8 ? maxS : minS; break;
      case 'highLow': stake = kp >= 8 ? minS : maxS; break;
      case 'random': stake = cfg.stakesOre[(Math.imul(i + 1, 0x9e3779b1) >>> 0) % cfg.stakesOre.length]; break;
      case 'perkHunt': {
        const f = kp - Math.floor(kp);
        const nextPerk = Math.floor(kp) + 1 === 3 || Math.floor(kp) + 1 === 5 || Math.floor(kp) + 1 === 7;
        stake = nextPerk && f > 0.9 ? maxS : minS;
        break;
      }
      case 'quitEarly': {
        // plays sessions of 300 spins at default stake and abandons the meter (no saved progress)
        if (i % 300 === 0) { meter.reset(); meter.perkQueue = 0; seg++; }
        stake = defS;
        break;
      }
    }
    rng.seedSpin(j.seed, 'base', j.from + i);
    simBaseSpin(model, rng, stake, false);
    ret = OUT.totalOre;
    staked += stake;
    after(OUT.charge, stake, OUT.stormB);
    while (meter.perkQueue > 0) {
      meter.perkQueue--;
      const ls = meter.locked();
      rng.seedSpin(j.seed, 'perk', perkIdx++);
      simBaseSpin(model, rng, ls, true);
      ret += OUT.totalOre;
      after(OUT.charge, ls, OUT.stormB);
    }
    returned += ret;
  }
  return { n: j.count, staked, returned, stormEV, storms, segments: seg };
}

export function runJob(j: Job): unknown {
  switch (j.kind) {
    case 'hit': return jobHit(j);
    case 'record': return jobRecord(j);
    case 'stormW': return jobStormW(j);
    case 'base': return jobBase(j);
    case 'storm': return jobStorm(j);
    case 'e2e': return jobE2E(j);
    case 'adv': return jobAdv(j);
  }
}

export type { Model };
