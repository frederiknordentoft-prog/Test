// Stjernefjeldet (verdenen `fjeld`): kortets baggrund – et højt, venligt fjeld under en lys skumringshimmel (lys
// lilla og blå, aldrig mørk), hvor de første stjerner allerede kan ses. Et trin op fra Regnbueskoven: højere,
// klarere og lidt mere storslået, men stadig papir og himmel. Scenen er et diorama i lag med papirkanter: en
// fjern kæde af snetoppe, fjeldmassivet med Tabeltoppen og en gletsjer, fjeldskråningen med granskov, den nære
// fjeldeng og forgrunden med sten, sne og grantræer i hjørnerne. Lagene står i luftperspektiv (blålilla og lyse
// langt væk, varmere og mere mættede forrest), og den lave sol oppe til venstre giver ét lys: et varmt aftenskær
// på de sider af sne og sten, der vender mod den, en kølig formskygge på fjeldenes højre sider (fra kammen ned mod
// foden) og jordskygger, der falder mod højre under alt, der står på jorden.
// Syv kendetegn står for Stjernefjeldets syv regioner og får hver sin farve igen efter regionens tier (SPEC §5.6):
//   den højeste top med et flag og en stenblok med stjerner i tre lige rækker af fire (Tabeltoppen) · en stenbro med
//   tre buer – hundreder, tiere og enere – og gelændere over bækkens kløft (Trecifret bro) · et tårn med en urskive
//   med tydelige 5-minutters-streger og dragen på en afsats (Minuttårnet) · en kløft med afsatser i fire lige store
//   trin og en hængebro med tolv planker i fire lige store fag (Delekløften) · en markedsplads med to boder,
//   markiser, et skilt med en mønt og en målestok (Markedet) · en have med kvadratiske bede i et net af 3 · 4
//   (Arealhaven) · et bageri med en rund kage i vinduet, delt i fire lige store stykker (Brøkbageriet).
// Start er dæmpet pastel (aldrig grå), og dragen sover; bronze tænder lys i vinduer og lygter, vækker dragen og
// sender røg op fra bageriet; sølv får stjernerne til at glimte og sne og is til at skinne; guld er fuld mætning
// med vimpler og flag – og et nordlys over fjeldet, når hele verdenen er guld. Fjeldene, engen, himlen og
// stjernerne følger hele verdenens fremgang. Fjeldets dyr giver liv: en pegasus flyver ved toppen, en venlig drage
// sidder på sin afsats, pingviner står på issøen og en isbjørn går i sneen.
// Vand og is følger terrænet: gletsjeren flyder ned ad fjeldets side, bækken springer ud af gletsjerens tunge,
// løber nedad under Trecifret bros største bue og ud i issøen, bredere og bredere med mørkere brinker. Stien går fra
// Tabeltoppen forbi kendetegnene i kortets rækkefølge (stykkerne lyser, når regionen er nået til bronze).
// Scenen måler sin plads og lægger kendetegnene der, hvor kortets panel ikke dækker: i bredformat i venstre
// strimmel, mellem stien og sidepanelet og under sidepanelet; i højformat i højre side og forneden (på en telefon
// i båndet over kortet og gennem kortets lyse panel). Kun skyerne driver, stjernerne glimter (fra sølv), røgen
// stiger og pegasus' vinger og dragens hale bevæger sig (transform og opacity); alt står stille i rolig tilstand og
// ved reduceret bevægelse. Alle former er husets parametriske primitiver; farverne kommer fra scenes/palette.ts.
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import type { RegionId } from '../../engine/types'
import type { RegionTier } from '../../meta/rewards'
import type { MapSceneProps } from '../../ui/screens/child/map/Backdrop'
import { blob, capsule, circle, ellipse, fmt3, join, lune, n, poly, rect, ribbon, ridge, scallop, spline, star, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import { FJELD, TIER_CHROMA, tintFjeld, tintFjeldBy } from './palette'
import type { FjeldColor } from './palette'
import './fjeld.css'

// ---------------------------------------------------------------------------------------------
// Regionerne og deres kendetegn (i kortets rækkefølge)

export const FJELD_REGIONS = {
  summit: 'w3-tabellen',
  bridge: 'w3-store-tal',
  tower: 'w3-klokken',
  cleft: 'w3-division',
  market: 'w3-penge-maal',
  garden: 'w3-areal',
  bakery: 'w3-broeker',
} as const satisfies Record<string, RegionId>
type Mark = keyof typeof FJELD_REGIONS
/** Kendetegnene i kortets rækkefølge (stien forbinder dem i den). */
export const MARKS = Object.keys(FJELD_REGIONS) as Mark[]
type Tiers = MapSceneProps['tiers']

const tierOf = (tiers: Tiers, mark: Mark): RegionTier => tiers[FJELD_REGIONS[mark]] ?? 'start'
const lit = (t: RegionTier) => t !== 'start'
const bloom = (t: RegionTier) => t === 'silver' || t === 'gold'
const full = (t: RegionTier) => t === 'gold'
/** Trinnet som tal (start 0, bronze 1, sølv 2, guld 3). */
const rank = (t: RegionTier) => (t === 'start' ? 0 : t === 'bronze' ? 1 : t === 'silver' ? 2 : 3)

/** Farvesæt for et kendetegn: grundfarverne tonet efter regionens tier. */
const paint = (t: RegionTier) => (c: FjeldColor) => tintFjeld(c, t)

/** Deterministisk "tilfældighed" (0–1) til spredte stjerner, træer og sneflader. */
const hash01 = (i: number) => {
  const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return v - Math.floor(v)
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// ---------------------------------------------------------------------------------------------
// Layout: alt i skærmens CSS-px (viewBox = pladsen). Kendetegnene tegnes i lokale enheder om deres fodpunkt og
// skaleres med `k` (ca. 1 på en iPad på tværs, 0,7 på en telefon). Solen står oppe til venstre i alle formater.

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
/** En fjeldtop: toppunktet (x, y), den halve bredde ved foden, fodens y og evt. en flad top (halv bredde). */
export interface Peak {
  x: number
  y: number
  hw: number
  base: number
  flat?: number
}
export interface Layout {
  w: number
  h: number
  wide: boolean
  k: number
  /** Den fjerne kæde af snetoppe (bageste og forreste række). */
  far: Peak[]
  far2: Peak[]
  /** Fjeldmassivet bag Tabeltoppen (toppen selv tegnes forrest). */
  massif: Peak[]
  top: Peak
  /** Tabeltoppens flade top, hvor stenblokken står. */
  summit: Place
  mid: Ridge
  near: Ridge
  sun: Place
  clouds: Place[]
  pegasus: Place & { flip: boolean }
  /** Gletsjeren: rygraden fra toppen ned ad fjeldets side (sidste punkt er tungen) og bredden i hvert punkt. */
  glacier: { spine: Vec[]; widths: number[] }
  /** Bækken fra gletsjerens tunge (første punkt) ned under broens store bue og ud i issøen (sidste punkt). */
  stream: Vec[]
  bridge: Place
  tower: Place
  /** Dragens afsats: klippen står på fjeldskråningen (`crag` er klippens højde under afsatsen, lokalt). */
  dragon: Place & { flip: boolean; crag: number }
  cleft: Place
  market: Place
  lake: { x: number; y: number; rx: number; ry: number }
  penguins: Place
  garden: Place
  bakery: Place
  bear: Place & { flip: boolean }
  /** Stien: punkterne mellem to kendetegn i kortets rækkefølge (seks stykker). */
  via: Vec[][]
  /** Så mange af stiens stykker ligger på fjeldskråningen (de tegnes før den nære eng). */
  midLegs: number
  /** Lundene af gran på fjeldskråningen (u-intervaller). */
  forest: [number, number][]
  /** Den lille fjeldby på skråningen (hytter med sne på taget). */
  hamlet: Place[]
  /** Store sten med sne på den nære eng (blomsterne gror ved dem). */
  boulders: Place[]
  /** Snemanden på engen. */
  snowman: Place
  /** Fritstående graner (forrest = på den nære eng). */
  firs: (Place & { front: boolean })[]
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

/** En række fjerne toppe fra venstre til højre (deterministisk højde og bredde). */
function range(w: number, h: number, k: number, o: { gap: number; hw: number; base: number; top: number; spread: number; seed: number }): Peak[] {
  const count = Math.ceil((w + 120 * k) / (o.gap * k)) + 1
  return Array.from({ length: count }, (_, i) => {
    const x = -60 * k + (i + hash01(i + o.seed) * 0.4) * o.gap * k
    return { x, y: h * (o.top + hash01(i + o.seed + 50) * o.spread), hw: o.hw * k * (0.85 + hash01(i + o.seed + 90) * 0.3), base: h * o.base }
  })
}

/** Gletsjeren fra lige under toppen ned ad fjeldets side (i forhold til toppen; tungen er det sidste punkt). */
const glacierAt = (top: Peak, k: number, len: number): Layout['glacier'] => ({
  spine: [[top.x + 20 * k, top.y + 34 * k], [top.x + 30 * k, top.y + len * 0.4], [top.x + 22 * k, top.y + len * 0.72], [top.x + 14 * k, top.y + len]],
  widths: [9 * k, 22 * k, 30 * k, 34 * k],
})

/** Stenbroens store bue (hundrederne) står over bækken: punktet under buen, hvor vandet løber. */
export const archFoot = (b: Place): Vec => [b.x, b.y + 30 * b.s]

export function layoutOf(w: number, h: number): Layout {
  const wide = w >= h
  const on = (r: Ridge, u: number, dv: number, s: number) => ({ x: w * u, y: ridgeY(r, w, w * u) + h * dv, s })
  if (wide) {
    const k = clamp(Math.max(w / 1180, (h / 820) * 0.85), 0.6, 1.4)
    const mid: Ridge = { base: h * 0.6, amp: h * 0.022, waves: 1.05, phase: 2.9 }
    const near: Ridge = { base: h * 0.79, amp: h * 0.02, waves: 0.8, phase: 4.1 }
    const top: Peak = { x: w * 0.645, y: h * 0.205, hw: 270 * k, base: h * 0.66, flat: 20 * k }
    const glacier = glacierAt(top, k, Math.min(168 * k, h * 0.2))
    // broens højre ende (enernes lille bue) står fri af sidepanelet: x + 82 · s < 0,72 · w
    const bridge = { x: w * 0.638, y: h * 0.53, s: k * 1.05 }
    const lake = { x: w * 0.82, y: h * 0.885, rx: 84 * k, ry: 17 * k }
    const snout = glacier.spine[glacier.spine.length - 1]
    const tower = on(mid, 0.075, 0.012, k * 0.88)
    const cleft = on(near, 0.075, 0.03, k * 0.95)
    const summit = { x: top.x, y: top.y, s: k }
    return {
      w, h, wide, k, mid, near, top, summit, glacier,
      far: range(w, h, k, { gap: 150, hw: 105, base: 0.5, top: 0.28, spread: 0.06, seed: 1 }),
      far2: range(w, h, k, { gap: 128, hw: 82, base: 0.53, top: 0.36, spread: 0.05, seed: 7 }),
      massif: [
        { x: w * 0.37, y: h * 0.3, hw: 200 * k, base: h * 0.66 },
        { x: w * 0.085, y: h * 0.34, hw: 170 * k, base: h * 0.66 },
        { x: w * 0.9, y: h * 0.31, hw: 210 * k, base: h * 0.66 },
      ],
      sun: { x: w * 0.085, y: h * 0.2, s: k },
      clouds: [
        { x: w * 0.27, y: h * 0.09, s: k },
        { x: w * 0.53, y: h * 0.05, s: k * 0.8 },
        { x: w * 0.43, y: h * 0.23, s: k * 0.6 },
      ],
      pegasus: { x: w * 0.6, y: h * 0.158, s: k * 0.92, flip: false },
      stream: [snout, [(snout[0] + archFoot(bridge)[0]) / 2 - 4 * k, (snout[1] + archFoot(bridge)[1]) / 2], archFoot(bridge), [w * 0.676, h * 0.66], [w * 0.712, h * 0.78], [w * 0.745, h * 0.86], [lake.x - lake.rx * 0.82, lake.y - 3 * k]],
      bridge,
      tower,
      dragon: { ...on(mid, 0.03, -0.075, k * 0.85), flip: false, crag: (h * 0.075 + 12 * k) / (k * 0.85) },
      cleft,
      market: { x: w * 0.118, y: h * 0.978, s: k * 0.95 },
      lake,
      penguins: { x: lake.x + 6 * k, y: lake.y + 2 * k, s: k * 1.15 },
      garden: { x: w * 0.235, y: h * 0.968, s: k * 1.02 },
      bakery: { x: w * 0.935, y: h * 0.905, s: k * 1.05 },
      bear: { x: w * 0.785, y: h * 0.99, s: k * 0.95, flip: true },
      hamlet: [on(mid, 0.23, 0.012, k * 0.85), on(mid, 0.3, 0.03, k * 0.75), on(mid, 0.44, 0.018, k * 0.8), on(mid, 0.885, 0.02, k * 0.8)],
      boulders: [on(near, 0.4, 0.06, k), on(near, 0.56, 0.12, k * 0.8), on(near, 0.31, 0.15, k * 0.7)],
      snowman: { x: w * 0.172, y: h * 0.885, s: k * 0.9 },
      via: [
        [[top.x + 40 * k, top.y + 30 * k], [top.x + 62 * k, top.y + 78 * k], [top.x + 50 * k, top.y + 122 * k], [top.x + 74 * k, top.y + 160 * k], [bridge.x + 80 * bridge.s, bridge.y]],
        [[bridge.x - 34 * bridge.s, bridge.y], [w * 0.52, h * 0.58], [w * 0.3, h * 0.6], [w * 0.15, h * 0.6]],
        [[w * 0.11, h * 0.63], [w * 0.03, h * 0.68], [cleft.x - 50 * cleft.s, cleft.y - 50 * cleft.s]],
        [[cleft.x + 50 * cleft.s, cleft.y - 50 * cleft.s], [w * 0.14, h * 0.88], [w * 0.135, h * 0.95]],
        [[w * 0.155, h * 1.0]],
        [[w * 0.3, h * 1.0], [w * 0.55, h * 1.01], [w * 0.75, h * 0.955], [w * 0.88, h * 0.935]],
      ],
      midLegs: 2,
      forest: [[0.14, 0.58], [0.73, 1.03]],
      firs: [
        { ...on(near, 0.69, 0.03, k * 1.05), front: true },
        { ...on(near, 0.995, 0.06, k * 1.1), front: true },
        { ...on(mid, 0.6, 0.05, k * 0.8), front: false },
      ],
      corners: [{ x: 0, y: h, s: k * 0.95 }, { x: w, y: h, s: k * 0.9 }],
    }
  }
  // en telefon (høj og smal) viser scenen i båndet over kortet og gennem kortets lyse panel: toppen og flaget står
  // over skoven, uret i båndet, resten midt i panelet. Fjeldene står højt, så himlen fylder en tredjedel og scenen
  // ikke bliver bundtung (som review G2-r2 §5.4 bad om for Regnbueskoven)
  const tall = h / w > 1.7
  if (tall) {
    const k = clamp(Math.max(w / 560, (h / 1250) * 0.9), 0.62, 1)
    const mid: Ridge = { base: h * 0.635, amp: h * 0.014, waves: 0.9, phase: 2.4 }
    const near: Ridge = { base: h * 0.8, amp: h * 0.016, waves: 0.7, phase: 4.1 }
    const top: Peak = { x: w * 0.3, y: h * 0.335, hw: 210 * k, base: h * 0.7, flat: 18 * k }
    const glacier = glacierAt(top, k, 150 * k)
    const snout = glacier.spine[glacier.spine.length - 1]
    const bridge = { x: w * 0.36, y: h * 0.575, s: k * 0.85 }
    const lake = { x: w * 0.56, y: h * 0.745, rx: 80 * k, ry: 15 * k }
    const tower = { x: w * 0.88, y: h * 0.655, s: k }
    const cleft = { x: w * 0.79, y: h * 0.855, s: k * 0.8 }
    return {
      w, h, wide, k, mid, near, top, glacier,
      summit: { x: top.x, y: top.y, s: k * 0.95 },
      far: range(w, h, k, { gap: 130, hw: 100, base: 0.58, top: 0.355, spread: 0.045, seed: 3 }),
      far2: range(w, h, k, { gap: 110, hw: 80, base: 0.6, top: 0.43, spread: 0.035, seed: 9 }),
      massif: [
        { x: w * 0.82, y: h * 0.38, hw: 180 * k, base: h * 0.7 },
        { x: w * -0.1, y: h * 0.4, hw: 150 * k, base: h * 0.7 },
      ],
      sun: { x: w * 0.14, y: h * 0.13, s: k },
      clouds: [
        { x: w * 0.55, y: h * 0.07, s: k },
        { x: w * 0.9, y: h * 0.17, s: k * 0.8 },
        { x: w * 0.3, y: h * 0.23, s: k * 0.6 },
      ],
      pegasus: { x: w * 0.66, y: h * 0.315, s: k * 0.85, flip: false },
      stream: [snout, archFoot(bridge), [w * 0.42, h * 0.68], [w * 0.45, h * 0.725], [lake.x - lake.rx * 0.8, lake.y - 2 * k]],
      bridge,
      tower,
      dragon: { ...on(mid, 0.69, -0.03, k * 0.8), flip: true, crag: (h * 0.03 + 10 * k) / (k * 0.8) },
      hamlet: [on(mid, 0.08, 0.02, k * 0.8), on(mid, 0.6, 0.03, k * 0.7)],
      boulders: [on(near, 0.86, 0.1, k * 0.8), on(near, 0.33, 0.13, k * 0.7)],
      snowman: { x: w * 0.07, y: h * 0.835, s: k * 0.8 },
      cleft,
      market: { x: w * 0.19, y: h * 0.87, s: k * 0.82 },
      lake,
      penguins: { x: lake.x + 8 * k, y: lake.y + 2 * k, s: k * 1.1 },
      garden: { x: w * 0.47, y: h * 0.86, s: k * 0.78 },
      bakery: { x: w * 0.16, y: h * 0.775, s: k * 0.85 },
      bear: { x: w * 0.66, y: h * 0.895, s: k * 0.8, flip: false },
      via: [
        [[top.x + 40 * k, top.y + 30 * k], [top.x + 58 * k, top.y + 70 * k], [top.x + 66 * k, top.y + 110 * k], [bridge.x + 80 * bridge.s, bridge.y]],
        [[bridge.x - 34 * bridge.s, bridge.y], [w * 0.2, h * 0.64], [w * 0.5, h * 0.66], [w * 0.75, h * 0.665]],
        [[w * 0.93, h * 0.7], [w * 0.98, h * 0.77], [cleft.x + 50 * cleft.s, cleft.y - 50 * cleft.s]],
        [[cleft.x - 50 * cleft.s, cleft.y - 50 * cleft.s], [w * 0.5, h * 0.8], [w * 0.3, h * 0.84]],
        [[w * 0.3, h * 0.9], [w * 0.4, h * 0.875]],
        [[w * 0.5, h * 0.825], [w * 0.3, h * 0.8]],
      ],
      midLegs: 2,
      forest: [[0.5, 0.75]],
      firs: [
        { ...on(near, 0.06, 0.03, k), front: true },
        { ...on(near, 0.95, 0.12, k * 1.05), front: true },
      ],
      corners: [{ x: 0, y: h, s: k * 0.85 }, { x: w, y: h, s: k * 0.85 }],
    }
  }
  // iPad på langs: kendetegnene i højre side (under sidepanelet) og forneden
  const k = clamp(w / 860, 0.7, 1.05)
  const mid: Ridge = { base: h * 0.73, amp: h * 0.014, waves: 0.85, phase: 2.5 }
  const near: Ridge = { base: h * 0.85, amp: h * 0.014, waves: 0.7, phase: 4.1 }
  const top: Peak = { x: w * 0.755, y: h * 0.615, hw: 220 * k, base: h * 0.78, flat: 18 * k }
  const glacier = glacierAt(top, k, 130 * k)
  const snout = glacier.spine[glacier.spine.length - 1]
  const bridge = { x: w * 0.79, y: h * 0.8, s: k * 0.85 }
  const lake = { x: w * 0.875, y: h * 0.905, rx: 64 * k, ry: 14 * k }
  const tower = { x: w * 0.6, y: h * 0.78, s: k * 0.85 }
  const cleft = { x: w * 0.655, y: h * 0.905, s: k * 0.74 }
  return {
    w, h, wide, k, mid, near, top, glacier,
    summit: { x: top.x, y: top.y, s: k * 0.9 },
    far: range(w, h, k, { gap: 140, hw: 110, base: 0.74, top: 0.625, spread: 0.035, seed: 5 }),
    far2: range(w, h, k, { gap: 120, hw: 84, base: 0.76, top: 0.665, spread: 0.03, seed: 11 }),
    massif: [
      { x: w * 0.3, y: h * 0.635, hw: 230 * k, base: h * 0.8 },
      { x: w * 1.02, y: h * 0.65, hw: 160 * k, base: h * 0.8 },
    ],
    sun: { x: w * 0.16, y: h * 0.14, s: k },
    // himlen over fjeldet er høj i højformat (den står bag sidepanelet og kortet): flere skyer i lag
    clouds: [
      { x: w * 0.5, y: h * 0.08, s: k * 1.05 },
      { x: w * 0.86, y: h * 0.16, s: k * 0.8 },
      { x: w * 0.3, y: h * 0.24, s: k * 0.6 },
      { x: w * 0.72, y: h * 0.36, s: k * 1.2 },
      { x: w * 0.18, y: h * 0.47, s: k * 0.9 },
    ],
    pegasus: { x: w * 0.62, y: h * 0.6, s: k * 0.8, flip: false },
    stream: [snout, archFoot(bridge), [w * 0.8, h * 0.85], [w * 0.81, h * 0.885], [lake.x - lake.rx * 0.8, lake.y - 2 * k]],
    bridge,
    tower,
    dragon: { ...on(mid, 0.67, -0.025, k * 0.75), flip: true, crag: (h * 0.025 + 10 * k) / (k * 0.75) },
    hamlet: [on(mid, 0.12, 0.012, k * 0.8), on(mid, 0.27, 0.03, k * 0.75), on(mid, 0.42, 0.015, k * 0.8)],
    boulders: [on(near, 0.2, 0.06, k * 0.9), on(near, 0.46, 0.1, k * 0.75)],
    snowman: { x: w * 0.27, y: h * 0.893, s: k * 0.85 },
    cleft,
    market: { x: w * 0.09, y: h * 0.96, s: k * 0.8 },
    lake,
    penguins: { x: lake.x + 6 * k, y: lake.y + 2 * k, s: k * 1.05 },
    garden: { x: w * 0.885, y: h * 0.975, s: k * 0.74 },
    bakery: { x: w * 0.925, y: h * 0.82, s: k * 0.8 },
    bear: { x: w * 0.37, y: h * 0.885, s: k * 0.8, flip: false },
    via: [
      [[top.x + 36 * k, top.y + 26 * k], [top.x + 52 * k, top.y + 60 * k], [top.x + 48 * k, top.y + 96 * k], [bridge.x + 80 * bridge.s, bridge.y]],
      [[bridge.x - 34 * bridge.s, bridge.y], [w * 0.7, h * 0.79]],
      [[w * 0.6, h * 0.83], [cleft.x - 50 * cleft.s, cleft.y - 50 * cleft.s]],
      [[cleft.x + 50 * cleft.s, cleft.y - 50 * cleft.s], [w * 0.5, h * 0.89], [w * 0.25, h * 0.92], [w * 0.15, h * 0.955]],
      [[w * 0.3, h * 1.0], [w * 0.6, h * 1.0], [w * 0.82, h * 0.985]],
      [[w * 0.97, h * 0.93], [w * 0.95, h * 0.85]],
    ],
    midLegs: 2,
    forest: [[0, 0.6]],
    firs: [
      { ...on(near, 0.52, 0.02, k * 0.95), front: true },
      { ...on(near, 0.99, 0.05, k), front: true },
    ],
    corners: [{ x: 0, y: h, s: k * 0.8 }, { x: w, y: h, s: k * 0.75 }],
  }
}

/** Kendetegnets stop på stien (fodpunktet; ved broerne midt på dækket). */
export function stopOf(L: Layout, m: Mark): Vec {
  if (m === 'cleft') return [L.cleft.x, L.cleft.y - CLEFT_RIM * L.cleft.s]
  const p = L[m]
  return [p.x, p.y]
}

/** Stien fra Tabeltoppen forbi alle kendetegn i kortets rækkefølge: ét stykke pr. skridt (fra stop til stop). */
export function trailLegs(L: Layout): Vec[][] {
  return MARKS.slice(1).map((m, i) => [stopOf(L, MARKS[i]), ...L.via[i], stopOf(L, m)])
}

// ---------------------------------------------------------------------------------------------
// Små hjælpere

const at = (p: Place, node: ReactNode, flip = false) => (
  <g transform={`translate(${n(p.x)} ${n(p.y)}) scale(${flip ? `${fmt3(-p.s)} ${fmt3(p.s)}` : fmt3(p.s)})`}>{node}</g>
)
const ROUND = { strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
/** Konturbredde i lokale enheder (en tynd, farvet kontur som dyrenes, men lettere). */
const SW = 1.9
/** Jordskyggerne falder væk fra solen oppe til venstre: forskudt mod højre og ned (px ved k = 1). */
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
      <path d={join(...pts.map(([x, y]) => circle(x, y + 7 * s, 12 * s)))} fill={FJELD.lanternGlow} opacity={0.75} />
      <path d={join(...pts.map(([x, y]) => join(rect(x - 3.6 * s, y + 2 * s, 7.2 * s, 9.5 * s, 2.2 * s), rect(x - 2.4 * s, y - 0.6 * s, 4.8 * s, 2.8 * s, 1))))} fill={FJELD.lantern} stroke={FJELD.lanternFrame} strokeWidth={1.3 * s} {...ROUND} />
    </>
  )
}

/** Røg (x, y): fire bløde puder, der stiger mod højre (vinden følger lyset). */
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
function Bunting({ b, c, a = 'flag', z = 'flowerYellow' }: { b: readonly ReturnType<typeof bunting>[]; c: (k: FjeldColor) => string; a?: FjeldColor; z?: FjeldColor }) {
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
// Fjeldene: toppe med sne, aftenskær på venstre side og en formskygge på højre side (fra kammen ned mod foden)

/** Flankens x i dybden t (0 = toppen, 1 = foden) på venstre (−1) eller højre (+1) side: spids top, bred fod. */
const flank = (p: Peak, side: -1 | 1, t: number) => p.x + side * ((p.flat ?? 0) * (1 - t) + p.hw * t ** 1.2)
const depthY = (p: Peak, t: number) => p.y + (p.base - p.y) * t

/** Én tops former: krop, snehætte med tunger ned ad kløfterne, formskygge, aftenskær og kløfter i stenen. */
export function peakShapes(p: Peak, seed: number, snowAt: number) {
  const T = [1, 0.8, 0.6, 0.42, 0.26, 0.12]
  const jit = (q: number) => (hash01(seed * 7 + q) - 0.5) * 0.05 * p.hw
  const left = T.map((t, q) => [flank(p, -1, t) + jit(q), depthY(p, t)] as Vec)
  const right = [...T].reverse().map((t, q) => [flank(p, 1, t) + jit(q + 20), depthY(p, t)] as Vec)
  const apex: Vec[] = p.flat ? [[flank(p, -1, 0), p.y], [flank(p, 1, 0), p.y]] : [[p.x, p.y]]
  const body = blob([[p.x - p.hw, p.base + 40], ...left, ...apex, ...right, [p.x + p.hw, p.base + 40]], 0.32)
  // snehætten: tunger ned ad kløfterne (dybe og lave punkter skiftevis), en anelse inden for flankerne
  const ts = snowAt * (0.9 + hash01(seed * 3) * 0.2)
  const drips = 7
  const edge = Array.from({ length: drips + 1 }, (_, q) => {
    const u = q / drips
    const t = ts * (q === 0 || q === drips ? 0.85 : q % 2 ? 1.08 + hash01(seed * 11 + q) * 0.12 : 0.66)
    const xr = flank(p, 1, t) - 2
    const xl = flank(p, -1, t) + 2
    return [xr + (xl - xr) * u, depthY(p, t)] as Vec
  })
  const inset = (side: -1 | 1, t: number): Vec => [flank(p, side, t) - side * 2, depthY(p, t)]
  const cap = blob([...apex.map(([x, y]) => [x, y - 0.5] as Vec), inset(1, ts * 0.45), ...edge, inset(-1, ts * 0.45)], 0.3)
  // formskyggen: hele højre side fra kammen (en linje lidt til højre for midten) ned til foden
  const shade = blob([
    p.flat ? [flank(p, 1, 0) - 3, p.y] : [p.x, p.y],
    ...[0.12, 0.42, 0.8].map((t) => [flank(p, 1, t) - 0.5, depthY(p, t)] as Vec),
    [p.x + p.hw, p.base + 40],
    [p.x + p.hw * 0.2, p.base + 40],
    [p.x + p.hw * 0.13, depthY(p, 0.62)],
    [p.x + p.hw * 0.05 + (p.flat ?? 0) * 0.6, depthY(p, 0.26)],
  ], 0.22)
  const glow = spline([0.02, 0.18, 0.36, 0.56].map((t) => [flank(p, -1, t) + 3.5, depthY(p, t) + 1] as Vec))
  const lines = join(
    spline([[p.x - p.hw * 0.12, depthY(p, 0.4)], [p.x - p.hw * 0.2, depthY(p, 0.58)], [p.x - p.hw * 0.3, depthY(p, 0.78)]]),
    spline([[p.x + p.hw * 0.3, depthY(p, 0.46)], [p.x + p.hw * 0.42, depthY(p, 0.66)], [p.x + p.hw * 0.5, depthY(p, 0.86)]]),
    spline([[p.x - p.hw * 0.42, depthY(p, 0.62)], [p.x - p.hw * 0.52, depthY(p, 0.84)]]),
  )
  return { body, cap, shade, glow, lines }
}

/** En række toppe (fem paths for dem alle): krop, sne, formskygge, aftenskær og evt. kløfter i stenen. */
function Peaks({ peaks, seed, fill, snow, snowAt, shadeO, glowO, k, line, paper }: {
  peaks: readonly Peak[]; seed: number; fill: string; snow: string; snowAt: number; shadeO: number; glowO: number; k: number; line?: string; paper?: boolean
}) {
  const sh = peaks.map((p, i) => peakShapes(p, seed + i, snowAt))
  return (
    <>
      {paper && <path d={join(...peaks.map((p, i) => peakShapes({ ...p, y: p.y - 5 * k, base: p.base - 5 * k }, seed + i, snowAt).body))} fill={FJELD.paperShadow} opacity={0.14} />}
      <path d={join(...sh.map((s) => s.body))} fill={fill} />
      {line && <path d={join(...sh.map((s) => s.lines))} fill="none" stroke={line} strokeWidth={1.6 * k} opacity={0.55} {...ROUND} />}
      <path d={join(...sh.map((s) => s.cap))} fill={snow} />
      <path d={join(...sh.map((s) => s.shade))} fill={FJELD.shade} opacity={shadeO} />
      <path d={join(...sh.map((s) => s.glow))} fill="none" stroke={FJELD.alpenglow} strokeWidth={4.4 * k} opacity={glowO * 0.7} {...ROUND} />
    </>
  )
}

/** En gran (lokalt fra foden, 100 enheder ≈ 2 graner): tre lag grene, sne på grenene og skygge på højre side. */
function firShape(x: number, y: number, s: number) {
  const R: Vec[] = [[7.5, -33], [3.5, -32], [12.5, -19], [6.5, -18], [16.5, -4]]
  const o = (pts: readonly Vec[]) => pts.map(([px, py]) => [x + px * s, y + py * s] as Vec)
  const body = poly(o([[0, -47], ...R, [0, -3.5], ...R.map(([px, py]) => [-px, py] as Vec).reverse()]))
  const shade = poly(o([[0, -47], ...R, [1.5, -3.5], [1.2, -20], [0.6, -34]]))
  const snow = join(...[[-2.2, -39, 3.6, 1.7, -55], [-5.4, -26, 4.8, 1.9, -42], [-8.6, -12.5, 5.8, 2.1, -32], [3.4, -27.5, 3.2, 1.4, 40], [5.6, -14, 4.2, 1.6, 32]].map(([px, py, rx, ry, a]) => ellipse(x + px * s, y + py * s, rx * s, ry * s, a)))
  return { body, shade, snow, trunk: rect(x - 2.4 * s, y - 6 * s, 4.8 * s, 7 * s, 1.2 * s) }
}

/** Graner (scenens koordinater): stammer, grene, sne og skygge – fire paths for dem alle. */
function Firs({ pts, fill, edge, snow }: { pts: readonly Place[]; fill: string; edge: string; snow: string }) {
  const f = pts.map((p) => firShape(p.x, p.y, p.s))
  return (
    <>
      <path d={join(...f.map((q) => q.trunk))} fill={FJELD.trunkDark} />
      <path d={join(...f.map((q) => q.body))} fill={fill} stroke={edge} strokeWidth={1.2} {...ROUND} />
      <path d={join(...f.map((q) => q.snow))} fill={snow} />
      <path d={join(...f.map((q) => q.shade))} fill={edge} opacity={0.32} />
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Kendetegnene (lokale enheder om fodpunktet; 100 enheder ≈ et tårns halve højde)

/**
 * Tabeltoppen (lokalt om toppens flade top): en stenblok med sne på toppen og stjerner i tre lige rækker af fire
 * (et lille gitter, 3 · 4), og et flag. Solen fra venstre: højlys på blokkens venstre kant, skygge på højre side.
 * Lanterne ved flaget fra bronze, stjernerne glimter fra sølv, vimpler i guld.
 */
export const STAR_GRID = { rows: 3, cols: 4 } as const
function Summit({ t }: { t: RegionTier }) {
  const c = paint(t)
  const cells = Array.from({ length: STAR_GRID.rows * STAR_GRID.cols }, (_, i) => [-16.5 + (i % STAR_GRID.cols) * 11, -26.5 + Math.floor(i / STAR_GRID.cols) * 9] as const)
  const f = flag(19, -35, 38, 1.2)
  const b = bunting([19.5, -72], [74, -6], 8, 9)
  return (
    <>
      <path d={ellipse(3 + SHADOW_SHIFT[0], 1 + SHADOW_SHIFT[1], 31, 4.2)} fill={FJELD.castShadow} opacity={0.22} />
      <path d={blob([[-25, 1], [-26, -33], [-22, -36], [22, -36], [26, -33], [25, 1]], 0.2)} fill={c('stone')} stroke={c('stoneShade')} strokeWidth={SW} {...ROUND} />
      <path d={blob([[13, -35], [22, -36], [26, -33], [25, 1], [13, 1]], 0.2)} fill={c('stoneShade')} opacity={0.42} />
      <path d={spline([[-23.5, -3], [-24, -30], [-19, -34]])} fill="none" stroke={FJELD.sunlit} strokeWidth={2.6} opacity={0.9} {...ROUND} />
      <path d={blob([[-27, -33], [-20, -39.5], [0, -40.5], [21, -39.5], [27.5, -33], [17, -32], [8, -34], [-4, -31.5], [-15, -33.5]], 0.5)} fill={FJELD.snow} stroke={FJELD.snowShade} strokeWidth={0.9} {...ROUND} />
      <path d={join(...cells.map(([x, y]) => star(x, y, 4.2, 1.9, 5)))} fill={c('starGold')} stroke={c('starEdge')} strokeWidth={0.8} {...ROUND} />
      <path d={f.pole} fill={c('timber')} />
      <path d={f.cloth} fill={c('flag')} stroke={c('awningShade')} strokeWidth={1} {...ROUND} />
      {lit(t) && lanterns([[25, -58]], 0.85)}
      {lit(t) && <path d={rect(19.5, -58.6, 5.5, 1.4, 0.7)} fill={c('woodDark')} />}
      {bloom(t) && <path d={glints([[-13, -36, 3.8], [12, -27, 3.2], [-31, -12, 2.6], [30, -44, 3]])} fill={FJELD.flowerWhite} stroke={FJELD.skyStarGlow} strokeWidth={0.5} />}
      {full(t) && <Bunting b={[b]} c={c} a="flag2" />}
    </>
  )
}

/**
 * Pegasus (lokalt om kroppen; flyver mod venstre): en hvid, forenklet vingehest med lavendel manke og hale; den
 * nære vinge slår blødt (transform). Kun i scenens stil – ikke riggens pegasus.
 */
function Pegasus({ t }: { t: RegionTier }) {
  const c = paint(t)
  const edge = c('stoneShade')
  const wing = blob([[0, 0], [2, -12], [9, -24], [19, -31], [24, -29], [20, -23], [27, -22], [22, -15], [28, -12], [17, -4]], 0.6)
  const feathers = join(spline([[6, -6], [14, -19]]), spline([[10, -4], [20, -14]]))
  return (
    <>
      <g transform="translate(4 -6) rotate(-14)">
        <path d={wing} fill={c('pegasusShade')} stroke={edge} strokeWidth={1} {...ROUND} />
      </g>
      <path d={join(capsule([10, 4], [17, 12], 2.2, 1.8), capsule([14, 3], [22, 8], 2.2, 1.8))} fill={c('pegasusShade')} stroke={edge} strokeWidth={0.9} />
      <path d={blob([[16, -3], [26, -6], [34, -2], [30, 3], [36, 9], [24, 5], [15, 3]], 0.7)} fill={c('pegasusMane')} stroke={c('pegasusManeDark')} strokeWidth={0.9} {...ROUND} />
      <path d={join(ellipse(2, 0, 17, 9), blob([[-11, -3], [-17, -15], [-20, -21], [-13, -22], [-6, -10], [-3, -5]], 0.7), ellipse(-22, -20, 7.5, 5.2, -24))} fill={c('pegasus')} stroke={edge} strokeWidth={1.1} {...ROUND} />
      <path d={join(capsule([-8, 5], [-15, 11], 2.2, 1.8), capsule([-3, 6], [-8, 14], 2.2, 1.8))} fill={c('pegasus')} stroke={edge} strokeWidth={0.9} />
      <path d={lune(3, 1, 15, 7.5, 3, 15, 150)} fill={c('pegasusShade')} opacity={0.9} />
      <path d={join(blob([[-17, -24], [-15, -30], [-12, -24]], 0.4), blob([[-12, -21], [-6, -17], [-4, -10], [-9, -12], [-14, -17]], 0.7))} fill={c('pegasusMane')} stroke={c('pegasusManeDark')} strokeWidth={0.8} {...ROUND} />
      <path d={join(circle(-23, -21.5, 1.3), ellipse(-28.4, -17.6, 0.8, 0.6))} fill={FJELD.eye} />
      <g transform="translate(-1 -7)">
        <g className="fjeld-flap">
          <path d={wing} fill={c('pegasus')} stroke={edge} strokeWidth={1.1} {...ROUND} />
          <path d={feathers} fill="none" stroke={c('pegasusShade')} strokeWidth={1.2} {...ROUND} />
        </g>
      </g>
    </>
  )
}

/**
 * Trecifret bro (lokalt om den store bue ved dækket): en stenbro med tre buer – en stor (hundreder), en mellem
 * (tiere) og en lille (enere) – over bækkens kløft, hvor jorden stiger mod højre; to gelændere (et bag dækket og et
 * foran). Buerne er huller (evenodd), så kløften og vandet ses igennem. Lygter fra bronze, vimpler i guld.
 */
export const BRIDGE_ARCHES = [
  { x0: -20, x1: 20, top: 6, bottom: 39 },
  { x0: 27, x1: 50, top: 9, bottom: 30 },
  { x0: 57, x1: 69, top: 11, bottom: 23 },
] as const
const BRIDGE_SPAN = [-30, 78] as const
function ArchBridge({ t }: { t: RegionTier }) {
  const c = paint(t)
  const [a, z] = BRIDGE_SPAN
  const deckY = (x: number) => -3 * (1 - ((x - (a + z) / 2) / ((z - a) / 2)) ** 2)
  const xs = Array.from({ length: 9 }, (_, i) => a + ((z - a) * i) / 8)
  const body = blob([...xs.map((x) => [x, deckY(x) - 0.5] as Vec), [z + 1, 16], [71, 25], [53, 32], [22, 41], [-22, 41], [a - 1, 30]], 0.3)
  const holes = join(...BRIDGE_ARCHES.map(({ x0, x1, top, bottom }) => {
    const r = (x1 - x0) / 2
    return blob([[x0, bottom], [x0, top + r * 0.7], [x0 + r * 0.3, top + r * 0.18], [(x0 + x1) / 2, top], [x1 - r * 0.3, top + r * 0.18], [x1, top + r * 0.7], [x1, bottom]], 0.6)
  }))
  const rail = (dy: number) => join(spline(xs.map((x) => [x, deckY(x) + dy - 9] as Vec)), ...xs.map((x) => poly([[x, deckY(x) + dy - 9], [x, deckY(x) + dy]], false)))
  const b = bunting([a, deckY(a) - 7], [z, deckY(z) - 7], 10, 4)
  return (
    <>
      <path d={rail(-4)} fill="none" stroke={c('stoneDark')} strokeWidth={2} {...ROUND} />
      <path d={join(body, holes)} fill={c('stone')} fillRule="evenodd" stroke={c('stoneShade')} strokeWidth={1.4} {...ROUND} />
      <path d={join(...BRIDGE_ARCHES.map(({ x1, top, bottom }) => blob([[x1 + 0.5, top + 6], [x1 + 6, top + 3], [x1 + 6, bottom], [x1 + 0.5, bottom]], 0.3)))} fill={c('stoneShade')} opacity={0.5} />
      <path d={band(xs.map((x) => [x, deckY(x) - 4.5] as Vec), xs.map((x) => [x, deckY(x) + 0.8] as Vec))} fill={c('trail')} />
      <path d={spline(xs.slice(1, -1).map((x) => [x, deckY(x) + 2.2] as Vec))} fill="none" stroke={FJELD.sunlit} strokeWidth={1.4} opacity={0.8} {...ROUND} />
      <path d={rail(4)} fill="none" stroke={c('woodDark')} strokeWidth={2.2} {...ROUND} />
      {lit(t) && lanterns([[a, deckY(a) - 6], [z, deckY(z) - 6]], 0.85)}
      {full(t) && <Bunting b={[b]} c={c} a="flag2" />}
    </>
  )
}

/**
 * Minuttårnet (lokalt fra tårnets fod): et slankt tårn af lys sten med en stor urskive med tolv tydelige
 * 5-minutters-streger (længere ved kvartererne); viserne viser fem minutter i halv elleve (tyk timeviser i blæk,
 * lang rød minutviser). Spidst violet tag med sne. Vindue og lanterne lyser fra bronze, glimt fra sølv, flag og
 * fugle i guld.
 */
export const CLOCK_TICKS = 12
function Tower({ t }: { t: RegionTier }) {
  const c = paint(t)
  const cy = -132
  const r = 18
  const ticks = join(...Array.from({ length: CLOCK_TICKS }, (_, i) => {
    const a = (i * Math.PI) / 6
    const r0 = i % 3 === 0 ? r - 8 : r - 6.2
    return capsule([Math.sin(a) * (r - 2.6), cy - Math.cos(a) * (r - 2.6)], [Math.sin(a) * r0, cy - Math.cos(a) * r0], i % 3 === 0 ? 1.15 : 0.85)
  }))
  // fem minutter i halv elleve: minutviseren peger på 5 (25 minutter), timeviseren lidt forbi 10
  const ang = (q: number) => (q * Math.PI) / 180
  const hour = ang((10 + 25 / 60) * 30)
  const minute = ang(25 * 6)
  const f = flag(0, -218, 24)
  return (
    <>
      <path d={blob([[-15, 1], [-14, -106], [14, -106], [15, 1]], 0.12)} fill={c('stone')} stroke={c('stoneShade')} strokeWidth={SW} {...ROUND} />
      <path d={blob([[5, 0], [5, -105], [14, -106], [15, 1]], 0.12)} fill={c('stoneShade')} opacity={0.5} />
      <path d={join(rect(-21, -158, 42, 54, 5), rect(-18, -8, 36, 9, 3))} fill={c('stone')} stroke={c('stoneShade')} strokeWidth={SW} {...ROUND} />
      <path d={join(rect(8, -157, 13, 52, 4), rect(8, -8, 10, 9, 2))} fill={c('stoneShade')} opacity={0.45} />
      <path d={spline([[-19, -110], [-19.5, -150], [-15, -156.5]])} fill="none" stroke={FJELD.sunlit} strokeWidth={2.6} opacity={0.9} {...ROUND} />
      <path d={join(rect(-5, -82, 10, 17, 5), rect(-6, -26, 12, 18, 6))} fill={lit(t) ? c('windowLit') : c('window')} stroke={c('timber')} strokeWidth={1.4} {...ROUND} />
      <path d={rect(-6, -26, 12, 18, 6)} fill={c('door')} opacity={0.85} />
      <path d={circle(0, cy, r)} fill={c('clockFace')} stroke={c('stoneDark')} strokeWidth={2.4} />
      <path d={ticks} fill={FJELD.clockInk} />
      <path d={capsule([0, cy], [Math.sin(hour) * 9.5, cy - Math.cos(hour) * 9.5], 2.1)} fill={FJELD.clockInk} />
      <path d={capsule([0, cy], [Math.sin(minute) * 14.5, cy - Math.cos(minute) * 14.5], 1.3)} fill={c('clockMinute')} />
      <path d={circle(0, cy, 2)} fill={FJELD.clockInk} />
      <path d={blob([[-27, -156], [0, -218], [27, -156]], 0.28)} fill={c('roof')} stroke={c('roofShade')} strokeWidth={SW} {...ROUND} />
      <path d={blob([[0, -218], [27, -156], [7, -156]], 0.28)} fill={c('roofShade')} opacity={0.45} />
      <path d={join(blob([[-28, -155], [-24, -163], [0, -165], [24, -163], [28, -155], [14, -158], [0, -156], [-14, -158]], 0.5), blob([[-5, -205], [0, -218], [5, -205], [0, -203]], 0.5))} fill={FJELD.snow} stroke={FJELD.snowShade} strokeWidth={0.9} {...ROUND} />
      {lit(t) && lanterns([[18, -40]], 0.9)}
      {bloom(t) && <path d={glints([[-14, -170, 3.2], [22, -120, 2.8], [-26, -150, 2.4]])} fill={FJELD.flowerWhite} stroke={FJELD.skyStarGlow} strokeWidth={0.5} />}
      {full(t) && (
        <>
          <path d={f.pole} fill={c('timber')} />
          <path d={f.cloth} fill={c('flag')} stroke={c('awningShade')} strokeWidth={1} {...ROUND} />
          <path d={birds([[30, -222, 1.1], [45, -232, 0.85]])} fill="none" stroke={FJELD.bird} strokeWidth={1.8} {...ROUND} />
        </>
      )}
    </>
  )
}

/**
 * Dragen på sin afsats (lokalt fra afsatsens kant): en lille, venlig, grøn drage, der sidder på en klippeafsats med
 * sne; halen svinger blødt. Den sover (lukkede øjne) i start og er vågen med en lille røgsky fra bronze.
 */
function Dragon({ t, crag }: { t: RegionTier; crag: number }) {
  const c = paint(t)
  const awake = lit(t)
  const H = Math.max(14, crag)
  return (
    <>
      <path d={ellipse(8 + SHADOW_SHIFT[0], H + SHADOW_SHIFT[1], 34, 5)} fill={FJELD.castShadow} opacity={0.22} />
      <path d={blob([[-30, 2], [-26, -8], [-12, -12], [14, -12], [28, -7], [32, 2], [24, H * 0.45], [34, H], [8, H + 3], [-26, H], [-20, H * 0.5], [-26, 10]], 0.5)} fill={c('rock')} stroke={c('rockShade')} strokeWidth={SW} {...ROUND} />
      <path d={blob([[8, -12], [28, -7], [32, 2], [24, H * 0.45], [34, H], [12, H + 2], [14, H * 0.4], [10, 2]], 0.5)} fill={c('rockShade')} opacity={0.4} />
      <path d={spline([[-24, H * 0.9], [-19, H * 0.5], [-25, 8], [-27, -6]])} fill="none" stroke={FJELD.sunlit} strokeWidth={2.4} opacity={0.8} {...ROUND} />
      <path d={blob([[-31, -6], [-24, -12], [0, -14], [20, -12], [30, -6], [16, -7], [2, -9], [-14, -8]], 0.5)} fill={FJELD.snow} stroke={FJELD.snowShade} strokeWidth={0.9} {...ROUND} />
      <g transform="translate(9 -16)">
        <g className="fjeld-tail">
          <path d={blob([[0, 0], [8, -1], [16, -5], [21, -11], [26, -12], [23, -6], [27, -3], [21, -4], [14, 2], [4, 4]], 0.7)} fill={c('dragon')} stroke={c('dragonDark')} strokeWidth={1.1} {...ROUND} />
        </g>
      </g>
      <path d={blob([[-6, -38], [-1, -50], [5, -44], [9, -40]], 0.6)} fill={c('dragonWing')} stroke={c('dragonDark')} strokeWidth={1} {...ROUND} />
      <path d={join(blob([[-12, -12], [-13, -26], [-8, -36], [4, -37], [11, -27], [11, -12], [0, -10]], 0.8), ellipse(-11, -42, 10.5, 9))} fill={c('dragon')} stroke={c('dragonDark')} strokeWidth={1.2} {...ROUND} />
      <path d={join(ellipse(-3, -22, 6, 9), ellipse(-17.5, -38.5, 4.6, 3.6))} fill={c('dragonBelly')} />
      <path d={join(blob([[-16, -50], [-15, -57], [-11, -50]], 0.4), blob([[-8, -50], [-5, -56], [-4, -49]], 0.4))} fill={c('dragonBelly')} stroke={c('dragonDark')} strokeWidth={0.9} {...ROUND} />
      <path d={join(capsule([-9, -12], [-11, -2], 2.6), capsule([5, -12], [6, -2], 2.6))} fill={c('dragon')} stroke={c('dragonDark')} strokeWidth={1} />
      <path d={lune(-2, -22, 10, 12, 3, 10, 120)} fill={c('dragonDark')} opacity={0.3} />
      {awake ? (
        <path d={join(circle(-13, -44, 1.6), circle(-6, -44.5, 1.5))} fill={FJELD.eye} />
      ) : (
        <path d={join(spline([[-15, -44], [-13, -42.6], [-11, -44]]), spline([[-8, -44.4], [-6, -43], [-4, -44.4]]))} fill="none" stroke={c('dragonDark')} strokeWidth={1.1} {...ROUND} />
      )}
      <path d={join(circle(-20, -39, 0.8), circle(-17.5, -39.5, 0.8))} fill={c('dragonDark')} />
      <path d={ellipse(-15, -37, 2.4, 1.2)} fill={FJELD.blush} opacity={0.8} />
      {awake && (
        <g className="fjeld-puff">
          <path d={join(circle(-26, -46, 3.4), circle(-31, -51, 4.4), circle(-38, -54, 3.6))} fill={FJELD.smoke} opacity={0.92} />
        </g>
      )}
    </>
  )
}

/**
 * Delekløften (lokalt om kløftens midte ved jorden): to klippeskuldre med afsatser i fire lige store trin ned mod en
 * dyb kløft og en hængebro med tolv planker, delt i fire lige store fag af hængerne. Solen fra venstre: den venstre
 * skulders trin vender væk fra solen (skygge), den højres vender mod den (højlys). Sne på hvert trin. Lygter på
 * stolperne fra bronze, sneen glimter fra sølv, vimpler på bærerebet i guld.
 */
export const CLEFT_STEPS = 4
export const CLEFT_STEP = 10
export const PLANKS = 12
export const PLANK_BAYS = 4
const CLEFT_RIM = 50
function Cleft({ t }: { t: RegionTier }) {
  const c = paint(t)
  const top = -CLEFT_RIM
  // trinene: fra kanten (x = ±40) ned mod kløften (x = ±12), lige høje og lige brede
  const stair = (side: -1 | 1): Vec[] => {
    const pts: Vec[] = []
    for (let i = 0; i < CLEFT_STEPS; i++) {
      const x = side * (40 - i * 7)
      pts.push([x, top + i * CLEFT_STEP], [x, top + (i + 1) * CLEFT_STEP])
    }
    pts.push([side * 12, top + CLEFT_STEPS * CLEFT_STEP], [side * 12, 3])
    return pts
  }
  const shoulder = (side: -1 | 1) => poly([[side * 74, 3], [side * 66, -22], [side * 56, top + 1], [side * 48, top], ...stair(side)])
  const risers = (side: -1 | 1) => join(...Array.from({ length: CLEFT_STEPS }, (_, i) => rect(side > 0 ? 40 - i * 7 - 0.2 : -(40 - i * 7) - 2.6, top + i * CLEFT_STEP + 0.8, 2.8, CLEFT_STEP - 0.8, 0.6)))
  const snowTops = join(
    ...([-1, 1] as const).flatMap((side) => Array.from({ length: CLEFT_STEPS }, (_, i) => {
      const x0 = side * (40 - i * 7)
      const x1 = side * (40 - (i + 1) * 7 + 0.5)
      return rect(Math.min(x0, x1) - 0.4, top + (i + 1) * CLEFT_STEP - 1.6, Math.abs(x1 - x0) + 0.8, 2.6, 1.2)
    })),
    blob([[-72, -20], [-64, -40], [-54, -51.5], [-41, -51.5], [-41, -48.5], [-56, -47], [-64, -34]], 0.5),
    blob([[72, -20], [64, -40], [54, -51.5], [41, -51.5], [41, -48.5], [56, -47], [64, -34]], 0.5),
  )
  // hængebroen: bærereb mellem stolperne, dækket som en kædelinje af tolv planker og hængere mellem hvert fag
  const post = 46
  const sag = 10
  const deck = (x: number) => top - 1 + sag * (1 - (x / 42) ** 2)
  const rope = (x: number) => top - 16 + (sag + 3) * (1 - (x / post) ** 2)
  const pw = 84 / PLANKS
  const planks = join(...Array.from({ length: PLANKS }, (_, i) => {
    const x = -42 + (i + 0.5) * pw
    return blob(xf([[-pw * 0.42, -1.3], [pw * 0.42, -1.3], [pw * 0.42, 1.3], [-pw * 0.42, 1.3]], { dx: x, dy: deck(x), rot: Math.atan((-2 * sag * x) / 42 ** 2) * (180 / Math.PI) }), 0.2)
  }))
  const hangers = join(...Array.from({ length: PLANK_BAYS - 1 }, (_, i) => {
    const x = -42 + (i + 1) * (PLANKS / PLANK_BAYS) * pw
    return poly([[x, rope(x)], [x, deck(x) - 1.3]], false)
  }))
  const ropes = (dy: number) => join(spline(Array.from({ length: 9 }, (_, i) => -post + (i * 2 * post) / 8).map((x) => [x, rope(x) + dy] as Vec)), spline([[-post, top - 16 + dy], [-42, deck(-42) - 1]]), spline([[post, top - 16 + dy], [42, deck(42) - 1]]))
  const b = bunting([-post, top - 16], [post, top - 16], 10, sag + 3)
  return (
    <>
      <path d={poly([[-42, top], [42, top], [14, 3], [-14, 3]])} fill={c('gorge')} />
      <path d={rect(-12, top + 34, 24, 8, 3)} fill={c('snowShade')} opacity={0.7} />
      <path d={join(shoulder(-1), shoulder(1))} fill={c('rock')} stroke={c('rockShade')} strokeWidth={SW} {...ROUND} />
      <path d={join(risers(-1), poly([[48, top], [56, top + 1], [66, -22], [74, 3], [60, 3]]))} fill={c('rockShade')} opacity={0.5} />
      <path d={risers(1)} fill={FJELD.sunlit} opacity={0.75} />
      <path d={spline([[-72, 0], [-65, -24], [-55, -48]])} fill="none" stroke={FJELD.sunlit} strokeWidth={2.6} opacity={0.85} {...ROUND} />
      <path d={snowTops} fill={FJELD.snow} />
      <path d={ropes(-1.5)} fill="none" stroke={c('rope')} strokeWidth={1.1} opacity={0.75} {...ROUND} />
      <path d={join(rect(-post - 1.6, top - 17, 3.2, 18, 1.2), rect(post - 1.6, top - 17, 3.2, 18, 1.2))} fill={c('woodDark')} />
      <path d={planks} fill={c('wood')} stroke={c('woodDark')} strokeWidth={0.8} {...ROUND} />
      <path d={join(ropes(0), hangers)} fill="none" stroke={c('rope')} strokeWidth={1.3} {...ROUND} />
      {lit(t) && lanterns([[-post, top - 27], [post, top - 27]], 0.8)}
      {bloom(t) && <path d={glints([[-30, top + 18, 2.8], [23, top + 28, 2.6], [-60, top + 8, 2.4], [52, top - 2, 2.6]])} fill={FJELD.flowerWhite} stroke={FJELD.skyStarGlow} strokeWidth={0.5} />}
      {full(t) && <Bunting b={[b]} c={c} a="flag" z="flowerYellow" />}
    </>
  )
}

/**
 * Markedet (lokalt fra pladsens forkant): to boder med stribede markiser (sne på taget), disk med varer, et skilt med
 * en mønt og en målestok med centimeterbånd. Lanterner fra bronze, sneen glimter fra sølv, vimpler i guld.
 */
function Market({ t }: { t: RegionTier }) {
  const c = paint(t)
  const stall = (x0: number, x1: number, hue: FjeldColor, shade: FjeldColor) => {
    const w = x1 - x0
    const stripes = join(...[0.2, 0.5, 0.8].map((q) => blob([[x0 + w * q - 4, -46], [x0 + w * q + 4, -46], [x0 + w * q + 5, -33], [x0 + w * q - 5, -33]], 0.1)))
    const scallops = join(...Array.from({ length: 4 }, (_, i) => blob([[x0 + 2 + i * (w - 4) / 4, -33.5], [x0 + 2 + (i + 1) * (w - 4) / 4, -33.5], [x0 + 2 + (i + 0.5) * (w - 4) / 4, -27.5]], 0.6)))
    return (
      <>
        <path d={join(rect(x0 + 2, -38, 3, 38, 1.2), rect(x1 - 5, -38, 3, 38, 1.2))} fill={c('wood')} stroke={c('woodDark')} strokeWidth={1} {...ROUND} />
        <path d={rect(x0, -15, w, 15, 2.5)} fill={c('wood')} stroke={c('woodDark')} strokeWidth={1.4} {...ROUND} />
        <path d={rect(x1 - 11, -15, 11, 15, 2)} fill={c('woodDark')} opacity={0.3} />
        <path d={blob([[x0 - 4, -33], [x0 + 3, -48], [x1 - 3, -48], [x1 + 4, -33]], 0.15)} fill={c(hue)} stroke={c(shade)} strokeWidth={1.5} {...ROUND} />
        <path d={stripes} fill={c('awningLight')} opacity={0.92} />
        <path d={scallops} fill={c(hue)} stroke={c(shade)} strokeWidth={1} {...ROUND} />
        <path d={blob([[x0 + 1, -47], [x0 + 4, -51], [x1 - 4, -51], [x1 - 1, -47], [(x0 + x1) / 2, -45.5]], 0.5)} fill={FJELD.snow} stroke={FJELD.snowShade} strokeWidth={0.8} {...ROUND} />
      </>
    )
  }
  // målestokken: ti lige store bånd (skiftevis gule og hvide) med streger
  const bands = (odd: boolean) => join(...Array.from({ length: 10 }, (_, i) => i).filter((i) => i % 2 === (odd ? 1 : 0)).map((i) => rect(-72, -5 - (i + 1) * 5.4, 6, 5.4)))
  const b = bunting([-69, -60], [62, -52], 12, 10)
  return (
    <>
      <path d={ellipse(-2, 1, 80, 6)} fill={c('stone')} stroke={c('stoneShade')} strokeWidth={1} />
      <path d={join(ellipse(-26 + SHADOW_SHIFT[0], 1 + SHADOW_SHIFT[1], 24, 3), ellipse(22 + SHADOW_SHIFT[0], 1 + SHADOW_SHIFT[1], 22, 3))} fill={FJELD.castShadow} opacity={0.22} />
      {stall(-50, -6, 'awning', 'awningShade')}
      {stall(2, 42, 'awning2', 'awning2Shade')}
      <path d={join(circle(-40, -17.5, 3.2), circle(-33, -18.5, 3.2), circle(-26, -17.5, 3.2))} fill={c('apple')} stroke={c('roofRedShade')} strokeWidth={0.8} />
      <path d={join(rect(10, -23, 8, 8, 1.5), rect(21, -21, 7, 6, 1.5), ellipse(33, -17.5, 4.5, 2.4))} fill={c('cake')} stroke={c('woodDark')} strokeWidth={0.8} {...ROUND} />
      {/* skiltet med mønten */}
      <path d={join(rect(55, -50, 2.6, 50, 1.2), rect(46, -51, 16, 2.4, 1.2))} fill={c('woodDark')} />
      <path d={rect(46, -45, 18, 17, 3)} fill={c('wall')} stroke={c('timber')} strokeWidth={1.2} {...ROUND} />
      <path d={circle(55, -36.5, 6.2)} fill={c('coin')} stroke={c('coinDark')} strokeWidth={1.3} />
      <path d={join(circle(55, -36.5, 3.6), ellipse(53, -39, 1.7, 0.9, -30))} fill="none" stroke={c('coinDark')} strokeWidth={0.9} />
      {/* målestokken */}
      <path d={rect(-73, -61, 8, 62, 2)} fill={c('ruler')} stroke={c('rulerEdge')} strokeWidth={1.2} {...ROUND} />
      <path d={bands(true)} fill={c('awningLight')} />
      <path d={join(...Array.from({ length: 10 }, (_, i) => poly([[-73, -5 - (i + 1) * 5.4], [-69.5, -5 - (i + 1) * 5.4]], false)))} fill="none" stroke={c('rulerEdge')} strokeWidth={0.9} />
      <path d={join(ellipse(-69, -61, 5.5, 2.4), rect(-71.5, -2, 4, 3, 1))} fill={FJELD.snow} />
      {lit(t) && lanterns([[-28, -44], [22, -44]], 0.8)}
      {bloom(t) && <path d={glints([[-40, -54, 3], [30, -54, 2.8], [55, -49, 2.4]])} fill={FJELD.flowerWhite} stroke={FJELD.skyStarGlow} strokeWidth={0.5} />}
      {full(t) && <Bunting b={[b]} c={c} a="flag2" />}
    </>
  )
}

/**
 * Arealhaven (lokalt fra havens forkant): kvadratiske bede i et net af 3 · 4 (set lidt oppefra), stier mellem dem
 * og en lav hæk. Spirer i 3 bede i start og 6 fra bronze (og lanterner ved lågen); blomster i 9 bede fra sølv og i
 * alle 12 i guld, med vimpler.
 */
export const GARDEN_GRID = { rows: 3, cols: 4 } as const
function Garden({ t }: { t: RegionTier }) {
  const c = paint(t)
  const FL: Vec = [-52, -2]
  const FR: Vec = [52, -2]
  const BR: Vec = [42, -30]
  const BL: Vec = [-42, -30]
  const P = (u: number, v: number): Vec => {
    const top: Vec = [BL[0] + (BR[0] - BL[0]) * u, BL[1] + (BR[1] - BL[1]) * u]
    const bot: Vec = [FL[0] + (FR[0] - FL[0]) * u, FL[1] + (FR[1] - FL[1]) * u]
    return [top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v]
  }
  const { rows, cols } = GARDEN_GRID
  const g = 0.07
  const cells = Array.from({ length: rows * cols }, (_, i) => {
    const r = Math.floor(i / cols)
    const q = i % cols
    const [u0, u1, v0, v1] = [(q + g) / cols, (q + 1 - g) / cols, (r + g) / rows, (r + 1 - g) / rows]
    return { d: poly([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)]), mid: P((q + 0.5) / cols, (r + 0.55) / rows), r }
  })
  // hvilke bede der gror: de første i en fast, spredt rækkefølge
  const order = [5, 2, 8, 11, 0, 6, 9, 3, 10, 1, 4, 7]
  const sprouts = order.slice(0, [3, 6, 6, 6][rank(t)]).map((i) => cells[i])
  const flowers = order.slice(0, [0, 0, 9, 12][rank(t)]).map((i) => cells[i])
  const fl = flowerPaths(flowers.map(({ mid, r }) => [mid[0], mid[1] - 1, 2.6 + r * 0.4] as [number, number, number]))
  const tuft = (x: number, y: number, s: number) => blob([[x - 3 * s, y], [x - 2.4 * s, y - 4 * s], [x - 0.6 * s, y - 1.8 * s], [x, y - 5.6 * s], [x + 0.8 * s, y - 1.8 * s], [x + 2.6 * s, y - 4.4 * s], [x + 3 * s, y]], 0.4)
  const b = bunting([-58, -40], [58, -40], 12, 6)
  return (
    <>
      <path d={ellipse(6 + SHADOW_SHIFT[0], 0 + SHADOW_SHIFT[1], 58, 5)} fill={FJELD.castShadow} opacity={0.2} />
      <path d={join(...Array.from({ length: 7 }, (_, i) => scallop(-42 + i * 14, -31, 8.5, 5, 5, 0.6, -90)))} fill={c('hedge')} stroke={c('hedgeShade')} strokeWidth={1.1} {...ROUND} />
      <path d={poly([[FL[0] - 3, FL[1] + 1.5], [FR[0] + 3, FR[1] + 1.5], [BR[0] + 2.5, BR[1] - 1], [BL[0] - 2.5, BL[1] - 1]])} fill={c('trail')} stroke={c('stoneShade')} strokeWidth={1} {...ROUND} />
      <path d={join(...cells.map((q) => q.d))} fill={c('soil')} stroke={c('soilDark')} strokeWidth={0.9} {...ROUND} />
      <path d={join(...sprouts.map(({ mid, r }) => tuft(mid[0], mid[1] + 1.5, 0.75 + r * 0.15)))} fill={c('sprout')} />
      {flowers.length > 0 && (
        <>
          <path d={fl.petals} fill={c('flowerPink')} />
          <path d={fl.hearts} fill={c('flowerYellow')} />
        </>
      )}
      <path d={join(rect(-58, -18, 4, 18, 1.5), rect(54, -18, 4, 18, 1.5))} fill={c('wood')} stroke={c('woodDark')} strokeWidth={1} {...ROUND} />
      {lit(t) && lanterns([[-56, -30], [56, -30]], 0.8)}
      {full(t) && <Bunting b={[b]} c={c} a="flag" z="flowerViolet" />}
    </>
  )
}

/**
 * Brøkbageriet (lokalt fra husets fod): et lille bageri med sne på taget, skorsten og et rundt vindue med en kage,
 * delt i fire lige store stykker. Vinduerne lyser og skorstenen ryger fra bronze, sneen glimter og kagen får bær fra
 * sølv, vimpler under taget i guld.
 */
export const CAKE_PIECES = 4
function Bakery({ t }: { t: RegionTier }) {
  const c = paint(t)
  const cx = -11
  const cy = -21
  const cuts = join(...Array.from({ length: CAKE_PIECES / 2 }, (_, i) => {
    const a = (i * Math.PI * 2) / CAKE_PIECES + Math.PI / 4
    return poly([[cx - Math.cos(a) * 8.2, cy - Math.sin(a) * 8.2], [cx + Math.cos(a) * 8.2, cy + Math.sin(a) * 8.2]], false)
  }))
  const berries = join(...Array.from({ length: CAKE_PIECES }, (_, i) => {
    const a = (i * Math.PI * 2) / CAKE_PIECES
    return circle(cx + Math.cos(a) * 4.6, cy + Math.sin(a) * 4.6, 1.5)
  }))
  const b = bunting([-34, -40], [34, -40], 9, 4)
  return (
    <>
      <path d={ellipse(6 + SHADOW_SHIFT[0], 1 + SHADOW_SHIFT[1], 38, 4)} fill={FJELD.castShadow} opacity={0.22} />
      {lit(t) && (
        <g className="fjeld-puff">
          <path d={smoke(19, -76, 1.3)} fill={FJELD.smoke} opacity={0.92} />
        </g>
      )}
      <path d={rect(15, -76, 9, 20, 1.5)} fill={c('roofRedShade')} stroke={c('timber')} strokeWidth={1.2} {...ROUND} />
      <path d={rect(-31, -40, 62, 40, 2.5)} fill={c('wall')} stroke={c('timber')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={rect(15, -40, 16, 40, 2)} fill={c('wallShade')} opacity={0.7} />
      <path d={blob([[-37, -37], [0, -70], [37, -37]], 0.22)} fill={c('roofRed')} stroke={c('roofRedShade')} strokeWidth={SW * 0.8} {...ROUND} />
      <path d={blob([[0, -70], [37, -37], [12, -37]], 0.22)} fill={c('roofRedShade')} opacity={0.4} />
      <path d={join(blob([[-30, -42], [-24, -50], [0, -71.5], [24, -50], [30, -42], [22, -47], [10, -55], [0, -61], [-12, -53], [-22, -46]], 0.4), rect(14, -79, 11, 4.5, 2))} fill={FJELD.snow} stroke={FJELD.snowShade} strokeWidth={0.9} {...ROUND} />
      {/* det runde vindue med kagen */}
      <path d={circle(cx, cy, 12)} fill={lit(t) ? c('windowLit') : c('window')} stroke={c('timber')} strokeWidth={1.8} />
      <path d={circle(cx, cy, 8.2)} fill={c('cake')} stroke={c('cakeCream')} strokeWidth={1.6} />
      <path d={cuts} fill="none" stroke={c('cakeCream')} strokeWidth={1.5} {...ROUND} />
      {bloom(t) && <path d={berries} fill={c('cakeBerry')} />}
      <path d={rect(9, -24, 13, 24, 6.5)} fill={c('door')} stroke={c('timber')} strokeWidth={1.2} {...ROUND} />
      <path d={rect(-25, -6, 28, 4, 1.6)} fill={c('woodDark')} />
      {lit(t) && lanterns([[27, -30]], 0.8)}
      {bloom(t) && <path d={glints([[-18, -56, 3], [8, -66, 2.8], [30, -46, 2.4]])} fill={FJELD.flowerWhite} stroke={FJELD.skyStarGlow} strokeWidth={0.5} />}
      {full(t) && <Bunting b={[b]} c={c} a="flag" z="flowerYellow" />}
    </>
  )
}

/** En isbjørn i sneen (lokalt fra poterne; går mod venstre): forenklet, hvid med lilla skygge. */
function Bear({ cub = false }: { cub?: boolean }) {
  const edge = FJELD.stoneShade
  const s = cub ? 0.62 : 1
  const o = (pts: readonly Vec[]) => xf(pts, { sx: s })
  const legs = join(...[[-12, -6], [-5, -5], [8, -5], [14, -6]].map(([x, y]) => capsule(o([[x, y]])[0], o([[x + (x < 0 ? -1 : 1), -1.5]])[0], 3.6 * s)))
  return (
    <>
      <path d={ellipse(4 * s + SHADOW_SHIFT[0], 0.5 + SHADOW_SHIFT[1], 24 * s, 3.2 * s)} fill={FJELD.castShadow} opacity={0.2} />
      <path d={legs} fill={FJELD.bear} stroke={edge} strokeWidth={1} />
      <path d={join(blob(o([[-16, -8], [-14, -20], [0, -24], [16, -22], [22, -14], [19, -6], [0, -5]]), 0.8), ellipse(-20 * s, -21 * s, 8.5 * s, 7.2 * s), circle(-20 * s, -28.5 * s, 2.6 * s), circle(-13.5 * s, -27 * s, 2.4 * s))} fill={FJELD.bear} stroke={edge} strokeWidth={1.1} {...ROUND} />
      <path d={join(lune(3 * s, -14 * s, 18 * s, 8 * s, 3 * s, 15, 150), ellipse(-27 * s, -18.5 * s, 4.6 * s, 3.4 * s))} fill={FJELD.bearShade} />
      <path d={join(ellipse(-30.6 * s, -19.6 * s, 1.8 * s, 1.3 * s), circle(-22 * s, -23 * s, 1.2 * s))} fill={FJELD.bearNose} />
    </>
  )
}

/** Pingviner på isen (lokalt fra fødderne): mørkeblå ryg, hvid mave, orange næb og fødder; én vinker med vingen. */
function Penguins({ count }: { count: number }) {
  const spots: [number, number, number][] = [[-14, 0, 1], [0, -3, 0.82], [13, 1, 0.95], [25, -2, 0.7]]
  const ps = spots.slice(0, count)
  const each = (f: (x: number, y: number, s: number, i: number) => string) => join(...ps.map(([x, y, s], i) => f(x, y, s, i)))
  return (
    <>
      <path d={each((x, y, s) => ellipse(x + 2 * s + SHADOW_SHIFT[0] * 0.6, y + 0.5, 6 * s, 1.6 * s))} fill={FJELD.castShadow} opacity={0.22} />
      <path d={each((x, y, s, i) => join(ellipse(x, y - 10.5 * s, 6.2 * s, 10.5 * s), capsule([x - 5 * s, y - 13 * s], [x - (i === 0 ? 10 : 8) * s, y - (i === 0 ? 19 : 6) * s], 1.6 * s, 1.1 * s), capsule([x + 5 * s, y - 13 * s], [x + 8 * s, y - 6 * s], 1.6 * s, 1.1 * s)))} fill={FJELD.penguin} />
      <path d={each((x, y, s) => join(ellipse(x, y - 8.5 * s, 4.3 * s, 8 * s), circle(x - 2 * s, y - 15.5 * s, 2 * s), circle(x + 2 * s, y - 15.5 * s, 2 * s)))} fill={FJELD.penguinBelly} />
      <path d={each((x, y, s) => join(circle(x - 1.9 * s, y - 15.8 * s, 0.85 * s), circle(x + 1.9 * s, y - 15.8 * s, 0.85 * s)))} fill={FJELD.eye} />
      <path d={each((x, y, s) => join(blob([[x - 1.6 * s, y - 13.6 * s], [x + 1.6 * s, y - 13.6 * s], [x, y - 11.2 * s]], 0.3), ellipse(x - 2.4 * s, y - 0.3 * s, 2.2 * s, 1 * s), ellipse(x + 2.4 * s, y - 0.3 * s, 2.2 * s, 1 * s)))} fill={FJELD.beak} />
    </>
  )
}

/** En snemand (lokalt fra foden): tre snebolde, kulknapper, gulerodsnæse, halstørklæde og pindearme. */
function Snowman({ t }: { t: RegionTier }) {
  const c = paint(t)
  return (
    <>
      <path d={ellipse(4 + SHADOW_SHIFT[0], 0.5 + SHADOW_SHIFT[1], 16, 3)} fill={FJELD.castShadow} opacity={0.22} />
      <path d={join(spline([[-8, -27], [-16, -33], [-20, -32]]), spline([[8, -27], [16, -34], [19, -38]]), spline([[-16, -33], [-17, -37]]))} fill="none" stroke={c('trunkDark')} strokeWidth={1.6} {...ROUND} />
      <path d={join(circle(0, -11, 12), circle(0, -29, 9), circle(0, -43, 7))} fill={FJELD.snow} stroke={FJELD.snowShade} strokeWidth={1.2} />
      <path d={join(lune(1, -11, 11, 11, 3.4, 10, 120), lune(1, -29, 8.4, 8.4, 2.6, 10, 120), lune(1, -43, 6.4, 6.4, 2, 10, 120))} fill={FJELD.snowShade} opacity={0.85} />
      <path d={join(circle(-2.6, -45, 1), circle(2.4, -45, 1), circle(0, -31, 1.1), circle(0, -26, 1.1), circle(0, -14, 1.2))} fill={FJELD.eye} />
      <path d={blob([[0.5, -43.2], [8, -41.8], [0.5, -40.8]], 0.3)} fill={FJELD.beak} />
      <path d={join(blob([[-7, -37], [0, -35], [7, -37], [7.5, -34], [0, -32], [-7.5, -34]], 0.5), blob([[3, -34], [6.5, -34], [7.5, -26], [4, -26.5]], 0.4))} fill={c('flag')} stroke={c('awningShade')} strokeWidth={0.8} {...ROUND} />
    </>
  )
}

/** Et forgrundshjørne (lokalt fra hjørnet; spejles til højre): en stor sten med sne, en gran, græs og blomster. */
function Corner({ t, mirror }: { t: RegionTier; mirror: boolean }) {
  const c = paint(t)
  const rock = blob([[-4, 6], [-2, -26], [16, -48], [46, -54], [72, -38], [86, -12], [90, 6]], 0.7)
  const fl = (mirror ? [[100, -6, 6.5], [116, -18, 5.5], [130, -4, 6]] : [[104, -8, 7], [120, -20, 6], [136, -6, 6.5]]).slice(0, rank(t)) as [number, number, number][]
  const flowers = flowerPaths(fl)
  const fir = firShape(mirror ? 22 : 18, -32, mirror ? 2.1 : 2.4)
  return (
    <g transform={mirror ? 'scale(-1 1)' : undefined}>
      <path d={fir.trunk} fill={c('trunkDark')} />
      <path d={fir.body} fill={c('fir')} stroke={c('firDark')} strokeWidth={1.4} {...ROUND} />
      <path d={fir.snow} fill={FJELD.snow} />
      <path d={fir.shade} fill={c('firDark')} opacity={0.32} />
      <path d={rock} fill={c('rock')} stroke={c('rockShade')} strokeWidth={1.8} {...ROUND} />
      <path d={blob([[40, -53], [72, -38], [86, -12], [90, 6], [52, 6], [56, -22]], 0.6)} fill={c('rockShade')} opacity={0.38} />
      <path d={spline([[2, -22], [14, -42], [34, -52]])} fill="none" stroke={FJELD.sunlit} strokeWidth={3} opacity={0.85} {...ROUND} />
      <path d={blob([[-3, -28], [8, -44], [30, -55], [52, -55], [72, -40], [60, -38], [44, -44], [26, -40], [10, -30]], 0.6)} fill={FJELD.snow} stroke={FJELD.snowShade} strokeWidth={1} {...ROUND} />
      <path d={grass([[90, 6, 1.6], [108, 8, 1.3], [-6, 8, 1.8], [128, 9, 1.1]])} fill={c('front')} stroke={c('frontDark')} strokeWidth={1.3} {...ROUND} />
      {fl.length > 0 && (
        <>
          <path d={flowers.petals} fill={mirror ? c('flowerViolet') : c('flowerPink')} stroke={FJELD.outline} strokeWidth={1.1} {...ROUND} />
          <path d={flowers.hearts} fill={c('flowerYellow')} />
        </>
      )}
    </g>
  )
}

/** En sky: fire runde puder og en flad bund, med en lyserød-lilla skygge forneden (scenens koordinater). */
const cloud = (p: Place) => {
  const o = (x: number, y: number) => [p.x + x * p.s, p.y + y * p.s] as const
  const c = (x: number, y: number, r: number) => circle(...o(x, y), r * p.s)
  return {
    body: join(c(-22, -4, 14), c(-4, -14, 18), c(18, -8, 15), c(32, 0, 10), rect(p.x - 36 * p.s, p.y - 6 * p.s, 78 * p.s, 14 * p.s, 7 * p.s)),
    shade: ellipse(p.x + 4 * p.s, p.y + 5 * p.s, 34 * p.s, 4.5 * p.s),
  }
}

// ---------------------------------------------------------------------------------------------
// Bækken og stien

/** Bækken bliver bredere nedstrøms (fuld bredde pr. punkt); fra gletsjerens tunge til issøen. */
export const streamWidths = (L: Layout) => L.stream.map((_, i) => (7 + i * (24 / Math.max(1, L.stream.length - 1))) * L.k)
/** Stiens bredde ved y: smal langt oppe ad fjeldet, bredere forrest (perspektiv). */
const trailWidth = (L: Layout, y: number) => (5 + 11 * clamp((y - L.h * 0.25) / (L.h * 0.7), 0, 1)) * L.k

// ---------------------------------------------------------------------------------------------
// Scenen

export interface FjeldArtProps {
  w: number
  h: number
  tiers: Tiers
  className?: string
  svgRef?: Ref<SVGSVGElement>
}

/** Den rene tegning for en given plads (CSS-px). */
export function FjeldArt({ w, h, tiers, className, svgRef }: FjeldArtProps) {
  const sky = `${useId().replace(/[^A-Za-z0-9_-]/g, '')}sky`
  const L = layoutOf(w, h)
  const T = Object.fromEntries(MARKS.map((m) => [m, tierOf(tiers, m)])) as Record<Mark, RegionTier>
  // Fjeldene, engen, himlen og stjernerne følger hele verdenens fremgang (gennemsnittet af regionernes krom).
  const world = Object.values(T).reduce((s, t) => s + TIER_CHROMA[t], 0) / MARKS.length
  const progress = (world - TIER_CHROMA.start) / (1 - TIER_CHROMA.start)
  const g = (c: FjeldColor) => tintFjeldBy(c, world)
  const tb = (c: FjeldColor, t: RegionTier) => tintFjeld(c, t)
  const K = L.k
  const R = { mid: ridgePts(L.mid, w), near: ridgePts(L.near, w) }
  // Lag: papirkantens skygge, fladen, solens skygge- og lysbånd, det varme højlys på kammen og den lyse kant.
  const layer = (r: Ridge, pts: Vec[], color: FjeldColor, depth: number, shadeO: number) => {
    const light = ridgeLight(r, w, depth)
    return (
      <>
        <path d={ridge(xf(pts, { dy: -5 }), h + 40)} fill={FJELD.paperShadow} opacity={0.13} />
        <path d={ridge(pts, h + 40)} fill={g(color)} />
        <path d={light.shade} fill={FJELD.shade} opacity={shadeO} />
        <path d={light.glow} fill={FJELD.sunlit} opacity={0.22} />
        <path d={spline(pts)} fill="none" stroke={FJELD.rim} strokeWidth={2} opacity={0.5} {...ROUND} />
        <path d={light.crest} fill="none" stroke={FJELD.sunlit} strokeWidth={3.2 * K} opacity={0.95} {...ROUND} />
      </>
    )
  }
  // Himlens stjerner: flere og klarere, jo længere verdenen er nået; de glimter fra sølv (tre hold i hver sin takt).
  const starCount = Math.round(9 + 21 * progress)
  const skyStars = Array.from({ length: 34 }, (_, i) => ({ x: hash01(i + 300) * w, y: (0.025 + hash01(i + 400) * 0.3) * h, r: (2.2 + hash01(i + 500) * 2.6) * K, big: hash01(i + 600) > 0.62 }))
    .filter((p) => Math.hypot(p.x - L.sun.x, p.y - L.sun.y) > 90 * K)
    .slice(0, starCount)
  const twinkle = progress > 0.6
  // Granskoven på fjeldskråningen: to rækker langs kammen i lundene; bækkens løb holdes fri.
  const free = (x: number, y: number) => L.stream.every(([sx, sy], i) => i === 0 || Math.hypot(x - sx, (y - sy) * 0.5) > 34 * K) && Math.abs(x - L.bridge.x - 24 * L.bridge.s) > 80 * L.bridge.s
  const grove = (dv: number, step: number, s0: number, seed: number) =>
    L.forest.flatMap(([u0, u1], j) => {
      const cnt = Math.max(1, Math.round(((u1 - u0) * w) / (step * K)))
      return Array.from({ length: cnt }, (_, i) => {
        const x = w * u0 + (i + 0.3 + hash01(i + j * 19 + seed) * 0.4) * (((u1 - u0) * w) / cnt)
        return { x, y: ridgeY(L.mid, w, x) + (dv + hash01(i + seed + 7) * 6) * K, s: K * (s0 + hash01(i + seed + 13) * 0.25) }
      })
    }).filter((p) => free(p.x, p.y))
  const rowA = grove(6, 17, 0.5, 31)
  const rowB = grove(24, 22, 0.66, 71)
  // Spredte klynger af gran længere nede ad skråningen og langs den nære engs kam (kendetegnene holdes fri).
  const marks = [L.tower, L.cleft, L.market, L.garden, L.bakery, L.lake, L.dragon, L.snowman]
  const clear = (x: number, y: number) => free(x, y) && marks.every((p) => Math.hypot(x - p.x, (y - p.y) * 1.4) > 70 * K)
  const scatter = (r: Ridge, n0: number, dv0: number, dv1: number, s0: number, seed: number) =>
    Array.from({ length: n0 }, (_, i) => {
      const x = (hash01(i + seed) * 1.04 - 0.02) * w
      return { x, y: ridgeY(r, w, x) + (dv0 + hash01(i + seed + 40) * (dv1 - dv0)) * K, s: K * (s0 + hash01(i + seed + 80) * 0.3) }
    }).filter((p) => clear(p.x, p.y)).sort((a, b) => a.y - b.y)
  const rowC = grove(44, 34, 0.86, 111).filter((p) => clear(p.x, p.y))
  const rowD = scatter(L.mid, Math.round(w / (60 * K)), 60, 110, 0.85, 1201)
  const rowE = scatter(L.near, Math.round(w / (95 * K)), 6, 24, 0.95, 1301)
  // Den lille fjeldby: hytter med sne på taget; vinduerne lyser, når verdenen er nået et stykke.
  const huts = L.hamlet.map((p) => {
    const o = (pts: readonly Vec[]) => xf(pts, { sx: p.s, dx: p.x, dy: p.y })
    return {
      wall: poly(o([[-11, 1], [-11, -13], [11, -13], [11, 1]])),
      side: poly(o([[3, 1], [3, -13], [11, -13], [11, 1]])),
      roof: blob(o([[-15, -11], [0, -26], [15, -11]]), 0.25),
      snow: blob(o([[-14, -12.5], [-7, -20], [0, -27.5], [7, -20], [14, -12.5], [8, -15], [0, -21], [-8, -15]]), 0.4),
      win: join(rect(...(o([[-7, -9]])[0]), 5 * p.s, 5 * p.s, 1.2 * p.s), rect(...(o([[4.5, -9]])[0]), 4 * p.s, 5 * p.s, 1.2 * p.s)),
    }
  })
  const rocks = L.boulders.map((p) => {
    const o = (pts: readonly Vec[]) => xf(pts, { sx: p.s, dx: p.x, dy: p.y })
    return {
      body: blob(o([[-16, 2], [-15, -10], [-6, -19], [8, -19], [17, -9], [18, 2]]), 0.7),
      shade: blob(o([[4, -19], [8, -19], [17, -9], [18, 2], [4, 2], [7, -9]]), 0.6),
      snow: blob(o([[-15, -9], [-7, -19.5], [8, -20], [15, -11], [6, -13.5], [-4, -12]]), 0.6),
      cast: ellipse(p.x + 8 * p.s + SHADOW_SHIFT[0] * K, p.y + 2 * p.s + SHADOW_SHIFT[1] * K, 20 * p.s, 3 * p.s),
    }
  })
  // Sneflader og blomsterprikker på den nære eng (flere blomster, jo længere verdenen er nået).
  const patches = Array.from({ length: L.wide ? 6 : 4 }, (_, i) => {
    const x = (0.08 + 0.84 * hash01(i + 800)) * w
    const top = ridgeY(L.near, w, x) + 18 * K
    return [x, top + hash01(i + 820) * Math.max(6, h - top - 50 * K), (16 + hash01(i + 840) * 14) * K] as const
  })
  const dots = Math.round(8 + 30 * progress)
  const spots = Array.from({ length: dots }, (_, i) => {
    const x = hash01(i) * w
    const top = ridgeY(L.near, w, x) + 14 * K
    return [x, top + hash01(i + 97) * Math.max(10, h - top - 40 * K), (1.5 + hash01(i + 31) * 1.1) * K] as const
  })
  // Bækken: fra gletsjerens tunge, bredere nedstrøms; brinken er et mørkere bånd under vandet.
  const sw = streamWidths(L)
  const water = blob(ribbon(L.stream, sw), 0.9)
  const banks = blob(ribbon(L.stream, sw.map((b) => b + 8 * K)), 0.9)
  const wet = L.stream.slice(2, 5).map(([x, y], i) => [x + (i % 2 ? 4 : -5) * K, y + 4 * K, (3.4 + i * 0.6) * K] as const)
  // Kløften under Trecifret bro: mørk sten bag broen, hvor bækken løber igennem den store bue.
  const B = L.bridge
  const gorge = blob(xf([[-33, -2], [80, -2], [84, 12], [72, 26], [52, 33], [24, 43], [-24, 44], [-32, 30]], { sx: B.s, dx: B.x, dy: B.y }), 0.5)
  // Stien (lyser stykke for stykke, når regionen ved stykkets ende er nået til bronze).
  const legs = trailLegs(L)
  const ribbonOf = (pts: Vec[]) => blob(ribbon(pts, pts.map(([, y]) => trailWidth(L, y))), 0.9)
  const trail = (from: number, to: number) => {
    const part = legs.slice(from, to)
    const glow = part.map((p, i) => (lit(T[MARKS[from + i + 1]]) ? spline(p) : '')).filter(Boolean)
    return (
      <>
        <path d={join(...part.map(ribbonOf))} fill={g('trail')} stroke={g('trailEdge')} strokeWidth={1.3 * K} {...ROUND} />
        {glow.length > 0 && <path d={join(...glow)} fill="none" stroke={FJELD.lanternGlow} strokeWidth={2.8 * K} opacity={0.8} {...ROUND} />}
      </>
    )
  }
  // Jordskygger (solen oppe til venstre: skyggen falder mod højre).
  const cast = (p: Place, dx: number, rx: number, ry: number) => ellipse(p.x + dx * p.s + SHADOW_SHIFT[0] * K, p.y + 1.5 * p.s + SHADOW_SHIFT[1] * K, rx * p.s, ry * p.s)
  const castMid = join(cast(L.tower, 10, 30, 5), ...L.firs.filter((p) => !p.front).map((p) => cast(p, 6, 16, 3.5)))
  const castNear = join(cast(L.market, 0, 82, 6), ...L.firs.filter((p) => p.front).map((p) => cast(p, 6, 16, 3.5)))
  // Forgrundens græskant langs bunden (rammer dioramaet ind).
  const tufts = Array.from({ length: Math.ceil(w / (30 * K)) + 1 }, (_, i) => [i * 30 * K + hash01(i + 7) * 10 * K, h + 2, K * (0.9 + hash01(i + 3) * 0.6)] as const)
  // Nordlyset (guld i hele verdenen): fire bløde bånd, der bølger hen over himlen bag fjeldene.
  const aurora = (['aurora1', 'aurora2', 'aurora3', 'aurora4'] as const).map((c, i) => {
    const xs = Array.from({ length: 9 }, (_, q) => w * (-0.04 + (1.08 * q) / 8))
    const y0 = (x: number) => h * (L.wide ? 0.07 + i * 0.045 : 0.1 + i * 0.035) + Math.sin((x / w) * Math.PI * 2.1 + i * 0.9) * h * 0.028
    return { c, d: band(xs.map((x) => [x, y0(x)] as Vec), xs.map((x) => [x, y0(x) + (18 + 5 * Math.cos(x / 90 + i)) * K] as Vec)) }
  })
  const glac = L.glacier
  const gl = blob(ribbon(glac.spine, glac.widths), 0.85)
  const crevasses = join(...[0.35, 0.55, 0.75].map((q, i) => {
    const j = Math.min(glac.spine.length - 2, Math.floor(q * (glac.spine.length - 1)))
    const f = q * (glac.spine.length - 1) - j
    const [ax, ay] = glac.spine[j]
    const [bx, by] = glac.spine[j + 1]
    const x = ax + (bx - ax) * f
    const y = ay + (by - ay) * f
    const wd = (glac.widths[j] + (glac.widths[j + 1] - glac.widths[j]) * f) * 0.36
    return spline([[x - wd, y - 2 * K], [x - wd * 0.2, y + (2 + i) * K], [x + wd, y - 1 * K]])
  }))
  const penguinCount = 2 + (bloom(T.market) ? 1 : 0) + (full(T.market) ? 1 : 0)
  return (
    <svg
      ref={svgRef}
      className={['fjeld-scene', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${n(w)} ${n(h)}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      data-scene="fjeld"
    >
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={g('skyTop')} />
          <stop offset="0.36" stopColor={FJELD.skyMid} />
          <stop offset="0.62" stopColor={FJELD.skyBottom} />
        </linearGradient>
      </defs>
      <path d={rect(0, 0, w, h)} fill={`url(#${sky})`} />
      {/* nordlyset bag alt (guld i hele verdenen) */}
      {world >= 1 && (
        <g opacity={0.5}>
          {aurora.map(({ c, d }) => <path key={c} d={d} fill={FJELD[c]} />)}
        </g>
      )}
      {/* de første stjerner */}
      {[0, 1, 2].map((q) => {
        const pts = skyStars.filter((_, i) => i % 3 === q)
        if (!pts.length) return null
        return (
          <g key={q} className={twinkle ? `fjeld-twinkle fjeld-twinkle-${q}` : undefined} opacity={n(0.55 + 0.4 * progress)}>
            <path d={join(...pts.map((p) => (p.big ? star(p.x, p.y, p.r * 1.2, p.r * 0.5, 5) : star(p.x, p.y, p.r, p.r * 0.3, 4))))} fill={FJELD.skyStar} stroke={FJELD.skyStarGlow} strokeWidth={0.6 * K} {...ROUND} />
          </g>
        )
      })}
      {/* den lave sol (strålerne kommer med lyset) og skyerne */}
      <g transform={`translate(${n(L.sun.x)} ${n(L.sun.y)}) scale(${fmt3(L.sun.s)})`}>
        <path d={circle(0, 0, 48)} fill={FJELD.sunHalo} opacity={0.75} />
        {world > 0.8 && <path d={join(...Array.from({ length: 10 }, (_, i) => blob(xf([[-4, -36], [0, -50], [4, -36]], { rot: i * 36 }), 0.4)))} fill={FJELD.sun} opacity={0.75} />}
        <path d={circle(0, 0, 27)} fill={g('sun')} />
      </g>
      {L.clouds.map((p, i) => {
        const cl = cloud(p)
        return (
          <g key={i} className={`fjeld-drift fjeld-drift-${i % 3}`}>
            <path d={cl.body} fill={FJELD.cloud} opacity={0.94} />
            <path d={cl.shade} fill={FJELD.cloudShade} opacity={0.9} />
          </g>
        )
      })}
      {/* lag 1: den fjerne kæde af snetoppe (lys og kølig) */}
      <Peaks peaks={L.far} seed={1} fill={g('farMount2')} snow={FJELD.snow} snowAt={0.34} shadeO={0.11} glowO={0.3} k={K} />
      <Peaks peaks={L.far2} seed={21} fill={g('farMount')} snow={FJELD.snow} snowAt={0.3} shadeO={0.14} glowO={0.35} k={K} />
      {/* lag 2: fjeldmassivet og Tabeltoppen med gletsjeren */}
      <Peaks peaks={L.massif} seed={41} fill={g('rock')} snow={FJELD.snow} snowAt={0.36} shadeO={0.27} glowO={0.7} k={K} line={g('rockLine')} paper />
      <Peaks peaks={[L.top]} seed={61} fill={g('rock')} snow={FJELD.snow} snowAt={0.38} shadeO={0.29} glowO={0.75} k={K} line={g('rockLine')} paper />
      <path d={gl} fill={tb('ice', T.bridge)} stroke={tb('iceEdge', T.bridge)} strokeWidth={1.4 * K} {...ROUND} />
      <path d={crevasses} fill="none" stroke={tb('iceDeep', T.bridge)} strokeWidth={1.4 * K} opacity={0.8} {...ROUND} />
      <path d={spline(xf(glac.spine.slice(0, -1), { dx: -glac.widths[1] * 0.22 }))} fill="none" stroke={FJELD.iceLight} strokeWidth={2.6 * K} opacity={0.9} {...ROUND} />
      {bloom(T.bridge) && <path d={glints(glac.spine.slice(1).map(([x, y], i) => [x + (i % 2 ? 6 : -7) * K, y, (3 + i * 0.4) * K] as const))} fill={FJELD.flowerWhite} stroke={FJELD.skyStarGlow} strokeWidth={0.5 * K} />}
      {at(L.summit, <Summit t={T.summit} />)}
      {at(L.pegasus, <Pegasus t={T.summit} />, L.pegasus.flip)}
      {/* lag 3: fjeldskråningen med granskoven, stien og Minuttårnet */}
      {layer(L.mid, R.mid, 'midHill', h * 0.08, 0.13)}
      <path d={band(R.mid.map(([x, y]) => [x, y + 1] as Vec), R.mid.map(([x, y], i) => [x, y + (7 + 9 * hash01(i + 900)) * K] as Vec))} fill={FJELD.snow} opacity={0.72} />
      <Firs pts={rowA} fill={g('midForest')} edge={g('firDark')} snow={FJELD.snow} />
      <Firs pts={rowB} fill={g('midForest')} edge={g('firDark')} snow={FJELD.snow} />
      {huts.length > 0 && (
        <>
          <path d={join(...huts.map((q) => q.wall))} fill={g('wall')} stroke={g('timber')} strokeWidth={1 * K} {...ROUND} />
          <path d={join(...huts.map((q) => q.side))} fill={g('wallShade')} opacity={0.75} />
          <path d={join(...huts.map((q) => q.roof))} fill={g('roofBlue')} stroke={g('roofBlueShade')} strokeWidth={1 * K} {...ROUND} />
          <path d={join(...huts.map((q) => q.snow))} fill={FJELD.snow} />
          <path d={join(...huts.map((q) => q.win))} fill={progress > 0.25 ? g('windowLit') : g('window')} />
        </>
      )}
      <path d={castMid} fill={FJELD.castShadow} opacity={0.2} />
      {trail(0, L.midLegs)}
      <Firs pts={rowC} fill={g('fir')} edge={g('firDark')} snow={FJELD.snow} />
      <Firs pts={rowD} fill={g('fir')} edge={g('firDark')} snow={FJELD.snow} />
      {L.firs.filter((p) => !p.front).map((p, i) => <Firs key={i} pts={[p]} fill={g('fir')} edge={g('firDark')} snow={FJELD.snow} />)}
      {at(L.tower, <Tower t={T.tower} />)}
      {at(L.dragon, <Dragon t={T.tower} crag={L.dragon.crag} />, L.dragon.flip)}
      {/* lag 4: den nære fjeldeng med sneflader, bækken, broen og issøen */}
      {layer(L.near, R.near, 'nearHill', h * 0.1, 0.15)}
      <path d={join(...patches.map(([x, y, r]) => blob([[x - r, y], [x - r * 0.5, y - r * 0.32], [x + r * 0.3, y - r * 0.36], [x + r, y - r * 0.05], [x + r * 0.4, y + r * 0.2], [x - r * 0.5, y + r * 0.18]], 0.8)))} fill={FJELD.snow} opacity={0.92} />
      <path d={join(...patches.map(([x, y, r]) => lune(x + r * 0.1, y - r * 0.08, r * 0.85, r * 0.26, r * 0.08, 20, 160)))} fill={FJELD.snowShade} opacity={0.8} />
      <path d={join(...spots.filter((_, i) => i % 2 === 0).map(([x, y, r]) => circle(x, y, r)))} fill={FJELD.flowerWhite} opacity={0.9} />
      <path d={join(...spots.filter((_, i) => i % 2 === 1).map(([x, y, r]) => circle(x, y, r)))} fill={g('flowerViolet')} />
      {rocks.length > 0 && (
        <>
          <path d={join(...rocks.map((q) => q.cast))} fill={FJELD.castShadow} opacity={0.22} />
          <path d={join(...rocks.map((q) => q.body))} fill={g('rock')} stroke={g('rockShade')} strokeWidth={1.4 * K} {...ROUND} />
          <path d={join(...rocks.map((q) => q.shade))} fill={g('rockShade')} opacity={0.38} />
          <path d={join(...rocks.map((q) => q.snow))} fill={FJELD.snow} />
        </>
      )}
      {(() => {
        // fjeldblomster ved stenene: 2, 4, 6 og 8 pr. klynge efter Arealhavens trin
        const n0 = [2, 4, 6, 8][rank(T.garden)]
        const pts = L.boulders.flatMap((p, j) =>
          Array.from({ length: n0 }, (_, i) => [p.x + (22 + i * 6.5 + hash01(i + j * 13 + 950) * 4) * p.s * (i % 2 ? 1 : -1) * 0.8 + (i % 2 ? 6 : -8) * p.s, p.y + (hash01(i + j * 7 + 970) * 6 - 1) * p.s, (2.6 + hash01(i + 990) * 1.2) * p.s] as [number, number, number]),
        )
        const fl = flowerPaths(pts)
        return (
          <>
            <path d={fl.petals} fill={tb('flowerPink', T.garden)} stroke={tb('awningShade', T.garden)} strokeWidth={0.7 * K} {...ROUND} />
            <path d={fl.hearts} fill={tb('flowerYellow', T.garden)} />
          </>
        )
      })()}
      <Firs pts={rowE} fill={g('fir')} edge={g('firDark')} snow={FJELD.snow} />
      <path d={gorge} fill={tb('gorge', T.bridge)} />
      <path d={banks} fill={tb('bank', T.bridge)} />
      <path d={water} fill={tb('water', T.bridge)} stroke={tb('waterEdge', T.bridge)} strokeWidth={1.3 * K} {...ROUND} />
      <path d={spline(xf(L.stream.slice(1), { dx: -2.5 * K }))} fill="none" stroke={FJELD.waterLight} strokeWidth={2 * K} opacity={bloom(T.bridge) ? 0.95 : 0.6} {...ROUND} />
      {bloom(T.bridge) && <path d={glints(wet)} fill={FJELD.flowerWhite} />}
      {at(B, <ArchBridge t={T.bridge} />)}
      {/* issøen: sne langs bredden, åbent vand ved bækkens udløb og is resten af vejen */}
      <path d={ellipse(L.lake.x, L.lake.y + 3 * K, L.lake.rx + 10 * K, L.lake.ry + 6 * K)} fill={FJELD.snow} stroke={FJELD.snowShade} strokeWidth={1.2 * K} />
      <path d={ellipse(L.lake.x, L.lake.y, L.lake.rx, L.lake.ry)} fill={tb('water', T.bridge)} stroke={tb('waterEdge', T.bridge)} strokeWidth={1.3 * K} />
      <path d={blob([[L.lake.x - L.lake.rx * 0.55, L.lake.y - L.lake.ry * 0.92], [L.lake.x + L.lake.rx * 0.62, L.lake.y - L.lake.ry * 0.86], [L.lake.x + L.lake.rx * 0.97, L.lake.y], [L.lake.x + L.lake.rx * 0.55, L.lake.y + L.lake.ry * 0.88], [L.lake.x - L.lake.rx * 0.48, L.lake.y + L.lake.ry * 0.9], [L.lake.x - L.lake.rx * 0.62, L.lake.y + L.lake.ry * 0.1]], 0.8)} fill={tb('ice', T.market)} stroke={tb('iceEdge', T.market)} strokeWidth={1.1 * K} {...ROUND} />
      <path d={join(spline([[L.lake.x - L.lake.rx * 0.2, L.lake.y - L.lake.ry * 0.5], [L.lake.x, L.lake.y - L.lake.ry * 0.1], [L.lake.x + L.lake.rx * 0.3, L.lake.y + L.lake.ry * 0.2]]), spline([[L.lake.x + L.lake.rx * 0.45, L.lake.y - L.lake.ry * 0.55], [L.lake.x + L.lake.rx * 0.6, L.lake.y + L.lake.ry * 0.4]]))} fill="none" stroke={tb('iceDeep', T.market)} strokeWidth={1 * K} opacity={0.75} {...ROUND} />
      <path d={join(ellipse(L.lake.x - L.lake.rx * 0.1, L.lake.y - L.lake.ry * 0.45, L.lake.rx * 0.32, L.lake.ry * 0.12), ellipse(L.lake.x + L.lake.rx * 0.55, L.lake.y + L.lake.ry * 0.35, L.lake.rx * 0.16, L.lake.ry * 0.08))} fill={FJELD.iceLight} opacity={0.9} />
      {bloom(T.market) && <path d={glints([[L.lake.x - L.lake.rx * 0.35, L.lake.y - L.lake.ry * 0.3, 3.2 * K], [L.lake.x + L.lake.rx * 0.75, L.lake.y - L.lake.ry * 0.1, 2.8 * K]])} fill={FJELD.flowerWhite} stroke={FJELD.skyStarGlow} strokeWidth={0.5 * K} />}
      {at(L.penguins, <Penguins count={penguinCount} />)}
      {/* stien på engen og kendetegnene forrest */}
      {trail(L.midLegs, legs.length)}
      <path d={castNear} fill={FJELD.castShadow} opacity={0.22} />
      {at(L.cleft, <Cleft t={T.cleft} />)}
      {at(L.market, <Market t={T.market} />)}
      {at(L.garden, <Garden t={T.garden} />)}
      {at(L.bakery, <Bakery t={T.bakery} />)}
      {at(L.snowman, <Snowman t={T.market} />)}
      {at(L.bear, <Bear />, L.bear.flip)}
      {bloom(T.bakery) && at({ x: L.bear.x + (L.bear.flip ? 30 : -30) * L.bear.s, y: L.bear.y + 2 * L.bear.s, s: L.bear.s }, <Bear cub />, L.bear.flip)}
      {L.firs.filter((p) => p.front).map((p, i) => <Firs key={i} pts={[p]} fill={g('fir')} edge={g('firDark')} snow={FJELD.snow} />)}
      <path d={grass(tufts)} fill={g('front')} stroke={g('frontDark')} strokeWidth={1.2 * K} {...ROUND} />
      {at(L.corners[0], <Corner t={T.market} mirror={false} />)}
      {at(L.corners[1], <Corner t={T.bakery} mirror />)}
    </svg>
  )
}

/** Kortets scene (MapSceneProps): måler sin plads og tegner Stjernefjeldet til netop den. */
export default function FjeldScene({ tiers, className }: MapSceneProps) {
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
  return <FjeldArt w={size.w} h={size.h} tiers={tiers} className={className} svgRef={ref} />
}
