import { describe, expect, it } from 'vitest';
import { generateFeed, stateAt } from '../src/odds/feed';
import { BUCKET_COUNT, momentumBuckets } from '../src/odds/momentum';

describe('momentum buckets', () => {
  const feed = generateFeed('sl-1-2026', 1.55, 1.15);

  it('nine ten-minute buckets across the match', () => {
    expect(BUCKET_COUNT).toBe(9);
    const b = momentumBuckets(feed, 90);
    expect(b).toHaveLength(9);
    expect(b[0].from).toBe(0);
    expect(b[8].to).toBe(89);
  });

  it('bucket totals equal the shots in the state at that minute, for home and away', () => {
    for (const m of [0, 10, 37, 73, 90]) {
      const b = momentumBuckets(feed, m);
      const s = stateAt(feed, m);
      expect(b.reduce((n, x) => n + x.home, 0)).toBe(s.shotsH);
      expect(b.reduce((n, x) => n + x.away, 0)).toBe(s.shotsA);
    }
  });

  it('nothing after the current minute is counted', () => {
    const early = momentumBuckets(feed, 12);
    expect(early.slice(2).every((x) => x.home === 0 && x.away === 0)).toBe(true);
  });
});
