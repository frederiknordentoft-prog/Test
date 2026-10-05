// mul6to9 — 6- til 9-tabellen (SPEC §2.2, pædagogik-forslaget §1.3: "resten af 6–9-tabellerne (6·6…9·9 og
// ·1)"). Recall, the 14 products of the 6-, 7-, 8- and 9-table that are in neither mul2510 nor mul34,
// `mul:<a>x<b>` with the smaller factor first (CONVENTIONS). A product in two tables belongs to the
// bigger one, as in mul2510 (6 · 8 to t8), so each table brings its products with the tables before it:
//   t6   1·6, 6·6                    2 facts
//   t7   1·7, 6·7, 7·7               3 facts
//   t8   1·8, 6·8, 7·8, 8·8          4 facts
//   t9   1·9, 6·9, 7·9, 8·9, 9·9     5 facts
// The card shows the table's number second: "Hvad er syv gange otte?" over 7 · 8 = □. Ranked by family
// (t6 … t9), then by the other factor. Kinds: choice, keypad (production). Range 0–100.
// Wrong answers (pædagogik §3.2): tableNeighbour — a neighbouring product (a ± 1) · b, a · (b ± 1), or a
// square a², b² (7 · 8 → 48, 64, 49, 63); mulAsAdd = a + b (7 · 8 → 15); the numbers from the question
// ('operand') and near misses (±1). Two explanations make a value 'ambiguous' (A9: 1 · 7 → 1); so does a
// misconception value that is the answer with its digits swapped (A11, buildTask: 6 · 9 → 45 is 5 · 9 and
// 54 written as it is said).
// Hint, the array split in five rows and the rest (pædagogik: 7·8 = 5·8 + 2·8, HintVisual 'splitArray'):
// "Del rækkerne op i fem og resten. Fem gange otte giver fyrre. To gange otte giver seksten. Fyrre plus
// seksten giver seksoghalvtreds." One row of a table: "Når vi ganger med en, får vi tallet selv. En gange
// syv giver syv." tableNeighbour says to count the rows first (animated, SPEC §4.3); mulAsAdd that the two
// numbers are not added.
import type { ErrorTag, Fact, HintSpec, HintVisual, SkillModule, SpeechPart } from '../types'
import { hintOf, metaOf, num, say } from '../number/kit'
import { equationSpeech } from '../../../speech/equation'
import { swapHint } from '../addsub/calc'
import { factorsOf, tableFacts, timesCandidates, timesSays, timesTerms } from './tables'

const FACTS: readonly Fact[] = tableFacts('mul6to9', [6, 7, 8, 9], [1, 6, 7, 8, 9])
const BY_ID: ReadonlyMap<string, Fact> = new Map(FACTS.map((f) => [f.id, f]))
const parts = (f: Pick<Fact, 'id'>) => factorsOf(BY_ID, { id: f.id, skill: 'mul6to9' })

/** The rows the array is split after: the five-table is known, the rest is a small product. */
const SPLIT = 5

/** The strategy and its picture: the split array for n ≥ 6 rows, one row for 1 · t. */
function strategy(n: number, t: number): { words: SpeechPart[]; visual: HintVisual } {
  if (n === 1) return { words: [say('hint.mul6to9.oneTimes'), ...timesSays(1, t)], visual: { scene: 'array', rows: 1, cols: t } }
  const rest = n - SPLIT
  return {
    words: [
      say('hint.mul6to9.split'), ...timesSays(SPLIT, t), ...timesSays(rest, t),
      num(SPLIT * t, 'mid'), say('op.plus'), num(rest * t, 'mid'), say('op.giver'), num(n * t),
    ],
    visual: { scene: 'splitArray', rows: n, cols: t, split: SPLIT },
  }
}

function hint(f: Fact, tag: ErrorTag | null): HintSpec {
  const [n, t] = parts(f)
  if (tag === 'digitSwap') return swapHint(n * t)
  const { words, visual } = strategy(n, t)
  if (tag === 'tableNeighbour') return hintOf([say('hint.mul6to9.countRows'), ...words], visual, 'tableNeighbour', true)
  if (tag === 'mulAsAdd') return hintOf([say('hint.muldiv.notPlus'), ...words], visual, 'mulAsAdd')
  return hintOf(words, visual)
}

export default {
  ...metaOf('mul6to9'),
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
