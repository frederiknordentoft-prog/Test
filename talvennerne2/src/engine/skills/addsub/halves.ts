// halves — Halvdelen (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 10 facts `hlf:<n>` (CONVENTIONS:
// n is the whole), n = 2, 4 … 20, answer n : 2. Families: to10 (n ≤ 10), to20 (n = 12–20). Ranked like
// doubles (V1): halves of 2, 4, 10, 20, 6, 8, 12 … 18.
// The question is the recorded sentence "Hvad er halvdelen af fjorten?" (q.hlf:14). The card shows the
// sharing ("deling i to"): a pile of n things and two friends ({ scene: 'share' }), for every kind.
// Kinds: choice, keypad (production), share (the child deals the pile; an even deal is n : 2, an uneven
// one −1 = 'shareUnequal' in the engine; manipulative, so never production here, SPEC §3.3).
// Wrong answers: the whole ('operand': nothing shared), near misses (±1, ±2) and the double
// ('wrongOperation': halving is : 2, doubling the other operation, the mix-up of Dobbeltdalen). The
// card range is 0–20, and 0–40 for n ≥ 12 so the double can be a card too.
// Hint: two equal rows, said as the double backwards: "Syv og syv giver fjorten. Så halvdelen af
// fjorten er syv."
import type { Fact, HintSpec, SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'

const ORDER = [1, 2, 5, 10, 3, 4, 6, 7, 8, 9]

const FACTS: readonly Fact[] = ORDER.map((h, rank) => ({
  id: `hlf:${2 * h}`, skill: 'halves', family: 2 * h <= 10 ? 'to10' : 'to20', operands: [2 * h], answer: h, rank,
}))

/** Things to share, picked per task (the question does not name them). */
const THINGS = ['carrot', 'apple', 'strawberry', 'chestnut', 'flower', 'fish', 'mushroom', 'leaf', 'star', 'ball'] as const

function hint(f: Fact, tag: string | null): HintSpec {
  const n = f.operands[0]
  const h = n / 2
  const strategy = [
    say('hint.halves.twoRows'),
    num(h, 'mid'), say('op.og'), num(h, 'mid'), say('op.giver'), num(n),
    say('hint.halves.soHalfOf'), num(n, 'mid'), say('hint.halves.is'), num(h),
  ]
  const visual = { scene: 'array', rows: 2, cols: h } as const
  if (tag === 'wrongOperation') return hintOf([say('hint.halves.fewer'), ...strategy], visual, 'wrongOperation')
  return hintOf(strategy, visual)
}

export default {
  ...metaOf('halves'),
  kinds: ['choice', 'keypad', 'share'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f, _kind, rng) => ({ scene: 'share', total: f.operands[0], recipients: 2, thing: rng.pick(THINGS) }),
  optionView: () => 'numeral',
  range: (f) => [0, f.operands[0] <= 10 ? 20 : 40],
  speech: (f) => [say(`q.${f.id}`)],
  candidates(f) {
    const n = f.operands[0]
    const h = n / 2
    return tagged(h, [
      [2 * n, 'wrongOperation'],
      [n, 'operand'],
      [h + 1, 'near'], [h - 1, 'near'], [h + 2, 'near'], [h - 2, 'near'],
    ])
  },
  hint,
} satisfies SkillModule
