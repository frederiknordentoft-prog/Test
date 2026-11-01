import { describe, expect, it } from 'vitest';
import { formatOdds } from '../src/odds/format';

describe('odds formats at the edges', () => {
  it('fractional odds near 1 use a real denominator, not 0/1', () => {
    expect(formatOdds(1.01, 'fraction')).toBe('1/100');
    expect(formatOdds(1.05, 'fraction')).toBe('1/20');
    expect(formatOdds(1.5, 'fraction')).toBe('1/2');
  });
  it('fractional odds for a common price', () => {
    expect(formatOdds(1.91, 'fraction')).toBe('10/11');
  });
  it('american odds for prices below 2 and above 2', () => {
    expect(formatOdds(1.01, 'american')).toBe('-10000');
    expect(formatOdds(1.05, 'american')).toBe('-2000');
    expect(formatOdds(1.5, 'american')).toBe('-200');
    expect(formatOdds(2, 'american')).toBe('+100');
  });
  it('decimal keeps two places and a comma', () => {
    expect(formatOdds(1.01, 'decimal')).toBe('1,01');
  });
});
