// QA2's P3 findings in the task views (UIFIX4): the number line's shadow never stands on the answer
// (P3-10), the pay tray counts every quick tap and drag exactly once (P3-15), the seesaw never lies
// about its sides nor gives the answer away (P3-5), and skip counting hops on the row's own numbers
// (P3-7).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { factsOf, keysForSkills, skillRegistry } from '../../engine/registry'
import { makeRng } from '../../engine/rng'
import { buildTask, isMisconceptionId } from '../../engine/tasks'
import type { Box, Task } from '../../engine/types'
import { readFileSync } from 'node:fs'
import { isCorrect } from '../../engine/answer'
import { lineRange } from './answers'
import { NumberlineView, shadowStart } from './numberline/View'
import { MAX_TRAY, payValue, trayWith, trayWithout } from './pay/logic'
import type { Piece } from './pay/logic'
import { PayView } from './pay/View'
import { PromptScene, evenHops, seesawLean } from '../scenes/PromptScene'
import { hintFor } from '../hint/hintFor'
import { HintVisual } from '../hint/HintVisual'

const reg = skillRegistry()
const noop = () => undefined

/** Every numberline task of every skill that has one, a few instances of each key. */
function lineTasks(n = 4): Task[] {
  const out: Task[] = []
  const skills = reg.all.filter((d) => d.kinds.includes('numberline')).map((d) => ({ skill: d.id }))
  for (const k of keysForSkills(skills, { skills: reg, states: {}, audioVerified: true, mode: 'round' })) {
    if (!k.kinds.includes('numberline')) continue
    for (let i = 0; i < n; i++) out.push(k.build('numberline', makeRng(i + 7), i))
  }
  return out
}

describe('the number line shadow (QA2 P3-10)', () => {
  const tasks = lineTasks()

  it('covers the skills asked on a number line', () => {
    expect(new Set(tasks.map((t) => t.skill)).size).toBeGreaterThanOrEqual(5)
    expect(tasks.length).toBeGreaterThan(100)
  })

  it('never waits on the answer or near it, and never on a misconception', () => {
    for (const t of tasks) {
      const [min, max] = lineRange(t)
      const at = shadowStart(t, min, max)
      expect(at, t.id).toBeGreaterThanOrEqual(min)
      expect(at, t.id).toBeLessThanOrEqual(max)
      const answer = Number(t.answer)
      // never accepted as the answer, and at least a fifth of the line away from it
      expect(Math.abs(at - answer), t.id).toBeGreaterThan(t.tolerance)
      expect(Math.abs(at - answer), t.id).toBeGreaterThanOrEqual(Math.ceil((max - min) / 5))
      for (const [value, tag] of Object.entries(t.distractorTags)) {
        if (isMisconceptionId(tag)) expect(Math.abs(at - Number(value)), `${t.id} ${tag}`).toBeGreaterThan(t.tolerance)
      }
    }
  })

  it('is the same for the same task, and drawn from all over the line', () => {
    const t = tasks.find((x) => x.factId === 'dbl:5')!
    expect(t).toBeDefined()
    const [min, max] = lineRange(t)
    expect([min, max]).toEqual([0, 20])
    const at = shadowStart(t, min, max)
    expect(at).toBe(shadowStart({ ...t }, min, max))
    expect(Math.abs(at - 10)).toBeGreaterThanOrEqual(4)
    // across tasks the shadow lands on many places, not one fixed spot that would teach a rule
    const spots = new Set(tasks.filter((x) => lineRange(x)[1] - lineRange(x)[0] === 20).map((x) => shadowStart(x, ...lineRange(x))))
    expect(spots.size).toBeGreaterThanOrEqual(8)
  })

  it('draws the shadow there before the first touch: "5 + 5" on 0–20 no longer shows 10', () => {
    const t = tasks.find((x) => x.factId === 'dbl:5')!
    const html = renderToStaticMarkup(<NumberlineView task={t} mode="input" given={null} onSubmit={noop} onActivity={noop} onDraft={noop} speaking={null} />)
    const m = /data-shadow="(\d+)"/.exec(html)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBe(shadowStart(t, 0, 20))
    expect(Number(m![1])).not.toBe(10)
  })
})

