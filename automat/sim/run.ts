// ============================================================
// NORDLYS · Monte Carlo verification on FRESH seeds (PLAN.md §5). Usage: node sim/run.ts [--quick]
//
// Decomposition estimator (per paid spin, constant stake, persistent meter):
//   RTP = E[base + perk spins] + (r_A + r_B − r_AB) · E[S]
//     E[base + perk]  paid spins with their inline "Ladet spin" perks          (kernel 'base')
//     r_A = 1/E[N]    renewal-reward: N = paid spins per route-A cycle          (kernel 'base', cycles)
//     r_B = P(4+ suns)·(1 + perks per paid spin) — P(4+ suns) exact (closed form on the u32 threshold)
//     r_AB            A and B on the same spin (counted)
//     E[S]            storm mean incl. the 30× guarantee, fresh storms          (kernel 'storm')
//   95 % CI by the delta method. End-to-end cross-check: a player with everything inline (kernel 'e2e'),
//   route-A regenerative cycles as i.i.d. batches; passes when |e2e − dec| ≤ 1.96·√(SE² + SE²).
//   Stake-switch adversaries (kernel 'adv', common random numbers across strategies).
// Writes sim/report.json, sim/REPORT.md and src/math/config.generated.ts (tuned CONFIG + this REPORT).
// ============================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONFIG, REPORT, type MathConfig, type MathReport } from '../src/math/config.ts';
import { minWinX, DEFAULT_MODEL } from '../src/math/engine.ts';
import { Pool } from './pool.ts';
import { SeedPlan } from './seeds.ts';
import { tuneRanges, tuneSeed, pAtLeast, pExactly, pSunEff } from './tune.ts';
import { TIER_MAX_SPINS, type BaseStats, type E2EStats, type StormStats, type Strategy } from './core.ts';
import { HIST_BINS, addInto, histQuantile, intHistMean, intHistQuantile } from './stats.ts';
import { modelHashOf, writeGenerated } from './gen.ts';
import { writeReportMd, buildGates, type Gate } from './report.ts';

const QUICK = process.argv.includes('--quick');
const N = QUICK
  ? { base: 3_000_000, storm: 60_000, e2e: 2_000_000, adv: 600_000, stakeStorms: 10_000, chunks: 8 }
  : { base: 120_000_000, storm: 1_000_000, e2e: 40_000_000, adv: 4_000_000, stakeStorms: 100_000, chunks: 48 };
const STAKE = CONFIG.defaultStakeOre; // 200 øre (2 kr)
const STRATEGIES: Strategy[] = ['const', 'lowHigh', 'highLow', 'random', 'perkHunt', 'perkSnipe', 'quitEarly'];

function log(...a: unknown[]) {
  console.log('[run]', ...a);
}
const z = 1.959964;


