// Hvalpen (Engdalen, bølge 2): skabelonen `tall`, én race (std) og et af de fire startdyr.
// Artstrækkene står i silhuetten:
// - brede hængeører med bløde, runde spidser, der hænger ud over hovedets sider (aldrig smalle vædderører),
// - en tydelig snude: hovedets kontur buler blødt ud forneden om en lys mule med en stor, blank næse,
// - en logrende hale, der står op bag højre lår og krummer ind mod ryggen.
// Fælles: forben ned til jorden med åben kontur ved brystet, lårbuler, bagpoter og et lyst bryst med en
// pelstot under hagen. Signaturen er logren: halen sidder i sin egen pivot (`a-wag`) og logrer fire gange
// hurtigt med stort udsving, ét overshoot og en pause (rig.css). Alle former er punkter og husets primitiver.
import { OpenLimb, ROUND, limbLoop, padsPath } from '../parts/kit'
import { Pivot } from '../rig/Rig'
import { blob, circle, ellipse, frame, join, mirrorX, offsetLoop, scallop, spline, symmetric, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, OutlineFn, Part, SidePart, SpeciesDef, Stage } from '../rig/types'
import { PUPPY_COLORWAYS } from './puppy.colorways'

const round = ROUND
/** Regnbuen ligger som fire flade striber i ører, hale og krave; ellers den givne farve. */
const hair = (pal: { gradient?: readonly string[] }, fill: string, gradientId: string) => (pal.gradient ? `url(#${gradientId})` : fill)

// ---------------------------------------------------------------------------------------------
// Hoved: bredt kranium og fyldige kinder, der går blødt ind i en rund snude forneden (snuden buler lidt
// ud under kinderne, så den også ses i sort).

const HEAD_HALF: Vec[] = [
  [0, -1.0], [-0.4, -0.97], [-0.7, -0.84], [-0.9, -0.6], [-1.0, -0.28], [-1.02, 0.04], [-0.97, 0.32],
  [-0.86, 0.55], [-0.7, 0.71], [-0.54, 0.78], [-0.45, 0.9], [-0.3, 1.02], [0, 1.08],
]
const HEAD_UNIT = symmetric(HEAD_HALF)
const puppyHead: OutlineFn = (a: AnchorSet, inflate: number) =>
  blob(offsetLoop(frame(HEAD_UNIT, a.headCenter.x, a.headCenter.y, a.headRx, a.headRy), inflate))

// ---------------------------------------------------------------------------------------------
// Hængeører (venstre; lokalt: roden i (0,0), øret hænger ned og ud). Folden øverst ligger lige over
// hovedets kontur; øret hænger ud over hovedets side, og spidsen er blød og rund i kindhøjde. Ørerne
// tegnes foran hovedet (ingen klip) og svajer blidt i alle humør (`a-hang`).

const EAR_RAW: Vec[] = [
  [7, -4], [2, -8], [-4, -8.5], [-10, -6], [-15, -1], [-20, 8], [-25, 20], [-28.5, 33], [-30, 46], [-28.5, 56],
  [-24, 62.5], [-17.5, 64.5], [-11.5, 61], [-8.5, 52], [-7.5, 41], [-5.5, 29], [-2.5, 17], [2, 6],
]
/** Øret står en anelse ud fra kinden, så der er luft mellem ørespidsen og kæben (også i sort). */
const EAR_ROT = 10
const EAR = xf(EAR_RAW, { rot: EAR_ROT })
/** Folden, hvor øret slår om over issen (kort, buet streg). */
const FOLD: Vec[] = xf([[2.5, -3], [-4, -4], [-10.5, -1.5], [-15.5, 3.5]], { rot: EAR_ROT })
/** Babyen har kortere, rundere ører; den store lidt længere. */
const earScale = (stage: Stage) => (stage === 1 ? { sx: 0.96, sy: 0.88 } : stage === 3 ? { sx: 1.03, sy: 1.06 } : {})

