// Independent oracles for patterns (0. klasse). A pattern task is solved twice, without the
// generator: blind — from the beads on the row alone, as the child sees them — and from the instance
// id (family, beads, how many are shown) with each family's rule built here. Both must give the
// task's answer. The registry skips *.oracle.ts files, so none of this reaches the app.
import type { ShapeId } from '../../types'
import { THING_IDS } from '../../../art/materials/Things'
import type { Explanation } from '../number/number.oracle'

export const PATTERN_FAMILIES = ['AB', 'AAB', 'ABB', 'ABC', 'growing'] as const
export type PatternFamily = (typeof PATTERN_FAMILIES)[number]

export interface PatternId {
  family: PatternFamily
  /** The beads by name: A, B (and C). */
  units: string[]
  /** How many beads are shown before the gap. */
  shown: number
}

/** ptn:<family>:<A>.<B>[.<C>]:<shown> */
export function parsePatternId(id: string): PatternId {
  const m = /^ptn:([A-Za-z]+):([a-z]+(?:\.[a-z]+)+):(\d+)$/.exec(id)
  if (!m || !(PATTERN_FAMILIES as readonly string[]).includes(m[1])) throw new Error(`not a pattern id: ${id}`)
  return { family: m[1] as PatternFamily, units: m[2].split('.'), shown: Number(m[3]) }
}

/** The repeating unit of each repeating family, as indices into the beads. */
const UNIT: Readonly<Record<Exclude<PatternFamily, 'growing'>, readonly number[]>> = {
  AB: [0, 1], AAB: [0, 0, 1], ABB: [0, 1, 1], ABC: [0, 1, 2],
}

/** Beads per family: two different, or three for ABC. */
export const beadsOf = (family: PatternFamily): number => (family === 'ABC' ? 3 : 2)

/** The first `length` beads of a family's endless row. growing: A B, A B B, A B B B … */
export function patternRow(family: PatternFamily, units: readonly string[], length: number): string[] {
  if (family === 'growing') {
    const out: string[] = []
    for (let g = 1; out.length < length; g++) out.push(units[0], ...Array<string>(g).fill(units[1]))
    return out.slice(0, length)
  }
  const unit = UNIT[family]
  return Array.from({ length }, (_, i) => units[unit[i % unit.length]])
}

export interface Solved {
  /** 'repeat:<period>' or 'growing'. */
  rule: string
  next: string[]
}

/**
 * What comes next, read off the shown beads alone. A repeating pattern is the shortest unit of at
 * least two different beads that is shown in full at least twice and explains every bead; failing
 * that, a growing pattern (one A, then one more B in each group) with two whole groups shown.
 */
export function continueRow(shown: readonly string[], k: number): Solved | null {
  for (let p = 2; 2 * p <= shown.length; p++) {
    if (new Set(shown.slice(0, p)).size >= 2 && shown.every((b, i) => b === shown[i % p])) {
      return { rule: `repeat:${p}`, next: Array.from({ length: k }, (_, j) => shown[(shown.length + j) % p]) }
    }
  }
  const [a, b] = shown
  if (shown.length >= 5 && a !== b) {
    const row = patternRow('growing', [a, b], shown.length + k)
    if (row.slice(0, shown.length).every((x, i) => x === shown[i])) return { rule: 'growing', next: row.slice(shown.length) }
  }
  return null
}

/** The length of a repeating family's unit (0 for growing, which does not repeat). */
export const periodOf = (family: PatternFamily): number => (family === 'growing' ? 0 : UNIT[family].length)

/** The rule a family's row should be read as. */
export const ruleOf = (family: PatternFamily): string => (family === 'growing' ? 'growing' : `repeat:${periodOf(family)}`)

// ─── Beads ──────────────────────────────────────────────────────────────────

const COLOURS = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'pink', 'white', 'brown']
const SHAPES: readonly ShapeId[] = [
  'circle', 'triangle', 'quadrilateral', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon', 'semicircle', 'rhombus', 'trapezoid',
]

/** What a bead is: a coloured bead, a figure or a countable thing (all drawable); null when unknown. */
export function beadKind(name: string): 'colour' | 'shape' | 'thing' | null {
  if (COLOURS.includes(name)) return 'colour'
  if ((SHAPES as readonly string[]).includes(name)) return 'shape'
  if ((THING_IDS as readonly string[]).includes(name)) return 'thing'
  return null
}

export const bead = (name: string): string => `pat:${name}`
export const beadName = (token: string): string => {
  if (!token.startsWith('pat:')) throw new Error(`not a bead: ${token}`)
  return token.slice(4)
}

/**
 * Wrong answers have no misconception in the catalogue: on the cards another bead of the pattern is a
 * near miss and a bead from outside is plainly wrong; in the slots the continuation one place too
 * late is a near miss, any other filling plainly wrong.
 */
export function explainBeads(id: string, given: string, slots: number): Explanation {
  const { family, units, shown } = parsePatternId(id)
  if (slots === 1) return { mis: [], near: units.map(bead).includes(given) }
  const shifted = patternRow(family, units, shown + slots + 1).slice(shown + 1).map(bead).join('|')
  return { mis: [], near: given === shifted }
}
