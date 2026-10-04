import { describe, expect, it } from 'vitest'
import { keysForSkills, skillRegistry } from '../../engine/registry'
import { makeRng } from '../../engine/rng'
import type { SkillId, Task, TaskKind } from '../../engine/types'
import { REGIONS } from '../../content/curriculum'
import { addsToPrompt, countingLine, hintFor, revealsAnswer, scaffoldFor, supportFor } from './hintFor'

/**
 * Support on a new key (review r1 P2-5, SPEC §3.5 and §5.1): a key in box 0 is shown with support
 * that helps without giving the answer away; the full strategy, which may show it, stays behind the
 * lightbulb, which logs the answer as assisted (and then never moves the box).
 */

const reg = skillRegistry()
const ENGDALEN = REGIONS.filter((r) => r.world === 'eng').flatMap((r) => r.skills)
const keys = keysForSkills(ENGDALEN, { skills: reg, states: {}, audioVerified: true, mode: 'round' })
const build = (key: string, kind: TaskKind, seed = 7): Task => {
  const k = keys.find((x) => x.key === key)
  if (!k) throw new Error(`no key ${key}`)
  return k.build(kind, makeRng(seed), 0)
}

describe('support on a new key', () => {
  it('"Find tallet 1": a number line to count along, not a ten-frame with one counter', () => {
    const t = build('h20:1', 'choice')
    expect(t.scaffold).toBe(true)
    expect(revealsAnswer(scaffoldFor(t, reg), t)).toBe(true)
    expect(supportFor(t, reg)).toEqual({ scene: 'line', min: 0, max: 10 })
  })

  it('"Hvilket tal kommer efter 1?": the line with the 1 marked, no hop onto the answer', () => {
    for (let seed = 0; seed < 40; seed++) {
      const t = build('order20/after', 'choice', seed)
      const given = t.prompt.scene === 'row' ? t.prompt.cells.find((c) => typeof c === 'number') : undefined
      const full = scaffoldFor(t, reg)
      expect(revealsAnswer(full, t)).toBe(true)
      const support = supportFor(t, reg)
      expect(support).toMatchObject({ scene: 'line', min: 0, arrowAt: given })
      expect(support && 'hops' in support ? support.hops : undefined).toBeUndefined()
      expect(revealsAnswer(support!, t)).toBe(false)
    }
  })

  it('leaves the counting to the child: the things again in a row, a line to count on along', () => {
    const count = build('c10:scatter:3', 'choice')
    expect(supportFor(count, reg)).toMatchObject({ scene: 'objects', n: 3 })
    // a sum: the line to count on along, from its bigger number (the skill's hop would land on 3)
    const sum = build('add:1+2', 'choice')
    expect(supportFor(sum, reg)).toEqual({ scene: 'line', min: 0, max: 10, arrowAt: 2 })
    const minus = build('sub:5-2', 'choice')
    expect(supportFor(minus, reg)).toMatchObject({ scene: 'line', arrowAt: 5 })
  })

  it('"Hvilket tal er størst?": no second line; the strategy uses the task\'s own line with the cards marked', () => {
    for (let seed = 0; seed < 40; seed++) {
      const t = build('order20/bigger', 'choice', seed)
      expect(t.prompt.scene).toBe('line')
      expect(supportFor(t, reg)).toBeNull()
      expect(countingLine(t)).toBeNull()
      const strategy = hintFor(t, null, reg).visual
      expect(strategy.scene).toBe('markedLine')
      if (strategy.scene !== 'markedLine') continue
      expect([...strategy.marks].sort()).toEqual([...t.options].sort())
      // the hops run from the other number of the pair up to the answer
      expect(strategy.hops?.at(-1)).toBe(t.answer)
      expect((strategy.hops?.length ?? 0) > 1).toBe(true)
      expect(addsToPrompt(strategy, t)).toBe(true)
    }
  })

  it('never shows the answer, for any new key of Engdalen in any kind', () => {
    let shown = 0
    for (const k of keys) {
      for (const kind of k.kinds) {
        for (let seed = 0; seed < 6; seed++) {
          const t = k.build(kind, makeRng(seed), 0)
          const support = supportFor(t, reg)
          if (!support) continue
          shown++
          expect(revealsAnswer(support, t), `${t.factId} ${kind}: ${JSON.stringify(support)}`).toBe(false)
          expect(addsToPrompt(support, t)).toBe(true)
        }
      }
    }
    expect(shown).toBeGreaterThan(200)
  })

  it('offers a support on the number skills of Tællelunden and Tyvestien', () => {
    const skills: SkillId[] = ['count10', 'count20', 'hear20', 'order20']
    for (const skill of skills) {
      const mine = keys.filter((k) => k.skill === skill)
      const withSupport = mine.filter((k) => supportFor(k.build(k.kinds[0], makeRng(1), 0), reg) !== null)
      expect(withSupport.length / mine.length, skill).toBeGreaterThan(0.5)
    }
  })
})

describe('no counting line under tens and ones (UI-fund 5)', () => {
  it('fillSlots in the place-value skills ("74 = □ tiere og □ enere", the blocks of 748) gets no 0–10 line', () => {
    for (const skill of ['tensOnes', 'placeValue1000'] as SkillId[]) {
      const own = keysForSkills([{ skill }], { skills: reg, states: {}, audioVerified: true, mode: 'round' })
      let seen = 0
      for (const k of own) {
        for (const kind of k.kinds) {
          const t = k.build(kind, makeRng(3), 0)
          expect(countingLine(t), `${t.factId} ${kind}`).toBeNull()
          const s = supportFor(t, reg)
          if (kind === 'fillSlots') seen++
          expect(s?.scene === 'line' && s.min === 0 && (s.max === 10 || s.max === 20), `${t.factId} ${kind}`).toBe(false)
        }
      }
      expect(seen).toBeGreaterThan(0)
    }
  })

  it('still counts along the line for a row of numbers (skipCount 0, 2, 4, 6, □, □)', () => {
    const k = keysForSkills([{ skill: 'skipCount' }], { skills: reg, states: {}, audioVerified: true, mode: 'round' }).find((x) => x.kinds.includes('fillSlots'))!
    const t = k.build('fillSlots', makeRng(3), 0)
    expect(countingLine(t)).toMatchObject({ scene: 'line', min: 0 })
  })
})

describe('the support from the scaffold the round has already worked out (perf P3)', () => {
  it('gives the same support as before for example tasks of every registered skill, and the scaffold itself when it is the support', () => {
    let tasks = 0
    let same = 0
    for (const def of reg.all) {
      const own = keysForSkills([{ skill: def.id }], { skills: reg, states: {}, audioVerified: true, mode: 'round' })
      for (const k of own.slice(0, 6)) {
        for (const kind of k.kinds) {
          for (let seed = 0; seed < 2; seed++) {
            const t = k.build(kind, makeRng(seed), 0)
            const full = scaffoldFor(t, reg)
            const reused = supportFor(t, reg, full)
            // before: supportFor worked the scaffold out a second time
            expect(reused, `${t.factId} ${kind}`).toEqual(supportFor(t, reg))
            // the round tells "the support is the whole strategy" by identity (was: JSON.stringify)
            expect(reused === full, `${t.factId} ${kind}`).toBe(reused !== null && JSON.stringify(reused) === JSON.stringify(full))
            if (reused === full) same++
            tasks++
          }
        }
      }
    }
    expect(tasks).toBeGreaterThan(500)
    expect(same).toBeGreaterThan(0)
  })
})
