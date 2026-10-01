import { describe, expect, it } from 'vitest'
import {
  SOUND_CHECK_OTHERS, retrySoundCheck, startSoundCheck, tapCard, verdict,
} from './soundCheck'
import type { SoundCheckState } from './soundCheck'

const other = (s: SoundCheckState) => s.cards.find((c) => c !== 'cat')!

describe('sound check (SPEC §8)', () => {
  it('deals a cat and one other animal, the cat on either side', () => {
    const sides = new Set<number>()
    for (let seed = 1; seed <= 60; seed++) {
      const s = startSoundCheck(seed)
      expect(s.cards).toContain('cat')
      expect(SOUND_CHECK_OTHERS).toContain(other(s))
      sides.add(s.cards.indexOf('cat'))
    }
    expect([...sides].sort()).toEqual([0, 1])
  })

  it('passes on the cat', () => {
    const s = tapCard(startSoundCheck(3), 'cat')
    expect(s.phase).toBe('passed')
    expect(verdict(s)).toBe(true)
  })

  it('asks again after one wrong tap, and fails after the second', () => {
    let s = startSoundCheck(5)
    s = tapCard(s, other(s))
    expect(s).toMatchObject({ phase: 'listen', wrong: 1, deal: 1 })
    expect(verdict(s)).toBeNull()
    s = tapCard(s, other(s))
    expect(s).toMatchObject({ phase: 'failed', wrong: 2 })
    expect(verdict(s)).toBe(false)
  })

  it('still passes on the cat after one wrong tap', () => {
    let s = startSoundCheck(8)
    s = tapCard(s, other(s))
    s = tapCard(s, 'cat')
    expect(verdict(s)).toBe(true)
  })

  it('reshuffles after a wrong tap, so elimination is no shortcut', () => {
    let moved = 0
    for (let seed = 1; seed <= 40; seed++) {
      const s = startSoundCheck(seed)
      const after = tapCard(s, other(s))
      if (after.cards.indexOf('cat') !== s.cards.indexOf('cat')) moved++
    }
    // a fresh deal, not a fixed swap: the cat stays put about half the time
    expect(moved).toBeGreaterThan(8)
    expect(moved).toBeLessThan(32)
  })

  it('ignores taps once the check is over, and starts over on "Prøv igen"', () => {
    let s = startSoundCheck(11)
    s = tapCard(tapCard(s, other(s)), other(tapCard(s, other(s))))
    expect(s.phase).toBe('failed')
    expect(tapCard(s, 'cat')).toBe(s)
    const again = retrySoundCheck(s)
    expect(again).toMatchObject({ phase: 'listen', wrong: 0 })
    expect(verdict(tapCard(again, 'cat'))).toBe(true)
  })
})
