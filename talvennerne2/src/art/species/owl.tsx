// Uglen (Regnbueskoven, bølge 3): skabelonen `pear` som æg-variant, én race (std). Artstrækkene står i silhuetten:
// - fjerører: to spidse fjertotter på hovedets hjørner, der vipper udad,
// - et bredt, lidt fladt hoved på en æggeformet krop, og vinger, der ligger langs siderne og stritter ud ved
//   skuldrene (vingerne er uglens arme: den vinker med vingen),
// - en lys ansigtsskive (to buer om øjnene med et V mellem dem), et lille krumt næb og fødder med kløer.
// Brystet har små V-fjer i rækker; regnbuen bærer de fire flade pastelstriber på brystet. Uglens egne vinger
// optager ryg-slottet (`occupies: ['back']` i kataloget).
// Signaturen er hoved-drejet: fjerørerne vipper ud, slår et overshoot og falder til ro (`a-curl`, rig.css). Selve
// hovedets drej kræver en regel i rig.css (foreslået i rapporten); fjerørerne bærer bevægelsen indtil da.
// Alle former er punkter og husets primitiver.
import { ROUND, hatted, limbLoop, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { STAGE_XF } from '../rig/anchors'
import { mixHex } from '../rig/oklch'
import { Pivot } from '../rig/Rig'
import { blob, bun, capsule, ellipse, join, spline, symBlob, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, OutlineFn, Palette, Part, SidePart, SpeciesDef, Stage } from '../rig/types'
import { OWL_COLORWAYS } from './owl.colorways'

const round = ROUND
/** Vingerne: en tone mørkere end kroppen (sort i silhuet). */
const wing = (pal: Palette) => pal.mane2 ?? pal.shade
/** Fjerlinjer og V-fjer: en mellemtone mellem fladen og konturen. */
const featherLine = (pal: Palette, base: string) => mixHex(base, pal.outline, 0.42)

// ---------------------------------------------------------------------------------------------
// Hoved: bredt og lidt fladt foroven (fjerørerne sidder på hjørnerne).

const owlHead: OutlineFn = (a: AnchorSet, inflate: number) =>
  bun({
    cx: a.headCenter.x,
    cy: a.headCenter.y + a.headRy * 0.08,
    rx: a.headRx + inflate,
    top: a.headRy * 1.02 + inflate,
    bottom: a.headRy * 0.98 + inflate,
    eTop: 3.1,
    eBottom: 2.2,
    taper: 0.02,
  })

// ---------------------------------------------------------------------------------------------
// Ansigtsskiven: to buer om øjnene med et V mellem dem foroven og en spids ned mod næbbet (lokalt om midten
// mellem øjnene). Den vokser med øjnene på babyen.

const DISC_HALF: Vec[] = [
  [0, -9], [-7.4, -19], [-19, -23.4], [-31, -20], [-39, -9], [-40.6, 4], [-36, 16], [-26.4, 24.4], [-14, 27.6], [-4.6, 25.4], [0, 22.4],
]

const Disc: Part = ({ pal, a, sw, stage }) => {
  if (pal.silhouette) return null
  const k = 1 + (STAGE_XF[stage].eye - 1) * 0.85
  const ox = (a.eyeL.x + a.eyeR.x) / 2
  const oy = (a.eyeL.y + a.eyeR.y) / 2
  return (
    <path
      d={symBlob(xf(DISC_HALF, { sx: k, dx: ox, dy: oy }), ox, 0.9)}
      fill={pal.belly}
      stroke={featherLine(pal, pal.fur)}
      strokeWidth={sw * 0.8}
      {...round}
    />
  )
}

// ---------------------------------------------------------------------------------------------
// Næbbet: et lille, krumt næb mellem øjnene, lige over munden.

const BEAK: Vec[] = [[0, 9.2], [-3.4, 3.2], [-5.6, -2.6], [-4.4, -6.2], [0, -7.4], [4.4, -6.2], [5.6, -2.6], [3.4, 3.2]]

const Beak: Part = ({ pal, sw, a }) => {
  const m = a.muzzle
  return (
    <>
      <path d={blob(xf(BEAK, { dx: m.x, dy: m.y }), 0.8)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.45} {...round} />
      {!pal.silhouette && <path d={ellipse(m.x - 1.8, m.y - 3.4, 1.7, 1.2, -20)} fill={pal.highlight} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Fjerører (lokalt: roden i (0,0), peger op): spidse, let krumme totter med en lys stribe. Signaturen vipper dem.

const EAR: Vec[] = [
  [3, 5], [-6, 2.5], [-10, -3], [-13.4, -11], [-17, -21], [-20.5, -31], [-13.4, -25.5], [-12, -33.5], [-6.4, -22.5], [-1.6, -14],
  [3.6, -6.5], [7.4, 0.5],
]
const EAR_STREAK: Vec[] = [[-4.4, -2.4], [-8.4, -8.4], [-11.6, -16], [-13.4, -22], [-9.6, -18.4], [-5.4, -11], [-1.6, -4.6]]
const EAR_HATTED = hatted(EAR, -6, 3.5)
const earScale = (stage: Stage) => (stage === 1 ? { sx: 1.1, sy: 1.1 } : {})

const Ear: SidePart = ({ pal, sw, stage, hat, still }) => {
  const s = earScale(stage)
  return (
    <Pivot at={{ x: 0, y: 0 }} cls="a-curl" still={still}>
      <path d={blob(xf(hat === 'through' ? EAR_HATTED : EAR, s), 0.62)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      {!pal.silhouette && hat !== 'through' && <path d={blob(xf(EAR_STREAK, s), 0.85)} fill={mixHex(pal.fur, pal.belly, 0.45)} />}
    </Pivot>
  )
}

// ---------------------------------------------------------------------------------------------
// Vingerne (uglens arme, lokalt om skulderen): hængende vinger langs siderne med svungne fjerspidser forneden og
// åben kontur ved roden. Løftet bliver vingen en bred, spids vinge, der vinker.

const PAW_ROT = 8
/**
 * Vingens forskydning i skulderens ramme: vingen er centreret om x = 0 (så ærmets manchet sidder midt på den), og
 * skulderankrene ligger tilsvarende længere ude; den hængende vinge står samme sted i modelrummet.
 */
const WX = 5.8
const WING: Vec[] = xf([
  [7, -8], [9, 4], [8.6, 17], [6, 29], [1.8, 39], [-3, 46.5], [-6.6, 41.6], [-10.2, 45], [-12.8, 37.6], [-16.6, 39], [-19, 29],
  [-20.6, 17], [-20, 4], [-16, -6.5],
], { dx: WX })
const WING_LINES: Vec[][] = ([
  [[-3.4, 8], [-5, 21], [-6, 33]],
  [[-10.2, 10], [-11.4, 24]],
] as Vec[][]).map((l) => xf(l, { dx: WX }))
/** Ærmet: vingen fra roden til manchetten (lodret ramme), en anelse løsere end vingen og centreret som den. */
const SLEEVE: Vec[] = [[-8.6, -9.6], [-13.6, -3.4], [-15.8, 6], [-15.8, 16], [-15.2, 26], [0, 29.4], [15.2, 26], [15.8, 16], [15.6, 6], [13.8, -3.4], [9, -9.6], [0, -11.6]]

const Paw: SidePart = ({ pal, sw, lod }) => (
  <g transform={`rotate(${PAW_ROT})`}>
    <path d={blob(WING, 0.85)} fill={wing(pal)} />
    {lod === 'full' && !pal.silhouette && <path d={join(...WING_LINES.map((l) => spline(l)))} fill="none" stroke={featherLine(pal, wing(pal))} strokeWidth={sw * 0.5} {...round} />}
    <path d={spline(WING.slice(1, -1), 0.85)} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
  </g>
)

/** Løftede vinger (lokalt om skulderen). Roden ligger på brystet; konturen er åben dér. */
const UP_SPINES = {
  cheer: xf([[6, 6], [0, -3], [-9, -13], [-18, -23], [-25, -33]], { dx: WX }),
  wave: xf([[7, 6], [-3, 1], [-14, -4], [-23, -12], [-28, -24], [-30, -36]], { dx: WX }),
  // Tænker: vingespidsen under næbbet.
  think: xf([[6, 7], [14, 1], [21, -6], [25, -12]], { dx: WX }),
  // Ups: vingen op til kinden (genert "hov"), tungen ude.
  oops: xf([[6, 7], [7, -4], [8, -13], [8.5, -21], [8, -27]], { dx: WX }),
}
type UpKind = keyof typeof UP_SPINES
const UP_W = { w0: 19, w1: 10 }
const UP_LOOPS = Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, limbLoop(s, UP_W.w0, UP_W.w1)])) as Record<UpKind, Vec[]>
const tipOf = (s: readonly Vec[]) => s[s.length - 1]
const kindOf = (mood: string): UpKind => (mood in UP_SPINES ? (mood as UpKind) : 'cheer')
/** En fjerlinje langs den løftede vinges rygrad (fra midten mod spidsen). */
const upLine = (s: readonly Vec[]) => spline(s.slice(Math.max(1, Math.floor(s.length / 2) - 1)))

const PawUp: SidePart = ({ pal, sw, mood, lod }) => {
  const kind = kindOf(mood)
  const loop = UP_LOOPS[kind]
  return (
    <>
      <path d={blob(loop)} fill={wing(pal)} />
      {lod === 'full' && !pal.silhouette && <path d={upLine(UP_SPINES[kind])} fill="none" stroke={featherLine(pal, wing(pal))} strokeWidth={sw * 0.5} {...round} />}
      <path d={spline(loop)} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
    </>
  )
}

/** Fyld bag alt ved vingerne (se `pawWebs`): lommernes udvidede hylstre pr. race, stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {}

// ---------------------------------------------------------------------------------------------
// Bryst: en lys oval med små V-fjer i tre rækker (regnbuen: fire flade striber). Foran: fødder med tre kløer.

const CHEVRONS: Vec[] = [[90, 176], [100, 177.5], [110, 176], [84, 188], [94.5, 190], [105.5, 190], [116, 188], [90, 201], [100, 202.5], [110, 201]]

const BodyDeco: Part = ({ pal, a, ids, sw, lod }) => {
  const b = a.bodyCenter
  const stripes = !!pal.gradient
  const marks = join(...CHEVRONS.map(([x, y]) => spline([[x - 3.4, y - 1.8], [x, y + 1.4], [x + 3.4, y - 1.8]])))
  return (
    <>
      <path d={ellipse(b.x, b.y + 4, a.bodyRx * 0.62, a.bodyRy * 0.82)} fill={stripes ? `url(#${ids.gradient})` : pal.belly} clipPath={`url(#${ids.bodyClip})`} />
      {lod === 'full' && !pal.silhouette && !stripes && <path d={marks} fill="none" stroke={featherLine(pal, pal.belly)} strokeWidth={sw * 0.5} {...round} />}
    </>
  )
}

const TOE_ANGLES = [116, 90, 64]
const FOOT_C: Vec = [87, 217.5]
const toes = (c: Vec) => TOE_ANGLES.map((t) => {
  const r = (t * Math.PI) / 180
  return capsule(c, [c[0] + Math.cos(r) * 6.4, c[1] + Math.sin(r) * 6.4], 2.7, 2.2)
})

const Talons: Part = ({ pal, sw }) => (
  <path d={join(...toes(FOOT_C), ...toes([200 - FOOT_C[0], FOOT_C[1]]))} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.8} {...round} />
)

/** Bag kroppen: intet (halen er gemt bag den siddende krop). */
const Feet: Part = () => null

// ---------------------------------------------------------------------------------------------

export const owl: SpeciesDef = {
  id: 'owl',
  name: 'Ugle',
  nameClip: 'name.species.owl',
  family: 'bird',
  body: 'pear',
  breeds: [{ id: 'std', name: 'ugle' }],
  colorways: OWL_COLORWAYS,
  magic: ['gold', 'rainbow'],
  occupies: ['back'],
  anchors: {
    headCenter: { x: 100, y: 96 },
    headRx: 59,
    headRy: 46,
    headTop: { x: 100, y: 51 },
    headWidth: 108,
    earBaseL: { x: 64, y: 62 },
    earBaseR: { x: 136, y: 62 },
    hornBase: { x: 100, y: 52 },
    eyeL: { x: 79, y: 99 },
    eyeR: { x: 121, y: 99 },
    eyeRx: 10.8,
    eyeRy: 12.8,
    muzzle: { x: 100, y: 115 },
    mouth: { x: 100, y: 128.5 },
    cheekL: { x: 62, y: 119 },
    cheekR: { x: 138, y: 119 },
    neck: { x: 100, y: 142 },
    neckWidth: 60,
    bodyCenter: { x: 100, y: 184 },
    bodyRx: 52,
    bodyRy: 42,
    bodyWidth: 104,
    chest: { x: 100, y: 166 },
    back: { x: 100, y: 166 },
    shoulderL: { x: 58.2, y: 155 },
    shoulderR: { x: 141.8, y: 155 },
    pawL: { x: 56, y: 199 },
    pawR: { x: 144, y: 199 },
    handRot: -20,
    footL: { x: 87, y: 220 },
    footR: { x: 113, y: 220 },
    tailBase: { x: 100, y: 222 },
  },
  bounds: {
    head: { x0: 36, y0: 18, x1: 164, y1: 146 },
    body: { x0: 40, y0: 134, x1: 160, y1: 228 },
  },
  // Tankebobler og Zzz (fælles regel): til højre for kinden under fjerøret med mindst 8 enheders luft.
  fx: { x: 178, y: 118 },
  face: { idleMouth: 'smile', cheeks: true },
  ears: { splay: 8 },
  signature: 'head-turn',
  // Guldets glansbånd på kroppens venstre flanke under vingen.
  goldBand: [120, 160],
  // Ups: vingen op til kinden (vingen når ikke om bag nakken).
  poses: {
    oops: { pawL: 0, pawR: { up: true } },
  },
  parts: {
    head: owlHead,
    Ear,
    Paw,
    PawUp,
    PawBack: pawWebs({}, PAW_WEBS),
    pawUpTip: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { x: tipOf(s)[0], y: tipOf(s)[1] }])),
    upArms: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { spine: s, w0: UP_W.w0, w1: UP_W.w1, tip: 7 }])),
    limb: { rot: PAW_ROT, sleeve: () => blob(SLEEVE), cuff: { y: 26, half: 15.2 } },
    Feet,
    Muzzle: Beak,
    HeadDeco: Disc,
    BodyDeco,
    Ruff: Talons,
  },
}

export default owl
