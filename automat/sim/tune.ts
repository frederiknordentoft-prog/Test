// ============================================================
// NORDLYS · tuner (PLAN.md §5). Usage: node sim/tune.ts [--quick]
//
// Common random numbers throughout: every candidate is evaluated on the SAME spins (same seed + idx
// ranges, see seeds.ts). The cascade never depends on the paytable, so the pays of any table are
// recovered exactly from recorded (sym·bucket, mult) pairs. Order:
//   0. pSun analytic: P(≥4 of 6 columns) = 1:3300 (route B)
//   1. wild weight  ← bisection on hit rate (target 45 %)
//   2. shape knob φ ← bisection on net-win (27 %); s re-solved at each φ for the cluster-RTP target
//   3. round the paytable to "nice" steps (0.1 below 10×, 1 below 100×, 5 above — all multiples of 0.1×,
//      so every pay is an exact øre amount at every stake ≥ 10 øre); payScale = 1 (what the paytable
//      screen shows is exactly what pays). Greedy ±1-step corrections on sizes ≥ 8 then land the
//      cluster-RTP target (this is the "re-solve s" of PLAN §5 step 7, done in the table itself).
//   4. K closed form (renewal + Wald): E[paid spins per cycle] = (K + Ō)/c̄ − 3  (3 perk spins per cycle,
//      perk charge ~ base charge because marks never change the cascade) → K = c̄·(2200 + 3) − Ō.
//   5. stormPayScale closed form on a storm sample recorded at scale 1 without cap:
//      E[S](s) = mean(min(cap, s·W) + max(0, 30 − min(cap, s·W))) — solve total RTP = 96 %.
//   6. variants 94 / 92 % (payScale & stormPayScale × λ).
// Output: src/math/config.generated.ts (+ a provisional REPORT), sim/out/tune.json.
// Fresh-seed verification + the real REPORT: `node sim/run.ts`.
// ============================================================
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONFIG, REPORT, type MathConfig, type MathReport } from '../src/math/config.ts';
import { bernoulliThreshold, TWO32 } from '../src/math/grid.ts';
import { TIERS } from '../src/game/tiers.ts';
import { Pool } from './pool.ts';
import { SeedPlan, type Range } from './seeds.ts';
import { SHAPE0, roundTable, shapeAt } from './shape.ts';
import { modelHashOf, writeGenerated } from './gen.ts';

const QUICK = process.argv.includes('--quick');
export const TUNE_SEED0 = 0x4e4c5455; // 'NLTU'

export const TARGET = {
  hit: 0.45,            // gate ≥ 0.43
  net: 0.27,            // gate ≥ 0.25
  cluster: 0.787,       // base clusters; + suns ≈ 1.6 pp → base-only ≈ 80.3 % (gate 79–81)
  spinsPerA: 2200,      // route A ≈ 1:2200 paid spins
  spinsPerB: 3300,      // route B ≈ 1:3300 (pSun)
  rtp: 0.96,
};

const FULL = { hit: 1_500_000, wacc: 60_000_000, rec: 5_000_000, perk: 1_000_000, storm: 800_000 };
const SMALL = { hit: 300_000, wacc: 2_000_000, rec: 600_000, perk: 100_000, storm: 40_000 };
const NN = QUICK ? SMALL : FULL;
export const N_HIT = NN.hit, N_WACC = NN.wacc, N_REC = NN.rec, N_PERK = NN.perk, N_STORM = NN.storm;
const CHUNKS = 16;

/** The idx ranges a full tune consumes (run.ts allocates its fresh seeds disjoint from these). */
export function tuneRanges(seed: number): Range[] {
  return [
    { seed, domain: 'base', from: 0, n: Math.max(FULL.hit, FULL.wacc, FULL.rec), name: 'tune' },
    { seed, domain: 'perk', from: 0, n: FULL.perk, name: 'tune' },
    { seed, domain: 'storm', from: 0, n: FULL.storm, name: 'tune' },
  ];
}
/** Deterministic tune seed: first seed ≥ TUNE_SEED0 whose three domain ranges are mutually disjoint. */
export function tuneSeed(): number {
  return new SeedPlan().alloc('tune', TUNE_SEED0, tuneRanges(0).map((r) => ({ domain: r.domain, n: r.n })));
}

