// Enhjørningen (bølge 2). Tre racer:
// - foal (føllet): buttet med korte ben, en kort, krøllet pandelok, kort manke og hale og et lille
//   horn. Kun føllet findes i stjernehvid: Stjernefølet, spillets mest eftertragtede dyr.
// - wavy (bølgemanke): lang, bølget manke på begge sider, en fejende pandelok og en lang bølget hale.
// - starhorn (stjernehorn): et kort spiralhorn med en stjerne i spidsen og en skilt pandelok.
// Alle har pastelmanke med striber (mane2), øjenvipper og et spiralhorn med et glimt, der tænder og
// slukker (signaturen horn-glint: kun opacity). Hoved, ører, ben og hove deles med hesten
// (shared/equine.tsx).
import { MOOD_FACE } from '../parts/house'
import { limbLoop, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { STAGE_XF } from '../rig/anchors'
import { HOUSE } from '../rig/palette'
import { blob, join, mirrorX, poly, quad, star } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, Part, SpeciesDef, Stage } from '../rig/types'
import {
  EQUINE_ANCHORS, EQUINE_LIMB, EQUINE_UP_ARMS, EQUINE_UP_TIP, EquineEar, EquineLegUp, equineHead, hairShape, makeFeet, makeLeg,
  makeMuzzle, round,
} from './shared/equine'
import { UNICORN_COLORWAYS } from './unicorn.colorways'

// ---------------------------------------------------------------------------------------------
// Hornet: en blød kegle med tre skrå spiralbånd i hornets skygge og et glimt, der blinker.

/** Halv bredde af keglen i højden y (0 = basen, −L = spidsen). */
const coneHalf = (hw: number, L: number, y: number) => hw * Math.max(0, 1 + y / L)

function hornShape(L: number, hw: number): Vec[] {
  return [
    [-hw, 3], [-hw * 0.93, -L * 0.2], [-hw * 0.74, -L * 0.45], [-hw * 0.48, -L * 0.7], [-hw * 0.22, -L * 0.9], [0, -L],
    [hw * 0.22, -L * 0.9], [hw * 0.48, -L * 0.7], [hw * 0.74, -L * 0.45], [hw * 0.93, -L * 0.2], [hw, 3], [0, 4.6],
  ]
}

/** Spiralbåndene: skrå bånd fra venstre kant op mod højre, inden for keglen. */
function hornBands(L: number, hw: number): string {
  const band = (t: number) => {
    const y0 = -t * L
    const rise = L * 0.11
    const th = L * 0.08
    const inset = 0.7
    const lx = (y: number) => -coneHalf(hw, L, y) + inset
    const rx = (y: number) => coneHalf(hw, L, y) - inset
    return poly([[lx(y0), y0], [rx(y0 - rise), y0 - rise], [rx(y0 - rise - th), y0 - rise - th], [lx(y0 - th), y0 - th]])
  }
  return join(band(0.12), band(0.38), band(0.64))
}

/**
 * Hornet: en slank kegle (smal bund, skarp spids) med spiralbånd, så højt at spidsen når ørespidserne.
 * Stjernehornet bærer en lille stjerne på spidsen (0,9 gange hornets bundbredde, så skaftet læses som et horn). Signaturen: et
 * firtakket glimt ved spidsen, der tænder og slukker, efterfulgt af en hvid højlysstribe langs hornet
 * (kun opacity, SPEC §6.1).
 */
