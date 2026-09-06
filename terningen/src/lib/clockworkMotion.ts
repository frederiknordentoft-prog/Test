/**
 * Ren matematik bag bremsning og genstart af urværket.
 * Rotationen er en CSS-animation; bremse/genstart er én Web Animations-overgang per hjul.
 */

/** Bremse- og genstartstider (ms). */
export const BRAKE_MS = 1200
export const RESUME_MS = 900

/** Hældningen i det punkt, hvor kurverne møder CSS-animationens konstante hastighed. */
export const EASE_SLOPE = 3

/** Antal keyframes per overgang (lineær interpolation imellem — glat nok ved 25-40 ms per trin). */
export const KEYFRAME_STEPS = 32

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

export type MotionKind = 'brake' | 'resume'

/**
 * Bremsning: hastigheden aftager kvadratisk, v(u) = v0·(1−u)², så bremsen griber først og
 * slipper blødt (ease-out). Vinklen er integralet: a(u) = a0 + v0·D·(1 − (1−u)³)/3.
 * Starthastigheden er den faktiske (v0), så en bremsning midt i en genstart giver intet ryk.
 */
export function brakeAngle(a0: number, v0: number, durationMs: number, u: number): number {
  const D = durationMs / 1000
  return a0 + (v0 * D * (1 - (1 - u) ** 3)) / 3
}

/**
 * Genstart: hastigheden vokser kvadratisk fra v0 til v1, v(u) = v0 + (v1 − v0)·u² (ease-in), så
 * den møder CSS-animationens hastighed v1 uden knæk. a(u) = a0 + v0·D·u + (v1 − v0)·D·u³/3.
 */
export function resumeAngle(a0: number, v0: number, v1: number, durationMs: number, u: number): number {
  const D = durationMs / 1000
  return a0 + v0 * D * u + ((v1 - v0) * D * u ** 3) / 3
}

/** Øjeblikkelig hastighed (grader/s) midt i en overgang ved fremdrift u ∈ [0,1]. */
export function velocityAt(kind: MotionKind, v0: number, v1: number, u: number): number {
  const t = Math.min(1, Math.max(0, u))
  return kind === 'brake' ? v0 * (1 - t) ** 2 : v0 + (v1 - v0) * t ** 2
}

/** Web Animations-keyframes for en overgang; bruges med `easing: 'linear'`. */
export function motionKeyframes(
  kind: MotionKind,
  a0: number,
  v0: number,
  v1: number,
  durationMs: number,
  steps = KEYFRAME_STEPS,
): Keyframe[] {
  const frames: Keyframe[] = []
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    const angle = kind === 'brake' ? brakeAngle(a0, v0, durationMs, u) : resumeAngle(a0, v0, v1, durationMs, u)
    frames.push({ offset: u, transform: `rotate(${angle}deg)` })
  }
  return frames
}

/** Negativ `animation-delay` (s), der starter CSS-animationen præcis i vinklen `angle`. */
export function delayForAngle(angle: number, periodS: number, dir: 1 | -1): number {
  const norm = ((angle % 360) + 360) % 360
  const progress = dir === 1 ? norm / 360 : ((360 - norm) % 360) / 360
  return -progress * periodS
}
