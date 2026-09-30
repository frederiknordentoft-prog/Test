// Spoken fractions (SPEC §10.1): en halv, en tredjedel, en fjerdedel, to tredjedele, tre fjerdedele,
// en femtedel, en sjettedel, en ottendedel. These eight are whole clips (`noun.frac.<n>_<d>.<form>`);
// any other n/d is the number in mid form plus the plural denominator (`noun.frac.d<d>.pl.<form>`).
import type { ClipId, SpeechForm } from '../engine/types'
import { numberClips, numberWords } from './numberWords'

export type Denominator = 2 | 3 | 4 | 5 | 6 | 8
export const DENOMINATORS: readonly Denominator[] = [2, 3, 4, 5, 6, 8]

const SINGULAR: Readonly<Record<Denominator, string>> = {
  2: 'halv', 3: 'tredjedel', 4: 'fjerdedel', 5: 'femtedel', 6: 'sjettedel', 8: 'ottendedel',
}
const PLURAL: Readonly<Record<Denominator, string>> = {
  2: 'halve', 3: 'tredjedele', 4: 'fjerdedele', 5: 'femtedele', 6: 'sjettedele', 8: 'ottendedele',
}

/** The fractions recorded as whole phrases, as `n_d`. */
export const NAMED_FRACTIONS = ['1_2', '1_3', '1_4', '2_3', '3_4', '1_5', '1_6', '1_8'] as const

export function fractionWords(n: number, d: Denominator): string {
  return n === 1 ? `en ${SINGULAR[d]}` : `${numberWords(n)} ${PLURAL[d]}`
}

/** Plural denominator word ("fjerdedele"), used by the catalogue. */
export function denominatorPlural(d: Denominator): string {
  return PLURAL[d]
}

export function fractionClips(n: number, d: Denominator, form: SpeechForm): ClipId[] {
  const key = `${n}_${d}`
  if ((NAMED_FRACTIONS as readonly string[]).includes(key)) return [`noun.frac.${key}.${form}`]
  return [...numberClips(n, 'mid', 'c'), `noun.frac.d${d}.pl.${form}`]
}
