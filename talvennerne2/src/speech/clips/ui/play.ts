// Fixed clips for the start of a round (src/ui/screens/child/PlayScreen.tsx and play/**): the intro
// that shows while the round is fetched, the tap that wakes the sound after a reload, and the rare
// node without tasks yet.
import type { ClipId } from '../../../engine/types'

export const clips: Readonly<Record<ClipId, string>> = {
  's.play.ready': 'Klar? Så går vi i gang.',
  's.play.resume': 'Vi fortsætter, hvor du slap.',
  's.play.tap': 'Tryk for at starte.',
  's.play.empty': 'Her er ingen opgaver endnu. Prøv et andet sted på kortet.',
}
