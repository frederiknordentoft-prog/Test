import { describe, expect, it } from 'vitest'
import { angleFromTransform, coastAngle, delayForAngle, omega } from './clockworkMotion'

describe('bremsning og genstart af urværket', () => {
  it('læser vinklen ud af et transform-matrix', () => {
    expect(angleFromTransform('none')).toBe(0)
    expect(angleFromTransform(null)).toBe(0)
    const deg = 37
    const r = (deg * Math.PI) / 180
    const m = `matrix(${Math.cos(r)}, ${Math.sin(r)}, ${-Math.sin(r)}, ${Math.cos(r)}, 12, -4)`
    expect(angleFromTransform(m)).toBeCloseTo(37, 6)
    const m3 = `matrix3d(${Math.cos(r)}, ${Math.sin(r)}, 0, 0, ${-Math.sin(r)}, ${Math.cos(r)}, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)`
    expect(angleFromTransform(m3)).toBeCloseTo(37, 6)
  })

  it('bremselængden følger hastigheden og retningen', () => {
    expect(omega(16, 1)).toBeCloseTo(22.5)
    expect(omega(4, -1)).toBeCloseTo(-90)
    expect(coastAngle(16, 1, 1200)).toBeCloseTo(9)
    expect(coastAngle(4, -1, 1200)).toBeCloseTo(-36)
    expect(coastAngle(16, 1, 900)).toBeCloseTo(6.75)
  })

  it('animation-delay starter CSS-animationen i den holdte vinkel', () => {
    // normal retning: vinkel v efter progress v/360
    expect(delayForAngle(90, 16, 1)).toBeCloseTo(-4)
    expect(delayForAngle(450, 16, 1)).toBeCloseTo(-4)
    expect(delayForAngle(-90, 16, 1)).toBeCloseTo(-12)
    // reverse: animationen kører fra 360 mod 0
    expect(delayForAngle(270, 8, -1)).toBeCloseTo(-2)
    expect(delayForAngle(0, 8, -1)).toBeCloseTo(0)
  })
})
