import { describe, expect, it } from 'vitest'
import halvesModule from './halves'
import { addsub2Suite, textOf } from './testing/suite'
import { tasksUnderTest } from '../number/testing/harness'
import { classifyAnswer } from '../../misconceptions'
import { isProduction } from '../../kinds'
import { compile } from '../../../speech/compile'
import type { ErrorTag, Fact, SkillDef } from '../../types'

const halves: SkillDef = halvesModule
const whole = (f: Fact) => Number(f.id.slice(4))
const fact = (id: string) => halves.enumerate().find((f) => f.id === id)!
const hintText = (id: string, tag: ErrorTag | null) => compile(halves.hint(fact(id), tag).speech).text

addsub2Suite(halves, {
  families: { to10: 5, to20: 5 },
  answerOf: (f) => whole(f) / 2,
  idFormat: /^hlf:(2|4|6|8|10|12|14|16|18|20)$/,
  explain: (f, v) => ({ mis: v === 2 * whole(f) ? ['wrongOperation'] : [], operand: v === whole(f) }),
  formulaValues: (f) => [2 * whole(f), whole(f)],
  ceilings: { choice: 3, keypad: 5, share: 3 },
})

describe('halves', () => {
  const tasks = tasksUnderTest(halves, 2)

  it('halves the even numbers 2–20 in the doubles order, each asked with its recorded question', () => {
    const order = [...halves.enumerate()].sort((x, y) => x.rank - y.rank).map((f) => f.id)
    expect(order).toEqual([1, 2, 5, 10, 3, 4, 6, 7, 8, 9].map((h) => `hlf:${2 * h}`))
    for (const f of halves.enumerate()) expect(f.family).toBe(whole(f) <= 10 ? 'to10' : 'to20')
    expect(textOf(tasks.find((t) => t.fact.id === 'hlf:14')!.task)).toBe('Hvad er halvdelen af fjorten?')
  })

  it('pictures the sharing between two friends on every kind; dealing is never production', () => {
    for (const { fact: f, kind, task } of tasks) {
      expect(task.prompt).toMatchObject({ scene: 'share', total: whole(f), recipients: 2 })
      if (kind === 'share') expect(isProduction(task)).toBe(false)
    }
  })

  it('shows the double as a card from 12 on (range 0–40) and reads an uneven deal as shareUnequal', () => {
    const t = tasks.find((x) => x.fact.id === 'hlf:14' && x.kind === 'keypad')!.task
    expect(t.range).toEqual([0, 40])
    expect(classifyAnswer(t, 28)).toBe('wrongOperation')
    expect(classifyAnswer(t, 14)).toBe('operand')
    const s = tasks.find((x) => x.fact.id === 'hlf:14' && x.kind === 'share')!.task
    expect(classifyAnswer(s, -1)).toBe('shareUnequal')
    expect(classifyAnswer(s, 7)).toBeNull()
    expect(tasks.find((x) => x.fact.id === 'hlf:8' && x.kind === 'choice')!.task.range).toEqual([0, 20])
  })

  it('says the half as the double backwards, in two equal rows', () => {
    expect(hintText('hlf:14', null)).toBe('Del i to lige store rækker. Syv og syv giver fjorten. Så halvdelen af fjorten er syv.')
    expect(hintText('hlf:2', 'operand')).toBe('Del i to lige store rækker. En og en giver to. Så halvdelen af to er en.')
    expect(hintText('hlf:14', 'wrongOperation')).toMatch(/^Halvdelen er mindre end tallet\. Del i to/)
    expect(halves.hint(fact('hlf:14'), null).visual).toEqual({ scene: 'array', rows: 2, cols: 7 })
  })
})
