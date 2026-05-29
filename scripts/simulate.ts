// ============================================================
// Economy simulation — runs on the NATURAL MIX (solvable +
// impossible deals, kept as-is, like the default game mode).
//
// 1) Classifies each deal with the solver (solvable / unsolvable
//    / unknown) and records the PROVEN minimum-round benchmark.
// 2) Runs a human-like heuristic player at several skill levels
//    over the same deals, paying solved games from the round
//    paytable and unsolved games from the threshold progress
//    payout — to estimate the *actual* RTP.
//
// Run:  npm run simulate -- [games] [targetRtp%] [nodeBudget] [tuneTo]
//   games     deals to simulate (default 200)
//   targetRtp target RTP% for the tuned table (default 96)
//   nodeBudget solver budget per deal (default 400000)
//   tuneTo    level to tune to: optimal|expert|good|casual (default good)
// ============================================================

import { deal } from '../src/engine/klondike';
import { solve } from '../src/solver/solver';
import { playHeuristic, PlayerOpts } from '../src/solver/player';
import {
  DEFAULT_PAYTABLE_MIX,
  Paytable,
  payoutMultiplier,
  roundBucket,
} from '../src/economy/paytable';
import { DEFAULT_PROGRESS, progressMultiplier } from '../src/economy/progress';

const argv = process.argv.slice(2);
const GAMES = Number(argv[0] ?? 200);
const TARGET_RTP = Number(argv[1] ?? 96);
const NODE_BUDGET = Number(argv[2] ?? 400_000);
const TUNE_TO = (argv[3] ?? 'good') as string;

const BUCKETS: (keyof Paytable)[] = [1, 2, 3, 4, 5, '6plus'];

const PLAYERS: Record<string, Omit<PlayerOpts, 'seed'>> = {
  expert: { errorRate: 0.03, foundationGreed: 0.05, maxRounds: 0 },
  good: { errorRate: 0.12, foundationGreed: 0.2, maxRounds: 0 },
  casual: { errorRate: 0.3, foundationGreed: 0.45, maxRounds: 0 },
};

const pt = DEFAULT_PAYTABLE_MIX;
const pct = (n: number, d = 1) => n.toFixed(d);

interface Tally {
  dist: Record<string, number>;
  solved: number;
  played: number;
  roundsSum: number;
  payoutSum: number; // multiplier units (stake = 1)
}
const newTally = (): Tally => ({
  dist: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6plus': 0 },
  solved: 0,
  played: 0,
  roundsSum: 0,
  payoutSum: 0,
});

console.log(
  `Simulerer ${GAMES} deals fra naturligt mix (solver-budget ${NODE_BUDGET.toLocaleString()})…\n`,
);

const optimal = newTally();
const players: Record<string, Tally> = {};
for (const k of Object.keys(PLAYERS)) players[k] = newTally();

const cls = { solvable: 0, unsolvable: 0, unknown: 0 };
let provenSolvable = 0;
const t0 = Date.now();

for (let seed = 1; optimal.played < GAMES; seed++) {
  const g = deal(seed);
  const res = solve(g, NODE_BUDGET);
  cls[res.status]++;

  // Optimal player: solves solvable deals at minRounds; otherwise 0 (the solver
  // doesn't model grinding progress on impossible deals — a slight under-estimate).
  optimal.played++;
  if (res.status === 'solvable' && res.minRounds != null) {
    optimal.solved++;
    optimal.dist[String(roundBucket(res.minRounds))]++;
    optimal.roundsSum += res.minRounds;
    optimal.payoutSum += payoutMultiplier(pt, true, res.minRounds);
    if (res.minRoundsProven) provenSolvable++;
  }

  // Heuristic players: solved -> round paytable; unsolved -> progress payout.
  for (const [name, opts] of Object.entries(PLAYERS)) {
    const r = playHeuristic(g, { ...opts, seed });
    const t = players[name];
    t.played++;
    if (r.solved) {
      t.solved++;
      t.dist[String(roundBucket(r.rounds))]++;
      t.roundsSum += r.rounds;
      t.payoutSum += payoutMultiplier(pt, true, r.rounds);
    } else {
      t.payoutSum += progressMultiplier(r.foundationFraction, DEFAULT_PROGRESS);
    }
  }

  if (optimal.played % 50 === 0) {
    process.stdout.write(`  ${optimal.played}/${GAMES} (${((Date.now() - t0) / 1000).toFixed(0)}s)\r`);
  }
}
console.log(`\n\nFærdig på ${((Date.now() - t0) / 1000).toFixed(1)}s.\n`);

