// Lammet (Hestebakkerne, bølge 2): skabelonen `round`, én race (std). Artstrækkene står i silhuetten, så lammet
// hverken læses som en løvehovedkanin eller en hvalp:
// - kroppen er én uldsky: kroppens kontur er bløde uldbuer hele vejen rundt (ingen glat krop),
// - en lille uldtop i panden mellem ørerne (ikke en krave om ansigtet, som løvehovedets manke),
// - ørerne stritter vandret ud fra hovedets sider og hænger en anelse (aldrig op som kaninens, aldrig ned
//   langs kinderne som hvalpens),
// - et glat, rundt ansigt med en lille, lys mule og mørke klove på forben og bagben.
// Signaturen er øre-floppet: hvert øre sidder i sin egen pivot (`a-curl`) og flopper ned, slår et overshoot op
// og falder til ro (rig.css). Alle former er punkter og husets primitiver.
import { ROUND, below, limbLoop, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { Pivot } from '../rig/Rig'
import { blob, ellipse, join, scallop, spline, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, OutlineFn, Palette, Part, SidePart, SpeciesDef, Stage } from '../rig/types'
import { LAMB_COLORWAYS } from './lamb.colorways'

const round = ROUND
/** Regnbuen ligger som fire flade striber i uldtoppen, halen og kraven; ellers ulden. */
const wool = (pal: Palette, gradientId: string) => (pal.gradient ? `url(#${gradientId})` : pal.mane)
/** Klovene: hovfarven (sort i silhuet). */
const hoof = (pal: Palette) => pal.hoof ?? pal.outline

// ---------------------------------------------------------------------------------------------
// Krop: en uldsky af bløde buer rundt om kroppens ellipse. Tøj klippes til skyen (+2), og konturen streges igen.

const WOOL_LOBES = 15
const woolBody: OutlineFn = (a: AnchorSet, inflate: number) =>
  scallop(a.bodyCenter.x, a.bodyCenter.y, a.bodyRx - 5 + inflate, a.bodyRy - 5 + inflate, WOOL_LOBES, 0.6, -90)

/** Uldkrøller på kroppen (små, åbne buer i skyggefarven; kun i fuld detalje). */
const CURLS: Vec[][] = [
  [[-30, -10], [-26, -14], [-21, -12]],
  [[-12, 4], [-8, 0], [-3, 2]],
  [[14, -14], [18, -18], [23, -16]],
  [[22, 10], [26, 6], [31, 8]],
  [[-24, 18], [-20, 14], [-15, 16]],
  [[2, 22], [6, 18], [11, 20]],
]

const BodyDeco: Part = ({ pal, a, ids, sw, lod }) =>
  lod === 'full' && !pal.silhouette ? (
    <path
      d={join(...CURLS.map((c) => spline(xf(c, { dx: a.bodyCenter.x, dy: a.bodyCenter.y }))))}
      fill="none"
      stroke={pal.outline}
      strokeOpacity={0.32}
      strokeWidth={sw * 0.5}
      clipPath={`url(#${ids.bodyClip})`}
      {...round}
    />
  ) : null

/** Regnbuens krave: fire flade striber i en uldflæse om halsen (i kroppens lag under kropstøjet). */
const RainbowCollar: Part = ({ pal, sw, ids, colorway, a, stage }) => {
  if (colorway !== 'rainbow' || pal.silhouette) return null
  const k = stage === 3 ? 1.12 : stage === 1 ? 1.08 : 1
  return (
    <path d={scallop(100, a.neck.y + 6 * k, 30 * k, 11 * k, 10, 0.6, -90)} fill={`url(#${ids.gradient})`} stroke={pal.maneOutline} strokeWidth={sw} strokeLinejoin="round" clipPath={`url(#${ids.bodyClip})`} />
  )
}

// ---------------------------------------------------------------------------------------------
// Ører (venstre; lokalt: roden i (0,0) bag hovedets side, øret stritter vandret ud og hænger en anelse).
// Ørerne tegnes bag hovedet, så hovedets kontur løber ubrudt hen over ørebasen.

const EAR_DROOP = -14
const EAR: Vec[] = xf(
  [[8, -6], [-4, -8.6], [-14, -9.6], [-24, -8.4], [-32, -4.6], [-36.5, 0.6], [-34.4, 6], [-26.4, 9.2], [-15, 9.6], [-4, 7.8], [8, 5]],
  { rot: EAR_DROOP },
)
const EAR_INNER: Vec[] = xf([[-3, -3.6], [-13, -5.2], [-22.4, -4.2], [-29.4, -0.8], [-27.4, 3.2], [-18, 5], [-8, 4], [0, 1.6]], { rot: EAR_DROOP })
const earScale = (stage: Stage) => (stage === 1 ? { sx: 0.94, sy: 1.04 } : stage === 3 ? { sx: 1.04 } : {})

const Ear: SidePart = ({ pal, sw, stage, still }) => {
  const s = earScale(stage)
  return (
    <Pivot at={{ x: 0, y: 0 }} cls="a-curl" still={still}>
      <path d={blob(xf(EAR, s), 0.9)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      {!pal.silhouette && <path d={blob(xf(EAR_INNER, s), 0.9)} fill={pal.inner} />}
    </Pivot>
  )
}

// ---------------------------------------------------------------------------------------------
// Forben: korte, buttede ben, der kommer frem under hovedet og hviler mod uldmaven, med mørke klove
// (åben kontur ved skulderen).

const PAW_ROT = -24
const ARM_SPINE: Vec[] = [[0, -13], [-0.4, -3], [-0.6, 7], [0, 17]]
const ARM = limbLoop(ARM_SPINE, 19, 19, 8)
const HOOF_CUT = 16.5
const ARM_HOOF = below(ARM, HOOF_CUT)
/** Klovens spalte (lodret streg midt på klovene). */
const HOOF_SPLIT: Vec[] = [[0, 20.4], [0, 26.2]]
/** Ærmet: armen fra skulderen til manchetten lige over klovene (lodret ramme), en anelse løsere end armen. */
const SLEEVE: Vec[] = [[0, -17], [-11, -14.5], [-12.2, -4], [-12.6, 5], [-12.8, 12.5], [0, 14.5], [12.8, 12.5], [12.6, 5], [12.2, -4], [11, -14.5]]

const Paw: SidePart = ({ pal, sw, lod }) => (
  <g transform={`rotate(${PAW_ROT})`}>
    <path d={blob(ARM)} fill={pal.fur} />
    {!pal.silhouette && <path d={blob(ARM_HOOF, 0.9)} fill={hoof(pal)} />}
    <path d={spline(ARM.slice(1, -1))} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
    {lod === 'full' && !pal.silhouette && <path d={spline(HOOF_SPLIT)} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />}
  </g>
)

/** Løftede ben (lokalt om skulderen). Roden ligger på brystet; konturen er åben dér. */
const UP_SPINES = {
  cheer: [[7.5, 20], [-1.5, 10], [-11.5, 0], [-20.5, -10], [-27.5, -20]] as Vec[],
  wave: [[8.5, 19], [-3.5, 14], [-16.5, 11], [-26.5, 4], [-31.5, -7], [-33.5, -21]] as Vec[],
  think: [[5.5, 20], [11.5, 12], [17.5, 5], [21.5, -1]] as Vec[],
  // Ups: klovene op til kinden (genert "hov"), så tungen ses.
  oops: [[6, 7], [7, -3], [7.5, -12], [6, -21]] as Vec[],
}
type UpKind = keyof typeof UP_SPINES
const UP_W: Record<UpKind, [number, number]> = { cheer: [17, 18.5], wave: [17, 18.5], think: [17, 18], oops: [17, 18] }
const UP_LOOPS = Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, limbLoop(s, ...UP_W[k as UpKind])])) as Record<UpKind, Vec[]>
/** Klovene på det løftede ben: de sidste 8 enheder, en anelse inden for benets kontur. */
const upHoof = (s: readonly Vec[], w: number): Vec[] => {
  const [ex, ey] = s[s.length - 1]
  const [px, py] = s[s.length - 2]
  const t = Math.min(1, 8 / (Math.hypot(ex - px, ey - py) || 1))
  return limbLoop([[ex + (px - ex) * t, ey + (py - ey) * t], [ex, ey]], w - 0.8, w - 0.8)
}
const UP_HOOVES = Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, upHoof(s, UP_W[k as UpKind][1])])) as Record<UpKind, Vec[]>
const tipOf = (s: readonly Vec[]) => s[s.length - 1]
const kindOf = (mood: string): UpKind => (mood in UP_SPINES ? (mood as UpKind) : 'cheer')

