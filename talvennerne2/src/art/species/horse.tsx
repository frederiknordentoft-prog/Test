// Hesten (bølge 2). Tre racer:
// - shetland: lille og buttet med korte ben, en stor, busket pandelok, tyk manke og busket hale.
// - fjord: blakket/creme med den karakteristiske stående, tofarvede manke (lys med mørk midterstribe).
// - arabian: elegant og høj med lange ben, store øjne, en lang, svungen manke og en løftet hale.
// Manken falder til én side (beskuerens venstre) og har kun en lille tot bag højre øre, så den aldrig
// ligner hængeører. Signaturen er manke-kastet: manken sidder i sin egen pivot ved issen
// (`a-toss`), og hovedet kaster med i hvile (rig.css). Fælles dele i shared/equine.tsx.
import { mixHex } from '../rig/oklch'
import type { Vec } from '../rig/shapes'
import { pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import type { AnchorSet, SpeciesDef, Stage } from '../rig/types'
import { FJORD_CREAM, FJORD_DARK, HORSE_COLORWAYS } from './horse.colorways'
import {
  EQUINE_ANCHORS, EQUINE_LIMB, EQUINE_UP_ARMS, EQUINE_UP_TIP, EquineEar, EquineLegUp, HorsePatternBody, HorsePatternHead,
  dunPalette, dy, equineHead, hairShape, makeFeet, makeLeg, makeMuzzle,
} from './shared/equine'

const TOSS = 'a-toss'

// ---------------------------------------------------------------------------------------------
// Manker, pandelokker og haler (modelrum for standardhovedet i (100, 86); halen lokalt om tailBase).

/** Tyk manke ned langs venstre side med tre lokkespidser, og en lille tot bag højre øre. */
const MANE_THICK_L: Vec[] = [
  [92, 46], [78, 44.5], [64, 49], [52, 60], [44, 76], [40, 94], [39, 112], [41, 128], [45, 142], [50, 155],
  [53.5, 146], [57, 157], [60.5, 147], [64.5, 152], [66, 139], [62, 118], [60, 98], [63, 80], [72, 64], [86, 54], [96, 51],
]
const MANE_TUFT_R: Vec[] = [
  [106, 46], [121, 45.5], [135, 51], [145, 62], [151, 77], [152, 90], [147, 84], [140, 74], [131, 63], [118, 55], [108, 52],
]
const MANE_THICK_STRANDS: Vec[][] = [
  [[70, 56], [56, 70], [48, 90], [45, 112], [47, 134]],
  [[136, 57], [144, 68], [148, 80]],
]
/** Shetlandsponyens store pandelok: en fyldig frynse med fem spidser, der standser over øjnene. */
const FORELOCK_BIG: Vec[] = [
  [100, 38], [90, 39.5], [82, 46], [78.5, 55], [80, 64], [84, 69], [87.5, 62], [91, 72], [95, 63], [99.5, 75],
  [104, 63], [108.5, 71], [112, 61.5], [117, 66], [121, 57], [119, 47], [111, 40],
]
const FORELOCK_BIG_STRANDS: Vec[][] = [
  [[96, 44], [93, 56], [91.5, 66]],
  [[105, 44], [107.5, 55], [108, 64]],
]
/** Busket hale (lokalt om tailBase oven på låret): buer ud over låret og falder ned langs siden. */
const TAIL_THICK: Vec[] = [
  [-4, -2], [2, -11], [12, -16], [22, -14], [28, -6], [31, 4], [32, 13], [30, 21], [27, 25], [24, 20], [21, 25], [18, 18], [17, 9], [16, 1],
  [11, -5], [4, -5],
]
const TAIL_THICK_STRANDS: Vec[][] = [[[6, -9], [16, -11], [23, -5], [26, 5], [26.6, 15]]]

/**
 * Fjordhestens stående manke (review G1-r2, H1): en kort, opretstående, børstet manestribe med seks
 * korte totter og en mørk midterstribe, klippet lavt som på en fjordhest. Ingen rund pandelok (den
 * læstes som et tredje øje).
 */
const FJORD_CREST: Vec[] = [
  [86, 52], [85, 43], [85.5, 36], [86.6, 31.6], [89, 29.4], [91.2, 32.4], [93.5, 28.8], [96, 32.2], [98.5, 28.4], [101, 32.2],
  [103.5, 28.8], [106, 32.4], [108.5, 29.2], [111, 31.6], [113.6, 33.4], [114.5, 37], [115, 43], [113, 52],
]
const FJORD_CREST_STRIPE: Vec[] = [[96.8, 52], [96.5, 41], [96.8, 34], [97.9, 30.6], [99.6, 29.6], [101.6, 31], [103.2, 34.6], [103.5, 41], [103.2, 52]]
const FJORD_TAIL: Vec[] = [[-3, -2], [3, -10], [12, -14], [21, -12], [26, -5], [28, 4], [28, 14], [26, 22], [23, 25], [20, 20], [17, 24], [16, 15], [15, 6], [11, -2], [4, -4]]
const FJORD_TAIL_STRIPE: Vec[] = [[3, -6], [11, -10], [18, -9], [22, -3], [23.6, 5], [23.4, 14], [21.6, 19], [20.4, 14], [20.6, 5], [18, -2], [11, -5]]

/** Araberens lange, silkebløde manke i en S-bue og en tynd, krøllet pandelok. */
const MANE_SILK_L: Vec[] = [
  [97, 37], [84, 36], [70, 42], [57, 54], [49, 70], [45, 90], [46, 112], [50, 133], [56, 150], [61, 165], [64, 154], [67.5, 162],
  [69, 149], [65, 132], [61, 113], [60, 95], [63, 78], [71, 64], [84, 53], [96, 49],
]
const MANE_SILK_R: Vec[] = [[106, 45], [120, 45], [132, 51], [141, 62], [145, 75], [139, 69], [129, 60], [117, 54], [108, 51]]
const MANE_SILK_STRANDS: Vec[][] = [[[68, 55], [57, 70], [51, 92], [52, 115], [57, 138]]]
const FORELOCK_CURL: Vec[] = [[100, 39], [95, 41.5], [92.5, 48], [93, 56], [96, 63], [99.5, 66], [98.5, 58], [99, 50], [102, 43]]
/** Løftet hale (lokalt): en bue op over ryggen, der falder blødt ned. */
const TAIL_RAISED: Vec[] = [
  [-3, 2], [-1, -10], [5, -21], [14, -29], [24, -31], [32, -25], [35, -14], [34, -3], [31, 8], [28, 13], [26, 5], [24, 10], [22, 1],
  [25, -10], [22, -19], [15, -21], [9, -15], [5, -5], [3, 3],
]
const TAIL_RAISED_STRANDS: Vec[][] = [[[4, -10], [12, -20], [22, -24], [29, -17], [30, -4]]]

// ---------------------------------------------------------------------------------------------
// Racernes ankre: shetlands hoved sidder lavere (kort hals) på en rundere krop; araberens højere.

const SHET_DY = 6
const shift = (d: number, x: number, y: number) => ({ x, y: y + d })
function headAt(d: number): Partial<AnchorSet> {
  return {
    headCenter: shift(d, 100, 86),
    headTop: shift(d, 100, 44),
    earBaseL: shift(d, 71, 54),
    earBaseR: shift(d, 129, 54),
    hornBase: shift(d, 100, 58),
    eyeL: shift(d, 76.5, 92),
    eyeR: shift(d, 123.5, 92),
    muzzle: shift(d, 100, 131),
    mouth: shift(d, 100, 141.5),
    cheekL: shift(d, 63, 109),
    cheekR: shift(d, 137, 109),
    neck: shift(d, 100, 142),
  }
}
const SHETLAND_ANCHORS: Partial<AnchorSet> = {
  ...headAt(SHET_DY),
  bodyCenter: { x: 100, y: 185 },
  bodyRx: 44,
  bodyRy: 41,
  bodyWidth: 88,
  shoulderL: { x: 87, y: 178 },
  shoulderR: { x: 113, y: 178 },
  pawL: { x: 88, y: 221 },
  pawR: { x: 112, y: 221 },
}
const ARAB_DY = -2
const ARABIAN_ANCHORS: Partial<AnchorSet> = {
  ...headAt(ARAB_DY),
  earBaseL: { x: 72, y: 54 + ARAB_DY },
  earBaseR: { x: 128, y: 54 + ARAB_DY },
  eyeL: { x: 77, y: 92 + ARAB_DY },
  eyeR: { x: 123, y: 92 + ARAB_DY },
  eyeRx: 10.9,
  eyeRy: 13.4,
  bodyCenter: { x: 100, y: 183 },
  bodyRx: 38,
  bodyRy: 43,
  bodyWidth: 76,
  shoulderL: { x: 88.5, y: 166 },
  shoulderR: { x: 111.5, y: 166 },
  tailBase: { x: 128, y: 204 },
}

// ---------------------------------------------------------------------------------------------

/** Fyld bag alt ved armene (se `pawWebs`): lommernes udvidede hylstre pr. race, stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {
  arabian: {
    2: {
      oops: { L: [[-19.4, -18.9], [-19, -20], [-16.8, -20.4], [-11.8, -18.3], [-11.4, -17.2], [-13, -14.5], [-15.2, -12.2], [-16.3, -11.8], [-17.4, -12.2], [-17.8, -13.3]] },
      wave: { L: [[-19.4, -18.9], [-19, -20], [-16.8, -20.4], [-11.8, -18.3], [-11.4, -17.2], [-13, -14.5], [-15.2, -12.2], [-16.3, -11.8], [-17.4, -12.2], [-17.8, -13.3]] },
    },
  },
  fjord: {
    3: {
      oops: { R: [[-47.3, 47.4], [-46.9, 46.3], [-45.8, 45.9], [-44.7, 46.3], [-44.3, 47.4], [-44.3, 49.7], [-44.7, 50.8], [-45.8, 51.2], [-46.9, 50.8], [-47.3, 49.7]] },
      wave: { R: [[-47.3, 47.4], [-46.9, 46.3], [-45.8, 45.9], [-44.7, 46.3], [-44.3, 47.4], [-44.3, 49.7], [-44.7, 50.8], [-45.8, 51.2], [-46.9, 50.8], [-47.3, 49.7]] },
    },
  },
  shetland: {
    1: {
      oops: { L: [[-28.8, -22.7], [-28.4, -23.8], [-25.7, -24.2], [-21.6, -22.2], [-20.4, -20.4], [-20.8, -18.5], [-26.2, -10.9], [-27.3, -10.5], [-28.4, -10.9], [-28.8, -12]] },
      wave: { L: [[-28.8, -22.7], [-28.4, -23.8], [-27.3, -24.2], [-25.4, -23.8], [-20.9, -21.5], [-20.4, -19.6], [-20.8, -18.5], [-26.2, -10.9], [-27.3, -10.5], [-28.8, -12]], R: [[-29.9, -38.2], [-27.7, -38.2], [-14, -27.6], [-13.6, -26.5], [-15.5, -23.1], [-22.7, -18.1], [-23.8, -18.5], [-26.9, -22.3], [-29.5, -30.3], [-30.3, -35.6]] },
    },
    2: {
      oops: { L: [[-20.2, -24.2], [-19.8, -25.3], [-18.1, -25.7], [-16.5, -24.8], [-16.1, -23.1], [-16.5, -22], [-17.6, -20.9], [-18.7, -20.5], [-19.8, -20.9], [-20.2, -22]] },
      wave: { L: [[-20.2, -24.2], [-19.8, -25.3], [-18.1, -25.7], [-16.5, -24.8], [-16.1, -23.1], [-16.5, -22], [-17.6, -20.9], [-18.7, -20.5], [-19.8, -20.9], [-20.2, -22]] },
    },
    3: {
      think: { L: [[-40.4, 5], [-39.9, 3.6], [-38.1, -0.8], [-37, -1.2], [-35.4, -0.3], [-34.1, 3.1], [-34.5, 4.7], [-37.3, 6.1], [-38.9, 6.5], [-40, 6.1]], R: [[[-43.6, 7.7], [-43.2, 6.6], [-41.8, 5.3], [-40.2, 4.9], [-39.1, 5.3], [-38.7, 6.4], [-39.1, 7.5], [-40.5, 8.8], [-42.1, 9.2], [-43.2, 8.8]], [[-47.3, 12.4], [-46.4, 10.3], [-44.1, 7.6], [-43, 7.2], [-41.9, 7.6], [-41.5, 8.7], [-42.4, 10.7], [-44.7, 13.5], [-45.8, 13.9], [-46.9, 13.5]]] },
    },
  },
}

export const horse: SpeciesDef = {
  id: 'horse',
  name: 'Hest',
  nameClip: 'name.species.horse',
  family: 'equine',
  body: 'tall',
  breeds: [
    {
      id: 'shetland',
      name: 'shetlandspony',
      fx: { x: 177, y: 69 },
      anchors: SHETLAND_ANCHORS,
      parts: {
        Paw: makeLeg(0.82),
        Feet: makeFeet(1.04),
        ManeBack: hairShape([dy(MANE_THICK_L, SHET_DY), dy(MANE_TUFT_R, SHET_DY)], {
          strands: MANE_THICK_STRANDS.map((s) => dy(s, SHET_DY)),
          pivot: { at: [100, 46 + SHET_DY], cls: TOSS },
        }),
        ManeFront: hairShape(dy(FORELOCK_BIG, SHET_DY), { strands: FORELOCK_BIG_STRANDS.map((s) => dy(s, SHET_DY)) }),
        Tail: hairShape(TAIL_THICK, { strands: TAIL_THICK_STRANDS }),
      },
      bounds: { head: { x0: 30, y0: 22, x1: 160, y1: 168 } },
    },
    {
      id: 'fjord',
      name: 'fjordhest',
      fx: { x: 172, y: 74 },
      anchors: { bodyRx: 43, bodyWidth: 86 },
      palette: dunPalette(mixHex, FJORD_CREAM, FJORD_DARK),
      parts: {
        ManeBack: hairShape(FJORD_CREST, { stripe: FJORD_CREST_STRIPE, pivot: { at: [100, 46], cls: TOSS } }),
        // Ingen pandelok: den korte børstemanke står alene bag issen.
        ManeFront: undefined,
        Tail: hairShape(FJORD_TAIL, { stripe: FJORD_TAIL_STRIPE }),
      },
      bounds: { head: { x0: 40, y0: 6, x1: 160, y1: 152 } },
    },
    {
      id: 'arabian',
      name: 'araber',
      fx: { x: 175, y: 66 },
      anchors: ARABIAN_ANCHORS,
      parts: {
        Paw: makeLeg(1.04),
        ManeBack: hairShape([dy(MANE_SILK_L, ARAB_DY), dy(MANE_SILK_R, ARAB_DY)], {
          strands: MANE_SILK_STRANDS.map((s) => dy(s, ARAB_DY)),
          pivot: { at: [100, 46 + ARAB_DY], cls: TOSS },
        }),
        ManeFront: hairShape(dy(FORELOCK_CURL, ARAB_DY)),
        Tail: hairShape(TAIL_RAISED, { strands: TAIL_RAISED_STRANDS }),
        Muzzle: makeMuzzle(0.86),
      },
      bounds: { head: { x0: 34, y0: 8, x1: 160, y1: 170 }, body: { x0: 44, y0: 132, x1: 172, y1: 228 } },
    },
  ],
  colorways: HORSE_COLORWAYS,
  magic: ['gold', 'rainbow'],
  anchors: EQUINE_ANCHORS,
  bounds: {
    head: { x0: 34, y0: 14, x1: 160, y1: 160 },
    body: { x0: 36, y0: 134, x1: 172, y1: 228 },
  },
  maneOrigin: 'headTop',
  // Tankebobler og Zzz (fælles regel, review G1-r2 pkt. 5.2): hver race har sit anker i fri luft med
  // mindst 8 enheder til hoved, ører, manke og horn i alle stadier og inden for den sikre zone; moods-
  // arkets lint tjekker alle racer og stadier.
  fx: { x: 172, y: 72 },
  face: { idleMouth: 'smile', cheeks: true },
  ears: { splay: 16 },
  signature: 'mane-toss',
  // Forbenene står på jorden: glad løfter dem kun lidt; ups løfter en hov genert op ved mulen.
  poses: {
    happy: { pawL: 10, pawR: 10, tail: 3 },
    cheer: { tail: 3 },
    think: { tail: -3 },
    oops: { pawL: 0, pawR: { up: true }, tail: 2 },
    sleep: { pawL: 0, pawR: 0 },
    wave: { tail: 2 },
  },
  parts: {
    head: equineHead,
    Ear: EquineEar,
    Paw: makeLeg(),
    PawUp: EquineLegUp,
    PawBack: pawWebs({}, PAW_WEBS),
    pawUpTip: EQUINE_UP_TIP,
    upArms: EQUINE_UP_ARMS,
    limb: EQUINE_LIMB,
    Feet: makeFeet(),
    Tail: hairShape(TAIL_THICK, { strands: TAIL_THICK_STRANDS }),
    Muzzle: makeMuzzle(),
    ManeBack: hairShape([MANE_THICK_L, MANE_TUFT_R], { strands: MANE_THICK_STRANDS, pivot: { at: [100, 46], cls: TOSS } }),
    ManeFront: hairShape(FORELOCK_BIG, { strands: FORELOCK_BIG_STRANDS }),
    Pattern: { head: HorsePatternHead, body: HorsePatternBody },
  },
}

export default horse
