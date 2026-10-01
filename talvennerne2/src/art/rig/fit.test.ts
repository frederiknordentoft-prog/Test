import { describe, expect, it } from 'vitest'
import { hverdagBody } from '../items/hverdag/hverdag-body'
import { hverdagHead } from '../items/hverdag/hverdag-head'
import { festHead } from '../items/fest/fest-head'
import { rabbit } from '../species/rabbit'
import { DEFAULT_ANCHORS, modelAnchors, worldAnchors } from './anchors'
import { EAR_GAP_FACTOR, FIT_REFERENCE, MAX_OVERRIDE_SHARE, fitItem, inverseTransform, overrideShare, toLocal } from './fit'
import type { ItemDef, ItemFit, Slot } from './types'

const who = { id: 'rabbit', family: 'lagomorph' } as const
const item = (fit: Partial<ItemFit>, slot: Slot = 'head'): Pick<ItemDef, 'slot' | 'fit'> => ({
  slot,
  fit: { anchor: 'headTop', scaleBy: 'headWidth', baseScale: 1, baseWidth: 100, ...fit },
})

describe('fitItem (SPEC §7.1)', () => {
  it('1. skalerer med baseScale × anker / reference', () => {
    const a = { ...DEFAULT_ANCHORS, headWidth: 130 }
    expect(fitItem(item({ baseScale: 1.2 }), a, who).scale).toBeCloseTo((1.2 * 130) / FIT_REFERENCE.headWidth)
    const b = { ...DEFAULT_ANCHORS, bodyWidth: 80 }
    expect(fitItem(item({ anchor: 'bodyCenter', scaleBy: 'bodyWidth' }, 'body'), b, who).scale).toBeCloseTo(0.8)
    const c = { ...DEFAULT_ANCHORS, neckWidth: 29 }
    expect(fitItem(item({ anchor: 'neck', scaleBy: 'neckWidth' }, 'neck'), c, who).scale).toBeCloseTo(0.5)
  })

  it('placerer genstanden på sit anker', () => {
    const r = fitItem(item({ anchor: 'chest' }, 'neck'), DEFAULT_ANCHORS, who)
    expect([r.x, r.y]).toEqual([DEFAULT_ANCHORS.chest.x, DEFAULT_ANCHORS.chest.y])
  })

  it("2. earMode 'under' klemmes til earGap × 1,15 / baseWidth", () => {
    const a = { ...DEFAULT_ANCHORS, earGap: 40 }
    const r = fitItem(item({ earMode: 'under', baseWidth: 60 }), a, who)
    expect(r.scale).toBeCloseTo((40 * EAR_GAP_FACTOR) / 60)
    expect(r.earMode).toBe('under')
    // Klemningen gør aldrig en genstand større.
    const wide = { ...DEFAULT_ANCHORS, earGap: 200 }
    expect(fitItem(item({ earMode: 'under', baseWidth: 60 }), wide, who).scale).toBeCloseTo(1)
  })

  it("'through' er standard og klemmes aldrig", () => {
    const a = { ...DEFAULT_ANCHORS, earGap: 10 }
    const r = fitItem(item({}), a, who)
    expect(r.earMode).toBe('through')
    expect(r.scale).toBeCloseTo(1)
  })

  it('ørereglen gælder kun hovedgenstande', () => {
    const a = { ...DEFAULT_ANCHORS, earGap: 10 }
    const r = fitItem(item({ anchor: 'bodyCenter', scaleBy: 'bodyWidth', earMode: 'under' }, 'body'), a, who)
    expect(r.scale).toBeCloseTo(1)
    expect(r.earMode).toBe('through')
  })

  it('5. håndgenstande følger potens vinkel (handRot)', () => {
    const a = { ...DEFAULT_ANCHORS, handRot: -32 }
    const r = fitItem(item({ anchor: 'pawR', scaleBy: 'fixed' }, 'hand'), a, who)
    expect(r.rot).toBe(-32)
    expect([r.x, r.y]).toEqual([a.pawR.x, a.pawR.y])
    expect(fitItem(item({}), a, who).rot).toBe(0)
  })

  it("'fixed' ignorerer ankermålene", () => {
    const a = { ...DEFAULT_ANCHORS, headWidth: 300 }
    expect(fitItem(item({ scaleBy: 'fixed', baseScale: 0.7 }), a, who).scale).toBe(0.7)
  })

  it('overskrivninger slås op pr. art før familie', () => {
    const fit = item({ overrides: { lagomorph: { dy: 4 }, rabbit: { dx: 2, scale: 0.5, rot: 10 } } })
    const r = fitItem(fit, DEFAULT_ANCHORS, who)
    expect(r.override).toBe('rabbit')
    expect(r.x).toBe(DEFAULT_ANCHORS.headTop.x + 2)
    expect(r.y).toBe(DEFAULT_ANCHORS.headTop.y)
    expect(r.scale).toBeCloseTo(0.5)
    expect(r.rot).toBe(10)
    const fam = fitItem(item({ overrides: { lagomorph: { dy: 4 } } }), DEFAULT_ANCHORS, who)
    expect(fam.override).toBe('lagomorph')
    expect(fam.y).toBe(DEFAULT_ANCHORS.headTop.y + 4)
    expect(fitItem(item({}), DEFAULT_ANCHORS, who).override).toBeNull()
  })

  it('toLocal og inverseTransform er den inverse af pasformen', () => {
    const r = fitItem(item({ baseScale: 1.3, overrides: { rabbit: { rot: 25 } } }), DEFAULT_ANCHORS, who)
    const p = { x: 71, y: 58 }
    const q = toLocal(r, p)
    // Frem igen: translate · rotate · scale.
    const t = (r.rot * Math.PI) / 180
    const back = {
      x: r.x + (q.x * Math.cos(t) - q.y * Math.sin(t)) * r.scale,
      y: r.y + (q.x * Math.sin(t) + q.y * Math.cos(t)) * r.scale,
    }
    expect(back.x).toBeCloseTo(p.x, 6)
    expect(back.y).toBeCloseTo(p.y, 6)
    expect(inverseTransform(r)).toMatch(/^scale\(0\.769\) rotate\(-25\) translate\(-100 -48\)$/)
  })

  it('7. højst 10 % af (genstand, art)-par har en overskrivning', () => {
    const wearers = [{ ...who, anchors: modelAnchors(rabbit, 'upright') }]
    const items = [hverdagHead, festHead, hverdagBody]
    expect(overrideShare(items, wearers)).toBeLessThanOrEqual(MAX_OVERRIDE_SHARE)
    const withOverride = [...items, item({ overrides: { rabbit: { dy: 1 } } })]
    expect(overrideShare(withOverride, wearers)).toBeCloseTo(0.25)
  })

  it('pasformen afhænger ikke af stadiet (stadier ligger i region-transformationerne)', () => {
    const a = modelAnchors(rabbit, 'upright')
    const r = fitItem(hverdagHead, a, rabbit)
    // Genstanden sidder i modelrummet; verdensankrene flytter sig med stadiet, men fit er det samme.
    expect(worldAnchors(a, 1).headTop).not.toEqual(worldAnchors(a, 3).headTop)
    expect(fitItem(hverdagHead, modelAnchors(rabbit, 'upright'), rabbit)).toEqual(r)
  })

  it('spike-genstandene: hue gennem ørerne, festhat mellem dem, trøje efter kroppen', () => {
    const a = modelAnchors(rabbit, 'upright')
    expect(fitItem(hverdagHead, a, rabbit).earMode).toBe('through')
    const fest = fitItem(festHead, a, rabbit)
    expect(fest.earMode).toBe('under')
    expect(fest.scale * festHead.fit.baseWidth).toBeLessThanOrEqual(a.earGap * EAR_GAP_FACTOR + 1e-9)
    const body = fitItem(hverdagBody, a, rabbit)
    expect(body.scale).toBeCloseTo(a.bodyWidth / FIT_REFERENCE.bodyWidth)
    expect(Object.keys(hverdagBody.art.bodyShapes ?? {}).sort()).toEqual(['pear', 'round', 'tall'])
  })
})
