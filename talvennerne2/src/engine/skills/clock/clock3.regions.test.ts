// The clock skills of 3. klasse in the map (SPEC §5.3–5.4): Minuttårnet plays clockFive, clockDigital and
// clockElapsed in rounds of 8, and the finale of Stjernefjeldet draws from it. A fresh child of 3. klasse gets
// a playable round on every node, read with recorded clips, the trial asks only for production (the dial),
// and every clip of clips/skills/clock3.ts is spoken somewhere and recorded in wave 3.
import { describe, expect, it } from 'vitest'
import { NODES, REGION_BY_ID } from '../../../content/curriculum'
import { planRound } from '../../plan'
import { newProfile } from '../../testing/profile'
import { regionSuite } from '../algebra/testing/regions'
import { isProduction } from '../../kinds'
import { compile } from '../../../speech/compile'
import type { SkillId } from '../../types'

const MINE: ReadonlySet<SkillId> = new Set<SkillId>(['clockFive', 'clockDigital', 'clockElapsed'])
const ctx = { day: '2026-10-05', sessionId: 's', audioVerified: true }

regionSuite('the clock skills of 3. klasse', MINE, 'clock3.ts', 'clock-3', { wave: 3 })

describe('Minuttårnet', () => {
  it('plays the three clock skills where SPEC §5.3 says, in rounds of 8, after Urtårnets top', () => {
    const region = REGION_BY_ID['w3-klokken']
    expect(region.skills.map((s) => s.skill)).toEqual(['clockFive', 'clockDigital', 'clockElapsed'])
    expect([region.roundSize, region.chain, region.requires]).toEqual([8, 'klokken', ['w2-klokken']])
  })

  it('fills a whole round on every node with the clocks, the trial with the dial only', () => {
    const nodes = NODES.filter((n) => n.region === 'w3-klokken')
    expect(nodes).toHaveLength(6)
    const families = new Set<string>()
    for (const node of nodes) {
      for (const seed of [3, 9, 27]) {
        const plan = planRound(node, newProfile({ grade: 3 }), { ...ctx, seed })
        expect(plan.tasks.length, `${node.id} seed ${seed}`).toBe(node.size)
        for (const t of plan.tasks) {
          expect(MINE.has(t.skill), `${node.id} ${t.skill}`).toBe(true)
          expect(compile(t.speech).missing, t.factId).toEqual([])
          families.add(t.masteryKey)
          if (node.production === 'only') expect([t.kind, isProduction(t)], `${node.id} ${t.factId}`).toEqual(['clockSet', true])
        }
      }
    }
    // every family of the three skills is played somewhere in the tower
    expect(families.size).toBe(5 + 2 + 4)
  })
})
