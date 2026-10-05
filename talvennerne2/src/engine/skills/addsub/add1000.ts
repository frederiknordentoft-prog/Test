// add1000 — Plus med trecifrede tal (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `a1000:`,
// six families (disjoint, so an instance id names one family; o, t, h are a's ones, tens and hundreds):
//   HTOplusOcarry     a1000:<a>+<b>   a three-digit with tens 0–8, b = 2–9, the ones make ten or more (247 + 6)
//   HTOplusTO         a1000:<a>+<b>   b two-digit with ones ≥ 1, nothing to carry (342 + 25)
//   HTOplusTOcarry1   a1000:<a>+<b>   b two-digit with ones ≥ 1, only the ones carry (348 + 25)
//   HTOplusTOcarry10  a1000:<a>+<b>   b two-digit with ones ≥ 1, the tens carry, the ones may too (372 + 54, 378 + 45)
//   HTOplusHTO        a1000:<a>+<b>   a, b three-digit, neither whole hundreds, nothing to carry (234 + 352)
//   HTOplusHTOcarry   a1000:<a>+<b>   a, b three-digit, neither whole hundreds, one carry or two (278 + 345)
// Every sum is at most 999. enumerate() gives 20 seeded instances per family. "Hvad er to hundrede og
// syvogfyrre plus seks?" over 247 + 6 = □; kinds choice and keypad (production); card range 0–1000.
// Speed (SPEC §3.2): keypad 25 s (kinds.ts), and per family choice 12 s — three-digit cards take reading.
// Wrong answers (pædagogik §3.2): forgotCarry (each column's own sum, no ten carried on: 247 + 6 → 243,
// 378 + 45 → 313), placeMisalign (HTOplusOcarry: the one-digit b added to the tens, a + 10 · b: 247 + 6 →
// 307), wrongOperation (|a − b|), the numbers from the question ('operand') and near misses (±1, ±10,
// ±100: one column off). Two explanations for one value make it 'ambiguous' (A9); a misconception value
// that is the answer with its tens and ones swapped is 'ambiguous' too (A11, buildTask).
// Hint, the columns (HintVisual 'columns' with the carry): "Regn enerne først. Otte plus fem giver
// tretten. En tier går med over til tierne. Regn så tierne. Syv plus fire plus en giver tolv. Et hundrede
// går med over til hundrederne. Regn så hundrederne. Tre plus en giver fire. Svaret er fire hundrede og
// treogtyve." forgotCarry says the rule for each column that carries, with its sum (the round plays the
// carry film): "Når enerne giver ti eller mere, skal tieren med over til tierne. Otte plus fem giver
// tretten. Når tierne giver ti eller mere, skal hundredet med over til hundrederne. Syv plus fire plus en
// giver tolv. Svaret er …". placeMisalign and wrongOperation say what went wrong before the columns.
import type { ErrorTag, Fact, FamilyDef, HintSpec, Rng, SkillModule, TaskKind } from '../types'
import { hintOf, metaOf, say, tagged } from '../number/kit'
import { around, canonicalFacts, columns, drawInstance, meaningOf, sumId, sumPrompt, sumSpeech, swapHint, type Drawer } from './calc'
import { carriesOut, carryRules, noCarrySum, plusColumns } from './calc3'

const META = metaOf('add1000')
const FAST: Partial<Record<TaskKind, number>> = { choice: 12_000, keypad: 25_000 }
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST }))
const RANK: Readonly<Record<string, number>> = Object.fromEntries(FAMILIES.map((f) => [f.id, f.rank]))

const make = (family: string, a: number, b: number): Fact => ({
  id: sumId('a1000', a, '+', b), skill: 'add1000', family, operands: [a, b], answer: a + b, rank: RANK[family],
})

/** a and b from the id (also for a fact the round screen rebuilt from its task). */
function parts(f: Pick<Fact, 'id'>): [number, number] {
  const m = /^a1000:(\d+)\+(\d+)$/.exec(f.id)
  if (!m) throw new Error(`not an add1000 fact: ${f.id}`)
  return [Number(m[1]), Number(m[2])]
}

