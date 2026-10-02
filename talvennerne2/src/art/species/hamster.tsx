// Hamsteren (Hestebakkerne, bølge 2): skabelonen `round`, én race (std). Artstrækkene står i silhuetten, så
// hamsteren aldrig læses som en kanin uden ører:
// - store kindposer, der buler ud forneden på hovedets sider, så ansigtet er bredest ved kinderne (en pære),
// - små, runde ører højt oppe på issen (ikke lange ører og ingen ører),
// - en bred kartoffelkrop uden hale, hvor hovedet sidder lavt (kort hals), og små lyserøde hænder samlet
//   foran brystet og små lyserøde fødder (ingen store kaninfødder og ingen pomponhale).
// Kindposerne er tegnet i to lag om samme pivot: konturen bag hovedet (så den løber sømløst ind i hovedets
// kontur) og det lyse fyld foran (så hovedets kontur ikke ses hen over posen).
// Signaturen er kind-pustet: posen puster sig op, holder, slår et overshoot og falder til ro (`a-puff`,
// rig.css). Alle former er punkter og husets primitiver.
import { ROUND, hatted, limbLoop, padsPath, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { Pivot } from '../rig/Rig'
import { blob, ellipse, frame, join, mirrorX, spline, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { Palette, Part, SidePart, SpeciesDef, Stage } from '../rig/types'
import { HAMSTER_COLORWAYS } from './hamster.colorways'

const round = ROUND
/** Hænder og fødder: lyserøde (sort i silhuet). */
const pink = (pal: Palette) => pal.inner

/** Den del af en lukket lemkontur, der ligger under y = cut (hånden): starter og slutter på snittet. */
function below(loop: readonly Vec[], cut: number): Vec[] {
  const out: Vec[] = []
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i]
    const q = loop[(i + 1) % loop.length]
    if (p[1] >= cut) out.push(p)
    if (p[1] >= cut !== q[1] >= cut) {
      const t = (cut - p[1]) / (q[1] - p[1])
      out.push([p[0] + (q[0] - p[0]) * t, cut])
    }
  }
  const k = out.findIndex(([, y]) => y === cut)
  return [...out.slice(k), ...out.slice(0, k)]
}

// ---------------------------------------------------------------------------------------------
// Kindposer (lokalt om hovedets centrum): en bred, blød bule forneden på hver side af ansigtet.

const POUCH = { cx: -42, cy: 17, rx: 23.5, ry: 20.5, rot: -10 }
/**
 * Hver pose puster sig op om et punkt på modsat side af ansigtet (lokalt om hovedets centrum), så riggens
 * pust (skala 1,08) flytter posens yderkant ca. 7,5 enheder ud og den indre kant kun ca. 4.
 */
const PIVOT_X = 30
/** Posen om sin pivot: venstre pose (side 1) har pivoten til højre for ansigtets midte, højre pose spejlet. */
const pouchAt = (side: 1 | -1, inset: number) => ellipse(side * (POUCH.cx - PIVOT_X), 0, POUCH.rx - inset, POUCH.ry - inset, side * POUCH.rot)
/** Posens kontur bag hovedet og det lyse fyld foran (en anelse inden for konturen, så den står i fuld bredde). */
const POUCH_BACK = { L: pouchAt(1, 0), R: pouchAt(-1, 0) }
const POUCH_FRONT = { L: pouchAt(1, 1.7), R: pouchAt(-1, 1.7) }
const pivotOf = (a: { headCenter: { x: number; y: number } }, side: 1 | -1) => ({ x: a.headCenter.x + side * PIVOT_X, y: a.headCenter.y + POUCH.cy })

/** Posernes kontur bag hovedet (lag 10): kun buen uden for hovedet ses. */
const PouchBack: Part = ({ pal, sw, a, still }) => (
  <>
    {([1, -1] as const).map((side) => (
      <Pivot key={side} at={pivotOf(a, side)} cls="a-puff" still={still}>
        <path d={side === 1 ? POUCH_BACK.L : POUCH_BACK.R} fill={pal.belly} stroke={pal.outline} strokeWidth={sw} {...round} />
      </Pivot>
    ))}
  </>
)
/** Posernes lyse fyld foran hovedet (efter skyggen): dækker hovedets kontur hen over posen. */
const PouchFront: Part = ({ pal, a, still }) =>
  pal.silhouette ? null : (
    <>
      {([1, -1] as const).map((side) => (
        <Pivot key={side} at={pivotOf(a, side)} cls="a-puff" still={still}>
          <path d={side === 1 ? POUCH_FRONT.L : POUCH_FRONT.R} fill={pal.belly} />
        </Pivot>
      ))}
    </>
  )

