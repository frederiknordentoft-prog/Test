// ============================================================
// Klondike draw-1 solver.
//
// Iterative (explicit-stack) DFS — never recursive, so the deep
// search paths Klondike produces can't overflow the call stack.
//
// It MINIMISES the number of talon rounds (recycles) via
// branch-and-bound: it keeps the best (fewest-round) solution
// found and prunes any branch that can't beat it, plus a
// dominance transposition table (a board reached with fewer
// rounds dominates the same board reached with more). When the
// search completes without hitting the node budget, the reported
// `minRounds` is a PROVEN minimum within the round cap; otherwise
// `minRoundsProven` is false and minRounds is only an upper bound.
//
// Used for: (a) classifying generated deals (solvable / unsolvable
// / unknown), (b) hints, (c) the optimal round benchmark.
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

const DEFAULT_NODE_BUDGET = 600_000;
const SOLVER_MAX_ROUNDS = 8; // hard cap on talon passes considered during search

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

/**
 * Solve a deal, minimising talon rounds. `maxRoundCap` is the hard round cap
 * (0 = unlimited, falls back to SOLVER_MAX_ROUNDS): the search only considers
 * solutions using <= cap talon passes, and "unsolvable" means "no solution
 * within the cap". A small cap makes minimality cheap to prove.
 */
export function solve(
  state: GameState,
  nodeBudget: number = DEFAULT_NODE_BUDGET,
  maxRoundCap: number = SOLVER_MAX_ROUNDS,
): SolveResult {
  const cap = maxRoundCap > 0 ? maxRoundCap : SOLVER_MAX_ROUNDS;
  if (isWin(state)) {
    return { status: 'solvable', solution: [], minRounds: 1, minRoundsProven: true, nodesVisited: 0 };
  }

  // Dominance table: fewest rounds seen to reach a given board hash.
  const bestRoundsAt = new Map<string, number>();
  bestRoundsAt.set(hashState(state), state.rounds);

  let nodes = 0;
  let budgetExceeded = false;
  let best = cap + 1; // accept only solutions with rounds <= cap
  let bestSolution: Move[] | null = null;

  const stack: Frame[] = [
    { state, moves: orderedMoves(state, state.rounds + 1 < best), idx: 0 },
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

    // Branch-and-bound: a solution from here has rounds >= next.rounds, so it
    // can't beat the best found if next.rounds is already >= best.
    if (next.rounds >= best) continue;

    if (isWin(next)) {
      best = next.rounds;
      bestSolution = [...path, m];
      continue; // keep searching for a fewer-round solution
    }

    // Dominance: skip if this board was already reached with <= rounds.
    const key = hashState(next);
    const seen = bestRoundsAt.get(key);
    if (seen !== undefined && seen <= next.rounds) continue;
    bestRoundsAt.set(key, next.rounds);

    path.push(m);
    stack.push({
      state: next,
      moves: orderedMoves(next, next.rounds + 1 < best),
      idx: 0,
    });
  }

  if (bestSolution) {
    return {
      status: 'solvable',
      solution: bestSolution,
      minRounds: best,
      // Proven only if the whole search completed (no branch left unexplored
      // due to the budget). A budget cut means a fewer-round solution might exist.
      minRoundsProven: !budgetExceeded,
      nodesVisited: nodes,
    };
  }
  return {
    status: budgetExceeded ? 'unknown' : 'unsolvable',
    minRoundsProven: false,
    nodesVisited: nodes,
  };
}

/** Replay a solution to count how many talon rounds it consumes. */
export function roundsForSolution(state: GameState, solution: Move[]): number {
  let rounds = 1;
  for (const m of solution) if (m.type === 'recycle') rounds++;
  void state;
  return rounds;
}

/** A single suggested next move for the hint feature (or undefined if none/unknown). */
export function hint(state: GameState, nodeBudget: number = 60_000, maxRounds = 0): Move | undefined {
  const res = solve(state, nodeBudget, maxRounds);
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
