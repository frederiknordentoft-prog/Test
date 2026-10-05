// The multiplication and division skills of 3. klasse in the map (SPEC §5.3–5.4): Tabeltoppen plays mul34,
// mul6to9 and mulTens, Delekløften div2510 and divAll beside inverseOps (mulToDiv) and equalSides, and the
// finale of Stjernefjeldet draws from both. A fresh child of 3. klasse gets a playable round on every node,
// read with recorded clips, the trial asks only for production, and every clip of clips/skills/muldiv3.ts
// is spoken somewhere and recorded in wave 3.
import { describe, expect, it } from 'vitest'
import { NODES, REGION_BY_ID } from '../../../content/curriculum'
import { planRound } from '../../plan'
import { newProfile } from '../../testing/profile'
import { regionSuite } from '../algebra/testing/regions'
import { isProduction } from '../../kinds'
import type { SkillId } from '../../types'

const MINE: ReadonlySet<SkillId> = new Set<SkillId>(['mul34', 'mul6to9', 'mulTens', 'div2510', 'divAll'])
const ctx = { day: '2026-10-05', sessionId: 's', audioVerified: true }

regionSuite('the multiplication and division skills of 3. klasse', MINE, 'muldiv3.ts', 'muldiv-3', { wave: 3 })

describe('Tabeltoppen and Delekløften', () => {
  it('play the tables and the division where SPEC §5.3 says', () => {
    expect(REGION_BY_ID['w3-tabellen'].skills.map((s) => s.skill)).toEqual(['mul34', 'mul6to9', 'mulTens'])
    expect(REGION_BY_ID['w3-division'].skills.map((s) => s.skill)).toEqual(expect.arrayContaining(['div2510', 'divAll']))
  })

  for (const region of ['w3-tabellen', 'w3-division'] as const) {
    it(`fills a whole round on every node of ${region}, the trial with production only`, () => {
      const nodes = NODES.filter((n) => n.region === region)
      expect(nodes).toHaveLength(6)
      for (const node of nodes) {
        for (const seed of [3, 9]) {
          const plan = planRound(node, newProfile({ grade: 3 }), { ...ctx, seed })
          expect(plan.tasks.length, `${node.id} seed ${seed}`).toBe(node.size)
          // l2 introduces the region's other skills (SPEC §5.3)
          if (node.skills.some((s) => MINE.has(s.skill))) expect(plan.tasks.some((t) => MINE.has(t.skill)), node.id).toBe(true)
          if (node.production === 'only') for (const t of plan.tasks) expect(isProduction(t), `${node.id} ${t.factId} ${t.kind}`).toBe(true)
        }
      }
    })
  }
})
