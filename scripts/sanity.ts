// Quick correctness sanity check for the engine + solver.
import { deal, applyMove, isWin, legalMoves, foundationCount } from '../src/engine/klondike';
import { solve } from '../src/solver/solver';

function check(name: string, cond: boolean) {
  console.log(`${cond ? '✓' : '✗ FAIL'}  ${name}`);
  if (!cond) process.exitCode = 1;
}

// Deal integrity: 52 unique cards across all zones.
const s = deal(12345);
const all = [
  ...s.stock,
  ...s.waste,
  ...s.tableau.flatMap((p) => [...p.down, ...p.up]),
];
check('deal has 52 cards', all.length === 52);
check('deal cards unique', new Set(all).size === 52);
check('stock has 24', s.stock.length === 24);
check('tableau column k has k+1 cards', s.tableau.every((p, i) => p.down.length + p.up.length === i + 1));
check('each column has exactly one face-up', s.tableau.every((p) => p.up.length === 1));

// Solver with a hard round cap: verify solutions win, round counts match,
// minRounds is minimal, and that the cap makes the benchmark provable.
const BUDGET = 400_000;
const CAP = 3; // hard round cap (matches game default)
let solved = 0;
let unknown = 0;
let proven = 0;
let minimalityChecked = 0;
const N = 25;
for (let seed = 1; seed <= N; seed++) {
  const g = deal(seed);
  const res = solve(g, BUDGET, CAP);
  if (res.status === 'solvable' && res.solution) {
    solved++;
    if (res.minRoundsProven) proven++;
    let cur = g;
    let rounds = 1;
    let allLegal = true;
    for (const m of res.solution) {
      const legal = legalMoves(cur, CAP).some((lm) => JSON.stringify(lm) === JSON.stringify(m));
      if (!legal) {
        allLegal = false;
        break;
      }
      cur = applyMove(cur, m);
      if (m.type === 'recycle') rounds++;
    }
    check(`seed ${seed}: solution moves all legal (cap ${CAP})`, allLegal);
    check(`seed ${seed}: solution reaches a win (${foundationCount(cur)}/52)`, isWin(cur));
    check(`seed ${seed}: solution uses <= ${CAP} rounds`, rounds <= CAP);
    check(`seed ${seed}: reported minRounds matches replay`, res.minRounds === rounds);

    // Minimality: if proven, no solution should exist with fewer rounds.
    if (res.minRoundsProven && (res.minRounds ?? 1) > 1) {
      minimalityChecked++;
      const tighter = solve(g, BUDGET, (res.minRounds as number) - 1);
      check(
        `seed ${seed}: no solution with < ${res.minRounds} rounds (minRounds is minimal)`,
        tighter.status !== 'solvable',
      );
    }
  } else if (res.status === 'unknown') {
    unknown++;
  }
}
console.log(
  `\nCap ${CAP} @ ${BUDGET / 1000}k: solved ${solved}/${N}, unknown ${unknown}/${N}, ` +
    `proven ${proven}/${solved}, minimality-checked ${minimalityChecked}.`,
);
check('a fair share of deals classified solvable within cap', solved >= N * 0.4);
// NOTE: the cap bounds depth but NOT per-pass tableau branching, so proving
// minRounds stays expensive — only some solvable deals are proven at this budget.
// (See PROJECT_SUMMARY: the cap is a game rule, not a provability fix.)
check('at least one proven benchmark under the cap', proven >= 1);
check('proven benchmark minimality holds', minimalityChecked >= 1);
