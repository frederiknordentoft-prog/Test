// Rest (SPEC A25): after REST_MS without a touch on a screen that allows it (the map, Dyrehaven,
// "Vælg spiller" and a task waiting for its answer), `data-rest` on <html> pauses the decorative
// loops. The CSS twins of those loops set only `animation-play-state: paused`, so everything freezes
// where it is and goes on from the same phase at the next touch, click, key or wheel. Attention cues
// (REST_CUES: the lightbulb, a speaking card, the next stone …) keep calling for DEEP_MS more; then
// `data-rest="deep"` pauses them too, all but the animal's blink, because one running loop keeps the
// phone drawing every frame. A screen allows rest with useRestAllowed(on); the ceremonies,
// onboarding, the wardrobe and a task's intro, demo and teaching never do.
import { useEffect } from 'react'

export const REST_MS = 20_000
/** How long the attention cues keep calling once the app rests, before they stand still too. */
export const DEEP_MS = 10_000
export const REST_ATTR = 'data-rest'
/** The attribute's value once the cues stand still too (resting before that: ''). */
export const DEEP = 'deep'

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

/**
 * Input that wakes the app, heard first (capture) and never delaying a scroll (passive). A finger
 * that drags (a bubble, a knob) keeps it awake, and letting go wakes it.
 */
export const WAKE_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'click', 'keydown', 'wheel'] as const

const NOOP = () => undefined

/** awake, resting (the loops stand still), deep (the cues too) */
type Stage = 0 | 1 | 2

/** A rest controller; `restMs` ≤ 0 turns rest off, `deepMs` ≤ 0 lets the cues call for as long as it rests. */
export function createRest(env: RestEnv, restMs: number = REST_MS, deepMs: number = DEEP_MS): Rest {
  let allowed = 0
  let last = 0
  let timer: number | null = null
  let stage: Stage = 0
  let installed = false

  const set = (to: Stage) => {
    if (to === stage) return
    stage = to
    if (to === 0) env.root.removeAttribute(REST_ATTR)
    else env.root.setAttribute(REST_ATTR, to === 2 ? DEEP : '')
  }
  /** How long the quiet must last for the next stage after this one (null: none). */
  const due = (s: Stage) => (s === 0 ? restMs : s === 1 && deepMs > 0 ? restMs + deepMs : null)
  const arm = (ms: number) => {
    timer = env.setTimer(tick, ms)
  }
  // one timer: move on to each stage once the quiet has lasted, otherwise look again when it would have
  function tick() {
    timer = null
    if (allowed === 0) return
    const quiet = env.now() - last
    let next = due(stage)
    while (next !== null && quiet >= next) {
      set((stage + 1) as Stage)
      next = due(stage)
    }
    if (next !== null) arm(next - quiet)
  }
  const wake = () => {
    last = env.now()
    if (stage === 0) return
    set(0)
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
        set(0)
      }
    },
  }
}

/** A time from the URL that only a test may set: `?e2e=1&<key>=<ms>` (0 turns it off). */
function msFrom(search: string, key: string, fallback: number): number {
  const params = new URLSearchParams(search)
  const raw = params.get(key)
  if (params.get('e2e') !== '1' || raw === null || raw.trim() === '') return fallback
  const ms = Number(raw)
  return Number.isFinite(ms) && ms >= 0 ? ms : fallback
}

/** The rest time from the URL: `?e2e=1&rest=<ms>` sets it for a test (0 turns rest off). */
export const restMsFrom = (search: string): number => msFrom(search, 'rest', REST_MS)
/** How long the cues keep calling at rest: `?e2e=1&deep=<ms>` sets it for a test (0: for as long as it rests). */
export const deepMsFrom = (search: string): number => msFrom(search, 'deep', DEEP_MS)

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
  app ??= createRest(browserEnv(), restMsFrom(location.search), deepMsFrom(location.search))
  return app
}

/** While `on`, this screen lets the app rest after REST_MS without a touch. */
export function useRestAllowed(on: boolean): void {
  useEffect(() => (on ? appRest().allow() : undefined), [on])
}
