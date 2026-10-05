// Gate G3 (SPEC §14 F4, §2.2), ORK3a: every one of the 72 skills is registered from its own file in
// src/engine/skills/<domain>/ and agrees with its row in src/content/skills.ts. SK3-MAAL brought the last five
// (clockFive, clockDigital, clockElapsed, kronerOre, convertCmM); the gate itself was it.fails until then.
import { describe, expect, it } from 'vitest'
import { SKILL_IDS } from './types'
import { SKILL_BY_ID } from '../content/skills'
import { registeredSkills, validateSkill } from './registry'

describe('the skill register of all three waves (gate G3)', () => {
  it('registers every skill once, each agreeing with its metadata row; 16 of the 72 rows are 3. klasse', () => {
    const ids = registeredSkills().map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const def of registeredSkills()) expect(validateSkill(def), def.id).toEqual([])
    expect(SKILL_IDS.length).toBe(72)
    expect(SKILL_IDS.filter((id) => SKILL_BY_ID[id].grade === 3).length).toBe(16)
  })

  it('registers all 72 skills of SPEC §2.2', () => {
    const ids = registeredSkills().map((d) => d.id)
    expect([...ids].sort()).toEqual([...SKILL_IDS].sort())
    expect(ids.length).toBe(72)
  })
})
