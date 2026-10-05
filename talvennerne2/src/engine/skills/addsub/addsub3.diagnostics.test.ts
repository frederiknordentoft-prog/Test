// The misconceptions of the plus and minus skills of 3. klasse through the real diagnostics (SPEC §4.3): a
// child who keeps making one mistake is flagged for it; a child who answers right, and a child who guesses
// 500 times, never is.
import { describe, expect, it } from 'vitest'
import { flagsRaised } from '../number/testing/harness'
import { always, builder, guesser, right } from '../algebra/testing/diagnose'
import type { ErrorTag, SkillId, TaskKind } from '../../types'

const CASES: { skill: SkillId; tags: ErrorTag[] }[] = [
  { skill: 'add1000', tags: ['forgotCarry', 'placeMisalign', 'wrongOperation'] },
  { skill: 'sub1000', tags: ['smallerFromLarger', 'borrowNoDecrement', 'wrongOperation'] },
]
const NODE = 'w3-store-tal-l3'
const KINDS: TaskKind[] = ['choice', 'keypad', 'keypad']

describe('diagnostics of the plus and minus skills of 3. klasse (SPEC §4.3)', () => {
  for (const { skill, tags } of CASES) {
    describe(skill, () => {
      for (const tag of tags) {
        it(`flags a child who keeps answering with ${tag}`, () => {
          expect([...flagsRaised(builder(NODE, skill, KINDS), 160, always(tag))]).toContain(tag)
        })
      }

      it('flags nothing for a child who answers right', () => {
        expect([...flagsRaised(builder(NODE, skill, KINDS), 120, right)]).toEqual([])
      })

      it('flags nothing for a child who guesses (500 answers)', () => {
        expect([...flagsRaised(builder(NODE, skill, KINDS), 500, guesser(31))]).toEqual([])
      })
    })
  }
})
