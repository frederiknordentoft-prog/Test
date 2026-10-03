// Clips for the algebra skills of 1.–2. klasse (missingPart10, skipCount, missingPart100, inverseOps,
// equalSides; their 3. klasse families step25, mulToDiv, balanceSub and balanceMixed use the same
// sentences): the Kan-bog lines, the questions that are not composed from equation.ts, and the
// strategy hints. missingPart10's questions are the recorded `q.mp:<a>+?=<c>` sentences
// (clips/questions.ts, pack algebra-2); the empty-number-line hops reuse the plus-and-minus words
// (clips/skills/addsub2.ts: "Start på", "Hop", "frem til" …).
//
// Every number is a { num } part (SPEC §10.1). All wave 2, in the algebra sprite of wave 2.
import type { ClipId } from '../../../engine/types'

const table: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.missingPart10': 'Jeg kan finde det tal, der mangler, i plusstykker til ti.',
  's.cando.skipCount': 'Jeg kan tælle i spring.',
  's.cando.missingPart100': 'Jeg kan finde det tal, der mangler, op til hundrede.',
  's.cando.inverseOps': 'Jeg kan bruge et regnestykke, jeg kender, til at regne et nyt.',
  's.cando.equalSides': 'Jeg kan se, om der er lige meget på begge sider af lighedstegnet.',

  // Shared: the equals sign (equalsAsAnswer, SPEC §4.3 — said before the strategy)
  'hint.algebra2.sameBothSides': 'Lighedstegnet betyder: det samme på begge sider.',

  // missingPart10: count on from the first number
  'hint.missingPart10.startOn': 'Start på',
  'hint.missingPart10.countTo': 'Tæl op til',

  // skipCount
  's.skipCount.next': 'Hvilket tal kommer så?',
  's.skipCount.nextTwo': 'Hvilke to tal kommer så?',
  'hint.skipCount.everyHop': 'Springet er',
  'hint.skipCount.everyHopBack': 'Springet tilbage er',
  'hint.skipCount.sameHop': 'Spring lige langt hver gang, ikke bare en.',

  // missingPart100
  'hint.missingPart100.wholeWay': 'Tæl hele vejen op til hundrede. Tierne og enerne skal ikke hver for sig op til ti.',
  'hint.missingPart100.startNumber': 'Vi leder efter det tal, vi startede med. Det er større end de to andre.',

  // inverseOps: the number family
  'frag.inverseOps.so': 'så',
  'hint.inverseOps.plusMinus': 'Plus og minus hører sammen.',
  'hint.inverseOps.timesDivide': 'Gange og delt med hører sammen.',
  'hint.inverseOps.soGives': 'Så giver',
  'hint.inverseOps.divideMeans': 'Delt med betyder, at vi deler i lige store dele.',

  // equalSides
  's.equalSides.same': 'Er der lige meget på begge sider?',
  'hint.equalSides.fullSide': 'Regn først den side ud, hvor der ikke mangler noget.',
  'hint.equalSides.otherSide': 'Den anden side skal også give',
  'hint.equalSides.both': 'Begge sider giver det samme.',
  'hint.equalSides.notBoth': 'Siderne giver ikke det samme.',
  // equalsAsAnswer on the seesaw: the equals sign is not on the screen, the seesaw is (QA2 P3-5)
  'hint.equalSides.sameBothSides': 'Vippen står lige, når der er lige meget på begge sider.',
}

export const clips: Readonly<Record<ClipId, string>> = table

/** Hestebakkerne and Regnbueskoven (1.–2. klasse) are wave 2. */
export const wave = 2

/** The algebra sprite of wave 2, beside the recorded missingPart10 questions (clips/questions.ts). */
export const pack = 'algebra-2'
