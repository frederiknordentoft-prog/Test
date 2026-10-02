// The plus and minus skills of 1.–2. klasse in the map nodes that play them (SPEC §5.3–5.4): Dobbeltdalen,
// Tyvebroen, Tierhoppet, Vekselvandet, Hundredebroen and the two world finales. A fresh child gets a
// full round on every node, read with recorded clips, and the trials ask only for production.
import { describe, expect, it } from 'vitest'
import { NODES, REGION_BY_ID } from '../../../content/curriculum'
import { planRound } from '../../plan'
import { keysForNode, registeredSkills } from '../../registry'
import { isCorrect } from '../../answer'
import { isProduction } from '../../kinds'
import { newProfile } from '../../testing/profile'
import { compile } from '../../../speech/compile'
import { allClips } from '../../../speech/catalog'
import { factsUnderTest, tasksUnderTest } from '../number/testing/harness'
import type { ErrorTag, SkillDef, SkillId } from '../../types'

const MINE: ReadonlySet<SkillId> = new Set<SkillId>([
  'doubles', 'halves', 'addSub20Simple', 'addTo20', 'subTo20', 'tens100', 'add100NoCarry', 'sub100NoBorrow',
  'add100Carry', 'sub100Borrow', 'addSub1000Round',
])
const NODES_WITH_MINE = NODES.filter((n) => n.skills.some((s) => MINE.has(s.skill)))
const ctx = { day: '2026-10-02', sessionId: 's', audioVerified: true }

describe('the plus and minus regions of 1.–2. klasse', () => {
  it('registers all eleven skills', () => {
    const ids = new Set(registeredSkills().map((d) => d.id))
    for (const id of MINE) expect(ids.has(id), id).toBe(true)
  })

  it('places them where SPEC §5.3 says', () => {
    const skills = (region: string) => REGION_BY_ID[region].skills.map((s) => s.skill)
    expect(skills('w1-dobbelt')).toEqual(expect.arrayContaining(['doubles', 'halves']))
    expect(skills('w1-tieren')).toEqual(expect.arrayContaining(['addSub20Simple', 'addTo20', 'subTo20']))
    expect(skills('w1-tiere')).toEqual(['tens100', 'add100NoCarry', 'sub100NoBorrow'])
    expect(skills('w2-veksling')).toEqual(expect.arrayContaining(['add100Carry', 'sub100Borrow']))
    expect(skills('w2-hundreder')).toEqual(expect.arrayContaining(['addSub1000Round']))
  })

  for (const node of NODES_WITH_MINE) {
    it(`plans a playable round on ${node.id}`, () => {
      const keys = keysForNode(node, { states: {}, audioVerified: true }).filter((k) => MINE.has(k.skill))
      expect(keys.length).toBeGreaterThan(0)
      let seen = 0
      for (const seed of [1, 2, 3]) {
        const plan = planRound(node, newProfile({ grade: node.world === 'skov' ? 2 : 1 }), { ...ctx, seed })
        const mine = plan.tasks.filter((t) => MINE.has(t.skill))
        // a world finale spreads its twelve tasks over every region: one seed may hold none of these
        if (node.slot !== 'finale') expect(mine.length, `${node.id} seed ${seed}`).toBeGreaterThan(0)
        seen += mine.length
        for (const t of mine) {
          const where = `${node.id} ${t.factId} ${t.kind}`
          const c = compile(t.speech)
          expect(c.missing, where).toEqual([])
          expect(c.text, where).not.toMatch(/\d/)
          expect(isCorrect(t, t.answer), where).toBe(true)
          if (t.kind === 'choice') expect(t.options).toHaveLength(3)
          if (node.production === 'only') expect(isProduction(t), where).toBe(true)
        }
      }
      expect(seen, node.id).toBeGreaterThan(0)
    })
  }

  it('fills whole rounds where the region has only these skills (Tierhoppet)', () => {
    for (const slot of ['l1', 'l2', 'chest', 'l3', 'mix', 'trial']) {
      const node = NODES.find((n) => n.id === `w1-tiere-${slot}`)!
      const plan = planRound(node, newProfile(), { ...ctx, seed: 7 })
      expect(plan.tasks.length, node.id).toBe(node.size)
    }
  })

  it('records only clips that are spoken: every clip of clips/skills/addsub2.ts is used', () => {
    const used = new Set<string>()
    const defs = registeredSkills().filter((d) => MINE.has(d.id)) as SkillDef[]
    const tags: (ErrorTag | null)[] = [null, 'near', 'operand', 'other', 'ambiguous', 'forgotCarry', 'smallerFromLarger', 'borrowNoDecrement',
      'placeMisalign', 'wrongOperation', 'countFromFirst', 'tensZero', 'digitComplement10', 'digitSwap']
    for (const def of defs) {
      used.add(def.canDo)
      for (const { task } of tasksUnderTest(def, 1)) for (const c of compile(task.speech).clips) used.add(c)
      for (const f of factsUnderTest(def, 40)) for (const tag of tags) for (const c of compile(def.hint(f, tag).speech).clips) used.add(c)
    }
    const mine = allClips().filter((c) => c.file === 'skills/addsub2.ts')
    expect(mine.length).toBeGreaterThan(40)
    expect(mine.filter((c) => !used.has(c.id)).map((c) => c.id)).toEqual([])
    for (const c of mine) expect([c.wave, c.pack], c.id).toEqual([2, 'addsub-2'])
  })
})
