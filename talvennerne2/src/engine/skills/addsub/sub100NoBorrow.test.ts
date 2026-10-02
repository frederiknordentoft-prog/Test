import { describe, expect, it } from 'vitest'
import sub100NoBorrowModule from './sub100NoBorrow'
import { addsub2Suite, explainSum, findFact, hintText, idSum, tagOf, textOf } from './testing/suite'
import { factsUnderTest, tasksUnderTest } from '../number/testing/harness'
import type { Fact, SkillDef } from '../../types'

const def: SkillDef = sub100NoBorrowModule
const diff = (f: Fact) => idSum(f.id)

addsub2Suite(def, {
  families: { TOminusO: 20, TOminusT0: 20, TOminusTO: 20 },
  answerOf: (f) => diff(f).a - diff(f).b,
  idFormat: /^s100:\d\d-\d\d?$/,
  explain: (f, v) => explainSum('sub100NoBorrow', f.family, diff(f).a, '−', diff(f).b, v),
  formulaValues: (f) => [diff(f).a + diff(f).b, diff(f).a, diff(f).b],
  ceilings: { choice: 3, keypad: 5 },
  swaps: true,
})

describe('sub100NoBorrow', () => {
  it('never borrows, and the families are what they say', () => {
    for (const f of factsUnderTest(def)) {
      const { a, op, b } = diff(f)
      expect(op).toBe('−')
      expect(a >= 21 && a % 10 >= 1 && a % 10 >= b % 10 && a > b, f.id).toBe(true)
      expect(f.family, f.id).toBe(b < 10 ? 'TOminusO' : b % 10 === 0 ? 'TOminusT0' : 'TOminusTO')
      // without a borrow the column misconceptions give the answer itself
      expect(def.candidates(f).every((c) => ['wrongOperation', 'operand', 'near', 'other', 'ambiguous'].includes(c.tag)), f.id).toBe(true)
    }
  })

  it('asks "Hvad er syvogfyrre minus femogtyve?"', () => {
    const t = tasksUnderTest(def)[0].task
    expect(textOf({ ...t, speech: def.speech(findFact(def, 's100:47-25'), 'choice') })).toBe('Hvad er syvogfyrre minus femogtyve?')
  })

  it('tags plus instead of minus, the numbers asked and near misses', () => {
    expect(tagOf(def, 's100:47-25', 72)).toBe('wrongOperation')
    expect(tagOf(def, 's100:47-25', 25)).toBe('operand')
    expect(tagOf(def, 's100:47-25', 32)).toBe('near')
    expect(tagOf(def, 's100:47-5', 52)).toBe('wrongOperation')
    expect(tagOf(def, 's100:47-20', 45)).toBe('other') // the tens taken from the ones: not in the catalogue
  })

  it('works the columns, ones first', () => {
    expect(hintText(def, 's100:47-5', null)).toBe('Regn enerne først. Syv minus fem giver to. Tierne er de samme. Svaret er toogfyrre.')
    expect(hintText(def, 's100:47-7', null)).toBe('Regn enerne først. Syv minus syv giver nul. Tierne er de samme. Svaret er fyrre.')
    expect(hintText(def, 's100:47-20', null)).toBe('Regn tierne. Fire tiere minus to tiere giver to tiere. Enerne er de samme. Svaret er syvogtyve.')
    expect(hintText(def, 's100:47-25', 'wrongOperation'))
      .toBe('Minus betyder, at nogle bliver taget væk. Regn enerne først. Syv minus fem giver to. Regn så tierne. Fire tiere minus to tiere giver to tiere. Svaret er toogtyve.')
    expect(def.hint(findFact(def, 's100:47-25'), null).visual).toEqual({ scene: 'columns', a: 47, b: 25, op: '−', carry: false })
  })
})
