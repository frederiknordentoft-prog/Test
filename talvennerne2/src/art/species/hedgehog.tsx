// Pindsvinet (Engdalen, bølge 2): skabelonen `pear`, én race (std). Et blødt, venligt barnedyr.
// Artstrækket i silhuetten er pigkappen: en rund, takket hætte af bløde pigge (husets parametriske buer,
// aldrig spidse nåle) om hovedet og ned bag kroppen, i to lag, så kappen får dybde. Ansigtet er en lys,
// let ægformet maske med en lille snude og en knapnæse; en takket pandekant af pigge rammer det ind, og
// små runde ører titter frem af piggene. Korte arme hviler på den lyse mave, og fødderne er små.
// Signaturen er at rulle sig halvt sammen og ud igen: hovedet dukker sig, kroppen trykker sig sammen,
// pandekanten ruller ned (`a-roll`), og piggene puster sig op (`a-puff`); så ruller det ud med ét
// overshoot og en pause (rig.css). Alle former er punkter og husets primitiver.
import { OpenLimb, ROUND, hatted, limbLoop, padsPath } from '../parts/kit'
import { shadeOf } from '../rig/palette'
import { Pivot } from '../rig/Rig'
import { blob, ellipse, frame, join, mirrorX, offsetLoop, spikes, spline, symmetric, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, OutlineFn, Palette, Part, SidePart, SpeciesDef, Stage } from '../rig/types'
import { HEDGEHOG_COLORWAYS } from './hedgehog.colorways'

const round = ROUND
/** Piggenes farve: regnbuen som fire flade striber, ellers kappens farve. */
const quills = (pal: Palette, gradientId: string) => (pal.gradient ? `url(#${gradientId})` : pal.mane)
/** Det bageste piglag (en tone mørkere), så kappen får dybde. */
const quillsBack = (pal: Palette) => (pal.silhouette ? pal.mane : (pal.mane2 ?? shadeOf(pal.mane)))

// ---------------------------------------------------------------------------------------------
// Ansigtet: en lys, let ægformet maske, der spidser blødt til om snuden forneden. Øverst møder huden
// piggene i en takket hårgrænse (en spids i midten), så hætten ser ud til at gå ned over panden; den
// takkede kant er en del af ansigtets egen kontur, så der er ingen søm mellem hætte og pande.

const FACE_HALF: Vec[] = [
  [0, -0.66], [-0.17, -0.95], [-0.33, -0.72], [-0.5, -0.93], [-0.66, -0.7], [-0.78, -0.78], [-0.86, -0.5],
  [-0.93, -0.5], [-0.99, -0.26], [-1.0, -0.04], [-0.97, 0.22], [-0.88, 0.5], [-0.7, 0.73], [-0.46, 0.9],
  [-0.22, 1.0], [0, 1.03],
]
const FACE_UNIT = symmetric(FACE_HALF)
const face: OutlineFn = (a: AnchorSet, inflate: number) =>
  blob(offsetLoop(frame(FACE_UNIT, a.headCenter.x, a.headCenter.y, a.headRx, a.headRy), inflate), 0.75)

// ---------------------------------------------------------------------------------------------
// Pigkappen. Hætten om hovedet (bag ansigtet) og kappen bag kroppen er hver to lag pigge: et bageste,
// mørkere lag forskudt en halv pig og et forreste i kappens farve. Piggene peger ud fra centrum og er
// strøget en anelse bagud (swirl). Hætten slutter ved kinderne; kappen fortsætter ned langs kroppen.

interface Ring {
  cx: number
  cy: number
  rx: number
  ry: number
  count: number
  from: number
  to: number
}
const HOOD: Ring = { cx: 100, cy: 100, rx: 63, ry: 58, count: 14, from: 126, to: 414 }
const CAPE: Ring = { cx: 100, cy: 166, rx: 64, ry: 60, count: 12, from: 150, to: 390 }

/**
 * Ét piglag: spidse, let buede pigge (fladere buer og dybere dale end uldens bløde buler), der strøges
 * nedad væk fra issen på begge sider, så hætten er symmetrisk. Det bageste lag er forskudt en halv pig.
 */
