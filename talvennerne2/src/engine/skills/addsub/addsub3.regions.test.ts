// The plus and minus skills of 3. klasse in the map (SPEC §5.3–5.4): Trecifret bro plays add1000 and sub1000
// beside the rounding of numberLine1000 and the regrouping of placeValue1000, in rounds of 8, and the finale
// of Stjernefjeldet draws from it. A fresh child of 3. klasse gets a playable round on every node, read with
// recorded clips, the trial asks only for production, and every clip of clips/skills/addsub3.ts is spoken
// somewhere and recorded in wave 3.
import { describe, expect, it } from 'vitest'
import { NODES, REGION_BY_ID } from '../../../content/curriculum'
import { planRound } from '../../plan'
import { newProfile } from '../../testing/profile'
import { regionSuite } from '../algebra/testing/regions'
import { isProduction } from '../../kinds'
import type { SkillId } from '../../types'

const MINE: ReadonlySet<SkillId> = new Set<SkillId>(['add1000', 'sub1000'])
const ctx = { day: '2026-10-05', sessionId: 's', audioVerified: true }

regionSuite('the plus and minus skills of 3. klasse', MINE, 'addsub3.ts', 'addsub-3', { wave: 3, minClips: 10 })

describe('Trecifret bro', () => {
  it('plays add1000 and sub1000 where SPEC §5.3 says, in rounds of 8', () => {
    expect(REGION_BY_ID['w3-store-tal'].skills.map((s) => s.skill)).toEqual(expect.arrayContaining(['add1000', 'sub1000']))
    expect(REGION_BY_ID['w3-store-tal'].roundSize).toBe(8)
  })

  it('fills a whole round on every node, the trial with production only', () => {
    const nodes = NODES.filter((n) => n.region === 'w3-store-tal')
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
})
