// Independent oracles for the fraction skills of 3. klasse (fractionOfSet, fractionCompare), ORK3b. Written
// by another agent than the generators (SPEC A5, §15.1): the right answers are worked out here from what
// the child hears and sees — the fraction and the heap in the spoken question, the plates of the share
// view, the fraction cards — and checked against the fact ids read by the module headers' documented
// formats, never from the generator code. Fractions are compared as numbers (k/d against k'/d' by cross
// multiplication). The wrong answers are pædagogik §3.2's: denominatorAsAnswer ("¼ af 12 → 4: svar =
// nævner") and biggerDenominator ("1/8 > 1/4: brøken med størst nævner"). The registry skips *.oracle.ts.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FractionBars } from '../../../art/materials'
import type { AnswerValue, ErrorTag, Task } from '../../types'
import { THING_WORDS } from '../number/number.oracle'
import { numbersIn } from '../number/number2.oracle'
import { PLAIN } from '../shapes/shapes3.oracle'

// ─── Fractions as the child hears them (SPEC §10.1) ─────────────────────────

const DEN_WORDS: readonly (readonly [number, string, string])[] = [
  [2, 'halv', 'halve'], [3, 'tredjedel', 'tredjedele'], [4, 'fjerdedel', 'fjerdedele'],
  [5, 'femtedel', 'femtedele'], [6, 'sjettedel', 'sjettedele'], [8, 'ottendedel', 'ottendedele'],
]

/** "en fjerdedel" → 1/4, "tre fjerdedele" → 3/4, "en halv" and "halvdelen" → 1/2; null for anything else. */
export function heardFraction(words: string): { n: number; d: number } | null {
  const w = words.trim().toLowerCase()
  if (w === 'halvdelen') return { n: 1, d: 2 }
  const m = /^([a-zæøå]+) ([a-zæøå]+)$/.exec(w)
  if (!m) return null
  for (const [d, sg, pl] of DEN_WORDS) {
    if (m[1] === 'en' && m[2] === sg) return { n: 1, d }
    const n = numbersIn(m[1])
    if (m[2] === pl && n.length === 1 && n[0] >= 2) return { n: n[0], d }
  }
  return null
}

/** The thing a plural noun names ("jordbær", "æbler", "gulerødder"), from the oracle's own table. */
export function thingOfPlural(word: string): string | null {
  return Object.entries(THING_WORDS).find(([, w]) => w.pl === word)?.[0] ?? null
}

// ═══ fractionOfSet ════════════════════════════════════════════════════════════

export type SetFamily = 'halfOf' | 'quarterOf' | 'thirdOf' | 'threeQuartersOf'
const SET_FAMILY: Readonly<Record<string, SetFamily>> = { '1/2': 'halfOf', '1/4': 'quarterOf', '1/3': 'thirdOf', '3/4': 'threeQuartersOf' }

export interface SetQ {
  family: SetFamily
  n: number
  d: number
  total: number
  thing: string
  /** n/d of the heap. */
  answer: number
  /** One of the d equal heaps. */
  unit: number
  /** What is left of the heap: the other plate's share for three quarters. */
  rest: number
}

/** fos:<n>/<d>:<total>:<thing> (module header), the family named by its fraction (pædagogik §1.3). */
export function setIdOf(id: string): SetQ | null {
  const m = /^fos:(\d)\/(\d):(\d+):([a-z]+)$/.exec(id)
  if (!m) return null
  const [n, d, total] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const family = SET_FAMILY[`${n}/${d}`]
  if (!family || total % d !== 0) return null
  const unit = total / d
  return { family, n, d, total, thing: m[4], answer: unit * n, unit, rest: total - unit * n }
}

/** What the voice asks on a fractionOfSet task. */
export interface SetAsk {
  how: 'of' | 'deal' | 'twoPlates'
  n: number
  d: number
  total: number
  thing: string | null
}

/**
 * "Hvor mange er en fjerdedel af tolv jordbær?", "Hvad er halvdelen af tolv jordbær?" (of); "Del tolv
 * jordbær i fire lige store dele. Hvor mange er en fjerdedel?" / "… Hvor mange er halvdelen?" (deal);
 * "Del tolv jordbær på de to tallerkener. Den ene skal have tre fjerdedele og den anden resten." (twoPlates).
 */
