// Kp tiers — THE single source of truth for sky look, music layers and perks per Kp level.
// Sky & music modules read this table; the rules screen renders it.

export interface Tier {
  kp: number;
  name: string;        // shown on the Kp ladder
  gName: string;       // NOAA G-scale label (or '')
  frac: number;        // fraction of K required to reach this Kp
  perk: boolean;       // grants a "Ladet spin" when reached
  change: string;      // Danish one-liner describing what changes (ladder + level-up banner)
  sky: {
    intensity: number; // aurora brightness 0..1
    speed: number;     // curtain motion speed multiplier
    fold: number;      // curtain folding amount 0..1
    red: number;       // red upper fringe amount 0..1
    violet: number;    // violet mix 0..1
    stars: number;     // star brightness 0..1 (dims as aurora grows)
    crackle: number;   // storm-crackle / frame cracks 0..1
  };
  music: number;       // number of active base music layers (1..5)
}

// Front-loaded thresholds (fractions of K) — see PLAN.md §3.
export const TIERS: Tier[] = [
  { kp: 0, name: 'Stille', gName: '', frac: 0, perk: false, change: 'Svagt grønt nordlys', sky: { intensity: 0.35, speed: 0.6, fold: 0.15, red: 0, violet: 0, stars: 1, crackle: 0 }, music: 1 },
  { kp: 1, name: 'Stille', gName: '', frac: 0.004, perk: false, change: 'Glas-arpeggio tændes', sky: { intensity: 0.42, speed: 0.7, fold: 0.2, red: 0, violet: 0, stars: 0.95, crackle: 0 }, music: 2 },
  { kp: 2, name: 'Uro', gName: '', frac: 0.012, perk: false, change: 'Tykkere gardiner', sky: { intensity: 0.5, speed: 0.8, fold: 0.3, red: 0, violet: 0.05, stars: 0.9, crackle: 0 }, music: 2 },
  { kp: 3, name: 'Uro', gName: '', frac: 0.03, perk: true, change: 'Ladet spin · 4 felter x2', sky: { intensity: 0.58, speed: 0.9, fold: 0.38, red: 0, violet: 0.1, stars: 0.85, crackle: 0 }, music: 2 },
  { kp: 4, name: 'Aktiv', gName: '', frac: 0.06, perk: false, change: 'Rimlys på isrammen · puls-bas', sky: { intensity: 0.66, speed: 1.0, fold: 0.45, red: 0.05, violet: 0.2, stars: 0.8, crackle: 0 }, music: 3 },
  { kp: 5, name: 'Svag storm', gName: 'G1', frac: 0.11, perk: true, change: 'Violet nordlys · Ladet spin', sky: { intensity: 0.74, speed: 1.1, fold: 0.55, red: 0.1, violet: 0.55, stars: 0.7, crackle: 0 }, music: 3 },
  { kp: 6, name: 'Moderat storm', gName: 'G2', frac: 0.19, perk: false, change: 'Foldede gardiner · perkussion', sky: { intensity: 0.82, speed: 1.25, fold: 0.7, red: 0.2, violet: 0.6, stars: 0.6, crackle: 0.05 }, music: 4 },
  { kp: 7, name: 'Kraftig storm', gName: 'G3', frac: 0.31, perk: true, change: 'Røde toppe · Ladet spin', sky: { intensity: 0.9, speed: 1.4, fold: 0.8, red: 0.65, violet: 0.6, stars: 0.5, crackle: 0.15 }, music: 4 },
  { kp: 8, name: 'Svær storm', gName: 'G4', frac: 0.55, perk: false, change: 'Knitren i rammen · ostinato', sky: { intensity: 0.97, speed: 1.6, fold: 0.9, red: 0.85, violet: 0.65, stars: 0.4, crackle: 0.5 }, music: 5 },
  { kp: 9, name: 'Ekstrem', gName: 'G5', frac: 1, perk: false, change: 'SOLSTORM', sky: { intensity: 1, speed: 1.8, fold: 1, red: 1, violet: 0.7, stars: 0.3, crackle: 1 }, music: 5 },
];

/** Continuous Kp (e.g. 4.3) from charge and K. */
export function kpFromCharge(charge: number, K: number): number {
  const f = charge / K;
  if (f >= 1) return 9;
  for (let i = 1; i < TIERS.length; i++) {
    if (f < TIERS[i].frac) {
      const a = TIERS[i - 1].frac, b = TIERS[i].frac;
      return i - 1 + (f - a) / (b - a);
    }
  }
  return 9;
}

/** Interpolated sky params for a continuous Kp. */
export function skyAt(kp: number): Tier['sky'] {
  const i = Math.max(0, Math.min(8, Math.floor(kp)));
  const t = Math.max(0, Math.min(1, kp - i));
  const a = TIERS[i].sky, b = TIERS[Math.min(9, i + 1)].sky;
  const o = {} as Tier['sky'];
  for (const k of Object.keys(a) as (keyof Tier['sky'])[]) o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
}
