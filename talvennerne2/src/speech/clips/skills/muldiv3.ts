// Clips for the multiplication and division skills of 3. klasse (mul34, mul6to9, mulTens in Tabeltoppen;
// div2510, divAll in Delekløften): the Kan-bog lines and the strategy hints. The questions are composed
// ("Hvad er syv gange otte?", "Hvad er tyve divideret med fem?", speech/equation.ts with op.gange and
// op.divideret_med: from 3. klasse ":" is read "divideret med", SPEC A19). The skip counting of 2. klasse
// is said as it is recorded ("Tæl i spring med", clips/skills/muldiv.ts), and so is the dealing on plates.
//
// Every number is a { num } part (SPEC §10.1). All wave 3, in the multiplication-and-division sprite of wave 3.
import type { ClipId } from '../../../engine/types'

const table: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.mul34': 'Jeg kan tre- og firetabellen.',
  's.cando.mul6to9': 'Jeg kan seks-, syv-, otte- og nitabellen.',
  's.cando.div2510': 'Jeg kan dividere med to, fem og ti.',
  's.cando.divAll': 'Jeg kan dividere i hele den lille tabel.',
  's.cando.mulTens': 'Jeg kan gange med hele tiere.',

  // mul6to9: the array split in five rows and the rest (7 · 8 = 5 · 8 + 2 · 8)
  'hint.mul6to9.split': 'Del rækkerne op i fem og resten.',
  'hint.mul6to9.oneTimes': 'Når vi ganger med en, får vi tallet selv.',
  'hint.mul6to9.countRows': 'Tæl efter, hvor mange rækker der er.',

  // div2510 and divAll: the times table backwards. The first division hint bridges the two words (SPEC A19)
  'hint.div2510.bridge': 'Divideret med betyder det samme som delt med.',
  'hint.div.meaning': 'Divideret med betyder, at vi deler i lige store dele.',
  'hint.div.equalParts': 'Vi deler i lige store dele.',
  'hint.div.check': 'Prøv at gange dit svar med',
  'hint.div.shouldGive': 'Det skal give',

  // mulTens: whole tens are tens ("Fyrre består af fire tiere.")
  'frag.mulTens.consistsOf': 'består af',
  'hint.mulTens.withoutZero': 'Gang først uden nullet.',
  'hint.mulTens.zeroBack': 'Sæt så nullet på igen.',
}

export const clips: Readonly<Record<ClipId, string>> = table

/** Stjernefjeldet (3. klasse) is wave 3. */
export const wave = 3

/** The multiplication-and-division sprite of wave 3. */
export const pack = 'muldiv-3'
