// ============================================================
// NORDLYS · tuner (PLAN.md §5). Usage: node sim/tune.ts [--quick]
//
// Common random numbers throughout (same seed/idx ranges for every candidate). Order:
//   1. wild weight  ← bisection on hit rate
//   2. shape knob φ ← bisection on net-win (s re-solved for the cluster-RTP target at each φ)
//   3. round the paytable to "nice" steps (0.1 / 1 / 5 — exact øre at every stake), payScale = 1,
//      then greedy ±1-step corrections on sizes ≥ 8 to land the cluster-RTP target
//   4. pSun analytic (route B ≈ 1:3300)
//   5. K = c̄/r_A − Ō (+ perk charge), fixed-point on the recorded charge sequence
//   6. stormPayScale closed form on a recorded storm sample (cap + guarantee applied analytically)
//   7. variants 94/92 (payScale & stormPayScale scaled together)
// The cascade never depends on the paytable, so a recorded (sym·bucket, mult) sample prices any table
// exactly. Output: src/math/config.generated.ts (+ provisional REPORT), sim/out/tune.json.
// Fresh-seed verification is `node sim/run.ts`.
// ============================================================
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONFIG, REPORT, type MathConfig, type MathReport } from '../src/math/config.ts';
import { bernoulliThreshold, TWO32 } from '../src/math/grid.ts';
import { TIERS } from '../src/game/tiers.ts';
import { Pool } from './pool.ts';
import { SHAPE0, isMonotone, roundNice, shapeAt, stepDown, stepUp } from './shape.ts';
import { modelHashOf, writeGenerated } from './gen.ts';

const QUICK = process.argv.includes('--quick');
export const TUNE_SEED = 0x4e4c5455; // 'NLTU'

export const TARGET = {
  hit: 0.45,            // gate ≥ 0.43
  net: 0.27,            // gate ≥ 0.25
  cluster: 0.787,       // base clusters; + suns ≈ 1.6 pp → base-only ≈ 80.3 % (gate 79–81)
  spinsPerA: 2200,      // route A ≈ 1:2200
  rtp: 0.96,
};

const N_HIT = QUICK ? 300_000 : 1_500_000;
const N_REC = QUICK ? 600_000 : 6_000_000;
const N_PERK = QUICK ? 100_000 : 1_000_000;
const N_STORM = QUICK ? 20_000 : 600_000;
const CHUNKS = 12;

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

/** Σ mult per (sym, bucket) / n — cluster RTP is linear in the paytable with these weights. */
export function multWeights(rec: Rec): Float64Array {
  const w = new Float64Array(56);
  for (let j = 0; j < rec.sb.length; j++) w[rec.sb[j]] += rec.mult[j];
  for (let k = 0; k < 56; k++) w[k] /= rec.n;
  return w;
}
const dot = (pt: number[][], w: Float64Array) => { let s = 0; for (let k = 0; k < 56; k++) s += pt[k >> 3][k & 7] * w[k]; return s; };

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

/** Meter cycles over a recorded charge sequence (perk spins approximated by their mean charge). */
export function meterCycles(charge: Uint16Array, K: number, perkCharge: number) {
  const th = TIERS.map((t) => t.frac * K);
  let c = 0, cycles = 0, spins = 0, overshoot = 0, cycSpins = 0;
  for (let i = 0; i < charge.length; i++) {
    const before = c;
    c += charge[i];
    spins++;
    for (let t = 1; t <= 9; t++) if (TIERS[t].perk && before < th[t] && c >= th[t]) c += perkCharge;
    if (c >= K) {
      overshoot += c - K;
      cycles++;
      cycSpins += spins;
      spins = 0;
      c = 0;
    }
  }
  return { cycles, meanLen: cycSpins / cycles, overshoot: overshoot / cycles };
}

function log(...a: unknown[]) {
  console.log('[tune]', ...a);
}

