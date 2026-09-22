// Isfont — glyph skeletons. A condensed geometric display face drawn as monoline
// centre-lines on a 10 × 14 grid (cap height = 14 units, nominal stroke = 2 units).
//
// Design rules (keep them when adding glyphs):
//  • Horizontal bars sit on y = 1 / 13 (ink touches the base/cap line), stems run 0 → 14.
//  • Bowls are rounded rectangles (fillet ≈ 3.0–3.6 on the skeleton) → outer radius ≈ 4.4.
//  • Rounds overshoot by OV (skeleton at 0.85 / 13.15, clipped at −OV / 14 + OV).
//  • Free terminals are cut at 12° (a single global slash direction, like the whole face
//    was sliced by parallel blades); strokes that end on the base/cap line are cut flat.
//  • Sharp joints are mitred (limit 2.5 r), so stems and arms meet in crisp corners.
//  • Stroke order = drawing order (the arc-length channel drives the stroke reveal).

export const CAP = 14;
export const R0 = 1;       // nominal stroke half-width (units)
export const OV = 0.15;    // overshoot of round shapes

/** 'auto' → 'line' when the end sits on the base/cap line, else 'cut'. */
export type CapKind = 'auto' | 'cut' | 'flat' | 'round';

export interface StrokeDef {
  /** flat list of skeleton points x0,y0,x1,y1,… (units, y up, baseline 0) */
  p: number[];
  /** fillet radius per interior vertex (number = all), 0 = sharp mitre */
  f?: number | number[];
  c0?: CapKind;
  c1?: CapKind;
  /** y clip [lo, hi]; defaults to [0, 14] (or ±OV for round glyphs) */
  clip?: [number, number];
  /** full circle instead of a polyline: p = [cx, cy], radius = ring */
  ring?: number;
  miter?: number;
}

export interface GlyphDef {
  /** nominal ink width (units) */
  w: number;
  /** left / right side bearing */
  l: number;
  r: number;
  s: StrokeDef[];
  /** round glyph: default clip gets the overshoot */
  ov?: boolean;
  /** fixed advance (tabular figures); ink is centred in it */
  adv?: number;
}

const S = (p: number[], f: number | number[] = 0, o: Partial<StrokeDef> = {}): StrokeDef => ({ p, f, ...o });
const R = (p: number[]): StrokeDef => ({ p, f: 0, c0: 'round', c1: 'round' }); // junction bar
/** Closed rounded rectangle, drawn counter-clockwise from the top centre. */
const loop = (x0: number, y0: number, x1: number, y1: number, rad: number, o: Partial<StrokeDef> = {}): StrokeDef => {
  const xm = (x0 + x1) / 2;
  return { p: [xm, y1, x0, y1, x0, y0, x1, y0, x1, y1, xm, y1], f: rad, c0: 'round', c1: 'round', ...o };
};

const Y0 = 0.85, Y1 = 13.15;     // round skeleton bottom / top (with overshoot)
const TAB = 10.4;                // tabular figure advance
const clipLow: [number, number] = [-OV, CAP];
const clipHigh: [number, number] = [0, CAP + OV];

