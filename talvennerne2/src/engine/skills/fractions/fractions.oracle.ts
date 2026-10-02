// Independent oracles for the fraction skills of 1.–2. klasse (halfShape, fractionShape), ORK2c. Written
// by another agent than the generators (SPEC A5, §15.1). "Delt i to halve" is measured on the drawing:
// the dashed line Shape2D draws cuts the figure, and the two parts' areas are compared
// (shapes2.oracle.ts). A fraction is a ratio, so equal fractions are one value (2/4 is a half); the
// fraction a figure shows is its coloured parts over its parts, and a spoken fraction ("tre fjerdedele")
// is read back to n/d. The registry skips *.oracle.ts files.
import type { ShapeId } from '../../types'
import { cutX, figure, halvedAt } from '../shapes/shapes2.oracle'

// ─── halfShape ──────────────────────────────────────────────────────────────

/** Is a figure, drawn with this cut, divided into two halves? Uncut figures are not. */
export function cutIntoHalves(shape: ShapeId, variant: number, cut: 'equal' | 'unequal' | undefined): boolean {
  if (!cut) return false
  const x = cutX(shape, variant, cut)
  return x !== null && halvedAt(figure(shape, variant), x)
}

/** hlv:<shape>:<e|u> → the figure and the cut the id names. */
export function halfShapeId(id: string): { shape: ShapeId; equal: boolean } | null {
  const m = /^hlv:([a-z]+):([eu])$/.exec(id)
  return m ? { shape: m[1] as ShapeId, equal: m[2] === 'e' } : null
}

// ─── Fractions as values ───────────────────────────────────────────────────

export interface Frac {
  n: number
  d: number
}

/** 'frac:3/4' → 3/4 (any whole numbers, d ≥ 1); null for anything else. */
export function fracToken(v: unknown): Frac | null {
  if (typeof v !== 'string') return null
  const m = /^frac:(\d+)\/(\d+)$/.exec(v)
  return m && Number(m[2]) >= 1 ? { n: Number(m[1]), d: Number(m[2]) } : null
}

/** 'a|b' (numerator slot, denominator slot) → a/b. */
export function fracSlots(v: unknown): Frac | null {
  if (typeof v !== 'string') return null
  const m = /^(\d+)\|(\d+)$/.exec(v)
  return m && Number(m[2]) >= 1 ? { n: Number(m[1]), d: Number(m[2]) } : null
}

/** Equal as numbers: a/b = c/d. */
export const sameValue = (x: Frac, y: Frac): boolean => x.n * y.d === y.n * x.d

/** frs:<n>/<d>:<shape> → the fraction and the figure. */
export function fractionShapeId(id: string): { frac: Frac; shape: string } | null {
  const m = /^frs:(\d+)\/(\d+):([a-z]+)$/.exec(id)
  return m ? { frac: { n: Number(m[1]), d: Number(m[2]) }, shape: m[3] } : null
}

const COUNT: Readonly<Record<string, number>> = { en: 1, et: 1, to: 2, tre: 3, fire: 4, fem: 5, seks: 6, syv: 7 }
const PART: Readonly<Record<string, number>> = {
  halv: 2, halve: 2, tredjedel: 3, tredjedele: 3, fjerdedel: 4, fjerdedele: 4, femtedel: 5, femtedele: 5,
  sjettedel: 6, sjettedele: 6, ottendedel: 8, ottendedele: 8,
}

/** A spoken fraction (SPEC §10.1: "en halv", "to tredjedele", "tre fjerdedele") → n/d; null otherwise. */
export function spokenFraction(words: string): Frac | null {
  const m = /^([a-zæøå]+) ([a-zæøå]+)$/.exec(words.trim())
  if (!m || !(m[1] in COUNT) || !(m[2] in PART)) return null
  const n = COUNT[m[1]]
  // the singular goes with one, the plural with more ("en halv", "en fjerdedel", "to fjerdedele")
  const singular = !m[2].endsWith('e')
  return (n === 1) === singular ? { n, d: PART[m[2]] } : null
}
