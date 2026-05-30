// ============================================================
// Klondike (7-kabale), draw-1, standard rules.
// Pure, deterministic state model + legal-move generation.
// ============================================================

import {
  CardId,
  GameState,
  Move,
  Pile,
  isRed,
  rankOf,
  suitOf,
} from './types';
import { shuffledDeck } from './rng';

// ---------- dealing ----------

/** Deal a fresh game from a seed. 7 columns of 1..7 cards, top card up. */
export function deal(seed: number): GameState {
  const deck = shuffledDeck(seed);
  let idx = 0;
  const tableau: Pile[] = [];
  for (let col = 0; col < 7; col++) {
    const down: CardId[] = [];
    for (let k = 0; k < col; k++) down.push(deck[idx++]);
    const up: CardId[] = [deck[idx++]];
    tableau.push({ down, up });
  }
  const stock = deck.slice(idx); // remaining 24 cards
  return {
    tableau,
    foundations: [0, 0, 0, 0],
    stock,
    waste: [],
    rounds: 1,
  };
}

// ---------- cloning ----------

export function cloneState(s: GameState): GameState {
  return {
    tableau: s.tableau.map((p) => ({ down: p.down.slice(), up: p.up.slice() })),
    foundations: [...s.foundations],
    stock: s.stock.slice(),
    waste: s.waste.slice(),
    rounds: s.rounds,
  };
}

// ---------- hashing (for transposition table / loop detection) ----------
// NOTE: `rounds` is intentionally excluded so that recycling back to an
// identical card arrangement is detected as a loop by the solver.

export function hashState(s: GameState): string {
  let h = '';
  for (const p of s.tableau) {
    h += p.down.length + ':' + p.up.join(',') + '|';
  }
  h += '#' + s.foundations.join(',');
  h += '#' + s.stock.join(',');
  h += '#' + s.waste.join(',');
  return h;
}

// ---------- rule helpers ----------

const topUp = (p: Pile): CardId | undefined => p.up[p.up.length - 1];

/** Can `card` be placed on tableau top `onto` (alternating colour, one lower)? */
function canStackTableau(card: CardId, onto: CardId | undefined): boolean {
  if (onto === undefined) return rankOf(card) === 13; // empty column: King only
  return isRed(card) !== isRed(onto) && rankOf(card) === rankOf(onto) - 1;
}

/** Can `card` go onto its foundation given current top rank for its suit? */
function canStackFoundation(card: CardId, foundationTop: number): boolean {
  return rankOf(card) === foundationTop + 1;
}

/** A face-up run starting at index `i` in pile.up must be a valid alternating-down sequence. */
function isValidRun(up: CardId[], startIdx: number): boolean {
  for (let i = startIdx; i < up.length - 1; i++) {
    const a = up[i];
    const b = up[i + 1];
    if (!(isRed(a) !== isRed(b) && rankOf(b) === rankOf(a) - 1)) return false;
  }
  return true;
}

// ---------- legal move generation ----------

/**
 * Legal moves. `maxRounds` (0 = unlimited) is the hard round cap: once the
 * talon has been used `maxRounds` times, recycling (which would start round
 * `maxRounds + 1`) is no longer a legal move.
 */
