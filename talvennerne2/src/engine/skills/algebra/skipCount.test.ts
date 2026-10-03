import { describe, expect, it } from 'vitest'
import skipCountModule from './skipCount'
import { algebra2Suite, explainBy, findFact, hintText, taskOf, textOf } from './testing/suite'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { guessP } from '../../kinds'
import { factsUnderTest, tasksUnderTest } from '../number/testing/harness'
import type { AnswerValue, Fact, SkillDef } from '../../types'

const def: SkillDef = skipCountModule

const STEP: Readonly<Record<string, number>> = { step2: 2, step5: 5, step10: 10, step10offset: 10, back10: -10, step100: 100, step25: 25 }

/** The row of `skc:<family>:<start>:<shown>`, worked out independently of the module. */
function row(f: Pick<Fact, 'id'>) {
  const m = /^skc:(\w+):(\d+):(\d+)$/.exec(f.id)!
  const step = STEP[m[1]]
  const start = Number(m[2])
  const shown = Number(m[3])
  const nums = Array.from({ length: shown }, (_, i) => start + i * step)
  const last = nums[nums.length - 1]
  const one = Math.sign(step)
  return { family: m[1], step, nums, last, x: last + step, y: last + 2 * step, one }
}

algebra2Suite(def, {
  families: { step2: 20, step5: 20, step10: 18, step10offset: 20, back10: 20, step100: 20, step25: 17 },
  answerOf: (f, kind) => {
    const r = row(f)
    return kind === 'fillSlots' ? `${r.x}|${r.y}` : r.x
  },
  idFormat: /^skc:(step2|step5|step10|step10offset|back10|step100|step25):\d+:[345]$/,
  explain: (f, v: AnswerValue) => {
    const r = row(f)
    return typeof v === 'number'
      ? explainBy(v, r.x, [['skipStepOne', r.last + r.one]], r.nums)
      : explainBy(v, `${r.x}|${r.y}`, [['skipStepOne', `${r.last + r.one}|${r.last + 2 * r.one}`]], [])
  },
  formulaValues: (f) => {
    const r = row(f)
    return [r.last + r.one, `${r.last + r.one}|${r.last + 2 * r.one}`, ...r.nums]
  },
  ceilings: { choice: 3, keypad: 5, fillSlots: 5 },
})