function makeHorn(L: number, hw: number, withStar = false): Part {
  const cone = blob(hornShape(L, hw), 0.6)
  const bands = hornBands(L, hw)
  const starR = hw * 0.9
  const starD = withStar ? star(0, -L - starR * 0.35, starR, starR * 0.45, 5) : null
  // Højlysstriben: en smal linse langs keglens venstre side.
  const stripe = blob(
    [[-hw * 0.62, -L * 0.1], [-hw * 0.5, -L * 0.38], [-hw * 0.3, -L * 0.62], [-hw * 0.12, -L * 0.8], [-hw * 0.22, -L * 0.6], [-hw * 0.34, -L * 0.36], [-hw * 0.42, -L * 0.1]],
    0.7,
  )
  // Glimtet: et firtakket glimt (16 enheder) lige under spidsen på hornets højre side (rager ikke op
  // over spidsen, så stor-stadiets horn holder sig i den sikre zone).
  const tipY = withStar ? -L - starR * 0.35 : -L
  const sparkle = star(hw * 0.7 + 3, tipY + 8.5, 8, 1.6, 4)
  return ({ pal, sw, still }) => {
    const horn = pal.horn ?? pal.belly
    const line = pal.outline
    return (
      <>
        <path d={cone} fill={horn} stroke={line} strokeWidth={sw} {...round} />
        {!pal.silhouette && <path d={bands} fill={pal.hornShade ?? pal.shade} />}
        {starD && <path d={starD} fill={horn} stroke={line} strokeWidth={sw} {...round} />}
        {!pal.silhouette && <path d={stripe} fill={HOUSE.white} opacity={0.4} className={still ? undefined : 'a-glint-stripe'} />}
        {!pal.silhouette && !still && <path d={sparkle} fill={HOUSE.white} stroke={line} strokeWidth={sw * 0.4} strokeLinejoin="round" opacity={0} className="a-glint-star" />}
      </>
    )
  }
}

// ---------------------------------------------------------------------------------------------
// Øjenvipper: to små buede vipper ved hvert øjes ydre, øvre kant (kun når øjnene er åbne).

const Lashes: Part = ({ pal, sw, a, stage, mood }) => {
  if (pal.silhouette) return null
  const eyes = MOOD_FACE[mood].eyes
  if (eyes !== 'open' && eyes !== 'sparkle' && eyes !== 'wink' && eyes !== 'half') return null
  const k = STAGE_XF[stage].eye
  const rx = a.eyeRx * k
  const ry = a.eyeRy * k
  const lash = (c: { x: number; y: number }, s: 1 | -1) =>
    join(
      quad([c.x + s * rx * 0.86, c.y - ry * 0.5], [c.x + s * rx * 1.22, c.y - ry * 0.62], [c.x + s * rx * 1.38, c.y - ry * 0.92]),
      quad([c.x + s * rx * 0.6, c.y - ry * 0.8], [c.x + s * rx * 0.86, c.y - ry * 1.04], [c.x + s * rx * 0.92, c.y - ry * 1.32]),
    )
  const d = eyes === 'wink' ? lash(a.eyeL, -1) : join(lash(a.eyeL, -1), lash(a.eyeR, 1))
  return <path d={d} fill="none" stroke={pal.ink} strokeWidth={sw * 0.62} {...round} />
}

// ---------------------------------------------------------------------------------------------
// Stjernefølets stjernemærker: gyldne stjerner på kroppens side.

const STARS: [number, number, number][] = [[-0.6, 0.12, 6.2], [-0.36, 0.42, 4.2], [-0.74, 0.5, 3.4], [0.58, 0.36, 4.4]]
/** Stjernefølets gyldne stjerne i panden, mellem pandelokken og øjnene. */
const StarHead: Part = ({ pal, a, colorway, sw }) =>
  colorway === 'starwhite' ? (
    <path d={star(a.headCenter.x, a.headCenter.y - a.headRy * 0.36, 6.4, 2.4, 4)} fill={pal.pattern} stroke={pal.outline} strokeWidth={sw * 0.3} strokeLinejoin="round" />
  ) : null

const StarsBody: Part = ({ pal, a, ids, colorway }) =>
  colorway === 'starwhite' ? (
    <path
      d={join(...STARS.map(([u, v, r]) => star(a.bodyCenter.x + u * a.bodyRx, a.bodyCenter.y + v * a.bodyRy, r, r * 0.45, 5, (u * 40) % 36)))}
      fill={pal.pattern}
      clipPath={`url(#${ids.bodyClip})`}
    />
  ) : null