export const GLYPHS: Record<string, GlyphDef> = {
  // ---------------------------------------------------------------- letters
  A: { w: 10.4, l: 0.35, r: 0.35, s: [S([1.05, 0, 5.2, 14, 9.35, 0]), R([2.41, 4.6, 7.99, 4.6])] },
  B: {
    w: 9.4, l: 1.3, r: 1.0, s: [
      S([1, 0, 1, 14]),
      S([1, 13, 8.0, 13, 8.0, 7.3, 1, 7.3], 2.8, { c0: 'round', c1: 'round' }),
      S([1, 7.3, 8.4, 7.3, 8.4, 1, 1, 1], 3.0, { c0: 'round', c1: 'round' }),
    ],
  },
  C: { w: 9.4, l: 1.0, r: 0.45, ov: true, s: [S([9.0, Y1, 1, Y1, 1, Y0, 9.0, Y0], 3.5)] },
  D: { w: 10, l: 1.3, r: 1.0, s: [S([1, 0, 1, 14]), S([1, 13, 9, 13, 9, 1, 1, 1], 3.6, { c0: 'round', c1: 'round' })] },
  E: { w: 8.6, l: 1.3, r: 0.55, s: [S([8.2, 13, 1, 13, 1, 1, 8.4, 1]), S([1, 7.1, 7.4, 7.1], 0, { c0: 'round' })] },
  F: { w: 8.4, l: 1.3, r: 0.45, s: [S([8.2, 13, 1, 13, 1, 0]), S([1, 6.9, 7.2, 6.9], 0, { c0: 'round' })] },
  G: { w: 9.9, l: 1.0, r: 1.1, ov: true, s: [S([9.0, Y1, 1, Y1, 1, Y0, 8.9, Y0, 8.9, 6.6, 5.4, 6.6], [3.5, 3.5, 2.4, 0])] },
  H: { w: 9.6, l: 1.3, r: 1.3, s: [S([1, 14, 1, 0]), S([8.6, 14, 8.6, 0]), R([1, 7.1, 8.6, 7.1])] },
  I: { w: 2, l: 1.3, r: 1.3, s: [S([1, 14, 1, 0])] },
  J: { w: 8.2, l: 0.6, r: 1.3, s: [S([7.2, 14, 7.2, Y0, 1, Y0, 1, 4.6], 3.2, { clip: clipLow })] },
  K: { w: 9.8, l: 1.3, r: 0.35, s: [S([1, 14, 1, 0]), S([8.4, 14, 1.0, 5.6], 0, { c1: 'round' }), S([3.8, 8.78, 8.5, 0], 0, { c0: 'round' })] },
  L: { w: 8.2, l: 1.3, r: 0.25, s: [S([1, 14, 1, 1, 8.0, 1])] },
  M: { w: 11.8, l: 1.3, r: 1.3, s: [S([1, 0, 1, 14]), S([1.1, 14, 5.9, 3.8, 10.7, 14]), S([10.8, 14, 10.8, 0])] },
  N: { w: 9.6, l: 1.3, r: 1.3, s: [S([1, 0, 1, 14]), S([1.14, 14, 8.46, 0]), S([8.6, 0, 8.6, 14])] },
  O: { w: 10.2, l: 1.0, r: 1.0, ov: true, s: [loop(1, Y0, 9.2, Y1, 3.6)] },
  P: { w: 9.2, l: 1.3, r: 0.7, s: [S([1, 0, 1, 14]), S([1, 13, 8.2, 13, 8.2, 6.3, 1, 6.3], 3.1, { c0: 'round', c1: 'round' })] },
  Q: { w: 10.2, l: 1.0, r: 0.6, ov: true, s: [loop(1, Y0, 9.2, Y1, 3.6), S([6.0, 3.8, 10.0, -1.0], 0, { c0: 'round', clip: [-2.5, CAP] })] },
  R: { w: 9.7, l: 1.3, r: 0.35, s: [S([1, 0, 1, 14]), S([1, 13, 8.2, 13, 8.2, 6.5, 1, 6.5], 3.0, { c0: 'round', c1: 'round' }), S([4.9, 6.5, 8.5, 0], 0, { c0: 'round' })] },
  S: { w: 9.4, l: 0.8, r: 0.8, ov: true, s: [S([8.4, Y1, 1, Y1, 1, 7.1, 8.4, 7.1, 8.4, Y0, 0.8, Y0], [2.9, 2.9, 3.0, 3.0])] },
  T: { w: 9.4, l: 0.3, r: 0.3, s: [S([0.2, 13, 9.2, 13]), S([4.7, 13, 4.7, 0], 0, { c0: 'round' })] },
  U: { w: 9.8, l: 1.3, r: 1.3, s: [S([1, 14, 1, Y0, 8.8, Y0, 8.8, 14], 3.4, { clip: clipLow })] },
  V: { w: 10.2, l: 0.3, r: 0.3, s: [S([1.05, 14, 5.1, 0, 9.15, 14])] },
  W: { w: 13.6, l: 0.3, r: 0.3, s: [S([1.0, 14, 3.7, 0, 6.8, 10.6, 9.9, 0, 12.6, 14], 0, { miter: 2 })] },
  X: { w: 10.0, l: 0.3, r: 0.3, s: [S([1.15, 14, 8.85, 0]), S([8.85, 14, 1.15, 0])] },
  Y: { w: 10.2, l: 0.3, r: 0.3, s: [S([1.14, 14, 5.1, 6.6, 5.1, 0]), S([9.06, 14, 5.1, 6.6], 0, { c1: 'round' })] },
  Z: { w: 9.2, l: 0.6, r: 0.6, s: [S([0.4, 13, 7.4, 13, 1.8, 1, 8.8, 1])] },
  Æ: {
    w: 14.8, l: 0.3, r: 0.55, s: [
      S([1.05, 0, 7.3, 14]),
      S([14.2, 13, 7.6, 13, 7.6, 1, 14.4, 1]),
      S([7.6, 7.1, 13.4, 7.1], 0, { c0: 'round' }),
      R([3.1, 4.6, 7.6, 4.6]),
    ],
  },
  Ø: { w: 10.2, l: 1.0, r: 1.0, ov: true, s: [loop(1, Y0, 9.2, Y1, 3.6), S([0.4, -0.9, 9.8, 14.9], 0, { clip: [-2, 16] })] },
  Å: { w: 10.4, l: 0.35, r: 0.35, s: [S([1.05, 0, 5.2, 14, 9.35, 0]), R([2.41, 4.6, 7.99, 4.6]), { p: [5.2, 16.95], ring: 1.2, clip: [0, 30] }] },

  // ---------------------------------------------------------------- figures (tabular)
  '0': { w: 8.8, l: 0.8, r: 0.8, adv: TAB, ov: true, s: [loop(1, Y0, 7.8, Y1, 3.2)] },
  '1': { w: 8.8, l: 0.8, r: 0.8, adv: TAB, s: [S([2.2, 10.9, 5.5, 14, 5.5, 0], 0, { miter: 2 })] },
  '2': { w: 8.8, l: 0.8, r: 0.8, adv: TAB, s: [S([1.0, Y1, 7.8, Y1, 7.8, 8.6, 2.1, 1, 8.5, 1], [3.2, 2.0, 0], { clip: clipHigh })] },
  '3': {
    w: 8.8, l: 0.8, r: 0.8, adv: TAB, ov: true, s: [
      S([1.0, Y1, 7.6, Y1, 7.6, 7.2, 3.4, 7.2], [3.0, 2.6]),
      S([4.6, 7.2, 7.9, 7.2, 7.9, Y0, 0.9, Y0], [2.6, 3.0], { c0: 'round' }),
    ],
  },
  '4': { w: 8.8, l: 0.8, r: 0.8, adv: TAB, s: [S([6.3, 14, 2.2, 4.4, 8.5, 4.4]), S([6.8, 9.4, 6.8, 0])] },
  '5': { w: 8.8, l: 0.8, r: 0.8, adv: TAB, s: [S([7.8, 13, 1.4, 13, 1.4, 7.7, 7.9, 7.7, 7.9, Y0, 0.9, Y0], [0, 0, 3.0, 3.0], { clip: clipLow })] },
  '6': { w: 8.8, l: 0.8, r: 0.8, adv: TAB, ov: true, s: [S([7.5, Y1, 1, Y1, 1, Y0, 7.8, Y0, 7.8, 7.4, 1, 7.4], [3.2, 3.2, 3.0, 2.8], { c1: 'round' })] },
  '7': { w: 8.8, l: 0.8, r: 0.8, adv: TAB, s: [S([0.9, 13, 7.4, 13, 3.0, 0])] },
  '8': { w: 8.8, l: 0.8, r: 0.8, adv: TAB, ov: true, s: [loop(1.3, 7.3, 7.5, Y1, 2.8), loop(1, Y0, 7.8, 7.3, 3.1)] },
  '9': { w: 8.8, l: 0.8, r: 0.8, adv: TAB, ov: true, s: [S([1.3, Y0, 7.8, Y0, 7.8, Y1, 1, Y1, 1, 6.6, 7.8, 6.6], [3.2, 3.2, 3.2, 2.8], { c1: 'round' })] },

  // ---------------------------------------------------------------- punctuation
  '.': { w: 2, l: 0.9, r: 0.9, s: [S([0, 1, 2, 1], 0, { c0: 'cut', c1: 'cut' })] },
  ',': { w: 3.0, l: 0.5, r: 0.8, s: [S([2.1, 2.0, 1.0, -2.0], 0, { c0: 'cut', c1: 'cut', clip: [-3, CAP] })] },
  ':': { w: 2, l: 1.0, r: 1.0, s: [S([0, 3.2, 2, 3.2], 0, { c0: 'cut', c1: 'cut' }), S([0, 10.2, 2, 10.2], 0, { c0: 'cut', c1: 'cut' })] },
  '%': { w: 10.8, l: 0.6, r: 0.6, s: [loop(0.8, 8.2, 4.4, Y1, 1.6, { clip: clipHigh }), loop(6.4, Y0, 10.0, 5.8, 1.6, { clip: clipLow }), S([1.3, 0, 9.5, 14])] },
  '×': { w: 7.6, l: 0.45, r: 0.3, s: [S([1.0, 4.2, 6.6, 9.8], 0, { c0: 'flat', c1: 'flat' }), S([1.0, 9.8, 6.6, 4.2], 0, { c0: 'flat', c1: 'flat' })] },
  '+': { w: 8.4, l: 0.8, r: 0.8, s: [S([0.8, 7, 7.6, 7], 0, { c0: 'flat', c1: 'flat' }), S([4.2, 3.6, 4.2, 10.4], 0, { c0: 'flat', c1: 'flat' })] },
  '−': { w: 8.4, l: 0.8, r: 0.8, s: [S([0.8, 7, 7.6, 7], 0, { c0: 'flat', c1: 'flat' })] },
  '-': { w: 6.0, l: 0.6, r: 0.6, s: [S([0.6, 6.6, 5.4, 6.6], 0, { c0: 'cut', c1: 'cut' })] },
  '/': { w: 7.8, l: 0.3, r: 0.3, s: [S([0.95, 0, 6.85, 14])] },
  '·': { w: 2.84, l: 1.1, r: 1.1, s: [S([0.71, 6.29, 2.13, 7.71], 0, { c0: 'flat', c1: 'flat' })] },
  '!': { w: 2, l: 1.3, r: 1.3, s: [S([1, 14, 1, 4.6], 0, { c1: 'cut' }), S([0, 1, 2, 1], 0, { c0: 'cut', c1: 'cut' })] },
  '±': { w: 8.4, l: 0.8, r: 0.8, s: [S([0.8, 8.6, 7.6, 8.6], 0, { c0: 'flat', c1: 'flat' }), S([4.2, 5.4, 4.2, 11.8], 0, { c0: 'flat', c1: 'flat' }), S([0.8, 2.2, 7.6, 2.2], 0, { c0: 'flat', c1: 'flat' })] },
};

