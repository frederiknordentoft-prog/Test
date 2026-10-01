// Fraction clips (SPEC §10.1): the eight named fractions as whole phrases and the plural
// denominators that follow a number ("fem ottendedele").
import type { ClipId } from '../../engine/types'
import type { Wave } from '../catalog'
import { DENOMINATORS, NAMED_FRACTIONS, denominatorPlural, fractionWords, type Denominator } from '../fractions'

const table: Record<ClipId, string> = {}
for (const form of ['mid', 'end'] as const) {
  for (const key of NAMED_FRACTIONS) {
    const [n, d] = key.split('_').map(Number)
    table[`noun.frac.${key}.${form}`] = fractionWords(n, d as Denominator)
  }
  for (const d of DENOMINATORS) table[`noun.frac.d${d}.pl.${form}`] = denominatorPlural(d)
}

export const clips = table

/** Halves, thirds and quarters are 1.–2. klasse (wave 2); fifths, sixths, eighths and plurals wave 3. */
export function wave(id: ClipId): Wave {
  return /^noun\.frac\.(1_2|1_3|1_4|2_3|3_4)\./.test(id) ? 2 : 3
}

export function pack(id: ClipId): string {
  return `fractions-${wave(id)}`
}
