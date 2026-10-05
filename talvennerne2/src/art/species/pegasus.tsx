// Pegasussen (Stjernefjeldet, bølge 3): en bevinget pony på skabelonen `tall`, én race (std). Hoved, ører, ben,
// hove og mule deles med hesten (shared/equine.tsx); artstrækkene står i silhuetten, så pegasussen aldrig læses som
// en hest eller en enhjørning (blindtestene G2-r3 og G2-r4 nævnte langmankede heste som mulige pegasusser):
// - to store, fjerede vinger, der rejser sig skråt op og ud bag skuldrene, med fire runde fjerspidser langs ydersiden
//   og et lag dækfjer foroven; de rager ud på begge sider af hovedet i alle stadier (føllets vinger er større, så de
//   også står frem ved siden af det store babyhoved),
// - en kort, opsvunget manke over issen og bag højre øre og en pandelok, der holder siderne fri til vingerne,
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
// Vingerne (lokalt om ankeret `back`; venstre vinge, højre spejles): en vifte af svingfjer med fire runde spidser
// langs ydersiden og et lag dækfjer foroven langs forkanten. Begge vinger er ét path pr. lag.

/**
 * Svingfjerene: forkanten fra roden ud og op til vingespidsen, den yderste svingfjer ned langs ydersiden og så fire
 * fjerspidser, der peger nedad, trappevis ind mod kroppen (bagkanten). Fjerene peger alle samme vej, så vingen aldrig
 * læses som en manke eller en sky om hovedet.
 */
const FAN: Vec[] = [
  [-12, 7], [-6, -11], [-15, -21], [-28, -32], [-42, -44], [-55, -57], [-63, -69], [-67, -77], [-71, -73], [-73, -62],
  [-74, -48], [-72, -37], [-67, -35], [-62, -40], [-61, -30], [-59, -21], [-54, -19], [-50, -26], [-48, -15], [-45, -7],
  [-40, -6], [-37, -14], [-34, -4], [-30, 3], [-24, 3], [-21, -3], [-18, 5],
]
/** Dækfjerene: forkanten (samme punkter som svingfjerene) og en underkant med fire små fjerspidser. */
const COVERT: Vec[] = [
  [-4, -2], [-6, -11], [-15, -21], [-28, -32], [-42, -44], [-55, -57], [-63, -69], [-67, -77], [-69, -70], [-66, -60],
  [-62, -54], [-60, -46], [-54, -45], [-50, -38], [-44, -37], [-40, -29], [-33, -28], [-29, -20], [-22, -19], [-17, -11],
  [-10, -8],
]
/** Skillelinjerne mellem svingfjerene (fra dækfjerene ned til hakkerne). */
const QUILLS: Vec[][] = [
  [[-66, -55], [-65, -46], [-62, -40]],
  [[-54, -40], [-51, -32], [-50, -26]],
  [[-41, -27], [-38, -20], [-37, -14]],
  [[-27, -17], [-23, -9], [-21, -3]],
]
const FAN_D = join(blob(FAN, 0.86), blob(mirrorX(FAN), 0.86))
const COVERT_D = join(blob(COVERT, 0.86), blob(mirrorX(COVERT), 0.86))
const QUILLS_D = join(...QUILLS.flatMap((q) => [spline(q), spline(mirrorX(q))]))
/** Føllets vinger er større i forhold til kroppen, så de står frem ved siden af det store babyhoved. */
const WING_STAGE: Record<Stage, number> = { 1: 1.3, 2: 1, 3: 1 }

const Wings: Part = ({ pal, sw, stage, still, ids, lod }) => {
  const k = WING_STAGE[stage]
  const s = sw / k
  // Svingfjerene: regnbuens fire striber, ellers fjertonen (en lys tone af manken).
  const feather = pal.gradient ? `url(#${ids.gradient})` : (pal.mane2 ?? mixHex(pal.fur, pal.mane, 0.45))
  return (
    <g className={still ? undefined : 'a-flap'} transform={k !== 1 ? `scale(${k})` : undefined}>
      <path d={FAN_D} fill={feather} stroke={pal.outline} strokeWidth={s} {...round} />
      {lod === 'full' && !pal.silhouette && <path d={QUILLS_D} fill="none" stroke={pal.outline} strokeOpacity={0.4} strokeWidth={s * 0.5} {...round} />}
      <path d={COVERT_D} fill={pal.fur} stroke={pal.outline} strokeWidth={s} {...round} />
    </g>
  )
}

// ---------------------------------------------------------------------------------------------
// Hår (modelrum for standardhovedet i (100, 86); halen lokalt om tailBase).

/** Manken: en kort, opsvunget kam over issen, der falder bag højre øre ned til kinden, og en lille tot bag venstre øre. */
const MANE: Vec[][] = [
  [
    [101, 52], [98, 41], [105, 33], [117, 31], [130, 35], [142, 43], [151, 55], [156, 69], [157, 84], [152, 79], [150, 92],
    [145, 85], [140, 96], [137, 83], [131, 70], [121, 60], [110, 55],
  ],
  [[97, 42], [86, 38], [74, 41], [65, 48], [60, 58], [66, 55], [70, 60], [74, 53], [84, 48], [95, 48]],
]
const MANE_STRANDS: Vec[][] = [[[108, 40], [124, 41], [138, 50], [147, 63], [150, 76]]]
/** Pandelokken: tre lokker, der fejer mod højre og standser over øjnene. */
const FORELOCK: Vec[] = [
  [101, 37], [92, 39], [86, 45], [85, 53], [89, 60], [92, 53], [96, 62], [101, 55], [107, 66], [110, 57], [117, 62], [118, 53],
  [114, 44], [108, 39],
]
const FORELOCK_STRANDS: Vec[][] = [[[98, 43], [97, 51], [99, 57]], [[107, 44], [109, 52], [111, 58]]]
/** Halen (lokalt om tailBase): en fyldig lok, der buer ud over låret og falder ned langs siden med to spidser. */
const TAIL: Vec[] = [
  [-4, -2], [2, -11], [12, -16], [22, -14], [29, -6], [32, 5], [31, 15], [33, 24], [29, 30], [26, 23], [22, 28], [19, 20],
  [18, 11], [16, 2], [11, -5], [4, -5],
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
  breeds: [{ id: 'std', name: 'pegasus' }],
  colorways: PEGASUS_COLORWAYS,
  magic: ['gold', 'rainbow'],
  occupies: ['back'],
  anchors: EQUINE_ANCHORS,
  bounds: {
    head: { x0: 34, y0: 14, x1: 166, y1: 160 },
    body: { x0: 24, y0: 64, x1: 176, y1: 228 },
  },
  maneOrigin: 'headTop',
  // Tankebobler og Zzz (fælles regel): i fri luft til højre for hovedet, mindst 8 enheder fra manke og øre.
  fx: { x: 176, y: 70 },
  face: { idleMouth: 'smile', cheeks: true },
  ears: { splay: 16 },
  signature: 'wing-flap',
  // Forbenene står på jorden: glad løfter dem let ud (se `HappyLeg`); ups løfter en hov genert op ved mulen.
  poses: {
    happy: { pawL: { up: true, behind: true, rot: 30 }, pawR: { up: true, behind: true, rot: 30 }, tail: 3 },
    cheer: { tail: 3 },
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
