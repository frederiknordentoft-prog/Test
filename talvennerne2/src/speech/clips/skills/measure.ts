// Clips for compareLength (0. klasse, wave 1): the questions, the Kan-bog line and the hints. The
// things are pictures on the cards and are never named, so one question fits every set of things.
import type { ClipId } from '../../../engine/types'

export const clips: Readonly<Record<ClipId, string>> = {
  's.cando.compareLength': 'Jeg kan se, hvad der er længst og kortest.',
  's.compareLength.longest': 'Hvilken ting er længst?',
  's.compareLength.shortest': 'Hvilken ting er kortest?',
  's.compareLength.sortLong': 'Sæt tingene i rækkefølge. Start med den længste.',
  's.compareLength.sortShort': 'Sæt tingene i rækkefølge. Start med den korteste.',
  'hint.compareLength.alignLong': 'Når tingene starter samme sted, kan du se, hvilken der er længst.',
  'hint.compareLength.alignShort': 'Når tingene starter samme sted, kan du se, hvilken der er kortest.',
  'hint.compareLength.bothEnds': 'Se på begge ender, ikke kun den ene.',
}

/** Engdalen (0. klasse) is wave 1. */
export const wave = 1
