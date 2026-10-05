// Markedet's money skills through the real diagnostics (SPEC §4.3), ORK3c: kronerOre, and the 3. klasse families of
// change (from100) and payExact (fewestCoins). The child keeps one idea worked out by the oracle from what it hears and
// sees — six halvtredsører counted as six kroner, the price and the note added, 100 − 37 made up digit by digit, the
// kroner typed back to front — and taps it, pays it from the purse or types it. The tasks come from Markedet's
// production stone as rounds plan them, with the child's own first-try accuracy (SPEC §4.3 rule 6). Such a child is
// flagged within 160 answers, and for nothing else; a child who answers right, or guesses 500 times, never is.
import { describe, expect, it } from 'vitest'
import type { MisconceptionId, SkillId, Task } from '../../types'
import { spokenText } from '../number/number.oracle'
import { answersRight } from '../addsub/addsub3.oracle'
import { flaggedRuns, guessesC, keepsC, simulateNode, typedSwapC } from '../clock/clock3.oracle'
import { digitComplementKr, saleAsked } from './money.oracle'

const NODE = 'w3-penge-maal-l3'
const MONEY: readonly SkillId[] = ['kronerOre', 'change', 'payExact']

/** What the idea gives on this task, from what the child hears and sees. */
const idea = (m: MisconceptionId) => (t: Task): number[] => {
  if (m === 'coinsAsCount') return t.prompt.scene === 'coins' && spokenText(t.speech).startsWith('Hvor mange penge er der?') ? [t.prompt.ore.length * 100] : []
  if (m === 'digitSwap') return t.kind === 'keypad' && typedSwapC(t) !== null ? [typedSwapC(t)!] : []
  const s = saleAsked(spokenText(t.speech))
  if (!s) return []
  if (m === 'wrongOperation') return [s.price + s.paid]
  const dc = s.paid === 10000 ? digitComplementKr(s.price / 100) : null
  return m === 'digitComplement10' && dc !== null ? [dc * 100] : []
}

const CASES: { skill: SkillId; ideas: MisconceptionId[] }[] = [
  { skill: 'kronerOre', ideas: ['coinsAsCount'] },
  { skill: 'change', ideas: ['wrongOperation', 'digitComplement10', 'digitSwap'] },
  { skill: 'payExact', ideas: [] },
]

describe('Markedet’s money through the real diagnostics (SPEC §4.3), the child by the oracle’s formulas', () => {
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

  it('flags coinsAsCount on the whole money stone too, among the other skills’ tasks', () => {
    expect([...simulateNode(NODE, MONEY, keepsC(idea('coinsAsCount'), 'market:coins'), 400).keys()]).toEqual(['coinsAsCount'])
  })
})
