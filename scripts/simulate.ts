// ============================================================
// Economy simulation & RTP-ceiling validity report.
//
// Runs on the NATURAL MIX. Measurement only — it does NOT change
// any game logic, paytable, or progress parameters; it reads the
// current defaults and reports. Work is parallelised across CPU
// cores (child processes) so large runs are feasible.
//
// Run:  npm run simulate -- [games] [sensSample] [mainBudget]
//   games       deals in the main pass (default 200)
//   sensSample  deals for the budget-sensitivity table (default min(games,400))
//   mainBudget  solver node budget for the main pass (default = config benchmark budget)
//
// Writes a compact text report to stdout and full numbers to sim-report.json.
// ============================================================

import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import {
  PT,
  PROG,
  CAP,
  PLAYERS,
  emptyHist,
  MainPartial,
  SensPartial,
  mergeMain,
  mergeSens,
  runMainChunk,
  runSensChunk,
} from './simCore';
import { Paytable, roundBucket } from '../src/economy/paytable';
import { DEFAULT_CONFIG } from '../src/store/configStore';

void roundBucket;
void emptyHist;

const argv = process.argv.slice(2);
const GAMES = Number(argv[0] ?? 200);
const SENS_SAMPLE = Number(argv[1] ?? Math.min(GAMES, 400));
const MAIN_BUDGET = Number(argv[2] ?? DEFAULT_CONFIG.benchNodeBudget);
// With a hard round cap, proving (un)solvability is cheap — probe lower budgets.
const SENS_BUDGETS = [100_000, 200_000, 400_000, 800_000];
const WORKERS = Math.max(1, Math.min(cpus().length, 4));

const BUCKETS: (keyof Paytable)[] = [1, 2, 3, 4, 5, '6plus'];
const pct = (n: number, d = 1) => n.toFixed(d);

// ---------- parallel runner ----------

function spawnChunk<T>(mode: 'main' | 'sens', start: number, count: number, budget: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', 'scripts/simChunk.ts', mode, String(start), String(count), String(budget)], {
      cwd: process.cwd(),
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`chunk exit ${code}: ${err.slice(-500)}`));
      const line = out.trim().split('\n').filter(Boolean).pop();
      if (!line) return reject(new Error(`no output from chunk: ${err.slice(-500)}`));
      try {
        resolve(JSON.parse(line) as T);
      } catch (e) {
        reject(new Error(`bad JSON from chunk: ${(e as Error).message}\n${line.slice(0, 200)}`));
      }
    });
  });
}

/** Split [base, base+total) into `WORKERS` ranges and run them in parallel. */
async function runParallel<T>(mode: 'main' | 'sens', base: number, total: number, budget: number): Promise<T[]> {
  // Tiny jobs (or single core): run inline to avoid spawn overhead.
  if (WORKERS === 1 || total <= 8) {
    const r = mode === 'sens' ? runSensChunk(base, total, budget) : runMainChunk(base, total, budget);
    return [r as unknown as T];
  }
  const chunk = Math.ceil(total / WORKERS);
  const jobs: Promise<T>[] = [];
  for (let i = 0; i < WORKERS; i++) {
    const start = base + i * chunk;
    const count = Math.min(chunk, base + total - start);
    if (count <= 0) break;
    jobs.push(spawnChunk<T>(mode, start, count, budget));
  }
  return Promise.all(jobs);
}

// ---------- run ----------

