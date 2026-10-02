import { describe, expect, it } from 'vitest'
import add100CarryModule from './add100Carry'
import { addsub2Suite, explainSum, findFact, hintText, idSum, tagOf, textOf } from './testing/suite'
import { factsUnderTest, tasksUnderTest } from '../number/testing/harness'
import { buildTask } from '../../tasks'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { makeRng } from '../../rng'
import type { Fact, SkillDef } from '../../types'

const def: SkillDef = add100CarryModule
const sum = (f: Fact) => idSum(f.id)

addsub2Suite(def, {
  families: { toNextTen: 20, TOplusOcarry: 20, TOplusTOcarry: 20, nearTen: 20, TOplusTOover100: 20 },
  answerOf: (f) => sum(f).a + sum(f).b,
  idFormat: /^a100c:\d\d\+\d\d?$/,
  explain: (f, v) => explainSum('add100Carry', f.family, sum(f).a, '+', sum(f).b, v),
  formulaValues: (f) => {
    const { a, b } = sum(f)
    return [a + b - 10, a + 10 * b, Math.abs(a - b), a, b]
  },
  ceilings: { choice: 3, keypad: 5, numberline: 5 },
  swaps: true,
})

/** The family a sum belongs to, from its numbers alone (the families are disjoint). */
function familyOf(a: number, b: number): string {
  if (a + b > 100) return 'TOplusTOover100'
  if (b === 9 || b === 19) return (a % 10) + (b % 10) === 10 ? 'toNextTen' : 'nearTen'
  if (b < 10) return (a % 10) + b === 10 ? 'toNextTen' : 'TOplusOcarry'
  return 'TOplusTOcarry'
}

