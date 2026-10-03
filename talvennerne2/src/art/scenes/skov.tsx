// Regnbueskoven (verdenen `skov`): kortets baggrund – en lys eventyrskov med høje, bløde trækroner, lysninger med
// regnbuelys, svampe, en sø og et vandfald, et trin op fra Hestebakkerne: mere magisk og lidt dybere, men stadig
// papir og himmel. Scenen er bygget som et diorama i fire lag (fjerne, blålilla skovbakker, skovbakken med de høje
// kroner, engen ved søen og forgrunden) med papirkanter: en blød skygge bag hvert lag og en lys kant langs toppen.
// Lagene står i luftperspektiv (kølige og lyse langt væk, varme og mættede forrest), og solen oppe til venstre
// giver blødt retningslys: varmt højlys på de skrænter og flader, der vender mod den, kølig skygge på de andre og
// jordskygger, der falder mod højre under alt, der står på jorden. Lysstråler i regnbuens farver falder skråt
// ned i lysningerne fra samme side.
// Otte kendetegn står for Regnbueskovens otte regioner, og hvert får sin farve igen efter regionens tier (SPEC §5.6):
//   et trappebjerg med tre trin og et flag på toppen (Stortalsbjerget) · søen med vandmøllen og ti små sten ved
//   siden af én stor (Vekselvandet) · grotten i skrænten med krystaller i tre rækker af fire og pandaen ved
//   bambussen (Gangegrotten) · tårnets spir med et ur, der viser kvartererne, over trætoppene (Urtårnets top) ·
//   gården med købmandsboden, markisen, skiltet med mønten og egernene på grenen (Købmandsgården) · broen med ti
//   buer og to gelændere over åen (Hundredebroen) · stien med pæle i stigende højde og centimeterstreger og uglen
//   i træhullet (Linealstien) · haven med hække klippet som kugle, terning, kegle og cylinder og et spejlsymmetrisk
//   bed (Figurhaven).
// Start er dæmpet pastel (aldrig grå), og uglen blunder; bronze tænder lys i lygter, lygtepæle og vinduer, sender
// røg op fra gården, lader krystallerne gløde og vækker uglen; sølv bringer flere blomster, sommerfugle, et egern
// mere og vand, der glimter; guld er fuld mætning med vimpler og fugle – og en regnbue over skoven
// (Regnbuelysningen), når hele verdenen er guld. Bakkerne, skoven, himlen og regnbuelyset følger hele verdenens
// fremgang. En svampekreds på engen og buske mellem kendetegnene fylder mellemgrunden.
// Vandet løber nedad fra en kilde: det springer ud af en kløft i bjergets fod, falder ned ad skrænten og fodrer
// søen; åen løber fra søens udløb forbi møllehjulet, under Hundredebroen og ud af billedet, bredere og bredere med
// mørkere brinker. Mølleengens hegn stopper ved åen med en stolpe på brinken. Store blade, bregner og svampe i de
// nederste hjørner rammer dioramaet ind.
// Scenen måler sin plads og lægger kendetegnene der, hvor kortets panel ikke dækker: i bredformat i venstre
// strimmel, mellem stien og sidepanelet og under sidepanelet; i højformat i højre side og forneden (på en telefon
// i båndet over kortet). Kun skyerne driver, bladene svajer, lysstrålerne ånder og egernenes haler vipper
// (transform og opacity); alt står stille i rolig tilstand og ved reduceret bevægelse. Alle former er husets
// parametriske primitiver; farverne kommer fra scenes/palette.ts.
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import type { RegionId } from '../../engine/types'
import type { RegionTier } from '../../meta/rewards'
import type { MapSceneProps } from '../../ui/screens/child/map/Backdrop'
import { arc, arcPts, blob, capsule, circle, ellipse, fmt3, join, lune, n, poly, rect, ribbon, ridge, scallop, spline, star, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import { SKOV, TIER_CHROMA, tintSkov, tintSkovBy } from './palette'
import type { SkovColor } from './palette'
import './skov.css'

// ---------------------------------------------------------------------------------------------
// Regionerne og deres kendetegn

export const SKOV_REGIONS = {
  mountain: 'w2-tal1000',
  lake: 'w2-veksling',
  cave: 'w2-gange',
  tower: 'w2-klokken',
  farm: 'w2-penge',
  bridge: 'w2-hundreder',
  ruler: 'w2-maal-data',
  garden: 'w2-figurer',
} as const satisfies Record<string, RegionId>
type Mark = keyof typeof SKOV_REGIONS
type Tiers = MapSceneProps['tiers']

const tierOf = (tiers: Tiers, mark: Mark): RegionTier => tiers[SKOV_REGIONS[mark]] ?? 'start'
const lit = (t: RegionTier) => t !== 'start'
const bloom = (t: RegionTier) => t === 'silver' || t === 'gold'
const full = (t: RegionTier) => t === 'gold'
/** Trinnet som tal (start 0, bronze 1, sølv 2, guld 3). */
const rank = (t: RegionTier) => (t === 'start' ? 0 : t === 'bronze' ? 1 : t === 'silver' ? 2 : 3)

/** Farvesæt for et kendetegn: grundfarverne tonet efter regionens tier. */
const paint = (t: RegionTier) => (c: SkovColor) => tintSkov(c, t)

/** Deterministisk "tilfældighed" (0–1) til spredte blomster, kroner og totter. */
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
export interface Layout {
  w: number
  h: number
  wide: boolean
  k: number
  far: Ridge
  mid: Ridge
  near: Ridge
  sun: Place
  clouds: Place[]
  mountain: Place
  /** Vandfaldet: fra kløften i bjergets fod (top) ned ad skrænten i søen (bund). */
  fall: { x: number; top: number; bottom: number; s: number }
  lake: { x: number; y: number; rx: number; ry: number }
  mill: Place
  /** Åen fra søens udløb (første punkt) nedad under broen og ud af billedet. */
  stream: Vec[]
  bridge: Place
  tower: Place
  cave: Place
  panda: Place
  farm: Place
  /** Egernenes træ (grenen stikker mod højre fra stammen). */
  squirrels: Place & { flip: boolean }
  owl: Place
  /** Linealstien: stien og pælene (fra den laveste til den højeste). */
  trail: Vec[]
  trailW: number[]
  /** Stiens punkter, hvor en lygtepæl står (tændes fra bronze). */
  lamps: number[]
  posts: Place
  garden: Place
  /** Mølleengens hegn: fra den tørre ende mod åen (det stopper på brinken). */
  fence: [Vec, Vec]
  /** Lysningerne, hvor regnbuelyset falder (stråler oppe fra venstre ned mod punktet). */
  glades: Place[]
  /** Lundene på skovbakken (u-intervaller), hvor den forreste række kroner står, og hvor langt nede den står. */
  groves: [number, number][]
  groveDy: number
  /** Buske spredt på engen (u), så forgrunden mellem kendetegnene ikke står flad. */
  scrub: number[]
  /** Fritstående løvtræer (forrest = på forgrundens bakke). */
  trees: (Place & { front: boolean })[]
  /** Svampekredsen på engen (en heksering af små svampe). */
  ring: Place
  /** Blomsterklynger på engen. */
  meadow: Place[]
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

/** Søens nederste bred ved x (åens udløb ligger dér). */
const lakeBottom = (lake: Layout['lake'], x: number) => lake.y + lake.ry * Math.sqrt(Math.max(0, 1 - ((x - lake.x) / lake.rx) ** 2))

export function layoutOf(w: number, h: number): Layout {
  const wide = w >= h
  const on = (r: Ridge, u: number, dv: number, s: number) => ({ x: w * u, y: ridgeY(r, w, w * u) + h * dv, s })
  if (wide) {
    const k = clamp(Math.max(w / 1180, (h / 820) * 0.85), 0.6, 1.4)
    const far: Ridge = { base: h * 0.335, amp: h * 0.022, waves: 1.4, phase: 0.7 }
    const mid: Ridge = { base: h * 0.52, amp: h * 0.03, waves: 1.0, phase: 2.3 }
    const near: Ridge = { base: h * 0.765, amp: h * 0.02, waves: 0.8, phase: 4.1 }
    const lake = { x: w * 0.775, y: h * 0.75, rx: 118 * k, ry: 27 * k }
    const mountain = on(mid, 0.655, -0.014, k * 1.12)
    const out: Vec = [w * 0.85, lakeBottom(lake, w * 0.85) - 2 * k]
    const bridge = { x: w * 0.852, y: h * 0.905, s: k }
    return {
      w, h, wide, k, far, mid, near,
      sun: { x: w * 0.09, y: h * 0.16, s: k },
      clouds: [
        { x: w * 0.24, y: h * 0.1, s: k * 1.05 },
        { x: w * 0.5, y: h * 0.06, s: k * 0.8 },
        { x: w * 0.4, y: h * 0.21, s: k * 0.6 },
      ],
      mountain,
      fall: { x: w * 0.695, top: mountain.y + 6 * k, bottom: lake.y - lake.ry * 0.45, s: k },
      lake,
      mill: { x: out[0] + 22 * k, y: out[1] + 12 * k, s: k * 0.9 },
      stream: [out, [w * 0.862, h * 0.83], [bridge.x, bridge.y], [w * 0.842, h * 0.975], [w * 0.835, h * 1.06]],
      bridge,
      tower: { x: w * 0.07, y: h * 0.47, s: k * 0.95 },
      cave: { x: w * 0.088, y: h * 0.655, s: k * 0.9 },
      panda: { x: w * 0.026, y: h * 0.69, s: k * 1.1 },
      farm: { x: w * 0.068, y: h * 0.865, s: k * 0.85 },
      squirrels: { x: w * 0.995, y: h * 0.86, s: k, flip: true },
      owl: { x: w * 0.624, y: h * 0.835, s: k * 0.95 },
      trail: [[w * 0.705, h * 1.03], [w * 0.735, h * 0.955], [w * 0.775, h * 0.918], [bridge.x - 70 * k, bridge.y], [bridge.x + 70 * k, bridge.y], [w * 0.94, h * 0.888], [w * 1.02, h * 0.875]],
      trailW: [18, 15, 12, 10, 10, 9, 8],
      lamps: [1, 2, 5],
      posts: { x: w * 0.722, y: h * 0.975, s: k * 1.2 },
      garden: { x: w * 0.2, y: h * 0.955, s: k * 0.98 },
      fence: [[w * 1.02, h * 0.825], [w * 0.86, h * 0.83]],
      glades: [{ x: w * 0.74, y: h * 0.7, s: k }, { x: w * 0.09, y: h * 0.62, s: k * 0.8 }],
      groves: [[0.14, 0.6], [0.86, 1.02]],
      groveDy: 0.075,
      scrub: [0.2, 0.31, 0.42, 0.53],
      trees: [
        { ...on(mid, 0.6, 0.085, k * 0.95), front: false },
        { ...on(near, 0.13, 0.02, k * 0.9), front: true },
      ],
      ring: { x: w * 0.752, y: h * 0.82, s: k },
      meadow: [{ x: w * 0.28, y: h * 0.86, s: k }, { x: w * 0.46, y: h * 0.93, s: k * 1.1 }],
      corners: [{ x: 0, y: h, s: k * 0.95 }, { x: w, y: h, s: k * 0.9 }],
    }
  }
  // en telefon (høj og smal) viser scenen i båndet over kortet og gennem kortets lyse panel
  const tall = h / w > 1.7
  if (tall) {
    const k = clamp(Math.max(w / 560, (h / 1250) * 0.9), 0.62, 1)
    const far: Ridge = { base: h * 0.43, amp: h * 0.014, waves: 1.2, phase: 0.8 }
    const mid: Ridge = { base: h * 0.645, amp: h * 0.016, waves: 0.9, phase: 2.4 }
    const near: Ridge = { base: h * 0.81, amp: h * 0.018, waves: 0.7, phase: 4.1 }
    const lake = { x: w * 0.5, y: h * 0.712, rx: 112 * k, ry: 22 * k }
    // bjergets top og flag står i båndet mellem regionens overskrift og kortets panel
    const mountain = { ...on(mid, 0.2, -0.004, k * 0.95), x: w * 0.2 }
    const out: Vec = [w * 0.66, lakeBottom(lake, w * 0.66) - 2 * k]
    const bridge = { x: w * 0.69, y: h * 0.81, s: k * 0.9 }
    return {
      w, h, wide, k, far, mid, near,
      sun: { x: w * 0.14, y: h * 0.13, s: k },
      clouds: [
        { x: w * 0.55, y: h * 0.07, s: k },
        { x: w * 0.9, y: h * 0.17, s: k * 0.8 },
        { x: w * 0.3, y: h * 0.23, s: k * 0.6 },
      ],
      mountain,
      fall: { x: w * 0.31, top: mountain.y + 6 * k, bottom: lake.y - lake.ry * 0.4, s: k },
      lake,
      mill: { x: out[0] + 22 * k, y: out[1] + 12 * k, s: k * 0.9 },
      stream: [out, [w * 0.7, h * 0.76], [bridge.x, bridge.y], [w * 0.67, h * 0.9], [w * 0.66, h * 1.03]],
      bridge,
      tower: { x: w * 0.885, y: h * 0.635, s: k },
      cave: { x: w * 0.84, y: h * 0.775, s: k * 0.85 },
      panda: { x: w * 0.93, y: h * 0.79, s: k * 0.85 },
      farm: { x: w * 0.17, y: h * 0.86, s: k * 0.8 },
      squirrels: { x: w * 0.005, y: h * 0.84, s: k * 0.85, flip: false },
      owl: { x: w * 0.06, y: h * 0.745, s: k * 0.9 },
      trail: [[w * 0.38, h * 1.03], [w * 0.45, h * 0.92], [w * 0.55, h * 0.84], [bridge.x - 66 * k, bridge.y], [bridge.x + 66 * k, bridge.y], [w * 0.92, h * 0.8], [w * 1.03, h * 0.79]],
      trailW: [16, 13, 11, 10, 10, 9, 8],
      lamps: [1, 2, 5],
      posts: { x: w * 0.38, y: h * 0.955, s: k },
      garden: { x: w * 0.36, y: h * 0.775, s: k * 0.8 },
      fence: [[w * 1.03, h * 0.765], [w * 0.6, h * 0.778]],
      glades: [{ x: w * 0.55, y: h * 0.62, s: k }],
      groves: [[0, 0.62]],
      groveDy: 0.05,
      scrub: [0.2, 0.55],
      trees: [
        { ...on(mid, 0.6, 0.07, k), front: false },
        { ...on(near, 0.95, 0.03, k), front: true },
      ],
      ring: { x: w * 0.8, y: h * 0.93, s: k },
      meadow: [{ x: w * 0.3, y: h * 0.96, s: k * 0.9 }],
      corners: [{ x: 0, y: h, s: k * 0.85 }, { x: w, y: h, s: k * 0.85 }],
    }
  }
  // iPad på langs: kendetegnene i højre side (under sidepanelet) og forneden
  const k = clamp(w / 860, 0.7, 1.05)
  const far: Ridge = { base: h * 0.5, amp: h * 0.012, waves: 1.3, phase: 0.8 }
  const mid: Ridge = { base: h * 0.665, amp: h * 0.016, waves: 0.85, phase: 2.5 }
  const near: Ridge = { base: h * 0.835, amp: h * 0.016, waves: 0.7, phase: 4.1 }
  const lake = { x: w * 0.765, y: h * 0.77, rx: 132 * k, ry: 26 * k }
  const mountain = { x: w * 0.855, y: h * 0.652, s: k * 1.0 }
  const out: Vec = [w * 0.795, lakeBottom(lake, w * 0.795) - 2 * k]
  const bridge = { x: w * 0.8, y: h * 0.872, s: k * 0.95 }
  return {
    w, h, wide, k, far, mid, near,
    sun: { x: w * 0.16, y: h * 0.14, s: k },
    clouds: [
      { x: w * 0.5, y: h * 0.08, s: k * 1.05 },
      { x: w * 0.86, y: h * 0.16, s: k * 0.8 },
      { x: w * 0.3, y: h * 0.24, s: k * 0.6 },
    ],
    mountain,
    fall: { x: w * 0.89, top: mountain.y + 6 * k, bottom: lake.y - lake.ry * 0.3, s: k * 0.9 },
    lake,
    mill: { x: out[0] + 22 * k, y: out[1] + 12 * k, s: k * 0.9 },
    stream: [out, [w * 0.815, h * 0.825], [bridge.x, bridge.y], [w * 0.782, h * 0.95], [w * 0.772, h * 1.04]],
    bridge,
    tower: { x: w * 0.655, y: h * 0.668, s: k * 0.88 },
    cave: { x: w * 0.64, y: h * 0.858, s: k * 0.82 },
    panda: { x: w * 0.592, y: h * 0.875, s: k * 0.85 },
    farm: { x: w * 0.1, y: h * 0.935, s: k * 0.8 },
    squirrels: { x: w * 0.005, y: h * 0.905, s: k * 0.85, flip: false },
    owl: { x: w * 0.53, y: h * 0.918, s: k * 0.8 },
    trail: [[w * 0.36, h * 1.03], [w * 0.45, h * 0.905], [w * 0.62, h * 0.885], [bridge.x - 70 * k, bridge.y], [bridge.x + 70 * k, bridge.y], [w * 0.93, h * 0.86], [w * 1.03, h * 0.85]],
    trailW: [16, 13, 11, 10, 10, 9, 8],
    lamps: [1, 5],
    posts: { x: w * 0.4, y: h * 0.9, s: k * 0.9 },
    garden: { x: w * 0.905, y: h * 0.955, s: k * 0.72 },
    fence: [[w * 1.03, h * 0.82], [w * 0.86, h * 0.83]],
    glades: [{ x: w * 0.72, y: h * 0.72, s: k }],
    groves: [[0, 0.57]],
    groveDy: 0.06,
    scrub: [0.12, 0.27, 0.42],
    trees: [
      { ...on(near, 0.99, 0.02, k), front: true },
    ],
    ring: { x: w * 0.28, y: h * 0.9, s: k },
    meadow: [{ x: w * 0.3, y: h * 0.96, s: k * 0.9 }],
    corners: [{ x: 0, y: h, s: k * 0.8 }, { x: w, y: h, s: k * 0.75 }],
  }
}

// ---------------------------------------------------------------------------------------------
// Små hjælpere

const at = (p: Place, node: ReactNode) => <g transform={`translate(${n(p.x)} ${n(p.y)}) scale(${fmt3(p.s)})`}>{node}</g>
const ROUND = { strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
/** Konturbredde i lokale enheder (en tynd, farvet kontur som dyrenes, men lettere). */
const SW = 1.9
/**
 * Jordskyggerne falder væk fra solen oppe til venstre: forskudt mod højre og ned (px ved k = 1, eller lokale
 * enheder), så de ikke ligger lige under tingene (review G2-r2 §5.4, lys).
 */
export const SHADOW_SHIFT: Vec = [4.5, 3]

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

/** Tændte lanterner (lokalt om krogene, fra bronze): glas, ramme og bløde glorier – to paths for dem alle. */
function lanterns(pts: readonly (readonly [number, number])[], s = 1): ReactNode {
  return (
    <>
      <path d={join(...pts.map(([x, y]) => circle(x, y + 7 * s, 12 * s)))} fill={SKOV.lanternGlow} opacity={0.7} />
      <path d={join(...pts.map(([x, y]) => join(rect(x - 3.6 * s, y + 2 * s, 7.2 * s, 9.5 * s, 2.2 * s), rect(x - 2.4 * s, y - 0.6 * s, 4.8 * s, 2.8 * s, 1))))} fill={SKOV.lantern} stroke={SKOV.lanternFrame} strokeWidth={1.3 * s} {...ROUND} />
    </>
  )
}

/** Røg fra en skorsten (x, y): fire bløde puder, der stiger mod højre (vinden følger lyset). */
const smoke = (x: number, y: number, s: number) => join(circle(x, y - 4 * s, 3.6 * s), circle(x + 4 * s, y - 12 * s, 4.8 * s), circle(x + 11 * s, y - 21 * s, 6 * s), circle(x + 21 * s, y - 28 * s, 5 * s))

/** Glimt: små firtakkede stjerner om (x, y) med radius r (én path). */
const glints = (pts: readonly (readonly [number, number, number])[]) => join(...pts.map(([x, y, r]) => star(x, y, r, r * 0.28, 4)))

/** Fugle: små buer om (x, y) med størrelse s (én path). */
const birds = (pts: readonly (readonly [number, number, number])[]) =>
  join(...pts.map(([x, y, s]) => spline([[x - 6 * s, y - 3 * s], [x, y], [x + 6 * s, y - 3 * s]])))

/** Sommerfugle: to par runde vinger om (x, y) med størrelse s (én path). */
const butterflies = (pts: readonly (readonly [number, number, number])[]) =>
  join(...pts.flatMap(([x, y, s]) => [ellipse(x - 2.6 * s, y - 1.6 * s, 2.6 * s, 3.2 * s, -30), ellipse(x + 2.6 * s, y - 1.6 * s, 2.6 * s, 3.2 * s, 30), ellipse(x - 1.8 * s, y + 2 * s, 1.7 * s, 2 * s, 20), ellipse(x + 1.8 * s, y + 2 * s, 1.7 * s, 2 * s, -20)]))

/** Et lille flag på en stang fra (x, y) og op (lokalt): stangen og dugen. */
const flag = (x: number, y: number, hgt: number, s = 1) => ({
  pole: rect(x - 0.9 * s, y - hgt, 1.8 * s, hgt, 0.9 * s),
  cloth: blob([[x + 0.8 * s, y - hgt + 0.5 * s], [x + 15 * s, y - hgt + 4.5 * s], [x + 0.8 * s, y - hgt + 9.5 * s]], 0.35),
})

/** Vimpler (små trekanter) langs en linje fra a til b (lokalt), skiftevis to farver. */
function bunting(a: Vec, b: Vec, count: number, sag: number, size = 1) {
  const pts = Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + sag * 4 * t * (1 - t)] as Vec
  })
  const tri = ([x, y]: Vec) => poly([[x - 3.4 * size, y], [x + 3.4 * size, y], [x, y + 6.5 * size]])
  return {
    line: spline([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag], b]),
    even: join(...pts.filter((_, i) => i % 2 === 0).map(tri)),
    odd: join(...pts.filter((_, i) => i % 2 === 1).map(tri)),
  }
}