/** Advance of a space (units). */
export const SPACE = 4.0;

/**
 * Kerning (units, added to the pen between the pair). Hand-tuned for the logo
 * words NORDLYS, SOLSTORM, EKSTREM, GEVINST plus the usual diagonal/open pairs.
 */
export const KERN: Record<string, number> = {
  // NORDLYS
  NO: -0.15, OR: -0.1, RD: 0.1, DL: 0, LY: -1.7, YS: -0.45,
  // SOLSTORM
  SO: -0.15, OL: 0, LS: -0.55, ST: -0.55, TO: -0.55, RM: 0.05,
  // EKSTREM
  EK: 0.05, KS: -0.35, TR: -0.35, RE: 0.1, EM: 0.1,
  // GEVINST / GEVINST-like
  GE: 0.05, EV: -0.45, VI: -0.2, IN: 0, NS: 0,
  // generic diagonals / open shapes
  AV: -1.0, VA: -1.0, AT: -0.9, TA: -0.9, AY: -1.0, YA: -1.0, AW: -0.7, WA: -0.7,
  LT: -1.5, LV: -1.3, LW: -1.0, PA: -0.8, FA: -0.7, TÆ: -0.9, VÆ: -1.0,
  KO: -0.3, KE: 0, RT: -0.3, RV: -0.3, RY: -0.4, TT: 0.1, OT: -0.5, OV: -0.3, OY: -0.4, VO: -0.3, YO: -0.4,
  LO: -0.2, LU: -0.1, KR: 0.1, EG: 0, EP: 0, PI: 0, IS: 0, SK: 0, GA: -0.2, AG: -0.2,
  FL: 0.1, LE: 0, OO: 0,
};
