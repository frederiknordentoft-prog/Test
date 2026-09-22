// Colour grade presets for UberPost. Display-referred (sRGB-encoded values, like the rest of the 2D pipeline).
// The shader applies:  x = gain * (x + lift * (1 - x));  x = pow(x, 1/gamma);  S-curve(contrast, pivot);  saturation.
// Presets are blended on the CPU by `storm` (0..1) once per frame and written into the uniform arrays (no allocation).

export interface GradePreset {
  lift: readonly [number, number, number];
  gamma: readonly [number, number, number];
  gain: readonly [number, number, number];
  contrast: number;
  pivot: number;
  sat: number;
  /** Multiplier reached at full vignette (tinted darkening, never a flat black). */
  vigTint: readonly [number, number, number];
  /** How much stronger vignette / grain get relative to the user values. */
  vigBoost: number;
  grainBoost: number;
}

/** NORDLYS base: cool, clean, inky navy blacks (never grey), faint teal mids, crisp highlights. */
export const GRADE_BASE: GradePreset = {
  lift: [0.004, 0.009, 0.022],
  gamma: [0.985, 1.0, 1.035],
  gain: [0.985, 1.0, 1.02],
  contrast: 1.07,
  pivot: 0.42,
  sat: 1.06,
  vigTint: [0.34, 0.4, 0.56], // cool-neutral falloff (a hint of navy, never a blue cast on warm colours)
  vigBoost: 1,
  grainBoost: 1,
};

/** SOLSTORM: hot and violent, but never a red wash. Heat lives in the highlights (molten → white-hot) and in hard
 *  contrast; shadows fall to crimson-black; mids and saturation are pushed only lightly (the storm art is already
 *  crimson — a strong red mid push turned half the frame into saturated red, see PLAN §6 photosensitivity). */
export const GRADE_STORM: GradePreset = {
  lift: [0.026, 0.0, 0.008],
  gamma: [1.04, 0.98, 0.95],
  gain: [1.05, 1.0, 0.9],
  contrast: 1.22,
  pivot: 0.42,
  sat: 1.06,
  vigTint: [0.46, 0.16, 0.2], // edges burn toward crimson-black
  vigBoost: 1.45,
  grainBoost: 1.5,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Blend two presets into the given uniform arrays (length ≥ 3). Returns nothing; zero allocations. */
export function blendGrade(
  a: GradePreset, b: GradePreset, t: number,
  lift: Float32Array, invGamma: Float32Array, gain: Float32Array, tone: Float32Array, vigTint: Float32Array,
): { vigBoost: number; grainBoost: number } {
  for (let i = 0; i < 3; i++) {
    lift[i] = lerp(a.lift[i], b.lift[i], t);
    invGamma[i] = 1 / lerp(a.gamma[i], b.gamma[i], t);
    gain[i] = lerp(a.gain[i], b.gain[i], t);
    vigTint[i] = lerp(a.vigTint[i], b.vigTint[i], t);
  }
  tone[0] = lerp(a.sat, b.sat, t);
  tone[1] = lerp(a.contrast, b.contrast, t);
  tone[2] = lerp(a.pivot, b.pivot, t);
  _boost.vigBoost = lerp(a.vigBoost, b.vigBoost, t);
  _boost.grainBoost = lerp(a.grainBoost, b.grainBoost, t);
  return _boost;
}
const _boost = { vigBoost: 1, grainBoost: 1 };
