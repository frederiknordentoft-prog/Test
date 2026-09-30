// Motion tokens and helpers (SPEC §11). CSS and WAAPI only, no motion library. Only transform and
// opacity are ever animated. Calm mode (`data-calm` on <html>) and prefers-reduced-motion reduce
// every movement to a crossfade.

export const DUR = { fast: 120, base: 220, slow: 400, press: 80, release: 180 } as const
export const EASE = 'cubic-bezier(.2,.8,.2,1)'
export const EASE_IN = 'cubic-bezier(.5,0,.75,0)'
/** Screen change: slide 24 px and fade (SPEC §11). */
export const SCREEN_SHIFT = 24

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** True in calm mode or with reduced motion: only crossfades, no loops, no travel. */
export function isCalm(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.hasAttribute('data-calm') || prefersReducedMotion()
}

/** Turns calm mode on or off for the whole app. */
export function setCalm(on: boolean): void {
  if (typeof document === 'undefined') return
  if (on) document.documentElement.setAttribute('data-calm', '')
  else document.documentElement.removeAttribute('data-calm')
}

/**
 * Samples a damped spring (mass 1) from 0 to 1 as WAAPI offsets, so sheets can "spring" without a
 * library. Stiffness 380 and damping 32 are the sheet values from the art direction (§1.5).
 */
export function springCurve(stiffness = 380, damping = 32, fps = 60): { values: number[]; durationMs: number } {
  const dt = 1 / fps
  let x = 0
  let v = 0
  const values = [0]
  for (let i = 0; i < fps * 2; i++) {
    const a = stiffness * (1 - x) - damping * v
    v += a * dt
    x += v * dt
    values.push(x)
    if (Math.abs(1 - x) < 0.001 && Math.abs(v) < 0.01) break
  }
  values[values.length - 1] = 1
  return { values, durationMs: Math.round((values.length - 1) * dt * 1000) }
}

/** Keyframes for a spring translate along Y from `fromY` (any CSS length) to 0. */
export function springInY(el: Element, fromY: string, stiffness?: number, damping?: number): Animation {
  const { values, durationMs } = springCurve(stiffness, damping)
  const frames = values.map((p) => ({ transform: `translateY(calc(${fromY} * ${(1 - p).toFixed(4)}))` }))
  return el.animate(frames, { duration: durationMs, easing: 'linear', fill: 'both' })
}

export function fade(el: Element, from: number, to: number, duration: number = DUR.base): Animation {
  return el.animate([{ opacity: from }, { opacity: to }], { duration, easing: EASE, fill: 'both' })
}

export type ScreenDirection = 'forward' | 'back' | 'none'

/** Enter animation for a screen: slide 24 px from the travel direction and fade in. */
export function screenIn(el: Element, dir: ScreenDirection): Animation {
  if (isCalm() || dir === 'none') return fade(el, 0, 1, isCalm() ? DUR.fast : DUR.base)
  const dx = dir === 'forward' ? SCREEN_SHIFT : -SCREEN_SHIFT
  return el.animate(
    [
      { opacity: 0, transform: `translateX(${dx}px)` },
      { opacity: 1, transform: 'translateX(0)' },
    ],
    { duration: DUR.base, easing: EASE, fill: 'both' },
  )
}

/** Exit animation for the screen being replaced. */
export function screenOut(el: Element, dir: ScreenDirection): Animation {
  if (isCalm() || dir === 'none') return fade(el, 1, 0, isCalm() ? DUR.fast : DUR.base)
  const dx = dir === 'forward' ? -SCREEN_SHIFT : SCREEN_SHIFT
  return el.animate(
    [
      { opacity: 1, transform: 'translateX(0)' },
      { opacity: 0, transform: `translateX(${dx}px)` },
    ],
    { duration: DUR.base, easing: EASE, fill: 'both' },
  )
}

/** A short celebratory pop (scale only) – used by answer cards and badges. */
export function pop(el: Element, scale = 1.08): Animation | null {
  if (isCalm()) return null
  return el.animate(
    [{ transform: 'scale(1)' }, { transform: `scale(${scale})`, offset: 0.4 }, { transform: 'scale(1)' }],
    { duration: DUR.slow, easing: EASE },
  )
}