function quillRing(r: Ring, back: boolean): string {
  const step = (r.to - r.from) / r.count
  const mid = 270
  const k = back ? 3.5 : 0
  const o = { depth: back ? 0.22 : 0.25, bulge: 0.3 }
  const shift = back ? step / 2 : 0
  // Venstre halvdel (fra kinden op til issen) strøges mod uret, højre halvdel med uret.
  const nL = Math.round((mid - r.from) / step)
  const nR = r.count - nL
  return join(
    spikes(r.cx, r.cy - k / 3, r.rx + k, r.ry + k, nL, { ...o, from: r.from - shift, to: mid - shift, swirl: -5 }),
    spikes(r.cx, r.cy - k / 3, r.rx + k, r.ry + k, nR, { ...o, from: mid - shift, to: r.to - shift, swirl: 5 }),
    // Fyld mellem de to halvdele (bag ansigtet eller kroppen), så der aldrig er en kile uden pigge.
    ellipse(r.cx, r.cy, r.rx * 0.74, r.ry * 0.74),
  )
}

const HOOD_BACK = quillRing(HOOD, true)
const HOOD_FRONT = quillRing(HOOD, false)
const CAPE_BACK = quillRing(CAPE, true)
const CAPE_FRONT = quillRing(CAPE, false)
/** Hætten under en hue: piggene øverst trykkes flade (kun siderne stikker frem under huen). */
const HOOD_HAT: Ring = { ...HOOD, cy: 104, ry: 52, rx: 61 }
const HOOD_HAT_BACK = quillRing(HOOD_HAT, true)
const HOOD_HAT_FRONT = quillRing(HOOD_HAT, false)

const Hood: Part = ({ pal, sw, ids, still, hat }) => {
  const flat = hat === 'through'
  return (
    <Pivot at={{ x: 100, y: 104 }} cls="a-roll" still={still}>
      <g transform="translate(-100 -104)">
        <path d={flat ? HOOD_HAT_BACK : HOOD_BACK} fill={quillsBack(pal)} stroke={pal.maneOutline} strokeWidth={sw} {...round} />
        <path d={flat ? HOOD_HAT_FRONT : HOOD_FRONT} fill={quills(pal, ids.gradient)} stroke={pal.maneOutline} strokeWidth={sw} {...round} />
      </g>
    </Pivot>
  )
}

// ---------------------------------------------------------------------------------------------
// Ører: små, runde ører, der titter frem af piggene (lokalt: roden i (0,0), peger op).

const EAR: Vec[] = [[0, 6], [-8.2, 3.5], [-10.4, -3.5], [-8.8, -10.6], [-4, -14.4], [1.4, -14.6], [6.4, -11.6], [9.2, -5.4], [8.8, 1.5], [5.6, 5.6]]
const EAR_INNER: Vec[] = [[-0.2, -0.8], [-5.2, -3.6], [-5.4, -8.6], [-2.4, -11], [1.6, -10.8], [4.6, -7.6], [4.6, -3.2], [2.4, -0.6]]
const EAR_HATTED = hatted(EAR, -4, 3.5)
const earScale = (stage: Stage) => (stage === 1 ? { sx: 1.24, sy: 1.22 } : { sx: 1.14, sy: 1.14 })

