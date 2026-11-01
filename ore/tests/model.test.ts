import { describe, expect, it } from 'vitest';
import { hash01, hash32, mulberry32 } from '../src/engine/lib/rng';
import { largestRemainder, powerAsks } from '../src/engine/lib/quote';
import { buildTable, computeFrame, DERBY, D, fair, I_END, permutation, SCENARIOS, selectStrands, simulateOutcomes, STEP } from '../src/lookdev/model';

const tab = buildTable(DERBY);

describe('rng', () => {
  it('hash32 is deterministic and spreads', () => {
    expect(hash32(1, 2, 3, 4)).toBe(hash32(1, 2, 3, 4));
    expect(hash32(1, 2, 3, 4)).not.toBe(hash32(1, 2, 3, 5));
    let s = 0;
    for (let i = 0; i < 20000; i++) s += hash01(9, i, 0, 0);
    expect(Math.abs(s / 20000 - 0.5)).toBeLessThan(0.01);
  });
  it('mulberry32 matches the sibling implementation', () => {
    const r = mulberry32(42);
    expect(r()).toBeCloseTo(0.6011037519201636, 12);
  });
});

describe('quote', () => {
  it('power-method asks sum to 1 + overround and favour favourites', () => {
    const a = powerAsks([0.48, 0.27, 0.25], 0.03);
    expect(a.reduce((x, y) => x + y, 0)).toBeCloseTo(1.03, 6);
    expect(a[0] / 0.48).toBeLessThan(a[2] / 0.25);
  });
  it('largest remainder sums exactly', () => {
    expect(largestRemainder([0.544, 0.25, 0.206], 100)).toEqual([54, 25, 21]);
    expect(largestRemainder([1 / 3, 1 / 3, 1 / 3], 100).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('DP', () => {
  it('probabilities sum to 1 everywhere and match the pre-match target', () => {
    for (let i = 0; i <= I_END; i += 37) {
      for (let d = -D; d <= D; d++) {
        const p = fair(tab, i, d);
        expect(p[0] + p[1] + p[2]).toBeCloseTo(1, 9);
      }
    }
    const pre = fair(tab, 0, 0);
    expect(pre[0]).toBeGreaterThan(0.44);
    expect(pre[0]).toBeLessThan(0.52);
  });
  it('a lead late is worth more than a lead early', () => {
    expect(fair(tab, 80 / STEP, 1)[0]).toBeGreaterThan(fair(tab, 20 / STEP, 1)[0]);
  });
});

describe('Monte Carlo and strands', () => {
  it('MC outcome shares agree with the DP within sampling error', () => {
    const iNow = 27 / STEP;
    const out = simulateOutcomes(DERBY, iNow, 0, 5000);
    const c = [0, 0, 0];
    out.forEach((o) => c[o]++);
    const p = fair(tab, iNow, 0);
    for (let k = 0; k < 3; k++) expect(Math.abs(c[k] / 5000 - p[k])).toBeLessThan(0.025);
  });
  it('the tally of 100 strands equals the rounded fair price exactly', () => {
    for (const sc of SCENARIOS) {
      const f = computeFrame(DERBY, tab, sc);
      expect(f.counts).toEqual(largestRemainder(f.fair, 100));
      expect(Math.abs(f.counts[0] - f.asks[0])).toBeLessThan(3.5); // price ≈ count + margin
      expect(f.strands.length).toBe(100);
      for (const s of f.strands) {
        const end = s.v[s.v.length - 1];
        expect(end === 100 || end === 0).toBe(true);
        expect(end === 100).toBe(s.outcome === 0);
      }
    }
  });
  it('selection is stable: one game minute without events swaps few strands', () => {
    const perm = permutation(DERBY.seed, 5000);
    const sel = (now: number) => {
      const iNow = now / STEP;
      return new Set(selectStrands(simulateOutcomes(DERBY, iNow, 0, 5000), perm, fair(tab, iNow, 0)).ids);
    };
    const a = sel(20);
    const b = sel(21);
    let changed = 0;
    b.forEach((id) => {
      if (!a.has(id)) changed++;
    });
    expect(changed).toBeLessThanOrEqual(5);
  });
  it('strands start at the current ask (no step at NU)', () => {
    const f = computeFrame(DERBY, tab, SCENARIOS[0]);
    for (const s of f.strands) expect(Math.abs(s.v[0] - f.asks[0])).toBeLessThan(1e-3);
  });
});
