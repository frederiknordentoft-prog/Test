/**
 * STELLA NOVA — shared constants. Single source of truth for board geometry,
 * symbol ids, palette and timing. Everything here is presentation-neutral
 * (no three.js imports) so math, audio, ui and render can all use it.
 *
 * DO NOT EDIT from feature modules. If a module needs a new shared constant,
 * keep it local and report it in the agent's final summary.
 */

// ───────────────────────────── Board ─────────────────────────────

/** Number of concentric rings. Ring 0 is the innermost. */
export const RINGS = 4;
/** Number of spokes (paylines). Spoke 0 points "north" (world −Z, screen-up). */
export const SPOKES = 8;
/** Angle between two neighbouring spokes, radians. */
export const STEP_ANGLE = (Math.PI * 2) / SPOKES;

/**
 * World-space conventions (render):
 *  - Y is up. The orrery lies in the XZ plane, centred on the origin.
 *  - Spoke s sits at polar angle a = s * STEP_ANGLE, measured CLOCKWISE when
 *    seen from above (camera side), starting at −Z.
 *      x =  sin(a) * r
 *      z = −cos(a) * r
 *  - A ring rotation of +1 notch moves every symbol on that ring one spoke
 *    clockwise (spoke s → spoke s+1).
 */
export const RING_RADII = [1.25, 2.25, 3.25, 4.25] as const;
/** Radial width of one ring band. Bands touch with a 0.06 gap. */
export const RING_WIDTH = 0.94;
/** Nominal symbol diameter per ring (world units). */
export const SYMBOL_DIAMETER = [0.74, 0.82, 0.88, 0.92] as const;
/**
 * Top surface (the enamel) of each ring. The instrument is a shallow stepped
 * dais: the inner rings sit a little higher, so the star is the apex.
 */
export const RING_Y = [0.12, 0.08, 0.04, 0.0] as const;
/** Height of a symbol's centre above its ring's top surface. Socket anchors sit at RING_Y[ring] + SYMBOL_Y. */
export const SYMBOL_Y = 0.16;
/** Height of the central star's centre. */
export const STAR_Y = 0.62;
/** Radius of the hub that cradles the central star. */
export const HUB_RADIUS = 0.74;
/** Visual radius of the central star at zero charge. */
export const STAR_RADIUS = 0.36;
/** Fixed outer bezel (zodiac scale). */
export const BEZEL_INNER = 4.76;
export const BEZEL_OUTER = 5.12;
/** The camera must keep a disc of this radius fully visible. */
export const FIT_RADIUS = 5.22;

/** Direction each ring spins / ticks. +1 = clockwise seen from above. */
export const RING_DIR = [1, -1, 1, -1] as const;

export function spokeAngle(spoke: number): number {
  return spoke * STEP_ANGLE;
}

/** World XZ of the centre of cell (ring, spoke) when all rings are at rest. */
export function cellXZ(ring: number, spoke: number): { x: number; z: number } {
  const a = spokeAngle(spoke);
  const r = RING_RADII[ring];
  return { x: Math.sin(a) * r, z: -Math.cos(a) * r };
}

/** World Y of a symbol's centre on a ring. */
export function cellY(ring: number): number {
  return RING_Y[ring] + SYMBOL_Y;
}

// ───────────────────────────── Symbols ─────────────────────────────

export const SYM = {
  SAPPHIRE: 0,
  EMERALD: 1,
  AMETHYST: 2,
  RUBY: 3,
  MOON: 4,
  JUPITER: 5,
  SATURN: 6,
  SUN: 7,
  WILD: 8,
  SCATTER: 9,
} as const;

export type SymbolId = (typeof SYM)[keyof typeof SYM];

export const SYMBOL_COUNT = 10;
export const REGULAR_SYMBOLS: readonly SymbolId[] = [0, 1, 2, 3, 4, 5, 6, 7];
export const LOW_SYMBOLS: readonly SymbolId[] = [0, 1, 2, 3];
export const HIGH_SYMBOLS: readonly SymbolId[] = [4, 5, 6, 7];

