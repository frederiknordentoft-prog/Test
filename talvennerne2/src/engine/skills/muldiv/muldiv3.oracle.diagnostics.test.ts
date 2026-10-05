// mul34, mul6to9, mulTens, div2510 and divAll through the real diagnostics (SPEC §4.3), ORK3a. Independent of
// muldiv3.diagnostics.test.ts (the author's, whose child answers with the value the generator tagged): here a
// child keeps one idea worked out from the card by the oracle's own formulas (muldiv3.oracle.ts), the tasks
// come from the node's keys as rounds plan them (div2510's share view included), and the diagnostics get the
// child's own first-try accuracy (SPEC §4.3 rule 6). Such a child is flagged within 160 answers, and for nothing
// else; a child who answers right never is; a child who guesses 500 times never is, also when every tapped card
// counts (accuracy fixed at 0.7).
import { describe, expect, it } from 'vitest'
import type { MisconceptionId, SkillId, Task } from '../../types'
import { typedSwapOf } from '../algebra/algebra2.oracle'
import { answersRight, guesses, keeps, simulate, type Child } from '../addsub/addsub3.oracle'
import { mulMis } from './muldiv.oracle'
import { cardOf, divMis, tensFactOf, tensMis } from './muldiv3.oracle'

/** What the idea gives on this card: the times tables, whole tens or a division (pædagogik §3.2). */
const idea = (skill: SkillId, m: MisconceptionId) => (t: Task): number[] => {
  const c = cardOf(t)
  if (!c) return []
  let mis: [number, MisconceptionId][] = []
  if (skill === 'mulTens') {
    const q = tensFactOf(`mt:${c.x}x${c.y}`)
    mis = q ? tensMis(q.a, q.T) : []
  } else if (c.op === '·') mis = mulMis(c.x, c.y)
  else if (c.op === ':') mis = divMis(c.x, c.y)
  return mis.filter(([, x]) => x === m).map(([v]) => v)
}

const swapsDigits: Child = (t) => (t.kind === 'keypad' ? typedSwapOf(t) ?? t.answer : t.answer)

const CASES: { skill: SkillId; node: string; ideas: MisconceptionId[]; swaps: boolean }[] = [
  { skill: 'mul34', node: 'w3-tabellen-l3', ideas: ['tableNeighbour', 'mulAsAdd'], swaps: true },
  { skill: 'mul6to9', node: 'w3-tabellen-l3', ideas: ['tableNeighbour', 'mulAsAdd'], swaps: true },
  { skill: 'mulTens', node: 'w3-tabellen-l3', ideas: ['tensZero', 'tableNeighbour', 'mulAsAdd'], swaps: false },
  { skill: 'div2510', node: 'w3-division-l3', ideas: ['tableNeighbour', 'wrongOperation'], swaps: false },
  { skill: 'divAll', node: 'w3-division-l3', ideas: ['tableNeighbour', 'wrongOperation'], swaps: false },
]

describe('gange og division of 3. klasse through the real diagnostics (SPEC §4.3), the child by the oracle’s formulas', () => {
  for (const { skill, node, ideas, swaps } of CASES) {
    describe(skill, () => {
      for (const m of ideas) {
        it(`flags a child who keeps ${m} within 160 answers, and nothing else`, () => {
          const { flagged } = simulate(node, skill, keeps(idea(skill, m), `${skill}:${m}`), 160)
          expect([...flagged.keys()]).toEqual([m])
        })
      }

      if (swaps) {
        it('flags a child who types the tens and ones swapped (digitSwap, a slip here), and nothing else', () => {
          expect([...simulate(node, skill, swapsDigits, 160).flagged.keys()]).toEqual(['digitSwap'])
        })
      }

      it('flags nothing for a child who answers right (160 answers)', () => {
        expect([...simulate(node, skill, answersRight, 160).flagged.keys()]).toEqual([])
      })

      it('flags nothing for a child who guesses 500 times, with its own accuracy and with every card counting', () => {
        expect([...simulate(node, skill, guesses(`${skill}:a`), 500).flagged.keys()]).toEqual([])
        expect([...simulate(node, skill, guesses(`${skill}:b`), 500, { accuracy: 0.7 }).flagged.keys()]).toEqual([])
      })
    })
  }
})
