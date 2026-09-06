/** Læser prefers-reduced-motion live (kan slås til midt i en session). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function onReducedMotionChange(cb: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  const handler = (e: MediaQueryListEvent) => cb(e.matches)
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}

export function easeOutCubic(t: number): number {
  const u = 1 - t
  return 1 - u * u * u
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Fjerner fokus efter et museklik (e.detail > 0), så mellemrum/Enter bagefter styrer
 * fortællingen i stedet for at gentage det sidst klikkede element. Tastaturaktivering
 * (detail === 0) beholder fokus.
 */
export function blurIfPointer(e: { detail: number; currentTarget: EventTarget | null; button?: number }): void {
  const fromPointer = e.detail > 0 || (e.button !== undefined && e.button !== 0)
  if (fromPointer && e.currentTarget instanceof HTMLElement) e.currentTarget.blur()
}
