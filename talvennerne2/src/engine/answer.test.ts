import { describe, expect, it } from 'vitest'
import { canonicalSet, isCorrect } from './answer'
import type { Task } from './types'

const task = (over: Partial<Task>): Task => ({ answer: 0, tolerance: 0, accept: [], kind: 'keypad', ...over }) as Task

describe('isCorrect', () => {
  it('compares numbers with tolerance and modulo', () => {
    expect(isCorrect(task({ answer: 7 }), 7)).toBe(true)
    expect(isCorrect(task({ answer: 7, tolerance: 1, kind: 'numberline' }), 8)).toBe(true)
    expect(isCorrect(task({ answer: 7, tolerance: 1, kind: 'numberline' }), 9)).toBe(false)
    expect(isCorrect(task({ answer: 180, modulo: 720, kind: 'choice' }), 900)).toBe(true)
  })

  it('treats multiSelect, grid and pay answers as sets: the order of taps never matters', () => {
    expect(isCorrect(task({ answer: 's0|s3|s5', kind: 'multiSelect' }), 's5|s0|s3')).toBe(true)
    expect(isCorrect(task({ answer: '3|7|12', kind: 'grid' }), '12|3|7')).toBe(true)
    expect(isCorrect(task({ answer: 'c2000|c500|c500', kind: 'pay' }), 'c500|c2000|c500')).toBe(true)
    // a multiset: one coin too few is wrong
    expect(isCorrect(task({ answer: 'c2000|c500|c500', kind: 'pay' }), 'c500|c2000')).toBe(false)
    expect(isCorrect(task({ answer: 's0|s3', kind: 'multiSelect', accept: ['s1|s2'] }), 's2|s1')).toBe(true)
  })

  it('keeps the order for sortOrder and fillSlots', () => {
    expect(isCorrect(task({ answer: '3|7|12', kind: 'sortOrder' }), '12|7|3')).toBe(false)
    expect(isCorrect(task({ answer: '3|7|12', kind: 'fillSlots' }), '7|3|12')).toBe(false)
    expect(isCorrect(task({ answer: '3|7|12', kind: 'sortOrder' }), '3|7|12')).toBe(true)
  })

  it('canonicalises a set by sorting its tokens', () => {
    expect(canonicalSet('b|a||c')).toBe('a|b|c')
  })
})
