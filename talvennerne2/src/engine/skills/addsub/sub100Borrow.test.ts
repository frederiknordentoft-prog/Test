import { describe, expect, it } from 'vitest'
import sub100BorrowModule from './sub100Borrow'
import { addsub2Suite, bnd, dc10, explainSum, findFact, hintText, idSum, sfl, tagOf, textOf } from './testing/suite'
import { factsUnderTest, tasksUnderTest } from '../number/testing/harness'
import { buildTask } from '../../tasks'
import { classifyAnswer } from '../../misconceptions'
import { makeRng } from '../../rng'
import type { Fact, SkillDef } from '../../types'

const def: SkillDef = sub100BorrowModule
const diff = (f: Fact) => idSum(f.id)

addsub2Suite(def, {
  families: { fromTen: 20, TOminusOborrow: 20, TOminusTOborrow: 20, nearTen: 20 },
  answerOf: (f) => diff(f).a - diff(f).b,
  idFormat: /^s100b:\d\d\d?-\d\d?$/,
  explain: (f, v) => explainSum('sub100Borrow', f.family, diff(f).a, '−', diff(f).b, v),
  formulaValues: (f) => {
    const { a, b } = diff(f)
    return [sfl(a, b), bnd(a, b), ...(f.family === 'fromTen' ? [dc10(a, b) ?? -1] : []), a + b, a, b]
  },
  ceilings: { choice: 3, keypad: 5 },
})

function familyOf(a: number, b: number): string {
  if (a % 10 === 0) return 'fromTen'
  if (b === 9 || b === 19) return 'nearTen'
  return b < 10 ? 'TOminusOborrow' : 'TOminusTOborrow'
}

describe('sub100Borrow', () => {
  it('always borrows, and the numbers alone say the family', () => {
    for (const f of factsUnderTest(def)) {
      const { a, op, b } = diff(f)
      expect(op).toBe('−')
      expect(a % 10 < b % 10 && a > b && a <= 100 && a >= 20, f.id).toBe(true)
      expect(f.family, f.id).toBe(familyOf(a, b))
    }
    const seen = new Set(factsUnderTest(def).filter((f) => f.family === 'fromTen').map((f) => diff(f).a))
    expect(seen.has(100) && seen.has(20)).toBe(true)
  })

  it('asks "Hvad er treoghalvtreds minus syvogtyve?"', () => {
    const t = tasksUnderTest(def)[0].task
    expect(textOf({ ...t, speech: def.speech(findFact(def, 's100b:53-27'), 'keypad') })).toBe('Hvad er treoghalvtreds minus syvogtyve?')
    expect(textOf({ ...t, speech: def.speech(findFact(def, 's100b:100-37'), 'keypad') })).toBe('Hvad er et hundrede minus syvogtredive?')
  })

  it('tags the borrow misconceptions of pædagogik §3.2 and digitComplement10 on 100 − TO', () => {
    expect(tagOf(def, 's100b:53-27', 34)).toBe('smallerFromLarger')
    expect(tagOf(def, 's100b:53-27', 36)).toBe('borrowNoDecrement')
    expect(tagOf(def, 's100b:53-27', 80)).toBe('wrongOperation')
    expect(tagOf(def, 's100b:53-27', 27)).toBe('operand')
    expect(tagOf(def, 's100b:53-27', 16)).toBe('near')
    expect(tagOf(def, 's100b:100-37', 73)).toBe('digitComplement10')
    expect(tagOf(def, 's100b:100-37', 173)).toBe('borrowNoDecrement')
    expect(tagOf(def, 's100b:100-37', 137)).toBe('ambiguous') // smallerFromLarger, or 100 + 37
    expect(tagOf(def, 's100b:40-3', 43)).toBe('ambiguous') // smallerFromLarger, or 40 + 3
    expect(tagOf(def, 's100b:40-3', 47)).toBe('borrowNoDecrement')
    expect(tagOf(def, 's100b:60-24', 46)).toBe('borrowNoDecrement') // no digitComplement10 below 100
    expect(tagOf(def, 's100b:52-9', 57)).toBe('smallerFromLarger')
    const t = buildTask(def, findFact(def, 's100b:100-37'), 'keypad', makeRng(1), 0).task
    expect(t.maxDigits).toBe(3)
    expect(classifyAnswer(t, 73)).toBe('digitComplement10')
    expect(classifyAnswer(t, 173)).toBe('borrowNoDecrement')
  })

  it('hops back to the ten first on the empty number line; a ten too far and one forward near a ten', () => {
    expect(hintText(def, 's100b:53-27', null))
      .toBe('Start på treoghalvtreds. Hop tre tilbage til halvtreds. Hop tyve tilbage til tredive. Hop fire tilbage til seksogtyve.')
    expect(def.hint(findFact(def, 's100b:53-27'), null).visual).toEqual({ scene: 'line', min: 20, max: 60, hops: [53, 50, 30, 26] })
    expect(hintText(def, 's100b:43-7', 'near')).toBe('Start på treogfyrre. Hop tre tilbage til fyrre. Hop fire tilbage til seksogtredive.')
    expect(hintText(def, 's100b:60-24', null)).toBe('Start på tres. Hop tyve tilbage til fyrre. Hop fire tilbage til seksogtredive.')
    expect(hintText(def, 's100b:52-9', null)).toBe('Start på tooghalvtreds. Hop ti tilbage til toogfyrre. Hop en frem til treogfyrre.')
    expect(hintText(def, 's100b:52-19', null)).toBe('Start på tooghalvtreds. Hop tyve tilbage til toogtredive. Hop en frem til treogtredive.')
  })

  it('says the borrow in columns, and counts up for digitComplement10', () => {
    expect(hintText(def, 's100b:53-27', 'smallerFromLarger'))
      .toBe('Der er ikke enere nok. Veksl en tier til ti enere. Tretten minus syv giver seks. Svaret er seksogtyve.')
    expect(def.hint(findFact(def, 's100b:53-27'), 'smallerFromLarger'))
      .toMatchObject({ misconception: 'smallerFromLarger', animated: true, visual: { scene: 'columns', a: 53, b: 27, op: '−', carry: true } })
    expect(hintText(def, 's100b:53-27', 'borrowNoDecrement'))
      .toBe('Når du veksler en tier, er der en tier mindre tilbage. Tretten minus syv giver seks. Svaret er seksogtyve.')
    expect(hintText(def, 's100b:100-37', 'digitComplement10'))
      .toBe('Tæl op fra det lille tal. Start på syvogtredive. Hop tre frem til fyrre. Hop tres frem til et hundrede. Hoppene giver tilsammen treogtres.')
    expect(def.hint(findFact(def, 's100b:100-37'), 'digitComplement10'))
      .toMatchObject({ misconception: 'digitComplement10', visual: { scene: 'line', min: 30, max: 100, hops: [37, 40, 100] } })
  })
})
