// Terningen · the pure rule, the store's two count mutators (addDie, settleGamble), the formatters and the award timing helpers.
import { describe, it, expect } from 'vitest';
import {
  DICE_GOAL, DICE_MIN_X, diceFor, diceDefaults, addDie, fmtDice, diceWord, realDiceView, previewDiceView, PREVIEW_STEPS,
  canOffer, openGamble, settleGamble, clearSettled, cloneDice, stagedOf, GAMBLE_LOG_MAX, type DiceStore, type GambleChoice,
} from '../src/game/dice.ts';
import { resolveGamble, GAMBLE_SIDES } from '../src/math/gamble.ts';
import { loadDice, peekDice, storedGambleIdx, DICE_KEY } from '../src/game/store.ts';
import { dieBirthAt, celebrateEndWithDie, TIER_SECS, winTier } from '../src/present/schedule.ts';
import { spinBase } from '../src/math/engine.ts';
import { spinRng } from '../src/math/rng.ts';
import { gateLattice, gateOrder, GATE_H, TILES, PER_LEAF } from '../src/render/chamber/gateLattice.ts';

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

describe('DiceStore and addDie (the award mutator)', () => {
  it('defaults: count 0, flags false, unlock none', () => {
    expect(diceDefaults(0xdeadbeef)).toStrictEqual({ v: 1, count: 0, seed: 0xdeadbeef, firstAt: null, lastAt: null, helloSeen: false, introSeen: false, unlock: 'none', offered: false, unlockedAt: null, gamble: null, gambleLog: [] });
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

// ---------------------------------------------------------------- Kvit eller dobbelt
/** A veteran store with `n` dice (intro seen) plus a freshly awarded die with its choice open. */
function withOffer(n: number, stake = 1, source: 'spin' | 'storm' = 'spin'): DiceStore {
  const d = diceDefaults(9);
  d.count = n; d.introSeen = true; d.helloSeen = true;
  for (let i = 0; i < stake; i++) addDie(d, 100);
  expect(openGamble(d, { id: 'NL-00000009-B000001', source, stake, at: 100 })).toBe(true);
  return d;
}

describe('canOffer / openGamble', () => {
  it('canOffer: allowed, intro seen, not pending, no open choice', () => {
    const d = diceDefaults(1);
    d.count = 1;
    expect(canOffer(d, true)).toBe(false); // the first-ever die: its card comes first
    d.introSeen = true;
    expect(canOffer(d, true)).toBe(true);
    expect(canOffer(d, false)).toBe(false); // setting off / dice hidden
    d.unlock = 'pending';
    expect(canOffer(d, true)).toBe(false); // all lit, gate not opened: new dice are always kept
    d.unlock = 'seen';
    expect(canOffer(d, true)).toBe(true); // after the real opening the choice returns
    openGamble(d, { id: 'x', source: 'spin', stake: 1, at: 0 });
    expect(canOffer(d, true)).toBe(false);
  });
  it('openGamble refuses a second choice, a stake < 1 or a non-integer, and a stake the count does not hold', () => {
    const d = diceDefaults(1);
    d.count = 3;
    expect(openGamble(d, { id: 'a', source: 'spin', stake: 0, at: 0 })).toBe(false);
    expect(openGamble(d, { id: 'a', source: 'spin', stake: 1.5, at: 0 })).toBe(false);
    expect(openGamble(d, { id: 'a', source: 'storm', stake: 4, at: 0 })).toBe(false);
    expect(d.gamble).toBeNull();
    expect(openGamble(d, { id: 'a', source: 'storm', stake: 3, at: 5 })).toBe(true);
    expect(d.gamble).toStrictEqual({ id: 'a', source: 'storm', stake: 3, at: 5 });
    expect(openGamble(d, { id: 'b', source: 'spin', stake: 1, at: 0 })).toBe(false);
    expect(d.gamble!.id).toBe('a');
  });
});

describe('settleGamble (THE other count mutator)', () => {
  it('keep: the count stays, the choice closes, the log has no gid/face', () => {
    const d = withOffer(10);
    expect(d.count).toBe(11);
    expect(stagedOf(d)).toBe(1);
    const r = settleGamble(d, 'keep', -1, '', 500);
    expect(r).toEqual({ payout: 1, delta: 0, count: 11 });
    expect(d.gamble).toBeNull();
    expect(d.lastAt).toBe(100);
    expect(d.gambleLog).toEqual([{ gid: null, id: 'NL-00000009-B000001', source: 'spin', choice: 'keep', stake: 1, face: null, payout: 1, at: 500 }]);
    expect(stagedOf(d)).toBe(0);
    expect(() => settleGamble(d, 'keep', -1, '', 600)).toThrow(); // nothing open
  });
  it('every face × both bets × k: count = pre-award + payout, settled kept until clearSettled, lastAt only on a gain', () => {
    for (const bet of ['double', 'triple'] as const) for (const k of [1, 2, 7]) for (let f = 0; f < GAMBLE_SIDES; f++) {
      const d = withOffer(40, k, k > 1 ? 'storm' : 'spin');
      const pre = 40;
      const r = settleGamble(d, bet, f, 'NL-00000009-T000003', 900);
      const exp = resolveGamble(bet, k, f).payout;
      expect(r.payout).toBe(exp);
      expect(r.delta).toBe(exp - k);
      expect(d.count).toBe(pre + exp);
      expect(d.count).toBeGreaterThanOrEqual(pre);
      expect(d.lastAt).toBe(exp > k ? 900 : 100);
      expect(d.gamble!.settled).toStrictEqual({ choice: bet, face: f, gid: 'NL-00000009-T000003', payout: exp });
      expect(stagedOf(d)).toBe(exp);
      expect(d.gambleLog.at(-1)).toEqual({ gid: 'NL-00000009-T000003', id: 'NL-00000009-B000001', source: k > 1 ? 'storm' : 'spin', choice: bet, stake: k, face: f, payout: exp, at: 900 });
      expect(() => settleGamble(d, bet, f, 'x', 901)).toThrow(); // settled once
      clearSettled(d);
      expect(d.gamble).toBeNull();
      expect(stagedOf(d)).toBe(0);
    }
  });
  it("crossing 1948 through a win sets 'pending'; 'seen' never reverts; a bad face throws before any write", () => {
    const d = withOffer(1946); // 1947 with the new die
    expect(d.unlock).toBe('none');
    settleGamble(d, 'triple', 5, 'g', 1);
    expect(d.count).toBe(1949);
    expect(d.unlock).toBe('pending');
    const s = withOffer(2000);
    s.unlock = 'seen'; s.offered = true;
    settleGamble(s, 'double', 0, 'g', 1);
    expect(s.count).toBe(2000);
    expect(s.unlock).toBe('seen');
    const b = withOffer(5);
    expect(() => settleGamble(b, 'double', 6, 'g', 1)).toThrow();
    expect(b.count).toBe(6);
    expect(b.gamble!.settled).toBeUndefined();
    expect(b.gambleLog).toEqual([]);
  });
  it('the log is capped at GAMBLE_LOG_MAX (oldest dropped)', () => {
    const d = withOffer(3);
    for (let i = 0; i < GAMBLE_LOG_MAX + 7; i++) {
      if (!d.gamble) { addDie(d, i); openGamble(d, { id: `id${i}`, source: 'spin', stake: 1, at: i }); }
      settleGamble(d, 'keep', -1, '', i);
    }
    expect(d.gambleLog.length).toBe(GAMBLE_LOG_MAX);
    expect(d.gambleLog.at(-1)!.at).toBe(GAMBLE_LOG_MAX + 6);
  });
  it('cloneDice is deep (the choice, its result and the log are not shared)', () => {
    const d = withOffer(12);
    settleGamble(d, 'double', 4, 'g1', 7);
    const c = cloneDice(d);
    expect(c).toStrictEqual(d);
    expect(c.gamble).not.toBe(d.gamble);
    expect(c.gamble!.settled).not.toBe(d.gamble!.settled);
    expect(c.gambleLog).not.toBe(d.gambleLog);
    expect(c.gambleLog[0]).not.toBe(d.gambleLog[0]);
    c.gamble!.settled!.payout = 99; c.gambleLog[0].payout = 99; c.count = 1;
    expect(d.gamble!.settled!.payout).toBe(2);
    expect(d.gambleLog[0].payout).toBe(2);
    expect(JSON.stringify(cloneDice(diceDefaults(3)))).toBe(JSON.stringify(diceDefaults(3)));
  });
  it('seeded property test: the count never drops below its pre-award value, pending ⇒ count ≥ 1948, seen never reverts', () => {
    let x = 0x2545f491;
    const rnd = (n: number) => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) % n; };
    for (let run = 0; run < 300; run++) {
      const d = diceDefaults(run);
      d.count = rnd(2) ? rnd(40) : 1900 + rnd(60);
      d.introSeen = d.count > 0;
      let seen = false;
      for (let step = 0; step < 200; step++) {
        const pre = d.count;
        const k = rnd(5) === 0 ? 1 + rnd(9) : 1;
        for (let i = 0; i < k; i++) addDie(d, step);
        if (!d.introSeen) d.introSeen = true;
        if (rnd(7) === 0 && d.unlock === 'pending') { d.offered = true; d.unlock = 'seen'; d.unlockedAt = step; }
        if (canOffer(d, rnd(10) > 0)) {
          expect(openGamble(d, { id: `s${step}`, source: k > 1 ? 'storm' : 'spin', stake: k, at: step })).toBe(true);
          const choice = (['keep', 'double', 'triple'] as GambleChoice[])[rnd(3)];
          settleGamble(d, choice, rnd(6), `g${step}`, step);
          if (rnd(2)) clearSettled(d); else d.gamble = null;
        }
        expect(d.count).toBeGreaterThanOrEqual(pre);
        if (d.unlock === 'pending') expect(d.count).toBeGreaterThanOrEqual(DICE_GOAL);
        if (seen) expect(d.unlock).toBe('seen');
        seen = d.unlock === 'seen';
        if (d.count >= DICE_GOAL) expect(d.unlock).not.toBe('none');
      }
    }
  });
});

describe('loadDice: v1 stays v1, defaults fill in, malformed choices are dropped', () => {
  const mem = new Map<string, string>();
  const ls = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  const load = (o: object) => { (globalThis as unknown as { localStorage: typeof ls }).localStorage = ls; mem.set(DICE_KEY, JSON.stringify(o)); return loadDice(1); };
  const old = { v: 1, count: 5, seed: 3, firstAt: 1, lastAt: 2, helloSeen: true, introSeen: true, unlock: 'none', offered: false, unlockedAt: null };
  it('an old save gets gamble null and an empty log (no migration)', () => {
    const d = load(old);
    expect(d.gamble).toBeNull();
    expect(d.gambleLog).toEqual([]);
    expect(d.count).toBe(5);
  });
  it('an open choice survives; a malformed one is dropped; a non-array log becomes []', () => {
    const g = { id: 'i', source: 'spin', stake: 1, at: 1 };
    expect(load({ ...old, gamble: g }).gamble).toEqual(g);
    for (const bad of [{ ...g, stake: 0 }, { ...g, stake: 1.5 }, { ...g, stake: 6 }, { ...g, source: 'x' }, { ...g, id: 3 }, 'nope'])
      expect(load({ ...old, gamble: bad }).gamble, JSON.stringify(bad)).toBeNull();
    expect(load({ ...old, gambleLog: { a: 1 } }).gambleLog).toEqual([]);
  });
  it('a settled choice survives when the count holds its payout (a storm loss may leave count < stake)', () => {
    const lost = { id: 'i', source: 'storm', stake: 5, at: 1, settled: { choice: 'double', face: 0, gid: 'g', payout: 0 } };
    expect(load({ ...old, count: 1, gamble: lost }).gamble).toEqual(lost);
    const won = { ...lost, settled: { choice: 'triple', face: 5, gid: 'g', payout: 15 } };
    expect(load({ ...old, count: 16, gamble: won }).gamble).toEqual(won);
    expect(load({ ...old, count: 14, gamble: won }).gamble).toBeNull();
    expect(load({ ...old, count: 16, gamble: { ...won, settled: { ...won.settled, payout: 14 } } }).gamble).toBeNull();
  });
  // a second tab: the choice press re-reads what is stored NOW (its result stands; a throw index is never reused)
  it('peekDice: the stored collection as it is now, sanitised like loadDice; null when there is nothing to trust', () => {
    const g = { id: 'i', source: 'spin', stake: 1, at: 1, settled: { choice: 'double', face: 4, gid: 'NL-1-T000001', payout: 2 } };
    load({ ...old, count: 7, gamble: g, gambleLog: [{ gid: 'NL-1-T000001', id: 'i', source: 'spin', choice: 'double', stake: 1, face: 4, payout: 2, at: 1 }] });
    const p = peekDice();
    expect(p?.count).toBe(7);
    expect(p?.gamble).toEqual(g);
    expect(p?.gambleLog.length).toBe(1);
    load({ ...old, gamble: { ...g, stake: 1.5 } });
    expect(peekDice()?.gamble).toBeNull();
    mem.delete(DICE_KEY);
    expect(peekDice()).toBeNull();
    mem.set(DICE_KEY, '{nope');
    expect(peekDice()).toBeNull();
    mem.set(DICE_KEY, JSON.stringify({ ...old, v: 2 }));
    expect(peekDice()).toBeNull();
  });
  it('storedGambleIdx: the stored throw counter, 0 when missing or malformed', () => {
    (globalThis as unknown as { localStorage: typeof ls }).localStorage = ls;
    mem.set('nordlys.v1', JSON.stringify({ v: 1, counters: { base: 3, gamble: 12 } }));
    expect(storedGambleIdx()).toBe(12);
    for (const bad of ['{nope', JSON.stringify({ v: 1, counters: { base: 3 } }), JSON.stringify({ v: 1, counters: { gamble: -2 } }), JSON.stringify({ v: 1, counters: { gamble: 'x' } }), 'null']) {
      mem.set('nordlys.v1', bad);
      expect(storedGambleIdx(), bad).toBe(0);
    }
    mem.delete('nordlys.v1');
    expect(storedGambleIdx()).toBe(0);
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

// src/render/chamber/gateLattice.ts (pure): the tiles and the per-player fill order.
const fnv = (vals: Iterable<number>) => {
  let h = 0x811c9dc5;
  for (const v of vals) { let x = v | 0; for (let b = 0; b < 4; b++) { h ^= x & 255; h = Math.imul(h, 0x01000193) >>> 0; x >>>= 8; } }
  return h.toString(16).padStart(8, '0');
};
/** Equal-count cells over all tiles: 6 horizontal bands (sextiles of y), optionally × the 2 leaves. */
function bands(): Uint8Array {
  const L = gateLattice();
  const idx = Array.from({ length: TILES }, (_, i) => i).sort((a, b) => L.y[a] - L.y[b] || a - b);
  const b = new Uint8Array(TILES);
  idx.forEach((i, k) => { b[i] = Math.floor((k * 6) / TILES); });
  return b;
}

describe('gateLattice / gateOrder', () => {
  it('gateLattice: exactly 1948 tiles, 974 per leaf, all inside the arch with the border margin; golden hash of the coordinates', () => {
    const L = gateLattice();
    expect(L.x.length).toBe(TILES);
    expect(TILES).toBe(DICE_GOAL);
    let left = 0;
    for (let i = 0; i < TILES; i++) {
      const x = L.x[i], y = L.y[i], m = L.spacing / 2 - 1e-6;
      if (L.leaf[i] === 0) left++;
      // the leaf's own border: the arch / its jamb, the bottom and the centre seam
      expect(L.leaf[i] === 0 ? 0.5 - x : x - 0.5).toBeGreaterThanOrEqual(m);
      expect(GATE_H - y).toBeGreaterThanOrEqual(m);
      if (y < 0.5) expect(0.5 - Math.hypot(x - 0.5, y - 0.5)).toBeGreaterThanOrEqual(m);
      else expect(Math.min(x, 1 - x)).toBeGreaterThanOrEqual(m);
    }
    expect(left).toBe(PER_LEAF);
    const coords: number[] = [];
    for (let i = 0; i < TILES; i++) coords.push(Math.round(L.x[i] * 1e6), Math.round(L.y[i] * 1e6));
    expect(fnv(coords)).toBe('dbedccce');
  });

  it('gateOrder: a permutation of 0..1947, deterministic per seed, seeds differ, golden hash for seed 1', () => {
    const o = gateOrder(1);
    expect(o.length).toBe(TILES);
    expect(new Set(o).size).toBe(TILES);
    expect(Math.max(...o)).toBe(TILES - 1);
    expect(Array.from(gateOrder(1))).toEqual(Array.from(o));
    expect(Array.from(gateOrder(2)).slice(0, 50)).not.toEqual(Array.from(o).slice(0, 50));
    expect(fnv(o)).toBe('9747d555');
  });

  it('gateOrder: no predictable last tile — over 200 seeds order[1947] falls in ≥ 8 of 12 area cells', () => {
    const L = gateLattice(), b = bands();
    const cells = new Set<number>();
    for (let s = 0; s < 200; s++) { const i = gateOrder(0x1000 + s * 7919)[TILES - 1]; cells.add(b[i] * 2 + L.leaf[i]); }
    expect(cells.size).toBeGreaterThanOrEqual(8);
  });

  it('gateOrder: no front line — prefixes 500/1000/1500/1900: each of 6 bands holds n/6 ± 35 %, |left − right| ≤ 10 % of n', () => {
    const L = gateLattice(), b = bands();
    for (const seed of [1, 7, 0xdeadbeef]) {
      const o = gateOrder(seed);
      for (const n of [500, 1000, 1500, 1900]) {
        const c = [0, 0, 0, 0, 0, 0];
        let lr = 0;
        for (let k = 0; k < n; k++) { c[b[o[k]]]++; lr += L.leaf[o[k]] ? 1 : -1; }
        for (const v of c) expect(Math.abs(v - n / 6)).toBeLessThanOrEqual(0.35 * (n / 6));
        expect(Math.abs(lr)).toBeLessThanOrEqual(0.1 * n);
      }
    }
  });
});
