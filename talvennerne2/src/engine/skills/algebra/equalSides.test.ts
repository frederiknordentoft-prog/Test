import { describe, expect, it } from 'vitest'
import equalSidesModule from './equalSides'
import { algebra2Suite, explainBy, findFact, hintText, taskOf, textOf } from './testing/suite'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { factsUnderTest } from '../number/testing/harness'
import type { AnswerValue, Fact, MisconceptionId, SkillDef } from '../../types'

const def: SkillDef = equalSidesModule

/** A side as written in the id ("8+4", "_-3", "9"), worked out with the probe set to `probe`. */
function side(text: string, probe: number): number {
  const m = /^(\d+)(?:([+-])(\d+))?$/.exec(text.replace('_', String(probe)))!
  if (!m[2]) return Number(m[1])
  return m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3])
}

/** The instance read independently of the module (the probe found by trying every value). */
function read(f: Pick<Fact, 'id'>) {
  const m = /^eqs:(tf|add|sub|mix):([^=]+)=([^:]+):(\d+)$/.exec(f.id)!
  const [left, right, shown] = [m[2], m[3], Number(m[4])]
  let x = -1
  for (let v = 0; v <= 40 && x < 0; v++) if (side(left, v) === side(right, v)) x = v
  const nums = (s: string) => s.split(/[+-]/).filter((t) => t !== '_').map(Number)
  const full = left.includes('_') ? right : left
  const part = left.includes('_') ? left : right
  const v = side(full, 0)
  const formulas: [MisconceptionId, number | null][] = [['equalsAsAnswer', v]]
  const carried = /^_\+(\d+)$/.exec(part) ?? /^(\d+)\+_$/.exec(part)
  if (carried) formulas.push(['equalsAsAnswer', v + Number(carried[1])])
  const back = /^_-(\d+)$/.exec(part)
  if (back) formulas.push(['equalsAsAnswer', v - Number(back[1])])
  const truth = side(left, shown) === side(right, shown) ? 'yes' : 'no'
  // a child who reads = as "the answer comes now": the first number after = must be the left side's result
  const l = left.replace('_', String(shown))
  const r = right.replace('_', String(shown))
  const reader = /[+-]/.test(l) ? (Number(r.split(/[+-]/)[0]) === side(l, 0) ? 'yes' : 'no') : /[+-]/.test(r) ? 'no' : l === r ? 'yes' : 'no'
  return { x, shown, shownNums: [...nums(left), ...nums(right)], formulas, truth, reader }
}

algebra2Suite(def, {
  families: { trueFalse: 20, balanceAdd: 20, balanceSub: 20, balanceMixed: 20 },
  answerOf: (f, kind) => (kind === 'trueFalse' ? read(f).truth : read(f).x),
  idFormat: /^eqs:(tf|add|sub|mix):(\d+|_)([+-](\d+|_))?=(\d+|_)([+-](\d+|_))?:\d+$/,
  explain: (f, value: AnswerValue) => {
    const r = read(f)
    if (typeof value === 'string') return { mis: value !== r.truth && value === r.reader ? ['equalsAsAnswer'] : [], operand: false }
    return explainBy(value, r.x, r.formulas, r.shownNums)
  },
  formulaValues: (f) => {
    const r = read(f)
    return [...r.formulas.map(([, v]) => v).filter((v): v is number => v !== null && v >= 0), ...r.shownNums, 'yes', 'no']
  },
  ceilings: { trueFalse: 2, choice: 3, keypad: 5 },
})

