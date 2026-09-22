// ============================================================
// NORDLYS · supplementary end-to-end cross-check. Usage: node sim/e2e.ts [spins, default 8e7]
// Runs the e2e kernel (everything inline: perks, route A/B storms with guarantee) on a FRESH seed that shares
// no splitmix state with the tuner or with sim/run.ts, appends the result to sim/report.json
// (e2eSupplement), recomputes the pooled check and re-renders sim/REPORT.md.
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/math/config.ts';
import { Pool } from './pool.ts';
import { SeedPlan, type Range } from './seeds.ts';
import { tuneRanges, tuneSeed } from './tune.ts';
import type { E2EStats } from './core.ts';
import { buildGates, writeReportMd } from './report.ts';

const Z = 1.959964;

async function main() {
  const t0 = Date.now();
  const N = Number(process.argv[2] ?? 80_000_000);
  const chunks = 32;
  const jsonPath = fileURLToPath(new URL('./report.json', import.meta.url));
  const j = JSON.parse(readFileSync(jsonPath, 'utf8'));
  if (j.config.modelHash !== CONFIG.modelHash) throw new Error('sim/report.json belongs to another model — run node sim/run.ts first');
  // every range used so far: tuner + run.ts (as recorded) + earlier supplements
  const S = j.seeds as Record<string, number>, sm = j.samples as Record<string, number>;
  const taken: Range[] = [
    ...tuneRanges(tuneSeed()),
    { seed: S.base, domain: 'base', from: 0, n: sm.base }, { seed: S.base, domain: 'perk', from: 0, n: sm.base },
    { seed: S.storm, domain: 'storm', from: 0, n: sm.storm + sm.stakeStorms },
    { seed: S.e2e, domain: 'base', from: 0, n: sm.e2e }, { seed: S.e2e, domain: 'perk', from: 0, n: sm.e2e }, { seed: S.e2e, domain: 'storm', from: 0, n: sm.e2e },
    { seed: S.adv, domain: 'base', from: 0, n: sm.adv }, { seed: S.adv, domain: 'perk', from: 0, n: sm.adv },
    ...((j.e2eSupplement ?? []) as { seed: number; n: number }[]).flatMap((x) => (['base', 'perk', 'storm'] as const).map((d) => ({ seed: x.seed, domain: d, from: 0, n: x.n }))),
  ];
  const per = Math.ceil(N / chunks);
  const side = Math.ceil(per * 0.004) + 2000;
  const seed = new SeedPlan(taken).alloc('e2e-supplement', 0x4e4c5845 + 0x1000 * ((j.e2eSupplement ?? []).length + 1), [
    { domain: 'base', n: N }, { domain: 'perk', n: chunks * side }, { domain: 'storm', n: chunks * side },
  ]);
  const pool = new Pool();
  console.log(`[e2e] ${N} spins, seed 0x${seed.toString(16)}, workers ${pool.size}`);
  const parts = await pool.map<E2EStats>(N, chunks, (from, count, k) => ({ kind: 'e2e', cfg: CONFIG, seed, from, count, stake: CONFIG.defaultStakeOre, perkSeed: seed, perkFrom: k * side, stormSeed: seed, stormFrom: k * side }));
  await pool.close();
  let n = 0, cyc = 0, cW = 0, cN = 0, cW2 = 0, cN2 = 0, cWN = 0, storms = 0;
  for (const p of parts) { n += p.n; cyc += p.cycles; cW += p.cW; cN += p.cN; cW2 += p.cW2; cN2 += p.cN2; cWN += p.cWN; storms += p.storms; }
  const R = cW / cN, Nbar = cN / cyc;
  const se = Math.sqrt((cW2 - 2 * R * cWN + R * R * cN2) / cyc / cyc) / Nbar;
  const sup = { seed, n, cycles: cyc, storms, rtpCycles: R, seCycles: se, elapsedS: (Date.now() - t0) / 1000 };
  j.e2eSupplement = [...(j.e2eSupplement ?? []), sup];
  // pooled (inverse-variance) e2e estimate over the run.ts sample and all supplements
  const all = [{ rtpCycles: j.e2e.rtpCycles, seCycles: j.e2e.seCycles }, ...j.e2eSupplement];
  const w = all.map((x: { seCycles: number }) => 1 / x.seCycles ** 2);
  const W = w.reduce((a: number, b: number) => a + b, 0);
  const pooled = all.reduce((a: number, x: { rtpCycles: number }, i: number) => a + w[i] * x.rtpCycles, 0) / W;
  const seP = Math.sqrt(1 / W);
  j.e2ePooled = { rtp: pooled, se: seP, samples: all.length, storms: j.e2e.storms + j.e2eSupplement.reduce((a: number, x: { storms: number }) => a + x.storms, 0), z: (pooled - j.report.rtp) / Math.sqrt(seP ** 2 + j.decomposition.seRtp ** 2) };
  j.gates = buildGates(j);
  writeFileSync(jsonPath, JSON.stringify(j, (_k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(10) : v), 1));
  writeReportMd(j);
  console.log(`[e2e] supplement ${(R * 100).toFixed(3)} % ± ${(Z * se * 100).toFixed(3)} (${storms} storms, ${cyc} cycles) · pooled ${(pooled * 100).toFixed(3)} % ± ${(Z * seP * 100).toFixed(3)} vs decomposition ${(j.report.rtp * 100).toFixed(3)} % (z = ${j.e2ePooled.z.toFixed(2)}) · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
