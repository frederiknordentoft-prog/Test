import { describe, expect, it } from 'vitest'
import { DOMAINS, SKILLS } from '../content/skills'
import { FAMILY_LABEL_KEYS, familyLabel } from './familyLabels'
import { DOMAIN_TIPS, ALL_TIPS, productionTip, tableTip, tipFor } from './tips'

describe('home tips', () => {
  it('has a tip for every domain and every skill, with the name filled in', () => {
    for (const d of DOMAINS) expect(DOMAIN_TIPS[d.id].length).toBeGreaterThan(20)
    for (const m of SKILLS) {
      const tip = tipFor(m.id, 'Ada')
      expect(tip).toMatch(/^at /)
      expect(tip).not.toContain('{navn}')
    }
    expect(tipFor('tenFriends', 'Ada')).toContain('Ada viser')
    expect(tipFor('tenFriends', '')).toContain('Barnet viser')
  })

  it('gives every 3. klasse skill a tip of its own, not only its domain\'s', () => {
    const third = SKILLS.filter((m) => m.grade === 3)
    expect(third).toHaveLength(16)
    for (const m of third) expect(tipFor(m.id, 'Ada'), m.id).not.toBe(DOMAIN_TIPS[m.domain].replaceAll('{navn}', 'Ada'))
    expect(new Set(third.map((m) => tipFor(m.id, 'Ada'))).size).toBe(16)
    expect(tipFor('fractionOfSet', 'Ada')).toContain('lade Ada dele')
  })

  it('follows the strategy of the app: plus with three digits from the ones (QA3b)', () => {
    const tip = tipFor('add1000', 'Ada')
    expect(tip.indexOf('enerne')).toBeGreaterThan(-1)
    expect(tip.indexOf('enerne')).toBeLessThan(tip.indexOf('tierne'))
    expect(tip.indexOf('tierne')).toBeLessThan(tip.indexOf('hundrederne'))
  })

  it('completes "Prøv …" as one short sentence without a full stop', () => {
    for (const tip of [...ALL_TIPS, tableTip(7), productionTip('Ada')]) {
      expect(tip.startsWith('at ')).toBe(true)
      expect(tip.endsWith('.')).toBe(false)
      expect(tip.length).toBeLessThan(140)
    }
  })

  it('stays off the screen and keeps the house rules', () => {
    for (const tip of [...ALL_TIPS, tableTip(7), productionTip('Ada')]) {
      expect(tip).not.toMatch(/[\u00d7\u00f7]/)
      expect(tip).not.toMatch(/\bapp(en)?\b|skærm|tablet|ipad|telefon|\bspillet\b/i)
      expect(tip).not.toMatch(/savner|ked af det|venter på dig|glem ikke|kom tilbage|lektie|streak|i træk/i)
    }
  })
})

describe('family labels', () => {
  it('names every family of every skill in words, never by its id', () => {
    for (const m of SKILLS) {
      for (const f of m.families) {
        const label = familyLabel(m.id, f.id)
        expect(label, `${m.id}/${f.id}`).not.toMatch(/^Del \d+$/)
        if (f.id.length > 3) expect(label, `${m.id}/${f.id}`).not.toBe(f.id)
        expect(label).not.toMatch(/[\u00d7\u00f7]/)
      }
    }
  })

  it('holds no labels for families that do not exist', () => {
    const known = new Set(SKILLS.flatMap((m) => m.families.map((f) => `${m.id}/${f.id}`)))
    expect(FAMILY_LABEL_KEYS.filter((k) => !known.has(k))).toEqual([])
  })

  it('prefers the label of the skill table', () => {
    expect(familyLabel('addTo10', 'small')).toBe('Til 5')
    expect(familyLabel('mul6to9', 't7')).toBe('7-tabellen')
  })
})
