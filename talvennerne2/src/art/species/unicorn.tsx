// Enhjørningen (bølge 2). Tre racer:
// - foal (føllet): buttet med korte ben, en kort, krøllet pandelok, kort manke og hale og et lille
//   horn. Kun føllet findes i stjernehvid: Stjernefølet, spillets mest eftertragtede dyr.
// - wavy (bølgemanke): lang, bølget manke på begge sider, en fejende pandelok og en lang bølget hale.
// - starhorn (stjernehorn): et kort spiralhorn med en stjerne i panden ved hornets rod og en skilt pandelok
//   (stjernen sad før på spidsen og gjorde hornet til en tryllestav i silhuet, review G1-r4).
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
  EQUINE_ANCHORS, EQUINE_LIMB, EQUINE_UP_ARMS, EQUINE_UP_TIP, EquineEar, EquineLegUp, addWebs, withKeyWebs, equineHead, hairShape, makeFeet,
  makeLeg, makeMuzzle, round,
} from './shared/equine'
import type { CwWebs, WebTable } from './shared/equine'
import { GLINT, UNICORN_COLORWAYS } from './unicorn.colorways'

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
 * Signaturen: et firtakket glimt ved spidsen, der tænder og slukker, efterfulgt af en hvid højlysstribe
 * langs hornet (kun opacity, SPEC §6.1).
 */
