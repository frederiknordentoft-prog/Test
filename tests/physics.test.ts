import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PHYSICS,
  FIXED_DT,
  isSettled,
  REST_STATE,
  settle,
  stepPhysics,
  targetAngle,
} from '../src/engine/physics'

/** Kør helt i bund (uden settle-early-break) så residualet er ~0. */
function converge(left: number, right: number) {
  let s = REST_STATE
  for (let i = 0; i < 40_000; i++) s = stepPhysics(s, left, right, FIXED_DT)
  return s
}

describe('bjælke-fysik', () => {
  it('massediff > 0 (højre tungest) settler med positiv vinkel — og omvendt', () => {
    const heavyRight = settle(1.008, 238.02891)
    expect(heavyRight.angle).toBeGreaterThan(0.01)
    expect(isSettled(heavyRight, 1.008, 238.02891)).toBe(true)

    const heavyLeft = settle(196.96657, 12.011)
    expect(heavyLeft.angle).toBeLessThan(-0.01)
    expect(isSettled(heavyLeft, 196.96657, 12.011)).toBe(true)
  })

  it('større massediff giver større |θ| — strengt monotont', () => {
    const diffs = [0.5, 1, 2, 4, 8, 16, 32, 64, 128, 238]
    let prev = 0
    for (const diff of diffs) {
      const s = converge(0, diff)
      expect(Math.abs(s.angle)).toBeGreaterThan(prev)
      prev = Math.abs(s.angle)
    }
  })

  it('monotont også ved fast totalmasse', () => {
    const total = 100
    let prev = -1
    for (const diff of [0, 2, 10, 30, 60, 100]) {
      const s = converge((total - diff) / 2, (total + diff) / 2)
      expect(Math.abs(s.angle)).toBeGreaterThan(prev)
      prev = Math.abs(s.angle)
    }
  })

  it('ved balance går θ mod 0 og settled bliver true', () => {
    // start med udslag og hastighed — skal falde til ro omkring 0
    let s = { angle: 0.25, angularVel: 0.8 }
    for (let i = 0; i < 20_000; i++) {
      s = stepPhysics(s, 55.845, 55.845, FIXED_DT)
      if (isSettled(s, 55.845, 55.845)) break
    }
    expect(Math.abs(s.angle)).toBeLessThan(DEFAULT_PHYSICS.settleAngle)
    expect(isSettled(s, 55.845, 55.845)).toBe(true)
  })

  it('wobbler (underdampet): krydser målvinklen mindst én gang', () => {
    let s = REST_STATE
    const target = targetAngle(0, 100)
    let crossed = false
    let above = false
    for (let i = 0; i < 5000; i++) {
      s = stepPhysics(s, 0, 100, FIXED_DT)
      if (s.angle > target) above = true
      if (above && s.angle < target) crossed = true
    }
    expect(crossed).toBe(true) // overshoot + tilbagesving = wobble
  })

  it('tom vægt er i ro fra start', () => {
    expect(isSettled(REST_STATE, 0, 0)).toBe(true)
    expect(targetAngle(0, 0)).toBe(0)
  })
})
