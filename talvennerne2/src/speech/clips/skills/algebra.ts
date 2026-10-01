// Clips for patterns (0. klasse, wave 1): the two questions, the Kan-bog line and one hint per
// kind of pattern. The beads themselves are never named; the child sees and continues them.
import type { ClipId } from '../../../engine/types'

export const clips: Readonly<Record<ClipId, string>> = {
  's.cando.patterns': 'Jeg kan fortsætte et mønster.',
  's.patterns.whatNext': 'Hvad kommer så?',
  's.patterns.continue': 'Fortsæt mønstret.',
  'hint.patterns.AB': 'To ting skiftes: den ene, den anden, igen og igen.',
  'hint.patterns.AAB': 'To ens, og så en anden. Det gentager sig.',
  'hint.patterns.ABB': 'En, og så to ens. Det gentager sig.',
  'hint.patterns.ABC': 'Tre forskellige i samme rækkefølge, igen og igen.',
  'hint.patterns.growing': 'Se, der kommer en mere hver gang.',
  'hint.patterns.sayIt': 'Sig mønstret højt, og hør, hvad der kommer igen.',
}

/** Engdalen (0. klasse) is wave 1. */
export const wave = 1
