// Clips for kronerOre (3. klasse, Markedet): the Kan-bog line, the questions and the strategy hints.
// Amounts are the generated `{ money }` parts ("tolv kroner og halvtreds øre"), the coin names the
// catalogue nouns (noun.coin.50.pl.mid "halvtredsører", clips/money.ts); "Betal", "Det koster", "Hvilke
// penge er præcis", "Hvor mange penge er der?", "Tæl pengene efter." and the money "er" are 2. klasse's
// (clips/ops.ts, clips/skills/money.ts). Every number is a { num } or { money } part (SPEC §10.1).
//
// All wave 3, in the money sprite of wave 3 beside payExact's fewestCoins and change's from100.
import type { ClipId } from '../../../engine/types'

const table: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.kronerOre': 'Jeg kan betale med kroner og øre.',

  // fiftiesInKroner: "Hvor mange penge er der? Betal det samme med kroner." (the 50-øre coins lie on the table)
  's.kronerOre.payInKroner': 'Betal det samme med kroner.',
  // addHalves: "Det koster to kroner og halvtreds øre. Hvad koster to af dem?" · "… Betal for to af dem."
  's.kronerOre.askTwo': 'Hvad koster to af dem?',
  's.kronerOre.payTwo': 'Betal for to af dem.',

  // readAmount: "Kommaet skiller kronerne fra ørerne. Betal først tolv kroner, og læg så en halvtredsøre."
  'hint.kronerOre.comma': 'Kommaet skiller kronerne fra ørerne.',
  'hint.kronerOre.first': 'Betal først',
  'hint.kronerOre.thenFifty': 'og læg så en halvtredsøre.',
  // fiftiesInKroner: "To halvtredsører er en krone. Seks halvtredsører er tre kroner." · addHalves: "To
  // halvtredsører er en krone. To kroner plus to kroner giver fire kroner. De to halvtredsører giver en krone
  // mere. Det er fem kroner."
  'hint.kronerOre.twoFifties': 'To halvtredsører er en krone.',
  'hint.kronerOre.oneMore': 'De to halvtredsører giver en krone mere.',
}

export const clips: Readonly<Record<ClipId, string>> = table

/** Stjernefjeldet (3. klasse) is wave 3. */
export const wave = 3

/** The money sprite of wave 3 (clips/skills/money.ts puts its 3. klasse clips there too). */
export const pack = 'money-3'
