// clockFive, clockDigital and clockElapsed through the real diagnostics (SPEC §4.3), ORK3c. Independent of
// clock3.diagnostics.test.ts (the author's, whose child answers with the value the generator tagged): here the child
// keeps one idea worked out by the oracle from what it hears and sees (clock3.oracle.ts) — "halv tre" as 3:30, "over"
// for "i", the short hand read as the next number, the hands' roles swapped, the hands turned the wrong way — and taps
// that clock, or sets it when the dial's step can show it. The tasks come from Minuttårnet's production stone as rounds
// plan them, and the diagnostics get the child's own first-try accuracy (SPEC §4.3 rule 6). Such a child is flagged
// within 160 answers, and for nothing else; a child who answers right never is; a child who guesses 500 times never
// is, also when every tapped card counts.
import { describe, expect, it } from 'vitest'
import type { MisconceptionId, SkillId, Task } from '../../types'
import { spokenText } from '../number/number.oracle'
import { answersRight } from '../addsub/addsub3.oracle'
import {
  askedDigital, askedElapsed, askedFive, digitalIdeas, drawnAnalog, elapsedIdeas, fiveIdeas, flaggedRuns, guessesC, keepsC, markupOfPrompt,
  simulateNode,
} from './clock3.oracle'

const NODE = 'w3-klokken-l3'
const CLOCKS: readonly SkillId[] = ['clockFive', 'clockDigital', 'clockElapsed']

/** What the idea gives on this task, worked out from what the child hears (and, for the 12-hour cards, the clock it reads). */
const idea = (m: MisconceptionId) => (t: Task): number[] => {
  const text = spokenText(t.speech)
  if (t.skill === 'clockFive') {
    const a = askedFive(text, t.kind)
    return a ? (fiveIdeas(a.said, t.kind === 'clockSet' ? 5 : null)[m] ?? []) : []
  }
  if (t.skill === 'clockDigital') {
    const drawn = t.kind === 'choice' && t.prompt.scene === 'clock' && !t.prompt.digital ? drawnAnalog(markupOfPrompt(t)) : null
    const q = askedDigital(t, text, drawn)
    return q ? (digitalIdeas(q, t.kind)[m] ?? []) : []
  }
  const q = askedElapsed(text, t.kind)
  return q ? (elapsedIdeas(q)[m] ?? []) : []
}

const CASES: { skill: SkillId; ideas: MisconceptionId[] }[] = [
  { skill: 'clockFive', ideas: ['quarterDirection', 'halfPastNext', 'hourHandMisread', 'handsSwapped'] },
  { skill: 'clockDigital', ideas: ['hourHandMisread', 'handsSwapped'] },
  { skill: 'clockElapsed', ideas: ['wrongOperation', 'halfPastNext'] },
]

describe('the clock skills of 3. klasse through the real diagnostics (SPEC §4.3), the child by the oracle’s formulas', () => {
  for (const { skill, ideas } of CASES) {
    describe(skill, () => {
      for (const m of ideas) {
        it(`flags a child who keeps ${m} within 160 answers, and nothing else (five seeded runs)`, () => {
          const runs = flaggedRuns(NODE, [skill], (seed) => keepsC(idea(m), seed), m, 160, 5)
          expect(runs.map((r) => [r.at !== null, r.others])).toEqual(runs.map(() => [true, []]))
        })
      }

      it('flags nothing for a child who answers right (160 answers)', () => {
        expect([...simulateNode(NODE, [skill], answersRight, 160).keys()]).toEqual([])
      })

      it('flags nothing for a child who guesses 500 times, with its own accuracy and with every card counting', () => {
        expect([...simulateNode(NODE, [skill], guessesC(`${skill}:a`), 500).keys()]).toEqual([])
        expect([...simulateNode(NODE, [skill], guessesC(`${skill}:b`), 500, { accuracy: 0.7 }).keys()]).toEqual([])
      })
    })
  }

  // clockDigital says a time with "halv" only on its 24-hour cards ("Klokken er halv tre om eftermiddagen."); its dial is
  // set from the digits. Cards alone never flag (SPEC §4.3 rule 5: the skill has a production kind), so the idea is
  // flagged from the stone that also plays clockFive and clockElapsed, where the dial hears "halv".
  it('flags halfPastNext on Minuttårnet’s stone within 160 answers, never from clockDigital’s cards alone', () => {
    expect([...simulateNode(NODE, ['clockDigital'], keepsC(idea('halfPastNext'), 'digital:halv'), 300).keys()]).toEqual([])
    const runs = flaggedRuns(NODE, CLOCKS, (seed) => keepsC(idea('halfPastNext'), seed), 'halfPastNext', 160, 5)
    expect(runs.map((r) => [r.at !== null, r.others])).toEqual(runs.map(() => [true, []]))
  })

  it('flags nothing on the whole stone for a child who answers right or guesses', () => {
    expect([...simulateNode(NODE, CLOCKS, answersRight, 200).keys()]).toEqual([])
    expect([...simulateNode(NODE, CLOCKS, guessesC('tower'), 500, { accuracy: 0.7 }).keys()]).toEqual([])
  })
})
