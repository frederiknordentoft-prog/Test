// Hesten (bølge 2). Tre racer:
// - shetland: lille og buttet med korte ben, en stor, busket pandelok, tyk manke og busket hale.
// - fjord: blakket/creme med den karakteristiske stående, tofarvede manke (lys med mørk midterstribe).
// - arabian: elegant og høj med lange ben, store øjne, en lang, svungen manke og en løftet hale.
// Manken falder til én side (beskuerens venstre) og har kun en lille tot bag højre øre, så den aldrig
// ligner hængeører. Signaturen er manke-kastet: manken sidder i sin egen pivot ved issen
// (`a-toss`), og hovedet kaster med i hvile (rig.css). Fælles dele i shared/equine.tsx.
import { mixHex } from '../rig/oklch'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, SpeciesDef } from '../rig/types'
import { FJORD_CREAM, FJORD_DARK, HORSE_COLORWAYS } from './horse.colorways'
import {
  EQUINE_ANCHORS, EQUINE_LIMB, EQUINE_UP_TIP, EquineEar, EquineLegUp, HorsePatternBody, HorsePatternHead,
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

/** Fjordhestens stående manke: en høj kam bag issen med mørk midte, og en kort pandelok. */
const FJORD_CREST: Vec[] = [[90.5, 54], [89.5, 42], [90.5, 31], [93.5, 22.5], [100, 18], [106.5, 22.5], [109.5, 31], [110.5, 42], [109.5, 54]]
const FJORD_CREST_STRIPE: Vec[] = [[97.4, 54], [96.8, 40], [97.4, 28], [100, 22.6], [102.6, 28], [103.2, 40], [102.6, 54]]
const FJORD_FORELOCK: Vec[] = [[100, 40], [93, 42], [90.5, 48], [92, 54], [96, 57], [100, 58], [104, 57], [108, 54], [109.5, 48], [107, 42]]
const FJORD_FORELOCK_STRIPE: Vec[] = [[100, 41], [98.4, 44], [98.2, 50], [99.4, 55], [100, 56], [100.6, 55], [101.8, 50], [101.6, 44]]
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
      anchors: { bodyRx: 43, bodyWidth: 86 },
      palette: dunPalette(mixHex, FJORD_CREAM, FJORD_DARK),
      parts: {
        ManeBack: hairShape(FJORD_CREST, { stripe: FJORD_CREST_STRIPE, pivot: { at: [100, 46], cls: TOSS } }),
        ManeFront: hairShape(FJORD_FORELOCK, { stripe: FJORD_FORELOCK_STRIPE }),
        Tail: hairShape(FJORD_TAIL, { stripe: FJORD_TAIL_STRIPE }),
      },
      bounds: { head: { x0: 40, y0: 6, x1: 160, y1: 152 } },
    },
    {
      id: 'arabian',
      name: 'araber',
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
  fx: { x: 160, y: 80 },
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
    pawUpTip: EQUINE_UP_TIP,
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
