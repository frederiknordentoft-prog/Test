// The misconceptions of the algebra skills of 1.–2. klasse (and their 3. klasse families) through the
// real diagnostics (SPEC §4.3): a child who keeps making one mistake is flagged for it; a child who
// answers right, and a child who guesses 500 times, never is.
import { describe, expect, it } from 'vitest'
import { flagsRaised } from '../number/testing/harness'
import { always, builder, guesser, right } from './testing/diagnose'
import type { ErrorTag, SkillId, TaskKind } from '../../types'

const CASES: { skill: SkillId; node: string; kinds: TaskKind[]; tags: ErrorTag[] }[] = [
  { skill: 'missingPart10', node: 'w1-tieren-l3', kinds: ['choice', 'keypad', 'keypad'], tags: ['equalsAsAnswer'] },
  { skill: 'skipCount', node: 'w1-dobbelt-l3', kinds: ['choice', 'keypad', 'fillSlots'], tags: ['skipStepOne'] },
  { skill: 'skipCount', node: 'w2-hundreder-l3', kinds: ['choice', 'keypad', 'fillSlots'], tags: ['skipStepOne'] },
  { skill: 'skipCount', node: 'w3-areal-l3', kinds: ['choice', 'keypad', 'fillSlots'], tags: ['skipStepOne'] },
  { skill: 'missingPart100', node: 'w2-veksling-l3', kinds: ['choice', 'keypad', 'keypad'], tags: ['equalsAsAnswer', 'digitComplement10', 'wrongOperation'] },
  { skill: 'inverseOps', node: 'w2-veksling-l3', kinds: ['choice', 'keypad', 'keypad'], tags: ['wrongOperation'] },
  { skill: 'inverseOps', node: 'w3-division-l3', kinds: ['choice', 'keypad', 'keypad'], tags: ['wrongOperation'] },
  { skill: 'equalSides', node: 'w2-hundreder-l3', kinds: ['trueFalse', 'choice', 'keypad'], tags: ['equalsAsAnswer'] },
  { skill: 'equalSides', node: 'w3-division-l3', kinds: ['trueFalse', 'choice', 'keypad'], tags: ['equalsAsAnswer'] },
]

describe('diagnostics of the algebra skills of 1.–2. klasse (SPEC §4.3)', () => {
  for (const { skill, node, kinds, tags } of CASES) {
    describe(`${skill} on ${node}`, () => {
      for (const tag of tags) {
        it(`flags a child who keeps answering with ${tag}`, () => {
          expect([...flagsRaised(builder(node, skill, kinds), 160, always(tag))]).toContain(tag)
        })
      }

      it('flags nothing for a child who answers right', () => {
        expect([...flagsRaised(builder(node, skill, kinds), 120, right)]).toEqual([])
      })

      it('flags nothing for a child who guesses (500 answers)', () => {
        expect([...flagsRaised(builder(node, skill, kinds), 500, guesser(31))]).toEqual([])
      })
    })
  }
})
