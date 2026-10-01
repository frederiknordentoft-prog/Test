// Clock clips (SPEC §10.1–10.2): 144 analog phrases `t.end.<m>` (every 5 minutes on the 12-hour
// dial), 24 half-hour forms `t.half.<m>` (:20 and :40), the lead-ins that build a phrase in mid form
// (`t.part.<lead>` + hour) and the times of day (`t.part.morgen` …).
import type { ClipId } from '../../engine/types'
import type { Wave } from '../catalog'
import { CLOCK_LEADS, DAY_PART_WORDS, clockWords } from '../clock'

const table: Record<ClipId, string> = {}
for (let m = 0; m < 720; m += 5) {
  table[`t.end.${m}`] = clockWords(m, 'analog')
  if (m % 60 === 20 || m % 60 === 40) table[`t.half.${m}`] = clockWords(m, 'analogHalfForm')
}
for (const [key, words] of Object.entries(CLOCK_LEADS)) table[`t.part.${key}`] = words
for (const [key, words] of Object.entries(DAY_PART_WORDS)) table[`t.part.${key}`] = words

export const clips = table

/** Hel, halv and kvart come with clockHour/clockHalf/clockQuarter (wave 2); the rest is 3. klasse. */
export function wave(id: ClipId): Wave {
  const end = /^t\.end\.(\d+)$/.exec(id)
  if (end) return Number(end[1]) % 15 === 0 ? 2 : 3
  return /^t\.part\.(kvart_over|halv|kvart_i)$/.test(id) ? 2 : 3
}

export function pack(id: ClipId): string {
  return `clock-${wave(id)}`
}
