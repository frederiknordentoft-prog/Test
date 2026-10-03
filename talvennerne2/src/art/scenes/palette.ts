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
  /** Heste på folden: en fuks, en skimmel, en brun og et isabelfarvet føl. */
  chestnut: '#D27E45',
  chestnutDark: '#99522A',
  grey: '#F1ECF6',
  greyDark: '#B9AFC9',
  foal: '#F2C98E',
  foalDark: '#C98F4E',
  bay: '#A8643F',
  bayDark: '#6B3D26',
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

/**
 * Regnbueskovens grundfarver (fuld mætning = guld): en lys eventyrskov med høje, bløde trækroner i luftperspektiv
 * (blålilla og lyse langt væk, varme og mættede forrest), et trappebjerg af lys sten med mos, en sø med vandfald og
 * en å, lysninger med regnbuelys og skovens dyr. Himlen er en anelse mere lilla end engens (papir og himmel).
 */
export const SKOV = {
  skyTop: '#C6DCFF',
  skyMid: '#ECE4FB',
  skyBottom: '#FFF3DC',
  sun: '#FFE08A',
  sunHalo: '#FFF1C4',
  cloud: '#FFFFFF',
  cloudShade: '#E7E8FB',
  /** Skoven i luftperspektiv (OKLCH L 0,88 → 0,72, C 0,04 → 0,16, tone fra blålilla over blågrøn mod gulgrøn). */
  farHill: '#C9D8F0',
  farForest: '#AEC6E4',
  midHill: '#A6DAC0',
  midForest: '#73BE96',
  nearHill: '#95D06B',
  front: '#79BC48',
  frontDark: '#4C963C',
  sunlit: '#FFEEB5',
  shade: '#3A6A70',
  castShadow: '#2D5A48',
  fgLeaf: '#55A944',
  fgLeafDark: '#27762F',
  fgLeafLight: '#8FD465',
  fern: '#5BB868',
  fernDark: '#2E8246',
  paperShadow: '#4B886A',
  rim: '#F2FFF4',
  /** Træerne: stammer og høje kroner i grønt og mint med enkelte magiske kroner i lilla og rosa. */
  trunk: '#A97349',
  trunkDark: '#7A5034',
  crownGreen: '#5DB46A',
  crownTeal: '#45B095',
  crownLilac: '#B69AF0',
  crownPink: '#FFA3C2',
  leafLight: '#A2E28E',
  leafDark: '#2F8556',
  /** Lysstrålerne i lysningerne (regnbuelys, meget lette). */
  shaft1: '#FFC2D6',
  shaft2: '#FFE59A',
  shaft3: '#C2F2C6',
  shaft4: '#C4DEFF',
  /** Stortalsbjerget: lys lavendelgrå sten med mos på de tre trin. */
  rock: '#D8D0EC',
  rockShade: '#A69BCB',
  moss: '#8CCF78',
  mossDark: '#58A658',
  /** Vandet: vandfaldet, søen og åen (mørkere brinker). */
  water: '#72C5F2',
  waterLight: '#D4F1FF',
  waterEdge: '#3E9BD6',
  waterDeep: '#3F84C2',
  foam: '#FFFFFF',
  bank: '#6E8E48',
  stone: '#DED7EA',
  stoneShade: '#B2A8C8',
  lily: '#69C26C',
  /** Urtårnets top og møllen: lys sten, violet tag, urskive med kvartererne, tyk timeviser (blæk) og lang minutviser (urets røde). */
  tower: '#F2EBF7',
  towerShade: '#C8BBDB',
  roof: '#8E7AE8',
  roofShade: '#6955C8',
  clockFace: '#FFFDF6',
  clockQuarter: '#FFE3A0',
  clockInk: '#2B2144',
  clockMinute: '#EB5757',
  wall: '#FFF5E6',
  wallShade: '#EAD5BA',
  roofRed: '#E7684F',
  roofRedShade: '#C24E3A',
  timber: '#8A5A3A',
  window: '#9ED8F5',
  windowLit: '#FFD45E',
  door: '#5B8FD9',
  wood: '#C88B55',
  woodDark: '#8E5F35',
  /** Gangegrotten: grottens mørke og krystaller i lige rækker. */
  cave: '#5D4E86',
  crystalA: '#FF9CCB',
  crystalB: '#95D3FF',
  crystalGlow: '#F1E2FF',
  /** Købmandsgården: stribet markise og et skilt med en mønt. */
  awning: '#FF7F9E',
  awningShade: '#D9567A',
  awningLight: '#FFFFFF',
  coin: '#E9C24E',
  coinDark: '#AD8721',
  /** Linealstien: pæle med centimeterstreger; i guld farvede som søjler i et diagram. */
  post: '#EBCB9E',
  postShade: '#B98E5C',
  tick: '#6B4A2E',
  barA: '#FF9F8A',
  barB: '#7FC8F8',
  barC: '#9EDF7A',
  trail: '#F3D7A1',
  trailEdge: '#D8B074',
  /** Figurhaven: hække klippet som kugle, terning, kegle og cylinder; et spejlsymmetrisk bed. */
  hedge: '#4DA552',
  hedgeLight: '#86D06E',
  hedgeShade: '#2E7F40',
  soil: '#CF9F70',
  /** Dyrene: uglen i træhullet, egernene og pandaen ved bambusen. */
  owl: '#B98A5E',
  owlDark: '#7D5737',
  owlFace: '#F4DFC2',
  squirrel: '#D9824A',
  squirrelDark: '#A3552B',
  squirrelBelly: '#F7D9B8',
  acorn: '#9A6A3E',
  pandaWhite: '#FFFFFF',
  pandaShade: '#DCD6EA',
  pandaBlack: '#3D3550',
  bamboo: '#8DCB5E',
  bambooDark: '#5A983B',
  eye: '#2B2144',
  /** Svampe i forgrunden. */
  mushroom: '#FF7E7E',
  mushroomDark: '#D65059',
  stem: '#FFF4E3',
  flowerPink: '#FF8FB4',
  flowerYellow: '#FFD24A',
  flowerWhite: '#FFFFFF',
  flowerViolet: '#B49BFF',
  flowerHeart: '#FFA928',
  lantern: '#FFC83D',
  lanternGlow: '#FFE9A8',
  lanternFrame: '#7A5230',
  smoke: '#DFDCE5',
  flag: '#FF6F91',
  flag2: '#6C4CF5',
  butterfly: '#FF9D45',
  butterfly2: '#B49BFF',
  bird: '#5E5478',
  outline: '#5E5478',
  /** Regnbuen over skoven (Regnbuelysningen): fem flade pastelstriber. */
  rainbow1: '#FF9FB2',
  rainbow2: '#FFDC85',
  rainbow3: '#A6E8A4',
  rainbow4: '#9CC8FF',
  rainbow5: '#C7B2FF',
} as const
export type SkovColor = keyof typeof SKOV

/** Regnbueskovens grundfarve tonet til en tier (start er pastel, aldrig grå). */
export const tintSkov = (color: SkovColor, tier: RegionTier): string => tintHex(SKOV[color], tier)
/** Regnbueskovens grundfarve i et blandet trin (bakkerne, skoven og himlen følger hele verdenens fremgang). */
export const tintSkovBy = (color: SkovColor, chroma: number): string => tintHexBy(SKOV[color], chroma)
