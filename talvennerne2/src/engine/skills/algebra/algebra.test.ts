import { describe, expect, it, vi } from 'vitest'
import patternsModule from './patterns'
import { skillContract, tasksUnderTest } from '../number/testing/harness'
import { isProduction } from '../../kinds'
import { keysForSkills, skillRegistry } from '../../registry'
import { makeRng } from '../../rng'
import { buildTask } from '../../tasks'
import { compile } from '../../../speech/compile'
import { factFor, hintFor, scaffoldFor } from '../../../ui/hint/hintFor'
import type { Fact, Prompt, SkillDef, Task } from '../../types'

const patterns: SkillDef = patternsModule

const PERIOD: Readonly<Record<string, number>> = { AB: 2, AAB: 3, ABB: 3, ABC: 3 }
const SLOTS: Readonly<Record<string, number>> = { AB: 2, AAB: 3, ABB: 3, ABC: 3, growing: 2 }
const BEADS = new Set([
  'red', 'blue', 'yellow', 'circle', 'triangle', 'square',
  'carrot', 'apple', 'flower', 'fish', 'leaf', 'mushroom', 'strawberry', 'ball', 'chestnut', 'star',
].map((b) => `pat:${b}`))

const rowOf = (t: Task) => (t.prompt as Extract<Prompt, { scene: 'row' }>).cells
const shownOf = (t: Task) => rowOf(t).filter((c): c is string => typeof c === 'string')

/** A B, A B B, A B B B …, written out independently of the generator. */
function growing(a: string, b: string, n: number): string[] {
  const out: string[] = []
  for (let g = 1; out.length < n; g++) out.push(a, ...Array<string>(g).fill(b))
  return out.slice(0, n)
}

/** The next `n` beads, read off the shown row by the family's rule. */
function continuation(family: string, shown: readonly string[], n: number): string[] {
  if (family === 'growing') return growing(shown[0], shown[1], shown.length + n).slice(shown.length)
  const p = PERIOD[family]
  const seq = [...shown]
  for (let i = 0; i < n; i++) seq.push(seq[seq.length - p])
  return seq.slice(shown.length)
}

describe('patterns of 0. klasse', () => {
  skillContract(patterns, {
    families: { AB: 20, AAB: 20, ABB: 20, ABC: 20, growing: 20 },
    answerOf(f, kind, task) {
      const next = continuation(f.family, shownOf(task), kind === 'fillSlots' ? SLOTS[f.family] : 1)
      return next.join('|')
    },
  })
})

