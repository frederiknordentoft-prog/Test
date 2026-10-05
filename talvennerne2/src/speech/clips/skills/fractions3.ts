// Clips for the fraction skills of 3. klasse (SK3-GEO: fractionOfSet, fractionCompare): the Kan-bog
// lines, the questions and the strategy hints. The fractions themselves are `{ frac }` parts
// (clips/fractions.ts: "en fjerdedel", "tre fjerdedele"), the things the shared `noun.thing.<id>.pl`
// (clips/skills/number.ts), every number a { num } part (SPEC §10.1). Wave 3, in the fractions sprite
// of wave 3 (Brøkbageriet).
import type { ClipId } from '../../../engine/types'

const table: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.fractionOfSet': 'Jeg kan finde halvdelen, en tredjedel og en fjerdedel af en mængde.',
  's.cando.fractionCompare': 'Jeg kan se, hvilken brøk der er størst.',

  // fractionOfSet: questions ("Hvor mange er en fjerdedel af tolv jordbær?", "Del tolv jordbær i fire
  // lige store dele. Hvor mange er en fjerdedel?", "Del tolv jordbær på de to tallerkener. Den ene skal
  // have tre fjerdedele og den anden resten.")
  's.fractionOfSet.howMany': 'Hvor mange er',
  's.fractionOfSet.of': 'af',
  's.fractionOfSet.deal': 'Del',
  's.fractionOfSet.into': 'i',
  's.fractionOfSet.equalParts': 'lige store dele.',
  's.fractionOfSet.howManyHalf': 'Hvor mange er halvdelen?',
  's.fractionOfSet.onTwo': 'på de to tallerkener.',
  's.fractionOfSet.oneGets': 'Den ene skal have',
  's.fractionOfSet.otherRest': 'og den anden resten.',

  // fractionOfSet: hints ("Del de tolv i fire lige store bunker. Der er tre i hver bunke. En fjerdedel
  // af tolv er tre.")
  'hint.fractionOfSet.dealThe': 'Del de',
  'hint.fractionOfSet.piles': 'lige store bunker.',
  'hint.fractionOfSet.thereAre': 'Der er',
  'hint.fractionOfSet.inEach': 'i hver bunke.',
  'hint.fractionOfSet.is': 'er',
  'hint.fractionOfSet.halfOf': 'Halvdelen af',
  'hint.fractionOfSet.threePiles': 'er tre af bunkerne.',
  'hint.fractionOfSet.notAnswer': 'Brøken fortæller, hvor mange lige store bunker du skal dele i. Den fortæller ikke svaret.',
  'hint.fractionOfSet.sameEach': 'Alle bunker skal have lige mange.',
  'hint.fractionOfSet.put': 'Læg',
  'hint.fractionOfSet.onOne': 'på den ene tallerken og',
  'hint.fractionOfSet.onOther': 'på den anden.',

  // fractionCompare: questions
  's.fractionCompare.biggest': 'Hvilken brøk er størst?',
  's.fractionCompare.smallest': 'Hvilken brøk er mindst?',
  's.fractionCompare.sortBiggest': 'Sæt brøkerne i rækkefølge. Start med den største.',
  's.fractionCompare.sortSmallest': 'Sæt brøkerne i rækkefølge. Start med den mindste.',

  // fractionCompare: hints ("Jo flere lige store dele en hel er delt i, jo mindre bliver hver del. En
  // halv er størst.")
  'hint.fractionCompare.moreParts': 'Jo flere lige store dele en hel er delt i, jo mindre bliver hver del.',
  'hint.fractionCompare.sameCount': 'Brøkerne har lige mange dele, men delene er ikke lige store.',
  'hint.fractionCompare.notBigNumber': 'Et stort tal under brøkstregen betyder små dele. Det er ikke en stor brøk.',
  'hint.fractionCompare.isBiggest': 'er størst.',
  'hint.fractionCompare.isSmallest': 'er mindst.',
  'hint.fractionCompare.fromBiggest': 'Fra den største er de',
  'hint.fractionCompare.fromSmallest': 'Fra den mindste er de',
}

export const clips: Readonly<Record<ClipId, string>> = table

/** Stjernefjeldet (3. klasse) is wave 3. */
export const wave = 3

export const pack = 'fractions-3'
