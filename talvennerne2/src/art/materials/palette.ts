// Material colours (SPEC §11, kunst-lyd-teknik §1.6). With src/ui/design/tokens.css this is the only
// place in src/art/materials with raw colours. Every tone is derived with the rig's formulas so the
// materials sit next to the animals: shade = L−0.08, h−5; outline = Lx0.55, Cx1.1 (OKLCH); light is
// the lit face of 3D forms. White objects use the ink family for their contour instead of grey.

export interface Tone {
  fill: string
  shade: string
  outline: string
  light: string
}

export const INK = '#2B2144'
export const INK_2 = '#5E5478'
export const INK_3 = '#8A82A0'
export const WHITE = '#FFFFFF'
export const PAPER = '#FFF8EC'
/** Cel highlight: white at 45 %. */
export const HIGHLIGHT = 'rgba(255,255,255,0.45)'
/** Flat ground shadow under objects. */
export const GROUND = 'rgba(43,33,68,0.12)'
/** Thin guide lines (grids, ticks on light backgrounds). */
export const GUIDE = 'rgba(43,33,68,0.16)'
/** Zebra tint for alternate rows. */
export const ROW_TINT = 'rgba(43,33,68,0.04)'
/** The long minute hand (SPEC §11). */
export const MINUTE_HAND = '#EB5757'
export const PRIMARY = '#6C4CF5'
export const PRIMARY_SOFT = '#EFEBFF'
export const GOOD = '#22B573'
export const STAR = '#FFC83D'

