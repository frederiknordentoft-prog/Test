// subTo20 — Minus over tieren (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 36 facts `sub:<a>-<b>`
// (CONVENTIONS, the V1 set): a = 11–18, b = 2–9, a − b = 2–9, one family 'bridge10'. Ranked by how far
// the minuend is above ten (11 − 2 first, 18 − 9 last), then by what is left to take from the ten.
// The question is the recorded sentence "Hvad er tretten minus fem?" (q.sub:13-5) over 13 − 5 = □.
// Kinds: choice, keypad (production). The card range is 0–30, so "plus instead of minus" (a + b, up
// to 27) can be the diagnostic card.
// Wrong answers (pædagogik §3.2): countFromFirst = difference + 1, smallerFromLarger (13 − 5 → 12: 5 − 3
// in the ones), borrowNoDecrement = difference + 10 (13 − 5 → 18: the ten taken from, but kept),
// wrongOperation = a + b, the numbers from the question and near misses (±1, ±2). A value with two
// explanations (13 − 8 → 15: smallerFromLarger and borrowNoDecrement; 11 − 2 → 11: smallerFromLarger
// or the 11 repeated) is 'ambiguous' (SPEC §4.1, A9).
// Hint: "tilbage til 10" — "Gå tilbage til ti først. Tretten minus tre giver ti. Ti minus to giver
// otte." with the two ten-frames (backToTen); the misconception hints say why first.
import type { Fact, HintSpec, SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged, walk } from '../number/kit'
import { borrowNoDecrement, meaningOf, smallerFromLarger, sumPrompt } from './calc'

const FACTS: readonly Fact[] = (() => {
  const out: Fact[] = []
  for (let a = 11; a <= 18; a++) {
    for (let b = 2; b <= 9; b++) {
      const d = a - b
      if (d >= 2 && d < 10) {
        out.push({ id: `sub:${a}-${b}`, skill: 'subTo20', family: 'bridge10', operands: [a, b], answer: d, rank: (a - 10) * 10 + (b - (a - 10)) })
      }
    }
  }
  return out.sort((x, y) => x.rank - y.rank)
})()

/** "Gå tilbage til ti først. Tretten minus tre giver ti. Ti minus to giver otte." */
function backToTen(a: number, b: number) {
  const down = a - 10
  return [
    say('hint.subTo20.backToTen'),
    num(a, 'mid'), say('op.minus'), num(down, 'mid'), say('op.giver'), num(10),
    num(10, 'mid'), say('op.minus'), num(b - down, 'mid'), say('op.giver'), num(a - b),
  ]
}

function hint(f: Fact, tag: string | null): HintSpec {
  const [a, b] = f.operands
  const strategy = backToTen(a, b)
  const frames = { scene: 'backToTen', a, b } as const
  switch (tag) {
    case 'countFromFirst':
      return hintOf(
        [say('hint.addsub2.startOn'), num(a), say('hint.addsub2.firstHopBack'), num(a - 1), ...strategy],
        { scene: 'line', min: 0, max: 20, hops: walk(a, a - b) },
        'countFromFirst',
      )
    case 'smallerFromLarger':
      return hintOf([say('hint.subTo20.takeFromTen'), ...strategy], frames, 'smallerFromLarger', true)
    case 'borrowNoDecrement':
      return hintOf([say('hint.subTo20.tenIsUsed'), ...strategy], frames, 'borrowNoDecrement', true)
    case 'wrongOperation':
      return hintOf([meaningOf('−'), ...strategy], frames, 'wrongOperation')
    default:
      return hintOf(strategy, frames)
  }
}

export default {
  ...metaOf('subTo20'),
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f) => sumPrompt(f.operands[0], '−', f.operands[1]),
  optionView: () => 'numeral',
  range: () => [0, 30],
  speech: (f) => [say(`q.${f.id}`)],
  candidates(f) {
    const [a, b] = f.operands
    const d = a - b
    return tagged(d, [
      [d + 1, 'countFromFirst'], [smallerFromLarger(a, b), 'smallerFromLarger'], [borrowNoDecrement(a, b), 'borrowNoDecrement'],
      [a + b, 'wrongOperation'],
      [a, 'operand'], [b, 'operand'],
      [d + 1, 'near'], [d - 1, 'near'], [d + 2, 'near'], [d - 2, 'near'],
    ])
  },
  hint,
} satisfies SkillModule
