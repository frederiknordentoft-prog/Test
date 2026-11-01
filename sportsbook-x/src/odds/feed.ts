import { mulberry32, hashSeed } from './rng';
import { FULL_MINUTES, probsFromState, type Probs } from './model';

export type Side = 'h' | 'a';
export type EventKind = 'goal' | 'shot' | 'card' | 'half' | 'full';

export interface FeedEvent {
  minute: number;
  kind: EventKind;
  side: Side | null;
}

/** Pre-generated, seeded event stream for one match. Same seed, same match. */
export function generateFeed(seedText: string, lamH: number, lamA: number): FeedEvent[] {
  const rnd = mulberry32(hashSeed(seedText));
  const events: FeedEvent[] = [];
  for (let m = 1; m < FULL_MINUTES; m++) {
    if (m !== 45 && rnd() < lamH / FULL_MINUTES) events.push({ minute: m, kind: 'goal', side: 'h' });
    if (rnd() < lamA / FULL_MINUTES) events.push({ minute: m, kind: 'goal', side: 'a' });
    if (rnd() < 0.14) events.push({ minute: m, kind: 'shot', side: rnd() < 0.5 ? 'h' : 'a' });
    if (rnd() < 0.012) events.push({ minute: m, kind: 'card', side: rnd() < 0.5 ? 'h' : 'a' });
  }
  events.push({ minute: 45, kind: 'half', side: null });
  events.push({ minute: FULL_MINUTES, kind: 'full', side: null });
  return events.sort((x, y) => x.minute - y.minute);
}

export interface MatchState {
  minute: number;
  h: number;
  a: number;
  shotsH: number;
  shotsA: number;
  /** Events that have happened up to and including `minute`. */
  past: FeedEvent[];
}

/** Match state at a given minute. Pure function of the feed. */
export function stateAt(feed: FeedEvent[], minute: number): MatchState {
  const t = Math.max(0, Math.min(FULL_MINUTES, Math.floor(minute)));
  const past = feed.filter((e) => e.minute <= t);
  return {
    minute: t,
    h: past.filter((e) => e.kind === 'goal' && e.side === 'h').length,
    a: past.filter((e) => e.kind === 'goal' && e.side === 'a').length,
    shotsH: past.filter((e) => e.kind === 'shot' && e.side === 'h').length,
    shotsA: past.filter((e) => e.kind === 'shot' && e.side === 'a').length,
    past,
  };
}

/** Conditional final-result probabilities at a given minute. */
export function probsAt(feed: FeedEvent[], lamH: number, lamA: number, minute: number): Probs {
  const s = stateAt(feed, minute);
  const remaining = (FULL_MINUTES - s.minute) / FULL_MINUTES;
  return probsFromState(s.h, s.a, lamH * remaining, lamA * remaining);
}

/** Win-probability series for the forecast curve, one point per minute. */
export function probSeries(feed: FeedEvent[], lamH: number, lamA: number): number[] {
  const out: number[] = [];
  for (let m = 0; m <= FULL_MINUTES; m++) out.push(probsAt(feed, lamH, lamA, m).home);
  return out;
}
