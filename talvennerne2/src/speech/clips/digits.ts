// Digit names (SPEC §10.1 "Cifferord"): nullet, ettallet … nitallet, used by place-value hints
// ("Se på tretallet."). `noun.digit.<0-9>.<form>`.
import type { ClipId } from '../../engine/types'

export const DIGIT_WORDS = [
  'nullet', 'ettallet', 'totallet', 'tretallet', 'firetallet',
  'femtallet', 'sekstallet', 'syvtallet', 'ottetallet', 'nitallet',
] as const

const table: Record<ClipId, string> = {}
for (const form of ['mid', 'end'] as const) {
  DIGIT_WORDS.forEach((word, d) => {
    table[`noun.digit.${d}.${form}`] = word
  })
}

export const clips = table

/** tensOnes is 1. klasse. */
export const wave = 2
export const pack = 'place-2'
