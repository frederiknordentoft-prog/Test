// Fixed clips for the start of a round (src/ui/screens/child/PlayScreen.tsx and play/**): the intro
// that shows while the round is fetched, the tap that wakes the sound after a reload, the rare node
// without tasks yet, and Pip's line at a stone that has nothing new today (QA2 P2-1: never a
// countdown, never "come back in …").
import type { ClipId } from '../../../engine/types'

export const clips: Readonly<Record<ClipId, string>> = {
  's.play.ready': 'Klar? Så går vi i gang.',
  's.play.resume': 'Vi fortsætter, hvor du slap.',
  's.play.tap': 'Tryk for at starte.',
  's.play.empty': 'Her er ingen opgaver endnu. Prøv et andet sted på kortet.',
  's.play.tomorrow': 'Her er der nyt i morgen. Nu kan du øve det, du har lært.',
}
