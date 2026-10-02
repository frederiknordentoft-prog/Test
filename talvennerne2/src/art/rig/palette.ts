// Farveafledning (SPEC §6.4) og husets faste farver. Denne fil og colorway-filerne (`*.colorways.ts`)
// er de eneste steder i src/art, hvor rå hex er tilladt (lint i art-lint.test.ts).
import { hexToOklch, oklchToHex } from './oklch'
import type { ColorwayDef, Colorway, ItemPalette, MagicColorwayId, Palette } from './types'

/** Pupiller, øjenlinjer og jordskygge. Aldrig ren sort. */
export const INK = '#2B2144'
export const WHITE = '#FFFFFF'
/** Silhuet-arket: sort fyld. */
export const SILHOUETTE_FILL = '#000000'

/** Husets faste ansigtsfarver. */
export const HOUSE = {
  ink: INK,
  white: WHITE,
  cheek: '#FF8AA8',
  mouth: '#8E2F52',
  tongue: '#FF8FA6',
  teeth: '#FFFFFF',
  nose: '#F27E9E',
  inner: '#FBB9CB',
  iris: '#8663C7',
  sparkle: '#FFF3B0',
  aura: '#FFE9A8',
  auraRing: '#FFD66B',
  thought: '#FFFFFF',
  sweat: '#A9DEFF',
  sweatLine: '#4A8BC2',
} as const

/** Cel-højlys: hvid med 40 % alfa. */
export const HIGHLIGHT = 'rgba(255,255,255,0.4)'
/** Tone på jordskyggens radialGradient. */
export const SHADOW_ALPHA = 0.2

const lch = (hex: string) => hexToOklch(hex)

/** kontur = L·0,55, C·1,1 */
export function outlineOf(hex: string): string {
  const c = lch(hex)
  return oklchToHex({ L: c.L * 0.55, C: c.C * 1.1, h: c.h })
}

/** skygge = L−0,08, h−5 */
export function shadeOf(hex: string): string {
  const c = lch(hex)
  return oklchToHex({ L: c.L - 0.08, C: c.C, h: c.h - 5 })
}

/** mave = L+0,12 (maks 0,97), C·0,4 */
export function bellyOf(hex: string): string {
  const c = lch(hex)
  return oklchToHex({ L: Math.min(0.97, c.L + 0.12), C: c.C * 0.4, h: c.h })
}

/** Iris-ringen: en mellemtone i pelsens tone, eller husets violet på neutral pels. */
function irisOf(fur: string): string {
  const c = lch(fur)
  if (c.C < 0.04) return HOUSE.iris
  return oklchToHex({ L: 0.5, C: Math.min(0.14, c.C * 1.4 + 0.02), h: c.h })
}

export function derivePalette(cw: ColorwayDef): Palette {
  const fur = cw.fur
  const o = cw.overrides ?? {}
  const outline = o.outline ?? outlineOf(fur)
  const pattern = o.pattern ?? cw.patternColor ?? fur
  const dutch = cw.pattern === 'dutch'
  const inner = o.inner ?? HOUSE.inner
  const mane = o.mane ?? fur
  const pattern2 = o.pattern2 ?? cw.patternColor2
  const optional: Partial<Palette> = {}
  if (o.mane2) optional.mane2 = o.mane2
  if (o.muzzle) optional.muzzle = o.muzzle
  if (pattern2) {
    optional.pattern2 = pattern2
    optional.pattern2Outline = o.pattern2Outline ?? outlineOf(pattern2)
  }
  if (o.hoof) {
    optional.hoof = o.hoof
    optional.hoofOutline = o.hoofOutline ?? outlineOf(o.hoof)
  }
  if (o.horn) {
    optional.horn = o.horn
    optional.hornShade = o.hornShade ?? shadeOf(o.horn)
    optional.hornOutline = o.hornOutline ?? outlineOf(o.horn)
  }
  return {
    ...optional,
    fur,
    outline,
    shade: o.shade ?? shadeOf(fur),
    belly: o.belly ?? bellyOf(fur),
    highlight: o.highlight ?? HIGHLIGHT,
    inner,
    innerShade: o.innerShade ?? shadeOf(inner),
    nose: o.nose ?? HOUSE.nose,
    cheek: o.cheek ?? HOUSE.cheek,
    iris: o.iris ?? irisOf(fur),
    ink: o.ink ?? INK,
    pattern,
    patternOutline: o.patternOutline ?? outlineOf(pattern),
    patternShade: o.patternShade ?? shadeOf(pattern),
    earFur: o.earFur ?? (dutch ? pattern : fur),
    // Én konturfarve for hele figuren (review G0-r1, fund 5): ører og manke arver figurens kontur.
    earOutline: o.earOutline ?? outline,
    mane,
    maneOutline: o.maneOutline ?? outline,
    gradient: cw.gradient,
    sparkle: cw.sparkle,
  }
}

/** Alt sort – til silhuet-arket (blind silhuettest). */
export function silhouettePalette(p: Palette): Palette {
  const k = SILHOUETTE_FILL
  return {
    ...p,
    fur: k, outline: k, shade: k, belly: k, highlight: 'none', inner: k, innerShade: k, nose: k,
    cheek: 'none', iris: k, ink: k, pattern: k, patternOutline: k, patternShade: k, earFur: k,
    earOutline: k, mane: k, maneOutline: k, gradient: undefined, sparkle: undefined, silhouette: true,
    mane2: k, pattern2: k, pattern2Outline: k, hoof: k, hoofOutline: k, horn: k, hornShade: k, hornOutline: k, muzzle: k,
  }
}

