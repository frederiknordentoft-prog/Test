// The shapes and fraction skills of 1.–2. klasse in the map (SPEC §5.3–5.4): Formværkstedet (w1-figurer)
// and Figurhaven (w2-figurer) play only them (and shapes2D, SK1): whole rounds on every node, read with
// recorded clips, production only in the trials, and every clip of clips/skills/shapes2.ts and
// clips/skills/fractions.ts spoken somewhere. The grid kind of symmetry plays on the keypad until the
// grid view of wave 3 exists (src/ui/task/registry.ts).
import { describe, expect, it } from 'vitest'
import { NODES, REGION_BY_ID } from '../../../content/curriculum'
import { planRound } from '../../plan'
import { getSkill } from '../../registry'
import { isProduction } from '../../kinds'
import { newProfile } from '../../testing/profile'
import { regionSuite } from '../algebra/testing/regions'
import { factById } from './testing/suite'
import { buildTask } from '../../tasks'
import { makeRng } from '../../rng'
import { BUILT_KINDS, KIND_MODULES, moduleFor } from '../../../ui/task/registry'
import type { SkillId } from '../../types'

const SHAPES: ReadonlySet<SkillId> = new Set<SkillId>(['sidesCorners', 'shapes3D', 'sortShapes', 'symmetry', 'composeShapes'])
const FRACTIONS: ReadonlySet<SkillId> = new Set<SkillId>(['halfShape', 'fractionShape'])

regionSuite('the shapes skills of 1.–2. klasse', SHAPES, 'shapes2.ts', 'shapes-2')
regionSuite('the fraction skills of 1.–2. klasse', FRACTIONS, 'fractions.ts', 'fractions-2')

describe('Formværkstedet and Figurhaven', () => {
  it('play the skills of SPEC §5.3', () => {
    expect(REGION_BY_ID['w1-figurer'].skills.map((s) => s.skill)).toEqual(['shapes2D', 'sidesCorners', 'shapes3D', 'sortShapes', 'symmetry', 'halfShape'])
    expect(REGION_BY_ID['w2-figurer'].skills.map((s) => s.skill)).toEqual(['composeShapes', 'symmetry', 'shapes3D', 'sortShapes', 'fractionShape'])
  })

  for (const region of ['w1-figurer', 'w2-figurer']) {
    it(`fills whole rounds on every node of ${region}, the trial with production only`, () => {
      for (const slot of ['l1', 'l2', 'chest', 'l3', 'mix', 'trial']) {
        const node = NODES.find((n) => n.id === `${region}-${slot}`)!
        for (const seed of [5, 6, 7]) {
          const plan = planRound(node, newProfile({ grade: region === 'w1-figurer' ? 1 : 2 }), { day: '2026-10-02', sessionId: 's', audioVerified: true, seed })
          expect(plan.tasks.length, node.id).toBe(node.size)
          if (slot === 'trial') for (const t of plan.tasks) expect(isProduction(t), `${t.factId} ${t.kind}`).toBe(true)
        }
      }
    })
  }

  it('shows a symmetry grid task on the keypad until the grid view is built', () => {
    const def = getSkill('symmetry')!
    for (const id of ['sym:grid:3', 'sym:line:3']) {
      const t = buildTask(def, factById(def, id), 'grid', makeRng(1), 0).task
      expect([t.answerType, typeof t.answer, t.range, t.maxDigits]).toEqual(['int', 'number', [0, 12], 2])
      if (BUILT_KINDS.includes('grid')) continue
      expect(moduleFor(t)).toBe(KIND_MODULES.keypad)
    }
  })

  it('colours fractionShape on the colorParts view (KIND2)', () => {
    const def = getSkill('fractionShape')!
    const t = buildTask(def, factById(def, 'frs:1/3:circle'), 'colorParts', makeRng(1), 0).task
    expect(moduleFor(t)).toBe(KIND_MODULES.colorParts)
  })
})
