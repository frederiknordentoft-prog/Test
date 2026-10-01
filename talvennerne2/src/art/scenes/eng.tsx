// Engdalen (verdenen `eng`): kortets baggrund – en lys, varm forårseng i papir-og-himmel-stilen, bygget som et
// diorama i fire lag (fjerne bakker med en mølle, marker med læhegn, mellembakken og forgrunden) med
// papirkanter: en blød skygge bag hvert lag og en lys kant langs toppen. Seks kendetegn står for Engdalens seks
// regioner, og hvert får sin farve igen efter regionens tier (SPEC §5.6):
//   træerne og buskene (Tællelunden) · haven med formklippede buske (Formhaven) · blomsterne (Plusengen) ·
//   stien med hegn og huset (Tyvestien) · bækken med broen (Minusbækken) · hulen i bakken (Tiervennernes hule).
// Start er dæmpet pastel (aldrig grå); bronze tænder lanterner og lader stien og vinduerne lyse; sølv bringer
// blomster, vand og lys tilbage; guld er fuld mætning med sommerfugle, fugle og flag. Bakkerne og himlen følger
// hele dalens fremgang.
// Scenen måler sin plads og lægger kendetegnene i kanterne, så kortets sti og trædesten i midten får ro: i
// bredformat i venstre strimmel, mellem stien og sidepanelet og under sidepanelet; i højformat i højre side og
// forneden. Kun skyerne driver og bladene svajer (transform); begge står stille i rolig tilstand og ved
// reduceret bevægelse. Alle former er husets parametriske primitiver; farverne kommer fra scenes/palette.ts.
import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import type { RegionId } from '../../engine/types'
import type { RegionTier } from '../../meta/rewards'
import type { MapSceneProps } from '../../ui/screens/child/map/Backdrop'
import { blob, circle, ellipse, fmt3, join, lune, n, poly, rect, ribbon, ridge, scallop, spline, star, xf } from '../rig/shapes'
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

/** Farvesæt for et kendetegn: grundfarverne tonet efter regionens tier. */
const paint = (t: RegionTier) => (c: EngColor) => tint(c, t)

/** Deterministisk "tilfældighed" (0–1) til spredte blomster og totter. */
const hash01 = (i: number) => {
  const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return v - Math.floor(v)
}

// ---------------------------------------------------------------------------------------------
// Layout: alt i skærmens CSS-px (viewBox = pladsen). Kendetegnene tegnes i lokale enheder om deres fodpunkt
// og skaleres med `k` (ca. 1 på en iPad på tværs, 0,7 på en telefon).

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
  brook: Vec[]
  trail: Vec[]
  /** Hvor stien krydser bækken (broen), og broens drejning. */
  bridge: Place & { rot: number }
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
      garden: { x: w * 0.09, y: h * 0.935, s: k * 1.1 },
      den,
      meadow: [
        { x: w * 0.125, y: h * 0.86, s: k * 0.9 },
        { x: w * 0.7, y: h * 0.925, s: k * 0.95 },
        { x: w * 0.962, y: h * 0.972, s: k * 1.05 },
      ],
      brook: [
        [w * 0.865, ridgeY(mid, w, w * 0.865) - 2], [w * 0.84, h * 0.585], [w * 0.8, h * 0.65], [bridge.x, bridge.y],
        [w * 0.79, h * 0.8], [w * 0.83, h * 0.9], [w * 0.8, h * 1.03],
      ],
      trail: [
        [house.x + 4 * house.s, house.y - 1], [w * 0.675, h * 0.605], [w * 0.735, h * 0.685], [bridge.x, bridge.y],
        [w * 0.865, h * 0.755], [den.x - 6 * den.s, den.y - 4 * den.s],
      ],
      bridge,
    }
  }
  const k = clamp(Math.max(w / 560, (h / 1250) * 0.9), 0.7, 1.3)
  const far: Ridge = { base: h * 0.33, amp: h * 0.02, waves: 1.3, phase: 0.9 }
  const fields: Ridge = { base: h * 0.405, amp: h * 0.024, waves: 1.0, phase: 1.9 }
  const mid: Ridge = { base: h * 0.5, amp: h * 0.03, waves: 0.85, phase: 2.4 }
  const near: Ridge = { base: h * 0.735, amp: h * 0.026, waves: 0.7, phase: 4.0 }
  const house = on(mid, 0.79, 0.012, k * 0.95)
  const den = on(near, 0.83, 0.072, k)
  const bridge = { x: w * 0.68, y: h * 0.665, s: k * 0.9, rot: -24 }
  return {
    w, h, wide, k, far, fields, mid, near,
    sun: { x: w * 0.8, y: h * 0.2, s: k },
    clouds: [
      { x: w * 0.2, y: h * 0.13, s: k * 1.05 },
      { x: w * 0.66, y: h * 0.1, s: k * 0.8 },
      { x: w * 0.42, y: h * 0.26, s: k * 0.6 },
    ],
    mill: on(far, 0.2, 0.01, k * 0.68),
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
    garden: { x: w * 0.25, y: h * 0.935, s: k },
    den,
    meadow: [
      { x: w * 0.9, y: h * 0.955, s: k },
      { x: w * 0.52, y: h * 0.97, s: k * 0.9 },
      { x: w * 0.1, y: h * 0.84, s: k * 0.9 },
    ],
    brook: [
      [w * 0.5, ridgeY(mid, w, w * 0.5) - 2], [w * 0.56, h * 0.575], [w * 0.63, h * 0.625], [bridge.x, bridge.y],
      [w * 0.69, h * 0.76], [w * 0.63, h * 0.88], [w * 0.7, h * 1.03],
    ],
    trail: [
      [house.x - 3 * house.s, house.y - 1], [w * 0.76, h * 0.575], [w * 0.7, h * 0.625], [bridge.x, bridge.y],
      [w * 0.72, h * 0.715], [den.x - 8 * den.s, den.y - 4 * den.s],
    ],
    bridge,
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
      {full(t) && <path d={butterflies([[-8, -76, 1], [40, -66, 0.8]])} fill={c('butterfly2')} stroke={ENG.outline} strokeWidth={1} {...ROUND} />}
    </>
  )
}

