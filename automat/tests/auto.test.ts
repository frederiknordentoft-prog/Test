// Autospin: the pure stop rules (order and boundaries), the loss-limit steps and the run validation.
import { describe, it, expect } from 'vitest';
import { AUTO_COUNTS, AUTO_LIMIT_X, AUTO_GAP, autoLimits, validAuto, autoStopReason, type AutoRun } from '../src/game/auto.ts';
import { AUTO, AUTO_STOPS } from '../src/ui/autoCopy.ts';
import { T } from '../src/present/schedule.ts';

const run = (o: Partial<AutoRun> = {}): AutoRun => ({ total: 25, left: 10, stakeOre: 200, startBalanceOre: 100_000, lossLimitOre: 2000, ...o });
const ctx = (o: Partial<Parameters<typeof autoStopReason>[1]> = {}) => ({ balanceOre: 100_000, stakeOre: 200, perksPending: 0, gambleOpen: false, momentDue: false, ...o });

describe('autoStopReason', () => {
  it('a table of single causes', () => {
    const rows: [AutoRun, ReturnType<typeof ctx>, string | null][] = [
      [run(), ctx(), null],
      [run({ left: 0 }), ctx(), 'done'],
      [run({ left: -1 }), ctx(), 'done'],
      [run(), ctx({ gambleOpen: true }), 'offer'],
      [run(), ctx({ perksPending: 1 }), 'perk'],
      [run(), ctx({ momentDue: true }), 'card'],
      [run(), ctx({ stakeOre: 500 }), 'stake'],
      [run(), ctx({ balanceOre: 199 }), 'balance'],
      [run({ startBalanceOre: 199 }), ctx({ balanceOre: 199 }), 'balance'],
      [run({ startBalanceOre: 200 }), ctx({ balanceOre: 200 }), null],
    ];
    for (const [a, c, want] of rows) expect(autoStopReason(a, c), JSON.stringify([a, c])).toBe(want);
  });
  it('the order: done > offer > perk > card > stake > balance > loss', () => {
    const all = ctx({ gambleOpen: true, perksPending: 1, momentDue: true, stakeOre: 500, balanceOre: 0 });
    expect(autoStopReason(run({ left: 0 }), all)).toBe('done');
    expect(autoStopReason(run(), all)).toBe('offer');
    expect(autoStopReason(run(), { ...all, gambleOpen: false })).toBe('perk');
    expect(autoStopReason(run(), { ...all, gambleOpen: false, perksPending: 0 })).toBe('card');
    expect(autoStopReason(run(), { ...all, gambleOpen: false, perksPending: 0, momentDue: false })).toBe('stake');
    expect(autoStopReason(run({ stakeOre: 500 }), { ...all, gambleOpen: false, perksPending: 0, momentDue: false })).toBe('balance');
  });
  it('loss: stops BEFORE a spin that could take the round past the limit (never after)', () => {
    const a = run({ startBalanceOre: 10_000, lossLimitOre: 2000 }); // 10× of 2 kr
    // lost 18 kr: the next 2 kr can at most make it 20 kr = the limit → allowed
    expect(autoStopReason(a, ctx({ balanceOre: 10_000 - 1800 }))).toBeNull();
    // lost 18,01 kr: the next spin could reach 20,01 kr → stop
    expect(autoStopReason(a, ctx({ balanceOre: 10_000 - 1801 }))).toBe('loss');
    // a win above the start never stops
    expect(autoStopReason(a, ctx({ balanceOre: 50_000 }))).toBeNull();
    // worst case (every spin lost): the loss never exceeds the limit
    for (const x of AUTO_LIMIT_X) {
      const r = run({ total: 100, left: 100, startBalanceOre: 100_000, lossLimitOre: x * 200 });
      let bal = 100_000, spins = 0;
      while (!autoStopReason(r, ctx({ balanceOre: bal }))) { bal -= 200; r.left--; spins++; }
      expect(100_000 - bal).toBeLessThanOrEqual(r.lossLimitOre);
      expect(spins).toBe(Math.min(100, x));
    }
  });
});

describe('autoLimits / validAuto', () => {
  it('the counts, the × stake steps and the gap', () => {
    expect([...AUTO_COUNTS]).toEqual([10, 25, 50, 100]);
    expect([...AUTO_LIMIT_X]).toEqual([10, 25, 50, 100]);
    expect(AUTO_GAP).toBeGreaterThan(0);
    expect(AUTO_GAP).toBeLessThan(T.floor);
  });
  it('limits in øre: × stake, up to the run length (a limit above the whole run could never bind)', () => {
    expect(autoLimits(200, 10)).toEqual([2000]);
    expect(autoLimits(200, 25)).toEqual([2000, 5000]);
    expect(autoLimits(200, 50)).toEqual([2000, 5000, 10_000]);
    expect(autoLimits(200, 100)).toEqual([2000, 5000, 10_000, 20_000]);
    expect(autoLimits(50, 100)).toEqual([500, 1250, 2500, 5000]);
    expect(autoLimits(0, 100)).toEqual([]);
    for (const n of AUTO_COUNTS) expect(autoLimits(200, n).length).toBeGreaterThanOrEqual(1); // a limit always exists
  });
  it('validAuto: a listed count and one of its limits at this stake', () => {
    expect(validAuto(25, 5000, 200)).toBe(true);
    expect(validAuto(10, 2000, 200)).toBe(true);
    expect(validAuto(10, 5000, 200)).toBe(false);
    expect(validAuto(12, 2000, 200)).toBe(false);
    expect(validAuto(25, 4999, 200)).toBe(false);
    expect(validAuto(25, 0, 200)).toBe(false);
    expect(validAuto(25, 5000, 0)).toBe(false);
  });
});

describe('autoCopy', () => {
  it('every stop reason has a line; the button caption and aria carry the queue', () => {
    for (const r of AUTO_STOPS) expect(AUTO.stop(r)).toMatch(/^Autospin (færdig|stoppet)/);
    expect(AUTO.stop('done')).toBe('Autospin færdig');
    expect(AUTO.stop('player')).toBe('Autospin stoppet');
    expect(AUTO.stopCap(12)).toBe('STOP · 12');
    expect(AUTO.stopAria(12)).toBe('Stop autospin. Der er 12 spin i køen.');
    expect(AUTO.summary(25, -1240)).toBe('25 spin · netto −12,40 kr');
    expect(AUTO.limitHint(5000)).toBe('Autospin stopper, før tabet i denne runde bliver større end 50,00 kr.');
    expect(AUTO.rules).toContain('Vælg 10, 25, 50 eller 100 spin');
    expect(AUTO.rules).toContain('mindst 3,0 s');
  });
});