// ---------------------------------------------------------------------------------------------
// Ører: små, runde ører højt på issen (lokalt: roden i (0,0), peger op).

const EAR: Vec[] = xf(
  [[0, 6], [-8.2, 3.5], [-10.4, -3.5], [-8.8, -10.6], [-4, -14.4], [1.4, -14.6], [6.4, -11.6], [9.2, -5.4], [8.8, 1.5], [5.6, 5.6]],
  { sx: 1.22, sy: 1.2 },
)
const EAR_INNER: Vec[] = xf([[-0.2, -0.8], [-5.2, -3.6], [-5.4, -8.6], [-2.4, -11], [1.6, -10.8], [4.6, -7.6], [4.6, -3.2], [2.4, -0.6]], { sx: 1.22, sy: 1.2 })
const EAR_HATTED = hatted(EAR, -4, 3.5)
const earScale = (stage: Stage) => (stage === 1 ? { sx: 1.1, sy: 1.1 } : {})

const Ear: SidePart = ({ pal, sw, stage, hat }) => {
  const s = earScale(stage)
  return (
    <>
      <path d={blob(xf(hat === 'through' ? EAR_HATTED : EAR, s), 0.9)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      {!pal.silhouette && <path d={blob(xf(EAR_INNER, s), 0.9)} fill={pink(pal)} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Arme: korte, buttede arme, der kommer frem under kinderne, med små lyserøde hænder samlet foran brystet
// (åben kontur ved roden). Tegnet lodret og drejet ind mod brystet.

const PAW_ROT = -48
const ARM_SPINE: Vec[] = [[0, -8], [0, 1], [0, 9], [0, 16]]
const ARM = limbLoop(ARM_SPINE, 14.5, 15, 7)
const HAND = below(ARM, 12.5)
/** Ærmet: armen fra roden til manchetten lige over hånden (lodret ramme), en anelse løsere end armen. */
const SLEEVE: Vec[] = [[-9.4, -11], [-9.8, -3], [-10.2, 4], [-10.4, 10.5], [0, 12], [10.4, 10.5], [10.2, 4], [9.8, -3], [9.4, -11], [0, -13]]

const Paw: SidePart = ({ pal, sw }) => (
  <g transform={`rotate(${PAW_ROT})`}>
    <path d={blob(ARM)} fill={pal.fur} />
    {!pal.silhouette && <path d={blob(HAND, 0.9)} fill={pink(pal)} />}
    <path d={spline(ARM.slice(1, -1))} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
  </g>
)

/** Løftede arme (lokalt om skulderen). Roden ligger på brystet; konturen er åben dér. */
const UP_SPINES = {
  cheer: [[6, 6], [0, -2], [-7, -10], [-13, -18], [-17, -26]] as Vec[],
  wave: [[7, 6], [-2, 2], [-11, -2], [-18, -9], [-21, -18], [-22, -28]] as Vec[],
  // Tænker: hånden under hagen.
  think: [[6, 7], [13, 1], [19, -6], [23, -12]] as Vec[],
  // Ups: hånden op til kinden (genert "hov"), tungen ude.
  oops: [[6, 7], [7, -3], [8, -12], [8.5, -19], [8, -25]] as Vec[],
}
type UpKind = keyof typeof UP_SPINES
const UP_W = { w0: 14, w1: 15.5 }
const UP_LOOPS = Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, limbLoop(s, UP_W.w0, UP_W.w1)])) as Record<UpKind, Vec[]>
/** Hånden på den løftede arm: de sidste 6 enheder, en anelse inden for armens kontur. */
const upHand = (s: readonly Vec[]): Vec[] => {
  const [ex, ey] = s[s.length - 1]
  const [px, py] = s[s.length - 2]
  const t = Math.min(1, 6 / (Math.hypot(ex - px, ey - py) || 1))
  return limbLoop([[ex + (px - ex) * t, ey + (py - ey) * t], [ex, ey]], UP_W.w1 - 0.8, UP_W.w1 - 0.8)
}
const UP_HANDS = Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, upHand(s)])) as Record<UpKind, Vec[]>
const tipOf = (s: readonly Vec[]) => s[s.length - 1]
const kindOf = (mood: string): UpKind => (mood in UP_SPINES ? (mood as UpKind) : 'cheer')

