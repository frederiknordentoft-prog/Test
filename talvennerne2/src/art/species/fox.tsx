// Ræven (Hestebakkerne, bølge 2): skabelonen `tall`, én race (std). Artstrækkene står i silhuetten, så
// ræven aldrig læses som en langhåret kat (blindtest G1-r4):
// - store, spidse ører med mørke spidser, der rejser sig højt over hovedet,
// - en lang, spids snude: hovedet smalner til en blød spids under en lys maske, med næsen yderst,
// - spidse kindtotter, der stritter ud og ned fra kinderne,
// - lange, slanke forben med mørke "sokker" og mørke bagpoter,
// - en stor, busket hale med hvid spids, der står op bag højre side.
// Signaturen er halesvippet: halen sidder i sin egen pivot (`a-curl`) og svipper ind bag ryggen, slår et
// overshoot ud og falder til ro (rig.css). Alle former er punkter og husets primitiver.
import { ROUND, hatted, limbLoop, padsPath, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { mixHex } from '../rig/oklch'
import { Pivot } from '../rig/Rig'
import { blob, ellipse, frame, join, mirrorX, offsetLoop, ribbon, scallop, spline, symmetric, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, OutlineFn, Palette, Part, SidePart, SpeciesDef, Stage } from '../rig/types'
import { FOX_COLORWAYS } from './fox.colorways'

const round = ROUND
/** Regnbuen ligger som fire flade striber i halen og kraven; ellers den givne farve. */
const hair = (pal: Palette, fill: string, gradientId: string) => (pal.gradient ? `url(#${gradientId})` : fill)
/** Sokker og ørespidser: mønsterfarven (sort i silhuet). */
const sock = (pal: Palette) => pal.pattern

/** Den del af en lukket lemkontur, der ligger under y = cut (soklen): starter og slutter på snittet. */
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
  // Start i det første snit (løkken krydser snittet to gange; resten ligger imellem).
  const k = out.findIndex(([, y]) => y === cut)
  return [...out.slice(k), ...out.slice(0, k)]
}

/** Den del af en lukket kontur, der ligger over y = cut (ørespidsen). */
const above = (loop: readonly Vec[], cut: number): Vec[] => below(xf(loop, { sy: -1 }), -cut).map(([x, y]) => [x, -y] as Vec)

// ---------------------------------------------------------------------------------------------
// Hoved: bred pande, spidse kindtotter, der stritter ud og ned, og en snude, der smalner til en blød spids
// under næsen. Den spidse hage står også i sort (silhuetten skiller ræven fra katten).

const HEAD_HALF: Vec[] = [
  [0, -1.0], [-0.36, -0.96], [-0.66, -0.83], [-0.88, -0.6], [-0.99, -0.31], [-1.02, -0.04], [-1.01, 0.12],
  [-1.24, 0.3], [-0.98, 0.37], [-1.13, 0.52], [-0.84, 0.56], [-0.6, 0.7], [-0.37, 0.87], [-0.17, 1.02], [0, 1.09],
]
const HEAD_UNIT = symmetric(HEAD_HALF)
const foxHead: OutlineFn = (a: AnchorSet, inflate: number) =>
  blob(offsetLoop(frame(HEAD_UNIT, a.headCenter.x, a.headCenter.y, a.headRx, a.headRy), inflate), 0.78)

/**
 * Masken: kinder, totter og snude er lyse, mens en orange næseryg går ned mellem øjnene til næsen
 * (klippet til hovedet). Øverst følger kanten øjnenes underside.
 */
const MASK_HALF: Vec[] = [[0, 0.58], [-0.13, 0.5], [-0.28, 0.36], [-0.48, 0.25], [-0.72, 0.19], [-0.98, 0.14], [-1.3, 0.1], [-1.3, 1.3], [0, 1.3]]
const MASK_UNIT = symmetric(MASK_HALF)

const Mask: Part = ({ pal, a, ids }) =>
  pal.silhouette ? null : (
    <path d={blob(frame(MASK_UNIT, a.headCenter.x, a.headCenter.y, a.headRx, a.headRy), 0.8)} fill={pal.belly} clipPath={`url(#${ids.headClip})`} />
  )

// ---------------------------------------------------------------------------------------------
// Ører (venstre; lokalt: roden i (0,0), peger op): store, spidse ører med lys, pelset inderside og mørk spids.

