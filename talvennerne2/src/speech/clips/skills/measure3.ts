// Clips for convertCmM (3. klasse, Markedet): the Kan-bog line, the questions and the strategy hints.
// Lengths are the generated `{ measure }` parts ("to meter", "femogtredive centimeter"; the unit words
// noun.unit.* live in clips/nouns.ts), numbers { num } parts, so no text here has a digit. "minus", "giver",
// "og" and "Det er" are clips/ops.ts'.
//
// All wave 3, in the measure sprite of wave 3 beside unitChoice's weight family.
import type { ClipId } from '../../../engine/types'

const table: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.convertCmM': 'Jeg kan regne om mellem meter og centimeter.',

  // "Hvor mange centimeter er to meter og femogtredive centimeter?" · "Hvor mange hele meter er to hundrede og
  // femogtredive centimeter?" · "Hvor mange centimeter længere er en meter end syvogtredive centimeter?"
  's.convertCmM.howManyCm': 'Hvor mange centimeter er',
  's.convertCmM.howManyM': 'Hvor mange hele meter er',
  's.convertCmM.howMuchLonger': 'Hvor mange centimeter længere er',
  's.convertCmM.than': 'end',

  // "En meter er hundrede centimeter. To meter er to hundrede centimeter. Læg femogtredive centimeter til. Det
  // er to hundrede og femogtredive centimeter." · "To hundrede centimeter er to meter. Der er femogtredive
  // centimeter til overs." · "Et hundrede minus syvogtredive giver treogtres."
  'hint.convertCmM.meter': 'En meter er hundrede centimeter.',
  'hint.convertCmM.is': 'er',
  'hint.convertCmM.add': 'Læg',
  'hint.convertCmM.more': 'til.',
  'hint.convertCmM.left': 'Der er',
  'hint.convertCmM.over': 'til overs.',
  // tensZero (a meter taken as ten centimeter), in place of the first sentence
  'hint.convertCmM.notTen': 'En meter er hundrede centimeter, ikke ti centimeter.',
  // zeroPlaceholder: "to meter og fem centimeter" written 25 or 250
  'hint.convertCmM.noTens': 'Der er ingen tiere, så der står et nul på tiernes plads.',
  // digitComplement10: a hundred minus 37 made up digit by digit (73)
  'hint.convertCmM.notDigits': 'Træk ikke cifrene fra hver for sig. Tæl op til hundrede.',
  // wrongOperation: the lengths added
  'hint.convertCmM.takeAway': 'Når du skal finde ud af, hvor meget længere noget er, skal du trække fra.',
}

export const clips: Readonly<Record<ClipId, string>> = table

/** Stjernefjeldet (3. klasse) is wave 3. */
export const wave = 3

/** The measure sprite of wave 3 (clips/skills/measure2.ts puts unitChoice's weight family there too). */
export const pack = 'measure-3'
