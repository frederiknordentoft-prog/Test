// The rest controller (SPEC A25) on fake timers and a fake environment: when the app rests and when
// the rest turns deep, what wakes it, how screens share it, and the URL's test hooks.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEEP, DEEP_MS, REST_ATTR, REST_MS, WAKE_EVENTS, createRest, deepMsFrom, restMsFrom } from './rest'
import type { RestEnv } from './rest'

interface Listener {
  type: string
  fn: (event: Event) => void
  options: AddEventListenerOptions
}

function fake() {
  const attrs = new Map<string, string>()
  const changes: string[] = []
  const listeners: Listener[] = []
  const shown: (() => void)[] = []
  const env: RestEnv = {
    root: {
      setAttribute: (name, value) => {
        attrs.set(name, value)
        changes.push(value ? `+${name}=${value}` : `+${name}`)
      },
      removeAttribute: (name) => {
        attrs.delete(name)
        changes.push(`-${name}`)
      },
    },
    events: { addEventListener: (type, fn, options) => listeners.push({ type, fn, options }) },
    now: () => performance.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms) as unknown as number,
    clearTimer: (id) => clearTimeout(id),
    visible: (fn) => shown.push(fn),
  }
  return {
    env,
    changes,
    listeners,
    shown,
    resting: () => attrs.has(REST_ATTR),
    deep: () => attrs.get(REST_ATTR) === DEEP,
    /** A tap (or another waking input) on the page; a pointermove drags (a finger or button down) unless `buttons` says 0. */
    input: (type: string = 'pointerdown', buttons = 1) => listeners.filter((l) => l.type === type).forEach((l) => l.fn({ type, buttons } as unknown as Event)),
    /** The page comes back on screen. */
    show: () => shown.forEach((fn) => fn()),
  }
}

