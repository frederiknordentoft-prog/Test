// Scenernes farver (verdenskortets baggrunde). Denne fil er, sammen med rig/palette.ts og colorway-filerne,
// det eneste sted i src/art med rå hex (lint). Regionernes farve vender tilbage efter tier (SPEC §5.6):
// OKLCH-kromaskalering fra dæmpet pastel (start – aldrig grå) over bronze og sølv til fuld mætning (guld).
import type { RegionTier } from '../../meta/rewards'
import { hexToOklch, oklchToHex } from '../rig/oklch'

/** Engdalens grundfarver (fuld mætning = guld). Himlen er tokens' himmel (sky-from → sky-to). */
export const ENG = {
  skyTop: '#BFE6FF',
  skyBottom: '#FFF3D6',
  sun: '#FFE08A',
  sunHalo: '#FFF1C4',
  cloud: '#FFFFFF',
  cloudShade: '#E4F1FB',
  /** Bakkerne i luftperspektiv: kølige og lyse langt væk, varme og mættede forrest (OKLCH L 0,9 → 0,72, C 0,042 → 0,165, tone fra blågrøn mod gulgrøn). */
  farHill: '#C4E7D9',
  farTree: '#AAD4C1',
  fieldHill: '#B5E6C0',
  field: '#CCEEB8',
  hedgerow: '#7FBB93',
  midHill: '#A3DB8F',
  nearHill: '#94CB5B',
  front: '#7ABA42',
  frontDark: '#4E9A3C',
  /** Solens lys (fra venstre): varmt højlys på de skrænter, der vender mod solen; kølig skygge på de andre; jordskygger. */
  sunlit: '#FFEEB5',
  shade: '#35705D',
  castShadow: '#2B6339',
  /** Forgrundens store blade i de nederste hjørner (tættest på, mest mættede). */
  fgLeaf: '#57A943',
  fgLeafDark: '#27762F',
  fgLeafLight: '#8FD465',
  mill: '#FFFAF2',
  millShade: '#E3D4C2',
  sail: '#F2E3CC',
  /** Papirkantens skygge (bag hvert lag) og lyse kant (langs toppen). */
  paperShadow: '#4F8F4C',
  rim: '#F4FFE6',
  trunk: '#A97349',
  leaf: '#62B455',
  leafLight: '#8FD36F',
  leafDark: '#3F9142',
  blossom: '#FFB3CC',
  wall: '#FFF5E6',
  wallShade: '#EAD5BA',
  roof: '#E7684F',
  roofShade: '#C24E3A',
  timber: '#8A5A3A',
  window: '#9ED8F5',
  windowLit: '#FFD45E',
  doorBlue: '#5B8FD9',
  trail: '#F3D7A1',
  trailEdge: '#D8B074',
  wood: '#C88B55',
  woodDark: '#8E5F35',
  water: '#6EC3F0',
  waterLight: '#C8ECFF',
  waterEdge: '#3E9BD6',
  /** Bækkens og dammens mørkere brinker. */
  bank: '#718B3D',
  /** Røg fra skorstenen (fra bronze). */
  smoke: '#DFDCE5',
  /** Skiltet med tallet ved stien. */
  signBoard: '#F3DAB2',
  stone: '#D9D3E4',
  stoneShade: '#B7AEC9',
  hedge: '#4FA752',
  hedgeLight: '#7FCB68',
  hedgeShade: '#2F8040',
  moundDoor: '#9B6BE0',
  moundDoorShade: '#7448B8',
  flowerPink: '#FF8FB4',
  flowerYellow: '#FFD24A',
  flowerWhite: '#FFFFFF',
  flowerViolet: '#B49BFF',
  flowerHeart: '#FFA928',
  lantern: '#FFC83D',
  lanternGlow: '#FFE9A8',
  lanternFrame: '#7A5230',
  butterfly: '#FF9D45',
  butterfly2: '#B49BFF',
  bird: '#5E5478',
  outline: '#5E5478',
  /** Regnbuen over dalen (fire flade pastelstriber, som dyrenes regnbue). */
  rainbow1: '#FF9FB2',
  rainbow2: '#FFDC85',
  rainbow3: '#A6E8A4',
  rainbow4: '#9CC8FF',
} as const
export type EngColor = keyof typeof ENG

