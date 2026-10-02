import { describe, expect, it } from 'vitest'
import { isCorrect } from '../../../engine/answer'
import { fewestPieces as engineFewest } from '../../../engine/kinds'
import type { Task } from '../../../engine/types'
import { EXAMPLES } from '../../../dev/tasks/examples'
import {
  amountOf, canPay, fewestPieces, groupPieces, payValue, pieceOfToken, piecesOf, piecesOfSet, purseOf, rememberTray,
  rememberedTray,
} from './logic'

const ex = (id: string): Task => {
  const e = Object.values(EXAMPLES).flat().find((x) => x.id === id)
  if (!e) throw new Error(id)
  return e.task
}
const pay17 = ex('pay-17') // 17 kr, answer in øre
const fewest = ex('pay-fewest') // 27 kr as the fewest coins: 'c2000|c500|c200'

describe('the purse', () => {
  it('holds the shop’s coins and notes, each once, largest first; anything else is left out', () => {
    expect(purseOf(pay17)).toEqual([2000, 1000, 500, 200, 100])
    expect(purseOf({ ...pay17, prompt: { scene: 'shop', thing: 'apple', priceOre: 1700, purse: [100, 2000, 100, 300, 5000, 100000] } })).toEqual([5000, 2000, 100])
    expect(purseOf(ex('pay-75'))).toEqual([10000, 5000, 2000, 1000, 500, 200, 100])
  })

  it('without a shop: the coins (50 øre only when the amount has øre) and the notes up to the amount', () => {
    const amount = (ore: number) => ({ answer: ore, prompt: { scene: 'amount' as const, ore } })
    expect(purseOf(amount(1700))).toEqual([2000, 1000, 500, 200, 100])
    expect(purseOf(amount(1250))).toEqual([2000, 1000, 500, 200, 100, 50])
    expect(purseOf(amount(12000))).toEqual([10000, 5000, 2000, 1000, 500, 200, 100])
  })

  it('knows the amount a task asks for', () => {
    expect(amountOf(pay17)).toBe(1700)
    expect(amountOf(fewest)).toBe(2700)
  })
})

describe('what the tray hands in', () => {
  it('is the sum in øre when the task asks for an amount: any exact payment is right', () => {
    expect(payValue(pay17, [1000, 500, 200])).toBe(1700)
    expect(isCorrect(pay17, payValue(pay17, [1000, 500, 200]))).toBe(true)
    expect(isCorrect(pay17, payValue(pay17, [500, 500, 500, 200]))).toBe(true)
    expect(isCorrect(pay17, payValue(pay17, [1000, 500, 100]))).toBe(false)
  })

  it('is the coins themselves, largest first, when the task asks for the coins (fewestCoins)', () => {
    expect(payValue(fewest, [200, 2000, 500])).toBe('c2000|c500|c200')
    expect(payValue(fewest, [500, 200, 2000])).toBe('c2000|c500|c200')
  })

  it('compares coins as a multiset: the order never matters, the coins do', () => {
    // laid in any order, the same coins are right
    expect(isCorrect(fewest, payValue(fewest, [200, 500, 2000]))).toBe(true)
    // the engine also takes a coin set in another order (src/engine/answer.ts)
    expect(isCorrect(fewest, 'c200|c2000|c500')).toBe(true)
    // the same sum in more coins is not the fewest coins
    expect(isCorrect(fewest, payValue(fewest, [1000, 1000, 500, 200]))).toBe(false)
    // one coin too many, or one missing
    expect(isCorrect(fewest, payValue(fewest, [2000, 500, 200, 200]))).toBe(false)
    expect(isCorrect(fewest, payValue(fewest, [2000, 500]))).toBe(false)
    // two of a kind count twice
    expect(isCorrect({ ...fewest, answer: 'c1000|c1000' }, payValue(fewest, [1000, 1000]))).toBe(true)
    expect(isCorrect({ ...fewest, answer: 'c1000|c1000' }, payValue(fewest, [1000]))).toBe(false)
  })

  it('answers every harness example right with its answer and wrong with its wrong answer', () => {
    for (const e of EXAMPLES.pay) {
      const t = e.task
      expect(canPay(t), e.id).toBe(true)
      expect(isCorrect(t, payValue(t, piecesOf(t, t.answer))), e.id).toBe(true)
      expect(isCorrect(t, payValue(t, piecesOf(t, e.wrong))), e.id).toBe(false)
    }
  })
})

describe('coins and notes', () => {
  it('reads and writes the tokens', () => {
    expect(pieceOfToken('c2000')).toBe(2000)
    expect(pieceOfToken('c5000')).toBe(5000)
    expect(pieceOfToken('c300')).toBeNull()
    expect(pieceOfToken('2000')).toBeNull()
    expect(piecesOfSet('c2000|c500|c200|cx')).toEqual([2000, 500, 200])
  })

  it('pays an amount in the fewest pieces the purse has — exactly, not greedily', () => {
    expect(fewestPieces(2700, [2000, 1000, 500, 200, 100])).toEqual([2000, 500, 200])
    expect(fewestPieces(600, [500, 200])).toEqual([200, 200, 200])
    expect(fewestPieces(1250, [1000, 200, 50])).toEqual([1000, 200, 50])
    expect(fewestPieces(50, [100, 200])).toBeNull()
    expect(fewestPieces(0, [100])).toEqual([])
    expect(fewestPieces(30, [100])).toBeNull()
    // the same count as the engine's speed rule (fewestPieces in src/engine/kinds.ts)
    for (const ore of [50, 150, 1700, 2700, 4950, 8850, 18800]) {
      expect(fewestPieces(ore, [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50])?.length).toBe(engineFewest(ore))
    }
  })

  it('pictures an answer: an amount as its fewest pieces, a coin set as it is', () => {
    expect(piecesOf(pay17, 1700)).toEqual([1000, 500, 200])
    expect(piecesOf(fewest, 'c500|c2000|c200')).toEqual([2000, 500, 200])
    expect(groupPieces([200, 1000, 200, 5000])).toEqual([{ piece: 5000, n: 1 }, { piece: 1000, n: 1 }, { piece: 200, n: 2 }])
  })

  it('cannot pay what the purse cannot make, nor a coin set with unknown coins', () => {
    expect(canPay({ ...pay17, answer: 1750 })).toBe(false)
    expect(canPay({ ...fewest, answer: 'c2000|c300' })).toBe(false)
    expect(canPay({ ...pay17, answer: 0 })).toBe(false)
  })

  it('remembers the child’s own tray for the struck answer (the last few tasks only)', () => {
    rememberTray('t1', 1600, [1000, 500, 100])
    expect(rememberedTray('t1', 1600)).toEqual([1000, 500, 100])
    expect(rememberedTray('t1', 1700)).toBeNull()
    for (let i = 0; i < 10; i++) rememberTray(`x${i}`, i, [100])
    expect(rememberedTray('t1', 1600)).toBeNull()
    expect(rememberedTray('x9', 9)).toEqual([100])
  })
})
