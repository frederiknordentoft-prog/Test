import { describe, expect, it } from 'vitest'
import tens100Module from './tens100'
import { addsub2Suite, explainSum, findFact, hintText, idSum, tagOf, textOf } from './testing/suite'
import { factsUnderTest, tasksUnderTest } from '../number/testing/harness'
import { classifyAnswer } from '../../misconceptions'
import { makeRng } from '../../rng'
import type { Fact, SkillDef } from '../../types'

const def: SkillDef = tens100Module
const sum = (f: Fact) => idSum(f.id)

addsub2Suite(def, {
  families: { addTens: 20, subTens: 20 },
  answerOf: (f) => (sum(f).op === '+' ? sum(f).a + sum(f).b : sum(f).a - sum(f).b),
  idFormat: /^t100:\d+0[+-]\d+0$/,
  explain: (f, v) => explainSum('tens100', f.family, sum(f).a, sum(f).op, sum(f).b, v),
  formulaValues: (f) => {
    const { a, op, b } = sum(f)
    const answer = op === '+' ? a + b : a - b
    return [answer / 10, answer * 10, op === '+' ? Math.abs(a - b) : a + b, a, b]
  },
  ceilings: { choice: 3, keypad: 5 },
})

describe('tens100', () => {
  it('draws whole tens up to 100, plus and minus, and reaches all 45 of each', () => {
    const seen: Record<string, Set<string>> = { addTens: new Set(), subTens: new Set() }
    for (const f of factsUnderTest(def)) {
      const { a, op, b } = sum(f)
      expect(a % 10 === 0 && b % 10 === 0 && a >= 10 && b >= 10, f.id).toBe(true)
      expect(f.family === 'addTens' ? op === '+' && a + b <= 100 : op === '−' && b < a && a <= 100, f.id).toBe(true)
    }
    const rng = makeRng(3)
    for (const fam of def.families) for (let i = 0; i < 1500; i++) seen[fam.id].add(def.instance!(fam, rng, new Set()).id)
    expect([seen.addTens.size, seen.subTens.size]).toEqual([45, 45])
  })

  it('asks "Hvad er tredive plus fyrre?"', () => {
    expect(textOf(tasksUnderTest(def).find((x) => x.fact.family === 'subTens')!.task)).toMatch(/^Hvad er [a-zæøå ]+ minus [a-zæøå]+\?$/)
    const f = findFact(def, 't100:30+40')
    expect(textOf({ ...tasksUnderTest(def)[0].task, speech: def.speech(f, 'keypad') })).toBe('Hvad er tredive plus fyrre?')
  })

  it('reads a lost or doubled zero as tensZero, and the next tens as near misses', () => {
    expect(tagOf(def, 't100:30+40', 7)).toBe('tensZero')
    expect(tagOf(def, 't100:30+40', 700)).toBe('tensZero')
    expect(tagOf(def, 't100:30+40', 10)).toBe('wrongOperation')
    expect(tagOf(def, 't100:30+40', 80)).toBe('near')
    expect(tagOf(def, 't100:70-20', 5)).toBe('tensZero')
    expect(tagOf(def, 't100:70-20', 90)).toBe('wrongOperation')
    expect(tagOf(def, 't100:100-90', 100)).toBe('ambiguous') // the zero doubled, or the 100 repeated (A9)
    expect(def.candidates(findFact(def, 't100:30+40')).some((c) => c.value === 71 || c.value === 69)).toBe(false)
    const t = tasksUnderTest(def).find((x) => x.kind === 'keypad')!.task
    expect(t.maxDigits).toBe(3)
    expect(classifyAnswer(t, (t.answer as number) * 10)).toBe('tensZero')
  })

  it('counts in tens, with rods for the answer', () => {
    expect(hintText(def, 't100:30+40', null)).toBe('Tre tiere plus fire tiere giver syv tiere. Det er halvfjerds.')
    expect(hintText(def, 't100:20-10', 'near')).toBe('To tiere minus en tier giver en tier. Det er ti.')
    expect(hintText(def, 't100:50+50', null)).toBe('Fem tiere plus fem tiere giver ti tiere. Det er et hundrede.')
    expect(hintText(def, 't100:30+40', 'tensZero')).toMatch(/^Hele tiere skrives med ét nul til sidst\. Tre tiere/)
    expect(def.hint(findFact(def, 't100:30+40'), 'tensZero').misconception).toBe('tensZero')
    expect(def.hint(findFact(def, 't100:30+40'), null).visual).toEqual({ scene: 'base', h: 0, t: 7, o: 0, order: 'hto' })
  })
})
