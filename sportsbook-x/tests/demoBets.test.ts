import { describe, expect, it } from 'vitest';
import { emptyBook, quoteFor, reduceBook, stepOf, type DemoBook } from '../src/state/demoBets';
import { STEP_MS, MOCK_MINUTE_MS, PRICE_STEP_MIN } from '../src/config';
import { priceFromProb } from '../src/odds/model';

const placeSingle = (book: DemoBook, step = 0, stake = 100) => {
  const odds = priceFromProb(0.5, 0.05);
  return reduceBook(book, {
    type: 'place',
    kind: 'single',
    label: 'Hjemme · Kampens vinder',
    selectionId: 'sl-1:1x2:0',
    odds,
    prob: 0.5,
    stake,
    step,
  });
};

describe('demo book', () => {
  it('a placed bet keeps its odds when the market moves', () => {
    const book = placeSingle(emptyBook);
    const bet = book.bets[0];
    const low = quoteFor(bet, 0.3);
    const high = quoteFor(bet, 0.8);
    expect(bet.odds).toBeCloseTo(priceFromProb(0.5, 0.05), 12);
    expect(high).toBeGreaterThan(low);
  });

  it('at placement the cash-out offer is below the stake (the book keeps its margin)', () => {
    const book = placeSingle(emptyBook);
    const bet = book.bets[0];
    expect(quoteFor(bet, bet.prob)).toBeLessThan(bet.stake);
  });

  it('prices depend only on the price step, so a quote holds for the whole step', () => {
    for (let m = 0; m < PRICE_STEP_MIN; m++) expect(stepOf(20 + m)).toBe(stepOf(20));
    expect(stepOf(19)).not.toBe(stepOf(20));
  });

  it('a stale accept gives a requote and pays nothing', () => {
    const book = placeSingle(emptyBook, 0);
    const bet = book.bets[0];
    const next = reduceBook(book, {
      type: 'cashOut',
      betId: bet.id,
      quotedOffer: quoteFor(bet, 0.6),
      quotedStep: 0,
      currentStep: 1,
    });
    expect(next.bets[0].status).toBe('open');
    expect(next.bets[0].cashedOut).toBeNull();
    expect(next.bets[0].requote).toBe(true);
  });

  it('an accept at the same step pays the quoted offer once', () => {
    const book = placeSingle(emptyBook, 2);
    const bet = book.bets[0];
    const offer = quoteFor(bet, 0.6);
    const once = reduceBook(book, { type: 'cashOut', betId: bet.id, quotedOffer: offer, quotedStep: 2, currentStep: 2 });
    expect(once.bets[0].status).toBe('cashed');
    expect(once.bets[0].cashedOut).toBe(offer);
    const twice = reduceBook(once, { type: 'cashOut', betId: bet.id, quotedOffer: offer, quotedStep: 2, currentStep: 2 });
    expect(twice).toBe(once);
  });

  it('combined bets cannot be cashed out in this demo', () => {
    const book = reduceBook(emptyBook, {
      type: 'place',
      kind: 'combined',
      label: 'Kombineret (2 valg)',
      selectionId: null,
      odds: 3.78,
      prob: 0.25,
      stake: 100,
      step: 0,
    });
    const next = reduceBook(book, {
      type: 'cashOut',
      betId: book.bets[0].id,
      quotedOffer: 50,
      quotedStep: 0,
      currentStep: 0,
    });
    expect(next).toBe(book);
    expect(quoteFor(book.bets[0], 0.5)).toBe(0);
  });

  it('a zero stake is ignored', () => {
    expect(placeSingle(emptyBook, 0, 0)).toBe(emptyBook);
  });

  it('reset empties the book', () => {
    const book = placeSingle(placeSingle(emptyBook));
    expect(book.bets).toHaveLength(2);
    expect(reduceBook(book, { type: 'reset' })).toEqual(emptyBook);
  });

  it('odds never refresh faster than every 10 seconds', () => {
    expect(STEP_MS).toBeGreaterThanOrEqual(10_000);
    expect(MOCK_MINUTE_MS * PRICE_STEP_MIN).toBe(STEP_MS);
  });
});
