// Deferring work off the frame that shows a change. `afterPaint` runs once the frame is on screen
// (a frame callback, then a task after it): the effects of a tap — the burst of stars, the start of
// the voice — follow the green card instead of holding it back. `whenIdle` runs when the browser has
// nothing else to do; Safari has no requestIdleCallback, so there it is a plain timeout.

type IdleWindow = {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
}

/** Run `fn` after the next paint. Returns a cancel function. */
export function afterPaint(fn: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  if (typeof requestAnimationFrame !== 'function') {
    timer = setTimeout(fn, 0)
    return () => clearTimeout(timer!)
  }
  const raf = requestAnimationFrame(() => {
    timer = setTimeout(fn, 0)
  })
  return () => {
    cancelAnimationFrame(raf)
    if (timer !== null) clearTimeout(timer)
  }
}

export interface IdleOptions {
  /** Longest wait where requestIdleCallback exists (none: whenever the browser is idle). */
  timeout?: number
  /** The wait without requestIdleCallback (Safari). */
  fallbackMs?: number
}

/** Run `fn` when the browser is idle. Returns a cancel function. */
export function whenIdle(fn: () => void, opts: IdleOptions = {}): () => void {
  const w = globalThis as IdleWindow
  if (w.requestIdleCallback) {
    const id = opts.timeout !== undefined ? w.requestIdleCallback(fn, { timeout: opts.timeout }) : w.requestIdleCallback(fn)
    return () => w.cancelIdleCallback?.(id)
  }
  const id = setTimeout(fn, opts.fallbackMs ?? 600)
  return () => clearTimeout(id)
}
