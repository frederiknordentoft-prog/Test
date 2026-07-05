// In-page physics harness (?harness=1[&auto=1]): drives the Engine directly and
// verifies the vision's physics claims. Results land in window.__harness as JSON.

import { useEffect, useRef, useState } from 'react';
import { Engine } from '../engine/Engine';
import { makePrimitive } from '../engine/shape/primitives';
import type { SimParams } from '../engine/types';
import { dragCoefficient } from '../engine/units';

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
}

declare global {
  interface Window {
    __harness?: { done: boolean; pass: boolean; backend: string; results: TestResult[] };
  }
}

// fast=1 (til headless/CI med software-GL): mindre gitter og kortere kørsel.
// settle=<n>/measure=<n> kan overstyres til hurtig debugging.
const QUERY = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const FAST = QUERY.get('fast') === '1';
const MEASURE = Number(QUERY.get('measure')) || (FAST ? 1200 : 2000);
const SETTLE_OVERRIDE = Number(QUERY.get('settle')) || 0;
const SAMPLE_EVERY = 25;

/** Settle skaleres med flow-udviklingstiden (~1.2 domænekrydsninger). */
function settleFor(engine: Engine): number {
  if (SETTLE_OVERRIDE > 0) return SETTLE_OVERRIDE;
  const steps = Math.round((1.2 * engine.grid.w) / Math.max(engine.currentULat, 1e-4));
  return Math.min(FAST ? 8000 : 14000, Math.max(2500, steps));
}

const HARNESS_PARAMS: SimParams = {
  windSpeed: 0.5,
  density: 1,
  restAngleDeg: 0,
  pivotLocked: true,
  overlay: 'none',
  smoke: false,
  paused: true, // rAF-loopet må ikke steppe ved siden af harnessens synkrone kørsel
  quality: FAST ? 'low' : 'high',
  probe: null,
  reducedMotion: true,
};

