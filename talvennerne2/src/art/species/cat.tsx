// Katten (bølge 2). Tre racer:
// - domestic (huskat): glat pels og en slank hale, der krøller op langs siden som et spørgsmålstegn.
// - longhair (langhåret): en rund, symmetrisk krave af store, bløde totter, fnug i ørerne og en busket hale.
//   Ingen spidse kindtotter: de er rævens kendetegn (blindtest G1-r4 og G2-r1).
// - mainecoon: den store med lossetotter på de høje ører, brystkrave og en kraftig, busket hale.
// Fælles: brede kinder, trekantede ører, et hjerteformet næsetip (kattens særpræg), knurhår,
// forben ned til jorden med åben kontur ved brystet, lårbuler og bagpoter. Signaturen er
// halekrøllen: halens spids sidder i sin egen pivot (`a-curl`), og halen tegnes i tre lag, så leddet
// er sømløst. Mønstre (striber, calico-plader) klippes til hoved og krop.
import { OpenLimb, ROUND, hatted, limbLoop, padsPath, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { Pivot } from '../rig/Rig'
import {
  blob, ellipse, frame, join, line, mirrorX, offsetLoop, ribbon, scallop, spline, symmetric, tufts, xf,
} from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, OutlineFn, Palette, Part, PartCtx, SidePart, SpeciesDef, Stage } from '../rig/types'
import { CAT_COLORWAYS } from './cat.colorways'
import { addWebs } from './shared/equine'

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
/**
 * Ærmet: forbenet fra brystet helt ned til lige over poten (lodret ramme), en anelse løsere, så det
 * læses som et ærme og ikke som en lomme på ribkanten (review G1-r2, C2).
 */
const LEG_SLEEVE: Vec[] = [[-11.6, -9], [-12, 0], [-12.4, 8], [-12.6, 13.6], [0, 15.4], [12.6, 13.6], [12.4, 8], [12, 0], [11.6, -9], [0, -11]]

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
  /** Dæmpningen af riggens vækst på stor (standard `TAIL_STAGE3`). */
  grow3?: number
}