async function main() {
  const t0 = Date.now();
  const pool = new Pool(3);
  log(`workers=${pool.size} quick=${QUICK}`);
  let cfg: MathConfig = {
    ...CONFIG,
    cols: 6, rows: 6, stormCols: 8, stormRows: 8,
    weights: [26, 25, 23, 22, 10, 8, 6, 2.2],
    paytable: SHAPE0.map((r) => r.slice()),
    payScale: 1,
    baseMarkCap: 32, stormMarkCap: 128, stormSpins: 10, stormStartMarks: 6, retriggerSpins: 3, maxStormSpins: 20,
    guaranteeX: 30, maxWinX: 10000, sunPayX: 3, sunCharge: 150,
    stakesOre: [50, 100, 200, 400, 600, 1000, 2000, 5000, 10000], defaultStakeOre: 200,
    modelHash: '',
  };

  // ---------------- 1. wild weight ← hit rate ----------------
  const hitAt = async (w: number) => {
    const c = { ...cfg, weights: [...cfg.weights.slice(0, 7), w] };
    const parts = await pool.map<{ n: number; hits: number }>(N_HIT, CHUNKS, (from, n) => ({ kind: 'hit', cfg: c, seed: TUNE_SEED, from, count: n }));
    let h = 0, n = 0;
    for (const p of parts) { h += p.hits; n += p.n; }
    return h / n;
  };
  let lo = 1.2, hi = 4.0;
  for (let it = 0; it < (QUICK ? 5 : 8); it++) {
    const mid = (lo + hi) / 2;
    const h = await hitAt(mid);
    log(`wild ${mid.toFixed(4)} → hit ${h.toFixed(5)}`);
    if (h < TARGET.hit) lo = mid; else hi = mid;
  }
  const wild = Math.round(((lo + hi) / 2) * 20) / 20; // 0.05 steps
  cfg = { ...cfg, weights: [...cfg.weights.slice(0, 7), wild] };
  log(`wild weight = ${wild}`);

  // ---------------- 2. record base sample ----------------
  const rec = mergeRecords(await pool.map<Rec>(N_REC, CHUNKS, (from, n) => ({ kind: 'record', cfg, seed: TUNE_SEED, from, count: n, stake: 100, perk: false })));
  const W = multWeights(rec);
  log(`recorded ${rec.n} spins, ${rec.sb.length} clusters (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

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

  // ---------------- 3. round to nice steps, payScale = 1, greedy cluster-RTP correction ----------------
  let pt = best.eff.map((r) => r.map(roundNice));
  // repair monotonicity after rounding
  for (let pass = 0; pass < 4 && !isMonotone(pt); pass++) {
    for (let s = 0; s < 7; s++) for (let b = 1; b < 8; b++) if (pt[s][b] < pt[s][b - 1]) pt[s][b] = pt[s][b - 1];
    for (let b = 0; b < 8; b++) for (let s = 1; s < 7; s++) if (pt[s][b] < pt[s - 1][b]) pt[s][b] = pt[s - 1][b];
  }
  let cl = dot(pt, W);
  log(`rounded cluster RTP ${cl.toFixed(5)} (target ${TARGET.cluster})`);
  for (let it = 0; it < 400 && Math.abs(cl - TARGET.cluster) > 0.0003; it++) {
    const up = cl < TARGET.cluster;
    let bestK = -1, bestV = 0, bestErr = Math.abs(cl - TARGET.cluster);
    for (let s = 0; s < 7; s++) {
      for (let b = 3; b < 8; b++) {
        const v0 = pt[s][b];
        const v1 = up ? stepUp(v0) : stepDown(v0);
        pt[s][b] = v1;
        const ok = isMonotone(pt);
        pt[s][b] = v0;
        if (!ok) continue;
        const err = Math.abs(cl + (v1 - v0) * W[s * 8 + b] - TARGET.cluster);
        if (err < bestErr - 1e-9) { bestErr = err; bestK = s * 8 + b; bestV = v1; }
      }
    }
    if (bestK < 0) break;
    pt[bestK >> 3][bestK & 7] = bestV;
    cl = dot(pt, W);
  }
  const prBase = price(rec, pt, cfg.sunPayX);
  cfg = { ...cfg, paytable: pt, payScale: 1 };
  log(`paytable (× stake):\n${pt.map((r) => '   ' + r.map((v) => v.toFixed(1).padStart(6)).join('')).join('\n')}`);
  log(`base: cluster ${prBase.cluster.toFixed(5)} sun ${prBase.sun.toFixed(5)} hit ${prBase.hit.toFixed(4)} net ${prBase.net.toFixed(4)} eq ${prBase.eq.toFixed(4)} ldwShare ${prBase.ldwShare.toFixed(4)} sd ${prBase.sd.toFixed(3)}`);

  // ---------------- 4. pSun (route B ≈ 1:3300) ----------------
  // P(≥4 of 6) solved analytically on the exact u32 threshold grid.
  let a = 0.02, b = 0.2;
  for (let it = 0; it < 60; it++) { const m = (a + b) / 2; if (pAtLeast(m, cfg.cols, 4) < 1 / 3300) a = m; else b = m; }
  const pSun = Math.round(((a + b) / 2) * 1e5) / 1e5;
  cfg = { ...cfg, pSun };
  const pSunEff = bernoulliThreshold(pSun) / TWO32;
  const pB = pAtLeast(pSunEff, cfg.cols, 4);
  const p3 = pExactly(pSunEff, cfg.cols, 3);
  log(`pSun ${pSun} → P(4+) = 1:${(1 / pB).toFixed(0)}, P(3) = ${p3.toFixed(5)} (recorded ${(rec.sun.reduce((s, x) => s + (x === 3 ? 1 : 0), 0) / rec.n).toFixed(5)} at old p)`);
  // sun RTP & sun charge at the new p (closed form)
  const sunRtp = p3 * cfg.sunPayX;

  // ---------------- perk sample ----------------
  const perkRec = mergeRecords(await pool.map<Rec>(N_PERK, CHUNKS, (from, n) => ({ kind: 'record', cfg, seed: TUNE_SEED, from, count: n, stake: 100, perk: true })));
  const prPerk = price(perkRec, pt, cfg.sunPayX);
  let perkC = 0;
  for (let i = 0; i < perkRec.n; i++) perkC += perkRec.charge[i];
  perkC /= perkRec.n;
  log(`perk spin EV ${prPerk.rtp.toFixed(4)}× (charge ${perkC.toFixed(2)})`);

  // ---------------- 5. K ← route A ≈ 1:2200 ----------------
  // charge per spin with the new pSun: recorded charge minus old sun charge plus new expectation (adjust via mean)
  let cbar = 0;
  for (let i = 0; i < rec.n; i++) cbar += rec.charge[i];
  cbar /= rec.n;
  let K = Math.round(cbar * TARGET.spinsPerA);
  for (let it = 0; it < 5; it++) {
    const mc = meterCycles(rec.charge, K, perkC);
    K = Math.round(K * (TARGET.spinsPerA / mc.meanLen));
    log(`K ${K}: cycle ${mc.meanLen.toFixed(1)} spins, overshoot ${mc.overshoot.toFixed(1)} (cycles ${mc.cycles})`);
  }
  K = Math.round(K / 10) * 10;
  const mcK = meterCycles(rec.charge, K, perkC);
  const rA = 1 / mcK.meanLen;
  cfg = { ...cfg, K };
  log(`K = ${K} (c̄ = ${cbar.toFixed(3)}, Ō = ${mcK.overshoot.toFixed(1)}, K ≈ c̄/r_A − Ō + 3·c̄_perk = ${(cbar / rA - mcK.overshoot + 3 * perkC).toFixed(0)})`);

  // ---------------- 6. storm sample → stormPayScale ----------------
  const stormCfg: MathConfig = { ...cfg, stormPayScale: 1, maxWinX: 1e9 };
  const sParts = await pool.map<{ n: number; w: Float64Array; spins: number; retr: number }>(N_STORM, CHUNKS, (from, n) => ({ kind: 'stormW', cfg: stormCfg, seed: TUNE_SEED, from, count: n, stake: 10000 }));
  const wAll = new Float64Array(N_STORM);
  let k0 = 0, sp = 0, rt = 0;
  for (const p of sParts) { wAll.set(p.w, k0); k0 += p.n; sp += p.spins; rt += p.retr; }
  log(`storm sample ${N_STORM} (${((Date.now() - t0) / 1000).toFixed(0)} s): mean@1 ${(wAll.reduce((s, x) => s + x, 0) / N_STORM).toFixed(2)}×, spins ${(sp / N_STORM).toFixed(3)}, retrigger ${(rt / N_STORM).toFixed(4)}`);

  const baseRtp = prBase.cluster + sunRtp;
  const perksPerSpin = 3 * rA;
  const perkRtp = perksPerSpin * prPerk.rtp;
  const rB = pB * (1 + perksPerSpin);
  const rAB = rA * pB;
  const stormRate = rA + rB - rAB;
  const total = (s: number) => baseRtp + perkRtp + stormRate * stormEV(wAll, s, cfg.maxWinX, cfg.guaranteeX).mean;
  let s0 = 0, s1 = 10;
  for (let it = 0; it < 80; it++) { const m = (s0 + s1) / 2; if (total(m) < TARGET.rtp) s0 = m; else s1 = m; }
  const sStorm = Math.round(((s0 + s1) / 2) * 1e6) / 1e6;
  cfg = { ...cfg, stormPayScale: sStorm };
  const ev = stormEV(wAll, sStorm, cfg.maxWinX, cfg.guaranteeX);
  const sorted = Float64Array.from(wAll).map((x) => Math.min(cfg.maxWinX, x * sStorm)).sort();
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  log(`stormPayScale ${sStorm}: E[S] ${ev.mean.toFixed(2)}× (W ${ev.meanW.toFixed(2)} + G ${ev.guarantee.toFixed(3)}), guarUse ${(ev.guarUse * 100).toFixed(2)} %, cap ${ev.capRate.toExponential(2)}, P10 ${q(0.1).toFixed(1)} P50 ${q(0.5).toFixed(1)} P90 ${q(0.9).toFixed(1)} P99 ${q(0.99).toFixed(0)}`);
  log(`RTP: base ${(baseRtp * 100).toFixed(3)} (cl ${(prBase.cluster * 100).toFixed(3)} + sun ${(sunRtp * 100).toFixed(3)}), perk ${(perkRtp * 100).toFixed(3)}, A ${(rA * ev.mean * 100).toFixed(3)}, B ${((rB - rAB) * ev.mean * 100).toFixed(3)} → ${(total(sStorm) * 100).toFixed(3)}`);
  log(`min RTP (base + B) ${((baseRtp + (rB - rAB) * ev.mean) * 100).toFixed(3)} %, meter share ${((perkRtp + rA * ev.mean) * 100).toFixed(3)} pp, storm 1:${(1 / stormRate).toFixed(0)}`);

  // ---------------- 7. variants (payScale & stormPayScale × λ) ----------------
  const variants: MathReport['variants'] = [{ rtp: 0.96, payScale: 1, stormPayScale: sStorm }];
  for (const target of [0.94, 0.92]) {
    const rtpAt = (lam: number) => {
      const p = price(rec, pt.map((r) => r.map((v) => v * lam)), cfg.sunPayX);
      const pk = price(perkRec, pt.map((r) => r.map((v) => v * lam)), cfg.sunPayX);
      return p.cluster + sunRtp + perksPerSpin * pk.rtp + stormRate * stormEV(wAll, sStorm * lam, cfg.maxWinX, cfg.guaranteeX).mean;
    };
    let l0 = 0.8, l1 = 1.0;
    for (let it = 0; it < 30; it++) { const m = (l0 + l1) / 2; if (rtpAt(m) < target) l0 = m; else l1 = m; }
    const lam = Math.round(((l0 + l1) / 2) * 1e5) / 1e5;
    variants.push({ rtp: target, payScale: lam, stormPayScale: Math.round(sStorm * lam * 1e6) / 1e6 });
    log(`variant ${target}: λ = ${lam}`);
  }

  cfg.modelHash = '';
  cfg.modelHash = modelHashOf(cfg);
  // provisional REPORT (tuning estimates) — node sim/run.ts replaces it with the fresh-seed verification
  const report: MathReport = {
    ...REPORT,
    rtp: total(sStorm), rtpMin: baseRtp + (rB - rAB) * ev.mean, meterShare: perkRtp + rA * ev.mean,
    hitRate: prBase.hit, netWinRate: prBase.net, ldwShareOfHits: prBase.ldwShare,
    stormRate, routeARate: rA, routeBRate: rB - rAB, avgSpinsToKp9: mcK.meanLen,
    stormMeanX: ev.mean, stormP10X: q(0.1), stormP50X: q(0.5), stormP90X: q(0.9), stormP99X: q(0.99),
    guaranteeUseRate: ev.guarUse, baseSdX: prBase.sd, blendedSdX: REPORT.blendedSdX,
    perStormSpinRtp: ev.mean / (sp / N_STORM), baseSpinRtp: baseRtp,
    spinsSimulated: rec.n, stormsSimulated: N_STORM, variants,
    rtpCi95: 0, clusterRtp: prBase.cluster, sunRtp, perkRtp, stormARtp: rA * ev.mean, stormBRtp: (rB - rAB) * ev.mean,
    avgChargePerSpin: cbar, minWinX: Math.min(...pt.map((r) => r[0])), capHitRate: ev.capRate, guaranteeCostShare: ev.guarantee / ev.mean,
    modelHash: cfg.modelHash, generatedAt: new Date().toISOString() + ' (tune, provisional)',
  };
  writeGenerated(cfg, report, 'sim/tune.ts');
  const outDir = fileURLToPath(new URL('./out/', import.meta.url));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outDir + 'tune.json', JSON.stringify({ cfg, report, phi: best.phi, sBeforeRounding: best.s, targets: TARGET, elapsedS: (Date.now() - t0) / 1000 }, null, 1));
  log(`wrote config.generated.ts  modelHash ${cfg.modelHash.slice(0, 16)}…  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  await pool.close();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
