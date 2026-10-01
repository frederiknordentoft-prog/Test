import { describe, expect, it } from 'vitest'
import { isCorrect } from '../../engine/answer'
import { toDanishText } from '../../speech/compile'
import type { Task } from '../../engine/types'
import { EXAMPLES } from '../../dev/tasks/examples'
import {
  answerSpeech, baseKinds, baseValue, confirmSpeech, formatMoney, formatNumber, hasBlank, keypadPress, keypadValue,
  lineRange, lineRatio, lineValue, orderValue, pairSum, setValue, slotsValue, splitTokens, supplyCount,
} from './answers'

const all = Object.values(EXAMPLES).flat()
const ex = (id: string): Task => {
  const e = all.find((x) => x.id === id)
  if (!e) throw new Error(id)
  return e.task
}
const withTask = (over: Partial<Task>): Task => ({ ...ex('choice-8+5'), ...over })

describe('tokens', () => {
  it('splits sets and sequences, numbers back to numbers', () => {
    expect(splitTokens('s0|s3|s5')).toEqual(['s0', 's3', 's5'])
    expect(splitTokens('3|7|12')).toEqual([3, 7, 12])
    expect(splitTokens(4)).toEqual([4])
    expect(splitTokens('')).toEqual([])
  })

  it('serialises a selection in whatever order the skill used', () => {
    const shapes = ex('multi-triangles')
    // the child taps in any order; the skill listed the items in option order
    expect(setValue(['s5', 's1', 's4'], shapes)).toBe(shapes.answer)
    // natural order (s2 before s10) when that is how the skill wrote it
    const natural = withTask({ kind: 'multiSelect', options: ['s10', 's2', 's1'], answer: 's2|s10', answerType: 'set' })
    expect(setValue(['s10', 's2'], natural)).toBe('s2|s10')
    // a wrong selection is reported in natural order
    expect(setValue(['s10', 's1'], natural)).toBe('s1|s10')
  })

  it('keeps order for sortOrder and needs every slot for fillSlots', () => {
    expect(orderValue([5, 8, 12, 19])).toBe('5|8|12|19')
    expect(orderValue(['obj:ribbon', 'obj:brush'])).toBe('obj:ribbon|obj:brush')
    expect(slotsValue(['pat:red', null])).toBeNull()
    expect(slotsValue([])).toBeNull()
    expect(slotsValue(['pat:red', 'pat:blue'])).toBe('pat:red|pat:blue')
    expect(slotsValue([3, 4])).toBe('3|4')
  })
})

