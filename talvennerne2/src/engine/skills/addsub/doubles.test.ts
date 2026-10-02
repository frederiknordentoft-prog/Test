import { describe, expect, it } from 'vitest'
import doublesModule from './doubles'
import { addsub2Suite, textOf } from './testing/suite'
import { tasksUnderTest } from '../number/testing/harness'
import { classifyAnswer } from '../../misconceptions'
import { compile } from '../../../speech/compile'
import type { ErrorTag, Fact, SkillDef } from '../../types'

const doubles: SkillDef = doublesModule
const n = (f: Fact) => Number(f.id.slice(4))
const fact = (id: string) => doubles.enumerate().find((f) => f.id === id)!
const hintText = (id: string, tag: ErrorTag | null) => compile(doubles.hint(fact(id), tag).speech).text

addsub2Suite(doubles, {
  families: { to5: 5, to10: 5 },
  answerOf: (f) => 2 * n(f),
  idFormat: /^dbl:([1-9]|10)$/,
  explain: (f, v) => ({ mis: n(f) % 2 === 0 && v === n(f) / 2 ? ['wrongOperation'] : [], operand: v === n(f) }),
  formulaValues: (f) => [n(f) / 2, n(f)],
  ceilings: { choice: 3, keypad: 5, numberline: 5 },
  swaps: true,
})

describe('doubles', () => {
  const tasks = tasksUnderTest(doubles, 2)

  it('has the doubles of 1–10, 1, 2, 5 and 10 first, each asked with its recorded question', () => {
    const order = [...doubles.enumerate()].sort((x, y) => x.rank - y.rank).map((f) => f.id)
    expect(order).toEqual([1, 2, 5, 10, 3, 4, 6, 7, 8, 9].map((a) => `dbl:${a}`))
    for (const f of doubles.enumerate()) expect(f.family).toBe(n(f) <= 5 ? 'to5' : 'to10')
    expect(textOf(tasks.find((t) => t.fact.id === 'dbl:6')!.task)).toBe('Hvad er det dobbelte af seks?')
  })

  it('shows a + a on the card for every kind, and the pin goes on an exact 0–20 line', () => {
    for (const { fact: f, kind, task } of tasks) {
      expect(task.prompt).toEqual({ scene: 'equation', terms: [{ n: n(f) }, { op: '+' }, { n: n(f) }, { op: '=' }, { blank: true }] })
      expect(task.range).toEqual([0, 20])
      if (kind === 'numberline') expect(task.tolerance).toBe(0)
    }
  })

  it('reads the half as the other operation, the number itself as an operand', () => {
    const t = tasks.find((x) => x.fact.id === 'dbl:6' && x.kind === 'keypad')!.task
    expect(classifyAnswer(t, 3)).toBe('wrongOperation')
    expect(classifyAnswer(t, 6)).toBe('operand')
    expect(classifyAnswer(t, 11)).toBe('near')
    expect(doubles.candidates(fact('dbl:7')).some((c) => c.tag === 'wrongOperation')).toBe(false)
  })

  it('teaches two equal rows, and the five trick from six to nine', () => {
    expect(hintText('dbl:3', null)).toBe('Det dobbelte er to lige store rækker. Tre og tre giver seks.')
    expect(hintText('dbl:6', 'near')).toBe('Det dobbelte er to lige store rækker. Fem og fem giver ti. En og en giver to. Ti og to giver tolv.')
    expect(hintText('dbl:10', null)).toBe('Det dobbelte er to lige store rækker. Ti og ti giver tyve.')
    expect(hintText('dbl:8', 'wrongOperation')).toMatch(/^Det dobbelte er mere end tallet\. Der kommer lige så mange til\. /)
    expect(doubles.hint(fact('dbl:8'), 'wrongOperation').misconception).toBe('wrongOperation')
    expect(doubles.hint(fact('dbl:8'), null).visual).toEqual({ scene: 'array', rows: 2, cols: 8 })
  })
})