const EAR: Vec[] = xf([
  [0, 8], [-13.5, 5], [-16.2, -5], [-15, -18], [-11.4, -30], [-6.4, -41], [-1.8, -48.5], [1.2, -49.5],
  [4.6, -44], [8.6, -33], [12, -20], [13.6, -7], [12.4, 4],
], { sx: 1.04, sy: 1.08 })
const EAR_INNER: Vec[] = xf([[0.2, -1], [-8.6, -4.5], [-9.6, -15], [-7, -27], [-3, -36.5], [0.2, -39], [3.4, -33], [6.6, -21], [7.6, -9], [5.6, -2.5]], { sx: 1.04, sy: 1.08 })
/** Den mørke spids: ørets øverste del, lidt inden for konturen (konturen tegnes med øret). */
const EAR_TIP = above(xf(EAR, { sx: 0.93, sy: 0.96, about: [-1, -28] }), -34)
/** Under en hue med ørehuller ender øret i en blød bund nede i hullet. */
const EAR_HATTED = hatted(EAR, -6, 4)
const earScale = (stage: Stage) => (stage === 1 ? { sx: 1.04, sy: 0.9 } : stage === 3 ? { sx: 0.98, sy: 0.92 } : {})

const Ear: SidePart = ({ pal, sw, stage, hat }) => {
  const s = earScale(stage)
  return (
    <>
      <path d={blob(xf(hat === 'through' ? EAR_HATTED : EAR, s), 0.85)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      {!pal.silhouette && <path d={blob(xf(EAR_INNER, s), 0.85)} fill={pal.inner} />}
      {!pal.silhouette && <path d={blob(xf(EAR_TIP, s), 0.8)} fill={sock(pal)} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Forben: lange, slanke søjler fra skulderen under hagen ned til jorden, med mørke sokker. Konturen er
// åben ved skulderen (roden gemmer sig under hovedet), og soklen har ingen kant mod den orange pels.

const LEG_SPINE: Vec[] = [[0, -14], [0.4, 8], [0.8, 30], [1.1, 52], [1.3, 75]]
const LEG = limbLoop(LEG_SPINE, 15, 16.5, 7)
const SOCK_CUT = 54
const LEG_SOCK = below(LEG, SOCK_CUT)
const LEG_TOES: Vec[][] = [
  [[-3.4, 82.6], [-3.1, 78.4]],
  [[4.2, 82.6], [3.9, 78.4]],
]
/** Ærmet: fra skulderen under hagen ned til manchetten lige over soklen (lodret ramme), lidt løsere end benet. */
const LEG_SLEEVE: Vec[] = [
  [-9.6, -16], [-10.2, -2], [-10.6, 14], [-10.9, 30], [-11.2, 46], [0, 48.6], [11.2, 46], [10.9, 30], [10.6, 14], [10.2, -2], [9.6, -16], [0, -18],
]

const Leg: SidePart = ({ pal, sw, lod }) => (
  <>
    <path d={blob(LEG)} fill={pal.fur} />
    {!pal.silhouette && <path d={blob(LEG_SOCK, 0.9)} fill={sock(pal)} />}
    <path d={spline(LEG.slice(1, -1))} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
    {lod === 'full' && !pal.silhouette && (
      <path d={join(...LEG_TOES.map((t) => spline(t)))} fill="none" stroke={mixHex(sock(pal), pal.belly, 0.4)} strokeWidth={sw * 0.5} {...round} />
    )}
  </>
)

/** Løftede poter (lokalt om skulderen; roden ligger på brystet under hagen). */
const CHEER: Vec[] = [[2, 4], [-6, -6], [-15, -16], [-24, -26], [-31, -35], [-36, -42]]
/** Glad: armene ud til siden i brysthøjde. Tegnet drejet −30°, så glad-hoppets 30° (rig.css) bringer dem på plads. */
const HAPPY: Vec[] = xf([[2, 4], [-8, -2], [-19, -8], [-30, -13], [-40, -16]], { rot: -30 })
const UP_SPINES = {
  happy: HAPPY,
  cheer: CHEER,
  // Vink: overarmen ud, underarmen op, poten ved siden af kinden.
  wave: [[2, 4], [-8, 0], [-19, -5], [-29, -13], [-35, -25], [-37, -38]] as Vec[],
  // Tænker: poten under hagen.
  think: [[-1, 4], [5, 0], [10, -2], [14, -3]] as Vec[],
  // Ups: poten op til kinden (genert "hov"), så tungen ses.
  oops: [[-1, 4], [-4, -6], [-8, -15], [-11, -23]] as Vec[],
}
type UpKind = keyof typeof UP_SPINES
const UP_W = { w0: 15, w1: 17 }
const UP_LOOPS = Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, limbLoop(s, UP_W.w0, UP_W.w1)])) as Record<UpKind, Vec[]>
/** Soklen på den løftede pote: de sidste 13 enheder af armen, en anelse inden for armens kontur. */
const upSock = (s: readonly Vec[]): Vec[] => {
  const [ex, ey] = s[s.length - 1]
  const [px, py] = s[s.length - 2]
  const t = Math.min(1, 13 / (Math.hypot(ex - px, ey - py) || 1))
  return limbLoop([[ex + (px - ex) * t, ey + (py - ey) * t], [ex, ey]], UP_W.w1 - 0.8, UP_W.w1 - 0.8)
}
const UP_SOCKS = Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, upSock(s)])) as Record<UpKind, Vec[]>
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
      {!pal.silhouette && <path d={blob(UP_SOCKS[kind], 0.9)} fill={sock(pal)} />}
      <path d={spline(loop)} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
      {palm && !pal.silhouette && <path d={padsPath(tx, ty + 0.5, 7.6, kind === 'wave' ? -4 : -36)} fill={mixHex(sock(pal), pal.inner, 0.55)} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Bagben: lårbuler og mørke bagpoter, der titter frem ved siderne.

const HAUNCH = { cx: 63, cy: 205, rx: 18.5, ry: 18, rot: -18 }
const HIND_PAW = { cx: 56, cy: 220.6, rx: 12.6, ry: 6.4, rot: -8 }

const Feet: Part = ({ pal, sw, stage }) => {
  const k = stage === 3 ? 1.08 : 1
  const e = (o: typeof HAUNCH, mirror: boolean) => ellipse(mirror ? 200 - o.cx : o.cx, o.cy, o.rx * k, o.ry * k, mirror ? -o.rot : o.rot)
  return (
    <>
      <path d={join(e(HAUNCH, false), e(HAUNCH, true))} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
      <path d={join(e(HIND_PAW, false), e(HIND_PAW, true))} fill={sock(pal)} stroke={pal.outline} strokeWidth={sw} {...round} />
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Halen (lokalt om tailBase bag højre side): en stor, busket fane, der står op og krummer ind mod ryggen,
// med hvid spids. Signaturen svipper den om roden (`a-curl`).

const TAIL_SPINE: Vec[] = [[0, 2], [10.5, -3], [20, -12], [25.5, -26], [25.5, -41], [21, -54], [11.5, -63]]
const TAIL_W = [12, 22, 29, 31, 28, 19, 0]
const TAIL_PTS = ribbon(TAIL_SPINE, TAIL_W)
const TAIL = blob(TAIL_PTS, 0.9)
const TAIL_TIP = blob(above(xf(TAIL_PTS, { sx: 0.95, sy: 0.97, about: [20, -40] }), -45), 0.85)

const Tail: Part = ({ pal, sw, still, ids }) => {
  const fill = hair(pal, pal.fur, ids.gradient)
  const tip = !pal.silhouette && !pal.gradient
  return (
    <Pivot at={{ x: 0, y: 0 }} cls="a-curl" still={still}>
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
// Ansigt: en stor, blank næse yderst på snuden og et lille "knurhårsfelt" af prikker.

const NOSE: Vec[] = [[0, 4.4], [-3.8, 2.6], [-6.4, -0.4], [-6, -3], [-3, -4.4], [0, -4.7], [3, -4.4], [6, -3], [6.4, -0.4], [3.8, 2.6]]
const DOTS: Vec[] = [[-10.5, 4.5], [-13.5, 7.5], [-9.8, 9]]

const Muzzle: Part = ({ pal, sw, a, lod }) => {
  const m = a.muzzle
  const dots = join(...[...DOTS, ...mirrorX(DOTS)].map(([x, y]) => ellipse(m.x + x, m.y + y, 1.05, 1.05)))
  return (
    <>
      {!pal.silhouette && lod === 'full' && <path d={dots} fill={pal.outline} opacity={0.38} />}
      <path d={blob(xf(NOSE, { dx: m.x, dy: m.y }), 0.8)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.42} {...round} />
      {!pal.silhouette && <path d={ellipse(m.x - 2.4, m.y - 2.2, 2.4, 1.3, -12)} fill={pal.highlight} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Krop: et smalt, hvidt bryst mellem forbenene og en lille pelstot under hagen.

const BIB: Vec[] = [[0, -42], [-8, -40], [-11, -30], [-11.5, -16], [-9, -2], [-4.5, 9], [0, 13], [4.5, 9], [9, -2], [11.5, -16], [11, -30], [8, -40]]

const BodyDeco: Part = ({ pal, a, ids, sw, stage }) => {
  const b = a.bodyCenter
  const k = stage === 3 ? 1.2 : 1
  return (
    <>
      <path d={blob(xf(BIB, { dx: b.x, dy: b.y }), 0.9)} fill={pal.belly} clipPath={`url(#${ids.bodyClip})`} />
      <path d={scallop(100, a.neck.y + 5, 10 * k, 6.5 * k, 6, 0.62, 0)} fill={pal.belly} stroke={pal.outline} strokeWidth={sw * 0.6} strokeLinejoin="round" />
    </>
  )
}

/** Regnbuens krave: fire flade striber i en flæse om halsen (i kroppens lag under kropstøjet). */
const RainbowCollar: Part = ({ pal, sw, ids, colorway, a, stage }) => {
  if (colorway !== 'rainbow' || pal.silhouette) return null
  const k = stage === 3 ? 1.12 : stage === 1 ? 1.06 : 1
  return (
    <path d={scallop(100, a.neck.y + 11 * k, 30 * k, 11 * k, 10, 0.6, -90)} fill={`url(#${ids.gradient})`} stroke={pal.maneOutline} strokeWidth={sw} strokeLinejoin="round" clipPath={`url(#${ids.bodyClip})`} />
  )
}

// ---------------------------------------------------------------------------------------------

/** Fyld bag alt ved armene (se `pawWebs`): lommernes udvidede hylstre pr. race, stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {}

export const fox: SpeciesDef = {
  id: 'fox',
  name: 'Ræv',
  nameClip: 'name.species.fox',
  family: 'canine',
  body: 'tall',
  breeds: [{ id: 'std', name: 'ræv' }],
  colorways: FOX_COLORWAYS,
  magic: ['gold', 'rainbow'],
  anchors: {
    headCenter: { x: 100, y: 92 },
    headRx: 52,
    headRy: 45,
    headTop: { x: 100, y: 48 },
    headWidth: 104,
    earBaseL: { x: 72, y: 63 },
    earBaseR: { x: 128, y: 63 },
    hornBase: { x: 100, y: 50 },
    eyeL: { x: 79, y: 96 },
    eyeR: { x: 121, y: 96 },
    eyeRx: 10.2,
    eyeRy: 12.6,
    muzzle: { x: 100, y: 122 },
    mouth: { x: 100, y: 130 },
    cheekL: { x: 66, y: 113 },
    cheekR: { x: 134, y: 113 },
    neck: { x: 100, y: 140 },
    neckWidth: 46,
    bodyCenter: { x: 100, y: 182 },
    bodyRx: 40,
    bodyRy: 44,
    bodyWidth: 80,
    chest: { x: 100, y: 162 },
    back: { x: 100, y: 162 },
    shoulderL: { x: 85, y: 142 },
    shoulderR: { x: 115, y: 142 },
    pawL: { x: 86, y: 217 },
    pawR: { x: 114, y: 217 },
    footL: { x: 60, y: 220 },
    footR: { x: 140, y: 220 },
    tailBase: { x: 128, y: 212 },
  },
  bounds: {
    head: { x0: 34, y0: 10, x1: 166, y1: 146 },
    body: { x0: 38, y0: 128, x1: 172, y1: 228 },
  },
  // Tankebobler og Zzz (fælles regel): til højre for kinden, under det store øre (også når det hænger i søvn),
  // med mindst 8 enheders luft og inden for den sikre zone på stor.
  fx: { x: 176, y: 96 },
  face: { idleMouth: 'cat-w', cheeks: true },
  ears: { splay: 17 },
  signature: 'tail-swish',
  // Guldets glansbånd på kroppens venstre flanke uden for forbenet.
  goldBand: [150, 196],
  // Forbenene står på jorden: glad løfter dem ud til siden (tegnet −30°, så glad-hoppets 30° passer), og ups
  // er en pote op til kinden. Halen står højt i de glade humør.
  poses: {
    happy: { pawL: { up: true, rot: 30 }, pawR: { up: true, rot: 30 }, tail: -10 },
    cheer: { tail: -12 },
    oops: { pawL: 0, pawR: { up: true }, tail: -4 },
    sleep: { pawL: 0, pawR: 0 },
    wave: { tail: -10 },
  },
  parts: {
    head: foxHead,
    Ear,
    Paw: Leg,
    PawUp,
    PawBack: pawWebs({}, PAW_WEBS),
    pawUpTip: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { x: tipOf(s)[0], y: tipOf(s)[1] }])),
    upArms: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { spine: s, w0: UP_W.w0, w1: UP_W.w1, tip: 12 }])),
    limb: { rot: 0, sleeve: () => blob(LEG_SLEEVE), cuff: { y: 46, half: 11.2 } },
    Feet,
    Tail,
    Muzzle,
    HeadDeco: Mask,
    BodyDeco,
    Ruff: RainbowCollar,
  },
}

export default fox
