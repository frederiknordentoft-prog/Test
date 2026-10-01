import { describe, expect, it } from 'vitest'
import compareLengthModule, { type CompareScene } from './compareLength'
import { skillContract, tasksUnderTest } from '../number/testing/harness'
import { classifyAnswer, detectableOf, flaggedIds, updateMisconceptions, type MisconceptionStates } from '../../misconceptions'
import { isProduction } from '../../kinds'
import { keysForNode } from '../../registry'
import { NODE_BY_ID } from '../../../content/curriculum'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import type { AnswerLogEntry, AnswerValue, SkillDef, Task } from '../../types'

const compareLength: SkillDef = compareLengthModule

const sceneOf = (t: Task) => t.prompt as CompareScene
const ends = (s: CompareScene) => s.sizes.map((size, i) => s.starts[i] + size)
const isLong = (t: Task) => /længst|længste/.test(compile(t.speech).text)
/** Index of the extreme: the biggest value for "længst", the smallest for "kortest". */
const extreme = (values: readonly number[], long: boolean) => values.indexOf(long ? Math.max(...values) : Math.min(...values))
const tokens = (s: CompareScene, order: readonly number[]) => order.map((i) => `obj:${s.objects[i]}`)
const ordered = (values: readonly number[], long: boolean) => values.map((_, i) => i).sort((a, b) => (long ? values[b] - values[a] : values[a] - values[b]))

describe('compareLength of 0. klasse', () => {
  skillContract(compareLength, {
    families: { aligned: 8, offset: 8 },
    answerOf(_f, kind, task) {
      const s = sceneOf(task)
      return kind === 'sortOrder' ? tokens(s, ordered(s.sizes, isLong(task))).join('|') : tokens(s, [extreme(s.sizes, isLong(task))])[0]
    },
  })
})

