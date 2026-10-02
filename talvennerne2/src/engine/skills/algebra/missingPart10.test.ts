import { describe, expect, it } from 'vitest'
import missingPart10Module from './missingPart10'
import { algebra2Suite, explainBy, findFact, hintText, taskOf, textOf } from './testing/suite'
import { classifyAnswer } from '../../misconceptions'
import type { AnswerValue, Fact, SkillDef } from '../../types'

const def: SkillDef = missingPart10Module

/** a and c of `mp:<a>+?=<c>`, read independently of the module. */
function ac(f: Pick<Fact, 'id'>): [number, number] {
  const m = /^mp:(\d)\+\?=(\d)$/.exec(f.id)!
  return [Number(m[1]), Number(m[2])]
}

algebra2Suite(def, {
  families: { missing: 36 },
  answerOf: (f) => ac(f)[1] - ac(f)[0],
  idFormat: /^mp:[1-8]\+\?=[2-9]$/,
  explain: (f, v: AnswerValue) => {
    const [a, c] = ac(f)
    return explainBy(v, c - a, [['equalsAsAnswer', a + c]], [a, c])
  },
  formulaValues: (f) => {
    const [a, c] = ac(f)
    return [a + c, a, c]
  },
  ceilings: { choice: 3, keypad: 5 },
})

describe('missingPart10', () => {
  it('is exactly the 36 pairs 1 ≤ a < c ≤ 9 (c = 10 is tenFriends), small wholes first', () => {
    const ids = def.enumerate().map((f) => f.id)
    const want: string[] = []
    for (let c = 2; c <= 9; c++) for (let a = 1; a < c; a++) want.push(`mp:${a}+?=${c}`)
    expect([...ids].sort()).toEqual([...want].sort())
    expect(ids[0]).toBe('mp:1+?=2')
    expect(ids[ids.length - 1]).toBe('mp:1+?=9')
  })

  it('asks the recorded question over a + □ = c, with cards and keypad 0–20', () => {
    const t = taskOf(def, 'mp:3+?=7', 'keypad')
    expect(t.speech).toEqual([{ clip: 'q.mp:3+?=7' }])
    expect(textOf(t)).toBe('Tre plus hvad giver syv?')
    expect(t.prompt).toEqual({ scene: 'equation', terms: [{ n: 3 }, { op: '+' }, { blank: true }, { op: '=' }, { n: 7 }] })
    expect(t.range).toEqual([0, 20])
    expect(t.maxDigits).toBe(2)
  })

  it('reads 3 + □ = 7 answered 10 as equalsAsAnswer, 3 and 7 as operands', () => {
    const t = taskOf(def, 'mp:3+?=7', 'keypad')
    expect(classifyAnswer(t, 10)).toBe('equalsAsAnswer')
    expect(classifyAnswer(t, 3)).toBe('operand')
    expect(classifyAnswer(t, 7)).toBe('operand')
    expect(classifyAnswer(t, 5)).toBe('near')
  })

  it('counts on from the first number, and says what = means for equalsAsAnswer', () => {
    expect(hintText(def, 'mp:3+?=7', null)).toBe('Start på tre. Tæl op til syv. Fire. Fem. Seks. Syv. Tre plus fire giver syv.')
    expect(def.hint(findFact(def, 'mp:3+?=7'), null).visual).toEqual({ scene: 'line', min: 0, max: 10, hops: [3, 4, 5, 6, 7] })
    const h = def.hint(findFact(def, 'mp:3+?=7'), 'equalsAsAnswer')
    expect(hintText(def, 'mp:3+?=7', 'equalsAsAnswer')).toMatch(/^Lighedstegnet betyder: det samme på begge sider\. Start på tre\./)
    expect(h).toMatchObject({ misconception: 'equalsAsAnswer', animated: true, visual: { scene: 'balance', left: [{ n: 3 }, { op: '+' }, { n: 4 }], right: [{ n: 7 }] } })
  })
})
