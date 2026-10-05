// Dragen (Stjernefjeldet, bølge 3): en sød, venlig drageunge på skabelonen `tall`, én race (std). Runde former, store
// øjne og ingen tænder. Artstrækkene står i silhuetten, så dragen aldrig læses som en ugle, et egern eller en ræv:
// - to glatte, let krumme horn i benfarve, der rejser sig fra issen bag ørerne (review G2-r1: uglens kløvede fjerører
//   kan læses som horn, så dragens horn er glatte kegler, og ørerne er små finner ude på siderne),
// - flagermusevinger bag skuldrene: fingerknogler med små spidser og en flyvehud, der buer ind mellem dem,
// - en tynd hale, der svinger ud til højre og ender i en spade, og en lys mave med tværstriber.
// Hovedet er rundt med en kort, bred snude og to næsebor. Vingerne tegnes om ankeret `back` (lag 3) og optager
// ryg-slottet (`occupies: ['back']`). Signaturen er en lille røgpust: en lys sky, der puster ud af næseborene,
// vokser med ét overshoot og driver væk (`a-smoke`, kun opacity og transform, kun i hvile). Alle former er punkter og
// husets primitiver.
import { OpenLimb, ROUND, limbLoop, padsPath, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { mixHex } from '../rig/oklch'
import { blob, ellipse, frame, join, mirrorX, offsetLoop, ribbon, scallop, spline, symmetric, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, OutlineFn, Palette, Part, PartCtx, SidePart, SpeciesDef, Stage } from '../rig/types'
import { DRAGON_COLORWAYS, SMOKE } from './dragon.colorways'

const round = ROUND
/** Flyvehud, finnernes inderside og halens spade: regnbuens striber, ellers kontrastfarven. */
const skin = (pal: Palette, ids: PartCtx['ids']) =>
  pal.gradient ? `url(#${ids.gradient})` : pal.pattern !== pal.fur ? pal.pattern : mixHex(pal.fur, pal.belly, 0.55)
/** Horn og kløer i benfarve. */
const bone = (pal: Palette) => pal.horn ?? pal.belly
const boneShade = (pal: Palette) => pal.hornShade ?? pal.shade

// ---------------------------------------------------------------------------------------------
// Hoved: rundt og bredt med en kort, bred snude forneden (en blød talje under kinderne).

const HEAD_HALF: Vec[] = [
  [0, -1.0], [-0.42, -0.97], [-0.74, -0.83], [-0.94, -0.57], [-1.02, -0.22], [-1.0, 0.1], [-0.9, 0.37], [-0.78, 0.55],
  [-0.72, 0.69], [-0.72, 0.86], [-0.64, 1.02], [-0.42, 1.13], [0, 1.17],
]
const HEAD_UNIT = symmetric(HEAD_HALF)
const dragonHead: OutlineFn = (a: AnchorSet, inflate: number) =>
  blob(offsetLoop(frame(HEAD_UNIT, a.headCenter.x, a.headCenter.y, a.headRx, a.headRy), inflate), 0.86)

// ---------------------------------------------------------------------------------------------
// Horn (bag hovedet, modelrum): to glatte kegler, der rejser sig fra issen og krummer let udad. Roden gemmer sig i
// hovedet, så hornene vokser ud bag issen; de tegnes før hovedet (lag 10) og ligger derfor også bag en hat.

const HORN_SPINE: Vec[] = [[83, 60], [80, 46], [76, 34], [72, 25], [68.5, 19]]
const HORN_W = [14, 12.5, 10, 6.5, 2.6]
const HORN = ribbon(HORN_SPINE, HORN_W)
/** Hornets skyggeside: en smal stribe langs ydersiden. */
const HORN_SHADE = ribbon(xf(HORN_SPINE, { dx: -2.2, dy: 0.6 }).slice(1), [6, 4.6, 2.8, 0.8])
const HORNS_D = join(blob(HORN, 0.8), blob(mirrorX(HORN, 100), 0.8))
const HORN_SHADE_D = join(blob(HORN_SHADE, 0.8), blob(mirrorX(HORN_SHADE, 100), 0.8))

const Horns: Part = ({ pal, sw }) => (
  <>
    <path d={HORNS_D} fill={bone(pal)} stroke={pal.outline} strokeWidth={sw} {...round} />
    {!pal.silhouette && <path d={HORN_SHADE_D} fill={boneShade(pal)} />}
  </>
)

// ---------------------------------------------------------------------------------------------
// Ører: små finner ude på hovedets sider (bag hovedet, så hovedets kontur løber ubrudt over roden): tre runde
// fingerspidser med hud imellem, som en lille udgave af vingerne, så hovedet aldrig læses som en kalv med horn.

const FIN: Vec[] = [
  [0, 9], [-7.5, 5.5], [-10.5, -3], [-12.5, -12], [-13, -20], [-9.5, -18], [-6.5, -20.5], [-3.5, -26], [0.5, -31.5], [2.6, -25],
  [4.6, -21], [8, -22.5], [8.8, -15], [8.6, -6], [7.4, 2], [5.6, 8],
]
const FIN_INNER: Vec[] = [[-0.6, 3], [-6.4, -1.5], [-8.6, -9], [-8.6, -15], [-5.6, -15], [-2.2, -19.5], [0.4, -24], [1.6, -19], [3.6, -15.5], [5.4, -15], [5, -6], [3.6, -0.5]]
const FIN_RAYS: Vec[][] = [[[-0.6, 3], [-6.4, -8], [-11.4, -17.4]], [[-0.4, 3], [-0.6, -14], [0.4, -27.6]], [[0, 3], [4.4, -9], [7.2, -19]]]
const FIN_RAYS_D = join(...FIN_RAYS.map((r) => spline(r)))
const finScale = (stage: Stage) => (stage === 1 ? { sx: 1.1, sy: 1.1 } : {})

const Fin: SidePart = ({ pal, sw, stage, ids, lod }) => {
  const s = finScale(stage)
  return (
    <>
      <path d={blob(xf(FIN, s), 0.78)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      {!pal.silhouette && <path d={blob(xf(FIN_INNER, s), 0.8)} fill={skin(pal, ids)} />}
      {lod === 'full' && !pal.silhouette && (
        <path d={stage === 1 ? join(...FIN_RAYS.map((r) => spline(xf(r, s)))) : FIN_RAYS_D} fill="none" stroke={pal.earFur} strokeWidth={sw * 0.8} {...round} />
      )}
    </>
  )
}

/** Skælpletter: tre små, runde pletter i skyggetonen på issen (klippet til hovedet). */
const SPOTS: [number, number, number][] = [[-0.3, -0.72, 4.2], [0.02, -0.84, 3.2], [0.32, -0.7, 3.8]]
const HeadSpots: Part = ({ pal, a, ids }) =>
  pal.silhouette ? null : (
    <path
      d={join(...SPOTS.map(([u, v, r]) => ellipse(a.headCenter.x + u * a.headRx, a.headCenter.y + v * a.headRy, r, r * 0.86)))}
      fill={pal.shade}
      clipPath={`url(#${ids.headClip})`}
    />
  )

// ---------------------------------------------------------------------------------------------
// Snude: en lys plet forneden med to små næsebor, og røgpusten (signaturen): en lille sky, der puster ud af det højre
// næsebor, vokser med ét overshoot og driver ud til siden, væk fra øjet (kun i animeret tilstand; rig.css `a-smoke`).

const PUFF = scallop(7, -1, 8, 5.6, 7, 0.62)
const PUFF_SMALL = scallop(-2, -2, 3.2, 2.6, 5, 0.62)

const Snout: Part = ({ pal, a, ids, still, sw }) => {
  const m = a.muzzle
  return (
    <>
      {!pal.silhouette && <path d={ellipse(m.x, m.y + 6, 29, 16)} fill={pal.belly} clipPath={`url(#${ids.headClip})`} />}
      {!pal.silhouette && <path d={join(ellipse(m.x - 6.6, m.y - 2.2, 2.1, 1.6, 24), ellipse(m.x + 6.6, m.y - 2.2, 2.1, 1.6, -24))} fill={pal.outline} opacity={0.7} />}
      {!pal.silhouette && !still && (
        <g transform={`translate(${m.x + 10} ${m.y - 1})`}>
          <g className="a-smoke" opacity={0}>
            <path d={join(PUFF, PUFF_SMALL)} fill={SMOKE.fill} stroke={SMOKE.line} strokeWidth={sw * 0.55} {...round} />
          </g>
        </g>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Vinger (lokalt om ankeret `back`; venstre vinge, højre spejles): flagermusevinger med en arm op til håndleddet,
// tre fingre med små, runde spidser og en flyvehud, der buer ind mellem fingerspidserne. Begge vinger er ét path pr.
// lag (hud med kontur, knogler).

const WRIST: Vec = [-44, -50]
const MEMBRANE: Vec[] = [
  [-10, 7], [-6, -9], [-16, -23], [-28, -35], [-39, -45], [-46, -55], [-51, -64], [-55, -72], [-58.5, -71], [-59.5, -64],
  [-62, -56], [-67, -52], [-70, -48.5], [-69.5, -44], [-66, -39], [-64, -31], [-66, -24], [-69, -18], [-67.5, -14], [-62, -13],
  [-56.5, -10], [-54, -3], [-53, 3], [-50, 5], [-44, 1], [-36, 0], [-28, 3], [-22, 9],
]
const BONES: Vec[][] = [
  [[-6, -9], [-24, -32], WRIST, [-53, -62], [-56.5, -69]],
  [WRIST, [-58, -50], [-66, -48]],
  [WRIST, [-56, -36], [-65.5, -19]],
  [WRIST, [-49, -28], [-51.5, 1]],
]
const MEMBRANE_D = join(blob(MEMBRANE, 0.8), blob(mirrorX(MEMBRANE), 0.8))
const BONES_D = join(...BONES.flatMap((b) => [spline(b), spline(mirrorX(b))]))
/** Ungens vinger er større i forhold til kroppen, så de står frem ved siden af det store babyhoved. */
const WING_STAGE: Record<Stage, number> = { 1: 1.24, 2: 1, 3: 1 }

const Wings: Part = ({ pal, sw, stage, ids }) => {
  const k = WING_STAGE[stage]
  const s = sw / k
  return (
    <g transform={k !== 1 ? `scale(${k})` : undefined}>
      <path d={MEMBRANE_D} fill={skin(pal, ids)} stroke={pal.outline} strokeWidth={s} {...round} />
      {!pal.silhouette && <path d={BONES_D} fill="none" stroke={pal.fur} strokeWidth={s * 1.15} {...round} />}
    </g>
  )
}

// ---------------------------------------------------------------------------------------------
// Forben (lokalt om skulderen): kraftige søjler fra skulderen under hagen ned til jorden, med tre runde kløer.
// Konturen er åben ved skulderen (roden gemmer sig under hovedet).

const LEG_SPINE: Vec[] = [[0, -12], [0.3, 8], [0.7, 28], [1, 48], [1.2, 64]]
const LEG = limbLoop(LEG_SPINE, 17, 18, 7)
const CLAWS: Vec[] = [[-5.6, 72.4], [0.8, 74], [7.2, 72.4]]
const clawsAt = (pts: readonly Vec[], r = 2.6) => join(...pts.map(([x, y]) => ellipse(x, y, r, r * 0.84)))
/** Ærmet: fra skulderen under hagen ned til manchetten (lodret ramme), en anelse løsere end benet. */
const LEG_SLEEVE: Vec[] = [
  [-10.2, -14], [-10.8, 0], [-11.2, 14], [-11.5, 28], [-11.8, 42], [0, 44.6], [11.8, 42], [11.5, 28], [11.2, 14], [10.8, 0], [10.2, -14], [0, -16],
]

const Leg: SidePart = ({ pal, sw }) => (
  <>
    <OpenLimb loop={LEG} fill={pal.fur} stroke={pal.outline} sw={sw} trim={1} />
    <path d={clawsAt(CLAWS)} fill={bone(pal)} stroke={pal.outline} strokeWidth={sw * 0.55} {...round} />
  </>
)

/** Løftede forben (lokalt om skulderen; roden ligger på brystet under hagen). */
const UP_SPINES = {
  // Glad: armene ud til siden i brysthøjde, tegnet drejet −30°, så glad-hoppets 30° (rig.css) bringer dem på plads.
  happy: xf([[2, 4], [-8, -1], [-18, -6], [-28, -10], [-37, -12]], { rot: -30 }),
  cheer: [[2, 4], [-7, -5], [-16, -14], [-25, -23], [-33, -31], [-38, -37]] as Vec[],
  // Vink: overarmen ud, underarmen op, poten ved siden af kinden.
  wave: [[2, 4], [-8, 0], [-18, -5], [-27, -13], [-32, -25], [-34, -37]] as Vec[],
  // Tænker: poten under hagen.
  think: [[-1, 4], [5, 0], [10, -3], [14, -5]] as Vec[],
  // Ups: poten op til kinden (genert "hov"), så tungen ses.
  oops: [[-1, 4], [-4, -6], [-7, -15], [-10, -23]] as Vec[],
}
type UpKind = keyof typeof UP_SPINES
const UP_W = { w0: 17, w1: 17 }
const UP_LOOPS = Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, limbLoop(s, UP_W.w0, UP_W.w1)])) as Record<UpKind, Vec[]>
const tipOf = (s: readonly Vec[]) => s[s.length - 1]
const kindOf = (mood: string): UpKind => (mood in UP_SPINES ? (mood as UpKind) : 'cheer')

const PawUp: SidePart = ({ pal, sw, mood }) => {
  const kind = kindOf(mood)
  const spine = UP_SPINES[kind]
  const [tx, ty] = tipOf(spine)
  const [px, py] = spine[spine.length - 2]
  const ang = (Math.atan2(ty - py, tx - px) * 180) / Math.PI
  const loop = UP_LOOPS[kind]
  const palm = kind === 'cheer' || kind === 'wave' || kind === 'happy'
  // Kløerne sidder for enden af poten i armens retning.
  const claws = xf([[-6, 6.4], [0, 8], [6, 6.4]], { rot: ang - 90, dx: tx, dy: ty })
  return (
    <>
      <path d={blob(loop)} fill={pal.fur} />
      <path d={spline(loop)} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
      {palm && !pal.silhouette && <path d={padsPath(tx, ty + 0.5, 7.4, kind === 'wave' ? -4 : -36)} fill={mixHex(pal.belly, pal.inner, 0.35)} />}
      <path d={clawsAt(claws, 2.4)} fill={bone(pal)} stroke={pal.outline} strokeWidth={sw * 0.55} {...round} />
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Bagben: lårbuler og fødder med tre kløer, der titter frem ved siderne.

const HAUNCH = { cx: 63, cy: 205, rx: 19.5, ry: 18.5, rot: -18 }
const HIND = { cx: 56, cy: 220.4, rx: 13.4, ry: 6.8, rot: -6 }
const HIND_CLAWS: Vec[] = [[45.6, 222.6], [51.4, 225], [57.6, 225.6]]

const Feet: Part = ({ pal, sw, stage }) => {
  const k = stage === 3 ? 1.07 : 1
  const e = (o: typeof HAUNCH, mirror: boolean) => ellipse(mirror ? 200 - o.cx : o.cx, o.cy, o.rx * k, o.ry * k, mirror ? -o.rot : o.rot)
  const claws = [...HIND_CLAWS, ...mirrorX(HIND_CLAWS, 100)].map(([x, y]) => [100 + (x - 100) * k, 226 + (y - 226) * k] as Vec)
  return (
    <>
      <path d={join(e(HAUNCH, false), e(HAUNCH, true), e(HIND, false), e(HIND, true))} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
      <path d={clawsAt(claws, 2.3)} fill={bone(pal)} stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Halen (lokalt om tailBase bag højre side): en tynd hale, der svinger ud og op og ender i en spade.

const TAIL_SPINE: Vec[] = [[-3, 0], [8, 5], [18, 6], [25, 2], [28, -6], [28, -15]]
const TAIL = blob(ribbon(TAIL_SPINE, [15, 14, 12, 10, 8.5, 7]), 0.9)
const SPADE: Vec[] = [[28, -32], [33.5, -26], [37, -20], [35.5, -14.6], [31.2, -13.4], [28, -16.4], [24.8, -13.4], [20.5, -14.6], [19, -20], [22.5, -26]]
const SPADE_D = blob(SPADE, 0.72)
/** Ungens hale er større (som føllets), så den står frem ved siden af den lille krop. */
const BABY_TAIL = 1.3

const Tail: Part = ({ pal, sw, ids, stage }) => {
  const k = stage === 1 ? BABY_TAIL : 1
  const s = sw / k
  return (
    <g transform={k !== 1 ? `scale(${k})` : undefined}>
      <path d={TAIL} fill={pal.fur} stroke={pal.outline} strokeWidth={s} {...round} />
      <path d={SPADE_D} fill={pal.silhouette ? pal.fur : skin(pal, ids)} stroke={pal.outline} strokeWidth={s} {...round} />
    </g>
  )
}

// ---------------------------------------------------------------------------------------------
// Krop: en lys mave med tværstriber (regnbuen: fire flade striber).

const BELLY_LINES: Vec[][] = [-0.46, -0.16, 0.14, 0.44].map((v) => {
  const w = Math.sqrt(1 - v * v) * 0.92
  return [[-w, v - 0.02], [0, v + 0.06], [w, v - 0.02]] as Vec[]
})

const BodyDeco: Part = ({ pal, a, ids, sw, lod }) => {
  const c = { x: a.bodyCenter.x, y: a.bodyCenter.y + 6 }
  const rx = a.bodyRx * 0.6
  const ry = a.bodyRy * 0.78
  const lines = join(...BELLY_LINES.map((l) => spline(frame(l, c.x, c.y, rx, ry))))
  return (
    <>
      <path d={ellipse(c.x, c.y, rx, ry)} fill={pal.gradient ? `url(#${ids.gradient})` : pal.belly} clipPath={`url(#${ids.bodyClip})`} />
      {lod === 'full' && !pal.silhouette && !pal.gradient && (
        <path d={lines} fill="none" stroke={mixHex(pal.belly, pal.outline, 0.4)} strokeWidth={sw * 0.5} {...round} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------

/** Fyld bag alt ved armene (se `pawWebs`): lommernes udvidede hylstre pr. stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {}

export const dragon: SpeciesDef = {
  id: 'dragon',
  name: 'Drage',
  nameClip: 'name.species.dragon',
  family: 'reptile',
  body: 'tall',
  breeds: [{ id: 'std', name: 'drage' }],
  colorways: DRAGON_COLORWAYS,
  magic: ['gold', 'rainbow'],
  occupies: ['back'],
  anchors: {
    headCenter: { x: 100, y: 88 },
    headRx: 52,
    headRy: 44,
    headTop: { x: 100, y: 45 },
    headWidth: 102,
    earBaseL: { x: 56, y: 74 },
    earBaseR: { x: 144, y: 74 },
    // Hatte mellem ørerne sidder mellem hornene (ørerne er finner ude på siderne).
    earGap: 46,
    hornBase: { x: 100, y: 48 },
    eyeL: { x: 78, y: 92 },
    eyeR: { x: 122, y: 92 },
    eyeRx: 10.8,
    eyeRy: 13,
    muzzle: { x: 100, y: 120 },
    mouth: { x: 100, y: 131 },
    cheekL: { x: 64, y: 108 },
    cheekR: { x: 136, y: 108 },
    neck: { x: 100, y: 140 },
    neckWidth: 50,
    bodyCenter: { x: 100, y: 182 },
    bodyRx: 42,
    bodyRy: 44,
    bodyWidth: 84,
    chest: { x: 100, y: 162 },
    back: { x: 100, y: 160 },
    shoulderL: { x: 86, y: 150 },
    shoulderR: { x: 114, y: 150 },
    pawL: { x: 87, y: 216 },
    pawR: { x: 113, y: 216 },
    footL: { x: 60, y: 220 },
    footR: { x: 140, y: 220 },
    tailBase: { x: 134, y: 206 },
  },
  bounds: {
    head: { x0: 26, y0: 12, x1: 174, y1: 142 },
    body: { x0: 26, y0: 84, x1: 178, y1: 228 },
  },
  maneOrigin: 'headTop',
  // Tankebobler og Zzz (fælles regel): til højre for hovedet under finnen, mindst 8 enheder fri af hoved og finne.
  fx: { x: 176, y: 104 },
  face: { idleMouth: 'smile', cheeks: true },
  ears: { splay: 58, behind: true, clip: false },
  signature: 'smoke-puff',
  goldBand: [150, 196],
  // Forbenene står på jorden: glad løfter dem ud til siden (tegnet −30°, så glad-hoppets 30° passer), og ups er en
  // pote op til kinden.
  poses: {
    happy: { pawL: { up: true, rot: 30 }, pawR: { up: true, rot: 30 }, tail: -8 },
    cheer: { tail: -10 },
    oops: { pawL: 0, pawR: { up: true }, tail: -4 },
    sleep: { pawL: 0, pawR: 0 },
    wave: { tail: -8 },
  },
  parts: {
    head: dragonHead,
    Ear: Fin,
    Paw: Leg,
    PawUp,
    PawBack: pawWebs({}, PAW_WEBS),
    pawUpTip: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { x: tipOf(s)[0], y: tipOf(s)[1] }])),
    upArms: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { spine: s, w0: UP_W.w0, w1: UP_W.w1, tip: 12 }])),
    limb: { rot: 0, sleeve: () => blob(LEG_SLEEVE), cuff: { y: 42, half: 11.8 } },
    Feet,
    Tail,
    Muzzle: Snout,
    BodyDeco,
    HeadDeco: HeadSpots,
    ManeBack: Horns,
    Wings,
  },
}

export default dragon