export function legalMoves(s: GameState, maxRounds = 0): Move[] {
  const moves: Move[] = [];

  // Draw / recycle from the talon.
  if (s.stock.length > 0) {
    moves.push({ type: 'draw' });
  } else if (s.waste.length > 0 && (maxRounds <= 0 || s.rounds < maxRounds)) {
    moves.push({ type: 'recycle' });
  }

  // Waste top -> foundation
  const w = s.waste[s.waste.length - 1];
  if (w !== undefined && canStackFoundation(w, s.foundations[suitOf(w)])) {
    moves.push({ type: 'wf', suit: suitOf(w) });
  }

  // Waste top -> tableau
  if (w !== undefined) {
    for (let to = 0; to < 7; to++) {
      if (canStackTableau(w, topUp(s.tableau[to]))) moves.push({ type: 'wt', to });
    }
  }

  // Tableau top -> foundation
  for (let from = 0; from < 7; from++) {
    const t = topUp(s.tableau[from]);
    if (t !== undefined && canStackFoundation(t, s.foundations[suitOf(t)])) {
      moves.push({ type: 'tf', from });
    }
  }

  // Tableau sequence -> tableau
  for (let from = 0; from < 7; from++) {
    const up = s.tableau[from].up;
    if (up.length === 0) continue;
    // Try moving runs of increasing length (deepest card that forms a valid run).
    for (let startIdx = 0; startIdx < up.length; startIdx++) {
      if (!isValidRun(up, startIdx)) continue;
      const moving = up[startIdx];
      const count = up.length - startIdx;
      for (let to = 0; to < 7; to++) {
        if (to === from) continue;
        // Avoid pointless King-to-empty move from a column whose King is already at the
        // bottom with nothing beneath (no face-down card to reveal, no progress).
        if (
          canStackTableau(moving, topUp(s.tableau[to])) &&
          !(startIdx === 0 && s.tableau[from].down.length === 0 && s.tableau[to].up.length === 0)
        ) {
          moves.push({ type: 'tt', from, to, count });
        }
      }
    }
  }

  // Foundation -> tableau (rarely needed but legal)
  for (let suit = 0; suit < 4; suit++) {
    const top = s.foundations[suit];
    if (top <= 0) continue;
    const card = suit * 13 + (top - 1);
    for (let to = 0; to < 7; to++) {
      if (canStackTableau(card, topUp(s.tableau[to]))) moves.push({ type: 'ft', suit, to });
    }
  }

  return moves;
}

// ---------- move application (immutable) ----------

/** Flip the top face-down card of a pile if it is now exposed. */
function flipIfNeeded(p: Pile): void {
  if (p.up.length === 0 && p.down.length > 0) {
    p.up.push(p.down.pop()!);
  }
}

export function applyMove(state: GameState, m: Move): GameState {
  const s = cloneState(state);
  switch (m.type) {
    case 'draw': {
      s.waste.push(s.stock.pop()!);
      break;
    }
    case 'recycle': {
      // waste -> stock, preserving deal order for the next pass
      s.stock = s.waste.slice().reverse();
      s.waste = [];
      s.rounds += 1;
      break;
    }
    case 'wf': {
      const card = s.waste.pop()!;
      s.foundations[m.suit] = rankOf(card);
      break;
    }
    case 'wt': {
      const card = s.waste.pop()!;
      s.tableau[m.to].up.push(card);
      break;
    }
    case 'tf': {
      const p = s.tableau[m.from];
      const card = p.up.pop()!;
      s.foundations[suitOf(card)] = rankOf(card);
      flipIfNeeded(p);
      break;
    }
    case 'tt': {
      const fromP = s.tableau[m.from];
      const moving = fromP.up.splice(fromP.up.length - m.count, m.count);
      s.tableau[m.to].up.push(...moving);
      flipIfNeeded(fromP);
      break;
    }
    case 'ft': {
      const top = s.foundations[m.suit];
      const card = m.suit * 13 + (top - 1);
      s.foundations[m.suit] = top - 1;
      s.tableau[m.to].up.push(card);
      break;
    }
  }
  return s;
}

// ---------- terminal / scoring ----------

export function isWin(s: GameState): boolean {
  return s.foundations[0] === 13 && s.foundations[1] === 13 && s.foundations[2] === 13 && s.foundations[3] === 13;
}

export function foundationCount(s: GameState): number {
  return s.foundations.reduce((a, b) => a + b, 0);
}

/** Are there any moves that make progress (i.e. not only draw/recycle)? */
export function hasProductiveMove(s: GameState): boolean {
  return legalMoves(s).some((m) => m.type !== 'draw' && m.type !== 'recycle');
}