/** A pay task of payExact, as the task builder makes it (box 0: a new key, with support). */
function payTask(fact: string, box: Box = 1): Task {
  const def = reg.get('payExact')!
  const [, family, price] = fact.split(':')
  const f = factsOf(def).find((x) => x.id === fact) ?? { id: fact, skill: def.id, family, operands: [Number(price) / 100], answer: Number(price), rank: 0 }
  return buildTask(def, f, 'pay', makeRng(1), 0, { box }).task
}

/** Taps played one after another on the tray as the view keeps it (the latest tray, not a render's). */
function play(taps: readonly ({ add: Piece } | { take: Piece })[]): Piece[] {
  let tray: Piece[] = []
  for (const tap of taps) tray = ('add' in tap ? trayWith(tray, tap.add) : trayWithout(tray, tap.take)) ?? tray
  return tray
}

describe('quick taps and drags in the pay tray (QA2 P3-15)', () => {
  it('lays the QA payments exactly, however fast: 77 kr and 67 kr', () => {
    const t77 = payTask('pay:to100:7700')
    const t67 = payTask('pay:to100:6700')
    const laid77 = play([{ add: 5000 }, { add: 2000 }, { add: 500 }, { add: 200 }])
    const laid67 = play([{ add: 5000 }, { add: 1000 }, { add: 500 }, { add: 200 }])
    expect(payValue(t77, laid77)).toBe(7700)
    expect(isCorrect(t77, payValue(t77, laid77))).toBe(true)
    expect(isCorrect(t67, payValue(t67, laid67))).toBe(true)
  })

  it('takes a coin back only when one lies there: a double tap on a single coin takes one, never another kind', () => {
    // the old remove read a render's tray: the second tap still "saw" the 2-krone coin, and
    // splice(lastIndexOf = −1, 1) took the last coin of another kind
    expect(play([{ add: 5000 }, { add: 500 }, { add: 200 }, { take: 200 }, { take: 200 }])).toEqual([5000, 500])
    expect(trayWithout([5000, 500], 200)).toBeNull()
    expect(play([{ add: 200 }, { add: 500 }, { add: 200 }, { take: 200 }])).toEqual([200, 500])
  })

  it('never lays more than the tray holds, nor anything that is no coin or note', () => {
    let tray: Piece[] = []
    for (let i = 0; i < MAX_TRAY + 5; i++) tray = trayWith(tray, 100) ?? tray
    expect(tray).toHaveLength(MAX_TRAY)
    expect(trayWith([], 300)).toBeNull()
  })

  it('keeps the place of the sum on a new key from the start, so the purse never moves when it appears', () => {
    const fresh = payTask('pay:to100:7700', 0)
    const html = renderToStaticMarkup(<PayView task={fresh} mode="input" given={null} onSubmit={noop} onActivity={noop} onDraft={noop} speaking={null} />)
    expect(html).toMatch(/class="[^"]*tv-pay__sum[^"]*is-zero/)
    const known = payTask('pay:to100:7700', 2)
    expect(renderToStaticMarkup(<PayView task={known} mode="input" given={null} onSubmit={noop} onActivity={noop} onDraft={noop} speaking={null} />)).not.toContain('tv-pay__sum')
  })

  it('lets taps through a coin that hops into the tray, and keeps two rows of tray on a phone', () => {
    const css = readFileSync(new URL('./pay/pay.css', import.meta.url), 'utf8')
    const rule = (sel: string) => new RegExp(`${sel.replace(/[.]/g, '\\.')} \\{[^}]*pointer-events: none`)
    expect(css).toMatch(rule('.tv-pay__piece'))
    expect(css).toMatch(rule('.tv-pay__face'))
    expect(css).toMatch(/\.tv-pay__tray \{[^}]*min-height: calc\(2 \*/)
  })
})

describe('the seesaw (QA2 P3-5)', () => {
  const tf = (id: string) => {
    const def = reg.get('equalSides')!
    const f = factsOf(def).find((x) => x.id === id) ?? { id, skill: def.id, family: 'trueFalse', operands: [], answer: 0, rank: 0 }
    return buildTask(def, f, 'trueFalse', makeRng(1), 0).task
  }
  const sides = (t: Task) => (t.prompt.scene === 'balance' ? t.prompt : null)!

  it('rests on its blocks while the child judges, and then shows the truth', () => {
    const wrong = tf('eqs:tf:7+2=9+_:2') // 7 + 2 = 9 + 2: the right side is heavier
    expect(seesawLean(sides(wrong), 'empty')).toBe('held')
    expect(seesawLean(sides(wrong), 'oops')).toBe(1)
    expect(seesawLean(sides(wrong), 'good')).toBe(1)
    const right = tf('eqs:tf:7+2=_:9')
    expect(seesawLean(sides(right), 'empty')).toBe('held')
    expect(seesawLean(sides(right), 'good')).toBe(0)
    const ask = renderToStaticMarkup(<PromptScene prompt={wrong.prompt} task={wrong} />)
    expect(ask).toContain('is-held')
    expect(ask).toContain('data-lean="held"')
    const after = renderToStaticMarkup(<PromptScene prompt={wrong.prompt} task={wrong} slot="oops" />)
    expect(after).not.toContain('is-held')
    expect(after).toContain('data-lean="1"')
  })

  it('is level after the answer exactly when the statement is true, for every true/false card', () => {
    const k = keysForSkills([{ skill: 'equalSides' }], { skills: reg, states: {}, audioVerified: true, mode: 'round' })
    let n = 0
    for (const key of k) {
      if (!key.kinds.includes('trueFalse')) continue
      for (let i = 0; i < 30; i++) {
        const t = key.build('trueFalse', makeRng(i + 11), i)
        const lean = seesawLean(sides(t), 'good')
        expect(lean === 0, t.factId).toBe(t.answer === 'yes')
        n++
      }
    }
    expect(n).toBeGreaterThan(20)
  })

  it('shows the strategy\'s seesaw as it is: down on the heavier side, and the words name the seesaw', () => {
    const t = tf('eqs:tf:7+2=9+_:2')
    const h = hintFor(t, 'yes', reg)
    expect(h.misconception).toBe('equalsAsAnswer')
    const html = renderToStaticMarkup(<HintVisual visual={h.visual} />)
    expect(html).toContain('data-lean="1"')
    // a blank answered right is level; answered wrong, the blocks stay
    const def = reg.get('equalSides')!
    const keypad = buildTask(def, { id: 'eqs:add:8+4=_+5:7', skill: def.id, family: 'balanceAdd', operands: [], answer: 7, rank: 0 }, 'keypad', makeRng(1), 0).task
    expect(seesawLean(sides(keypad), 'good')).toBe(0)
    expect(seesawLean(sides(keypad), 'oops')).toBe('held')
    expect(seesawLean(sides(keypad), 'active')).toBe('held')
  })
})

describe('skip counting hops on the row\'s own numbers (QA2 P3-7)', () => {
  const labels = (html: string) => [...html.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map((m) => Number(m[1]))

  it('numbers the line at every hop: 420, 520, 620, 720, 820 — never only the hundreds', () => {
    const def = reg.get('skipCount')!
    const t = buildTask(def, { id: 'skc:step100:420:3', skill: def.id, family: 'step100', operands: [420, 520, 620], answer: 720, rank: 0 }, 'fillSlots', makeRng(1), 0).task
    const h = hintFor(t, '621|622', reg)
    expect(h.visual).toMatchObject({ scene: 'line', min: 420, max: 820, hops: [420, 520, 620, 720, 820] })
    const html = renderToStaticMarkup(<HintVisual visual={h.visual} />)
    for (const n of [420, 520, 620, 720, 820]) expect(labels(html), String(n)).toContain(n)
    expect(labels(html)).not.toContain(400)
    expect(labels(html)).not.toContain(500)
  })

  it('does so for every family, back10 and the offset tens included', () => {
    const def = reg.get('skipCount')!
    for (const fact of factsOf(def)) {
      for (const kind of ['choice', 'fillSlots'] as const) {
        const t = buildTask(def, fact, kind, makeRng(2), 0).task
        const v = hintFor(t, null, reg).visual
        if (v.scene !== 'line') continue
        const html = renderToStaticMarkup(<HintVisual visual={v} />)
        for (const stop of v.hops ?? []) expect(labels(html), `${fact.id} ${kind} ${stop}`).toContain(stop)
      }
    }
  })

  it('leaves uneven hops and wider lines to the line\'s own numbers', () => {
    expect(evenHops(0, 20, [7, 10, 13])).toBeNull()
    expect(evenHops(0, 100, [0, 30, 37])).toBeNull()
    expect(evenHops(400, 900, [420, 520, 620])).toBeNull()
    expect(evenHops(57, 87, [87, 77, 67, 57])).toEqual({ every: 10 })
  })
})
