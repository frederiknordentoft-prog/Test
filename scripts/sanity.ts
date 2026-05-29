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

// Solver: verify solutions win, round counts match, and minRounds is minimal.
const BUDGET = 400_000;
let solved = 0;
let unknown = 0;
let provenChecked = 0;
const N = 25;
for (let seed = 1; seed <= N; seed++) {
  const g = deal(seed);
  const res = solve(g, BUDGET);
  if (res.status === 'solvable' && res.solution) {
    solved++;
    let cur = g;
    let rounds = 1;
    let allLegal = true;
    for (const m of res.solution) {
      const legal = legalMoves(cur).some((lm) => JSON.stringify(lm) === JSON.stringify(m));
      if (!legal) {
        allLegal = false;
        break;
      }
      cur = applyMove(cur, m);
      if (m.type === 'recycle') rounds++;
    }
    check(`seed ${seed}: solution moves all legal`, allLegal);
    check(`seed ${seed}: solution reaches a win (${foundationCount(cur)}/52)`, isWin(cur));
    check(`seed ${seed}: reported minRounds matches replay`, res.minRounds === rounds);

    // Minimality: if proven, no solution should exist with fewer rounds.
    if (res.minRoundsProven && (res.minRounds ?? 1) > 1) {
      provenChecked++;
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
console.log(`\nSolved ${solved}/${N}, unknown ${unknown}/${N}, minimality-checked ${provenChecked}.`);
check('majority of draw-1 deals solvable within budget', solved >= N * 0.6);
check('at least one proven-minimal benchmark verified', provenChecked >= 1);