describe('patterns', () => {
  const tasks = tasksUnderTest(patterns, 1)

  it('shows a row that follows its family and at least two whole repeats', () => {
    for (const { fact, task } of tasks) {
      const s = shownOf(task)
      const [a, b, c] = s
      const where = `${fact.id} ${task.kind}`
      for (const x of s) expect(BEADS.has(x), where).toBe(true)
      switch (fact.family) {
        case 'AB':
          expect(a, where).not.toBe(b)
          break
        case 'AAB':
          expect(a === b && b !== c, where).toBe(true)
          break
        case 'ABB':
          expect(a !== b && b === c, where).toBe(true)
          break
        case 'ABC':
          expect(new Set([a, b, c]).size, where).toBe(3)
          break
        case 'growing':
          expect(s, where).toEqual(growing(a, b, s.length))
          expect(s.length, where).toBeGreaterThanOrEqual(8) // A B, A B B and part of A B B B
          break
      }
      if (fact.family !== 'growing') {
        const p = PERIOD[fact.family]
        expect(s.length, where).toBeGreaterThanOrEqual(2 * p)
        s.forEach((x, i) => i >= p && expect(x, where).toBe(s[i - p]))
      }
      // the gap is at the end, one place for cards, two or three to fill
      const gaps = rowOf(task).filter((x) => x === null).length
      expect(gaps, where).toBe(task.kind === 'fillSlots' ? SLOTS[fact.family] : 1)
      expect(rowOf(task).slice(0, s.length).every((x) => x !== null), where).toBe(true)
    }
  })

  it('moves the gap through every place of the repeat', () => {
    for (const fam of patterns.families) {
      const phases = new Set(tasks.filter((t) => t.fact.family === fam.id).map((t) => t.fact.operands[0] % (PERIOD[fam.id] ?? 1)))
      if (fam.id === 'growing') {
        // B in the middle of a group (8, 10) and A at the start of one (9)
        const roles = new Set(
          tasks.filter((t) => t.fact.family === 'growing' && t.task.kind === 'choice').map((t) => (t.task.answer === shownOf(t.task)[0] ? 'A' : 'B')),
        )
        expect(roles).toEqual(new Set(['A', 'B']))
      } else {
        expect(phases.size).toBe(PERIOD[fam.id])
      }
    }
  })

  it('keeps colour patterns readable without red and green together', () => {
    for (const { task } of tasks) {
      const beads = new Set([...shownOf(task), ...task.options.map(String)])
      expect(beads.has('pat:red') && beads.has('pat:green')).toBe(false)
    }
  })

  it('fills from a palette of three: the pattern and one bead from outside (ABC: its own three)', () => {
    for (const { fact, task } of tasks) {
      if (task.kind !== 'fillSlots') continue
      expect(task.options).toHaveLength(3)
      const inPattern = new Set(shownOf(task))
      expect(task.options.filter((o) => !inPattern.has(String(o)))).toHaveLength(fact.family === 'ABC' ? 0 : 1)
      expect(isProduction(task)).toBe(true)
    }
  })

  it('deals cards from the pattern itself and from outside it', () => {
    for (const { fact, task } of tasks) {
      if (task.kind !== 'choice') continue
      expect(task.options).toHaveLength(3)
      const inPattern = new Set(shownOf(task))
      for (const o of task.options) if (o !== task.answer) expect(task.distractorTags[String(o)]).toBe(inPattern.has(String(o)) ? 'near' : 'other')
      if (fact.family === 'ABC') for (const o of task.options) expect(inPattern.has(String(o))).toBe(true)
    }
  })

  it('asks and hints in plain Danish', () => {
    const f: Fact = patterns.enumerate().find((x) => x.family === 'AAB')!
    expect(compile(patterns.speech(f, 'choice')).text).toBe('Hvad kommer så?')
    expect(compile(patterns.speech(f, 'fillSlots')).text).toBe('Fortsæt mønstret.')
    const h = patterns.hint(f, null)
    expect(compile(h.speech).text).toBe('To ens, og så en anden. Det gentager sig. Sig mønstret højt, og hør, hvad der kommer igen.')
    const row = (h.visual as Extract<Prompt, { scene: 'row' }>).cells
    expect(row.every((c) => typeof c === 'string')).toBe(true)
    expect(row.length).toBe(f.operands[0] + 3)
  })

  // Formhaven: the round hints a drawn instance from a fact rebuilt from its task (hintFor's
  // factFor: the id, but no data). The hint threw, safely() logged it and the child got the round's
  // generic picture instead of the pattern completed.
  it('hints a drawn instance from its id alone, as the round rebuilds it from the task', () => {
    const canon = new Set(patterns.enumerate().map((f) => f.id))
    const rng = makeRng(13)
    let drawn = 0
    for (const fam of patterns.families) {
      for (let i = 0; i < 8; i++) {
        const f = patternsModule.instance(fam, rng, canon)
        expect(canon.has(f.id), f.id).toBe(false)
        drawn++
        for (const kind of patterns.kinds) {
          const task = buildTask(patterns, f, kind, makeRng(i), 0).task
          const rebuilt = factFor(patterns, task)
          expect(rebuilt.data, f.id).toBeUndefined()
          for (const tag of [null, 'near', 'other'] as const) {
            expect(patterns.hint(rebuilt, tag, kind), `${f.id} ${kind} ${tag}`).toEqual(patterns.hint(f, tag, kind))
          }
          // the same pattern, read back from the id, all through the module (the rebuilt fact's
          // answer is the task's, so its candidates match where that is the one next bead)
          if (kind === 'choice') expect(patterns.candidates(rebuilt), f.id).toEqual(patterns.candidates(f))
          expect(patterns.prompt(rebuilt, kind, makeRng(1)), f.id).toEqual(patterns.prompt(f, kind, makeRng(1)))
          expect(patternsModule.options(rebuilt, kind, makeRng(1)), f.id).toEqual(patternsModule.options(f, kind, makeRng(1)))
          expect(patternsModule.answer(rebuilt, kind), f.id).toEqual(task.answer)
        }
      }
    }
    expect(drawn).toBe(40)
  })

  it('names a drawn instance in full in its id: family, beads and how many are shown', () => {
    const rng = makeRng(29)
    for (const fam of patterns.families) {
      for (let i = 0; i < 10; i++) {
        const f = patternsModule.instance(fam, rng, new Set())
        expect(f.id).toMatch(/^ptn:(AB|AAB|ABB|ABC|growing):[a-z]+(\.[a-z]+){1,2}:\d+$/)
        expect(f.id.split(':')[1]).toBe(fam.id)
      }
    }
  })
})

describe('patterns in the round: the strategy after a wrong answer (Formhaven)', () => {
  it('shows the pattern completed as a row of beads, with no error logged', () => {
    const reg = skillRegistry()
    const keys = keysForSkills([{ skill: 'patterns' }], { skills: reg, states: {}, audioVerified: true, mode: 'round' })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      let n = 0
      for (const k of keys) {
        for (const kind of k.kinds) {
          for (let seed = 0; seed < 6; seed++) {
            const task = k.build(kind, makeRng(seed), seed)
            const wrong = Object.keys(task.distractorTags)[0]
            const h = hintFor(task, wrong, reg)
            expect(h.fromSkill, task.factId).toBe(true)
            expect(h.visual.scene, task.factId).toBe('row')
            const cells = (h.visual as Extract<Prompt, { scene: 'row' }>).cells
            const shown = shownOf(task)
            expect(cells.slice(0, shown.length), task.factId).toEqual(shown)
            const next = continuation(task.family, shown, SLOTS[task.family]).join('|')
            expect(cells.slice(shown.length).join('|'), task.factId).toBe(next)
            if (kind === 'fillSlots') expect(next, task.factId).toBe(task.answer)
            expect(scaffoldFor(task, reg).scene, task.factId).toBe('row')
            n++
          }
        }
      }
      expect(n).toBe(5 * 2 * 6)
      expect(errors).not.toHaveBeenCalled()
    } finally {
      errors.mockRestore()
    }
  })
})