const PawUp: SidePart = ({ pal, sw, mood }) => {
  const kind = kindOf(mood)
  const loop = UP_LOOPS[kind]
  return (
    <>
      <path d={blob(loop)} fill={pal.fur} />
      {!pal.silhouette && <path d={blob(UP_HOOVES[kind], 0.9)} fill={hoof(pal)} />}
      <path d={spline(loop)} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
    </>
  )
}

/**
 * Fyld bag kroppen ved armene (lokalt om skulderen; højre side spejlet): lommen mellem det løftede ben,
 * hagen og uldkroppen, så der aldrig ses baggrund inde i figuren (huller-lint).
 */
const CHEER_WEB: Vec[] = [[7.5, 20], [-1.5, 10], [-11.5, 0], [-19, -9], [-10, -15], [4, -12], [22, -2], [20, 14]]
const WEBS: PawWebs = {
  cheer: { L: CHEER_WEB, R: CHEER_WEB },
}
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {}

// ---------------------------------------------------------------------------------------------
// Bagben: små, mørke klove, der titter frem under uldskyen.

const HIND: Vec = [61, 220.5]
const Feet: Part = ({ pal, sw, lod, stage }) => {
  const k = stage === 3 ? 1.08 : 1
  const [x, y] = HIND
  const hooves = join(ellipse(x, y, 11 * k, 6.4 * k, -6), ellipse(200 - x, y, 11 * k, 6.4 * k, 6))
  const split = join(spline([[x + 1, y - 1.5], [x + 1.4, y + 5.6]]), spline([[199 - x, y - 1.5], [198.6 - x, y + 5.6]]))
  return (
    <>
      <path d={hooves} fill={hoof(pal)} stroke={pal.outline} strokeWidth={sw} {...round} />
      {lod === 'full' && !pal.silhouette && <path d={split} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />}
    </>
  )
}

