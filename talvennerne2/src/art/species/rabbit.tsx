// Kaninen – guldstandarden for stilen (bølge 1). Racen `upright` er færdig; `lop` og `lionhead`
// er skitser. Alle former beskrives med punkter og husets primitiver (ingen path-literaler).
import { Pivot } from '../rig/Rig'
import { blob, ellipse, join, lune, mirrorX, scallop, spline, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { Part, SidePart, SpeciesDef } from '../rig/types'
import { RABBIT_COLORWAYS } from './rabbit.colorways'

const round = { strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

// ---------------------------------------------------------------------------------------------
// Ører (lokalt: basen i (0,0), peger op). Venstre øre tegnes; riggen spejler det højre.

/** Stående øre: langt blad, lidt mere bug på ydersiden, rund spids. */
const UPRIGHT_EAR: Vec[] = [
  [0, 10], [-7.8, 7], [-9.6, -6], [-11.4, -21], [-11, -35], [-8.2, -47], [-4.2, -53.4], [0, -55],
  [4.4, -53.2], [7.9, -47.2], [10.4, -35], [10.6, -21], [9, -6], [7.6, 7],
]
const UPRIGHT_INNER: Vec[] = [
  [0, -2], [-4.6, -8], [-6, -21], [-5.6, -34], [-3.4, -44], [0, -47.5], [3.4, -44.2], [5.4, -34],
  [5.6, -21], [4.4, -8],
]

const earScale = (stage: number) => (stage === 1 ? { sx: 1.08, sy: 0.84 } : stage === 3 ? { sx: 1, sy: 0.97 } : {})

const UprightEar: SidePart = ({ pal, sw, stage, ids }) => {
  const s = earScale(stage)
  const outer = xf(UPRIGHT_EAR, s)
  const inner = xf(UPRIGHT_INNER, s)
  const fill = pal.gradient ? `url(#${ids.gradient})` : pal.inner
  return (
    <>
      <path d={blob(outer)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      <path d={blob(inner)} fill={fill} />
    </>
  )
}

/** Vædderøre (skitse): bredt, hænger ned langs kinden, ligger foran hovedet. */
const LOP_EAR: Vec[] = [
  [2, -6], [-8, -8], [-17, -2], [-21, 12], [-21, 30], [-17, 46], [-10, 54], [-2, 52], [2, 40],
  [3, 22], [5, 6],
]
const LOP_INNER: Vec[] = [[-5, 4], [-12, 8], [-15, 22], [-14, 38], [-9, 47], [-5, 44], [-4, 30], [-3, 16]]

const LopEar: SidePart = ({ pal, sw, stage, ids }) => {
  const s = stage === 1 ? { sx: 1.04, sy: 0.86 } : {}
  const fill = pal.gradient ? `url(#${ids.gradient})` : pal.inner
  return (
    <>
      <path d={blob(xf(LOP_EAR, s))} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      <path d={blob(xf(LOP_INNER, s))} fill={fill} opacity={0.9} />
    </>
  )
}

/** Løvehovedets korte ører (skitse). */
const SHORT_EAR = xf(UPRIGHT_EAR, { sy: 0.68, sx: 1.04 })
const SHORT_INNER = xf(UPRIGHT_INNER, { sy: 0.66, sx: 1.02 })
const ShortEar: SidePart = ({ pal, sw, ids }) => (
  <>
    <path d={blob(SHORT_EAR)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
    <path d={blob(SHORT_INNER)} fill={pal.gradient ? `url(#${ids.gradient})` : pal.inner} />
  </>
)

// ---------------------------------------------------------------------------------------------
// Poter, fødder, hale

/** Venstre forpote fra skulderen: kort og buttet, vinklet ind så poterne hviler på maven. */
const PAW_ROT = -14
const PAW: Vec[] = xf(
  [[-6.4, -4], [-8, 6], [-8.6, 15.5], [-7, 22.5], [-2.2, 26.2], [3.4, 25.8], [7, 21], [7.4, 12], [6, 2], [0, -6.2]],
  { rot: PAW_ROT },
)
const PAW_TOE_LINES: Vec[][] = [
  [[-3, 25.4], [-2.6, 21.6]],
  [[2, 25.6], [1.8, 21.8]],
]
const PAW_TOES = PAW_TOE_LINES.map((t) => xf(t, { rot: PAW_ROT }))

const Paw: SidePart = ({ pal, sw }) => (
  <>
    <path d={blob(PAW)} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
    <path d={join(...PAW_TOES.map((t) => spline(t)))} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />
  </>
)

/** Bagfødderne stikker frem på hver side under kroppen; ydertæerne har tålinjer. */
const FOOT: Vec[] = [[-4, -10], [-17, -9.5], [-23.5, -3.5], [-24, 4.5], [-17.5, 9.6], [-2, 10.2], [11, 7.6], [15, 0], [10, -8]]
const TOES: Vec[][] = [
  [[-19.8, 8.4], [-18.6, 3.8]],
  [[-13.8, 9.9], [-13, 5.2]],
]

const Feet: Part = ({ pal, sw, a }) => {
  const place = (pts: readonly Vec[], side: 'L' | 'R') =>
    side === 'L'
      ? xf(pts, { dx: a.footL.x, dy: a.footL.y, rot: -3 })
      : mirrorX(xf(pts, { dx: 200 - a.footR.x, dy: a.footR.y, rot: -3 }), 100)
  const toes = TOES.flatMap((t) => [spline(place(t, 'L')), spline(place(t, 'R'))])
  return (
    <>
      <path d={join(blob(place(FOOT, 'L')), blob(place(FOOT, 'R')))} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
      <path d={join(...toes)} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />
    </>
  )
}

/** Bomuldshalen: en fnugget kvast, lysere end pelsen. */
const Tail: Part = ({ pal, sw, ids }) => {
  const fill = pal.gradient ? `url(#${ids.gradient})` : pal.belly
  return <path d={scallop(6, -6, 12.5, 11.5, 8, 0.64, -100)} fill={fill} stroke={pal.outline} strokeWidth={sw} {...round} />
}

// ---------------------------------------------------------------------------------------------
// Ansigt: næse (med næse-vip), knurhår, snudepuder

const NOSE: Vec[] = [[0, 3.4], [-3.2, 1.2], [-4.6, -1.6], [-3, -3.2], [0, -3.4], [3, -3.2], [4.6, -1.6], [3.2, 1.2]]

const Muzzle: Part = ({ pal, sw, a, still }) => {
  const m = a.muzzle
  const whisk = (s: number): string =>
    join(
      spline([[m.x + s * 14, m.y + 1], [m.x + s * 23, m.y - 1], [m.x + s * 30, m.y - 0.5]]),
      spline([[m.x + s * 14, m.y + 5], [m.x + s * 23, m.y + 6], [m.x + s * 29, m.y + 8.5]]),
    )
  return (
    <>
      {!pal.silhouette && <path d={join(whisk(-1), whisk(1))} fill="none" stroke={pal.outline} strokeOpacity={0.45} strokeWidth={sw * 0.42} {...round} />}
      <Pivot at={m} cls="a-sig" still={still}>
        <path d={blob(NOSE)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.42} {...round} />
        {!pal.silhouette && <path d={ellipse(-1.3, -1.6, 1.4, 0.9, -15)} fill={pal.highlight} />}
      </Pivot>
    </>
  )
}

/** Lys mave klippet til kroppen. */
const Belly: Part = ({ pal, a, ids }) => {
  const b = a.bodyCenter
  return <path d={ellipse(b.x, b.y + 16, a.bodyRx * 0.6, a.bodyRy * 0.66)} fill={pal.belly} clipPath={`url(#${ids.bodyClip})`} />
}

// ---------------------------------------------------------------------------------------------
// Hollænder-mønster (c4): farvede ører og øjenpletter med en bred hvid blis. Forfra ses den hvide
// forpart, så kroppen forbliver hvid (bagparten er farvet, men vender væk).

const DUTCH_HEAD_L: Vec[] = [
  [52, 70], [66, 59], [80, 61], [88, 73], [91, 91], [90, 108], [84, 119], [72, 121.5], [58, 116], [48, 101], [46, 84],
]

const DutchHead: Part = ({ pal, ids }) => (
  <path d={join(blob(DUTCH_HEAD_L), blob(mirrorX(DUTCH_HEAD_L, 100)))} fill={pal.pattern} clipPath={`url(#${ids.headClip})`} />
)

// ---------------------------------------------------------------------------------------------
// Løvehovedets manke (skitse): fnugget krave bag hovedet.

const LionMane: Part = ({ pal, sw, a, ids }) => {
  const c = a.headCenter
  const fill = pal.gradient ? `url(#${ids.gradient})` : pal.mane
  return (
    <>
      <path d={scallop(c.x, c.y + 14, a.headRx + 14, a.headRy + 8, 14, 0.62, -90)} fill={fill} stroke={pal.maneOutline} strokeWidth={sw} {...round} />
      <path d={lune(c.x, c.y + 14, a.headRx + 10, a.headRy + 4, 7, 20, 160)} fill={pal.shade} opacity={0.6} />
    </>
  )
}

/** Løvehovedets pandetot (skitse). */
const LionTuft: Part = ({ pal, sw, a, ids }) => {
  const t = a.headTop
  const fill = pal.gradient ? `url(#${ids.gradient})` : pal.mane
  return <path d={scallop(t.x, t.y + 4, 17, 9, 7, 0.6, 180)} fill={fill} stroke={pal.maneOutline} strokeWidth={sw} {...round} />
}

// ---------------------------------------------------------------------------------------------

export const rabbit: SpeciesDef = {
  id: 'rabbit',
  name: 'Kanin',
  nameClip: 'species.rabbit',
  family: 'lagomorph',
  body: 'round',
  breeds: [
    { id: 'upright', name: 'stående ører', ears: { splay: 10 } },
    {
      id: 'lop',
      name: 'vædder',
      ears: { splay: 0, clip: false },
      anchors: { earBaseL: { x: 56, y: 70 }, earBaseR: { x: 144, y: 70 } },
      parts: { Ear: LopEar },
    },
    {
      id: 'lionhead',
      name: 'løvehoved',
      ears: { splay: 12 },
      anchors: { earBaseL: { x: 74, y: 56 }, earBaseR: { x: 126, y: 56 } },
      parts: { Ear: ShortEar, ManeBack: LionMane, ManeFront: LionTuft },
    },
  ],
  colorways: RABBIT_COLORWAYS,
  magic: ['gold', 'rainbow'],
  // Kaninen har de længste ører: hovedet sidder lidt lavere og er lidt mindre end standarden.
  anchors: {
    headCenter: { x: 100, y: 101 },
    headRx: 55,
    headRy: 47.5,
    headTop: { x: 100, y: 55.5 },
    headWidth: 102,
    earBaseL: { x: 71, y: 63 },
    earBaseR: { x: 129, y: 63 },
    hornBase: { x: 100, y: 57 },
    eyeL: { x: 78, y: 106 },
    eyeR: { x: 122, y: 106 },
    eyeRx: 10.4,
    eyeRy: 12.9,
    muzzle: { x: 100, y: 123.5 },
    mouth: { x: 100, y: 132 },
    cheekL: { x: 67, y: 123 },
    cheekR: { x: 133, y: 123 },
    neck: { x: 100, y: 148.5 },
    bodyCenter: { x: 100, y: 183 },
    bodyRx: 49,
    bodyRy: 43,
    bodyWidth: 98,
    shoulderL: { x: 82, y: 161 },
    shoulderR: { x: 118, y: 161 },
    pawL: { x: 87, y: 186 },
    pawR: { x: 113, y: 186 },
    footL: { x: 62, y: 216 },
    footR: { x: 138, y: 216 },
    tailBase: { x: 146, y: 204 },
  },
  face: { idleMouth: 'cat-w', buckTeeth: true, cheeks: true },
  ears: { splay: 10 },
  signature: 'nose-wiggle',
  parts: {
    Ear: UprightEar,
    Paw,
    Feet,
    Tail,
    Muzzle,
    BodyDeco: Belly,
    Pattern: { head: DutchHead },
  },
}

export default rabbit