const total = optimal.played;
console.log('═══ DEAL-KLASSIFIKATION ═══');
console.log(`  Løsbare:  ${cls.solvable} (${pct((cls.solvable / total) * 100)}%)`);
console.log(`  Umulige:  ${cls.unsolvable} (${pct((cls.unsolvable / total) * 100)}%)`);
console.log(`  Ukendt:   ${cls.unknown} (${pct((cls.unknown / total) * 100)}%)`);
console.log(
  `  minRounds bevist optimalt: ${provenSolvable}/${optimal.solved} løsbare (${
    optimal.solved ? pct((provenSolvable / optimal.solved) * 100) : '0'
  }%)\n`,
);

function printDist(t: Tally) {
  for (const b of BUCKETS) {
    const c = t.dist[String(b)];
    const label = b === '6plus' ? '6+' : String(b);
    const share = t.solved ? (c / t.solved) * 100 : 0;
    console.log(`    ${label.padStart(4)} │ ${String(c).padStart(5)} │ ${pct(share).padStart(5)}%`);
  }
}
const rtpOf = (t: Tally) => (t.payoutSum / t.played) * 100;

console.log('═══ OPTIMALT SPIL (solver) ═══');
console.log('  Runder │ Antal │ Andel (af løste)');
printDist(optimal);
const optRtp = rtpOf(optimal);
console.log(`  Optimal-RTP (mix, nuværende mix-tabel): ${pct(optRtp, 2)}%`);
console.log(optRtp < 100 ? '  ✓ < 100%\n' : '  ✗ ≥ 100% — spillet er slået!\n');

console.log('═══ SPILLERMODELLER (estimeret faktisk RTP, inkl. progress payout) ═══');
console.log('  Niveau │ Løst%  │ Ø.runder │ RTP');
console.log('  ───────┼────────┼──────────┼────────');
for (const name of Object.keys(PLAYERS)) {
  const t = players[name];
  const solvePct = (t.solved / t.played) * 100;
  const avgR = t.solved ? t.roundsSum / t.solved : 0;
  console.log(
    `  ${name.padEnd(6)} │ ${pct(solvePct).padStart(5)}% │ ${pct(avgR, 2).padStart(8)} │ ${pct(rtpOf(t), 2).padStart(6)}%`,
  );
}

// Tuned table proposal toward the target for the chosen level.
const baseRtp = TUNE_TO === 'optimal' ? optRtp : rtpOf(players[TUNE_TO] ?? optimal);
const k = baseRtp > 0 ? TARGET_RTP / baseRtp : 1;
console.log(`\n═══ FORSLAG: mix-tabel skaleret mod "${TUNE_TO}" → ${TARGET_RTP}% ═══`);
console.log('  const paytableMix = {');
for (const b of BUCKETS) {
  const key = b === '6plus' ? `'6plus'` : String(b);
  console.log(`    ${key}: ${Math.max(0, Math.round((pt[b] as number) * k * 100) / 100)},`);
}
console.log('    fail: 0,');
console.log('  };');
console.log(
  '\nBemærk: heuristik-spilleren er en grov proxy (ingen dyb søgning). Progress payout',
);
console.log('bruger default-tærskel/maks/eksponent. Endelig tuning kræver rigtige spil-data.');
