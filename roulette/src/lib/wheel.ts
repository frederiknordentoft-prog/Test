/**
 * European single-zero wheel: canonical constants and the number <-> angle math.
 *
 * Angle convention (used everywhere in this project):
 *  - Angles are radians around +Y. A point "at angle a" sits at (sin a, y, cos a) * r,
 *    so a = 0 is +Z and increasing a is counter-clockwise seen from above.
 *  - The pocket sequence runs CLOCKWISE seen from above, so pocket index i is at
 *    rotor-local angle -i * POCKET_STEP.
 *  - With rotor rotation.y = phi, a pocket at local angle a sits at world angle a + phi.
 */

/** Canonical European pocket order, clockwise starting at 0. */
export const POCKET_SEQUENCE = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const

export const POCKET_COUNT = 37
export const POCKET_STEP = (Math.PI * 2) / POCKET_COUNT

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
])

export type PocketColor = 'green' | 'red' | 'black'

export function colorOf(n: number): PocketColor {
  if (n === 0) return 'green'
  return RED_NUMBERS.has(n) ? 'red' : 'black'
}

const INDEX_OF_NUMBER = new Map<number, number>(
  POCKET_SEQUENCE.map((n, i) => [n, i]),
)

export function indexOfNumber(n: number): number {
  const i = INDEX_OF_NUMBER.get(n)
  if (i === undefined) throw new Error(`Not a roulette number: ${n}`)
  return i
}

export const TWO_PI = Math.PI * 2

/** Normalize an angle to [0, 2*PI). */
export function normalizeAngle(a: number): number {
  return ((a % TWO_PI) + TWO_PI) % TWO_PI
}

/** Spec helper: clockwise position of N in the sequence, in degrees. */
export function pocketAngleDeg(n: number): number {
  return indexOfNumber(n) * (360 / POCKET_COUNT)
}

/** Rotor-local angle (radians, our CCW-positive convention) of pocket N's center. */
export function pocketLocalAngle(n: number): number {
  return normalizeAngle(-indexOfNumber(n) * POCKET_STEP)
}

/**
 * Rotor rotation.y that puts pocket N's center at the given world angle.
 * world = local + phi  =>  phi = world - local.
 */
export function rotorAngleForNumber(n: number, worldAngle = 0): number {
  return normalizeAngle(worldAngle - pocketLocalAngle(n))
}

/** Which pocket number sits at world angle `theta` when the rotor is at `phi`. */
export function pocketAtWorldAngle(theta: number, phi: number): number {
  const local = normalizeAngle(theta - phi)
  // local = -i * STEP (mod 2PI)  =>  i = -local / STEP (mod 37)
  const i = (Math.round(-local / POCKET_STEP) % POCKET_COUNT + POCKET_COUNT) % POCKET_COUNT
  return POCKET_SEQUENCE[i]
}

/* ------------------------------------------------------------------ */
/* Wheel dimensions (one unit ~ a 400 mm bowl radius wheel).           */
/* ------------------------------------------------------------------ */

export const WHEEL = {
  /** Outer bowl wall. */
  bowlOuterRadius: 1.06,
  bowlRimHeight: 0.47,

  /** Banked ball track (upper rim where the ball spirals). */
  trackOuterRadius: 0.95,
  trackInnerRadius: 0.82,
  trackOuterY: 0.4,
  trackInnerY: 0.295,

  /** Stationary apron between track and rotor; deflectors live here. */
  apronOuterRadius: 0.8,
  apronInnerRadius: 0.62,
  apronOuterY: 0.27,
  apronInnerY: 0.135,
  deflectorCount: 8,
  deflectorRadius: 0.71,

  /** Rotor. */
  rotorRadius: 0.58,
  numberRingOuterRadius: 0.58,
  numberRingInnerRadius: 0.46,
  numberRingOuterY: 0.1,
  numberRingInnerY: 0.035,
  pocketOuterRadius: 0.455,
  pocketInnerRadius: 0.335,
  pocketFloorY: 0.0,
  fretHeight: 0.034,
  fretWidth: 0.01,
  coneBaseY: 0.025,
  turretTopY: 0.31,

  ballRadius: 0.028,
} as const

/** Apron slope angle (radians), used to seat deflectors on the surface. */
export const APRON_SLOPE = Math.atan2(
  WHEEL.apronOuterY - WHEEL.apronInnerY,
  WHEEL.apronOuterRadius - WHEEL.apronInnerRadius,
)
