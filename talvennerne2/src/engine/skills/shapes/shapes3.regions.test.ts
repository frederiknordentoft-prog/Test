// SK3-GEO's skills in Stjernefjeldet (SPEC §5.3–5.4, A21): Arealhaven (w3-areal: area and gridCoords,
// beside sortShapes rightAngle and skipCount step25) and Brøkbageriet (w3-broeker: fractionOfSet and
// fractionCompare, beside fractionShape nonUnit). Whole rounds on every node, read with recorded clips,
// production only in the trials and the finale, every clip of clips/skills/shapes3.ts and
// fractions3.ts spoken somewhere, and gridCoords' points played on the grid view where only
// production counts: Arealhaven's trial and the world finale.
import { describe, expect, it } from 'vitest'
import { NODES, REGION_BY_ID } from '../../../content/curriculum'
import { planRound } from '../../plan'
import { isProduction } from '../../kinds'
import { newProfile } from '../../testing/profile'
import { regionSuite } from '../algebra/testing/regions'
import { KIND_MODULES, moduleFor, shownKind } from '../../../ui/task/registry'
import type { SkillId, Task } from '../../types'

const SHAPES: ReadonlySet<SkillId> = new Set<SkillId>(['area', 'gridCoords'])
const FRACTIONS: ReadonlySet<SkillId> = new Set<SkillId>(['fractionOfSet', 'fractionCompare'])

regionSuite('the shapes skills of 3. klasse', SHAPES, 'shapes3.ts', 'shapes-3', 3)
regionSuite('the fraction skills of 3. klasse', FRACTIONS, 'fractions3.ts', 'fractions-3', 3)

const node = (id: string) => NODES.find((n) => n.id === id)!
const plan = (id: string, seed: number) =>
  planRound(node(id), newProfile({ grade: 3 }), { day: '2026-10-05', sessionId: 's', audioVerified: true, seed }).tasks

/** Tasks of one skill over enough seeded plans of a node. */
function tasksOf(id: string, skill: SkillId, want = 6): Task[] {
  const out: Task[] = []
  for (let seed = 1; seed <= 40 && out.length < want; seed++) out.push(...plan(id, seed).filter((t) => t.skill === skill))
  return out
}

describe('Arealhaven and Brøkbageriet', () => {
  it('play the skills of SPEC §5.3', () => {
    expect(REGION_BY_ID['w3-areal'].skills.map((s) => s.skill)).toEqual(['area', 'gridCoords', 'sortShapes', 'skipCount'])
    expect(REGION_BY_ID['w3-broeker'].skills.map((s) => s.skill)).toEqual(['fractionOfSet', 'fractionCompare', 'fractionShape'])
  })

  for (const region of ['w3-areal', 'w3-broeker']) {
    it(`fills whole rounds on every node of ${region}, the trial with production only`, () => {
      for (const slot of ['l1', 'l2', 'chest', 'friend', 'l3', 'mix', 'trial']) {
        const n = NODES.find((x) => x.id === `${region}-${slot}`)
        if (!n) continue
        for (const seed of [5, 6, 7]) {
          const tasks = plan(n.id, seed)
          expect(tasks.length, n.id).toBe(n.size)
          if (slot === 'trial') for (const t of tasks) expect(isProduction(t), `${t.factId} ${t.kind}`).toBe(true)
        }
      }
    })
  }

  it('plays gridCoords on the grid view in Arealhaven’s trial and in the finale (A21)', () => {
    for (const id of ['w3-areal-trial', 'fjeld-finale']) {
      const grid = tasksOf(id, 'gridCoords')
      expect(grid.length, id).toBeGreaterThan(0)
      for (const t of grid) {
        const where = `${id} ${t.factId}`
        expect([t.kind, t.answerType, isProduction(t)], where).toEqual(['grid', 'set', true])
        expect(shownKind(t), where).toBe('grid')
        expect(moduleFor(t), where).toBe(KIND_MODULES.grid)
      }
    }
  })

  it('deals fractionOfSet out on the share view (or types it) in Brøkbageriet’s trial, and sorts fractionCompare', () => {
    const tasks = tasksOf('w3-broeker-trial', 'fractionOfSet', 12)
    const deal = tasks.filter((t) => t.kind === 'share')
    expect(deal.length).toBeGreaterThan(0)
    for (const t of tasks) expect(['share', 'keypad'], t.factId).toContain(t.kind)
    for (const t of deal) expect(moduleFor(t), t.factId).toBe(KIND_MODULES.share)
    const sort = tasksOf('w3-broeker-trial', 'fractionCompare')
    expect(sort.length).toBeGreaterThan(0)
    for (const t of sort) expect([t.kind, t.options.length], t.factId).toEqual(['sortOrder', 4])
  })

  it('asks area on the keypad in the trial and the finale', () => {
    for (const id of ['w3-areal-trial', 'fjeld-finale']) {
      const area = tasksOf(id, 'area')
      expect(area.length, id).toBeGreaterThan(0)
      for (const t of area) expect([t.kind, moduleFor(t) === KIND_MODULES.keypad], t.factId).toEqual(['keypad', true])
    }
  })
})
