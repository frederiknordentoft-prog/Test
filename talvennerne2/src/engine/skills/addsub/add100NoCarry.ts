// add100NoCarry — Plus til 100 uden tierovergang (SPEC §2.2, pædagogik-forslaget §1.3). Procedure,
// prefix `a100:`, three families (no column reaches ten, so every sum is at most 99):
//   TOplusO   a100:<a>+<b>   a = 21–98 with ones ≥ 1, b = 1–9 (34 + 5)
//   TOplusT0  a100:<a>+<b>   a = 21–89 with ones ≥ 1, b = whole tens (34 + 20)
//   TOplusTO  a100:<a>+<b>   a, b two-digit with ones ≥ 1 (34 + 25)
// enumerate() gives 20 seeded instances per family. "Hvad er fireogtredive plus fem?" over 34 + 5 = □.
// Kinds: choice, keypad (production), buildBase (the equation on the card, the sum built with rods and
// cubes; manipulative, so never production here, SPEC §3.3). Range 0–99: the tray has rods and cubes.
// Wrong answers (pædagogik §3.2): placeMisalign (TOplusO: a + 10 · b, 34 + 5 → 84), wrongOperation
// (|a − b|), the numbers from the question ('operand') and near misses (±1, ±2, ±10).
// Hint (columns): "Regn enerne først. Fire plus fem giver ni. Regn så tierne. Tre tiere plus to tiere
// giver fem tiere. Svaret er nioghalvtreds." (only the column that changes for TOplusO and TOplusT0).
import type { Fact, FamilyDef, HintSpec, Rng, SkillModule } from '../types'
import { hintOf, metaOf, say, tagged } from '../number/kit'
import {
  around, between, canonicalFacts, columns, drawInstance, meaningOf, noCarryColumns, otherOperation, sumId, sumPrompt, sumSpeech,
  type Drawer,
} from './calc'

const META = metaOf('add100NoCarry')
const RANK: Readonly<Record<string, number>> = Object.fromEntries(META.families.map((f) => [f.id, f.rank]))

const make = (family: string, a: number, b: number): Fact => ({
  id: sumId('a100', a, '+', b), skill: 'add100NoCarry', family, operands: [a, b], answer: a + b, rank: RANK[family],
})

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    switch (family) {
      case 'TOplusO': {
        const o = rng.between(1, 8)
        return make('TOplusO', 10 * rng.between(2, 9) + o, rng.between(1, 9 - o))
      }
      case 'TOplusT0': {
        const t = rng.between(2, 8)
        return make('TOplusT0', 10 * t + rng.between(1, 9), 10 * rng.between(1, 9 - t))
      }
      default: {
        const t = rng.between(1, 8)
        const o = rng.between(1, 8)
        const j = between(rng, 1, 9 - t)
        const p = between(rng, 1, 9 - o)
        return j === null || p === null ? null : make('TOplusTO', 10 * t + o, 10 * j + p)
      }
    }
  },
}

const CANON = canonicalFacts('add100NoCarry', drawer, META.families)

function hint(f: Fact, tag: string | null): HintSpec {
  const [a, b] = f.operands
  const steps = noCarryColumns(a, '+', b)
  const visual = columns(a, '+', b)
  if (tag === 'placeMisalign') return hintOf([say('hint.addsub2.onesToOnes'), ...steps], visual, 'placeMisalign')
  if (tag === 'wrongOperation') return hintOf([meaningOf('+'), ...steps], visual, 'wrongOperation')
  return hintOf(steps, visual)
}

export default {
  ...META,
  kinds: ['choice', 'keypad', 'buildBase'],
  enumerate: () => [...CANON],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawInstance(drawer, family, rng, avoid),
  answerType: () => 'int',
  prompt: (f) => sumPrompt(f.operands[0], '+', f.operands[1]),
  optionView: () => 'numeral',
  range: () => [0, 99],
  speech: (f) => sumSpeech(f.operands[0], '+', f.operands[1]),
  candidates(f) {
    const [a, b] = f.operands
    const s = a + b
    return tagged(s, [
      ...(b < 10 ? ([[a + 10 * b, 'placeMisalign']] as const) : []),
      [otherOperation(a, '+', b), 'wrongOperation'],
      [a, 'operand'], [b, 'operand'],
      ...around(s, [1, 2, 10]).map((v) => [v, 'near'] as const),
    ])
  },
  hint,
} satisfies SkillModule
