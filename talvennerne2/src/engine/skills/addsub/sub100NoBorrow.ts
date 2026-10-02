// sub100NoBorrow — Minus til 100 uden veksling (SPEC §2.2, pædagogik-forslaget §1.3). Procedure,
// prefix `s100:`, three families (no column needs a borrowed ten):
//   TOminusO   s100:<a>-<b>   a = 21–99 with ones ≥ 1, 1 ≤ b ≤ the ones of a (47 − 5, 47 − 7)
//   TOminusT0  s100:<a>-<b>   a = 21–99 with ones ≥ 1, b = whole tens below a's tens (47 − 20)
//   TOminusTO  s100:<a>-<b>   a = 21–99, b two-digit, ones and tens of b at most a's (47 − 25)
// enumerate() gives 20 seeded instances per family. "Hvad er syvogfyrre minus fem?" over 47 − 5 = □;
// kinds choice and keypad (production); card range 0–100.
// Wrong answers: wrongOperation (a + b; a card when it is at most 100), the numbers from the question
// ('operand') and near misses (±1, ±2, ±10). Without a borrow the column misconceptions give the
// answer itself, so there are none.
// Hint (columns): "Regn enerne først. Syv minus fem giver to. Tierne er de samme. Svaret er toogfyrre."
import type { Fact, FamilyDef, HintSpec, Rng, SkillModule } from '../types'
import { hintOf, metaOf, tagged } from '../number/kit'
import {
  around, between, canonicalFacts, columns, drawInstance, meaningOf, noCarryColumns, otherOperation, sumId, sumPrompt, sumSpeech,
  type Drawer,
} from './calc'

const META = metaOf('sub100NoBorrow')
const RANK: Readonly<Record<string, number>> = Object.fromEntries(META.families.map((f) => [f.id, f.rank]))

const make = (family: string, a: number, b: number): Fact => ({
  id: sumId('s100', a, '−', b), skill: 'sub100NoBorrow', family, operands: [a, b], answer: a - b, rank: RANK[family],
})

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    const t = rng.between(2, 9)
    const o = rng.between(1, 9)
    const a = 10 * t + o
    switch (family) {
      case 'TOminusO':
        return make('TOminusO', a, rng.between(1, o))
      case 'TOminusT0':
        return make('TOminusT0', a, 10 * rng.between(1, t - 1))
      default: {
        const j = between(rng, 1, t - 1)
        return j === null ? null : make('TOminusTO', a, 10 * j + rng.between(1, o))
      }
    }
  },
}

const CANON = canonicalFacts('sub100NoBorrow', drawer, META.families)

function hint(f: Fact, tag: string | null): HintSpec {
  const [a, b] = f.operands
  const steps = noCarryColumns(a, '−', b)
  const visual = columns(a, '−', b)
  if (tag === 'wrongOperation') return hintOf([meaningOf('−'), ...steps], visual, 'wrongOperation')
  return hintOf(steps, visual)
}

export default {
  ...META,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...CANON],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawInstance(drawer, family, rng, avoid),
  answerType: () => 'int',
  prompt: (f) => sumPrompt(f.operands[0], '−', f.operands[1]),
  optionView: () => 'numeral',
  range: () => [0, 100],
  speech: (f) => sumSpeech(f.operands[0], '−', f.operands[1]),
  candidates(f) {
    const [a, b] = f.operands
    const d = a - b
    return tagged(d, [
      [otherOperation(a, '−', b), 'wrongOperation'],
      [a, 'operand'], [b, 'operand'],
      ...around(d, [1, 2, 10]).map((v) => [v, 'near'] as const),
    ])
  },
  hint,
} satisfies SkillModule
