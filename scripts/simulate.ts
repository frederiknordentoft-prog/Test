// ============================================================
// Economy simulation.
//
// 1) Uses the solver as an "optimal player" over many solvable
//    deals to measure the round distribution and the optimal-play
//    RTP ceiling (must stay < 100%).
// 2) Runs a human-like heuristic player at several skill levels
//    over the SAME deals to estimate the *actual* RTP that real
//    players would experience (incl. give-ups), and proposes a
//    paytable tuned so a chosen skill level lands on the target.
//
// Run:  npm run simulate -- [games] [targetRtp%] [nodeBudget] [tuneTo]
//   games    number of solvable deals to collect (default 300)
//   targetRtp target RTP% for the tuned table (default 96)
//   nodeBudget solver budget per deal (default 200000)
//   tuneTo   which level to tune to: optimal|expert|good|casual (default good)
// ============================================================

import { deal } from '../src/engine/klondike';
import { solve } from '../src/solver/solver';
import { playHeuristic, PlayerOpts } from '../src/solver/player';
import { DEFAULT_PAYTABLE, Paytable, roundBucket } from '../src/economy/paytable';

const argv = process.argv.slice(2);
const GAMES = Number(argv[0] ?? 300);
const TARGET_RTP = Number(argv[1] ?? 96);
const NODE_BUDGET = Number(argv[2] ?? 200_000);
const TUNE_TO = (argv[3] ?? 'good') as keyof typeof PLAYERS | 'optimal';

const BUCKETS: (keyof Paytable)[] = [1, 2, 3, 4, 5, '6plus'];

const PLAYERS: Record<string, Omit<PlayerOpts, 'seed'>> = {
  expert: { errorRate: 0.03, foundationGreed: 0.05, maxRounds: 0 },
  good: { errorRate: 0.12, foundationGreed: 0.2, maxRounds: 0 },
  casual: { errorRate: 0.3, foundationGreed: 0.45, maxRounds: 0 },
};

