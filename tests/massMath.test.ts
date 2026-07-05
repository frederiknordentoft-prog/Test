import { describe, expect, it } from 'vitest'
import { ELEMENTS, MICRO, toMicroU } from '../src/data/elements'
import { MOLECULES, moleculeAtomSumMicroU } from '../src/data/molecules'
import { mulberry32, pick } from '../src/game/rng'
import type { Tile } from '../src/game/types'
import { tileMass } from '../src/game/types'

describe('masse-matematik (mikro-u, eksakt)', () => {
  it('hver skåls total er summen af brikkerne — eksakt i mikro-u', () => {
    const rng = mulberry32(7)
    for (let round = 0; round < 200; round++) {
      const n = 1 + Math.floor(rng() * 30)
      const tiles: Tile[] = []
      for (let i = 0; i < n; i++) {
        tiles.push({ id: `t${i}`, kind: 'element', element: pick(rng, ELEMENTS) })
      }
      const microSum = tiles.reduce((s, t) => s + toMicroU(tileMass(t)), 0)
      const manual = tiles.reduce((s, t) => s + Math.round(tileMass(t) * MICRO), 0)
      expect(microSum).toBe(manual)
      expect(Number.isInteger(microSum)).toBe(true)
    }
  })

  it.each(MOLECULES.map((m) => [m.formula, m] as const))(
    'molarMass for %s er NØJAGTIG summen af constituent-grundstofferne',
    (_formula, molecule) => {
      expect(toMicroU(molecule.molarMass)).toBe(moleculeAtomSumMicroU(molecule))
    },
  )

  it('H₂O === O + 2·H helt konkret', () => {
    const h = toMicroU(1.008)
    const o = toMicroU(15.999)
    expect(toMicroU(18.015)).toBe(o + 2 * h)
  })

  it('238 brint er tungere end 1 uran — men 236 er ikke', () => {
    const h = toMicroU(1.008)
    const u = toMicroU(238.02891)
    expect(238 * h).toBeGreaterThan(u)
    expect(236 * h).toBeLessThan(u)
  })
})
