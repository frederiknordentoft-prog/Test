// mul34 — 3- og 4-tabellen (SPEC §2.2, pædagogik-forslaget §1.3: "resten af 3- og 4-tabellen"). Recall,
// the 13 products of the 3- and 4-table with factors 1–10 that are not in the 2-, 5- and 10-table
// (mul2510), `mul:<a>x<b>` with the smaller factor first (CONVENTIONS). A product in both tables belongs
// to the bigger one, as in mul2510 (3 · 4 to t4):
//   t3   1·3, 3·3, 6·3, 7·3, 8·3, 9·3          6 facts
//   t4   1·4, 3·4, 4·4, 6·4, 7·4, 8·4, 9·4     7 facts
// The card shows the table's number second, the way the table is said: "Hvad er seks gange tre?" over
// 6 · 3 = □. Ranked by family (t3, t4), then by the other factor.
// Kinds: choice, keypad (production). Range 0–100.
// Wrong answers (pædagogik §3.2): tableNeighbour — a neighbouring product (a ± 1) · b, a · (b ± 1), or a
// square a², b² (7 · 4 → 24, 32, 21, 35, 49, 16); mulAsAdd = a + b (7 · 4 → 11); the numbers from the
// question ('operand') and near misses (±1). Two explanations make a value 'ambiguous' (A9: 1 · 3 → 1),
// and so would a misconception value that is the answer with its digits swapped (A11, buildTask).
// Hint, as in mul2510 (the 3- and 4-table are counted the same way): skip count by the table's number over
// the array, a row per hop — "Tæl i spring med tre. Tre. Seks. Ni. Tolv. Femten. Atten. Seks gange tre
// giver atten." tableNeighbour says to count the hops first (animated, SPEC §4.3); mulAsAdd that the two
// numbers are not added. One times t is no skip count (one hop: "Tæl i spring med tre. Tre. En gange tre
// giver tre.", QA3b): it says what times one does, as mul6to9 — "Når vi ganger med en, får vi tallet selv.
// En gange tre giver tre."
import type { ErrorTag, Fact, HintSpec, SkillModule, SpeechPart } from '../types'
import { hintOf, metaOf, num, say } from '../number/kit'
import { equationSpeech } from '../../../speech/equation'
import { swapHint } from '../addsub/calc'
import { factorsOf, tableFacts, timesCandidates, timesSays, timesTerms } from './tables'

const FACTS: readonly Fact[] = tableFacts('mul34', [3, 4], [1, 3, 4, 6, 7, 8, 9])
const BY_ID: ReadonlyMap<string, Fact> = new Map(FACTS.map((f) => [f.id, f]))
const parts = (f: Pick<Fact, 'id'>) => factorsOf(BY_ID, { id: f.id, skill: 'mul34' })

function hint(f: Fact, tag: ErrorTag | null): HintSpec {
  const [n, t] = parts(f)
  const x = n * t
  if (tag === 'digitSwap') return swapHint(x)
  const words: SpeechPart[] = n === 1
    ? [say('hint.mul6to9.oneTimes'), ...timesSays(1, t)]
    : [
        say('hint.mul2510.skipBy'), num(t),
        ...Array.from({ length: n }, (_, i) => num((i + 1) * t)),
        num(n, 'mid'), say('op.gange'), num(t, 'mid'), say('op.giver'), num(x),
      ]
  const visual = { scene: 'array', rows: n, cols: t } as const
  // one times t has one hop: nothing to count
  if (tag === 'tableNeighbour') return hintOf([...(n === 1 ? [] : [say('hint.mul2510.countHops')]), ...words], visual, 'tableNeighbour', true)
  if (tag === 'mulAsAdd') return hintOf([say('hint.muldiv.notPlus'), ...words], visual, 'mulAsAdd')
  return hintOf(words, visual)
}

export default {
  ...metaOf('mul34'),
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f) => ({ scene: 'equation', terms: timesTerms(...parts(f)) }),
  optionView: () => 'numeral',
  range: () => [0, 100],
  speech: (f) => equationSpeech(timesTerms(...parts(f))),
  candidates: (f) => timesCandidates(...parts(f)),
  hint,
} satisfies SkillModule
