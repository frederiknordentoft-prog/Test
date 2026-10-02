// Engdalen (verdenen `eng`): kortets baggrund – en lys, varm forårseng i papir-og-himmel-stilen, bygget som et
// diorama i fire lag (fjerne bakker med en mølle, marker med læhegn, mellembakken og forgrunden) med
// papirkanter: en blød skygge bag hvert lag og en lys kant langs toppen. Bakkerne står i luftperspektiv (kølige
// og lyse langt væk, varme og mættede forrest), og solen oppe til venstre giver blødt retningslys: varmt højlys
// på de skrænter, der vender mod den, kølig skygge på de andre og jordskygger under hus, træer, mølle og hule.
// Seks kendetegn står for Engdalens seks regioner, og hvert får sin farve igen efter regionens tier (SPEC §5.6):
//   træerne og buskene (Tællelunden) · haven med formklippede buske (Formhaven) · blomsterne (Plusengen) ·
//   stien med hegn og huset (Tyvestien) · bækken med dammen og broen (Minusbækken) · hulen i bakken (Tiervennernes hule).
// Start er dæmpet pastel (aldrig grå); bronze tænder lanterner, lader stien og vinduerne lyse, sender røg op af
// skorstenen og giver flere blomster og de første sommerfugle; sølv bringer blomster, vand og lys tilbage; guld er
// fuld mætning med regnbue, fugle, glimt og flag. Bakkerne og himlen følger hele dalens fremgang.
// Bækken springer fra en lille dam med et vandfald, bliver bredere nedstrøms og har mørkere brinker; hegnet
// stopper ved bækken med en stolpe på hver bred, og broen er en bue med to gelændere. Små seværdigheder fylder
// mellemgrunden: dammen, trædesten over bækken, en andemor med ællinger og et skilt med tallet 10 ved hulen.
// Store blade og blomster i de nederste hjørner rammer dioramaet ind.
// Scenen måler sin plads og lægger kendetegnene i kanterne, så kortets sti og trædesten i midten får ro: i
// bredformat i venstre strimmel, mellem stien og sidepanelet og under sidepanelet; i højformat i højre side og
// forneden. Kun skyerne driver og bladene svajer (transform); begge står stille i rolig tilstand og ved
// reduceret bevægelse. Alle former er husets parametriske primitiver; farverne kommer fra scenes/palette.ts.
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import type { RegionId } from '../../engine/types'
import type { RegionTier } from '../../meta/rewards'
import type { MapSceneProps } from '../../ui/screens/child/map/Backdrop'
import { arc, blob, capsule, circle, ellipse, fmt3, join, lune, n, poly, rect, ribbon, ridge, scallop, spline, star, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import { ENG, TIER_CHROMA, tint, tintBy } from './palette'
import type { EngColor } from './palette'
import './eng.css'

// ---------------------------------------------------------------------------------------------
// Regionerne og deres kendetegn

export const ENG_REGIONS = {
  grove: 'w0-tal10',
  garden: 'w0-former',
  meadow: 'w0-plus10',
  trail: 'w0-tal20',
  brook: 'w0-minus10',
  den: 'w0-tiervenner',
} as const satisfies Record<string, RegionId>
type Mark = keyof typeof ENG_REGIONS
type Tiers = MapSceneProps['tiers']

const tierOf = (tiers: Tiers, mark: Mark): RegionTier => tiers[ENG_REGIONS[mark]] ?? 'start'
const lit = (t: RegionTier) => t !== 'start'
const bloom = (t: RegionTier) => t === 'silver' || t === 'gold'
const full = (t: RegionTier) => t === 'gold'
/** Trinnet som tal (start 0, bronze 1, sølv 2, guld 3): flere blomster, sommerfugle og ællinger for hvert trin. */
const rank = (t: RegionTier) => (t === 'start' ? 0 : t === 'bronze' ? 1 : t === 'silver' ? 2 : 3)

/** Farvesæt for et kendetegn: grundfarverne tonet efter regionens tier. */
const paint = (t: RegionTier) => (c: EngColor) => tint(c, t)

/** Deterministisk "tilfældighed" (0–1) til spredte blomster og totter. */
const hash01 = (i: number) => {
  const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return v - Math.floor(v)
}

// ---------------------------------------------------------------------------------------------
// Layout: alt i skærmens CSS-px (viewBox = pladsen). Kendetegnene tegnes i lokale enheder om deres fodpunkt
// og skaleres med `k` (ca. 1 på en iPad på tværs, 0,7 på en telefon). Solen står oppe til venstre i begge
// formater, så alle kendetegns cel-skygger (højlys oppe til venstre, skygge nede til højre) passer til lyset.

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
interface Layout {
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
  mill: Place
  house: Place
  trees: (Place & { front: boolean })[]
  bushes: (Place & { front: boolean })[]
  garden: Place
  den: Place
  meadow: Place[]
  /** Dammen på mellembakken, hvor bækken springer ud (vandfaldets fod er bækkens første punkt). */
  pond: Place
  brook: Vec[]
  trail: Vec[]
  /** Hvor stien krydser bækken (broen), og broens drejning. */
  bridge: Place & { rot: number }
  /** Seværdighederne i mellemgrunden: andemor med ællinger, trædesten over bækken og skiltet med tallet. */
  ducks: Place & { kids: Vec[] }
  stones: Place & { rot: number }
  sign: Place
  /** Forgrundens hjørner (nederst til venstre og højre). */
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

/** Vandfaldets fod (bækkens første punkt) i forhold til dammens midte, i dammens lokale enheder. */
const FALL: Vec = [-7, 36]

/** Drejningen (grader) på tværs af bækken mellem to af dens punkter (til trædestenene). */
const across = (a: Vec, b: Vec) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI - 90

export function layoutOf(w: number, h: number): Layout {
  const wide = w >= h
  const on = (r: Ridge, u: number, dv: number, s: number) => ({ x: w * u, y: ridgeY(r, w, w * u) + h * dv, s })
  if (wide) {
    const k = clamp(Math.max(w / 1180, (h / 820) * 0.85), 0.6, 1.4)
    const far: Ridge = { base: h * 0.3, amp: h * 0.022, waves: 1.7, phase: 0.4 }
    const fields: Ridge = { base: h * 0.39, amp: h * 0.03, waves: 1.25, phase: 1.6 }
    const mid: Ridge = { base: h * 0.5, amp: h * 0.04, waves: 0.95, phase: 2.8 }
    const near: Ridge = { base: h * 0.77, amp: h * 0.03, waves: 0.8, phase: 4.4 }
    const house = on(mid, 0.655, 0.014, k * 1.05)
    const den = on(near, 0.925, 0.075, k * 1.1)
    const bridge = { x: w * 0.805, y: h * 0.725, s: k, rot: 14 }
    const pond = on(mid, 0.888, 0.052, k)
    const brook: Vec[] = [
      [pond.x + FALL[0] * k, pond.y + FALL[1] * k], [w * 0.852, h * 0.655], [bridge.x, bridge.y],
      [w * 0.79, h * 0.8], [w * 0.83, h * 0.9], [w * 0.8, h * 1.03],
    ]
    return {
      w, h, wide, k, far, fields, mid, near,
      sun: { x: w * 0.075, y: h * 0.2, s: k },
      clouds: [
        { x: w * 0.18, y: h * 0.12, s: k * 1.1 },
        { x: w * 0.5, y: h * 0.08, s: k * 0.8 },
        { x: w * 0.84, y: h * 0.17, s: k },
        { x: w * 0.36, y: h * 0.22, s: k * 0.6 },
      ],
      mill: on(far, 0.72, 0.012, k * 0.7),
      house,
      trees: [
        { ...on(mid, 0.028, 0.035, k * 1.1), front: false },
        { ...on(mid, 0.105, 0.052, k * 0.85), front: false },
        { ...on(mid, 0.585, 0.022, k * 0.78), front: false },
        { ...on(near, 0.05, 0.035, k * 1.28), front: true },
        { ...on(near, 0.988, 0.012, k * 1.12), front: true },
      ],
      bushes: [
        { ...on(mid, 0.068, 0.058, k * 0.9), front: false },
        { ...on(mid, 0.612, 0.03, k * 0.75), front: false },
        { ...on(near, 0.115, 0.06, k * 1.05), front: true },
        { ...on(near, 0.958, 0.11, k * 0.95), front: true },
      ],
      garden: { x: w * 0.105, y: h * 0.935, s: k * 1.05 },
      den,
      meadow: [
        { x: w * 0.125, y: h * 0.86, s: k * 0.9 },
        { x: w * 0.7, y: h * 0.925, s: k * 0.95 },
        { x: w * 0.962, y: h * 0.972, s: k * 1.05 },
      ],
      pond,
      brook,
      trail: [
        [house.x + 4 * house.s, house.y - 1], [w * 0.675, h * 0.605], [w * 0.735, h * 0.685], [bridge.x, bridge.y],
        [w * 0.865, h * 0.755], [den.x - 6 * den.s, den.y - 4 * den.s],
      ],
      bridge,
      // andemor med ællinger, der svømmer ned ad bækken (ællingerne bag hende, opstrøms)
      ducks: { x: w * 0.81, y: h * 0.862, s: k * 0.95, kids: [[-13, -8], [-22, -15], [-30, -22]] },
      stones: { x: w * 0.818, y: h * 0.95, s: k, rot: across(brook[4], brook[5]) },
      sign: { ...on(near, 0.872, 0.012, k * 0.95) },
      corners: [{ x: 0, y: h, s: k * 1.35 }, { x: w, y: h, s: k * 1.3 }],
    }
  }
  const k = clamp(Math.max(w / 560, (h / 1250) * 0.9), 0.7, 1.3)
  const far: Ridge = { base: h * 0.33, amp: h * 0.02, waves: 1.3, phase: 0.9 }
  const fields: Ridge = { base: h * 0.405, amp: h * 0.024, waves: 1.0, phase: 1.9 }
  const mid: Ridge = { base: h * 0.5, amp: h * 0.03, waves: 0.85, phase: 2.4 }
  const near: Ridge = { base: h * 0.735, amp: h * 0.026, waves: 0.7, phase: 4.0 }
  // huset står lavt nok til at ses under sidepanelet på en iPad på langs
  const house = on(mid, 0.8, 0.08, k * 0.95)
  const den = on(near, 0.83, 0.072, k)
  const bridge = { x: w * 0.68, y: h * 0.665, s: k * 0.9, rot: -24 }
  const pond = on(mid, 0.5, 0.042, k * 1.0)
  const brook: Vec[] = [
    [pond.x + FALL[0] * pond.s, pond.y + FALL[1] * pond.s], [w * 0.585, h * 0.605], [bridge.x, bridge.y],
    [w * 0.69, h * 0.76], [w * 0.63, h * 0.88], [w * 0.7, h * 1.03],
  ]
  return {
    w, h, wide, k, far, fields, mid, near,
    sun: { x: w * 0.17, y: h * 0.165, s: k },
    clouds: [
      { x: w * 0.52, y: h * 0.1, s: k * 1.05 },
      { x: w * 0.86, y: h * 0.17, s: k * 0.8 },
      { x: w * 0.36, y: h * 0.255, s: k * 0.6 },
    ],
    mill: on(far, 0.64, 0.01, k * 0.68),
    house,
    trees: [
      { ...on(mid, 0.06, 0.035, k * 1.0), front: false },
      { ...on(mid, 0.955, 0.04, k * 0.85), front: false },
      { ...on(near, 0.09, 0.035, k * 1.2), front: true },
      { ...on(near, 0.6, 0.012, k * 0.9), front: true },
    ],
    bushes: [
      { ...on(mid, 0.15, 0.05, k * 0.85), front: false },
      { ...on(near, 0.2, 0.06, k * 0.95), front: true },
      { ...on(near, 0.96, 0.1, k * 0.95), front: true },
    ],
    garden: { x: w * 0.27, y: h * 0.935, s: k },
    den,
    meadow: [
      { x: w * 0.9, y: h * 0.955, s: k },
      { x: w * 0.52, y: h * 0.97, s: k * 0.9 },
      { x: w * 0.1, y: h * 0.84, s: k * 0.9 },
    ],
    pond,
    brook,
    trail: [
      [house.x - 3 * house.s, house.y - 1], [w * 0.77, h * 0.607], [w * 0.715, h * 0.64], [bridge.x, bridge.y],
      [w * 0.72, h * 0.715], [den.x - 8 * den.s, den.y - 4 * den.s],
    ],
    bridge,
    // på dammen (bækken er smal i højformat)
    ducks: { x: pond.x + 6 * pond.s, y: pond.y + 4 * pond.s, s: pond.s * 0.72, kids: [[-15, 1], [-26, 2], [-36, 2.5]] },
    stones: { x: w * 0.668, y: h * 0.952, s: k, rot: across(brook[4], brook[5]) },
    sign: { ...on(near, 0.925, 0.008, k * 0.9) },
    corners: [{ x: 0, y: h, s: k * 1.5 }, { x: w, y: h, s: k * 1.45 }],
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
      {on && <path d={circle(x, y + 7 * s, 9.5 * s)} fill={ENG.lanternGlow} opacity={0.6} />}
      <path d={join(rect(x - 3.6 * s, y + 2 * s, 7.2 * s, 9.5 * s, 2.2 * s), rect(x - 2.4 * s, y - 0.6 * s, 4.8 * s, 2.8 * s, 1))} fill={on ? ENG.lantern : ENG.wallShade} stroke={ENG.lanternFrame} strokeWidth={1.3 * s} {...ROUND} />
    </>
  )
}

/** Sommerfugle: to par vinger om (x, y) med størrelse s (én path). */
function butterflies(pts: readonly (readonly [number, number, number])[]): string {
  return join(
    ...pts.flatMap(([x, y, s]) => [
      ellipse(x - 4 * s, y - 2 * s, 4.2 * s, 3.4 * s, -25), ellipse(x + 4 * s, y - 2 * s, 4.2 * s, 3.4 * s, 25),
      ellipse(x - 3 * s, y + 2.6 * s, 2.6 * s, 2.2 * s, 20), ellipse(x + 3 * s, y + 2.6 * s, 2.6 * s, 2.2 * s, -20),
    ]),
  )
}

/** Glimt: små firtakkede stjerner om (x, y) med radius r (én path). */
const glints = (pts: readonly (readonly [number, number, number])[]) => join(...pts.map(([x, y, r]) => star(x, y, r, r * 0.28, 4)))

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
 * Solens lys på en bakkekam (solen oppe til venstre): et kølig skyggebånd under de skrænter, der vender væk fra
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

/** Et rundt løvtræ: stamme, løvkrone med cel-skygge og højlys; blomster (sølv), lanterne (bronze). */
function Tree({ t, seed }: { t: RegionTier; seed: number }) {
  const c = paint(t)
  const crown = scallop(0, -52, 28, 25, 8, 0.62, -90 + seed * 17)
  const blossoms = [[-12, -60], [8, -67], [17, -49], [-4, -44], [-19, -47], [2, -56]].map(([x, y]) => circle(x, y, 2.7))
  return (
    <>
      <path d={blob([[-5.5, 0], [-4, -14], [-3.4, -30], [3.4, -30], [4, -14], [5.5, 0], [0, 1.5]], 0.6)} fill={c('trunk')} stroke={c('woodDark')} strokeWidth={SW} {...ROUND} />
      <g className="eng-sway" style={{ animationDelay: `${-seed * 1.7}s` }}>
        <path d={crown} fill={c('leaf')} stroke={c('leafDark')} strokeWidth={SW} {...ROUND} />
        <path d={lune(2, -50, 25, 22, 8, 15, 150)} fill={c('leafDark')} opacity={0.42} />
        <path d={ellipse(-10, -63, 8.5, 5, -28)} fill={c('leafLight')} opacity={0.9} />
        {bloom(t) && <path d={join(...blossoms)} fill={c('blossom')} />}
        {lit(t) && seed % 2 === 0 && <g>{lantern(17, -36, true, 0.9)}</g>}
      </g>
    </>
  )
}

/** En rund busk ved træerne (Tællelunden). */
function Bush({ t, seed }: { t: RegionTier; seed: number }) {
  const c = paint(t)
  return (
    <>
      <path d={scallop(0, -11, 19, 12, 7, 0.6, -80 + seed * 23)} fill={c('leaf')} stroke={c('leafDark')} strokeWidth={SW} {...ROUND} />
      <path d={lune(2, -10, 17, 10, 4.5, 20, 160)} fill={c('leafDark')} opacity={0.4} />
      {bloom(t) && <path d={join(circle(-8, -15, 2.4), circle(5, -18, 2.4), circle(12, -10, 2.4))} fill={c('flowerWhite')} />}
    </>
  )
}

/** Formhaven: en lav hæk med tre formklippede buske (kugle, kegle og terning) og et blomsterbed foran. */
function Garden({ t }: { t: RegionTier }) {
  const c = paint(t)
  const topiary = join(circle(-34, -33, 14), blob([[2, -62], [15, -22], [-11, -22]], 0.35), rect(23, -45, 24, 24, 5))
  const shade = join(lune(-32, -31, 12, 12, 5, 10, 150), lune(30, -27, 8, 9, 3.5, 20, 160))
  const fl = flowerPaths([[-46, 4, 4.4], [-30, 6, 3.8], [-14, 5, 4.4], [4, 6, 3.8], [20, 5, 4.4], [38, 6, 3.8], [52, 4, 4]])
  return (
    <>
      <path d={ellipse(10, 2, 70, 7)} fill={ENG.castShadow} opacity={0.2} />
      <path d={join(rect(-36, -20, 4, 8), rect(1, -22, 4, 8), rect(33, -22, 4, 8))} fill={c('trunk')} />
      <path d={topiary} fill={c('hedgeLight')} stroke={c('hedgeShade')} strokeWidth={SW} {...ROUND} />
      <path d={shade} fill={c('hedgeShade')} opacity={0.35} />
      <path d={rect(-62, -17, 124, 18, 9)} fill={c('hedge')} stroke={c('hedgeShade')} strokeWidth={SW} {...ROUND} />
      <path d={ellipse(-30, -13, 18, 2.6)} fill={c('hedgeLight')} opacity={0.7} />
      <path d={fl.petals} fill={c('flowerPink')} opacity={bloom(t) ? 1 : 0.75} />
      <path d={fl.hearts} fill={c('flowerHeart')} />
      {lit(t) && (
        <g>
          <path d={join(rect(-63.2, -38, 2.4, 22), rect(60.8, -38, 2.4, 22))} fill={c('woodDark')} />
          {lantern(-62, -40, true, 0.95)}
          {lantern(62, -40, true, 0.95)}
        </g>
      )}
      {lit(t) && <path d={butterflies(([[-8, -76, 1], [40, -66, 0.8], [-44, -60, 0.75]] as const).slice(0, rank(t)))} fill={c('butterfly2')} stroke={ENG.outline} strokeWidth={1} {...ROUND} />}
    </>
  )
}

/** Plusengen: en klynge engblomster og græs; flere blomster og sommerfugle jo længere regionen er nået. */
function Meadow({ t, seed }: { t: RegionTier; seed: number }) {
  const c = paint(t)
  const all: [number, number, number][] = [
    [-22, -6, 5.2], [-8, -14, 4.6], [6, -4, 5.4], [20, -12, 4.4], [32, -2, 4.8], [-34, -1, 4.2], [-14, 2, 4],
    [14, 4, 4.2], [-2, -24, 3.8], [26, -26, 3.6], [-28, -18, 3.6], [38, -16, 3.4],
  ].map(([x, y, r], i) => [x + ((seed * 7 + i * 3) % 5) - 2, y, r] as [number, number, number])
  const count = [3, 7, 10, 12][rank(t)]
  const yellow = flowerPaths(all.slice(0, count).filter((_, i) => i % 3 !== 2))
  const white = flowerPaths(all.slice(0, count).filter((_, i) => i % 3 === 2))
  return (
    <>
      <path d={grass([[-30, 4, 1.1], [-12, 6, 1.3], [8, 5, 1.2], [26, 6, 1.1], [40, 4, 0.9], [-42, 6, 0.9]])} fill={c('front')} stroke={c('frontDark')} strokeWidth={1.2} {...ROUND} />
      <path d={yellow.petals} fill={c('flowerYellow')} stroke={c('flowerHeart')} strokeWidth={0.9} {...ROUND} />
      <path d={white.petals} fill={ENG.flowerWhite} stroke={c('flowerViolet')} strokeWidth={0.9} {...ROUND} />
      <path d={join(yellow.hearts, white.hearts)} fill={c('flowerHeart')} />
      {lit(t) && <path d={butterflies(([[-10, -44, 1.1], [24, -52, 0.85], [6, -66, 0.75]] as const).slice(0, rank(t)))} fill={c('butterfly')} stroke={ENG.outline} strokeWidth={1} {...ROUND} />}
    </>
  )
}

/** Huset ved Tyvestien: hvide mure, rødt tag, bindingsværk, blå dør, vinduer (lyser fra bronze), skorsten med røg. */
function House({ t }: { t: RegionTier }) {
  const c = paint(t)
  return (
    <>
      {lit(t) && <path d={join(circle(23, -76, 4.6), circle(29, -86, 6), circle(38, -98, 7.6), circle(50, -108, 6.2))} fill={ENG.smoke} opacity={0.88} />}
      <path d={rect(15, -66, 9, 20, 2)} fill={c('roofShade')} stroke={c('timber')} strokeWidth={SW} {...ROUND} />
      <path d={rect(-28, -36, 56, 37, 3)} fill={c('wall')} stroke={c('timber')} strokeWidth={SW} {...ROUND} />
      <path d={rect(16, -36, 12, 37, 2)} fill={c('wallShade')} opacity={0.7} />
      <path d={join(poly([[-28, -20], [28, -20]], false), poly([[0, -36], [0, -22]], false))} fill="none" stroke={c('timber')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={blob([[-36, -32], [0, -68], [36, -32], [30, -29], [0, -58], [-30, -29]], 0.25)} fill={c('roof')} stroke={c('roofShade')} strokeWidth={SW} {...ROUND} />
      <path d={blob([[0, -58], [30, -29], [36, -32], [0, -68]], 0.25)} fill={c('roofShade')} opacity={0.5} />
      <path d={rect(-7, -19, 14, 20, 7)} fill={c('doorBlue')} stroke={c('timber')} strokeWidth={SW} {...ROUND} />
      <path d={join(rect(-22, -31, 11, 9, 2), rect(11, -31, 11, 9, 2))} fill={lit(t) ? c('windowLit') : c('window')} stroke={c('timber')} strokeWidth={SW * 0.8} {...ROUND} />
      {full(t) && <path d={join(poly([[-20, -36], [-13, -26], [-6, -36]]), poly([[6, -36], [13, -26], [20, -36]]))} fill={c('flowerPink')} />}
    </>
  )
}

/** Møllen på den fjerne bakke: hvidt tårn, rød hætte og fire vinger (står stille). */
function Mill({ chroma }: { chroma: number }) {
  const c = (k: EngColor) => tintBy(k, chroma)
  const blade: Vec[] = [[-3, -6], [-4, -40], [4, -40], [3, -6]]
  const sails = join(...[18, 108, 198, 288].map((a) => blob(xf(blade, { rot: a, dy: -50 }), 0.2)))
  return (
    <>
      <path d={blob([[-12, 0], [-9.5, -46], [9.5, -46], [12, 0]], 0.25)} fill={c('mill')} stroke={c('timber')} strokeWidth={SW} {...ROUND} />
      <path d={rect(4.5, -45, 6, 45, 2)} fill={c('millShade')} opacity={0.7} />
      <path d={ellipse(0, -48, 11.5, 7)} fill={c('roof')} stroke={c('roofShade')} strokeWidth={SW} {...ROUND} />
      <path d={join(rect(-4, -12, 8, 12, 4), circle(0, -30, 3.2))} fill={c('timber')} />
      <path d={sails} fill={c('sail')} stroke={c('timber')} strokeWidth={SW * 0.9} {...ROUND} />
      <path d={circle(0, -50, 3.6)} fill={c('roofShade')} />
    </>
  )
}

/** Tiervennernes hule: en græsbakke med en rund lilla dør i en stenkarm, et rundt vindue og en lanterne. */
function Den({ t }: { t: RegionTier }) {
  const c = paint(t)
  const mound = ridge([[-74, 0], [-66, -24], [-46, -44], [-14, -54], [18, -53], [48, -42], [66, -22], [74, 0]], 0.5, 0.9)
  const fl = flowerPaths([[-40, -42, 4], [-24, -50, 3.6], [30, -48, 4], [52, -36, 3.6]])
  const steps = join(ellipse(2, 6, 9, 3.2), ellipse(-8, 13, 10, 3.6), ellipse(4, 21, 11, 4))
  return (
    <>
      <path d={mound} fill={c('nearHill')} stroke={c('paperShadow')} strokeWidth={SW} {...ROUND} />
      <path d={lune(4, -6, 64, 46, 11, 0, 80)} fill={c('paperShadow')} opacity={0.22} />
      <path d={spline([[-62, -27], [-46, -43], [-20, -52]])} fill="none" stroke={ENG.sunlit} strokeWidth={3.2} opacity={0.8} {...ROUND} />
      <path d={grass([[-52, -32, 0.8], [-10, -52, 0.8], [40, -45, 0.8], [62, -22, 0.7], [-64, -14, 0.7]])} fill={c('front')} />
      <path d={steps} fill={c('stone')} stroke={c('stoneShade')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={rect(-21, -46, 42, 47, 21)} fill={c('stone')} stroke={c('stoneShade')} strokeWidth={SW} {...ROUND} />
      <path d={rect(-15, -40, 30, 41, 15)} fill={c('moundDoor')} stroke={c('moundDoorShade')} strokeWidth={SW} {...ROUND} />
      <path d={join(poly([[-5, -38], [-5, 0]], false), poly([[5, -38], [5, 0]], false))} fill="none" stroke={c('moundDoorShade')} strokeWidth={SW * 0.7} {...ROUND} />
      <path d={circle(9.5, -18, 2.6)} fill={c('lantern')} stroke={c('lanternFrame')} strokeWidth={1} />
      <path d={circle(44, -24, 8)} fill={lit(t) ? c('windowLit') : c('window')} stroke={c('stoneShade')} strokeWidth={SW * 1.4} />
      <path d={join(poly([[36, -24], [52, -24]], false), poly([[44, -32], [44, -16]], false))} fill="none" stroke={c('stoneShade')} strokeWidth={SW * 0.7} />
      <path d={rect(-36.5, -38, 2.6, 38)} fill={c('woodDark')} />
      {lantern(-35.2, -40, lit(t), 1)}
      {bloom(t) && <path d={fl.petals} fill={c('flowerViolet')} />}
      {full(t) && <path d={join(...[-16, -8, 0, 8, 16].map((x, i) => poly([[x - 4, -50 + Math.abs(i - 2) * 1.2], [x + 4, -50 + Math.abs(i - 2) * 1.2], [x, -43 + Math.abs(i - 2) * 1.2]])))} fill={c('flowerYellow')} stroke={c('moundDoorShade')} strokeWidth={0.9} {...ROUND} />}
    </>
  )
}

/** Broen over bækken (lokalt langs stien): en buet planke med to gelændere (bag og foran) og skygge på vandet. */
function Bridge({ t }: { t: RegionTier }) {
  const c = paint(t)
  const xs = [-27, -18, -9, 0, 9, 18, 27]
  const archY = (x: number) => -9 * (1 - (x / 30) ** 2)
  const deckTop = xs.map((x) => [x, archY(x) - 5] as Vec)
  const deckBot = xs.map((x) => [x, archY(x) + 6] as Vec)
  const rail = (dy: number) => join(spline(xs.map((x) => [x, archY(x) + dy - 11] as Vec)), ...[-27, -9, 9, 27].map((x) => poly([[x, archY(x) + dy - 11], [x, archY(x) + dy]], false)))
  return (
    <>
      <path d={ellipse(5, 11, 30, 6.5)} fill={ENG.castShadow} opacity={0.3} />
      <path d={rail(-5)} fill="none" stroke={c('woodDark')} strokeWidth={2.2} {...ROUND} />
      <path d={band(deckTop, deckBot)} fill={c('wood')} stroke={c('woodDark')} strokeWidth={SW} {...ROUND} />
      <path d={join(...[-18, -9, 0, 9, 18].map((x) => poly([[x, archY(x) - 4], [x, archY(x) + 5]], false)))} fill="none" stroke={c('woodDark')} strokeWidth={1.1} opacity={0.6} />
      <path d={spline(xs.slice(1, -1).map((x) => [x, archY(x) - 3.4] as Vec))} fill="none" stroke={ENG.sunlit} strokeWidth={1.6} opacity={0.75} {...ROUND} />
      <path d={rail(6)} fill="none" stroke={c('woodDark')} strokeWidth={2.4} {...ROUND} />
    </>
  )
}

/** Dammen på mellembakken (lokalt om midten): brink, vand, siv, åkander og vandfaldet ned til bækken. */
function Pond({ t }: { t: RegionTier }) {
  const c = paint(t)
  const [fx, fy] = FALL
  const fall = ribbon([[fx + 1, 9], [fx, (9 + fy) / 2], [fx, fy - 2]], [7, 8, 9.5])
  return (
    <>
      <path d={join(ellipse(0, 2.5, 47, 16.5), blob([[fx - 9, 8], [fx + 8, 8], [fx + 10, fy - 4], [fx - 11, fy - 4]], 0.6))} fill={c('bank')} />
      <path d={join(blob([[fx - 13, 14], [fx - 7, 11], [fx - 5, fy - 7], [fx - 15, fy - 3]], 0.7), blob([[fx + 6, 12], [fx + 13, 15], [fx + 14, fy - 3], [fx + 5, fy - 7]], 0.7))} fill={c('stone')} stroke={c('stoneShade')} strokeWidth={1.3} {...ROUND} />
      <path d={blob(fall, 0.9)} fill={c('water')} stroke={c('waterEdge')} strokeWidth={1.3} {...ROUND} />
      <path d={join(poly([[fx - 1.8, 12], [fx - 2, fy - 6]], false), poly([[fx + 2.2, 14], [fx + 2, fy - 8]], false))} fill="none" stroke={ENG.waterLight} strokeWidth={1.4} opacity={0.95} {...ROUND} />
      <path d={ellipse(0, 0, 41, 12.5)} fill={c('water')} stroke={c('waterEdge')} strokeWidth={1.5} {...ROUND} />
      <path d={join(ellipse(-13, -3.5, 15, 2.4), ellipse(14, 4, 7, 1.4))} fill={ENG.waterLight} opacity={0.85} />
      <path d={join(ellipse(17, -1, 6.5, 3, -8), ellipse(26, 3.5, 4.6, 2.2, 10))} fill={c('leaf')} stroke={c('leafDark')} strokeWidth={0.9} {...ROUND} />
      <path d={join(poly([[-38, 2], [-40, -20]], false), poly([[-34, 4], [-34, -24]], false), poly([[-30, 3], [-28, -17]], false))} fill="none" stroke={c('leafDark')} strokeWidth={1.4} {...ROUND} />
      <path d={join(capsule([-40, -21], [-40.4, -27], 1.9), capsule([-34, -25], [-34, -31], 1.9))} fill={c('trunk')} />
      <path d={join(circle(fx - 8, fy, 4.2), circle(fx, fy + 1.5, 5), circle(fx + 8, fy, 4.2))} fill={ENG.flowerWhite} opacity={0.92} />
      {bloom(t) && <path d={scallop(17, -3, 3.2, 3.2, 5, 0.66, -90)} fill={c('flowerPink')} />}
    </>
  )
}

/** Andemor med ællinger (lokalt; svømmer mod højre, ællingerne efter hende): én ælling mere for hvert trin. */
function Ducks({ t, offsets }: { t: RegionTier; offsets: readonly Vec[] }) {
  const c = paint(t)
  const kids = offsets.slice(0, rank(t))
  const duck = (x: number, y: number, s: number) => join(blob([[x - 9 * s, y], [x - 11 * s, y - 6 * s], [x - 4 * s, y - 5 * s], [x + 5 * s, y - 5 * s], [x + 8 * s, y - 1 * s], [x + 3 * s, y + 1.5 * s], [x - 6 * s, y + 1.5 * s]], 0.8), circle(x + 5.5 * s, y - 9 * s, 4.2 * s))
  const beak = (x: number, y: number, s: number) => blob([[x + 9 * s, y - 10 * s], [x + 14 * s, y - 9 * s], [x + 9 * s, y - 7.6 * s]], 0.4)
  const eye = (x: number, y: number, s: number) => circle(x + 6.5 * s, y - 10 * s, 0.9 * s)
  return (
    <>
      <path d={join(...[[0, 0, 1], ...kids.map(([x, y]) => [x, y, 0.58])].map(([x, y, s]) => spline([[x - 11 * s, y + 2.5], [x, y + 3.8], [x + 12 * s, y + 2.5]])))} fill="none" stroke={ENG.waterLight} strokeWidth={1.5} {...ROUND} />
      <path d={duck(0, 0, 1)} fill={ENG.flowerWhite} stroke={ENG.outline} strokeWidth={1.2} {...ROUND} />
      {kids.length > 0 && <path d={join(...kids.map(([x, y]) => duck(x, y, 0.58)))} fill={c('flowerYellow')} stroke={c('flowerHeart')} strokeWidth={1} {...ROUND} />}
      <path d={join(beak(0, 0, 1), ...kids.map(([x, y]) => beak(x, y, 0.58)))} fill={c('flowerHeart')} />
      <path d={join(eye(0, 0, 1), ...kids.map(([x, y]) => eye(x, y, 0.58)))} fill={ENG.outline} />
    </>
  )
}

/** Skiltet ved stien til hulen: en pæl og en pil med tallet 10 (tegnet som streger, ingen tekst). */
function Sign({ t }: { t: RegionTier }) {
  const c = paint(t)
  return (
    <>
      <path d={ellipse(6, 1, 12, 2.6)} fill={ENG.castShadow} opacity={0.22} />
      <path d={rect(-2, -30, 4, 31, 1.5)} fill={c('wood')} stroke={c('woodDark')} strokeWidth={1.3} {...ROUND} />
      <path d={poly([[-16, -45], [10, -45], [18, -36.5], [10, -28], [-16, -28]])} fill={ENG.signBoard} stroke={c('woodDark')} strokeWidth={1.6} {...ROUND} />
      <path d={join(poly([[-11, -39.5], [-8, -41.5], [-8, -31.5]], false), ellipse(2, -36.5, 3.8, 5))} fill="none" stroke={ENG.outline} strokeWidth={2} {...ROUND} />
    </>
  )
}

/** Trædesten over bækken (lokalt på tværs af den). */
function SteppingStones({ t }: { t: RegionTier }) {
  const c = paint(t)
  const xs = [-24, -8, 8, 24]
  return (
    <>
      <path d={join(...xs.map((x, i) => ellipse(x + 1.5, 2.2, 7 - (i % 2) * 0.8, 3.6)))} fill={c('stoneShade')} />
      <path d={join(...xs.map((x, i) => ellipse(x, 0, 7 - (i % 2) * 0.8, 3.8)))} fill={c('stone')} stroke={c('stoneShade')} strokeWidth={1.1} {...ROUND} />
    </>
  )
}

/** Et forgrundshjørne (lokalt fra hjørnet; spejles til højre): store blade, græs og blomster, der beskæres. */
function Corner({ t, mirror }: { t: RegionTier; mirror: boolean }) {
  const c = paint(t)
  const leaves = mirror
    ? [leaf(-6, 14, 104, 21, -76), leaf(-14, 8, 80, 17, -40), leaf(16, 18, 66, 14, -98)]
    : [leaf(-6, 12, 112, 22, -68), leaf(-16, 6, 84, 18, -36), leaf(14, 18, 72, 15, -96)]
  const fl: [number, number, number][] = (mirror
    ? [[40, -26, 10], [24, -70, 8.5], [58, -8, 8], [50, -50, 7]]
    : [[42, -30, 11], [60, -8, 9], [26, -76, 8.5], [56, -54, 7.5]]).slice(0, 1 + rank(t)) as [number, number, number][]
  const flowers = flowerPaths(fl)
  return (
    <g transform={mirror ? 'scale(-1 1)' : undefined}>
      <path d={grass([[10, 4, 2.4], [36, 6, 1.9], [62, 8, 1.4], [82, 8, 1.1]])} fill={c('front')} stroke={c('frontDark')} strokeWidth={1.3} {...ROUND} />
      <g className="eng-sway" style={{ animationDelay: mirror ? '-2.4s' : '-0.8s' }}>
        <path d={join(...leaves.map((l) => l.blade))} fill={c('fgLeaf')} stroke={c('fgLeafDark')} strokeWidth={1.8} {...ROUND} />
        <path d={join(...leaves.map((l) => l.rib))} fill="none" stroke={c('fgLeafLight')} strokeWidth={1.6} opacity={0.9} {...ROUND} />
      </g>
      <path d={flowers.petals} fill={mirror ? c('flowerViolet') : c('flowerPink')} stroke={ENG.outline} strokeWidth={1.1} {...ROUND} />
      <path d={flowers.hearts} fill={c('flowerYellow')} />
      {lit(t) && <path d={butterflies(([[78, -92, 1.1], [44, -112, 0.9]] as const).slice(0, rank(t) > 1 ? 2 : 1))} fill={mirror ? c('butterfly') : c('butterfly2')} stroke={ENG.outline} strokeWidth={1} {...ROUND} />}
    </g>
  )
}

/** En sky: fire runde puder og en flad bund, med en blå skygge forneden. */
const CLOUD = {
  body: join(circle(-22, -4, 14), circle(-4, -14, 18), circle(18, -8, 15), circle(32, 0, 10), rect(-36, -6, 78, 14, 7)),
  shade: ellipse(4, 5, 34, 4.5),
}

// ---------------------------------------------------------------------------------------------
// Hegnet: stolper langs stiens ene side, der stopper ved bækken (en stolpe på hver bred)

/** Afstanden fra (x, y) til bækkens vandkant (negativ i vandet), med bækkens bredde lagt lineært ud. */
function brookGap(brook: readonly Vec[], widths: readonly number[], x: number, y: number): number {
  let best = Infinity
  for (let i = 0; i < brook.length - 1; i++) {
    const [ax, ay] = brook[i]
    const [bx, by] = brook[i + 1]
    const dx = bx - ax
    const dy = by - ay
    const u = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1)
    const d = Math.hypot(x - ax - dx * u, y - ay - dy * u) - (widths[i] + (widths[i + 1] - widths[i]) * u) / 2
    best = Math.min(best, d)
  }
  return best
}

/**
 * Hegnets stolper i løb på land: langs stien fra punkt 1 hen til bækken (løbets sidste stolpe står på brinken)
 * og et kort stykke på den anden bred (en stolpe på brinken og én til), på den side af stien, der er tør.
 */
function fenceRuns(L: Layout, trailW: readonly number[], brookW: readonly number[]): Vec[][] {
  const K = L.k
  const side = L.wide ? -1 : 1
  const dry = (p: Vec) => brookGap(L.brook, brookW, p[0], p[1]) >= 7 * K
  const offsetOf = (i: number, sd: number) => (trailW[i] / 2 + 9 * K) * sd
  // hegnets linje: stiens punkter 1–3 (broen), forskudt til stiens ene side
  const line: Vec[] = L.trail.slice(1, 4).map((p, i, a) => {
    const q = L.trail[Math.min(i + 2, L.trail.length - 1)]
    const o = a[Math.max(i - 1, 0)]
    const dx = q[0] - o[0]
    const dy = q[1] - o[1]
    const l = Math.hypot(dx, dy) || 1
    const off = offsetOf(i + 1, side)
    return [p[0] + (-dy / l) * off, p[1] + (dx / l) * off] as Vec
  })
  // tæt prøvetagning langs linjen frem til det første vand
  const run: Vec[] = []
  outer: for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i]
    const [bx, by] = line[i + 1]
    const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / (2 * K)))
    for (let j = 0; j <= steps; j++) {
      const p: Vec = [ax + ((bx - ax) * j) / steps, ay + ((by - ay) * j) / steps]
      if (!dry(p)) break outer
      run.push(p)
    }
  }
  // stolper med jævn afstand; den sidste står altid ved brinken
  const spacing = 24 * K
  const near: Vec[] = run.length ? [run[0]] : []
  let acc = 0
  for (let i = 1; i < run.length; i++) {
    acc += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1])
    if (acc >= spacing) {
      near.push(run[i])
      acc = 0
    }
  }
  if (run.length > 1) {
    const last = run[run.length - 1]
    const tail = near[near.length - 1]
    if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > spacing * 0.45) near.push(last)
    else near[near.length - 1] = last
  }
  // den anden bred: fra broen langs stien, først på hegnets egen side, ellers på den anden
  const [b, q] = [L.trail[3], L.trail[4]]
  const l = Math.hypot(q[0] - b[0], q[1] - b[1]) || 1
  const [ux, uy] = [(q[0] - b[0]) / l, (q[1] - b[1]) / l]
  // bækkens retning ved broen: den anden bred er den side, stiens næste punkt ligger på
  const bi = L.brook.findIndex(([x, y]) => x === b[0] && y === b[1])
  const [p0, p1] = [L.brook[Math.max(0, bi - 1)], L.brook[Math.min(L.brook.length - 1, bi + 1)]]
  const sideOf = (p: Vec) => Math.sign((p1[0] - p0[0]) * (p[1] - b[1]) - (p1[1] - p0[1]) * (p[0] - b[0]))
  const farSide = sideOf(q)
  let far: Vec[] = []
  for (const sd of [side, -side]) {
    const off = offsetOf(3, sd)
    for (let t = 0; t < Math.min(l, 60 * K); t += 2 * K) {
      const p: Vec = [b[0] + ux * t - uy * off, b[1] + uy * t + ux * off]
      if (!dry(p) || sideOf(p) !== farSide) continue
      const next: Vec = [p[0] + ux * spacing, p[1] + uy * spacing]
      far = dry(next) ? [p, next] : [p]
      break
    }
    if (far.length) break
  }
  return [near, far].filter((r) => r.length > 0)
}

