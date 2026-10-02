// Pandaen (Regnbueskoven, bølge 3): skabelonen `round`, én race (std). Artstrækkene står i silhuetten, så
// pandaen aldrig læses som en hamster (rundt hoved med runde ører) eller som en bjørneunge uden mønster:
// - en bred bjørnekrop med tykke arme og store bagfødder, der stritter frem til siderne med trædepuderne
//   vendt mod os (den klassiske siddende panda),
// - store, runde bjørneører, der sidder bredt på issen (ikke små hamsterører højt oppe og ingen kindposer),
// - en bambusstængel med blade i venstre pote, der står ud til siden (også i sort silhuet),
// - aftegningen i mønsterfarven: ører, skrå øjenpletter, næse, skulderbånd, arme og ben.
// Øjnene sidder på pletterne i en lys ring (blinker med øjnene), så de altid står blanke og levende.
// Signaturen er pote-vinket: venstre arm med bambussen vinker fire gange om skulderen med aftagende udsving og
// en pause (`a-wag`, rig.css; kun i hvile og uden kropstøj, så armen aldrig går ud af ærmet).
// Alle former er punkter og husets primitiver.
import { MOOD_FACE } from '../parts/house'
import { ROUND, hatted, limbLoop, padsPath, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { STAGE_XF } from '../rig/anchors'
import { mixHex } from '../rig/oklch'
import { blob, capsule, ellipse, frame, join, mirrorX, n, offsetLoop, quad, ring, spline, symmetric, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, OutlineFn, Palette, Part, SidePart, SpeciesDef, Stage } from '../rig/types'
import { BAMBOO, PANDA_COLORWAYS } from './panda.colorways'

const round = ROUND
/** Aftegningen (ører, pletter, arme, ben): mønsterfarven, sort i silhuet. */
const ink = (pal: Palette) => pal.pattern
/** Ørernes inderside og en blød tone på aftegningen: en anelse lysere end aftegningen. */
const soft = (pal: Palette) => (pal.silhouette ? pal.pattern : mixHex(pal.pattern, pal.inner, 0.3))

// ---------------------------------------------------------------------------------------------
// Hoved: en bred, rund bjørnehoved med fyldige kinder forneden.

const HEAD_HALF: Vec[] = [
  [0, -1.0], [-0.42, -0.97], [-0.76, -0.82], [-0.97, -0.52], [-1.04, -0.17], [-1.02, 0.14], [-0.92, 0.44],
  [-0.73, 0.7], [-0.49, 0.88], [-0.23, 0.98], [0, 1.0],
]
const HEAD_UNIT = symmetric(HEAD_HALF)
const pandaHead: OutlineFn = (a: AnchorSet, inflate: number) =>
  blob(offsetLoop(frame(HEAD_UNIT, a.headCenter.x, a.headCenter.y, a.headRx, a.headRy), inflate), 0.85)

// ---------------------------------------------------------------------------------------------
// Ører: store, runde bjørneører (lokalt: roden i (0,0), peger op). Roden forsvinder sømløst i hovedet.

const EAR_C = { x: 0, y: -13, r: 17.4 }
/** Ørets kontur som punkter, der starter og slutter forneden (så `hatted` kan skære det under en hue). */
const EAR: Vec[] = ring(EAR_C.x, EAR_C.y, EAR_C.r, EAR_C.r * 0.95, 14, 90)
const EAR_HATTED = hatted(EAR, -6.5, 4)
const earScale = (stage: Stage) => (stage === 1 ? { sx: 1.12, sy: 1.12 } : stage === 3 ? { sx: 0.96, sy: 0.96 } : {})

const Ear: SidePart = ({ pal, sw, stage, hat }) => {
  const s = earScale(stage)
  return (
    <>
      <path d={blob(xf(hat === 'through' ? EAR_HATTED : EAR, s), 0.9)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      {!pal.silhouette && <path d={ellipse(EAR_C.x * (s.sx ?? 1) + 1, (EAR_C.y + 0.5) * (s.sy ?? 1), 9.8 * (s.sx ?? 1), 9.2 * (s.sy ?? 1))} fill={soft(pal)} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Øjenpletter: skrå, dråbeformede pletter, der hælder ned og ud fra øjnene (klippet til hovedet), og en lys ring
// om hvert øje, der blinker med øjnene (samme pivot og klasse som husets øjne), så øjnene står blanke på pletten.

const patch = (e: { x: number; y: number }, side: 1 | -1, a: AnchorSet, k: number) =>
  ellipse(e.x - side * 3.4 * k, e.y + 4.4 * k, a.eyeRx * 1.95 * k, a.eyeRy * 1.5 * k, side * 30)

/**
 * Lyse underlag til husets lukkede øjne (glad ^, sover, blink), så øjenlinjen står på pletten: samme kurver som
 * husets øjne (house.tsx), tegnet bredere i den lyse farve.
 */
function lidUnderlay(shape: string, eyes: readonly Vec[], rx: number, ry: number): string {
  const happy = (x: number, y: number) => quad([x - rx * 0.95, y + ry * 0.22], [x, y - ry * 0.95], [x + rx * 0.95, y + ry * 0.22])
  const closed = (x: number, y: number, s: number) =>
    join(
      quad([x - rx * 0.95, y + ry * 0.05], [x, y + ry * 0.75], [x + rx * 0.95, y + ry * 0.05]),
      quad([x + s * rx * 0.95, y + ry * 0.05], [x + s * rx * 1.25, y - ry * 0.05], [x + s * rx * 1.35, y - ry * 0.3]),
    )
  const wink = (x: number, y: number) => quad([x - rx * 0.95, y + ry * 0.12], [x - rx * 0.1, y - ry * 0.95], [x + rx * 0.95, y + ry * 0.12])
  if (shape === 'happy') return join(...eyes.map(([x, y]) => happy(x, y)))
  if (shape === 'closed') return join(...eyes.map(([x, y], i) => closed(x, y, i === 0 ? -1 : 1)))
  if (shape === 'wink') return wink(eyes[1][0], eyes[1][1])
  return ''
}

const HeadDeco: Part = ({ pal, a, ids, stage, mood, still, lod, sw }) => {
  if (pal.silhouette) return null
  const k = STAGE_XF[stage].eye
  const shape = MOOD_FACE[mood].eyes
  const ox = (a.eyeL.x + a.eyeR.x) / 2
  const oy = (a.eyeL.y + a.eyeR.y) / 2
  const pad = lod === 'small' ? 2.6 : 1.7
  const rx = a.eyeRx * k
  const ry = a.eyeRy * k
  const open = shape === 'open' || shape === 'sparkle' || shape === 'half'
  const eyes: Vec[] = [[a.eyeL.x - ox, a.eyeL.y - oy], [a.eyeR.x - ox, a.eyeR.y - oy]]
  const rings = open ? eyes : shape === 'wink' ? [eyes[0]] : []
  const lids = lidUnderlay(shape, eyes, rx, ry)
  return (
    <>
      <path d={join(patch(a.eyeL, 1, a, k), patch(a.eyeR, -1, a, k))} fill={ink(pal)} clipPath={`url(#${ids.headClip})`} />
      <g transform={`translate(${n(ox)} ${n(oy)})`}>
        {rings.length > 0 && (
          <g className={!still && open ? 'a-blink' : undefined}>
            <path d={join(...rings.map(([x, y]) => ellipse(x, y, rx + pad, ry + pad)))} fill={pal.belly} />
          </g>
        )}
        {lids && <path d={lids} fill="none" stroke={pal.belly} strokeWidth={sw * 1.2 + pad * 2.2} {...round} />}
      </g>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Snude: en lys, lidt fremskudt mule med en stor, blank bjørnenæse.

const NOSE: Vec[] = [[0, 4.6], [-3.6, 2.6], [-6.6, -0.6], [-6.4, -3.2], [-3, -4.4], [0, -4.6], [3, -4.4], [6.4, -3.2], [6.6, -0.6], [3.6, 2.6]]

const Muzzle: Part = ({ pal, sw, a, ids }) => {
  const m = a.muzzle
  return (
    <>
      {!pal.silhouette && <path d={ellipse(m.x, m.y + 4.5, 17, 12.5)} fill={pal.belly} clipPath={`url(#${ids.headClip})`} />}
      <path d={blob(xf(NOSE, { dx: m.x, dy: m.y - 1 }), 0.85)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.42} {...round} />
      {!pal.silhouette && <path d={ellipse(m.x - 2.2, m.y - 3.2, 2.4, 1.3, -12)} fill={pal.highlight} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Arme: tykke bjørnearme i aftegningens farve, der hænger ned langs maven (åben kontur ved roden).

const PAW_ROT = -12
const ARM_SPINE: Vec[] = [[0, -8], [0, 5], [0, 17], [0, 29]]
const ARM = limbLoop(ARM_SPINE, 20.5, 19.5, 7)
/** Ærmet: armen fra roden til manchetten lige over poten (lodret ramme), en anelse løsere end armen. */
const SLEEVE: Vec[] = [[-11.8, -12], [-12.2, -3], [-12.4, 7], [-12.4, 19], [0, 21], [12.4, 19], [12.4, 7], [12.2, -3], [11.8, -12], [0, -14]]

/** Bambusstænglen i venstre pote (lokalt i armens ramme): stænglen går gennem poten og står op og ud til siden. */
const STALK = { a: [9, 46] as Vec, b: [-30, -36] as Vec, r: 3.8 }
const along = (t: number): Vec => [STALK.a[0] + (STALK.b[0] - STALK.a[0]) * t, STALK.a[1] + (STALK.b[1] - STALK.a[1]) * t]
const NODES = [0.16, 0.42, 0.66, 0.88].map((t) => {
  const [x, y] = along(t)
  const dx = STALK.b[0] - STALK.a[0]
  const dy = STALK.b[1] - STALK.a[1]
  const l = Math.hypot(dx, dy)
  const nx = (-dy / l) * (STALK.r + 0.6)
  const ny = (dx / l) * (STALK.r + 0.6)
  return spline([[x - nx, y - ny], [x + nx, y + ny]])
})
/** To blade fra toppen ud mod siden og et lille blad ved det øverste led. */
const LEAF = (base: Vec, rot: number, len: number, w: number) =>
  blob(xf([[0, 0], [len * 0.3, -w], [len * 0.72, -w * 0.7], [len, 0], [len * 0.72, w * 0.55], [len * 0.3, w * 0.8]], { rot, dx: base[0], dy: base[1] }), 0.8)
const LEAVES = join(LEAF(along(0.99), -141, 22, 6.2), LEAF(along(0.96), -100, 21, 5.6), LEAF(along(0.84), 172, 17, 4.8), LEAF(along(0.68), -170, 13, 3.8))

const Bamboo = ({ pal, sw }: { pal: Palette; sw: number }) => {
  const sil = pal.silhouette
  return (
    <>
      <path d={LEAVES} fill={sil ? pal.fur : BAMBOO.leaf} stroke={sil ? pal.fur : BAMBOO.outline} strokeWidth={sw * 0.8} {...round} />
      <path d={capsule(STALK.a, STALK.b, STALK.r)} fill={sil ? pal.fur : BAMBOO.stalk} stroke={sil ? pal.fur : BAMBOO.outline} strokeWidth={sw * 0.8} {...round} />
      {!sil && <path d={join(...NODES)} fill="none" stroke={BAMBOO.node} strokeWidth={sw * 0.7} {...round} />}
    </>
  )
}

const Paw: SidePart = ({ pal, sw, side, mood, still, clothed, stage }) => {
  // Bambussen og pote-vinket kun i venstre pote og kun uden kropstøj (ærmet tegnes af riggen uden for armen).
  const bamboo = side === 'L' && !clothed
  const wag = bamboo && !still && mood === 'idle'
  return (
    <g className={wag ? 'a-wag' : undefined}>
      <g transform={`rotate(${PAW_ROT})`}>
        {/* Babyens store hoved: bambussen hælder lidt mere ud, så der ikke lukkes en lomme mellem stængel og kind. */}
        {bamboo && (
          <g transform={stage === 1 ? 'rotate(-10 0 29)' : undefined}>
            <Bamboo pal={pal} sw={sw} />
          </g>
        )}
        <path d={blob(ARM)} fill={ink(pal)} />
        <path d={spline(ARM.slice(1, -1))} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
      </g>
    </g>
  )
}

/** Løftede arme (lokalt om skulderen). Roden ligger på brystet; konturen er åben dér. */
const UP_SPINES = {
  cheer: [[6, 6], [0, -3], [-8, -13], [-16, -23], [-22, -33]] as Vec[],
  wave: [[7, 6], [-3, 1], [-14, -4], [-23, -12], [-27, -24], [-28, -36]] as Vec[],
  // Tænker: poten under hagen.
  think: [[6, 7], [14, 1], [21, -7], [25, -14]] as Vec[],
  // Ups: poten op til kinden (genert "hov"), tungen ude.
  oops: [[6, 7], [7, -4], [8, -13], [8.5, -20], [8, -25]] as Vec[],
}
type UpKind = keyof typeof UP_SPINES
const UP_W = { w0: 18.5, w1: 19 }
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
      <path d={blob(loop)} fill={ink(pal)} />
      <path d={spline(loop)} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
      {palm && !pal.silhouette && <path d={padsPath(tx, ty + 0.6, 8.6, kind === 'wave' ? -4 : -32)} fill={pal.inner} />}
    </>
  )
}

/** Fyld bag alt ved armene (se `pawWebs`): lommernes udvidede hylstre pr. race, stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {}

// ---------------------------------------------------------------------------------------------
// Foran kroppen (efter maven og skyggen, før kropstøjet): skulderbåndet over brystet og de store bagfødder, der
// stritter frem til siderne med trædepuden og fire tåpuder vendt mod os.

const LEG = { cx: 61, cy: 210, rx: 20.5, ry: 16, rot: -24 }
const SOLE = { cx: 56, cy: 214, rx: 8.8, ry: 7.8, rot: -24 }
/** Fire tåpuder i en bue over trædepuden (inden for fodens kontur). */
const TOES: Vec[] = [-152, -122, -92, -62].map((t) => [SOLE.cx + 11.2 * Math.cos((t * Math.PI) / 180), SOLE.cy + 10.6 * Math.sin((t * Math.PI) / 180)] as Vec)

const Front: Part = ({ pal, sw, a, ids, lod, clothed }) => {
  const legs = join(ellipse(LEG.cx, LEG.cy, LEG.rx, LEG.ry, LEG.rot), ellipse(200 - LEG.cx, LEG.cy, LEG.rx, LEG.ry, -LEG.rot))
  const soles = join(ellipse(SOLE.cx, SOLE.cy, SOLE.rx, SOLE.ry, SOLE.rot), ellipse(200 - SOLE.cx, SOLE.cy, SOLE.rx, SOLE.ry, -SOLE.rot))
  const toes = join(...[...TOES, ...mirrorX(TOES, 100)].map(([x, y]) => ellipse(x, y, 2.6, 2.9)))
  const b = a.bodyCenter
  return (
    <>
      {!clothed && <path d={ellipse(b.x, a.neck.y + 6, a.bodyRx * 1.12, 17)} fill={ink(pal)} clipPath={`url(#${ids.bodyClip})`} />}
      <path d={legs} fill={ink(pal)} stroke={pal.outline} strokeWidth={sw} {...round} />
      {!pal.silhouette && <path d={soles} fill={pal.inner} />}
      {!pal.silhouette && lod === 'full' && <path d={toes} fill={pal.inner} />}
    </>
  )
}

/** Den lyse mave (en blød oval); regnbuen har her sin smæk af fire flade striber. */
const BodyDeco: Part = ({ pal, a, ids }) => (
  <path d={ellipse(a.bodyCenter.x, a.bodyCenter.y + 9, a.bodyRx * 0.62, a.bodyRy * 0.7)} fill={pal.gradient ? `url(#${ids.gradient})` : pal.belly} clipPath={`url(#${ids.bodyClip})`} />
)

/** Bag kroppen: intet (pandaens hale er gemt bag den siddende krop; benene sidder foran). */
const Feet: Part = () => null

// ---------------------------------------------------------------------------------------------

export const panda: SpeciesDef = {
  id: 'panda',
  name: 'Panda',
  nameClip: 'name.species.panda',
  family: 'bear',
  body: 'round',
  breeds: [{ id: 'std', name: 'panda' }],
  colorways: PANDA_COLORWAYS,
  magic: ['gold', 'rainbow'],
  anchors: {
    headCenter: { x: 100, y: 98 },
    headRx: 56,
    headRy: 47,
    headTop: { x: 100, y: 51 },
    headWidth: 106,
    earBaseL: { x: 67, y: 63 },
    earBaseR: { x: 133, y: 63 },
    hornBase: { x: 100, y: 53 },
    eyeL: { x: 79, y: 101 },
    eyeR: { x: 121, y: 101 },
    eyeRx: 9.8,
    eyeRy: 12.2,
    muzzle: { x: 100, y: 120 },
    mouth: { x: 100, y: 129 },
    cheekL: { x: 61, y: 124 },
    cheekR: { x: 139, y: 124 },
    neck: { x: 100, y: 146 },
    neckWidth: 62,
    bodyCenter: { x: 100, y: 184 },
    bodyRx: 54,
    bodyRy: 42,
    bodyWidth: 94,
    chest: { x: 100, y: 168 },
    back: { x: 100, y: 168 },
    shoulderL: { x: 76, y: 158 },
    shoulderR: { x: 124, y: 158 },
    pawL: { x: 83, y: 188 },
    pawR: { x: 117, y: 188 },
    handRot: -20,
    footL: { x: 63, y: 214 },
    footR: { x: 137, y: 214 },
    tailBase: { x: 148, y: 212 },
  },
  bounds: {
    head: { x0: 32, y0: 26, x1: 168, y1: 148 },
    body: { x0: 18, y0: 114, x1: 166, y1: 228 },
  },
  // Tankebobler og Zzz (fælles regel): til højre for kinden under øret med mindst 8 enheders luft.
  fx: { x: 178, y: 118 },
  face: { idleMouth: 'cat-w', cheeks: true },
  ears: { splay: 26 },
  signature: 'paw-wave',
  // Guldets glansbånd på kroppens venstre flanke uden for armen.
  goldBand: [150, 196],
  // Ups: poten op til kinden (de korte bjørnearme når ikke om bag nakken).
  poses: {
    oops: { pawL: 0, pawR: { up: true } },
  },
  parts: {
    head: pandaHead,
    Ear,
    Paw,
    PawUp,
    PawBack: pawWebs({}, PAW_WEBS),
    pawUpTip: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { x: tipOf(s)[0], y: tipOf(s)[1] }])),
    upArms: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { spine: s, w0: UP_W.w0, w1: UP_W.w1, tip: 7 }])),
    limb: { rot: PAW_ROT, sleeve: () => blob(SLEEVE), cuff: { y: 19, half: 12.4 } },
    Feet,
    Muzzle,
    HeadDeco,
    BodyDeco,
    Ruff: Front,
  },
}

export default panda