/** Krom pr. tier (andel af grundfarvens krom) og et lille løft i lyshed for de dæmpede trin. */
export const TIER_CHROMA: Record<RegionTier, number> = { start: 0.55, bronze: 0.72, silver: 0.87, gold: 1 }
const TIER_LIGHT: Record<RegionTier, number> = { start: 0.06, bronze: 0.035, silver: 0.012, gold: 0 }

/** Grundfarven tonet til en tier (start er pastel, aldrig grå: kromen skaleres, tonen bevares). */
export function tint(color: EngColor, tier: RegionTier): string {
  const c = hexToOklch(ENG[color])
  return oklchToHex({ L: Math.min(0.985, c.L + TIER_LIGHT[tier]), C: c.C * TIER_CHROMA[tier], h: c.h })
}

/** Et blandet trin (fx bakkerne, der følger hele dalens fremgang): krom og lyshed interpoleres. */
export function tintBy(color: EngColor, chroma: number): string {
  const c = hexToOklch(ENG[color])
  const k = Math.min(1, Math.max(TIER_CHROMA.start, chroma))
  const lift = TIER_LIGHT.start * (1 - (k - TIER_CHROMA.start) / (1 - TIER_CHROMA.start))
  return oklchToHex({ L: Math.min(0.985, c.L + lift), C: c.C * k, h: c.h })
}

/**
 * Hestebakkernes grundfarver (fuld mætning = guld): bløde, grønne bakker i luftperspektiv (blågrønne og lyse
 * langt væk, varme og mættede forrest), høgule marker, en landsby med tegltage og et stentårn med ur.
 */
