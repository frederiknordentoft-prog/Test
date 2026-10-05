// Gate G3 (SPEC §14 F4, §2.2), ORK3a: every one of the 72 skills is registered from its own file in
// src/engine/skills/<domain>/ and agrees with its row in src/content/skills.ts. Until SK3-MAAL is merged five
// skills are missing (clockFive, clockDigital, clockElapsed, kronerOre, convertCmM), so the gate itself is
// it.fails; the integrator drops `.fails` when SK3-MAAL lands. The test before it pins down that those five
// are the only ones missing, so the gate fails for that reason and no other.
import { describe, expect, it } from 'vitest'
import { SKILL_IDS, type SkillId } from './types'
import { SKILL_BY_ID } from '../content/skills'
import { registeredSkills, validateSkill } from './registry'

/** What SK3-MAAL brings (clock and money/measure of 3. klasse). */
const SK3_MAAL: readonly SkillId[] = ['clockFive', 'clockDigital', 'clockElapsed', 'kronerOre', 'convertCmM']

describe('the skill register of all three waves (gate G3)', () => {
  it('registers every skill but SK3-MAAL’s five, each once and agreeing with its metadata row; the wave-3 skills merged so far are in', () => {
    const ids = registeredSkills().map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    const missing = SKILL_IDS.filter((id) => !ids.includes(id))
    expect(missing.filter((id) => !SK3_MAAL.includes(id))).toEqual([])
    for (const def of registeredSkills()) expect(validateSkill(def), def.id).toEqual([])
    for (const id of ['add1000', 'sub1000', 'mul34', 'mul6to9', 'div2510', 'divAll', 'mulTens', 'area', 'gridCoords', 'fractionOfSet', 'fractionCompare'] as const) {
      expect(ids, id).toContain(id)
    }
    // the metadata table has all 72 rows, 16 of them 3. klasse
    expect(SKILL_IDS.length).toBe(72)
    expect(SKILL_IDS.filter((id) => SKILL_BY_ID[id].grade === 3).length).toBe(16)
  })

  it.fails('registers all 72 skills of SPEC §2.2 (fails until SK3-MAAL is merged: clockFive, clockDigital, clockElapsed, kronerOre, convertCmM)', () => {
    const ids = registeredSkills().map((d) => d.id)
    expect([...ids].sort()).toEqual([...SKILL_IDS].sort())
    expect(ids.length).toBe(72)
  })
})
