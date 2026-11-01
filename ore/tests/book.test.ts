import { describe, expect, it } from 'vitest';
import { Book, grade } from '../src/engine/book/portfolio';

describe('book', () => {
  it('buys whole shares: 250 kr at 49 øre is 510 shares for 249,90 kr', () => {
    const b = new Book();
    const r = b.buy({ contract: '1x2:F', label: 'FCK vinder', kr: 250, ask: 49, k: 1, t: 0.5, mid: 0.48 });
    expect(r).toEqual({ ok: true, shares: 510, cost: 249.9 });
    expect(b.saldo).toBeCloseTo(5000 - 249.9, 9);
  });
  it('sells at the bid and keeps the average cost of the rest', () => {
    const b = new Book();
    b.buy({ contract: 'c', label: 'c', kr: 100, ask: 50, k: 1, t: 1, mid: 0.5 });
    const r = b.sell({ contract: 'c', shares: 100, bid: 60, k: 2, t: 2 });
    expect(r).toEqual({ ok: true, kr: 60 });
    const p = b.positions.get('c')!;
    expect(p.shares).toBe(100);
    expect(p.cost).toBeCloseTo(50, 9);
  });
  it('limit orders reserve funds, never fill in a halt, and fill at the first ask after a gap', () => {
    const b = new Book();
    b.placeLimit({ contract: 'c', label: 'c', level: 35, kr: 100, k: 1, ask: 50 });
    expect(b.available).toBe(4900);
    expect(b.checkLimits(() => ({ ask: 26, mid: 0.25 }), true, 2, 1)).toHaveLength(0);
    const f = b.checkLimits(() => ({ ask: 26, mid: 0.25 }), false, 3, 1);
    expect(f[0].fill).toMatchObject({ price: 26, shares: 384, gapBetter: 9 });
    expect(b.saldo).toBeCloseTo(5000 - 99.84, 9);
    expect(b.available).toBeCloseTo(b.saldo, 9);
  });
  it('rejects a limit above the current ask and a fourth active limit', () => {
    const b = new Book();
    expect(b.placeLimit({ contract: 'c', label: 'c', level: 55, kr: 50, k: 1, ask: 50 }).ok).toBe(false);
    for (let i = 0; i < 3; i++) expect(b.placeLimit({ contract: 'c', label: 'c', level: 30 + i, kr: 50, k: 1, ask: 50 }).ok).toBe(true);
    expect(b.placeLimit({ contract: 'c', label: 'c', level: 20, kr: 50, k: 1, ask: 50 }).ok).toBe(false);
  });
  it('settles to 100 or 0 and books the payout', () => {
    const b = new Book();
    b.buy({ contract: 'c', label: 'c', kr: 250, ask: 49, k: 1, t: 1, mid: 0.48 });
    b.settle('c', 100, 9, 93);
    expect(b.saldo).toBeCloseTo(5000 - 249.9 + 510, 9);
    expect(b.totals()).toEqual({ staked: 249.9, paidOut: 510 });
  });
  it('grades a buy by closing-line value net of time', () => {
    expect(grade(0.48, 0.6, 0.48, 0.47).grade).toBe('Brillant !!');
    expect(grade(0.48, 0.47, 0.48, 0.47).grade).toBe('Præcist');
    expect(grade(0.48, 0.3, 0.48, 0.47).grade).toBe('Fejlkøb ??');
  });
});
