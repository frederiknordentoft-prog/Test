import { describe, expect, it } from 'vitest'
import { makeRng } from '../../engine/rng'
import { GATE_FACTOR_A, GATE_FACTOR_B, gateKey, gateProblem, gateSolved, gateText } from './gate'

describe('the grown-ups gate (SPEC §8)', () => {
  it('asks a two-digit number times a one-digit number, 12–19 · 6–9', () => {
    const seenA = new Set<number>()
    const seenB = new Set<number>()
    for (let seed = 1; seed <= 400; seed++) {
      const p = gateProblem(makeRng(seed))
      expect(p.a).toBeGreaterThanOrEqual(GATE_FACTOR_A.min)
      expect(p.a).toBeLessThanOrEqual(GATE_FACTOR_A.max)
      expect(p.b).toBeGreaterThanOrEqual(GATE_FACTOR_B.min)
      expect(p.b).toBeLessThanOrEqual(GATE_FACTOR_B.max)
      expect(p.answer).toBe(p.a * p.b)
      seenA.add(p.a)
      seenB.add(p.b)
    }
    expect([...seenA].sort((x, y) => x - y)).toEqual([12, 13, 14, 15, 16, 17, 18, 19])
    expect([...seenB].sort((x, y) => x - y)).toEqual([6, 7, 8, 9])
  })

  it('writes the sum with the multiplication dot and never with a cross', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const text = gateText(gateProblem(makeRng(seed)))
      expect(text).toMatch(/^1\d · [6-9]$/)
      expect(text).not.toMatch(/[×x*]/)
    }
  })

  it('brings a different sum after a wrong answer', () => {
    const rng = makeRng(7)
    let p = gateProblem(rng)
    for (let i = 0; i < 200; i++) {
      const next = gateProblem(rng, p)
      expect(`${next.a}·${next.b}`).not.toBe(`${p.a}·${p.b}`)
      p = next
    }
  })

  it('types digits only, at most three, without a leading zero', () => {
    let e = ''
    for (const k of ['0', '1', 'x', '2', '6', '7']) e = gateKey(e, k)
    expect(e).toBe('126')
    expect(gateKey('126', 'del')).toBe('12')
    expect(gateKey('', 'del')).toBe('')
  })

  it('passes only on the exact product', () => {
    const p = { a: 14, b: 7, answer: 98 }
    expect(gateSolved(p, '98')).toBe(true)
    expect(gateSolved(p, '89')).toBe(false)
    expect(gateSolved(p, '')).toBe(false)
  })
})
