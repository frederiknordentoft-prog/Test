// "Vis Pip hvad du kan" (SPEC §8): the placement in the onboarding of a child in 3. klasse, once
// Stjernefjeldet is built. Pip says where the child will start instead of "Alle starter i Engdalen",
// explains that it is not a test, and says the same friendly words after every answer: no praise, no
// stars, never a countdown. The questions are the skills' own sentences. Sentences carry their own
// punctuation; button labels carry none. "Spring over" and "Spil" are the shared UI labels.
import type { ClipId } from '../../../engine/types'

export const clips: Readonly<Record<ClipId, string>> = {
  /** Under the grades, and said after "Tredje klasse", when the ladder is offered. */
  's.place.grade': 'Vis mig gerne, hvad du kan. Så finder vi et godt sted at starte.',
  's.place.intro': 'Nu får du nogle opgaver. Det er ikke en prøve.',
  's.place.intro.stop': 'Du kan stoppe, når du vil.',
  's.place.start': 'Vis Pip, hvad du kan',
  's.place.enough': 'Det er nok',
  // after every answer, right or not (they rotate)
  's.place.next.1': 'Godt, næste!',
  's.place.next.2': 'Tak! Her er den næste.',
  's.place.next.3': 'Fint. Så kommer der en ny.',
  's.place.done': 'Tak, fordi du viste mig det! Nu finder vi dit sted på kortet.',
}

/** Stjernefjeldet (3. klasse) is wave 3. */
export const wave = 3

/** Its own sprite, fetched when the ladder can be offered: never part of the preloaded UI voice. */
export const pack = 'placement-3'

export const NEXT_CLIPS: readonly ClipId[] = Object.keys(clips).filter((id) => id.startsWith('s.place.next.'))
