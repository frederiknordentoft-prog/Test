// The measure skills of 1.–2. klasse in the map nodes that play them (SPEC §5.3–5.4): Målebakken
// (measureUnits, rulerRead from0, weightCompare — its first stone asks only these three), Linealstien
// (rulerRead offset, unitChoice length, readChart), Markedet (unitChoice weight, 3. klasse) and the world
// finales. A fresh child gets a whole round on every node, read with recorded clips, the trials ask
// only for production, and every clip of clips/skills/measure2.ts is spoken somewhere.
import { describe, expect, it } from 'vitest'
import { NODES, NODE_BY_ID, REGION_BY_ID } from '../../../content/curriculum'
import { planRound } from '../../plan'
import { keysForNode, registeredSkills } from '../../registry'
import { isCorrect } from '../../answer'
import { isProduction } from '../../kinds'
import { newProfile } from '../../testing/profile'
import { compile } from '../../../speech/compile'
import { allClips, clipInfo } from '../../../speech/catalog'
import { factsUnderTest, tasksUnderTest } from '../number/testing/harness'
import type { ErrorTag, SkillDef, SkillId } from '../../types'

const MINE: ReadonlySet<SkillId> = new Set<SkillId>(['measureUnits', 'rulerRead', 'weightCompare', 'unitChoice', 'readChart'])
// Stjernefjeldet's nodes (Markedet and the finale) are 3. klasse's: there unitChoice's weight family shares the
// rounds with kronerOre and convertCmM, and measure3.regions.test.ts plays it (SK3-MAAL)
const NODES_WITH_MINE = NODES.filter((n) => n.world !== 'fjeld' && n.skills.some((s) => MINE.has(s.skill)))
const ctx = { day: '2026-10-02', sessionId: 's', audioVerified: true }
const gradeOf = (world: string) => (world === 'fjeld' ? 3 : world === 'skov' ? 2 : 1)

describe('the measure regions of 1.–2. klasse', () => {
  it('registers all five skills', () => {
    const ids = new Set(registeredSkills().map((d) => d.id))
    for (const id of MINE) expect(ids.has(id), id).toBe(true)
  })

  it('places them where SPEC §5.3 says', () => {
    const skills = (region: string) => REGION_BY_ID[region].skills.filter((s) => MINE.has(s.skill)).map((s) => [s.skill, s.families ?? null])
    expect(skills('w1-maal-penge')).toEqual([['measureUnits', null], ['rulerRead', ['from0']], ['weightCompare', null]])
    expect(skills('w2-maal-data')).toEqual([['rulerRead', ['offset']], ['unitChoice', ['length']], ['readChart', null]])
    expect(skills('w3-penge-maal')).toEqual([['unitChoice', ['weight']]])
  })

  it('gives Målebakken\'s first stone a whole round of its measure skills', () => {
    const node = NODE_BY_ID['w1-maal-penge-l1']
    expect(node.skills.map((s) => s.skill)).toEqual(['measureUnits', 'rulerRead', 'weightCompare'])
    for (const seed of [1, 2, 3]) {
      const plan = planRound(node, newProfile({ grade: 1 }), { ...ctx, seed })
      expect(plan.tasks).toHaveLength(node.size)
      expect(new Set(plan.tasks.map((t) => t.skill))).toEqual(new Set(['measureUnits', 'rulerRead', 'weightCompare']))
    }
  })

  for (const node of NODES_WITH_MINE) {
    it(`plans a playable round on ${node.id}`, () => {
      const keys = keysForNode(node, { states: {}, audioVerified: true }).filter((k) => MINE.has(k.skill))
      expect(keys.length).toBeGreaterThan(0)
      for (const k of keys) {
        const families = node.skills.find((s) => s.skill === k.skill)?.families
        if (families) expect(families, k.key).toContain(k.family)
      }
      let seen = 0
      for (const seed of [1, 2, 3, 4]) {
        const plan = planRound(node, newProfile({ grade: gradeOf(node.world) }), { ...ctx, seed })
        expect(plan.tasks.length, node.id).toBe(node.size)
        for (const t of plan.tasks.filter((x) => MINE.has(x.skill))) {
          seen++
          const where = `${node.id} ${t.factId} ${t.kind}`
          const c = compile(t.speech)
          expect(c.missing, where).toEqual([])
          expect(c.text, where).not.toMatch(/\d/)
          expect(isCorrect(t, t.answer), where).toBe(true)
          if (t.kind === 'choice') expect(t.options, where).toHaveLength(3)
          if (node.production === 'only') expect(isProduction(t), where).toBe(true)
        }
      }
      expect(seen, node.id).toBeGreaterThan(0)
    })
  }

  it('keeps unitChoice\'s weight family (3. klasse) out of Linealstien', () => {
    for (const node of NODES.filter((n) => n.region === 'w2-maal-data')) {
      for (const k of keysForNode(node, { states: {}, audioVerified: true })) expect(k.key.startsWith('enh:weight:'), k.key).toBe(false)
    }
    const market = keysForNode(NODE_BY_ID['w3-penge-maal-l3'], { states: {}, audioVerified: true }).filter((k) => k.skill === 'unitChoice')
    expect(market.map((k) => k.family)).toEqual(Array.from({ length: 8 }, () => 'weight'))
  })
})

describe('clips/skills/measure2.ts', () => {
  const defs = registeredSkills().filter((d) => MINE.has(d.id)) as SkillDef[]
  const file = allClips().filter((c) => c.file === 'skills/measure2.ts')

  it('records only clips that are spoken: every clip is used', () => {
    const used = new Set<string>()
    for (const def of defs) {
      used.add(def.canDo)
      for (const { fact, kind, task } of tasksUnderTest(def, 1)) {
        for (const c of compile(task.speech).clips) used.add(c)
        for (const c of task.optionClips ?? []) used.add(c)
        const tags: (ErrorTag | null)[] = [null, 'near', 'operand', 'other', 'ambiguous', 'digitSwap', ...Object.values(task.distractorTags)]
        for (const tag of new Set(tags)) for (const c of compile(def.hint(fact, tag, kind).speech).clips) used.add(c)
      }
      for (const f of factsUnderTest(def, 20)) for (const c of compile(def.hint(f, null).speech).clips) used.add(c)
    }
    expect(file.length).toBeGreaterThan(50)
    expect(file.filter((c) => !used.has(c.id)).map((c) => c.id)).toEqual([])
  })

  it('has no digits, wave 2 except what only unitChoice\'s weight family (3. klasse) says', () => {
    const weightOnly = /^(s\.unitChoice\.(tapG|tapKg|q\.(feather|strawberry|key|letter|dog|bike|sofa|suitcase))|noun\.mt\.(feather|strawberry|key|letter|dog|bike|sofa|suitcase)|hint\.unitChoice\.(weightRule|weighedIn|weightUnits))$/
    for (const c of file) {
      expect(c.text, c.id).not.toMatch(/\d/)
      expect([c.wave, c.pack], c.id).toEqual(weightOnly.test(c.id) ? [3, 'measure-3'] : [2, 'measure-2'])
    }
  })

  it('never needs a wave 3 clip for a 1.–2. klasse task, its cards or its hints', () => {
    for (const def of defs) {
      for (const { fact, kind, task } of tasksUnderTest(def, 1)) {
        if (fact.family === 'weight') continue
        const clips = [...compile(task.speech).clips, ...(task.optionClips ?? []), ...compile(def.hint(fact, null, kind).speech).clips]
        for (const id of clips) expect(clipInfo(id)?.wave ?? 1, `${fact.id} ${id}`).toBeLessThanOrEqual(2)
      }
    }
  })
})