export function setAsk(text: string): SetAsk | null {
  let m = /^Hvor mange er (.+) af ([a-zæøå]+) ([a-zæøå]+)\?$/.exec(text) ?? /^Hvad er (halvdelen) af ([a-zæøå]+) ([a-zæøå]+)\?$/.exec(text)
  if (m) {
    const f = heardFraction(m[1])
    const total = numbersIn(m[2])
    return f && total.length === 1 ? { how: 'of', ...f, total: total[0], thing: thingOfPlural(m[3]) } : null
  }
  m = /^Del ([a-zæøå]+) ([a-zæøå]+) i ([a-zæøå]+) lige store dele\. Hvor mange er (.+)\?$/.exec(text)
  if (m) {
    const f = heardFraction(m[4])
    const total = numbersIn(m[1])
    const parts = numbersIn(m[3])
    if (!f || total.length !== 1 || parts.length !== 1 || f.n !== 1 || f.d !== parts[0]) return null
    return { how: 'deal', ...f, total: total[0], thing: thingOfPlural(m[2]) }
  }
  m = /^Del ([a-zæøå]+) ([a-zæøå]+) på de to tallerkener\. Den ene skal have (.+) og den anden resten\.$/.exec(text)
  if (m) {
    const f = heardFraction(m[3])
    const total = numbersIn(m[1])
    return f && total.length === 1 ? { how: 'twoPlates', ...f, total: total[0], thing: thingOfPlural(m[2]) } : null
  }
  return null
}

/**
 * SPEC §4.1 with A9 and A11 for a number given for "n/d of the heap": the denominator is
 * denominatorAsAnswer — 'ambiguous' when it is also the heap (A9: the heap is said) or the typed answer's
 * swapped digits (A11); with a plain slip on the same value (the rest, one heap, one more or less) SPEC
 * §4.1's letter keeps the misconception and the conservative reading makes it 'ambiguous': either is
 * allowed. The heap alone is 'operand'; anything else plain.
 */
export function setTags(q: SetQ, v: number, swap: number | null): readonly ErrorTag[] {
  if (v === q.d && v !== q.answer) {
    if (v === q.total || v === swap) return ['ambiguous']
    if ([q.rest, q.unit, q.answer + 1, q.answer - 1].includes(v)) return ['denominatorAsAnswer', 'ambiguous']
    return ['denominatorAsAnswer']
  }
  if (v === q.total) return ['operand']
  return PLAIN
}

// ═══ fractionCompare ══════════════════════════════════════════════════════════

export type CmpFamily = 'pairBigger' | 'pairSmaller' | 'order4'
export const DENOMINATORS = [2, 3, 4, 5, 6, 8]

export interface CmpQ {
  family: CmpFamily
  k: number
  /** pairBigger and pairSmaller: the pair a < b. */
  pair?: [number, number]
  /** order4: the four denominators. */
  four?: number[]
}

/** fcm:b:<a>,<b> · fcm:s:<a>,<b> (unit fractions, a < b) · fcm:o:<k>:<d1>,<d2>,<d3>,<d4> (same numerator, k < d). */
export function cmpIdOf(id: string): CmpQ | null {
  let m = /^fcm:([bs]):(\d),(\d)$/.exec(id)
  if (m) {
    const [a, b] = [Number(m[2]), Number(m[3])]
    if (a >= b || !DENOMINATORS.includes(a) || !DENOMINATORS.includes(b)) return null
    return { family: m[1] === 'b' ? 'pairBigger' : 'pairSmaller', k: 1, pair: [a, b] }
  }
  m = /^fcm:o:(\d):(\d),(\d),(\d),(\d)$/.exec(id)
  if (m) {
    const k = Number(m[1])
    const four = [m[2], m[3], m[4], m[5]].map(Number)
    if (new Set(four).size !== 4 || four.some((d) => !DENOMINATORS.includes(d) || d <= k)) return null
    return { family: 'order4', k, four }
  }
  return null
}

export interface Frac {
  n: number
  d: number
}

/** A fraction card 'frac:k/d'. */
export function cardFrac(v: AnswerValue): Frac | null {
  const m = typeof v === 'string' ? /^frac:(\d+)\/(\d+)$/.exec(v) : null
  return m ? { n: Number(m[1]), d: Number(m[2]) } : null
}