/** Halen: en lille, aflang uldtot, der titter frem bag højre side. */
const Tail: Part = ({ pal, sw, ids }) => (
  <path d={scallop(6, -4, 9.5, 12.5, 7, 0.62, -90, 24)} fill={wool(pal, ids.gradient)} stroke={pal.maneOutline} strokeWidth={sw} {...round} />
)

// ---------------------------------------------------------------------------------------------
// Ansigt: en lille, lys mule med en lyserød næse (et blødt hjerte).

const NOSE: Vec[] = [[0, 3.2], [-3.4, 0.6], [-5.4, -2], [-4.2, -3.6], [-1.6, -3.4], [0, -2.2], [1.6, -3.4], [4.2, -3.6], [5.4, -2], [3.4, 0.6]]

const Muzzle: Part = ({ pal, sw, a, ids }) => {
  const m = a.muzzle
  return (
    <>
      {!pal.silhouette && <path d={ellipse(m.x, m.y + 4.5, 15.5, 11)} fill={pal.belly} clipPath={`url(#${ids.headClip})`} />}
      <path d={blob(xf(NOSE, { dx: m.x, dy: m.y }), 0.85)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.42} {...round} />
      {!pal.silhouette && <path d={ellipse(m.x - 2.4, m.y - 1.9, 1.6, 1, -15)} fill={pal.highlight} />}
    </>
  )
}

