// Hestebakkerne (verdenen `bakke`): kortets baggrund – bløde, grønne bakker med folde, heste og en lille landsby,
// et trin op fra Engdalen og lidt større og mere åben. Scenen er bygget som et diorama i fire lag (fjerne bakker,
// marker med høstriber og høballer, mellembakken med landsbyen og forgrunden) med papirkanter: en blød skygge bag
// hvert lag og en lys kant langs toppen. Bakkerne står i luftperspektiv (blågrønne og lyse langt væk, varme og
// mættede forrest), og solen oppe til venstre giver blødt retningslys: varmt højlys på de skrænter, der vender mod
// den, kølig skygge på de andre og jordskygger under alt, der står på jorden.
// Syv kendetegn står for Hestebakkernes syv regioner, og hvert får sin farve igen efter regionens tier (SPEC §5.6):
//   marken med ti rækker af ti blomster og hestene på folden (Hundredemarken) · to ens bakker med spejlede træer
//   (Dobbeltdalen) · broen med ti planker over åen (Tyvebroen) · værkstedet med trekant-gavl, runde vinduer og
//   firkantede kasser (Formværkstedet) · tårnet med det analoge ur og landsbyen (Urtårnet) · to rækker af ti
//   hoppesten (Tierhoppet) · boden med vægt og lineal (Målebakken).
// Start er dæmpet pastel (aldrig grå); bronze tænder lys i vinduer og lanterner og sender røg op af skorstenene;
// sølv bringer flere blomster og glimt i vandet; guld er fuld mætning med flag, fugle og et føl mere på folden – og
// en regnbue, når hele verdenen er guld. Bakkerne og himlen følger hele verdenens fremgang.
// Åen springer fra en kilde mellem sten og løber nedad, bredere og bredere med mørkere brinker; foldens hegn stopper
// ved åen med en stolpe på brinken, og broen er en bue med to gelændere. Store blade og blomster i de nederste
// hjørner rammer dioramaet ind.
// Scenen måler sin plads og lægger kendetegnene der, hvor kortets panel ikke dækker: i bredformat i venstre
// strimmel, mellem stien og sidepanelet og under sidepanelet; i højformat i højre side (på en telefon oppe til
// højre) og forneden. Kun skyerne driver, bladene svajer og hestenes haler svinger (transform); alt står stille i
// rolig tilstand og ved reduceret bevægelse. Alle former er husets parametriske primitiver; farverne kommer fra
// scenes/palette.ts.
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import type { RegionId } from '../../engine/types'
import type { RegionTier } from '../../meta/rewards'
import type { MapSceneProps } from '../../ui/screens/child/map/Backdrop'
import { arc, blob, capsule, circle, ellipse, ellipseBelow, fmt3, join, lune, n, poly, rect, ribbon, ridge, scallop, spline, star, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import { BAKKE, TIER_CHROMA, tintBakke, tintBakkeBy } from './palette'
import type { BakkeColor } from './palette'
import './bakke.css'

// ---------------------------------------------------------------------------------------------
// Regionerne og deres kendetegn

export const BAKKE_REGIONS = {
  field: 'w1-tal100',
  twins: 'w1-dobbelt',
  bridge: 'w1-tieren',
  workshop: 'w1-figurer',
  tower: 'w1-klokken',
  hop: 'w1-tiere',
  market: 'w1-maal-penge',
} as const satisfies Record<string, RegionId>
type Mark = keyof typeof BAKKE_REGIONS
type Tiers = MapSceneProps['tiers']

const tierOf = (tiers: Tiers, mark: Mark): RegionTier => tiers[BAKKE_REGIONS[mark]] ?? 'start'
const lit = (t: RegionTier) => t !== 'start'
const bloom = (t: RegionTier) => t === 'silver' || t === 'gold'
const full = (t: RegionTier) => t === 'gold'
/** Trinnet som tal (start 0, bronze 1, sølv 2, guld 3). */
const rank = (t: RegionTier) => (t === 'start' ? 0 : t === 'bronze' ? 1 : t === 'silver' ? 2 : 3)

/** Farvesæt for et kendetegn: grundfarverne tonet efter regionens tier. */
const paint = (t: RegionTier) => (c: BakkeColor) => tintBakke(c, t)

/** Deterministisk "tilfældighed" (0–1) til spredte blomster og totter. */
const hash01 = (i: number) => {
  const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return v - Math.floor(v)
}

// ---------------------------------------------------------------------------------------------
// Layout: alt i skærmens CSS-px (viewBox = pladsen). Kendetegnene tegnes i lokale enheder om deres fodpunkt
// og skaleres med `k` (ca. 1 på en iPad på tværs, 0,7 på en telefon). Solen står oppe til venstre i alle
// formater, så alle cel-skygger (højlys oppe til venstre, skygge nede til højre) passer til lyset.

interface Place {
  x: number
  y: number
  s: number
}
interface Ridge {
  base: number
  amp: number
  waves: number
  phase: number
}
export type Coat = 'chestnut' | 'grey' | 'foal' | 'bay'
export interface HorseSpot extends Place {
  coat: Coat
  graze: boolean
  /** Vender mod venstre. */
  flip: boolean
  /** Det trin (0–3), hvor hesten kommer på folden. */
  from: number
}
export interface Layout {
  w: number
  h: number
  wide: boolean
  k: number
  far: Ridge
  fields: Ridge
  mid: Ridge
  near: Ridge
  sun: Place
  clouds: Place[]
  /** Dobbeltdalens to bakker (midten mellem dem) og det lag, de står på. */
  twins: Place & { onMid: boolean }
  tower: Place
  cottages: (Place & { slate: boolean })[]
  field: Place
  workshop: Place
  stall: Place
  /** Kilden mellem stenene, hvor åen springer ud (åens første punkt ligger lige under den). */
  spring: Place
  stream: Vec[]
  path: Vec[]
  /** Stiens bredde pr. punkt (smal langt væk, bredere forrest), i k. */
  pathW: number[]
  /** Stien ligger på forgrundens bakke (højformat) i stedet for mellembakken (bredformat). */
  pathOnNear: boolean
  bridge: Place & { rot: number }
  /** Foldens hegn: fra den tørre ende mod åen (det stopper på brinken). */
  fence: [Vec, Vec]
  horses: HorseSpot[]
  /** Lam på bakken (mellemgrunden) og deres folds hegn (langs bakken, langt fra åen). */
  sheep: Vec[]
  sheepFence: Vec[]
  hop: Place
  trees: (Place & { front: boolean })[]
  bales: Place[]
  corners: [Place, Place]
}

const ridgeY = (r: Ridge, w: number, x: number) => {
  const t = (x / w) * Math.PI * 2 * r.waves + r.phase
  return r.base - r.amp * (0.75 * Math.cos(t) + 0.25 * Math.cos(2.3 * t + 1))
}
const ridgePts = (r: Ridge, w: number, dy = 0): Vec[] =>
  Array.from({ length: 15 }, (_, i) => {
    const x = -30 + ((w + 60) * i) / 14
    return [x, ridgeY(r, w, x) + dy] as Vec
  })

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Drejningen (grader) langs en linje mellem to punkter. */
const along = (a: Vec, b: Vec) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI

export function layoutOf(w: number, h: number): Layout {
  const wide = w >= h
  const on = (r: Ridge, u: number, dv: number, s: number) => ({ x: w * u, y: ridgeY(r, w, w * u) + h * dv, s })
  if (wide) {
    const k = clamp(Math.max(w / 1180, (h / 820) * 0.85), 0.6, 1.4)
    const far: Ridge = { base: h * 0.3, amp: h * 0.022, waves: 1.6, phase: 0.5 }
    const fields: Ridge = { base: h * 0.405, amp: h * 0.03, waves: 1.2, phase: 1.5 }
    const mid: Ridge = { base: h * 0.53, amp: h * 0.04, waves: 0.9, phase: 2.6 }
    const near: Ridge = { base: h * 0.8, amp: h * 0.026, waves: 0.75, phase: 4.2 }
    const spring = on(mid, 0.668, 0.03, k)
    const bridge = { x: w * 0.646, y: h * 0.672, s: k, rot: 2 }
    return {
      w, h, wide, k, far, fields, mid, near,
      sun: { x: w * 0.075, y: h * 0.19, s: k },
      clouds: [
        { x: w * 0.2, y: h * 0.11, s: k * 1.1 },
        { x: w * 0.47, y: h * 0.07, s: k * 0.8 },
        { x: w * 0.8, y: h * 0.15, s: k },
        { x: w * 0.35, y: h * 0.21, s: k * 0.6 },
      ],
      twins: { ...on(fields, 0.652, 0.052, k * 0.95), onMid: false },
      tower: on(mid, 0.062, 0.035, k),
      cottages: [
        { ...on(mid, 0.012, 0.05, k * 0.9), slate: false },
        { ...on(mid, 0.118, 0.056, k * 0.85), slate: true },
        { ...on(mid, 0.094, 0.088, k * 0.72), slate: false },
      ],
      field: { x: w * 0.064, y: h * 0.775, s: k * 0.95 },
      workshop: { x: w * 0.613, y: h * 0.828, s: k * 0.85 },
      stall: { x: w * 0.935, y: h * 0.8, s: k * 0.95 },
      spring,
      stream: [
        [spring.x, spring.y + 3 * k], [w * 0.642, h * 0.605], [bridge.x, bridge.y], [w * 0.674, h * 0.752],
        [w * 0.72, h * 0.842], [w * 0.744, h * 0.93], [w * 0.736, h * 1.03],
      ],
      // vejen fra landsbyen ned over bakken til Tyvebroen og videre til boden
      path: [[w * 0.135, h * 0.632], [w * 0.25, h * 0.672], [w * 0.4, h * 0.705], [w * 0.52, h * 0.695], [w * 0.6, h * 0.676], [bridge.x, bridge.y], [w * 0.7, h * 0.69], [w * 0.79, h * 0.745], [w * 0.875, h * 0.79]],
      pathW: [4, 6, 8, 9, 9.5, 10, 11, 13, 15],
      pathOnNear: false,
      bridge,
      fence: [[w * 0.885, h * 0.832], [w * 0.66, h * 0.81]],
      horses: [
        { x: w * 0.8, y: h * 0.893, s: k * 0.95, coat: 'chestnut', graze: true, flip: false, from: 0 },
        { x: w * 0.888, y: h * 0.9, s: k, coat: 'grey', graze: false, flip: true, from: 0 },
        { x: w * 0.846, y: h * 0.866, s: k * 0.62, coat: 'foal', graze: false, flip: false, from: 2 },
        // drikker ved åen
        { x: w * 0.768, y: h * 0.882, s: k * 0.85, coat: 'bay', graze: true, flip: true, from: 3 },
      ],
      sheep: [[w * 0.215, h * 0.6], [w * 0.25, h * 0.615], [w * 0.285, h * 0.597], [w * 0.43, h * 0.64], [w * 0.47, h * 0.628]],
      sheepFence: [[w * 0.17, h * 0.618], [w * 0.3, h * 0.645], [w * 0.42, h * 0.668], [w * 0.53, h * 0.664]],
      hop: { x: w * 0.83, y: h * 0.968, s: k },
      trees: [
        { ...on(mid, 0.165, 0.06, k * 0.85), front: false },
        { ...on(mid, 0.715, 0.045, k * 0.8), front: false },
        { ...on(mid, 0.86, 0.03, k * 0.9), front: false },
        { ...on(near, 0.995, -0.01, k * 1.05), front: true },
      ],
      bales: [on(fields, 0.3, 0.035, k * 0.8), on(fields, 0.34, 0.05, k), on(fields, 0.52, 0.03, k * 0.8)],
      corners: [{ x: 0, y: h, s: k * 1.2 }, { x: w, y: h, s: k * 0.95 }],
    }
  }
  const k = clamp(Math.max(w / 560, (h / 1250) * 0.9), 0.7, 1.3)
  // en telefon (høj og smal) viser kun et hjørne oppe til højre mellem kortets knapper og panelet
  const tall = h / w > 1.7
  const far: Ridge = { base: h * 0.33, amp: h * 0.018, waves: 1.3, phase: 0.8 }
  const fields: Ridge = { base: h * 0.415, amp: h * 0.022, waves: 1.0, phase: 1.8 }
  const mid: Ridge = { base: h * 0.535, amp: h * 0.03, waves: 0.85, phase: 2.5 }
  const near: Ridge = { base: h * 0.78, amp: h * 0.024, waves: 0.7, phase: 4.1 }
  const spring = { x: w * 0.925, y: h * 0.715, s: k }
  const bridge = { x: w * 0.8, y: h * 0.775, s: k * 0.9, rot: 0 }
  const stream: Vec[] = [
    [spring.x, spring.y + 3 * k], [w * 0.835, h * 0.735], [bridge.x, bridge.y], [w * 0.765, h * 0.835],
    [w * 0.735, h * 0.9], [w * 0.75, h * 0.965], [w * 0.73, h * 1.03],
  ]
  bridge.rot = along(stream[1], stream[3]) - 90
  return {
    w, h, wide, k, far, fields, mid, near,
    sun: { x: w * 0.17, y: h * 0.15, s: k },
    clouds: [
      { x: w * 0.5, y: h * 0.09, s: k * 1.05 },
      { x: w * 0.85, y: h * 0.17, s: k * 0.8 },
      { x: w * 0.33, y: h * 0.235, s: k * 0.6 },
    ],
    twins: tall ? { ...on(fields, 0.72, 0.032, k * 0.9), onMid: false } : { ...on(mid, 0.79, 0.04, k * 0.85), onMid: true },
    tower: tall ? on(mid, 0.9, -0.004, k) : on(mid, 0.935, 0.118, k * 0.95),
    cottages: tall
      ? [{ ...on(mid, 0.77, 0.004, k * 0.85), slate: false }, { ...on(mid, 1.0, 0.008, k * 0.8), slate: true }]
      : [{ ...on(mid, 0.855, 0.13, k * 0.85), slate: false }, { ...on(mid, 1.0, 0.134, k * 0.8), slate: true }, { ...on(mid, 0.895, 0.162, k * 0.68), slate: false }],
    field: { x: w * 0.69, y: h * (tall ? 0.64 : 0.658), s: k * 0.9 },
    workshop: { x: w * 0.6, y: h * 0.865, s: k * 0.88 },
    stall: { x: w * 0.915, y: h * 0.99, s: k * 0.95 },
    spring,
    stream,
    // stien fra værkstedets port over Tyvebroen til folden
    path: [[w * 0.625, h * 0.85], [w * 0.68, h * 0.805], [w * 0.735, h * 0.782], [bridge.x, bridge.y], [w * 0.87, h * 0.797], [w * 0.95, h * 0.83]],
    pathW: [12, 11, 10, 10, 11, 12],
    pathOnNear: true,
    bridge,
    fence: [[w * 1.02, h * 0.838], [w * 0.7, h * 0.85]],
    horses: [
      { x: w * 0.868, y: h * 0.877, s: k * 0.85, coat: 'chestnut', graze: true, flip: false, from: 0 },
      { x: w * 0.962, y: h * 0.879, s: k * 0.88, coat: 'grey', graze: false, flip: true, from: 0 },
      { x: w * 0.918, y: h * 0.856, s: k * 0.55, coat: 'foal', graze: false, flip: false, from: 2 },
      // drikker ved åen
      { x: w * 0.79, y: h * 0.858, s: k * 0.72, coat: 'bay', graze: true, flip: true, from: 3 },
    ],
    sheep: [[w * 0.2, h * 0.585], [w * 0.25, h * 0.6], [w * 0.3, h * 0.583], [w * 0.4, h * 0.622], [w * 0.45, h * 0.612]],
    sheepFence: [[w * 0.1, h * 0.605], [w * 0.25, h * 0.622], [w * 0.38, h * 0.648], [w * 0.5, h * 0.645]],
    hop: { x: w * 0.165, y: h * 0.885, s: k * 0.8 },
    trees: [
      { ...on(mid, 0.06, 0.03, k), front: false },
      { ...on(mid, 0.53, 0.05, k * 0.8), front: false },
      { ...on(near, 0.08, 0.03, k * 1.1), front: true },
      { ...on(near, 0.4, 0.04, k * 0.95), front: true },
    ],
    bales: [on(fields, 0.2, 0.03, k * 0.8), on(fields, 0.26, 0.045, k), on(fields, 0.45, 0.03, k * 0.8)],
    corners: [{ x: 0, y: h, s: k * 0.85 }, { x: w, y: h, s: k * 0.9 }],
  }
}

// ---------------------------------------------------------------------------------------------
// Små hjælpere

const at = (p: Place, node: ReactNode) => <g transform={`translate(${n(p.x)} ${n(p.y)}) scale(${fmt3(p.s)})`}>{node}</g>
const ROUND = { strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
/** Konturbredde i lokale enheder (en tynd, farvet kontur som dyrenes, men lettere). */
const SW = 1.9

/** Små blomster (fem runde kronblade) om punkter (x, y, r); kronbladene i én path, midterne i en anden. */
function flowerPaths(pts: readonly (readonly [number, number, number])[]) {
  return {
    petals: join(...pts.map(([x, y, r]) => scallop(x, y, r, r, 5, 0.66, -90))),
    hearts: join(...pts.map(([x, y, r]) => circle(x, y, r * 0.36))),
  }
}

/** Græstotter: små, spidse blade i vifte om (x, y) med størrelse s (én path). */
function grass(pts: readonly (readonly [number, number, number])[]): string {
  return join(
    ...pts.map(([x, y, s]) =>
      blob([[x - 6 * s, y], [x - 4.5 * s, y - 7 * s], [x - 2.5 * s, y - 13 * s], [x - 0.5 * s, y - 6 * s], [x + 1.5 * s, y - 15 * s], [x + 3 * s, y - 6 * s], [x + 5.5 * s, y - 11 * s], [x + 6 * s, y]], 0.5),
    ),
  )
}

/** En lanterne (lokalt om krogen): ramme, glas (lyser fra bronze) og en blød glorie. */
function lantern(x: number, y: number, on: boolean, s = 1): ReactNode {
  return (
    <>
      {on && <path d={circle(x, y + 7 * s, 9.5 * s)} fill={BAKKE.lanternGlow} opacity={0.6} />}
      <path d={join(rect(x - 3.6 * s, y + 2 * s, 7.2 * s, 9.5 * s, 2.2 * s), rect(x - 2.4 * s, y - 0.6 * s, 4.8 * s, 2.8 * s, 1))} fill={on ? BAKKE.lantern : BAKKE.wallShade} stroke={BAKKE.lanternFrame} strokeWidth={1.3 * s} {...ROUND} />
    </>
  )
}

/** Røg fra en skorsten (x, y): fire bløde puder, der stiger mod højre. */
const smoke = (x: number, y: number, s: number) => join(circle(x, y - 4 * s, 3.6 * s), circle(x + 4 * s, y - 12 * s, 4.8 * s), circle(x + 11 * s, y - 21 * s, 6 * s), circle(x + 21 * s, y - 28 * s, 5 * s))

/** Glimt: små firtakkede stjerner om (x, y) med radius r (én path). */
const glints = (pts: readonly (readonly [number, number, number])[]) => join(...pts.map(([x, y, r]) => star(x, y, r, r * 0.28, 4)))

/** Fugle: små buer om (x, y) med størrelse s (én path). */
const birds = (pts: readonly (readonly [number, number, number])[]) =>
  join(...pts.map(([x, y, s]) => spline([[x - 6 * s, y - 3 * s], [x, y], [x + 6 * s, y - 3 * s]])))

/** Et lille flag på en stang fra (x, y) og op (lokalt): stangen og dugen. */
const flag = (x: number, y: number, hgt: number, s = 1) => ({
  pole: rect(x - 0.9 * s, y - hgt, 1.8 * s, hgt, 0.9 * s),
  cloth: blob([[x + 0.8 * s, y - hgt + 0.5 * s], [x + 15 * s, y - hgt + 4.5 * s], [x + 0.8 * s, y - hgt + 9.5 * s]], 0.35),
})

/** Vimpler (små trekanter) langs en linje fra a til b (lokalt), skiftevis to farver. */
function bunting(a: Vec, b: Vec, count: number, sag: number) {
  const pts = Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + sag * 4 * t * (1 - t)] as Vec
  })
  const tri = ([x, y]: Vec) => poly([[x - 3.4, y], [x + 3.4, y], [x, y + 6.5]])
  return {
    line: spline([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag], b]),
    even: join(...pts.filter((_, i) => i % 2 === 0).map(tri)),
    odd: join(...pts.filter((_, i) => i % 2 === 1).map(tri)),
  }
}

