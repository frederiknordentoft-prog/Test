// Shared by the number and place-value skills of 1.–2. klasse (hear100, order100, numberLine100,
// tensOnes, hear1000, order1000, numberLine1000, placeValue1000): the digits of a number, the
// spoken place words ("fire tiere og syv enere"), seeded instances and the canonical facts.
// It has no SkillDef default export, so the registry skips it (like number/kit.ts).
//
// Every skill here keeps its instance in the fact id and reads it back with its own parse(): a
// strategy hint for a drawn instance is built from a fact the round screen rebuilds from the task
// (src/ui/hint/hintFor.ts factFor), which has the id but neither `data` nor the kind's own answer.
import type { Fact, FamilyDef, Rng, SkillId, SpeechPart } from '../types'
import type { SpeechForm } from '../../types'
import { hashSeed, makeRng } from '../../rng'
import { num, say } from '../number/kit'

// ─── Digits ─────────────────────────────────────────────────────────────────

export const hundredsOf = (n: number): number => Math.floor(n / 100)
export const tensOf = (n: number): number => Math.floor(n / 10) % 10
export const onesOf = (n: number): number => n % 10

export type Place = 'h' | 't' | 'o'
export const PLACE_VALUE: Readonly<Record<Place, number>> = { h: 100, t: 10, o: 1 }

/** The non-zero parts of a number: 472 → [400, 70, 2], 407 → [400, 7]. */
export function expandedParts(n: number): number[] {
  return [hundredsOf(n) * 100, tensOf(n) * 10, onesOf(n)].filter((v) => v > 0)
}

/** Every order of a list (the parts of an expanded number may be written in any order). */
export function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]]
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]))
}

/** fillSlots and sortOrder answers: the parts joined by '|'. */
export const joined = (parts: readonly (number | string)[]): string => parts.join('|')

// ─── Place words ────────────────────────────────────────────────────────────

/**
 * The noun after a count: "tier"/"tiere", "ener"/"enere", "hundrede"/"hundreder" — one hundred is
 * "et hundrede" (neuter), so `placeCount` gives its number the neuter "et".
 */
export function placeNoun(place: Place, count: number, form: SpeechForm): SpeechPart {
  return say(`noun.place.${place}.${count === 1 ? 'sg' : 'pl'}.${form}`)
}

export function placeCount(place: Place, count: number, form: SpeechForm = 'mid'): SpeechPart {
  return num(count, form, place === 'h' && count === 1 ? 'n' : 'c')
}

export type PlacePart = readonly [place: Place, count: number]

/**
 * "fire tiere og syv enere", "tre hundreder, nul tiere og fire enere": each count with its place
 * noun, "og" before the last, the last noun in `form`. Zeros are said when they are listed.
 */
export function placeWords(parts: readonly PlacePart[], form: SpeechForm = 'end'): SpeechPart[] {
  const out: SpeechPart[] = []
  parts.forEach(([place, count], i) => {
    const last = i === parts.length - 1
    if (last && parts.length > 1) out.push(say('op.og'))
    out.push(placeCount(place, count), placeNoun(place, count, last ? form : 'mid'))
  })
  return out
}

/** The places of a number, hundreds only when there are any: 47 → t 4, o 7 · 304 → h 3, t 0, o 4. */
export function placesOf(n: number): PlacePart[] {
  const parts: PlacePart[] = [['t', tensOf(n)], ['o', onesOf(n)]]
  return n >= 100 ? [['h', hundredsOf(n)], ...parts] : parts
}

/** "Syvogfyrre er fire tiere og syv enere." */
export function isPlaces(n: number, parts: readonly PlacePart[] = placesOf(n)): SpeechPart[] {
  return [num(n, 'mid'), say('hint.place.is'), ...placeWords(parts)]
}

/** The blocks of a number for a 'base' picture. */
export const blocks = (n: number, order: 'hto' | 'oth' = 'hto') =>
  ({ scene: 'base', h: hundredsOf(n), t: tensOf(n), o: onesOf(n), order }) as const

// ─── Instances ──────────────────────────────────────────────────────────────

/** A fresh instance that avoids the given ids when it can (at most 40 draws, then the last one). */
export function drawAvoiding(draw: () => Fact, avoid: ReadonlySet<string>): Fact {
  let f = draw()
  for (let i = 0; i < 40 && avoid.has(f.id); i++) f = draw()
  return f
}

/** Number of canonical facts per family for a procedure skill (SPEC §2.4). */
export const CANON_PER_FAMILY = 20

/**
 * The canonical facts of a family: all of them when the family is small (`all`), else 20 distinct
 * seeded instances — the same every time, from the seed `<skill>/<family>`.
 */
export function canonical(skill: SkillId, family: string, draw: (rng: Rng) => Fact, all?: readonly Fact[]): Fact[] {
  if (all && all.length <= CANON_PER_FAMILY) return [...all]
  const rng = makeRng(hashSeed(`${skill}/${family}`))
  const out = new Map<string, Fact>()
  for (let i = 0; out.size < CANON_PER_FAMILY && i < 2000; i++) {
    const f = draw(rng)
    out.set(f.id, f)
  }
  return [...out.values()]
}

/** A rank per family: new keys are introduced in family order. */
export const familyRank = (families: readonly FamilyDef[], id: string): number => families.find((f) => f.id === id)?.rank ?? 0

/** A seeded rng for choices that belong to one instance (extra cards to sort, a palette). */
export const rngFor = (id: string): Rng => makeRng(hashSeed(id))

/** Keeps values inside [lo, hi] (candidates outside the numbers a task can show are dropped). */
export const within = (lo: number, hi: number) => (v: number): boolean => Number.isInteger(v) && v >= lo && v <= hi
