// QA2's P3 findings in the task views (UIFIX4): the number line's shadow never stands on the answer
// (P3-10), and the pay tray counts every quick tap and drag exactly once (P3-15).
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
