// Clips for the multiplication and division skills of 2. klasse (groupsOf, mul2510, shareEqually):
// the Kan-bog lines, the questions about groups and sharing, and the strategy hints. The equations
// "Hvad er tre gange fem?" are composed (speech/equation.ts, op.gange). Division is read "delt med"
// (frag.muldiv.delt_med); the thing nouns are the shared `noun.thing.<id>.pl` (clips/skills/number.ts).
//
// Every number is a { num } part (SPEC §10.1). All wave 2, in the muldiv sprite of wave 2.
import type { ClipId } from '../../../engine/types'

const table: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.groupsOf': 'Jeg kan tælle grupper med lige mange i hver.',
  's.cando.mul2510': 'Jeg kan to-, fem- og titabellen.',
  's.cando.shareEqually': 'Jeg kan dele ligeligt.',

  // Shared
  'frag.muldiv.delt_med': 'delt med',
  'noun.muldiv.dyr': 'dyr',
  'hint.muldiv.notPlus': 'Vi skal ikke lægge de to tal sammen. Gange er grupper med lige mange i hver.',

  // groupsOf
  's.groupsOf.thereAre': 'Der er',
  's.groupsOf.groupsWith': 'grupper med',
  's.groupsOf.inEach': 'i hver.',
  's.groupsOf.howMany': 'Hvor mange er der i alt?',
  'hint.groupsOf.countGroups': 'Tæl gruppe for gruppe.',
  'hint.groupsOf.is': 'er',
  'hint.groupsOf.countAll': 'Vi skal ikke lægge de to tal sammen. Tæl alle i alle grupperne.',

  // mul2510
  'hint.mul2510.skipBy': 'Tæl i spring med',
  'hint.mul2510.countHops': 'Tæl springene, så du ved, hvornår du skal stoppe.',

  // shareEqually
  's.shareEqually.share': 'Del',
  's.shareEqually.between': 'ligeligt mellem',
  's.shareEqually.howMany': 'Hvor mange får hvert dyr?',
  'hint.shareEqually.oneEach': 'Giv en til hvert dyr ad gangen, rundt og rundt, til der ikke er flere.',
  'hint.shareEqually.eachGets': 'Så får hvert dyr',
  'hint.shareEqually.sameForAll': 'Alle dyr skal have lige mange.',
  'hint.shareEqually.giveAll': 'Når vi deler, skal alle tingene gives ud, og alle får lige mange.',
}

export const clips: Readonly<Record<ClipId, string>> = table

/** Regnbueskoven (2. klasse) is wave 2. */
export const wave = 2