/** Et lukket bånd mellem to kurver (top venstre → højre, bund i samme rækkefølge). */
const band = (top: readonly Vec[], bottom: readonly Vec[]) => `${spline(top)}L${spline([...bottom].reverse()).slice(1)}Z`

/** Et blad (lokalt fra stilken langs +x), drejet `rot` grader og flyttet til (x, y): kontur og midterribbe. */
function leaf(x: number, y: number, len: number, wid: number, rot: number) {
  const o = { rot, dx: x, dy: y }
  return {
    blade: blob(xf([[0, 0], [len * 0.22, -wid * 0.85], [len * 0.58, -wid], [len, -wid * 0.1], [len * 0.6, wid * 0.78], [len * 0.24, wid * 0.62]], o), 0.75),
    rib: spline(xf([[len * 0.04, 0], [len * 0.45, -wid * 0.12], [len * 0.86, -wid * 0.1]], o)),
  }
}

/**
 * Solens lys på en bakkekam (solen oppe til venstre): et køligt skyggebånd under de skrænter, der vender væk fra
 * solen, og et varmt højlys langs de skrænter, der vender mod den (kammen og et blødt bånd under den).
 */
function ridgeLight(r: Ridge, w: number, depth: number) {
  const N = Math.max(28, Math.round(w / 20))
  const s0 = (r.amp * Math.PI * 2 * r.waves) / w || 1
  const top: Vec[] = []
  const shade: Vec[] = []
  const glow: Vec[] = []
  const crests: Vec[][] = []
  let run: Vec[] = []
  for (let i = 0; i <= N; i++) {
    const x = -24 + ((w + 48) * i) / N
    const y = ridgeY(r, w, x)
    // > 0: skrænten vender mod solen (stiger mod højre, når solen står til venstre)
    const f = clamp(-(ridgeY(r, w, x + 2) - ridgeY(r, w, x - 2)) / 4 / s0, -1, 1)
    const away = clamp(-f * 1.5 + 0.1, 0, 1)
    const toward = clamp(f * 1.5 - 0.1, 0, 1)
    top.push([x, y])
    shade.push([x, y + depth * away * away * (3 - 2 * away)])
    glow.push([x, y + depth * 0.4 * toward * toward * (3 - 2 * toward)])
    if (f > 0.05) run.push([x, y + 1])
    else {
      if (run.length > 1) crests.push(run)
      run = []
    }
  }
  if (run.length > 1) crests.push(run)
  return { shade: band(top, shade), glow: band(top, glow), crest: join(...crests.map((p) => spline(p))) }
}