/** Vimpler tegnet (en eller flere snore): snor og trekanter i to farver – tre paths i alt. */
function Bunting({ b, c, a = 'flag', z = 'flowerYellow' }: { b: readonly ReturnType<typeof bunting>[]; c: (k: SkovColor) => string; a?: SkovColor; z?: SkovColor }) {
  return (
    <>
      <path d={join(...b.map((x) => x.line))} fill="none" stroke={c('timber')} strokeWidth={0.9} />
      <path d={join(...b.map((x) => x.even))} fill={c(a)} />
      <path d={join(...b.map((x) => x.odd))} fill={c(z)} />
    </>
  )
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

/** En bregne (lokalt fra roden langs +x, drejet `rot`): små, spidse småblade på begge sider af stilken. */
function fern(x: number, y: number, len: number, rot: number) {
  const o = { rot, dx: x, dy: y }
  const pinnae = Array.from({ length: 7 }, (_, i) => {
    const t = 0.18 + i * 0.12
    const l = len * 0.24 * (1 - t * 0.7)
    const px = len * t
    return [
      blob(xf([[px, 0], [px + l * 0.35, -l * 0.55], [px + l * 0.8, -l * 0.95], [px + l * 0.55, -l * 0.35]], o), 0.6),
      blob(xf([[px, 0], [px + l * 0.35, l * 0.55], [px + l * 0.8, l * 0.95], [px + l * 0.55, l * 0.35]], o), 0.6),
    ]
  }).flat()
  return { leaves: join(...pinnae, blob(xf([[len * 0.95, 0], [len * 1.08, -1.8], [len * 1.12, 0], [len * 1.08, 1.8]], o), 0.6)), stem: spline(xf([[0, 0], [len * 0.5, -len * 0.02], [len * 1.05, 0]], o)) }
}

/** En kagekile (cirkeludsnit) fra vinkel a0 til a1 (grader, 0 = højre, 90 = ned), som polygon. */
const wedge = (cx: number, cy: number, r: number, a0: number, a1: number) => poly([[cx, cy], ...arcPts(cx, cy, r, r, a0, a1, 7)])

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
    // skyggesiden begynder lige efter toppen og dækker hele skrænten ned mod dalen (review G2-r2 §5.4)
    const away = clamp(-f * 1.6 + 0.25, 0, 1)
    const toward = clamp(f * 1.5 - 0.1, 0, 1)
    top.push([x, y])
    shade.push([x, y + depth * 1.6 * away * away * (3 - 2 * away)])
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

/** Et højt løvtræ med en blød, høj krone (cel-skygge og højlys); blomster i kronen fra sølv. */
function Tree({ t, seed, hue = 'crownGreen' }: { t: RegionTier; seed: number; hue?: SkovColor }) {
  const c = paint(t)
  const blossoms = [[-10, -78], [8, -86], [15, -64], [-4, -58], [-15, -66], [3, -72]].map(([x, y]) => circle(x, y, 2.6))
  return (
    <>
      <path d={blob([[-6, 0], [-4.5, -16], [-3.6, -40], [3.6, -40], [4.5, -16], [6, 0], [0, 1.5]], 0.6)} fill={c('trunk')} stroke={c('trunkDark')} strokeWidth={SW} {...ROUND} />
      <g className="skov-sway" style={{ animationDelay: `${-seed * 1.9}s` }}>
        <path d={scallop(0, -70, 25, 36, 9, 0.6, -90 + seed * 13)} fill={c(hue)} stroke={c('leafDark')} strokeWidth={SW} {...ROUND} />
        <path d={lune(2, -68, 22, 33, 9, 15, 150)} fill={c('leafDark')} opacity={0.38} />
        <path d={ellipse(-9, -86, 7, 11, -22)} fill={c('leafLight')} opacity={0.85} />
        {bloom(t) && <path d={join(...blossoms)} fill={c('flowerPink')} />}
      </g>
    </>
  )
}

/**
 * Stortalsbjerget: et højdedrag af lys sten med tre tydelige trin – et stort (hundreder), et mellem (tiere) og et
 * lille (enere) – med mos på hvert trin og et flag på toppen. Solen fra venstre: højlys på trinenes venstre kanter,
 * skygge på højre sider. Lanterne ved flaget fra bronze, blomster på trinene fra sølv, vimpler og fugle i guld.
 */
export const MOUNTAIN_STEPS = 3
function Mountain({ t }: { t: RegionTier }) {
  const c = paint(t)
  const steps = [
    { x0: -84, x1: 84, top: -50, base: 2 },
    { x0: -54, x1: 52, top: -94, base: -46 },
    { x0: -26, x1: 22, top: -128, base: -90 },
  ]
  const block = ({ x0, x1, top, base }: (typeof steps)[number]) =>
    blob([[x0, base], [x0 + 1.5, top + 12], [x0 + 8, top], [x1 - 8, top], [x1 - 1.5, top + 12], [x1, base], [(x0 + x1) / 2, base + 2]], 0.5)
  const cap = ({ x0, x1, top }: (typeof steps)[number]) =>
    blob([[x0 + 3, top + 8], [x0 + 9, top - 1.5], [x1 - 9, top - 1.5], [x1 - 3, top + 8], [x1 - 14, top + 11], [(x0 + x1) / 2, top + 9], [x0 + 14, top + 12]], 0.6)
  const side = ({ x1, top, base }: (typeof steps)[number]) => blob([[x1 - 16, top + 8], [x1 - 5, top + 6], [x1, base], [x1 - 20, base]], 0.4)
  const f = flag(-2, -128, 34, 1.2)
  const fl = flowerPaths([[-70, -46, 3.4], [-40, -50, 3], [60, -48, 3.2], [-44, -91, 3], [30, -92, 3], [-14, -126, 2.6]])
  const b = bunting([-1, -158], [80, -52], 7, 10)
  return (
    <>
      <path d={join(...steps.map(block))} fill={c('rock')} stroke={c('rockShade')} strokeWidth={SW} {...ROUND} />
      <path d={join(...steps.map(side))} fill={c('rockShade')} opacity={0.5} />
      {/* trinenes kanter: lyse sten mod solen, mørke streger i fronten */}
      <path d={join(...steps.map(({ x0, top, base }) => spline([[x0 + 2, base - 4], [x0 + 2.5, top + 12], [x0 + 9, top + 3]])))} fill="none" stroke={SKOV.sunlit} strokeWidth={3} opacity={0.85} {...ROUND} />
      <path d={join(...steps.map(cap))} fill={c('moss')} stroke={c('mossDark')} strokeWidth={1.4} {...ROUND} />
      <path d={join(...steps.map(({ x0, x1, top }) => ellipse(x0 + (x1 - x0) * 0.3, top + 3, (x1 - x0) * 0.14, 1.8)))} fill={c('leafLight')} opacity={0.8} />
      <path d={f.pole} fill={c('timber')} />
      <path d={f.cloth} fill={c('flag')} stroke={c('awningShade')} strokeWidth={1} {...ROUND} />
      {lit(t) && lanterns([[14, -144]], 0.9)}
      {lit(t) && <path d={rect(13.2, -142, 1.6, 14, 0.8)} fill={c('woodDark')} />}
      {bloom(t) && (
        <>
          <path d={fl.petals} fill={c('flowerYellow')} />
          <path d={fl.hearts} fill={c('flowerHeart')} />
        </>
      )}
      {full(t) && (
        <>
          <Bunting b={[b]} c={c} a="flag2" />
          <path d={birds([[-46, -150, 1.1], [-30, -164, 0.9], [44, -150, 1]])} fill="none" stroke={SKOV.bird} strokeWidth={1.8} {...ROUND} />
        </>
      )}
    </>
  )
}

/**
 * Vandfaldet (scenens koordinater): kilden springer ud af en kløft i skrænten lige under bjergets fod og falder
 * ned ad en bred skrænt af sten (afsatser, mos og to små træer på kanten) i søen; skum og dis forneden. Solen fra
 * venstre: skrænten står i skygge på højre side. Vandet glimter fra sølv.
 */
function Waterfall({ fall, t }: { fall: Layout['fall']; t: RegionTier }) {
  const c = paint(t)
  const { x, top, bottom, s } = fall
  const hgt = bottom - top
  const yAt = (q: number) => top + hgt * q
  const cliff = blob([
    [x - 50 * s, top + 8 * s], [x - 26 * s, top - 4 * s], [x + 2 * s, top - 7 * s], [x + 30 * s, top - 3 * s], [x + 52 * s, top + 10 * s],
    [x + 60 * s, yAt(0.5)], [x + 74 * s, bottom + 5 * s], [x - 76 * s, bottom + 5 * s], [x - 62 * s, yAt(0.45)],
  ], 0.6)
  const shadeR = blob([[x + 20 * s, top - 4 * s], [x + 52 * s, top + 10 * s], [x + 60 * s, yAt(0.5)], [x + 74 * s, bottom + 5 * s], [x + 26 * s, bottom + 3 * s], [x + 22 * s, yAt(0.5)]], 0.6)
  const ledges = join(
    spline([[x - 56 * s, yAt(0.34)], [x - 34 * s, yAt(0.31)], [x - 15 * s, yAt(0.35)]]),
    spline([[x + 17 * s, yAt(0.56)], [x + 38 * s, yAt(0.53)], [x + 60 * s, yAt(0.58)]]),
    spline([[x - 66 * s, yAt(0.72)], [x - 40 * s, yAt(0.69)], [x - 18 * s, yAt(0.73)]]),
  )
  const moss = join(
    scallop(x - 30 * s, top - 2 * s, 22 * s, 7 * s, 7, 0.6, -90), scallop(x + 30 * s, top + 1 * s, 22 * s, 7 * s, 7, 0.6, -90),
    scallop(x - 40 * s, yAt(0.33), 12 * s, 5 * s, 5, 0.6, -90), scallop(x + 42 * s, yAt(0.55), 12 * s, 5 * s, 5, 0.6, -90),
  )
  const water = blob(ribbon([[x, top], [x + 1.5 * s, yAt(0.35)], [x + 0.5 * s, yAt(0.7)], [x, bottom]], [12 * s, 16 * s, 21 * s, 27 * s]), 0.9)
  const streaks = join(...[-5, 0.5, 5.5].map((dx, i) => spline([[x + dx * s, top + (6 + i * 9) * s], [x + (dx + 0.8) * s, yAt(0.5)], [x + dx * 1.35 * s, bottom - (10 + i * 6) * s]])))
  return (
    <>
      <path d={cliff} fill={c('rock')} stroke={c('rockShade')} strokeWidth={1.6 * s} {...ROUND} />
      <path d={shadeR} fill={c('rockShade')} opacity={0.42} />
      <path d={ledges} fill="none" stroke={c('rockShade')} strokeWidth={1.6 * s} opacity={0.8} {...ROUND} />
      <path d={spline([[x - 60 * s, yAt(0.4)], [x - 48 * s, top + 10 * s], [x - 26 * s, top]])} fill="none" stroke={SKOV.sunlit} strokeWidth={3 * s} opacity={0.8} {...ROUND} />
      <path d={moss} fill={c('moss')} stroke={c('mossDark')} strokeWidth={1.2 * s} {...ROUND} />
      <path d={ellipse(x, top + 1 * s, 8 * s, 4.5 * s)} fill={c('cave')} opacity={0.75} />
      <path d={water} fill={c('water')} stroke={c('waterEdge')} strokeWidth={1.3 * s} {...ROUND} />
      <path d={streaks} fill="none" stroke={SKOV.waterLight} strokeWidth={1.7 * s} opacity={bloom(t) ? 0.95 : 0.7} {...ROUND} />
      <path d={join(scallop(x, bottom, 22 * s, 7 * s, 7, 0.6, -90), circle(x - 20 * s, bottom - 7 * s, 5 * s), circle(x + 21 * s, bottom - 9 * s, 6 * s))} fill={SKOV.foam} opacity={0.88} />
      {bloom(t) && <path d={glints([[x - 11 * s, bottom - 16 * s, 3.6 * s], [x + 7 * s, yAt(0.3), 2.8 * s]])} fill={SKOV.flowerWhite} />}
    </>
  )
}

/**
 * Vekselvandet: søen med mørkere bred, lyse striber og – i vandet – ti små sten i to rækker af fem ved siden af
 * én stor sten (ti små for én stor). Åkander fra sølv; glimt i vandet fra sølv.
 */
export const SMALL_STONES = 10
function Lake({ lake, t, k }: { lake: Layout['lake']; t: RegionTier; k: number }) {
  const c = paint(t)
  const { x, y, rx, ry } = lake
  // ti små sten (to rækker af fem) og én stor sten lidt til højre
  const small = Array.from({ length: SMALL_STONES }, (_, i) => [x - rx * 0.12 - 50 * k + (i % 5) * 11 * k + (i >= 5 ? 4 * k : 0), y - 4 * k + (i >= 5 ? 9 * k : 0), 4.4 * k] as const)
  const big = [x + rx * 0.12 + 14 * k, y + 1 * k, 14 * k] as const
  const stones = [...small, big]
  const lilies = join(...[[x - rx * 0.66, y + ry * 0.2], [x - rx * 0.56, y - ry * 0.25], [x + rx * 0.56, y - ry * 0.1]].map(([lx, ly]) => ellipseCut(lx, ly, 6 * k, 2.6 * k)))
  const lf = flowerPaths([[x - rx * 0.66, y + ry * 0.12, 2.2 * k], [x + rx * 0.56, y - ry * 0.18, 2.2 * k]])
  return (
    <>
      <path d={ellipse(x, y + 3 * k, rx + 9 * k, ry + 6 * k)} fill={c('bank')} />
      <path d={ellipse(x, y, rx, ry)} fill={c('water')} stroke={c('waterEdge')} strokeWidth={1.5 * k} />
      <path d={join(ellipse(x - rx * 0.1, y - ry * 0.55, rx * 0.55, ry * 0.12), ellipse(x + rx * 0.45, y + ry * 0.45, rx * 0.25, ry * 0.08))} fill={SKOV.waterLight} opacity={bloom(t) ? 0.9 : 0.6} />
      {/* ringe i vandet om stenene og stenene selv (solen fra venstre: højlys oppe til venstre) */}
      <path d={join(...stones.map(([sx, sy, r]) => ellipse(sx, sy + r * 0.35, r * 1.5, r * 0.5)))} fill={SKOV.waterLight} opacity={0.55} />
      <path d={join(...stones.map(([sx, sy, r]) => blob([[sx - r, sy + r * 0.3], [sx - r * 0.8, sy - r * 0.5], [sx, sy - r * 0.85], [sx + r * 0.85, sy - r * 0.4], [sx + r, sy + r * 0.3]], 0.8)))} fill={c('pebble')} stroke={c('pebbleDark')} strokeWidth={1.4 * k} {...ROUND} />
      <path d={join(...stones.map(([sx, sy, r]) => blob([[sx + r * 0.15, sy - r * 0.6], [sx + r * 0.85, sy - r * 0.4], [sx + r, sy + r * 0.3], [sx + r * 0.2, sy + r * 0.3]], 0.8)))} fill={c('pebbleDark')} opacity={0.45} />
      <path d={join(...stones.map(([sx, sy, r]) => ellipse(sx - r * 0.3, sy - r * 0.35, r * 0.38, r * 0.18, -15)))} fill={SKOV.flowerWhite} opacity={0.7} />
      {bloom(t) && (
        <>
          <path d={lilies} fill={c('lily')} />
          <path d={lf.petals} fill={c('flowerPink')} />
          <path d={glints([[x - rx * 0.05, y - ry * 0.5, 3.6 * k], [x + rx * 0.62, y + ry * 0.3, 3 * k], [x - rx * 0.75, y - ry * 0.1, 2.6 * k]])} fill={SKOV.flowerWhite} />
        </>
      )}
    </>
  )
}

/** En åkande: en flad ellipse med et lille hak (som en halvmåne af en cirkel), som polygon. */
const ellipseCut = (cx: number, cy: number, rx: number, ry: number) => poly([[cx, cy], ...arcPts(cx, cy, rx, ry, 20, 340, 9)])

/**
 * Vandmøllen ved søens udløb (lokalt; hjulet står i åen til venstre for huset): kalket mur, violet tag, vindue og
 * dør; hjulet med eger og skovle. Vinduet og en lanterne lyser fra bronze, vimpler langs taget i guld.
 */
function Mill({ t }: { t: RegionTier }) {
  const c = paint(t)
  const wheel: Vec = [-4, -16]
  const spokes = join(...Array.from({ length: 4 }, (_, i) => {
    const a = (i * Math.PI) / 4 + 0.3
    return capsule([wheel[0] - Math.cos(a) * 14, wheel[1] - Math.sin(a) * 14], [wheel[0] + Math.cos(a) * 14, wheel[1] + Math.sin(a) * 14], 1.1)
  }))
  const paddles = join(...Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4 + 0.3
    return capsule([wheel[0] + Math.cos(a) * 13, wheel[1] + Math.sin(a) * 13], [wheel[0] + Math.cos(a) * 19, wheel[1] + Math.sin(a) * 19], 2)
  }))
  const b = bunting([4, -44], [24, -64], 4, 2)
  const b2 = bunting([24, -64], [46, -44], 4, 2)
  return (
    <>
      <path d={join(rect(4, -40, 40, 40, 2.5), rect(30, -54, 7, 14, 1.5))} fill={c('wall')} stroke={c('timber')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={rect(31, -40, 13, 40, 2)} fill={c('wallShade')} opacity={0.7} />
      <path d={blob([[0, -38], [24, -66], [48, -38]], 0.25)} fill={c('roof')} stroke={c('roofShade')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={blob([[24, -66], [48, -38], [30, -38]], 0.25)} fill={c('roofShade')} opacity={0.45} />
      <path d={join(rect(12, -30, 9, 9, 2), rect(28, -30, 9, 9, 2))} fill={lit(t) ? c('windowLit') : c('window')} stroke={c('timber')} strokeWidth={1.2} {...ROUND} />
      <path d={rect(19, -15, 9, 15, 4.5)} fill={c('door')} />
      <path d={circle(wheel[0], wheel[1], 19)} fill="none" stroke={c('woodDark')} strokeWidth={2.4} />
      <path d={join(spokes, circle(wheel[0], wheel[1], 3))} fill={c('woodDark')} />
      <path d={paddles} fill={c('wood')} stroke={c('woodDark')} strokeWidth={0.9} />
      {lit(t) && lanterns([[46, -26]], 0.8)}
      {full(t) && (
        <>
          <Bunting b={[b, b2]} c={c} />
        </>
      )}
    </>
  )
}

/**
 * Hundredebroen (lokalt, midt på broen ved dækket): en lang stenbro med præcis ti buer over åen, en svag bue i
 * dækket og to gelændere (et bag dækket og et foran). Lygter fra bronze, glimt i vandet fra sølv, vimpler i guld.
 */
export const BRIDGE_ARCHES = 10
function Bridge({ t, half }: { t: RegionTier; half: number }) {
  const c = paint(t)
  const L = half
  const deckY = (x: number) => -5 * (1 - (x / L) ** 2)
  const aw = (2 * L) / BRIDGE_ARCHES
  const arches = Array.from({ length: BRIDGE_ARCHES }, (_, i) => {
    const x0 = -L + i * aw + aw * 0.16
    const x1 = -L + (i + 1) * aw - aw * 0.16
    const top = deckY((x0 + x1) / 2) + 7
    return blob([[x0, 16], [x0, top + aw * 0.3], [(x0 + x1) / 2, top], [x1, top + aw * 0.3], [x1, 16]], 0.7)
  })
  const xs = Array.from({ length: 9 }, (_, i) => -L + (i * 2 * L) / 8)
  const rail = (dy: number) => join(spline(xs.map((x) => [x, deckY(x) + dy - 9] as Vec)), ...xs.map((x) => poly([[x, deckY(x) + dy - 9], [x, deckY(x) + dy]], false)))
  const body = band(xs.map((x) => [x * 1.02, deckY(x) - 1] as Vec), xs.map((x) => [x * 1.02, 15] as Vec))
  const b = bunting([-L, deckY(-L) - 15], [0, deckY(0) - 15], 6, 4)
  const b2 = bunting([0, deckY(0) - 15], [L, deckY(L) - 15], 6, 4)
  return (
    <>
      <path d={ellipse(6 + SHADOW_SHIFT[0], 18 + SHADOW_SHIFT[1], L + 6, 5)} fill={SKOV.castShadow} opacity={0.28} />
      <path d={rail(-4)} fill="none" stroke={c('stoneShade')} strokeWidth={2} {...ROUND} />
      <path d={band(xs.map((x) => [x, deckY(x) - 4.5] as Vec), xs.map((x) => [x, deckY(x) + 0.5] as Vec))} fill={c('trail')} />
      <path d={body} fill={c('stone')} stroke={c('stoneShade')} strokeWidth={1.3} {...ROUND} />
      <path d={join(...arches)} fill={c('waterDeep')} opacity={0.85} />
      <path d={spline(xs.slice(1, -1).map((x) => [x, deckY(x) + 1.6] as Vec))} fill="none" stroke={SKOV.sunlit} strokeWidth={1.4} opacity={0.7} {...ROUND} />
      <path d={rail(4)} fill="none" stroke={c('woodDark')} strokeWidth={2.2} {...ROUND} />
      {lit(t) && lanterns([[-L, deckY(-L) - 6], [L, deckY(L) - 6]], 0.85)}
      {full(t) && <Bunting b={[b, b2]} c={c} a="flag2" />}
    </>
  )
}

/**
 * Urtårnets top: tårnets øverste del over trætoppene – en lys stenskakt med et ur, hvis skive er delt i fire
 * kvarterer (to af dem lyse), og viserne viser kvart over ti (tyk timeviser i blæk, lang rød minutviser) – og et
 * spidst, violet spir. Vindue og lanterne lyser fra bronze, kvartererne får farve og glimt fra sølv, flag og
 * fugle i guld.
 */
function Tower({ t }: { t: RegionTier }) {
  const c = paint(t)
  const cy = -112
  const r = 15
  const ticks = join(...Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6
    return circle(Math.sin(a) * (r - 3), cy - Math.cos(a) * (r - 3), i % 3 === 0 ? 1.7 : 0.8)
  }))
  // kvart over ti: minutviseren peger på 3 (højre), timeviseren en kvart time forbi 10
  const hour = ((10.25 / 12) * 360 - 90) * (Math.PI / 180)
  const f = flag(0, -196, 22)
  return (
    <>
      <path d={blob([[-17, 0], [-16, -138], [16, -138], [17, 0]], 0.12)} fill={c('tower')} stroke={c('towerShade')} strokeWidth={SW} {...ROUND} />
      <path d={blob([[6, 0], [6, -137], [16, -138], [17, 0]], 0.12)} fill={c('towerShade')} opacity={0.55} />
      <path d={join(rect(-19, -84, 38, 5, 2.5), rect(-20.5, -142, 41, 7, 3.5))} fill={c('tower')} stroke={c('towerShade')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={rect(-5, -68, 10, 16, 5)} fill={lit(t) ? c('windowLit') : c('window')} stroke={c('timber')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={circle(0, cy, r)} fill={c('clockFace')} stroke={c('towerShade')} strokeWidth={2.6} />
      <path d={join(wedge(0, cy, r - 1.2, -90, 0), wedge(0, cy, r - 1.2, 90, 180))} fill={bloom(t) ? c('clockQuarter') : tintSkov('clockQuarter', 'start')} opacity={0.9} />
      <path d={join(poly([[0, cy - r + 1], [0, cy + r - 1]], false), poly([[-r + 1, cy], [r - 1, cy]], false))} fill="none" stroke={c('towerShade')} strokeWidth={0.8} />
      <path d={ticks} fill={SKOV.clockInk} />
      <path d={capsule([0, cy], [Math.cos(hour) * 8, cy + Math.sin(hour) * 8], 2)} fill={SKOV.clockInk} />
      <path d={capsule([0, cy], [12, cy], 1.25)} fill={c('clockMinute')} />
      <path d={circle(0, cy, 1.9)} fill={SKOV.clockInk} />
      <path d={blob([[-23, -140], [0, -196], [23, -140]], 0.3)} fill={c('roof')} stroke={c('roofShade')} strokeWidth={SW} {...ROUND} />
      <path d={blob([[0, -196], [23, -140], [6, -140]], 0.3)} fill={c('roofShade')} opacity={0.5} />
      {lit(t) && lanterns([[14, -78]], 0.9)}
      {bloom(t) && <path d={glints([[-12, cy - 15, 3], [21, -150, 2.6]])} fill={SKOV.flowerWhite} />}
      {full(t) && (
        <>
          <path d={f.pole} fill={c('timber')} />
          <path d={f.cloth} fill={c('flag')} stroke={c('awningShade')} strokeWidth={1} {...ROUND} />
          <path d={birds([[30, -200, 1.1], [44, -212, 0.85]])} fill="none" stroke={SKOV.bird} strokeWidth={1.8} {...ROUND} />
        </>
      )}
    </>
  )
}

/**
 * Gangegrotten: en klippe af lys sten med mos på toppen og en mørk, rund grotte, hvor krystaller står i tre lige
 * rækker af fire (et lille gitter, 3 · 4). Krystallerne gløder fra bronze (og en lanterne ved indgangen), glimter
 * og får svampe ved indgangen fra sølv og står i fuld farve med vimpler over indgangen i guld.
 */
export const CRYSTAL_GRID = { rows: 3, cols: 4 } as const
function Cave({ t }: { t: RegionTier }) {
  const c = paint(t)
  const rock = blob([[-58, 0], [-60, -24], [-48, -52], [-22, -68], [8, -70], [36, -60], [56, -38], [60, 0]], 0.75)
  const mouth = blob([[-27, 0], [-28, -24], [-18, -42], [0, -48], [18, -42], [28, -24], [27, 0]], 0.75)
  const crystal = (x: number, y: number, s: number) => poly([[x - 3 * s, y], [x - 3.2 * s, y - 6 * s], [x, y - 10.5 * s], [x + 3.2 * s, y - 6 * s], [x + 3 * s, y]])
  const cells = Array.from({ length: CRYSTAL_GRID.rows * CRYSTAL_GRID.cols }, (_, i) => {
    const row = Math.floor(i / CRYSTAL_GRID.cols)
    const col = i % CRYSTAL_GRID.cols
    return { x: -16.5 + col * 11, y: -27 + row * 11.5, s: 0.85 + row * 0.08, col }
  })
  const b = bunting([-30, -40], [30, -40], 7, 7)
  const caps = join(ellipseTop(40, -7, 7, 5), ellipseTop(50, -4, 5, 4), ellipseTop(-42, -5, 6, 4.5))
  return (
    <>
      <path d={rock} fill={c('rock')} stroke={c('rockShade')} strokeWidth={SW} {...ROUND} />
      <path d={blob([[20, -64], [44, -54], [58, -34], [60, 0], [30, 0], [34, -30]], 0.7)} fill={c('rockShade')} opacity={0.45} />
      <path d={join(scallop(-28, -60, 22, 8, 7, 0.6, -90), scallop(16, -66, 24, 7, 7, 0.6, -90))} fill={c('moss')} stroke={c('mossDark')} strokeWidth={1.3} {...ROUND} />
      <path d={spline([[-56, -18], [-50, -44], [-30, -60]])} fill="none" stroke={SKOV.sunlit} strokeWidth={3} opacity={0.8} {...ROUND} />
      <path d={mouth} fill={c('cave')} stroke={c('rockShade')} strokeWidth={1.4} {...ROUND} />
      {lit(t) && <path d={ellipse(0, -16, 22, 22)} fill={c('crystalGlow')} opacity={0.55} />}
      <path d={join(...cells.filter((q) => q.col % 2 === 0).map((q) => crystal(q.x, q.y, q.s)))} fill={c('crystalA')} stroke={c('cave')} strokeWidth={0.8} {...ROUND} />
      <path d={join(...cells.filter((q) => q.col % 2 === 1).map((q) => crystal(q.x, q.y, q.s)))} fill={c('crystalB')} stroke={c('cave')} strokeWidth={0.8} {...ROUND} />
      <path d={join(...cells.map((q) => poly([[q.x - 1.4 * q.s, q.y - 1], [q.x - 1.6 * q.s, q.y - 6 * q.s], [q.x - 0.2, q.y - 9 * q.s]], false)))} fill="none" stroke={SKOV.flowerWhite} strokeWidth={0.9} opacity={0.75} {...ROUND} />
      {lit(t) && lanterns([[34, -40]], 0.85)}
      {bloom(t) && (
        <>
          <path d={join(rect(38.8, -6, 2.4, 6, 1), rect(49, -4, 2, 4, 1), rect(-43, -5, 2.2, 5, 1))} fill={c('stem')} />
          <path d={caps} fill={c('mushroom')} stroke={c('mushroomDark')} strokeWidth={0.9} {...ROUND} />
          <path d={glints([[-20, -36, 3], [13, -30, 2.6], [2, -12, 2.4]])} fill={SKOV.flowerWhite} />
        </>
      )}
      {full(t) && <Bunting b={[b]} c={c} a="flag2" z="crystalA" />}
    </>
  )
}

/** Den øverste halvdel af en ellipse (en svampehat), lukket langs bunden. */
const ellipseTop = (cx: number, cy: number, rx: number, ry: number) => blob([[cx - rx, cy], [cx - rx * 0.8, cy - ry * 0.75], [cx, cy - ry], [cx + rx * 0.8, cy - ry * 0.75], [cx + rx, cy], [cx, cy + ry * 0.2]], 0.7)

/** Bambus (lokalt fra roden): fire stængler med led og smalle blade. */
function Bamboo({ t }: { t: RegionTier }) {
  const c = paint(t)
  const stalks: [number, number][] = [[-14, 74], [-6, 92], [3, 80], [12, 64]]
  const leaves = stalks.flatMap(([x, hgt], i) => [leaf(x, -hgt * 0.7, 15, 3.4, -150 + i * 8), leaf(x, -hgt * 0.86, 14, 3.2, -30 - i * 6), leaf(x, -hgt + 2, 12, 3, -70 - i * 10)])
  return (
    <>
      <path d={join(...stalks.map(([x, hgt]) => capsule([x, 0], [x + 1.5, -hgt], 2.1)))} fill={c('bamboo')} stroke={c('bambooDark')} strokeWidth={1.1} {...ROUND} />
      <path d={join(...stalks.flatMap(([x, hgt]) => [0.25, 0.5, 0.75].map((q) => rect(x + q * 1.5 - 2.6, -hgt * q - 0.8, 5.2, 1.6, 0.8))))} fill={c('bambooDark')} />
      <g className="skov-sway" style={{ animationDelay: '-2.1s' }}>
        <path d={join(...leaves.map((l) => l.blade))} fill={c('bamboo')} stroke={c('bambooDark')} strokeWidth={0.9} {...ROUND} />
      </g>
    </>
  )
}

/** En forenklet panda i scenens stil (lokalt, sidder på y = 0 og gnasker en bambusstang). */
function Panda({ t }: { t: RegionTier }) {
  const c = paint(t)
  const black = c('pandaBlack')
  return (
    <>
      <path d={join(circle(-8, -36, 3.6), circle(8, -36, 3.6), ellipse(-9, -3.5, 6.5, 4.5, -10), ellipse(9, -3.5, 6.5, 4.5, 10))} fill={black} />
      <path d={join(blob([[-11, -2], [-12.5, -14], [-8, -23], [8, -23], [12.5, -14], [11, -2], [0, 0]], 0.8), ellipse(0, -28.5, 10.5, 8.8))} fill={SKOV.pandaWhite} stroke={black} strokeWidth={1.2} {...ROUND} />
      <path d={join(lune(1, -11, 11, 10, 3.2, 15, 120), lune(1, -27, 10, 8, 2.4, 10, 110))} fill={c('pandaShade')} opacity={0.9} />
      <path d={capsule([5, -4], [7.5, -33], 1.5)} fill={c('bamboo')} stroke={c('bambooDark')} strokeWidth={0.8} />
      <path d={join(capsule([-9, -19], [-3.5, -12.5], 3), capsule([9, -19], [5.5, -12], 3), ellipse(-4, -29, 2.7, 3.4, 25), ellipse(4, -29, 2.7, 3.4, -25), ellipse(0, -25.4, 1.6, 1.1))} fill={black} />
      <path d={join(circle(-3.6, -29.6, 0.95), circle(4.4, -29.6, 0.95))} fill={SKOV.pandaWhite} />
    </>
  )
}

/**
 * Købmandsgården: et lille gårdhus med skorsten og en købmandsbod med stribet markise, disk med varer og et
 * hængende skilt med en guldmønt. Vinduer og lanterne lyser og skorstenen ryger fra bronze, blomsterkasser fra
 * sølv, vimpler langs markisen i guld.
 */
function Farm({ t }: { t: RegionTier }) {
  const c = paint(t)
  const stripes = join(...[22, 38, 54].map((x) => blob([[x - 4, -50], [x + 4, -50], [x + 5, -36], [x - 5, -36]], 0.1)))
  const scallops = (odd: boolean) => join(...Array.from({ length: 5 }, (_, i) => i).filter((i) => i % 2 === (odd ? 1 : 0)).map((i) => ellipseTopDown(16 + i * 11.5, -37, 5.8, 5.5)))
  const b = bunting([12, -52], [70, -52], 7, 4)
  const fl = flowerPaths([[-30, -13, 2.4], [-24, -13, 2.2], [-18, -13, 2.4]])
  return (
    <>
      {lit(t) && <path d={smoke(-14, -60, 1.25)} fill={SKOV.smoke} opacity={0.9} />}
      {/* huset */}
      <path d={rect(-17, -62, 7, 16, 1.5)} fill={c('roofRedShade')} stroke={c('timber')} strokeWidth={1.2} {...ROUND} />
      <path d={rect(-36, -34, 40, 34, 2.5)} fill={c('wall')} stroke={c('timber')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={rect(-8, -34, 12, 34, 2)} fill={c('wallShade')} opacity={0.7} />
      <path d={blob([[-40, -32], [-16, -58], [8, -32]], 0.25)} fill={c('roofRed')} stroke={c('roofRedShade')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={blob([[-16, -58], [8, -32], [-8, -32]], 0.25)} fill={c('roofRedShade')} opacity={0.4} />
      <path d={rect(-31, -25, 9, 9, 2)} fill={lit(t) ? c('windowLit') : c('window')} stroke={c('timber')} strokeWidth={1.2} {...ROUND} />
      <path d={rect(-17, -18, 9, 18, 4.5)} fill={c('door')} />
      {/* boden: stolper, disk med æbler, markise */}
      <path d={join(rect(12, -40, 3.2, 40, 1.2), rect(64, -40, 3.2, 40, 1.2))} fill={c('wood')} stroke={c('woodDark')} strokeWidth={1.1} {...ROUND} />
      <path d={rect(10, -16, 60, 16, 2.5)} fill={c('wood')} stroke={c('woodDark')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={rect(56, -16, 14, 16, 2)} fill={c('woodDark')} opacity={0.3} />
      <path d={join(circle(22, -18.5, 3.2), circle(29, -19.5, 3.2), circle(36, -18.5, 3.2))} fill={c('mushroom')} stroke={c('mushroomDark')} strokeWidth={0.8} />
      <path d={join(rect(44, -23, 9, 7, 1.5), rect(47, -27, 6, 4, 1))} fill={c('soil')} stroke={c('woodDark')} strokeWidth={0.8} {...ROUND} />
      <path d={blob([[8, -36], [14, -52], [66, -52], [72, -36]], 0.15)} fill={c('awning')} stroke={c('awningShade')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={stripes} fill={c('awningLight')} opacity={0.92} />
      <path d={scallops(false)} fill={c('awning')} stroke={c('awningShade')} strokeWidth={1.1} />
      <path d={scallops(true)} fill={c('awningLight')} stroke={c('awningShade')} strokeWidth={1.1} />
      {/* skiltet med mønten på en stolpe foran boden */}
      <path d={join(rect(81, -46, 2.6, 46, 1.2), rect(70, -47, 16, 2.4, 1.2))} fill={c('woodDark')} />
      <path d={join(poly([[73, -45], [73, -40]], false), poly([[83, -45], [83, -40]], false))} fill="none" stroke={c('woodDark')} strokeWidth={0.9} />
      <path d={rect(68, -40, 20, 18, 3)} fill={c('wall')} stroke={c('timber')} strokeWidth={1.2} {...ROUND} />
      <path d={circle(78, -31, 6.4)} fill={c('coin')} stroke={c('coinDark')} strokeWidth={1.3} />
      <path d={join(circle(78, -31, 3.8), ellipse(76, -33.4, 1.8, 0.9, -30))} fill="none" stroke={c('coinDark')} strokeWidth={0.9} />
      {lit(t) && lanterns([[62, -36]], 0.8)}
      {bloom(t) && (
        <>
          <path d={rect(-33, -14, 18, 3.6, 1.5)} fill={c('woodDark')} />
          <path d={fl.petals} fill={c('flowerPink')} />
        </>
      )}
      {full(t) && <Bunting b={[b]} c={c} a="flag2" />}
    </>
  )
}

/** Den nederste halvdel af en ellipse (markisens buer), lukket langs toppen. */
const ellipseTopDown = (cx: number, cy: number, rx: number, ry: number) => blob([[cx - rx, cy], [cx + rx, cy], [cx + rx * 0.8, cy + ry * 0.75], [cx, cy + ry], [cx - rx * 0.8, cy + ry * 0.75]], 0.7)

/**
 * Egernenes træ (lokalt fra stammens fod; grenen stikker mod højre): en kraftig stamme med en vandret gren og
 * kronen øverst; egernene sidder på grenen med store, buskede haler, der vipper. Det andet egern kommer fra sølv.
 */
function SquirrelTree({ t, flip }: { t: RegionTier; flip: boolean }) {
  const c = paint(t)
  const spots: [number, number, number][] = [[34, -62, 1], [56, -63.5, 0.85]]
  const shown = spots.slice(0, bloom(t) ? 2 : 1)
  const tail = blob([[0, 0], [-7, -2], [-13, -10], [-14, -22], [-8, -30], [0, -30], [3, -24], [-2, -20], [-5, -12], [-2, -5]], 0.8)
  return (
    <g transform={flip ? 'scale(-1 1)' : undefined}>
      <path d={join(blob([[-9, 0], [-7, -40], [-6, -96], [6, -96], [7, -40], [10, 0], [0, 2]], 0.5), blob([[4, -58], [30, -61], [70, -64], [72, -59.5], [30, -55], [5, -50]], 0.6))} fill={c('trunk')} stroke={c('trunkDark')} strokeWidth={SW} {...ROUND} />
      <path d={blob([[2, -94], [6, -40], [9, 0], [2, 0], [0, -40]], 0.5)} fill={c('trunkDark')} opacity={0.3} />
      <g className="skov-sway" style={{ animationDelay: '-3.3s' }}>
        <path d={join(scallop(-2, -118, 34, 30, 9, 0.6, -90), scallop(64, -78, 13, 10, 6, 0.6, -90))} fill={c('crownTeal')} stroke={c('leafDark')} strokeWidth={SW} {...ROUND} />
        <path d={lune(0, -115, 30, 26, 8, 15, 150)} fill={c('leafDark')} opacity={0.38} />
        <path d={ellipse(-14, -132, 9, 6, -22)} fill={c('leafLight')} opacity={0.85} />
      </g>
      {shown.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${n(x)} ${n(y)}) scale(${fmt3(s)})`}>
          <g transform="translate(-4 -4)">
            <g className="skov-tail" style={{ animationDelay: `${-i * 1.6}s` }}>
              <path d={tail} fill={c('squirrel')} stroke={c('squirrelDark')} strokeWidth={1.1} {...ROUND} />
            </g>
          </g>
          <path d={join(blob([[-6, 0], [-7.5, -8], [-3, -15], [3.5, -15], [6.5, -9], [5.5, -1], [0, 1]], 0.8), circle(4.5, -18.5, 5), blob([[2.4, -22], [3.2, -28.5], [6.2, -23]], 0.4))} fill={c('squirrel')} stroke={c('squirrelDark')} strokeWidth={1.1} {...ROUND} />
          <path d={join(ellipse(2, -7.5, 2.8, 4.6), circle(8.6, -12, 2.2))} fill={c('squirrelBelly')} />
          <path d={join(circle(6.6, -19.4, 1), circle(9.4, -17.6, 0.8), circle(8.6, -13.6, 1.1))} fill={SKOV.eye} />
        </g>
      ))}
    </g>
  )
}

/**
 * Uglens træ (lokalt fra stammens fod): en tyk stamme med et rundt træhul, hvor uglen kigger ud – store øjne,
 * øretoppe og et lille næb. Den blunder (lukkede øjne) i start og er vågen fra bronze.
 */
function OwlTree({ t }: { t: RegionTier }) {
  const c = paint(t)
  const awake = lit(t)
  const hy = -64
  return (
    <>
      <path d={blob([[-14, 0], [-10, -40], [-9, -96], [9, -96], [10, -40], [14, 0], [0, 2]], 0.5)} fill={c('trunk')} stroke={c('trunkDark')} strokeWidth={SW} {...ROUND} />
      <path d={blob([[3, -94], [7, -40], [12, 0], [4, 0], [1, -40]], 0.5)} fill={c('trunkDark')} opacity={0.3} />
      <path d={join(spline([[-6, -20], [-5, -32], [-6, -42]]), spline([[5, -14], [6, -24]]))} fill="none" stroke={c('trunkDark')} strokeWidth={1.2} opacity={0.6} {...ROUND} />
      <g className="skov-sway" style={{ animationDelay: '-0.6s' }}>
        <path d={scallop(0, -122, 36, 34, 9, 0.6, -80)} fill={c('crownGreen')} stroke={c('leafDark')} strokeWidth={SW} {...ROUND} />
        <path d={lune(2, -119, 32, 30, 9, 15, 150)} fill={c('leafDark')} opacity={0.38} />
        <path d={ellipse(-13, -138, 9, 7, -22)} fill={c('leafLight')} opacity={0.85} />
      </g>
      <path d={ellipse(0, hy, 10.5, 13)} fill={c('cave')} stroke={c('trunkDark')} strokeWidth={1.6} />
      {/* uglen: krop med øretoppe, ansigtsskive, øjne og næb */}
      <path d={blob([[-8, hy + 12], [-8.5, hy - 2], [-7.5, hy - 10], [-6, hy - 14], [-3, hy - 10], [3, hy - 10], [6, hy - 14], [7.5, hy - 10], [8.5, hy - 2], [8, hy + 12]], 0.7)} fill={c('owl')} stroke={c('owlDark')} strokeWidth={1.1} {...ROUND} />
      <path d={join(circle(-3.4, hy - 4, 4), circle(3.4, hy - 4, 4), ellipse(0, hy + 6, 4.5, 5))} fill={c('owlFace')} />
      {awake ? (
        <>
          <path d={join(circle(-3.4, hy - 4, 2.6), circle(3.4, hy - 4, 2.6))} fill={SKOV.flowerWhite} stroke={c('owlDark')} strokeWidth={0.6} />
          <path d={join(circle(-3, hy - 4, 1.4), circle(3.8, hy - 4, 1.4))} fill={SKOV.eye} />
        </>
      ) : (
        <path d={join(spline([[-5.6, hy - 4], [-3.4, hy - 2.6], [-1.2, hy - 4]]), spline([[1.2, hy - 4], [3.4, hy - 2.6], [5.6, hy - 4]]))} fill="none" stroke={c('owlDark')} strokeWidth={1.1} {...ROUND} />
      )}
      <path d={blob([[-1.4, hy - 1], [1.4, hy - 1], [0, hy + 2]], 0.3)} fill={c('flowerHeart')} />
    </>
  )
}

/**
 * Linealstiens pæle (lokalt fra den laveste pæls fod; de står langs stien mod højre): fem pæle i stigende højde
 * som søjler i et diagram, hver med centimeterstreger (lange for hver femte). Lanterne på den højeste fra bronze,
 * blomster ved foden fra sølv, pælene farvet som søjler i guld.
 */
export const RULER_POSTS = [14, 22, 30, 38, 46] as const
function RulerPosts({ t }: { t: RegionTier }) {
  const c = paint(t)
  const pitch = 13
  const ps = RULER_POSTS.map((hgt, i) => ({ x: i * pitch, y: -i * 3.2, hgt }))
  const body = (pick: (i: number) => boolean) => join(...ps.filter((_, i) => pick(i)).map((p) => rect(p.x - 3.4, p.y - p.hgt, 6.8, p.hgt, 1.6)))
  const ticks = join(...ps.flatMap((p) => Array.from({ length: Math.floor(p.hgt / 4) }, (_, j) => poly([[p.x - 3.4, p.y - (j + 1) * 4], [p.x + (j % 5 === 4 ? 1.6 : -0.6), p.y - (j + 1) * 4]], false))))
  const fl = flowerPaths(ps.map((p) => [p.x + 6, p.y - 1, 2.3] as [number, number, number]))
  const top = ps[ps.length - 1]
  return (
    <>
      <path d={join(...ps.map((p) => ellipse(p.x + 4 + SHADOW_SHIFT[0] * 0.7, p.y + 0.5 + SHADOW_SHIFT[1] * 0.5, 6, 1.6)))} fill={SKOV.castShadow} opacity={0.25} />
      {full(t) ? (
        <>
          <path d={body((i) => i % 3 === 0)} fill={c('barA')} stroke={c('postShade')} strokeWidth={1.1} {...ROUND} />
          <path d={body((i) => i % 3 === 1)} fill={c('barB')} stroke={c('postShade')} strokeWidth={1.1} {...ROUND} />
          <path d={body((i) => i % 3 === 2)} fill={c('barC')} stroke={c('postShade')} strokeWidth={1.1} {...ROUND} />
        </>
      ) : (
        <path d={body(() => true)} fill={c('post')} stroke={c('postShade')} strokeWidth={1.1} {...ROUND} />
      )}
      <path d={join(...ps.map((p) => rect(p.x + 1, p.y - p.hgt + 1, 2.4, p.hgt - 1, 1)))} fill={c('postShade')} opacity={0.35} />
      <path d={ticks} fill="none" stroke={c('tick')} strokeWidth={0.8} {...ROUND} />
      {lit(t) && lanterns([[top.x, top.y - top.hgt - 11]], 0.8)}
      {lit(t) && <path d={rect(top.x - 0.7, top.y - top.hgt - 3, 1.4, 3, 0.6)} fill={c('woodDark')} />}
      {bloom(t) && (
        <>
          <path d={fl.petals} fill={c('flowerViolet')} />
          <path d={fl.hearts} fill={c('flowerYellow')} />
        </>
      )}
    </>
  )
}

/**
 * Figurhaven (lokalt fra havens midte forrest): en græsplæne med lav hæk, fire hække klippet som kugle, terning,
 * kegle og cylinder og i midten et spejlsymmetrisk bed (blomsterne spejlet om en lille sti). Lanterner ved
 * indgangen fra bronze, flere blomster i bedet fra sølv, vimpler og fuld farve i guld.
 */
export const GARDEN_FIGURES = ['kugle', 'terning', 'kegle', 'cylinder'] as const
function Garden({ t }: { t: RegionTier }) {
  const c = paint(t)
  // kuglen og keglen til venstre, terningen og cylinderen til højre
  const sphere = circle(-62, -24, 15)
  const cubeTop = poly([[44, -38], [56, -44], [68, -38], [56, -32]])
  const cubeLeft = poly([[44, -38], [56, -32], [56, -12], [44, -18]])
  const cubeRight = poly([[56, -32], [68, -38], [68, -18], [56, -12]])
  const cone = blob([[-37, -12], [-30, -50], [-23, -12], [-30, -9]], 0.25)
  const cyl = join(rect(78, -40, 22, 28, 2), ellipse(89, -40, 11, 3.6))
  const cylTop = ellipse(89, -40, 11, 3.6)
  const pots = join(rect(-70, -11, 16, 7, 1.5), rect(-36, -11, 12, 7, 1.5), rect(48, -12, 16, 7, 1.5), rect(81, -12, 16, 7, 1.5))
  // spejlsymmetrisk bed om x = 6: blomsterne til venstre spejles til højre
  const half: [number, number, number][] = [[-6, -16, 3.2], [-13, -10, 3], [-18, -19, 2.8], [-10, -24, 2.6], [-22, -9, 2.6], [-26, -16, 2.4]]
  const n0 = [3, 4, 5, 6][rank(t)]
  const left = half.slice(0, n0)
  const mirror = left.map(([x, y, r]) => [12 - x, y, r] as [number, number, number])
  const warm = flowerPaths([...left.filter((_, i) => i % 2 === 0), ...mirror.filter((_, i) => i % 2 === 0)])
  const cool = flowerPaths([...left.filter((_, i) => i % 2 === 1), ...mirror.filter((_, i) => i % 2 === 1)])
  const b = bunting([-78, -46], [104, -46], 12, 8)
  return (
    <>
      <path d={blob([[-90, 2], [-82, -14], [-40, -22], [40, -24], [96, -18], [108, 0], [60, 6], [-40, 6]], 0.8)} fill={c('nearHill')} stroke={c('hedgeShade')} strokeWidth={1.2} {...ROUND} />
      <path d={join(...[[-60, -4, 18, 3.2], [-28, -4, 11, 2.6], [60, -5, 16, 3], [92, -5, 14, 3]].map(([x, y, rx, ry]) => ellipse(x + SHADOW_SHIFT[0], y + SHADOW_SHIFT[1], rx, ry)))} fill={SKOV.castShadow} opacity={0.22} />
      <path d={blob([[-34, -4], [-30, -24], [42, -24], [46, -4], [6, -1]], 0.7)} fill={c('soil')} stroke={c('woodDark')} strokeWidth={1} {...ROUND} />
      <path d={poly([[6, -24], [6, -3]], false)} fill="none" stroke={c('trail')} strokeWidth={2.4} {...ROUND} />
      <path d={pots} fill={c('wood')} stroke={c('woodDark')} strokeWidth={1} {...ROUND} />
      <path d={join(sphere, cone, cubeLeft, cyl)} fill={c('hedge')} stroke={c('hedgeShade')} strokeWidth={1.5} {...ROUND} />
      <path d={join(cubeRight, lune(-62, -24, 15, 15, 5, 10, 140), blob([[-30, -50], [-23, -12], [-30, -10]], 0.25), rect(91, -40, 9, 28, 2))} fill={c('hedgeShade')} opacity={0.6} />
      <path d={join(cubeTop, cylTop, ellipse(-67, -30, 5, 3.4, -30))} fill={c('hedgeLight')} stroke={c('hedgeShade')} strokeWidth={1} {...ROUND} />
      <path d={warm.petals} fill={c('flowerPink')} />
      <path d={cool.petals} fill={c('flowerViolet')} />
      <path d={join(warm.hearts, cool.hearts)} fill={c('flowerYellow')} />
      {/* lav hæk langs forkanten */}
      <path d={join(...Array.from({ length: 9 }, (_, i) => scallop(-74 + i * 21, 1, 11, 5, 5, 0.6, -90)))} fill={c('hedge')} stroke={c('hedgeShade')} strokeWidth={1.1} {...ROUND} />
      {lit(t) && lanterns([[-84, -20], [104, -20]], 0.8)}
      {full(t) && <Bunting b={[b]} c={c} a="flag" z="flowerViolet" />}
    </>
  )
}

/** Et forgrundshjørne (lokalt fra hjørnet; spejles til højre): store blade, bregner, svampe og blomster, der beskæres. */
function Corner({ t, mirror }: { t: RegionTier; mirror: boolean }) {
  const c = paint(t)
  const leaves = mirror
    ? [leaf(-6, 14, 96, 20, -78), leaf(-14, 8, 74, 17, -42)]
    : [leaf(-6, 12, 104, 22, -70), leaf(-16, 6, 80, 18, -38)]
  const ferns = mirror ? [fern(20, 10, 70, -112), fern(6, 8, 56, -58)] : [fern(18, 10, 76, -108), fern(4, 10, 60, -54)]
  const fl: [number, number, number][] = (mirror ? [[52, -12, 7], [70, -30, 6], [86, -8, 6.5]] : [[56, -14, 7.5], [74, -34, 6.5], [92, -10, 7]]).slice(0, rank(t)) as [number, number, number][]
  const flowers = flowerPaths(fl)
  // svampe: stokke, hatte og prikker
  const shrooms: [number, number, number][] = mirror ? [[38, 0, 1], [24, 4, 0.75]] : [[40, 0, 1.1], [27, 5, 0.8]]
  return (
    <g transform={mirror ? 'scale(-1 1)' : undefined}>
      <path d={grass([[10, 4, 2.4], [36, 6, 1.9], [62, 8, 1.4], [86, 8, 1.1]])} fill={c('front')} stroke={c('frontDark')} strokeWidth={1.3} {...ROUND} />
      <g className="skov-sway" style={{ animationDelay: mirror ? '-2.6s' : '-0.9s' }}>
        <path d={join(...ferns.map((f) => f.leaves))} fill={c('fern')} stroke={c('fernDark')} strokeWidth={1} {...ROUND} />
        <path d={join(...ferns.map((f) => f.stem))} fill="none" stroke={c('fernDark')} strokeWidth={1.4} {...ROUND} />
        <path d={join(...leaves.map((l) => l.blade))} fill={c('fgLeaf')} stroke={c('fgLeafDark')} strokeWidth={1.8} {...ROUND} />
        <path d={join(...leaves.map((l) => l.rib))} fill="none" stroke={c('fgLeafLight')} strokeWidth={1.6} opacity={0.9} {...ROUND} />
      </g>
      <path d={join(...shrooms.map(([x, y, s]) => blob([[x - 3.2 * s, y], [x - 2.6 * s, y - 12 * s], [x + 2.6 * s, y - 12 * s], [x + 3.2 * s, y], [x, y + 1.5 * s]], 0.6)))} fill={c('stem')} stroke={c('wallShade')} strokeWidth={1} {...ROUND} />
      <path d={join(...shrooms.map(([x, y, s]) => ellipseTop(x, y - 11 * s, 11 * s, 9 * s)))} fill={c('mushroom')} stroke={c('mushroomDark')} strokeWidth={1.3} {...ROUND} />
      <path d={join(...shrooms.flatMap(([x, y, s]) => [circle(x - 4.5 * s, y - 15 * s, 1.7 * s), circle(x + 1.5 * s, y - 18 * s, 1.5 * s), circle(x + 5.5 * s, y - 13.5 * s, 1.3 * s)]))} fill={SKOV.flowerWhite} />
      {fl.length > 0 && (
        <>
          <path d={flowers.petals} fill={mirror ? c('flowerViolet') : c('flowerPink')} stroke={SKOV.outline} strokeWidth={1.1} {...ROUND} />
          <path d={flowers.hearts} fill={c('flowerYellow')} />
        </>
      )}
    </g>
  )
}

/** En sky: fire runde puder og en flad bund, med en blå skygge forneden (scenens koordinater). */
const cloud = (p: Place) => {
  const o = (x: number, y: number) => [p.x + x * p.s, p.y + y * p.s] as const
  const c = (x: number, y: number, r: number) => circle(...o(x, y), r * p.s)
  return {
    body: join(c(-22, -4, 14), c(-4, -14, 18), c(18, -8, 15), c(32, 0, 10), rect(p.x - 36 * p.s, p.y - 6 * p.s, 78 * p.s, 14 * p.s, 7 * p.s)),
    shade: ellipse(p.x + 4 * p.s, p.y + 5 * p.s, 34 * p.s, 4.5 * p.s),
  }
}

// ---------------------------------------------------------------------------------------------
// Åen og mølleengens hegn

/** Åen bliver bredere nedstrøms (fuld bredde pr. punkt); fra søens udløb til billedets kant. */
export const streamWidths = (L: Layout) => L.stream.map((_, i) => (26 + i * 26) * L.k)
export const trailWidths = (L: Layout) => L.trailW.map((v) => v * L.k)
/** Broens halve længde (den spænder over åen ved broen med lidt bred i hver ende). */
export const bridgeHalf = (L: Layout) => (streamWidths(L)[2] / 2 + 16 * L.k) / L.bridge.s

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

/** Mølleengens hegnsstolper: fra den tørre ende mod åen med jævn afstand; den sidste står på brinken. */
export function meadowFence(L: Layout, widths: readonly number[]): Vec[] {
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

export interface SkovArtProps {
  w: number
  h: number
  tiers: Tiers
  className?: string
  svgRef?: Ref<SVGSVGElement>
}

/** Den rene tegning for en given plads (CSS-px). */
export function SkovArt({ w, h, tiers, className, svgRef }: SkovArtProps) {
  const sky = `${useId().replace(/[^A-Za-z0-9_-]/g, '')}sky`
  const L = layoutOf(w, h)
  const T = Object.fromEntries((Object.keys(SKOV_REGIONS) as Mark[]).map((m) => [m, tierOf(tiers, m)])) as Record<Mark, RegionTier>
  // Bakkerne, skoven, himlen og solen følger hele verdenens fremgang (gennemsnittet af regionernes krom).
  const world = Object.values(T).reduce((s, t) => s + TIER_CHROMA[t], 0) / Object.keys(T).length
  const g = (c: SkovColor) => tintSkovBy(c, world)
  const tb = (c: SkovColor, t: RegionTier) => tintSkov(c, t)
  const R = { far: ridgePts(L.far, w), mid: ridgePts(L.mid, w), near: ridgePts(L.near, w) }
  const K = L.k
  // Lag: papirkantens skygge, fladen, solens skygge- og lysbånd, det varme højlys på kammen og den lyse kant.
  const layer = (r: Ridge, pts: Vec[], color: SkovColor, depth: number, shadeO: number) => {
    const light = ridgeLight(r, w, depth)
    return (
      <>
        <path d={ridge(xf(pts, { dy: -5 }), h + 40)} fill={SKOV.paperShadow} opacity={0.13} />
        <path d={ridge(pts, h + 40)} fill={g(color)} />
        <path d={light.shade} fill={SKOV.shade} opacity={shadeO} />
        <path d={light.glow} fill={SKOV.sunlit} opacity={0.2} />
        <path d={spline(pts)} fill="none" stroke={SKOV.rim} strokeWidth={2} opacity={0.5} {...ROUND} />
        <path d={light.crest} fill="none" stroke={SKOV.sunlit} strokeWidth={3.2 * K} opacity={0.95} {...ROUND} />
      </>
    )
  }
  // Den fjerne skov: runde, blålilla kroner langs den fjerne bakke (lyse og kølige).
  const farCount = Math.round(w / (11 * K))
  const farCrowns = join(
    ...Array.from({ length: farCount }, (_, i) => {
      const x = (i + 0.5) * (w / farCount)
      const r = (6.5 + hash01(i + 11) * 4.5) * K
      return ellipse(x, ridgeY(L.far, w, x) - r * 0.55 + 3 * K, r, r * 1.4)
    }),
  )
  // Skovbakken: høje, bløde kroner i to rækker – den bageste tæt langs kammen (også om tårnets fod, der står inde i
  // skoven), den forreste længere nede i lundene. Bjergets fod og skrænten med vandfaldet holdes fri. Kronerne i
  // samme farve er én path; konturen males under fladen, så overlappende kroner står som én blød silhuet, og hver
  // krone får sin egen skygge (nede til højre) og sit højlys (oppe til venstre).
  const HUES: SkovColor[] = ['crownGreen', 'crownTeal', 'crownGreen', 'crownLilac', 'crownGreen', 'crownTeal', 'crownPink']
  const free = (x: number) => Math.abs(x - L.mountain.x) > 70 * L.mountain.s && Math.abs(x - L.fall.x) > 60 * L.fall.s
  const rowACount = Math.round(w / (21 * K))
  const rowA = Array.from({ length: rowACount }, (_, i) => {
    const x = (i + 0.2 + hash01(i + 41) * 0.6) * (w / rowACount)
    const s = K * (0.6 + hash01(i + 53) * 0.32)
    return { x, y: ridgeY(L.mid, w, x) + (5 + hash01(i + 67) * 9) * K, s, hue: HUES[Math.floor(hash01(i + 79) * HUES.length)] }
  }).filter((p) => free(p.x))
  rowA.push(...[-25, 0, 23].map((dx, i) => ({ x: L.tower.x + dx * L.tower.s, y: L.tower.y + (6 + (i % 2) * 8) * L.tower.s, s: L.tower.s * (0.9 + (i % 2) * 0.18), hue: (i === 1 ? 'crownTeal' : 'crownGreen') as SkovColor })))
  const rowB = L.groves.flatMap(([u0, u1], j) => {
    const cnt = Math.max(1, Math.round(((u1 - u0) * w) / (30 * K)))
    return Array.from({ length: cnt }, (_, i) => {
      const x = w * u0 + (i + 0.25 + hash01(i + j * 19 + 131) * 0.5) * (((u1 - u0) * w) / cnt)
      const s = K * (0.85 + hash01(i + j * 23 + 151) * 0.35)
      return { x, y: ridgeY(L.mid, w, x) + h * L.groveDy + hash01(i + 171) * 12 * K, s, hue: HUES[Math.floor(hash01(i + j * 7 + 191) * HUES.length)] }
    })
  }).filter((p) => free(p.x))
  const rowC = L.groves.flatMap(([u0, u1], j) => {
    const cnt = Math.max(1, Math.round(((u1 - u0) * w) / (38 * K)))
    return Array.from({ length: cnt }, (_, i) => {
      const x = w * u0 + (i + 0.5 + (hash01(i + j * 29 + 211) - 0.5) * 0.5) * (((u1 - u0) * w) / cnt)
      const s = K * (1.0 + hash01(i + j * 31 + 231) * 0.32)
      return { x, y: ridgeY(L.mid, w, x) + h * L.groveDy * 2 + hash01(i + 251) * 10 * K, s, hue: HUES[Math.floor(hash01(i + j * 11 + 271) * HUES.length)] }
    })
  }).filter((p) => free(p.x))
  const crown = (p: { x: number; y: number; s: number }) => scallop(p.x, p.y - 44 * p.s, 17 * p.s, 26 * p.s, 8, 0.6, -90)
  const canopy = (row: typeof rowA) => ({
    groups: (['crownGreen', 'crownTeal', 'crownLilac', 'crownPink'] as SkovColor[]).map((hue) => ({ hue, d: join(...row.filter((p) => p.hue === hue).map(crown)) })),
    shade: join(...row.map((p) => lune(p.x + 1.5 * p.s, p.y - 42 * p.s, 15 * p.s, 23 * p.s, 6 * p.s, 15, 150))),
    light: join(...row.map((p) => ellipse(p.x - 6 * p.s, p.y - 56 * p.s, 4.5 * p.s, 7.5 * p.s, -20))),
  })
  const forest = (row: typeof rowA, key: string) => {
    const cv = canopy(row)
    return (
      <>
        {cv.groups.map(({ hue, d }) => d && <path key={`${key}${hue}`} d={d} fill={g(hue)} stroke={g('leafDark')} strokeWidth={2.6 * K} paintOrder="stroke" {...ROUND} />)}
        <path d={cv.shade} fill={g('leafDark')} opacity={0.3} />
        <path d={cv.light} fill={g('leafLight')} opacity={0.8} />
      </>
    )
  }
  const groveTrunks = join(...[...rowB, ...rowC].map((p) => rect(p.x - 2.6 * p.s, p.y - 22 * p.s, 5.2 * p.s, 22 * p.s, 2 * p.s)))
  // Buske på engen (de står mellem kendetegnene, så forgrunden ikke er flad og tom).
  const bushes = L.scrub.map((u, i) => {
    const x = w * u + hash01(i + 501) * 14 * K
    const top = ridgeY(L.near, w, x) + 16 * K
    const y = top + hash01(i + 601) * Math.max(4, h - top - 60 * K)
    return [x, y, K * (0.85 + hash01(i + 701) * 0.4)] as const
  })
  const scrub = join(...bushes.map(([x, y, s]) => scallop(x, y - 7 * s, 13 * s, 8 * s, 6, 0.6, -80)))
  const scrubShade = join(...bushes.map(([x, y, s]) => join(lune(x + 1 * s, y - 6.5 * s, 12 * s, 7 * s, 3.2 * s, 20, 160), ellipse(x + 9 * s + SHADOW_SHIFT[0] * K, y + 0.5 * s + SHADOW_SHIFT[1] * K, 14 * s, 2.8 * s))))
  // Regnbuelyset: skrå stråler oppe fra venstre ned i lysningerne.
  const shafts = L.glades.flatMap((p, j) =>
    (['shaft1', 'shaft2', 'shaft3', 'shaft4'] as const).map((c, i) => {
      const x = p.x + (i - 1.5) * 20 * p.s
      const top: Vec = [x - 210 * p.s, p.y - 330 * p.s]
      const wd = (12 + ((i + j) % 2) * 5) * p.s
      return { c, d: poly([[top[0] - wd * 0.35, top[1]], [top[0] + wd * 0.35, top[1]], [x + wd, p.y], [x - wd, p.y]]) }
    }),
  )
  // Hvor langt verdenen er nået (0 i start, 1 i guld): flere blomsterprikker og stærkere regnbuelys.
  const progress = (world - TIER_CHROMA.start) / (1 - TIER_CHROMA.start)
  // Spredte blomsterprikker på forgrunden (flere jo længere verdenen er nået).
  const dots = Math.round(12 + 44 * progress)
  const spots = Array.from({ length: dots }, (_, i) => {
    const x = hash01(i) * w
    const top = ridgeY(L.near, w, x) + 14 * K
    return [x, top + hash01(i + 97) * Math.max(10, h - top - 40 * K), (1.6 + hash01(i + 31) * 1.2) * K] as const
  })
  const daisies = Array.from({ length: Math.round(dots * 0.5) }, (_, i) => {
    const x = hash01(i + 211) * w
    const top = ridgeY(L.mid, w, x) + 24 * K
    return [x, top + hash01(i + 307) * Math.max(8, ridgeY(L.near, w, x) - top - 14 * K), (1.3 + hash01(i + 401)) * K] as const
  })
  // Åen bliver bredere nedstrøms; brinken er et mørkere bånd under vandet.
  const sw = streamWidths(L)
  const tw = trailWidths(L)
  const posts = meadowFence(L, sw)
  const postH = 15 * K
  const pebbles = join(...L.stream.slice(1, 4).map(([x, y], i) => ellipse(x + (sw[i + 1] / 2 + 8 * K) * (i % 2 ? 1 : -1), y + 3 * K, 4.6 * K, 2.8 * K)))
  // Jordskygger (solen oppe til venstre: skyggen falder mod højre).
  const cast = (p: Place, dx: number, rx: number, ry: number) =>
    ellipse(p.x + dx * p.s + SHADOW_SHIFT[0] * K, p.y + 1.5 * p.s + SHADOW_SHIFT[1] * K, rx * p.s, ry * p.s)
  const castMid = join(
    ...L.trees.filter((p) => !p.front).map((p) => cast(p, 14, 30, 6)),
  )
  const castNear = join(
    cast(L.cave, 14, 66, 7),
    cast(L.farm, 22, 66, 6.5),
    cast(L.owl, 16, 30, 6),
    cast(L.panda, 6, 16, 3.5),
    // egernenes træ: skyggen falder mod højre, også når grenen peger mod venstre
    cast(L.squirrels, 14, 30, 6),
    ...L.trees.filter((p) => p.front).map((p) => cast(p, 14, 30, 6)),
  )
  // Forgrundens græskant langs bunden (rammer dioramaet ind).
  const tufts = Array.from({ length: Math.ceil(w / (30 * K)) + 1 }, (_, i) => [i * 30 * K + hash01(i + 7) * 10 * K, h + 2, K * (0.9 + hash01(i + 3) * 0.6)] as const)
  // Regnbuen over skoven (guld i hele verdenen), glimt i luften og sommerfugle (sølv ved Vekselvandet).
  const bow = { x: w * 0.5, y: h * (L.wide ? 0.5 : 0.47), rx: L.wide ? w * 0.4 : w * 0.62, ry: h * (L.wide ? 0.34 : 0.22) }
  const air = (L.wide ? [[0.3, 0.17, 7], [0.58, 0.12, 5], [0.7, 0.29, 6], [0.15, 0.36, 5]] : [[0.3, 0.2, 6], [0.72, 0.27, 7], [0.12, 0.34, 5], [0.86, 0.36, 5]]).map(([u, v, r]) => [w * u, h * v, r * K] as const)
  const flutter = [[L.lake.x - L.lake.rx * 0.8, L.lake.y - 44 * K, 1.3 * K], [L.lake.x + L.lake.rx * 0.3, L.lake.y - 52 * K, 1.1 * K], [L.garden.x + 30 * K, L.garden.y - 62 * K, 1.2 * K]] as const
  const wet = L.stream.slice(1, 4).map(([x, y], i) => [x + (i % 2 ? 6 : -7) * K, y + 6 * K, (4 + i) * K] as const)
  const half = bridgeHalf(L)
  // Linealstien (lyser fra bronze, SPEC §5.6) – fra forgrunden op over Hundredebroen til mølleengen.
  const trail = (
    <>
      <path d={blob(ribbon(L.trail, tw), 0.9)} fill={tb('trail', T.ruler)} stroke={tb('trailEdge', T.ruler)} strokeWidth={1.5 * K} {...ROUND} />
      {lit(T.ruler) && <path d={spline(L.trail)} fill="none" stroke={SKOV.lanternGlow} strokeWidth={3.4 * K} opacity={0.75} {...ROUND} />}
    </>
  )
  // lygtepæle langs stien (de tændes med Linealstien fra bronze), på den side, der vender væk fra åen
  const trailLamps = L.lamps.map((i) => [L.trail[i][0] + (i < 3 ? -1 : 1) * (tw[i] / 2 + 7 * K), L.trail[i][1] - 2 * K] as Vec)
  return (
    <svg
      ref={svgRef}
      className={['skov-scene', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${n(w)} ${n(h)}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      data-scene="skov"
    >
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={g('skyTop')} />
          <stop offset="0.38" stopColor={SKOV.skyMid} />
          <stop offset="0.66" stopColor={SKOV.skyBottom} />
        </linearGradient>
      </defs>
      <path d={rect(0, 0, w, h)} fill={`url(#${sky})`} />
      {/* sol (strålerne kommer med lyset) og skyer */}
      {at(L.sun, (
        <>
          <path d={circle(0, 0, 46)} fill={SKOV.sunHalo} opacity={0.75} />
          {world > 0.8 && <path d={join(...Array.from({ length: 10 }, (_, i) => blob(xf([[-4, -36], [0, -50], [4, -36]], { rot: i * 36 }), 0.4)))} fill={SKOV.sun} opacity={0.75} />}
          <path d={circle(0, 0, 27)} fill={g('sun')} />
        </>
      ))}
      {world >= 1 && (
        <g opacity={0.6}>
          {(['rainbow1', 'rainbow2', 'rainbow3', 'rainbow4', 'rainbow5'] as const).map((c, i) => (
            <path key={c} d={arc(bow.x, bow.y, bow.rx - i * 8 * K, bow.ry - i * 8 * K, 180, 360)} fill="none" stroke={SKOV[c]} strokeWidth={8 * K} />
          ))}
        </g>
      )}
      {L.clouds.map((p, i) => {
        const cl = cloud(p)
        return (
          <g key={i} className={`skov-drift skov-drift-${i % 3}`}>
            <path d={cl.body} fill={SKOV.cloud} opacity={0.94} />
            <path d={cl.shade} fill={SKOV.cloudShade} opacity={0.85} />
          </g>
        )
      })}
      {/* lag 1: de fjerne, blålilla skovbakker */}
      {layer(L.far, R.far, 'farHill', h * 0.04, 0.12)}
      <path d={farCrowns} fill={g('farForest')} />
      {at(L.mountain, <Mountain t={T.mountain} />)}
      {/* lag 2: skovbakken med de høje kroner og tårnet, der rager op over dem */}
      {layer(L.mid, R.mid, 'midHill', h * 0.1, 0.17)}
      {at(L.tower, <Tower t={T.tower} />)}
      {forest(rowA, 'a')}
      <path d={groveTrunks} fill={g('trunk')} stroke={g('trunkDark')} strokeWidth={1.2 * K} />
      {forest(rowB, 'b')}
      {forest(rowC, 'c')}
      <path d={join(...daisies.map(([x, y, r]) => circle(x, y, r)))} fill={SKOV.flowerWhite} opacity={0.85} />
      <path d={castMid} fill={SKOV.castShadow} opacity={0.2} />
      {L.trees.filter((p) => !p.front).map((p, i) => <g key={i}>{at(p, <Tree t={T.garden} seed={i} hue={i % 2 ? 'crownLilac' : 'crownGreen'} />)}</g>)}
      {/* regnbuelyset i lysningerne (ånder blødt) */}
      <g className="skov-shimmer">
        {shafts.map((s, i) => <path key={i} d={s.d} fill={g(s.c)} opacity={n(0.13 + 0.17 * progress)} />)}
      </g>
      {/* lag 3: engen ved søen og forgrunden */}
      {layer(L.near, R.near, 'nearHill', h * 0.12, 0.19)}
      <path d={join(...spots.filter((_, i) => i % 2 === 0).map(([x, y, r]) => circle(x, y, r)))} fill={SKOV.flowerWhite} opacity={0.9} />
      <path d={join(...spots.filter((_, i) => i % 2 === 1).map(([x, y, r]) => circle(x, y, r)))} fill={g('flowerYellow')} />
      <path d={castNear} fill={SKOV.castShadow} opacity={0.22} />
      <path d={scrub} fill={g('crownGreen')} stroke={g('leafDark')} strokeWidth={1.2 * K} {...ROUND} />
      <path d={scrubShade} fill={SKOV.castShadow} opacity={0.22} />
      {(() => {
        // svampekredsen: syv små svampe i en ellipse (de bageste lidt mindre); glimt i kredsen, når skoven er nået langt
        const R = L.ring
        const fung = Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2 + 0.4
          const sy = Math.sin(a)
          return [R.x + Math.cos(a) * 26 * R.s, R.y + sy * 8 * R.s, R.s * (0.78 + 0.22 * (sy + 1) * 0.5)] as const
        }).sort((a, b) => a[1] - b[1])
        return (
          <>
            <path d={join(...fung.map(([x, y, q]) => blob([[x - 1.8 * q, y], [x - 1.5 * q, y - 6 * q], [x + 1.5 * q, y - 6 * q], [x + 1.8 * q, y], [x, y + 1 * q]], 0.6)))} fill={g('stem')} stroke={g('wallShade')} strokeWidth={0.8 * K} {...ROUND} />
            <path d={join(...fung.map(([x, y, q]) => ellipseTop(x, y - 5.5 * q, 5.5 * q, 4.6 * q)))} fill={g('mushroom')} stroke={g('mushroomDark')} strokeWidth={1 * K} {...ROUND} />
            <path d={join(...fung.flatMap(([x, y, q]) => [circle(x - 2 * q, y - 7.6 * q, 0.9 * q), circle(x + 1.6 * q, y - 8.4 * q, 0.8 * q)]))} fill={SKOV.flowerWhite} />
            {progress > 0.5 && <path d={glints([[R.x - 6 * R.s, R.y - 14 * R.s, 3 * R.s], [R.x + 9 * R.s, R.y - 20 * R.s, 2.4 * R.s], [R.x + 2 * R.s, R.y - 4 * R.s, 2 * R.s]])} fill={SKOV.sunHalo} stroke={SKOV.lantern} strokeWidth={0.6 * K} />}
          </>
        )
      })()}
      {at(L.cave, <Cave t={T.cave} />)}
      {at(L.panda, <Bamboo t={T.cave} />)}
      {at(L.panda, <g transform="translate(14 0)"><Panda t={T.cave} /></g>)}
      {trail}
      {/* vandet: vandfaldet fra bjergets fod, søen, åen fra udløbet (bredere nedstrøms) og broen */}
      <Waterfall fall={L.fall} t={T.lake} />
      <Lake lake={L.lake} t={T.lake} k={K} />
      <path d={blob(ribbon(L.stream, sw.map((b) => b + 9 * K)), 0.9)} fill={tb('bank', T.bridge)} />
      <path d={blob(ribbon(L.stream, sw), 0.9)} fill={tb('water', T.bridge)} stroke={tb('waterEdge', T.bridge)} strokeWidth={1.5 * K} {...ROUND} />
      <path d={ellipse(L.stream[0][0], L.stream[0][1] + 2 * K, sw[0] * 0.55, 5 * K)} fill={tb('water', T.lake)} />
      <path d={spline(xf(L.stream.slice(1), { dx: -4 * K }))} fill="none" stroke={SKOV.waterLight} strokeWidth={2.4 * K} opacity={bloom(T.bridge) ? 0.9 : 0.55} {...ROUND} />
      <path d={pebbles} fill={tb('stone', T.bridge)} stroke={tb('stoneShade', T.bridge)} strokeWidth={1.1 * K} />
      {bloom(T.bridge) && <path d={glints(wet)} fill={SKOV.flowerWhite} />}
      {at(L.mill, <Mill t={T.lake} />)}
      {at(L.bridge, <Bridge t={T.bridge} half={half} />)}
      {/* mølleengens hegn stopper ved åen */}
      <path d={join(...posts.map(([x, y]) => rect(x - 1.9 * K, y - postH, 3.8 * K, postH, 1.4 * K)))} fill={tb('wood', T.lake)} stroke={tb('woodDark', T.lake)} strokeWidth={1.2 * K} {...ROUND} />
      {posts.length > 1 && <path d={join(spline(posts.map(([x, y]) => [x, y - postH * 0.8] as Vec)), spline(posts.map(([x, y]) => [x, y - postH * 0.4] as Vec)))} fill="none" stroke={tb('woodDark', T.lake)} strokeWidth={1.7 * K} {...ROUND} />}
      {at(L.posts, <RulerPosts t={T.ruler} />)}
      {lit(T.ruler) && (
        <>
          <path d={join(...trailLamps.map(([x, y]) => rect(x - 1.2 * K, y - 24 * K, 2.4 * K, 24 * K, 1 * K)))} fill={tb('woodDark', T.ruler)} />
          {lanterns(trailLamps.map(([x, y]) => [x, y - 33 * K] as const), 0.9 * K)}
        </>
      )}
      {at(L.owl, <OwlTree t={T.ruler} />)}
      {at(L.farm, <Farm t={T.farm} />)}
      {at(L.squirrels, <SquirrelTree t={T.farm} flip={L.squirrels.flip} />)}
      {at(L.garden, <Garden t={T.garden} />)}
      {(() => {
        // blomsterklynger på engen: 3, 5, 8 og 11 blomster pr. klynge efter Figurhavens trin
        const n0 = [3, 5, 8, 11][rank(T.garden)]
        const pts = L.meadow.flatMap((p, j) =>
          Array.from({ length: n0 }, (_, i) => {
            const a = hash01(i + j * 31 + 900) * Math.PI * 2
            const r = Math.sqrt((i + 0.5) / 11) * 32
            return [p.x + Math.cos(a) * r * p.s, p.y + Math.sin(a) * r * 0.45 * p.s, (3.4 + hash01(i + j * 17) * 1.6) * p.s] as [number, number, number]
          }),
        )
        const warm = flowerPaths(pts.filter((_, i) => i % 3 !== 2))
        const cool = flowerPaths(pts.filter((_, i) => i % 3 === 2))
        return (
          <>
            <path d={grass(L.meadow.flatMap((p) => [[p.x - 22 * p.s, p.y + 4 * p.s, p.s], [p.x + 4 * p.s, p.y + 6 * p.s, 1.2 * p.s], [p.x + 26 * p.s, p.y + 4 * p.s, 0.9 * p.s]] as [number, number, number][]))} fill={tb('front', T.garden)} stroke={tb('frontDark', T.garden)} strokeWidth={1.1 * K} {...ROUND} />
            <path d={warm.petals} fill={tb('flowerPink', T.garden)} stroke={tb('awningShade', T.garden)} strokeWidth={0.8 * K} {...ROUND} />
            <path d={cool.petals} fill={SKOV.flowerWhite} stroke={tb('flowerViolet', T.garden)} strokeWidth={0.8 * K} {...ROUND} />
            <path d={join(warm.hearts, cool.hearts)} fill={tb('flowerHeart', T.garden)} />
          </>
        )
      })()}
      {L.trees.filter((p) => p.front).map((p, i) => <g key={i}>{at(p, <Tree t={T.garden} seed={i + 3} hue="crownTeal" />)}</g>)}
      <path d={grass(tufts)} fill={g('front')} stroke={g('frontDark')} strokeWidth={1.2 * K} {...ROUND} />
      {at(L.corners[0], <Corner t={T.cave} mirror={false} />)}
      {at(L.corners[1], <Corner t={T.bridge} mirror />)}
      {/* sommerfugle over søen og haven (sølv ved Vekselvandet) og glimt i luften (guld i hele verdenen) */}
      {bloom(T.lake) && <path d={butterflies(flutter)} fill={tb('butterfly', T.lake)} stroke={SKOV.outline} strokeWidth={0.6 * K} />}
      {world >= 1 && <path d={glints(air)} fill={SKOV.sunHalo} stroke={SKOV.lantern} strokeWidth={0.8 * K} {...ROUND} />}
    </svg>
  )
}

/** Kortets scene (MapSceneProps): måler sin plads og tegner Regnbueskoven til netop den. */
export default function SkovScene({ tiers, className }: MapSceneProps) {
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
  return <SkovArt w={size.w} h={size.h} tiers={tiers} className={className} svgRef={ref} />
}
