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
  farHill: '#B5DCC4',
  farTree: '#93C6A0',
  fieldHill: '#C2E39A',
  field: '#D8EDA0',
  fieldDark: '#A9D67E',
  hedgerow: '#6BAE62',
  midHill: '#A3D88A',
  nearHill: '#88CB69',
  front: '#72BA55',
  frontDark: '#4E9C45',
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
