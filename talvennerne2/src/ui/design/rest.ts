// Rest (SPEC A25): after REST_MS without a touch on a screen that allows it (the map, Dyrehaven,
// "Vælg spiller" and a task waiting for its answer), `data-rest` on <html> pauses the decorative
// loops. The CSS twins of those loops set only `animation-play-state: paused`, so everything freezes
// where it is and goes on from the same phase at the next tap, click, key or wheel. Attention cues
// (REST_CUES: the lightbulb, a speaking card, the next stone …) keep running. A screen allows rest
// with useRestAllowed(on); the ceremonies, onboarding, the wardrobe and a task's intro, demo and
// teaching never do.
import { useEffect } from 'react'

export const REST_MS = 20_000
export const REST_ATTR = 'data-rest'

/** What the controller touches, so a test can run it on fake timers without a DOM. */
export interface RestEnv {
  /** Carries the attribute (<html>). */
  root: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void }
  /** Hears the waking input (document). */
  events: { addEventListener(type: string, listener: () => void, options: AddEventListenerOptions): void }
  now(): number
  setTimer(fn: () => void, ms: number): number
  clearTimer(id: number): void
  /** Calls `fn` each time the page becomes visible again. */
  visible(fn: () => void): void
}

export interface Rest {
  /** One more screen allows rest; the returned release (idempotent) takes it back. */
  allow(): () => void
}

/** Input that wakes the app: heard first (capture), never delaying a scroll (passive). */
export const WAKE_EVENTS = ['pointerdown', 'click', 'keydown', 'wheel'] as const

const NOOP = () => undefined

/** A rest controller; `restMs` ≤ 0 turns rest off. */
export function createRest(env: RestEnv, restMs: number = REST_MS): Rest {
  let allowed = 0
  let last = 0
  let timer: number | null = null
  let resting = false
  let installed = false

  const set = (on: boolean) => {
    if (on === resting) return
    resting = on
    if (on) env.root.setAttribute(REST_ATTR, '')
    else env.root.removeAttribute(REST_ATTR)
  }
  const arm = (ms: number) => {
    timer = env.setTimer(tick, ms)
  }
  // one timer: rest once the quiet has lasted, otherwise look again when it would have
  function tick() {
    timer = null
    if (allowed === 0) return
    const quiet = env.now() - last
    if (quiet >= restMs) set(true)
    else arm(restMs - quiet)
  }
  const wake = () => {
    last = env.now()
    if (!resting) return
    set(false)
    if (allowed > 0 && timer === null) arm(restMs)
  }
  const install = () => {
    installed = true
    for (const type of WAKE_EVENTS) env.events.addEventListener(type, wake, { capture: true, passive: true })
    // back on screen: the quiet starts over, but nothing wakes by itself
    env.visible(() => {
      last = env.now()
    })
  }

  return {
    allow() {
      if (restMs <= 0) return NOOP
      if (!installed) install()
      allowed++
      if (allowed === 1) {
        last = env.now()
        arm(restMs)
      }
      let released = false
      return () => {
        if (released) return
        released = true
        allowed--
        if (allowed > 0) return
        if (timer !== null) env.clearTimer(timer)
        timer = null
        set(false)
      }
    },
  }
}

/** The rest time from the URL: `?e2e=1&rest=<ms>` sets it for a test (0 turns rest off). */
export function restMsFrom(search: string): number {
  const params = new URLSearchParams(search)
  const raw = params.get('rest')
  if (params.get('e2e') !== '1' || raw === null || raw.trim() === '') return REST_MS
  const ms = Number(raw)
  return Number.isFinite(ms) && ms >= 0 ? ms : REST_MS
}

function browserEnv(): RestEnv {
  return {
    root: document.documentElement,
    events: document,
    now: () => performance.now(),
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (id) => window.clearTimeout(id),
    visible: (fn) =>
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') fn()
      }),
  }
}

let app: Rest | null = null

/** The app's controller, made on first use. */
function appRest(): Rest {
  app ??= createRest(browserEnv(), restMsFrom(location.search))
  return app
}

/** While `on`, this screen lets the app rest after REST_MS without a touch. */
export function useRestAllowed(on: boolean): void {
  useEffect(() => (on ? appRest().allow() : undefined), [on])
}
