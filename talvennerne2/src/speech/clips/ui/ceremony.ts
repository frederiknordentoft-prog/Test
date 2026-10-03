// Fixed clips for the end of a round (src/ui/screens/child/CeremonyScreen.tsx and ceremony/**) that
// the reward texts in clips/ui/rewards.ts do not already say: the count-up labels, "Prøv den på",
// naming an animal and the egg, and the words "Det lærte du" needs to say a fact whole ("Halvdelen af
// otte er fire"). Never "only N more", never a countdown.
import type { ClipId } from '../../../engine/types'

export const clips: Readonly<Record<ClipId, string>> = {
  's.ceremony.perler': 'perler',
  's.ceremony.xp': 'point',
  's.ceremony.tryOn': 'Prøv den på',
  's.ceremony.name.own': 'Skriv selv',
  's.ceremony.name.hint': 'Skriv et navn',
  's.ceremony.name.is': 'Din ven hedder',
  's.ceremony.egg.later': 'Gem ægget til senere',
  's.ceremony.choose': 'Tryk på den, du vil have.',
  's.ceremony.medal.for': 'Medaljen er for:',
  's.ceremony.trial.score': 'planker lagt',
  // "Det lærte du": a fact said whole (QA2 P1-1)
  's.ceremony.learned.halfOf': 'Halvdelen af',
}
