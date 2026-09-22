// ============================================================
// NORDLYS · simulator kernels (run inside worker_threads; also callable directly).
// Every kernel uses the SAME engine code paths as the game (src/math) with recording disabled.
// Replayable conventions:
//   base / perk spin i of a job  = spinRng(seed, 'base' | 'perk', from + i)      (one rng per spin)
//   storm i of a job             = ONE rng spinRng(seed, 'storm', from + i) for createStorm + all spins
//                                  (exactly how Game.ts plays and replays a storm)
// ============================================================
import { OUT, PAIR_SINK, compileModel, simBaseSpin, type Model } from '../src/math/engine.ts';
import { STORM_OUT, simStorm } from '../src/math/storm.ts';
import { Xoshiro128ss } from '../src/math/rng.ts';
import type { MathConfig } from '../src/math/config.ts';
import { TIERS } from '../src/game/tiers.ts';
import { HIST_BINS, histBin } from './stats.ts';

export const TIER_MAX_SPINS = 12000;

export type Strategy = 'const' | 'lowHigh' | 'highLow' | 'random' | 'perkHunt' | 'perkSnipe' | 'quitEarly';

export type Job =
  | { kind: 'hit'; cfg: MathConfig; seed: number; from: number; count: number }
  | { kind: 'wacc'; cfg: MathConfig; seed: number; from: number; count: number }
  | { kind: 'record'; cfg: MathConfig; seed: number; from: number; count: number; stake: number; perk: boolean }
  | { kind: 'stormW'; cfg: MathConfig; seed: number; from: number; count: number; stake: number }
  | { kind: 'base'; cfg: MathConfig; seed: number; from: number; count: number; stake: number; perkSeed: number; perkFrom: number }
  | { kind: 'storm'; cfg: MathConfig; seed: number; from: number; count: number; stake: number }
  | { kind: 'e2e'; cfg: MathConfig; seed: number; from: number; count: number; stake: number; perkSeed: number; perkFrom: number; stormSeed: number; stormFrom: number }
  | { kind: 'adv'; cfg: MathConfig; seed: number; from: number; count: number; strategy: Strategy; ES: number; baseRtp: number; perkEV: number; pB: number; perkSeed: number; perkFrom: number };

// ------------------------------------------------------------------------------------------------
/** Hit rate only (tuner step 1: wild weight). Hit = any paying cluster or exactly 3 suns. */
export function jobHit(j: Extract<Job, { kind: 'hit' }>) {
  const model = compileModel(j.cfg);
  const rng = new Xoshiro128ss();
  let hits = 0, sun3 = 0, sun4 = 0, winSteps = 0;
  for (let i = 0; i < j.count; i++) {
    rng.seedSpin(j.seed, 'base', j.from + i);
    simBaseSpin(model, rng, 100, false);
    if (OUT.winSteps > 0 || OUT.sunCount === 3) hits++;
    if (OUT.sunCount === 3) sun3++;
    else if (OUT.sunCount >= 4) sun4++;
    winSteps += OUT.winSteps;
  }
  return { n: j.count, hits, sun3, sun4, winSteps };
}

// ------------------------------------------------------------------------------------------------
/**
 * Linear pricing weights: acc[sym·8+bucket] = Σ mult over all paying clusters (cluster RTP of any table
 * = Σ pt·acc / n), plus the charge moments and the sun histogram. No per-spin memory.
 */
export function jobWacc(j: Extract<Job, { kind: 'wacc' }>) {
  const model = compileModel(j.cfg);
  const rng = new Xoshiro128ss();
  PAIR_SINK.acc = new Float64Array(56);
  PAIR_SINK.on = 2;
  let sumC = 0, sumC2 = 0;
  const sun = new Float64Array(9);
  for (let i = 0; i < j.count; i++) {
    rng.seedSpin(j.seed, 'base', j.from + i);
    simBaseSpin(model, rng, 100, false);
    const c = OUT.charge;
    sumC += c;
    sumC2 += c * c;
    sun[Math.min(8, OUT.sunCount)]++;
  }
  PAIR_SINK.on = 0;
  const acc = PAIR_SINK.acc;
  PAIR_SINK.acc = new Float64Array(56);
  return { n: j.count, acc, sumC, sumC2, sun };
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
  PAIR_SINK.on = 1;
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
  PAIR_SINK.on = 0;
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
    rng.seedSpin(j.seed, 'storm', j.from + i);
    simStorm(model, rng, j.stake);
    w[i] = STORM_OUT.winOre / j.stake;
    spins += STORM_OUT.spins;
    if (STORM_OUT.retriggers > 0) retr++;
  }
  return { n: j.count, w, spins, retr };
}

