// The misconceptions of the plus and minus skills of 1.–2. klasse through the real diagnostics (SPEC §4.3):
// a child who keeps making one mistake is flagged for it, a child who answers right or guesses is not.
// (Random slips of one have their own test, misconceptions.slips.test.ts, SPEC A10.)
import { describe, expect, it } from 'vitest'
import { NODE_BY_ID } from '../../../content/curriculum'
import { keysForNode } from '../../registry'
import { makeRng } from '../../rng'
import { flagsRaised } from '../number/testing/harness'
import type { AnswerValue, ErrorTag, SkillId, Task } from '../../types'

const ctx = { states: {}, audioVerified: true }
const keysOf = (node: string, skill: SkillId) => keysForNode(NODE_BY_ID[node], ctx).filter((k) => k.skill === skill)

/** Every third task on cards, the rest typed; the key drawn independently of the kind. */
function builder(node: string, skill: SkillId) {
  const keys = keysOf(node, skill)
  const pick = makeRng(77)
  return (i: number): Task => keys[pick.int(keys.length)].build(i % 3 === 0 ? 'choice' : 'keypad', makeRng(1000 + i), i)
}

/** The child gives the value tagged `tag` whenever the task has one it can give (a card shown, or typed). */
const always = (tag: ErrorTag) => (t: Task): AnswerValue => {
  const hit = Object.entries(t.distractorTags).find(([k, x]) => x === tag && (t.kind !== 'choice' || t.options.map(String).includes(k)))
  return hit ? Number(hit[0]) : t.answer
}

const right = (t: Task): AnswerValue => t.answer

function guesser(seed: number) {
  const rng = makeRng(seed)
  return (t: Task): AnswerValue => (t.kind === 'choice' ? rng.pick(t.options) : rng.between(t.range[0], t.range[1]))
}

const CASES: { skill: SkillId; node: string; tags: ErrorTag[] }[] = [
  { skill: 'addTo20', node: 'w1-tieren-l3', tags: ['countFromFirst', 'forgotCarry', 'wrongOperation'] },
  { skill: 'subTo20', node: 'w1-tieren-l3', tags: ['countFromFirst', 'smallerFromLarger', 'borrowNoDecrement', 'wrongOperation'] },
  { skill: 'doubles', node: 'w1-dobbelt-l3', tags: ['wrongOperation'] },
  { skill: 'halves', node: 'w1-dobbelt-l3', tags: ['wrongOperation'] },
  { skill: 'addSub20Simple', node: 'w1-tieren-l3', tags: ['wrongOperation'] },
  { skill: 'tens100', node: 'w1-tiere-l3', tags: ['tensZero', 'wrongOperation'] },
  { skill: 'add100NoCarry', node: 'w1-tiere-l3', tags: ['placeMisalign', 'wrongOperation'] },
  { skill: 'sub100NoBorrow', node: 'w1-tiere-l3', tags: ['wrongOperation'] },
  { skill: 'add100Carry', node: 'w2-veksling-l3', tags: ['forgotCarry', 'placeMisalign', 'wrongOperation'] },
  { skill: 'sub100Borrow', node: 'w2-veksling-l3', tags: ['smallerFromLarger', 'borrowNoDecrement', 'digitComplement10', 'wrongOperation'] },
  { skill: 'addSub1000Round', node: 'w2-hundreder-l3', tags: ['tensZero', 'forgotCarry', 'wrongOperation'] },
]

describe('diagnostics of the plus and minus skills of 1.–2. klasse (SPEC §4.3)', () => {
  for (const { skill, node, tags } of CASES) {
    describe(skill, () => {
      for (const tag of tags) {
        it(`flags a child who keeps answering with ${tag}`, () => {
          expect([...flagsRaised(builder(node, skill), 160, always(tag))]).toContain(tag)
        })
      }

      it('flags nothing for a child who answers right', () => {
        expect([...flagsRaised(builder(node, skill), 120, right)]).toEqual([])
      })

      it('flags nothing for a child who guesses (500 answers)', () => {
        expect([...flagsRaised(builder(node, skill), 500, guesser(31))]).toEqual([])
      })
    })
  }
})
