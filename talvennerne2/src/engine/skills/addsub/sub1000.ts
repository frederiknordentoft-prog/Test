// sub1000 — Minus med trecifrede tal (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `s1000:`,
// six families (disjoint, so an instance id names one family; o, t, h are a's ones, tens and hundreds):
//   HTOminusOborrow    s1000:<a>-<b>   a three-digit with tens ≥ 1, b = 1–9 above a's ones (243 − 7)
//   HTOminusTO         s1000:<a>-<b>   b two-digit with ones ≥ 1, nothing to exchange (368 − 25)
//   HTOminusTOborrow   s1000:<a>-<b>   b two-digit with ones ≥ 1, one exchange or two, never across a
//                                      zero ten, the answer three-digit (352 − 27, 325 − 42, 423 − 58)
//   HTOminusHTO        s1000:<a>-<b>   b three-digit, not whole hundreds, fewer hundreds than a, nothing
//                                      to exchange (587 − 234)
//   HTOminusHTOborrow  s1000:<a>-<b>   b three-digit, not whole hundreds, b < a, one exchange or two, never
//                                      across a zero ten (523 − 278, 512 − 278)
//   acrossZero         s1000:<a>-<b>   a with zero tens, the ones exchange across the zero; b one-, two-
//                                      or three-digit (402 − 7, 500 − 36, 403 − 158)
// A two-digit or one-digit b always leaves a three-digit answer. enumerate() gives 20 seeded instances per
// family. "Hvad er fire hundrede og to minus syv?" over 402 − 7 = □; kinds choice and keypad (production);
// card range 0–1000. Speed (SPEC §3.2): keypad 25 s (kinds.ts), and per family choice 12 s.
// Wrong answers (pædagogik §3.2): smallerFromLarger (per column |x − y|: 423 − 158 → 335), borrowNoDecrement
// (a column borrows ten, the next is never lowered: 423 − 158 → 375, 402 − 7 → 405), wrongOperation
// (a + b), the numbers from the question ('operand') and near misses (±1, ±10, ±100). Two explanations for
// one value make it 'ambiguous' (402 − 7 → 405 is both smallerFromLarger and borrowNoDecrement; A9); so is
// a misconception value that is the answer with its tens and ones swapped (A11, buildTask).
// Hint, the columns (HintVisual 'columns' with the exchanges): "Regn enerne først. Der er ikke enere nok.
// Veksl en tier til ti enere. Tretten minus otte giver fem. Regn så tierne. Der er ikke tiere nok. Veksl et
// hundrede til ti tiere. Elleve minus fem giver seks. Regn så hundrederne. Tre minus en giver to. Svaret er
// to hundrede og femogtres." Across a zero: "Der er ikke enere nok, og der er ingen tiere. Veksl først et
// hundrede til ti tiere, og så en tier til ti enere. Tolv minus syv giver fem. Regn så tierne. Ni minus
// nul giver ni. …" smallerFromLarger (the borrow film) says first that the bottom number is always taken
// from the top one, borrowNoDecrement (the film with the lowered digit in focus) that the column a ten or
// a hundred was exchanged from has one less — then only the columns that exchange, as in 2. klasse;
// wrongOperation says what minus means before the whole walk.
import type { ErrorTag, Fact, FamilyDef, HintSpec, Rng, SkillModule, TaskKind } from '../types'
import { hintOf, metaOf, say, tagged } from '../number/kit'
import {
  around, borrowNoDecrement, canonicalFacts, columns, drawInstance, meaningOf, needsBorrow, smallerFromLarger, sumId, sumPrompt,
  sumSpeech, swapHint, type Drawer,
} from './calc'
import { digitAt, exchangeColumns, firstExchange, minusColumns } from './calc3'

const META = metaOf('sub1000')
const FAST: Partial<Record<TaskKind, number>> = { choice: 12_000, keypad: 25_000 }
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST }))
const RANK: Readonly<Record<string, number>> = Object.fromEntries(FAMILIES.map((f) => [f.id, f.rank]))

const make = (family: string, a: number, b: number): Fact => ({
  id: sumId('s1000', a, '−', b), skill: 'sub1000', family, operands: [a, b], answer: a - b, rank: RANK[family],
})

