// fractionShape — Brøker af figurer (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 18 facts, prefix
// `frs:`: `frs:<n>/<d>:<shape>` for a fraction of a circle, rectangle or bar.
//   basic    (2. kl.)  1/2, 1/3, 1/4, 2/4 of a cirkel, rektangel or stang   12
//   nonUnit  (3. kl.)  3/4, 2/3 of a cirkel, rektangel or stang             6
// The figure is cut into d equal parts (the materials' fraction scene).
// choice: "Hvor stor en del er farvet?" — n parts coloured, three fraction cards ('frac:n/d').
// colorParts (KIND2, CONVENTIONS "Opgavetyperne fra bølge 2"): "Farv en fjerdedel." — nothing coloured
//   (`colored: 0`), the child colours parts; the answer is 'frac:n/d', equal fractions in `accept`.
//   Never production at n ≤ 7 (SPEC §3.3).
// fillSlots (production): "Skriv brøken, der er farvet." — numerator over denominator from a palette
//   1–8: the answer 'n|d' (1 in 64 by guessing); an equal fraction ('1|2' for two quarters) is accepted.
// Wrong answers (no catalogue misconception fits a figure cut into equal parts — unequalParts is
// halfShape's, where the cut is unequal): the uncoloured parts counted ((d − n)/d), coloured against
// uncoloured (n/(d − n)), numerator and denominator swapped (d/n, fillSlots), one part too many or too
// few ('near'). An equal fraction is never a wrong card (2/4 is a half).
// Hint: "Figuren er delt i fire lige store dele. En af dem er farvet. Det er en fjerdedel."
import type { AnswerValue, Fact, Prompt, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import type { Denominator } from '../../../speech/fractions'
import { hintOf, metaOf, num, say, tagged, type Entry } from '../number/kit'

type FracShape = 'circle' | 'rect' | 'bar'
type Family = 'basic' | 'nonUnit'

const SHAPES: readonly FracShape[] = ['circle', 'rect', 'bar']
const BASIC: readonly (readonly [number, number])[] = [[1, 2], [1, 4], [1, 3], [2, 4]]
const NON_UNIT: readonly (readonly [number, number])[] = [[3, 4], [2, 3]]

interface Parsed {
  n: number
  d: number
  shape: FracShape
}

function parse(f: Pick<Fact, 'id'>): Parsed {
  const m = /^frs:(\d+)\/(\d+):(\w+)$/.exec(f.id)
  if (!m) throw new Error(`fractionShape: bad id ${f.id}`)
  return { n: Number(m[1]), d: Number(m[2]), shape: m[3] as FracShape }
}

const FACTS: readonly Fact[] = [
  ...BASIC.map((nd) => ['basic', nd] as const),
  ...NON_UNIT.map((nd) => ['nonUnit', nd] as const),
].flatMap(([family, [n, d]], fi) =>
  SHAPES.map((shape, si) => ({
    id: `frs:${n}/${d}:${shape}`,
    skill: 'fractionShape' as const,
    family: family as Family,
    operands: [n, d],
    answer: `frac:${n}/${d}`,
    rank: fi * 10 + si,
  })),
)

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const DENOMINATORS: readonly number[] = [2, 3, 4, 5, 6, 8]

/** n/d and every fraction equal to it with a denominator up to 8. */
function equals(n: number, d: number): [number, number][] {
  const g = gcd(n, d)
  return DENOMINATORS.filter((x) => x % (d / g) === 0).map((x) => [(n / g) * (x / (d / g)), x])
}

const slots = (n: number, d: number) => `${n}|${d}`
const token = (n: number, d: number) => `frac:${n}/${d}`

function candidates(f: Fact) {
  const { n, d } = parse(f)
  const same = new Set(equals(n, d).map(([a, b]) => `${a}/${b}`))
  const entries: Entry[] = []
  const add = (a: number, b: number, tag: 'near' | 'other') => {
    if (a < 0 || b <= 0 || a > b || same.has(`${a}/${b}`)) return
    entries.push([token(a, b), tag], [slots(a, b), tag])
  }
  add(d - n, d, 'other')
  add(n, d - n, 'other')
  add(n + 1, d, 'near')
  add(n - 1, d, 'near')
  add(n, d + 1, 'near')
  add(n, d - 1, 'near')
  for (const [a, b] of [[1, 2], [1, 3], [1, 4], [2, 3], [3, 4]] as const) add(a, b, 'other')
  // fillSlots: denominator written on top
  if (!same.has(`${d}/${n}`)) entries.push([slots(d, n), 'other'])
  return tagged(f.answer, entries)
}

function hint(f: Fact, _tag: string | null, kind?: TaskKind) {
  const { n, d, shape } = parse(f)
  const visual: Prompt = { scene: 'fraction', shape, parts: d, colored: n, equal: true }
  const frac = { frac: { n, d: d as Denominator, form: 'end' as const } }
  if (kind === 'colorParts') {
    return hintOf([say('hint.fractionShape.cutInto'), num(d, 'mid'), say('hint.fractionShape.equalParts'), say('s.fractionShape.colour'), num(n, 'mid', 'c'), say('hint.fractionShape.ofThem'), say('hint.fractionShape.thatIs'), frac], visual)
  }
  return hintOf([
    say('hint.fractionShape.cutInto'), num(d, 'mid'), say('hint.fractionShape.equalParts'),
    num(n, 'mid', 'c'), say('hint.fractionShape.coloured'),
    say('hint.fractionShape.thatIs'), frac,
  ], visual)
}

export default {
  ...metaOf('fractionShape'),
  kinds: ['choice', 'colorParts', 'fillSlots'],
  enumerate: () => [...FACTS],
  answer: (f: Fact, kind: TaskKind): AnswerValue => {
    const { n, d } = parse(f)
    return kind === 'fillSlots' ? slots(n, d) : token(n, d)
  },
  answerType: () => 'token',
  accept: (f: Fact, kind: TaskKind): AnswerValue[] => {
    const { n, d } = parse(f)
    return equals(n, d).filter(([a, b]) => a !== n || b !== d).map(([a, b]) => (kind === 'fillSlots' ? slots(a, b) : token(a, b)))
  },
  options: (_f: Fact, kind: TaskKind) => (kind === 'fillSlots' ? [1, 2, 3, 4, 5, 6, 7, 8] : []),
  prompt: (f: Fact, kind: TaskKind): Prompt => {
    const { n, d, shape } = parse(f)
    return { scene: 'fraction', shape, parts: d, colored: kind === 'colorParts' ? 0 : n, equal: true }
  },
  optionView: () => 'fraction',
  range: () => [0, 1],
  speech: (f: Fact, kind: TaskKind) => {
    const { n, d } = parse(f)
    if (kind === 'colorParts') return [say('s.fractionShape.colour'), { frac: { n, d: d as Denominator, form: 'end' } }]
    return [say(kind === 'fillSlots' ? 's.fractionShape.write' : 's.fractionShape.howBig')]
  },
  candidates,
  hint,
} satisfies SkillModule