// ---------------------------------------------------------------------------------------------
// Kendetegnene (lokale enheder om fodpunktet; 100 enheder ≈ et træs højde)

/** Et rundt løvtræ: stamme, løvkrone med cel-skygge og højlys; blomster (sølv). */
function Tree({ t, seed }: { t: RegionTier; seed: number }) {
  const c = paint(t)
  const blossoms = [[-12, -60], [8, -67], [17, -49], [-4, -44], [-19, -47], [2, -56]].map(([x, y]) => circle(x, y, 2.7))
  return (
    <>
      <path d={blob([[-5.5, 0], [-4, -14], [-3.4, -30], [3.4, -30], [4, -14], [5.5, 0], [0, 1.5]], 0.6)} fill={c('trunk')} stroke={c('woodDark')} strokeWidth={SW} {...ROUND} />
      <g className="bakke-sway" style={{ animationDelay: `${-seed * 1.7}s` }}>
        <path d={scallop(0, -52, 28, 25, 8, 0.62, -90 + seed * 17)} fill={c('leaf')} stroke={c('leafDark')} strokeWidth={SW} {...ROUND} />
        <path d={lune(2, -50, 25, 22, 8, 15, 150)} fill={c('leafDark')} opacity={0.42} />
        <path d={ellipse(-10, -63, 8.5, 5, -28)} fill={c('leafLight')} opacity={0.9} />
        {bloom(t) && <path d={join(...blossoms)} fill={c('blossom')} />}
      </g>
    </>
  )
}

/**
 * Dobbeltdalen: to ens, runde bakker side om side med hvert sit træ og en busk – spejlet om midten (som et
 * dobbelt). Lanterner i træerne fra bronze, blomster og frugt fra sølv, et par fugle i guld.
 */
function Twins({ t, onMid }: { t: RegionTier; onMid: boolean }) {
  const c = paint(t)
  const half: Vec[] = [[-84, 4], [-76, -14], [-60, -32], [-40, -39], [-20, -32], [-8, -17], [0, -10]]
  const top = [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [-x, y] as Vec)]
  const hills = ridge(top, 16, 0.9)
  // de to træer står på toppene og hælder hver sin vej (spejlet)
  const crown = (sx: number) => scallop(sx * 41, -78, 19, 17, 7, 0.62, sx > 0 ? -90 : -90 + 360 / 14)
  const fruit = [[-6, -84], [5, -88], [9, -74], [-9, -72]]
  const fl = flowerPaths([[-62, -18, 3.2], [-50, -26, 3], [-30, -30, 3], [62, -18, 3.2], [50, -26, 3], [30, -30, 3]])
  return (
    <>
      <path d={hills} fill={c(onMid ? 'nearHill' : 'midHill')} />
      {/* solen fra venstre: skygge på højre skrænt af begge bakker, højlys på venstre; kontur kun langs toppen */}
      <path d={join(blob([[-40, -39], [-20, -32], [-8, -17], [-2, 2], [-22, 6], [-30, -20]], 0.8), blob([[40, -39], [60, -32], [76, -14], [84, 4], [60, 6], [50, -20]], 0.8))} fill={c('shade')} opacity={0.16} />
      <path d={spline(top.slice(1, -1), 0.9)} fill="none" stroke={c('paperShadow')} strokeWidth={SW * 0.8} opacity={0.7} {...ROUND} />
      <path d={join(spline([[-74, -16], [-60, -31], [-44, -38]]), spline([[6, -14], [20, -31], [36, -38]]))} fill="none" stroke={BAKKE.sunlit} strokeWidth={3} opacity={0.85} {...ROUND} />
      <path d={join(...[-1, 1].map((sx) => blob([[sx * 41 - 3.4, -37], [sx * 41 - 2.6, -52], [sx * 42.5, -62], [sx * 41 + 2.6, -52], [sx * 41 + 3.4, -37]], 0.6)))} fill={c('trunk')} stroke={c('woodDark')} strokeWidth={SW * 0.8} {...ROUND} />
      <g className="bakke-sway" style={{ animationDelay: '-1.3s' }}>
        <path d={join(crown(-1), crown(1))} fill={c('leaf')} stroke={c('leafDark')} strokeWidth={SW} {...ROUND} />
        <path d={join(lune(-40, -77, 16, 14, 5, 15, 150), lune(42, -77, 16, 14, 5, 15, 150))} fill={c('leafDark')} opacity={0.4} />
        <path d={join(ellipse(-47, -86, 5.5, 3.4, -28), ellipse(35, -86, 5.5, 3.4, -28))} fill={c('leafLight')} opacity={0.9} />
        {bloom(t) && <path d={join(...fruit.flatMap(([x, y]) => [circle(-41 + x, y, 2.4), circle(41 - x, y, 2.4)]))} fill={c('apple')} />}
      </g>
      <path d={join(scallop(-66, -16, 9, 6, 5, 0.6, -80), scallop(66, -16, 9, 6, 5, 0.6, -100))} fill={c('leaf')} stroke={c('leafDark')} strokeWidth={1.3} {...ROUND} />
      {lit(t) && (
        <>
          {lantern(-53, -66, true, 0.75)}
          {lantern(53, -66, true, 0.75)}
        </>
      )}
      {bloom(t) && <path d={fl.petals} fill={c('flowerYellow')} />}
      {full(t) && <path d={birds([[-34, -116, 1.1], [34, -116, 1.1]])} fill="none" stroke={BAKKE.bird} strokeWidth={1.8} {...ROUND} />}
    </>
  )
}

/**
 * Urtårnet: et smalt stentårn med spidst tag og et analogt ur – kort, tyk timeviser i blæk og lang, rød
 * minutviser (klokken tre). Vindue og lanterne lyser fra bronze, blomster ved foden fra sølv, flag i guld.
 */