/** a and b from the id (also for a fact the round screen rebuilt from its task). */
function parts(f: Pick<Fact, 'id'>): [number, number] {
  const m = /^s1000:(\d+)-(\d+)$/.exec(f.id)
  if (!m) throw new Error(`not a sub1000 fact: ${f.id}`)
  return [Number(m[1]), Number(m[2])]
}

/** h·100 + t·10 + o. */
const hto = (h: number, t: number, o: number) => 100 * h + 10 * t + o

/** The ones exchange across a zero ten (402 − 7): the acrossZero family's own difficulty. */
const acrossZero = (a: number, b: number) => digitAt(a, 0) < digitAt(b, 0) && digitAt(a, 1) === 0

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    switch (family) {
      case 'HTOminusOborrow': {
        const o = rng.between(0, 8)
        return make(family, hto(rng.between(1, 9), rng.between(1, 9), o), rng.between(o + 1, 9))
      }
      case 'HTOminusTO': {
        const p = rng.between(1, 9)
        const j = rng.between(1, 9)
        return make(family, hto(rng.between(1, 9), rng.between(j, 9), rng.between(p, 9)), hto(0, j, p))
      }
      case 'HTOminusTOborrow': {
        const a = rng.between(110, 999)
        const b = hto(0, rng.between(1, 9), rng.between(1, 9))
        return needsBorrow(a, b) && !acrossZero(a, b) && a - b >= 100 ? make(family, a, b) : null
      }
      case 'HTOminusHTO': {
        const h = rng.between(2, 9)
        const p = rng.between(0, 9)
        const j = rng.between(0, 9)
        if (p === 0 && j === 0) return null
        return make(family, hto(h, rng.between(j, 9), rng.between(p, 9)), hto(rng.between(1, h - 1), j, p))
      }
      case 'HTOminusHTOborrow': {
        const a = rng.between(201, 999)
        const b = rng.between(101, a - 1)
        return b % 100 !== 0 && needsBorrow(a, b) && !acrossZero(a, b) ? make(family, a, b) : null
      }
      default: {
        const h = rng.between(2, 9)
        const o = rng.between(0, 8)
        const p = rng.between(o + 1, 9)
        const size = rng.between(1, 3)
        const b = size === 1 ? p : size === 2 ? hto(0, rng.between(1, 9), p) : hto(rng.between(1, h - 1), rng.between(0, 9), p)
        return make('acrossZero', hto(h, 0, o), b)
      }
    }
  },
}

const CANON = canonicalFacts('sub1000', drawer, FAMILIES)

function hint(f: Fact, tag: ErrorTag | null): HintSpec {
  const [a, b] = parts(f)
  const visual = columns(a, '−', b)
  const steps = minusColumns(a, b)
  switch (tag) {
    case 'smallerFromLarger':
      return hintOf([say('hint.sub1000.topMinusBottom'), ...exchangeColumns(a, b)], visual, 'smallerFromLarger', true)
    case 'borrowNoDecrement': {
      // the column the first ten (or hundred, across a zero or for the tens) was exchanged from
      const lead = firstExchange(a, b) === 'ones' ? 'hint.addsub2.oneTenLess' : 'hint.sub1000.oneHundredLess'
      return hintOf([say(lead), ...exchangeColumns(a, b)], visual, 'borrowNoDecrement', true)
    }
    case 'wrongOperation':
      return hintOf([meaningOf('−'), ...steps], visual, 'wrongOperation')
    case 'digitSwap':
      return swapHint(a - b)
    default:
      return hintOf(steps, visual)
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
    return sumPrompt(a, '−', b)
  },
  optionView: () => 'numeral',
  range: () => [0, 1000],
  speech: (f) => {
    const [a, b] = parts(f)
    return sumSpeech(a, '−', b)
  },
  candidates(f) {
    const [a, b] = parts(f)
    const d = a - b
    return tagged(d, [
      [smallerFromLarger(a, b), 'smallerFromLarger'],
      [borrowNoDecrement(a, b), 'borrowNoDecrement'],
      [a + b, 'wrongOperation'],
      [a, 'operand'], [b, 'operand'],
      ...around(d, [1, 10, 100]).map((v) => [v, 'near'] as const),
    ])
  },
  hint,
  fastMs: (_f: Fact, kind: TaskKind) => FAST[kind],
} satisfies SkillModule