export const BAKKE = {
  skyTop: '#BFE6FF',
  skyBottom: '#FFF3D6',
  sun: '#FFE08A',
  sunHalo: '#FFF1C4',
  cloud: '#FFFFFF',
  cloudShade: '#E4F1FB',
  /** Bakkerne i luftperspektiv (OKLCH L 0,9 → 0,72, C 0,04 → 0,16, tone fra blågrøn mod gulgrøn). */
  farHill: '#C6E3E3',
  farTree: '#A6CBCB',
  fieldHill: '#B8E2C2',
  field: '#E6EDB2',
  hedgerow: '#80B994',
  midHill: '#9DD68C',
  nearHill: '#8CCB57',
  front: '#76B944',
  frontDark: '#4B963B',
  sunlit: '#FFEEB5',
  shade: '#35705D',
  castShadow: '#2B6339',
  fgLeaf: '#57A943',
  fgLeafDark: '#27762F',
  fgLeafLight: '#8FD465',
  paperShadow: '#4F8F4C',
  rim: '#F4FFE6',
  trunk: '#A97349',
  leaf: '#5DB35A',
  leafLight: '#8FD36F',
  leafDark: '#3C8E45',
  blossom: '#FFB3CC',
  /** Landsbyen: kalkede mure, tegl- og skifertage, vinduer der lyser fra bronze. */
  wall: '#FFF5E6',
  wallShade: '#EAD5BA',
  roof: '#E7684F',
  roofShade: '#C24E3A',
  roof2: '#7D8FE3',
  roof2Shade: '#5B6BC4',
  timber: '#8A5A3A',
  window: '#9ED8F5',
  windowLit: '#FFD45E',
  door: '#5B8FD9',
  /** Urtårnet: lys sten, urskive med tyk timeviser (blæk) og lang minutviser (urets røde). */
  tower: '#EEE6F3',
  towerShade: '#C7BAD9',
  clockFace: '#FFFDF6',
  clockInk: '#2B2144',
  clockMinute: '#EB5757',
  /** Formværkstedet: varme planker og en grøn port. */
  plank: '#F2C690',
  plankShade: '#D49E66',
  gate: '#4FAE8C',
  gateShade: '#2F8768',
  wood: '#C88B55',
  woodDark: '#8E5F35',
  trail: '#F3D7A1',
  trailEdge: '#D8B074',
  water: '#6EC3F0',
  waterLight: '#C8ECFF',
  waterEdge: '#3E9BD6',
  bank: '#718B3D',
  smoke: '#DFDCE5',
  stone: '#D9D3E4',
  stoneShade: '#B7AEC9',
  /** Tierhoppets sten i guld: fem og fem (som en tierramme). */
  hopA: '#FF9F8A',
  hopB: '#7FC8F8',
  /** Målebakkens bod: stribet markise, vægt i messing og en gul lineal. */
  awning: '#FF7F9E',
  awningShade: '#D9567A',
  awningLight: '#FFFFFF',
  brass: '#E8B54A',
  brassDark: '#A9792A',
  ruler: '#FFD24A',
  rulerEdge: '#C99A1E',
  apple: '#FF6B5E',
  /** Heste på folden: en fuks, en skimmel og et isabelfarvet føl. */
  chestnut: '#D27E45',
  chestnutDark: '#99522A',
  grey: '#F1ECF6',
  greyDark: '#B9AFC9',
  foal: '#F2C98E',
  foalDark: '#C98F4E',
  mane: '#6A4634',
  muzzle: '#F6D9C4',
  /** Lam på bakken (lyst uld, mørkt hoved). */
  wool: '#FFFFFF',
  sheepFace: '#5E5478',
  hay: '#F1D27A',
  hayShade: '#C9A548',
  flowerPink: '#FF8FB4',
  flowerRed: '#FF7A6B',
  flowerYellow: '#FFD24A',
  flowerWhite: '#FFFFFF',
  flowerViolet: '#B49BFF',
  flowerHeart: '#FFA928',
  bud: '#8CCB6A',
  fieldBed: '#C9DE8E',
  furrow: '#9FBF5E',
  lantern: '#FFC83D',
  lanternGlow: '#FFE9A8',
  lanternFrame: '#7A5230',
  flag: '#FF6F91',
  flag2: '#6C4CF5',
  butterfly: '#FF9D45',
  bird: '#5E5478',
  outline: '#5E5478',
  rainbow1: '#FF9FB2',
  rainbow2: '#FFDC85',
  rainbow3: '#A6E8A4',
  rainbow4: '#9CC8FF',
} as const
export type BakkeColor = keyof typeof BAKKE

/** En farve tonet til en tier (som `tint`, for enhver hex fra paletten). */
function tintHex(hex: string, tier: RegionTier): string {
  const c = hexToOklch(hex)
  return oklchToHex({ L: Math.min(0.985, c.L + TIER_LIGHT[tier]), C: c.C * TIER_CHROMA[tier], h: c.h })
}

/** Et blandet trin for enhver hex fra paletten (som `tintBy`). */
function tintHexBy(hex: string, chroma: number): string {
  const c = hexToOklch(hex)
  const k = Math.min(1, Math.max(TIER_CHROMA.start, chroma))
  const lift = TIER_LIGHT.start * (1 - (k - TIER_CHROMA.start) / (1 - TIER_CHROMA.start))
  return oklchToHex({ L: Math.min(0.985, c.L + lift), C: c.C * k, h: c.h })
}

/** Hestebakkernes grundfarve tonet til en tier (start er pastel, aldrig grå). */
export const tintBakke = (color: BakkeColor, tier: RegionTier): string => tintHex(BAKKE[color], tier)
/** Hestebakkernes grundfarve i et blandet trin (bakkerne og himlen følger hele verdenens fremgang). */
export const tintBakkeBy = (color: BakkeColor, chroma: number): string => tintHexBy(BAKKE[color], chroma)
