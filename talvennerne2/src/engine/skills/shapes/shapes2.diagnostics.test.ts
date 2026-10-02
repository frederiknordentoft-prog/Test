// The misconceptions of the shapes and fraction skills of 1.–2. klasse through the real diagnostics
// (SPEC §4.3): both are perceptual and concluded from contrast only. A child who misses every turned,
// stretched or small figure (prototypeOnly, sortShapes) or takes any two parts for halves (unequalParts,
// halfShape) is flagged; a child who answers right, and a child who guesses 500 times, never is — nor is
// anyone flagged in the skills without a misconception of their own.
import { describe, expect, it } from 'vitest'
import { flagsRaised } from '../number/testing/harness'
import { always, builder, right } from '../algebra/testing/diagnose'
import { makeRng } from '../../rng'
import { PICK_KINDS } from '../../tasks'
import type { AnswerValue, MisconceptionId, SkillId, Task, TaskKind } from '../../types'

/** Taps a random card, a random set of things, colours or writes at random, types a number in range. */
function guesser(seed: number) {
  const rng = makeRng(seed)
  return (t: Task): AnswerValue => {
    if (PICK_KINDS.has(t.kind)) return rng.pick(t.options)
    if (t.kind === 'multiSelect') {
      const picked = t.options.filter(() => rng.next() < 0.5).map(String)
      return (picked.length > 0 ? picked : [String(rng.pick(t.options))]).sort().join('|')
    }
    if (t.kind === 'fillSlots') return String(t.answer).split('|').map(() => rng.pick(t.options)).join('|')
    if (t.kind === 'colorParts') {
      const p = t.prompt as Extract<Task['prompt'], { scene: 'fraction' }>
      return `frac:${rng.int(p.parts + 1)}/${p.parts}`
    }
    return rng.between(t.range[0], t.range[1])
  }
}

const CASES: { skill: SkillId; node: string; kinds: TaskKind[]; tag?: MisconceptionId }[] = [
  { skill: 'sortShapes', node: 'w1-figurer-l3', kinds: ['multiSelect'], tag: 'prototypeOnly' },
  { skill: 'sortShapes', node: 'w2-figurer-l3', kinds: ['multiSelect'], tag: 'prototypeOnly' },
  { skill: 'halfShape', node: 'w1-figurer-l3', kinds: ['trueFalse', 'multiSelect', 'multiSelect'], tag: 'unequalParts' },
  { skill: 'sidesCorners', node: 'w1-figurer-l3', kinds: ['choice', 'keypad', 'keypad'] },
  { skill: 'shapes3D', node: 'w1-figurer-l3', kinds: ['choice', 'multiSelect', 'keypad'] },
  { skill: 'shapes3D', node: 'w2-figurer-l3', kinds: ['choice', 'multiSelect', 'keypad'] },
  { skill: 'symmetry', node: 'w1-figurer-l3', kinds: ['trueFalse', 'grid', 'multiSelect'] },
  { skill: 'symmetry', node: 'w2-figurer-l3', kinds: ['trueFalse', 'grid', 'multiSelect'] },
  { skill: 'composeShapes', node: 'w2-figurer-l3', kinds: ['choice', 'keypad', 'keypad'] },
  { skill: 'fractionShape', node: 'w2-figurer-l3', kinds: ['choice', 'colorParts', 'fillSlots'] },
]

describe('diagnostics of the shapes and fraction skills of 1.–2. klasse (SPEC §4.3)', () => {
  for (const { skill, node, kinds, tag } of CASES) {
    describe(`${skill} on ${node}`, () => {
      if (tag) {
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