/** h·100 + t·10 + o. */
const hto = (h: number, t: number, o: number) => 100 * h + 10 * t + o

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    switch (family) {
      case 'HTOplusOcarry': {
        const o = rng.between(1, 9)
        return make(family, hto(rng.between(1, 9), rng.between(0, 8), o), rng.between(Math.max(2, 10 - o), 9))
      }
      case 'HTOplusTO': {
        const o = rng.between(0, 8)
        const t = rng.between(0, 8)
        return make(family, hto(rng.between(1, 9), t, o), hto(0, rng.between(1, 9 - t), rng.between(1, 9 - o)))
      }
      case 'HTOplusTOcarry1': {
        const o = rng.between(1, 9)
        const t = rng.between(0, 7)
        return make(family, hto(rng.between(1, 9), t, o), hto(0, rng.between(1, 8 - t), rng.between(10 - o, 9)))
      }
      case 'HTOplusTOcarry10': {
        const o = rng.between(0, 9)
        const p = rng.between(1, 9)
        const t = rng.between(1, 9)
        const j = rng.between(Math.max(1, 10 - t - (o + p >= 10 ? 1 : 0)), 9)
        return make(family, hto(rng.between(1, 8), t, o), hto(0, j, p))
      }
      case 'HTOplusHTO': {
        const h = rng.between(1, 8)
        const o = rng.between(0, 9)
        const t = rng.between(0, 9)
        const p = rng.between(0, 9 - o)
        const j = rng.between(0, 9 - t)
        if ((o === 0 && t === 0) || (p === 0 && j === 0)) return null
        return make(family, hto(h, t, o), hto(rng.between(1, 9 - h), j, p))
      }
      default: {
        const a = rng.between(101, 898)
        const b = rng.between(101, 898)
        const carry = carriesOut(a, b, 0) || carriesOut(a, b, 1)
        return carry && a + b <= 999 && a % 100 !== 0 && b % 100 !== 0 ? make('HTOplusHTOcarry', a, b) : null
      }
    }
  },
}

const CANON = canonicalFacts('add1000', drawer, FAMILIES)

function hint(f: Fact, tag: ErrorTag | null): HintSpec {
  const [a, b] = parts(f)
  const visual = columns(a, '+', b)
  switch (tag) {
    case 'forgotCarry':
      return hintOf(carryRules(a, b), visual, 'forgotCarry', true)
    case 'placeMisalign':
      return hintOf([say('hint.addsub2.onesToOnes'), ...plusColumns(a, b)], visual, 'placeMisalign')
    case 'wrongOperation':
      return hintOf([meaningOf('+'), ...plusColumns(a, b)], visual, 'wrongOperation')
    case 'digitSwap':
      return swapHint(a + b)
    default:
      return hintOf(plusColumns(a, b), visual)
  }
}

export default {
  ...META,
  families: FAMILIES,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...CANON],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawInstance(drawer, family, rng, avoid),
  answerType: () => 'int',
  prompt: (f) => {
    const [a, b] = parts(f)
    return sumPrompt(a, '+', b)
  },
  optionView: () => 'numeral',
  range: () => [0, 1000],
  speech: (f) => {
    const [a, b] = parts(f)
    return sumSpeech(a, '+', b)
  },
  candidates(f) {
    const [a, b] = parts(f)
    const s = a + b
    return tagged(s, [
      [noCarrySum(a, b), 'forgotCarry'],
      ...(b < 10 ? ([[a + 10 * b, 'placeMisalign']] as const) : []),
      [Math.abs(a - b), 'wrongOperation'],
      [a, 'operand'], [b, 'operand'],
      ...around(s, [1, 10, 100]).map((v) => [v, 'near'] as const),
    ])
  },
  hint,
  fastMs: (_f: Fact, kind: TaskKind) => FAST[kind],
} satisfies SkillModule
