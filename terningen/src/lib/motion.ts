/** Læser prefers-reduced-motion live (kan slås til midt i en session). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

/** Finder fladen (eller urværket) for en komponent i DOM'en. */
export function componentElement(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(`[data-component="${id}"][role="button"]`)
  return el instanceof HTMLElement ? el : null
}

/**
 * Giver tastaturfokus tilbage til komponentens flade efter Esc eller Luk — men kun hvis
 * fokus stod inde i panelet (en tastaturbruger); ellers ville mellemrum bagefter genåbne
 * fladen i stedet for at gå videre i fortællingen.
 */
export function restoreFocusAfterClose(id: string): void {
  if (typeof document === 'undefined') return
  const active = document.activeElement
  if (!(active instanceof Element) || !active.closest('.panel-card')) return
  componentElement(id)?.focus()
}
