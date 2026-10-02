import { describe, expect, it } from 'vitest'
import { isCorrect } from '../../../engine/answer'
import { classifyAnswer } from '../../../engine/misconceptions'
import type { Task } from '../../../engine/types'
import { EXAMPLES } from '../../../dev/tasks/examples'
import { SHARE_UNEQUAL, canShare, countsOf, nextFromPile, rememberDeal, rememberedDeal, shareOwnsPrompt, shareSetup, shareValue } from './logic'

const ex = (id: string): Task => {
  const e = Object.values(EXAMPLES).flat().find((x) => x.id === id)
  if (!e) throw new Error(id)
  return e.task
}
const twelve = ex('share-12-3') // 12 carrots on 3 plates: 4 each

describe('the deal', () => {
  it('comes from the share scene, or from "a : b" (carrots on plates)', () => {
    expect(shareSetup(twelve)).toEqual({ total: 12, plates: 3, thing: 'carrot' })
    const eq: Task = { ...twelve, prompt: { scene: 'equation', terms: [{ n: 15 }, { op: ':' }, { n: 5 }, { op: '=' }, { blank: true }] } }
    expect(shareSetup(eq)).toEqual({ total: 15, plates: 5, thing: 'carrot' })
    expect(shareOwnsPrompt(twelve)).toBe(true)
    expect(shareOwnsPrompt(eq)).toBe(false)
  })

  it('is not dealt one by one when there is nothing to share, one plate, or too much', () => {
    const scene = (total: number, recipients: number): Task => ({ ...twelve, prompt: { scene: 'share', total, recipients, thing: 'apple' } })
    expect(shareSetup(scene(12, 1))).toBeNull()
    expect(shareSetup(scene(0, 3))).toBeNull()
    expect(shareSetup(scene(60, 6))).toBeNull()
    expect(shareSetup(scene(20, 11))).toBeNull()
    expect(shareSetup({ ...twelve, prompt: { scene: 'hear' } })).toBeNull()
    expect(canShare(scene(60, 6))).toBe(false)
    expect(canShare(twelve)).toBe(true)
    expect(canShare({ ...twelve, answer: 'frac:1/2' })).toBe(false)
  })

  it('takes the next thing from the end of the pile', () => {
    expect(nextFromPile([0, 1, 5])).toBe(5)
    expect(nextFromPile([])).toBeNull()
  })
})

describe('what the plates hand in', () => {
  it('is the count each plate got when the deal is even — right when it is the task’s answer', () => {
    expect(shareValue(twelve, [4, 4, 4])).toBe(4)
    expect(isCorrect(twelve, shareValue(twelve, [4, 4, 4]))).toBe(true)
    expect(classifyAnswer(twelve, 4)).toBeNull()
  })

  it('is −1 for an uneven deal, which the engine recognises as shareUnequal', () => {
    for (const counts of [[5, 4, 3], [12, 0, 0], [4, 4, 3, 1]]) {
      const v = shareValue(twelve, counts)
      expect(v).toBe(SHARE_UNEQUAL)
      expect(isCorrect(twelve, v)).toBe(false)
      expect(classifyAnswer(twelve, v)).toBe('shareUnequal')
    }
  })

  it('is the counts as a set, largest first, when the task asks for the deal itself', () => {
    const asSet: Task = { ...twelve, answer: '4|4|4', answerType: 'set' }
    expect(shareValue(asSet, [4, 4, 4])).toBe('4|4|4')
    expect(shareValue(asSet, [3, 5, 4])).toBe('5|4|3')
    expect(isCorrect(asSet, shareValue(asSet, [4, 4, 4]))).toBe(true)
    expect(isCorrect(asSet, shareValue(asSet, [3, 5, 4]))).toBe(false)
  })

  it('pictures an answer as equal plates (the confirm button), or the remembered deal', () => {
    expect(countsOf(twelve, 4)).toEqual([4, 4, 4])
    expect(countsOf(twelve, -1)).toBeNull()
    expect(countsOf(twelve, '5|4|3')).toEqual([5, 4, 3])
    rememberDeal(twelve.id, -1, [5, 4, 3])
    expect(rememberedDeal(twelve.id, -1)).toEqual([5, 4, 3])
    expect(rememberedDeal('other', -1)).toBeNull()
  })

  it('answers every harness example right with an even deal and wrong with an uneven one', () => {
    for (const e of EXAMPLES.share) {
      const t = e.task
      const s = shareSetup(t)!
      const even = Array.from({ length: s.plates }, () => s.total / s.plates)
      const uneven = [s.total, ...Array.from({ length: s.plates - 1 }, () => 0)]
      expect(isCorrect(t, shareValue(t, even)), e.id).toBe(true)
      expect(isCorrect(t, shareValue(t, uneven)), e.id).toBe(false)
      expect(shareValue(t, uneven)).toBe(e.wrong)
    }
  })
})
