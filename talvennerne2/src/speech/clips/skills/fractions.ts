// Clips for the fraction skills of 1.–2. klasse (SK2-GEO: halfShape, fractionShape): the Kan-bog lines,
// the questions and the strategy hints. The fractions themselves are `{ frac }` parts (clips/fractions.ts:
// "en fjerdedel", "to fjerdedele"); every number is a { num } part (SPEC §10.1). Wave 2, in the
// fractions sprite of wave 2.
import type { ClipId } from '../../../engine/types'

const table: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.halfShape': 'Jeg kan se, om en figur er delt i to halve.',
  's.cando.fractionShape': 'Jeg kan se halve, tredjedele og fjerdedele af en figur.',

  // halfShape
  's.halfShape.isHalves': 'Er figuren delt i to halve?',
  's.halfShape.all': 'alle figurer, der er delt i to halve.',
  'hint.halfShape.fold': 'Forestil dig, at du folder figuren langs stregen.',
  'hint.halfShape.same': 'De to dele passer oven på hinanden, så det er to halve.',
  'hint.halfShape.notSame': 'Den ene del er større end den anden, så det er ikke to halve.',
  'hint.halfShape.twoPartsNotHalves': 'To dele er ikke altid to halve.',
  'hint.halfShape.halvesSame': 'Halve er to lige store dele.',
  'hint.halfShape.lookEach': 'Se på hver figur. Er de to dele lige store?',

  // fractionShape
  's.fractionShape.howBig': 'Hvor stor en del af figuren er farvet?',
  's.fractionShape.write': 'Skriv brøken for den farvede del.',
  's.fractionShape.colour': 'Farv',
  'hint.fractionShape.cutInto': 'Figuren er delt i',
  'hint.fractionShape.equalParts': 'lige store dele.',
  'hint.fractionShape.coloured': 'af dem er farvet.',
  'hint.fractionShape.ofThem': 'af dem.',
  'hint.fractionShape.thatIs': 'Det er',
}

export const clips: Readonly<Record<ClipId, string>> = table

/** Hestebakkerne and Regnbueskoven (1.–2. klasse) are wave 2. */
export const wave = 2

export const pack = 'fractions-2'
