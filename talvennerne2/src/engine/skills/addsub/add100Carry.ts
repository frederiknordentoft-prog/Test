// add100Carry — Plus til 100 med tierovergang (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix
// `a100c:`, five families (disjoint, so an instance id names one family; SPEC §4.1's add:38+45 is
// a100c:38+45 here):
//   toNextTen        a100c:<a>+<b>   a = 21–99 with ones o ≥ 1, b = 10 − o (37 + 3)
//   TOplusOcarry     a100c:<a>+<b>   a = 23–89, b = 2–8, the ones make 11 or more (38 + 5)
//   TOplusTOcarry    a100c:<a>+<b>   a, b two-digit with ones ≥ 1, the ones make ten or more, a + b ≤ 100,
//                                    b ≠ 19 (38 + 45, 37 + 23)
//   nearTen          a100c:<a>+<b>   b = 9 or 19, a's ones 2–9, a + b ≤ 100 (46 + 9, 46 + 19)
//   TOplusTOover100  a100c:<a>+<b>   a, b two-digit with ones ≥ 1, a + b = 101–198 (67 + 58)
// enumerate() gives 20 seeded instances per family. "Hvad er otteogtredive plus femogfyrre?" over
// 38 + 45 = □. Kinds: choice, keypad (production), numberline (production: the equation stays on the
// card, the pin goes on the task's line, 0–100 ±5 or 0–200 ±10 for TOplusTOover100, SPEC §3.3).
// Card range 0–100 (0–200 for TOplusTOover100). Speed (SPEC §3.2): keypad 15 s (kinds.ts), and per
// family choice 10 s and numberline 18 s — a sum with a carry takes longer than reading a card.
// Wrong answers (pædagogik §3.2): forgotCarry (a + b − 10 when the ones make ten or more: 38 + 45 → 73,
// 37 + 3 → 30, 67 + 58 → 115), placeMisalign (a one-digit b added to the tens: a + 10 · b, 38 + 5 → 88),
// wrongOperation (|a − b|), the numbers from the question ('operand': 38 + 45 → 38 is an operand,
// never digitSwap, SPEC §4.1) and near misses (±1, ±2, ±10). Two explanations → 'ambiguous'.
// Hint, the empty number line with hops (2. klasse): "Start på otteogtredive. Hop to frem til fyrre.
// Hop fyrre frem til firs. Hop tre frem til treogfirs." nearTen hops a ten and one back. The forgotCarry
// hint is said in columns (the round shows the carry film there): "Når enerne giver ti eller mere,
// skal tieren med over til tierne. Otte plus fem giver tretten. Svaret er treogfirs."
import type { Fact, FamilyDef, HintSpec, Rng, SkillModule, TaskKind } from '../types'
import { hintOf, metaOf, say, tagged } from '../number/kit'
import {
  answerIs, around, canonicalFacts, columns, digitSum, drawInstance, hopLine, hopSpeech, meaningOf, onesCarry, plusStops, sumId,
  sumPrompt, sumSpeech, type Drawer,
} from './calc'

const META = metaOf('add100Carry')
const FAST: Partial<Record<TaskKind, number>> = { choice: 10_000, keypad: 15_000, numberline: 18_000 }
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST }))
const RANK: Readonly<Record<string, number>> = Object.fromEntries(FAMILIES.map((f) => [f.id, f.rank]))

const make = (family: string, a: number, b: number): Fact => ({
  id: sumId('a100c', a, '+', b), skill: 'add100Carry', family, operands: [a, b], answer: a + b, rank: RANK[family],
})

/** A two-digit number with ones ≥ 1. */
const twoDigit = (rng: Rng, minTens = 1, maxTens = 9) => 10 * rng.between(minTens, maxTens) + rng.between(1, 9)

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    switch (family) {
      case 'toNextTen': {
        const o = rng.between(1, 9)
        return make('toNextTen', 10 * rng.between(2, 9) + o, 10 - o)
      }
      case 'TOplusOcarry': {
        const o = rng.between(3, 9)
        return make('TOplusOcarry', 10 * rng.between(2, 8) + o, rng.between(11 - o, 8))
      }
      case 'TOplusTOcarry': {
        const a = twoDigit(rng, 1, 8)
        const b = twoDigit(rng, 1, 8)
        return onesCarry(a, b) && a + b <= 100 && b !== 19 ? make('TOplusTOcarry', a, b) : null
      }
      case 'nearTen': {
        const b = rng.pick([9, 19])
        const a = 10 * rng.between(2, 9) + rng.between(2, 9)
        return a + b <= 100 ? make('nearTen', a, b) : null
      }
      default: {
        const a = twoDigit(rng, 2, 9)
        const b = twoDigit(rng, 2, 9)
        return a + b > 100 ? make('TOplusTOover100', a, b) : null
      }
    }
  },
}

const CANON = canonicalFacts('add100Carry', drawer, FAMILIES)

const top = (f: Fact) => (f.family === 'TOplusTOover100' ? 200 : 100)

function hint(f: Fact, tag: string | null): HintSpec {
  const [a, b] = f.operands
  const s = a + b
  const stops = plusStops(a, b, f.family === 'nearTen')
  const steps = hopSpeech(stops)
  const line = hopLine(stops)
  switch (tag) {
    case 'forgotCarry':
      return hintOf(
        [say('hint.addsub2.carryTen'), ...digitSum(a % 10, '+', b % 10), ...answerIs(s)],
        columns(a, '+', b),
        'forgotCarry',
        true,
      )
    case 'placeMisalign':
      return hintOf([say('hint.addsub2.onesToOnes'), ...steps], line, 'placeMisalign')
    case 'wrongOperation':
      return hintOf([meaningOf('+'), ...steps], line, 'wrongOperation')
    default:
      return hintOf(steps, line)
  }
}

export default {
  ...META,
  families: FAMILIES,
  kinds: ['choice', 'keypad', 'numberline'],
  enumerate: () => [...CANON],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawInstance(drawer, family, rng, avoid),
  answerType: () => 'int',
  prompt: (f) => sumPrompt(f.operands[0], '+', f.operands[1]),
  optionView: () => 'numeral',
  range: (f) => [0, top(f)],
  speech: (f) => sumSpeech(f.operands[0], '+', f.operands[1]),
  candidates(f) {
    const [a, b] = f.operands
    const s = a + b
    return tagged(s, [
      ...(onesCarry(a, b) ? ([[s - 10, 'forgotCarry']] as const) : []),
      ...(b < 10 ? ([[a + 10 * b, 'placeMisalign']] as const) : []),
      [Math.abs(a - b), 'wrongOperation'],
      [a, 'operand'], [b, 'operand'],
      ...around(s, [1, 2, 10]).map((v) => [v, 'near'] as const),
    ])
  },
  hint,
  fastMs: (_f: Fact, kind: TaskKind) => FAST[kind],
} satisfies SkillModule
