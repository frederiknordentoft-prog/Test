// Terminal physics verification on the CPU core (same numerics as the shaders).
// Run: npm run verify:physics — exits non-zero on failure.

import { CpuCore } from '../engine/cpu/CpuCore';
import { makePrimitive } from '../engine/shape/primitives';
import { frontalHeight } from '../engine/shape/polygon';
import { dragCoefficient, TAU0, NU_LAT } from '../engine/units';
import type { ShapeKind } from '../engine/types';

const W = 256;
const H = 128;
const SETTLE = 4000;
const MEASURE = 2500;
const SAMPLE = 20;

interface Result {
  name: string;
  pass: boolean;
  detail: string;
}

function runCase(kind: Exclude<ShapeKind, 'freehand'>, uIn: number) {
  const core = new CpuCore(W, H);
  const shape = makePrimitive(kind);
  core.rasterize(shape, { theta: 0, bend: [0, 0] });
  core.init(uIn);
  for (let s = 0; s < SETTLE; s++) core.step(uIn, TAU0);
  const samples: { fx: number; fy: number; bad: boolean }[] = [];
  for (let s = 0; s < MEASURE; s += SAMPLE) {
    for (let k = 0; k < SAMPLE; k++) core.step(uIn, TAU0);
    samples.push(core.measureForce());
  }
  const fx = samples.reduce((a, b) => a + b.fx, 0) / samples.length;
  const fy = samples.reduce((a, b) => a + b.fy, 0) / samples.length;
  let signChanges = 0;
  for (let i = 1; i < samples.length; i++) {
    if (Math.sign(samples[i].fy) !== Math.sign(samples[i - 1].fy)) signChanges++;
  }
  const dCells = frontalHeight(shape.points, shape.pivot, 0) * H;
  return {
    fx,
    fy,
    anyBad: samples.some((s) => s.bad),
    fShed: signChanges / (2 * MEASURE),
    dCells,
    cd: dragCoefficient(fx, uIn, dCells),
    cl: dragCoefficient(fy, uIn, dCells),
  };
}

const results: Result[] = [];
const t0 = Date.now();

console.log(`Vindtunnel fysik-verifikation (CPU-kerne, ${W}×${H}, tau=${TAU0}, nu=${NU_LAT.toFixed(4)})\n`);

// --- 1. v² law: cylinder at u and 2u ---
{
  const lo = runCase('circle', 0.05);
  const hi = runCase('circle', 0.1);
  const ratio = hi.fx / lo.fx;
  results.push({
    name: 'v²-lov: drag(2v)/drag(v) ∈ [3.2, 4.8]',
    pass: ratio > 3.2 && ratio < 4.8 && lo.fx > 0,
    detail: `ratio=${ratio.toFixed(2)} (drag ${lo.fx.toFixed(4)} → ${hi.fx.toFixed(4)}), Re=${(0.1 * lo.dCells / NU_LAT).toFixed(0)}`,
  });

  // --- 3. Strouhal at high speed ---
  const st = (hi.fShed * hi.dCells) / 0.1;
  results.push({
    name: 'Strouhal (cylinder): St ∈ [0.12, 0.35]',
    pass: st > 0.12 && st < 0.35,
    detail: `St=${st.toFixed(3)} (f=${hi.fShed.toExponential(2)}/step, D=${hi.dCells.toFixed(0)} celler)`,
  });

  // --- 4. Symmetry ---
  results.push({
    name: 'Symmetri: cylinder |Cl| lille',
    pass: Math.abs(hi.cl) < Math.max(0.1, 0.15 * hi.cd),
    detail: `Cl=${hi.cl.toFixed(3)}, Cd=${hi.cd.toFixed(2)}`,
  });
}

// --- 2. Streamlining: teardrop vs plate, same frontal height ---
{
  const plate = runCase('plate', 0.08);
  const tear = runCase('teardrop', 0.08);
  const ratio = tear.cd / plate.cd;
  results.push({
    name: 'Strømlinjeform: Cd(dråbe)/Cd(plade) < 0.5',
    pass: ratio < 0.5 && plate.cd > 0.5,
    detail: `Cd(plade)=${plate.cd.toFixed(2)}, Cd(dråbe)=${tear.cd.toFixed(2)}, forhold=${ratio.toFixed(2)}`,
  });
}

// --- 6. Stability at max wind ---
{
  const sq = runCase('square', 0.12);
  results.push({
    name: 'Stabilitet: firkant ved max vind, ingen blowup',
    pass: !sq.anyBad && isFinite(sq.fx),
    detail: sq.anyBad ? 'blowup!' : `stabil, Cd=${sq.cd.toFixed(2)}`,
  });
}

// --- 5. Determinism: same seed → identical forces ---
{
  const a = runCase('circle', 0.09);
  const b = runCase('circle', 0.09);
  results.push({
    name: 'Determinisme: to ens kørsler → identisk drag',
    pass: a.fx === b.fx && a.fy === b.fy,
    detail: `Δfx=${Math.abs(a.fx - b.fx).toExponential(2)}`,
  });
}

console.log(
  results
    .map((r) => `${r.pass ? '✅ PASS' : '❌ FAIL'}  ${r.name}\n         ${r.detail}`)
    .join('\n'),
);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} bestået på ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
