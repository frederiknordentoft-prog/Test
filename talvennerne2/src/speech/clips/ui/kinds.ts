// Instructions per task kind (SPEC §3.4): the long form is read the first three times a profile
// meets a kind, the short form after that. All fifteen kinds are here, so wave 2 and 3 only add
// their views (wave 2's words match its views: both clock hands, coins that hop, plates). Plus the
// names of the buildBase blocks (read when their buttons are explored) and of the grid's controls.
import type { TaskKind } from '../../../engine/types'
import type { Wave } from '../../catalog'

export const KIND_INSTRUCTIONS: Record<TaskKind, { long: string; short: string }> = {
  choice: { long: 'Tryk på det kort, der passer.', short: 'Tryk på svaret.' },
  keypad: { long: 'Skriv svaret med tallene. Tryk på fluebenet, når du er færdig.', short: 'Skriv svaret.' },
  countTap: { long: 'Tryk på tingene, så hopper de i kurven. Tryk på kurven for at tage en op igen.', short: 'Læg det rigtige antal i kurven.' },
  pair: { long: 'Træk den boble, der passer, over i den tomme boble.', short: 'Træk boblen på plads.' },
  numberline: { long: 'Tryk på tallinjen, der hvor tallet hører til. Du kan flytte nålen. Tryk så på fluebenet.', short: 'Sæt nålen på tallinjen.' },
  trueFalse: { long: 'Passer det? Tryk på det grønne flueben for ja eller på det røde kryds for nej.', short: 'Ja eller nej?' },
  sortOrder: { long: 'Tryk på kortene i den rigtige rækkefølge. Tryk på et kort igen for at sende det tilbage.', short: 'Sæt dem i rækkefølge.' },
  multiSelect: { long: 'Tryk på alle dem, der passer. Tryk på fluebenet, når du har fundet dem alle.', short: 'Find dem alle.' },
  fillSlots: { long: 'Tryk på brikkerne nedenfor for at fylde de tomme pladser. Tryk på en plads for at tømme den.', short: 'Fyld de tomme pladser.' },
  buildBase: { long: 'Byg tallet med plader, stænger og terninger. Tryk på en bunke for at tage en klods væk.', short: 'Byg tallet.' },
  clockSet: { long: 'Træk i viserne for at stille uret. Når du drejer den lange viser, følger den lille med. Tryk så på fluebenet.', short: 'Stil uret.' },
  pay: { long: 'Tryk på en mønt, så hopper den ned i bakken. Tryk på mønterne i bakken for at lægge dem tilbage. Tryk så på fluebenet.', short: 'Betal det, det koster.' },
  share: { long: 'Tryk på en tallerken for at give den en ting fra bunken. Bliv ved, til bunken er tom. Træk en ting tilbage, hvis du fortryder.', short: 'Del lige.' },
  colorParts: { long: 'Tryk på delene for at farve dem. Tryk igen for at fjerne farven. Tryk så på fluebenet.', short: 'Farv delene.' },
  // grid (A21): a point is set in the net, or read off by its numbers on the two axes
  grid: { long: 'Først hen, så op. Tryk i nettet, hvor punktet skal stå, eller tryk på punktets tal forneden og til venstre. Tryk så på fluebenet.', short: 'Først hen, så op.' },
}

export const instructionClip = (kind: TaskKind, form: 'long' | 'short'): string => `s.kind.${kind}.${form}`

/**
 * The bubble's words for a family whose task asks for something else than its kind's short form
 * (QA3a P2-2): pay's "Betal det, det koster." is wrong when the tray is to hold the change (every
 * family of change, also Købmandsgården's), the price of two, the same money in kroner, or the
 * fewest coins. Keys are `<kind>:<skill>` or `<kind>:<skill>/<family>`; the words are the skills' own
 * clips, the end of the spoken question.
 */
const FAMILY_SHORT: Readonly<Record<string, readonly string[]>> = {
  'pay:change': ['s.change.layChange'],
  'pay:kronerOre/addHalves': ['s.kronerOre.payTwo'],
  'pay:kronerOre/fiftiesInKroner': ['s.kronerOre.payInKroner'],
  'pay:payExact/fewestCoins': ['frag.betal', 's.payExact.asFewAsPossible'],
}

/** A family's own words for its kind (null: the kind's short form says it). */
export function familyInstruction(kind: TaskKind, skill: string, family: string): readonly string[] | null {
  return FAMILY_SHORT[`${kind}:${skill}/${family}`] ?? FAMILY_SHORT[`${kind}:${skill}`] ?? null
}

/** The bubble's short instruction for a task: its family's own words, else its kind's short form. */
export function shortInstruction(kind: TaskKind, skill: string, family: string): { clip: string }[] {
  return (familyInstruction(kind, skill, family) ?? [instructionClip(kind, 'short')]).map((clip) => ({ clip }))
}

const table: Record<string, string> = {}
for (const [kind, text] of Object.entries(KIND_INSTRUCTIONS)) {
  table[instructionClip(kind as TaskKind, 'long')] = text.long
  table[instructionClip(kind as TaskKind, 'short')] = text.short
}
table['s.kind.buildBase.flat'] = 'Plade'
table['s.kind.buildBase.rod'] = 'Stang'
table['s.kind.buildBase.unit'] = 'Terning'
// the ends of a row of places that has a direction (QA3a P2-3, Brøkbageriet's fractions in order)
table['s.kind.sortOrder.biggest'] = 'Størst'
table['s.kind.sortOrder.smallest'] = 'Mindst'
// the grid's controls (A21): the net a point is set in, and the numbers along the two axes
table['s.kind.grid.board'] = 'Nettet'
table['s.kind.grid.along'] = 'Tallene forneden'
table['s.kind.grid.up'] = 'Tallene til venstre'

export const clips: Readonly<Record<string, string>> = table

/** The grid kind is rebuilt for points in wave 3 (SPEC A21): its words are recorded with wave 3. */
export const wave = (id: string): Wave => (id.startsWith('s.kind.grid.') || id.startsWith('s.kind.sortOrder.') ? 3 : 1)

/** The ends of a row of fractions come with Brøkbageriet's sprite; the rest is the round's own (uiPack). */
export const pack = (id: string): string => (id.startsWith('s.kind.sortOrder.') ? 'fractions-3' : 'ui-play')
