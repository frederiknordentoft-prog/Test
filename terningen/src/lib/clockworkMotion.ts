/**
 * Ren matematik bag bremsning og genstart af urværket.
 * Rotationen er en CSS-animation; bremse/genstart er én Web Animations-overgang per hjul.
 */

/** Bremse- og genstartstider (ms). */
export const BRAKE_MS = 1200
export const RESUME_MS = 900

/** easeOutCubic / easeInCubic som bezier. Begge har hældning 3 i det punkt, hvor de møder CSS-animationen. */
export const EASE_OUT = 'cubic-bezier(0.33, 1, 0.68, 1)'
export const EASE_IN = 'cubic-bezier(0.32, 0, 0.67, 0)'
export const EASE_SLOPE = 3

/** id på de midlertidige Web Animations, så de kan findes og annulleres. */
export const WAAPI_ID = 'gear-brake'

/** Vinkelhastighed i grader/s for et hjul med given omløbstid og retning. */
export function omega(periodS: number, dir: 1 | -1): number {
  return (dir * 360) / periodS
}

/**
 * Hvor langt hjulet drejer under en ease-out/ease-in på `durationMs`, når kurven skal
 * møde CSS-animationens konstante hastighed uden knæk: Δ = ω · T / hældning.
 */
export function coastAngle(periodS: number, dir: 1 | -1, durationMs: number): number {
  return (omega(periodS, dir) * (durationMs / 1000)) / EASE_SLOPE
}

/** Læser rotationsvinklen (grader) ud af et beregnet `transform` (matrix eller matrix3d). */
export function angleFromTransform(transform: string | null | undefined): number {
  if (!transform || transform === 'none') return 0
  const m = transform.match(/matrix(3d)?\(([^)]+)\)/)
  if (!m || !m[2]) return 0
  const v = m[2].split(',').map((x) => Number(x.trim()))
  const a = v[0] ?? 1
  const b = v[1] ?? 0
  return (Math.atan2(b, a) * 180) / Math.PI
}

/** Negativ `animation-delay` (s), der starter CSS-animationen præcis i vinklen `angle`. */
export function delayForAngle(angle: number, periodS: number, dir: 1 | -1): number {
  const norm = ((angle % 360) + 360) % 360
  const progress = dir === 1 ? norm / 360 : ((360 - norm) % 360) / 360
  return -progress * periodS
}