describe('skipCount', () => {
  const tasks = tasksUnderTest(def)

  it('keeps every family inside its numbers: steps, start, never below 0, at most 40/100/1000/300', () => {
    const top: Readonly<Record<string, number>> = { step2: 40, step5: 100, step10: 100, step10offset: 100, back10: 100, step100: 1000, step25: 300 }
    for (const f of factsUnderTest(def)) {
      const r = row(f)
      expect(f.operands, f.id).toEqual(r.nums)
      expect(Math.min(...r.nums, r.y), f.id).toBeGreaterThanOrEqual(0)
      expect(Math.max(...r.nums, r.y), f.id).toBeLessThanOrEqual(top[r.family])
      if (r.family === 'step10offset') expect(r.nums[0] % 10, f.id).toBeGreaterThan(0)
      if (r.family === 'step2' || r.family === 'step5' || r.family === 'step10' || r.family === 'step25') expect(r.nums[0] % r.step, f.id).toBe(0)
    }
  })

  it('reads the row and asks for the next number (fillSlots: the next two), with one or two gaps', () => {
    expect(textOf(taskOf(def, 'skc:step5:15:3', 'keypad'))).toBe('Femten, tyve, femogtyve. Hvilket tal kommer så?')
    expect(textOf(taskOf(def, 'skc:step5:15:3', 'fillSlots'))).toBe('Femten, tyve, femogtyve. Hvilke to tal kommer så?')
    expect(taskOf(def, 'skc:step5:15:3', 'choice').prompt).toEqual({ scene: 'row', cells: [15, 20, 25, null] })
    expect(taskOf(def, 'skc:back10:87:3', 'fillSlots').prompt).toEqual({ scene: 'row', cells: [87, 77, 67, null, null] })
    expect(taskOf(def, 'skc:back10:87:3', 'fillSlots').answer).toBe('57|47')
  })

  it('deals a fillSlots palette of five or six numbers holding both answers and the skipStepOne pair', () => {
    for (const { fact, task } of tasks) {
      if (task.kind !== 'fillSlots') continue
      const r = row(fact)
      expect(task.options.length, fact.id).toBeGreaterThanOrEqual(5)
      for (const v of [r.x, r.y, r.last + r.one, r.last + 2 * r.one]) expect(task.options, fact.id).toContain(v)
      expect(guessP(task), fact.id).toBeLessThanOrEqual(1 / 25)
    }
  })

  it('keeps the palette inside the family’s numbers, also where the row ends at the top', () => {
    for (const { fact, task } of tasks) {
      if (task.kind !== 'fillSlots') continue
      const out = task.options.filter((o) => typeof o !== 'number' || o < task.range[0] || o > task.range[1])
      expect(out, `${fact.id} [${task.options}]`).toEqual([])
    }
    // the second answer is the top: no 101, 1001 or 301 to tap
    const sorted = (id: string) => [...taskOf(def, id, 'fillSlots').options].sort((a, b) => Number(a) - Number(b))
    expect(sorted('skc:step10:60:3')).toEqual([81, 82, 90, 91, 100])
    expect(sorted('skc:step100:500:4')).toEqual([801, 802, 900, 901, 1000])
    expect(sorted('skc:step25:200:3')).toEqual([251, 252, 275, 276, 300])
    // below the top nothing changes: one past each answer is still there
    expect(sorted('skc:step10:50:3')).toEqual([71, 72, 80, 81, 90, 91])
  })

  it('reads the row continued by one as skipStepOne on every kind (5, 10, 15 → 16; back: one less)', () => {
    expect(classifyAnswer(taskOf(def, 'skc:step5:5:3', 'keypad'), 16)).toBe('skipStepOne')
    expect(classifyAnswer(taskOf(def, 'skc:step5:5:3', 'fillSlots'), '16|17')).toBe('skipStepOne')
    expect(classifyAnswer(taskOf(def, 'skc:back10:87:3', 'keypad'), 66)).toBe('skipStepOne')
    expect(classifyAnswer(taskOf(def, 'skc:step5:5:3', 'keypad'), 15)).toBe('operand')
    expect(detectableOf(taskOf(def, 'skc:step5:5:3', 'fillSlots'))).toEqual(['skipStepOne'])
  })

  it('says the step and the hops; skipStepOne first asks for the same hop every time', () => {
    expect(hintText(def, 'skc:step5:15:3', null)).toBe('Springet er fem. Femogtyve plus fem giver tredive.')
    expect(hintText(def, 'skc:step5:15:3', null, 'fillSlots')).toBe('Springet er fem. Femogtyve plus fem giver tredive. Tredive plus fem giver femogtredive.')
    expect(hintText(def, 'skc:back10:87:3', null)).toBe('Springet tilbage er ti. Syvogtres minus ti giver syvoghalvtreds.')
    expect(hintText(def, 'skc:step5:15:3', 'skipStepOne')).toMatch(/^Spring lige langt hver gang, ikke bare en\. Springet er fem\./)
    // the line runs from the row's first number to the last answer, so the hops follow the row's own
    // numbers (QA2 P3-7: 420 → 520 → 620 drawn on a 400–900 line read as 400 → 500 → 600)
    expect(def.hint(findFact(def, 'skc:step5:15:3'), null).visual).toEqual({ scene: 'line', min: 15, max: 30, hops: [15, 20, 25, 30] })
    expect(def.hint({ ...findFact(def, 'skc:step5:15:3'), id: 'skc:step100:420:3', family: 'step100' }, null, 'fillSlots').visual)
      .toEqual({ scene: 'line', min: 420, max: 820, hops: [420, 520, 620, 720, 820] })
    expect(def.hint({ ...findFact(def, 'skc:step5:15:3'), id: 'skc:back10:87:3', family: 'back10' }, null).visual)
      .toEqual({ scene: 'line', min: 57, max: 87, hops: [87, 77, 67, 57] })
  })

  it('meets a swapped typed answer with the tens-first hint (digitSwap)', () => {
    const t = taskOf(def, 'skc:step2:6:4', 'keypad')
    expect(t.answer).toBe(14)
    expect(classifyAnswer(t, 41)).toBe('digitSwap')
    expect(hintText(def, 'skc:step2:6:4', 'digitSwap', 'keypad')).toBe('Vi skriver tierne først og så enerne. Svaret er fjorten.')
  })
})
