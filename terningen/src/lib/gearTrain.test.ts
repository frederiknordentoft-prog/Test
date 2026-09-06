import { describe, expect, it } from 'vitest'
import { TRAIN, meshProblems, periodFor } from './gearTrain'

describe('urværkets tandhjulskæde', () => {
  it('har 5-7 tandhjul', () => {
    expect(TRAIN.length).toBeGreaterThanOrEqual(5)
    expect(TRAIN.length).toBeLessThanOrEqual(7)
  })

  it('hjul i indgreb har korrekt centerafstand, modsat retning og hastighed omvendt proportional med radius', () => {
    for (const g of TRAIN) {
      if (!g.meshWith) continue
      const parent = TRAIN.find((p) => p.id === g.meshWith)!
      const dist = Math.hypot(g.cx - parent.cx, g.cy - parent.cy)
      expect(dist).toBeCloseTo(parent.r + g.r, 6)
      expect(g.dir).toBe(-parent.dir)
      // ω ∝ 1/r  ⇔  ω_g · r_g = ω_p · r_p
      expect(g.speed * g.r).toBeCloseTo(parent.speed * parent.r, 6)
      expect(periodFor(g) / periodFor(parent)).toBeCloseTo(g.teeth / parent.teeth, 6)
    }
  })

  it('koaksiale hjul deler center, retning og hastighed', () => {
    for (const g of TRAIN) {
      if (!g.coaxialWith) continue
      const parent = TRAIN.find((p) => p.id === g.coaxialWith)!
      expect(g.cx).toBe(parent.cx)
      expect(g.cy).toBe(parent.cy)
      expect(g.dir).toBe(parent.dir)
      expect(g.speed).toBe(parent.speed)
    }
  })

  it('tænderne griber ind i hinanden uden at kollidere', () => {
    for (const g of TRAIN) {
      if (!g.meshWith) continue
      const parent = TRAIN.find((p) => p.id === g.meshWith)!
      expect(meshProblems(parent, g)).toEqual([])
    }
  })

  it('hjul i samme lag, der ikke er i indgreb, rører ikke hinanden', () => {
    for (let i = 0; i < TRAIN.length; i++) {
      for (let j = i + 1; j < TRAIN.length; j++) {
        const a = TRAIN[i]!
        const b = TRAIN[j]!
        if (a.layer !== b.layer) continue
        if (a.meshWith === b.id || b.meshWith === a.id) continue
        if (a.coaxialWith === b.id || b.coaxialWith === a.id) continue
        const dist = Math.hypot(a.cx - b.cx, a.cy - b.cy)
        expect(dist).toBeGreaterThan(a.outerR + b.outerR)
      }
    }
  })

  it('holder sig inden for urværkets ramme', () => {
    for (const g of TRAIN) {
      expect(Math.abs(g.cx) + g.outerR).toBeLessThanOrEqual(60)
      expect(Math.abs(g.cy) + g.outerR).toBeLessThanOrEqual(60)
    }
  })
})
