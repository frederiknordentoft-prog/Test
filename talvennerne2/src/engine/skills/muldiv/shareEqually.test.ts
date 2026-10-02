import { describe, expect, it } from 'vitest'
import shareEquallyModule from './shareEqually'
import { algebra2Suite, explainBy, findFact, hintText, taskOf, textOf } from '../algebra/testing/suite'
import { classifyAnswer } from '../../misconceptions'
import { isProduction } from '../../kinds'
import type { AnswerValue, Fact, SkillDef } from '../../types'

const def: SkillDef = shareEquallyModule

/** total and the number of animals, read independently of the module. */
function tg(f: Pick<Fact, 'id'>): [number, number] {
  const m = /^shr:(\d+):(\d)$/.exec(f.id)!
  return [Number(m[1]), Number(m[2])]
}

algebra2Suite(def, {
  families: { share: 20 },
  answerOf: (f) => tg(f)[0] / tg(f)[1],
  idFormat: /^shr:\d+:[2-5]$/,
  explain: (f, v: AnswerValue) => {
    const [t, g] = tg(f)
    return explainBy(v, t / g, [['wrongOperation', t - g], ['wrongOperation', t + g]], [t, g])
  },
  formulaValues: (f) => [tg(f)[0] - tg(f)[1], tg(f)[0] + tg(f)[1], ...tg(f)],
  ceilings: { share: 5, choice: 3, keypad: 5 },
})

describe('shareEqually', () => {
  it('shares g · q carrots between g = 2–5 animals, q = 1–5 each', () => {
    const ids = def.enumerate().map((f) => f.id).sort()
    expect(ids).toEqual([2, 3, 4, 5].flatMap((g) => [1, 2, 3, 4, 5].map((q) => `shr:${g * q}:${g}`)).sort())
  })

  it('asks over the pile and the animals, the same words on every kind', () => {
    for (const kind of ['share', 'choice', 'keypad'] as const) {
      const t = taskOf(def, 'shr:12:3', kind)
      expect(t.prompt).toEqual({ scene: 'share', total: 12, recipients: 3, thing: 'carrot' })
      expect(textOf(t)).toBe('Del tolv gulerødder ligeligt mellem tre dyr. Hvor mange får hvert dyr?')
      expect(t.answer).toBe(4)
      expect(isProduction(t), kind).toBe(kind !== 'choice')
    }
  })

  it('reads an uneven deal as shareUnequal, another operation as wrongOperation, 6 between 3 → 3 as ambiguous', () => {
    expect(classifyAnswer(taskOf(def, 'shr:12:3', 'share'), -1)).toBe('shareUnequal')
    expect(classifyAnswer(taskOf(def, 'shr:12:3', 'keypad'), 9)).toBe('wrongOperation')
    expect(classifyAnswer(taskOf(def, 'shr:12:3', 'keypad'), 15)).toBe('wrongOperation')
    expect(classifyAnswer(taskOf(def, 'shr:12:3', 'keypad'), 3)).toBe('operand')
    expect(classifyAnswer(taskOf(def, 'shr:6:3', 'keypad'), 3)).toBe('ambiguous')
  })

  it('deals one at a time, and says division as "delt med"', () => {
    expect(hintText(def, 'shr:12:3', null))
      .toBe('Giv en til hvert dyr ad gangen, rundt og rundt, til der ikke er flere. Så får hvert dyr fire. Tolv delt med tre giver fire.')
    expect(def.hint(findFact(def, 'shr:12:3'), null).visual).toEqual({ scene: 'groups', groups: 3, size: 4, thing: 'carrot' })
    expect(hintText(def, 'shr:12:3', 'shareUnequal')).toMatch(/^Alle dyr skal have lige mange\./)
    expect(def.hint(findFact(def, 'shr:12:3'), 'shareUnequal').misconception).toBeUndefined()
    expect(hintText(def, 'shr:12:3', 'wrongOperation')).toMatch(/^Når vi deler, skal alle tingene gives ud/)
  })
})
