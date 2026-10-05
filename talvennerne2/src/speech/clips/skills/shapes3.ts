// Clips for the shapes skills of 3. klasse (SK3-GEO: area, gridCoords): the Kan-bog lines, the questions
// and the strategy hints. "Kvadrater" after a number is the catalogue noun (`noun.shape.square.pl.*`,
// clips/nouns.ts); every number is a { num } part (SPEC §10.1). All wave 3, in the shapes sprite of
// wave 3 (Arealhaven, Stjernefjeldet).
import type { ClipId } from '../../../engine/types'

const table: Record<ClipId, string> = {
  // Kan-bogen
  's.cando.area': 'Jeg kan finde arealet af en figur ved at tælle kvadrater.',
  's.cando.gridCoords': 'Jeg kan sætte og aflæse punkter i et koordinatsystem.',

  // area: questions
  's.area.cover': 'Hvor mange kvadrater dækker figuren?',
  's.area.rect': 'Hvor mange kvadrater dækker rektanglet?',
  's.area.more': 'Hvor mange flere kvadrater dækker den største figur?',

  // area: hints ("Figuren dækker tolv kvadrater." / "Der er tre rækker med fire kvadrater i hver.")
  'hint.area.countEach': 'Peg på hvert kvadrat, mens du tæller, og tæl hvert kvadrat én gang.',
  'hint.area.covers': 'Figuren dækker',
  'hint.area.notEdge': 'Arealet er de kvadrater, der dækker figuren. Tæl ikke kanten rundt om den.',
  'hint.area.thereAre': 'Der er',
  'hint.area.rowsWith': 'rækker med',
  'hint.area.inEach': 'kvadrater i hver.',
  'hint.area.split': 'Del figuren i to rektangler.',
  'hint.area.oneRect': 'Det ene rektangel dækker',
  'hint.area.otherRect': 'og det andet dækker',
  'hint.area.eachFigure': 'Find arealet af hver figur for sig.',
  'hint.area.oneFigure': 'Den ene figur dækker',
  'hint.area.otherFigure': 'og den anden dækker',
  'hint.area.longNotBig': 'En lang figur er ikke altid den største.',

  // gridCoords: questions ("Sæt punktet tre, to." / "Du skal sætte punktet tre, to. Hvor langt op skal du gå?")
  's.gridCoords.place': 'Sæt punktet',
  's.gridCoords.toPlace': 'Du skal sætte punktet',
  's.gridCoords.howFarAlong': 'Hvor langt hen skal du gå?',
  's.gridCoords.howFarUp': 'Hvor langt op skal du gå?',
  's.gridCoords.read': 'Hvor langt hen og hvor langt op er punktet?',
  's.gridCoords.readAlong': 'Hvor langt hen er punktet?',
  's.gridCoords.readUp': 'Hvor langt op er punktet?',

  // gridCoords: hints ("Start i nul. Gå tre hen og så to op. Der er punktet.")
  'hint.gridCoords.order': 'Det første tal er hen, og det andet tal er op.',
  'hint.gridCoords.fromZero': 'Start i nul.',
  'hint.gridCoords.go': 'Gå',
  'hint.gridCoords.alongThen': 'hen og så',
  'hint.gridCoords.upThere': 'op. Der er punktet.',
  'hint.gridCoords.down': 'Kig lige ned under punktet. Der står',
  'hint.gridCoords.side': 'Kig lige over til venstre. Der står',
}

export const clips: Readonly<Record<ClipId, string>> = table

/** Stjernefjeldet (3. klasse) is wave 3. */
export const wave = 3

export const pack = 'shapes-3'
