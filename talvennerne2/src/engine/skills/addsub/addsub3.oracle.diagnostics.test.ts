// add1000 and sub1000 through the real diagnostics (SPEC §4.3), ORK3a. Independent of addsub3.diagnostics.test.ts
// (the author's, whose child answers with the value the generator tagged): here a child keeps one idea worked
// out from the card by the oracle's own formulas (addsub3.oracle.ts), the tasks come from Trecifret bro's
// keys as rounds plan them, and the diagnostics get the child's own first-try accuracy over its last 20
// answers (SPEC §4.3 rule 6: below 40 % a tapped card is no evidence). Such a child is flagged within 160
// answers, and for nothing else; a child who answers right never is; a child who guesses 500 times never is,
// also when every tapped card counts (accuracy fixed at 0.7, the harder test).
import { describe, expect, it } from 'vitest'
import type { MisconceptionId, SkillId, Task } from '../../types'
import { typedSwapOf } from '../algebra/algebra2.oracle'
import { answersRight, cardSum, guesses, keeps, simulate, sumMis, type Child, type Sum3 } from './addsub3.oracle'

const NODE = 'w3-store-tal-l3'

/** The sum on the card. */
function sumOn(t: Task): Sum3 | null {
  const c = cardSum(t)
  if (!c || (c.op !== '+' && c.op !== '−')) return null
  return { op: c.op, a: c.a, b: c.b, answer: c.op === '+' ? c.a + c.b : c.a - c.b }
}

/** What the idea gives on this card (pædagogik §3.2 by the oracle's formulas). */
const idea = (m: MisconceptionId) => (t: Task): number[] => {
  const s = sumOn(t)
  return s ? sumMis(s).filter(([, x]) => x === m).map(([v]) => v) : []
}

/** Types the answer with its tens and ones swapped wherever the keys show a swap can happen; cards right. */
const swapsDigits: Child = (t) => (t.kind === 'keypad' ? typedSwapOf(t) ?? t.answer : t.answer)

const CASES: { skill: SkillId; ideas: MisconceptionId[] }[] = [
  { skill: 'add1000', ideas: ['forgotCarry', 'placeMisalign', 'wrongOperation'] },
  { skill: 'sub1000', ideas: ['smallerFromLarger', 'borrowNoDecrement', 'wrongOperation'] },
]

describe('add1000 and sub1000 through the real diagnostics (SPEC §4.3), the child by the oracle’s formulas', () => {
  for (const { skill, ideas } of CASES) {
    describe(skill, () => {
      for (const m of ideas) {
        it(`flags a child who keeps ${m} within 160 answers, and nothing else`, () => {
          const { flagged } = simulate(NODE, skill, keeps(idea(m), `${skill}:${m}`), 160)
          expect([...flagged.keys()]).toEqual([m])
        })
      }

      it('flags a child who types the tens and ones swapped (digitSwap, a slip in this skill), and nothing else', () => {
        const { flagged } = simulate(NODE, skill, swapsDigits, 160)
        expect([...flagged.keys()]).toEqual(['digitSwap'])
      })

      it('flags nothing for a child who answers right (160 answers)', () => {
        expect([...simulate(NODE, skill, answersRight, 160).flagged.keys()]).toEqual([])
      })

      it('flags nothing for a child who guesses 500 times, with its own accuracy and with every card counting', () => {
        expect([...simulate(NODE, skill, guesses(`${skill}:a`), 500).flagged.keys()]).toEqual([])
        expect([...simulate(NODE, skill, guesses(`${skill}:b`), 500, { accuracy: 0.7 }).flagged.keys()]).toEqual([])
      })
    })
  }
})
