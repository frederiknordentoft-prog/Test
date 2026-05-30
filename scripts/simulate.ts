// ============================================================
// Economy simulation & RTP-ceiling validity report.
//
// Runs on the NATURAL MIX (solvable + impossible deals, kept
// as-is). Measurement only — it does NOT change any game logic,
// paytable, or progress parameters; it reads the current
// defaults and reports.
//
// Run:  npm run simulate -- [games] [sensSample] [mainBudget]
//   games       deals to classify in the main pass (default 200)
//   sensSample  deals for the budget-sensitivity table (default min(games,400))
//   mainBudget  solver node budget for the main pass (default = config benchmark budget)
//
// Writes a compact text report to stdout and the full numbers to
// sim-report.json.
// ============================================================

import { writeFileSync } from 'node:fs';
import { deal } from '../src/engine/klondike';
import { solve } from '../src/solver/solver';
import { playHeuristic, PlayerOpts } from '../src/solver/player';
import { DEFAULT_PAYTABLE_MIX, Paytable, payoutMultiplier, roundBucket } from '../src/economy/paytable';
import { DEFAULT_PROGRESS, progressMultiplier } from '../src/economy/progress';
import { DEFAULT_CONFIG } from '../src/store/configStore';

const argv = process.argv.slice(2);
const GAMES = Number(argv[0] ?? 200);
const SENS_SAMPLE = Number(argv[1] ?? Math.min(GAMES, 400));
const MAIN_BUDGET = Number(argv[2] ?? DEFAULT_CONFIG.benchNodeBudget);
const SENS_BUDGETS = [400_000, 800_000, 1_500_000];

const PT: Paytable = DEFAULT_PAYTABLE_MIX;
const PROG = DEFAULT_PROGRESS;
const BUCKETS: (keyof Paytable)[] = [1, 2, 3, 4, 5, '6plus'];
const bucketKey = (n: number) => String(roundBucket(n));

const PLAYERS: Record<string, Omit<PlayerOpts, 'seed'>> = {
  expert: { errorRate: 0.03, foundationGreed: 0.05, maxRounds: 0 },
  good: { errorRate: 0.12, foundationGreed: 0.2, maxRounds: 0 },
  casual: { errorRate: 0.3, foundationGreed: 0.45, maxRounds: 0 },
};