function Tower({ t }: { t: RegionTier }) {
  const c = paint(t)
  const cy = -90
  const ticks = join(...Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6
    return circle(Math.sin(a) * 11, cy - Math.cos(a) * 11, i % 3 === 0 ? 1.5 : 0.85)
  }))
  const fl = flowerPaths([[-19, -2, 3.4], [-12, 1, 3], [14, 1, 3], [21, -2, 3.4]])
  const f = flag(0, -152, 20)
  return (
    <>
      <path d={blob([[-17, 0], [-15, -110], [15, -110], [17, 0]], 0.15)} fill={c('tower')} stroke={c('towerShade')} strokeWidth={SW} {...ROUND} />
      <path d={blob([[6.5, 0], [6.5, -109], [15, -110], [17, 0]], 0.15)} fill={c('towerShade')} opacity={0.55} />
      <path d={join(rect(-18.5, -68, 37, 5, 2.5), rect(-19.5, -114, 39, 7, 3.5))} fill={c('tower')} stroke={c('towerShade')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={rect(-7, -21, 14, 21, 7)} fill={c('door')} stroke={c('timber')} strokeWidth={SW} {...ROUND} />
      <path d={rect(-5, -52, 10, 15, 5)} fill={lit(t) ? c('windowLit') : c('window')} stroke={c('timber')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={circle(0, cy, 14.5)} fill={c('clockFace')} stroke={c('towerShade')} strokeWidth={2.6} />
      <path d={ticks} fill={BAKKE.clockInk} />
      <path d={capsule([0, cy], [7.5, cy], 1.9)} fill={BAKKE.clockInk} />
      <path d={capsule([0, cy], [0, cy - 11.5], 1.2)} fill={c('clockMinute')} />
      <path d={circle(0, cy, 1.9)} fill={BAKKE.clockInk} />
      <path d={blob([[-22, -112], [0, -152], [22, -112]], 0.3)} fill={c('roof2')} stroke={c('roof2Shade')} strokeWidth={SW} {...ROUND} />
      <path d={blob([[0, -152], [22, -112], [6, -112]], 0.3)} fill={c('roof2Shade')} opacity={0.5} />
      {lit(t) && <>{lantern(13, -30, true, 0.9)}</>}
      {bloom(t) && (
        <>
          <path d={fl.petals} fill={c('flowerRed')} />
          <path d={fl.hearts} fill={c('flowerYellow')} />
        </>
      )}
      {full(t) && (
        <>
          <path d={f.pole} fill={c('timber')} />
          <path d={f.cloth} fill={c('flag')} stroke={c('awningShade')} strokeWidth={1} {...ROUND} />
        </>
      )}
    </>
  )
}

/** Landsbyens små huse (i scenens koordinater): mure, tage (tegl eller skifer), vinduer, døre og skorstene. */
function Cottages({ spots, t }: { spots: readonly (Place & { slate: boolean })[]; t: RegionTier }) {
  const c = paint(t)
  const parts = spots.map(({ x, y, s, slate }) => ({
    slate,
    wall: rect(x - 15 * s, y - 21 * s, 30 * s, 21 * s, 2 * s),
    shade: rect(x + 6 * s, y - 21 * s, 9 * s, 21 * s, 2 * s),
    roof: blob([[x - 19 * s, y - 19 * s], [x, y - 38 * s], [x + 19 * s, y - 19 * s]], 0.25),
    chimney: rect(x + 6 * s, y - 38 * s, 5 * s, 11 * s, 1.2 * s),
    windows: join(rect(x - 11 * s, y - 15 * s, 7 * s, 6 * s, 1.5 * s), rect(x + 4 * s, y - 15 * s, 7 * s, 6 * s, 1.5 * s)),
    door: rect(x - 3 * s, y - 11 * s, 6 * s, 11 * s, 3 * s),
    smoke: smoke(x + 8.5 * s, y - 40 * s, s * 0.8),
    s,
  }))
  return (
    <>
      {lit(t) && <path d={join(...parts.map((p) => p.smoke))} fill={BAKKE.smoke} opacity={0.85} />}
      <path d={join(...parts.map((p) => p.chimney))} fill={c('roofShade')} stroke={c('timber')} strokeWidth={1.2} {...ROUND} />
      <path d={join(...parts.map((p) => p.wall))} fill={c('wall')} stroke={c('timber')} strokeWidth={1.4} {...ROUND} />
      <path d={join(...parts.map((p) => p.shade))} fill={c('wallShade')} opacity={0.7} />
      <path d={join(...parts.filter((p) => !p.slate).map((p) => p.roof))} fill={c('roof')} stroke={c('roofShade')} strokeWidth={1.4} {...ROUND} />
      <path d={join(...parts.filter((p) => p.slate).map((p) => p.roof))} fill={c('roof2')} stroke={c('roof2Shade')} strokeWidth={1.4} {...ROUND} />
      <path d={join(...parts.map((p) => p.windows))} fill={lit(t) ? c('windowLit') : c('window')} stroke={c('timber')} strokeWidth={1.1} {...ROUND} />
      <path d={join(...parts.map((p) => p.door))} fill={c('door')} />
    </>
  )
}

/**
 * Formværkstedet: et plankehus med trekant-gavl, et rundt vindue i gavlen og to runde vinduer i facaden, en
 * bred port og firkantede kasser og en tønde (cylinder) udenfor. Lys og røg fra bronze, blomsterkasser fra
 * sølv, vimpler langs gavlen og flag i guld.
 */
function Workshop({ t }: { t: RegionTier }) {
  const c = paint(t)
  const crates = join(rect(44, -17, 17, 17, 2), rect(61, -12, 12, 12, 2), rect(47, -31, 13, 13, 2))
  const crateLines = join(poly([[44, -17], [61, 0]], false), poly([[61, -12], [73, 0]], false), poly([[47, -31], [60, -18]], false))
  const b = bunting([-44, -42], [0, -84], 5, 2)
  const b2 = bunting([0, -84], [44, -42], 5, 2)
  const f = flag(0, -86, 18)
  const fl = flowerPaths([[-29, -13, 2.6], [-22, -13, 2.4], [-15, -13, 2.6], [15, -13, 2.6], [22, -13, 2.4], [29, -13, 2.6]])
  return (
    <>
      {lit(t) && <path d={smoke(-25, -80, 1)} fill={BAKKE.smoke} opacity={0.88} />}
      <path d={rect(-29, -80, 8, 20, 1.5)} fill={c('roofShade')} stroke={c('timber')} strokeWidth={SW * 0.8} {...ROUND} />
      {/* tønden (cylinder) til venstre */}
      <path d={join(rect(-60, -19, 15, 19, 3), ellipse(-52.5, -19, 7.5, 2.6))} fill={c('wood')} stroke={c('woodDark')} strokeWidth={1.4} {...ROUND} />
      <path d={join(rect(-40, -46, 80, 46, 3), blob([[-42, -45], [0, -80], [42, -45]], 0.12))} fill={c('plank')} stroke={c('timber')} strokeWidth={SW} {...ROUND} />
      <path d={join(rect(24, -46, 16, 46, 2), blob([[0, -78], [40, -45], [20, -45]], 0.12))} fill={c('plankShade')} opacity={0.55} />
      <path d={join(...[-34, -26, -18, 18, 26, 34].map((x) => poly([[x, -44], [x, -2]], false)))} fill="none" stroke={c('plankShade')} strokeWidth={1.1} opacity={0.8} />
      {/* trekant-gavlen: tagkanten som to brede planker */}
      <path d={poly([[-48, -40], [0, -86], [48, -40]], false)} fill="none" stroke={c('roof')} strokeWidth={8} {...ROUND} />
      <path d={poly([[-48, -40], [0, -86], [48, -40]], false)} fill="none" stroke={c('roofShade')} strokeWidth={2} opacity={0.7} {...ROUND} />
      <path d={join(circle(0, -58, 7.5), circle(-23, -27, 7.5), circle(23, -27, 7.5))} fill={lit(t) ? c('windowLit') : c('window')} stroke={c('timber')} strokeWidth={SW} />
      <path d={join(poly([[0, -65.5], [0, -50.5]], false), poly([[-7.5, -58], [7.5, -58]], false), poly([[-23, -34.5], [-23, -19.5]], false), poly([[23, -34.5], [23, -19.5]], false))} fill="none" stroke={c('timber')} strokeWidth={1.3} />
      <path d={rect(-10, -33, 20, 33, 3)} fill={c('gate')} stroke={c('gateShade')} strokeWidth={SW} {...ROUND} />
      <path d={join(poly([[-10, -30], [10, -3]], false), poly([[0, -33], [0, 0]], false))} fill="none" stroke={c('gateShade')} strokeWidth={1.4} {...ROUND} />
      <path d={crates} fill={c('wood')} stroke={c('woodDark')} strokeWidth={1.5} {...ROUND} />
      <path d={crateLines} fill="none" stroke={c('woodDark')} strokeWidth={1.1} {...ROUND} />
      {bloom(t) && (
        <>
          <path d={join(rect(-33, -12, 20, 4, 1.5), rect(13, -12, 20, 4, 1.5))} fill={c('woodDark')} />
          <path d={fl.petals} fill={c('flowerPink')} />
        </>
      )}
      {full(t) && (
        <>
          <path d={join(b.line, b2.line)} fill="none" stroke={c('timber')} strokeWidth={0.9} />
          <path d={join(b.even, b2.even)} fill={c('flag')} />
          <path d={join(b.odd, b2.odd)} fill={c('flowerYellow')} />
          <path d={f.pole} fill={c('timber')} />
          <path d={f.cloth} fill={c('flag2')} />
        </>
      )}
    </>
  )
}

/**
 * Målebakken: en markedsbod med stribet markise, en vægt med to skåle (et æble mod lodder) og en gul lineal
 * med ti streger langs disken. Lanterne fra bronze, kurve med frugt fra sølv, vimpler og glimt i guld.
 */
function Stall({ t }: { t: RegionTier }) {
  const c = paint(t)
  const ticks = join(...Array.from({ length: 11 }, (_, i) => poly([[-30 + i * 6, -19], [-30 + i * 6, i % 5 === 0 ? -14 : -16.5]], false)))
  const stripes = join(...[-30, -10, 10, 30].map((x) => blob([[x - 5, -90], [x + 5, -90], [x + 6.2, -72], [x - 6.2, -72]], 0.1)))
  const scallops = (odd: boolean) => join(...Array.from({ length: 6 }, (_, i) => i).filter((i) => i % 2 === (odd ? 1 : 0)).map((i) => ellipseBelow(-40 + i * 16, -73, 8, 7.5, -73)))
  // vægten hælder mod æblet (det tunge)
  const beam: Vec[] = xf([[-13, 0], [13, 0]], { rot: -8, dx: -20, dy: -50 })
  const pan = ([x, y]: Vec) => blob([[x - 6.5, y + 9], [x + 6.5, y + 9], [x + 4, y + 13], [x - 4, y + 13]], 0.5)
  const b = bunting([-46, -88], [46, -88], 8, 5)
  return (
    <>
      <path d={join(rect(-37, -78, 4.5, 78, 1.5), rect(32.5, -78, 4.5, 78, 1.5))} fill={c('wood')} stroke={c('woodDark')} strokeWidth={1.5} {...ROUND} />
      <path d={blob([[-47, -72], [-40, -92], [40, -92], [47, -72]], 0.15)} fill={c('awning')} stroke={c('awningShade')} strokeWidth={SW} {...ROUND} />
      <path d={stripes} fill={c('awningLight')} opacity={0.92} />
      <path d={scallops(false)} fill={c('awning')} stroke={c('awningShade')} strokeWidth={1.4} />
      <path d={scallops(true)} fill={c('awningLight')} stroke={c('awningShade')} strokeWidth={1.4} />
      {/* disken med linealen */}
      <path d={rect(-42, -28, 84, 28, 3)} fill={c('wood')} stroke={c('woodDark')} strokeWidth={SW} {...ROUND} />
      <path d={rect(26, -28, 16, 28, 2)} fill={c('woodDark')} opacity={0.3} />
      <path d={rect(-33, -21, 66, 9, 1.5)} fill={c('ruler')} stroke={c('rulerEdge')} strokeWidth={1.3} {...ROUND} />
      <path d={ticks} fill="none" stroke={c('rulerEdge')} strokeWidth={1.1} {...ROUND} />
      {/* vægten */}
      <path d={join(rect(-25, -31, 10, 3.5, 1.5), rect(-21.2, -51, 2.4, 21, 1))} fill={c('brassDark')} />
      <path d={join(poly([beam[0], [beam[0][0], beam[0][1] + 9]], false), poly([beam[1], [beam[1][0], beam[1][1] + 9]], false))} fill="none" stroke={c('brassDark')} strokeWidth={0.9} />
      <path d={join(capsule(beam[0], beam[1], 1.5), pan(beam[0]), pan(beam[1]))} fill={c('brass')} stroke={c('brassDark')} strokeWidth={1.1} {...ROUND} />
      <path d={circle(beam[1][0], beam[1][1] + 5.5, 4)} fill={c('apple')} stroke={c('awningShade')} strokeWidth={0.9} />
      <path d={join(rect(beam[0][0] - 4, beam[0][1] + 4.5, 3.6, 4.5, 0.8), rect(beam[0][0] + 0.6, beam[0][1] + 5.5, 3.2, 3.5, 0.8))} fill={c('stoneShade')} />
      {lit(t) && <>{lantern(28, -71, true, 0.85)}</>}
      {bloom(t) && (
        <>
          <path d={join(rect(2, -35, 20, 8, 3.5))} fill={c('woodDark')} />
          <path d={join(circle(6, -36, 3.4), circle(12, -37.5, 3.4), circle(18, -36, 3.4))} fill={c('apple')} />
        </>
      )}
      {full(t) && (
        <>
          <path d={b.line} fill="none" stroke={c('timber')} strokeWidth={0.9} />
          <path d={b.even} fill={c('flag2')} />
          <path d={b.odd} fill={c('flowerYellow')} />
          <path d={glints([[-30, -42, 3.2], [0, -48, 2.6]])} fill={BAKKE.flowerWhite} />
        </>
      )}
    </>
  )
}

/**
 * Hundredemarken: en mark i let perspektiv med ti rækker af ti blomster. Flere rækker springer ud for hvert trin
 * (to, fem, otte, alle ti); lanterne på hjørnepælen fra bronze, flag i guld.
 */
function Field({ t }: { t: RegionTier }) {
  const c = paint(t)
  const rows = Array.from({ length: 10 }, (_, j) => {
    const y = -64 + j * 6.6
    const half = 46 + j * 1.7
    const r = 2.1 + j * 0.12
    return Array.from({ length: 10 }, (_, i) => [-half + ((i + 0.5) * 2 * half) / 10, y, r] as [number, number, number])
  })
  const open = [2, 5, 8, 10][rank(t)]
  // rækkerne forfra: de forreste rækker springer ud først
  const opened = rows.slice(10 - open)
  const buds = rows.slice(0, 10 - open).flat()
  const warm = flowerPaths(opened.filter((_, j) => j % 2 === 0).flat())
  const cool = flowerPaths(opened.filter((_, j) => j % 2 === 1).flat())
  const f = flag(66, 1, 34)
  return (
    <>
      <path d={poly([[-50, -69], [50, -69], [64, 1], [-64, 1]])} fill={c('fieldBed')} stroke={c('furrow')} strokeWidth={SW} {...ROUND} />
      <path d={join(...rows.map((row) => poly([[row[0][0] - 3, row[0][1] + 2], [row[9][0] + 3, row[9][1] + 2]], false)))} fill="none" stroke={c('furrow')} strokeWidth={1.4} opacity={0.75} {...ROUND} />
      {buds.length > 0 && <path d={join(...buds.map(([x, y, r]) => circle(x, y, r * 0.7)))} fill={c('bud')} />}
      <path d={warm.petals} fill={c('flowerRed')} />
      <path d={cool.petals} fill={c('flowerYellow')} />
      <path d={join(warm.hearts, cool.hearts)} fill={BAKKE.flowerWhite} opacity={0.9} />
      <path d={rect(-67.5, -58, 3, 58, 1.2)} fill={c('wood')} stroke={c('woodDark')} strokeWidth={1} />
      {lit(t) && <>{lantern(-66, -61, true, 0.85)}</>}
      {full(t) && (
        <>
          <path d={f.pole} fill={c('timber')} />
          <path d={f.cloth} fill={c('flag')} />
        </>
      )}
    </>
  )
}

/** Tierhoppet: to rækker af ti flade hoppesten med et lille mellemrum efter de fem (som en tierramme). */
function HopStones({ t }: { t: RegionTier }) {
  const c = paint(t)
  const row = (y: number, pitch: number, rx: number) =>
    Array.from({ length: 10 }, (_, i) => [(i - 4.5) * pitch + (i >= 5 ? pitch * 0.35 : -pitch * 0.35), y, rx] as const)
  const stones = [...row(-13, 12.4, 5.4), ...row(0, 13.6, 6.1)]
  const top = (pick: (i: number) => boolean) => join(...stones.filter((_, i) => pick(i % 10)).map(([x, y, rx]) => ellipse(x, y, rx, rx * 0.6)))
  const fl = flowerPaths([[-40, -5.5, 2.2], [-12, -5.5, 2.2], [17, -5.5, 2.2], [46, -5.5, 2.2]])
  const f = flag(76, 1, 26)
  return (
    <>
      <path d={join(...stones.map(([x, y, rx]) => ellipse(x + 1.2, y + 2, rx, rx * 0.62)))} fill={c('stoneShade')} />
      {full(t) ? (
        <>
          <path d={top((i) => i < 5)} fill={c('hopA')} stroke={c('stoneShade')} strokeWidth={1} />
          <path d={top((i) => i >= 5)} fill={c('hopB')} stroke={c('stoneShade')} strokeWidth={1} />
        </>
      ) : (
        <path d={top(() => true)} fill={c('stone')} stroke={c('stoneShade')} strokeWidth={1} />
      )}
      <path d={join(...stones.map(([x, y, rx]) => ellipse(x - rx * 0.25, y - rx * 0.2, rx * 0.45, rx * 0.16)))} fill={BAKKE.flowerWhite} opacity={0.55} />
      {lit(t) && <>{lantern(-78, -24, true, 0.8)}</>}
      {lit(t) && <path d={rect(-79.2, -22, 2.4, 24, 1)} fill={c('woodDark')} />}
      {bloom(t) && <path d={fl.petals} fill={c('flowerViolet')} />}
      {full(t) && (
        <>
          <path d={f.pole} fill={c('timber')} />
          <path d={f.cloth} fill={c('flag2')} />
        </>
      )}
    </>
  )
}

/** Broen over åen (lokalt langs stien): en bue af præcis ti planker med to gelændere og skygge på vandet. */
export const BRIDGE_PLANKS = 10
function Bridge({ t }: { t: RegionTier }) {
  const c = paint(t)
  const archY = (x: number) => -10 * (1 - (x / 34) ** 2)
  const planks = Array.from({ length: BRIDGE_PLANKS }, (_, i) => {
    const x0 = -31 + i * 6.3
    const x1 = x0 + 5.3
    return poly([[x0, archY(x0) - 4.5], [x1, archY(x1) - 4.5], [x1, archY(x1) + 5], [x0, archY(x0) + 5]])
  })
  const xs = [-31, -15.5, 0, 15.5, 31]
  const rail = (dy: number) => join(spline(xs.map((x) => [x, archY(x) + dy - 12] as Vec)), ...xs.filter((_, i) => i % 2 === 0).map((x) => poly([[x, archY(x) + dy - 12], [x, archY(x) + dy]], false)))
  return (
    <>
      <path d={ellipse(4, 12, 36, 6.5)} fill={BAKKE.castShadow} opacity={0.3} />
      <path d={rail(-5)} fill="none" stroke={c('woodDark')} strokeWidth={2.2} {...ROUND} />
      <path d={band(xs.map((x) => [x * 1.04, archY(x) + 2] as Vec), xs.map((x) => [x * 1.04, archY(x) + 8] as Vec))} fill={c('woodDark')} />
      <path d={join(...planks)} fill={c('wood')} stroke={c('woodDark')} strokeWidth={1.1} {...ROUND} />
      <path d={spline(xs.slice(1, -1).map((x) => [x, archY(x) - 3.5] as Vec))} fill="none" stroke={BAKKE.sunlit} strokeWidth={1.4} opacity={0.6} {...ROUND} />
      <path d={rail(6)} fill="none" stroke={c('woodDark')} strokeWidth={2.4} {...ROUND} />
      {lit(t) && (
        <>
          {lantern(-31, archY(-31) - 9, true, 0.8)}
          {lantern(31, archY(31) - 9, true, 0.8)}
        </>
      )}
      {full(t) && <path d={join(...[-31, 0, 31].map((x) => blob([[x, archY(x) - 23], [x + 9, archY(x) - 20], [x, archY(x) - 17]], 0.3)), ...[-31, 0, 31].map((x) => rect(x - 0.7, archY(x) - 23, 1.4, 12, 0.7)))} fill={c('flag')} />}
    </>
  )
}

/** Kilden (lokalt): vandet vælder op mellem tre sten i en lille gryde, der løber over i åen. */
function Spring({ t }: { t: RegionTier }) {
  const c = paint(t)
  return (
    <>
      <path d={ellipse(0, 3, 17, 6)} fill={c('bank')} />
      <path d={ellipse(0, 2, 12, 4.4)} fill={c('water')} stroke={c('waterEdge')} strokeWidth={1.2} />
      <path d={join(blob([[-19, 4], [-17, -6], [-9, -8], [-6, 0], [-10, 6]], 0.8), blob([[7, 1], [10, -9], [18, -7], [20, 3], [13, 6]], 0.8), blob([[-6, -5], [-2, -12], [5, -11], [6, -4]], 0.8))} fill={c('stone')} stroke={c('stoneShade')} strokeWidth={1.3} {...ROUND} />
      <path d={join(ellipse(-3, 1.5, 4.5, 1.2), ellipse(4, 3, 2.4, 0.8))} fill={BAKKE.waterLight} opacity={0.95} />
      {bloom(t) && <path d={glints([[0, -2, 3.2]])} fill={BAKKE.flowerWhite} />}
    </>
  )
}

/** En forenklet hest i scenens stil (lokalt, vender mod højre, hovene på y = 0): græssende eller stående. */
function Horse({ t, coat, graze }: { t: RegionTier; coat: Coat; graze: boolean }) {
  const c = paint(t)
  const [body, dark] = ({ chestnut: ['chestnut', 'chestnutDark'], grey: ['grey', 'greyDark'], foal: ['foal', 'foalDark'], bay: ['bay', 'bayDark'] } as const)[coat]
  const mane = coat === 'chestnut' || coat === 'bay' ? c('mane') : c(dark)
  const torso = blob([[-19, -26], [-6, -31], [10, -30.5], [19, -26], [20.5, -18], [12, -13.5], [-8, -13.5], [-19.5, -17.5]], 0.8)
  const head = graze
    ? blob([[11, -28], [20, -25], [27, -16], [31, -8], [34, -3], [30, -0.5], [25, -4], [19, -12], [13, -19]], 0.75)
    : blob([[11, -27], [16, -38], [21, -47], [26, -49.5], [30, -47], [36, -40], [35.5, -36], [31, -35.5], [25, -38], [21, -27]], 0.75)
  const ear = graze ? blob([[21, -19], [17, -24], [23, -21.5]], 0.4) : blob([[22.5, -48], [23, -55], [26.5, -49.5]], 0.4)
  const maneP = graze
    ? blob([[9.5, -28.5], [17, -28], [23, -21], [21.5, -19.5], [16, -24], [9.5, -25.5]], 0.7)
    : blob([[9.5, -27], [13, -36], [18.5, -45.5], [22.5, -50], [21, -45], [16.5, -36], [13.5, -28]], 0.7)
  const muzzle = graze ? ellipse(32, -2.4, 3.2, 2.5, 50) : ellipse(34, -38.2, 3.6, 2.8, 30)
  const eye = graze ? circle(26.5, -10, 1.15) : circle(27.5, -44.5, 1.15)
  const shape = join(torso, head, ear)
  return (
    <>
      <path d={join(capsule([-16, -16], [-17, 0], 2.5), capsule([16, -16], [17.5, 0], 2.5))} fill={c(dark)} />
      <g transform="translate(-19 -25)">
        <g className="bakke-swish" style={{ animationDelay: `${coat === 'grey' ? -1.4 : 0}s` }}>
          <path d={blob([[0, 0], [-5, 1], [-8.5, 8], [-8, 17], [-5, 22], [-3.5, 14], [-1.5, 6]], 0.75)} fill={mane} />
        </g>
      </g>
      <path d={join(capsule([-12, -16], [-12.5, 0], 2.7), capsule([12, -16], [13, 0], 2.7))} fill={c(body)} stroke={c(dark)} strokeWidth={1.3} {...ROUND} />
      {/* konturen (dobbelt bredde) bag fladen: ingen sømme, hvor hals og krop mødes */}
      <path d={shape} fill={c(dark)} stroke={c(dark)} strokeWidth={2.6} {...ROUND} />
      <path d={shape} fill={c(body)} />
      <path d={lune(1, -22, 19, 8.5, 4, 15, 165)} fill={c(dark)} opacity={0.35} />
      <path d={ellipse(-6, -28, 8, 2, -4)} fill={BAKKE.flowerWhite} opacity={0.35} />
      <path d={maneP} fill={mane} />
      <path d={muzzle} fill={BAKKE.muzzle} opacity={coat === 'grey' ? 0.6 : 0.9} />
      <path d={eye} fill={BAKKE.outline} />
    </>
  )
}

/** Et forgrundshjørne (lokalt fra hjørnet; spejles til højre): store blade, græs og blomster, der beskæres. */
function Corner({ t, mirror }: { t: RegionTier; mirror: boolean }) {
  const c = paint(t)
  const leaves = mirror
    ? [leaf(-6, 14, 100, 20, -76), leaf(-14, 8, 78, 17, -40), leaf(16, 18, 64, 14, -98)]
    : [leaf(-6, 12, 108, 22, -68), leaf(-16, 6, 82, 18, -36), leaf(14, 18, 70, 15, -96)]
  const fl: [number, number, number][] = (mirror
    ? [[40, -26, 10], [24, -70, 8.5], [58, -8, 8], [50, -50, 7]]
    : [[42, -30, 11], [60, -8, 9], [26, -76, 8.5], [56, -54, 7.5]]).slice(0, 1 + rank(t)) as [number, number, number][]
  const flowers = flowerPaths(fl)
  return (
    <g transform={mirror ? 'scale(-1 1)' : undefined}>
      <path d={grass([[10, 4, 2.4], [36, 6, 1.9], [62, 8, 1.4], [82, 8, 1.1]])} fill={c('front')} stroke={c('frontDark')} strokeWidth={1.3} {...ROUND} />
      <g className="bakke-sway" style={{ animationDelay: mirror ? '-2.4s' : '-0.8s' }}>
        <path d={join(...leaves.map((l) => l.blade))} fill={c('fgLeaf')} stroke={c('fgLeafDark')} strokeWidth={1.8} {...ROUND} />
        <path d={join(...leaves.map((l) => l.rib))} fill="none" stroke={c('fgLeafLight')} strokeWidth={1.6} opacity={0.9} {...ROUND} />
      </g>
      <path d={flowers.petals} fill={mirror ? c('flowerViolet') : c('flowerPink')} stroke={BAKKE.outline} strokeWidth={1.1} {...ROUND} />
      <path d={flowers.hearts} fill={c('flowerYellow')} />
    </g>
  )
}

/** En sky: fire runde puder og en flad bund, med en blå skygge forneden. */
const CLOUD = {
  body: join(circle(-22, -4, 14), circle(-4, -14, 18), circle(18, -8, 15), circle(32, 0, 10), rect(-36, -6, 78, 14, 7)),
  shade: ellipse(4, 5, 34, 4.5),
}

// ---------------------------------------------------------------------------------------------
// Åen og foldens hegn

/** Åen bliver bredere nedstrøms (fuld bredde pr. punkt); stien ligeså. */
export const streamWidths = (L: Layout) => L.stream.map((_, i) => (4 + i * 6.5) * L.k)
export const pathWidths = (L: Layout) => L.pathW.map((v) => v * L.k)

/** Afstanden fra (x, y) til åens vandkant (negativ i vandet), med åens bredde lagt lineært ud. */
export function streamGap(stream: readonly Vec[], widths: readonly number[], x: number, y: number): number {
  let best = Infinity
  for (let i = 0; i < stream.length - 1; i++) {
    const [ax, ay] = stream[i]
    const [bx, by] = stream[i + 1]
    const dx = bx - ax
    const dy = by - ay
    const u = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1)
    const d = Math.hypot(x - ax - dx * u, y - ay - dy * u) - (widths[i] + (widths[i + 1] - widths[i]) * u) / 2
    best = Math.min(best, d)
  }
  return best
}

