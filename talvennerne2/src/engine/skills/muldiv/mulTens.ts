// mulTens — Gange med hele tiere (SPEC §2.2, pædagogik-forslaget §1.3). Procedure, prefix `mt:`, two
// families (the card's order is the id's, so an id names one family):
//   oneDigitTimesTens  mt:<a>x<T>   a = 2–5 times a whole ten T = 20–90 (3 · 40)     32
//   tensTimesOneDigit  mt:<T>x<a>   a whole ten T = 20–90 times a = 2–5 (40 · 3)     32
// The small fact under it, a · t (t = T : 10), is from the 2- to 5-tables times 2–9, so every table of
// Tabeltoppen meets it. enumerate() gives 20 seeded instances per family. "Hvad er tre gange fyrre?" over
// 3 · 40 = □; kinds choice and keypad (production); card range 0–1000 (the keypad takes four digits, so
// an extra zero can be typed). Speed (SPEC §3.2): keypad 10 s (kinds.ts) and choice 8 s, per family.
// Wrong answers (pædagogik §3.2): tensZero — the zero lost or one too many (3 · 40 → 12 or 1200); mulAsAdd
// (3 · 40 → 43); tableNeighbour — a neighbouring small fact, then the zero ((a ± 1) · T, a · (T ± 10):
// 3 · 40 → 80, 160, 90, 150); the numbers from the question ('operand') and near misses (± 10). A value
// with two explanations is 'ambiguous' (A9: 2 · 40 → 40 is 1 · 40 and the 40 of the question).
// Hint, the rods (a · t rods, HintVisual 'base'): "Fyrre består af fire tiere. Tre gange fire tiere giver
// tolv tiere. Svaret er et hundrede og tyve." tensZero takes the zero away and puts it back: "Gang først
// uden nullet. Tre gange fire giver tolv. Sæt så nullet på igen. Svaret er et hundrede og tyve."
// tableNeighbour counts in hops of the whole ten (animated, SPEC §4.3): "Tæl springene, så du ved, hvornår
// du skal stoppe. Tæl i spring med fyrre. Fyrre. Firs. Et hundrede og tyve. Tre gange fyrre giver et
// hundrede og tyve." mulAsAdd says first that the two numbers are not added.
import type { ErrorTag, Fact, FamilyDef, HintSpec, Rng, SkillModule, SpeechPart, TaskKind } from '../types'
import { hintOf, metaOf, num, say, tagged } from '../number/kit'
import { equationSpeech } from '../../../speech/equation'
import { answerIs, canonicalFacts, drawInstance, type Drawer } from '../addsub/calc'
import { timesSays, timesTerms } from './tables'

const META = metaOf('mulTens')
const FAST: Partial<Record<TaskKind, number>> = { choice: 8_000, keypad: 10_000 }
const FAMILIES: FamilyDef[] = META.families.map((f) => ({ ...f, fastMs: FAST }))
const RANK: Readonly<Record<string, number>> = Object.fromEntries(FAMILIES.map((f) => [f.id, f.rank]))

/** The two factors as on the card, the one-digit a and the whole ten T. */
interface Product { first: number; second: number; a: number; T: number }

function parts(f: Pick<Fact, 'id'>): Product {
  const m = /^mt:(\d+)x(\d+)$/.exec(f.id)
  if (!m) throw new Error(`not a mulTens fact: ${f.id}`)
  const first = Number(m[1])
  const second = Number(m[2])
  return first < 10 ? { first, second, a: first, T: second } : { first, second, a: second, T: first }
}

const make = (family: string, first: number, second: number): Fact => ({
  id: `mt:${first}x${second}`, skill: 'mulTens', family, operands: [first, second], answer: first * second, rank: RANK[family],
})

const drawer: Drawer = {
  draw(family: string, rng: Rng) {
    const a = rng.between(2, 5)
    const T = 10 * rng.between(2, 9)
    return family === 'oneDigitTimesTens' ? make(family, a, T) : make('tensTimesOneDigit', T, a)
  },
}

const CANON = canonicalFacts('mulTens', drawer, FAMILIES)

/** "fire tiere" inside a sentence, and at its end ("… giver tolv tiere."). */
const tens = (n: number): SpeechPart[] => [num(n, 'mid'), say(n === 1 ? 'noun.addsub2.tier' : 'noun.addsub2.tiere')]
const tensEnd = (n: number): SpeechPart[] => [num(n, 'mid'), say(n === 1 ? 'noun.place.t.sg.end' : 'noun.place.t.pl.end')]

function hint(f: Fact, tag: ErrorTag | null): HintSpec {
  const { first, second, a, T } = parts(f)
  const t = T / 10
  const x = a * T
  const visual = { scene: 'base', h: 0, t: a * t, o: 0, order: 'hto' } as const
  if (tag === 'tensZero') {
    const small = first === a ? timesSays(a, t) : timesSays(t, a)
    return hintOf([say('hint.mulTens.withoutZero'), ...small, say('hint.mulTens.zeroBack'), ...answerIs(x)], visual, 'tensZero')
  }
  if (tag === 'tableNeighbour') {
    const hops = Array.from({ length: a }, (_, i) => num((i + 1) * T))
    return hintOf(
      [say('hint.mul2510.countHops'), say('hint.mul2510.skipBy'), num(T), ...hops, ...timesSays(first, second)],
      { scene: 'line', min: 0, max: Math.ceil(x / 100) * 100, hops: Array.from({ length: a + 1 }, (_, i) => i * T) },
      'tableNeighbour',
      true,
    )
  }
  // "Fyrre består af fire tiere. Tre gange fire tiere giver tolv tiere." in the card's order
  const times = first === a ? [num(a, 'mid'), say('op.gange'), ...tens(t)] : [...tens(t), say('op.gange'), num(a, 'mid')]
  const words = [num(T, 'mid'), say('frag.mulTens.consistsOf'), ...tensEnd(t), ...times, say('op.giver'), ...tensEnd(a * t), ...answerIs(x)]
  if (tag === 'mulAsAdd') return hintOf([say('hint.muldiv.notPlus'), ...words], visual, 'mulAsAdd')
  return hintOf(words, visual)
}

export default {
  ...META,
  families: FAMILIES,
  kinds: ['choice', 'keypad'],
  enumerate: () => [...CANON],
  instance: (family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>) => drawInstance(drawer, family, rng, avoid),
  answerType: () => 'int',
  prompt: (f) => {
    const { first, second } = parts(f)
    return { scene: 'equation', terms: timesTerms(first, second) }
  },
  optionView: () => 'numeral',
  range: () => [0, 1000],
  speech: (f) => {
    const { first, second } = parts(f)
    return equationSpeech(timesTerms(first, second))
  },
  candidates(f) {
    const { a, T } = parts(f)
    const x = a * T
    return tagged(x, [
      [x / 10, 'tensZero'], [x * 10, 'tensZero'],
      [a + T, 'mulAsAdd'],
      ...[(a + 1) * T, (a - 1) * T, a * (T + 10), a * (T - 10)].map((v) => [v, 'tableNeighbour'] as const),
      [a, 'operand'], [T, 'operand'],
      [x + 10, 'near'], [x - 10, 'near'],
    ])
  },
  hint,
  fastMs: (_f: Fact, kind: TaskKind) => FAST[kind],
} satisfies SkillModule
