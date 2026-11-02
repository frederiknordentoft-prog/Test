import { describe, expect, it } from 'vitest';
import { Book, grade, poolPayout } from '../src/engine/book/portfolio';

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

  describe('exits', () => {
    const held = () => {
      const b = new Book();
      b.buy({ contract: '1x2:F', label: 'FCK vinder', kr: 500, ask: 50, k: 1, t: 1, mid: 0.49 });
      return b;
    };
    it('validates sides of the bid, one of each kind, and a stop against an active buy limit', () => {
      const b = held();
      expect(b.placeExit({ contract: '1x2:F', kind: 'stop', level: 48, bid: 48, k: 2 }).ok).toBe(false);
      expect(b.placeExit({ contract: '1x2:F', kind: 'take', level: 48, bid: 48, k: 2 }).ok).toBe(false);
      expect(b.placeExit({ contract: '1x2:X', kind: 'stop', level: 20, bid: 30, k: 2 }).ok).toBe(false);
      expect(b.placeExit({ contract: '1x2:F', kind: 'stop', level: 35, bid: 48, k: 2 }).ok).toBe(true);
      expect(b.placeExit({ contract: '1x2:F', kind: 'stop', level: 30, bid: 48, k: 3 }).ok).toBe(true);
      expect(b.exits.filter((x) => x.status === 'aktiv')).toHaveLength(1);
      b.placeLimit({ contract: '1x2:F', label: 'FCK vinder', level: 32, kr: 50, k: 4, ask: 50 });
      expect(b.placeExit({ contract: '1x2:F', kind: 'stop', level: 33, bid: 48, k: 5 }).ok).toBe(false);
      expect(b.placeLimit({ contract: '1x2:F', label: 'FCK vinder', level: 29, kr: 50, k: 5, ask: 50 }).ok).toBe(false);
    });
    it('a stop never fires in a halt, right after a reopen, or from a wider spread alone', () => {
      const b = held();
      b.placeExit({ contract: '1x2:F', kind: 'stop', level: 40, bid: 48, k: 2 });
      // Halted.
      expect(b.checkExits(() => ({ ask: 30, bid: 24 }), true, 100, 10, 0)).toHaveLength(0);
      // Within 7 substeps of the reopen.
      expect(b.checkExits(() => ({ ask: 30, bid: 24 }), false, 105, 10, 100)).toHaveLength(0);
      // Spread widened to 6 around an unchanged ask: bid 40, ask 46 → ask − 2 = 44 > 40.
      expect(b.checkExits(() => ({ ask: 46, bid: 40 }), false, 200, 20, 100)).toHaveLength(0);
    });
    it('a stop sells everything at the first bid after the gap, and cancels the take', () => {
      const b = held();
      b.placeExit({ contract: '1x2:F', kind: 'stop', level: 40, bid: 48, k: 2 });
      b.placeExit({ contract: '1x2:F', kind: 'take', level: 75, bid: 48, k: 2 });
      const f = b.checkExits(() => ({ ask: 29, bid: 27 }), false, 120, 12, 100);
      expect(f).toHaveLength(1);
      expect(f[0].fill).toMatchObject({ price: 27, shares: 1000, kr: 270 });
      expect(b.positions.get('1x2:F')!.shares).toBe(0);
      expect(b.exits.find((x) => x.kind === 'take')!.status).toBe('annulleret');
      expect(b.log.at(-1)).toMatchObject({ kind: 'sell', via: 'stop', price: 27 });
      expect(b.saldo).toBeCloseTo(5000 - 500 + 270, 9);
    });
    it('a take fills at the bid, never below the level', () => {
      const b = held();
      b.placeExit({ contract: '1x2:F', kind: 'take', level: 75, bid: 48, k: 2 });
      expect(b.checkExits(() => ({ ask: 76, bid: 74 }), false, 50, 5, 0)).toHaveLength(0);
      const f = b.checkExits(() => ({ ask: 79, bid: 77 }), false, 51, 5, 0);
      expect(f[0].fill!.price).toBe(77);
    });
    it('exits are cleared when the shares reach zero by a sale or a settlement', () => {
      const b = held();
      b.placeExit({ contract: '1x2:F', kind: 'stop', level: 30, bid: 48, k: 2 });
      b.sell({ contract: '1x2:F', shares: 1000, bid: 48, k: 3, t: 1 });
      expect(b.exits[0].status).toBe('annulleret');
      const c = held();
      c.placeExit({ contract: '1x2:F', kind: 'take', level: 80, bid: 48, k: 2 });
      c.settle('1x2:F', 100, 9, 93);
      expect(c.exits[0].status).toBe('annulleret');
    });
    it('suggests levels on the right side of the bid, within 1..99', () => {
      expect(Book.exitSuggestion(50, 48)).toEqual({ stop: 35, take: 75 });
      expect(Book.exitSuggestion(10, 4)).toEqual({ stop: 1, take: 35 });
      expect(Book.exitSuggestion(90, 95)).toEqual({ stop: 75, take: 99 });
    });
  });

  describe('pool', () => {
    it('pays winning stake ÷ winning side × pool × 0.9, with the user in the sides', () => {
      const r = poolPayout([100, 0, 0], [5000, 3000, 2000], 0);
      expect(r.refund).toBe(false);
      expect(r.payout).toBeCloseTo((100 / 5100) * 10100 * 0.9, 9);
      expect(poolPayout([100, 0, 0], [5000, 3000, 2000], 1).payout).toBe(0);
    });
    it('a lone winner takes the pool less the take; an empty winning side refunds', () => {
      expect(poolPayout([0, 50, 0], [100, 0, 100], 1)).toEqual({ payout: 0.9 * 250, refund: false });
      expect(poolPayout([20, 0, 30], [100, 0, 100], 1)).toEqual({ payout: 50, refund: true });
    });
    it('stakes leave the saldo, settle once, and count in the totals', () => {
      const b = new Book();
      expect(b.stakePool({ side: 2, kr: 200, k: 1, t: 5, label: 'Puljen: BIF' }).ok).toBe(true);
      expect(b.stakePool({ side: 2, kr: 2000, k: 1, t: 5, label: 'Puljen: BIF' }).ok).toBe(false);
      expect(b.saldo).toBe(4800);
      const r = b.settlePool(2, [6000, 2000, 1800], 9, 93, 'Puljen');
      expect(r!.payout).toBeCloseTo((200 / 2000) * 10000 * 0.9, 9);
      expect(b.settlePool(2, [6000, 2000, 1800], 10, 93, 'Puljen')).toBeNull();
      expect(b.saldo).toBeCloseTo(4800 + 900, 9);
      expect(b.totals()).toEqual({ staked: 200, paidOut: 900 });
      expect(b.stakePool({ side: 0, kr: 10, k: 11, t: 93, label: 'x' }).ok).toBe(false);
    });
  });
});
