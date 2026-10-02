// Egernet (Regnbueskoven, bølge 3): skabelonen `pear`, én race (std). Artens kendetegn i silhuetten er den store,
// buede hale: en busket fane, der rejser sig bag ryggen højere end hovedet og slår en krølle udad i toppen (et S).
// Dertil spidse ører med hårtotter i spidsen, en lille pæreformet krop med små hænder samlet foran brystet og
// lange bagfødder. Halen har en lys, fnugget kant og en mørkere kerne; regnbuen bærer de fire flade striber i
// halen.
// Signaturen er halesvirpet: halens øverste krølle sidder i sin egen pivot (`a-curl`, rig.css) og svirper ind mod
// hovedet, slår et overshoot ud og falder til ro. Leddet er tegnet i tre lag (som kattens hale), så det er sømløst.
// Alle former er punkter og husets primitiver.
import { ROUND, hatted, limbLoop, padsPath, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { mixHex } from '../rig/oklch'
import { Pivot } from '../rig/Rig'
import { blob, ellipse, join, mirrorX, poly, ribbon, spline, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { Part, SidePart, SpeciesDef, Stage } from '../rig/types'
import { SQUIRREL_COLORWAYS } from './squirrel.colorways'

const round = ROUND

// ---------------------------------------------------------------------------------------------
// Halen (modelrummet, bag kroppens højre side): rygraden stiger op langs ryggen og slår en krølle udad i toppen.

/** Halens rod i modelrummet (bag kroppens højre side, ved hoften). */
const TAIL_BASE: Vec = [121, 214]
const TAIL_SPINE: Vec[] = xf(
  [[0, 0], [15, -6], [28, -20], [36, -40], [38.5, -64], [37.5, -88], [32.5, -110], [26.5, -130], [27.5, -148], [37, -160], [48.5, -162], [55, -154]],
  { dx: TAIL_BASE[0], dy: TAIL_BASE[1] },
)
const TAIL_W = [16, 26, 34, 39, 42, 44, 43, 40, 34, 26, 15, 4]
/** Leddet: krøllen fra dette punkt på rygraden svirper om det. */
const JOINT = 6
const PIVOT = TAIL_SPINE[JOINT]

/** Fnugget kant: mellem hvert par punkter på konturen skubbes et ekstra punkt `amp` udad (en blød tot). */
function fluff(pts: readonly Vec[], amp: number): Vec[] {
  const out: Vec[] = []
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    const dx = q[0] - p[0]
    const dy = q[1] - p[1]
    const l = Math.hypot(dx, dy) || 1
    out.push(p)
    if (l > 9) out.push([(p[0] + q[0]) / 2 + (dy / l) * amp, (p[1] + q[1]) / 2 - (dx / l) * amp])
  }
  return out
}

const part = (from: number, to: number, k = 1) => ribbon(TAIL_SPINE.slice(from, to), TAIL_W.slice(from, to).map((w) => w * k))
const LOWER = blob(fluff(part(0, JOINT + 2), 1.8), 1)
const LOWER_CORE = blob(part(0, JOINT + 2, 0.5), 0.9)
const toPivot = (pts: readonly Vec[]) => xf(pts, { dx: -PIVOT[0], dy: -PIVOT[1] })
const UPPER = blob(toPivot(fluff(part(JOINT - 1, TAIL_SPINE.length), 1.8)), 1)
const UPPER_CORE = blob(toPivot(part(JOINT - 1, TAIL_SPINE.length, 0.5)), 0.9)

/**
 * Halen tegnes i modelrummet bag kroppen (i fødernes lag, ikke riggens hale-led): den er så høj, at riggens
 * halevift (op til ±14°) ville svinge toppen uden for den sikre zone. Den lever i stedet med kroppens ånding og
 * sit eget svirp i krøllen, og den vokser med kroppen (ikke riggens ekstra ·1,3 på stor).
 */
/**
 * Lommen mellem hagen, skulderen og halens inderside (huller-reglen): pels i skyggetone bag alt, så der aldrig ses
 * baggrund inde i figuren. Hjørnerne ligger inde i hoved, hale eller krop på alle stadier, så fyldet kun ses i lommen.
 */
const POCKET: Vec[] = [[110, 160], [112, 132], [128, 126], [141, 124], [143, 150], [142, 176], [128, 180]]

const Tail: Part = ({ pal, sw, still, ids }) => {
  const stripes = !!pal.gradient
  const fringe = pal.silhouette ? pal.mane : stripes ? `url(#${ids.gradient})` : mixHex(pal.mane, pal.belly, 0.38)
  const core = !pal.silhouette && !stripes
  return (
    <>
      <path d={poly(POCKET)} fill={pal.shade} />
      <path d={LOWER} fill="none" stroke={pal.maneOutline} strokeWidth={sw} {...round} />
      <Pivot at={{ x: PIVOT[0], y: PIVOT[1] }} cls="a-curl" still={still}>
        <path d={UPPER} fill={fringe} stroke={pal.maneOutline} strokeWidth={sw} {...round} />
        {core && <path d={UPPER_CORE} fill={pal.mane} />}
      </Pivot>
      <path d={LOWER} fill={fringe} />
      {core && <path d={LOWER_CORE} fill={pal.mane} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Ører (lokalt: roden i (0,0), peger op): spidse ører med en hårtot i spidsen.

const EAR: Vec[] = [
  [0, 6], [-9, 3.5], [-11.6, -5], [-10.6, -15.5], [-7.4, -24], [-5, -29], [-8.6, -36.6], [-3, -33.4], [-1.4, -44],
  [1.8, -34.2], [7.6, -39.6], [4.4, -29.4], [7.4, -22.5], [10.6, -13], [11.2, -3.5], [8, 3.5],
]
const EAR_INNER: Vec[] = [[0, -1], [-5.8, -4], [-6.4, -12], [-4.4, -20.5], [-1.4, -25.5], [1.6, -24.5], [4.4, -18], [5.6, -9.5], [4.4, -3]]
const EAR_HATTED = hatted(EAR, -5, 3.5)
const earScale = (stage: Stage) => (stage === 1 ? { sx: 1.1, sy: 1.08 } : {})

const Ear: SidePart = ({ pal, sw, stage, hat }) => {
  const s = earScale(stage)
  return (
    <>
      <path d={blob(xf(hat === 'through' ? EAR_HATTED : EAR, s), 0.75)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      {!pal.silhouette && <path d={blob(xf(EAR_INNER, s), 0.9)} fill={pal.inner} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Arme: korte arme med små hænder samlet foran brystet (åben kontur ved roden), drejet ind mod brystet.

const PAW_ROT = -52
const ARM_SPINE: Vec[] = [[0, -7], [0, 2], [0, 10], [0, 17]]
const ARM = limbLoop(ARM_SPINE, 12.5, 13.5, 7)
const ARM_TOES: Vec[][] = [
  [[-2.4, 23], [-2.2, 19.6]],
  [[2.4, 23], [2.2, 19.6]],
]
/** Ærmet: armen fra roden til manchetten lige over hånden (lodret ramme), en anelse løsere end armen. */
const SLEEVE: Vec[] = [[-8.6, -10], [-9, -2], [-9.4, 6], [-9.6, 12], [0, 13.4], [9.6, 12], [9.4, 6], [9, -2], [8.6, -10], [0, -12]]

const Paw: SidePart = ({ pal, sw, lod }) => (
  <g transform={`rotate(${PAW_ROT})`}>
    <path d={blob(ARM)} fill={pal.fur} />
    <path d={spline(ARM.slice(1, -1))} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
    {lod === 'full' && !pal.silhouette && <path d={join(...ARM_TOES.map((t) => spline(t)))} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />}
  </g>
)

/** Løftede arme (lokalt om skulderen). Roden ligger på brystet; konturen er åben dér. */
const UP_SPINES = {
  cheer: [[6, 6], [0, -2], [-7, -10], [-13, -18], [-17, -26]] as Vec[],
  wave: [[7, 6], [-2, 2], [-11, -2], [-18, -9], [-21, -18], [-22, -28]] as Vec[],
  // Tænker: hånden under hagen.
  think: [[6, 7], [12, 1], [17, -5], [20, -10]] as Vec[],
  // Ups: hånden op til kinden (genert "hov"), tungen ude.
  oops: [[6, 7], [7, -3], [8, -11], [8.5, -18], [8, -23]] as Vec[],
}
type UpKind = keyof typeof UP_SPINES
const UP_W = { w0: 12.5, w1: 13.5 }
const UP_LOOPS = Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, limbLoop(s, UP_W.w0, UP_W.w1)])) as Record<UpKind, Vec[]>
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
      <path d={spline(loop)} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
      {palm && !pal.silhouette && <path d={padsPath(tx, ty + 0.4, 6, kind === 'wave' ? -4 : -32)} fill={pal.inner} />}
    </>
  )
}

/** Fyld bag alt ved armene (se `pawWebs`): lommernes udvidede hylstre pr. race, stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {}

// ---------------------------------------------------------------------------------------------
// Bag kroppen: lårbuler ved siderne. Foran kroppen: lange bagfødder, der peger frem og ud, med tåstreger.

const HAUNCH = { cx: 62, cy: 205, rx: 15, ry: 16, rot: -16 }
const Haunches: Part = (p) => {
  const h = HAUNCH
  return (
    <>
      <Tail {...p} />
      <path d={join(ellipse(h.cx, h.cy, h.rx, h.ry, h.rot), ellipse(200 - h.cx, h.cy, h.rx, h.ry, -h.rot))} fill={p.pal.fur} stroke={p.pal.outline} strokeWidth={p.sw} {...round} />
    </>
  )
}

const FOOT = { cx: 74, cy: 221.5, rx: 15, ry: 6.4, rot: -10 }
const FOOT_TOES: Vec[][] = [
  [[63.6, 225.6], [64.6, 221.6]],
  [[69.4, 227], [69.8, 223]],
]
const FrontFeet: Part = ({ pal, sw, lod }) => {
  const f = FOOT
  const feet = join(ellipse(f.cx, f.cy, f.rx, f.ry, f.rot), ellipse(200 - f.cx, f.cy, f.rx, f.ry, -f.rot))
  const toes = FOOT_TOES.flatMap((t) => [spline(t), spline(mirrorX(t, 100))])
  return (
    <>
      <path d={feet} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
      {lod === 'full' && !pal.silhouette && <path d={join(...toes)} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />}
    </>
  )
}

/** Den lyse mave (en blød oval) helt op under hagen. */
const BodyDeco: Part = ({ pal, a, ids }) => (
  <path d={ellipse(a.bodyCenter.x, a.bodyCenter.y + 4, a.bodyRx * 0.64, a.bodyRy * 0.86)} fill={pal.belly} clipPath={`url(#${ids.bodyClip})`} />
)

// ---------------------------------------------------------------------------------------------
// Ansigt: en lys mule med en lille, blank næse og knurhårsprikker.

const NOSE: Vec[] = [[0, 2.8], [-3, 0.8], [-4.2, -1.6], [-2.8, -3], [0, -3.2], [2.8, -3], [4.2, -1.6], [3, 0.8]]
const DOTS: Vec[] = [[-9, 4.2], [-12, 7], [-8.4, 8.6]]

const Muzzle: Part = ({ pal, sw, a, ids, lod }) => {
  const m = a.muzzle
  const dots = join(...[...DOTS, ...mirrorX(DOTS)].map(([x, y]) => ellipse(m.x + x, m.y + y, 0.95, 0.95)))
  return (
    <>
      {!pal.silhouette && <path d={ellipse(m.x, m.y + 4.6, 14.5, 10.5)} fill={pal.belly} clipPath={`url(#${ids.headClip})`} />}
      {!pal.silhouette && lod === 'full' && <path d={dots} fill={pal.outline} opacity={0.4} />}
      <path d={blob(xf(NOSE, { dx: m.x, dy: m.y }), 0.85)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.42} {...round} />
      {!pal.silhouette && <path d={ellipse(m.x - 1.5, m.y - 1.6, 1.5, 0.9, -15)} fill={pal.highlight} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------

export const squirrel: SpeciesDef = {
  id: 'squirrel',
  name: 'Egern',
  nameClip: 'name.species.squirrel',
  family: 'rodent',
  body: 'pear',
  breeds: [{ id: 'std', name: 'egern' }],
  colorways: SQUIRREL_COLORWAYS,
  magic: ['gold', 'rainbow'],
  anchors: {
    headCenter: { x: 100, y: 98 },
    headRx: 50,
    headRy: 45,
    headTop: { x: 100, y: 54 },
    headWidth: 98,
    earBaseL: { x: 73, y: 63 },
    earBaseR: { x: 127, y: 63 },
    hornBase: { x: 100, y: 56 },
    eyeL: { x: 80, y: 100 },
    eyeR: { x: 120, y: 100 },
    eyeRx: 10,
    eyeRy: 12.4,
    muzzle: { x: 100, y: 119 },
    mouth: { x: 100, y: 126 },
    cheekL: { x: 66, y: 117 },
    cheekR: { x: 134, y: 117 },
    neck: { x: 100, y: 143 },
    neckWidth: 56,
    bodyCenter: { x: 100, y: 184 },
    bodyRx: 46,
    bodyRy: 40,
    bodyWidth: 88,
    chest: { x: 100, y: 166 },
    back: { x: 100, y: 166 },
    shoulderL: { x: 77, y: 157 },
    shoulderR: { x: 123, y: 157 },
    pawL: { x: 90, y: 168 },
    pawR: { x: 110, y: 168 },
    handRot: -20,
    footL: { x: 74, y: 222 },
    footR: { x: 126, y: 222 },
    tailBase: { x: 121, y: 214 },
  },
  bounds: {
    head: { x0: 40, y0: 14, x1: 160, y1: 145 },
    body: { x0: 44, y0: 40, x1: 184, y1: 228 },
  },
  // Tankebobler og Zzz (fælles regel): til venstre for hovedet (halen fylder til højre), med mindst 8 enheders luft.
  fx: { x: 28, y: 86 },
  face: { idleMouth: 'cat-w', buckTeeth: true, cheeks: true },
  ears: { splay: 16 },
  signature: 'tail-flick',
  // Guldets glansbånd på kroppens venstre flanke under armen.
  goldBand: [146, 192],
  // Ups: hånden op til kinden (de korte arme når ikke om bag nakken).
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
    limb: { rot: PAW_ROT, sleeve: () => blob(SLEEVE), cuff: { y: 12, half: 9.6 } },
    Feet: Haunches,
    Muzzle,
    BodyDeco,
    Ruff: FrontFeet,
  },
}

export default squirrel