describe('numbers', () => {
  it('types digits within maxDigits; a lone 0 is replaced; delete removes the last', () => {
    const t = { maxDigits: 2 }
    expect(keypadPress('', '7', t)).toBe('7')
    expect(keypadPress('7', '3', t)).toBe('73')
    expect(keypadPress('73', '1', t)).toBe('73')
    expect(keypadPress('0', '5', t)).toBe('5')
    expect(keypadPress('73', 'del', t)).toBe('7')
    expect(keypadPress('', 'x', t)).toBe('')
  })

  it('sends kroner as øre on whole-krone money tasks', () => {
    expect(keypadValue('17', { entryScale: 100 })).toBe(1700)
    expect(keypadValue('17', { entryScale: 1 })).toBe(17)
    expect(keypadValue('', { entryScale: 1 })).toBeNull()
  })

  it('counts blocks as they lie, without regrouping', () => {
    expect(baseValue({ h: 2, t: 0, o: 5 })).toBe(205)
    expect(baseValue({ h: 0, t: 1, o: 12 })).toBe(22)
    expect(baseKinds(ex('base-34'))).toEqual(['rod', 'unit'])
    expect(baseKinds(ex('base-205'))).toEqual(['flat', 'rod', 'unit'])
  })

  it('maps the number line both ways and clamps', () => {
    expect(lineValue(0.37, 0, 100)).toBe(37)
    expect(lineValue(-1, 0, 100)).toBe(0)
    expect(lineValue(2, 0, 1000)).toBe(1000)
    expect(lineRatio(600, 0, 1000)).toBeCloseTo(0.6)
    expect(lineRange(ex('line-37'))).toEqual([0, 100])
    expect(lineRange(withTask({ prompt: { scene: 'hear' }, range: [0, 20] }))).toEqual([0, 20])
  })

  it('finds the given number and the total of a pair task', () => {
    expect(pairSum(ex('pair-3'))).toEqual({ anchor: 3, total: 10 })
    expect(pairSum(withTask({ prompt: { scene: 'equation', terms: [{ n: 4 }, { op: '+' }, { blank: true }, { op: '=' }, { n: 10 }] } }))).toEqual({ anchor: 4, total: 10 })
  })

  it('takes the countTap pile from the prompt (SK1) and makes one otherwise', () => {
    expect(supplyCount(ex('count-7'))).toBe(12)
    expect(supplyCount(ex('count-14'))).toBe(24)
    const bare = withTask({ kind: 'countTap', prompt: { scene: 'hear' }, answer: 7, range: [0, 10] })
    expect(supplyCount(bare)).toBeGreaterThan(7)
  })

  it('knows which prompts have a blank to type into', () => {
    expect(hasBlank(ex('keypad-38+45').prompt)).toBe(true)
    expect(hasBlank({ scene: 'balance', left: [{ n: 4 }, { op: '+' }, { blank: true }], right: [{ n: 7 }] })).toBe(true)
    expect(hasBlank({ scene: 'hear' })).toBe(false)
  })

  it('writes numbers and money the house way', () => {
    expect(formatNumber(-3)).toBe('−3')
    expect(formatNumber(9999)).toBe('9999')
    expect(formatMoney(1250)).toBe('12,50 kr.')
    expect(formatMoney(1700)).toBe('17 kr.')
  })
})

describe('every kind sends an answer its task accepts', () => {
  /** What the right interaction on each view produces, built with the views' own helpers. */
  function rightAnswer(t: Task) {
    switch (t.kind) {
      case 'keypad':
        return keypadValue(String((t.answer as number) / t.entryScale), t)
      case 'countTap':
      case 'buildBase':
        return t.answer
      case 'numberline': {
        const [min, max] = lineRange(t)
        return lineValue(lineRatio(t.answer as number, min, max), min, max)
      }
      case 'sortOrder':
        return orderValue(splitTokens(t.answer))
      case 'multiSelect':
        return setValue([...splitTokens(t.answer)].reverse(), t)
      case 'fillSlots':
        return slotsValue(splitTokens(t.answer))
      default:
        return t.answer
    }
  }
  for (const e of all) {
    it(`${e.task.kind}: ${e.title}`, () => {
      const v = rightAnswer(e.task)
      expect(v).not.toBeNull()
      expect(isCorrect(e.task, v!)).toBe(true)
      expect(isCorrect(e.task, e.wrong)).toBe(false)
    })
  }
})

describe('the confirm button speaks the right answer', () => {
  it('reads numbers, money, clocks, units, shapes and yes/no', () => {
    expect(toDanishText(confirmSpeech(ex('choice-8+5')))).toBe('Tryk på tretten.')
    expect(toDanishText(confirmSpeech(ex('keypad-kr')))).toBe('Tryk på sytten kroner.')
    expect(answerSpeech(ex('choice-clock'), 180)).toEqual([{ clock: { minutes: 180, style: 'analog', form: 'end' } }])
    expect(answerSpeech(ex('choice-unit'), 'unit:cm')).toEqual([{ clip: 'noun.unit.cm.end' }])
    expect(answerSpeech(ex('choice-shape'), 'shape:triangle:1')).toEqual([{ clip: 'noun.shape.triangle.indef.end' }])
    expect(answerSpeech(ex('tf-balance'), 'yes')).toEqual([{ clip: 's.ui.yes' }])
  })

  it('says "Tryk her" when an answer has no short spoken form', () => {
    expect(answerSpeech(ex('sort-numbers'), '5|8|12|19')).toBeNull()
    expect(confirmSpeech(ex('multi-triangles'))).toEqual([{ clip: 's.round.tapHere' }])
  })
})