// ---------------------------------------------------------------------------------------------
// Scenen

export interface EngArtProps {
  w: number
  h: number
  tiers: Tiers
  className?: string
  svgRef?: Ref<SVGSVGElement>
}

/** Den rene tegning for en given plads (CSS-px). */
export function EngArt({ w, h, tiers, className, svgRef }: EngArtProps) {
  const sky = `${useId().replace(/[^A-Za-z0-9_-]/g, '')}sky`
  const L = layoutOf(w, h)
  const T = Object.fromEntries((Object.keys(ENG_REGIONS) as Mark[]).map((m) => [m, tierOf(tiers, m)])) as Record<Mark, RegionTier>
  // Bakkerne, himlen og møllen følger hele dalens fremgang (gennemsnittet af regionernes krom).
  const valley = Object.values(T).reduce((s, t) => s + TIER_CHROMA[t], 0) / 6
  const g = (c: EngColor) => tintBy(c, valley)
  const R = { far: ridgePts(L.far, w), fields: ridgePts(L.fields, w), mid: ridgePts(L.mid, w), near: ridgePts(L.near, w) }
  const K = L.k
  // Lag: papirkantens skygge, fladen, solens skygge- og lysbånd, det varme højlys på kammen og den lyse kant.
  const layer = (r: Ridge, pts: Vec[], color: EngColor, depth: number, shadeO: number) => {
    const light = ridgeLight(r, w, depth)
    return (
      <>
        <path d={ridge(xf(pts, { dy: -5 }), h + 40)} fill={ENG.paperShadow} opacity={0.13} />
        <path d={ridge(pts, h + 40)} fill={g(color)} />
        <path d={light.shade} fill={ENG.shade} opacity={shadeO} />
        <path d={light.glow} fill={ENG.sunlit} opacity={0.2} />
        <path d={spline(pts)} fill="none" stroke={ENG.rim} strokeWidth={2} opacity={0.5} {...ROUND} />
        <path d={light.crest} fill="none" stroke={ENG.sunlit} strokeWidth={3.2 * K} opacity={0.95} {...ROUND} />
      </>
    )
  }
  // Den fjerne trærække og læhegnene mellem markerne (Tællelunden i det fjerne).
  const farTrees = join(
    ...Array.from({ length: Math.round(w / 30) }, (_, i) => {
      const x = (i + 0.5) * (w / Math.round(w / 30))
      const r = (4.5 + ((i * 7) % 4)) * K
      return (i * 5) % 7 < 3 ? circle(x, ridgeY(L.far, w, x) - r * 0.55, r) : ''
    }),
  )
  const hedgerows = join(
    ...Array.from({ length: Math.round(w / 15) }, (_, i) => {
      const x = (i + 0.5) * (w / Math.round(w / 15))
      return (i % 9) < 4 ? circle(x, ridgeY(L.fields, w, x) + 16 * K, (2.6 + (i % 3) * 0.6) * K) : ''
    }),
  )
  // Markerne: brede, bløde bånd langs markbakken (lysere og mørkere striber).
  const fieldBands = [8, 30].map((dy) => spline(ridgePts(L.fields, w, dy * K)))
  // Spredte blomsterprikker på forgrunden (flere jo længere Plusengen er nået).
  const dots = { start: 12, bronze: 30, silver: 46, gold: 62 }[T.meadow]
  const spots = Array.from({ length: dots }, (_, i) => {
    const x = hash01(i) * w
    const top = ridgeY(L.near, w, x) + 14 * K
    return [x, top + hash01(i + 97) * Math.max(10, h - top - 40 * K), (1.6 + hash01(i + 31) * 1.2) * K] as const
  })
  // Tusindfryd på mellembakken (flere med Plusengen).
  const daisies = Array.from({ length: Math.round(dots * 0.5) }, (_, i) => {
    const x = hash01(i + 211) * w
    const top = ridgeY(L.mid, w, x) + 10 * K
    return [x, top + hash01(i + 307) * Math.max(8, ridgeY(L.near, w, x) - top - 14 * K), (1.3 + hash01(i + 401)) * K] as const
  })
  const tb = T.brook
  const tt = T.trail
  // Bækken bliver bredere nedstrøms; brinken er et mørkere bånd under vandet.
  const brookW = L.brook.map((_, i) => (5 + i * 7.5) * K)
  const trailW = L.trail.map((_, i) => (7 + i * 3.4) * K)
  const fence = fenceRuns(L, trailW, brookW)
  const postH = 16 * K
  const posts = fence.flat()
  // Bækkens sten langs bredden.
  const pebbles = join(...L.brook.slice(1, 5).map(([x, y], i) => ellipse(x + (brookW[i + 1] / 2 + 8 * K) * (i % 2 ? 1 : -1), y + 3 * K, 5 * K, 3 * K)))
  // Jordskygger (solen oppe til venstre: skyggen falder mod højre).
  const castMid = join(
    ellipse(L.house.x + 12 * L.house.s, L.house.y + 1.5 * L.house.s, 42 * L.house.s, 6.5 * L.house.s),
    ...L.trees.filter((p) => !p.front).map((p) => ellipse(p.x + 14 * p.s, p.y + 1.5 * p.s, 30 * p.s, 6 * p.s)),
    ...L.bushes.filter((p) => !p.front).map((p) => ellipse(p.x + 8 * p.s, p.y + 1 * p.s, 22 * p.s, 4.5 * p.s)),
  )
  const castNear = join(
    ellipse(L.den.x + 14 * L.den.s, L.den.y + 2 * L.den.s, 82 * L.den.s, 9 * L.den.s),
    ...L.trees.filter((p) => p.front).map((p) => ellipse(p.x + 14 * p.s, p.y + 1.5 * p.s, 30 * p.s, 6 * p.s)),
    ...L.bushes.filter((p) => p.front).map((p) => ellipse(p.x + 8 * p.s, p.y + 1 * p.s, 22 * p.s, 4.5 * p.s)),
  )
  // Små buske spredt i mellemgrunden (Tællelunden), så engen mellem kendetegnene ikke står flad og tom.
  const scatter = (L.wide ? [0.19, 0.255, 0.33, 0.4, 0.465, 0.535] : [0.24, 0.31, 0.385, 0.83]).map((u, i) => {
    const x = w * u + hash01(i + 501) * 14 * K
    const top = ridgeY(L.mid, w, x) + h * 0.05
    const y = top + hash01(i + 601) * Math.max(4, ridgeY(L.near, w, x) - top - h * 0.05)
    return [x, y, K * (0.75 + hash01(i + 701) * 0.4)] as const
  })
  const scrub = join(...scatter.map(([x, y, s]) => scallop(x, y - 6 * s, 11 * s, 7 * s, 5, 0.6, -80)))
  const scrubShade = join(...scatter.map(([x, y, s]) => join(lune(x + 1 * s, y - 5.5 * s, 10 * s, 6 * s, 2.8 * s, 20, 160), ellipse(x + 8 * s, y + 0.5 * s, 12 * s, 2.6 * s))))
  // Forgrundens græskant langs bunden (rammer dioramaet ind).
  const tufts = Array.from({ length: Math.ceil(w / (30 * K)) + 1 }, (_, i) => [i * 30 * K + hash01(i + 7) * 10 * K, h + 2, K * (0.9 + hash01(i + 3) * 0.6)] as const)
  // Regnbuen (guld i hele dalen) og glimtene (guld) i luften og på vandet.
  const bow = { x: w * 0.5, y: h * (L.wide ? 0.42 : 0.4), rx: L.wide ? w * 0.36 : w * 0.62, ry: h * (L.wide ? 0.3 : 0.2) }
  const air = (L.wide ? [[0.3, 0.16, 7], [0.58, 0.12, 5], [0.7, 0.27, 6], [0.16, 0.33, 5]] : [[0.3, 0.2, 6], [0.72, 0.27, 7], [0.12, 0.34, 5], [0.86, 0.36, 5]]).map(([u, v, r]) => [w * u, h * v, r * K] as const)
  const wet = L.brook.slice(1, 5).map(([x, y], i) => [x + (i % 2 ? 6 : -7) * K, y + 5 * K, (5 + i) * K] as const)
  return (
    <svg
      ref={svgRef}
      className={['eng-scene', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${n(w)} ${n(h)}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      data-scene="eng"
    >
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ENG.skyTop} />
          <stop offset="0.6" stopColor={ENG.skyBottom} />
        </linearGradient>
      </defs>
      <path d={rect(0, 0, w, h)} fill={`url(#${sky})`} />
      {/* sol (strålerne kommer igen med lyset) og skyer */}
      {at(L.sun, (
        <>
          <path d={circle(0, 0, 46)} fill={ENG.sunHalo} opacity={0.75} />
          {valley > 0.8 && <path d={join(...Array.from({ length: 10 }, (_, i) => blob(xf([[-4, -36], [0, -50], [4, -36]], { rot: i * 36 }), 0.4)))} fill={ENG.sun} opacity={0.75} />}
          <path d={circle(0, 0, 27)} fill={g('sun')} />
        </>
      ))}
      {/* regnbuen over dalen, når hele dalen er guld (fire flade striber) */}
      {valley >= 1 && (
        <g opacity={0.6}>
          {(['rainbow1', 'rainbow2', 'rainbow3', 'rainbow4'] as const).map((c, i) => (
            <path key={c} d={arc(bow.x, bow.y, bow.rx - i * 9 * K, bow.ry - i * 9 * K, 180, 360)} fill="none" stroke={ENG[c]} strokeWidth={9 * K} />
          ))}
        </g>
      )}
      {L.clouds.map((c, i) => (
        <g key={i} className={`eng-drift eng-drift-${i % 3}`}>
          {at(c, (
            <>
              <path d={CLOUD.body} fill={ENG.cloud} opacity={0.94} />
              <path d={CLOUD.shade} fill={ENG.cloudShade} opacity={0.85} />
            </>
          ))}
        </g>
      ))}
      {/* lag 1: de fjerne bakker med trærække og mølle */}
      {layer(L.far, R.far, 'farHill', h * 0.045, 0.09)}
      <path d={farTrees} fill={tint('farTree', T.grove)} />
      <path d={ellipse(L.mill.x + 10 * L.mill.s, L.mill.y + 1 * L.mill.s, 22 * L.mill.s, 4 * L.mill.s)} fill={ENG.castShadow} opacity={0.16} />
      {at(L.mill, <Mill chroma={valley} />)}
      {/* lag 2: markerne med læhegn */}
      {layer(L.fields, R.fields, 'fieldHill', h * 0.05, 0.1)}
      <path d={join(...fieldBands)} fill="none" stroke={g('field')} strokeWidth={12 * K} opacity={0.8} {...ROUND} />
      <path d={hedgerows} fill={tint('hedgerow', T.garden)} />
      {/* lag 3: mellembakken med tusindfryd, huset, de bageste træer og buske */}
      {layer(L.mid, R.mid, 'midHill', h * 0.11, 0.13)}
      <path d={join(...daisies.map(([x, y, r]) => circle(x, y, r)))} fill={ENG.flowerWhite} opacity={0.85} />
      <path d={castMid} fill={ENG.castShadow} opacity={0.22} />
      <path d={scrub} fill={tint('leaf', T.grove)} stroke={tint('leafDark', T.grove)} strokeWidth={1.2 * K} opacity={0.92} {...ROUND} />
      <path d={scrubShade} fill={ENG.castShadow} opacity={0.2} />
      {at(L.house, <House t={tt} />)}
      {L.trees.filter((p) => !p.front).map((p, i) => <g key={i}>{at(p, <Tree t={T.grove} seed={i} />)}</g>)}
      {L.bushes.filter((p) => !p.front).map((p, i) => <g key={i}>{at(p, <Bush t={T.grove} seed={i} />)}</g>)}
      {/* lag 4: forgrunden */}
      {layer(L.near, R.near, 'nearHill', h * 0.12, 0.15)}
      <path d={join(...spots.filter((_, i) => i % 2 === 0).map(([x, y, r]) => circle(x, y, r)))} fill={ENG.flowerWhite} opacity={0.9} />
      <path d={join(...spots.filter((_, i) => i % 2 === 1).map(([x, y, r]) => circle(x, y, r)))} fill={tint('flowerYellow', T.meadow)} />
      <path d={castNear} fill={ENG.castShadow} opacity={0.22} />
      {/* Tyvestien (lyser fra bronze) og hegnet, der stopper ved bækken */}
      <path d={blob(ribbon(L.trail, trailW), 0.9)} fill={tint('trail', tt)} stroke={tint('trailEdge', tt)} strokeWidth={1.6 * K} {...ROUND} />
      {lit(tt) && <path d={spline(L.trail)} fill="none" stroke={ENG.lanternGlow} strokeWidth={5 * K} opacity={0.75} {...ROUND} />}
      <path d={join(...posts.map(([x, y]) => rect(x - 2 * K, y - postH, 4 * K, postH, 1.5 * K)))} fill={tint('wood', tt)} stroke={tint('woodDark', tt)} strokeWidth={1.3 * K} {...ROUND} />
      <path d={join(...fence.filter((r) => r.length > 1).flatMap((r) => [spline(r.map(([x, y]) => [x, y - postH * 0.78] as Vec)), spline(r.map(([x, y]) => [x, y - postH * 0.38] as Vec))]))} fill="none" stroke={tint('woodDark', tt)} strokeWidth={1.8 * K} {...ROUND} />
      {lit(tt) && <g>{(fence[0] ?? []).filter((_, i, a) => i % 2 === 0 && i < a.length - 1).map(([x, y], i) => <g key={i}>{lantern(x, y - postH - 9 * K, true, K * 0.85)}</g>)}</g>}
      {bloom(tt) && (() => {
        const fl = flowerPaths((fence[0] ?? []).slice(0, -1).flatMap(([x, y], i) => [[x + 6 * K, y + 1, 3.4 * K], [x - 5 * K, y + 2, 3 * K + (i % 2) * 0.6 * K]] as [number, number, number][]))
        return (
          <>
            <path d={fl.petals} fill={tint('flowerPink', tt)} />
            <path d={fl.hearts} fill={tint('flowerHeart', tt)} />
          </>
        )
      })()}
      {/* Minusbækken: brinken, vandet (bredere nedstrøms), sten, dammen med vandfaldet, broen, ænderne og trædestenene */}
      <path d={blob(ribbon(L.brook, brookW.map((b) => b + 9 * K)), 0.9)} fill={tint('bank', tb)} />
      <path d={blob(ribbon(L.brook, brookW), 0.9)} fill={tint('water', tb)} stroke={tint('waterEdge', tb)} strokeWidth={1.6 * K} {...ROUND} />
      <path d={spline(xf(L.brook.slice(1), { dx: -3 * K }))} fill="none" stroke={ENG.waterLight} strokeWidth={2.6 * K} opacity={bloom(tb) ? 0.9 : 0.55} {...ROUND} />
      <path d={pebbles} fill={tint('stone', tb)} stroke={tint('stoneShade', tb)} strokeWidth={1.2 * K} />
      {at(L.pond, <Pond t={tb} />)}
      {at(L.stones, <g transform={`rotate(${n(L.stones.rot)})`}><SteppingStones t={tb} /></g>)}
      {at(L.ducks, <Ducks t={tb} offsets={L.ducks.kids} />)}
      {bloom(tb) && <path d={glints(wet)} fill={ENG.flowerWhite} />}
      {at(L.bridge, <g transform={`rotate(${L.bridge.rot})`}><Bridge t={tb} /></g>)}
      {/* forgrundens kendetegn */}
      {L.bushes.filter((p) => p.front).map((p, i) => <g key={i}>{at(p, <Bush t={T.grove} seed={i + 4} />)}</g>)}
      {L.trees.filter((p) => p.front).map((p, i) => <g key={i}>{at(p, <Tree t={T.grove} seed={i + 3} />)}</g>)}
      {at(L.sign, <Sign t={T.den} />)}
      {at(L.den, <Den t={T.den} />)}
      {at(L.garden, <Garden t={T.garden} />)}
      {L.meadow.map((p, i) => <g key={i}>{at(p, <Meadow t={T.meadow} seed={i} />)}</g>)}
      <path d={grass(tufts)} fill={tint('front', T.meadow)} stroke={tint('frontDark', T.meadow)} strokeWidth={1.2 * K} {...ROUND} />
      {at(L.corners[0], <Corner t={T.meadow} mirror={false} />)}
      {at(L.corners[1], <Corner t={T.grove} mirror />)}
      {/* fugle over lunden og glimt i luften (guld) */}
      {full(T.grove) && (
        <path
          d={join(...(L.wide ? [[0.2, 0.3], [0.235, 0.27], [0.62, 0.22]] : [[0.25, 0.3], [0.3, 0.28], [0.7, 0.32]]).map(([u, v]) => spline([[w * u - 6 * K, h * v - 3 * K], [w * u, h * v], [w * u + 6 * K, h * v - 3 * K]])))}
          fill="none"
          stroke={ENG.bird}
          strokeWidth={2 * K}
          {...ROUND}
        />
      )}
      {valley >= 1 && <path d={glints(air)} fill={ENG.sunHalo} stroke={ENG.lantern} strokeWidth={0.8 * K} {...ROUND} />}
    </svg>
  )
}

/** Kortets scene (MapSceneProps): måler sin plads og tegner Engdalen til netop den. */
export default function EngScene({ tiers, className }: MapSceneProps) {
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
  return <EngArt w={size.w} h={size.h} tiers={tiers} className={className} svgRef={ref} />
}
