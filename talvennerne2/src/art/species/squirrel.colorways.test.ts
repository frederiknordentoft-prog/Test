// Egernets c6 (orange) mod guld og de andre farver (review G2-r3 §4 og §7.5): c6 lå kun 0,044 fra guldets pels i
// OKLab, så de to kun blev skilt ad af glimmeret og guldets lyse mave. Pelsen skal ligge mindst 0,08 fra guld og fra
// hver af egernets andre farver (c5 lå 0,072 fra c6).
import { describe, expect, it } from 'vitest'
import { hexToOklch } from '../rig/oklch'
import { SQUIRREL_COLORWAYS } from './squirrel.colorways'

/** Mindste OKLab-afstand mellem c6's pels og de andre farvers pels. */
const MIN_DELTA_E = 0.08

/** OKLab (L, a, b) fra en hex-farve via oklch.ts' OKLCH. */
function oklab(hex: string): [number, number, number] {
  const { L, C, h } = hexToOklch(hex)
  const r = (h * Math.PI) / 180
  return [L, C * Math.cos(r), C * Math.sin(r)]
}

/** Euklidisk afstand i OKLab (ΔE_ok). */
function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = oklab(a)
  const [l2, a2, b2] = oklab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

describe('egernets c6 (orange)', () => {
  const c6 = SQUIRREL_COLORWAYS.c6.fur
  const others = Object.values(SQUIRREL_COLORWAYS).filter((cw) => cw.id !== 'c6')

  it('afstanden måles i OKLab: en farve har afstand 0 til sig selv, og sort mod hvid er 1', () => {
    expect(deltaE(c6, c6)).toBe(0)
    expect(deltaE('#000000', '#FFFFFF')).toBeCloseTo(1, 3)
  })

  it(`ligger mindst ${MIN_DELTA_E} fra guld (før: 0,044)`, () => {
    expect(deltaE(c6, SQUIRREL_COLORWAYS.gold.fur)).toBeGreaterThanOrEqual(MIN_DELTA_E)
  })

  it(`ligger mindst ${MIN_DELTA_E} fra hver af egernets andre farver`, () => {
    expect(others.map((cw) => cw.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'gold', 'rainbow'])
    for (const cw of others) expect(deltaE(c6, cw.fur), `c6 mod ${cw.id}`).toBeGreaterThanOrEqual(MIN_DELTA_E)
  })

  it('er stadig orange: mellem det rustrøde c1 og guldets gule tone, og lysere end c1', () => {
    const o = hexToOklch(c6)
    const red = hexToOklch(SQUIRREL_COLORWAYS.c1.fur)
    const gold = hexToOklch(SQUIRREL_COLORWAYS.gold.fur)
    expect(o.h).toBeGreaterThan(red.h)
    expect(o.h).toBeLessThan(gold.h)
    expect(o.L).toBeGreaterThan(red.L)
  })
})