// De buskede haler slutter under kraven og hovedet, så halespidsen aldrig lukker en sprække med baggrund
// inde mellem krave, skulder og hale (review G1-r3, huller-lint).
const TAILS: Record<'domestic' | 'longhair' | 'mainecoon', TailShape> = {
  // Huskatten: et åbent spørgsmålstegn. Krogen slutter med luft til kroppen og knurhårene, så halen aldrig
  // lukker en lomme mellem hale, hofte og krop (review G1-r4, huller-lint).
  domestic: {
    base: [[0, 0], [12, -2], [23, -9], [29, -22], [29.5, -36]],
    tip: [[0, 0], [-0.4, -8.2], [-3.8, -13.6], [-8.8, -14.8], [-11.2, -11.4]],
    w: 10.5,
    grow3: 0.83,
  },
  longhair: {
    base: [[0, 0], [9.5, -3], [16.5, -11], [19, -21.5], [19, -30]],
    tip: [[0, 0], [-1.4, -10], [-6.4, -17], [-13.4, -18], [-16.4, -12.6]],
    w: 15,
    bushy: { base: [13, 15, 16.5, 17.5, 18], tip: [18, 18, 16.5, 13.5, 0] },
  },
  mainecoon: {
    base: [[0, 0], [11, -3], [19, -12], [23, -24], [22.5, -33]],
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

/**
 * Halens vækst på stor: riggen skalerer halen 1,3 (STAGE_XF), men så når krogen op til knurhårene og lukker
 * en lomme mellem hale, krop og kind (review G1-r4, huller-lint). Katten dæmper den til ca. 1,1: de buskede haler
 * 0,86 (ca. 1,12), huskattens 0,83 (ca. 1,08), så dens hale også bliver i den sikre zone, når den svinger ud i vink.
 */
const TAIL_STAGE3 = 0.86

/** Halen skaleret om roden (punkter og bredder, så stregen bevarer sin bredde og der ikke kommer flere elementer). */
function scaleTail(t: TailShape, k: number): TailShape {
  const sc = (pts: readonly Vec[]) => pts.map(([x, y]) => [x * k, y * k] as Vec)
  return {
    base: sc(t.base),
    tip: sc(t.tip),
    w: t.w * k,
    bushy: t.bushy && { base: t.bushy.base.map((v) => v * k), tip: t.bushy.tip.map((v) => v * k) },
  }
}

function makeTail(t: TailShape): Part {
  const grown = makeTailInner(t)
  const big = makeTailInner(scaleTail(t, t.grow3 ?? TAIL_STAGE3))
  return (p) => (p.stage === 3 ? big(p) : grown(p))
}

function makeTailInner(t: TailShape): Part {
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

/**
 * Knurhårene stikker mindst 6 enheder ud over hovedets kontur (review G1-r4 §5 og G2-r1 §2), så katten også
 * læses som kat i sort: ræven har ingen. Spidserne regnes fra hovedets halve bredde, så de følger racen.
 * I silhuetten er de en anelse tykkere, så de ses ved arkenes størrelse.
 */
const WHISKERS: { mid: Vec; tip: Vec; root: Vec }[] = [
  { root: [15, 3], mid: [36, -1.5], tip: [9.5, -5.5] },
  { root: [15.5, 6.5], mid: [37, 6.5], tip: [10.5, 7] },
  { root: [15, 10], mid: [34, 12.5], tip: [5.5, 13.5] },
]

function makeMuzzle(padK: number): Part {
  return ({ pal, sw, a, lod }) => {
    const m = a.muzzle
    const px = 6.2 * padK
    const pads = join(ellipse(m.x - px, m.y + 5.6, 7.6 * padK, 5.6 * padK), ellipse(m.x + px, m.y + 5.6, 7.6 * padK, 5.6 * padK))
    const reach = a.headRx
    const whisk = (s: number): string =>
      join(
        ...WHISKERS.map(({ root, mid, tip }) =>
          spline([[m.x + s * root[0], m.y + root[1]], [m.x + s * mid[0], m.y + mid[1]], [m.x + s * (reach + tip[0]), m.y + tip[1]]]),
        ),
      )
    return (
      <>
        {!pal.silhouette && <path d={pads} fill={pal.belly} />}
        {lod === 'full' && <path d={join(whisk(-1), whisk(1))} fill="none" stroke={pal.outline} strokeOpacity={pal.silhouette ? 1 : 0.5} strokeWidth={sw * (pal.silhouette ? 0.6 : 0.42)} {...round} />}
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

/**
 * Krave af bløde pelstotter i brystets lyse farve (i kroppens lag, så en trøje dækker den). Med kropstøj
 * klippes den til kroppen, så kravens buer aldrig titter frem over trøjens skuldre (review G1-r3, C1).
 */
function makeRuff(rx: number, ry: number, dy: number, count: number, depth = 0.1): Part {
  const loop = tufts(100, 0, rx, ry, count, { depth, swirl: 4, jitter: 0.05 })
  return ({ pal, sw, a, ids, stage, clothed }) => {
    const k = ruffK(stage)
    return (
      <path
        d={blob(xf(loop, { sx: k, about: [100, 0], dy: a.neck.y + dy * k }), 1)}
        fill={pal.gradient ? `url(#${ids.gradient})` : pal.belly}
        stroke={pal.maneOutline}
        strokeWidth={sw}
        clipPath={clothed ? `url(#${ids.bodyClip})` : undefined}
        {...round}
      />
    )
  }
}

/** Regnbuekraven ligger på brystfladen inden for armene (klippet til kroppen; review G1-r3, C3). */
const RainbowCollar: Part = ({ pal, sw, ids, colorway, a, stage }) =>
  colorway === 'rainbow' && !pal.silhouette ? (
    <path d={scallop(100, a.neck.y + 6 * ruffK(stage), 25 * ruffK(stage), 12 * ruffK(stage), 8, 0.6, -90)} fill={`url(#${ids.gradient})`} stroke={pal.maneOutline} strokeWidth={sw} strokeLinejoin="round" clipPath={`url(#${ids.bodyClip})`} />
  ) : null

/**
 * Langhårskravens runde, symmetriske krave (review G1-r4 §5 og G2-r1 §2): store, bløde totter (husets
 * scallop) om halsen med en kløft midt under hagen, så der ses to runde totter på hver side. Den runde
 * kontur og de vandrette knurhår over den skiller katten fra rævens spidse kindtotter, også i sort. En kort
 * pelsstreg i hver tot giver den lange pels uden at bryde silhuetten (i kroppens lag, så kropstøj dækker den).
 */
function makeRoundRuff(rx: number, ry: number, dy: number, lobes: number): Part {
  return ({ pal, sw, a, ids, stage, clothed, lod }) => {
    const k = ruffK(stage)
    const cy = a.neck.y + dy * k
    const clip = clothed ? `url(#${ids.bodyClip})` : undefined
    // Pelsstreger midt i de nederste totter (lodret symmetriske om x = 100).
    const strands = Array.from({ length: lobes }, (_, i) => 90 + (360 * (i + 0.5)) / lobes)
      .filter((deg) => deg > 20 && deg < 160)
      .map((deg) => {
        const t = (deg * Math.PI) / 180
        const c = Math.cos(t)
        const s = Math.sin(t)
        const at = (f: number): Vec => [100 + rx * k * f * c, cy + ry * k * f * s]
        return spline([at(0.66), at(0.86)])
      })
    return (
      <>
        <path
          d={scallop(100, cy, rx * k, ry * k, lobes, 0.6, 90)}
          fill={pal.gradient ? `url(#${ids.gradient})` : pal.belly}
          stroke={pal.maneOutline}
          strokeWidth={sw}
          clipPath={clip}
          {...round}
        />
        {lod === 'full' && !pal.silhouette && (
          <path d={join(...strands)} fill="none" stroke={pal.maneOutline} strokeWidth={sw * 0.5} clipPath={clip} {...round} />
        )}
      </>
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

/** Fyld bag alt ved armene (se `pawWebs`): lommernes udvidede hylstre pr. race, stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {
  domestic: {
    2: {
      cheer: { L: [[-7.8, -52.6], [-7.4, -53.7], [-6.3, -54.1], [-3.8, -54], [1.7, -52.6], [2.2, -51.1], [0.3, -47.8], [-1.9, -46.9], [-4.1, -47.4], [-7.4, -51.5]], R: [[-6.2, -51.4], [-5.8, -52.5], [-3, -53], [2, -52.1], [3.1, -51.7], [3.5, -50.6], [3.1, -48.9], [-0.1, -47.2], [-1.8, -46.8], [-4.6, -48.7]] },
      wave: { R: [[-24.4, -27.1], [-23.5, -29.8], [-21.8, -30.2], [-20.7, -29.8], [-20.3, -28.7], [-20.3, -27.6], [-21.8, -24.8], [-22.9, -24.4], [-24, -24.8], [-24.4, -25.9]] },
    },
    3: {
      cheer: { L: [[-8.4, -54.7], [-6, -55.1], [-2, -54.1], [0.8, -53.2], [1.2, -52.1], [1.3, -48.8], [0.9, -47.7], [-2.6, -46], [-3.7, -46.4], [-8.4, -52.5]] },
      wave: { R: [[-25.7, -66.9], [-25.3, -68], [-24.2, -68.4], [-23.1, -68], [-21.4, -65], [-21.8, -63.9], [-22.9, -63.5], [-24.2, -63.5], [-25.3, -63.9], [-25.7, -65]] },
    },
  },
  longhair: {
    3: {
      happy: { R: [[-31.8, -13.2], [-29, -28.4], [-28.6, -29.5], [-27.5, -29.9], [-23, -29.6], [-21.9, -29.2], [-21.5, -28.1], [-28.7, -11.4], [-30.3, -10.7], [-31.4, -11.1]] },
      idle: { R: [[-32.1, -13.4], [-28.7, -28.5], [-28.3, -29.6], [-27.2, -30], [-23.2, -29.8], [-22.1, -29.4], [-21.6, -28], [-29.1, -10.5], [-30.6, -10.1], [-31.7, -10.5]] },
      oops: { R: [[-37.8, -30.5], [-33.2, -37.4], [-30.1, -37.4], [-22.2, -30.5], [-21.8, -27.5], [-30.1, -7], [-33.5, -4.7], [-36, -6.5], [-37.3, -9], [-38.2, -28.9]] },
      sleep: { R: [[-25.7, -28.1], [-25.3, -29.2], [-23.9, -29.8], [-23, -29.8], [-21.9, -29.4], [-21.4, -28.1], [-23.1, -24.6], [-24.2, -24.2], [-25.3, -24.6], [-25.7, -25.7]] },
      wave: { R: [[-32.2, -14.1], [-30.4, -30.7], [-30, -31.8], [-28.9, -32.2], [-23.3, -30.9], [-22.2, -30.5], [-21.8, -27.5], [-28.7, -11.6], [-30.3, -10.7], [-31.4, -11.1]] },
    },
  },
  mainecoon: {
    2: {
      cheer: { R: [[-28.8, -28.8], [-24.4, -42.1], [-20.6, -46], [-19.5, -46.4], [-17.8, -45.5], [-15.6, -41.7], [-16, -40], [-25.6, -24.5], [-27.2, -23.5], [-28.7, -25]] },
      sleep: { R: [[-17.6, -48.7], [-16, -49.1], [-11, -47.5], [-10.6, -45.9], [-11, -44.8], [-14.3, -41.4], [-15.4, -41], [-16.8, -41.7], [-17.2, -42.8], [-18, -46.9]] },
    },
    3: {
      wave: { R: [[-26.1, -66.9], [-25.7, -68], [-24.6, -68.4], [-23.5, -68], [-22.6, -67], [-22.2, -65.9], [-22.6, -64.4], [-24.2, -63.5], [-25.3, -63.9], [-26.1, -65.5]] },
    },
  },
}

/**
 * Lommerne i nøgleposerne (review G1-r4 §1.4 og §5): pels i skyggetone bag alt mellem løftet pote, hale, kind og
 * krop, så der aldrig ses baggrund inde i figuren. Kun i stillbilleder (album, butik og kontaktark): i animationen
 * åbner og lukker lommerne, mens poten og halen bevæger sig, så et fast fyld ville ses mod baggrunden dér (samme
 * mønster som rævens `KEY_WEBS`). Hylstrene er lommerne målt på magenta (2 px pr. enhed, udvidet 1,6 enheder og
 * holdt inden for figurens yderkontur) i skulderens ramme (højre side spejlet) pr. race, stadie og humør.
 */
const KEY_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {
  domestic: {
    1: {
      wave: { R: [[-21.9, -59.3], [-24.2, -58.5], [-24.9, -57], [-22.6, -50.9], [-14.3, -45.6], [-6.7, -43.3], [0.9, -47.9], [1.7, -49.4], [0.9, -50.9], [-1.4, -52.4], [-9.7, -54], [-21.1, -58.5]] },
    },
    2: {
      wave: { R: [[-24.3, -64.6], [-25.4, -64], [-26, -62.9], [-24.3, -54], [-22.1, -50.1], [-14.9, -45.7], [-9.9, -44.6], [-7.7, -43.4], [-6, -43.4], [-0.4, -47.3], [3.4, -49], [4.6, -50.7], [4, -51.8], [-3.2, -53.4], [-8.2, -55.1], [-11, -56.8], [-12.1, -56.8], [-23.8, -64]] },
    },
    3: {
      wave: { R: [[[-21.7, -64.8], [-24.5, -64.8], [-25.4, -64.3], [-25.9, -63.4], [-25.4, -57.8], [-23.5, -51.8], [-18.9, -47.6], [-15.2, -45.8], [-6.9, -43], [1, -47.6], [1.5, -48.6], [1.5, -51.3], [1.9, -51.8], [1.5, -52.7], [-6, -55], [-13.4, -58.7], [-21.2, -64.3]], [[-31.9, -85.6], [-32.8, -84.7], [-37, -85.6], [-35.1, -84.2], [-37, -82.8], [-35.1, -81.9], [-31.9, -81.4], [-30.5, -82.8], [-30.5, -84.2], [-31.4, -85.1]]] },
      cheer: { R: [[-6.1, -54], [-7.5, -53.5], [-7.9, -52.6], [-3.6, -46.9], [-2.1, -46], [0.6, -47.5], [1.5, -48.9], [1.4, -51.1], [0.9, -52], [0, -52.4], [-1.4, -52.4], [-5.6, -53.6]] },
    },
  },
  longhair: {
    2: {
      wave: { R: [[-23.2, -30.7], [-25.4, -30.1], [-26, -29], [-26, -27.3], [-26.6, -26.8], [-26, -24.6], [-24.9, -24], [-23.8, -24.6], [-22.7, -26.2], [-21.6, -28.4], [-22.1, -30.1], [-22.7, -30.1]] },
    },
    3: {
      cheer: { R: [[-25.1, -26.6], [-26.9, -26.1], [-27.3, -25.2], [-27.3, -22.9], [-26.8, -22], [-25.8, -21.6], [-24.9, -22.1], [-23.6, -24.8], [-24.1, -26.2], [-24.6, -26.2]] },
    },
  },
  mainecoon: {
    1: {
      idle: { R: [[-19.4, -54.7], [-20.9, -54], [-18.6, -52.4], [-18.6, -50.9], [-20.1, -49.4], [-20.9, -50.2], [-20.9, -49.4], [-17.1, -46.4], [-16.3, -43.3], [-14.8, -42.6], [-12.5, -43.3], [-8.7, -50.2], [-9.5, -51.7], [-12.5, -53.2], [-18.6, -54]] },
      wave: { R: [[[-21.6, -59.3], [-23.9, -58.5], [-24.7, -57], [-23.2, -51.7], [-20.9, -49.4], [-14, -45.6], [-11, -46.4], [-6.4, -51.7], [-7.2, -53.2], [-10.2, -54.7], [-16.3, -56.2], [-20.9, -58.5]], [[-28.5, -26.6], [-30, -25.8], [-31.5, -23.6], [-30.8, -20.5], [-29.2, -19.8], [-27.7, -20.5], [-26.2, -23.6], [-27, -25.8], [-27.7, -25.8]]] },
      think: { R: [[-14.8, -46.4], [-17.8, -45.6], [-18.6, -44.1], [-17.8, -41], [-16.3, -40.3], [-13.3, -42.6], [-12.5, -44.1], [-13.3, -45.6], [-14, -45.6]] },
    },
    2: {
      think: { R: [[-23.3, -51.2], [-24.4, -51.2], [-23.9, -49.6], [-25.6, -48.4], [-22.2, -47.9], [-20, -45.7], [-18.9, -40.7], [-18.3, -39.6], [-17.2, -39], [-10.6, -45.1], [-10, -46.2], [-10.6, -47.9], [-22.8, -50.7]] },
      wave: { R: [[[-23.9, -64], [-25, -63.4], [-25.6, -62.3], [-25.6, -59], [-25, -58.4], [-24.4, -54], [-23.3, -51.8], [-20, -48.4], [-17.2, -46.8], [-13.3, -45.1], [-11.1, -45.1], [-10, -45.7], [-5.6, -50.7], [-3.9, -51.2], [-3.3, -52.3], [-4.4, -54], [-10.6, -56.2], [-23.3, -63.4]], [[-26.1, -31.8], [-27.2, -31.2], [-27.8, -29], [-30, -26.8], [-32.2, -25.7], [-32.8, -24.6], [-32.2, -23.4], [-32.2, -14.6], [-31.7, -13.4], [-30.6, -12.9], [-29.4, -13.4], [-26.7, -22.9], [-23.3, -29], [-23.9, -30.7], [-25.6, -31.2]]] },
    },
    3: {
      idle: { R: [[-22.1, -34.7], [-23.5, -33.8], [-25.8, -33.3], [-26.2, -32.4], [-26.2, -28.7], [-26.7, -28.2], [-26.2, -26.8], [-25.3, -26.3], [-24.4, -26.8], [-23.5, -29.1], [-20.7, -33.3], [-21.2, -34.2], [-21.6, -34.2]] },
      happy: { R: [[-27.2, -22.2], [-28.1, -20.8], [-29, -20.8], [-30, -22.2], [-31.3, -17.1], [-33.2, -13.4], [-31.8, -11.1], [-30.9, -10.6], [-30, -11.1], [-28.6, -17.1], [-26.7, -21.3], [-27.2, -21.7]] },
      cheer: { R: [[-22.3, -41.2], [-23.6, -40.7], [-24.9, -35.7], [-27.1, -33.3], [-29.8, -32.3], [-30.3, -31.4], [-30.1, -25.5], [-30.5, -25], [-30.4, -23.2], [-30.9, -22.7], [-31.6, -17.7], [-33.4, -14], [-33.3, -12.2], [-32.3, -10.4], [-31.4, -10], [-30, -11], [-26.7, -22.4], [-22.8, -30.3], [-18.4, -36.8], [-19.4, -39], [-21.8, -40.8]] },
      think: { R: [[[-18.4, -51.3], [-19.8, -50.9], [-20.2, -50], [-20.2, -49], [-19.3, -47.6], [-20.2, -46.2], [-20.7, -40.7], [-22.1, -36.1], [-23.9, -34.2], [-27.6, -32.8], [-28.1, -31.9], [-27.6, -30], [-28.1, -29.6], [-28.1, -25.4], [-29, -23.1], [-28.6, -21.7], [-27.6, -21.2], [-26.7, -21.7], [-25.8, -24.5], [-22.1, -31.4], [-19.3, -35.6], [-11.9, -44.4], [-12.8, -45.8], [-12.8, -47.6], [-12.4, -48.1], [-12.8, -49.5], [-17.9, -50.9]], [[-30, -17.1], [-30.9, -16.6], [-32.3, -13.8], [-31.8, -12.9], [-30.9, -12.5], [-29.5, -12.9], [-28.6, -15.7], [-29, -16.6], [-29.5, -16.6]]] },
      oops: { R: [[-26.2, -24.5], [-27.2, -23.1], [-29, -24.5], [-30, -22.2], [-30, -19.4], [-32.7, -13.8], [-31.8, -11.5], [-30.9, -11.1], [-30, -11.5], [-27.6, -19.9], [-25.8, -23.6], [-26.2, -24]] },
      sleep: { R: [[[-16.1, -50.4], [-17.5, -49.9], [-17.9, -49], [-17.5, -48.5], [-17.5, -47], [-18.4, -45.6], [-18.4, -42.7], [-19.3, -40.3], [-18.8, -38.4], [-17.9, -37.9], [-17, -38.4], [-11.9, -44.2], [-12.8, -46.1], [-12.8, -47.5], [-12.4, -48], [-12.8, -49], [-14.2, -49.9], [-15.6, -49.9]], [[-22.5, -34.6], [-25.8, -33.1], [-26.2, -32.2], [-26.2, -28.8], [-26.7, -28.3], [-26.2, -26.9], [-25.3, -26.4], [-24.4, -26.9], [-23.5, -28.3], [-21.2, -32.6], [-21.6, -34.1], [-22.1, -34.1]]] },
      wave: { R: [[[-22.5, -65.7], [-25.3, -64.3], [-25.8, -63.4], [-25.3, -57.4], [-24.9, -56.9], [-24.4, -53.7], [-22.5, -50.4], [-19.8, -48.1], [-15.1, -45.8], [-14.2, -45.8], [-13.3, -46.2], [-10.5, -49.5], [-6.3, -51.8], [-5, -54.1], [-5.9, -55.5], [-12.4, -58.3], [-22.1, -65.2]], [[-29, -33.7], [-30.9, -33.3], [-34.1, -31], [-35, -29.6], [-34.6, -28.7], [-34.6, -17.1], [-36.4, -11.1], [-34.6, -8.3], [-32.7, -6.4], [-31.8, -6], [-30.9, -6.4], [-27.6, -19.9], [-23, -29.6], [-23.5, -30.5], [-28.6, -33.3]], [[-33.2, -85.6], [-35.5, -85.6], [-34.1, -84.7], [-35.5, -82.8], [-34.6, -82.4], [-32.7, -82.8], [-32.3, -83.7], [-32.7, -85.1]]] },
    },
  },
}

/**
 * Lommerne, som huller-arkets alfa-lint fandt (review G2-r2 §3.1 og §6, Kat): mellem hale og krop hos huskat-babyen
 * (hoftekilen i hvile og sover, lommen i vinker, flise 302) og sprækken mellem pote og krop hos maine coon i ups (fliserne 460 og 466).
 */
const KeyWebs = pawWebs(
  {},
  addWebs(
    KEY_WEBS,
    `domestic 1 idle R: -38 -18.3 -36.9 -21.6 -26.6 -29.2 -23.5 -28.3 -23.5 -23.6 -29 -7.9 -30.7 -5.6 -34.1 -3.3 -36 -3.3 -38 -8.9
domestic 1 sleep R: -38 -20.6 -35.6 -45.7 -34.6 -46.7 -27.9 -46.7 -12.2 -43.6 -11.4 -40.3 -29.4 -6.8 -34.1 -2.9 -36.3 -3.3 -38 -8.8
domestic 1 wave R: -44.5 -16.5 -42.7 -39.7 -38.8 -40.6 -22.7 -29.2 -21.8 -26.9 -29 -7.9 -29.9 -6.4 -37.4 0.9 -39.3 0.9 -42.1 -3.7
mainecoon 3 oops R: -29.1 -24.6 -28.8 -31.9 -28.3 -32.7 -21.9 -38.3 -20.1 -38.3 -19.6 -37.4 -20 -34.2 -26.1 -23.3 -28 -22.7 -28.9 -23.3`,
  ),
)
/** Armenes faste fyld og, i stillbilleder, nøgleposernes lommer i skyggetone (se `KEY_WEBS`). */
const withKeyWebs = (webs: SidePart): SidePart => (p) => {
  const key = p.still ? KeyWebs({ ...p, pal: { ...p.pal, fur: p.pal.silhouette ? p.pal.fur : p.pal.shade } }) : null
  const web = webs(p)
  return key && web ? (
    <>
      {web}
      {key}
    </>
  ) : (key ?? web)
}

export const cat: SpeciesDef = {
  id: 'cat',
  name: 'Kat',
  nameClip: 'name.species.cat',
  family: 'feline',
  body: 'round',
  breeds: [
    { id: 'domestic', name: 'huskat', fx: { x: 177, y: 34 } },
    {
      id: 'longhair',
      name: 'langhåret kat',
      fx: { x: 177, y: 44 },
      anchors: { bodyRx: 47, bodyWidth: 94, eyeL: { x: 77, y: 106 }, eyeR: { x: 123, y: 106 }, muzzle: { x: 100, y: 121 }, mouth: { x: 100, y: 128.5 } },
      parts: {
        Ear: makeEar(SMALL_EAR, SMALL_INNER, true),
        Tail: makeTail(TAILS.longhair),
        Ruff: makeRoundRuff(46, 24, 2, 10),
        Muzzle: makeMuzzle(0.9),
      },
      bounds: { head: { x0: 34, y0: 14, x1: 166, y1: 172 } },
    },
    {
      id: 'mainecoon',
      name: 'maine coon',
      fx: { x: 129, y: 34 },
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
  // Tankebobler og Zzz (fælles regel, review G1-r2 pkt. 5.2): hver race har sit anker i fri luft med
  // mindst 8 enheder til hoved, ører, manke og horn i alle stadier og inden for den sikre zone; moods-
  // arkets lint tjekker alle racer og stadier.
  fx: { x: 172, y: 72 },
  face: { idleMouth: 'cat-w', cheeks: true },
  ears: { splay: 13 },
  signature: 'tail-curl',
  // Forbenene står på jorden: glad løfter dem kun lidt; ups er en pote op til munden (pelspleje).
  // Halen svinger kun lidt (den krøllede spids ville ellers ramme kanten på stor).
  poses: {
    happy: { pawL: 14, pawR: 14, tail: 4 },
    cheer: { tail: 5 },
    think: { tail: 2 },
    oops: { pawL: 0, pawR: { up: true }, tail: 3 },
    sleep: { pawL: 0, pawR: 0 },
    // Vink: halen svinger ud, så krogen går fri af den løftede albue (ingen lomme mellem arm, hale og krop).
    wave: { tail: 11 },
  },
  parts: {
    head: catHead,
    Ear: makeEar(CAT_EAR, CAT_INNER, false),
    Paw: Leg,
    PawUp,
    PawBack: withKeyWebs(pawWebs({}, PAW_WEBS)),
    pawUpTip: { cheer: { x: -31, y: -67 }, wave: { x: -36, y: -73 }, think: { x: 13, y: -50 }, oops: { x: 10, y: -55 } },
    upArms: {
      cheer: { spine: UP_SPINES.cheer, w0: 15, w1: 18.5, tip: 10 },
      wave: { spine: UP_SPINES.wave, w0: 15, w1: 18.5, tip: 10 },
      think: { spine: UP_SPINES.think, w0: 15, w1: 18, tip: 9.5 },
      oops: { spine: UP_SPINES.oops, w0: 15, w1: 18, tip: 9.5 },
    },
    limb: { rot: 0, sleeve: () => blob(LEG_SLEEVE), cuff: { y: 13.4, half: 12.9 } },
    Feet,
    Tail: makeTail(TAILS.domestic),
    Muzzle: makeMuzzle(1),
    BodyDeco,
    Ruff: RainbowCollar,
    Pattern: { head: PatternHead, body: PatternBody },
  },
}

export default cat
