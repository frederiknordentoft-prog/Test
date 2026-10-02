import { describe, expect, it } from 'vitest'
import inverseOpsModule from './inverseOps'
import { algebra2Suite, explainBy, findFact, hintText, taskOf, textOf } from './testing/suite'
import { classifyAnswer } from '../../misconceptions'
import { factsUnderTest } from '../number/testing/harness'
import type { AnswerValue, Fact, MisconceptionId, SkillDef } from '../../types'

const def: SkillDef = inverseOpsModule

/** The instance read independently of the module: answer, numbers on the card, wrong operations. */
function read(f: Pick<Fact, 'id'>): { x: number; shown: number[]; formulas: [MisconceptionId, number][] } {
  let m = /^inv:(\d+)\+(\d+):(\d+)-(\d+)$/.exec(f.id)
  if (m) {
    const [a, b, c, s] = m.slice(1).map(Number)
    return { x: c - s, shown: [a, b, c, s], formulas: [['wrongOperation', c + s]] }
  }
  if ((m = /^inv:(\d+)-(\d+):(\d+)\+(\d+)$/.exec(f.id))) {
    const [c, b, p, q] = m.slice(1).map(Number)
    return { x: p + q, shown: [c, b, c - b, p, q], formulas: [['wrongOperation', Math.abs(p - q)]] }
  }
  m = /^inv:(\d+)x(\d+):(\d+)\/(\d+)$/.exec(f.id)!
  const [a, b, c, s] = m.slice(1).map(Number)
  return { x: c / s, shown: [a, b, c, s], formulas: [['wrongOperation', c * s], ['wrongOperation', c - s]] }
}

algebra2Suite(def, {
  families: { addToSub: 20, subToAdd: 20, mulToDiv: 20 },
  answerOf: (f) => read(f).x,
  idFormat: /^inv:(\d+\+\d+:\d+-\d+|\d+-\d+:\d+\+\d+|\d+x\d+:\d+\/\d+)$/,
  explain: (f, v: AnswerValue) => {
    const r = read(f)
    return explainBy(v, r.x, r.formulas, r.shown)
  },
  formulaValues: (f) => {
    const r = read(f)
    return [...r.formulas.map(([, v]) => v), ...r.shown]
  },
  ceilings: { choice: 3, keypad: 5 },
})

describe('inverseOps', () => {
  it('asks the other member of a true number family', () => {
    for (const f of factsUnderTest(def)) {
      const m = /^inv:(\d+)([+\-x])(\d+):(\d+)([+\-/])(\d+)$/.exec(f.id)!
      const [a, b, c, s] = [m[1], m[3], m[4], m[6]].map(Number)
      if (m[2] === '+') expect([a + b === c, s === a || s === b, m[5]], f.id).toEqual([true, true, '-'])
      if (m[2] === '-') expect([[c, s].sort().join(), m[5]], f.id).toEqual([[a - b, b].sort().join(), '+'])
      if (m[2] === 'x') expect([a * b === c, s === a || s === b, m[5]], f.id).toEqual([true, true, '/'])
    }
  })

  it('shows both equations and reads the known one, then the question', () => {
    const t = taskOf(def, 'inv:7+5:12-5', 'keypad')
    expect(textOf(t)).toBe('Syv plus fem giver tolv. Hvad er tolv minus fem?')
    expect(t.prompt).toEqual({
      scene: 'equation',
      terms: [{ n: 7 }, { op: '+' }, { n: 5 }, { op: '=' }, { n: 12 }, { text: 'frag.inverseOps.so' }, { n: 12 }, { op: '−' }, { n: 5 }, { op: '=' }, { blank: true }],
    })
    expect(textOf(taskOf(def, 'inv:12-5:7+5', 'keypad'))).toBe('Tolv minus fem giver syv. Hvad er syv plus fem?')
    expect(textOf(taskOf(def, 'inv:3x4:12/4', 'keypad'))).toBe('Tre gange fire giver tolv. Hvad er tolv delt med fire?')
  })

  it('reads the other operation as wrongOperation, a number on the card as operand (A9)', () => {
    expect(classifyAnswer(taskOf(def, 'inv:7+5:12-5', 'keypad'), 17)).toBe('wrongOperation')
    expect(classifyAnswer(taskOf(def, 'inv:7+5:12-5', 'keypad'), 12)).toBe('operand')
    expect(classifyAnswer(taskOf(def, 'inv:12-5:7+5', 'keypad'), 2)).toBe('wrongOperation')
    expect(classifyAnswer(taskOf(def, 'inv:12-4:8+4', 'keypad'), 4)).toBe('ambiguous')
    expect(classifyAnswer(taskOf(def, 'inv:3x4:12/4', 'keypad'), 48)).toBe('wrongOperation')
    expect(classifyAnswer(taskOf(def, 'inv:3x4:12/4', 'keypad'), 8)).toBe('wrongOperation')
  })

  it('names the family in the hint, and the operation first for wrongOperation', () => {
    expect(hintText(def, 'inv:7+5:12-5', null)).toBe('Plus og minus hører sammen. Syv plus fem giver tolv. Så giver tolv minus fem syv.')
    expect(hintText(def, 'inv:12-5:7+5', null)).toBe('Plus og minus hører sammen. Tolv minus fem giver syv. Så giver syv plus fem tolv.')
    expect(hintText(def, 'inv:3x4:12/4', null)).toBe('Gange og delt med hører sammen. Tre gange fire giver tolv. Så giver tolv delt med fire tre.')
    expect(hintText(def, 'inv:7+5:12-5', 'wrongOperation')).toMatch(/^Minus betyder, at nogle bliver taget væk\. Plus og minus/)
    expect(def.hint(findFact(def, 'inv:3x4:12/4'), null).visual).toEqual({ scene: 'array', rows: 3, cols: 4 })
  })
})