type Rec = { n: number; off: Int32Array; sun: Uint8Array; charge: Uint16Array; sb: Uint8Array; mult: Uint16Array };

export function mergeRecords(parts: Rec[]): Rec {
  let n = 0, p = 0;
  for (const r of parts) { n += r.n; p += r.sb.length; }
  const off = new Int32Array(n + 1), sun = new Uint8Array(n), charge = new Uint16Array(n), sb = new Uint8Array(p), mult = new Uint16Array(p);
  let i0 = 0, p0 = 0;
  for (const r of parts) {
    for (let i = 0; i < r.n; i++) off[i0 + i] = r.off[i] + p0;
    sun.set(r.sun, i0); charge.set(r.charge, i0); sb.set(r.sb, p0); mult.set(r.mult, p0);
    i0 += r.n; p0 += r.sb.length;
  }
  off[n] = p;
  return { n, off, sun, charge, sb, mult };
}

export interface Priced { cluster: number; sun: number; rtp: number; hit: number; net: number; eq: number; ldw: number; ldwShare: number; sd: number }

/** Prices a recorded sample under an effective paytable (× stake) — exact up to øre rounding. */
export function price(rec: Rec, pt: number[][], sunPayX: number): Priced {
  const u = new Float64Array(56);
  for (let s = 0; s < 7; s++) for (let b = 0; b < 8; b++) u[s * 8 + b] = pt[s][b];
  let tc = 0, ts = 0, t2 = 0, hit = 0, net = 0, eq = 0, ldw = 0;
  const { off, sb, mult, sun, n } = rec;
  for (let i = 0; i < n; i++) {
    let T = 0;
    for (let j = off[i]; j < off[i + 1]; j++) T += u[sb[j]] * mult[j];
    tc += T;
    if (sun[i] === 3) { T += sunPayX; ts += sunPayX; }
    t2 += T * T;
    if (T > 0) {
      hit++;
      if (T > 1 + 1e-9) net++;
      else if (T > 1 - 1e-9) eq++;
      else ldw++;
    }
  }
  const rtp = (tc + ts) / n;
  return { cluster: tc / n, sun: ts / n, rtp, hit: hit / n, net: net / n, eq: eq / n, ldw: ldw / n, ldwShare: ldw / hit, sd: Math.sqrt(t2 / n - rtp * rtp) };
}

export const dot = (pt: number[][], w: Float64Array): number => { let s = 0; for (let k = 0; k < 56; k++) s += pt[k >> 3][k & 7] * w[k]; return s; };

/** P(≥ k suns) with ≤1 sun per column, independent columns. */
export function pAtLeast(p: number, cols: number, k: number): number {
  let tot = 0;
  const C = (n: number, r: number) => { let c = 1; for (let i = 0; i < r; i++) c = (c * (n - i)) / (i + 1); return c; };
  for (let j = k; j <= cols; j++) tot += C(cols, j) * p ** j * (1 - p) ** (cols - j);
  return tot;
}
export function pExactly(p: number, cols: number, k: number): number {
  return pAtLeast(p, cols, k) - pAtLeast(p, cols, k + 1);
}
/** The exact sun probability the engine uses (u32 threshold). */
export const pSunEff = (p: number): number => bernoulliThreshold(p) / TWO32;

/** Storm expectation (× stake) for a scale on a sample recorded at scale 1 without cap. */
export function stormEV(w: Float64Array, s: number, cap: number, G: number) {
  let sum = 0, g = 0, used = 0, capped = 0;
  for (let i = 0; i < w.length; i++) {
    let x = w[i] * s;
    if (x >= cap) { x = cap; capped++; }
    sum += x;
    if (x < G) { g += G - x; used++; }
  }
  const n = w.length;
  return { mean: (sum + g) / n, meanW: sum / n, guarantee: g / n, guarUse: used / n, capRate: capped / n };
}

