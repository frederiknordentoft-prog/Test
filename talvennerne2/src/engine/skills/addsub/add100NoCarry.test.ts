import { describe, expect, it } from 'vitest'
import add100NoCarryModule from './add100NoCarry'
import { addsub2Suite, explainSum, findFact, hintText, idSum, tagOf, textOf } from './testing/suite'
import { factsUnderTest, tasksUnderTest } from '../number/testing/harness'
import { classifyAnswer } from '../../misconceptions'
import { isProduction } from '../../kinds'
import type { Fact, SkillDef } from '../../types'

const def: SkillDef = add100NoCarryModule
const sum = (f: Fact) => idSum(f.id)

addsub2Suite(def, {
  families: { TOplusO: 20, TOplusT0: 20, TOplusTO: 20 },
  answerOf: (f) => sum(f).a + sum(f).b,
  idFormat: /^a100:\d\d\+\d\d?$/,
  explain: (f, v) => explainSum('add100NoCarry', f.family, sum(f).a, '+', sum(f).b, v),
  formulaValues: (f) => {
    const { a, b } = sum(f)
    return [a + 10 * b, Math.abs(a - b), a, b]
  },
  ceilings: { choice: 3, keypad: 5, buildBase: 3 },
})

describe('add100NoCarry', () => {
  const tasks = tasksUnderTest(def)

  it('never crosses a ten: every column stays under ten, and the families are what they say', () => {
    for (const f of factsUnderTest(def)) {
      const { a, op, b } = sum(f)
      expect(op).toBe('+')
      expect((a % 10) + (b % 10) <= 9 && Math.floor(a / 10) + Math.floor(b / 10) <= 9 && a % 10 >= 1, f.id).toBe(true)
      const shape = b < 10 ? 'TOplusO' : b % 10 === 0 ? 'TOplusT0' : 'TOplusTO'
      expect(f.family, f.id).toBe(shape)
      if (f.family !== 'TOplusTO') expect(a, f.id).toBeGreaterThanOrEqual(21)
    }
  })

  it('asks "Hvad er fireogtredive plus fem?", and buildBase builds the sum with rods and cubes (never production)', () => {
    expect(textOf({ ...tasks[0].task, speech: def.speech(findFact(def, 'a100:34+5'), 'keypad') })).toBe('Hvad er fireogtredive plus fem?')
    for (const { kind, task } of tasks) {
      expect(task.range).toEqual([0, 99])
      if (kind === 'buildBase') expect(isProduction(task)).toBe(false)
    }
  })

  it('reads a one-digit number added to the tens as placeMisalign', () => {
    expect(tagOf(def, 'a100:34+5', 84)).toBe('placeMisalign')
    expect(tagOf(def, 'a100:34+5', 29)).toBe('wrongOperation')
    expect(tagOf(def, 'a100:34+5', 34)).toBe('operand')
    expect(tagOf(def, 'a100:34+5', 49)).toBe('near')
    expect(tagOf(def, 'a100:34+20', 36)).toBeUndefined() // the tens added to the ones: not in the catalogue
    expect(tagOf(def, 'a100:41+5', 91)).toBe('placeMisalign')
    const t = tasks.find((x) => x.kind === 'keypad' && x.fact.family === 'TOplusO')!.task
    const [a, b] = [Number(t.factId.split(/[:+]/)[1]), Number(t.factId.split('+')[1])]
    expect(classifyAnswer(t, a + 10 * b)).toBe(a + 10 * b === Math.abs(a - b) ? 'ambiguous' : 'placeMisalign')
  })

  it('works the columns, ones first, and says which column stays', () => {
    expect(hintText(def, 'a100:34+5', null)).toBe('Regn enerne først. Fire plus fem giver ni. Tierne er de samme. Svaret er niogtredive.')
    expect(hintText(def, 'a100:34+20', null)).toBe('Regn tierne. Tre tiere plus to tiere giver fem tiere. Enerne er de samme. Svaret er fireoghalvtreds.')
    expect(hintText(def, 'a100:34+25', 'near'))
      .toBe('Regn enerne først. Fire plus fem giver ni. Regn så tierne. Tre tiere plus to tiere giver fem tiere. Svaret er nioghalvtreds.')
    expect(hintText(def, 'a100:34+5', 'placeMisalign')).toMatch(/^Det lille tal er enere\. Læg det til enerne, ikke til tierne\. Regn enerne/)
    expect(def.hint(findFact(def, 'a100:34+25'), null).visual).toEqual({ scene: 'columns', a: 34, b: 25, op: '+', carry: false })
  })
})
