// ============================================================
// Klondike draw-1 solver.
//
// DFS with a transposition table (hashState) and a node budget.
// Used for: (a) verifying solvability of generated deals,
// (b) hints, (c) an optimal-ish round benchmark.
//
// "Good enough" for a prototype: draw-1 is far more tractable
// than draw-3. The minRounds it reports is the round count of
// the first solution it finds under a move ordering that avoids
// recycling, so it is a near-optimal benchmark rather than a
// proven minimum.
// ============================================================

import {
  GameState,
  Move,
  SolveResult,
  suitOf,
} from '../engine/types';
import {
  applyMove,
  hashState,
  isWin,
  legalMoves,
} from '../engine/klondike';

const DEFAULT_NODE_BUDGET = 200_000;
const SOLVER_MAX_ROUNDS = 6; // cap talon passes during search

/** Heuristic priority: higher is tried first. */
function moveScore(s: GameState, m: Move): number {
  switch (m.type) {
    case 'tf':
      return 100;
    case 'wf':
      return 95;
    case 'tt': {
      const fromP = s.tableau[m.from];
      const revealsDown = m.count === fromP.up.length && fromP.down.length > 0;
      const emptiesCol = m.count === fromP.up.length && fromP.down.length === 0;
      if (revealsDown) return 90;
      if (emptiesCol) return 60;
      return 30;
    }
    case 'wt':
      return 70;
    case 'draw':
      return 20;
    case 'ft':
      return 5;
    case 'recycle':
      return 1;
  }
}

function orderedMoves(s: GameState, allowRecycle: boolean): Move[] {
  const moves = legalMoves(s).filter((m) => (allowRecycle ? true : m.type !== 'recycle'));
  return moves.sort((a, b) => moveScore(s, b) - moveScore(s, a));
}

interface Frame {
  state: GameState;
  moves: Move[];
  idx: number;
}

// Iterative DFS with an explicit stack (avoids call-stack overflow on the
// deep search paths Klondike can produce) + transposition table + node budget.
export function solve(state: GameState, nodeBudget: number = DEFAULT_NODE_BUDGET): SolveResult {
  if (isWin(state)) return { status: 'solvable', solution: [], minRounds: 1, nodes: 0 };

  const visited = new Set<string>([hashState(state)]);
  let nodes = 0;
  let budgetExceeded = false;

  const stack: Frame[] = [
    { state, moves: orderedMoves(state, state.rounds < SOLVER_MAX_ROUNDS), idx: 0 },
  ];
  const path: Move[] = []; // moves from root to the top frame's state

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.idx >= frame.moves.length) {
      stack.pop();
      path.pop();
      continue;
    }
    const m = frame.moves[frame.idx++];
    const next = applyMove(frame.state, m);

    if (++nodes >= nodeBudget) {
      budgetExceeded = true;
      break;
    }

    const key = hashState(next);
    if (visited.has(key)) continue;
    visited.add(key);

    if (isWin(next)) {
      const solution = [...path, m];
      return { status: 'solvable', solution, minRounds: roundsForSolution(state, solution), nodes };
    }

    path.push(m);
    stack.push({
      state: next,
      moves: orderedMoves(next, next.rounds < SOLVER_MAX_ROUNDS),
      idx: 0,
    });
  }

  return { status: budgetExceeded ? 'unknown' : 'unsolvable', nodes };
}

/** Replay a solution to count how many talon rounds it consumes. */
export function roundsForSolution(state: GameState, solution: Move[]): number {
  let rounds = 1;
  for (const m of solution) if (m.type === 'recycle') rounds++;
  void state;
  return rounds;
}

/** A single suggested next move for the hint feature (or undefined if none/unknown). */
export function hint(state: GameState, nodeBudget: number = 60_000): Move | undefined {
  const res = solve(state, nodeBudget);
  if (res.status === 'solvable' && res.solution && res.solution.length > 0) {
    return res.solution[0];
  }
  // Fall back to any productive move if the solver is unsure.
  const productive = legalMoves(state).find(
    (m) => m.type === 'tf' || m.type === 'wf' || (m.type === 'tt' && reveals(state, m)),
  );
  return productive;
}

function reveals(s: GameState, m: Extract<Move, { type: 'tt' }>): boolean {
  const p = s.tableau[m.from];
  return m.count === p.up.length && p.down.length > 0;
}

export { suitOf };
