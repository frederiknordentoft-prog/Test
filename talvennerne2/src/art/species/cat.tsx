// Katten (bølge 2). Tre racer:
// - domestic (huskat): glat pels og en slank hale, der krøller op langs siden som et spørgsmålstegn.
// - longhair (langhåret): pjusket krave, kindtotter, fnug i ørerne og en busket hale.
// - mainecoon: den store med lossetotter på de høje ører, brystkrave og en kraftig, busket hale.
// Fælles: brede kinder, trekantede ører, et hjerteformet næsetip (kattens særpræg), knurhår,
// forben ned til jorden med åben kontur ved brystet, lårbuler og bagpoter. Signaturen er
// halekrøllen: halens spids sidder i sin egen pivot (`a-curl`), og halen tegnes i tre lag, så leddet
// er sømløst. Mønstre (striber, calico-plader) klippes til hoved og krop.
import { OpenLimb, ROUND, hatted, limbLoop, padsPath } from '../parts/kit'
import { Pivot } from '../rig/Rig'
import {
  blob, ellipse, frame, join, line, mirrorX, offsetLoop, ribbon, scallop, spline, symmetric, tufts, xf,
} from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, OutlineFn, Palette, Part, PartCtx, SidePart, SpeciesDef, Stage } from '../rig/types'
import { CAT_COLORWAYS } from './cat.colorways'

const round = ROUND

// ---------------------------------------------------------------------------------------------
// Hoved: bred "mochi" med fyldige kinder (bredest lidt under øjnene) og en blød, lidt flad isse.

const HEAD_HALF: Vec[] = [
  [0, -1.0], [-0.36, -0.975], [-0.66, -0.84], [-0.87, -0.6], [-0.98, -0.28], [-1.02, 0.05], [-1.0, 0.34],
  [-0.9, 0.6], [-0.68, 0.83], [-0.36, 0.97], [0, 1.0],
]
const HEAD_UNIT = symmetric(HEAD_HALF)
const catHead: OutlineFn = (a: AnchorSet, inflate: number) =>
  blob(offsetLoop(frame(HEAD_UNIT, a.headCenter.x, a.headCenter.y, a.headRx, a.headRy), inflate))

// ---------------------------------------------------------------------------------------------
// Ører (lokalt: basen i (0,0), peger op): trekanter med let buede sider og rund spids.

const CAT_EAR: Vec[] = [
  [0, 12], [-13, 9], [-18.5, 0], [-18, -11], [-14.5, -22], [-9.2, -31], [-4.4, -37], [-1.2, -38.6], [2, -37.4],
  [6.4, -31], [11.4, -21.5], [15.4, -10], [17, 0], [12.5, 9],
]
const CAT_INNER: Vec[] = [
  [0.5, 1], [-11, -2], [-11.4, -10], [-8.6, -20], [-4.6, -28], [-1.2, -31.6], [1.8, -29], [5.6, -20], [9, -10], [10.4, -2.4],
]
/** Langhår: mindre, rundere ører, der næsten forsvinder i pelsen. */
const SMALL_EAR = xf(CAT_EAR, { sy: 0.84, sx: 0.96 })
const SMALL_INNER = xf(CAT_INNER, { sy: 0.82, sx: 0.94 })
/** Maine coon: højere øre med en lossetot i spidsen. */
const COON_EAR: Vec[] = [
  [0, 12], [-14, 9], [-19.5, 0], [-19.4, -12], [-16, -23.5], [-10.6, -33], [-6.2, -39], [-4, -43.6], [-2.6, -48.6],
  [-1, -43.4], [1.8, -39], [7, -32.5], [12.6, -22], [16.6, -10.5], [18, 0], [13, 9],
]
const COON_INNER = xf(CAT_INNER, { sy: 1.12, sx: 1.04 })
/** Pels i øret (langhår og maine coon): tre lyse totter fra bunden op mod midten. */
const EAR_WISPS: Vec[][] = [
  [[-6.8, -1], [-6, -9], [-3.8, -15.5]],
  [[-1.6, 0], [-1.4, -9], [-0.4, -17.5]],
  [[4.4, -1], [3.6, -8.5], [1.8, -14.5]],
]

