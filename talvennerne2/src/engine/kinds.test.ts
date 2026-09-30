import { describe, expect, it } from 'vitest'
import { ceilingFor, defaultFastMs, fewestPieces, guessP, isProduction } from './kinds'
import { isCorrect } from './answer'
import { buildAddTask } from './testing/addFacts'
import { makeRng } from './rng'
import type { Task } from './types'

const base = buildAddTask({ id: 'add:3+4', a: 3, b: 4, answer: 7, rank: 7 }, 'keypad', makeRng(1), 0)
const task = (over: Partial<Task>): Task => ({ ...base, ...over })

describe('guess rate, production and ceiling (SPEC §3.3)', () => {
  it('treats three cards as guessable up to box 3', () => {
    const t = task({ kind: 'choice', options: [6, 7, 8] })
    expect(guessP(t)).toBeCloseTo(1 / 3)
    expect(isProduction(t)).toBe(false)
    expect(ceilingFor(t)).toBe(3)
  })

  it('stops a true/false task at box 2', () => {
    const t = task({ kind: 'trueFalse', options: ['yes', 'no'], answer: 'yes', answerType: 'token' })
    expect(ceilingFor(t)).toBe(2)
  })

  it('counts a keypad answer as production', () => {
    expect(isProduction(task({ kind: 'keypad', range: [0, 20] }))).toBe(true)
    expect(ceilingFor(task({ kind: 'keypad', range: [0, 20] }))).toBe(5)
  })

  it('needs at least four cards before sorting counts as production', () => {
    expect(isProduction(task({ kind: 'sortOrder', options: [1, 2, 3], answer: '1|2|3' }))).toBe(false)
    expect(isProduction(task({ kind: 'sortOrder', options: [1, 2, 3, 4], answer: '1|2|3|4' }))).toBe(true)
  })

  it('never counts colouring parts of a small shape as production', () => {
    const t = task({ kind: 'colorParts', prompt: { scene: 'fraction', shape: 'circle', parts: 4, colored: 0, equal: true } })
    expect(isProduction(t)).toBe(false)
  })

  it('only counts manipulatives as production in their own skills', () => {
    expect(isProduction(task({ kind: 'share', skill: 'shareEqually' }))).toBe(true)
    expect(isProduction(task({ kind: 'share', skill: 'halves' }))).toBe(false)
    expect(isProduction(task({ kind: 'countTap', skill: 'count10', range: [1, 10] }))).toBe(true)
  })

  it('counts setting the clock to the hour as production', () => {
    const t = task({ kind: 'clockSet', modulo: 720, prompt: { scene: 'clock', minutes: null, step: 60 } })
    expect(guessP(t)).toBeCloseTo(1 / 12)
    expect(isProduction(t)).toBe(true)
  })
})

describe('speed thresholds (SPEC §3.2)', () => {
  it('gives more time per digit and to the long-sum skills', () => {
    expect(defaultFastMs(task({ kind: 'choice', answer: 7 }))).toBe(5000)
    expect(defaultFastMs(task({ kind: 'keypad', answer: 17 }))).toBe(8000)
    expect(defaultFastMs(task({ kind: 'keypad', skill: 'add1000', answer: 734 }))).toBe(25000)
  })

  it('pays with the fewest Danish coins and notes', () => {
    expect(fewestPieces(1700)).toBe(3) // 10 + 5 + 2 kr
    expect(fewestPieces(1250)).toBe(3) // 10 + 2 kr + 50 øre
  })
})

describe('isCorrect', () => {
  it('uses the tolerance on number lines and the modulo on analog clocks', () => {
    expect(isCorrect(task({ answer: 40, tolerance: 5 }), 44)).toBe(true)
    expect(isCorrect(task({ answer: 40, tolerance: 5 }), 46)).toBe(false)
    expect(isCorrect(task({ answer: 180, modulo: 720, answerType: 'minutes' }), 180 + 720)).toBe(true)
  })

  it('accepts equivalent tokens', () => {
    expect(isCorrect(task({ answer: 'frac:1/2', accept: ['frac:2/4'], answerType: 'token' }), 'frac:2/4')).toBe(true)
  })
})
