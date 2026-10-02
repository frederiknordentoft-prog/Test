// Clips for the clock skills of 1.–2. klasse (clockHour, clockHalf, clockQuarter): the card question,
// the Kan-bog lines and the strategy hints. Wave 2 (Urtårnet and Urtårnets top). The times themselves
// are the generated `{ clock }` parts (t.end.<m>, t.part.<lead> + hour, clips/time.ts); "Stil uret, så
// klokken er" is frag.stil_uret_saa_klokken_er (clips/ops.ts). Sentences carry their own punctuation;
// the fragments that stand before a time or an hour number carry none.
import type { ClipId } from '../../../engine/types'

export const clips: Readonly<Record<ClipId, string>> = {
  // Kan-bogen
  's.cando.clockHour': 'Jeg kan se, hvad klokken er ved hele timer.',
  's.cando.clockHalf': 'Jeg kan se, hvad klokken er ved halve timer.',
  's.cando.clockQuarter': 'Jeg kan se, når klokken er kvart over og kvart i.',

  // choice: "Find uret, der viser klokken halv tre."
  's.clock.findClock': 'Find uret, der viser klokken',

  // clockHour: "Ved hele timer peger den lange viser på tolv. Den lille viser peger på tre."
  'hint.clock.wholeHour': 'Ved hele timer peger den lange viser på tolv.',
  'hint.clock.smallPointsAt': 'Den lille viser peger på',
  // handsSwapped
  'hint.clock.handsRoles': 'Den lille viser er timeviseren, og den lange viser er minutviseren.',

  // clockHalf: "Halv tre betyder halvvejs hen mod tre. Den lange viser peger på seks, og den lille viser
  // står midt mellem to og tre."
  'hint.clock.halfMeans': 'betyder halvvejs hen mod',
  'hint.clock.longAtSixSmallBetween': 'Den lange viser peger på seks, og den lille viser står midt mellem',
  // halfPastNext: "Halv tre er en halv time før tre. Den lille viser står midt mellem to og tre."
  'hint.clock.halfBefore': 'er en halv time før',
  'hint.clock.smallBetween': 'Den lille viser står midt mellem',
  // hourHandMisread: "Se godt på den lille viser. Ved halv tre står den midt mellem to og tre."
  // · "Ved kvart i tre er den næsten ved tre."
  'hint.clock.lookSmall': 'Se godt på den lille viser.',
  'hint.clock.at': 'Ved',
  'hint.clock.itStandsBetween': 'står den midt mellem',
  'hint.clock.itIsAlmostAt': 'er den næsten ved',

  // clockQuarter: "Kvart over tre er et kvarter efter tre. Den lange viser peger på tre, og den lille
  // viser er lige gået forbi tre." · "Kvart i tre er et kvarter før tre. Den lange viser peger på ni,
  // og den lille viser er næsten ved tre."
  'hint.clock.quarterAfter': 'er et kvarter efter',
  'hint.clock.quarterBefore': 'er et kvarter før',
  'hint.clock.longAtThreeSmallPast': 'Den lange viser peger på tre, og den lille viser er lige gået forbi',
  'hint.clock.longAtNineSmallAlmost': 'Den lange viser peger på ni, og den lille viser er næsten ved',
  // quarterDirection
  'hint.clock.overAndTo': 'Kvart over er et kvarter efter den hele time. Kvart i er et kvarter før.',
}

/** Hestebakkerne and Regnbueskoven (1.–2. klasse) are wave 2. */
export const wave = 2
