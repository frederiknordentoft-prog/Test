// Spoken measurements (SPEC §10.1): centimeter, meter, gram, kilogram. The unit words are the same
// in singular and plural; the gender decides the 1: "en meter", "et gram", "et hundrede og et gram".
import type { ClipId, SpeechForm } from '../engine/types'
import { numberClips, numberWords, type Gender } from './numberWords'

export type MeasureUnit = 'cm' | 'm' | 'g' | 'kg'

export const UNIT_WORDS: Readonly<Record<MeasureUnit, string>> = {
  cm: 'centimeter',
  m: 'meter',
  g: 'gram',
  kg: 'kilogram',
}

export const UNIT_GENDER: Readonly<Record<MeasureUnit, Gender>> = { cm: 'c', m: 'c', g: 'n', kg: 'n' }

export function measureWords(value: number, unit: MeasureUnit): string {
  return `${numberWords(value, UNIT_GENDER[unit])} ${UNIT_WORDS[unit]}`
}

/** The number in mid form followed by `noun.unit.<unit>.<form>`. */
export function measureClips(value: number, unit: MeasureUnit, form: SpeechForm): ClipId[] {
  return [...numberClips(value, 'mid', UNIT_GENDER[unit]), `noun.unit.${unit}.${form}`]
}