// ------------------------------------------------------------------------------------------------
/** Meter bookkeeping shared by the base / e2e / adversary kernels (same arithmetic as src/math/meter.ts). */
export class MeterSim {
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
  /** Charge still missing to the next perk tier (Infinity if none left in this cycle). */
  toNextPerk(): number {
    for (let t = 1; t <= 9; t++) if (this.perkTier[t] && this.charge < this.th[t]) return this.th[t] - this.charge;
    return Infinity;
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
  sumXP: number; sumXP2: number;            // per paid spin: base + its perk spins (× stake)
  hits: number; net: number; eq: number; ldw: number; capped: number; sun3: number; sun4: number;
  hist: Float64Array;
  sumC: number; sumC2: number;
  cyclesA: number; cycleSpins: number; cycleSpins2: number; overshoot: number; cycleCharge: number;
  stormA: number; stormB: number; stormAB: number; stormBperk: number; stormBpaid: number;
  perkSpins: number; perkSumX: number; perkSumX2: number; perkCharge: number; perkHits: number;
  tierHist: Float64Array;   // [t-1][spins] paid spins from cycle start until Kp t is reached
  tiersBy150: Float64Array; // [#tiers reached after 150 paid spins]
  maxX: number;
}

export function newBaseStats(stake: number): BaseStats {
  return {
    n: 0, stake, sumX: 0, sumX2: 0, sumCluster: 0, sumSun: 0, sumXP: 0, sumXP2: 0,
    hits: 0, net: 0, eq: 0, ldw: 0, capped: 0, sun3: 0, sun4: 0,
    hist: new Float64Array(HIST_BINS),
    sumC: 0, sumC2: 0,
    cyclesA: 0, cycleSpins: 0, cycleSpins2: 0, overshoot: 0, cycleCharge: 0,
    stormA: 0, stormB: 0, stormAB: 0, stormBperk: 0, stormBpaid: 0,
    perkSpins: 0, perkSumX: 0, perkSumX2: 0, perkCharge: 0, perkHits: 0,
    tierHist: new Float64Array(9 * TIER_MAX_SPINS), tiersBy150: new Float64Array(10), maxX: 0,
  };
}

/**
 * Decomposition kernel: paid base spins at a constant stake with a persistent meter and inline perk
 * spins (locked stake); storms are only COUNTED here (their value E[S] comes from the storm kernel).
 */
export function jobBase(j: Extract<Job, { kind: 'base' }>): BaseStats {
  const model = compileModel(j.cfg);
  const rng = new Xoshiro128ss();
  const st = newBaseStats(j.stake);
  const stake = j.stake;
  const meter = new MeterSim(j.cfg);
  const K = j.cfg.K;
  let perkIdx = j.perkFrom, cycleStart = 0, tiersReached = 0;
  const onCharge = (c: number, spinStake: number, stormB: boolean, fromPerk: boolean, spinNo: number): void => {
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
    if (meter.charge >= K) {
      if (stormB) st.stormAB++;
      st.stormA++;
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
    }
    if (stormB) {
      st.stormB++;
      if (fromPerk) st.stormBperk++;
      else st.stormBpaid++;
    }
  };
  for (let i = 0; i < j.count; i++) {
    rng.seedSpin(j.seed, 'base', j.from + i);
    simBaseSpin(model, rng, stake, false);
    const T = OUT.totalOre, x = T / stake;
    st.n++;
    st.sumX += x;
    st.sumX2 += x * x;
    if (x > st.maxX) st.maxX = x;
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
    let xp = x;
    onCharge(c, stake, OUT.stormB, false, i + 1);
    while (meter.perkQueue > 0) {
      meter.perkQueue--;
      const ls = meter.locked();
      rng.seedSpin(j.perkSeed, 'perk', perkIdx++);
      simBaseSpin(model, rng, ls, true);
      const px = OUT.totalOre / stake;
      xp += px;
      st.perkSpins++;
      st.perkSumX += px;
      st.perkSumX2 += px * px;
      st.perkCharge += OUT.charge;
      if (OUT.totalOre > 0) st.perkHits++;
      onCharge(OUT.charge, ls, OUT.stormB, true, i + 1);
    }
    st.sumXP += xp;
    st.sumXP2 += xp * xp;
    if (i + 1 - cycleStart === 150) st.tiersBy150[Math.min(9, tiersReached)]++;
  }
  return st;
}

// ------------------------------------------------------------------------------------------------
export interface StormStats {
  n: number; stake: number;
  sumW: number; sumW2: number; sumG: number; sumS2: number; guarUsed: number; capped: number;
  spins: number; spins2: number; retr: number;
  w: Float64Array;          // every storm's W (× stake, before guarantee) — exact quantiles
  maxMarkHist: Float64Array; // index = log2(maxMark) 0..7
  spinsHist: Float64Array;   // index = storm spins played 0..20
}

/** Fresh storms with the tuned config (guarantee and cap applied exactly as in the game). */
export function jobStorm(j: Extract<Job, { kind: 'storm' }>): StormStats {
  const model = compileModel(j.cfg);
  const rng = new Xoshiro128ss();
  const st: StormStats = {
    n: 0, stake: j.stake, sumW: 0, sumW2: 0, sumG: 0, sumS2: 0, guarUsed: 0, capped: 0, spins: 0, spins2: 0, retr: 0,
    w: new Float64Array(j.count), maxMarkHist: new Float64Array(8), spinsHist: new Float64Array(21),
  };
  const G = j.cfg.guaranteeX;
  for (let i = 0; i < j.count; i++) {
    rng.seedSpin(j.seed, 'storm', j.from + i);
    simStorm(model, rng, j.stake);
    const w = STORM_OUT.winOre / j.stake;
    const gOre = STORM_OUT.winOre < G * j.stake ? G * j.stake - STORM_OUT.winOre : 0;
    const g = gOre / j.stake;
    st.w[i] = w;
    st.n++;
    st.sumW += w;
    st.sumW2 += w * w;
    st.sumG += g;
    st.sumS2 += (w + g) * (w + g);
    if (g > 0) st.guarUsed++;
    if (STORM_OUT.capped) st.capped++;
    st.spins += STORM_OUT.spins;
    st.spins2 += STORM_OUT.spins * STORM_OUT.spins;
    st.spinsHist[Math.min(20, STORM_OUT.spins)]++;
    if (STORM_OUT.retriggers > 0) st.retr++;
    st.maxMarkHist[Math.max(0, Math.min(7, Math.round(Math.log2(Math.max(1, STORM_OUT.maxMark)))))]++;
  }
  return st;
}

// ------------------------------------------------------------------------------------------------
export interface E2EStats {
  n: number; stake: number;
  sumX: number; sumX2: number; hist: Float64Array;   // per paid spin incl. its perks and storms
  storms: number; stormsA: number; stormsB: number;
  // regenerative (route-A) cycles: W = Σ return (× stake), N = paid spins
  cycles: number; cW: number; cN: number; cW2: number; cN2: number; cWN: number;
  tailW: number; tailN: number; // the unfinished last cycle (not used in the ratio estimator)
}

/** End-to-end player: everything inline (perks, route A/B storms with guarantee), constant stake. */
export function jobE2E(j: Extract<Job, { kind: 'e2e' }>): E2EStats {
  const model = compileModel(j.cfg);
  const rng = new Xoshiro128ss();
  const stake = j.stake, K = j.cfg.K, G = j.cfg.guaranteeX;
  const meter = new MeterSim(j.cfg);
  const st: E2EStats = { n: 0, stake, sumX: 0, sumX2: 0, hist: new Float64Array(HIST_BINS), storms: 0, stormsA: 0, stormsB: 0, cycles: 0, cW: 0, cN: 0, cW2: 0, cN2: 0, cWN: 0, tailW: 0, tailN: 0 };
  let perkIdx = j.perkFrom, stormIdx = j.stormFrom;
  let curW = 0, curN = 0; // current cycle
  let spinRet = 0;
  let cycleEnded = false;
  const playStormAt = (stakeOre: number): number => {
    rng.seedSpin(j.stormSeed, 'storm', stormIdx++);
    simStorm(model, rng, stakeOre);
    st.storms++;
    const w = STORM_OUT.winOre;
    return w < G * stakeOre ? G * stakeOre : w;
  };
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
      rng.seedSpin(j.perkSeed, 'perk', perkIdx++);
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
  st.tailW = curW;
  st.tailN = curN;
  return st;
}

// ------------------------------------------------------------------------------------------------
/**
 * Stake-switch adversary. Two estimators on the same spins:
 *   raw — actual base/perk pays + storms credited at E[S]·stormStake;
 *   ev  — every paid spin credited E[base + route B | stake] = (baseRtp + pB·E[S])·stake, every perk spin
 *         (perkEV + pB·E[S])·lockedStake, every route-A storm E[S]·lockedStake. Unbiased (the stake of spin i
 *         is fixed by the past; its pays and suns are independent of the past — tower property) and far less
 *         noisy: only the meter path (when stakes switch, when perks/Kp 9 land, at what locked stake) is random.
 * Returns totals in øre.
 */
export function jobAdv(j: Extract<Job, { kind: 'adv' }>) {
  const model = compileModel(j.cfg);
  const rng = new Xoshiro128ss();
  const cfg = j.cfg, K = cfg.K, ES = j.ES;
  const minS = cfg.stakesOre[0], maxS = cfg.stakesOre[cfg.stakesOre.length - 1], defS = cfg.defaultStakeOre;
  const evSpin = j.baseRtp + j.pB * ES, evPerk = j.perkEV + j.pB * ES;
  const meter = new MeterSim(cfg);
  let perkIdx = j.perkFrom;
  let staked = 0, raw = 0, ev = 0, stormsA = 0, stormsB = 0, perks = 0, perkOreRaw = 0, perkEvOre = 0, stormAEvOre = 0;
  const after = (c: number, spinStake: number, stormB: boolean): void => {
    meter.add(c, spinStake);
    if (meter.charge >= K) {
      const sStake = stormB ? spinStake : meter.locked();
      meter.reset();
      meter.perkQueue = 0;
      stormsA++;
      raw += ES * sStake;
      ev += ES * sStake;
      stormAEvOre += ES * sStake;
    } else if (stormB) {
      stormsB++;
      raw += ES * spinStake;
    }
  };
  let seg = 0;
  const snipe = (3 * cfg.K) / 2200; // ≈ 3 spins of average charge (c̄ ≈ K / 2200)
  for (let i = 0; i < j.count; i++) {
    let stake = defS;
    switch (j.strategy) {
      case 'const': stake = defS; break;
      case 'lowHigh': stake = meter.kp() >= 8 ? maxS : minS; break; // cheap charge, then a big locked storm?
      case 'highLow': stake = meter.kp() >= 8 ? minS : maxS; break;
      case 'random': stake = cfg.stakesOre[(Math.imul(i + 1, 0x9e3779b1) >>> 0) % cfg.stakesOre.length]; break;
      case 'perkHunt': {
        const kp = meter.kp(), f = kp - Math.floor(kp), nt = Math.floor(kp) + 1;
        stake = (nt === 3 || nt === 5 || nt === 7) && f > 0.9 ? maxS : minS;
        break;
      }
      case 'perkSnipe': stake = meter.toNextPerk() <= snipe ? maxS : minS; break; // max stake only right before a perk tier
      case 'quitEarly': {
        // sessions of 300 spins at default stake that abandon the meter (no saved progress)
        if (i % 300 === 0) { meter.reset(); meter.perkQueue = 0; seg++; }
        stake = defS;
        break;
      }
    }
    rng.seedSpin(j.seed, 'base', j.from + i);
    simBaseSpin(model, rng, stake, false);
    staked += stake;
    raw += OUT.totalOre;
    ev += evSpin * stake;
    after(OUT.charge, stake, OUT.stormB);
    while (meter.perkQueue > 0) {
      meter.perkQueue--;
      const ls = meter.locked();
      rng.seedSpin(j.perkSeed, 'perk', perkIdx++);
      simBaseSpin(model, rng, ls, true);
      perks++;
      raw += OUT.totalOre;
      perkOreRaw += OUT.totalOre;
      ev += evPerk * ls;
      perkEvOre += evPerk * ls;
      after(OUT.charge, ls, OUT.stormB);
    }
  }
  return { n: j.count, staked, raw, ev, stormsA, stormsB, perks, perkOreRaw, perkEvOre, stormAEvOre, segments: seg };
}

export function runJob(j: Job): unknown {
  switch (j.kind) {
    case 'hit': return jobHit(j);
    case 'wacc': return jobWacc(j);
    case 'record': return jobRecord(j);
    case 'stormW': return jobStormW(j);
    case 'base': return jobBase(j);
    case 'storm': return jobStorm(j);
    case 'e2e': return jobE2E(j);
    case 'adv': return jobAdv(j);
  }
}

export type { Model };