// ---------------------------------------------------------------------------------------------
// Hår (modelrum for standardhovedet i (100, 86); halen lokalt om tailBase).

/** Føllet: kort krøllet pandelok, kort tottet manke, kort hale. */
const FOAL_FORELOCK: Vec[] = [[100, 39], [92.5, 41], [88.5, 47.5], [89.5, 55], [94, 59.5], [99, 58.5], [96.6, 53.6], [99, 49.4], [104, 47], [107.5, 42.5]]
const FOAL_FORELOCK_STRIPE: Vec[] = [[99, 42], [94.5, 44.4], [92.6, 49.6], [94.2, 54.6], [95.6, 50.6], [98.6, 46.6]]
const FOAL_MANE: Vec[][] = [
  [[96, 40], [82, 39.5], [67, 45], [55, 55], [47, 69], [43, 85], [44, 100], [48, 112], [52, 102], [55, 113], [59, 101], [60, 84], [66, 66], [78, 55], [92, 50]],
  [[106, 41], [121, 41], [134, 48], [144, 60], [149, 75], [148, 88], [142, 80], [139, 90], [135, 76], [128, 62], [116, 53], [108, 50]],
]
const FOAL_MANE_STRIPE: Vec[] = [[62, 50], [53, 61], [48.5, 76], [47.6, 92], [50.6, 100], [52.6, 88], [54.4, 74], [60, 62], [68, 54]]
/**
 * Enhjørningens haler hænger tæt ned langs låret og ender i en spirallok, der krøller udad (den lukker
 * aldrig baggrund inde mellem hale og lår), så arten også kan læses i sort – hestens haler ender i
 * frynser (review G1-r2, E3c). Rygrad og bredde → kontur.
 */
const curlTail = (spine: readonly Vec[], w0: number, w1: number): Vec[] => limbLoop(spine, w0, w1, 6)
const FOAL_TAIL = curlTail([[-2, -1], [5, -5], [12, -5], [18, -1], [21, 6], [21.5, 13], [23, 19], [26.5, 22.5], [30, 21.5], [31, 17.5]], 11, 4.5)

/** Bølgemanke: lange, bølgede lokker på begge sider, en fejende pandelok og en lang bølget hale. */
const WAVY_FORELOCK: Vec[] = [[100, 39], [91.5, 41], [86.5, 47], [86, 55], [89, 62], [94, 66.5], [96.5, 72], [100, 66.6], [103.4, 60], [108.6, 56], [113.4, 51.6], [115, 45.6], [110, 40.6]]
const WAVY_FORELOCK_STRIPE: Vec[] = [[96, 43], [91.6, 47.6], [91, 55], [94, 61], [97, 64.5], [97.4, 58], [95.6, 52], [97.6, 46.6]]
const WAVY_MANE: Vec[][] = [
  [
    [96, 36], [82, 36], [68, 42], [56, 52], [48, 66], [44, 82], [46, 96], [42, 110], [42, 124], [46, 138], [44, 151], [48, 162],
    [53, 170], [57, 164], [60, 172], [64, 162], [72, 152], [80, 140], [68, 124], [61, 110], [64, 96], [62, 82], [66, 68], [74, 58],
    [86, 52], [97, 50],
  ],
  [
    [105, 40], [120, 40], [134, 46], [145, 57], [151, 72], [154, 88], [150, 102], [154, 116], [150, 128], [146, 118], [143, 106],
    [145, 92], [141, 78], [134, 66], [123, 56], [110, 52],
  ],
]
const WAVY_MANE_STRIPE: Vec[] = [[64, 48], [54, 62], [49, 80], [51, 96], [48, 112], [50, 128], [53, 124], [53.4, 110], [55.6, 96], [54.6, 80], [58.6, 64], [67, 52]]
const WAVY_TAIL = curlTail([[-2, -1], [6, -6], [13, -6.5], [19, -2], [22.5, 5], [22, 12], [23.5, 18], [27, 22], [30.5, 21.5], [31.5, 17.5]], 12, 5)