const PawUp: SidePart = ({ pal, sw, mood }) => {
  const kind = kindOf(mood)
  const [tx, ty] = tipOf(UP_SPINES[kind])
  const loop = UP_LOOPS[kind]
  const palm = kind === 'cheer' || kind === 'wave'
  return (
    <>
      <path d={blob(loop)} fill={pal.fur} />
      {!pal.silhouette && <path d={blob(UP_HANDS[kind], 0.9)} fill={pink(pal)} />}
      <path d={spline(loop)} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
      {palm && !pal.silhouette && <path d={padsPath(tx, ty + 0.4, 6.4, kind === 'wave' ? -4 : -32)} fill={pal.innerShade} />}
    </>
  )
}

/** Fyld bag alt ved armene (se `pawWebs`): lommernes udvidede hylstre pr. race, stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {}

// ---------------------------------------------------------------------------------------------
// Foran kroppen (efter maven og skyggen, før kropstøjet): små lyserøde fødder.

const FOOT = { cx: 79, cy: 222, rx: 11.5, ry: 6.4, rot: -8 }
const FOOT_TOES: Vec[][] = [
  [[73.6, 227], [74.2, 223.2]],
  [[79.4, 228], [79.6, 224]],
]

const FrontFeet: Part = ({ pal, sw, lod }) => {
  const f = FOOT
  const feet = join(ellipse(f.cx, f.cy, f.rx, f.ry, f.rot), ellipse(200 - f.cx, f.cy, f.rx, f.ry, -f.rot))
  const toes = FOOT_TOES.flatMap((t) => [spline(t), spline(mirrorX(t, 100))])
  return (
    <>
      <path d={feet} fill={pink(pal)} stroke={pal.outline} strokeWidth={sw} {...round} />
      {lod === 'full' && !pal.silhouette && <path d={join(...toes)} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />}
    </>
  )
}

/** Bagben: buttede lårbuler, der titter frem ved siderne. */
const HAUNCH = { cx: 52, cy: 207, rx: 14, ry: 15, rot: -14 }
const Haunches: Part = ({ pal, sw }) => {
  const h = HAUNCH
  return <path d={join(ellipse(h.cx, h.cy, h.rx, h.ry, h.rot), ellipse(200 - h.cx, h.cy, h.rx, h.ry, -h.rot))} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
}

/** Den lyse mave (en blød oval); regnbuen har her sin smæk af fire flade striber. */
const BodyDeco: Part = ({ pal, a, ids }) => (
  <path d={ellipse(a.bodyCenter.x, a.bodyCenter.y + 8, a.bodyRx * 0.64, a.bodyRy * 0.76)} fill={pal.gradient ? `url(#${ids.gradient})` : pal.belly} clipPath={`url(#${ids.bodyClip})`} />
)

// ---------------------------------------------------------------------------------------------
// Ansigt: en lys mule med en lille lyserød næse og knurhårsprikker.

const NOSE: Vec[] = [[0, 3], [-3.2, 0.8], [-4.6, -1.8], [-3, -3.2], [0, -3.4], [3, -3.2], [4.6, -1.8], [3.2, 0.8]]
const DOTS: Vec[] = [[-9.5, 4.5], [-12.5, 7.5], [-8.8, 9]]

