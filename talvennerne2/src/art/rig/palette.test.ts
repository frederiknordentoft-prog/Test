import { describe, expect, it } from 'vitest'
import { RABBIT_COLORWAYS } from '../species/rabbit.colorways'
import { hexToOklch, mixHex, oklchToHex } from './oklch'
import { FABRIC, INK, MAGIC, bellyOf, derivePalette, itemPalette, outlineOf, shadeOf, silhouettePalette } from './palette'
import { MAGIC_COLORWAYS, NATURAL_COLORWAYS } from './types'

describe('OKLCH', () => {
  it('rundtur hex → OKLCH → hex er tabsfri', () => {
    for (const hex of ['#000000', '#FFFFFF', INK, '#F2665E', '#67C3FF', '#7EDDB6', '#B98363', '#FBC6DA']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex.toUpperCase())
    }
  })
  it('farver uden for gamut klippes ved at sænke kroma, ikke lyshed', () => {
    const c = hexToOklch(oklchToHex({ L: 0.7, C: 0.5, h: 150 }))
    expect(c.L).toBeCloseTo(0.7, 2)
    expect(c.C).toBeLessThan(0.5)
  })
  it('blanding i OKLab rammer endepunkterne', () => {
    expect(mixHex('#FF0000', '#0000FF', 0)).toBe('#FF0000')
    expect(mixHex('#FF0000', '#0000FF', 1)).toBe('#0000FF')
  })
})

describe('afledning fra fur (SPEC §6.4)', () => {
  const fur = '#B98363'
  const f = hexToOklch(fur)
  it('kontur = L·0,55, C·1,1', () => {
    const o = hexToOklch(outlineOf(fur))
    expect(o.L).toBeCloseTo(f.L * 0.55, 2)
    expect(o.C).toBeCloseTo(f.C * 1.1, 2)
    expect(o.h).toBeCloseTo(f.h, 0)
  })
  it('skygge = L−0,08, h−5', () => {
    const s = hexToOklch(shadeOf(fur))
    expect(s.L).toBeCloseTo(f.L - 0.08, 2)
    expect(s.h).toBeCloseTo(f.h - 5, 0)
  })
  it('mave = L+0,12 (maks 0,97), C·0,4', () => {
    const b = hexToOklch(bellyOf(fur))
    expect(b.L).toBeCloseTo(Math.min(0.97, f.L + 0.12), 2)
    expect(b.C).toBeCloseTo(f.C * 0.4, 2)
    // 8-bit afrunding kan løfte L en anelse over 0,97.
    expect(hexToOklch(bellyOf('#FFF8F0')).L).toBeLessThanOrEqual(0.972)
  })
  it('colorway-overskrivninger vinder, og hollænderens ører får mønsterfarven', () => {
    const p = derivePalette(RABBIT_COLORWAYS.c4)
    expect(p.outline).toBe(RABBIT_COLORWAYS.c4.overrides!.outline)
    expect(p.earFur).toBe(RABBIT_COLORWAYS.c4.patternColor)
    expect(p.earOutline).toBe(outlineOf(RABBIT_COLORWAYS.c4.patternColor!))
    const brown = derivePalette(RABBIT_COLORWAYS.c3)
    expect(brown.outline).toBe(outlineOf(RABBIT_COLORWAYS.c3.fur))
    expect(brown.earFur).toBe(RABBIT_COLORWAYS.c3.fur)
  })
  it('alle kaninens farver giver gyldige hex-værdier', () => {
    for (const id of NATURAL_COLORWAYS) {
      const p = derivePalette(RABBIT_COLORWAYS[id])
      for (const k of ['fur', 'outline', 'shade', 'belly', 'inner', 'nose', 'iris', 'ink'] as const) expect(p[k]).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
  it('silhuetten er sort uden højlys', () => {
    const s = silhouettePalette(derivePalette(RABBIT_COLORWAYS.c5))
    expect(s.fur).toBe('#000000')
    expect(s.outline).toBe('#000000')
    expect(s.highlight).toBe('none')
    expect(s.silhouette).toBe(true)
  })
})

describe('magiske farver og stofpaletten', () => {
  it('magiske farver er gold, rainbow og starwhite – ikke stardust', () => {
    expect([...MAGIC_COLORWAYS]).toEqual(['gold', 'rainbow', 'starwhite'])
    expect(Object.keys(MAGIC).sort()).toEqual(['gold', 'rainbow', 'starwhite'])
    expect(MAGIC.rainbow.gradient?.length).toBeGreaterThanOrEqual(5)
    expect(MAGIC.gold.sparkle).toBeTruthy()
  })
  it('genstandes farver afledes med samme regel som dyrene', () => {
    const c = itemPalette({ id: 'x', name: 'x', main: FABRIC.tomato, trim: FABRIC.cream, accent: FABRIC.navy })
    expect(c.outline).toBe(outlineOf(FABRIC.tomato))
    expect(c.mainShade).toBe(shadeOf(FABRIC.tomato))
    expect(c.trimOutline).toBe(outlineOf(FABRIC.cream))
  })
})
