import { describe, expect, it } from 'vitest'
import subTo20Module from './subTo20'
import { addsub2Suite, bnd, explainSum, idSum, sfl, textOf } from './testing/suite'
import { tasksUnderTest } from '../number/testing/harness'
import { buildTask } from '../../tasks'
import { classifyAnswer } from '../../misconceptions'
import { makeRng } from '../../rng'
import { questionClip } from '../../../speech/recallQuestions'
import { compile } from '../../../speech/compile'
import type { ErrorTag, Fact, SkillDef } from '../../types'

const subTo20: SkillDef = subTo20Module
const fact = (id: string) => subTo20.enumerate().find((f) => f.id === id)!
const tagOf = (id: string, v: number) => subTo20.candidates(fact(id)).find((c) => c.value === v)?.tag
const hintText = (id: string, tag: ErrorTag | null) => compile(subTo20.hint(fact(id), tag).speech).text
const diff = (f: Fact) => idSum(f.id)

addsub2Suite(subTo20, {
  families: { bridge10: 36 },
  answerOf: (f) => diff(f).a - diff(f).b,
  idFormat: /^sub:1[1-8]-[2-9]$/,
  explain: (f, v) => explainSum('subTo20', f.family, diff(f).a, '−', diff(f).b, v),
  formulaValues: (f) => {
    const { a, b } = diff(f)
    return [a - b + 1, sfl(a, b), bnd(a, b), a + b, a, b]
  },
  ceilings: { choice: 3, keypad: 5 },
})

describe('subTo20', () => {
  const tasks = tasksUnderTest(subTo20, 1)

  it('has the 36 V1 differences back over the ten, each with its recorded question', () => {
    const want: string[] = []
    for (let a = 11; a <= 18; a++) for (let b = 2; b <= 9; b++) if (a - b >= 2 && a - b < 10) want.push(`sub:${a}-${b}`)
    expect(subTo20.enumerate().map((f) => f.id).sort()).toEqual(want.sort())
    const order = [...subTo20.enumerate()].sort((x, y) => x.rank - y.rank).map((f) => f.id)
    expect(order[0]).toBe('sub:11-2')
    expect(order[order.length - 1]).toBe('sub:18-9')
    for (const f of subTo20.enumerate()) expect(subTo20.speech(f, 'choice')).toEqual([{ clip: questionClip(f.id) }])
    expect(textOf(tasks.find((t) => t.fact.id === 'sub:13-5')!.task)).toBe('Hvad er tretten minus fem?')
  })

  it('tags the four ideas of pædagogik §3.2, and two at once as ambiguous', () => {
    expect(tagOf('sub:14-6', 9)).toBe('countFromFirst')
    expect(tagOf('sub:14-6', 12)).toBe('smallerFromLarger')
    expect(tagOf('sub:14-6', 18)).toBe('borrowNoDecrement')
    expect(tagOf('sub:14-6', 20)).toBe('wrongOperation')
    expect(tagOf('sub:14-6', 7)).toBe('near')
    expect(tagOf('sub:14-6', 6)).toBe('operand')
    expect(tagOf('sub:13-5', 18)).toBe('ambiguous') // borrowNoDecrement, or 13 + 5
    expect(tagOf('sub:13-8', 15)).toBe('ambiguous') // smallerFromLarger and borrowNoDecrement
    expect(tagOf('sub:11-2', 11)).toBe('ambiguous') // smallerFromLarger, or the 11 repeated (A9)
    expect(tagOf('sub:15-8', 8)).toBe('ambiguous') // counted the start, or the 8 repeated (A9)
  })

  it('can deal "plus instead of minus" as the diagnostic card (range 0–30)', () => {
    const t = buildTask(subTo20, fact('sub:16-9'), 'choice', makeRng(4), 0, { target: ['wrongOperation'] }).task
    expect(t.range).toEqual([0, 30])
    expect(t.options).toContain(25)
    expect(classifyAnswer(t, 25)).toBe('wrongOperation')
  })

  it('teaches "tilbage til 10" with two ten-frames, and says why first for each misconception', () => {
    expect(hintText('sub:13-5', null)).toBe('Gå tilbage til ti først. Tretten minus tre giver ti. Ti minus to giver otte.')
    expect(hintText('sub:11-9', 'near')).toBe('Gå tilbage til ti først. Elleve minus en giver ti. Ti minus otte giver to.')
    expect(subTo20.hint(fact('sub:13-5'), null).visual).toEqual({ scene: 'backToTen', a: 13, b: 5 })
    expect(hintText('sub:13-5', 'smallerFromLarger')).toMatch(/^Der er ikke enere nok\. Tag også af tieren\. Gå tilbage/)
    expect(hintText('sub:13-5', 'borrowNoDecrement')).toMatch(/^Når du tager af tieren, er tieren brugt\. Gå tilbage/)
    expect(hintText('sub:13-5', 'countFromFirst')).toMatch(/^Start på tretten\. Det første hop tilbage lander på tolv\. Gå tilbage/)
    expect(hintText('sub:13-5', 'wrongOperation')).toMatch(/^Minus betyder, at nogle bliver taget væk\. Gå tilbage/)
    expect(subTo20.hint(fact('sub:13-5'), 'smallerFromLarger')).toMatchObject({ misconception: 'smallerFromLarger', animated: true })
    expect(subTo20.hint(fact('sub:13-5'), 'countFromFirst').visual).toEqual({ scene: 'line', min: 0, max: 20, hops: [13, 12, 11, 10, 9, 8] })
  })
})
