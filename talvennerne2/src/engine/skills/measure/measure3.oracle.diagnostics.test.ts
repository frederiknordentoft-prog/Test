// convertCmM, and unitChoice's 3. klasse family, through the real diagnostics (SPEC §4.3), ORK3c. The child keeps one
// idea worked out by the oracle from the card it reads (measure3.oracle.ts) — a meter taken as ten centimeter or a
// thousand, the zero of "2 m 5 cm" dropped or moved, 1 m − 37 cm made up digit by digit, the lengths added, the answer
// typed back to front — and taps or types it. The tasks come from Markedet's production stone as rounds plan them,
// with the child's own first-try accuracy (SPEC §4.3 rule 6). Such a child is flagged within 160 answers, and for
// nothing else; a child who answers right, or guesses 500 times, never is.
import { describe, expect, it } from 'vitest'
import type { MisconceptionId, SkillId, Task } from '../../types'
import { answersRight } from '../addsub/addsub3.oracle'
import { flaggedRuns, guessesC, keepsC, simulateNode, typedSwapC } from '../clock/clock3.oracle'
import { cmFromCard, cmMis } from './measure3.oracle'

const NODE = 'w3-penge-maal-l3'

/** What the idea gives on this card (pædagogik §3.2's formulas by the oracle); the typed swap where the keys show one. */
const idea = (m: MisconceptionId) => (t: Task): number[] => {
  if (m === 'digitSwap') return t.kind === 'keypad' && typedSwapC(t) !== null ? [typedSwapC(t)!] : []
  const q = cmFromCard(t.prompt)
  return q ? cmMis(q).filter(([, x]) => x === m).map(([v]) => v) : []
}

/** The zero of "2 m 5 cm" moved (250): the one form of zeroPlaceholder no other idea explains. */
const movesZero = (t: Task): number[] => {
  const q = cmFromCard(t.prompt)
  return q && q.family === 'mCmToCm' && q.c < 10 ? [100 * q.a + 10 * q.c] : []
}

const CASES: { skill: SkillId; ideas: MisconceptionId[] }[] = [
  { skill: 'convertCmM', ideas: ['tensZero', 'digitComplement10', 'wrongOperation', 'digitSwap'] },
  { skill: 'unitChoice', ideas: [] },
]

describe('Markedet’s measuring through the real diagnostics (SPEC §4.3), the child by the oracle’s formulas', () => {
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

  // ORK3c finding (convertCmM, zeroPlaceholder): only "2 m 5 cm" with 1–9 cm can show the misplaced zero, and its
  // dropped form (25) is also a meter taken as ten centimeter (tensZero), so only the moved zero (250) is evidence.
  // mCmToCm draws the centimeter evenly from 1–99 (9 in 99) and is one family of four: about 2 % of convertCmM's tasks
  // can show it. A child who always writes 2 m 5 cm as 250 is flagged within 160 answers in 10 of these 30 seeded runs
  // (every other idea of convertCmM, kronerOre, change and the clocks: 30 of 30). SPEC §4.3 (the brief): within 160.
  // GENERATOR BUG — Rettet (GENFIX3): mCmToCm draws 1–9 cm in a third of its instances, some canonical
  it('flags a child who keeps moving the zero (2 m 5 cm written 250) within 160 answers in at least 27 of 30 seeded runs', () => {
    const runs = flaggedRuns(NODE, ['convertCmM'], (seed) => keepsC(movesZero, seed), 'zeroPlaceholder', 160, 30)
    expect(runs.filter((r) => r.others.length > 0)).toEqual([])
    expect(runs.filter((r) => r.at !== null).length).toBeGreaterThanOrEqual(27)
  })

  it('flags the child who keeps moving the zero within 400 answers in most runs, and nothing else (the idea itself is found)', () => {
    const runs = flaggedRuns(NODE, ['convertCmM'], (seed) => keepsC(movesZero, seed), 'zeroPlaceholder', 400, 10)
    expect(runs.filter((r) => r.others.length > 0)).toEqual([])
    expect(runs.filter((r) => r.at !== null).length).toBeGreaterThanOrEqual(7)
  })

  it('never flags the dropped zero (2 m 5 cm written 25): it is also a meter taken as ten centimeter, so it is ambiguous', () => {
    const drops = (t: Task): number[] => {
      const q = cmFromCard(t.prompt)
      return q && q.family === 'mCmToCm' && q.c < 10 ? [10 * q.a + q.c] : []
    }
    expect([...simulateNode(NODE, ['convertCmM'], keepsC(drops, 'drops'), 400).keys()]).toEqual([])
  })
})
