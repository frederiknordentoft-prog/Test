// Clips for the place-value skills (tensOnes, placeValue1000) and the place words the number skills
// of 1.–2. klasse share with them: questions, strategy hints, the Kan-bog lines and the nouns after a
// count — "fire tiere og syv enere", "et hundrede". Wave 2; regrouping (placeValue1000/regroup) is
// 3. klasse (wave 3). The digit names ("syvtallet") are in clips/digits.ts.
import type { ClipId } from '../../../engine/types'
import type { Wave } from '../../catalog'

/** The noun after a count, singular and plural: one hundred is "et hundrede" (neuter). */
export const PLACE_NOUNS = {
  h: { sg: 'hundrede', pl: 'hundreder' },
  t: { sg: 'tier', pl: 'tiere' },
  o: { sg: 'ener', pl: 'enere' },
} as const

const WAVE2: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.tensOnes': 'Jeg kender tiere og enere.',
  's.cando.placeValue1000': 'Jeg kender hundreder, tiere og enere.',

  // Questions
  's.place.build': 'Byg tallet',
  's.place.buildMissing': 'Byg det, der mangler.',
  's.place.buildOnlyTens': 'Byg kun tierne i',
  's.place.buildOnlyOnes': 'Byg kun enerne i',
  's.place.buildOnlyHundreds': 'Byg kun hundrederne i',
  's.place.howManyTens': 'Hvor mange tiere er der i',
  's.place.howManyOnes': 'Hvor mange enere er der i',
  's.place.howManyTensOnes': 'Hvor mange tiere og enere er der i',
  's.place.lay': 'Læg',
  's.place.whichNumber': 'Hvilket tal er det?',
  's.place.whichNumberBlocks': 'Hvilket tal viser klodserne?',
  's.place.writeWithTokens': 'Skriv det med brikkerne.',
  's.place.writeNumberWithTokens': 'Skriv tallet med brikkerne.',
  's.pv.worthHundreds': 'Hvad er hundrederne værd i',
  's.pv.worthTens': 'Hvad er tierne værd i',

  // Hint pieces between numbers ("Syvogfyrre er fire tiere og syv enere.")
  'hint.place.is': 'er',
  'hint.place.has': 'har',
  'hint.place.rodsAre': 'stænger er',
  'hint.place.rodIs': 'stang er',
  'hint.place.worthEnd': 'værd.',
  'hint.place.butThereAre': 'Men der er',
  'hint.place.onTensPlace': 'står på tiernes plads.',
  'hint.place.onHundredsPlace': 'står på hundredernes plads.',
  'hint.place.soItIs': 'Så er det',
  'hint.place.missingIs': 'Det, der mangler, er',

  // Hint sentences
  'hint.place.zeroOnesLast': 'Der er ingen enere, så vi skriver et nul til sidst.',
  'hint.place.zeroHoldsTens': 'Nullet holder tiernes plads.',
  'hint.place.zeroHoldsOnes': 'Nullet holder enernes plads.',
  'hint.place.zeroBoth': 'Nullerne holder tiernes og enernes plads.',
  'hint.place.countRodsFirst': 'Hver stang er en tier. Tæl stængerne først.',
  'hint.place.tensFirstAlways': 'Vi skriver tierne først, også når enerne bliver sagt først.',
  'hint.place.rodIsTen': 'En stang er ti, ikke en.',
  'hint.place.buildRods': 'Byg en stang for hver tier.',
  'hint.place.buildCubes': 'Byg en terning for hver ener.',
  'hint.place.tensDigitFirst': 'Tiernes ciffer står først.',
  'hint.pv.plateRodCube': 'En plade er hundrede, en stang er ti, og en terning er en.',
  'hint.pv.tensBeforeOnes': 'Vi skriver tierne før enerne, selv om vi siger enerne først.',
}

for (const form of ['mid', 'end'] as const) {
  for (const [place, words] of Object.entries(PLACE_NOUNS)) {
    WAVE2[`noun.place.${place}.sg.${form}`] = words.sg
    WAVE2[`noun.place.${place}.pl.${form}`] = words.pl
  }
}

/** Regrouping (placeValue1000/regroup) is Trecifret bro, 3. klasse. */
const WAVE3: Readonly<Record<ClipId, string>> = {
  'hint.pv.tenTensHundred': 'Ti tiere er et hundrede.',
  'hint.pv.tenOnesTen': 'Ti enere er en tier.',
}

export const clips: Readonly<Record<ClipId, string>> = { ...WAVE2, ...WAVE3 }

export function wave(id: ClipId): Wave {
  return id in WAVE3 ? 3 : 2
}
