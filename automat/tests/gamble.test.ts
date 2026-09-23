// Kvit eller dobbelt: the pure rule (exact fairness by enumeration), the draw (chi² over 600k throws), golden faces,
// the gamble id and the refusal of a bad face.
import { describe, it, expect } from 'vitest';
import { GAMBLE_BETS, GAMBLE_SIDES, gambleFace, resolveGamble, winPips, type GambleBet } from '../src/math/gamble.ts';
import { spinRng, makeSpinId, parseSpinId, Xoshiro128ss } from '../src/math/rng.ts';

const BETS: GambleBet[] = ['double', 'triple'];

describe('resolveGamble: exact fairness', () => {
  it('mean payout = stake exactly for k = 1..20 (enumeration over the six faces), both bets', () => {
    for (const bet of BETS) for (let k = 1; k <= 20; k++) {
      let sum = 0;
      for (let f = 0; f < GAMBLE_SIDES; f++) sum += resolveGamble(bet, k, f).payout;
      expect(sum).toBe(GAMBLE_SIDES * k); // mean = sum / 6 = k, in integers
    }
  });
  it('win faces: 3/6 for double (4–6), 2/6 for triple (5–6); nested (a triple win is always a double win)', () => {
    expect(winPips('double')).toEqual([4, 5, 6]);
    expect(winPips('triple')).toEqual([5, 6]);
    for (let f = 0; f < GAMBLE_SIDES; f++) {
      const d = resolveGamble('double', 1, f), t = resolveGamble('triple', 1, f);
      expect(d.pip).toBe(f + 1);
      expect(d.win).toBe(winPips('double').includes(f + 1));
      expect(t.win).toBe(winPips('triple').includes(f + 1));
      if (t.win) expect(d.win).toBe(true);
      expect(d.payout).toBe(d.win ? 2 : 0);
      expect(t.payout).toBe(t.win ? 3 : 0);
    }
    expect(GAMBLE_BETS.double.mult * winPips('double').length).toBe(GAMBLE_SIDES);
    expect(GAMBLE_BETS.triple.mult * winPips('triple').length).toBe(GAMBLE_SIDES);
  });
  it('a bad face or bet throws', () => {
    for (const f of [-1, 6, 1.5, NaN, Infinity]) expect(() => resolveGamble('double', 1, f), String(f)).toThrow();
    expect(() => resolveGamble('quad' as GambleBet, 1, 0)).toThrow();
  });
});

describe('gambleFace: the draw', () => {
  it('600k throws of gambleFace(spinRng(s, "gamble", i)): chi² over the six faces, mean payout within 0,006·k', () => {
    const N = 600_000, h = new Array(GAMBLE_SIDES).fill(0);
    const g = new Xoshiro128ss();
    let dbl = 0, tri = 0;
    for (let i = 1; i <= N; i++) {
      const f = gambleFace(g.seedSpin(0x5eed1948, 'gamble', i));
      h[f]++;
      dbl += resolveGamble('double', 1, f).payout;
      tri += resolveGamble('triple', 1, f).payout;
    }
    const e = N / GAMBLE_SIDES;
    const chi = h.reduce((a, o) => a + (o - e) ** 2 / e, 0);
    expect(chi).toBeLessThan(20.5); // p ≈ 0.001 for 5 dof
    for (const k of [1, 3, 20]) {
      expect(Math.abs((dbl / N) * k - k)).toBeLessThanOrEqual(0.006 * k);
      expect(Math.abs((tri / N) * k - k)).toBeLessThanOrEqual(0.006 * k);
    }
  });
  it('golden faces for one seed (idx 1..24)', () => {
    expect(Array.from({ length: 24 }, (_, i) => gambleFace(spinRng(0x1a2b3c4d, 'gamble', i + 1)))).toEqual(GOLDEN);
  });
  it('the first draw of a fresh per-idx rng (a replay from the id gives the same face)', () => {
    const gid = makeSpinId(0x1a2b3c4d, 'gamble', 7);
    expect(gid).toBe('NL-1a2b3c4d-T000007');
    const p = parseSpinId(gid)!;
    expect(p).toEqual({ sessionSeed: 0x1a2b3c4d, domain: 'gamble', idx: 7 });
    expect(gambleFace(spinRng(p.sessionSeed, p.domain, p.idx))).toBe(GOLDEN[6]);
  });
});

const GOLDEN = [0, 0, 1, 5, 4, 0, 4, 0, 2, 3, 3, 4, 4, 1, 1, 0, 1, 2, 3, 0, 0, 4, 2, 5];
