// ============================================================
// Human-like heuristic player.
//
// Plays a game greedily with no deep search: prefers moves that
// reveal face-down cards / safely build foundations, draws through
// the talon when nothing useful is available, and gives up if a
// full pass yields no progress. A configurable error rate and
// "foundation greed" model human imperfection, so we can estimate
// the *actual* (not optimal-ceiling) RTP for a paytable.
// ============================================================

import { GameState, Move, isRed, rankOf, suitOf } from '../engine/types';
import { applyMove, legalMoves, hashState, isWin } from '../engine/klondike';
import { mulberry32 } from '../engine/rng';

export interface PlayerOpts {
  errorRate: number; // 0..1: chance to pick a random worthwhile move instead of the best
  foundationGreed: number; // 0..1: tendency to play cards to foundation even when unsafe
  maxRounds: number; // give up after this many talon passes (0 = no cap, uses safety only)
  seed: number;
}

export interface PlayResult {
  solved: boolean;
  rounds: number;
  moves: number;
}

const WORTH_THRESHOLD = 20;
const MAX_MOVES = 5000;

/** Safe-autoplay rule: low cards, or both opposite-colour foundations are high enough. */
function safeToFoundation(card: number, foundations: GameState['foundations']): boolean {
  const r = rankOf(card);
  if (r <= 2) return true;
  // opposite colour suits: red(1,2) <-> black(0,3)
  const opp = isRed(card) ? [foundations[0], foundations[3]] : [foundations[1], foundations[2]];
  return Math.min(opp[0], opp[1]) >= r - 1;
}

function scoreMove(s: GameState, m: Move, greedUnsafe: boolean): number {
  switch (m.type) {
    case 'tf': {
      const card = s.tableau[m.from].up[s.tableau[m.from].up.length - 1];
      const safe = safeToFoundation(card, s.foundations);
      return safe ? 90 : greedUnsafe ? 95 : 15;
    }
    case 'wf': {
      const card = s.waste[s.waste.length - 1];
      const safe = safeToFoundation(card, s.foundations);
      return safe ? 88 : greedUnsafe ? 95 : 15;
    }
    case 'tt': {
      const fromP = s.tableau[m.from];
      const movesWhole = m.count === fromP.up.length;
      const revealsDown = movesWhole && fromP.down.length > 0;
      const emptiesCol = movesWhole && fromP.down.length === 0;
      if (revealsDown) return 85;
      if (emptiesCol) return 55; // frees a column
      return 22; // partial in-tableau reshuffle
    }
    case 'wt':
      return 50;
    case 'ft':
      return 5;
    default:
      return 0; // draw / recycle handled separately
  }
}

export function playHeuristic(initial: GameState, opts: PlayerOpts): PlayResult {
  const rng = mulberry32(opts.seed >>> 0);
  let s = initial;
  let moves = 0;
  let producedThisPass = false;
  const seen = new Set<string>();

  while (true) {
    if (isWin(s)) return { solved: true, rounds: s.rounds, moves };
    if (++moves > MAX_MOVES) return { solved: false, rounds: s.rounds, moves };

    seen.add(hashState(s));

    const greedUnsafe = rng() < opts.foundationGreed;
    const productive = legalMoves(s).filter((m) => m.type !== 'draw' && m.type !== 'recycle');

    // Evaluate productive moves, skipping ones that loop back to a seen state.
    const worth: { m: Move; next: GameState; score: number }[] = [];
    for (const m of productive) {
      const score = scoreMove(s, m, greedUnsafe);
      if (score < WORTH_THRESHOLD) continue;
      const next = applyMove(s, m);
      if (seen.has(hashState(next))) continue;
      worth.push({ m, next, score });
    }

    if (worth.length > 0) {
      let chosen: GameState;
      if (rng() < opts.errorRate) {
        chosen = worth[Math.floor(rng() * worth.length)].next; // a "mistake"
      } else {
        worth.sort((a, b) => b.score - a.score);
        chosen = worth[0].next;
      }
      s = chosen;
      producedThisPass = true;
      continue;
    }

    // Nothing worthwhile: advance the talon.
    if (s.stock.length > 0) {
      s = applyMove(s, { type: 'draw' });
    } else if (s.waste.length > 0) {
      if (!producedThisPass) return { solved: false, rounds: s.rounds, moves }; // stuck
      if (opts.maxRounds > 0 && s.rounds + 1 > opts.maxRounds)
        return { solved: false, rounds: s.rounds, moves };
      s = applyMove(s, { type: 'recycle' });
      producedThisPass = false;
    } else {
      return { solved: false, rounds: s.rounds, moves }; // no stock, no waste, no move
    }
  }
}

export { suitOf };