const wait = (ms: number) => vi.advanceTimersByTime(ms)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('rest', () => {
  it('rests after exactly 20 000 ms without a touch, not at 19 999', () => {
    expect(REST_MS).toBe(20_000)
    const f = fake()
    createRest(f.env).allow()
    wait(19_999)
    expect(f.resting()).toBe(false)
    wait(1)
    expect(f.resting()).toBe(true)
  })

  it('moves the rest to 35 s when the child touches the screen at 15 s', () => {
    const f = fake()
    createRest(f.env).allow()
    wait(15_000)
    f.input()
    wait(19_999)
    expect(f.resting()).toBe(false)
    wait(1)
    expect(f.resting()).toBe(true)
  })

  it('wakes on a touch, a drag, a release, a click, a key and the wheel, and rests again after another 20 s', () => {
    expect(WAKE_EVENTS).toEqual(['pointerdown', 'pointermove', 'pointerup', 'click', 'keydown', 'wheel'])
    for (const type of WAKE_EVENTS) {
      const f = fake()
      createRest(f.env).allow()
      wait(25_000)
      expect(f.resting()).toBe(true)
      f.input(type)
      expect(f.resting(), type).toBe(false)
      wait(19_999)
      expect(f.resting(), type).toBe(false)
      wait(1)
      expect(f.resting(), type).toBe(true)
    }
  })

  it('never rests when no screen allows it', () => {
    const f = fake()
    const rest = createRest(f.env)
    wait(60_000)
    expect(f.resting()).toBe(false)
    rest.allow()()
    wait(60_000)
    expect(f.resting()).toBe(false)
    expect(f.changes).toEqual([])
  })

  it('wakes at once when the last screen lets go', () => {
    const f = fake()
    const release = createRest(f.env).allow()
    wait(20_000)
    expect(f.resting()).toBe(true)
    release()
    expect(f.resting()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('counts the screens that allow it: rest lasts until the last one lets go', () => {
    const f = fake()
    const rest = createRest(f.env)
    const map = rest.allow()
    wait(10_000)
    // a second screen does not start the clock over (only the first one does)
    const round = rest.allow()
    wait(10_000)
    expect(f.resting()).toBe(true)
    map()
    expect(f.resting()).toBe(true)
    round()
    expect(f.resting()).toBe(false)
  })

  it('starts the clock when a screen allows rest, not before', () => {
    const f = fake()
    const rest = createRest(f.env)
    wait(50_000)
    rest.allow()
    wait(19_999)
    expect(f.resting()).toBe(false)
    wait(1)
    expect(f.resting()).toBe(true)
  })

  it('ignores a release that was already given', () => {
    const f = fake()
    const rest = createRest(f.env)
    const a = rest.allow()
    const b = rest.allow()
    a()
    a()
    wait(20_000)
    expect(f.resting()).toBe(true)
    b()
    b()
    expect(f.resting()).toBe(false)
    // the count never went below zero: one new screen is enough to rest again
    const c = rest.allow()
    wait(20_000)
    expect(f.resting()).toBe(true)
    c()
    expect(f.resting()).toBe(false)
  })

  it('is off with rest=0', () => {
    const f = fake()
    const release = createRest(f.env, restMsFrom('?e2e=1&voice=fast&rest=0')).allow()
    wait(120_000)
    expect(f.resting()).toBe(false)
    expect(f.listeners).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
    release()
    expect(f.changes).toEqual([])
  })

  it('starts the clock over when the page comes back on screen, without waking', () => {
    const f = fake()
    createRest(f.env).allow()
    wait(15_000)
    f.show()
    wait(19_999)
    expect(f.resting()).toBe(false)
    wait(1)
    expect(f.resting()).toBe(true)
    // resting and back on screen: still resting until a touch
    f.show()
    wait(5_000)
    expect(f.resting()).toBe(true)
    expect(f.changes).toEqual([`+${REST_ATTR}`])
    f.input()
    expect(f.resting()).toBe(false)
  })

  it('listens with capture and passive, installed once on the first allow', () => {
    const f = fake()
    const rest = createRest(f.env)
    expect(f.listeners).toEqual([])
    expect(f.shown).toHaveLength(0)
    rest.allow()()
    rest.allow()
    rest.allow()
    expect(f.listeners.map((l) => l.type).sort()).toEqual(['click', 'keydown', 'pointerdown', 'pointermove', 'pointerup', 'wheel'])
    for (const l of f.listeners) expect(l.options, l.type).toEqual({ capture: true, passive: true })
    expect(f.shown).toHaveLength(1)
  })

  it('changes the attribute only when the state changes, with one timer at a time', () => {
    const f = fake()
    createRest(f.env).allow()
    for (let i = 0; i < 10; i++) {
      wait(1_000)
      f.input()
      f.input('click')
      expect(vi.getTimerCount()).toBeLessThanOrEqual(1)
    }
    expect(f.changes).toEqual([])
    wait(20_000)
    expect(f.changes).toEqual([`+${REST_ATTR}`])
    expect(vi.getTimerCount()).toBe(1)
    wait(10_000)
    expect(f.changes).toEqual([`+${REST_ATTR}`, `+${REST_ATTR}=${DEEP}`])
    expect(vi.getTimerCount()).toBe(0)
    wait(60_000)
    f.input()
    f.input('click')
    f.input('pointermove')
    f.input('wheel')
    expect(f.changes).toEqual([`+${REST_ATTR}`, `+${REST_ATTR}=${DEEP}`, `-${REST_ATTR}`])
    expect(vi.getTimerCount()).toBe(1)
  })

  it('turns deep 10 s into the rest (30 000 ms without a touch), not at 29 999', () => {
    expect(DEEP_MS).toBe(10_000)
    const f = fake()
    createRest(f.env).allow()
    wait(20_000)
    expect(f.resting() && !f.deep()).toBe(true)
    wait(9_999)
    expect(f.deep()).toBe(false)
    wait(1)
    expect(f.deep()).toBe(true)
    wait(120_000)
    expect(f.deep()).toBe(true)
    expect(f.changes).toEqual([`+${REST_ATTR}`, `+${REST_ATTR}=${DEEP}`])
  })

  it('does not wake for a mouse that only hovers, but does for a drag', () => {
    const f = fake()
    createRest(f.env).allow()
    wait(15_000)
    f.input('pointermove', 0)
    wait(5_000)
    expect(f.resting()).toBe(true)
    f.input('pointermove', 0)
    expect(f.resting()).toBe(true)
    wait(10_000)
    expect(f.deep()).toBe(true)
    f.input('pointermove', 0)
    expect(f.deep()).toBe(true)
    f.input('pointermove')
    expect(f.resting()).toBe(false)
  })

  it('rests again restMs after a touch during the rest, even when the cues call for longer than that', () => {
    const f = fake()
    createRest(f.env, 1_500, 15_000).allow()
    wait(2_000)
    expect(f.resting()).toBe(true)
    f.input()
    wait(1_499)
    expect(f.resting()).toBe(false)
    wait(1)
    expect(f.resting() && !f.deep()).toBe(true)
    wait(14_999)
    expect(f.deep()).toBe(false)
    wait(1)
    expect(f.deep()).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not turn deep when a touch comes during the rest: the next rest starts over', () => {
    const f = fake()
    createRest(f.env).allow()
    wait(25_000)
    f.input('pointermove')
    expect(f.resting()).toBe(false)
    // no deep at 30 s; rest at 45 s and deep at 55 s
    wait(19_999)
    expect(f.resting()).toBe(false)
    wait(1)
    expect(f.resting() && !f.deep()).toBe(true)
    wait(9_999)
    expect(f.deep()).toBe(false)
    wait(1)
    expect(f.deep()).toBe(true)
    expect(f.changes).toEqual([`+${REST_ATTR}`, `-${REST_ATTR}`, `+${REST_ATTR}`, `+${REST_ATTR}=${DEEP}`])
  })

  it('wakes from deep rest at the first touch, and rests and turns deep again on the same clock', () => {
    const f = fake()
    createRest(f.env).allow()
    wait(40_000)
    expect(f.deep()).toBe(true)
    f.input('pointerup')
    expect(f.resting()).toBe(false)
    wait(20_000)
    expect(f.resting() && !f.deep()).toBe(true)
    wait(10_000)
    expect(f.deep()).toBe(true)
  })

  it('wakes from deep rest when the last screen lets go, with no timer left', () => {
    const f = fake()
    const release = createRest(f.env).allow()
    wait(30_000)
    expect(f.deep()).toBe(true)
    release()
    expect(f.resting()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('lets the cues call for as long as it rests with deep=0', () => {
    const f = fake()
    createRest(f.env, REST_MS, deepMsFrom('?e2e=1&deep=0')).allow()
    wait(20_000)
    expect(f.resting()).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    wait(600_000)
    expect(f.deep()).toBe(false)
    f.input()
    expect(f.resting()).toBe(false)
    wait(20_000)
    expect(f.resting()).toBe(true)
    expect(f.changes).toEqual([`+${REST_ATTR}`, `-${REST_ATTR}`, `+${REST_ATTR}`])
  })

  it('back on screen while resting: the quiet starts over there, so the rest turns deep 30 s later (REST_MS + DEEP_MS), and deep rest stays deep', () => {
    const f = fake()
    createRest(f.env).allow()
    wait(25_000)
    f.show()
    // the quiet starts over at 25 s: still resting, deep at 25 + 30 s
    wait(29_999)
    expect(f.resting() && !f.deep()).toBe(true)
    wait(1)
    expect(f.deep()).toBe(true)
    f.show()
    wait(60_000)
    expect(f.deep()).toBe(true)
    expect(f.changes).toEqual([`+${REST_ATTR}`, `+${REST_ATTR}=${DEEP}`])
  })
})

describe('restMsFrom and deepMsFrom', () => {
  it('reads ?e2e=1&rest=<ms> and nothing else', () => {
    expect(restMsFrom('')).toBe(REST_MS)
    expect(restMsFrom('?e2e=1')).toBe(REST_MS)
    expect(restMsFrom('?e2e=1&voice=fast')).toBe(REST_MS)
    expect(restMsFrom('?e2e=1&voice=fast&rest=1500')).toBe(1500)
    expect(restMsFrom('?rest=1500&e2e=1')).toBe(1500)
    expect(restMsFrom('?e2e=1&rest=0')).toBe(0)
    // only a test may change it
    expect(restMsFrom('?rest=1500')).toBe(REST_MS)
    expect(restMsFrom('?rest=0')).toBe(REST_MS)
    expect(restMsFrom('?e2e=0&rest=0')).toBe(REST_MS)
    // nonsense keeps the default
    expect(restMsFrom('?e2e=1&rest=')).toBe(REST_MS)
    expect(restMsFrom('?e2e=1&rest=abc')).toBe(REST_MS)
    expect(restMsFrom('?e2e=1&rest=-5')).toBe(REST_MS)
  })

  it('reads ?e2e=1&deep=<ms> the same way', () => {
    expect(deepMsFrom('')).toBe(DEEP_MS)
    expect(deepMsFrom('?e2e=1&rest=1500')).toBe(DEEP_MS)
    expect(deepMsFrom('?e2e=1&voice=fast&rest=1500&deep=12000')).toBe(12_000)
    expect(deepMsFrom('?e2e=1&deep=0')).toBe(0)
    expect(deepMsFrom('?deep=0')).toBe(DEEP_MS)
    expect(deepMsFrom('?e2e=1&deep=x')).toBe(DEEP_MS)
    expect(deepMsFrom('?e2e=1&deep=-1')).toBe(DEEP_MS)
  })
})
