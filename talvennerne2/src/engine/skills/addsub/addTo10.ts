// addTo10 — Plus til 10 (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 66 facts `add:<a>+<b>`
// (CONVENTIONS), a, b ≥ 0, a + b ≤ 10. Families: small (sum ≤ 5), big (sum 6–10).
// The question is the recorded sentence "Hvad er tre plus fire?" (q.add:3+4) over the equation
// 3 + 4 = □; the task UI adds counters as the scaffold in box 0.
// Wrong answers (pædagogik §3.2): countFromFirst = sum − 1 (5 + 3: "fem, seks, syv"),
// wrongOperation = |a − b|, the numbers from the question ('operand') and near misses. A value with
// two explanations (5 + 1 → 5: counted from five, or repeated it?) is 'ambiguous' and never evidence.
// Hint: count on from the bigger number on the number line; the countFromFirst hint says where the
// first hop lands, the wrongOperation hint says what plus means first.
import type { Fact, SkillModule } from '../types'
import { metaOf, say, tagged } from '../number/kit'
import { equation, frameOf, hopHint } from './within10'

function rank(a: number, b: number): number {
  // by sum; within a sum + 0, + 1, doubles, then bigger number first (easier to count on from)
  const easy = a === 0 || b === 0 ? 0 : a === 1 || b === 1 ? 1 : a === b ? 2 : a > b ? 3 : 4
  return (a + b) * 5 + easy
}

const FACTS: readonly Fact[] = (() => {
  const out: Fact[] = []
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; a + b <= 10; b++) {
      out.push({ id: `add:${a}+${b}`, skill: 'addTo10', family: a + b <= 5 ? 'small' : 'big', operands: [a, b], answer: a + b, rank: rank(a, b) })
    }
  }
  return out.sort((x, y) => x.rank - y.rank)
})()

export default {
  ...metaOf('addTo10'),
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f) => equation(f.operands[0], '+', f.operands[1]),
  optionView: () => 'numeral',
  range: () => [0, 10],
  speech: (f) => [say(`q.${f.id}`)],
  candidates(f) {
    const [a, b] = f.operands
    const s = a + b
    return tagged(s, [
      ...(a > 0 && b > 0 ? ([[s - 1, 'countFromFirst'], [Math.abs(a - b), 'wrongOperation']] as const) : []),
      [a, 'operand'], [b, 'operand'],
      [s + 1, 'near'], [s - 1, 'near'], [s + 2, 'near'], [s - 2, 'near'],
    ])
  },
  hint(f, tag) {
    const [a, b] = f.operands
    if (a === 0 || b === 0) return { speech: [say('hint.addsub.plusZero')], visual: frameOf(a + b) }
    const big = Math.max(a, b)
    const small = Math.min(a, b)
    if (tag === 'countFromFirst') return hopHint(big, small, 1, { firstHop: true, misconception: 'countFromFirst' })
    if (tag === 'wrongOperation') return hopHint(big, small, 1, { lead: [say('hint.addsub.plusMeansMore')], misconception: 'wrongOperation' })
    return hopHint(big, small, 1)
  },
} satisfies SkillModule
