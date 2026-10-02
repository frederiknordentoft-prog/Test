import { describe, expect, it } from 'vitest'
import addSub1000RoundModule from './addSub1000Round'
import { addsub2Suite, explainSum, findFact, hintText, idSum, tagOf, textOf } from './testing/suite'
import { factsUnderTest, tasksUnderTest } from '../number/testing/harness'
import { buildTask } from '../../tasks'
import { classifyAnswer } from '../../misconceptions'
import { makeRng } from '../../rng'
import type { Fact, SkillDef } from '../../types'

const def: SkillDef = addSub1000RoundModule
const sum = (f: Fact) => idSum(f.id)
const answerOf = (f: Fact) => (sum(f).op === '+' ? sum(f).a + sum(f).b : sum(f).a - sum(f).b)

addsub2Suite(def, {
  families: { HplusH: 20, HminusH: 20, HTplusT: 20, HTminusT: 20, HplusTO: 20, HTplusTcarry: 20 },
  answerOf,
  idFormat: /^r1000:\d+[+-]\d+$/,
  explain: (f, v) => explainSum('addSub1000Round', f.family, sum(f).a, sum(f).op, sum(f).b, v),
  formulaValues: (f) => {
    const { a, op, b } = sum(f)
    const answer = answerOf(f)
    return [answer / 10, answer * 10, answer - 100, op === '+' ? Math.abs(a - b) : a + b, a, b]
  },
  ceilings: { choice: 3, keypad: 5 },
  swaps: true,
})

function familyOf(a: number, op: string, b: number): string {
  if (a % 100 === 0 && b % 100 === 0) return op === '+' ? 'HplusH' : 'HminusH'
  if (a % 100 === 0) return 'HplusTO'
  if (op === '−') return 'HTminusT'
  return Math.floor((a % 100) / 10) + b / 10 >= 10 ? 'HTplusTcarry' : 'HTplusT'
}

describe('addSub1000Round', () => {
  it('keeps to whole hundreds and tens up to 1000, and the numbers alone say the family', () => {
    for (const f of factsUnderTest(def)) {
      const { a, op, b } = sum(f)
      const answer = answerOf(f)
      expect(answer >= 0 && answer <= 1000 && a >= 100, f.id).toBe(true)
      expect(f.family, f.id).toBe(familyOf(a, op, b))
      if (f.family === 'HplusTO') expect(b >= 11 && b <= 99 && b % 10 !== 0, f.id).toBe(true)
      else expect(a % 10 === 0 && b % 10 === 0, f.id).toBe(true)
      if (f.family === 'HTminusT') expect(b <= a % 100, f.id).toBe(true)
    }
    const rng = makeRng(8)
    const seen: Record<string, Set<string>> = {}
    for (const fam of def.families) {
      seen[fam.id] = new Set()
      for (let i = 0; i < 1500; i++) seen[fam.id].add(def.instance!(fam, rng, new Set()).id)
    }
    expect([seen.HplusH.size, seen.HminusH.size]).toEqual([45, 45])
  })

  it('asks "Hvad er tre hundrede plus fire hundrede?"', () => {
    const t = tasksUnderTest(def)[0].task
    expect(textOf({ ...t, speech: def.speech(findFact(def, 'r1000:300+400'), 'keypad') })).toBe('Hvad er tre hundrede plus fire hundrede?')
    expect(textOf({ ...t, speech: def.speech(findFact(def, 'r1000:370-20'), 'keypad') })).toBe('Hvad er tre hundrede og halvfjerds minus tyve?')
  })

  it('tags the lost or doubled zero, the new hundred left out, the other operation and the near hundreds', () => {
    expect(tagOf(def, 'r1000:300+400', 70)).toBe('tensZero')
    expect(tagOf(def, 'r1000:300+400', 7000)).toBe('tensZero')
    expect(tagOf(def, 'r1000:300+400', 100)).toBe('wrongOperation')
    expect(tagOf(def, 'r1000:300+400', 600)).toBe('near')
    expect(tagOf(def, 'r1000:300+400', 690)).toBeUndefined()
    expect(tagOf(def, 'r1000:370+20', 39)).toBe('tensZero')
    expect(tagOf(def, 'r1000:370+20', 400)).toBe('near')
    expect(tagOf(def, 'r1000:370+60', 330)).toBe('forgotCarry')
    expect(tagOf(def, 'r1000:370+50', 320)).toBe('ambiguous') // the hundred left out, or 370 − 50
    expect(tagOf(def, 'r1000:300+45', 255)).toBe('wrongOperation')
    expect(tagOf(def, 'r1000:300+45', 346)).toBe('near')
    expect(tagOf(def, 'r1000:1000-900', 1000)).toBe('ambiguous') // the zero doubled, or the 1000 repeated (A9)
    const t = buildTask(def, findFact(def, 'r1000:300+400'), 'keypad', makeRng(1), 0).task
    expect(t.maxDigits).toBe(4)
    expect(classifyAnswer(t, 7000)).toBe('tensZero')
    expect(classifyAnswer(t, 300)).toBe('operand')
  })

  it('works in whole hundreds or tens, the hundreds staying', () => {
    expect(hintText(def, 'r1000:300+400', null)).toBe('Regn med hele hundreder. Tre plus fire giver syv. Svaret er syv hundrede.')
    expect(hintText(def, 'r1000:700-200', 'near')).toBe('Regn med hele hundreder. Syv minus to giver fem. Svaret er fem hundrede.')
    expect(hintText(def, 'r1000:500+500', null)).toBe('Regn med hele hundreder. Fem plus fem giver ti. Svaret er tusind.')
    expect(hintText(def, 'r1000:370+20', null))
      .toBe('Regn med tierne. Halvfjerds plus tyve giver halvfems. Hundrederne er de samme. Svaret er tre hundrede og halvfems.')
    expect(hintText(def, 'r1000:370-70', null))
      .toBe('Regn med tierne. Halvfjerds minus halvfjerds giver nul. Hundrederne er de samme. Svaret er tre hundrede.')
    expect(hintText(def, 'r1000:300+45', null))
      .toBe('Hundrederne og resten skal bare stå sammen. Tre hundrede plus femogfyrre giver tre hundrede og femogfyrre.')
    expect(hintText(def, 'r1000:370+50', null))
      .toBe('Regn med tierne. Halvfjerds plus halvtreds giver et hundrede og tyve. Ti tiere bliver til et hundrede mere. Svaret er fire hundrede og tyve.')
    expect(hintText(def, 'r1000:370+60', 'forgotCarry')).toMatch(/^Når tierne giver ti tiere eller mere, kommer der et hundrede mere\. Regn med tierne\./)
    expect(hintText(def, 'r1000:300+400', 'tensZero')).toMatch(/^Hele hundreder skrives med to nuller til sidst\. /)
    expect(hintText(def, 'r1000:370+20', 'tensZero')).toMatch(/^Hele tiere skrives med ét nul til sidst\. /)
    expect(def.hint(findFact(def, 'r1000:370+50'), null).visual).toEqual({ scene: 'columns', a: 370, b: 50, op: '+', carry: true })
  })
})