export interface SymbolMeta {
  id: SymbolId;
  key: string;
  /** Danish display name. */
  name: string;
  /** Signature colour (sRGB hex) — used for trails, particles, beams, UI chips. */
  color: number;
  /** Secondary accent colour. */
  accent: number;
  kind: 'gem' | 'celestial' | 'wild' | 'scatter';
  /** Top-view silhouette, so symbols are distinguishable without colour. */
  shape: string;
}

export const SYMBOLS: readonly SymbolMeta[] = [
  { id: 0, key: 'sapphire', name: 'Safir', color: 0x2a6bff, accent: 0x9cc0ff, kind: 'gem', shape: 'round brilliant (circle)' },
  { id: 1, key: 'emerald', name: 'Smaragd', color: 0x14d98b, accent: 0xa6ffd9, kind: 'gem', shape: 'emerald cut (long octagon)' },
  { id: 2, key: 'amethyst', name: 'Ametyst', color: 0xa855ff, accent: 0xe2c4ff, kind: 'gem', shape: 'trillion (rounded triangle, apex outward)' },
  { id: 3, key: 'ruby', name: 'Rubin', color: 0xff2d55, accent: 0xffb0c0, kind: 'gem', shape: 'lozenge (rhombus, long axis radial)' },
  { id: 4, key: 'moon', name: 'Måne', color: 0xdfe8f5, accent: 0x8fa6c8, kind: 'celestial', shape: 'cratered silver sphere, crescent-lit' },
  { id: 5, key: 'jupiter', name: 'Jupiter', color: 0xf0a868, accent: 0xfff0d8, kind: 'celestial', shape: 'banded sphere with a red spot' },
  { id: 6, key: 'saturn', name: 'Saturn', color: 0xe9d29a, accent: 0xc9b6ff, kind: 'celestial', shape: 'sphere with a wide tilted ring' },
  { id: 7, key: 'sun', name: 'Sol', color: 0xffd34d, accent: 0xff8a3c, kind: 'celestial', shape: 'blazing sphere with corona rays' },
  { id: 8, key: 'wild', name: 'Stella Nova', color: 0xfff3c4, accent: 0xffffff, kind: 'wild', shape: 'eight-pointed white-gold star' },
  { id: 9, key: 'scatter', name: 'Komet', color: 0x6fe7ff, accent: 0xd8fbff, kind: 'scatter', shape: 'icy comet head with a curved tail' },
];

// ───────────────────────────── Palette ─────────────────────────────

/** Art-bible palette (sRGB hex). Use these, do not invent neighbours. */
export const PALETTE = {
  night0: 0x03050d,
  night1: 0x070b1c,
  night2: 0x0d1433,
  nebulaTeal: 0x17606e,
  nebulaViolet: 0x4a2a78,
  nebulaRose: 0x8a3a6a,
  brass: 0xb8923f,
  brassLight: 0xf2d488,
  brassDark: 0x5a3f17,
  gold: 0xffcf5a,
  enamel: 0x0a1230,
  enamelLight: 0x16245a,
  starCore: 0xfff8e6,
  starWarm: 0xffc46b,
  starHot: 0xff8a3c,
  comet: 0x6fe7ff,
  uiText: 0xf4ecd8,
  uiDim: 0x9aa3c0,
  uiGold: 0xe8c66a,
} as const;

// ───────────────────────────── Money ─────────────────────────────

/** All money is integer øre. */
export const BET_LEVELS = [100, 200, 500, 1000, 2000, 5000, 10000, 20000] as const;
export const DEFAULT_BET_INDEX = 3;
export const START_BALANCE = 500000;

// ───────────────────────────── Presentation tiers ─────────────────────────────

/** Total spin win as a multiple of the bet that triggers each celebration. */
export const BIG_WIN_TIERS = [
  { tier: 1, min: 10, label: 'STOR GEVINST' },
  { tier: 2, min: 25, label: 'MEGA GEVINST' },
  { tier: 3, min: 60, label: 'SUPERNOVA' },
] as const;

/** Baseline timings in seconds at normal speed. Turbo multiplies by TURBO_SCALE. */
export const TIMING = {
  whirlMin: 0.9,
  ringStopGap: 0.34,
  anticipationExtra: 1.25,
  winShow: 0.95,
  burst: 0.5,
  refill: 0.45,
  tick: 0.34,
  nudgeSnap: 0.22,
  hintDelay: 4.0,
} as const;
export const TURBO_SCALE = 0.55;
