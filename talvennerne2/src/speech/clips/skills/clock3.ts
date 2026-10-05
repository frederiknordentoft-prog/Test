// Clips for the clock skills of 3. klasse (clockFive, clockDigital, clockElapsed in Minuttårnet): the Kan-bog
// lines, the questions and the strategy hints. The times themselves are the generated `{ clock }` parts
// (t.end.<m>, t.half.<m>, t.part.<lead> + hour, the digital "fjorten femogfyrre" from the number clips, and
// the times of day "om eftermiddagen", clips/time.ts); "Stil uret, så klokken er", "Klokken er" (clips/ops.ts),
// "Find uret, der viser klokken", "Se godt på den lille viser." and "er en halv time før" are 2. klasse's
// (clips/skills/clock.ts). Sentences carry their own punctuation; the fragments that stand before a time or
// a number carry none.
//
// All wave 3, in the clock sprite of wave 3 beside the five-minute times.
import type { ClipId } from '../../../engine/types'

const table: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.clockFive': 'Jeg kan se, når klokken er fem minutter over og fem minutter i.',
  's.cando.clockDigital': 'Jeg kan læse et digitalt ur, også om eftermiddagen og om aftenen.',
  's.cando.clockElapsed': 'Jeg kan regne ud, hvad klokken bliver om lidt, og hvad den var for lidt siden.',

  // clockFive: "Fem minutter over tre er fem minutter efter tre. Den lange viser peger på et." · "Fem minutter i
  // halv tre er fem minutter før halv tre. Den lange viser peger på fem."
  'hint.clock5.is': 'er',
  'hint.clock5.minAfter': 'minutter efter',
  'hint.clock5.minBefore': 'minutter før',
  'hint.clock5.longAt': 'Den lange viser peger på',
  // quarterDirection, said before the strategy
  'hint.clock5.overAndTo': 'Over betyder efter, og i betyder før.',
  // hourHandMisread: "Se godt på den lille viser. Ved ti minutter i tre er den endnu ikke nået til tre."
  'hint.clock5.notYet': 'er den endnu ikke nået til',

  // clockDigital: "Find det digitale ur, der viser det samme." (an analog clock, or "Klokken er halv tre om
  // eftermiddagen.") · "Det digitale ur viser fjorten tredive. Stil uret, så det viser det samme."
  's.clockDigital.findDigital': 'Find det digitale ur, der viser det samme.',
  's.clockDigital.shows': 'Det digitale ur viser',
  's.clockDigital.setSame': 'Stil uret, så det viser det samme.',
  // "Den lille viser er gået forbi to. Den lange viser peger på ni, og det er femogfyrre minutter. Det digitale
  // ur viser to femogfyrre." · "Fjorten minus tolv giver to. Så er klokken halv tre om eftermiddagen."
  'hint.clockDigital.smallPast': 'Den lille viser er gået forbi',
  'hint.clockDigital.thatIs': 'og det er',
  'hint.clockDigital.minutes': 'minutter.',
  'hint.clockDigital.soItIs': 'Så er klokken',

  // clockElapsed: "Klokken er kvart over tre. Hvad er klokken om en halv time?"
  's.clockElapsed.ask.plusHour': 'Hvad er klokken om en time?',
  's.clockElapsed.ask.plusHalf': 'Hvad er klokken om en halv time?',
  's.clockElapsed.ask.plusQuarter': 'Hvad er klokken om et kvarter?',
  's.clockElapsed.ask.minusHalf': 'Hvad var klokken for en halv time siden?',
  // the dial starts somewhere else, so the instruction names the time, never "a half hour on"
  's.clockElapsed.set.plusHour': 'Stil uret, så det viser, hvad klokken er om en time.',
  's.clockElapsed.set.plusHalf': 'Stil uret, så det viser, hvad klokken er om en halv time.',
  's.clockElapsed.set.plusQuarter': 'Stil uret, så det viser, hvad klokken er om et kvarter.',
  's.clockElapsed.set.minusHalf': 'Stil uret, så det viser, hvad klokken var for en halv time siden.',
  // "En halv time efter kvart over tre er klokken kvart i fire. Den lange viser går en halv gang rundt."
  'hint.clockElapsed.d.plusHour': 'En time efter',
  'hint.clockElapsed.d.plusHalf': 'En halv time efter',
  'hint.clockElapsed.d.plusQuarter': 'Et kvarter efter',
  'hint.clockElapsed.d.minusHalf': 'En halv time før',
  'hint.clockElapsed.is': 'er klokken',
  'hint.clockElapsed.was': 'var klokken',
  'hint.clockElapsed.hand.plusHour': 'Den lange viser går en hel gang rundt.',
  'hint.clockElapsed.hand.plusHalf': 'Den lange viser går en halv gang rundt.',
  'hint.clockElapsed.hand.plusQuarter': 'Den lange viser går en kvart gang rundt.',
  'hint.clockElapsed.hand.minusHalf': 'Den lange viser går en halv gang tilbage.',
  // wrongOperation: the hands turned the wrong way
  'hint.clockElapsed.later': 'Om lidt er senere, så viserne går frem.',
  'hint.clockElapsed.earlier': 'For lidt siden er tidligere, så viserne går tilbage.',
}

export const clips: Readonly<Record<ClipId, string>> = table

/** Stjernefjeldet (3. klasse) is wave 3. */
export const wave = 3

/** The clock sprite of wave 3, beside the five-minute times (clips/time.ts). */
export const pack = 'clock-3'
