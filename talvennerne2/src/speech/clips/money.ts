// Money clips (SPEC §10.1): the units after an amount and the coin and note names in indefinite
// (with article), definite and plural form, each in mid and end form.
import type { ClipId } from '../../engine/types'
import type { Wave } from '../catalog'
import { DENOMINATIONS, coinClip, coinWords } from '../money'

const table: Record<ClipId, string> = {}
for (const form of ['mid', 'end'] as const) {
  table[`noun.unit.krone.${form}`] = 'krone'
  table[`noun.unit.kroner.${form}`] = 'kroner'
  table[`noun.unit.ore.${form}`] = 'øre'
  for (const ore of DENOMINATIONS) {
    for (const kind of ['indef', 'def', 'pl'] as const) table[coinClip(ore, kind, form)] = coinWords(ore, kind)
  }
}
table['noun.unit.krone_og'] = 'krone og'
table['noun.unit.kroner_og'] = 'kroner og'

export const clips = table

/** coinNames and countCoins are 1. klasse (wave 2); the notes above 100 kr come with change (wave 3). */
export function wave(id: ClipId): Wave {
  return /^noun\.coin\.(20000|50000)\./.test(id) ? 3 : 2
}

export function pack(id: ClipId): string {
  return `money-${wave(id)}`
}
