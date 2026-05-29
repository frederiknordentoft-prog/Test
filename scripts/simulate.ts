// ============================================================
// Economy simulation.
//
// Uses the solver as an "optimal player" over many solvable
// deals to measure the round distribution, then computes the
// RTP at optimal play for the current paytable and proposes a
// tuned paytable that hits a target RTP.
//
// Run:  npm run simulate -- [games] [targetRtp%] [nodeBudget]
//   e.g. npm run simulate -- 800 96 200000
//
// NOTE: the solver reports a near-optimal minimum round count,
// so the resulting RTP is the *optimal-play ceiling*. Real
// players use more rounds -> lower payouts -> lower actual RTP,
// which is why the ceiling must stay < 100%.
// ============================================================

import { deal } from '../src/engine/klondike';
import { solve } from '../src/solver/solver';
import { DEFAULT_PAYTABLE, Paytable, roundBucket } from '../src/economy/paytable';

const argv = process.argv.slice(2);
const GAMES = Number(argv[0] ?? 600);
const TARGET_RTP = Number(argv[1] ?? 96);
const NODE_BUDGET = Number(argv[2] ?? 200_000);

const BUCKETS: (keyof Paytable)[] = [1, 2, 3, 4, 5, '6plus'];

function pct(n: number, d = 1) {
  return n.toFixed(d);
}

console.log(
  `Simulerer ${GAMES} løsbare deals (optimal spiller = solver, node-budget ${NODE_BUDGET.toLocaleString()})…\n`,
);

const dist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6plus': 0 };
let collected = 0;
let attempts = 0;
let unsolvable = 0;
let unknown = 0;
const t0 = Date.now();

// Deterministic sweep over seeds for reproducibility.
for (let seed = 1; collected < GAMES; seed++) {
  attempts++;
  const res = solve(deal(seed), NODE_BUDGET);
  if (res.status === 'solvable' && res.minRounds != null) {
    dist[String(roundBucket(res.minRounds))]++;
    collected++;
    if (collected % 100 === 0) {
      process.stdout.write(
        `  ${collected}/${GAMES} (${((collected / attempts) * 100).toFixed(0)}% solvable, ${(
          (Date.now() - t0) /
          1000
        ).toFixed(0)}s)\r`,
      );
    }
  } else if (res.status === 'unsolvable') {
    unsolvable++;
  } else {
    unknown++;
  }
  if (attempts > GAMES * 6) break; // safety valve
}
const elapsed = (Date.now() - t0) / 1000;

const total = collected;
console.log(`\n\nFærdig på ${elapsed.toFixed(1)}s.`);
console.log(
  `Solvability: ${collected}/${attempts} solvable, ${unsolvable} unsolvable, ${unknown} unknown (budget).\n`,
);

// ---- distribution ----
console.log('Runde-fordeling ved optimalt spil:');
console.log('  Runder │  Antal │   Andel');
console.log('  ───────┼────────┼────────');
for (const b of BUCKETS) {
  const c = dist[String(b)];
  const label = b === '6plus' ? '6+' : String(b);
  console.log(`  ${label.padStart(6)} │ ${String(c).padStart(6)} │ ${pct((c / total) * 100).padStart(6)}%`);
}

// ---- RTP helpers ----
function optimalRtp(pt: Paytable): number {
  let ev = 0;
  for (const b of BUCKETS) {
    ev += (dist[String(b)] / total) * (pt[b] as number);
  }
  return ev * 100; // all solvable deals are won at optimal play
}

const defRtp = optimalRtp(DEFAULT_PAYTABLE);
console.log(`\nRTP ved optimalt spil med NUVÆRENDE tabel: ${pct(defRtp, 2)}%`);
console.log(
  defRtp < 100
    ? '  ✓ Under 100% — spillet kan ikke slås ved optimalt spil.'
    : '  ✗ Over 100% — spillet er slået! Tabellen SKAL sænkes.',
);

// ---- tuned table: scale win multipliers to hit TARGET_RTP ----
const k = TARGET_RTP / defRtp;
const tuned: Paytable = { ...DEFAULT_PAYTABLE };
for (const b of BUCKETS) {
  // round to 2 decimals, keep a sensible floor
  tuned[b] = Math.max(0, Math.round((DEFAULT_PAYTABLE[b] as number) * k * 100) / 100) as never;
}
const tunedRtp = optimalRtp(tuned);

console.log(`\nForslag til tunet tabel (mål ${TARGET_RTP}% ved optimalt spil):`);
console.log('  const paytable = {');
for (const b of BUCKETS) {
  const key = b === '6plus' ? `'6plus'` : String(b);
  console.log(`    ${key}: ${tuned[b]},`);
}
console.log(`    fail: 0,`);
console.log('  };');
console.log(`\n  → Optimal-RTP med tunet tabel: ${pct(tunedRtp, 2)}%`);
console.log(
  '\nBemærk: dette er LOFTET (optimal spiller). Faktisk RTP for menneskelige spillere',
);
console.log('bliver lavere, fordi de bruger flere runder. Brug rigtige spil-data til endelig tuning.');