/** Foldens hegnsstolper: fra den tørre ende mod åen med jævn afstand; den sidste står på brinken. */
export function paddockFence(L: Layout, widths: readonly number[]): Vec[] {
  const K = L.k
  const [[ax, ay], [bx, by]] = L.fence
  const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / (2 * K)))
  const run: Vec[] = []
  for (let j = 0; j <= steps; j++) {
    const p: Vec = [ax + ((bx - ax) * j) / steps, ay + ((by - ay) * j) / steps]
    if (streamGap(L.stream, widths, p[0], p[1]) < 6 * K) break
    run.push(p)
  }
  const spacing = 22 * K
  const posts: Vec[] = run.length ? [run[0]] : []
  let acc = 0
  for (let i = 1; i < run.length; i++) {
    acc += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1])
    if (acc >= spacing) {
      posts.push(run[i])
      acc = 0
    }
  }
  if (run.length > 1) {
    const last = run[run.length - 1]
    const tail = posts[posts.length - 1]
    if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > spacing * 0.45) posts.push(last)
    else posts[posts.length - 1] = last
  }
  return posts
}

// ---------------------------------------------------------------------------------------------
// Scenen

export interface BakkeArtProps {
  w: number
  h: number
  tiers: Tiers
  className?: string
  svgRef?: Ref<SVGSVGElement>
}

