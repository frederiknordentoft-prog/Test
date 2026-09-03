/* Finder gevinstkurven: pay[tier][bånd] = base × tierF^tier × sizeF[bånd].
   Måler mod den RIGTIGE motor og skriver den færdige tabel ud, klar til
   at klippe ind i config.js.

   node tools/curve.mjs [--spins 60000] [--target 0.96]
                        [--size 1,4.5,20,90,400] [--tier 1.36]            */

import { SYMBOLS, WILD_MULTIPLIERS, BONUS, REACTOR_STEPS } from '../src/config.js';
import { makeRng } from '../src/rng.js';
import { spinOutcome } from '../src/engine.js';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const SPINS = Number(arg('spins', 60000));
const TARGET = Number(arg('target', 0.96));
const SIZE_F = String(arg('size', '1,4.5,20,90,400')).split(',').map(Number);
const TIER_F = Number(arg('tier', 1.36));
const BET = 25;
if (process.argv.includes('--steps')) {
  BONUS.steps.length = 0;
  BONUS.steps.push(...String(arg('steps', '1,2,3,5,7')).split(',').map(Number));
}
if (process.argv.includes('--spinsfree')) BONUS.freeSpins = Number(arg('spinsfree', 8));

function applyCurve(base) {
  SYMBOLS.forEach(s => {
    const tf = Math.pow(TIER_F, s.tier);
    for (let b = 0; b < 5; b++) s.pays[b] = base * tf * SIZE_F[b];
  });
}

function run(spins, seed, bonus) {
  const rng = makeRng(seed);
  let staked = 0, paid = 0, dead = 0;
  let max = 0, casc = 0;
  const bands = [0, 0, 0, 0, 0, 0, 0, 0];
  const cascHist = new Array(14).fill(0);
  for (let s = 0; s < spins; s++) {
    const r = spinOutcome(rng, { bet: BET, bonus });
    staked += BET; paid += r.totalWin;
    casc += r.steps.length - 1;
    cascHist[Math.min(13, r.steps.length - 1)]++;
    if (r.totalWin === 0) dead++;
    max = Math.max(max, r.totalWin);
    const m = r.totalWin / BET;
    bands[m === 0 ? 0 : m < 1 ? 1 : m < 5 ? 2 : m < 15 ? 3 : m < 60 ? 4 : m < 250 ? 5 : m < 1000 ? 6 : 7]++;
  }
  return {
    rtp: paid / staked, dead: dead / spins, max: max / BET, casc: casc / spins,
    bands: bands.map(b => b / spins), cascHist: cascHist.map(b => b / spins),
  };
}

/* Kalibrer base: RTP er lineær i base, så én måling rækker. */
applyCurve(0.01);
const probe = run(Math.min(SPINS, 30000), 0xc0ffee, false);
const base = 0.01 * (TARGET / probe.rtp);
applyCurve(base);

const main = run(SPINS, 0x51075, false);

/* Bonusrunde: 8 gratisspin, én farve er wild, reaktortrinnet bæres videre. */
function runBonusSessions(sessions, seed) {
  const rng = makeRng(seed);
  const totals = [];
  for (let s = 0; s < sessions; s++) {
    const pool = SYMBOLS.filter(x => x.tier >= Number(arg('mintier', 5)));
    const colour = pool[Math.floor(rng() * pool.length)].id;
    let step = 0, total = 0, spins = BONUS.freeSpins;
    for (let k = 0; k < spins && k < 40; k++) {
      const r = spinOutcome(rng, { bet: BET, bonus: true, wildColor: colour, startStep: step });
      total += r.totalWin;
      step = r.endStep;
      if (r.prismHits >= 3) spins += BONUS.retriggerSpins;
    }
    totals.push(total / BET);
  }
  totals.sort((a, b) => a - b);
  const q = p => totals[Math.min(totals.length - 1, Math.floor(p * totals.length))];
  return {
    mean: totals.reduce((a, b) => a + b, 0) / totals.length,
    median: q(0.5), p90: q(0.9), p99: q(0.99), max: totals[totals.length - 1],
  };
}
const bonusRun = runBonusSessions(3000, 0xb055);

const pct = v => (v * 100).toFixed(2) + '%';
console.log(`gevinstkurve — tierF ${TIER_F}, sizeF [${SIZE_F.join(', ')}], base ${base.toFixed(6)}`);
console.log(`\nBASISSPIL (${SPINS} spins à ${BET} kr.)`);
console.log(`  RTP            ${pct(main.rtp)}`);
console.log(`  døde spins     ${pct(main.dead)}`);
console.log(`  kaskader/spin  ${main.casc.toFixed(2)}`);
console.log(`  største gevinst ${Math.round(main.max)}× indsats`);
console.log(`  fordeling      0×:${pct(main.bands[0])}  <1×:${pct(main.bands[1])}  1-5×:${pct(main.bands[2])}  5-15×:${pct(main.bands[3])}`);
console.log(`                 15-60×:${pct(main.bands[4])}  60-250×:${pct(main.bands[5])}  250-1000×:${pct(main.bands[6])}  1000×+:${pct(main.bands[7])}`);
console.log(`  kaskader       ${main.cascHist.map((v, i) => `${i}:${(v * 100).toFixed(1)}`).slice(0, 10).join('  ')}`);

console.log(`\nBONUSRUNDE — ${BONUS.freeSpins} gratisspin, farve-wilds, multiplikator op til ${BONUS.steps[BONUS.steps.length - 1]}×`);
console.log(`  gennemsnit     ${bonusRun.mean.toFixed(1)}× indsats`);
console.log(`  median         ${bonusRun.median.toFixed(1)}×   p90 ${bonusRun.p90.toFixed(0)}×   p99 ${bonusRun.p99.toFixed(0)}×`);
console.log(`  største af 3000 runder  ${Math.round(bonusRun.max)}× indsats`);

console.log(`\nWild-multiplikatorer: ${WILD_MULTIPLIERS.map(m => `${m.value}× (${m.weight})`).join(', ')}`);

console.log('\n── klip ind i config.js ──\n');
for (const s of SYMBOLS) {
  const pays = s.pays.map(p => (p < 1 ? p.toFixed(3) : p < 10 ? p.toFixed(2) : p.toFixed(1)));
  const pad = n => String(n).padStart(7);
  console.log(`  { id: '${s.id}',${' '.repeat(8 - s.id.length)}name: '${s.name}',${' '.repeat(12 - s.name.length)}tier: ${s.tier}, shape: '${s.shape}',${' '.repeat(10 - s.shape.length)}base: '${s.base}', edge: '${s.edge}', glow: '${s.glow}',`);
  console.log(`    pays: [${pays.map(pad).join(', ')}] },`);
}