const earScale = (stage: Stage) => (stage === 1 ? { sx: 1.06, sy: 1.04 } : {})

function makeEar(outer: readonly Vec[], inner: readonly Vec[], wisps: boolean): SidePart {
  const hattedOuter = hatted(outer, -4, 5)
  return ({ pal, sw, stage, hat, side, colorway, lod }) => {
    const s = earScale(stage)
    const shape = xf(hat === 'through' ? hattedOuter : outer, s)
    // Calico: venstre øre orange, højre mørkt (pladerne fortsætter op i ørerne).
    const calico = colorway === 'c4' && !pal.silhouette
    const fur = calico ? (side === 'L' ? pal.pattern : (pal.pattern2 ?? pal.pattern)) : pal.earFur
    return (
      <>
        <path d={blob(shape)} fill={fur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
        <path d={blob(xf(inner, s))} fill={pal.inner} />
        {wisps && lod === 'full' && !pal.silhouette && (
          <path d={join(...EAR_WISPS.map((w) => spline(xf(w, s))))} fill="none" stroke={pal.belly} strokeWidth={sw * 0.62} {...round} />
        )}
      </>
    )
  }
}

// ---------------------------------------------------------------------------------------------
// Forben: buttede søjler ned til jorden med en rund pote og åben kontur ved brystet.

/** Hvilende forben (lokalt om skulderen): roden oppe på brystet, poten på jorden. */
const LEG_SPINE: Vec[] = [[0, -4], [0.3, 3], [0.6, 10], [0.9, 17]]
const LEG = limbLoop(LEG_SPINE, 19.5, 23.5, 7)
const LEG_TOES: Vec[][] = [
  [[-4, 28], [-3.6, 23.4]],
  [[4, 28], [3.6, 23.4]],
]
/** Ærmet: forbenet fra brystet til manchetten (lodret ramme), en anelse løsere. */
const LEG_SLEEVE: Vec[] = [[-11.4, -6], [-11.8, 1], [-12.2, 7], [0, 8.6], [12.2, 7], [11.8, 1], [11.4, -6], [0, -8]]

const Leg: SidePart = ({ pal, sw, lod }) => (
  <OpenLimb loop={LEG} fill={pal.fur} stroke={pal.outline} sw={sw} trim={1}>
    {lod === 'full' && <path d={join(...LEG_TOES.map((t) => spline(t)))} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />}
  </OpenLimb>
)

/** Løftede poter (lokalt om skulderen; roden ligger højere oppe på brystet). */
const UP_SPINES = {
  cheer: [[1, -29], [-7, -38], [-16, -48], [-25, -58], [-31, -67]] as Vec[],
  // Vink: lykkekattens pote – overarmen ud, underarmen op, poten ved siden af kinden.
  wave: [[2, -29], [-9, -35], [-21, -39], [-31, -47], [-35, -60], [-36, -73]] as Vec[],
  think: [[-1, -29], [5, -37], [10, -44], [13, -50]] as Vec[],
  // Ups: poten op til munden (pelspleje), tungen ude.
  oops: [[-1, -29], [4, -38], [8, -47], [10, -55]] as Vec[],
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
// Bagben: lårbuler og små bagpoter, der titter frem forrest.

const HAUNCH = { cx: 64, cy: 207, rx: 18.5, ry: 17.5, rot: -16 }
const HIND_PAW = { cx: 58.5, cy: 221.2, rx: 12.6, ry: 6.6, rot: -8 }
const HIND_TOES: Vec[][] = [
  [[52.6, 226.2], [53.4, 222.4]],
  [[58.2, 227], [58.6, 223]],
]

const Feet: Part = ({ pal, sw, stage, lod }) => {
  const k = stage === 3 ? 1.08 : 1
  const e = (o: typeof HAUNCH, mirror: boolean) =>
    ellipse(mirror ? 200 - o.cx : o.cx, o.cy, o.rx * k, o.ry * k, mirror ? -o.rot : o.rot)
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
// Halen i tre lag: (1) basens kontur, (2) spidsen i sin pivot (kontur + fyld + ringe), (3) basens
// fyld ovenpå, der dækker leddets kontur. Busket hale (langhår, maine coon) bruger totter.

interface TailShape {
  base: Vec[]
  /** Spidsen relativt til leddet J (= basens sidste punkt). */
  tip: Vec[]
  /** Rørets bredde (glat hale) eller bredder langs rygraden (busket hale). */
  w: number
  bushy?: { base: readonly number[]; tip: readonly number[] }
}

const TAILS: Record<'domestic' | 'longhair' | 'mainecoon', TailShape> = {
  domestic: {
    base: [[0, 0], [12, -2], [23, -9], [28, -21], [28, -34]],
    tip: [[0, 0], [-1, -10], [-6, -17.5], [-13.4, -18.4], [-17, -13]],
    w: 10.5,
  },
  longhair: {
    base: [[0, 0], [11, -3], [20, -11], [24.5, -23], [24.5, -35]],
    tip: [[0, 0], [-1.4, -10], [-6.4, -17], [-13.4, -18], [-16.4, -12.6]],
    w: 15,
    bushy: { base: [13, 15, 16.5, 17.5, 18], tip: [18, 18, 16.5, 13.5, 0] },
  },
  mainecoon: {
    base: [[0, 0], [11, -3], [19, -12], [23, -26], [22.5, -40]],
    tip: [[0, 0], [-1.6, -11], [-7, -18.6], [-14.6, -19.4], [-18.4, -13.4]],
    w: 16,
    bushy: { base: [13, 15, 17, 18, 18.5], tip: [18.5, 18.5, 17, 14, 0] },
  },
}

/** Busket kontur: et bånd langs rygraden med små, strøgne totter på siderne. */
function bushy(spine: readonly Vec[], widths: readonly number[], amp: number, phase: number): Vec[] {
  const loop = ribbon(spine, widths)
  return loop.map(([x, y], i) => {
    const k = ((i + phase) % 2 === 0 ? 1 : -0.4) * amp
    const c = loop[(i + 1) % loop.length]
    const p = loop[(i - 1 + loop.length) % loop.length]
    const dx = c[0] - p[0]
    const dy = c[1] - p[1]
    const l = Math.hypot(dx, dy) || 1
    return [x + (dy / l) * k, y - (dx / l) * k] as Vec
  })
}

/** Ringe på tværs af halen (striber), lidt kortere end bredden, så de ligger inden for konturen. */
function rings(spine: readonly Vec[], at: readonly number[], len: number): string {
  return join(
    ...at.map((t) => {
      const f = t * (spine.length - 1)
      const i = Math.min(spine.length - 2, Math.floor(f))
      const u = f - i
      const [x0, y0] = spine[i]
      const [x1, y1] = spine[i + 1]
      const x = x0 + (x1 - x0) * u
      const y = y0 + (y1 - y0) * u
      const l = Math.hypot(x1 - x0, y1 - y0) || 1
      const nx = -(y1 - y0) / l
      const ny = (x1 - x0) / l
      return line([x - nx * len * 0.5, y - ny * len * 0.5], [x + nx * len * 0.5, y + ny * len * 0.5])
    }),
  )
}

function tailColors(pal: Palette, colorway: string, ids: PartCtx['ids']) {
  if (pal.gradient) return { base: `url(#${ids.gradient})`, tip: `url(#${ids.gradient})` }
  if (colorway === 'c4' && !pal.silhouette) return { base: pal.pattern, tip: pal.pattern2 ?? pal.pattern }
  return { base: pal.mane, tip: pal.mane }
}

function makeTail(t: TailShape): Part {
  const J = t.base[t.base.length - 1]
  const baseLoop = t.bushy ? bushy(t.base, t.bushy.base, 1.4, 0) : null
  const tipLoop = t.bushy ? bushy(t.tip, t.bushy.tip, 1.6, 1) : null
  return ({ pal, sw, still, colorway, ids, lod }) => {
    const col = tailColors(pal, colorway, ids)
    const tabby = colorway !== 'c4' && pal.pattern !== pal.fur && !pal.silhouette && !pal.gradient && lod === 'full'
    const ringW = sw * 1.1
    const w = t.w
    const outlineOf = (d: string, wide: number) =>
      t.bushy ? <path d={d} fill={pal.outline} stroke={pal.outline} strokeWidth={sw * 2} {...round} /> : <path d={d} fill="none" stroke={pal.outline} strokeWidth={wide} {...round} />
    const fillOf = (d: string, color: string) =>
      t.bushy ? <path d={d} fill={color} /> : <path d={d} fill="none" stroke={color} strokeWidth={w} {...round} />
    const baseD = baseLoop ? blob(baseLoop, 0.85) : spline(t.base)
    const tipD = tipLoop ? blob(tipLoop, 0.85) : spline(t.tip)
    return (
      <>
        {outlineOf(baseD, w + 2 * sw)}
        <Pivot at={{ x: J[0], y: J[1] }} cls="a-curl" still={still}>
          {outlineOf(tipD, w + 2 * sw)}
          {fillOf(tipD, col.tip)}
          {tabby && <path d={rings(t.tip, [0.42, 0.78], w * 0.92)} fill="none" stroke={pal.pattern} strokeWidth={ringW} {...round} />}
        </Pivot>
        {fillOf(baseD, col.base)}
      </>
    )
  }
}

// ---------------------------------------------------------------------------------------------
// Ansigt: hjertenæse (særpræget), knurhårspuder og knurhår.

const NOSE: Vec[] = [
  [0, 3.4], [-2.6, 1.3], [-4.5, -1.1], [-4.3, -3.1], [-2.5, -3.9], [-0.7, -3.1], [0, -2.3], [0.7, -3.1], [2.5, -3.9],
  [4.3, -3.1], [4.5, -1.1], [2.6, 1.3],
]

function makeMuzzle(padK: number): Part {
  return ({ pal, sw, a, lod }) => {
    const m = a.muzzle
    const px = 6.2 * padK
    const pads = join(ellipse(m.x - px, m.y + 5.6, 7.6 * padK, 5.6 * padK), ellipse(m.x + px, m.y + 5.6, 7.6 * padK, 5.6 * padK))
    const whisk = (s: number): string =>
      join(
        spline([[m.x + s * 15, m.y + 3], [m.x + s * 34, m.y - 1], [m.x + s * 58, m.y - 3.5]]),
        spline([[m.x + s * 15.5, m.y + 6.5], [m.x + s * 35, m.y + 6.5], [m.x + s * 59, m.y + 8.5]]),
        spline([[m.x + s * 15, m.y + 10], [m.x + s * 32, m.y + 13.5], [m.x + s * 53, m.y + 19]]),
      )
    return (
      <>
        {!pal.silhouette && <path d={pads} fill={pal.belly} />}
        {lod === 'full' && <path d={join(whisk(-1), whisk(1))} fill="none" stroke={pal.outline} strokeOpacity={pal.silhouette ? 1 : 0.5} strokeWidth={sw * 0.42} {...round} />}
        <path d={blob(xf(NOSE, { dx: m.x, dy: m.y }), 0.8)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.42} {...round} />
      </>
    )
  }
}

// ---------------------------------------------------------------------------------------------
// Krop: lys hagesmæk mellem forbenene og brystfnug under hagen.

/** Hagesmækken: bred under hagen, rund forneden mellem forbenene (lokalt om kroppens centrum). */
const BIB: Vec[] = [[0, -42], [-12.5, -37], [-15.5, -25], [-12.5, -11], [-6.4, -1], [0, 2], [6.4, -1], [12.5, -11], [15.5, -25], [12.5, -37]]

const BodyDeco: Part = ({ pal, a, ids, sw, stage }) => {
  const b = a.bodyCenter
  const k = stage === 3 ? 1.25 : 1
  return (
    <>
      <path d={blob(xf(BIB, { dx: b.x, dy: b.y }), 0.9)} fill={pal.belly} clipPath={`url(#${ids.bodyClip})`} />
      <path d={scallop(100, a.neck.y + 4, 12 * k, 7 * k, 7, 0.62, 0)} fill={pal.belly} stroke={pal.outline} strokeWidth={sw * 0.6} strokeLinejoin="round" />
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Mønstre: striber (tabby) og calico-plader, klippet til hoved og krop.

/** Panden: et "M" af tre striber og to kindstriber på hver side (lokalt om hovedets centrum, enhed). */
const TABBY_HEAD: Vec[][] = [
  [[0, -0.98], [0, -0.7]],
  [[-0.2, -0.95], [-0.15, -0.72]],
  [[0.2, -0.95], [0.15, -0.72]],
  [[-1.02, 0.12], [-0.8, 0.16]],
  [[-1.0, 0.33], [-0.79, 0.31]],
  [[1.02, 0.12], [0.8, 0.16]],
  [[1.0, 0.33], [0.79, 0.31]],
]
const TabbyHead: Part = ({ pal, a, ids, sw }) => (
  <path
    d={join(...TABBY_HEAD.map((s) => spline(frame(s, a.headCenter.x, a.headCenter.y, a.headRx, a.headRy))))}
    fill="none"
    stroke={pal.pattern}
    strokeWidth={sw * 1.35}
    clipPath={`url(#${ids.headClip})`}
    {...round}
  />
)

/** Siderne: tre buede striber på hver side af kroppen. */
const TABBY_BODY: Vec[][] = [
  [[-1.02, -0.32], [-0.78, -0.22], [-0.66, -0.1]],
  [[-1.02, 0.02], [-0.8, 0.08], [-0.68, 0.18]],
  [[-1.0, 0.36], [-0.8, 0.4], [-0.7, 0.48]],
]
const TabbyBody: Part = ({ pal, a, ids, sw }) => {
  const f = (s: readonly Vec[]) => frame(s, a.bodyCenter.x, a.bodyCenter.y, a.bodyRx, a.bodyRy)
  return (
    <path
      d={join(...TABBY_BODY.flatMap((s) => [spline(f(s)), spline(mirrorX(f(s), a.bodyCenter.x))]))}
      fill="none"
      stroke={pal.pattern}
      strokeWidth={sw * 1.4}
      clipPath={`url(#${ids.bodyClip})`}
      {...round}
    />
  )
}

/** Calico: en orange plade over venstre øje og øre, en mørk plade øverst til højre. */
const CALICO_HEAD_A: Vec[] = [[-1.1, -0.55], [-0.62, -1.1], [-0.12, -0.92], [-0.08, -0.46], [-0.36, -0.16], [-0.78, 0.0], [-1.1, -0.06]]
const CALICO_HEAD_B: Vec[] = [[0.3, -1.1], [0.86, -0.96], [1.1, -0.5], [1.0, -0.18], [0.62, -0.32], [0.34, -0.56]]
const CALICO_BODY_A: Vec[] = [[-1.1, -0.1], [-0.62, -0.28], [-0.36, 0.1], [-0.46, 0.62], [-1.0, 0.86]]
const CALICO_BODY_B: Vec[] = [[1.1, -0.55], [0.72, -0.7], [0.44, -0.4], [0.5, 0.0], [0.9, 0.2], [1.1, 0.1]]

const CalicoHead: Part = ({ pal, a, ids }) => {
  const f = (s: readonly Vec[]) => blob(frame(s, a.headCenter.x, a.headCenter.y, a.headRx, a.headRy), 0.9)
  return (
    <>
      <path d={f(CALICO_HEAD_A)} fill={pal.pattern} clipPath={`url(#${ids.headClip})`} />
      <path d={f(CALICO_HEAD_B)} fill={pal.pattern2 ?? pal.pattern} clipPath={`url(#${ids.headClip})`} />
    </>
  )
}
const CalicoBody: Part = ({ pal, a, ids }) => {
  const f = (s: readonly Vec[]) => blob(frame(s, a.bodyCenter.x, a.bodyCenter.y, a.bodyRx, a.bodyRy), 0.9)
  return (
    <>
      <path d={f(CALICO_BODY_A)} fill={pal.pattern} clipPath={`url(#${ids.bodyClip})`} />
      <path d={f(CALICO_BODY_B)} fill={pal.pattern2 ?? pal.pattern} clipPath={`url(#${ids.bodyClip})`} />
    </>
  )
}

const PatternHead: Part = (p) => (p.colorway === 'c4' ? CalicoHead(p) : TabbyHead(p))
const PatternBody: Part = (p) => (p.colorway === 'c4' ? CalicoBody(p) : TabbyBody(p))

// ---------------------------------------------------------------------------------------------
// Krave og kindtotter (langhår, maine coon) og regnbuens halsflæse (huskat). Kraverne ligger i
// kroppens lag (`Ruff`), så kropstøj dækker dem.

/** Kravens vækst pr. stadie (om halsen): babyen har en lille krave, den store en fyldig. */
const ruffK = (stage: number) => (stage === 3 ? 1.18 : stage === 1 ? 1.08 : 1)

/** Krave af bløde pelstotter i brystets lyse farve (i kroppens lag, så en trøje dækker den). */
function makeRuff(rx: number, ry: number, dy: number, count: number, depth = 0.1): Part {
  const loop = tufts(100, 0, rx, ry, count, { depth, swirl: 4, jitter: 0.05 })
  return ({ pal, sw, a, ids, stage }) => {
    const k = ruffK(stage)
    return (
      <path
        d={blob(xf(loop, { sx: k, about: [100, 0], dy: a.neck.y + dy * k }), 1)}
        fill={pal.gradient ? `url(#${ids.gradient})` : pal.belly}
        stroke={pal.maneOutline}
        strokeWidth={sw}
        {...round}
      />
    )
  }
}

const RainbowCollar: Part = ({ pal, sw, ids, colorway, a, stage }) =>
  colorway === 'rainbow' && !pal.silhouette ? (
    <path d={scallop(100, a.neck.y + 6 * ruffK(stage), 36 * ruffK(stage), 12 * ruffK(stage), 11, 0.6, -90)} fill={`url(#${ids.gradient})`} stroke={pal.maneOutline} strokeWidth={sw} strokeLinejoin="round" />
  ) : null

/** Kindtotter: strøgne spidser ud fra kinderne, klippet "uden for hovedet" (sømløse). */
function makeCheekTufts(size: number): Part {
  const left = tufts(0, 0, size, size * 1.05, 4, { depth: 0.3, swirl: 12, from: 90, to: 270, phase: 0 })
  return ({ pal, sw, a, ids }) => {
    const at = { x: a.headCenter.x - a.headRx * 0.9, y: a.headCenter.y + a.headRy * 0.26 }
    const l = xf(left, { dx: at.x, dy: at.y })
    return (
      <path
        d={join(blob(l, 0.7), blob(mirrorX(l, a.headCenter.x), 0.7))}
        fill={pal.fur}
        stroke={pal.outline}
        strokeWidth={sw}
        clipPath={`url(#${ids.outsideHead})`}
        {...round}
      />
    )
  }
}

// ---------------------------------------------------------------------------------------------

/** Maine coon er en stor kat: alle ankre skaleret om fodpunktet, hovedet lidt større endnu. */
const COON_ANCHORS: Partial<AnchorSet> = {
  headCenter: { x: 100, y: 98 },
  headRx: 60,
  headRy: 48,
  headTop: { x: 100, y: 50 },
  headWidth: 118,
  earBaseL: { x: 68, y: 65.5 },
  earBaseR: { x: 132, y: 65.5 },
  hornBase: { x: 100, y: 54 },
  eyeL: { x: 76, y: 102 },
  eyeR: { x: 124, y: 102 },
  eyeRx: 10.9,
  eyeRy: 12.9,
  muzzle: { x: 100, y: 119 },
  mouth: { x: 100, y: 127.5 },
  cheekL: { x: 62, y: 118 },
  cheekR: { x: 138, y: 118 },
  neck: { x: 100, y: 145 },
  bodyCenter: { x: 100, y: 183 },
  bodyRx: 48,
  bodyRy: 43,
  bodyWidth: 96,
  shoulderL: { x: 82.5, y: 197.5 },
  shoulderR: { x: 117.5, y: 197.5 },
  tailBase: { x: 134, y: 212 },
}

export const cat: SpeciesDef = {
  id: 'cat',
  name: 'Kat',
  nameClip: 'name.species.cat',
  family: 'feline',
  body: 'round',
  breeds: [
    { id: 'domestic', name: 'huskat' },
    {
      id: 'longhair',
      name: 'langhåret kat',
      anchors: { bodyRx: 47, bodyWidth: 94, eyeL: { x: 77, y: 106 }, eyeR: { x: 123, y: 106 }, muzzle: { x: 100, y: 121 }, mouth: { x: 100, y: 128.5 } },
      parts: {
        Ear: makeEar(SMALL_EAR, SMALL_INNER, true),
        Tail: makeTail(TAILS.longhair),
        Ruff: makeRuff(56, 28, 0, 19, 0.16),
        HeadDeco: makeCheekTufts(14),
        Muzzle: makeMuzzle(0.9),
      },
      bounds: { head: { x0: 34, y0: 14, x1: 166, y1: 172 } },
    },
    {
      id: 'mainecoon',
      name: 'maine coon',
      anchors: COON_ANCHORS,
      ears: { splay: 9 },
      parts: {
        Ear: makeEar(COON_EAR, COON_INNER, true),
        Tail: makeTail(TAILS.mainecoon),
        Ruff: makeRuff(26, 12, 6, 9, 0.12),
        Muzzle: makeMuzzle(1.12),
      },
      bounds: { head: { x0: 32, y0: -2, x1: 168, y1: 168 }, body: { x0: 36, y0: 136, x1: 178, y1: 228 } },
    },
  ],
  colorways: CAT_COLORWAYS,
  magic: ['gold', 'rainbow'],
  anchors: {
    headCenter: { x: 100, y: 100 },
    headRx: 57,
    headRy: 46,
    headTop: { x: 100, y: 54 },
    headWidth: 112,
    earBaseL: { x: 70, y: 66 },
    earBaseR: { x: 130, y: 66 },
    hornBase: { x: 100, y: 58 },
    eyeL: { x: 77, y: 104 },
    eyeR: { x: 123, y: 104 },
    eyeRx: 10.8,
    eyeRy: 12.8,
    muzzle: { x: 100, y: 119.5 },
    mouth: { x: 100, y: 127 },
    cheekL: { x: 64, y: 119 },
    cheekR: { x: 136, y: 119 },
    neck: { x: 100, y: 145 },
    bodyCenter: { x: 100, y: 186 },
    bodyRx: 45,
    bodyRy: 40,
    bodyWidth: 90,
    chest: { x: 100, y: 166 },
    back: { x: 100, y: 166 },
    shoulderL: { x: 83.5, y: 197.5 },
    shoulderR: { x: 116.5, y: 197.5 },
    pawL: { x: 85.5, y: 221 },
    pawR: { x: 114.5, y: 221 },
    footL: { x: 60, y: 218 },
    footR: { x: 140, y: 218 },
    tailBase: { x: 134, y: 214 },
  },
  bounds: {
    head: { x0: 36, y0: 18, x1: 164, y1: 150 },
    body: { x0: 38, y0: 140, x1: 176, y1: 228 },
  },
  fx: { x: 168, y: 96 },
  face: { idleMouth: 'cat-w', cheeks: true },
  ears: { splay: 13 },
  signature: 'tail-curl',
  // Forbenene står på jorden: glad løfter dem kun lidt; ups er en pote op til munden (pelspleje).
  // Halen svinger kun lidt (den krøllede spids ville ellers ramme kanten på stor).
  poses: {
    happy: { pawL: 14, pawR: 14, tail: 4 },
    cheer: { tail: 5 },
    think: { tail: -4 },
    oops: { pawL: 0, pawR: { up: true }, tail: 3 },
    sleep: { pawL: 0, pawR: 0 },
    wave: { tail: 4 },
  },
  parts: {
    head: catHead,
    Ear: makeEar(CAT_EAR, CAT_INNER, false),
    Paw: Leg,
    PawUp,
    pawUpTip: { cheer: { x: -31, y: -67 }, wave: { x: -36, y: -73 }, think: { x: 13, y: -50 }, oops: { x: 10, y: -55 } },
    limb: { rot: 0, sleeve: () => blob(LEG_SLEEVE), cuff: { y: 7, half: 12.6 } },
    Feet,
    Tail: makeTail(TAILS.domestic),
    Muzzle: makeMuzzle(1),
    BodyDeco,
    Ruff: RainbowCollar,
    Pattern: { head: PatternHead, body: PatternBody },
  },
}

export default cat