const Muzzle: Part = ({ pal, sw, a, ids, lod }) => {
  const m = a.muzzle
  const dots = join(...[...DOTS, ...mirrorX(DOTS)].map(([x, y]) => ellipse(m.x + x, m.y + y, 0.95, 0.95)))
  return (
    <>
      {!pal.silhouette && <path d={ellipse(m.x, m.y + 5, 15, 11)} fill={pal.belly} clipPath={`url(#${ids.headClip})`} />}
      {!pal.silhouette && lod === 'full' && <path d={dots} fill={pal.outline} opacity={0.4} />}
      <path d={blob(xf(NOSE, { dx: m.x, dy: m.y }), 0.85)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.42} {...round} />
      {!pal.silhouette && <path d={ellipse(m.x - 1.5, m.y - 1.6, 1.4, 0.9, -15)} fill={pal.highlight} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Aftegninger: blis (sort-hvid) og pandaens øjenpletter og sadel, klippet til hoved og krop.

const BLAZE: Vec[] = [[0, -1.02], [-0.12, -0.8], [-0.1, -0.46], [-0.08, -0.2], [0, -0.1], [0.08, -0.2], [0.1, -0.46], [0.12, -0.8]]

const PatternHead: Part = ({ pal, a, ids, colorway }) => {
  const h = a.headCenter
  if (colorway === 'c4') return <path d={blob(frame(BLAZE, h.x, h.y, a.headRx, a.headRy), 0.9)} fill={pal.pattern} clipPath={`url(#${ids.headClip})`} />
  if (colorway === 'c6') {
    const patch = (e: { x: number; y: number }, s: number) => ellipse(e.x - s * 1.5, e.y + 1, a.eyeRx * 1.55, a.eyeRy * 1.3, s * -18)
    return <path d={join(patch(a.eyeL, 1), patch(a.eyeR, -1))} fill={pal.pattern} clipPath={`url(#${ids.headClip})`} />
  }
  return null
}

const PatternBody: Part = ({ pal, a, ids, colorway }) =>
  colorway === 'c6' ? (
    <path d={ellipse(a.bodyCenter.x, a.bodyCenter.y - a.bodyRy * 0.22, a.bodyRx * 1.3, a.bodyRy * 0.4)} fill={pal.pattern} clipPath={`url(#${ids.bodyClip})`} />
  ) : null

// ---------------------------------------------------------------------------------------------

export const hamster: SpeciesDef = {
  id: 'hamster',
  name: 'Hamster',
  nameClip: 'name.species.hamster',
  family: 'rodent',
  body: 'round',
  // Kindposerne er hovedets egne dele: de vokser ikke som en manke på stor.
  breeds: [{ id: 'std', name: 'hamster', maneGrowth: 1 }],
  colorways: HAMSTER_COLORWAYS,
  magic: ['gold', 'rainbow'],
  anchors: {
    headCenter: { x: 100, y: 102 },
    headRx: 52,
    headRy: 44,
    headTop: { x: 100, y: 57 },
    headWidth: 102,
    earBaseL: { x: 73, y: 67 },
    earBaseR: { x: 127, y: 67 },
    hornBase: { x: 100, y: 59 },
    eyeL: { x: 79, y: 104 },
    eyeR: { x: 121, y: 104 },
    eyeRx: 10,
    eyeRy: 12.2,
    muzzle: { x: 100, y: 121 },
    mouth: { x: 100, y: 128 },
    cheekL: { x: 63, y: 121 },
    cheekR: { x: 137, y: 121 },
    neck: { x: 100, y: 147 },
    neckWidth: 60,
    bodyCenter: { x: 100, y: 184 },
    bodyRx: 54,
    bodyRy: 42,
    bodyWidth: 100,
    chest: { x: 100, y: 168 },
    back: { x: 100, y: 168 },
    shoulderL: { x: 74, y: 156 },
    shoulderR: { x: 126, y: 156 },
    pawL: { x: 88, y: 170 },
    pawR: { x: 112, y: 170 },
    handRot: -20,
    footL: { x: 79, y: 222 },
    footR: { x: 121, y: 222 },
    tailBase: { x: 150, y: 210 },
  },
  bounds: {
    head: { x0: 30, y0: 42, x1: 170, y1: 150 },
    body: { x0: 34, y0: 136, x1: 166, y1: 228 },
  },
  // Tankebobler og Zzz (fælles regel): til højre over øret med mindst 8 enheders luft til hoved, poser og ører.
  fx: { x: 168, y: 64 },
  face: { idleMouth: 'cat-w', buckTeeth: true, cheeks: true },
  ears: { splay: 20 },
  signature: 'cheek-puff',
  // Guldets glansbånd på kroppens venstre flanke under armen.
  goldBand: [146, 192],
  // Ups: hånden op til kinden (ikke bag nakken, hvor de korte arme ikke når).
  poses: {
    oops: { pawL: 0, pawR: { up: true } },
  },
  parts: {
    Ear,
    Paw,
    PawUp,
    PawBack: pawWebs({}, PAW_WEBS),
    pawUpTip: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { x: tipOf(s)[0], y: tipOf(s)[1] }])),
    upArms: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { spine: s, w0: UP_W.w0, w1: UP_W.w1, tip: 6 }])),
    limb: { rot: PAW_ROT, sleeve: () => blob(SLEEVE), cuff: { y: 10.5, half: 10.4 } },
    Feet: Haunches,
    Muzzle,
    BodyDeco,
    Ruff: FrontFeet,
    ManeBack: PouchBack,
    HeadDeco: PouchFront,
    Pattern: { head: PatternHead, body: PatternBody },
  },
}

export default hamster
