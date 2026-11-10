/**
 * Tuning. The whole game lives in D Dorian / D minor, so every pitched effect
 * can ring over every chord of the score. Effects stay on the D minor
 * pentatonic (D F G A C): those five notes are consonant with all four chords
 * of the base progression and with the big-win loop.
 */

/** MIDI note → Hz (A4 = 69 = 440 Hz). */
export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export const NOTE = {
  D1: 26,
  A1: 33,
  Bb1: 34,
  C2: 36,
  D2: 38,
  F2: 41,
  A2: 45,
  D3: 50,
  A3: 57,
  D4: 62,
  F4: 65,
  A4: 69,
  D5: 74,
  F5: 77,
  A5: 81,
  D6: 86,
  A6: 93,
  D7: 98,
} as const;

const PENTA = [0, 3, 5, 7, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

function degree(scale: readonly number[], i: number, base: number): number {
  const n = scale.length;
  const k = Math.round(i);
  const oct = Math.floor(k / n);
  return base + oct * 12 + scale[k - oct * n];
}

/** i-th step of the D minor pentatonic above `base` (a D). Negative steps go down. */
export const penta = (i: number, base: number = NOTE.D4): number => degree(PENTA, i, base);

/** i-th step of D Dorian above `base` (a D). */
export const dorian = (i: number, base: number = NOTE.D4): number => degree(DORIAN, i, base);

export interface Chord {
  name: string;
  /** Bass / sub root. */
  root: number;
  /** Pad voicing, low to high. */
  pad: number[];
  /** Arpeggio tones, ascending, around octave 4. */
  arp: number[];
  /** Notes the celesta may wander over, ascending, octaves 5–6. */
  pool: number[];
  /** Big-win bell line, one entry per eighth note (0 = rest). */
  bells?: number[];
}

/** Dm9 → B♭maj7 → Fmaj7 → Csus, two bars each. */
export const BASE_PROGRESSION: readonly Chord[] = [
  {
    name: 'Dm9',
    root: 38,
    pad: [50, 57, 60, 65, 76],
    arp: [62, 65, 69, 72, 76],
    pool: [74, 76, 77, 81, 84, 86, 88, 89, 93],
  },
  {
    name: 'Bbmaj7',
    root: 34,
    pad: [46, 57, 62, 65, 74],
    arp: [58, 62, 65, 69, 74],
    pool: [74, 77, 81, 82, 84, 86, 89, 93],
  },
  {
    name: 'Fmaj7',
    root: 41,
    pad: [53, 57, 60, 64, 72],
    arp: [60, 65, 69, 72, 76],
    pool: [72, 76, 77, 81, 84, 88, 89, 93],
  },
  {
    name: 'Csus',
    root: 36,
    pad: [48, 55, 60, 65, 74],
    arp: [60, 65, 67, 72, 74],
    pool: [72, 74, 77, 79, 84, 86, 89, 91],
  },
];

/**
 * F → C → Dm → B♭, one bar each: the same key seen from its relative major,
 * which is what makes the big win sound like daylight after the night music.
 */
export const BIGWIN_PROGRESSION: readonly Chord[] = [
  {
    name: 'F',
    root: 41,
    pad: [53, 60, 65, 69, 72],
    arp: [65, 69, 72, 77, 81],
    pool: [77, 81, 84, 89],
    bells: [77, 0, 81, 84, 0, 81, 84, 89],
  },
  {
    name: 'C',
    root: 36,
    pad: [48, 55, 64, 67, 72],
    arp: [64, 67, 72, 76, 79],
    pool: [76, 79, 84, 88],
    bells: [88, 0, 84, 79, 0, 84, 79, 76],
  },
  {
    name: 'Dm',
    root: 38,
    pad: [50, 57, 62, 65, 69],
    arp: [62, 65, 69, 74, 77],
    pool: [74, 77, 81, 86],
    bells: [86, 0, 81, 77, 0, 81, 86, 89],
  },
  {
    name: 'Bb',
    root: 34,
    pad: [46, 53, 62, 65, 70],
    arp: [62, 65, 70, 74, 77],
    pool: [74, 77, 82, 86],
    bells: [86, 0, 82, 77, 0, 82, 86, 84],
  },
];
