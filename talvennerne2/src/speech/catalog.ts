// The clip catalogue: every fixed spoken sentence has a clip id and its Danish text (SPEC §10.2).
// It doubles as the string table for the child's screens — SpokenText shows clipText(id) and
// speaks the clip. Signatures frozen by the integrator; W3 (speech) implements the catalogue by
// collecting src/speech/clips/**/*.ts.
import type { ClipId } from '../engine/types'

/** Danish text of a clip (the id itself when unknown, so a missing clip is visible in review). */
export function clipText(id: ClipId): string {
  return id
}

/** True when the clip id is defined in a catalogue file. */
export function hasClip(id: ClipId): boolean {
  void id
  return false
}
