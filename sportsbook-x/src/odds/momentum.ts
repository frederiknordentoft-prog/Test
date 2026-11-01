import type { FeedEvent } from './feed';
import { FULL_MINUTES } from './model';

/** Ten-minute buckets: nine fields across a 90-minute match. */
export const BUCKET_MIN = 10;
export const BUCKET_COUNT = FULL_MINUTES / BUCKET_MIN;

export interface Bucket {
  from: number;
  to: number;
  home: number;
  away: number;
}

/** Shots per ten-minute bucket, counting only events up to `minute`. Goals and cards are not used. */
export function momentumBuckets(feed: FeedEvent[], minute: number): Bucket[] {
  const buckets: Bucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => ({
    from: i * BUCKET_MIN,
    to: i * BUCKET_MIN + BUCKET_MIN - 1,
    home: 0,
    away: 0,
  }));
  for (const e of feed) {
    if (e.kind !== 'shot' || e.side === null || e.minute > minute) continue;
    const i = Math.min(BUCKET_COUNT - 1, Math.floor(e.minute / BUCKET_MIN));
    if (e.side === 'h') buckets[i].home += 1;
    else buckets[i].away += 1;
  }
  return buckets;
}
