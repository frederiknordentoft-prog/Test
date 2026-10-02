// Clips for the money skills of 1.–2. klasse (coinNames, countCoins, payExact, change): the questions,
// the Kan-bog lines and the strategy hints. Wave 2 (Målebakken and Købmandsgården); what only the
// 3. klasse families use (payExact's fewestCoins and change's from100 strategy) is wave 3. Amounts are
// the generated `{ money }` parts and the coin and note names the catalogue nouns
// (noun.coin.<øre>.<case>.<form>, clips/money.ts); "Betal" and "Du betaler med" are frag.* (clips/ops.ts).
import type { ClipId } from '../../../engine/types'
import type { Wave } from '../../catalog'

const WAVE2: Readonly<Record<ClipId, string>> = {
  // Kan-bogen
  's.cando.coinNames': 'Jeg kender mønterne og sedlerne.',
  's.cando.countCoins': 'Jeg kan tælle, hvor mange penge der er.',
  's.cando.payExact': 'Jeg kan betale præcis det, det koster.',
  's.cando.change': 'Jeg kan regne ud, hvor mange penge jeg får tilbage.',

  // coinNames: "Tryk på femkronen." · "Tryk på alle femkroner."
  's.coinNames.all': 'alle',
  // "Der står fem kroner på femkronen. Den er sølvfarvet med et hul og den største af sølvmønterne."
  'hint.coinNames.itSays': 'Der står',
  'hint.coinNames.on': 'på',
  'hint.coinNames.findAllCoins': 'Find alle de mønter, hvor der står',
  'hint.coinNames.findAllNotes': 'Find alle de sedler, hvor der står',
  'hint.coinNames.look.50': 'Den er lille og kobberfarvet.',
  'hint.coinNames.look.100': 'Den er sølvfarvet med et hul og den mindste af sølvmønterne.',
  'hint.coinNames.look.200': 'Den er sølvfarvet med et hul og større end enkronen.',
  'hint.coinNames.look.500': 'Den er sølvfarvet med et hul og den største af sølvmønterne.',
  'hint.coinNames.look.1000': 'Den er guldfarvet og mindre end tyvekronen.',
  'hint.coinNames.look.2000': 'Den er guldfarvet og den største af guldmønterne.',

  // countCoins: "Hvor mange penge er der?"
  's.countCoins.howMuch': 'Hvor mange penge er der?',
  // "Start med de største mønter. Tyve fyrre femogfyrre syvogfyrre. Det er syvogfyrre kroner."
  // · "Tæl i spring med to. To fire seks otte. Det er otte kroner."
  'hint.countCoins.biggestFirst': 'Start med de største mønter.',
  'hint.countCoins.skipBy': 'Tæl i spring med',
  'hint.countCoins.oneEach': 'Hver mønt er en krone.',
  'hint.countCoins.notTheCoins': 'Tæl ikke, hvor mange mønter der er, men hvad der står på dem.',
  'hint.countCoins.addThemAll': 'Læg alle mønterne sammen.',

  // payExact: "Betal sytten kroner." · "Hvilke penge er præcis sytten kroner?"
  's.payExact.whichMoney': 'Hvilke penge er præcis',
  // "Start med de største penge, der passer. Ti femten sytten. Det er sytten kroner."
  'hint.pay.biggestFirst': 'Start med de største penge, der passer.',
  'hint.pay.countAgain': 'Tæl pengene efter.',

  // change: "Det koster tretten kroner. Du betaler med en tyvekrone. Hvor mange penge får du tilbage?"
  's.money.itCosts': 'Det koster',
  's.change.howMuchBack': 'Hvor mange penge får du tilbage?',
  's.change.layChange': 'Læg byttepengene i bakken.',
  // "Tæl op fra prisen til det, du betaler med. Fra tretten til tyve er syv kroner."
  'hint.change.countUp': 'Tæl op fra prisen til det, du betaler med.',
  'hint.change.from': 'Fra',
  'hint.change.to': 'til',
  'hint.change.is': 'er',
  // wrongOperation: "Du skal have penge tilbage, så du skal trække fra. Tyve minus tretten giver syv."
  'hint.change.takeAway': 'Du skal have penge tilbage, så du skal trække fra.',
}

/** payExact fewestCoins and change from100 belong to Markedet, 3. klasse. */
const WAVE3: Readonly<Record<ClipId, string>> = {
  // "Betal syvogtyve kroner med så få mønter og sedler som muligt."
  's.payExact.asFewAsPossible': 'med så få mønter og sedler som muligt.',
  // "Hvilke penge er præcis syvogtyve kroner med færrest mønter og sedler?"
  's.payExact.withFewest': 'med færrest mønter og sedler?',
  'hint.pay.fewest': 'Brug så store mønter og sedler som muligt.',
  // digitComplement10: "Tæl op til den næste tier først. Fra syvogtredive til fyrre er tre. …"
  'hint.change.nextTenFirst': 'Tæl op til den næste tier først.',
}

export const clips: Readonly<Record<ClipId, string>> = { ...WAVE2, ...WAVE3 }

export function wave(id: ClipId): Wave {
  return id in WAVE3 ? 3 : 2
}
