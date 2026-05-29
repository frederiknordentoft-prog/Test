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

// Solver: try several seeds, verify reported solutions actually win and round counts match.
let solved = 0;
let unknown = 0;
const N = 25;
for (let seed = 1; seed <= N; seed++) {
  const g = deal(seed);
  const res = solve(g, 200_000);
  if (res.status === 'solvable' && res.solution) {
    solved++;
    let cur = g;
    let rounds = 1;
    for (const m of res.solution) {
      const before = legalMoves(cur).some((lm) => JSON.stringify(lm) === JSON.stringify(m));
      if (!before) {
        check(`seed ${seed}: solution move is legal`, false);
        break;
      }
      cur = applyMove(cur, m);
      if (m.type === 'recycle') rounds++;
    }
    check(`seed ${seed}: solution reaches a win (${foundationCount(cur)}/52)`, isWin(cur));
    check(`seed ${seed}: reported minRounds matches replay`, res.minRounds === rounds);
  } else if (res.status === 'unknown') {
    unknown++;
  }
}
console.log(`\nSolved ${solved}/${N}, unknown ${unknown}/${N}`);
check('majority of draw-1 deals solvable within budget', solved >= N * 0.6);
