/* Kalibrering af LYSBRUD-matematikken.
   Måler forbindelsestæthed, hyppighed, kaskadelængde og RTP, og foreslår
   en skalering af gevinsttabellen så RTP rammer målet.

   node tools/balance.mjs [--spins 20000] [--eps 0.18,0.35,0.5,0.65]
                          [--wild 3.5] [--target 0.96]                    */

import { GEOM, REEL_WEIGHTS, REFILL_WEIGHTS, SYMBOLS, TOTAL_CELLS } from '../src/config.js';
import { makeRng } from '../src/rng.js';
import { createBoard, neighbours, spinOutcome } from '../src/engine.js';

const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i < 0 ? d : process.argv[i + 1];
};

const SPINS = Number(arg('spins', 20000));
const TARGET = Number(arg('target', 0.96));
const EPS_LIST = String(arg('eps', '0.18,0.35,0.5,0.65,0.8')).split(',').map(Number);
const WILD_LIST = String(arg('wild', 'base')).split(',');
const BET = 25;

function averageDegree(rng, samples = 300) {
  let total = 0, n = 0;
  for (let s = 0; s < samples; s++) {
    const b = createBoard(rng, {});
    const nb = neighbours(b);
    for (const [, list] of nb) { total += list.length; n++; }
  }
  return total / n;
}

function scaleWild(factor) {
  if (factor === 'base') return null;
  const f = Number(factor);
  const before = REEL_WEIGHTS.map(w => w.wild);
  REEL_WEIGHTS.forEach(w => { w.wild = w.wild * f; });
  REFILL_WEIGHTS.forEach(w => { w.wild = w.wild * f; });
  return () => {
    REEL_WEIGHTS.forEach((w, i) => { w.wild = before[i]; });
    REFILL_WEIGHTS.forEach((w, i) => { w.wild = before[i]; });
  };
}

function measure(spins) {
  const rng = makeRng(0xbeef);
  let staked = 0, paid = 0, dead = 0, casc = 0, clusters = 0, clusterCells = 0;
  let capped = 0, best = 0;
  const bandHits = { dead: 0, tiny: 0, small: 0, medium: 0, big: 0, mega: 0, epic: 0 };
  const sizeHist = new Map();

  for (let s = 0; s < spins; s++) {
    const r = spinOutcome(rng, { bet: BET });
    staked += BET; paid += r.totalWin;
    if (r.totalWin === 0) dead++;
    const steps = r.steps.length - 1;
    casc += steps;
    if (steps >= 39) capped++;
    best = Math.max(best, r.totalWin);
    for (const st of r.steps) {
      clusters += st.clusters.length;
      for (const c of st.clusters) {
        clusterCells += c.size;
        sizeHist.set(c.size, (sizeHist.get(c.size) || 0) + 1);
      }
    }
    const m = r.totalWin / BET;
    if (m === 0) bandHits.dead++;
    else if (m < 1) bandHits.tiny++;
    else if (m < 5) bandHits.small++;
    else if (m < 15) bandHits.medium++;
    else if (m < 60) bandHits.big++;
    else if (m < 250) bandHits.mega++;
    else bandHits.epic++;
  }

  return {
    rtp: paid / staked,
    deadPct: dead / spins,
    avgCascades: casc / spins,
    avgClusters: clusters / spins,
    avgClusterSize: clusterCells / Math.max(1, clusters),
    cappedPct: capped / spins,
    bestMult: best / BET,
    bands: Object.fromEntries(Object.entries(bandHits).map(([k, v]) => [k, v / spins])),
    sizeHist,
  };
}

const pct = v => (v * 100).toFixed(2) + '%';
const num = (v, d = 2) => v.toFixed(d);

console.log(`LYSBRUD kalibrering — ${TOTAL_CELLS} celler, ${SYMBOLS.length} gems, ${SPINS} spins pr. konfiguration\n`);
console.log('eps    wildW   grad   RTP            død      kask.  klynger  str.   loft     bedste');
console.log('─'.repeat(92));

const rows = [];
for (const eps of EPS_LIST) {
  for (const wf of WILD_LIST) {
    GEOM.overlapEps = eps;
    const restore = scaleWild(wf);
    const deg = averageDegree(makeRng(7), 200);
    const m = measure(SPINS);
    rows.push({ eps, wf, deg, ...m });
    console.log(
      `${num(eps, 2).padEnd(6)} ${String(wf).padEnd(7)} ${num(deg, 2).padEnd(6)} ` +
      `${pct(m.rtp).padEnd(14)} ${pct(m.deadPct).padEnd(8)} ${num(m.avgCascades, 2).padEnd(6)} ` +
      `${num(m.avgClusters, 2).padEnd(8)} ${num(m.avgClusterSize, 1).padEnd(6)} ` +
      `${pct(m.cappedPct).padEnd(8)} ${num(m.bestMult, 0)}×`
    );
    if (restore) restore();
  }
}

/* ---------------------------------------------------- forslag til pays */

console.log('\nGevinstfordeling for hver konfiguration (andel af spins):');
console.log('eps    wildW   død      <1×      1-5×     5-15×    15-60×   60-250×  250×+');
console.log('─'.repeat(92));
for (const r of rows) {
  const b = r.bands;
  console.log(
    `${num(r.eps, 2).padEnd(6)} ${String(r.wf).padEnd(7)} ` +
    [b.dead, b.tiny, b.small, b.medium, b.big, b.mega, b.epic].map(v => pct(v).padEnd(8)).join('')
  );
}

console.log('\nKlyngestørrelser (bedste konfiguration efter død-andel nærmest 35 %):');
const bestRow = rows.reduce((a, b) => Math.abs(b.deadPct - 0.35) < Math.abs(a.deadPct - 0.35) ? b : a);
const hist = [...bestRow.sizeHist.entries()].sort((a, b) => a[0] - b[0]);
const totalC = hist.reduce((s, [, v]) => s + v, 0);
for (const [size, n] of hist) {
  if (size > 30) break;
  console.log(`  ${String(size).padStart(3)}  ${'█'.repeat(Math.round(n / totalC * 160))} ${pct(n / totalC)}`);
}

console.log(`\nAnbefaling: eps=${bestRow.eps}, wildvægt×${bestRow.wf}`);
console.log(`  ved den konfiguration er RTP ${pct(bestRow.rtp)} — gang alle pays med ${num(TARGET / bestRow.rtp, 4)} for at ramme ${pct(TARGET)}.`);
