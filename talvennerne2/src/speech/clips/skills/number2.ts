// Clips for the number skills of 1.–2. klasse (hear100, order100, numberLine100, hear1000, order1000,
// numberLine1000): questions, strategy hints and the Kan-bog lines. Wave 2 (Hestebakkerne and
// Regnbueskoven); the rounding families of numberLine1000 are 3. klasse (wave 3). Sentences carry
// their own punctuation; fragments that stand between numbers carry none.
//
// Shared with order20 and hear20 (clips/skills/number.ts): "Find tallet", "Skriv tallet", "Hvilket
// tal kommer efter/før", "Hvilket tal er størst", "Tæl videre/baglæns fra" and their hints.
import type { ClipId } from '../../../engine/types'
import type { Wave } from '../../catalog'

const WAVE2: Readonly<Record<ClipId, string>> = {
  // Kan-bogen
  's.cando.hear100': 'Jeg kan finde og skrive tallene til hundrede.',
  's.cando.order100': 'Jeg kan sætte tallene til hundrede i rækkefølge.',
  's.cando.numberLine100': 'Jeg kan finde tallene til hundrede på tallinjen.',
  's.cando.hear1000': 'Jeg kan finde og skrive tallene til tusind.',
  's.cando.order1000': 'Jeg kan sætte tallene til tusind i rækkefølge.',
  's.cando.numberLine1000': 'Jeg kan finde tallene til tusind på tallinjen.',

  // hear100 / hear1000: hints ("Vi siger syv først, men vi skriver tierne først.")
  'hint.hear.tensFirst': 'Vi skriver tierne først.',
  'hint.hear.butTensFirst': 'først, men vi skriver tierne først.',
  'hint.hear1000.hundredsFirst': 'Vi skriver hundrederne først, så tierne og så enerne.',
  'hint.hear1000.threeDigits': 'Det skriver vi med tre cifre.',

  // order100 / order1000: questions
  's.order.tenMore': 'Hvilket tal er ti mere end',
  's.order.tenLess': 'Hvilket tal er ti mindre end',
  's.order.hundredMore': 'Hvilket tal er hundrede mere end',
  's.order.hundredLess': 'Hvilket tal er hundrede mindre end',
  's.order.countOnTens': 'Tæl videre i tiere fra',
  's.order.countBackTens': 'Tæl baglæns i tiere fra',
  's.order.countOnHundreds': 'Tæl videre i hundreder fra',
  's.order.countBackHundreds': 'Tæl baglæns i hundreder fra',
  's.order1000.whichSign': 'Hvilket tegn skal stå mellem',

  // order100 / order1000: hints
  'hint.order.after': 'Efter',
  'hint.order.before': 'Før',
  'hint.order.comes': 'kommer',
  'hint.order.tenOnesTen': 'Ti enere bliver til en tier.',
  'hint.order.tenTensHundred': 'Ti tiere bliver til et hundrede.',
  'hint.order.hundredTenTens': 'Et hundrede bliver til ti tiere.',
  'hint.order.tenMoreThan': 'Ti mere end',
  'hint.order.tenLessThan': 'Ti mindre end',
  'hint.order100.boardRight': 'På hundredetavlen står det lige til højre.',
  'hint.order100.boardLeft': 'På hundredetavlen står det lige til venstre.',
  'hint.order100.tenMoreMeans': 'Ti mere er en tier mere.',
  'hint.order100.tenLessMeans': 'Ti mindre er en tier mindre.',
  'hint.order100.boardBelow': 'På hundredetavlen står det lige nedenunder.',
  'hint.order100.boardAbove': 'På hundredetavlen står det lige ovenover.',
  'hint.order100.mostTens': 'Se på tierne. Tallet med flest tiere er størst.',
  'hint.order100.boardLower': 'På hundredetavlen står det største tal længst nede.',
  'hint.order100.lookTens': 'Se på tierne først.',
  'hint.order1000.tenMore': 'Ti mere betyder, at tierne bliver en mere.',
  'hint.order1000.tenLess': 'Ti mindre betyder, at tierne bliver en mindre.',
  'hint.order1000.hundredMore': 'Hundrede mere betyder, at hundrederne bliver en mere.',
  'hint.order1000.hundredLess': 'Hundrede mindre betyder, at hundrederne bliver en mindre.',
  'hint.order1000.hundredsThenTens': 'Se på hundrederne først. Er de ens, så se på tierne.',
  'hint.order1000.threeDigitsBigger': 'Et tal med tre cifre er større end et tal med to cifre.',
  'hint.order1000.notFirstDigit': 'Det første ciffer siger ikke det hele.',

  // numberLine100 / numberLine1000: questions
  's.nl.place': 'Sæt nålen ved',
  's.nl.whichArrow': 'Hvilket tal peger pilen på?',
  's.nl.hopFrom': 'Hoppet starter ved',
  's.nl.whereLand': 'Hvor lander det?',
  's.nl.midway': 'Hvilket tal ligger midt mellem',

  // numberLine100 / numberLine1000: hints
  'hint.nl.hopTens': 'Hop ti ad gangen fra nul.',
  'hint.nl.liesBetween': 'ligger mellem',
  'hint.nl.liesMidway': 'ligger midt mellem',
  'hint.nl.startAt': 'Start ved',
  'hint.nl.andGo': 'og gå',
  'hint.nl.forward': 'frem.',
  'hint.nl1000.hopHundreds': 'Hop hundrede ad gangen fra nul.',
}

/** numberLine1000's rounding families (round10, round100) belong to Trecifret bro, 3. klasse. */
const WAVE3: Readonly<Record<ClipId, string>> = {
  's.nl1000.placeNearestTen': 'Sæt nålen ved den tier, der ligger tættest på',
  's.nl1000.placeNearestHundred': 'Sæt nålen ved det hundrede, der ligger tættest på',
  's.nl1000.whichTen': 'Hvilken tier ligger',
  's.nl1000.whichHundred': 'Hvilket hundrede ligger',
  's.nl1000.closest': 'tættest på?',
  'hint.nl1000.closestIs': 'Det ligger tættest på',
  'hint.nl1000.middleRoundsUp': 'Ligger tallet lige i midten, runder vi op.',
}

export const clips: Readonly<Record<ClipId, string>> = { ...WAVE2, ...WAVE3 }

export function wave(id: ClipId): Wave {
  return id in WAVE3 ? 3 : 2
}

/** One sprite per wave with the 0. klasse number clips' name: number-2, number-3. */
export function pack(id: ClipId): string {
  return `number-${wave(id)}`
}
