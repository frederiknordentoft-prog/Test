// missingPart10 — Det manglende tal til 10 (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 36 facts
// `mp:<a>+?=<c>` (CONVENTIONS): 1 ≤ a < c ≤ 9, the missing part c − a ≥ 1 (c = 10 is tenFriends,
// a zero on either side is left out), one family 'missing'. Ranked by the whole c, then by the
// missing part (2 + ? = 3 first, 1 + ? = 9 last).
// The question is the recorded sentence "Tre plus hvad giver syv?" (q.mp:3+?=7) over 3 + □ = 7.
// Kinds: choice, keypad (production). Card and keypad range 0–20, so the diagnostic value a + c
// (up to 17) can be dealt as a card and typed (two digits).
// Wrong answers (pædagogik §3.2): equalsAsAnswer = a + c ("3 + □ = 7 → 10": the = read as "the answer
// comes now", so the two numbers are added), the numbers from the question ('operand') and near
// misses (±1, ±2). Two explanations for one value make it 'ambiguous' (SPEC §4.1, A9); a + c is never
// a number from the question, so it always counts.
// Hint: count on from the first number — "Start på tre. Tæl op til syv. Fire. Fem. Seks. Syv. Tre plus
// fire giver syv." with the hops on a 0–10 line. equalsAsAnswer says what the equals sign means first
// and shows the balance (an animated hint, SPEC §4.3).
import type { ErrorTag, Fact, HintSpec, SkillModule, SpeechPart } from '../types'
import { hintOf, metaOf, num, say, tagged, walk } from '../number/kit'

const FACTS: readonly Fact[] = (() => {
  const out: Fact[] = []
  for (let c = 2; c <= 9; c++) {
    for (let a = 1; a < c; a++) {
      out.push({ id: `mp:${a}+?=${c}`, skill: 'missingPart10', family: 'missing', operands: [a, c], answer: c - a, rank: (c - 2) * 10 + (c - a) })
    }
  }
  return out.sort((x, y) => x.rank - y.rank)
})()

/** a and c from the id (also for a fact the round screen rebuilt from its task). */
function parts(f: Fact): [number, number] {
  const m = /^mp:(\d+)\+\?=(\d+)$/.exec(f.id)
  if (!m) throw new Error(`not a missingPart10 fact: ${f.id}`)
  return [Number(m[1]), Number(m[2])]
}

/** "Start på tre. Tæl op til syv. Fire. Fem. Seks. Syv. Tre plus fire giver syv." */
function countOn(a: number, c: number): SpeechPart[] {
  return [
    say('hint.missingPart10.startOn'), num(a),
    say('hint.missingPart10.countTo'), num(c),
    ...walk(a + 1, c).map((n) => num(n)),
    num(a, 'mid'), say('op.plus'), num(c - a, 'mid'), say('op.giver'), num(c),
  ]
}

function hint(f: Fact, tag: ErrorTag | null): HintSpec {
  const [a, c] = parts(f)
  const strategy = countOn(a, c)
  if (tag === 'equalsAsAnswer') {
    return hintOf(
      [say('hint.algebra2.sameBothSides'), ...strategy],
      { scene: 'balance', left: [{ n: a }, { op: '+' }, { n: c - a }], right: [{ n: c }] },
      'equalsAsAnswer',
      true,
    )
  }
  return hintOf(strategy, { scene: 'line', min: 0, max: 10, hops: walk(a, c) })
}

export default {
  ...metaOf('missingPart10'),
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f) => {
    const [a, c] = parts(f)
    return { scene: 'equation', terms: [{ n: a }, { op: '+' }, { blank: true }, { op: '=' }, { n: c }] }
  },
  optionView: () => 'numeral',
  range: () => [0, 20],
  speech: (f) => [say(`q.${f.id}`)],
  candidates(f) {
    const [a, c] = parts(f)
    const x = c - a
    return tagged(x, [
      [a + c, 'equalsAsAnswer'],
      [a, 'operand'], [c, 'operand'],
      [x + 1, 'near'], [x - 1, 'near'], [x + 2, 'near'], [x - 2, 'near'],
    ])
  },
  hint,
} satisfies SkillModule
