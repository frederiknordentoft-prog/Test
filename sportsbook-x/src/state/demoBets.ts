import { cashOutOffer } from './betslip';
import { PRICE_STEP_MIN } from '../config';

/**
 * Demo book: local state only. Nothing here is stored, and no money moves.
 * Bets keep the odds and probability they were placed with. Cash-out quotes
 * are re-priced per price step and carry the step they were quoted at.
 */
export interface DemoBet {
  id: number;
  kind: 'single' | 'combined';
  label: string;
  /** Singles only: the selection whose current probability prices the cash-out. */
  selectionId: string | null;
  odds: number;
  prob: number;
  stake: number;
  placedStep: number;
  status: 'open' | 'cashed';
  cashedOut: number | null;
  /** Set when a quote was accepted after the price step had moved on. */
  requote: boolean;
}

export interface DemoBook {
  bets: DemoBet[];
  nextId: number;
}

export const emptyBook: DemoBook = { bets: [], nextId: 1 };

export type BookAction =
  | {
      type: 'place';
      kind: 'single' | 'combined';
      label: string;
      selectionId: string | null;
      odds: number;
      prob: number;
      stake: number;
      step: number;
    }
  | { type: 'cashOut'; betId: number; quotedOffer: number; quotedStep: number; currentStep: number }
  | { type: 'reset' };

/** Price step for a mock minute. Prices depend only on this, so they hold for the whole step. */
export function stepOf(minute: number): number {
  return Math.floor(minute / PRICE_STEP_MIN);
}

/** Cash-out offer for an open single bet at the given current probability. Zero if not cashable. */
export function quoteFor(bet: DemoBet, probNow: number): number {
  if (bet.kind !== 'single' || bet.status !== 'open') return 0;
  return cashOutOffer(bet.stake, bet.odds, probNow);
}

export function reduceBook(book: DemoBook, action: BookAction): DemoBook {
  switch (action.type) {
    case 'place': {
      if (!(action.stake > 0)) return book;
      const bet: DemoBet = {
        id: book.nextId,
        kind: action.kind,
        label: action.label,
        selectionId: action.selectionId,
        odds: action.odds,
        prob: action.prob,
        stake: action.stake,
        placedStep: action.step,
        status: 'open',
        cashedOut: null,
        requote: false,
      };
      return { bets: [...book.bets, bet], nextId: book.nextId + 1 };
    }
    case 'cashOut': {
      const bet = book.bets.find((b) => b.id === action.betId);
      if (!bet || bet.kind !== 'single' || bet.status !== 'open') return book;
      if (action.quotedStep !== action.currentStep) {
        // The price step moved on since the quote was shown. Nothing is paid out.
        return { ...book, bets: book.bets.map((b) => (b.id === action.betId ? { ...b, requote: true } : b)) };
      }
      return {
        ...book,
        bets: book.bets.map((b) =>
          b.id === action.betId ? { ...b, status: 'cashed', cashedOut: action.quotedOffer, requote: false } : b,
        ),
      };
    }
    case 'reset':
      return emptyBook;
  }
}