async function main() {
  console.log(
    `Kabale Combo — økonomi/loft-rapport (parallel: ${WORKERS} kerner)\n` +
      `  games=${GAMES}  sensSample=${SENS_SAMPLE}  mainBudget=${MAIN_BUDGET.toLocaleString()} noder  hård runde-cap=${CAP}\n` +
      `  ("unsolvable" = ingen løsning inden for ${CAP} runder)\n` +
      `  mix-tabel + default progress (tærskel ${PROG.progressThreshold}, maks ${PROG.progressMax}, eksp ${PROG.progressExponent})\n`,
  );

  // MAIN PASS
  let t = Date.now();
  const mainParts = await runParallel<MainPartial>('main', 1, GAMES, MAIN_BUDGET);
  const M = mergeMain(mainParts);
  const mainElapsed = (Date.now() - t) / 1000;
  console.log(`  main pass færdig på ${mainElapsed.toFixed(1)}s`);

  // BUDGET SENSITIVITY
  const sensRows: { budget: number; s: SensPartial; seconds: number }[] = [];
  for (const budget of SENS_BUDGETS) {
    t = Date.now();
    const parts = await runParallel<SensPartial>('sens', 1, SENS_SAMPLE, budget);
    const s = mergeSens(parts);
    const seconds = (Date.now() - t) / 1000;
    sensRows.push({ budget, s, seconds });
    console.log(`  sens ${(budget / 1000).toFixed(0)}k færdig på ${seconds.toFixed(1)}s`);
  }
  console.log('');

  // ---------- derived numbers ----------
  const provenCeilingShareOfAll = (M.provenSolvable / GAMES) * 100;
  const ceilProvenRoundRtp = M.provenSolvable ? (M.ceilProvenPayoutSum / M.provenSolvable) * 100 : 0;
  const ceilNaiveRoundRtp = M.allSolvable ? (M.ceilNaivePayoutSum / M.allSolvable) * 100 : 0;

  const printHist = (h: Record<string, number>) => {
    const tot = Object.values(h).reduce((a, b) => a + b, 0) || 1;
    for (const b of BUCKETS) {
      const label = b === '6plus' ? '6+' : String(b);
      console.log(`    ${label.padStart(3)} │ ${String(h[String(b)]).padStart(6)} │ ${pct((h[String(b)] / tot) * 100).padStart(5)}%`);
    }
  };

  console.log(`━━━ 1. DEAL-KLASSIFIKATION (alle ${GAMES} deals @ ${(MAIN_BUDGET / 1000).toFixed(0)}k) ━━━`);
  console.log(`  solvable:   ${M.cls.solvable}  (${pct((M.cls.solvable / GAMES) * 100)}%)`);
  console.log(`  unsolvable: ${M.cls.unsolvable}  (${pct((M.cls.unsolvable / GAMES) * 100)}%)`);
  console.log(`  unknown:    ${M.cls.unknown}  (${pct((M.cls.unknown / GAMES) * 100)}%)`);
  console.log(
    `  blandt solvable: proven=${M.provenSolvable} (${pct(M.allSolvable ? (M.provenSolvable / M.allSolvable) * 100 : 0)}%), ` +
      `unproven=${M.unprovenSolvable} (${pct(M.allSolvable ? (M.unprovenSolvable / M.allSolvable) * 100 : 0)}%)`,
  );
  console.log(
    `\n  ►► NØGLETAL — andel af ALLE deals med BEVIST loft (solvable & proven): ` +
      `${M.provenSolvable}/${GAMES} = ${pct(provenCeilingShareOfAll, 2)}%\n`,
  );

  console.log('━━━ 2. minRounds-FORDELING ━━━');
  console.log('  Beviste (minRoundsProven=true):');
  console.log('    rnd │  antal │ andel');
  printHist(M.provenHist);
  console.log('  Ubeviste (øvre grænse, minRoundsProven=false):');
  console.log('    rnd │  antal │ andel');
  printHist(M.unprovenHist);

  console.log('\n━━━ 3. RTP VED OPTIMALT SPIL (loft) ━━━');
  console.log(`  Bevist loft (kun ${M.provenSolvable} beviste deals, solver spiller minRounds):`);
  console.log(`    runde-RTP=${pct(ceilProvenRoundRtp, 2)}%  progress-RTP=0.00%  total=${pct(ceilProvenRoundRtp, 2)}%`);
  console.log(`  Antaget loft (alle ${M.allSolvable} solvable, stoler naivt på minRounds inkl. ubeviste):`);
  console.log(`    runde-RTP=${pct(ceilNaiveRoundRtp, 2)}%  progress-RTP=0.00%  total=${pct(ceilNaiveRoundRtp, 2)}%`);
  console.log(`  Forskel (antaget − bevist): ${pct(ceilNaiveRoundRtp - ceilProvenRoundRtp, 2)} pp`);
  console.log('  (optimal spiller løser altid solvable deals → progress-RTP = 0)');

  console.log(`\n━━━ 4. RTP FOR SPILLERMODELLER (over alle ${GAMES} deals) ━━━`);
  console.log('  niveau │ solve% │ opgiv% │ runde-RTP │ progr-RTP │ total-RTP');
  console.log('  ───────┼────────┼────────┼───────────┼───────────┼──────────');
  const playerReport: Record<string, Record<string, number>> = {};
  for (const name of Object.keys(PLAYERS)) {
    const p = M.players[name];
    const solvePct = (p.solved / GAMES) * 100;
    const gaveUpPct = (p.gaveUp / GAMES) * 100;
    const roundRtp = (p.roundPayoutSum / GAMES) * 100;
    const progRtp = (p.progressPayoutSum / GAMES) * 100;
    const totalRtp = roundRtp + progRtp;
    playerReport[name] = { solvePct, gaveUpPct, roundRtp, progressRtp: progRtp, totalRtp };
    console.log(
      `  ${name.padEnd(6)} │ ${pct(solvePct).padStart(5)}% │ ${pct(gaveUpPct).padStart(5)}% │ ` +
        `${pct(roundRtp, 2).padStart(8)}% │ ${pct(progRtp, 2).padStart(8)}% │ ${pct(totalRtp, 2).padStart(7)}%`,
    );
  }

  console.log(`\n━━━ 5. BUDGET-FØLSOMHED (${SENS_SAMPLE} deals pr. budget) ━━━`);
  console.log('   budget │ %solv │ %unsolv │ %unkn │ %proven │ gns.noder │ tid');
  console.log('  ────────┼───────┼─────────┼───────┼─────────┼───────────┼──────');
  for (const r of sensRows) {
    const n = SENS_SAMPLE;
    console.log(
      `  ${(r.budget / 1000).toFixed(0).padStart(5)}k │ ${pct((r.s.solvable / n) * 100).padStart(5)} │ ` +
        `${pct((r.s.unsolvable / n) * 100).padStart(7)} │ ${pct((r.s.unknown / n) * 100).padStart(5)} │ ` +
        `${pct((r.s.proven / n) * 100).padStart(7)} │ ${Math.round(r.s.nodesSum / n).toLocaleString().padStart(9)} │ ${r.seconds.toFixed(0)}s`,
    );
  }
  console.log('  (%proven = andel af ALLE deals i sample med bevist loft ved det budget)');

  // ---------- JSON ----------
  const report = {
    meta: {
      games: GAMES,
      sensSample: SENS_SAMPLE,
      mainBudget: MAIN_BUDGET,
      sensBudgets: SENS_BUDGETS,
      maxRoundsCap: CAP,
      workers: WORKERS,
      paytable: PT,
      progress: PROG,
      mainElapsedSeconds: mainElapsed,
      generatedAt: new Date().toISOString(),
    },
    classification: {
      solvable: M.cls.solvable,
      unsolvable: M.cls.unsolvable,
      unknown: M.cls.unknown,
      solvableShare: M.cls.solvable / GAMES,
      provenSolvable: M.provenSolvable,
      unprovenSolvable: M.unprovenSolvable,
      provenShareOfSolvable: M.allSolvable ? M.provenSolvable / M.allSolvable : 0,
      provenCeilingShareOfAll: M.provenSolvable / GAMES,
    },
    minRoundsHistograms: { proven: M.provenHist, unproven: M.unprovenHist },
    ceiling: {
      provenRoundRtp: ceilProvenRoundRtp,
      provenTotalRtp: ceilProvenRoundRtp,
      naiveRoundRtp: ceilNaiveRoundRtp,
      naiveTotalRtp: ceilNaiveRoundRtp,
      assumedMinusProvenPp: ceilNaiveRoundRtp - ceilProvenRoundRtp,
    },
    players: playerReport,
    budgetSensitivity: sensRows.map((r) => ({
      budget: r.budget,
      solvablePct: (r.s.solvable / SENS_SAMPLE) * 100,
      unsolvablePct: (r.s.unsolvable / SENS_SAMPLE) * 100,
      unknownPct: (r.s.unknown / SENS_SAMPLE) * 100,
      provenPctOfAll: (r.s.proven / SENS_SAMPLE) * 100,
      avgNodesVisited: r.s.nodesSum / SENS_SAMPLE,
      seconds: r.seconds,
    })),
  };
  writeFileSync('sim-report.json', JSON.stringify(report, null, 2));
  console.log('\n✓ Skrev sim-report.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