/** a − b in sign: the bigger fraction by cross multiplication. */
export const compareFrac = (a: Frac, b: Frac): number => a.n * b.d - b.n * a.d

/** What the voice asks: the biggest or smallest card, or the cards in order from the biggest or the smallest. */
export function cmpAsk(text: string): { sort: boolean; biggest: boolean } | null {
  switch (text) {
    case 'Hvilken brøk er størst?': return { sort: false, biggest: true }
    case 'Hvilken brøk er mindst?': return { sort: false, biggest: false }
    case 'Sæt brøkerne i rækkefølge. Start med den største.': return { sort: true, biggest: true }
    case 'Sæt brøkerne i rækkefølge. Start med den mindste.': return { sort: true, biggest: false }
    default: return null
  }
}

/** The cards by value, from the asked end. */
export function byValue(cards: readonly AnswerValue[], biggest: boolean): string[] {
  const fr = cards.map((c) => ({ c: String(c), f: cardFrac(c)! }))
  return fr.sort((x, y) => (biggest ? -1 : 1) * compareFrac(x.f, y.f)).map((x) => x.c)
}

/**
 * biggerDenominator (pædagogik §3.2: "1/8 > 1/4"): the child takes the bigger denominator for the bigger
 * fraction — the cards ordered by denominator from the asked end, or the one card at that end.
 */
export function byDenominator(cards: readonly AnswerValue[], biggest: boolean): string[] {
  const fr = cards.map((c) => ({ c: String(c), f: cardFrac(c)! }))
  return fr.sort((x, y) => (biggest ? -1 : 1) * (x.f.d - y.f.d)).map((x) => x.c)
}

// ─── The fraction bars of a hint, as drawn ─────────────────────────────────

/**
 * FractionBars (src/art/materials/Fractions.tsx) read like a child reads them: per bar, how many equal
 * parts the whole is cut into (the dividing lines, evenly spaced across the bar) and how many of them are
 * coloured from the left. Returns one { n, d } per bar, or a problem.
 */
export function readBars(fracs: readonly string[]): ({ n: number; d: number } | string)[] {
  const svg = renderToStaticMarkup(createElement(FractionBars, { fracs: [...fracs] }))
  const bars = [...svg.matchAll(/<g>(.*?)<\/g>/g)].map((m) => m[1])
  return bars.map((g) => {
    const paths = [...g.matchAll(/<path d="([^"]*)"([^>]*)>/g)].map((m) => ({ d: m[1], attrs: m[2] }))
    if (paths.length < 2) return 'no bar'
    const outline = paths[paths.length - 1]
    const box = /^M([\d.]+) ([\d.]+)h([\d.]+)a/.exec(paths[0].d)
    if (!box || !/fill="none"/.test(outline.attrs)) return 'no outline'
    const r = 10
    const left = Number(box[1]) - r
    const width = Number(box[3]) + 2 * r
    const lines = paths.find((p) => /stroke-width="2.4"/.test(p.attrs))
    const xs = lines ? [...lines.d.matchAll(/M([\d.]+) /g)].map((m) => Number(m[1])) : []
    const d = xs.length + 1
    const even = xs.every((x, i) => Math.abs(x - (left + ((i + 1) * width) / d)) < 0.02)
    if (!even) return `parts not equal: lines at ${xs.join(', ')} on ${left}–${left + width}`
    const coloured = paths.slice(1, paths.length - 1).filter((p) => p !== lines && !/fill="none"/.test(p.attrs))
    // each coloured part starts on a line (the first at the rounded left end)
    const starts = coloured.map((p) => Number(/^M([\d.]+)/.exec(p.d)?.[1]))
    const want = coloured.map((_, i) => (i === 0 ? left + r : left + (i * width) / d))
    if (starts.some((s, i) => Math.abs(s - want[i]) > 0.02)) return `coloured parts at ${starts.join(', ')}, from the left would be ${want.join(', ')}`
    return { n: coloured.length, d }
  })
}

/** The tag set a 'share' hand-in gets: −1 is shareUnequal (SPEC §3.2), every other wrong deal plain. */
export const shareTags = (t: Task, v: AnswerValue): readonly ErrorTag[] => (t.kind === 'share' && v === -1 ? ['shareUnequal'] : ['other'])