const Ear: SidePart = ({ pal, sw, stage, hat }) => {
  const s = earScale(stage)
  return (
    <>
      <path d={blob(xf(hat === 'through' ? EAR_HATTED : EAR, s), 0.9)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      <path d={blob(xf(EAR_INNER, s), 0.9)} fill={pal.inner} />
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Arme: korte, buttede arme, der kommer frem under kappen og hviler med poterne på maven (åben kontur
// ved roden). Tegnet lodret og drejet ind mod maven.

const PAW_ROT = -50
const ARM_SPINE: Vec[] = [[0, -7], [0, 2], [0, 10], [0, 17]]
const ARM = limbLoop(ARM_SPINE, 13.5, 15.5, 7)
const ARM_TOES: Vec[][] = [
  [[-2.8, 23.6], [-2.6, 20]],
  [[2.8, 23.6], [2.6, 20]],
]
/** Ærmet: armen fra roden til manchetten, en anelse løsere end armen (lodret ramme). */
const SLEEVE: Vec[] = [[-9, -10], [-9.4, -2], [-9.8, 6], [-10, 12], [0, 13.6], [10, 12], [9.8, 6], [9.4, -2], [9, -10], [0, -12]]

const Paw: SidePart = ({ pal, sw, lod }) => (
  <g transform={`rotate(${PAW_ROT})`}>
    <OpenLimb loop={ARM} fill={pal.fur} stroke={pal.outline} sw={sw} trim={1}>
      {lod === 'full' && <path d={join(...ARM_TOES.map((t) => spline(t)))} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />}
    </OpenLimb>
  </g>
)

/** Løftede arme (lokalt om skulderen). Roden ligger på brystet; konturen er åben dér. */
const UP_SPINES = {
  cheer: [[6, 6], [0, -2], [-7, -10], [-13, -18], [-17, -25]] as Vec[],
  wave: [[7, 6], [-2, 2], [-11, -2], [-18, -9], [-21, -18], [-22, -28]] as Vec[],
  // Tænker: poten under hagen.
  think: [[6, 7], [13, 1], [19, -6], [23, -13]] as Vec[],
  // Ups: poten op til kinden (genert "hov"), tungen ude.
  oops: [[6, 7], [7, -3], [8, -12], [8.5, -20], [8, -27]] as Vec[],
}
const UP_LOOPS = {
  cheer: limbLoop(UP_SPINES.cheer, 13, 15.5),
  wave: limbLoop(UP_SPINES.wave, 13, 15.5),
  think: limbLoop(UP_SPINES.think, 13, 15),
  oops: limbLoop(UP_SPINES.oops, 13, 15),
}
const tipOf = (s: readonly Vec[]) => s[s.length - 1]

const PawUp: SidePart = ({ pal, sw, mood, lod }) => {
  const kind = mood === 'wave' ? 'wave' : mood === 'think' ? 'think' : mood === 'oops' ? 'oops' : 'cheer'
  const [tx, ty] = tipOf(UP_SPINES[kind])
  const side = kind === 'think' || kind === 'oops'
  const detail = side
    ? lod === 'full' && <path d={join(spline([[tx + 1.2, ty - 5], [tx + 4.4, ty - 2.8]]), spline([[tx + 2.6, ty - 0.6], [tx + 5.6, ty + 1.4]]))} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />
    : !pal.silhouette && <path d={padsPath(tx, ty + 0.4, 7, kind === 'wave' ? -4 : -32)} fill={pal.inner} />
  return (
    <OpenLimb loop={UP_LOOPS[kind]} fill={pal.fur} stroke={pal.outline} sw={sw}>
      {detail}
    </OpenLimb>
  )
}

// ---------------------------------------------------------------------------------------------
// Bag kroppen: pigkappen (to lag), der puster sig op i signaturen (`a-puff`). Foran kroppen: små fødder,
// der titter frem under maven med tåstreger (tegnet efter maven og skyggen, før kropstøjet).

const CapeLayer: Part = ({ pal, sw, ids, still }) => (
  <Pivot at={{ x: 100, y: 176 }} cls="a-puff" still={still}>
    <g transform="translate(-100 -176)">
      <path d={CAPE_BACK} fill={quillsBack(pal)} stroke={pal.maneOutline} strokeWidth={sw} {...round} />
      <path d={CAPE_FRONT} fill={quills(pal, ids.gradient)} stroke={pal.maneOutline} strokeWidth={sw} {...round} />
    </g>
  </Pivot>
)

const FOOT = { cx: 80, cy: 222, rx: 12, ry: 6.8, rot: -8 }
const FOOT_TOES: Vec[][] = [
  [[74.4, 227.4], [75, 223.4]],
  [[80.2, 228.4], [80.4, 224.2]],
]
const FrontFeet: Part = ({ pal, sw, lod }) => {
  const f = FOOT
  const feet = join(ellipse(f.cx, f.cy, f.rx, f.ry, f.rot), ellipse(200 - f.cx, f.cy, f.rx, f.ry, -f.rot))
  const toes = FOOT_TOES.flatMap((t) => [spline(t), spline(mirrorX(t, 100))])
  return (
    <>
      <path d={feet} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
      {lod === 'full' && <path d={join(...toes)} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Ansigt: en lille, lysere snude med en blank knapnæse.

const Muzzle: Part = ({ pal, sw, a, ids }) => {
  const m = a.muzzle
  return (
    <>
      {!pal.silhouette && <path d={ellipse(m.x, m.y + 5, 13.5, 10)} fill={pal.belly} clipPath={`url(#${ids.headClip})`} />}
      <path d={ellipse(m.x, m.y, 6, 4.7)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.42} />
      {!pal.silhouette && <path d={ellipse(m.x - 2, m.y - 1.7, 2.2, 1.3, -15)} fill={pal.highlight} />}
    </>
  )
}

/** Den lyse mave (en blød oval) og et lille fnug under hagen. */
const BodyDeco: Part = ({ pal, a, ids }) => (
  <path d={ellipse(a.bodyCenter.x, a.bodyCenter.y + 8, a.bodyRx * 0.66, a.bodyRy * 0.74)} fill={pal.belly} clipPath={`url(#${ids.bodyClip})`} />
)

// ---------------------------------------------------------------------------------------------

export const hedgehog: SpeciesDef = {
  id: 'hedgehog',
  name: 'Pindsvin',
  nameClip: 'name.species.hedgehog',
  family: 'insectivore',
  body: 'pear',
  // Pigkappen vokser kun lidt på stor (den skal blive i den sikre zone og fri af tankeboblerne).
  breeds: [{ id: 'std', name: 'pindsvin', maneGrowth: 1.06 }],
  colorways: HEDGEHOG_COLORWAYS,
  magic: ['gold', 'rainbow'],
  anchors: {
    headCenter: { x: 100, y: 104 },
    headRx: 46,
    headRy: 42,
    headTop: { x: 100, y: 54 },
    headWidth: 100,
    earBaseL: { x: 70, y: 63 },
    earBaseR: { x: 130, y: 63 },
    hornBase: { x: 100, y: 60 },
    eyeL: { x: 81, y: 106 },
    eyeR: { x: 119, y: 106 },
    eyeRx: 9.8,
    eyeRy: 12.2,
    muzzle: { x: 100, y: 125 },
    mouth: { x: 100, y: 134 },
    cheekL: { x: 70, y: 124 },
    cheekR: { x: 130, y: 124 },
    neck: { x: 100, y: 148 },
    neckWidth: 60,
    bodyCenter: { x: 100, y: 186 },
    bodyRx: 50,
    bodyRy: 40,
    bodyWidth: 100,
    chest: { x: 100, y: 172 },
    back: { x: 100, y: 170 },
    shoulderL: { x: 66, y: 163 },
    shoulderR: { x: 134, y: 163 },
    pawL: { x: 80, y: 175 },
    pawR: { x: 120, y: 175 },
    handRot: -20,
    footL: { x: 80, y: 222 },
    footR: { x: 120, y: 222 },
    tailBase: { x: 146, y: 214 },
  },
  bounds: {
    head: { x0: 34, y0: 38, x1: 166, y1: 150 },
    body: { x0: 36, y0: 128, x1: 164, y1: 228 },
  },
  // Tankebobler og Zzz (fælles regel): til højre over hætten med mindst 8 enheders luft til pigge og ører.
  fx: { x: 178, y: 56 },
  face: { idleMouth: 'smile', cheeks: true },
  ears: { splay: 34 },
  signature: 'curl-up',
  // Guldets glansbånd på kroppens venstre flanke under armen.
  goldBand: [146, 192],
  // Ups: poten op til kinden (ikke bag nakken, hvor pigkappen ville skjule den).
  poses: {
    oops: { pawL: 0, pawR: { up: true } },
  },
  parts: {
    head: face,
    Ear,
    Paw,
    PawUp,
    pawUpTip: { cheer: { x: -17, y: -25 }, wave: { x: -22, y: -28 }, think: { x: 23, y: -13 }, oops: { x: 8, y: -27 } },
    upArms: {
      cheer: { spine: UP_SPINES.cheer, w0: 13, w1: 15.5, tip: 8.5 },
      wave: { spine: UP_SPINES.wave, w0: 13, w1: 15.5, tip: 8.5 },
      think: { spine: UP_SPINES.think, w0: 13, w1: 15, tip: 8 },
      oops: { spine: UP_SPINES.oops, w0: 13, w1: 15, tip: 8 },
    },
    limb: { rot: PAW_ROT, sleeve: () => blob(SLEEVE), cuff: { y: 11, half: 10.2 } },
    Feet: CapeLayer,
    Muzzle,
    BodyDeco,
    Ruff: FrontFeet,
    ManeBack: Hood,
  },
}

export default hedgehog