const pct = (n: number, d = 1) => n.toFixed(d);
const emptyHist = (): Record<string, number> => ({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6plus': 0 });

console.log(
  `Kabale Combo — økonomi/loft-rapport\n` +
    `  games=${GAMES}  sensSample=${SENS_SAMPLE}  mainBudget=${MAIN_BUDGET.toLocaleString()} noder\n` +
    `  mix-tabel + default progress (tærskel ${PROG.progressThreshold}, maks ${PROG.progressMax}, eksp ${PROG.progressExponent})\n`,
);

// =====================================================================
// MAIN PASS — classify GAMES deals + run player models
// =====================================================================

const cls = { solvable: 0, unsolvable: 0, unknown: 0 };
const provenHist = emptyHist();
const unprovenHist = emptyHist();
let provenSolvable = 0;
let unprovenSolvable = 0;

// ceiling accumulators (multiplier units, stake = 1)
let ceilProvenPayoutSum = 0; // over proven-solvable deals, optimal plays minRounds
let ceilNaivePayoutSum = 0; // over ALL solvable deals, trusting their minRounds
let allSolvable = 0;

interface PlayerTally {
  solved: number;
  gaveUp: number;
  roundPayoutSum: number;
  progressPayoutSum: number;
}
const playerTallies: Record<string, PlayerTally> = {};
for (const k of Object.keys(PLAYERS)) playerTallies[k] = { solved: 0, gaveUp: 0, roundPayoutSum: 0, progressPayoutSum: 0 };

const t0 = Date.now();
for (let seed = 1; seed <= GAMES; seed++) {
  const g = deal(seed);
  const res = solve(g, MAIN_BUDGET);
  cls[res.status]++;

  if (res.status === 'solvable' && res.minRounds != null) {
    allSolvable++;
    ceilNaivePayoutSum += payoutMultiplier(PT, true, res.minRounds);
    if (res.minRoundsProven) {
      provenSolvable++;
      provenHist[bucketKey(res.minRounds)]++;
      ceilProvenPayoutSum += payoutMultiplier(PT, true, res.minRounds);
    } else {
      unprovenSolvable++;
      unprovenHist[bucketKey(res.minRounds)]++;
    }
  }

  // Heuristic players (cheap, no solver). Solved -> round paytable; else -> progress.
  for (const [name, opts] of Object.entries(PLAYERS)) {
    const r = playHeuristic(g, { ...opts, seed });
    const t = playerTallies[name];
    if (r.solved) {
      t.solved++;
      t.roundPayoutSum += payoutMultiplier(PT, true, r.rounds);
    } else {
      t.gaveUp++;
      t.progressPayoutSum += progressMultiplier(r.foundationFraction, PROG);
    }
  }

  if (seed % 100 === 0) {
    process.stdout.write(`  main: ${seed}/${GAMES} (${((Date.now() - t0) / 1000).toFixed(0)}s)\r`);
  }
}
const mainElapsed = (Date.now() - t0) / 1000;
console.log(`\n  main pass færdig på ${mainElapsed.toFixed(1)}s\n`);

// =====================================================================
// BUDGET-SENSITIVITY PASS — classify SENS_SAMPLE deals at 3 budgets
// =====================================================================

interface SensRow {
  budget: number;
  solvable: number;
  unsolvable: number;
  unknown: number;
  proven: number; // among solvable
  avgNodes: number;
  seconds: number;
}
const sensRows: SensRow[] = [];
for (const budget of SENS_BUDGETS) {
  const c = { solvable: 0, unsolvable: 0, unknown: 0 };
  let proven = 0;
  let nodesSum = 0;
  const ts = Date.now();
  for (let seed = 1; seed <= SENS_SAMPLE; seed++) {
    const res = solve(deal(seed), budget);
    c[res.status]++;
    nodesSum += res.nodesVisited;
    if (res.status === 'solvable' && res.minRoundsProven) proven++;
    if (seed % 100 === 0) {
      process.stdout.write(
        `  sens ${(budget / 1000).toFixed(0)}k: ${seed}/${SENS_SAMPLE} (${((Date.now() - ts) / 1000).toFixed(0)}s)\r`,
      );
    }
  }
  sensRows.push({
    budget,
    solvable: c.solvable,
    unsolvable: c.unsolvable,
    unknown: c.unknown,
    proven,
    avgNodes: nodesSum / SENS_SAMPLE,
    seconds: (Date.now() - ts) / 1000,
  });
  console.log(`  sens ${(budget / 1000).toFixed(0)}k færdig på ${((Date.now() - ts) / 1000).toFixed(1)}s        `);
}
console.log('');

// =====================================================================
// REPORT
// =====================================================================

const provenCeilingShareOfAll = (provenSolvable / GAMES) * 100;
const ceilProvenRoundRtp = provenSolvable ? (ceilProvenPayoutSum / provenSolvable) * 100 : 0;
const ceilNaiveRoundRtp = allSolvable ? (ceilNaivePayoutSum / allSolvable) * 100 : 0;

function printHist(h: Record<string, number>) {
  const tot = Object.values(h).reduce((a, b) => a + b, 0) || 1;
  for (const b of BUCKETS) {
    const label = b === '6plus' ? '6+' : String(b);
    console.log(`    ${label.padStart(3)} │ ${String(h[String(b)]).padStart(5)} │ ${pct((h[String(b)] / tot) * 100).padStart(5)}%`);
  }
}

console.log('━━━ 1. DEAL-KLASSIFIKATION (alle ' + GAMES + ' deals @ ' + (MAIN_BUDGET / 1000).toFixed(0) + 'k) ━━━');
console.log(`  solvable:   ${cls.solvable}  (${pct((cls.solvable / GAMES) * 100)}%)`);
console.log(`  unsolvable: ${cls.unsolvable}  (${pct((cls.unsolvable / GAMES) * 100)}%)`);
console.log(`  unknown:    ${cls.unknown}  (${pct((cls.unknown / GAMES) * 100)}%)`);
console.log(`  blandt solvable: proven=${provenSolvable} (${pct(allSolvable ? (provenSolvable / allSolvable) * 100 : 0)}%), ` +
  `unproven=${unprovenSolvable} (${pct(allSolvable ? (unprovenSolvable / allSolvable) * 100 : 0)}%)`);
console.log(`\n  ►► NØGLETAL — andel af ALLE deals med BEVIST loft (solvable & proven): ` +
  `${provenSolvable}/${GAMES} = ${pct(provenCeilingShareOfAll, 2)}%\n`);

console.log('━━━ 2. minRounds-FORDELING ━━━');
console.log('  Beviste (minRoundsProven=true):');
console.log('    rnd │ antal │ andel');
printHist(provenHist);
console.log('  Ubeviste (øvre grænse, minRoundsProven=false):');
console.log('    rnd │ antal │ andel');
printHist(unprovenHist);

console.log('\n━━━ 3. RTP VED OPTIMALT SPIL (loft) ━━━');
console.log(`  Bevist loft (kun ${provenSolvable} beviste deals, solver spiller minRounds):`);
console.log(`    runde-RTP=${pct(ceilProvenRoundRtp, 2)}%  progress-RTP=0.00%  total=${pct(ceilProvenRoundRtp, 2)}%`);
console.log(`  Antaget loft (alle ${allSolvable} solvable, stoler naivt på minRounds inkl. ubeviste):`);
console.log(`    runde-RTP=${pct(ceilNaiveRoundRtp, 2)}%  progress-RTP=0.00%  total=${pct(ceilNaiveRoundRtp, 2)}%`);
console.log(`  Forskel (antaget − bevist): ${pct(ceilNaiveRoundRtp - ceilProvenRoundRtp, 2)} pp`);
console.log('  (optimal spiller løser altid solvable deals → progress-RTP = 0)');

console.log('\n━━━ 4. RTP FOR SPILLERMODELLER (over alle ' + GAMES + ' deals) ━━━');
console.log('  niveau │ solve% │ opgiv% │ runde-RTP │ progr-RTP │ total-RTP');
console.log('  ───────┼────────┼────────┼───────────┼───────────┼──────────');
const playerReport: Record<string, any> = {};
for (const name of Object.keys(PLAYERS)) {
  const t = playerTallies[name];
  const solvePct = (t.solved / GAMES) * 100;
  const gaveUpPct = (t.gaveUp / GAMES) * 100;
  const roundRtp = (t.roundPayoutSum / GAMES) * 100;
  const progRtp = (t.progressPayoutSum / GAMES) * 100;
  const totalRtp = roundRtp + progRtp;
  playerReport[name] = { solvePct, gaveUpPct, roundRtp, progressRtp: progRtp, totalRtp };
  console.log(
    `  ${name.padEnd(6)} │ ${pct(solvePct).padStart(5)}% │ ${pct(gaveUpPct).padStart(5)}% │ ` +
      `${pct(roundRtp, 2).padStart(8)}% │ ${pct(progRtp, 2).padStart(8)}% │ ${pct(totalRtp, 2).padStart(7)}%`,
  );
}

console.log('\n━━━ 5. BUDGET-FØLSOMHED (' + SENS_SAMPLE + ' deals pr. budget) ━━━');
console.log('   budget │ %solv │ %unsolv │ %unkn │ %proven │ gns.noder │ tid');
console.log('  ────────┼───────┼─────────┼───────┼─────────┼───────────┼──────');
for (const r of sensRows) {
  const provenPctAll = (r.proven / SENS_SAMPLE) * 100;
  console.log(
    `  ${(r.budget / 1000).toFixed(0).padStart(5)}k │ ${pct((r.solvable / SENS_SAMPLE) * 100).padStart(5)} │ ` +
      `${pct((r.unsolvable / SENS_SAMPLE) * 100).padStart(7)} │ ${pct((r.unknown / SENS_SAMPLE) * 100).padStart(5)} │ ` +
      `${pct(provenPctAll).padStart(7)} │ ${Math.round(r.avgNodes).toLocaleString().padStart(9)} │ ${r.seconds.toFixed(0)}s`,
  );
}
console.log('  (%proven = andel af ALLE deals i sample med bevist loft ved det budget)');

// =====================================================================
// JSON
// =====================================================================

const report = {
  meta: {
    games: GAMES,
    sensSample: SENS_SAMPLE,
    mainBudget: MAIN_BUDGET,
    sensBudgets: SENS_BUDGETS,
    paytable: PT,
    progress: PROG,
    mainElapsedSeconds: mainElapsed,
    generatedAt: new Date().toISOString(),
  },
  classification: {
    ...cls,
    solvableShare: cls.solvable / GAMES,
    provenSolvable,
    unprovenSolvable,
    provenShareOfSolvable: allSolvable ? provenSolvable / allSolvable : 0,
    provenCeilingShareOfAll: provenSolvable / GAMES,
  },
  minRoundsHistograms: { proven: provenHist, unproven: unprovenHist },
  ceiling: {
    provenRoundRtp: ceilProvenRoundRtp,
    provenProgressRtp: 0,
    provenTotalRtp: ceilProvenRoundRtp,
    naiveRoundRtp: ceilNaiveRoundRtp,
    naiveProgressRtp: 0,
    naiveTotalRtp: ceilNaiveRoundRtp,
    assumedMinusProvenPp: ceilNaiveRoundRtp - ceilProvenRoundRtp,
  },
  players: playerReport,
  budgetSensitivity: sensRows.map((r) => ({
    budget: r.budget,
    solvablePct: (r.solvable / SENS_SAMPLE) * 100,
    unsolvablePct: (r.unsolvable / SENS_SAMPLE) * 100,
    unknownPct: (r.unknown / SENS_SAMPLE) * 100,
    provenPctOfAll: (r.proven / SENS_SAMPLE) * 100,
    avgNodesVisited: r.avgNodes,
    seconds: r.seconds,
  })),
};

writeFileSync('sim-report.json', JSON.stringify(report, null, 2));
console.log('\n✓ Skrev sim-report.json');
