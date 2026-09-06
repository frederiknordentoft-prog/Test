import { describe, expect, it } from 'vitest'
import {
  angleFromTransform,
  brakeAngle,
  coastAngle,
  delayForAngle,
  motionKeyframes,
  omega,
  resumeAngle,
  velocityAt,
} from './clockworkMotion'

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

  it('bremsekurven starter med den aktuelle hastighed og ender i stilstand', () => {
    const v0 = 90
    const D = 1200
    // numerisk hældning i start og slut
    const h = 1e-4
    const vStart = (brakeAngle(0, v0, D, h) - brakeAngle(0, v0, D, 0)) / (h * (D / 1000))
    const vEnd = (brakeAngle(0, v0, D, 1) - brakeAngle(0, v0, D, 1 - h)) / (h * (D / 1000))
    expect(vStart).toBeCloseTo(v0, 1)
    expect(Math.abs(vEnd)).toBeLessThan(0.01)
    expect(brakeAngle(10, v0, D, 1)).toBeCloseTo(10 + coastAngle(4, 1, D), 6)
    expect(velocityAt('brake', v0, 0, 0)).toBe(v0)
    expect(velocityAt('brake', v0, 0, 1)).toBe(0)
  })

  it('genstartskurven møder CSS-hastigheden uden knæk — også fra en delvis hastighed', () => {
    const v1 = 22.5
    const D = 900
    const h = 1e-4
    for (const v0 of [0, 7.3, 22.5]) {
      const vStart = (resumeAngle(0, v0, v1, D, h) - resumeAngle(0, v0, v1, D, 0)) / (h * (D / 1000))
      const vEnd = (resumeAngle(0, v0, v1, D, 1) - resumeAngle(0, v0, v1, D, 1 - h)) / (h * (D / 1000))
      expect(vStart).toBeCloseTo(v0, 1)
      expect(vEnd).toBeCloseTo(v1, 1)
      expect(velocityAt('resume', v0, v1, 1)).toBeCloseTo(v1)
    }
    expect(resumeAngle(5, 0, v1, D, 1)).toBeCloseTo(5 + coastAngle(16, 1, D), 6)
  })

  it('keyframes er monotone og dækker 0..1', () => {
    const frames = motionKeyframes('brake', 30, -90, 0, 1200)
    expect(frames[0]!.offset).toBe(0)
    expect(frames[frames.length - 1]!.offset).toBe(1)
    const angles = frames.map((f) => Number(String(f.transform).match(/-?[\d.]+/)![0]))
    for (let i = 1; i < angles.length; i++) expect(angles[i]!).toBeLessThanOrEqual(angles[i - 1]!)
    expect(angles[angles.length - 1]).toBeCloseTo(30 - 36, 6)
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