describe('add100Carry', () => {
  const tasks = tasksUnderTest(def)

  it('always crosses a ten (or the hundred), and the numbers alone say the family', () => {
    for (const f of factsUnderTest(def)) {
      const { a, op, b } = sum(f)
      expect(op).toBe('+')
      expect((a % 10) + (b % 10) >= 10 || a + b > 100, f.id).toBe(true)
      expect(a >= 11 && a <= 99 && a % 10 >= 1, f.id).toBe(true)
      expect(f.family, f.id).toBe(familyOf(a, b))
      expect(a + b, f.id).toBeLessThanOrEqual(f.family === 'TOplusTOover100' ? 198 : 100)
    }
  })

  it('asks "Hvad er otteogtredive plus femogfyrre?", with 0–200 for sums over a hundred', () => {
    expect(textOf({ ...tasks[0].task, speech: def.speech(findFact(def, 'a100c:38+45'), 'keypad') })).toBe('Hvad er otteogtredive plus femogfyrre?')
    for (const { fact, kind, task } of tasks) {
      expect(task.range).toEqual([0, fact.family === 'TOplusTOover100' ? 200 : 100])
      expect(task.prompt.scene).toBe('equation')
      if (kind === 'numberline') expect(task.tolerance).toBe(fact.family === 'TOplusTOover100' ? 10 : 5)
    }
  })

  it('SPEC §4.1: 38 + 45 answered 38 is an operand, 73 forgotCarry; 38 + 6 → 98 placeMisalign', () => {
    const t = buildTask(def, findFact(def, 'a100c:38+45'), 'keypad', makeRng(1), 0).task
    expect(classifyAnswer(t, 38)).toBe('operand')
    expect(classifyAnswer(t, 73)).toBe('forgotCarry')
    expect(classifyAnswer(t, 7)).toBe('wrongOperation')
    expect(classifyAnswer(t, 84)).toBe('near')
    expect([...detectableOf(t)].sort()).toEqual(['forgotCarry', 'wrongOperation'])
    expect(tagOf(def, 'a100c:38+6', 98)).toBe('placeMisalign')
    expect(tagOf(def, 'a100c:34+6', 30)).toBe('forgotCarry')
    expect(tagOf(def, 'a100c:67+58', 115)).toBe('forgotCarry')
    expect(tagOf(def, 'a100c:46+9', 136)).toBe('placeMisalign')
  })

  it('never takes a number from the question as right on the line (a one-digit b is 6 or more)', () => {
    for (const { fact, kind, task } of tasks) {
      if (kind !== 'numberline') continue
      for (const v of fact.operands) expect(isCorrect(task, v), `${fact.id}: ${v}`).toBe(false)
      if (fact.operands[1] < 10) expect(fact.operands[1], fact.id).toBeGreaterThanOrEqual(6)
    }
  })

  it('counts a pin within ±5 as right on the number line, and a forgotten ten as forgotCarry', () => {
    const t = buildTask(def, findFact(def, 'a100c:38+45'), 'numberline', makeRng(2), 0).task
    expect(isCorrect(t, 80)).toBe(true)
    expect(isCorrect(t, 77)).toBe(false)
    expect(classifyAnswer(t, 73)).toBe('forgotCarry')
  })

  it('gives a carry sum more time: cards 10 s, keypad 15 s, number line 18 s, also for drawn instances', () => {
    // the round reads SkillDef.fastMs for canonical facts and the family's fastMs for drawn instances
    const want = { choice: 10_000, keypad: 15_000, numberline: 18_000 }
    for (const fam of def.families) expect(fam.fastMs, fam.id).toEqual(want)
    const drawn = def.instance!(def.families[2], makeRng(11), new Set())
    expect(['choice', 'keypad', 'numberline'].map((k) => def.fastMs!(drawn, k as 'choice'))).toEqual([10_000, 15_000, 18_000])
  })

  it('hops on the empty number line: up to the ten, the tens, the rest; a ten and one back near a ten', () => {
    expect(hintText(def, 'a100c:38+45', null)).toBe('Start på otteogtredive. Hop to frem til fyrre. Hop fyrre frem til firs. Hop tre frem til treogfirs.')
    expect(def.hint(findFact(def, 'a100c:38+45'), null).visual).toEqual({ scene: 'line', min: 30, max: 90, hops: [38, 40, 80, 83] })
    expect(hintText(def, 'a100c:34+6', 'near')).toBe('Start på fireogtredive. Hop seks frem til fyrre.')
    expect(hintText(def, 'a100c:38+6', null)).toBe('Start på otteogtredive. Hop to frem til fyrre. Hop fire frem til fireogfyrre.')
    expect(hintText(def, 'a100c:46+9', null)).toBe('Start på seksogfyrre. Hop ti frem til seksoghalvtreds. Hop en tilbage til femoghalvtreds.')
    expect(hintText(def, 'a100c:46+19', null)).toBe('Start på seksogfyrre. Hop tyve frem til seksogtres. Hop en tilbage til femogtres.')
    expect(hintText(def, 'a100c:67+58', null))
      .toBe('Start på syvogtres. Hop tre frem til halvfjerds. Hop halvtreds frem til et hundrede og tyve. Hop fem frem til et hundrede og femogtyve.')
  })

  it('says the carry in columns for forgotCarry (the round shows the carry film there)', () => {
    const h = def.hint(findFact(def, 'a100c:38+45'), 'forgotCarry')
    expect(hintText(def, 'a100c:38+45', 'forgotCarry'))
      .toBe('Når enerne giver ti eller mere, skal tieren med over til tierne. Otte plus fem giver tretten. Svaret er treogfirs.')
    expect(h).toMatchObject({ misconception: 'forgotCarry', animated: true, visual: { scene: 'columns', a: 38, b: 45, op: '+', carry: true } })
    expect(hintText(def, 'a100c:38+6', 'placeMisalign')).toMatch(/^Det lille tal er enere\. Læg det til enerne, ikke til tierne\. Start på/)
    expect(hintText(def, 'a100c:38+45', 'wrongOperation')).toMatch(/^Plus betyder, at der kommer flere til\. Start på/)
  })
})
