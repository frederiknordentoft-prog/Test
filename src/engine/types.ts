// ============================================================
// Core domain types for the Klondike (7-kabale) engine.
//
// A card is encoded as a single integer 0..51 for compact state
// hashing and fast solver work:
//   suit = card / 13   (0=spades, 1=hearts, 2=diamonds, 3=clubs)
//   rank = card % 13 + 1  (1=Ace .. 13=King)
// ============================================================

export type CardId = number; // 0..51

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type Suit = (typeof SUITS)[number];

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const RANK_LABEL: Record<number, string> = {
  1: 'A',
  11: 'J',
  12: 'D', // Danish: Knægt(J)/Dame(D)/Konge(K). 12 = Dame (Queen)
  13: 'K',
};

export function suitOf(card: CardId): number {
  return Math.floor(card / 13);
}
export function rankOf(card: CardId): number {
  return (card % 13) + 1;
}
/** true = red (hearts/diamonds), false = black (spades/clubs) */
export function isRed(card: CardId): boolean {
  const s = suitOf(card);
  return s === 1 || s === 2;
}
export function suitName(card: CardId): Suit {
  return SUITS[suitOf(card)];
}
export function rankLabel(card: CardId): string {
  const r = rankOf(card);
  return RANK_LABEL[r] ?? String(r);
}

/** A tableau column: face-down cards (bottom) + face-up cards (top). */
export interface Pile {
  down: CardId[]; // bottom of stack, face-down
  up: CardId[]; // on top, face-up; up[up.length-1] is the visible top card
}

export interface GameState {
  tableau: Pile[]; // 7 columns
  // foundations: top rank per suit, indexed by suit number (0..3). 0 = empty.
  foundations: [number, number, number, number];
  stock: CardId[]; // face-down draw pile; draw from the end
  waste: CardId[]; // face-up; waste[waste.length-1] is the visible top card
  rounds: number; // passes through the talon; starts at 1, +1 on each recycle
}

export type Move =
  | { type: 'draw' } // stock -> waste (draw 1)
  | { type: 'recycle' } // waste -> stock (uses up a round)
  | { type: 'wf'; suit: number } // waste top -> foundation
  | { type: 'wt'; to: number } // waste top -> tableau column `to`
  | { type: 'tf'; from: number } // tableau column top -> foundation
  | { type: 'tt'; from: number; to: number; count: number } // tableau seq -> tableau
  | { type: 'ft'; suit: number; to: number }; // foundation -> tableau column

export interface Deal {
  seed: number;
  /** initial face-down + the deal layout, fully reconstructable from seed */
  state: GameState;
  minRounds?: number; // solver benchmark, if known
}

export interface SolveResult {
  status: 'solvable' | 'unsolvable' | 'unknown';
  solution?: Move[];
  minRounds?: number;
  nodes: number;
}
