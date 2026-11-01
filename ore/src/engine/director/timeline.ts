/**
 * Director timeline: the single source for scripted matches (demo autoplay and Playwright replay).
 * Times are match minutes; "64:05" means 64 minutes 5 seconds.
 */
export type TLEvent =
  | { at: string; type: 'goal'; team: 0 | 1; var?: { secs: number; p0: number; verdict: 'godkendt' | 'annulleret' } }
  | { at: string; type: 'whale'; team: 0 | 1 | 2; kr: number }
  | { at: string; until: string; type: 'pressure'; team: 0 | 1; corners?: number; piBias: number }
  | { at: string; type: 'buildUp'; team: 0 | 1; secs: number }
  | { at: string; type: 'red'; team: 0 | 1 };

export interface Timeline {
  seed: string;
  naturalGoals: boolean;
  naturalWhales?: boolean;
  stoppage?: number; // second-half stoppage minutes
  events: TLEvent[];
}

/** "64:05" → 64.0833, "90+3" → 93, "45" → 45. */
export function minuteOf(at: string): number {
  if (at.includes('+')) {
    const [a, b] = at.split('+');
    return Number(a) + Number(b);
  }
  const [m, s] = at.split(':');
  return Number(m) + (s ? Number(s) / 60 : 0);
}

export const FREE_PLAY: Timeline = { seed: 'FCK-BIF·Parken·2026·retur', naturalGoals: true, naturalWhales: true, stoppage: 3, events: [] };