/** Stjernehorn: mellemlang manke på højre side, en lille tot til venstre, skilt pandelok. */
const MANE_MED_L: Vec[] = [
  [93, 45], [79, 44], [66, 50], [55, 61], [48, 77], [45, 95], [46, 114], [50, 130], [55, 142], [58, 134], [61, 142], [64, 128],
  [61, 112], [60, 95], [63, 79], [71, 64], [84, 54], [95, 50],
]
const MANE_TUFT_L: Vec[] = [[94, 46], [80, 46], [68, 52], [60, 62], [57, 74], [63, 69], [72, 60], [84, 55], [92, 52]]
const STAR_MANE: Vec[][] = [mirrorX(MANE_MED_L, 100), MANE_TUFT_L]
const STAR_MANE_STRIPE: Vec[] = mirrorX([[66, 56], [56, 68], [51, 84], [50.5, 100], [53, 116], [55.4, 112], [55, 98], [56.4, 84], [60.6, 70], [69, 59]], 100)
const STAR_FORELOCK: Vec[] = [[100, 40], [92, 41], [86, 47], [84, 55], [88, 61], [92, 56], [96, 50], [100, 47], [104, 50], [108, 56], [112, 61], [116, 55], [114, 47], [108, 41]]
const STAR_TAIL = curlTail([[-2, -1], [5.5, -5.5], [12.5, -6], [18.5, -2], [22, 5], [22, 12], [23.5, 18.5], [27, 22.5], [30.5, 22], [31.5, 18]], 11.5, 4.5)

// ---------------------------------------------------------------------------------------------

const FOAL_ANCHORS: Partial<AnchorSet> = {
  bodyCenter: { x: 100, y: 184 },
  bodyRx: 43,
  bodyRy: 42,
  bodyWidth: 86,
  shoulderL: { x: 87, y: 175 },
  shoulderR: { x: 113, y: 175 },
  eyeRx: 10.9,
  eyeRy: 13.2,
}