const Ear: SidePart = ({ pal, sw, stage, ids, lod }) => {
  const s = earScale(stage)
  return (
    <>
      <path d={blob(xf(EAR, s), 0.9)} fill={hair(pal, pal.earFur, ids.gradient)} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      {lod === 'full' && !pal.silhouette && <path d={spline(xf(FOLD, s))} fill="none" stroke={pal.earOutline} strokeWidth={sw * 0.5} {...round} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Forben: buttede søjler fra brystet ned til jorden med runde poter og åben kontur ved brystet.

const LEG_SPINE: Vec[] = [[0, -8], [0.3, 4], [0.6, 16], [0.8, 27], [1, 35]]
const LEG = limbLoop(LEG_SPINE, 17.5, 20.5, 7)
const LEG_TOES: Vec[][] = [
  [[-4.4, 45], [-4, 40.2]],
  [[4.8, 45], [4.4, 40.2]],
]
/** Ærmet følger benet ned til lige over poten (lodret ramme), en anelse løsere end benet. */
const LEG_SLEEVE: Vec[] = [[-11.8, -12], [-12.2, 0], [-12.5, 12], [-12.8, 25], [0, 27.6], [12.8, 25], [12.5, 12], [12.2, 0], [11.8, -12], [0, -14]]

const Leg: SidePart = ({ pal, sw, lod }) => (
  <OpenLimb loop={LEG} fill={pal.fur} stroke={pal.outline} sw={sw} trim={1}>
    {lod === 'full' && <path d={join(...LEG_TOES.map((t) => spline(t)))} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />}
  </OpenLimb>
)

/** Løftede poter (lokalt om skulderen; roden ligger højere oppe på brystet). */
const UP_SPINES = {
  cheer: [[1, -16], [-7, -25], [-16, -35], [-25, -45], [-31, -54]] as Vec[],
  // Vink: overarmen ud, underarmen op, poten ved siden af kinden (foran øret).
  wave: [[2, -16], [-9, -22], [-21, -26], [-31, -34], [-35, -47], [-36, -60]] as Vec[],
  // Tænker: poten under hagen.
  think: [[-1, -16], [5, -23], [10, -29], [13, -33.5]] as Vec[],
  // Ups: poten op til kinden (genert "hov"), så tungen ses.
  oops: [[-1, -16], [-4, -26], [-8, -35], [-12, -43], [-14, -49]] as Vec[],
}
const UP_LOOPS = {
  cheer: limbLoop(UP_SPINES.cheer, 15, 18.5),
  wave: limbLoop(UP_SPINES.wave, 15, 18.5),
  think: limbLoop(UP_SPINES.think, 15, 18),
  oops: limbLoop(UP_SPINES.oops, 15, 18),
}
const tipOf = (s: readonly Vec[]) => s[s.length - 1]

const PawUp: SidePart = ({ pal, sw, mood, lod }) => {
  const kind = mood === 'wave' ? 'wave' : mood === 'think' ? 'think' : mood === 'oops' ? 'oops' : 'cheer'
  const [tx, ty] = tipOf(UP_SPINES[kind])
  const side = kind === 'think' || kind === 'oops'
  // Poten vender trædepuderne mod os ved jubel og vink og ses fra siden (tålinjer) ved tænker og ups.
  const detail = side
    ? lod === 'full' && <path d={join(spline([[tx + 1.5, ty - 6], [tx + 5.2, ty - 3.4]]), spline([[tx + 3, ty - 1], [tx + 6.6, ty + 1.6]]))} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />
    : !pal.silhouette && <path d={padsPath(tx, ty + 0.5, 8.2, kind === 'wave' ? -4 : -32)} fill={pal.inner} />
  return (
    <OpenLimb loop={UP_LOOPS[kind]} fill={pal.fur} stroke={pal.outline} sw={sw}>
      {detail}
    </OpenLimb>
  )
}

// ---------------------------------------------------------------------------------------------
// Bagben: lårbuler og bagpoter, der titter frem forrest.

const HAUNCH = { cx: 63, cy: 206, rx: 19.5, ry: 18.5, rot: -18 }
const HIND_PAW = { cx: 55.5, cy: 220.4, rx: 13.4, ry: 6.8, rot: -8 }
const HIND_TOES: Vec[][] = [
  [[49.4, 225.6], [50.2, 221.8]],
  [[55.4, 226.6], [55.8, 222.6]],
]

const Feet: Part = ({ pal, sw, stage, lod }) => {
  const k = stage === 3 ? 1.08 : 1
  const e = (o: typeof HAUNCH, mirror: boolean) => ellipse(mirror ? 200 - o.cx : o.cx, o.cy, o.rx * k, o.ry * k, mirror ? -o.rot : o.rot)
  const toes = HIND_TOES.flatMap((t) => [spline(t), spline(mirrorX(t, 100))])
  return (
    <>
      <path d={join(e(HAUNCH, false), e(HAUNCH, true))} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
      <path d={join(e(HIND_PAW, false), e(HIND_PAW, true))} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
      {lod === 'full' && <path d={join(...toes)} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Den logrende hale (lokalt om tailBase bag højre lår): en buttet banan, der står op og krummer ind mod
// ryggen, med en lys spids på sort-hvid og plettet. Signaturen logrer den om roden (`a-wag`).

const TAIL_SPINE: Vec[] = [[0, 2], [7, -7], [13, -17], [15.5, -28], [14, -38]]
const TAIL = blob(limbLoop(TAIL_SPINE, 12, 8.5, 7), 0.9)
const TAIL_TIP = blob(limbLoop([[15.3, -30.5], [14, -38]], 8.8, 8.5, 7), 0.9)

const Tail: Part = ({ pal, sw, still, ids, colorway }) => {
  const fill = hair(pal, pal.fur, ids.gradient)
  const tip = !pal.silhouette && !pal.gradient && (colorway === 'c2' || colorway === 'c4')
  return (
    <Pivot at={{ x: 0, y: 0 }} cls="a-wag" still={still}>
      {tip ? (
        <>
          <path d={TAIL} fill={fill} />
          <path d={TAIL_TIP} fill={pal.belly} />
          <path d={TAIL} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
        </>
      ) : (
        <path d={TAIL} fill={fill} stroke={pal.outline} strokeWidth={sw} {...round} />
      )}
    </Pivot>
  )
}

// ---------------------------------------------------------------------------------------------
// Ansigt: en lys snude af to knurhårspuder og en hage, en stor, blank næse og små knurhårsprikker.

const NOSE: Vec[] = [[0, 5.6], [-4.6, 3.8], [-7.8, 0.2], [-7.6, -3.4], [-4.4, -5.4], [0, -5.8], [4.4, -5.4], [7.6, -3.4], [7.8, 0.2], [4.6, 3.8]]
/** Knurhårsprikker (tre på hver pude), lokalt om næsen. */
const DOTS: Vec[] = [[-12.5, 9.5], [-16.5, 13], [-11.5, 14.5]]

const Muzzle: Part = ({ pal, sw, a, ids, lod }) => {
  const m = a.muzzle
  const snout = join(ellipse(m.x - 9.5, m.y + 12, 13.5, 11.5), ellipse(m.x + 9.5, m.y + 12, 13.5, 11.5), ellipse(m.x, m.y + 20, 15, 9))
  const dots = join(...[...DOTS, ...mirrorX(DOTS)].map(([x, y]) => circle(m.x + x, m.y + y, 1.15)))
  return (
    <>
      {!pal.silhouette && <path d={snout} fill={pal.belly} clipPath={`url(#${ids.headClip})`} />}
      {!pal.silhouette && lod === 'full' && <path d={dots} fill={pal.outline} opacity={0.42} />}
      <path d={blob(xf(NOSE, { dx: m.x, dy: m.y }), 0.8)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.42} {...round} />
      {!pal.silhouette && <path d={ellipse(m.x - 2.8, m.y - 2.6, 2.7, 1.5, -12)} fill={pal.highlight} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Krop: lyst bryst mellem forbenene og en pelstot under hagen (større på stor).

const BIB: Vec[] = [[0, -45], [-14, -41], [-17.5, -29], [-15, -15], [-8.5, -4], [0, -0.5], [8.5, -4], [15, -15], [17.5, -29], [14, -41]]

const BodyDeco: Part = ({ pal, a, ids, sw, stage }) => {
  const b = a.bodyCenter
  const k = stage === 3 ? 1.22 : 1
  return (
    <>
      <path d={blob(xf(BIB, { dx: b.x, dy: b.y }), 0.9)} fill={pal.belly} clipPath={`url(#${ids.bodyClip})`} />
      <path d={scallop(100, a.neck.y + 6, 14 * k, 7.5 * k, 7, 0.62, 0)} fill={pal.belly} stroke={pal.outline} strokeWidth={sw * 0.6} strokeLinejoin="round" />
    </>
  )
}

/** Regnbuens krave: fire flade striber i en flæse om halsen (i kroppens lag under kropstøjet). */
const RainbowCollar: Part = ({ pal, sw, ids, colorway, a, stage }) => {
  if (colorway !== 'rainbow' || pal.silhouette) return null
  const k = stage === 3 ? 1.14 : stage === 1 ? 1.06 : 1
  return (
    <path d={scallop(100, a.neck.y + 7 * k, 32 * k, 11 * k, 11, 0.6, -90)} fill={`url(#${ids.gradient})`} stroke={pal.maneOutline} strokeWidth={sw} strokeLinejoin="round" />
  )
}

// ---------------------------------------------------------------------------------------------
// Aftegninger: blis (sort-hvid) og pletter med en øjenplet (plettet), klippet til hoved og krop.

const BLAZE: Vec[] = [[0, -0.99], [-0.1, -0.8], [-0.09, -0.42], [-0.12, -0.05], [-0.26, 0.3], [0, 0.42], [0.26, 0.3], [0.12, -0.05], [0.09, -0.42], [0.1, -0.8]]
const EYE_PATCH: Vec[] = [[-0.72, -0.18], [-0.58, -0.4], [-0.34, -0.44], [-0.17, -0.26], [-0.15, 0.08], [-0.24, 0.3], [-0.48, 0.34], [-0.68, 0.2]]
const SPOTS: [number, number, number, number][] = [[-0.66, -0.08, 9, 8], [0.62, -0.36, 7, 6], [0.64, 0.44, 10, 8.5], [-0.36, 0.62, 6, 5]]

const PatternHead: Part = ({ pal, a, ids, colorway }) => {
  const f = (s: readonly Vec[]) => blob(frame(s, a.headCenter.x, a.headCenter.y, a.headRx, a.headRy), 0.9)
  if (colorway === 'c2') return <path d={f(BLAZE)} fill={pal.pattern} clipPath={`url(#${ids.headClip})`} />
  if (colorway === 'c4') {
    const spot = ellipse(a.headCenter.x + a.headRx * 0.44, a.headCenter.y - a.headRy * 0.6, 6.5, 5.5, -20)
    return <path d={join(f(EYE_PATCH), spot)} fill={pal.pattern} clipPath={`url(#${ids.headClip})`} />
  }
  return null
}

const PatternBody: Part = ({ pal, a, ids, colorway }) =>
  colorway === 'c4' ? (
    <path
      d={join(...SPOTS.map(([u, v, rx, ry]) => ellipse(a.bodyCenter.x + u * a.bodyRx, a.bodyCenter.y + v * a.bodyRy, rx, ry, u * 30)))}
      fill={pal.pattern}
      clipPath={`url(#${ids.bodyClip})`}
    />
  ) : null

// ---------------------------------------------------------------------------------------------

export const puppy: SpeciesDef = {
  id: 'puppy',
  name: 'Hvalp',
  nameClip: 'name.species.puppy',
  family: 'canine',
  body: 'tall',
  breeds: [{ id: 'std', name: 'hvalp' }],
  colorways: PUPPY_COLORWAYS,
  magic: ['gold', 'rainbow'],
  anchors: {
    headCenter: { x: 100, y: 92 },
    headRx: 55,
    headRy: 47,
    headTop: { x: 100, y: 45 },
    headWidth: 104,
    earBaseL: { x: 66, y: 70 },
    earBaseR: { x: 134, y: 70 },
    hornBase: { x: 100, y: 48 },
    eyeL: { x: 77.5, y: 96 },
    eyeR: { x: 122.5, y: 96 },
    eyeRx: 10.4,
    eyeRy: 12.8,
    muzzle: { x: 100, y: 113 },
    mouth: { x: 100, y: 124 },
    cheekL: { x: 65, y: 116 },
    cheekR: { x: 135, y: 116 },
    neck: { x: 100, y: 139 },
    neckWidth: 50,
    bodyCenter: { x: 100, y: 183 },
    bodyRx: 41,
    bodyRy: 41,
    bodyWidth: 82,
    chest: { x: 100, y: 162 },
    back: { x: 100, y: 162 },
    shoulderL: { x: 86.5, y: 178 },
    shoulderR: { x: 113.5, y: 178 },
    pawL: { x: 86.5, y: 218 },
    pawR: { x: 113.5, y: 218 },
    footL: { x: 62, y: 220 },
    footR: { x: 138, y: 220 },
    tailBase: { x: 136, y: 200 },
  },
  bounds: {
    head: { x0: 28, y0: 40, x1: 172, y1: 150 },
    body: { x0: 38, y0: 134, x1: 172, y1: 228 },
  },
  // Tankebobler og Zzz (fælles regel): over højre øre med mindst 8 enheders luft til hoved og ører i alle
  // stadier og inden for den sikre zone (moods-arkets lint).
  fx: { x: 176, y: 58 },
  face: { idleMouth: 'cat-w', cheeks: true },
  ears: { splay: 0, clip: false, hang: true },
  signature: 'tail-wag',
  // Forbenene står på jorden: glad løfter dem kun lidt; ups er en pote op til munden. Hængeørerne følger
  // hovedet og svajer (de rejser sig ikke med humøret), og halen står højt og logrer i de glade humør.
  poses: {
    happy: { pawL: 14, pawR: 14, tail: -14, earL: 0, earR: 0 },
    cheer: { tail: -14, earL: 0, earR: 0 },
    think: { tail: -6, earL: 0, earR: 0 },
    oops: { pawL: 0, pawR: { up: true }, tail: 8, earL: 0, earR: 0 },
    sleep: { pawL: 0, pawR: 0, earL: 0, earR: 0 },
    wave: { tail: -14, earL: 0, earR: 0 },
  },
  parts: {
    head: puppyHead,
    Ear,
    Paw: Leg,
    PawUp,
    pawUpTip: { cheer: { x: -31, y: -54 }, wave: { x: -36, y: -60 }, think: { x: 13, y: -33.5 }, oops: { x: -14, y: -49 } },
    upArms: {
      cheer: { spine: UP_SPINES.cheer, w0: 15, w1: 18.5, tip: 10 },
      wave: { spine: UP_SPINES.wave, w0: 15, w1: 18.5, tip: 10 },
      think: { spine: UP_SPINES.think, w0: 15, w1: 18, tip: 9.5 },
      oops: { spine: UP_SPINES.oops, w0: 15, w1: 18, tip: 9.5 },
    },
    limb: { rot: 0, sleeve: () => blob(LEG_SLEEVE), cuff: { y: 25.2, half: 12.9 } },
    Feet,
    Tail,
    Muzzle,
    BodyDeco,
    Ruff: RainbowCollar,
    Pattern: { head: PatternHead, body: PatternBody },
  },
}

export default puppy
