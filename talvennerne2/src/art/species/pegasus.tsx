// Pegasussen (Stjernefjeldet, bølge 3): en bevinget pony på skabelonen `tall`, én race (std). Hoved, ører, ben,
// hove og mule deles med hesten (shared/equine.tsx); artstrækkene står i silhuetten, så pegasussen aldrig læses som
// en hest eller en enhjørning (blindtestene G2-r3 og G2-r4 nævnte langmankede heste som mulige pegasusser):
// - to store, fjerede vinger, der står som et V bag hovedet: spidsen ved siden af issen, seks fjerspidser, der peger
//   nedad og udad langs bagkanten, og et lag dækfjer langs forkanten; de rager ud på begge sider af hovedet i alle
//   stadier (føllets vinger er større, så de også står frem ved siden af det store babyhoved),
// - en kort, opsvunget manke over issen og en pandelok, der holder siderne fri til vingerne,
// - intet horn.
// Vingerne tegnes om ankeret `back` (lag 3, bag kroppen) og optager ryg-slottet (`occupies: ['back']`). Signaturen er
// vinge-blafren: vingerne slår tre slag op og ud, overshooter og falder til ro (`a-flap` i rig.css, kun i hvile);
// `a-wings` (riggens gruppe) bærer humørenes vingeslag. Alle former er punkter og husets primitiver.
import { OpenLimb, limbLoop, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { mixHex } from '../rig/oklch'
import { blob, join, mirrorX, spline, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { Part, SidePart, SpeciesDef, Stage, UpArm } from '../rig/types'
import { PEGASUS_COLORWAYS } from './pegasus.colorways'
import {
  EQUINE_ANCHORS, EQUINE_LIMB, EQUINE_UP_ARMS, EQUINE_UP_TIP, EquineEar, EquineLegUp, hairShape, hoof, hoofColor, hoofLine, horseHead,
  makeFeet, makeLeg, makeMuzzle, round, withKeyWebs,
} from './shared/equine'
import type { WebTable } from './shared/equine'

// ---------------------------------------------------------------------------------------------
// Vingerne (lokalt om ankeret `back`; venstre vinge, højre spejles): en vifte af svingfjer med seks fjerspidser langs
// bagkanten og et lag dækfjer langs forkanten. Begge vinger er ét path pr. lag.

/**
 * Svingfjerene: forkanten går fra roden op bag hovedet og kommer frem ved siden af øjnene, i en tydelig vinkel mod
 * hovedets kontur, og buer videre op til vingespidsen ved siden af issen. Bagkanten løber skråt ned mod kroppen med seks
 * fjerspidser, der alle peger nedad og udad, så vingen står som et V på hver side. Vingen dækker hele området ved kinden
 * og kæben, så der aldrig opstår en lomme mellem kind og vinge, når hovedet vipper, og fjerene peger samme vej, så
 * vingen aldrig læses som en manke eller en sky om hovedet.
 */
const FAN: Vec[] = [
  [-12, 7], [-6, -11], [-10, -32], [-18, -52], [-30, -68], [-42, -78], [-52, -85], [-60, -91], [-65.5, -95], [-69.5, -97],
  [-71, -92], [-71, -83], [-70.5, -73.5], [-70, -64], [-64, -66.5], [-66.5, -58], [-66, -50], [-59, -53.5], [-61, -44],
  [-60, -36], [-53, -40.5], [-54, -31], [-52, -22], [-45, -27.5], [-45.5, -18], [-42, -10], [-35, -15.5], [-34, -6], [-30, 0],
  [-24, -5], [-21, 2], [-18, 6],
]
/** Dækfjerene: forkanten (samme punkter som svingfjerene) og en underkant med små fjerspidser, der peger nedad. */
const COVERT: Vec[] = [
  [-4, -2], [-6, -11], [-10, -32], [-18, -52], [-30, -68], [-42, -78], [-52, -85], [-60, -91], [-65.5, -95], [-69.5, -97],
  [-69, -89], [-66, -84], [-62, -85], [-58, -78], [-53, -79], [-48, -71], [-42, -71], [-37, -62], [-31, -61.5], [-26, -51],
  [-20, -49.5], [-16, -36], [-11, -33], [-8, -18],
]
/** Skillelinjerne mellem svingfjerene (fra dækfjerene ned til hakkerne). */
const QUILLS: Vec[][] = [
  [[-62, -81], [-64, -74], [-64, -66.5]],
  [[-54, -76], [-57.5, -64], [-59, -53.5]],
  [[-44, -68], [-50, -54], [-53, -40.5]],
  [[-33, -58], [-41, -42], [-45, -27.5]],
  [[-22, -46], [-30, -30], [-35, -15.5]],
  [[-13, -30], [-20, -17], [-24, -5]],
]
/**
 * Føllets vinger er større i forhold til kroppen, så de står frem ved siden af det store babyhoved. På stor vokser
 * vingerne 1,2 i riggen; her dæmpes væksten til ca. 1,1, så spidserne bliver i den sikre zone, også når jubel vipper
 * figuren 2° (som stjernehornets `hornGrowth`). Skalaen er bagt ind i stierne: signaturgruppen (`a-flap`) animeres med
 * CSS-transform, som ellers ville erstatte en transform-attribut på samme gruppe.
 */
const WING_STAGE: Record<Stage, number> = { 1: 1.3, 2: 1, 3: 0.92 }
const wingPaths = (k: number) => {
  const sc = (pts: readonly Vec[]) => xf(pts, { sx: k })
  return {
    fan: join(blob(sc(FAN), 0.86), blob(mirrorX(sc(FAN)), 0.86)),
    covert: join(blob(sc(COVERT), 0.86), blob(mirrorX(sc(COVERT)), 0.86)),
    quills: join(...QUILLS.map(sc).flatMap((q) => [spline(q), spline(mirrorX(q))])),
  }
}
const WING_D: Record<Stage, ReturnType<typeof wingPaths>> = { 1: wingPaths(WING_STAGE[1]), 2: wingPaths(WING_STAGE[2]), 3: wingPaths(WING_STAGE[3]) }

const Wings: Part = ({ pal, sw, stage, still, ids, lod }) => {
  const d = WING_D[stage]
  // Svingfjerene: regnbuens fire striber, ellers fjertonen (en lys tone af manken).
  const feather = pal.gradient ? `url(#${ids.gradient})` : (pal.mane2 ?? mixHex(pal.fur, pal.mane, 0.45))
  return (
    <g className={still ? undefined : 'a-flap'}>
      <path d={d.fan} fill={feather} stroke={pal.outline} strokeWidth={sw} {...round} />
      {lod === 'full' && !pal.silhouette && <path d={d.quills} fill="none" stroke={pal.outline} strokeOpacity={0.4} strokeWidth={sw * 0.5} {...round} />}
      <path d={d.covert} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
    </g>
  )
}

// ---------------------------------------------------------------------------------------------
// Hår (modelrum for standardhovedet i (100, 86); halen lokalt om tailBase).

/** Manken: en kort, opsvunget kam over issen, der falder bag højre øre (over vingens forkant), og en lille tot bag venstre øre. */
const MANE: Vec[][] = [
  [
    [101, 52], [98, 41], [105, 33], [117, 31], [129, 35], [137.5, 40], [142, 46], [144.5, 52], [143, 56], [141, 54],
    [138, 58], [135, 54.5], [131.5, 57.5], [127.5, 53], [120, 51.5], [112, 52],
  ],
  [[97, 42], [86, 38], [74, 41], [65, 48], [60, 58], [66, 55], [70, 60], [74, 53], [84, 48], [95, 48]],
]
const MANE_STRANDS: Vec[][] = [[[108, 40], [121, 38.5], [131, 42], [137.5, 47], [140.5, 52]]]
/** Pandelokken: tre lokker, der fejer mod højre og standser over øjnene. */
const FORELOCK: Vec[] = [
  [101, 37], [92, 39], [86, 45], [85, 53], [89, 60], [92, 53], [96, 62], [101, 55], [107, 66], [110, 57], [117, 62], [118, 53],
  [114, 44], [108, 39],
]
const FORELOCK_STRANDS: Vec[][] = [[[98, 43], [97, 51], [99, 57]], [[107, 44], [109, 52], [111, 58]]]
/** Halen (lokalt om tailBase): en fyldig lok, der buer ud over låret og falder ned langs siden med to spidser (den inderste
 * holder afstand til baghoven, så der ikke lukker sig en sprække mellem hale og hov). */
const TAIL: Vec[] = [
  [-4, -2], [2, -11], [12, -16], [22, -14], [29, -6], [32, 5], [31, 15], [33, 24], [29, 30], [26.5, 24], [25, 26], [21.5, 18],
  [19.5, 10], [14, 5], [9, 0], [2, 0],
]
const TAIL_STRANDS: Vec[][] = [[[6, -10], [16, -11], [23, -5], [26, 6], [27, 17]]]
/** Føllets hale er større (som hestens), så den står frem ved siden af den lille krop. */
const FOAL_TAIL = 1.3
const tailPart = hairShape(TAIL, { strands: TAIL_STRANDS })
const Tail: Part = (p) =>
  p.stage === 1 ? <g transform={`scale(${FOAL_TAIL})`}>{tailPart({ ...p, sw: p.sw / FOAL_TAIL })}</g> : tailPart(p)

// ---------------------------------------------------------------------------------------------
// Ben: hestens forben og løftede forben. Glad løfter forbenene let ud til siden: benet er tegnet drejet −22°, så
// glad-hoppets 30° (rig.css) stiller det 8° ud, og hovene sparker ud i hoppet.

const LEG_SPINE: Vec[] = [[0, -6], [0.2, 9], [0.4, 24], [0.6, 38], [0.8, 46]]
const HAPPY_ROT = -22
const HAPPY_SPINE = xf(LEG_SPINE, { rot: HAPPY_ROT })
const HAPPY_LOOP = limbLoop(HAPPY_SPINE, 15.5, 14.5, 6)
const HAPPY_TIP = HAPPY_SPINE[HAPPY_SPINE.length - 1]
const HappyLeg: SidePart = ({ pal, sw }) => {
  const [x, y] = xf([[0.8, 44]], { rot: HAPPY_ROT })[0]
  return (
    <OpenLimb loop={HAPPY_LOOP} fill={pal.fur} stroke={pal.outline} sw={sw} trim={1}>
      <path d={hoof(x, y, 17.5, 10.6, HAPPY_ROT)} fill={hoofColor(pal)} stroke={hoofLine(pal)} strokeWidth={sw} {...round} />
    </OpenLimb>
  )
}
const LegUp: SidePart = (p) => (p.mood === 'happy' ? <HappyLeg {...p} /> : <EquineLegUp {...p} />)
const HAPPY_ARM: UpArm = { spine: HAPPY_SPINE, w0: 15.5, w1: 14.5, tip: 13 }

// ---------------------------------------------------------------------------------------------

/** Fyld bag alt ved benene (se `pawWebs`): lommernes udvidede hylstre pr. stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {}
/** Nøgleposernes lommer i skyggetone, kun i stillbilleder (se `withKeyWebs` i shared/equine.tsx). */
const KEY_WEBS: WebTable = {}

export const pegasus: SpeciesDef = {
  id: 'pegasus',
  name: 'Pegasus',
  nameClip: 'name.species.pegasus',
  family: 'equine',
  body: 'tall',
  // Manken vokser lidt mindre på stor, så tankebobler og Zzz har plads ved siden af hovedet.
  breeds: [{ id: 'std', name: 'pegasus', maneGrowth: 1.1 }],
  colorways: PEGASUS_COLORWAYS,
  magic: ['gold', 'rainbow'],
  occupies: ['back'],
  // Kinderne sidder en anelse længere inde end hestens, så rosaen aldrig bygger bro til vingen bag hovedet.
  anchors: { ...EQUINE_ANCHORS, cheekL: { x: 65.5, y: 109.5 }, cheekR: { x: 134.5, y: 109.5 } },
  bounds: {
    head: { x0: 34, y0: 14, x1: 166, y1: 160 },
    body: { x0: 24, y0: 64, x1: 176, y1: 228 },
  },
  maneOrigin: 'headTop',
  // Tankebobler og Zzz (fælles regel): i fri luft til højre for hovedet, mindst 8 enheder fra manke og øre.
  fx: { x: 178, y: 64 },
  face: { idleMouth: 'smile', cheeks: true },
  ears: { splay: 16 },
  signature: 'wing-flap',
  // Forbenene står på jorden: glad løfter dem let ud (se `HappyLeg`); ups løfter en hov genert op ved mulen.
  poses: {
    happy: { pawL: { up: true, behind: true, rot: 30 }, pawR: { up: true, behind: true, rot: 30 }, tail: 3 },
    cheer: { tail: 0 },
    think: { tail: -3 },
    oops: { pawL: 0, pawR: { up: true }, tail: 2 },
    sleep: { pawL: 0, pawR: 0 },
    wave: { tail: 2 },
  },
  parts: {
    head: horseHead,
    Ear: EquineEar,
    Paw: makeLeg(),
    PawUp: LegUp,
    PawBack: withKeyWebs(pawWebs({}, PAW_WEBS), KEY_WEBS),
    pawUpTip: { ...EQUINE_UP_TIP, happy: { x: HAPPY_TIP[0], y: HAPPY_TIP[1] } },
    upArms: { ...EQUINE_UP_ARMS, happy: HAPPY_ARM },
    limb: EQUINE_LIMB,
    Feet: makeFeet(),
    Tail,
    Muzzle: makeMuzzle(),
    ManeBack: hairShape(MANE, { strands: MANE_STRANDS }),
    ManeFront: hairShape(FORELOCK, { strands: FORELOCK_STRANDS }),
    Wings,
  },
}

export default pegasus
