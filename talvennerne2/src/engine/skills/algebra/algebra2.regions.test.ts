// The algebra skills of 1.–2. klasse where SPEC §5.3 plays them: Dobbeltdalen (skipCount), Tyvebroen
// (missingPart10), Vekselvandet (missingPart100, inverseOps), Hundredebroen (skipCount step100,
// equalSides), their 3. klasse families in Delekløften and Arealhaven, and the world finales.
import { describe, expect, it } from 'vitest'
import { REGION_BY_ID } from '../../../content/curriculum'
import { regionSuite } from './testing/regions'
import type { SkillId } from '../../types'

const MINE: ReadonlySet<SkillId> = new Set<SkillId>(['missingPart10', 'skipCount', 'missingPart100', 'inverseOps', 'equalSides'])

regionSuite('the algebra skills of 1.–2. klasse', MINE, 'algebra2.ts', 'algebra-2')

describe('algebra regions', () => {
  it('places the skills where SPEC §5.3 says', () => {
    const skills = (region: string) => REGION_BY_ID[region].skills.map((s) => s.skill)
    expect(skills('w1-dobbelt')).toContain('skipCount')
    expect(skills('w1-tieren')).toContain('missingPart10')
    expect(skills('w2-veksling')).toEqual(expect.arrayContaining(['missingPart100', 'inverseOps']))
    expect(skills('w2-hundreder')).toEqual(expect.arrayContaining(['skipCount', 'equalSides']))
  })
})
