// Clips for the plus and minus skills of 0. klasse (addTo10, subTo10, tenFriends): the Kan-bog lines
// and the strategy hints. The questions themselves are the recorded `q.<factId>` sentences
// (clips/questions.ts). All wave 1 (Engdalen).
//
// The hop hints walk the number line: "Start på fem. Hop tre gange frem." One whole sentence per
// number of hops keeps the voice natural (no comma between "tre" and "gange"). Minus close to the
// whole counts up instead: "Start på otte. Hop op til ti og tæl hoppene." (two hops, not eight).
import type { ClipId } from '../../../engine/types'
import { numberWords } from '../../numberWords'

const table: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.addTo10': 'Jeg kan lægge sammen til ti.',
  's.cando.subTo10': 'Jeg kan trække fra inden for ti.',
  's.cando.tenFriends': 'Jeg kan alle tiervennerne.',

  // Hops on the number line
  'hint.addsub.startOn': 'Start på',
  'hint.addsub.firstHop': 'Det første hop lander på',
  'hint.addsub.hopUpTo': 'Hop op til',
  'hint.addsub.countHops': 'og tæl hoppene.',
  'hint.addsub.allGone': 'Når man tager det hele væk, er der nul tilbage.',
  'hint.addsub.plusMeansMore': 'Plus betyder, at der kommer flere til.',
  'hint.addsub.minusMeansLess': 'Minus betyder, at nogle bliver taget væk.',
  'hint.addsub.plusZero': 'Plus nul giver det samme tal.',
  'hint.addsub.minusZero': 'Minus nul giver det samme tal.',

  // Ten friends
  'hint.tenFriends.countEmpty': 'Tæl de tomme felter i ti-rammen.',
  'hint.tenFriends.full': 'Ti-rammen er allerede fuld.',
  'hint.tenFriends.empty': 'Ti-rammen er tom, så alle ti felter mangler.',
}

/** "Hop en gang frem." … "Hop fem gange frem." (plus to 10 never hops more than five). */
for (let n = 1; n <= 5; n++) table[`hint.addsub.hopForward.${n}`] = `Hop ${numberWords(n)} ${n === 1 ? 'gang' : 'gange'} frem.`
/** "Hop en gang tilbage." … "Hop ti gange tilbage." */
for (let n = 1; n <= 10; n++) table[`hint.addsub.hopBack.${n}`] = `Hop ${numberWords(n)} ${n === 1 ? 'gang' : 'gange'} tilbage.`

export const clips: Readonly<Record<ClipId, string>> = table

/** Engdalen (0. klasse) is wave 1. */
export const wave = 1