/** Den rene tegning for en given plads (CSS-px). */
export function BakkeArt({ w, h, tiers, className, svgRef }: BakkeArtProps) {
  const sky = `${useId().replace(/[^A-Za-z0-9_-]/g, '')}sky`
  const L = layoutOf(w, h)
  const T = Object.fromEntries((Object.keys(BAKKE_REGIONS) as Mark[]).map((m) => [m, tierOf(tiers, m)])) as Record<Mark, RegionTier>
  // Bakkerne, himlen og solen følger hele verdenens fremgang (gennemsnittet af regionernes krom).
  const world = Object.values(T).reduce((s, t) => s + TIER_CHROMA[t], 0) / Object.keys(T).length
  const g = (c: BakkeColor) => tintBakkeBy(c, world)
  const tb = (c: BakkeColor, t: RegionTier) => tintBakke(c, t)
  const R = { far: ridgePts(L.far, w), fields: ridgePts(L.fields, w), mid: ridgePts(L.mid, w), near: ridgePts(L.near, w) }
  const K = L.k
  // Lag: papirkantens skygge, fladen, solens skygge- og lysbånd, det varme højlys på kammen og den lyse kant.
  const layer = (r: Ridge, pts: Vec[], color: BakkeColor, depth: number, shadeO: number) => {
    const light = ridgeLight(r, w, depth)
    return (
      <>
        <path d={ridge(xf(pts, { dy: -5 }), h + 40)} fill={BAKKE.paperShadow} opacity={0.13} />
        <path d={ridge(pts, h + 40)} fill={g(color)} />
        <path d={light.shade} fill={BAKKE.shade} opacity={shadeO} />
        <path d={light.glow} fill={BAKKE.sunlit} opacity={0.2} />
        <path d={spline(pts)} fill="none" stroke={BAKKE.rim} strokeWidth={2} opacity={0.5} {...ROUND} />
        <path d={light.crest} fill="none" stroke={BAKKE.sunlit} strokeWidth={3.2 * K} opacity={0.95} {...ROUND} />
      </>
    )
  }
  // Den fjerne trærække og læhegnene (Dobbeltdalen i det fjerne) og poplerne på markbakken.
  const farTrees = join(
    ...Array.from({ length: Math.round(w / 30) }, (_, i) => {
      const x = (i + 0.5) * (w / Math.round(w / 30))
      const r = (4.2 + ((i * 7) % 4)) * K
      return (i * 5) % 7 < 3 ? circle(x, ridgeY(L.far, w, x) - r * 0.55, r) : ''
    }),
  )
  const hedgerows = join(
    ...Array.from({ length: Math.round(w / 15) }, (_, i) => {
      const x = (i + 0.5) * (w / Math.round(w / 15))
      return (i % 11) < 4 ? circle(x, ridgeY(L.fields, w, x) + 20 * K, (2.6 + (i % 3) * 0.6) * K) : ''
    }),
  )
  const poplars = join(
    ...(L.wide ? [0.24, 0.26, 0.28, 0.43] : [0.12, 0.15, 0.36]).map((u, i) => {
      const x = w * u
      const y = ridgeY(L.fields, w, x) + 6 * K
      return ellipse(x, y - 13 * K, (4 + (i % 2)) * K, 14 * K)
    }),
  )
  // Markerne: brede høgule og grønne bånd langs markbakken.
  const fieldBands = [9, 26].map((dy) => spline(ridgePts(L.fields, w, dy * K)))
  // Høballer på marken (runde, med en spiral).
  const bales = L.bales.map(({ x, y, s }) => ({ body: rect(x - 9 * s, y - 13 * s, 18 * s, 13 * s, 6 * s), spiral: ellipse(x - 4.5 * s, y - 6.5 * s, 3.4 * s, 4.6 * s), shadow: ellipse(x + 5 * s, y + 0.5 * s, 12 * s, 2.4 * s) }))
  // Spredte blomsterprikker på forgrunden (flere jo længere verdenen er nået).
  const dots = Math.round(14 + 48 * ((world - TIER_CHROMA.start) / (1 - TIER_CHROMA.start)))
  const spots = Array.from({ length: dots }, (_, i) => {
    const x = hash01(i) * w
    const top = ridgeY(L.near, w, x) + 14 * K
    return [x, top + hash01(i + 97) * Math.max(10, h - top - 40 * K), (1.6 + hash01(i + 31) * 1.2) * K] as const
  })
  const daisies = Array.from({ length: Math.round(dots * 0.5) }, (_, i) => {
    const x = hash01(i + 211) * w
    const top = ridgeY(L.mid, w, x) + 10 * K
    return [x, top + hash01(i + 307) * Math.max(8, ridgeY(L.near, w, x) - top - 14 * K), (1.3 + hash01(i + 401)) * K] as const
  })
  // Åen bliver bredere nedstrøms; brinken er et mørkere bånd under vandet.
  const sw = streamWidths(L)
  const pw = pathWidths(L)
  const posts = paddockFence(L, sw)
  const postH = 15 * K
  const pebbles = join(...L.stream.slice(1, 5).map(([x, y], i) => ellipse(x + (sw[i + 1] / 2 + 7 * K) * (i % 2 ? 1 : -1), y + 3 * K, 4.6 * K, 2.8 * K)))
  // Jordskygger (solen oppe til venstre: skyggen falder mod højre).
  const cast = (p: Place, dx: number, rx: number, ry: number) => ellipse(p.x + dx * p.s, p.y + 1.5 * p.s, rx * p.s, ry * p.s)
  const castMid = join(
    cast(L.tower, 16, 34, 6),
    ...L.cottages.map((p) => cast(p, 9, 22, 4.5)),
    ...L.trees.filter((p) => !p.front).map((p) => cast(p, 14, 30, 6)),
    ...bales.map((b) => b.shadow),
  )
  const castNear = join(
    cast(L.workshop, 12, 70, 7),
    cast(L.stall, 10, 54, 6.5),
    ...L.horses.filter((p) => p.from <= rank(T.field)).map((p) => ellipse(p.x + (p.flip ? -4 : 4) * p.s, p.y + 1 * p.s, 24 * p.s, 3.6 * p.s)),
    ...L.trees.filter((p) => p.front).map((p) => cast(p, 14, 30, 6)),
  )
  // Små buske spredt i mellemgrunden, så bakken mellem kendetegnene ikke står flad og tom.
  const scatter = (L.wide ? [0.18, 0.3, 0.38, 0.44, 0.53, 0.57] : [0.24, 0.36, 0.5, 0.62]).map((u, i) => {
    const x = w * u + hash01(i + 501) * 14 * K
    const top = ridgeY(L.mid, w, x) + h * 0.06
    const y = top + hash01(i + 601) * Math.max(4, ridgeY(L.near, w, x) - top - h * 0.05)
    return [x, y, K * (0.75 + hash01(i + 701) * 0.4)] as const
  })
  const scrub = join(...scatter.map(([x, y, s]) => scallop(x, y - 6 * s, 11 * s, 7 * s, 5, 0.6, -80)))
  const scrubShade = join(...scatter.map(([x, y, s]) => join(lune(x + 1 * s, y - 5.5 * s, 10 * s, 6 * s, 2.8 * s, 20, 160), ellipse(x + 8 * s, y + 0.5 * s, 12 * s, 2.6 * s))))
  // Lam på bakken: et lam for hvert trin mere ved Tyvebroen (Tyvebroens ven er lammet).
  const flock = L.sheep.slice(0, 2 + rank(T.bridge)).map(([x, y], i) => [x, y, K * (0.85 + (i % 2) * 0.15)] as const)
  // Forgrundens græskant langs bunden (rammer dioramaet ind).
  const tufts = Array.from({ length: Math.ceil(w / (30 * K)) + 1 }, (_, i) => [i * 30 * K + hash01(i + 7) * 10 * K, h + 2, K * (0.9 + hash01(i + 3) * 0.6)] as const)
  // Regnbuen (guld i hele verdenen) og glimtene i luften og på vandet.
  const bow = { x: w * 0.5, y: h * (L.wide ? 0.43 : 0.41), rx: L.wide ? w * 0.38 : w * 0.62, ry: h * (L.wide ? 0.31 : 0.2) }
  const air = (L.wide ? [[0.3, 0.16, 7], [0.58, 0.12, 5], [0.7, 0.27, 6], [0.16, 0.33, 5]] : [[0.3, 0.2, 6], [0.72, 0.27, 7], [0.12, 0.34, 5], [0.86, 0.36, 5]]).map(([u, v, r]) => [w * u, h * v, r * K] as const)
  const wet = L.stream.slice(1, 6).map(([x, y], i) => [x + (i % 2 ? 4 : -5) * K, y + 6 * K, (4 + i) * K] as const)
  // Stien over Tyvebroen (lyser fra bronze, SPEC §5.6).
  const road = (
    <>
      <path d={blob(ribbon(L.path, pw), 0.9)} fill={tb('trail', T.bridge)} stroke={tb('trailEdge', T.bridge)} strokeWidth={1.5 * K} {...ROUND} />
      {lit(T.bridge) && <path d={spline(L.path)} fill="none" stroke={BAKKE.lanternGlow} strokeWidth={3.6 * K} opacity={0.75} {...ROUND} />}
    </>
  )
  // hestene bagfra og frem (de fjerneste først)
  const horses = L.horses.filter((p) => p.from <= rank(T.field)).sort((a, b) => a.y - b.y)
  return (
    <svg
      ref={svgRef}
      className={['bakke-scene', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${n(w)} ${n(h)}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      data-scene="bakke"
    >
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BAKKE.skyTop} />
          <stop offset="0.6" stopColor={BAKKE.skyBottom} />
        </linearGradient>
      </defs>
      <path d={rect(0, 0, w, h)} fill={`url(#${sky})`} />
      {/* sol (strålerne kommer med lyset) og skyer */}
      {at(L.sun, (
        <>
          <path d={circle(0, 0, 46)} fill={BAKKE.sunHalo} opacity={0.75} />
          {world > 0.8 && <path d={join(...Array.from({ length: 10 }, (_, i) => blob(xf([[-4, -36], [0, -50], [4, -36]], { rot: i * 36 }), 0.4)))} fill={BAKKE.sun} opacity={0.75} />}
          <path d={circle(0, 0, 27)} fill={g('sun')} />
        </>
      ))}
      {world >= 1 && (
        <g opacity={0.6}>
          {(['rainbow1', 'rainbow2', 'rainbow3', 'rainbow4'] as const).map((c, i) => (
            <path key={c} d={arc(bow.x, bow.y, bow.rx - i * 9 * K, bow.ry - i * 9 * K, 180, 360)} fill="none" stroke={BAKKE[c]} strokeWidth={9 * K} />
          ))}
        </g>
      )}
      {L.clouds.map((c, i) => (
        <g key={i} className={`bakke-drift bakke-drift-${i % 3}`}>
          {at(c, (
            <>
              <path d={CLOUD.body} fill={BAKKE.cloud} opacity={0.94} />
              <path d={CLOUD.shade} fill={BAKKE.cloudShade} opacity={0.85} />
            </>
          ))}
        </g>
      ))}
      {/* lag 1: de fjerne bakker med en trærække */}
      {layer(L.far, R.far, 'farHill', h * 0.045, 0.09)}
      <path d={farTrees} fill={tb('farTree', T.twins)} />
      {/* lag 2: markerne med høstriber, læhegn, popler og høballer */}
      {layer(L.fields, R.fields, 'fieldHill', h * 0.05, 0.1)}
      <path d={join(...fieldBands)} fill="none" stroke={g('field')} strokeWidth={11 * K} opacity={0.85} {...ROUND} />
      <path d={hedgerows} fill={tb('hedgerow', T.twins)} />
      <path d={poplars} fill={tb('leafDark', T.twins)} opacity={0.85} />
      <path d={join(...bales.map((b) => b.body))} fill={g('hay')} stroke={g('hayShade')} strokeWidth={1.2 * K} {...ROUND} />
      <path d={join(...bales.map((b) => b.spiral))} fill="none" stroke={g('hayShade')} strokeWidth={1.1 * K} />
      {!L.twins.onMid && at(L.twins, <Twins t={T.twins} onMid={false} />)}
      {/* lag 3: mellembakken med landsbyen, tårnet, marken, lammene og de bageste træer */}
      {layer(L.mid, R.mid, 'midHill', h * 0.11, 0.13)}
      {L.twins.onMid && at(L.twins, <Twins t={T.twins} onMid />)}
      <path d={join(...daisies.map(([x, y, r]) => circle(x, y, r)))} fill={BAKKE.flowerWhite} opacity={0.85} />
      <path d={castMid} fill={BAKKE.castShadow} opacity={0.2} />
      {/* vejen fra landsbyen over Tyvebroen (forgrundens bakke dækker dens ende ved boden) */}
      {!L.pathOnNear && road}
      <path d={scrub} fill={tb('leaf', T.twins)} stroke={tb('leafDark', T.twins)} strokeWidth={1.2 * K} opacity={0.92} {...ROUND} />
      <path d={scrubShade} fill={BAKKE.castShadow} opacity={0.2} />
      <path d={join(...flock.map(([x, y, s]) => scallop(x, y - 7 * s, 9 * s, 6 * s, 7, 0.62, -90)))} fill={BAKKE.wool} stroke={tb('greyDark', T.bridge)} strokeWidth={1.1 * K} {...ROUND} />
      <path d={join(...flock.map(([x, y, s]) => join(ellipse(x + 9 * s, y - 8 * s, 3.2 * s, 2.6 * s, 20), capsule([x - 4 * s, y - 3 * s], [x - 4 * s, y + 1 * s], 1 * s), capsule([x + 4 * s, y - 3 * s], [x + 4 * s, y + 1 * s], 1 * s))))} fill={BAKKE.sheepFace} />
      {(() => {
        // lammenes fold: stolper med jævn afstand langs bakken
        const fp = L.sheepFence.flatMap((a, i, all) => {
          if (i === all.length - 1) return [a]
          const b = all[i + 1]
          const m = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / (26 * K)))
          return Array.from({ length: m }, (_, j) => [a[0] + ((b[0] - a[0]) * j) / m, a[1] + ((b[1] - a[1]) * j) / m] as Vec)
        })
        const ph = 12 * K
        return (
          <>
            <path d={join(...fp.map(([x, y]) => rect(x - 1.6 * K, y - ph, 3.2 * K, ph, 1.2 * K)))} fill={tb('wood', T.bridge)} />
            <path d={join(spline(L.sheepFence.map(([x, y]) => [x, y - ph * 0.8] as Vec)), spline(L.sheepFence.map(([x, y]) => [x, y - ph * 0.4] as Vec)))} fill="none" stroke={tb('woodDark', T.bridge)} strokeWidth={1.4 * K} {...ROUND} />
          </>
        )
      })()}
      {L.trees.filter((p) => !p.front).map((p, i) => <g key={i}>{at(p, <Tree t={T.twins} seed={i} />)}</g>)}
      <Cottages spots={L.cottages} t={T.tower} />
      {at(L.tower, <Tower t={T.tower} />)}
      {at(L.field, <Field t={T.field} />)}
      {/* lag 4: forgrunden */}
      {layer(L.near, R.near, 'nearHill', h * 0.12, 0.15)}
      <path d={join(...spots.filter((_, i) => i % 2 === 0).map(([x, y, r]) => circle(x, y, r)))} fill={BAKKE.flowerWhite} opacity={0.9} />
      <path d={join(...spots.filter((_, i) => i % 2 === 1).map(([x, y, r]) => circle(x, y, r)))} fill={g('flowerYellow')} />
      <path d={castNear} fill={BAKKE.castShadow} opacity={0.22} />
      {L.pathOnNear && road}
      {/* åen fra kilden (bredere nedstrøms) og broen */}
      <path d={blob(ribbon(L.stream, sw.map((b) => b + 9 * K)), 0.9)} fill={tb('bank', T.bridge)} />
      <path d={blob(ribbon(L.stream, sw), 0.9)} fill={tb('water', T.bridge)} stroke={tb('waterEdge', T.bridge)} strokeWidth={1.5 * K} {...ROUND} />
      <path d={spline(xf(L.stream.slice(1), { dx: -2.5 * K }))} fill="none" stroke={BAKKE.waterLight} strokeWidth={2.4 * K} opacity={bloom(T.bridge) ? 0.9 : 0.55} {...ROUND} />
      <path d={pebbles} fill={tb('stone', T.bridge)} stroke={tb('stoneShade', T.bridge)} strokeWidth={1.1 * K} />
      {at(L.spring, <Spring t={T.bridge} />)}
      {bloom(T.bridge) && <path d={glints(wet)} fill={BAKKE.flowerWhite} />}
      {at(L.bridge, <g transform={`rotate(${n(L.bridge.rot)})`}><Bridge t={T.bridge} /></g>)}
      {/* folden: hegnet stopper ved åen; hestene (en mere fra sølv og guld) */}
      <path d={join(...posts.map(([x, y]) => rect(x - 1.9 * K, y - postH, 3.8 * K, postH, 1.4 * K)))} fill={tb('wood', T.field)} stroke={tb('woodDark', T.field)} strokeWidth={1.2 * K} {...ROUND} />
      {posts.length > 1 && <path d={join(spline(posts.map(([x, y]) => [x, y - postH * 0.8] as Vec)), spline(posts.map(([x, y]) => [x, y - postH * 0.4] as Vec)))} fill="none" stroke={tb('woodDark', T.field)} strokeWidth={1.7 * K} {...ROUND} />}
      {horses.map((p, i) => (
        <g key={i} transform={`translate(${n(p.x)} ${n(p.y)}) scale(${fmt3(p.flip ? -p.s : p.s)} ${fmt3(p.s)})`}>
          <Horse t={T.field} coat={p.coat} graze={p.graze} />
        </g>
      ))}
      {at(L.workshop, <Workshop t={T.workshop} />)}
      {at(L.stall, <Stall t={T.market} />)}
      {at(L.hop, <HopStones t={T.hop} />)}
      {L.trees.filter((p) => p.front).map((p, i) => <g key={i}>{at(p, <Tree t={T.twins} seed={i + 3} />)}</g>)}
      <path d={grass(tufts)} fill={g('front')} stroke={g('frontDark')} strokeWidth={1.2 * K} {...ROUND} />
      {at(L.corners[0], <Corner t={T.field} mirror={false} />)}
      {at(L.corners[1], <Corner t={T.hop} mirror />)}
      {/* fugle over landsbyen (guld ved Urtårnet) og glimt i luften (guld i hele verdenen) */}
      {full(T.tower) && (
        <path
          d={birds([[L.tower.x + 30 * L.tower.s, L.tower.y - 150 * L.tower.s, K], [L.tower.x + 44 * L.tower.s, L.tower.y - 162 * L.tower.s, K * 0.8]])}
          fill="none"
          stroke={BAKKE.bird}
          strokeWidth={2 * K}
          {...ROUND}
        />
      )}
      {world >= 1 && <path d={glints(air)} fill={BAKKE.sunHalo} stroke={BAKKE.lantern} strokeWidth={0.8 * K} {...ROUND} />}
    </svg>
  )
}

/** Kortets scene (MapSceneProps): måler sin plads og tegner Hestebakkerne til netop den. */
export default function BakkeScene({ tiers, className }: MapSceneProps) {
  const ref = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState(() =>
    typeof window === 'undefined' ? { w: 1180, h: 820 } : { w: window.innerWidth, h: window.innerHeight },
  )
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return
      const w = Math.round(r.width)
      const h = Math.round(r.height)
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return <BakkeArt w={size.w} h={size.h} tiers={tiers} className={className} svgRef={ref} />
}
