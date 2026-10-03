// mul2510 — 2-, 5- og 10-tabellen (SPEC §2.2, pædagogik-forslaget §1.3). Recall, the 27 products of
// the three tables with factors 1–10, `mul:<a>x<b>` with the smaller factor first (CONVENTIONS). A
// product in two tables belongs to the bigger one (2 · 5 to t5, 2 · 10 and 5 · 10 to t10):
//   t2   1·2 … 9·2 without 5·2    8 facts
//   t5   1·5 … 9·5                9 facts
//   t10  1·10 … 10·10            10 facts
// The card shows the table's number second, the way the table is said ("tre gange fem"), so the order
// is fixed per fact and the voice and the card always agree: "Hvad er tre gange fem?" over 3 · 5 = □.
// Ranked by family (t2, t5, t10), then by the other factor.
// Kinds: choice, keypad (production). Range 0–100.
// Wrong answers (pædagogik §3.2): tableNeighbour — a neighbouring product (a ± 1) · b, a · (b ± 1), or a
// square a², b² (3 · 5 → 10, 20, 12, 18, 9, 25; zero left out); mulAsAdd = a + b (3 · 5 → 8); the
// numbers from the question ('operand') and near misses (±1). Two explanations make a value
// 'ambiguous' (A9): 1 · 5 → 1 (1², or the 1 of the question).
// Hint: skip count by the table's number — "Tæl i spring med fem. Fem. Ti. Femten. Tre gange fem giver
// femten." — with the array (products to 30) or the hops on a number line. tableNeighbour says to count
// the hops first (one of SPEC §4.3's eight animated hints); mulAsAdd that the numbers are not added.
import type { ErrorTag, Fact, HintSpec, HintVisual, SkillModule, SpeechPart } from '../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'
import { equationSpeech } from '../../../speech/equation'
import { swapHint } from '../addsub/calc'

const TABLES = [2, 5, 10] as const

const FACTS: readonly Fact[] = (() => {
  const out = new Map<string, Fact>()
  // bigger tables first, so a shared product lands in the bigger table
  for (const [ti, t] of [...TABLES.entries()].reverse()) {
    for (let n = 1; n <= 10; n++) {
      if (n > t && TABLES.includes(n as 2 | 5 | 10)) continue // 10 · 5 is 5 · 10 (t10)
      const id = `mul:${Math.min(n, t)}x${Math.max(n, t)}`
      if (out.has(id)) continue
      out.set(id, { id, skill: 'mul2510', family: `t${t}`, operands: [n, t], answer: n * t, rank: ti * 20 + n })
    }
  }
  return [...out.values()].sort((a, b) => a.rank - b.rank)
})()

const BY_ID: ReadonlyMap<string, Fact> = new Map(FACTS.map((f) => [f.id, f]))

/** [n, t]: the other factor and the table, as on the card (also for a fact rebuilt from its task). */
function parts(f: Pick<Fact, 'id'>): [number, number] {
  const known = BY_ID.get(f.id)
  if (!known) throw new Error(`not a mul2510 fact: ${f.id}`)
  return [known.operands[0], known.operands[1]]
}

function hint(f: Fact, tag: ErrorTag | null): HintSpec {
  const [n, t] = parts(f)
  const x = n * t
  if (tag === 'digitSwap') return swapHint(x)
  const words: SpeechPart[] = [
    say('hint.mul2510.skipBy'), num(t),
    ...Array.from({ length: n }, (_, i) => num((i + 1) * t)),
    num(n, 'mid'), say('op.gange'), num(t, 'mid'), say('op.giver'), num(x),
  ]
  const visual: HintVisual = x <= 30
    ? { scene: 'array', rows: n, cols: t }
    : { scene: 'line', min: 0, max: Math.ceil(x / 10) * 10, hops: Array.from({ length: n + 1 }, (_, i) => i * t) }
  if (tag === 'tableNeighbour') return hintOf([say('hint.mul2510.countHops'), ...words], visual, 'tableNeighbour', true)
  if (tag === 'mulAsAdd') return hintOf([say('hint.muldiv.notPlus'), ...words], visual, 'mulAsAdd')
  return hintOf(words, visual)
}

export default {
  ...metaOf('mul2510'),
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f) => {
    const [n, t] = parts(f)
    return { scene: 'equation', terms: [{ n }, { op: '·' }, { n: t }, { op: '=' }, { blank: true }] }
  },
  optionView: () => 'numeral',
  range: () => [0, 100],
  speech: (f) => {
    const [n, t] = parts(f)
    return equationSpeech([{ n }, { op: '·' }, { n: t }, { op: '=' }, { blank: true }])
  },
  candidates(f) {
    const [a, b] = parts(f)
    const x = a * b
    const neighbours = [(a + 1) * b, a * (b + 1), a * a, b * b, ...(a > 1 ? [(a - 1) * b] : []), ...(b > 1 ? [a * (b - 1)] : [])]
    return tagged(x, [
      ...neighbours.map((v) => [v, 'tableNeighbour'] as const),
      [a + b, 'mulAsAdd'],
      [a, 'operand'], [b, 'operand'],
      [x + 1, 'near'], [x - 1, 'near'],
    ])
  },
  hint,
} satisfies SkillModule
