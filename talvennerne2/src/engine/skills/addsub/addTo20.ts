// addTo20 — Plus over tieren (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 36 facts `add:<a>+<b>`
// (CONVENTIONS, the V1 set): a, b = 2–9, a + b = 11–18, one family 'bridge10'. Ranked by how much the
// bigger number needs to make ten (9 + 2 first, 6 + 5 last), the bigger number first within a pair.
// The question is the recorded sentence "Hvad er otte plus fem?" (q.add:8+5) over 8 + 5 = □.
// Kinds: choice, keypad (production), numberline (production; the equation stays on the card and the
// pin goes on the task's 0–20 line, exact).
// Wrong answers (pædagogik §3.2): countFromFirst = sum − 1, forgotCarry = sum − 10 (8 + 5 → 3: the ten
// is filled but left out), wrongOperation = |a − b|, the numbers from the question ('operand') and near
// misses (±1, ±2). Two explanations for one value (7 + 5 → 2: forgot the ten, or subtracted?; 8 + 4 → 4:
// subtracted, or repeated the 4?) make it 'ambiguous' (SPEC §4.1, A9), never evidence.
// Hint: "fyld op til 10" — "Fyld tieren op først. Otte og to giver ti. Ti og tre giver tretten." with the
// two ten-frames (makeTen). countFromFirst hops on a 0–20 line and says where the first hop lands;
// forgotCarry and wrongOperation say why first.
import type { Fact, HintSpec, SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged, walk } from '../number/kit'
import { meaningOf, sumPrompt, swapHint } from './calc'

function rank(a: number, b: number): number {
  const big = Math.max(a, b)
  const small = Math.min(a, b)
  return (10 - big) * 20 + small * 2 + (a < b ? 1 : 0)
}

const FACTS: readonly Fact[] = (() => {
  const out: Fact[] = []
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      if (a + b > 10) out.push({ id: `add:${a}+${b}`, skill: 'addTo20', family: 'bridge10', operands: [a, b], answer: a + b, rank: rank(a, b) })
    }
  }
  return out.sort((x, y) => x.rank - y.rank)
})()

/** "Fyld tieren op først. Otte og to giver ti. Ti og tre giver tretten." */
function makeTen(big: number, small: number) {
  const fill = 10 - big
  return [
    say('hint.addTo20.fillTen'),
    num(big, 'mid'), say('op.og'), num(fill, 'mid'), say('op.giver'), num(10),
    num(10, 'mid'), say('op.og'), num(small - fill, 'mid'), say('op.giver'), num(big + small),
  ]
}

function hint(f: Fact, tag: string | null): HintSpec {
  const [a, b] = f.operands
  if (tag === 'digitSwap') return swapHint(a + b)
  const big = Math.max(a, b)
  const small = Math.min(a, b)
  const strategy = makeTen(big, small)
  const frames = { scene: 'makeTen', a: big, b: small } as const
  switch (tag) {
    case 'countFromFirst':
      return hintOf(
        [say('hint.addsub2.startOn'), num(big), say('hint.addsub2.firstHop'), num(big + 1), ...strategy],
        { scene: 'line', min: 0, max: 20, hops: walk(big, big + small) },
        'countFromFirst',
      )
    case 'forgotCarry':
      return hintOf([say('hint.addTo20.keepTen'), ...strategy], frames, 'forgotCarry', true)
    case 'wrongOperation':
      return hintOf([meaningOf('+'), ...strategy], frames, 'wrongOperation')
    default:
      return hintOf(strategy, frames)
  }
}

export default {
  ...metaOf('addTo20'),
  kinds: ['choice', 'keypad', 'numberline'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f) => sumPrompt(f.operands[0], '+', f.operands[1]),
  optionView: () => 'numeral',
  range: () => [0, 20],
  speech: (f) => [say(`q.${f.id}`)],
  candidates(f) {
    const [a, b] = f.operands
    const s = a + b
    return tagged(s, [
      [s - 1, 'countFromFirst'], [s - 10, 'forgotCarry'], [Math.abs(a - b), 'wrongOperation'],
      [a, 'operand'], [b, 'operand'],
      [s + 1, 'near'], [s - 1, 'near'], [s + 2, 'near'], [s - 2, 'near'],
    ])
  },
  hint,
} satisfies SkillModule
