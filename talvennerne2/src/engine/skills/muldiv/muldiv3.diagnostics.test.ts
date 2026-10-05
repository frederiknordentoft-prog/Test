// The misconceptions of the multiplication and division skills of 3. klasse through the real diagnostics
// (SPEC §4.3): a child who keeps making one mistake is flagged for it; a child who answers right, and a
// child who guesses 500 times, never is. div2510's share view can only hand in the right deal or an
// uneven one (−1, 'shareUnequal', never evidence), so it is guessed on as well.
import { describe, expect, it } from 'vitest'
import { flagsRaised } from '../number/testing/harness'
import { always, builder, guesser, right } from '../algebra/testing/diagnose'
import type { ErrorTag, SkillId, TaskKind } from '../../types'

const CASES: { skill: SkillId; node: string; tags: ErrorTag[] }[] = [
  { skill: 'mul34', node: 'w3-tabellen-l3', tags: ['tableNeighbour', 'mulAsAdd'] },
  { skill: 'mul6to9', node: 'w3-tabellen-l3', tags: ['tableNeighbour', 'mulAsAdd'] },
  { skill: 'mulTens', node: 'w3-tabellen-l3', tags: ['tensZero', 'tableNeighbour', 'mulAsAdd'] },
  { skill: 'div2510', node: 'w3-division-l3', tags: ['tableNeighbour', 'wrongOperation'] },
  { skill: 'divAll', node: 'w3-division-l3', tags: ['tableNeighbour', 'wrongOperation'] },
]
const KINDS: TaskKind[] = ['choice', 'keypad', 'keypad']

describe('diagnostics of the multiplication and division skills of 3. klasse (SPEC §4.3)', () => {
  for (const { skill, node, tags } of CASES) {
    describe(skill, () => {
      for (const tag of tags) {
        it(`flags a child who keeps answering with ${tag}`, () => {
          expect([...flagsRaised(builder(node, skill, KINDS), 160, always(tag))]).toContain(tag)
        })
      }

      it('flags nothing for a child who answers right', () => {
        expect([...flagsRaised(builder(node, skill, KINDS), 120, right)]).toEqual([])
      })

      it('flags nothing for a child who guesses (500 answers)', () => {
        expect([...flagsRaised(builder(node, skill, KINDS), 500, guesser(31))]).toEqual([])
      })

      it('flags nothing for a child who guesses on the share view too', () => {
        if (skill !== 'div2510') return
        expect([...flagsRaised(builder(node, skill, ['share', 'choice', 'keypad']), 500, guesser(37))]).toEqual([])
      })
    })
  }
})
