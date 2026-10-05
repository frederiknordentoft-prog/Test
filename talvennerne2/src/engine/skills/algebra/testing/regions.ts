// The SK2-ALG skills in the map nodes that play them (SPEC §5.3–5.4): a fresh child gets a playable
// round on every node, read with recorded clips, the trials ask only for production, and every clip of
// the skills' catalogue files is spoken somewhere. Shared by the algebra and muldiv region tests; lives
// in a subfolder so the registry never imports it.
import { describe, expect, it } from 'vitest'
import { NODES } from '../../../../content/curriculum'
import { planRound } from '../../../plan'
import { keysForNode, registeredSkills } from '../../../registry'
import { isCorrect } from '../../../answer'
import { isProduction } from '../../../kinds'
import { newProfile } from '../../../testing/profile'
import { compile } from '../../../../speech/compile'
import { allClips } from '../../../../speech/catalog'
import { factsUnderTest, tasksUnderTest } from '../../number/testing/harness'
import type { ErrorTag, SkillDef, SkillId } from '../../../types'

const ctx = { day: '2026-10-02', sessionId: 's', audioVerified: true }

/** `wave`: the catalogue file's recording wave (3 for Stjernefjeldet's skills). */
export function regionSuite(name: string, mine: ReadonlySet<SkillId>, clipFile: string, pack: string, wave: 2 | 3 = 2): void {
  const nodes = NODES.filter((n) => n.skills.some((s) => mine.has(s.skill)))

  describe(`${name} in the map`, () => {
    it('registers every skill', () => {
      const ids = new Set(registeredSkills().map((d) => d.id))
      for (const id of mine) expect(ids.has(id), id).toBe(true)
    })

    for (const node of nodes) {
      it(`plans a playable round on ${node.id}`, () => {
        const keys = keysForNode(node, { states: {}, audioVerified: true }).filter((k) => mine.has(k.skill))
        expect(keys.length).toBeGreaterThan(0)
        let seen = 0
        for (const seed of [1, 2, 3, 4]) {
          const plan = planRound(node, newProfile({ grade: node.world === 'fjeld' ? 3 : node.world === 'skov' ? 2 : 1 }), { ...ctx, seed })
          for (const t of plan.tasks.filter((x) => mine.has(x.skill))) {
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

    it(`records only clips that are spoken: every clip of clips/${clipFile} is used`, () => {
      const used = new Set<string>()
      const defs = registeredSkills().filter((d) => mine.has(d.id)) as SkillDef[]
      for (const def of defs) {
        used.add(def.canDo)
        for (const { fact, kind, task } of tasksUnderTest(def, 1)) {
          for (const c of compile(task.speech).clips) used.add(c)
          // words on the card ("så" between two equations) are clips too: the card shows their text
          if (task.prompt.scene === 'equation') for (const t of task.prompt.terms) if ('text' in t) used.add(t.text)
          const tags: (ErrorTag | null)[] = [null, 'near', 'operand', 'other', 'ambiguous', 'digitSwap', 'shareUnequal', ...Object.values(task.distractorTags)]
          for (const tag of new Set(tags)) for (const c of compile(def.hint(fact, tag, kind).speech).clips) used.add(c)
        }
        for (const f of factsUnderTest(def, 20)) for (const c of compile(def.hint(f, null).speech).clips) used.add(c)
      }
      const file = allClips().filter((c) => c.file === `skills/${clipFile}`)
      expect(file.length).toBeGreaterThan(10)
      expect(file.filter((c) => !used.has(c.id)).map((c) => c.id)).toEqual([])
      for (const c of file) expect([c.wave, c.pack], c.id).toEqual([wave, pack])
    })
  })
}
