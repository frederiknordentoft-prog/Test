// subTo10 — Minus inden for 10 (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 66 facts `sub:<a>-<b>`
// (CONVENTIONS), 0 ≤ b ≤ a ≤ 10. Families: small (a ≤ 5), big (a 6–10).
// The question is the recorded sentence "Hvad er ni minus fem?" (q.sub:9-5) over 9 − 5 = □.
// Wrong answers (pædagogik §3.2): countFromFirst = difference + 1 (9 − 3: "ni, otte, syv"),
// wrongOperation = a + b (shown as a card up to 20, which is why the card range is 0–20), the numbers
// from the question and near misses; two explanations for one value make it 'ambiguous'.
// Hint: count back from a on the number line ("Start på ni. Hop tre gange tilbage."); when b is more
// than half of a, count up from b to a instead ("Start på otte. Hop op til ti og tæl hoppene.").
// "Plus instead of minus" is always answered with the take-away picture: hop back.
import type { Fact, SkillModule } from '../types'
import { hintOf, metaOf, say, tagged, walk } from '../number/kit'
import { countUpHint, equation, frameOf, hopHint } from './within10'

function rank(a: number, b: number): number {
  // by the number taken from; within it − 1, all of it, one left, then the rest; − 0 (and 0 − 0)
  // a little later: taking nothing away is an odd first question
  if (b === 0) return (a + 2) * 5 + 4
  const easy = b === 1 ? 0 : b === a ? 1 : a - b === 1 ? 2 : 3
  return a * 5 + easy
}

const FACTS: readonly Fact[] = (() => {
  const out: Fact[] = []
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; b <= a; b++) {
      out.push({ id: `sub:${a}-${b}`, skill: 'subTo10', family: a <= 5 ? 'small' : 'big', operands: [a, b], answer: a - b, rank: rank(a, b) })
    }
  }
  return out.sort((x, y) => x.rank - y.rank)
})()

export default {
  ...metaOf('subTo10'),
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f) => equation(f.operands[0], '−', f.operands[1]),
  optionView: () => 'numeral',
  range: () => [0, 20],
  speech: (f) => [say(`q.${f.id}`)],
  candidates(f) {
    const [a, b] = f.operands
    const d = a - b
    return tagged(d, [
      ...(b > 0 ? ([[d + 1, 'countFromFirst'], [a + b, 'wrongOperation']] as const) : []),
      [a, 'operand'], [b, 'operand'],
      [d + 1, 'near'], [d - 1, 'near'], [d + 2, 'near'], [d - 2, 'near'],
    ])
  },
  hint(f, tag) {
    const [a, b] = f.operands
    const d = a - b
    if (b === 0) return hintOf([say('hint.addsub.minusZero')], frameOf(a))
    if (tag === 'wrongOperation') return hopHint(a, b, -1, { lead: [say('hint.addsub.minusMeansLess')], misconception: 'wrongOperation' })
    const first = tag === 'countFromFirst' ? ({ firstHop: true, misconception: 'countFromFirst' } as const) : {}
    if (d === 0) return hintOf([say('hint.addsub.allGone')], { scene: 'line', min: 0, max: 10, hops: walk(a, 0) })
    return b > d ? countUpHint(b, a, first) : hopHint(a, b, -1, first)
  },
} satisfies SkillModule
