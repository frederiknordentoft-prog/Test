// divAll — Division i den lille tabel (SPEC §2.2, pædagogik-forslaget §1.3: "c : 3, 4, 6–9"). Recall,
// 60 facts `div:<c>/<d>` (CONVENTIONS; shared with div2510, whose divisors are 2, 5 and 10): c = d · q for
// d = 3, 4, 6, 7, 8, 9 and q = 1–10, families d3, d4, d6, d7, d8, d9, ranked by divisor, then by q.
// The question: "Hvad er seksoghalvtreds divideret med otte?" over 56 : 8 = □ (SPEC A19: ":" is "divideret
// med" in 3. klasse). Kinds: choice, keypad (production). Range 0–100.
// Wrong answers (pædagogik §3.2): tableNeighbour — the quotient ± 1 while it is a fact of the table (q = 1–10);
// wrongOperation — c − d or c · d (another operation on the two numbers; ":" read as "·"); the numbers from
// the question ('operand') and near misses (± 2). A value with two explanations is 'ambiguous' (A9:
// 12 : 3 → 3 is the quotient − 1 and the 3 of the question).
// Hint: the times table backwards over the array of q rows of d — "Hvad gange otte giver seksoghalvtreds?
// Syv gange otte giver seksoghalvtreds. Seksoghalvtreds divideret med otte giver syv." tableNeighbour
// checks the answer by multiplying ("Prøv at gange dit svar med otte. Det skal give seksoghalvtreds.",
// animated, SPEC §4.3); wrongOperation says what dividing is ("Divideret med betyder, at vi deler i lige
// store dele."). div2510 comes first and bridges "divideret med" to "delt med"; here it is known.
import type { ErrorTag, Fact, HintSpec, SkillModule } from '../types'
import { hintOf, metaOf, say } from '../number/kit'
import { equationSpeech } from '../../../speech/equation'
import {
  checkByTimes, divisionArray, divisionCandidates, divisionFacts, divisionOf, divisionStrategy, divisionTerms, soDivided, timesSays,
} from './tables'

const FACTS: readonly Fact[] = divisionFacts('divAll', [3, 4, 6, 7, 8, 9])

function hint(f: Fact, tag: ErrorTag | null): HintSpec {
  const { c, d, q } = divisionOf(f)
  const visual = divisionArray(c, d)
  if (tag === 'tableNeighbour') return hintOf([...checkByTimes(c, d), ...timesSays(q, d), ...soDivided(c, d)], visual, 'tableNeighbour', true)
  if (tag === 'wrongOperation') return hintOf([say('hint.div.meaning'), ...divisionStrategy(c, d)], visual, 'wrongOperation')
  return hintOf(divisionStrategy(c, d), visual)
}

export default {
  ...metaOf('divAll'),
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f) => {
    const { c, d } = divisionOf(f)
    return { scene: 'equation', terms: divisionTerms(c, d) }
  },
  optionView: () => 'numeral',
  range: () => [0, 100],
  speech: (f) => {
    const { c, d } = divisionOf(f)
    return equationSpeech(divisionTerms(c, d))
  },
  candidates: (f) => {
    const { c, d } = divisionOf(f)
    return divisionCandidates(c, d)
  },
  hint,
} satisfies SkillModule