describe('equalSides', () => {
  it('has one probe, a true equation with numbers to 20, and the families of SPEC §2.2', () => {
    for (const f of factsUnderTest(def)) {
      const r = read(f)
      expect((f.id.match(/_/g) ?? []).length, f.id).toBe(1)
      expect(r.x, f.id).toBeGreaterThanOrEqual(0)
      expect(Math.max(...r.shownNums, r.x, r.shown), f.id).toBeLessThanOrEqual(20)
      const signs = f.id.replace(/:\d+$/, '').match(/[+-]/g) ?? []
      if (f.family === 'balanceAdd') expect(signs, f.id).toEqual(['+', '+'])
      if (f.family === 'balanceSub') expect(signs, f.id).toEqual(['-', '-'])
      if (f.family === 'balanceMixed') expect([...signs].sort(), f.id).toEqual(['+', '-'])
    }
  })

  it('asks for the probe on the seesaw, or whether both sides weigh the same', () => {
    const t = taskOf(def, 'eqs:add:8+4=_+5:7', 'keypad')
    expect(textOf(t)).toBe('Otte plus fire er lig med hvad plus fem?')
    expect(t.prompt).toEqual({ scene: 'balance', left: [{ n: 8 }, { op: '+' }, { n: 4 }], right: [{ blank: true }, { op: '+' }, { n: 5 }] })
    expect(t.answer).toBe(7)
    expect(textOf(taskOf(def, 'eqs:tf:7+2=9+_:2', 'keypad'))).toBe('Syv plus to er lig med ni plus hvad?')
    const tf = taskOf(def, 'eqs:add:8+4=_+5:12', 'trueFalse')
    expect(textOf(tf)).toBe('Otte plus fire er lig med tolv plus fem. Er der lige meget på begge sider?')
    expect([tf.answer, tf.answerType, tf.optionView, tf.options]).toEqual(['no', 'token', 'yesNo', ['yes', 'no']])
  })

  it('reads "= means the answer comes now" as equalsAsAnswer: 12 or 17 for 8 + 4 = □ + 5 (A9 on the card)', () => {
    const t = taskOf(def, 'eqs:add:8+4=_+5:7', 'keypad')
    expect(classifyAnswer(t, 12)).toBe('equalsAsAnswer')
    expect(classifyAnswer(t, 17)).toBe('equalsAsAnswer')
    expect(classifyAnswer(t, 8)).toBe('operand')
    expect(detectableOf(t)).toEqual(['equalsAsAnswer'])
    const trap = taskOf(def, 'eqs:tf:7+2=9+_:2', 'keypad')
    expect(trap.answer).toBe(0)
    expect(classifyAnswer(trap, 9)).toBe('ambiguous') // the left side's result, or the 9 on the card
    expect(classifyAnswer(trap, 18)).toBe('equalsAsAnswer')
    expect(classifyAnswer(taskOf(def, 'eqs:add:8+4=_+5:12', 'trueFalse'), 'yes')).toBe('equalsAsAnswer')
    expect(classifyAnswer(taskOf(def, 'eqs:tf:7+2=9+_:2', 'trueFalse'), 'yes')).toBe('equalsAsAnswer')
    expect(classifyAnswer(taskOf(def, 'eqs:tf:_=7+2:9', 'trueFalse'), 'no')).toBe('equalsAsAnswer')
  })

  it('works out the whole side first; on true/false it compares both sides', () => {
    expect(hintText(def, 'eqs:add:8+4=_+5:7', null))
      .toBe('Regn først den side ud, hvor der ikke mangler noget. Otte plus fire giver tolv. Den anden side skal også give tolv. Tolv minus fem giver syv.')
    expect(hintText(def, 'eqs:add:8+4=_+5:12', null, 'trueFalse')).toBe('Otte plus fire giver tolv. Tolv plus fem giver sytten. Siderne giver ikke det samme.')
    expect(hintText(def, 'eqs:add:8+4=_+5:12', 'equalsAsAnswer', 'trueFalse')).toMatch(/^Lighedstegnet betyder: det samme på begge sider\. Otte plus fire/)
    const h = def.hint(findFact(def, 'eqs:add:8+4=_+5:7'), 'equalsAsAnswer', 'keypad')
    expect(h).toMatchObject({ misconception: 'equalsAsAnswer', animated: true, visual: { scene: 'balance', right: [{ n: 7 }, { op: '+' }, { n: 5 }] } })
  })
})

describe('equalSides speech', () => {
  it('reads a plain sum as a question, and a blank first or last as "hvad"', () => {
    expect(textOf(taskOf(def, 'eqs:tf:7+2=_:9', 'keypad'))).toBe('Hvad er syv plus to?')
    expect(textOf(taskOf(def, 'eqs:tf:_=7+2:9', 'keypad'))).toBe('Hvad er lig med syv plus to?')
    expect(textOf(taskOf(def, 'eqs:add:_+5=8+4:7', 'keypad'))).toBe('Hvad plus fem er lig med otte plus fire?')
  })
})
