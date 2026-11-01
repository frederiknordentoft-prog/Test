import { describe, expect, it } from 'vitest';
import { bo3Win, impliedSum, poissonPmf, priceFromProb, probsFromState } from '../src/odds/model';
import { formatOdds } from '../src/odds/format';
import { generateFeed, probsAt, probSeries, stateAt } from '../src/odds/feed';
import { combinedOdds, combinedProb, cashOutOffer, potentialReturn, type SlipSelection } from '../src/state/betslip';

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('poisson', () => {
  it('sums to ~1 and matches a known value', () => {
    let s = 0;
    for (let k = 0; k < 60; k++) s += poissonPmf(k, 2.3);
    close(s, 1, 1e-9);
    close(poissonPmf(0, 2), Math.exp(-2));
    close(poissonPmf(3, 2), (8 / 6) * Math.exp(-2));
  });
  it('handles lambda 0 exactly', () => {
    expect(poissonPmf(0, 0)).toBe(1);
    expect(poissonPmf(1, 0)).toBe(0);
  });
});

describe('probsFromState', () => {
  it('each market pair sums to 1 pre-match', () => {
    const p = probsFromState(0, 0, 1.55, 1.15);
    close(p.home + p.draw + p.away, 1);
    close(p.over25 + p.under25, 1);
    close(p.bttsYes + p.bttsNo, 1);
  });
  it('conditions on the score: a 2-0 lead late in the match is a near-certain home win', () => {
    const p = probsFromState(2, 0, 0.05, 0.05);
    expect(p.home).toBeGreaterThan(0.99);
  });
  it('with no goals left to come, the result is deterministic', () => {
    const p = probsFromState(1, 1, 0, 0);
    close(p.draw, 1);
    close(p.home, 0);
    close(p.bttsYes, 1);
  });
});

describe('pricing and implied probability', () => {
  it('a 50/50 at 5% margin prices each side at about 1.90', () => {
    const o = priceFromProb(0.5, 0.05);
    expect(o).toBeCloseTo(1.9, 1);
    expect(impliedSum([o, o])).toBeGreaterThan(1.04);
  });
  it('the -110/-110 example: 1.91 each gives 104.71 % implied (exact, not rounded)', () => {
    close(impliedSum([1.91, 1.91]), 2 / 1.91, 1e-12);
    expect((impliedSum([1.91, 1.91]) * 100).toFixed(2)).toBe('104.71');
  });
  it('bo3 probability from 56 % per map', () => {
    close(bo3Win(0.5), 0.5);
    close(bo3Win(0.56), 0.56 * 0.56 * (3 - 2 * 0.56));
    expect(bo3Win(0.56)).toBeGreaterThan(0.56);
  });
});

describe('odds formatting', () => {
  it('decimal uses a comma', () => {
    expect(formatOdds(1.91, 'decimal')).toBe('1,91');
  });
  it('fraction and american for a few values', () => {
    expect(formatOdds(2, 'fraction')).toBe('1/1');
    expect(formatOdds(2, 'american')).toBe('+100');
    expect(formatOdds(1.5, 'american')).toBe('-200');
  });
});

describe('seeded feed', () => {
  it('is deterministic for the same seed', () => {
    const a = generateFeed('sl-1-2026', 1.55, 1.15);
    const b = generateFeed('sl-1-2026', 1.55, 1.15);
    expect(a).toEqual(b);
  });
  it('differs for a different seed', () => {
    const a = generateFeed('sl-1-2026', 1.55, 1.15);
    const b = generateFeed('cl-1-2026', 1.55, 1.15);
    expect(a).not.toEqual(b);
  });
  it('state at full time equals the final score in the feed', () => {
    const feed = generateFeed('pl-1-2026', 1.45, 1.6);
    const s = stateAt(feed, 90);
    expect(s.h).toBe(feed.filter((e) => e.kind === 'goal' && e.side === 'h').length);
    expect(s.a).toBe(feed.filter((e) => e.kind === 'goal' && e.side === 'a').length);
  });
  it('the probability series ends in a deterministic result', () => {
    const feed = generateFeed('sl-1-2026', 1.55, 1.15);
    const series = probSeries(feed, 1.55, 1.15);
    expect(series).toHaveLength(91);
    const end = probsAt(feed, 1.55, 1.15, 90);
    expect(end.home === 1 || end.home === 0 || end.draw === 1).toBe(true);
  });
});

describe('bet slip maths', () => {
  const legs: SlipSelection[] = [
    { id: 'a', marketId: 'm1', label: 'A', odds: 1.8, prob: 0.55 },
    { id: 'b', marketId: 'm2', label: 'B', odds: 2.1, prob: 0.46 },
  ];
  it('combined odds and probability are products of the legs', () => {
    close(combinedOdds(legs), 3.78);
    close(combinedProb(legs), 0.253);
  });
  it('potential return = stake x combined odds, to the cent', () => {
    expect(potentialReturn(100, legs)).toBe(378);
  });
  it('a cash-out offer on a fresh bet is below the stake (the book keeps its margin)', () => {
    const stake = 100;
    const odds = 1.91;
    const fairProb = 1 / (odds * 1.05);
    expect(cashOutOffer(stake, odds, fairProb)).toBeLessThan(stake);
  });
  it('cash-out offer rises as the bet becomes more likely to win', () => {
    expect(cashOutOffer(100, 2, 0.8)).toBeGreaterThan(cashOutOffer(100, 2, 0.4));
  });
});

describe('feed calibration', () => {
  it('average goals over many seeds match the model expectation within 5 %', () => {
    const N = 2000;
    let home = 0;
    let away = 0;
    for (let i = 0; i < N; i++) {
      const f = generateFeed(`calib-${i}`, 1.55, 1.15);
      home += f.filter((e) => e.kind === 'goal' && e.side === 'h').length;
      away += f.filter((e) => e.kind === 'goal' && e.side === 'a').length;
    }
    const expectedHome = (88 * 1.55) / 90;
    const expectedAway = (88 * 1.15) / 90;
    expect(Math.abs(home / N - expectedHome) / expectedHome).toBeLessThan(0.05);
    expect(Math.abs(away / N - expectedAway) / expectedAway).toBeLessThan(0.05);
  });
});