/** Plusengen: en klynge engblomster og græs; flere blomster jo længere regionen er nået. */
function Meadow({ t, seed }: { t: RegionTier; seed: number }) {
  const c = paint(t)
  const all: [number, number, number][] = [
    [-22, -6, 5.2], [-8, -14, 4.6], [6, -4, 5.4], [20, -12, 4.4], [32, -2, 4.8], [-34, -1, 4.2], [-14, 2, 4],
    [14, 4, 4.2], [-2, -24, 3.8], [26, -26, 3.6],
  ].map(([x, y, r], i) => [x + ((seed * 7 + i * 3) % 5) - 2, y, r] as [number, number, number])
  const count = t === 'start' ? 4 : t === 'bronze' ? 6 : t === 'silver' ? 8 : 10
  const yellow = flowerPaths(all.slice(0, count).filter((_, i) => i % 3 !== 2))
  const white = flowerPaths(all.slice(0, count).filter((_, i) => i % 3 === 2))
  return (
    <>
      <path d={grass([[-30, 4, 1.1], [-12, 6, 1.3], [8, 5, 1.2], [26, 6, 1.1], [40, 4, 0.9], [-42, 6, 0.9]])} fill={c('front')} stroke={c('frontDark')} strokeWidth={1.2} {...ROUND} />
      <path d={yellow.petals} fill={c('flowerYellow')} stroke={c('flowerHeart')} strokeWidth={0.9} {...ROUND} />
      <path d={white.petals} fill={ENG.flowerWhite} stroke={c('flowerViolet')} strokeWidth={0.9} {...ROUND} />
      <path d={join(yellow.hearts, white.hearts)} fill={c('flowerHeart')} />
      {full(t) && <path d={butterflies([[-10, -44, 1.1], [24, -52, 0.85]])} fill={c('butterfly')} stroke={ENG.outline} strokeWidth={1} {...ROUND} />}
    </>
  )
}

