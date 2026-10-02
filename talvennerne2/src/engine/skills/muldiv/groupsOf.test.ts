import { describe, expect, it } from 'vitest'
import groupsOfModule from './groupsOf'
import { algebra2Suite, explainBy, findFact, hintText, taskOf, textOf } from '../algebra/testing/suite'
import { classifyAnswer } from '../../misconceptions'
import type { AnswerValue, Fact, SkillDef } from '../../types'

const def: SkillDef = groupsOfModule

/** g groups of s, read independently of the module. */
function gs(f: Pick<Fact, 'id'>): [number, number] {
  const m = /^grp:(\d)x(\d)$/.exec(f.id)!
  return [Number(m[1]), Number(m[2])]
}

algebra2Suite(def, {
  families: { groups: 16 },
  answerOf: (f) => gs(f)[0] * gs(f)[1],
  idFormat: /^grp:[2-5]x[2-5]$/,
  explain: (f, v: AnswerValue) => {
    const [g, s] = gs(f)
    return explainBy(v, g * s, [['mulAsAdd', g + s]], [g, s])
  },
  formulaValues: (f) => [gs(f)[0] + gs(f)[1], ...gs(f)],
  ceilings: { choice: 3, keypad: 5 },
})

describe('groupsOf', () => {
  it('has the 16 pictures g = 2–5 groups of s = 2–5, smallest totals first', () => {
    const facts = def.enumerate()
    expect(facts.map((f) => f.id).sort()).toEqual([2, 3, 4, 5].flatMap((g) => [2, 3, 4, 5].map((s) => `grp:${g}x${s}`)).sort())
    expect(facts[0].id).toBe('grp:2x2')
    expect(facts[facts.length - 1].id).toBe('grp:5x5')
  })

  it('shows the groups and asks how many in all, naming the things', () => {
    const t = taskOf(def, 'grp:3x4', 'keypad')
    expect(t.prompt).toMatchObject({ scene: 'groups', groups: 3, size: 4 })
    expect(textOf(t)).toMatch(/^Der er tre grupper med fire [a-zæøå]+ i hver\. Hvor mange er der i alt\?$/)
    expect(t.range).toEqual([0, 30])
  })

  it('reads 3 groups of 4 answered 7 as mulAsAdd, 3 and 4 as operands', () => {
    const t = taskOf(def, 'grp:3x4', 'keypad')
    expect(classifyAnswer(t, 7)).toBe('mulAsAdd')
    expect(classifyAnswer(t, 4)).toBe('operand')
    expect(classifyAnswer(t, 16)).toBe('near')
  })

  it('counts group by group', () => {
    expect(hintText(def, 'grp:3x4', null)).toBe('Tæl gruppe for gruppe. Fire. Otte. Tolv. Tre grupper med fire er tolv.')
    expect(hintText(def, 'grp:3x4', 'mulAsAdd')).toMatch(/^Vi skal ikke lægge de to tal sammen\. Tæl alle i alle grupperne\. Tæl gruppe/)
    expect(def.hint(findFact(def, 'grp:3x4'), null).visual).toMatchObject({ scene: 'groups', groups: 3, size: 4 })
  })
})
