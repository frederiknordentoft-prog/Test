// The sound check as pure logic (SPEC §8 "Lydtjek"): Pip says "Tryk på katten", two animal cards.
// The cat passes. A wrong tap shuffles the cards (a fresh side from the seed, so a child who cannot
// hear does not find the cat by elimination) and asks again; the second wrong tap ends the check
// with the "Tænd for lyden" card. "Prøv igen" starts over from there.
import { hashSeed, makeRng } from '../../../../engine/rng'
import type { SpeciesId } from '../../../../engine/types'

export const SOUND_CHECK_TARGET: SpeciesId = 'cat'
/** The other card: drawn animals that look nothing like a cat. */
export const SOUND_CHECK_OTHERS: readonly SpeciesId[] = ['rabbit', 'horse']
/** Wrong taps before the check gives up (SPEC §8: two). */
export const SOUND_CHECK_MAX_WRONG = 2

export interface SoundCheckState {
  phase: 'listen' | 'passed' | 'failed'
  /** Wrong taps since the check (re)started. */
  wrong: number
  /** The cards, left to right. */
  cards: readonly [SpeciesId, SpeciesId]
  /** Number of times the cards were dealt (seeds the next deal). */
  deal: number
  seed: number
}

function deal(seed: number, n: number): readonly [SpeciesId, SpeciesId] {
  const rng = makeRng(hashSeed(`sound:${seed}:${n}`))
  const other = rng.pick(SOUND_CHECK_OTHERS)
  return rng.int(2) === 0 ? [SOUND_CHECK_TARGET, other] : [other, SOUND_CHECK_TARGET]
}

export function startSoundCheck(seed: number): SoundCheckState {
  return { phase: 'listen', wrong: 0, cards: deal(seed, 0), deal: 0, seed }
}

/** A tap on one of the cards. Taps after the check has ended change nothing. */
export function tapCard(s: SoundCheckState, species: SpeciesId): SoundCheckState {
  if (s.phase !== 'listen') return s
  if (species === SOUND_CHECK_TARGET) return { ...s, phase: 'passed' }
  const wrong = s.wrong + 1
  if (wrong >= SOUND_CHECK_MAX_WRONG) return { ...s, phase: 'failed', wrong }
  return { ...s, wrong, deal: s.deal + 1, cards: deal(s.seed, s.deal + 1) }
}

/** "Prøv igen" on the "Tænd for lyden" card: a new deal and a clean count. */
export function retrySoundCheck(s: SoundCheckState): SoundCheckState {
  return { ...s, phase: 'listen', wrong: 0, deal: s.deal + 1, cards: deal(s.seed, s.deal + 1) }
}

/** What the check means for the device (`device.audioVerified`), or null while it is running. */
export function verdict(s: SoundCheckState): boolean | null {
  return s.phase === 'passed' ? true : s.phase === 'failed' ? false : null
}