function pct(n: number, d = 1) {
  return n.toFixed(d);
}
function emptyDist(): Record<string, number> {
  return { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6plus': 0 };
}

interface Tally {
  dist: Record<string, number>;
  solved: number;
  played: number;
  roundsSum: number;
}
function newTally(): Tally {
  return { dist: emptyDist(), solved: 0, played: 0, roundsSum: 0 };
}
function record(t: Tally, solved: boolean, rounds: number) {
  t.played++;
  if (solved) {
    t.solved++;
    t.dist[String(roundBucket(rounds))]++;
    t.roundsSum += rounds;
  }
}

console.log(
  `Simulerer ${GAMES} løsbare deals (solver-budget ${NODE_BUDGET.toLocaleString()}) + spillermodeller…\n`,
);

const optimal = newTally();
const players: Record<string, Tally> = {};
for (const k of Object.keys(PLAYERS)) players[k] = newTally();

let attempts = 0;
const t0 = Date.now();

for (let seed = 1; optimal.played < GAMES; seed++) {
  attempts++;
  const g = deal(seed);
  const res = solve(g, NODE_BUDGET);
  if (res.status !== 'solvable' || res.minRounds == null) {
    if (attempts > GAMES * 8) break; // safety valve
    continue;
  }
  record(optimal, true, res.minRounds);
  for (const [name, opts] of Object.entries(PLAYERS)) {
    const r = playHeuristic(g, { ...opts, seed });
    record(players[name], r.solved, r.rounds);
  }
  if (optimal.played % 50 === 0) {
    process.stdout.write(
      `  ${optimal.played}/${GAMES} (${((optimal.played / attempts) * 100).toFixed(0)}% solvable, ${(
        (Date.now() - t0) /
        1000
      ).toFixed(0)}s)\r`,
    );
  }
}
console.log(`\n\nFærdig på ${((Date.now() - t0) / 1000).toFixed(1)}s (${attempts} deals afprøvet).\n`);

// ---- RTP helpers ----
/** Optimal RTP: all solvable deals are won, weighted by the round bucket. */
function distRtp(pt: Paytable, dist: Record<string, number>, denom: number): number {
  let ev = 0;
  for (const b of BUCKETS) ev += (dist[String(b)] / denom) * (pt[b] as number);
  return ev * 100;
}
/** Player RTP: failures pay `fail` (0); winners pay by bucket. Denominator = games played. */
function playerRtp(pt: Paytable, t: Tally): number {
  let ev = 0;
  for (const b of BUCKETS) ev += t.dist[String(b)] * (pt[b] as number);
  ev += (t.played - t.solved) * (pt.fail as number);
  return (ev / t.played) * 100;
}

function printDist(t: Tally) {
  for (const b of BUCKETS) {
    const c = t.dist[String(b)];
    const label = b === '6plus' ? '6+' : String(b);
    const share = t.solved ? (c / t.solved) * 100 : 0;
    console.log(`    ${label.padStart(4)} │ ${String(c).padStart(5)} │ ${pct(share).padStart(5)}%`);
  }
}

// ---- optimal ----
console.log('═══ OPTIMALT SPIL (solver) ═══');
console.log('  Runder │ Antal │ Andel');
printDist(optimal);
const optRtp = distRtp(DEFAULT_PAYTABLE, optimal.dist, optimal.played);
console.log(`  Optimal-RTP (nuværende tabel): ${pct(optRtp, 2)}%`);
console.log(
  optRtp < 100
    ? '  ✓ Under 100% — kan ikke slås ved perfekt spil.\n'
    : '  ✗ Over 100% — spillet er slået!\n',
);

// ---- players ----
console.log('═══ SPILLERMODELLER (estimeret faktisk RTP, nuværende tabel) ═══');
console.log('  Niveau │ Løst%  │ Ø.runder │ Faktisk RTP');
console.log('  ───────┼────────┼──────────┼────────────');
for (const name of Object.keys(PLAYERS)) {
  const t = players[name];
  const solvePct = (t.solved / t.played) * 100;
  const avgR = t.solved ? t.roundsSum / t.solved : 0;
  const rtp = playerRtp(DEFAULT_PAYTABLE, t);
  console.log(
    `  ${name.padEnd(6)} │ ${pct(solvePct).padStart(5)}% │ ${pct(avgR, 2).padStart(8)} │ ${pct(rtp, 2).padStart(9)}%`,
  );
}

// ---- tuned table ----
console.log(`\n═══ FORSLAG: tabel tunet mod "${TUNE_TO}" → ${TARGET_RTP}% ═══`);
const baseRtp =
  TUNE_TO === 'optimal' ? optRtp : playerRtp(DEFAULT_PAYTABLE, players[TUNE_TO as string]);
const k = TARGET_RTP / baseRtp;
const tuned: Paytable = { ...DEFAULT_PAYTABLE };
for (const b of BUCKETS) {
  tuned[b] = (Math.max(0, Math.round((DEFAULT_PAYTABLE[b] as number) * k * 100) / 100)) as never;
}
console.log('  const paytable = {');
for (const b of BUCKETS) {
  const key = b === '6plus' ? `'6plus'` : String(b);
  console.log(`    ${key}: ${tuned[b]},`);
}
console.log('    fail: 0,');
console.log('  };');

const tunedOpt = distRtp(tuned, optimal.dist, optimal.played);
console.log(`\n  Med tunet tabel:`);
console.log(`    Optimal-RTP: ${pct(tunedOpt, 2)}%  ${tunedOpt < 100 ? '✓ < 100%' : '✗ ≥ 100%'}`);
for (const name of Object.keys(PLAYERS)) {
  console.log(`    ${name.padEnd(6)}-RTP: ${pct(playerRtp(tuned, players[name]), 2)}%`);
}
console.log(
  '\nBemærk: spillermodellen er en grov heuristik (ingen dyb søgning, justerbar fejlrate).',
);
console.log('Brug den til at føle på følsomheden — endelig tuning kræver rigtige spil-data.');
