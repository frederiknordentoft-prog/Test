// Isbjørnen (Stjernefjeldet, bølge 3): skabelonen `round`, én race (std). Artstrækkene står i silhuetten, så isbjørnen
// aldrig læses som en panda, en hamster eller en hvalp (review G2-r1 §2 og integratorens blinde for-test, hvor hamsteren
// blev læst som "isbjørn eller panda uden bambus"):
// - et bredt, lavt og fladt hoved med en lang snude, der rager ned under kinderne (pandaen og hamsteren har runde hoveder),
// - små, runde ører, der sidder lavt og bagud på hovedets sider (tegnet bag hovedet; pandaens store ører sidder højt),
// - en højere krop med lang hals og kraftige forben, der står lodret ned til jorden med store poter og kløer, og
// - bagbenenes lår og poter, der stikker frem ved siderne.
// Hvid pels på papirfarven bæres af konturen og cel-skyggen (og en snude-skygge, der viser snudens længde).
// Signaturen er snuse-næsen: næsen snuser tre gange med squash og et overshoot, mens hovedet løfter sig mod luften
// (`a-sniff` om næsen og hovedets løft i hvile, rig.css). Alle former er punkter og husets primitiver.
import { ROUND, limbLoop, padsPath, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { mixHex } from '../rig/oklch'
import { Pivot } from '../rig/Rig'
import { blob, ellipse, frame, join, mirrorX, offsetLoop, spline, symmetric, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, OutlineFn, Palette, Part, SidePart, SpeciesDef, Stage } from '../rig/types'
import { POLARBEAR_COLORWAYS } from './polarbear.colorways'

const round = ROUND
/** Trædepuder og kløer (sort i silhuet). */
const pads = (pal: Palette) => pal.pattern
/** Snudens og pelsens bløde folder: en tone mellem pelsen og konturen. */
const crease = (pal: Palette) => mixHex(pal.shade, pal.outline, 0.35)

// ---------------------------------------------------------------------------------------------
// Hoved: bredt og lavt med en flad isse, kinder og en lang snude, der rager ned under kinderne (en blød talje ved
// kinderne, så snuden står frem i silhuetten).

const HEAD_HALF: Vec[] = [
  [0, -1.0], [-0.46, -0.98], [-0.78, -0.86], [-0.96, -0.6], [-1.03, -0.26], [-1.0, 0.08], [-0.9, 0.38], [-0.74, 0.64],
  [-0.58, 0.86], [-0.46, 1.04], [-0.37, 1.19], [-0.23, 1.3], [0, 1.34],
]
const HEAD_UNIT = symmetric(HEAD_HALF)
const bearHead: OutlineFn = (a: AnchorSet, inflate: number) =>
  blob(offsetLoop(frame(HEAD_UNIT, a.headCenter.x, a.headCenter.y, a.headRx, a.headRy), inflate), 0.86)

// ---------------------------------------------------------------------------------------------
// Krop: en tung krop med brede skuldre og flad bund (ikke en kugle), så hovedets kile står foran skuldrene.

const BODY_HALF: Vec[] = [
  [0, -0.92], [-0.36, -0.93], [-0.68, -0.83], [-0.88, -0.64], [-0.98, -0.36], [-1.02, 0], [-1.03, 0.32], [-0.99, 0.62],
  [-0.88, 0.86], [-0.64, 0.99], [-0.32, 1.02], [0, 1.02],
]
const BODY_UNIT = symmetric(BODY_HALF)
const bearBody: OutlineFn = (a: AnchorSet, inflate: number) =>
  blob(offsetLoop(frame(BODY_UNIT, a.bodyCenter.x, a.bodyCenter.y, a.bodyRx, a.bodyRy), inflate), 0.9)

// ---------------------------------------------------------------------------------------------
// Ører: små og runde, lavt og bagud på hovedets sider (bag hovedet, lokalt: roden i (0,0), peger op).

const EAR_R = 9.6
const EAR: Vec[] = xf([[0, 6], [-7.4, 3], [-9.6, -4.6], [-7, -12.6], [0, -15.6], [7, -12.6], [9.6, -4.6], [7.4, 3]], { sx: 1.12 })
const earScale = (stage: Stage) => (stage === 1 ? { sx: 1.1, sy: 1.1 } : {})

const Ear: SidePart = ({ pal, sw, stage }) => {
  const s = earScale(stage)
  const k = s.sx ?? 1
  return (
    <>
      <path d={blob(xf(EAR, s), 0.9)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      {!pal.silhouette && <path d={ellipse(0.6 * k, -5.8 * k, EAR_R * 0.48 * k, EAR_R * 0.54 * k)} fill={pal.inner} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Snude: den lyse snude, der fylder hovedets nederste del, to bløde folder langs dens sider (snudens længde), en stor,
// blank næse (signaturen snuser) og et lille filtrum ned mod munden.

const NOSE: Vec[] = [[0, 5.2], [-4.4, 3.4], [-8, -0.2], [-8, -3.4], [-4, -5], [0, -5.4], [4, -5], [8, -3.4], [8, -0.2], [4.4, 3.4]]
const FOLD: Vec[] = [[-15.6, -14], [-19.6, -4], [-19.8, 7], [-16.4, 17]]

const Snout: Part = ({ pal, sw, a, ids, lod, still }) => {
  const m = a.muzzle
  const sil = pal.silhouette
  return (
    <>
      {!sil && <path d={ellipse(m.x, m.y + 7, 25, 21)} fill={pal.belly} clipPath={`url(#${ids.headClip})`} />}
      {!sil && lod === 'full' && (
        <path d={join(spline(xf(FOLD, { dx: m.x, dy: m.y })), spline(mirrorX(xf(FOLD, { dx: m.x, dy: m.y }), m.x)))} fill="none" stroke={crease(pal)} strokeWidth={sw * 0.5} {...round} />
      )}
      <Pivot at={{ x: m.x, y: m.y }} cls="a-sniff" still={still}>
        <path d={blob(NOSE, 0.85)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.42} {...round} />
        {!sil && <path d={ellipse(-2.6, -2.4, 2.8, 1.4, -12)} fill={pal.highlight} />}
      </Pivot>
      {!sil && <path d={spline([[m.x, m.y + 5], [m.x, m.y + 11]])} fill="none" stroke={pal.ink} strokeWidth={sw * 0.6} {...round} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Forben (lokalt om skulderen): kraftige søjler, der står lodret ned til jorden og breder sig ud i store poter med
// tåfolder og kløer. Konturen er åben ved skulderen (roden gemmer sig under hovedet og i kroppen).

const LEG: Vec[] = [
  [13, -12], [13.4, 4], [13.4, 18], [13.8, 30], [15.4, 39], [18.4, 46], [19, 53.4], [15.6, 59.6], [8, 62.6], [-1.4, 63.2], [-10.4, 62],
  [-16.4, 57.4], [-16.6, 50], [-14, 41.6], [-12.8, 30], [-12.8, 18], [-12.6, 4], [-12.2, -12],
]
const TOES: Vec[][] = [[[-5.6, 53.4], [-5.2, 59.6]], [[4.2, 53.4], [4.6, 59.8]]]
const CLAWS: Vec[] = [[-10.4, 61.8], [-0.6, 63.2], [9.4, 62.2]]
const clawsAt = (pts: readonly Vec[], r = 2.3) => join(...pts.map(([x, y]) => ellipse(x, y, r * 0.86, r)))
/** Ærmet: fra skulderen ned til manchetten over poten (lodret ramme), en anelse løsere end benet. */
const LEG_SLEEVE: Vec[] = [
  [-14, -14], [-14.6, 0], [-15, 14], [-15.2, 26], [-15.4, 35], [0, 37.6], [15.4, 35], [15.2, 26], [15, 14], [14.6, 0], [14, -14], [0, -16],
]

const Leg: SidePart = ({ pal, sw, lod }) => (
  <>
    <path d={blob(LEG, 0.8)} fill={pal.fur} />
    <path d={spline(LEG.slice(1, -1), 0.8)} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
    {lod === 'full' && !pal.silhouette && <path d={join(...TOES.map((t) => spline(t)))} fill="none" stroke={crease(pal)} strokeWidth={sw * 0.5} {...round} />}
    <path d={clawsAt(CLAWS)} fill={pads(pal)} />
  </>
)

/** Løftede forben (lokalt om skulderen). Roden ligger på brystet; konturen er åben dér. */
const UP_SPINES = {
  // Glad: poterne ud til siden i brysthøjde, tegnet drejet −30°, så glad-hoppets 30° (rig.css) bringer dem på plads.
  happy: xf([[3, 4], [-7, -1], [-17, -5], [-26, -8], [-34, -9]], { rot: -30 }),
  cheer: [[6, 6], [0, -3], [-8, -13], [-16, -23], [-22, -33]] as Vec[],
  wave: [[7, 6], [-3, 1], [-14, -4], [-23, -12], [-27, -24], [-28, -36]] as Vec[],
  // Tænker: poten under snuden.
  think: [[6, 7], [13, 1], [19, -6], [22, -12]] as Vec[],
  // Ups: poten op til kinden ved snuden (genert "hov"), tungen ude.
  oops: [[6, 7], [7, -4], [8, -13], [8.5, -20], [8, -25]] as Vec[],
}
type UpKind = keyof typeof UP_SPINES
const UP_W = { w0: 23, w1: 24 }
const UP_LOOPS = Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, limbLoop(s, UP_W.w0, UP_W.w1)])) as Record<UpKind, Vec[]>
const tipOf = (s: readonly Vec[]) => s[s.length - 1]
const kindOf = (mood: string): UpKind => (mood in UP_SPINES ? (mood as UpKind) : 'cheer')

const PawUp: SidePart = ({ pal, sw, mood }) => {
  const kind = kindOf(mood)
  const [tx, ty] = tipOf(UP_SPINES[kind])
  const loop = UP_LOOPS[kind]
  const palm = kind === 'cheer' || kind === 'wave' || kind === 'happy'
  return (
    <>
      <path d={blob(loop)} fill={pal.fur} />
      <path d={spline(loop)} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
      {palm && !pal.silhouette && <path d={padsPath(tx, ty + 0.6, 10.6, kind === 'wave' ? -4 : kind === 'happy' ? -64 : -32)} fill={pads(pal)} />}
    </>
  )
}

/** Fyld bag alt ved armene (se `pawWebs`): lommernes udvidede hylstre pr. race, stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {}

// ---------------------------------------------------------------------------------------------
// Bagben (bag kroppen): lårene og de store bagpoter, der stikker frem ved siderne.

const HAUNCH = { cx: 59, cy: 204, rx: 20, ry: 18.5, rot: -18 }
const HIND = { cx: 51.6, cy: 219.2, rx: 15.4, ry: 7.4, rot: -4 }
const HIND_TOES: Vec[][] = [[[42.6, 216.6], [41.4, 221.6]], [[49.4, 215.4], [48.8, 221.2]]]

const Feet: Part = ({ pal, sw, lod }) => {
  const e = (o: typeof HAUNCH, mirror: boolean) => ellipse(mirror ? 200 - o.cx : o.cx, o.cy, o.rx, o.ry, mirror ? -o.rot : o.rot)
  return (
    <>
      <path d={join(e(HAUNCH, false), e(HAUNCH, true), e(HIND, false), e(HIND, true))} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
      {lod === 'full' && !pal.silhouette && (
        <path d={join(...[...HIND_TOES, ...HIND_TOES.map((t) => mirrorX(t, 100))].map((t) => spline(t)))} fill="none" stroke={crease(pal)} strokeWidth={sw * 0.5} {...round} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Krop: en lys mave (regnbuen: fire flade striber) og en blød pelstot under hagen.

const TUFT: Vec[][] = [[[92, 150], [95, 155.4], [97.4, 151.6]], [[102.6, 151.6], [105, 155.4], [108, 150]]]

const BodyDeco: Part = ({ pal, a, ids, sw, lod }) => (
  <>
    <path d={ellipse(a.bodyCenter.x, a.bodyCenter.y + 8, a.bodyRx * 0.62, a.bodyRy * 0.74)} fill={pal.gradient ? `url(#${ids.gradient})` : pal.belly} clipPath={`url(#${ids.bodyClip})`} />
    {lod === 'full' && !pal.silhouette && <path d={join(...TUFT.map((t) => spline(t)))} fill="none" stroke={crease(pal)} strokeWidth={sw * 0.5} {...round} />}
  </>
)

// ---------------------------------------------------------------------------------------------

export const polarbear: SpeciesDef = {
  id: 'polarbear',
  name: 'Isbjørn',
  nameClip: 'name.species.polarbear',
  family: 'bear',
  body: 'round',
  breeds: [{ id: 'std', name: 'isbjørn' }],
  colorways: POLARBEAR_COLORWAYS,
  magic: ['gold', 'rainbow'],
  anchors: {
    headCenter: { x: 100, y: 93 },
    headRx: 51,
    headRy: 38,
    // Hatte sidder på den flade isse: ankeret ligger over den, så skyggen og kanten går fri af øjnene.
    headTop: { x: 100, y: 49 },
    headWidth: 102,
    earBaseL: { x: 57, y: 74 },
    earBaseR: { x: 143, y: 74 },
    // Hatte mellem ørerne sidder på issen (ørerne sidder lavt på siderne).
    earGap: 70,
    hornBase: { x: 100, y: 58 },
    eyeL: { x: 79, y: 93 },
    eyeR: { x: 121, y: 93 },
    eyeRx: 9.4,
    eyeRy: 11.8,
    muzzle: { x: 100, y: 117 },
    mouth: { x: 100, y: 133 },
    cheekL: { x: 67, y: 108 },
    cheekR: { x: 133, y: 108 },
    neck: { x: 100, y: 146 },
    neckWidth: 56,
    bodyCenter: { x: 100, y: 182 },
    bodyRx: 50,
    bodyRy: 44,
    bodyWidth: 100,
    chest: { x: 100, y: 166 },
    back: { x: 100, y: 166 },
    shoulderL: { x: 79, y: 162 },
    shoulderR: { x: 121, y: 162 },
    pawL: { x: 79, y: 214 },
    pawR: { x: 121, y: 214 },
    handRot: -20,
    footL: { x: 52, y: 219 },
    footR: { x: 148, y: 219 },
    tailBase: { x: 146, y: 212 },
  },
  bounds: {
    head: { x0: 30, y0: 52, x1: 170, y1: 147 },
    body: { x0: 30, y0: 120, x1: 170, y1: 228 },
  },
  // Tankebobler og Zzz (fælles regel): til højre for kinden under øret med mindst 8 enheders luft.
  fx: { x: 180, y: 116 },
  face: { idleMouth: 'smile', cheeks: true },
  ears: { splay: 58, behind: true, clip: false },
  signature: 'sniff',
  // Guldets glansbånd på kroppens venstre flanke uden for forbenet.
  goldBand: [176, 214],
  // Ups: poten op til kinden ved snuden (de kraftige forben når ikke om bag nakken).
  poses: {
    happy: { pawL: { up: true, rot: 30 }, pawR: { up: true, rot: 30 } },
    oops: { pawL: 0, pawR: { up: true } },
  },
  parts: {
    head: bearHead,
    body: bearBody,
    Ear,
    Paw: Leg,
    PawUp,
    PawBack: pawWebs({}, PAW_WEBS),
    pawUpTip: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { x: tipOf(s)[0], y: tipOf(s)[1] }])),
    upArms: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { spine: s, w0: UP_W.w0, w1: UP_W.w1, tip: 8 }])),
    limb: { rot: 0, sleeve: () => blob(LEG_SLEEVE), cuff: { y: 35, half: 15.4 } },
    Feet,
    Muzzle: Snout,
    BodyDeco,
  },
}

export default polarbear
