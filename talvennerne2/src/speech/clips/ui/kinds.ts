// Instructions per task kind (SPEC §3.4): the long form is read the first three times a profile
// meets a kind, the short form after that. All fifteen kinds are here, so wave 2 and 3 only add
// their views. Plus the names of the buildBase blocks (read when their buttons are explored).
import type { TaskKind } from '../../../engine/types'

export const KIND_INSTRUCTIONS: Record<TaskKind, { long: string; short: string }> = {
  choice: { long: 'Tryk på det kort, der passer.', short: 'Tryk på svaret.' },
  keypad: { long: 'Skriv svaret med tallene. Tryk på fluebenet, når du er færdig.', short: 'Skriv svaret.' },
  countTap: { long: 'Tryk på tingene, så hopper de i kurven. Tryk på kurven for at tage en op igen.', short: 'Læg dem i kurven.' },
  pair: { long: 'Træk den boble, der passer, over i den tomme boble.', short: 'Træk boblen på plads.' },
  numberline: { long: 'Tryk på tallinjen, der hvor tallet hører til. Du kan flytte nålen. Tryk så på fluebenet.', short: 'Sæt nålen på tallinjen.' },
  trueFalse: { long: 'Passer det? Tryk på det grønne flueben for ja eller på det røde kryds for nej.', short: 'Ja eller nej?' },
  sortOrder: { long: 'Tryk på kortene i den rigtige rækkefølge. Tryk på et kort igen for at sende det tilbage.', short: 'Sæt dem i rækkefølge.' },
  multiSelect: { long: 'Tryk på alle dem, der passer. Tryk på fluebenet, når du har fundet dem alle.', short: 'Find dem alle.' },
  fillSlots: { long: 'Tryk på brikkerne nedenfor for at fylde de tomme pladser. Tryk på en plads for at tømme den.', short: 'Fyld de tomme pladser.' },
  buildBase: { long: 'Byg tallet med plader, stænger og terninger. Tryk på en bunke for at tage en klods væk.', short: 'Byg tallet.' },
  clockSet: { long: 'Træk i den lange viser for at stille uret. Den lille viser følger med. Tryk så på fluebenet.', short: 'Stil uret.' },
  pay: { long: 'Tryk på mønterne for at lægge dem i bakken. Tryk i bakken for at tage en tilbage.', short: 'Betal det, det koster.' },
  share: { long: 'Tryk på et dyr for at give det en ting. Bliv ved, til bunken er tom.', short: 'Del lige.' },
  colorParts: { long: 'Tryk på delene for at farve dem. Tryk igen for at fjerne farven.', short: 'Farv delene.' },
  grid: { long: 'Tryk på felterne i nettet. Tryk igen for at fjerne et felt.', short: 'Tryk i nettet.' },
}

export const instructionClip = (kind: TaskKind, form: 'long' | 'short'): string => `s.kind.${kind}.${form}`

const table: Record<string, string> = {}
for (const [kind, text] of Object.entries(KIND_INSTRUCTIONS)) {
  table[instructionClip(kind as TaskKind, 'long')] = text.long
  table[instructionClip(kind as TaskKind, 'short')] = text.short
}
table['s.kind.buildBase.flat'] = 'Plade'
table['s.kind.buildBase.rod'] = 'Stang'
table['s.kind.buildBase.unit'] = 'Terning'

export const clips: Readonly<Record<string, string>> = table
