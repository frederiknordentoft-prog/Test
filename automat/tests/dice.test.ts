// Terningen · the pure rule, the store's single mutator, the formatters and the award timing helpers.
import { describe, it, expect } from 'vitest';
import { DICE_GOAL, DICE_MIN_X, diceFor, diceDefaults, addDie, fmtDice, diceWord, realDiceView, previewDiceView, PREVIEW_STEPS } from '../src/game/dice.ts';
import { dieBirthAt, celebrateEndWithDie, TIER_SECS, winTier } from '../src/present/schedule.ts';
import { spinBase } from '../src/math/engine.ts';
import { spinRng } from '../src/math/rng.ts';

describe('diceFor: ≥ 10× the stake the spin was evaluated at (integer øre, exact)', () => {
  it('boundaries', () => {
    expect(DICE_MIN_X).toBe(10);
    expect(diceFor(1000, 100)).toBe(true);
    expect(diceFor(999, 100)).toBe(false);
    expect(diceFor(500, 50)).toBe(true);
    expect(diceFor(499, 50)).toBe(false);
    // storm stake 200
    expect(diceFor(2000, 200)).toBe(true);
    expect(diceFor(1999, 200)).toBe(false);
    expect(diceFor(1000, 0)).toBe(false);
    expect(diceFor(0, 0)).toBe(false);
  });
  it('every die spin is a WIN (tier ≥ 2): the LDW rule holds by construction', () => {
    let n = 0;
    for (let i = 1; i <= 20000; i++) {
      const r = spinBase(spinRng(4242, 'base', i), 200);
      if (!diceFor(r.totalOre, r.stakeOre)) continue;
      n++;
      expect(r.totalOre).toBeGreaterThan(r.stakeOre);
      expect(winTier(r.totalOre, r.stakeOre)).toBeGreaterThanOrEqual(2);
    }
    expect(n).toBeGreaterThan(20);
  });
});

describe('formatting', () => {
  it('fmtDice prints plain digits up to 9999 ("1948", never "1.948")', () => {
    expect(fmtDice(0)).toBe('0');
    expect(fmtDice(1948)).toBe('1948');
    expect(fmtDice(9999)).toBe('9999');
    expect(fmtDice(10000)).toBe('10.000');
  });
  it('diceWord', () => {
    expect(diceWord(1)).toBe('terning');
    for (const n of [0, 2, 37, 1948]) expect(diceWord(n)).toBe('terninger');
  });
});

describe('DiceStore and addDie (THE only mutator)', () => {
  it('defaults: count 0, flags false, unlock none', () => {
    expect(diceDefaults(0xdeadbeef)).toEqual({ v: 1, count: 0, seed: 0xdeadbeef, firstAt: null, lastAt: null, helloSeen: false, introSeen: false, unlock: 'none', offered: false, unlockedAt: null });
    expect(diceDefaults(-1).seed).toBe(0xffffffff);
  });
  it('increments and returns the accession number; firstAt is set once', () => {
    const d = diceDefaults(1);
    expect(addDie(d, 1000)).toBe(1);
    expect(d.firstAt).toBe(1000);
    expect(d.lastAt).toBe(1000);
    expect(addDie(d, 2000)).toBe(2);
    expect(d.firstAt).toBe(1000);
    expect(d.lastAt).toBe(2000);
  });
  it("unlock becomes 'pending' exactly on 1947 → 1948, 'seen' is never reverted, and the count continues", () => {
    const d = diceDefaults(1);
    d.count = 1946;
    addDie(d, 1);
    expect(d.count).toBe(1947);
    expect(d.unlock).toBe('none');
    expect(addDie(d, 2)).toBe(DICE_GOAL);
    expect(d.unlock).toBe('pending');
    addDie(d, 3);
    expect(d.unlock).toBe('pending');
    d.unlock = 'seen';
    for (let i = 0; i < 62; i++) addDie(d, 4 + i);
    expect(d.count).toBe(2011);
    expect(d.unlock).toBe('seen');
    expect(d.offered).toBe(false); // addDie never touches the card / ceremony flags
    expect(d.unlockedAt).toBeNull();
  });
});

describe('DiceView (what renderers read)', () => {
  it('the real view copies count and unlock only', () => {
    const d = diceDefaults(7);
    d.count = 37;
    expect(realDiceView(d)).toEqual({ count: 37, unlock: 'none', mode: 'real' });
  });
  it('fixed preview steps: no 1947, no slider; 1948 previews the OPEN gate (never the pending image)', () => {
    expect([...PREVIEW_STEPS]).toEqual([0, 25, 250, 1000, 1948]);
    for (const n of PREVIEW_STEPS) {
      const v = previewDiceView(n);
      expect(v.mode).toBe('preview');
      expect(v.unlock).toBe(n >= DICE_GOAL ? 'seen' : 'none');
    }
    expect(previewDiceView(1948, 'demo').mode).toBe('demo');
  });
});

describe('award timing (schedule helpers; schedule() itself has no dice input)', () => {
  it('dieBirthAt: tiers 2–5 = 1.5 / 2.5 / 5.5 / 8.5 s, after the title slam and the count-up', () => {
    expect([2, 3, 4, 5].map(dieBirthAt).map((x) => +x.toFixed(6))).toEqual([1.5, 2.5, 5.5, 8.5]);
    for (const t of [2, 3, 4, 5]) {
      expect(dieBirthAt(t)).toBeGreaterThanOrEqual(1.0); // the title slam is 0,05–0,60 s
      const countUpEnd = 0.3 + Math.max(0.6, TIER_SECS[t] - 0.4);
      expect(dieBirthAt(t)).toBeGreaterThanOrEqual(countUpEnd - 0.4);
    }
  });
  it('celebrateEndWithDie: tier 2 = 2.7 s, tier 3 = 3.7 s (the die has time to be seen)', () => {
    expect(celebrateEndWithDie(2)).toBeCloseTo(2.7, 9);
    expect(celebrateEndWithDie(3)).toBeCloseTo(3.7, 9);
    for (const t of [2, 3, 4, 5]) expect(celebrateEndWithDie(t)).toBeGreaterThanOrEqual(dieBirthAt(t) + 1.2 - 1e-9);
  });
});

// src/render/chamber/gateLattice.ts (pure) belongs to the GateView build and does not exist yet.
describe('gateLattice / gateOrder (deferred to the GateView build)', () => {
  it.todo('gateLattice: exactly 1948 tiles, 974 per leaf, all inside the arch with the border margin; golden hash of the coordinates');
  it.todo('gateOrder: a permutation of 0..1947, deterministic per seed, seeds differ, golden hash for seed 1');
  it.todo('gateOrder: no predictable last tile — over 200 seeds order[1947] falls in ≥ 8 of 12 area cells');
  it.todo('gateOrder: no front line — prefixes 500/1000/1500/1900: each of 6 bands holds n/6 ± 35 %, |left − right| ≤ 10 % of n');
});