async function yieldUi(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

async function runSteps(engine: Engine, n: number): Promise<void> {
  const chunk = 200;
  for (let done = 0; done < n; done += chunk) {
    engine.runStepsSync(Math.min(chunk, n - done));
    await yieldUi();
  }
}

interface Sample {
  fx: number;
  fy: number;
  bad: boolean;
}

async function measure(engine: Engine, steps = MEASURE): Promise<{ fx: number; fy: number; anyBad: boolean; samples: Sample[] }> {
  const samples: Sample[] = [];
  for (let s = 0; s < steps; s += SAMPLE_EVERY) {
    engine.runStepsSync(SAMPLE_EVERY);
    samples.push(engine.readForceSync());
    if (s % 200 === 0) await yieldUi();
  }
  const fx = samples.reduce((a, b) => a + b.fx, 0) / samples.length;
  const fy = samples.reduce((a, b) => a + b.fy, 0) / samples.length;
  return { fx, fy, anyBad: samples.some((s) => s.bad), samples };
}

async function runAll(engine: Engine, report: (r: TestResult) => void): Promise<void> {
  const uLo = 0.45; // slider values
  const uHi = 0.9;

  // 1+3+4: cylinder at low+high wind
  engine.setShape(makePrimitive('circle'));
  engine.setWindImmediate(uLo);
  engine.reset();
  await runSteps(engine, settleFor(engine));
  const lo = await measure(engine);
  const uLatLo = engine.currentULat;
  const dLo = engine.frontalCells;

  engine.setWindImmediate(uHi);
  engine.reset();
  await runSteps(engine, settleFor(engine));
  const hi = await measure(engine);
  const uLatHi = engine.currentULat;

  const expected = (uLatHi / uLatLo) ** 2;
  const ratio = hi.fx / Math.max(1e-9, lo.fx);
  const relRatio = ratio / expected; // should be ≈ 1 if drag ∝ v²
  report({
    name: 'v²-lov (cylinder)',
    pass: relRatio > 0.8 && relRatio < 1.25 && lo.fx > 0,
    detail: `drag(hi)/drag(lo)=${ratio.toFixed(2)}, forventet ${expected.toFixed(2)} (forhold ${relRatio.toFixed(2)}), fx=${lo.fx.toFixed(4)}→${hi.fx.toFixed(4)}, solid=${engine.debugSolidCount()}, ${engine.debugForceInfo()}`,
  });

  // Strouhal from lift sign changes at high wind
  let changes = 0;
  for (let i = 1; i < hi.samples.length; i++) {
    if (Math.sign(hi.samples[i].fy) !== Math.sign(hi.samples[i - 1].fy)) changes++;
  }
  const fLat = changes / (2 * MEASURE);
  const st = (fLat * dLo) / uLatHi;
  report({
    name: 'Strouhal (cylinder)',
    pass: st > 0.1 && st < 0.4,
    detail: `St=${st.toFixed(2)} (mål: 0.10–0.40, litteratur ≈ 0.2)`,
  });

  const clMean = Math.abs(dragCoefficient(hi.fy, uLatHi, dLo));
  const cdHi = dragCoefficient(hi.fx, uLatHi, dLo);
  report({
    name: 'Symmetri (cylinder Cl≈0)',
    pass: clMean < Math.max(0.1, 0.15 * cdHi),
    detail: `|Cl|=${clMean.toFixed(3)}, Cd=${cdHi.toFixed(2)}`,
  });

  // 2: plate vs teardrop at same frontal height
  engine.setShape(makePrimitive('plate'));
  engine.setWindImmediate(0.7);
  engine.reset();
  await runSteps(engine, settleFor(engine));
  const plate = await measure(engine);
  const dPlate = engine.frontalCells;
  const uPlate = engine.currentULat;
  const cdPlate = dragCoefficient(plate.fx, uPlate, dPlate);

  engine.setShape(makePrimitive('teardrop'));
  engine.reset();
  await runSteps(engine, settleFor(engine));
  const tear = await measure(engine);
  const dTear = engine.frontalCells;
  const cdTear = dragCoefficient(tear.fx, uPlate, dTear);

  report({
    name: 'Strømlinjeform (dråbe vs plade)',
    pass: cdTear < 0.5 * cdPlate && cdPlate > 0.5,
    detail: `Cd(plade)=${cdPlate.toFixed(2)}, Cd(dråbe)=${cdTear.toFixed(2)} → forhold ${(cdTear / cdPlate).toFixed(2)} (mål < 0.5), fx=${plate.fx.toFixed(4)}/${tear.fx.toFixed(4)}, solid=${engine.debugSolidCount()}`,
  });

  // 6: stability at max wind
  engine.setShape(makePrimitive('square'));
  engine.setWindImmediate(1);
  engine.reset();
  await runSteps(engine, 6000);
  const stab = await measure(engine, 500);
  report({
    name: 'Stabilitet (max vind, 6500 steps)',
    pass: !stab.anyBad && isFinite(stab.fx) && stab.fx > 0,
    detail: stab.anyBad ? 'blowup detekteret' : `stabil, drag=${stab.fx.toFixed(3)} (lattice)`,
  });
}

export function HarnessPage() {
  const ref = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  const start = async () => {
    if (started.current || !ref.current) return;
    started.current = true;
    setRunning(true);
    const collected: TestResult[] = [];
    const engine = new Engine(ref.current, { onMeasure: () => {} });
    engine.setParams(HARNESS_PARAMS);
    try {
      await runAll(engine, (r) => {
        collected.push(r);
        setResults([...collected]);
      });
    } catch (e) {
      collected.push({ name: 'Harness-fejl', pass: false, detail: String(e) });
      setResults([...collected]);
    } finally {
      engine.dispose();
    }
    setRunning(false);
    setDone(true);
    window.__harness = { done: true, pass: collected.every((r) => r.pass), backend: engine.backendKind, results: collected };
  };

  useEffect(() => {
    if (new URLSearchParams(location.search).get('auto') === '1') void start();
  }, []);

  return (
    <div className="harness">
      <h1>Vindtunnel — fysik-harness</h1>
      <p>Verificerer v²-loven, strømlinjeform-effekten, Strouhal-tal, symmetri og stabilitet.</p>
      <div ref={ref} style={{ position: 'relative', width: 512, height: 256, margin: '12px 0' }} />
      <button className="btn" onClick={() => void start()} disabled={running || done}>
        {running ? 'Kører…' : done ? 'Færdig' : 'Kør tests'}
      </button>
      <table>
        <thead><tr><th>Test</th><th>Resultat</th><th>Detaljer</th></tr></thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td className={r.pass ? 'pass' : 'fail'}>{r.pass ? 'PASS' : 'FAIL'}</td>
              <td>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {done && <p>{results.every((r) => r.pass) ? '✅ Alle tests bestået' : '❌ Nogle tests fejlede'}</p>}
    </div>
  );
}