// ---------------------------------------------------------------------------------------------
// Fælles magiske farver (kan overskrives pr. art i artens colorway-fil)

/**
 * Pastel-regnbuen som fire flade striber (review G1-r2: ingen bløde gradienter på kroppen). Riggen
 * tegner den som en gradient med hårde stop, så hver form får vandrette, skarpe bånd uden ekstra elementer.
 */
export const RAINBOW_STOPS = ['#FF9FB2', '#FFDC85', '#A6E8A4', '#9CC8FF'] as const

export const MAGIC: Record<MagicColorwayId, ColorwayDef> = {
  // Guld: ravbrun kontur og ravskygge (review G0-r1, fund 11), så den ikke læses som almindelig gul.
  gold: {
    id: 'gold',
    name: 'guld',
    fur: '#F7C948',
    overrides: {
      outline: '#7A4A10', shade: '#E2A42F', belly: '#FFF0B8', inner: '#FFC98F', nose: '#E8744A',
      iris: '#A0561B', mane: '#FFE07A', hoof: '#C98A1E', horn: '#FFF4C4',
    },
    sparkle: '#FFF7CF',
  },
  // Regnbue: flade pasteller på inderører; de fire regnbuestriber på manke, hale og halsflæse.
  rainbow: {
    id: 'rainbow',
    name: 'regnbue',
    fur: '#F6F0FF',
    overrides: { outline: '#7E68B0', shade: '#E2D6F7', belly: '#FFFFFF', iris: '#7A62C9', inner: '#FFC4DC', hoof: '#B7A6E0', horn: '#FFE9A6' },
    gradient: RAINBOW_STOPS,
  },
  starwhite: {
    id: 'starwhite',
    name: 'stjernehvid',
    fur: '#FBFAFF',
    overrides: { outline: '#7F86C9', shade: '#E3E6FA', belly: '#FFFFFF', iris: '#5B6FD6', mane: '#DCE6FF' },
    sparkle: '#FFFFFF',
  },
}

// ---------------------------------------------------------------------------------------------
// Stofpaletten til tøj. Genstandsfiler vælger farver herfra i stedet for rå hex, så alle 74
// genstande harmonerer med hinanden og med dyrene.

export const FABRIC = {
  tomato: '#F2665E',
  coral: '#FF8E78',
  berry: '#E0569B',
  rose: '#FF9CC2',
  lilac: '#B59CFF',
  violet: '#8C6CF0',
  navy: '#3F4E91',
  sky: '#67C3FF',
  teal: '#2DB7B0',
  mint: '#7EDDB6',
  leaf: '#69C46A',
  sunflower: '#FFD45E',
  mustard: '#E9B23C',
  orange: '#FF9D45',
  cream: '#FFF2D8',
  snow: '#F5F7FF',
  cocoa: '#9B6B4F',
  /** Kaki og oliven (opdagerens tropehjelm og vest). */
  sand: '#DEBF8D',
  olive: '#98A855',
  charcoal: '#4B4560',
  gold: '#F4C84A',
  silver: '#CDD4E0',
} as const
export type FabricName = keyof typeof FABRIC

/** Genvej til et farvesæt ud fra stofnavne (evt. med ekstra striber, fx regnbuehuen). */
export function fabric(id: string, name: string, main: FabricName, trim: FabricName, accent: FabricName, ...stripes: FabricName[]): Colorway {
  const cw: Colorway = { id, name, main: FABRIC[main], trim: FABRIC[trim], accent: FABRIC[accent] }
  return stripes.length ? { ...cw, stripes: stripes.map((s) => FABRIC[s]) } : cw
}

/** Tøjets kontur er tydeligt mørkere end pelsens (L·0,44 mod pelsens L·0,55), så trøje og hue skiller sig ud på pels i samme farve. */
export function fabricOutlineOf(hex: string): string {
  const c = lch(hex)
  return oklchToHex({ L: c.L * 0.44, C: c.C * 1.15, h: c.h })
}

export function itemPalette(cw: Colorway, silhouette = false): ItemPalette {
  if (silhouette) {
    const k = SILHOUETTE_FILL
    return {
      main: k, mainShade: k, outline: k, trim: k, trimShade: k, trimOutline: k,
      accent: k, accentShade: k, accentOutline: k, highlight: 'none', ink: k,
      ...(cw.stripes ? { stripes: cw.stripes.map(() => k) } : null),
    }
  }
  return {
    ...(cw.stripes ? { stripes: cw.stripes } : null),
    main: cw.main,
    mainShade: shadeOf(cw.main),
    outline: fabricOutlineOf(cw.main),
    trim: cw.trim,
    trimShade: shadeOf(cw.trim),
    trimOutline: fabricOutlineOf(cw.trim),
    accent: cw.accent,
    accentShade: shadeOf(cw.accent),
    accentOutline: fabricOutlineOf(cw.accent),
    highlight: HIGHLIGHT,
    ink: INK,
  }
}
