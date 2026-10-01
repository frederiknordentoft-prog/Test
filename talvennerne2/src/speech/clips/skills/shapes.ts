// Clips for shapes2D: the Kan-bog line, "alle" for "Tryk på alle trekanter", and the strategy
// hints (what makes the figure that figure). Shape names are the catalogue nouns
// (`noun.shape.<shape>.<case>.<form>`, clips/nouns.ts). Circle, triangle and firkant are 0. klasse
// (wave 1); square, rectangle and the polygons are 1. klasse (wave 2).
import type { ClipId } from '../../../engine/types'
import type { Wave } from '../../catalog'

const WAVED: Readonly<Record<ClipId, readonly [text: string, wave: Wave]>> = {
  's.cando.shapes2D': ['Jeg kan kende cirkler, trekanter og firkanter.', 1],
  's.shapes2D.all': ['alle', 1],
  'hint.shapes2D.circle': ['En cirkel er helt rund og har ingen hjørner.', 1],
  'hint.shapes2D.triangle': ['En trekant har tre sider og tre hjørner.', 1],
  'hint.shapes2D.quadrilateral': ['En firkant har fire sider og fire hjørner.', 1],
  'hint.shapes2D.stillShape': ['Selv om den ser anderledes ud, er det stadig', 1],
  'hint.shapes2D.square': ['Et kvadrat har fire lige lange sider og fire rette hjørner.', 2],
  'hint.shapes2D.rectangle': ['Et rektangel har fire sider og fire rette hjørner.', 2],
  'hint.shapes2D.squareIsRect': ['Et kvadrat er også et rektangel.', 2],
  'hint.shapes2D.pentagon': ['En femkant har fem sider og fem hjørner.', 2],
  'hint.shapes2D.hexagon': ['En sekskant har seks sider og seks hjørner.', 2],
  'hint.shapes2D.octagon': ['En ottekant har otte sider og otte hjørner.', 2],
}

export const clips: Readonly<Record<ClipId, string>> = Object.fromEntries(Object.entries(WAVED).map(([id, [text]]) => [id, text]))

export function wave(id: ClipId): Wave {
  return WAVED[id]?.[1] ?? 1
}