async function main() {
  const t0 = Date.now();
  const el = () => ((Date.now() - t0) / 1000).toFixed(0) + ' s';
  const cfg: MathConfig = CONFIG;
  if (cfg.modelHash !== modelHashOf(cfg)) throw new Error('config.generated.ts modelHash does not match its config — re-run node sim/tune.ts');
  const tunePath = fileURLToPath(new URL('./out/tune.json', import.meta.url));
  const tune = existsSync(tunePath) ? JSON.parse(readFileSync(tunePath, 'utf8')) : null;
  if (!tune || tune.cfg.modelHash !== cfg.modelHash) log('WARNING: sim/out/tune.json does not belong to this config (variants/tuning notes may be stale)');

  // ---------------- fresh seeds, disjoint from the tuner's samples and from each other ----------------
  const plan = new SeedPlan(tuneRanges(tuneSeed()));
  const perkPerChunk = (n: number) => Math.ceil(n * 0.004) + 2000;
  const stormPerChunk = (n: number) => Math.ceil(n * 0.004) + 2000;
  const baseChunk = Math.ceil(N.base / N.chunks);
  const e2eChunk = Math.ceil(N.e2e / N.chunks);
  const advChunks = 8;
  const advChunk = Math.ceil(N.adv / advChunks);
  const S = {
    base: plan.alloc('decomposition', 0x4e4c5230, [{ domain: 'base', n: N.base }, { domain: 'perk', n: N.chunks * perkPerChunk(baseChunk) }]),
    storm: plan.alloc('storms', 0x4e4c5330, [{ domain: 'storm', n: N.storm + N.stakeStorms }]),
    e2e: plan.alloc('e2e', 0x4e4c4530, [{ domain: 'base', n: N.e2e }, { domain: 'perk', n: N.chunks * perkPerChunk(e2eChunk) }, { domain: 'storm', n: N.chunks * stormPerChunk(e2eChunk) }]),
    adv: plan.alloc('adversary', 0x4e4c4130, [{ domain: 'base', n: N.adv }, { domain: 'perk', n: advChunks * perkPerChunk(advChunk) }]),
  };
  const pool = new Pool();
  log(`workers=${pool.size} quick=${QUICK} model ${cfg.modelHash.slice(0, 12)} seeds ${Object.entries(S).map(([k, v]) => `${k}=0x${v.toString(16)}`).join(' ')}`);

  // ---------------- storms first (E[S] feeds the adversary) ----------------
  const stormParts = await pool.map<StormStats>(N.storm, N.chunks, (from, count) => ({ kind: 'storm', cfg, seed: S.storm, from, count, stake: STAKE }));
  const ss = mergeStorm(stormParts);
  const ES = (ss.sumW + ss.sumG) / ss.n;
  const sdS = Math.sqrt(ss.sumS2 / ss.n - ES * ES);
  const seES = sdS / Math.sqrt(ss.n);
  log(`storms ${ss.n}: E[S] ${ES.toFixed(3)} ± ${(z * seES).toFixed(3)} (W ${(ss.sumW / ss.n).toFixed(3)} + G ${(ss.sumG / ss.n).toFixed(3)}), sd ${sdS.toFixed(1)} (${el()})`);

  // stake dependence of storm pays (per-cluster øre rounding with a non-round stormPayScale): CRN storms
  const stakeCheck: { stakeOre: number; meanW: number }[] = [];
  for (const st of [cfg.stakesOre[0], STAKE, cfg.stakesOre[cfg.stakesOre.length - 1]]) {
    // the same storms (idx N.storm …) at every stake → the difference is pure øre rounding
    const parts = await pool.map<StormStats>(N.stakeStorms, 4, (from, count) => ({ kind: 'storm', cfg, seed: S.storm, from: N.storm + from, count, stake: st }));
    const m = mergeStorm(parts);
    stakeCheck.push({ stakeOre: st, meanW: m.sumW / m.n });
  }
  log(`storm W by stake (CRN, ${N.stakeStorms} storms): ${stakeCheck.map((s) => `${s.stakeOre} øre → ${s.meanW.toFixed(4)}×`).join(', ')}`);

  // ---------------- decomposition: paid base spins + perks + counted storms ----------------
  const baseParts = await pool.map<BaseStats>(N.base, N.chunks, (from, count, k) => ({ kind: 'base', cfg, seed: S.base, from, count, stake: STAKE, perkSeed: S.base, perkFrom: k * perkPerChunk(baseChunk) }));
  for (const p of baseParts) if (p.perkSpins > perkPerChunk(baseChunk)) throw new Error('perk idx range overflow');
  const bs = mergeBase(baseParts);
  const n = bs.n;
  const base = bs.sumX / n;
  const sdBase = Math.sqrt(bs.sumX2 / n - base * base);
  const BP = bs.sumXP / n;
  const sdBP = Math.sqrt(bs.sumXP2 / n - BP * BP);
  const seBP = sdBP / Math.sqrt(n);
  const perkRtp = bs.perkSumX / n;
  const perkRate = bs.perkSpins / n;
  const EN = bs.cycleSpins / bs.cyclesA;
  const sdN = Math.sqrt(bs.cycleSpins2 / bs.cyclesA - EN * EN);
  const seEN = sdN / Math.sqrt(bs.cyclesA);
  const rA = 1 / EN;
  const seRA = seEN / (EN * EN);
  const pSun = pSunEff(cfg.pSun);
  const pB = pAtLeast(pSun, cfg.cols, 4);
  const p3 = pExactly(pSun, cfg.cols, 3);
  const rBall = pB * (1 + perkRate);
  const rAB = bs.stormAB / n;
  const stormRate = rA + rBall - rAB;
  const rtp = BP + stormRate * ES;
  const seRtp = Math.sqrt(seBP ** 2 + (ES * seRA) ** 2 + (stormRate * seES) ** 2);
  const rtpMin = base + pB * ES;
  const seMin = Math.sqrt((sdBase / Math.sqrt(n)) ** 2 + (pB * seES) ** 2);
  log(`base ${n} spins (${el()}): base ${pct(base)} (sd ${sdBase.toFixed(3)}), perk ${pct(perkRtp)}, E[N] ${EN.toFixed(1)} ± ${(z * seEN).toFixed(1)} (${bs.cyclesA} cycles), r_AB ${rAB.toExponential(2)}`);
  log(`RTP ${pct(rtp, 3)} ± ${pct(z * seRtp, 3)}  min ${pct(rtpMin, 3)}  meter ${pct(rtp - rtpMin, 3)}  storm 1:${(1 / stormRate).toFixed(0)}`);

  // ---------------- stake-switch adversaries (CRN, expected-value crediting) ----------------
  const perkEV = bs.perkSumX / Math.max(1, bs.perkSpins);
  const adv: { strategy: Strategy; rtp: number; se: number; edge: number; vsConst: number; rawRtp: number; stormsA: number; perks: number; stakedKr: number; perkShare: number; stormAShare: number }[] = [];
  for (const strategy of STRATEGIES) {
    const parts = await pool.map<{ n: number; staked: number; raw: number; ev: number; stormsA: number; perks: number; perkEvOre: number; stormAEvOre: number }>(N.adv, advChunks, (from, count, k) => ({ kind: 'adv', cfg, seed: S.adv, from, count, strategy, ES, baseRtp: base, perkEV, pB, perkSeed: S.adv, perkFrom: k * perkPerChunk(advChunk) }));
    let staked = 0, raw = 0, evSum = 0, stormsA = 0, perks = 0, perkEvOre = 0, stormAEvOre = 0;
    for (const p of parts) { staked += p.staked; raw += p.raw; evSum += p.ev; stormsA += p.stormsA; perks += p.perks; perkEvOre += p.perkEvOre; stormAEvOre += p.stormAEvOre; }
    const r = evSum / staked;
    const rs = parts.map((p) => p.ev / p.staked);
    const mr = rs.reduce((a, b) => a + b, 0) / rs.length;
    const se = Math.sqrt(rs.reduce((a, b) => a + (b - mr) ** 2, 0) / (rs.length - 1) / rs.length);
    adv.push({ strategy, rtp: r, se, edge: r - 1, vsConst: 0, rawRtp: raw / staked, stormsA, perks, stakedKr: staked / 100, perkShare: perkEvOre / staked, stormAShare: stormAEvOre / staked });
  }
  for (const a of adv) a.vsConst = a.rtp - adv[0].rtp;
  log(`adversaries (${el()}): ${adv.map((a) => `${a.strategy} ${pct(a.rtp)} ±${pct(z * a.se, 2)} (raw ${pct(a.rawRtp)})`).join(', ')}`);

  // ---------------- end-to-end cross-check ----------------
  const e2eParts = await pool.map<E2EStats>(N.e2e, N.chunks, (from, count, k) => ({ kind: 'e2e', cfg, seed: S.e2e, from, count, stake: STAKE, perkSeed: S.e2e, perkFrom: k * perkPerChunk(e2eChunk), stormSeed: S.e2e, stormFrom: k * stormPerChunk(e2eChunk) }));
  const es = mergeE2E(e2eParts);
  const Rcyc = es.cW / es.cN;
  const Nbar = es.cN / es.cycles;
  const varD = (es.cW2 - 2 * Rcyc * es.cWN + Rcyc * Rcyc * es.cN2) / es.cycles; // E[(W − R·N)²]
  const seE2E = Math.sqrt(varD / es.cycles) / Nbar;
  const e2eMean = es.sumX / es.n;
  const e2eSd = Math.sqrt(es.sumX2 / es.n - e2eMean * e2eMean);
  const e2ePass = Math.abs(Rcyc - rtp) <= z * Math.sqrt(seE2E ** 2 + seRtp ** 2);
  log(`e2e ${es.n} spins, ${es.cycles} cycles, ${es.storms} storms (${el()}): RTP ${pct(Rcyc, 3)} ± ${pct(z * seE2E, 3)} (plain mean ${pct(e2eMean, 3)}) → ${e2ePass ? 'PASS' : 'FAIL'}`);

  await pool.close();

  // ---------------- derived statistics ----------------
  const wSorted = ss.w.slice().sort();
  const qW = (q: number) => wSorted[Math.min(wSorted.length - 1, Math.floor(q * wSorted.length))];
  const kpMedianSpins: number[] = [], kpMeanSpins: number[] = [];
  for (let t = 1; t <= 9; t++) {
    const h = bs.tierHist.subarray((t - 1) * TIER_MAX_SPINS, t * TIER_MAX_SPINS);
    kpMedianSpins.push(intHistQuantile(h, 0.5));
    kpMeanSpins.push(Math.round(intHistMean(h) * 10) / 10);
  }
  const tiersBy150Median = intHistQuantile(bs.tiersBy150, 0.5);
  const tiersBy150AtLeast3 = 1 - (bs.tiersBy150[0] + bs.tiersBy150[1] + bs.tiersBy150[2]) / bs.tiersBy150.reduce((a, b) => a + b, 0);
  const ES2 = ss.sumS2 / ss.n;
  const blendedSd = Math.sqrt(bs.sumXP2 / n + stormRate * ES2 - rtp * rtp);
  const avgStormSpins = ss.spins / ss.n;
  const guarCost = ss.sumG / ss.n / ES;
  const capRate = ss.capped / ss.n;
  const sunRtp = p3 * cfg.sunPayX;
  const clusterRtp = bs.sumCluster / n;

  // variants: payScale & stormPayScale × λ (from the tuner), re-evaluated on this verification sample
  const variants: MathReport['variants'] = [];
  const variantCheck: { rtp: number; payScale: number; stormPayScale: number; estRtp: number }[] = [];
  // (sim/out is gitignored: without tune.json fall back to the variants already stored in the generated REPORT)
  const tv: MathReport['variants'] = tune?.cfg?.modelHash === cfg.modelHash ? tune.report.variants
    : REPORT.modelHash === cfg.modelHash && REPORT.variants.length ? REPORT.variants : [{ rtp: 0.96, payScale: 1, stormPayScale: cfg.stormPayScale }];
  for (const v of tv) {
    const lam = v.payScale / cfg.payScale;
    const ls = v.stormPayScale / cfg.stormPayScale;
    let sW = 0, sG = 0;
    const cap = cfg.maxWinX, G = cfg.guaranteeX;
    for (let i = 0; i < ss.w.length; i++) { const x = Math.min(cap, ss.w[i] * ls); sW += x; if (x < G) sG += G - x; }
    const ESv = (sW + sG) / ss.w.length;
    const est = lam * (clusterRtp + perkRtp) + sunRtp + stormRate * ESv;
    variants.push({ rtp: v.rtp, payScale: v.payScale, stormPayScale: v.stormPayScale });
    variantCheck.push({ ...v, estRtp: est });
  }

  const report: MathReport = {
    rtp, rtpMin, meterShare: rtp - rtpMin,
    hitRate: bs.hits / n, netWinRate: bs.net / n, ldwShareOfHits: bs.ldw / bs.hits,
    stormRate, routeARate: rA, routeBRate: rBall - rAB, avgSpinsToKp9: EN,
    stormMeanX: ES, stormP10X: qW(0.1), stormP50X: qW(0.5), stormP90X: qW(0.9), stormP99X: qW(0.99),
    guaranteeUseRate: ss.guarUsed / ss.n, baseSdX: sdBase, blendedSdX: blendedSd,
    perStormSpinRtp: ES / avgStormSpins, baseSpinRtp: base,
    kpMedianSpins, spinsSimulated: n, stormsSimulated: ss.n, variants,
    rtpCi95: z * seRtp, clusterRtp, sunRtp, perkRtp, stormARtp: rA * ES, stormBRtp: (rBall - rAB) * ES,
    avgChargePerSpin: bs.sumC / n, kpMeanSpins, minWinX: minWinX(DEFAULT_MODEL), capHitRate: capRate, guaranteeCostShare: guarCost,
    baseP99X: histQuantile(bs.hist, 0.99), blendedP99X: histQuantile(es.hist, 0.99),
    modelHash: cfg.modelHash, generatedAt: new Date().toISOString() + (QUICK ? ' (sim/run.ts --quick)' : ' (sim/run.ts)'),
  };


  const json = {
    report, gates: [] as Gate[], config: cfg, seeds: S, samples: { ...N, quick: QUICK }, elapsedS: (Date.now() - t0) / 1000,
    decomposition: {
      stake: STAKE, n, base, sdBase, clusterRtp, sunRtp, sunRtpSampled: bs.sumSun / n, perkRtp, perkRate, perkEV: bs.perkSumX / Math.max(1, bs.perkSpins),
      BP, seBP, EN, sdN, seEN, cycles: bs.cyclesA, overshoot: bs.overshoot / bs.cyclesA, pB, p3, rA, rBall, rAB,
      countedRates: { stormA: bs.stormA / n, stormB: bs.stormB / n, stormBpaid: bs.stormBpaid / n, stormBperk: bs.stormBperk / n, stormAB: bs.stormAB / n },
      stormRate, rtp, seRtp, ci95: z * seRtp, rtpMin, seMin,
      hits: bs.hits / n, net: bs.net / n, push: bs.eq / n, ldw: bs.ldw / n, sun3: bs.sun3 / n, sun4: bs.sun4 / n, cappedBase: bs.capped, maxBaseX: bs.maxX,
      baseQuantiles: [0.5, 0.75, 0.9, 0.95, 0.99, 0.999].map((q) => ({ q, x: histQuantile(bs.hist, q) })),
      chargeMean: bs.sumC / n, chargeSd: Math.sqrt(bs.sumC2 / n - (bs.sumC / n) ** 2),
      kpMedianSpins, kpMeanSpins, tiersBy150: Array.from(bs.tiersBy150), tiersBy150Median, tiersBy150AtLeast3,
    },
    storms: {
      n: ss.n, stake: STAKE, ES, sdS, seES, meanW: ss.sumW / ss.n, meanG: ss.sumG / ss.n, guarUse: ss.guarUsed / ss.n, guarCost, capped: ss.capped, capRate,
      avgSpins: avgStormSpins, retriggerRate: ss.retr / ss.n, perStormSpinRtp: ES / avgStormSpins,
      quantilesW: [0.01, 0.05, 0.1, 0.2, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 0.999, 0.9999].map((q) => ({ q, x: qW(q) })), maxW: wSorted[wSorted.length - 1],
      maxMarkHist: Array.from(ss.maxMarkHist).map((c) => c / ss.n), spinsHist: Array.from(ss.spinsHist).map((c) => c / ss.n), stakeCheck,
    },
    e2e: { n: es.n, cycles: es.cycles, storms: es.storms, stormsA: es.stormsA, stormsB: es.stormsB, rtpCycles: Rcyc, seCycles: seE2E, rtpPlain: e2eMean, sd: e2eSd, pass: e2ePass, p99: histQuantile(es.hist, 0.99) },
    adversary: adv, variants: variantCheck,
    tuning: tune ? { phi: tune.phi, sBeforeRounding: tune.sBeforeRounding, targets: tune.targets, samples: tune.samples, seed: tune.seed, perkEV: tune.perkEV, overshoot: tune.overshoot, cbar: tune.cbar, provisional: tune.report } : null,
  };
  json.gates = buildGates(json);
  for (const g of json.gates) log(`${g.pass ? 'PASS' : 'FAIL'}  ${g.name}: ${g.value} (krav ${g.req})`);
  const outJson = fileURLToPath(new URL('./report.json', import.meta.url));
  writeFileSync(outJson, JSON.stringify(json, (_k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(10) : v), 1));
  writeGenerated(cfg, report, 'sim/run.ts');
  writeReportMd(json);
  log(`wrote sim/report.json, sim/REPORT.md, src/math/config.generated.ts (${el()})`);
}