/** Huset ved Tyvestien: hvide mure, rødt tag, bindingsværk, blå dør, vinduer (lyser fra bronze) og skorsten. */
function House({ t }: { t: RegionTier }) {
  const c = paint(t)
  return (
    <>
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

/** Broen over bækken (lokalt langs stien): planker og et lille gelænder. */
function Bridge({ t }: { t: RegionTier }) {
  const c = paint(t)
  return (
    <>
      <path d={rect(-24, -7, 48, 14, 4)} fill={c('wood')} stroke={c('woodDark')} strokeWidth={SW} {...ROUND} />
      <path d={join(...[-14, -4, 6, 16].map((x) => poly([[x, -6], [x, 6]], false)))} fill="none" stroke={c('woodDark')} strokeWidth={1.1} opacity={0.7} />
      <path d={join(poly([[-22, -7], [-22, -17]], false), poly([[22, -7], [22, -17]], false), poly([[-23, -15], [23, -15]], false))} fill="none" stroke={c('woodDark')} strokeWidth={2.2} {...ROUND} />
    </>
  )
}

/** En sky: fire runde puder og en flad bund, med en blå skygge forneden. */
const CLOUD = {
  body: join(circle(-22, -4, 14), circle(-4, -14, 18), circle(18, -8, 15), circle(32, 0, 10), rect(-36, -6, 78, 14, 7)),
  shade: ellipse(4, 5, 34, 4.5),
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
  const L = layoutOf(w, h)
  const T = Object.fromEntries((Object.keys(ENG_REGIONS) as Mark[]).map((m) => [m, tierOf(tiers, m)])) as Record<Mark, RegionTier>
  // Bakkerne, himlen og møllen følger hele dalens fremgang (gennemsnittet af regionernes krom).
  const valley = Object.values(T).reduce((s, t) => s + TIER_CHROMA[t], 0) / 6
  const g = (c: EngColor) => tintBy(c, valley)
  const R = { far: ridgePts(L.far, w), fields: ridgePts(L.fields, w), mid: ridgePts(L.mid, w), near: ridgePts(L.near, w) }
  const layer = (pts: Vec[], color: EngColor) => (
    <>
      <path d={ridge(xf(pts, { dy: -5 }), h + 40)} fill={ENG.paperShadow} opacity={0.13} />
      <path d={ridge(pts, h + 40)} fill={g(color)} />
      <path d={spline(pts)} fill="none" stroke={ENG.rim} strokeWidth={2.4} opacity={0.75} {...ROUND} />
    </>
  )
  const K = L.k
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
  const dots = { start: 14, bronze: 26, silver: 42, gold: 58 }[T.meadow]
  const spots = Array.from({ length: dots }, (_, i) => {
    const x = hash01(i) * w
    const top = ridgeY(L.near, w, x) + 14 * K
    return [x, top + hash01(i + 97) * Math.max(10, h - top - 40 * K), (1.6 + hash01(i + 31) * 1.2) * K] as const
  })
  const tb = T.brook
  const tt = T.trail
  const brookW = L.brook.map((_, i) => (4 + i * 6.5) * K)
  const trailW = L.trail.map((_, i) => (7 + i * 3.4) * K)
  // Hegnet langs stien (stolper på stiens ene side, to rafter).
  const fence = L.trail.slice(1, 4).flatMap((p, i) => {
    const q = L.trail[i + 2] ?? p
    const dx = q[0] - p[0]
    const dy = q[1] - p[1]
    const l = Math.hypot(dx, dy) || 1
    const off = (trailW[i + 1] / 2 + 9 * K) * (L.wide ? -1 : 1)
    return [0, 0.5].map((u) => [p[0] + dx * u + (-dy / l) * off, p[1] + dy * u + (dx / l) * off] as Vec)
  })
  const postH = 16 * K
  // Bækkens sten langs bredden.
  const pebbles = join(...L.brook.slice(2, 6).map(([x, y], i) => ellipse(x + (brookW[i + 2] / 2 + 5 * K) * (i % 2 ? 1 : -1), y + 3 * K, 5 * K, 3 * K)))
  // Forgrundens græskant langs bunden (rammer dioramaet ind).
  const tufts = Array.from({ length: Math.ceil(w / (30 * K)) + 1 }, (_, i) => [i * 30 * K + hash01(i + 7) * 10 * K, h + 2, K * (0.9 + hash01(i + 3) * 0.6)] as const)
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
        <linearGradient id="eng-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ENG.skyTop} />
          <stop offset="0.6" stopColor={ENG.skyBottom} />
        </linearGradient>
      </defs>
      <path d={rect(0, 0, w, h)} fill="url(#eng-sky)" />
      {/* sol (strålerne kommer igen med lyset) og skyer */}
      {at(L.sun, (
        <>
          <path d={circle(0, 0, 46)} fill={ENG.sunHalo} opacity={0.75} />
          {valley > 0.8 && <path d={join(...Array.from({ length: 10 }, (_, i) => blob(xf([[-4, -36], [0, -50], [4, -36]], { rot: i * 36 }), 0.4)))} fill={ENG.sun} opacity={0.75} />}
          <path d={circle(0, 0, 27)} fill={g('sun')} />
        </>
      ))}
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
      {layer(R.far, 'farHill')}
      <path d={farTrees} fill={tint('farTree', T.grove)} />
      {at(L.mill, <Mill chroma={valley} />)}
      {/* lag 2: markerne med læhegn */}
      {layer(R.fields, 'fieldHill')}
      <path d={join(...fieldBands)} fill="none" stroke={g('field')} strokeWidth={12 * K} opacity={0.8} {...ROUND} />
      <path d={hedgerows} fill={tint('hedgerow', T.garden)} />
      {/* lag 3: mellembakken med huset, de bageste træer og buske */}
      {layer(R.mid, 'midHill')}
      {at(L.house, <House t={tt} />)}
      {L.trees.filter((p) => !p.front).map((p, i) => <g key={i}>{at(p, <Tree t={T.grove} seed={i} />)}</g>)}
      {L.bushes.filter((p) => !p.front).map((p, i) => <g key={i}>{at(p, <Bush t={T.grove} seed={i} />)}</g>)}
      {/* lag 4: forgrunden */}
      {layer(R.near, 'nearHill')}
      <path d={join(...spots.filter((_, i) => i % 2 === 0).map(([x, y, r]) => circle(x, y, r)))} fill={ENG.flowerWhite} opacity={0.9} />
      <path d={join(...spots.filter((_, i) => i % 2 === 1).map(([x, y, r]) => circle(x, y, r)))} fill={tint('flowerYellow', T.meadow)} />
      {/* Tyvestien (lyser fra bronze) og hegnet */}
      <path d={blob(ribbon(L.trail, trailW), 0.9)} fill={tint('trail', tt)} stroke={tint('trailEdge', tt)} strokeWidth={1.6 * K} {...ROUND} />
      {lit(tt) && <path d={spline(L.trail)} fill="none" stroke={ENG.lanternGlow} strokeWidth={5 * K} opacity={0.75} {...ROUND} />}
      <path d={join(...fence.map(([x, y]) => rect(x - 2 * K, y - postH, 4 * K, postH, 1.5 * K)))} fill={tint('wood', tt)} stroke={tint('woodDark', tt)} strokeWidth={1.3 * K} {...ROUND} />
      <path d={join(spline(fence.map(([x, y]) => [x, y - postH * 0.78] as Vec)), spline(fence.map(([x, y]) => [x, y - postH * 0.38] as Vec)))} fill="none" stroke={tint('woodDark', tt)} strokeWidth={1.8 * K} {...ROUND} />
      {lit(tt) && <g>{fence.filter((_, i) => i % 2 === 0).map(([x, y], i) => <g key={i}>{lantern(x, y - postH - 9 * K, true, K * 0.85)}</g>)}</g>}
      {/* Minusbækken med sten og broen */}
      <path d={blob(ribbon(L.brook, brookW), 0.9)} fill={tint('water', tb)} stroke={tint('waterEdge', tb)} strokeWidth={1.6 * K} {...ROUND} />
      <path d={spline(xf(L.brook.slice(1), { dx: -3 * K }))} fill="none" stroke={ENG.waterLight} strokeWidth={2.6 * K} opacity={bloom(tb) ? 0.9 : 0.55} {...ROUND} />
      <path d={pebbles} fill={tint('stone', tb)} stroke={tint('stoneShade', tb)} strokeWidth={1.2 * K} />
      {bloom(tb) && <path d={join(...L.brook.slice(2, 6).map(([x, y], i) => star(x + (i % 2 ? 5 : -6) * K, y + 4 * K, (4 + i) * K, K, 4)))} fill={ENG.flowerWhite} />}
      {at(L.bridge, <g transform={`rotate(${L.bridge.rot})`}><Bridge t={tb} /></g>)}
      {/* forgrundens kendetegn */}
      {L.bushes.filter((p) => p.front).map((p, i) => <g key={i}>{at(p, <Bush t={T.grove} seed={i + 4} />)}</g>)}
      {L.trees.filter((p) => p.front).map((p, i) => <g key={i}>{at(p, <Tree t={T.grove} seed={i + 3} />)}</g>)}
      {at(L.den, <Den t={T.den} />)}
      {at(L.garden, <Garden t={T.garden} />)}
      {L.meadow.map((p, i) => <g key={i}>{at(p, <Meadow t={T.meadow} seed={i} />)}</g>)}
      <path d={grass(tufts)} fill={tint('front', T.meadow)} stroke={tint('frontDark', T.meadow)} strokeWidth={1.2 * K} {...ROUND} />
      {/* fugle over lunden (guld) */}
      {full(T.grove) && (
        <path
          d={join(...(L.wide ? [[0.2, 0.3], [0.235, 0.27], [0.62, 0.22]] : [[0.25, 0.3], [0.3, 0.28], [0.7, 0.32]]).map(([u, v]) => spline([[w * u - 6 * K, h * v - 3 * K], [w * u, h * v], [w * u + 6 * K, h * v - 3 * K]])))}
          fill="none"
          stroke={ENG.bird}
          strokeWidth={2 * K}
          {...ROUND}
        />
      )}
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
