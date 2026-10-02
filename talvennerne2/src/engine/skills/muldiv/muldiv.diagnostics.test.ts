// The misconceptions of the multiplication and division skills of 2. klasse through the real diagnostics
// (SPEC §4.3): a child who keeps making one mistake is flagged for it; a child who answers right, and a
// child who guesses 500 times, never is. shareEqually is asked on cards and the keypad here: the share
// view can only hand in the right deal or an uneven one (−1, 'shareUnequal', never evidence).
import { describe, expect, it } from 'vitest'
import { flagsRaised } from '../number/testing/harness'
import { always, builder, guesser, right } from '../algebra/testing/diagnose'
import type { ErrorTag, SkillId, TaskKind } from '../../types'

const CASES: { skill: SkillId; kinds: TaskKind[]; tags: ErrorTag[] }[] = [
  { skill: 'groupsOf', kinds: ['choice', 'keypad', 'keypad'], tags: ['mulAsAdd'] },
  { skill: 'mul2510', kinds: ['choice', 'keypad', 'keypad'], tags: ['tableNeighbour', 'mulAsAdd'] },
  { skill: 'shareEqually', kinds: ['choice', 'keypad', 'keypad'], tags: ['wrongOperation'] },
]

describe('diagnostics of the multiplication and division skills of 2. klasse (SPEC §4.3)', () => {
  for (const { skill, kinds, tags } of CASES) {
    describe(skill, () => {
      for (const tag of tags) {
        it(`flags a child who keeps answering with ${tag}`, () => {
          expect([...flagsRaised(builder('w2-gange-l3', skill, kinds), 160, always(tag))]).toContain(tag)
        })
      }

      it('flags nothing for a child who answers right', () => {
        expect([...flagsRaised(builder('w2-gange-l3', skill, kinds), 120, right)]).toEqual([])
      })

      it('flags nothing for a child who guesses (500 answers)', () => {
        expect([...flagsRaised(builder('w2-gange-l3', skill, kinds), 500, guesser(31))]).toEqual([])
      })

      it('flags nothing for a child who guesses on the share view too', () => {
        if (skill !== 'shareEqually') return
        expect([...flagsRaised(builder('w2-gange-l3', skill, ['share', 'choice', 'keypad']), 500, guesser(37))]).toEqual([])
      })
    })
  }
})
