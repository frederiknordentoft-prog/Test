import { describe, expect, it } from 'vitest'
import addTo20Module from './addTo20'
import { addsub2Suite, explainSum, idSum, textOf } from './testing/suite'
import { tasksUnderTest } from '../number/testing/harness'
import { classifyAnswer } from '../../misconceptions'
import { questionClip } from '../../../speech/recallQuestions'
import { compile } from '../../../speech/compile'
import type { ErrorTag, Fact, SkillDef } from '../../types'

const addTo20: SkillDef = addTo20Module
const fact = (id: string) => addTo20.enumerate().find((f) => f.id === id)!
const tagOf = (id: string, v: number) => addTo20.candidates(fact(id)).find((c) => c.value === v)?.tag
const hintText = (id: string, tag: ErrorTag | null) => compile(addTo20.hint(fact(id), tag).speech).text
const sum = (f: Fact) => idSum(f.id)

addsub2Suite(addTo20, {
  families: { bridge10: 36 },
  answerOf: (f) => sum(f).a + sum(f).b,
  idFormat: /^add:[2-9]\+[2-9]$/,
  explain: (f, v) => explainSum('addTo20', f.family, sum(f).a, '+', sum(f).b, v),
  formulaValues: (f) => {
    const { a, b } = sum(f)
    return [a + b - 1, a + b - 10, Math.abs(a - b), a, b]
  },
  ceilings: { choice: 3, keypad: 5, numberline: 5 },
  swaps: true,
})

describe('addTo20', () => {
  const tasks = tasksUnderTest(addTo20, 1)

  it('has the 36 V1 sums over the ten, 9 + 2 first, each with its recorded question', () => {
    const want: string[] = []
    for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) if (a + b > 10) want.push(`add:${a}+${b}`)
    expect(addTo20.enumerate().map((f) => f.id).sort()).toEqual(want.sort())
    const order = [...addTo20.enumerate()].sort((x, y) => x.rank - y.rank).map((f) => f.id)
    expect(order.slice(0, 2)).toEqual(['add:9+2', 'add:2+9'])
    expect(order.indexOf('add:9+5')).toBeLessThan(order.indexOf('add:6+5'))
    for (const f of addTo20.enumerate()) expect(addTo20.speech(f, 'keypad')).toEqual([{ clip: questionClip(f.id) }])
    expect(textOf(tasks.find((t) => t.fact.id === 'add:8+5')!.task)).toBe('Hvad er otte plus fem?')
  })

  it('tags counting the start, the forgotten ten, the other operation, the numbers asked and near misses', () => {
    expect(tagOf('add:8+6', 13)).toBe('countFromFirst')
    expect(tagOf('add:8+6', 4)).toBe('forgotCarry')
    expect(tagOf('add:9+4', 5)).toBe('wrongOperation')
    expect(tagOf('add:8+5', 8)).toBe('operand')
    expect(tagOf('add:8+5', 14)).toBe('near')
    // two explanations: never evidence (SPEC §4.1, A9)
    expect(tagOf('add:8+5', 3)).toBe('ambiguous') // forgot the ten, or 8 − 5 (pædagogik's own example)
    expect(tagOf('add:7+5', 2)).toBe('ambiguous') // forgot the ten, or 7 − 5
    expect(tagOf('add:8+4', 4)).toBe('ambiguous') // 8 − 4, or the 4 repeated
    expect(tagOf('add:6+5', 1)).toBe('ambiguous') // forgot the ten, or 6 − 5
  })

  it('classifies typed answers on the keypad and pins on the line alike', () => {
    for (const kind of ['keypad', 'numberline'] as const) {
      const t = tasks.find((x) => x.fact.id === 'add:8+6' && x.kind === kind)!.task
      expect(t.tolerance).toBe(0)
      expect(classifyAnswer(t, 4)).toBe('forgotCarry')
      expect(classifyAnswer(t, 13)).toBe('countFromFirst')
      expect(classifyAnswer(t, 2)).toBe('wrongOperation')
      expect(classifyAnswer(t, 5)).toBe('other')
      expect(classifyAnswer(t, 14)).toBeNull()
    }
  })

  it('teaches "fyld op til 10" with two ten-frames', () => {
    expect(hintText('add:8+5', null)).toBe('Fyld tieren op først. Otte og to giver ti. Ti og tre giver tretten.')
    expect(hintText('add:5+8', 'near')).toBe('Fyld tieren op først. Otte og to giver ti. Ti og tre giver tretten.')
    expect(hintText('add:9+9', null)).toBe('Fyld tieren op først. Ni og en giver ti. Ti og otte giver atten.')
    expect(addTo20.hint(fact('add:5+8'), null).visual).toEqual({ scene: 'makeTen', a: 8, b: 5 })
    expect(hintText('add:8+5', 'forgotCarry')).toBe('Når tieren er fuld, skal den med i svaret. Fyld tieren op først. Otte og to giver ti. Ti og tre giver tretten.')
    expect(addTo20.hint(fact('add:8+5'), 'forgotCarry')).toMatchObject({ misconception: 'forgotCarry', animated: true })
    expect(hintText('add:8+5', 'countFromFirst')).toMatch(/^Start på otte\. Det første hop lander på ni\. Fyld tieren op først\./)
    expect(addTo20.hint(fact('add:8+5'), 'countFromFirst').visual).toEqual({ scene: 'line', min: 0, max: 20, hops: [8, 9, 10, 11, 12, 13] })
    expect(hintText('add:8+5', 'wrongOperation')).toMatch(/^Plus betyder, at der kommer flere til\. Fyld tieren op først\./)
  })
})