/**
 * Route-A renewal cycles on a recorded charge sequence. Perk spins (3 per cycle, at Kp 3/5/7) consume the
 * next value of the sequence — exact in distribution, since perk marks never change the cascade.
 */
export function meterCycles(charge: Uint16Array, K: number) {
  const th = TIERS.map((t) => t.frac * K);
  let c = 0, cycles = 0, paid = 0, overshoot = 0, cycPaid = 0, pending = 0, k = 0;
  const add = (x: number) => {
    const before = c;
    c += x;
    for (let t = 1; t <= 9; t++) if (TIERS[t].perk && before < th[t] && c >= th[t]) pending++;
    if (c >= K) {
      overshoot += c - K;
      cycles++;
      cycPaid += paid;
      paid = 0;
      c = 0;
      pending = 0;
    }
  };
  while (k < charge.length) {
    paid++;
    add(charge[k++]);
    while (pending > 0 && k < charge.length) { pending--; add(charge[k++]); }
  }
  return { cycles, meanLen: cycPaid / cycles, overshoot: overshoot / cycles };
}

function log(...a: unknown[]) {
  console.log('[tune]', ...a);
}

async function main() {
  const t0 = Date.now();
  const el = () => ((Date.now() - t0) / 1000).toFixed(0) + ' s';
  const pool = new Pool();
  const SEED = tuneSeed();
  log(`workers=${pool.size} quick=${QUICK} seed=0x${SEED.toString(16)}`);
  let cfg: MathConfig = {
    ...CONFIG,
    cols: 6, rows: 6, stormCols: 8, stormRows: 8,
    weights: [26, 25, 23, 22, 10, 8, 6, 2.2],
    stormWeights: [26, 25, 23, 22, 10, 8, 6, 3],
    pSunStorm: 0.06,
    paytable: SHAPE0.map((r) => r.slice()),
    payScale: 1, stormPayScale: 1,
    baseMarkCap: 32, stormMarkCap: 128, stormSpins: 10, stormStartMarks: 6, retriggerSpins: 3, maxStormSpins: 20,
    guaranteeX: 30, maxWinX: 10000, sunPayX: 3, sunCharge: 150,
    stakesOre: [50, 100, 200, 400, 600, 1000, 2000, 5000, 10000], defaultStakeOre: 200,
    modelHash: '',
  };

  // ---------------- 0. pSun (route B ≈ 1:3300), analytic on the exact u32 threshold ----------------
  let a = 0.02, b = 0.2;
  for (let it = 0; it < 60; it++) { const m = (a + b) / 2; if (pAtLeast(pSunEff(m), cfg.cols, 4) < 1 / TARGET.spinsPerB) a = m; else b = m; }
  const pSun = Math.round(((a + b) / 2) * 1e5) / 1e5;
  cfg = { ...cfg, pSun };
  const pB = pAtLeast(pSunEff(pSun), cfg.cols, 4);
  const p3 = pExactly(pSunEff(pSun), cfg.cols, 3);
  const sunRtp = p3 * cfg.sunPayX;
  log(`pSun ${pSun} → P(4+) = 1:${(1 / pB).toFixed(0)}, P(3) = ${p3.toFixed(6)} (sun RTP ${(sunRtp * 100).toFixed(3)} %)`);

  // ---------------- 1. wild weight ← hit rate ----------------
  const hitAt = async (w: number) => {
    const c = { ...cfg, weights: [...cfg.weights.slice(0, 7), w] };
    const parts = await pool.map<{ n: number; hits: number }>(N_HIT, CHUNKS, (from, n) => ({ kind: 'hit', cfg: c, seed: SEED, from, count: n }));
    let h = 0, n = 0;
    for (const p of parts) { h += p.hits; n += p.n; }
    return h / n;
  };
  let lo = 1.2, hi = 4.0;
  for (let it = 0; it < (QUICK ? 5 : 7); it++) {
    const mid = (lo + hi) / 2;
    const h = await hitAt(mid);
    log(`wild ${mid.toFixed(4)} → hit ${h.toFixed(5)}`);
    if (h < TARGET.hit) lo = mid; else hi = mid;
  }
  const wild = Math.round(((lo + hi) / 2) * 20) / 20; // 0.05 steps
  cfg = { ...cfg, weights: [...cfg.weights.slice(0, 7), wild] };
  log(`wild weight = ${wild} (${el()})`);

  // ---------------- 2. samples: linear weights (big) + recorded pairs (non-linear metrics) ----------------
  const wParts = await pool.map<{ n: number; acc: Float64Array; sumC: number; sumC2: number; sun: Float64Array }>(N_WACC, CHUNKS * 2, (from, n) => ({ kind: 'wacc', cfg, seed: SEED, from, count: n }));
  const W = new Float64Array(56);
  let nW = 0, sumC = 0, sumC2 = 0;
  for (const p of wParts) { for (let k = 0; k < 56; k++) W[k] += p.acc[k]; nW += p.n; sumC += p.sumC; sumC2 += p.sumC2; }
  for (let k = 0; k < 56; k++) W[k] /= nW;
  const cbar = sumC / nW;
  log(`linear sample ${nW} spins: c̄ = ${cbar.toFixed(4)} (sd ${Math.sqrt(sumC2 / nW - cbar * cbar).toFixed(2)}) (${el()})`);
  const rec = mergeRecords(await pool.map<Rec>(N_REC, CHUNKS, (from, n) => ({ kind: 'record', cfg, seed: SEED, from, count: n, stake: 100, perk: false })));
  log(`recorded ${rec.n} spins, ${rec.sb.length} clusters (${el()})`);

  // shape knob φ ← net-win (s solved for the cluster target at each φ)
  const atPhi = (phi: number) => {
    const shp = shapeAt(phi);
    const s = TARGET.cluster / dot(shp, W);
    const eff = shp.map((r) => r.map((v) => v * s));
    return { phi, s, eff, pr: price(rec, eff, cfg.sunPayX) };
  };
  let pl = 0, ph = 2.5;
  let best = atPhi(0);
  if (best.pr.net < TARGET.net) {
    for (let it = 0; it < 24; it++) {
      const mid = (pl + ph) / 2;
      const r = atPhi(mid);
      if (r.pr.net < TARGET.net) pl = mid; else { ph = mid; best = r; }
    }
    if (best.phi === 0) best = atPhi(ph);
  }
  log(`φ = ${best.phi.toFixed(4)}  s = ${best.s.toFixed(4)}  net ${best.pr.net.toFixed(4)} ldwShare ${best.pr.ldwShare.toFixed(4)} hit ${best.pr.hit.toFixed(4)}`);

  // ---------------- 3. round to nice steps, payScale = 1 ----------------
  // The cluster RTP only has to stay inside the base band (79–81 % incl. suns): the exact total is solved by
  // stormPayScale in step 5, so rounding is only corrected when it moved the cluster RTP by > 0.3 pp.
  const rounded = roundTable(best.eff, W, TARGET.cluster, 0.003);
  const pt = rounded.pt;
  const cl = dot(pt, W);
  log(`rounded paytable: cluster RTP ${cl.toFixed(5)} (target ${TARGET.cluster}, ${rounded.moves} correction moves)`);
  const prBase = price(rec, pt, cfg.sunPayX);
  cfg = { ...cfg, paytable: pt, payScale: 1 };
  const baseRtp = cl + sunRtp;
  log(`paytable (× stake):\n${pt.map((r) => '   ' + r.map((v) => String(v).padStart(6)).join('')).join('\n')}`);
  log(`base: cluster ${cl.toFixed(5)} (rec ${prBase.cluster.toFixed(5)}) + sun ${sunRtp.toFixed(5)} = ${baseRtp.toFixed(5)}; hit ${prBase.hit.toFixed(4)} net ${prBase.net.toFixed(4)} eq ${prBase.eq.toFixed(4)} ldwShare ${prBase.ldwShare.toFixed(4)} sd ${prBase.sd.toFixed(3)}`);

  // ---------------- perk sample ----------------
  const perkRec = mergeRecords(await pool.map<Rec>(N_PERK, CHUNKS, (from, n) => ({ kind: 'record', cfg, seed: SEED, from, count: n, stake: 100, perk: true })));
  const prPerk = price(perkRec, pt, cfg.sunPayX);
  log(`perk spin EV ${prPerk.rtp.toFixed(4)}× (sd ${prPerk.sd.toFixed(2)}) (${el()})`);

  // ---------------- 4. K ← route A ≈ 1:2200 (renewal / Wald) ----------------
  let K = Math.round(cbar * (TARGET.spinsPerA + 3));
  let mc = meterCycles(rec.charge, K);
  for (let it = 0; it < 4; it++) {
    K = Math.round(cbar * (TARGET.spinsPerA + 3) - mc.overshoot);
    mc = meterCycles(rec.charge, K);
  }
  K = Math.round(K / 10) * 10;
  mc = meterCycles(rec.charge, K);
  const EN = (K + mc.overshoot) / cbar - 3;
  const rA = 1 / EN;
  cfg = { ...cfg, K };
  log(`K = ${K}: E[N] = (K + Ō)/c̄ − 3 = ${EN.toFixed(1)} (Ō = ${mc.overshoot.toFixed(2)}; direct on record: ${mc.meanLen.toFixed(1)} over ${mc.cycles} cycles)`);

  // ---------------- 5. storm sample → stormPayScale ----------------
  const stormCfg: MathConfig = { ...cfg, stormPayScale: 1, maxWinX: 1e9 };
  const sParts = await pool.map<{ n: number; w: Float64Array; spins: number; retr: number }>(N_STORM, CHUNKS, (from, n) => ({ kind: 'stormW', cfg: stormCfg, seed: SEED, from, count: n, stake: 10000 }));
  const wAll = new Float64Array(N_STORM);
  let k0 = 0, sp = 0, rt = 0;
  for (const p of sParts) { wAll.set(p.w, k0); k0 += p.n; sp += p.spins; rt += p.retr; }
  log(`storm sample ${N_STORM} (${el()}): mean@1 ${(wAll.reduce((s, x) => s + x, 0) / N_STORM).toFixed(2)}×, spins ${(sp / N_STORM).toFixed(3)}, retrigger ${(rt / N_STORM).toFixed(4)}`);

  const perksPerSpin = 3 * rA;
  const perkRtp = perksPerSpin * prPerk.rtp;
  const rBall = pB * (1 + perksPerSpin); // B from paid and perk spins
  const rAB = rA * pB * 0.5;             // A and B on the same spin (4+ sun spins carry no sun charge → < rA·pB); ≈ 1e-7, refined by run.ts
  const stormRate = rA + rBall - rAB;
  const total = (s: number) => baseRtp + perkRtp + stormRate * stormEV(wAll, s, cfg.maxWinX, cfg.guaranteeX).mean;
  let s0 = 0, s1 = 10;
  for (let it = 0; it < 80; it++) { const m = (s0 + s1) / 2; if (total(m) < TARGET.rtp) s0 = m; else s1 = m; }
  const sStorm = Math.round(((s0 + s1) / 2) * 1e4) / 1e4;
  cfg = { ...cfg, stormPayScale: sStorm };
  const ev = stormEV(wAll, sStorm, cfg.maxWinX, cfg.guaranteeX);
  const sorted = Float64Array.from(wAll).map((x) => Math.min(cfg.maxWinX, x * sStorm)).sort();
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  log(`stormPayScale ${sStorm}: E[S] ${ev.mean.toFixed(2)}× (W ${ev.meanW.toFixed(2)} + G ${ev.guarantee.toFixed(3)}), guarUse ${(ev.guarUse * 100).toFixed(2)} %, cap ${ev.capRate.toExponential(2)}, P10 ${q(0.1).toFixed(1)} P50 ${q(0.5).toFixed(1)} P90 ${q(0.9).toFixed(1)} P99 ${q(0.99).toFixed(0)}`);
  const rtpMin = baseRtp + pB * ev.mean;
  log(`RTP: base ${(baseRtp * 100).toFixed(3)} (cl ${(cl * 100).toFixed(3)} + sun ${(sunRtp * 100).toFixed(3)}), perk ${(perkRtp * 100).toFixed(3)}, A ${(rA * ev.mean * 100).toFixed(3)}, B ${((rBall - rAB) * ev.mean * 100).toFixed(3)} → ${(total(sStorm) * 100).toFixed(3)}`);
  log(`min RTP (base + B) ${(rtpMin * 100).toFixed(3)} %, meter share ${((total(sStorm) - rtpMin) * 100).toFixed(3)} pp, storm 1:${(1 / stormRate).toFixed(0)}`);

  // ---------------- 6. variants (payScale & stormPayScale × λ) ----------------
  const variants: MathReport['variants'] = [{ rtp: 0.96, payScale: 1, stormPayScale: sStorm }];
  for (const target of [0.94, 0.92]) {
    const rtpAt = (lam: number) => lam * (cl + perkRtp) + sunRtp + stormRate * stormEV(wAll, sStorm * lam, cfg.maxWinX, cfg.guaranteeX).mean;
    let l0 = 0.8, l1 = 1.0;
    for (let it = 0; it < 40; it++) { const m = (l0 + l1) / 2; if (rtpAt(m) < target) l0 = m; else l1 = m; }
    const lam = Math.round(((l0 + l1) / 2) * 1e5) / 1e5;
    variants.push({ rtp: target, payScale: lam, stormPayScale: Math.round(sStorm * lam * 1e4) / 1e4 });
    log(`variant ${target}: λ = ${lam}`);
  }

  cfg.modelHash = '';
  cfg.modelHash = modelHashOf(cfg);
  // provisional REPORT (tuning estimates) — node sim/run.ts replaces it with the fresh-seed verification
  const report: MathReport = {
    ...REPORT,
    rtp: total(sStorm), rtpMin, meterShare: total(sStorm) - rtpMin,
    hitRate: prBase.hit, netWinRate: prBase.net, ldwShareOfHits: prBase.ldwShare,
    stormRate, routeARate: rA, routeBRate: rBall - rAB, avgSpinsToKp9: EN,
    stormMeanX: ev.mean, stormP10X: q(0.1), stormP50X: q(0.5), stormP90X: q(0.9), stormP99X: q(0.99),
    guaranteeUseRate: ev.guarUse, baseSdX: prBase.sd, blendedSdX: REPORT.blendedSdX,
    perStormSpinRtp: ev.mean / (sp / N_STORM), baseSpinRtp: baseRtp,
    spinsSimulated: nW, stormsSimulated: N_STORM, variants,
    rtpCi95: 0, clusterRtp: cl, sunRtp, perkRtp, stormARtp: rA * ev.mean, stormBRtp: (rBall - rAB) * ev.mean,
    avgChargePerSpin: cbar, minWinX: Math.min(...pt.map((r) => r[0])), capHitRate: ev.capRate, guaranteeCostShare: ev.guarantee / ev.mean,
    modelHash: cfg.modelHash, generatedAt: new Date().toISOString() + ' (tune, provisional)',
  };
  writeGenerated(cfg, report, 'sim/tune.ts (provisional REPORT)');
  const outDir = fileURLToPath(new URL('./out/', import.meta.url));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outDir + 'tune.json', JSON.stringify({
    cfg, report, seed: SEED, phi: best.phi, sBeforeRounding: best.s, targets: TARGET, W: Array.from(W), cbar, overshoot: mc.overshoot,
    perkEV: prPerk.rtp, samples: { N_HIT, N_WACC, N_REC, N_PERK, N_STORM }, quick: QUICK, elapsedS: (Date.now() - t0) / 1000,
  }, null, 1));
  log(`wrote config.generated.ts  modelHash ${cfg.modelHash.slice(0, 16)}…  (${el()})`);
  await pool.close();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
