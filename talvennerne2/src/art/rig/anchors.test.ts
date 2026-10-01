import { describe, expect, it } from 'vitest'
import { rabbit } from '../species/rabbit'
import { DEFAULT_ANCHORS, GROUND_Y, SAFE, STAGE_FIG, STAGE_XF, anchorsFinite, apply, computeAnchors, modelAnchors, regionTransforms, templateAnchors, worldAnchors } from './anchors'
import { BODY_KINDS, STAGES } from './types'

describe('ankre (SPEC §6.4)', () => {
  it('standardtabellen fra kunst-forslaget §2.1 for stadie 2/round', () => {
    const a = DEFAULT_ANCHORS
    expect(a.headCenter).toEqual({ x: 100, y: 96 })
    expect([a.headRx, a.headRy, a.headWidth, a.earGap]).toEqual([56, 50, 104, 60])
    expect(a.eyeL).toEqual({ x: 78, y: 100 })
    expect(a.eyeR).toEqual({ x: 122, y: 100 })
    expect(a.neck).toEqual({ x: 100, y: 146 })
    expect([a.bodyRx, a.bodyRy, a.bodyWidth, a.neckWidth]).toEqual([50, 44, 100, 58])
    expect(a.pawR).toEqual({ x: 124, y: 206 })
    expect(a.handRot).toBe(-20)
    expect(a.tailBase).toEqual({ x: 146, y: 208 })
    expect(a.ground.y).toBe(GROUND_Y)
  })

  it('alle skabeloner, racer og stadier giver endelige ankre (ingen NaN)', () => {
    for (const k of BODY_KINDS) expect(anchorsFinite(templateAnchors(k))).toBe(true)
    for (const b of rabbit.breeds)
      for (const s of STAGES) {
        const w = computeAnchors(rabbit, b.id, s)
        expect(anchorsFinite(w)).toBe(true)
        // Ankrene ligger i den sikre zone.
        for (const v of Object.values(w))
          if (typeof v === 'object') {
            expect(v.x).toBeGreaterThanOrEqual(SAFE.x0)
            expect(v.x).toBeLessThanOrEqual(SAFE.x1)
            expect(v.y).toBeGreaterThanOrEqual(SAFE.y0)
            expect(v.y).toBeLessThanOrEqual(SAFE.y1)
          }
      }
  })

  it('earGap følger ørebaserne, når arten flytter dem', () => {
    const a = modelAnchors(rabbit, 'lionhead')
    expect(a.earGap).toBe(a.earBaseR.x - a.earBaseL.x)
    // En race kan sætte earGap selv (vædderens hængeører: hatte mellem ørerne må være bredere).
    expect(modelAnchors(rabbit, 'lop').earGap).toBe(60)
  })

  it('stadie 2 er modelrummet skaleret STAGE_FIG om fodpunktet', () => {
    const a = modelAnchors(rabbit, 'upright')
    const w = worldAnchors(a, 2)
    expect(STAGE_FIG).toBe(0.9)
    expect(w.ground).toEqual(a.ground)
    expect(w.headRx).toBeCloseTo(a.headRx * STAGE_FIG)
    expect(w.headCenter.y).toBeCloseTo(GROUND_Y - (GROUND_Y - a.headCenter.y) * STAGE_FIG)
  })

  it('stadie 1 (relativt til stadie 2): hoved ·1,08, krop ·0,85, øjne ·1,15, figur ·0,86 – fødderne på jorden', () => {
    const a = modelAnchors(rabbit, 'upright')
    const w1 = worldAnchors(a, 1)
    const w2 = worldAnchors(a, 2)
    expect(w1.headRx / w2.headRx).toBeCloseTo(0.86 * 1.08)
    expect(w1.bodyRx / w2.bodyRx).toBeCloseTo(0.86 * 0.85)
    expect(w1.eyeRx / w2.eyeRx).toBeCloseTo(0.86 * 1.08 * 1.15)
    expect(w1.ground).toEqual(a.ground)
  })

  it('stadie 3 (relativt til stadie 2): hoved ·0,96, krop ·1,08, hale/manke ·1,3, horn ·1,25, vinger ·1,2 – og 10–15 % højere', () => {
    expect(STAGE_XF[3]).toMatchObject({ head: 0.96, body: 1.08, mane: 1.3, tail: 1.3, horn: 1.25, wings: 1.2 })
    const a = modelAnchors(rabbit, 'upright')
    const w2 = worldAnchors(a, 2)
    const w3 = worldAnchors(a, 3)
    expect(w3.headWidth / w2.headWidth).toBeCloseTo((1 / STAGE_FIG) * 0.96)
    expect(w3.bodyWidth / w2.bodyWidth).toBeCloseTo((1 / STAGE_FIG) * 1.08)
    // Figurens højde (fodpunkt → isse) vokser 10–15 % fra ung til stor.
    const grow = (GROUND_Y - w3.headTop.y) / (GROUND_Y - w2.headTop.y)
    expect(grow).toBeGreaterThan(1.1)
    expect(grow).toBeLessThan(1.15)
  })

  it('hovedet sidder altid på halsen: hovedregionens hals = kroppens hals', () => {
    const a = modelAnchors(rabbit, 'upright')
    for (const s of STAGES) {
      const R = regionTransforms(a, s)
      const viaHead = apply(R.head, a.neck)
      const viaBody = apply(R.body, a.neck)
      expect(viaHead.x).toBeCloseTo(viaBody.x, 9)
      expect(viaHead.y).toBeCloseTo(viaBody.y, 9)
    }
  })
})
