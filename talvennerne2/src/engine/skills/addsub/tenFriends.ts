// tenFriends — Tiervenner (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 11 facts `ten:<a>`
// (CONVENTIONS): a + ? = 10, a = 0–10, one family 'pairs'.
// The question is the recorded sentence "Fire plus hvad giver ti?" (q.ten:4). choice and keypad show
// 4 + □ = 10; pair shows a ten-frame with four counters, and the child drags the bubble with the
// partner onto it (four bubbles). Ranked 9 + 1, 1 + 9, 5 + 5, 8 + 2 … 6 + 4, 4 + 6, and 10 + 0,
// 0 + 10 last (a zero is an odd first partner).
// Wrong answers: the given number and the ten ('operand'), near misses. The catalogue has no
// misconception for tiervenner (equalsAsAnswer belongs to missingPart10); a card like 14 would only
// teach the child that teens are never right. Hint: count the empty cells of the ten-frame.
import type { Fact, SkillModule } from '../types'
import { hintOf, metaOf, say, tagged } from '../number/kit'
import { frameOf } from './within10'

/** Introduction order of the partners: one more to ten first, the double, the rest, the zeros last. */
const ORDER = [9, 1, 5, 8, 2, 7, 3, 6, 4, 10, 0]

const FACTS: readonly Fact[] = ORDER.map((a, rank) => ({
  id: `ten:${a}`, skill: 'tenFriends', family: 'pairs', operands: [a, 10], answer: 10 - a, rank,
}))

export default {
  ...metaOf('tenFriends'),
  kinds: ['pair', 'choice', 'keypad'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f, kind) =>
    kind === 'pair'
      ? frameOf(f.operands[0])
      : { scene: 'equation', terms: [{ n: f.operands[0] }, { op: '+' }, { blank: true }, { op: '=' }, { n: 10 }] },
  optionView: () => 'numeral',
  range: () => [0, 10],
  speech: (f) => [say(`q.${f.id}`)],
  candidates(f) {
    const a = f.operands[0]
    const c = 10 - a
    return tagged(c, [[a, 'operand'], [10, 'operand'], [c + 1, 'near'], [c - 1, 'near'], [c + 2, 'near'], [c - 2, 'near']])
  },
  hint(f) {
    const a = f.operands[0]
    const clip = a === 10 ? 'hint.tenFriends.full' : a === 0 ? 'hint.tenFriends.empty' : 'hint.tenFriends.countEmpty'
    return hintOf([say(clip)], frameOf(a))
  },
} satisfies SkillModule