export const MAT = {
  // Money
  copper: { fill: '#D0854A', shade: '#B86B37', outline: '#643200', light: '#E09E6E' },
  silver: { fill: '#CDD3DC', shade: '#B3BAC2', outline: '#575D65', light: '#E5EAF2' },
  gold: { fill: '#E4BB4E', shade: '#CF9F31', outline: '#695000', light: '#F6D37C' },
  note50: { fill: '#A48BE8', shade: '#8575D0', outline: '#4C2A88', light: '#C9B9F6' },
  note100: { fill: '#F7A45A', shade: '#DF8846', outline: '#774100', light: '#FFD2A8' },
  note200: { fill: '#6CC48A', shade: '#5CA96B', outline: '#005B2E', light: '#B5E6C3' },
  note500: { fill: '#7C9CC0', shade: '#6185A6', outline: '#234365', light: '#C1D2E6' },
  // Clock and measuring
  rim: { fill: '#5AAEF5', shade: '#3297D7', outline: '#004B7C', light: '#81C4FF' },
  face: { fill: '#FFFDF7', shade: '#F1EBDF', outline: INK_2, light: '#FFFFFF' },
  ruler: { fill: '#FAD774', shade: '#E5BA5A', outline: '#765D00', light: '#FFF1CA' },
  wood: { fill: '#F2C27B', shade: '#DBA664', outline: '#775000', light: '#FFDCAA' },
  // Counting
  counterA: { fill: '#7B5CF6', shade: '#5B45DD', outline: '#37008C', light: '#9C85FF' },
  counterB: { fill: '#FF9D45', shade: '#E78131', outline: '#783F00', light: '#FFBF8D' },
  frame: { fill: '#FFFFFF', shade: '#EEEAF4', outline: INK_3, light: '#FFFFFF' },
  die: { fill: '#FFFFFF', shade: '#E9E4F2', outline: INK_2, light: '#FFFFFF' },
  skinA: { fill: '#F7CFAE', shade: '#DEB497', outline: '#7B5634', light: '#FFEADA' },
  skinB: { fill: '#E0A578', shade: '#C88B64', outline: '#753D00', light: '#F1BE97' },
  skinC: { fill: '#9C6644', shade: '#844E31', outline: '#4E2200', light: '#AD7D60' },
  beadA: { fill: '#7B5CF6', shade: '#5B45DD', outline: '#37008C', light: '#9C85FF' },
  beadB: { fill: '#FFFFFF', shade: '#E6E0F7', outline: '#37008C', light: '#FFFFFF' },
  // Countable things
  carrot: { fill: '#FF8A3D', shade: '#E56E2D', outline: '#773500', light: '#FFAF80' },
  leafGreen: { fill: '#56C26A', shade: '#4BA746', outline: '#00581E', light: '#7DD58A' },
  apple: { fill: '#F25C54', shade: '#D53F49', outline: '#7C000A', light: '#FF7E74' },
  strawberry: { fill: '#F0506E', shade: '#D23363', outline: '#770026', light: '#FD7588' },
  seed: { fill: '#FFE7A0', shade: '#E9CB87', outline: '#7C6408', light: '#FFFAEB' },
  chestnut: { fill: '#A35F36', shade: '#8B4624', outline: '#4E2000', light: '#B37755' },
  chestnutCap: { fill: '#E9C79C', shade: '#D1AC85', outline: '#735325', light: '#FCDFBA' },
  petal: { fill: '#FF93BD', shade: '#E07BAC', outline: '#8B1E54', light: '#FFBAD2' },
  petalCenter: { fill: '#FFC83D', shade: '#EBAA12', outline: '#745700', light: '#FFE5AD' },
  fish: { fill: '#4FB0FF', shade: '#1A99E1', outline: '#004C7D', light: '#85C6FF' },
  fishFin: { fill: '#2F8FE8', shade: '#0079C2', outline: '#003C6D', light: '#5AA6F2' },
  mushroom: { fill: '#F2665E', shade: '#D54A52', outline: '#7F000D', light: '#FF877D' },
  stem: { fill: '#FFF1D9', shade: '#E6D6BF', outline: '#776A53', light: '#FFF9F0' },
  star: { fill: '#FFC83D', shade: '#EBAA12', outline: '#745700', light: '#FFE5AD' },
  ball: { fill: '#FF7A59', shade: '#E35E4C', outline: '#831E00', light: '#FFA189' },
  // Geometry
  shape: { fill: '#7CD49B', shade: '#6BB97B', outline: '#006335', light: '#A9EAC0' },
  shapeB: { fill: '#27AE60', shade: '#1D933D', outline: '#004C24', light: '#5DC17E' },
  solid: { fill: '#5FC688', shade: '#3FA868', outline: '#005A2E', light: '#A6E8BF' },
  frac: { fill: '#F07CB5', shade: '#D164A4', outline: '#840054', light: '#FF9AC9' },
  fracEmpty: { fill: '#FFFFFF', shade: '#F6EDF3', outline: '#840054', light: '#FFFFFF' },
  gridFill: { fill: '#9ADFB0', shade: '#87C491', outline: '#196A3D', light: '#B9F4CB' },
  point: { fill: '#6C4CF5', shade: '#4D33DC', outline: '#2F0083', light: '#7E6EFA' },
  // Data
  bar: { fill: '#2DB7B0', shade: '#009E91', outline: '#00504D', light: '#65CBC4' },
  barB: { fill: '#F2994A', shade: '#DA7D36', outline: '#733D00', light: '#FFB578' },
  barC: { fill: '#9B51E0', shade: '#7B3ACB', outline: '#490078', light: '#AC71EA' },
  barD: { fill: '#2F7DF6', shade: '#006ACA', outline: '#003179', light: '#5596FD' },
  // Balance, boards
  seesaw: { fill: '#F2C27B', shade: '#DBA664', outline: '#775000', light: '#FFDCAA' },
  fulcrum: { fill: '#8C7BD8', shade: '#6E65C0', outline: '#3F2181', light: '#A194E4' },
  pan: { fill: '#CDD3DC', shade: '#B3BAC2', outline: '#575D65', light: '#E5EAF2' },
  cellHi: { fill: '#FFE29B', shade: '#E9C682', outline: '#7E6100', light: '#FFFAED' },
  cube: { fill: '#FFB84D', shade: '#E99B34', outline: '#774D00', light: '#FFD7A2' },
  clip: { fill: '#9FB3C8', shade: '#859BAE', outline: '#3B4E62', light: '#B8C9DB' },
} satisfies Record<string, Tone>

export type ToneName = keyof typeof MAT

/** Material outline width in material units (≈ px at natural size). */
export const SW = 3
/** Font stack for numbers drawn inside materials (tabular digits, weight 900). */
export const NUM_FONT = "'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif"
