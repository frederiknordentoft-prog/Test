import { describe, expect, it } from 'vitest'
import { COMPONENTS } from '../content/model'
import { FACES, componentForPips, faceForComponent, faceTransform, nearestAngle, pipLayout, viewFor } from './cube'

describe('terningens geometri', () => {
  it('er en rigtig terning: modstående sider giver 7', () => {
    const opposite: Record<string, string> = {
      front: 'back',
      back: 'front',
      left: 'right',
      right: 'left',
      top: 'bottom',
      bottom: 'top',
    }
    for (const f of FACES) {
      const o = FACES.find((x) => x.side === opposite[f.side])!
      expect(f.pips + o.pips).toBe(7)
    }
  })

  it('hver flade har præcis én komponent og kernen har ingen flade', () => {
    const withPips = COMPONENTS.filter((c) => c.pips !== null)
    expect(withPips).toHaveLength(6)
    for (const c of withPips) {
      expect(faceForComponent(c.id)?.pips).toBe(c.pips)
      expect(componentForPips(c.pips!)).toBe(c.id)
    }
    expect(faceForComponent('arbejdsgange')).toBeNull()
  })

  it('øjnene ligger som på en terning', () => {
    for (const p of [1, 2, 3, 4, 5, 6] as const) expect(pipLayout(p)).toHaveLength(p)
  })

  it('drejer korteste vej', () => {
    expect(nearestAngle(-124, -34)).toBe(-124)
    expect(Math.abs(nearestAngle(-214, -34) - -34)).toBe(180) // 180° — begge veje er lige korte
    expect(nearestAngle(56, -214)).toBe(-304)
    expect(nearestAngle(-34, -304)).toBe(-394)
    expect(nearestAngle(0, 350)).toBe(360)
  })

  it('bruger en fast funktionsliste per flade, styret af --tz og --swing', () => {
    for (const f of FACES) {
      const t = faceTransform(f)
      expect(t.startsWith(f.rotation)).toBe(true)
      expect(t).toContain('translateZ(var(--tz))')
      expect(t).toContain('var(--swing)')
    }
  })

  it('vælger kameravinkel efter tilstand', () => {
    expect(viewFor('assembled', null)).not.toEqual(viewFor('exploded', null))
    expect(viewFor('exploded', 'arbejdsgange')).toEqual(viewFor('exploded', null))
    expect(viewFor('exploded', 'maaling')).toEqual(faceForComponent('maaling')!.view)
  })
})
