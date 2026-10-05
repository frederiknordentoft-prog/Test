// Egernets farver skal kunne skilles ad (review G2-r3 §4 og §7.5): c6 (orange) lå kun 0,044 fra guldets pels i OKLab,
// så de to kun blev skilt ad af glimmeret og guldets lyse mave, og c5 (lys) lå 0,0755 fra guld. Pelsen i hvert par af
// egernets farver skal ligge mindst 0,08 fra hinanden.
import { describe, expect, it } from 'vitest'
import { hexToOklch } from '../rig/oklch'
import { SQUIRREL_COLORWAYS } from './squirrel.colorways'

/** Mindste OKLab-afstand mellem to af egernets farver (pelsen). */
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

const ALL = Object.values(SQUIRREL_COLORWAYS)
const PAIRS = ALL.flatMap((p, i) => ALL.slice(i + 1).map((q) => [p, q] as const))

describe('egernets farver', () => {
  it('afstanden måles i OKLab: en farve har afstand 0 til sig selv, og sort mod hvid er 1', () => {
    expect(deltaE('#FFA22C', '#FFA22C')).toBe(0)
    expect(deltaE('#000000', '#FFFFFF')).toBeCloseTo(1, 3)
  })

  it('har alle otte farver med (c1–c6, guld og regnbue)', () => {
    expect(ALL.map((cw) => cw.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'gold', 'rainbow'])
    expect(PAIRS).toHaveLength(28)
  })

  it(`c6 og c5 ligger mindst ${MIN_DELTA_E} fra guld (før: 0,044 og 0,0755)`, () => {
    expect(deltaE(SQUIRREL_COLORWAYS.c6.fur, SQUIRREL_COLORWAYS.gold.fur)).toBeGreaterThanOrEqual(MIN_DELTA_E)
    expect(deltaE(SQUIRREL_COLORWAYS.c5.fur, SQUIRREL_COLORWAYS.gold.fur)).toBeGreaterThanOrEqual(MIN_DELTA_E)
  })

  it(`hvert par af farverne ligger mindst ${MIN_DELTA_E} fra hinanden`, () => {
    for (const [p, q] of PAIRS) expect(deltaE(p.fur, q.fur), `${p.id} mod ${q.id}`).toBeGreaterThanOrEqual(MIN_DELTA_E)
  })

  it('c6 er stadig orange: mellem det rustrøde c1 og guldets gule tone, og lysere end c1', () => {
    const o = hexToOklch(SQUIRREL_COLORWAYS.c6.fur)
    const red = hexToOklch(SQUIRREL_COLORWAYS.c1.fur)
    const gold = hexToOklch(SQUIRREL_COLORWAYS.gold.fur)
    expect(o.h).toBeGreaterThan(red.h)
    expect(o.h).toBeLessThan(gold.h)
    expect(o.L).toBeGreaterThan(red.L)
  })

  it('c5 er stadig lys: lysere end c6 og blegere (mindre mættet) end guld og c6', () => {
    const lys = hexToOklch(SQUIRREL_COLORWAYS.c5.fur)
    const o = hexToOklch(SQUIRREL_COLORWAYS.c6.fur)
    const gold = hexToOklch(SQUIRREL_COLORWAYS.gold.fur)
    expect(lys.L).toBeGreaterThan(o.L)
    expect(lys.C).toBeLessThan(gold.C)
    expect(lys.C).toBeLessThan(o.C)
  })
})
