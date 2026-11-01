import { describe, expect, it } from 'vitest';
import { hash01, hash32, mulberry32 } from '../src/engine/lib/rng';
import { largestRemainder, powerAsks } from '../src/engine/lib/quote';

describe('rng', () => {
  it('hash32 is deterministic and spreads', () => {
    expect(hash32(1, 2, 3, 4)).toBe(hash32(1, 2, 3, 4));
    expect(hash32(1, 2, 3, 4)).not.toBe(hash32(1, 2, 3, 5));
    let s = 0;
    for (let i = 0; i < 20000; i++) s += hash01(9, i, 0, 0);
    expect(Math.abs(s / 20000 - 0.5)).toBeLessThan(0.01);
  });
  it('mulberry32 matches the sibling implementation', () => {
    expect(mulberry32(42)()).toBeCloseTo(0.6011037519201636, 12);
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
