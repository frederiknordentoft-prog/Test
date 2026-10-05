// The misconceptions of the clock skills of 3. klasse through the real diagnostics (SPEC §4.3), on the stone in
// Minuttårnet that asks for production: a child who keeps making one mistake is flagged for it; a child who
// answers right, and a child who guesses 500 times, never is. clockDigital's halfPastNext is only on the
// 24-hour cards (the time is said there), so it is evidence that flags only beside clockFive's or
// clockElapsed's dial.
import { describe, expect, it } from 'vitest'
import { flagsRaised } from '../number/testing/harness'
import { always, builder, right } from '../algebra/testing/diagnose'
import { makeRng } from '../../rng'
import type { AnswerValue, ErrorTag, SkillId, Task, TaskKind } from '../../types'

const CASES: { skill: SkillId; tags: ErrorTag[] }[] = [
  { skill: 'clockFive', tags: ['quarterDirection', 'halfPastNext', 'hourHandMisread', 'handsSwapped'] },
  { skill: 'clockDigital', tags: ['hourHandMisread', 'handsSwapped'] },
  { skill: 'clockElapsed', tags: ['wrongOperation', 'halfPastNext'] },
]
const KINDS: TaskKind[] = ['choice', 'clockSet', 'clockSet']
const NODE = 'w3-klokken-l3'

/** Taps a random card, or sets a random time on the dial's step. */
function clockGuesser(seed: number) {
  const rng = makeRng(seed)
  return (t: Task): AnswerValue => {
    if (t.kind === 'choice') return rng.pick(t.options)
    const step = t.prompt.scene === 'clock' ? t.prompt.step : 60
    return step * rng.int(720 / step)
  }
}

describe('diagnostics of the clock skills of 3. klasse (SPEC §4.3)', () => {
  for (const { skill, tags } of CASES) {
    describe(skill, () => {
      for (const tag of tags) {
        it(`flags a child who keeps answering with ${tag}`, () => {
          expect([...flagsRaised(builder(NODE, skill, KINDS), 200, always(tag))]).toContain(tag)
        })
      }

      it('flags nothing for a child who answers right', () => {
        expect([...flagsRaised(builder(NODE, skill, KINDS), 120, right)]).toEqual([])
      })

      it('flags nothing for a child who guesses (500 answers)', () => {
        expect([...flagsRaised(builder(NODE, skill, KINDS), 500, clockGuesser(29))]).toEqual([])
      })
    })
  }

  it('lets clockDigital\'s halfPastNext cards add to clockFive\'s dial, never flag alone', () => {
    const cards = builder(NODE, 'clockDigital', ['choice'])
    expect([...flagsRaised(cards, 300, always('halfPastNext'))]).not.toContain('halfPastNext')
    const five = builder(NODE, 'clockFive', KINDS)
    const both = (i: number) => (i % 2 ? cards(i) : five(i))
    expect([...flagsRaised(both, 300, always('halfPastNext'))]).toContain('halfPastNext')
  })
})
