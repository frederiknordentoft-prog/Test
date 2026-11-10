/**
 * Display-referred colour for a scene-referred pipeline.
 *
 * The stage tone-maps with ACES in OutputPass, and the toe of that curve
 * crushes near-black values by roughly a factor of ten: a palette hex used
 * directly as a sky colour would simply display as black. `displayColor`
 * inverts the curve, so the art bible's night and nebula colours arrive on
 * screen as written.
 */
import * as THREE from 'three';

// Same constants as three's ACESFilmicToneMapping (row-major here).
const IN = new THREE.Matrix3().set(0.59719, 0.35458, 0.04823, 0.076, 0.90834, 0.01566, 0.0284, 0.13383, 0.83777);
const OUT = new THREE.Matrix3().set(1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602);
const IN_INV = IN.clone().invert();
const OUT_INV = OUT.clone().invert();

function inverseFit(y: number): number {
  // Solve y = (v (v + A) − B) / (v (C v + D) + E) for v ≥ 0.
  const A = 0.0245786, B = 0.000090537, C = 0.983729, D = 0.432951, E = 0.238081;
  const yy = Math.min(Math.max(y, 0), 0.98);
  const qa = 1 - C * yy;
  const qb = A - D * yy;
  const qc = -(B + E * yy);
  return (-qb + Math.sqrt(qb * qb - 4 * qa * qc)) / (2 * qa);
}

/**
 * Scene-linear RGB that the output pass turns into `hex * gain` on screen.
 * Meant for dark and mid tones (the sky); saturated highlights are outside
 * what the curve can reach, use `emissive` for those.
 */
export function displayColor(color: number | THREE.Color, gain = 1): THREE.Vector3 {
  const c = typeof color === 'number' ? new THREE.Color(color) : color;
  const v = new THREE.Vector3(c.r * gain, c.g * gain, c.b * gain).applyMatrix3(OUT_INV);
  v.set(inverseFit(v.x), inverseFit(v.y), inverseFit(v.z)).applyMatrix3(IN_INV).multiplyScalar(0.6);
  return v.set(Math.max(v.x, 0), Math.max(v.y, 0), Math.max(v.z, 0));
}

/** Plain linear palette colour times an HDR gain, for things that glow. */
export function emissive(hex: number, gain = 1): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r * gain, c.g * gain, c.b * gain);
}