/** Fyld bag alt ved armene (se `pawWebs`): lommernes udvidede hylstre pr. race, stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {
  foal: {
    3: {
      cheer: { L: [[-30.3, -62.6], [-26.5, -68.9], [-24.3, -68.9], [-19.9, -60.2], [-18.1, -55.7], [-17.2, -50.9], [-17.6, -48.3], [-19.8, -48.3], [-30.1, -55.6], [-30.5, -56.7]] },
    },
  },
  wavy: {
    1: {
      cheer: { L: [[-34.5, 11.7], [-32.8, 5.8], [-31.5, 2.5], [-29.1, -1.9], [-26.9, -1.9], [-26.5, 0.7], [-29.2, 12.5], [-29.6, 13.6], [-32.3, 14.7], [-34.1, 14.3]] },
    },
    3: {
      cheer: { R: [[-33.7, -63.5], [-33.2, -65.1], [-29.2, -68.4], [-27, -68.4], [-23.5, -58.8], [-23.9, -56.8], [-30.3, -54], [-31.9, -54.4], [-32.8, -56.4], [-33.7, -60.4]] },
      happy: { L: [[-35.2, 13.5], [-34.8, 12.4], [-32.1, 8.8], [-31, 8.4], [-29.5, 9], [-28.7, 11.6], [-28.6, 12.6], [-29, 13.7], [-32.9, 15.1], [-34.8, 14.6]] },
      idle: { L: [[-34.8, 13.6], [-34.4, 12.5], [-32.2, 8.9], [-31, 8.4], [-29, 9.3], [-28.1, 12.3], [-29, 14], [-30.1, 14.4], [-32.9, 15.1], [-34.4, 14.7]], R: [[-50.6, 28.9], [-49.2, 25.9], [-47.7, 25], [-46.6, 25.4], [-46.2, 27], [-47.6, 31.6], [-48, 32.7], [-49.1, 33.1], [-50.2, 32.7], [-50.6, 31.6]] },
      sleep: { R: [[-51, 29.8], [-50.1, 27.3], [-49.2, 25.7], [-47.4, 24.6], [-46.3, 25], [-45.9, 26.6], [-48.1, 33.3], [-49.2, 33.7], [-50.3, 33.3], [-51, 31.7]] },
    },
  },
}

export const unicorn: SpeciesDef = {
  id: 'unicorn',
  name: 'Enhjørning',
  nameClip: 'name.species.unicorn',
  family: 'equine',
  body: 'tall',
  breeds: [
    {
      id: 'foal',
      name: 'enhjørningeføl',
      fx: { x: 175, y: 68 },
      anchors: FOAL_ANCHORS,
      magic: ['gold', 'rainbow', 'starwhite'],
      parts: {
        Paw: makeLeg(0.86),
        Horn: makeHorn(36, 6.4),
        ManeBack: hairShape(FOAL_MANE, { stripe: FOAL_MANE_STRIPE }),
        ManeFront: hairShape(FOAL_FORELOCK, { stripe: FOAL_FORELOCK_STRIPE }),
        Tail: hairShape(FOAL_TAIL),
      },
      maneGrowth: 1.15,
      bounds: { head: { x0: 40, y0: 14, x1: 160, y1: 152 } },
    },
    {
      id: 'wavy',
      name: 'bølgemanke',
      fx: { x: 176, y: 66 },
      parts: {
        Horn: makeHorn(37, 6.8),
        ManeBack: hairShape(WAVY_MANE, { stripe: WAVY_MANE_STRIPE }),
        ManeFront: hairShape(WAVY_FORELOCK, { stripe: WAVY_FORELOCK_STRIPE }),
        Tail: hairShape(WAVY_TAIL),
      },
      // Manken vokser lidt mindre på stor, så tankebobler og Zzz har plads ved siden af hovedet.
      maneGrowth: 1.12,
      bounds: { head: { x0: 34, y0: 8, x1: 162, y1: 182 } },
    },
    {
      id: 'starhorn',
      name: 'stjernehorn',
      fx: { x: 176, y: 68 },
      parts: {
        Horn: makeHorn(34, 6.6, true),
        ManeBack: hairShape(STAR_MANE, { stripe: STAR_MANE_STRIPE }),
        ManeFront: hairShape(STAR_FORELOCK),
        Tail: hairShape(STAR_TAIL),
      },
      maneGrowth: 1.15,
      // Stjernen sidder oven på et fuldt horn; på stor vokser hornet lidt mindre, så stjernen bliver i zonen.
      hornGrowth: 1.1,
      bounds: { head: { x0: 40, y0: 6, x1: 162, y1: 152 } },
    },
  ],
  colorways: UNICORN_COLORWAYS,
  magic: ['gold', 'rainbow'],
  anchors: EQUINE_ANCHORS,
  bounds: {
    head: { x0: 36, y0: 8, x1: 162, y1: 160 },
    body: { x0: 36, y0: 134, x1: 172, y1: 228 },
  },
  maneOrigin: 'headTop',
  // Tankebobler og Zzz (fælles regel, review G1-r2 pkt. 5.2): hver race har sit anker i fri luft med
  // mindst 8 enheder til hoved, ører, manke og horn i alle stadier og inden for den sikre zone; moods-
  // arkets lint tjekker alle racer og stadier.
  fx: { x: 172, y: 72 },
  face: { idleMouth: 'smile', cheeks: true },
  ears: { splay: 16 },
  signature: 'horn-glint',
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
    Tail: hairShape(FOAL_TAIL),
    Muzzle: makeMuzzle(),
    HeadDeco: Lashes,
    Horn: makeHorn(36, 6.4),
    ManeBack: hairShape(FOAL_MANE),
    ManeFront: hairShape(FOAL_FORELOCK),
    Pattern: { head: StarHead, body: StarsBody },
  },
}

export default unicorn
