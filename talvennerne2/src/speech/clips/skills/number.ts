// Clips for the number skills of 0. klasse (count10, count20, hear20, order20): questions, strategy
// hints, the Kan-bog lines and the nouns of the countable things. All wave 1 (Engdalen).
//
// The thing nouns `noun.thing.<id>.sg|pl` follow a number: "Læg syv gulerødder i kurven", "Læg et
// æble i kurven" (the gender decides "en"/"et" for one). Any skill that counts things may use them.
import type { ClipId } from '../../../engine/types'

export interface ThingNoun {
  sg: string
  pl: string
  /** 'c' fælleskøn (en gulerod), 'n' intetkøn (et æble). */
  gender: 'c' | 'n'
}

/** Nouns for the countable things in ids.lock.json `things` (src/art/materials THING_IDS). */
export const THING_NOUNS = {
  carrot: { sg: 'gulerod', pl: 'gulerødder', gender: 'c' },
  apple: { sg: 'æble', pl: 'æbler', gender: 'n' },
  strawberry: { sg: 'jordbær', pl: 'jordbær', gender: 'n' },
  chestnut: { sg: 'kastanje', pl: 'kastanjer', gender: 'c' },
  flower: { sg: 'blomst', pl: 'blomster', gender: 'c' },
  fish: { sg: 'fisk', pl: 'fisk', gender: 'c' },
  mushroom: { sg: 'svamp', pl: 'svampe', gender: 'c' },
  leaf: { sg: 'blad', pl: 'blade', gender: 'n' },
  star: { sg: 'stjerne', pl: 'stjerner', gender: 'c' },
  ball: { sg: 'bold', pl: 'bolde', gender: 'c' },
  cube: { sg: 'klods', pl: 'klodser', gender: 'c' },
  clip: { sg: 'clips', pl: 'clips', gender: 'c' },
} as const satisfies Record<string, ThingNoun>

export type CountThing = keyof typeof THING_NOUNS

/** Things that are counted in a picture and asked about by name ("Hvor mange gulerødder er der?"). */
export const HOW_MANY_THINGS = [
  'carrot', 'apple', 'strawberry', 'chestnut', 'flower', 'fish', 'mushroom', 'leaf', 'star', 'ball',
] as const satisfies readonly CountThing[]

const table: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.count10': 'Jeg kan tælle til ti.',
  's.cando.count20': 'Jeg kan tælle til tyve.',
  's.cando.hear20': 'Jeg kan finde og skrive tallene til tyve.',
  's.cando.order20': 'Jeg kan sætte tallene til tyve i rækkefølge.',

  // count10 / count20: questions
  's.count.howManyDots': 'Hvor mange prikker er der?',
  's.count.flash.dice': 'Hvor mange øjne så du på terningen?',
  's.count.flash.fingers': 'Hvor mange fingre så du?',
  's.count.flash.tenframe': 'Hvor mange prikker så du?',

  // count10 / count20: hints
  'hint.count.pointEach': 'Peg på hver ting, mens du tæller. Tæl hver ting en gang.',
  'hint.count.dice.1': 'Et øje i midten. Det er en.',
  'hint.count.dice.2': 'To øjne på skrå. Det er to.',
  'hint.count.dice.3': 'Tre øjne på en skrå linje. Det er tre.',
  'hint.count.dice.4': 'Et øje i hvert hjørne. Det er fire.',
  'hint.count.dice.5': 'Et øje i hvert hjørne og et i midten. Det er fem.',
  'hint.count.dice.6': 'To rækker med tre øjne. Det er seks.',
  'hint.count.fingersUp': 'Tæl de fingre, der peger op.',
  'hint.count.fullHand': 'En hel hånd er fem.',
  'hint.count.handAndOne': 'En hel hånd og en finger mere er seks.',
  'hint.count.framePoints': 'Tæl prikkerne i ti-rammen.',
  'hint.count.fullRow': 'En fuld række er fem.',
  'hint.count.rowAndOne': 'En fuld række og en prik mere er seks.',
  'hint.count20.fullFrame': 'En fuld ti-ramme er ti.',
  'hint.count20.countOn': 'Tæl videre fra ti.',
  'hint.count20.tenFirst': 'Find ti først, og tæl så videre fra ti.',

  // hear20
  's.hear20.write': 'Skriv tallet',
  'hint.hear20.thisMany': 'Så mange er',
  'hint.hear20.tenAnd': 'er ti og',
  'hint.hear20.oneFirst': 'Vi skriver ettallet først.',
  'hint.hear20.weSay': 'Vi siger',
  'hint.hear20.butOneFirst': 'først, men vi skriver ettallet først.',
  'hint.hear20.zero': 'Nul betyder, at der ingen er.',

  // order20: questions
  's.order20.between': 'Hvilket tal ligger mellem',
  's.order20.biggest': 'Hvilket tal er størst?',
  's.order20.whichBigger': 'Hvilket tal er størst,',
  's.order20.or': 'eller',
  's.order20.countOn': 'Tæl videre fra',
  's.order20.countBack': 'Tæl baglæns fra',
  's.order20.numbersBetween': 'Hvilke tal ligger mellem',
  's.order20.sortBiggestFirst': 'Sæt tallene i rækkefølge. Start med det største.',

  // order20: hints
  'hint.order20.afterMeans': 'Efter betyder en mere.',
  'hint.order20.countForward': 'Tæl fremad, et tal ad gangen.',
  'hint.order20.beforeMeans': 'Før betyder en mindre.',
  'hint.order20.countBackward': 'Tæl baglæns, et tal ad gangen.',
  'hint.order20.betweenCount': 'Tæl fra det første tal til det sidste.',
  'hint.order20.betweenMiddle': 'De tal, du siger undervejs, ligger imellem.',
  'hint.order20.biggerLast': 'Når man tæller, kommer det største tal sidst.',
}

for (const id of HOW_MANY_THINGS) table[`s.count.howMany.${id}`] = `Hvor mange ${THING_NOUNS[id].pl} er der?`
for (const [id, noun] of Object.entries(THING_NOUNS)) {
  table[`noun.thing.${id}.sg`] = noun.sg
  table[`noun.thing.${id}.pl`] = noun.pl
}

export const clips: Readonly<Record<ClipId, string>> = table

/** Engdalen (0. klasse) is wave 1. */
export const wave = 1
