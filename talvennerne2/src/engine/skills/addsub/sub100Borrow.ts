// sub100Borrow — Minus til 100 med veksling (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix
// `s100b:`, four families (disjoint, so an instance id names one family):
//   fromTen          s100b:<a>-<b>   a = 20, 30 … 100, b < a with ones ≥ 1 (40 − 3, 60 − 24, 100 − 37)
//   TOminusOborrow   s100b:<a>-<b>   a = 21–97 with ones 1–7, b = 2–8 above a's ones (43 − 7)
//   TOminusTOborrow  s100b:<a>-<b>   a = 21–98 with ones 1–8, b two-digit with ones above a's and fewer
//                                    tens, b ≠ 19 (53 − 27)
//   nearTen          s100b:<a>-<b>   b = 9 or 19, a = 21–98 with ones 1–8 (52 − 9, 52 − 19)
// enumerate() gives 20 seeded instances per family. "Hvad er treoghalvtreds minus syvogtyve?" over
// 53 − 27 = □; kinds choice and keypad (production); card range 0–100. Speed (SPEC §3.2): keypad 15 s
// (kinds.ts), choice 10 s per family.
// Wrong answers (pædagogik §3.2): smallerFromLarger (per column |x − y|: 53 − 27 → 34, 40 − 3 → 43),
// borrowNoDecrement (the ten borrowed but the tens not lowered: 53 − 27 → 36, 100 − 37 → 173),
// digitComplement10 (fromTen, 100 − TO: each digit to ten, 100 − 37 → 73; SPEC §4.2), wrongOperation
// (a + b), the numbers from the question ('operand') and near misses (±1, ±2, ±10). Two explanations
// for one value (100 − 37 → 137: smallerFromLarger and a + b) make it 'ambiguous'.
// Hint, the empty number line (2. klasse): back to the ten first, then the tens, then the rest — "Start
// på treoghalvtreds. Hop tre tilbage til halvtreds. Hop tyve tilbage til tredive. Hop fire tilbage til
// seksogtyve." nearTen hops a ten too far and one forward. smallerFromLarger and borrowNoDecrement are
// said in columns (the round shows the borrow film for smallerFromLarger); digitComplement10 counts up:
// "Tæl op fra det lille tal. Start på syvogtredive. Hop tre frem til fyrre. Hop tres frem til et
// hundrede. Hoppene giver tilsammen treogtres."
import type { Fact, FamilyDef, HintSpec, Rng, SkillModule, TaskKind } from '../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'
import {
  answerIs, around, between, borrowNoDecrement, canonicalFacts, columns, digitComplement10, digitSum, drawInstance, hopLine,
  hopSpeech, meaningOf, minusStops, plusStops, smallerFromLarger, sumId, sumPrompt, sumSpeech, swapHint, type Drawer,
} from './calc'

const META = metaOf('sub100Borrow')
const FAST: Partial<Record<TaskKind, number>> = { choice: 10_000, keypad: 15_000 }
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST }))
const RANK: Readonly<Record<string, number>> = Object.fromEntries(FAMILIES.map((f) => [f.id, f.rank]))

const make = (family: string, a: number, b: number): Fact => ({
  id: sumId('s100b', a, '−', b), skill: 'sub100Borrow', family, operands: [a, b], answer: a - b, rank: RANK[family],
})

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    switch (family) {
      case 'fromTen': {
        const a = 10 * rng.between(2, 10)
        // one-digit and two-digit takeaways alike: b = 10 · j + p with p ≥ 1
        const b = 10 * rng.between(0, a / 10 - 1) + rng.between(1, 9)
        return make('fromTen', a, b)
      }
      case 'TOminusOborrow': {
        const o = rng.between(1, 7)
        return make('TOminusOborrow', 10 * rng.between(2, 9) + o, rng.between(o + 1, 8))
      }
      case 'TOminusTOborrow': {
        const t = rng.between(2, 9)
        const o = rng.between(1, 8)
        const j = between(rng, 1, t - 1)
        if (j === null) return null
        const b = 10 * j + rng.between(o + 1, 9)
        return b === 19 ? null : make('TOminusTOborrow', 10 * t + o, b)
      }
      default: {
        const b = rng.pick([9, 19])
        const a = 10 * rng.between(2, 9) + rng.between(1, 8)
        return make('nearTen', a, b)
      }
    }
  },
}

const CANON = canonicalFacts('sub100Borrow', drawer, FAMILIES)

function hint(f: Fact, tag: string | null): HintSpec {
  const [a, b] = f.operands
  const d = a - b
  const stops = minusStops(a, b, f.family === 'nearTen')
  const steps = hopSpeech(stops)
  const line = hopLine(stops)
  // 53 − 27 in columns: the ones after the borrow, then the answer
  const inColumns = [...digitSum((a % 10) + 10, '−', b % 10), ...answerIs(d)]
  switch (tag) {
    case 'smallerFromLarger':
      return hintOf([say('hint.addsub2.borrowTen'), ...inColumns], columns(a, '−', b), 'smallerFromLarger', true)
    case 'borrowNoDecrement':
      return hintOf([say('hint.addsub2.oneTenLess'), ...inColumns], columns(a, '−', b), 'borrowNoDecrement', true)
    case 'digitComplement10': {
      const up = plusStops(b, d)
      return hintOf(
        [say('hint.addsub2.countUp'), ...hopSpeech(up), say('hint.addsub2.together'), num(d)],
        hopLine(up),
        'digitComplement10',
      )
    }
    case 'wrongOperation':
      return hintOf([meaningOf('−'), ...steps], line, 'wrongOperation')
    case 'digitSwap':
      return swapHint(d)
    default:
      return hintOf(steps, line)
  }
}

export default {
  ...META,
  families: FAMILIES,
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
    const dc = f.family === 'fromTen' ? digitComplement10(a, b) : null
    return tagged(d, [
      [smallerFromLarger(a, b), 'smallerFromLarger'],
      [borrowNoDecrement(a, b), 'borrowNoDecrement'],
      ...(dc !== null ? ([[dc, 'digitComplement10']] as const) : []),
      [a + b, 'wrongOperation'],
      [a, 'operand'], [b, 'operand'],
      ...around(d, [1, 2, 10]).map((v) => [v, 'near'] as const),
    ])
  },
  hint,
  fastMs: (_f: Fact, kind: TaskKind) => FAST[kind],
} satisfies SkillModule
