// The multiplication and division skills of 2. klasse in Gangegrotten (SPEC §5.3), the only region that
// plays only them: whole rounds on every node, and the share kind playable on the keypad until its own
// view lands (src/ui/task/registry.ts).
import { describe, expect, it } from 'vitest'
import { NODES, REGION_BY_ID } from '../../../content/curriculum'
import { planRound } from '../../plan'
import { newProfile } from '../../testing/profile'
import { regionSuite } from '../algebra/testing/regions'
import { taskOf } from '../algebra/testing/suite'
import { getSkill } from '../../registry'
import { BUILT_KINDS, KIND_MODULES, moduleFor } from '../../../ui/task/registry'
import type { SkillId } from '../../types'

const MINE: ReadonlySet<SkillId> = new Set<SkillId>(['groupsOf', 'mul2510', 'shareEqually'])

regionSuite('the multiplication and division skills of 2. klasse', MINE, 'muldiv.ts', 'muldiv-2')

describe('Gangegrotten', () => {
  it('plays groupsOf, mul2510 and shareEqually (SPEC §5.3)', () => {
    expect(REGION_BY_ID['w2-gange'].skills.map((s) => s.skill)).toEqual(['groupsOf', 'mul2510', 'shareEqually'])
  })

  it('fills whole rounds on every node', () => {
    for (const slot of ['l1', 'l2', 'friend', 'l3', 'mix', 'trial']) {
      const node = NODES.find((n) => n.id === `w2-gange-${slot}`)!
      const plan = planRound(node, newProfile({ grade: 2 }), { day: '2026-10-02', sessionId: 's', audioVerified: true, seed: 5 })
      expect(plan.tasks.length, node.id).toBe(node.size)
    }
  })

  it('shows a share task on the keypad until the share view is built', () => {
    const t = taskOf(getSkill('shareEqually')!, 'shr:12:3', 'share')
    if (BUILT_KINDS.includes('share')) return
    expect(moduleFor(t)).toBe(KIND_MODULES.keypad)
    expect([t.answerType, t.range, t.maxDigits]).toEqual(['int', [0, 30], 2])
  })
})
