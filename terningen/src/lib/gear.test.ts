import { describe, expect, it } from 'vitest'
import { countTeethInPath, makeGearPath } from './gear'

describe('makeGearPath', () => {
  it('returnerer et lukket path centreret i (0,0) med det korrekte antal tænder', () => {
    for (const teeth of [3, 8, 11, 13, 22, 40]) {
      const outerR = 50
      const path = makeGearPath(teeth, outerR, 8, 6)
      expect(path.startsWith('M')).toBe(true)
      expect(path.trim().endsWith('Z')).toBe(true)
      expect(countTeethInPath(path, outerR)).toBe(teeth)

      // Ydre kontur: 4 punkter per tand (M + 4n-1 L) — hullet bidrager med 1 M og 0 L.
      const lineCount = (path.match(/L/g) ?? []).length
      expect(lineCount).toBe(teeth * 4 - 1)

      // Centreret: tyngdepunktet af den ydre konturs punkter ligger i (0,0)
      const outline = path.slice(0, path.indexOf('Z'))
      const pts = [...outline.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [
        Number(m[1]),
        Number(m[2]),
      ])
      const cx = pts.reduce((a, p) => a + p[0]!, 0) / pts.length
      const cy = pts.reduce((a, p) => a + p[1]!, 0) / pts.length
      expect(Math.abs(cx)).toBeLessThan(1e-6 + 0.01)
      expect(Math.abs(cy)).toBeLessThan(1e-6 + 0.01)
    }
  })

  it('lægger akselhullet som en separat lukket subpath', () => {
    const withHole = makeGearPath(12, 40, 6, 5)
    expect((withHole.match(/Z/g) ?? []).length).toBe(2)
    expect(withHole).toContain('A6 6 0 1 0 -6 0')
    const withoutHole = makeGearPath(12, 40, 0, 5)
    expect((withoutHole.match(/Z/g) ?? []).length).toBe(1)
    expect(withoutHole).not.toContain('A')
  })

  it('holder alle konturpunkter mellem rod- og ydre radius', () => {
    const teeth = 17
    const outerR = 30
    const depth = 4
    const path = makeGearPath(teeth, outerR, 0, depth)
    for (const m of path.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
      const r = Math.hypot(Number(m[1]), Number(m[2]))
      expect(r).toBeGreaterThanOrEqual(outerR - depth - 0.01)
      expect(r).toBeLessThanOrEqual(outerR + 0.01)
    }
  })

  it('afviser ugyldige parametre', () => {
    expect(() => makeGearPath(2, 10, 0, 2)).toThrow(RangeError)
    expect(() => makeGearPath(10, 0, 0, 2)).toThrow(RangeError)
    expect(() => makeGearPath(10, 10, 0, 10)).toThrow(RangeError)
    expect(() => makeGearPath(10, 10, 9, 2)).toThrow(RangeError)
    expect(() => makeGearPath(10.5, 10, 0, 2)).toThrow(RangeError)
  })
})