// ------------------------------------------------------------------------------------------------
function mergeStorm(parts: StormStats[]): StormStats {
  const o = { ...parts[0], maxMarkHist: new Float64Array(8), spinsHist: new Float64Array(21) } as StormStats;
  o.n = 0; o.sumW = 0; o.sumW2 = 0; o.sumG = 0; o.sumS2 = 0; o.guarUsed = 0; o.capped = 0; o.spins = 0; o.spins2 = 0; o.retr = 0;
  let len = 0;
  for (const p of parts) len += p.w.length;
  o.w = new Float64Array(len);
  let k = 0;
  for (const p of parts) {
    o.n += p.n; o.sumW += p.sumW; o.sumW2 += p.sumW2; o.sumG += p.sumG; o.sumS2 += p.sumS2; o.guarUsed += p.guarUsed; o.capped += p.capped;
    o.spins += p.spins; o.spins2 += p.spins2; o.retr += p.retr;
    addInto(o.maxMarkHist, p.maxMarkHist); addInto(o.spinsHist, p.spinsHist);
    o.w.set(p.w, k); k += p.w.length;
  }
  return o;
}

function mergeBase(parts: BaseStats[]): BaseStats {
  const o: BaseStats = { ...parts[0], hist: new Float64Array(HIST_BINS), tierHist: new Float64Array(9 * TIER_MAX_SPINS), tiersBy150: new Float64Array(10) };
  const keys = Object.keys(o).filter((k) => typeof (o as unknown as Record<string, unknown>)[k] === 'number' && k !== 'stake' && k !== 'maxX') as (keyof BaseStats)[];
  for (const k of keys) (o as unknown as Record<string, number>)[k] = 0;
  o.maxX = 0;
  for (const p of parts) {
    for (const k of keys) (o as unknown as Record<string, number>)[k] += (p as unknown as Record<string, number>)[k];
    addInto(o.hist, p.hist); addInto(o.tierHist, p.tierHist); addInto(o.tiersBy150, p.tiersBy150);
    o.maxX = Math.max(o.maxX, p.maxX);
  }
  return o;
}

function mergeE2E(parts: E2EStats[]): E2EStats {
  const o: E2EStats = { ...parts[0], hist: new Float64Array(HIST_BINS) };
  const keys = Object.keys(o).filter((k) => typeof (o as unknown as Record<string, unknown>)[k] === 'number' && k !== 'stake') as (keyof E2EStats)[];
  for (const k of keys) (o as unknown as Record<string, number>)[k] = 0;
  for (const p of parts) {
    for (const k of keys) (o as unknown as Record<string, number>)[k] += (p as unknown as Record<string, number>)[k];
    addInto(o.hist, p.hist);
  }
  return o;
}

export const pct = (x: number, d = 2): string => (x * 100).toFixed(d).replace('.', ',') + ' %';

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