/** Uldtoppen i panden: en lille uldsky over issen, der aldrig når ned til øjnene. Skjules af hatte (hides). */
const WoolTop: Part = ({ pal, sw, ids, a }) => (
  <path d={scallop(100, a.headTop.y + 8, 27, 11, 8, 0.64, -90)} fill={wool(pal, ids.gradient)} stroke={pal.maneOutline} strokeWidth={sw} {...round} />
)

// ---------------------------------------------------------------------------------------------

export const lamb: SpeciesDef = {
  id: 'lamb',
  name: 'Lam',
  nameClip: 'name.species.lamb',
  family: 'ovine',
  body: 'round',
  // Uldtoppen vokser kun lidt på stor (den skal blive fri af øjnene).
  breeds: [{ id: 'std', name: 'lam', maneGrowth: 1.12 }],
  colorways: LAMB_COLORWAYS,
  magic: ['gold', 'rainbow'],
  anchors: {
    headCenter: { x: 100, y: 100 },
    headRx: 50,
    headRy: 45,
    headTop: { x: 100, y: 55 },
    headWidth: 100,
    earBaseL: { x: 56, y: 90 },
    earBaseR: { x: 144, y: 90 },
    hornBase: { x: 100, y: 57 },
    eyeL: { x: 80, y: 104 },
    eyeR: { x: 120, y: 104 },
    eyeRx: 10,
    eyeRy: 12.4,
    muzzle: { x: 100, y: 124 },
    mouth: { x: 100, y: 132 },
    cheekL: { x: 68, y: 121 },
    cheekR: { x: 132, y: 121 },
    neck: { x: 100, y: 148 },
    neckWidth: 56,
    bodyCenter: { x: 100, y: 183 },
    bodyRx: 53,
    bodyRy: 43,
    bodyWidth: 98,
    chest: { x: 100, y: 168 },
    back: { x: 100, y: 168 },
    shoulderL: { x: 74, y: 150 },
    shoulderR: { x: 126, y: 150 },
    pawL: { x: 84, y: 172 },
    pawR: { x: 116, y: 172 },
    footL: { x: 61, y: 220 },
    footR: { x: 139, y: 220 },
    tailBase: { x: 152, y: 198 },
  },
  bounds: {
    head: { x0: 14, y0: 38, x1: 186, y1: 150 },
    body: { x0: 40, y0: 136, x1: 172, y1: 228 },
  },
  // Tankebobler og Zzz (fælles regel): over højre øre med mindst 8 enheders luft til hoved, uldtop og øre.
  fx: { x: 172, y: 58 },
  face: { idleMouth: 'cat-w', cheeks: true },
  // Ørerne stritter ud bag hovedet: ingen huller i hattene (hatten sidder på issen over ørerne).
  ears: { splay: 0, clip: false, behind: true },
  signature: 'ear-flop',
  // Ups: klovene op til kinden (ikke bag nakken, hvor de tynde ben ville stikke op over ulden).
  poses: {
    oops: { pawL: 0, pawR: { up: true } },
  },
  // Guldets glansbånd på kroppens venstre flanke under armen.
  goldBand: [148, 196],
  parts: {
    body: woolBody,
    Ear,
    Paw,
    PawUp,
    PawBack: pawWebs(WEBS, PAW_WEBS),
    pawUpTip: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { x: tipOf(s)[0], y: tipOf(s)[1] }])),
    upArms: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { spine: s, w0: UP_W[k as UpKind][0], w1: UP_W[k as UpKind][1], tip: 8 }])),
    limb: { rot: PAW_ROT, sleeve: () => blob(SLEEVE), cuff: { y: 12.5, half: 12.8 } },
    Feet,
    Tail,
    Muzzle,
    BodyDeco,
    Ruff: RainbowCollar,
    ManeFront: WoolTop,
  },
}

export default lamb