function makeHorn(L: number, hw: number): Part {
  const cone = blob(hornShape(L, hw), 0.6)
  const bands = hornBands(L, hw)
  // Højlysstriben: en smal linse langs keglens venstre side.
  const stripe = blob(
    [[-hw * 0.62, -L * 0.1], [-hw * 0.5, -L * 0.38], [-hw * 0.3, -L * 0.62], [-hw * 0.12, -L * 0.8], [-hw * 0.22, -L * 0.6], [-hw * 0.34, -L * 0.36], [-hw * 0.42, -L * 0.1]],
    0.7,
  )
  // Glimtet (review G1-r4): en udfyldt, buttet firtakket stjerne (17 enheder) lige under spidsen på hornets
  // højre side og en lille stjerne skråt under den, i ét path, så de tænder og slukker sammen (kun opacity).
  // Rager ikke op over spidsen, så stor-stadiets horn holder sig i den sikre zone.
  const tipY = -L
  const gx = hw * 0.7 + 3.5
  const gy = tipY + 9
  const sparkle = join(star(gx, gy, 8.5, 3.4, 4), star(gx + 7.5, gy + 8, 4.4, 1.9, 4))
  return ({ pal, sw, still }) => {
    const horn = pal.horn ?? pal.belly
    const line = pal.outline
    return (
      <>
        <path d={cone} fill={horn} stroke={line} strokeWidth={sw} {...round} />
        {!pal.silhouette && <path d={bands} fill={pal.hornShade ?? pal.shade} />}
        {!pal.silhouette && <path d={stripe} fill={HOUSE.white} opacity={0.4} className={still ? undefined : 'a-glint-stripe'} />}
        {!pal.silhouette && !still && <path d={sparkle} fill={GLINT.fill} stroke={GLINT.line} strokeWidth={sw * 0.55} strokeLinejoin="round" opacity={0} className="a-glint-star" />}
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

/**
 * Stjernehornets mærke (review G1-r4): en stjerne i hornets farve i panden lige under hornets rod, mellem den
 * skilte pandeloks to halvdele, så hornet selv står rent og læses som et horn i silhuet og ved 48 px.
 */
const StarMark: Part = ({ pal, a, sw }) =>
  pal.silhouette ? null : (
    <path
      d={star(a.hornBase.x, a.hornBase.y + 12, 5.6, 2.5, 5)}
      fill={pal.horn ?? pal.belly}
      stroke={pal.outline}
      strokeWidth={sw * 0.5}
      strokeLinejoin="round"
    />
  )
const StarhornDeco: Part = (p) => (
  <>
    {Lashes(p)}
    {StarMark(p)}
  </>
)

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
const WAVY_TAIL = curlTail([[-2, -1], [6, -6], [13, -6.5], [19, -2], [22, 5], [21.5, 12], [22.5, 18], [25.5, 22], [28.5, 21.5], [29.5, 17.5]], 12, 5)

/** Stjernehorn: mellemlang manke på højre side, en lille tot til venstre, skilt pandelok. */
const MANE_MED_L: Vec[] = [
  [93, 45], [79, 44], [66, 50], [55, 61], [48, 77], [45, 95], [46, 114], [50, 130], [55, 142], [58, 134], [61, 142], [64, 128],
  [61, 112], [60, 95], [63, 79], [71, 64], [84, 54], [95, 50],
]
const MANE_TUFT_L: Vec[] = [[94, 46], [80, 46], [68, 52], [60, 62], [57, 74], [63, 69], [72, 60], [84, 55], [92, 52]]
const STAR_MANE: Vec[][] = [mirrorX(MANE_MED_L, 100), MANE_TUFT_L]
const STAR_MANE_STRIPE: Vec[] = mirrorX([[66, 56], [56, 68], [51, 84], [50.5, 100], [53, 116], [55.4, 112], [55, 98], [56.4, 84], [60.6, 70], [69, 59]], 100)
const STAR_FORELOCK: Vec[] = [[100, 40], [92, 41], [86, 47], [84, 55], [88, 61], [92, 56], [96, 50], [100, 47], [104, 50], [108, 56], [112, 61], [116, 55], [114, 47], [108, 41]]
const STAR_TAIL = curlTail([[-2, -1], [5.5, -5.5], [12.5, -6], [18.5, -2], [21.5, 5], [21.5, 12], [22.5, 18.5], [25.5, 22.5], [28.5, 22], [29.5, 18]], 11.5, 4.5)

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
  starhorn: {
    3: {
      think: { R: [[-50.6, 30.2], [-50.1, 28.4], [-48.3, 24], [-46.5, 21.7], [-45.4, 21.3], [-44.3, 21.7], [-43.9, 22.8], [-48, 32.3], [-49.1, 32.7], [-50.2, 32.3]] },
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
      oops: { L: [[-28.8, -45.2], [-28, -47.7], [-25.8, -47.7], [-23.9, -45.9], [-21.2, -40.1], [-20.3, -36.9], [-20.7, -32.1], [-22.9, -32.1], [-26.6, -37.2], [-28.8, -42]] },
      sleep: { R: [[-51, 29.8], [-50.1, 27.3], [-49.2, 25.7], [-47.4, 24.6], [-46.3, 25], [-45.9, 26.6], [-48.1, 33.3], [-49.2, 33.7], [-50.3, 33.3], [-51, 31.7]] },
      think: { R: [[-50.6, 28.9], [-48.8, 24.5], [-47.9, 23.1], [-46.3, 22.3], [-45.2, 22.7], [-44.8, 24.2], [-48, 32.3], [-49.1, 32.7], [-50.2, 32.3], [-50.6, 31.2]] },
      wave: { L: [[-28.8, -45.2], [-28, -47.7], [-25.8, -47.7], [-23.9, -45.9], [-21.2, -40.1], [-20.3, -36.9], [-20.7, -32.1], [-22.9, -32.1], [-26.6, -37.2], [-28.8, -42]] },
    },
  },
}

/** Nøgleposernes lommer i skyggetone, kun i stillbilleder (se `withKeyWebs` i shared/equine.tsx). */
const KEY_WEBS: WebTable = {
  foal: {
    1: {
      idle: { L: [[-48.7, -76.9], [-47.2, -76.5], [-46.8, -75.7], [-46.5, -73.1], [-47.6, -71.9], [-49.1, -71.9], [-50.3, -73.1], [-49.9, -75.7]] },
      happy: { L: [[-48.7, -76.9], [-47.2, -76.5], [-46.8, -75.7], [-46.8, -73.4], [-48, -72.3], [-49.1, -72.3], [-50.3, -73.4], [-50.3, -75]] },
      cheer: { L: [[-50.8, -72.5], [-49.3, -72.1], [-48.6, -70.2], [-48.7, -69.1], [-49.9, -68], [-51.4, -68.1], [-52.5, -69.2], [-52, -71.4]] },
      think: { L: [[-42.3, -82.6], [-40.8, -82.2], [-40.4, -81.4], [-40.4, -79.1], [-41.5, -78], [-43, -78], [-44.2, -79.1], [-43, -82.2]] },
      oops: { L: [[-53.7, -67.4], [-52.5, -67.4], [-51.4, -66.2], [-51.4, -64.7], [-52.5, -63.6], [-53.7, -63.6], [-54.8, -64.7], [-54.8, -66.2]] },
      sleep: { L: [[-43.4, -80.7], [-42.3, -80.7], [-41.1, -79.5], [-41.1, -77.6], [-42.3, -76.4], [-43.8, -76.4], [-44.9, -77.6], [-44.9, -78.7]] },
      wave: { L: [[-53.7, -67.4], [-52.5, -67.4], [-51.4, -66.2], [-51.4, -64.7], [-52.5, -63.6], [-53.7, -63.6], [-54.8, -64.7], [-54.8, -66.2]], R: [[-22.1, -33.2], [-23.7, -32.8], [-24, -32], [-24, -29.4], [-22.9, -24.8], [-19.9, -21], [-16.8, -20.3], [-10.7, -25.2], [-10.4, -27.1], [-10.7, -27.8], [-16.4, -29.7]] },
    },
    2: {
      wave: { R: [[-21.6, -50.5], [-23.5, -50.3], [-24.1, -47.8], [-24.1, -42.8], [-24.6, -41.9], [-24.9, -40], [-24.9, -33.6], [-24.4, -29.4], [-23.2, -25], [-21.9, -22.5], [-19.6, -20.5], [-18, -19.7], [-16.9, -19.7], [-9.9, -25.8], [-7.1, -27.5], [-6.9, -28.6], [-7.4, -29.4], [-14.1, -32.8], [-18.8, -37.2], [-19.9, -38.9], [-21.3, -43], [-21.6, -45.8], [-20.7, -49.7]] },
    },
  },
  wavy: {
    1: {
      idle: { L: [[[-23, -11.4], [-21.5, -11], [-21.1, -9.1], [-26.1, 0.8], [-29.5, 14.5], [-35.9, 16.8], [-37.5, 16.4], [-37.8, 13.3], [-35.9, 10.3], [-32.1, -0.7]], [[-23, -11.4], [-21.5, -11], [-21.1, -10.2], [-21.5, -8.3], [-22.6, -7.6], [-24.2, -7.9], [-24.5, -8.7], [-24.2, -10.6]], [[-43.2, 6.5], [-41.6, 6.9], [-41.3, 7.6], [-41.3, 9.2], [-42.4, 10.3], [-43.5, 10.3], [-44.7, 9.2], [-43.9, 6.9]]] },
      happy: { L: [[-23, -11.4], [-21.5, -11], [-21.1, -9.1], [-26.1, 0.8], [-29.5, 14.5], [-35.9, 16.8], [-37.5, 16.4], [-37.8, 13.3], [-35.9, 10.3], [-32.1, -0.7]] },
      cheer: { R: [[-38.2, -68.3], [-39.7, -67.9], [-40, -67.1], [-40, -65.6], [-38.8, -64.6], [-37.7, -64.6], [-36.6, -65.8], [-37.4, -68]] },
      think: { L: [[[-16.6, -21.2], [-13.9, -20.8], [-13.5, -19.3], [-15.8, -16.3], [-17.3, -15.9], [-18.8, -17.1], [-19.2, -18.6]], [[-47.3, 0.8], [-45.8, 1.2], [-45.4, 1.9], [-45.4, 3.5], [-46.6, 4.6], [-47.7, 4.6], [-48.9, 3.5], [-48.1, 1.2]]] },
      oops: { R: [[-45.8, 45.6], [-47.3, 46], [-48.1, 47.2], [-48.1, 48.3], [-47, 49.4], [-45.8, 49.4], [-44.7, 48.3], [-44.7, 46.8]] },
      sleep: { L: [[-21.5, -13.9], [-20, -13.5], [-19.6, -11.5], [-21.9, -7.6], [-23.4, -7.2], [-24.9, -8.4], [-25.3, -9.9]] },
      wave: { R: [[[-34.8, -71.4], [-36.7, -71], [-43.2, -56.9], [-44.3, -54.3], [-44.3, -53.1], [-43.2, -52], [-37.5, -53.9], [-30.6, -53.9], [-29.5, -55], [-31, -64.2], [-34, -71]], [[-43.5, -53.1], [-45.1, -52.8], [-45.8, -51.2], [-45.4, -49.7], [-44.7, -49.3], [-43.5, -49.3], [-42.4, -50.5], [-42.4, -52]], [[-45.8, 45.6], [-47.3, 46], [-48.1, 47.2], [-48.1, 48.3], [-47, 49.4], [-45.8, 49.4], [-44.7, 48.3], [-44.7, 46.8]]] },
    },
    2: {
      think: { L: [[-21, -13], [-19.6, -12.7], [-19.3, -11.6], [-20.7, -9.1], [-21.8, -8.8], [-22.9, -9.6], [-23.2, -10.8]] },
      sleep: { L: [[-24.3, -6.9], [-23.2, -6.6], [-22.9, -5.2], [-24.6, -2], [-26.3, 2.9], [-27.1, 3.5], [-28.2, 3.5], [-28.8, 3.2], [-29, 1.7], [-25.4, -6]] },
      wave: { R: [[-24.9, -61.9], [-26.2, -61.3], [-29, -55.2], [-29, -54.1], [-28.2, -53.3], [-26.8, -53.3], [-24.9, -52.4], [-23.7, -51], [-23.7, -48.3], [-24.3, -46.3], [-24, -42.7], [-24.9, -41.3], [-24.9, -33.3], [-23.5, -25.5], [-21.8, -22.4], [-19.9, -20.8], [-16.8, -19.1], [-13.7, -18.5], [-10.1, -21.6], [-9.9, -22.7], [-10.4, -23.5], [-12.9, -24.6], [-15.7, -26.6], [-19.3, -30.2], [-21.2, -33.8], [-22.1, -38.8], [-20.4, -46], [-20.7, -51.3], [-21.8, -56.3], [-24.3, -61.6]] },
    },
    3: {
      idle: { L: [[-24.2, -53.4], [-23, -53.2], [-21.6, -50.9], [-19.6, -45.6], [-18.9, -41.9], [-18.9, -38.9], [-19.1, -37.2], [-19.8, -36.5], [-20.9, -37], [-22.3, -39.3], [-24.2, -42.8], [-25.6, -46.5], [-25.6, -50.2], [-24.9, -52.7]] },
      happy: { L: [[-24.2, -53.4], [-23, -53.2], [-21.6, -50.9], [-19.6, -45.6], [-18.9, -41.9], [-18.9, -38.9], [-19.1, -37.2], [-19.8, -36.5], [-20.9, -37], [-22.3, -39.3], [-24.2, -42.8], [-25.6, -46.5], [-25.6, -50.2], [-24.9, -52.7]] },
      think: { L: [[[-20, -56.4], [-19.1, -56.2], [-17.5, -52.7], [-16.6, -48.1], [-16.6, -42.1], [-17, -40.5], [-17.9, -39.3], [-18.9, -39.6], [-19.8, -41.4], [-21.6, -46.5], [-22.3, -49.5], [-22.1, -52.5], [-20.7, -56]], [[-28.4, 4.7], [-27.4, 4.9], [-27.2, 5.4], [-27.7, 8.4], [-28.1, 9.3], [-29.7, 9.5], [-30.2, 9.3], [-30.4, 8.4], [-28.8, 4.9]]] },
      sleep: { L: [[-20.7, -56.3], [-19.6, -56], [-18.9, -54.6], [-17.9, -52.4], [-17, -48.1], [-16.8, -42.1], [-17.5, -39.3], [-18.2, -38.5], [-19.1, -38.8], [-20.3, -41.2], [-22.1, -46.2], [-22.8, -49.6], [-22.6, -52.4], [-21.4, -55.6]] },
      wave: { R: [[-24.9, -71.7], [-26, -71.3], [-26.7, -68.7], [-26.7, -65], [-26, -57.8], [-26.5, -53.4], [-24, -51.4], [-23.7, -50.4], [-24.4, -46.3], [-24.2, -42.6], [-24.9, -41.6], [-25.1, -36.8], [-24.9, -32.6], [-24, -26.8], [-22.6, -23.3], [-20.3, -20.8], [-17, -18.9], [-13.8, -18.3], [-9.1, -22.2], [-8.4, -23.6], [-9.1, -24.5], [-12.8, -26.8], [-15.6, -29.6], [-17.2, -32.4], [-18.2, -37.2], [-16.8, -43], [-16.8, -47], [-17.2, -50.2], [-17.9, -53], [-21.6, -61.1], [-23.5, -67.1], [-24.2, -71]] },
    },
  },
  starhorn: {
    1: {
      idle: { R: [[-40.5, -29.2], [-42, -28.8], [-42.4, -28.1], [-42.4, -26.5], [-41.3, -25.4], [-40.1, -25.4], [-39, -26.5], [-39.7, -28.8]] },
      cheer: { R: [[[-32, -34.6], [-33.6, -34.2], [-33.9, -33.4], [-33.9, -31.9], [-32.7, -30.8], [-31.5, -30.9], [-30.4, -32], [-31.3, -34.3]], [[-40.3, -31.7], [-41.8, -31.3], [-42.5, -29.8], [-42.1, -28.3], [-41.3, -27.9], [-40.2, -28], [-39.1, -29.1], [-39.1, -30.6]]] },
      think: { R: [[-40.1, -19.3], [-41.6, -18.9], [-42, -18.2], [-42, -16.7], [-40.9, -15.5], [-39.7, -15.5], [-38.6, -16.7], [-39.4, -18.9]] },
      oops: { R: [[-45.8, 45.6], [-47.3, 46], [-48.1, 47.5], [-47.7, 49.1], [-47, 49.4], [-45.8, 49.4], [-44.7, 48.3], [-44.7, 46.8]] },
      sleep: { R: [[-40.1, -17.8], [-41.6, -17.4], [-42.4, -15.8], [-42, -14.3], [-41.3, -13.9], [-39.7, -13.9], [-38.6, -15], [-39.4, -17.4]] },
      wave: { R: [[-45.8, 45.6], [-47.3, 46], [-48.1, 47.5], [-47.7, 49.1], [-47, 49.4], [-45.8, 49.4], [-44.7, 48.3], [-44.7, 46.8]] },
    },
    2: {
      wave: { R: [[-22.1, -34.6], [-23.2, -34.4], [-24.3, -31.9], [-24.3, -29.1], [-22.9, -24.1], [-21.8, -22.4], [-19, -20.2], [-14.9, -18.5], [-13.2, -18.8], [-10.1, -21.6], [-10.1, -23.3], [-15.7, -26.6], [-19.3, -30.2], [-21.2, -34.1]] },
    },
    3: {
      think: { R: [[-30.4, -50.9], [-31.4, -50.7], [-31.6, -50.2], [-31.6, -48.6], [-30.4, -42.6], [-28.8, -35.8], [-24.9, -25.7], [-23.5, -21], [-23.3, -13.6], [-24.2, -6.2], [-24, -5.8], [-23, -5.5], [-22.6, -5.8], [-18.9, -12], [-13.5, -18.3], [-13.3, -19.4], [-13.8, -20.1], [-15.2, -20.8], [-17.2, -22.7], [-19.3, -25.7], [-20.5, -29.4], [-20.5, -34.5], [-21.9, -38.9], [-24.4, -43.7], [-28.8, -48.8], [-29.7, -50.4]] },
      sleep: { R: [[-30, -52], [-30.9, -51.7], [-31.1, -51.2], [-31.1, -49.3], [-29.7, -41.4], [-28.4, -35.4], [-24.7, -25.1], [-23.5, -20.5], [-23.5, -12.6], [-24.4, -5.7], [-24.2, -5.2], [-23.3, -4.9], [-22.8, -5.2], [-19.1, -11.7], [-13.8, -18.1], [-13.5, -19.1], [-14, -19.8], [-15.4, -20.5], [-18.4, -23.9], [-20.3, -28.5], [-20.3, -34.2], [-21.9, -40], [-24.2, -44.5]] },
      wave: { R: [[-22.3, -62.2], [-23.3, -62], [-23.7, -60.6], [-24.2, -54.6], [-24.2, -51.6], [-23.7, -50.4], [-24.2, -47.7], [-24.2, -44.4], [-23, -33.1], [-24, -26.8], [-22.6, -23.3], [-20.3, -20.8], [-17, -18.9], [-13.8, -18.3], [-9.1, -22.2], [-8.4, -23.6], [-9.1, -24.5], [-12.8, -26.8], [-15.6, -29.6], [-17.2, -32.4], [-18.2, -37.2], [-16.8, -43], [-16.8, -47], [-17.2, -50.2], [-17.9, -53], [-20.9, -59.2], [-21.6, -61.5]] },
    },
  },
}

/** Sprækker, der kun lukker sig i enkelte farver (se `CwWebs` i shared/equine.tsx). */
const CW_WEBS: CwWebs = {
  'wavy 3 idle R': [{ cw: ['c2'], webs: [[[-30.2, -67.8], [-31.1, -67.6], [-31.6, -66.4], [-31.6, -62.7], [-30, -53.9], [-29.5, -53.2], [-28.4, -53], [-27.7, -53.7], [-27.7, -56.4], [-26.5, -57.6], [-26.3, -59], [-28.1, -62.7], [-29.5, -67.1]]] }, { cw: ['c1'], webs: [[[-30.3, -66.9], [-31.5, -65.4], [-30.7, -64.2], [-29.1, -65]]] }],
  'foal 3 idle L': [{ cw: ['c1'], webs: [[[-27, -67.3], [-25.7, -65.4], [-26.6, -64], [-28, -65], [-28, -66.3]]] }],
  'foal 3 happy L': [{ cw: ['c1'], webs: [[[-27, -67.3], [-25.7, -65.4], [-26.6, -64], [-28, -65], [-28, -66.3]]] }],
  'wavy 2 think L': [{ cw: ['c4'], webs: [[[-22.8, -10.6], [-21.7, -8.4], [-23.9, -7.3], [-25, -8.4]]] }],
  'wavy 3 happy R': [{ cw: ['c1'], webs: [[[-30.3, -66.9], [-31.5, -65.4], [-30.7, -64.2], [-29.1, -65]]] }],
  'wavy 3 think R': [{ cw: ['c4'], webs: [[[-35.4, -58.9], [-36.3, -58], [-36.3, -56.6], [-35, -55.6], [-34, -57]]] }],
  'wavy 3 sleep R': [{ cw: ['c4'], webs: [[[-35, -60.2], [-35.9, -59.3], [-35.9, -57.8], [-34.5, -56.9], [-33.6, -58.3]]] }],
}

/**
 * Lommerne, som huller-arkets alfa-lint fandt (review G2-r2 §3.1 og §6, Enhjørning): bølgemankens hårfine sprækker
 * mellem manens lokker og kroppen i tænker (fliserne 1028, 1048 og 1068), lommen mellem højre lok og kinden på stor og
 * lommen mellem den løftede hov og kinden hos det store føl i jubel. Alle farver får samme fyld (alfaen afhænger
 * ikke af konturens farve).
 */
const KEY_WEBS_G2R2 = addWebs(
  KEY_WEBS,
  `foal 3 cheer R: -25.3 -58.1 -24.3 -59.1 -20.8 -59.2 -19.4 -57.8 -18.7 -56.2 -17.6 -51.5 -17.6 -49.5 -19.1 -48.6 -20.6 -50.3 -25.2 -56.7
wavy 1 think L: -25.3 -12.2 -24.7 -13.6 -22.5 -15.8 -20.1 -17.8 -17.8 -17.4 -17.7 -15.4 -18.2 -14 -22 -8.9 -24.3 -8.8 -25.3 -9.8
wavy 2 think L: -29.3 -0.9 -27.5 -5.3 -25.4 -8.7 -23.4 -10.2 -21.5 -9.7 -21.5 -8.1 -26.1 2.1 -27.3 2.9 -28.8 2.8 -29.3 1.9
wavy 3 happy R: -31.7 -65.1 -31.3 -67.1 -29.6 -67.1 -26.2 -59 -26.2 -57.4 -27.8 -53.4 -29.2 -53 -29.8 -54 -30.6 -56.8 -31.7 -62.8
wavy 3 idle R: -31.7 -65.1 -31.3 -67.1 -29.6 -67.1 -26.2 -59 -26.2 -57.4 -27.8 -53.4 -29.2 -53 -29.8 -54 -30.6 -56.8 -31.7 -62.8
wavy 3 oops R: -26.8 -68.9 -26.1 -71.2 -25.3 -71.7 -24.4 -71.2 -22 -62.8 -22.1 -60.7 -24.1 -57.1 -25.5 -56.8 -26.3 -58.2 -26.8 -64.6; -63.6 40.7 -63.1 39.8 -61.8 39.7 -60.9 40.2 -60.8 40.7 -60.8 41.9 -61.3 42.8 -62.6 42.9 -63.5 42.4 -63.6 41.9
wavy 3 sleep R: -36.1 -60 -35.6 -60.9 -34.2 -60.5 -29.9 -52.7 -29.7 -52.2 -29.7 -44.8 -30.2 -43.9 -32.5 -44.3 -34.8 -52 -36.1 -56.8
wavy 3 think L: -33.1 11.3 -30.7 8.6 -28.7 8.5 -27.8 9 -27.7 9.8 -28.5 12.9 -29.4 13.4 -32.2 13.4 -33.1 12.9 -33.2 12.4
wavy 3 think R: -36.6 -58.5 -36.1 -59.3 -34.8 -59 -30.4 -51.8 -30 -44 -30.5 -43.2 -32.4 -43.2 -33.1 -44.1 -36 -53.1 -36.6 -55.6`,
)

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
        Horn: makeHorn(34, 6.6),
        HeadDeco: StarhornDeco,
        ManeBack: hairShape(STAR_MANE, { stripe: STAR_MANE_STRIPE }),
        ManeFront: hairShape(STAR_FORELOCK),
        Tail: hairShape(STAR_TAIL),
      },
      maneGrowth: 1.15,
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
    PawBack: withKeyWebs(pawWebs({}, PAW_WEBS), KEY_WEBS_G2R2, CW_WEBS),
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
