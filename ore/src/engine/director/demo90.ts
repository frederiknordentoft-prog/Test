/**
 * The scripted derby for the ~90-second demo. One file drives autoplay (DemoThumb) and
 * Playwright replay. Prices in the narration are targets; tests/demo.test.ts asserts them.
 */
import type { Timeline } from './timeline';

export const DEMO90: Timeline = {
  seed: 'FCK-BIF·Parken·2026·retur',
  naturalGoals: false,
  naturalWhales: false,
  stoppage: 3,
  htSubs: 80,
  events: [
    { at: '9:00', type: 'whale', team: 2, kr: 25000 },
    { at: '18:00', until: '24:00', type: 'pressure', team: 0, corners: 3, piBias: 0.45 },
    { at: '31:10', type: 'buildUp', team: 1, secs: 60 },
    { at: '31:10', type: 'goal', team: 1 },
    { at: '64:05', type: 'buildUp', team: 0, secs: 60 },
    { at: '64:05', type: 'goal', team: 0, var: { secs: 7, p0: 0.7, verdict: 'godkendt' } },
    { at: '89:20', type: 'buildUp', team: 0, secs: 50 },
    { at: '89:20', type: 'goal', team: 0 },
  ],
};

/** Real-time speed by match minute: ×1 where something happens, fast in between. */
export function demoSegments(): [number, number, number][] {
  return [
    [1, 8.8, 16],
    [10, 26, 16],
    [26, 30, 4],
    [31.8, 45, 16],
    [45.01, 53.8, 16],
    [55.2, 63, 16],
    [65.2, 88.8, 16],
    [90, 93, 4],
  ];
}

/** Scripted gestures for the ghost thumb, in match minutes. */
export type DemoStep =
  | { at: number; do: 'hold'; outcome: 0 | 1 | 2; kr: number; note: string }
  | { at: number; do: 'limit'; outcome: 0 | 1 | 2; level: number; kr: number; note: string }
  | { at: number; do: 'window'; a: number; b: number; kr: number; note: string }
  | { at: number; do: 'byg'; kr: number; note: string }
  | { at: number; do: 'fader'; note: string }
  | { at: number; do: 'settle'; note: string };

export const DEMO_STEPS: DemoStep[] = [
  { at: 0.3, do: 'hold', outcome: 0, kr: 250, note: 'Hold på FCK, glid op: 250 kr' },
  { at: 9.4, do: 'limit', outcome: 0, level: 35, kr: 100, note: 'Langt tryk i viften: køb FCK ved 35' },
  { at: 45, do: 'byg', kr: 50, note: 'Pause: byg en fremtid' },
  { at: 54.1, do: 'window', a: 60, b: 70, kr: 50, note: 'Træk over Målvejret: mål 60–70′' },
  { at: 89.6, do: 'fader', note: 'Faderen: sælg til indsatsen er hjemme?' },
  { at: 93, do: 'settle', note: 'Afregning' },
];
