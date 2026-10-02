// doubles — Dobbelt (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 10 facts `dbl:<a>` (CONVENTIONS),
// a = 1–10, answer a + a. Families: to5 (a ≤ 5), to10 (a = 6–10). Ranked as V1: 1, 2, 5, 10, 3, 4, 6–9.
// The question is the recorded sentence "Hvad er det dobbelte af seks?" (q.dbl:6) over 6 + 6 = □.
// Kinds: choice, keypad (production), numberline (production): the equation stays on the card and the
// pin goes on the task's 0–20 line (exact, SPEC §3.3).
// Wrong answers: the number itself ('operand': forgot to double), near misses (±1, ±2) and the half
// ('wrongOperation': doubling is · 2, halving the other operation, the mix-up of Dobbeltdalen; only
// for even a). The catalogue has no other misconception for doubles.
// Hint: two equal rows ("domino, to hænder"): "Seks og seks giver tolv." For 6–9 the five trick:
// "Fem og fem giver ti. En og en giver to. Ti og to giver tolv."
import type { Fact, HintSpec, SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'
import { sumPrompt, swapHint } from './calc'

const ORDER = [1, 2, 5, 10, 3, 4, 6, 7, 8, 9]

const FACTS: readonly Fact[] = ORDER.map((a, rank) => ({
  id: `dbl:${a}`, skill: 'doubles', family: a <= 5 ? 'to5' : 'to10', operands: [a], answer: 2 * a, rank,
}))

function hint(f: Fact, tag: string | null): HintSpec {
  const a = f.operands[0]
  if (tag === 'digitSwap') return swapHint(2 * a)
  const sum = (x: number) => [num(x, 'mid'), say('op.og'), num(x, 'mid'), say('op.giver'), num(2 * x)]
  const strategy = [
    say('hint.doubles.twoRows'),
    ...(a >= 6 && a <= 9 ? [...sum(5), ...sum(a - 5), num(10, 'mid'), say('op.og'), num(2 * (a - 5), 'mid'), say('op.giver'), num(2 * a)] : sum(a)),
  ]
  const visual = { scene: 'array', rows: 2, cols: a } as const
  if (tag === 'wrongOperation') return hintOf([say('hint.doubles.more'), ...strategy], visual, 'wrongOperation')
  return hintOf(strategy, visual)
}

export default {
  ...metaOf('doubles'),
  kinds: ['choice', 'keypad', 'numberline'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f) => sumPrompt(f.operands[0], '+', f.operands[0]),
  optionView: () => 'numeral',
  range: () => [0, 20],
  speech: (f) => [say(`q.${f.id}`)],
  candidates(f) {
    const a = f.operands[0]
    const d = 2 * a
    return tagged(d, [
      ...(a % 2 === 0 ? ([[a / 2, 'wrongOperation']] as const) : []),
      [a, 'operand'],
      [d + 1, 'near'], [d - 1, 'near'], [d + 2, 'near'], [d - 2, 'near'],
    ])
  },
  hint,
} satisfies SkillModule
