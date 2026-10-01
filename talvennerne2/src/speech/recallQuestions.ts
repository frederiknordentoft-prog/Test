// Whole recorded questions for the recall facts of 0.–1. klasse (SPEC §10.2 `q.<factId>`, 271 clips).
// Fact ids follow docs/CONVENTIONS.md. The fact sets are the V1 ones:
//   addTo10       add:a+b   a, b ≥ 0, a + b ≤ 10                         66  "Hvad er tre plus fire?"
//   subTo10       sub:a-b   0 ≤ b ≤ a ≤ 10                               66  "Hvad er ni minus fem?"
//   tenFriends    ten:a     a = 0–10 (a + ? = 10)                        11  "Fire plus hvad giver ti?"
//   doubles       dbl:a     a = 1–10                                     10  "Hvad er det dobbelte af seks?"
//   halves        hlf:n     n = 2, 4 … 20 (n is the whole)               10  "Hvad er halvdelen af fjorten?"
//   addTo20       add:a+b   a, b ∈ 2–9, 10 < a + b ≤ 20                  36  "Hvad er otte plus fem?"
//   subTo20       sub:a-b   a ∈ 11–18, b ∈ 2–9, 2 ≤ a − b < 10           36  "Hvad er tretten minus fem?"
//   missingPart10 mp:a+?=c  a ≥ 1, the missing part c − a ≥ 1, c ≤ 9     36  "Tre plus hvad giver syv?"
// missingPart10 is exactly the pairs 1 ≤ a < c ≤ 9: C(9, 2) = 36. c = 10 belongs to tenFriends, and a
// zero on either side (0 + ? = c, a + ? = a) is left out, which is what makes the set 36 and not 45/55.
// In sums a lone 1 is "en" (SPEC §10.1): "Hvad er en plus en?".
import type { ClipId, SkillId } from '../engine/types'
import { numberWords } from './numberWords'

export type RecallQuestionSkill =
  | 'addTo10' | 'subTo10' | 'tenFriends' | 'doubles' | 'halves' | 'addTo20' | 'subTo20' | 'missingPart10'

export interface RecallQuestion {
  skill: RecallQuestionSkill & SkillId
  factId: string
  clip: ClipId
  text: string
}

const w = (n: number) => numberWords(n)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function* enumerate(): Generator<[RecallQuestionSkill, string, string]> {
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; a + b <= 10; b++) yield ['addTo10', `add:${a}+${b}`, `Hvad er ${w(a)} plus ${w(b)}?`]
  }
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; b <= a; b++) yield ['subTo10', `sub:${a}-${b}`, `Hvad er ${w(a)} minus ${w(b)}?`]
  }
  for (let a = 0; a <= 10; a++) yield ['tenFriends', `ten:${a}`, cap(`${w(a)} plus hvad giver ti?`)]
  for (let a = 1; a <= 10; a++) yield ['doubles', `dbl:${a}`, `Hvad er det dobbelte af ${w(a)}?`]
  for (let n = 2; n <= 20; n += 2) yield ['halves', `hlf:${n}`, `Hvad er halvdelen af ${w(n)}?`]
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) if (a + b > 10) yield ['addTo20', `add:${a}+${b}`, `Hvad er ${w(a)} plus ${w(b)}?`]
  }
  for (let a = 11; a <= 18; a++) {
    for (let b = 2; b <= 9; b++) {
      const d = a - b
      if (d >= 2 && d < 10) yield ['subTo20', `sub:${a}-${b}`, `Hvad er ${w(a)} minus ${w(b)}?`]
    }
  }
  for (let c = 2; c <= 9; c++) {
    for (let a = 1; a < c; a++) yield ['missingPart10', `mp:${a}+?=${c}`, cap(`${w(a)} plus hvad giver ${w(c)}?`)]
  }
}

export const RECALL_QUESTIONS: readonly RecallQuestion[] = [...enumerate()].map(([skill, factId, text]) => ({
  skill,
  factId,
  clip: `q.${factId}`,
  text,
}))

/** Wave 1 (0. klasse): addTo10, subTo10, tenFriends = 143 clips; the rest (1. klasse) is wave 2. */
export const WAVE1_QUESTION_SKILLS: readonly RecallQuestionSkill[] = ['addTo10', 'subTo10', 'tenFriends']

/** The recorded question for a fact, or null when the fact has none (compose it instead). */
export function questionClip(factId: string): ClipId | null {
  return QUESTION_IDS.has(factId) ? `q.${factId}` : null
}

const QUESTION_IDS = new Set(RECALL_QUESTIONS.map((q) => q.factId))
