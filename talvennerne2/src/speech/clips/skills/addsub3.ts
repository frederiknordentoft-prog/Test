// Clips for the plus and minus skills of 3. klasse (add1000, sub1000 in Trecifret bro): the Kan-bog lines
// and what is new about three digits in the column strategy — the hundreds column, the ten or hundred
// that goes over, and exchanging a hundred (also across a zero). The questions are composed ("Hvad er"
// 247 "plus" 6, speech/equation.ts), and the column words of 2. klasse are said as they are recorded
// ("Regn enerne først.", "Regn så tierne.", "Svaret er" …, clips/skills/addsub2.ts).
//
// Every number is a { num } part (SPEC §10.1). All wave 3, in the plus-and-minus sprite of wave 3.
import type { ClipId } from '../../../engine/types'

const table: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.add1000': 'Jeg kan lægge trecifrede tal sammen.',
  's.cando.sub1000': 'Jeg kan trække trecifrede tal fra hinanden.',

  // The hundreds column, plus and minus ("Regn enerne først." and "Regn så tierne." are 2. klasse's)
  'hint.addsub3.hundredsThen': 'Regn så hundrederne.',

  // add1000: what goes over to the next column
  'hint.add1000.tenOver': 'En tier går med over til tierne.',
  'hint.add1000.hundredOver': 'Et hundrede går med over til hundrederne.',
  // forgotCarry where the tens make ten or more (the ones have 2. klasse's hint.addsub2.carryTen)
  'hint.add1000.carryHundred': 'Når tierne giver ti eller mere, skal hundredet med over til hundrederne.',

  // sub1000: exchanging (the ones have 2. klasse's hint.addsub2.borrowTen)
  'hint.sub1000.borrowHundred': 'Der er ikke tiere nok. Veksl et hundrede til ti tiere.',
  'hint.sub1000.acrossZero': 'Der er ikke enere nok, og der er ingen tiere. Veksl først et hundrede til ti tiere, og så en tier til ti enere.',
  // smallerFromLarger and borrowNoDecrement, said before the columns
  'hint.sub1000.topMinusBottom': 'Vi trækker altid det nederste tal fra det øverste. Er det øverste for lille, veksler vi.',
  'hint.sub1000.oneHundredLess': 'Når du veksler et hundrede, er der et hundrede mindre tilbage.',
}

export const clips: Readonly<Record<ClipId, string>> = table

/** Stjernefjeldet (3. klasse) is wave 3. */
export const wave = 3

/** The plus-and-minus sprite of wave 3. */
export const pack = 'addsub-3'