describe('compareLength', () => {
  const tasks = tasksUnderTest(compareLength, 6)

  it('lines four different things up, or moves them sideways', () => {
    for (const { fact, task } of tasks) {
      const s = sceneOf(task)
      expect(s.objects).toHaveLength(4)
      expect(new Set(s.objects).size).toBe(4)
      expect(s.mode).toBe('length')
      expect(s.aligned).toBe(fact.family === 'aligned')
      if (fact.family === 'aligned') expect(s.starts).toEqual([0, 0, 0, 0])
      else expect(new Set(s.starts).size).toBeGreaterThan(1)
      // clear to a child: no ties, and the answer beats the runner-up by two units
      expect(new Set(s.sizes).size).toBe(4)
      expect(new Set(ends(s)).size).toBe(4)
      const bySize = ordered(s.sizes, isLong(task))
      expect(Math.abs(s.sizes[bySize[0]] - s.sizes[bySize[1]])).toBeGreaterThanOrEqual(2)
    }
  })

  it('is a conflict exactly when the thing that sticks out furthest is not the answer', () => {
    const contrast = new Map<string, string>()
    for (const { fact, task } of tasks) {
      const s = sceneOf(task)
      const long = isLong(task)
      const misleads = extreme(ends(s), long) !== extreme(s.sizes, long)
      expect(task.contrast, fact.id).toBe(misleads ? 'conflict' : 'congruent')
      // congruent offset facts keep the ends in the same order as the lengths
      if (!misleads) expect(ordered(ends(s), long)).toEqual(ordered(s.sizes, long))
      contrast.set(fact.id, task.contrast!)
    }
    const values = [...contrast.values()]
    expect(values.filter((c) => c === 'conflict')).toHaveLength(6)
    expect(values.filter((c) => c === 'congruent')).toHaveLength(10)
  })

  it('shows the misleading thing as the diagnostic card and its order as the sortOrder candidate', () => {
    for (const { fact, task } of tasks) {
      const s = sceneOf(task)
      const long = isLong(task)
      const misleading = tokens(s, [extreme(ends(s), long)])[0]
      if (task.kind === 'choice') {
        expect(task.options).toHaveLength(3)
        for (const o of task.options) expect(tokens(s, [0, 1, 2, 3])).toContain(o)
        if (task.contrast === 'conflict') {
          expect(task.options).toContain(misleading)
          expect(task.distractorTags[misleading]).toBe('lengthByEnd')
          expect(classifyAnswer(task, misleading)).toBe('lengthByEnd')
        } else {
          expect(Object.values(task.distractorTags)).not.toContain('lengthByEnd')
        }
      } else {
        const byEnd = tokens(s, ordered(ends(s), long)).join('|')
        expect(classifyAnswer(task, byEnd)).toBe(task.contrast === 'conflict' ? 'lengthByEnd' : null)
        expect(isProduction(task)).toBe(true)
      }
      expect(detectableOf(task)).toContain('lengthByEnd')
      expect(fact.id).toMatch(/^lng:[ao]\d$/)
    }
  })

  it('asks for the longest and the shortest in both families', () => {
    const asked = new Set(tasks.map((t) => `${t.fact.family}:${isLong(t.task) ? 'long' : 'short'}`))
    expect(asked).toEqual(new Set(['aligned:long', 'aligned:short', 'offset:long', 'offset:short']))
    const f = compareLength.enumerate().find((x) => x.id === 'lng:o1')!
    expect(compile(compareLength.speech(f, 'choice')).text).toBe('Hvilken ting er længst?')
    expect(compile(compareLength.speech(f, 'sortOrder')).text).toBe('Sæt tingene i rækkefølge. Start med den længste.')
  })

  it('hints by lining the things up', () => {
    const f = compareLength.enumerate().find((x) => x.id === 'lng:o2')!
    const h = compareLength.hint(f, 'lengthByEnd')
    expect(compile(h.speech).text).toBe('Se på begge ender, ikke kun den ene. Når tingene starter samme sted, kan du se, hvilken der er kortest.')
    expect(h.misconception).toBe('lengthByEnd')
    const v = h.visual as CompareScene
    expect(v.aligned).toBe(true)
    expect(v.starts).toEqual([0, 0, 0, 0])
    expect(compile(compareLength.hint(f, null).speech).text).toBe('Når tingene starter samme sted, kan du se, hvilken der er kortest.')
  })

  it('lets a child who only looks at one end be flagged, and a child who compares well not', () => {
    const keys = keysForNode(NODE_BY_ID['w0-former-l3'], { states: {}, audioVerified: true }).filter((k) => k.skill === 'compareLength')
    expect(keys).toHaveLength(16)
    const run = (answer: (t: Task) => AnswerValue): MisconceptionStates => {
      let states: MisconceptionStates = {}
      for (let i = 0; i < 64; i++) {
        const k = keys[i % keys.length]
        const t = k.build(i % 2 === 0 ? 'sortOrder' : 'choice', makeRng(i), i)
        const given = answer(t)
        const correct = given === t.answer
        const day = `2026-10-${String(1 + Math.floor(i / 16)).padStart(2, '0')}`
        const entry = {
          profileId: 'p', ts: i + 1, day, sessionId: 's', roundId: 'r', nodeId: 'n', mode: 'round', skill: t.skill,
          family: t.family, factId: t.factId, masteryKey: t.masteryKey, kind: t.kind, optionsCount: t.options.length,
          production: isProduction(t), given, answer: t.answer, correct, ms: 3000, fast: true,
          errorTag: correct ? null : classifyAnswer(t, given), detectable: detectableOf(t), boxBefore: 0, boxAfter: 0,
          scaffold: false, replays: 0, retryOf: null, assisted: false, audioUnverified: false, contrast: t.contrast,
        } satisfies AnswerLogEntry
        states = updateMisconceptions(states, entry, { skillAccuracy20: 0.7, day, contrast: t.contrast })
      }
      return states
    }
    // looks only at the right-hand ends: right on congruent lineups, misled on the others
    const oneEnd = (t: Task): AnswerValue => {
      if (t.contrast !== 'conflict') return t.answer
      const s = sceneOf(t)
      const order = ordered(ends(s), isLong(t))
      return t.kind === 'sortOrder' ? tokens(s, order).join('|') : tokens(s, [order[0]])[0]
    }
    expect(flaggedIds(run(oneEnd))).toContain('lengthByEnd')
    expect(flaggedIds(run((t) => t.answer))).toEqual([])
    // a child who guesses gets the congruent lineups wrong too: no flag
    const rng = makeRng(99)
    const guess = (t: Task): AnswerValue => (t.kind === 'sortOrder' ? rng.shuffle(t.options).join('|') : rng.pick(t.options))
    expect(flaggedIds(run(guess))).toEqual([])
  })
})
