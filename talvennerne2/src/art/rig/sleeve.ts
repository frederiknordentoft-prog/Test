// Ærmer på løftede arme (jubel, vink, tænker, ups): formen regnes ud langs armens rygrad (den samme
// rygrad som artens `PawUp` tegner), så trøjens ærme følger albuen og slutter med en ribmanchet lige
// før poten eller hoven. Kun geometri i armens lokale ramme; genstanden maler (`SleeveUpArt`).
import { blob, join, poly, spline } from './shapes'
import type { Vec } from './shapes'
import type { UpArm } from './types'

/** Ærmet er så meget bredere end armen (i alt), så armens kontur aldrig titter frem ved siden af. */
const EASE = 3.6

const segLen = (a: Vec, b: Vec) => Math.hypot(b[0] - a[0], b[1] - a[1])
const lengthOf = (spine: readonly Vec[]) => spine.slice(1).reduce((acc, p, i) => acc + segLen(spine[i], p), 0)

/** Punkt og enhedstangent i buelængden `s` langs en polylinje (klampet til enderne) og segmentet. */
function along(spine: readonly Vec[], s: number): { p: Vec; t: Vec; i: number } {
  let acc = 0
  for (let i = 0; i < spine.length - 1; i++) {
    const a = spine[i]
    const b = spine[i + 1]
    const l = segLen(a, b) || 1e-6
    if (s <= acc + l || i === spine.length - 2) {
      const u = Math.min(1, Math.max(0, (s - acc) / l))
      return { p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], t: [(b[0] - a[0]) / l, (b[1] - a[1]) / l], i }
    }
    acc += l
  }
  return { p: spine[0], t: [0, 1], i: 0 }
}

/** Firkant på tværs af armen i buelængden `s`: `half` til hver side, fra `d0` til `d1` langs armen. */
function across(spine: readonly Vec[], s: number, half: number, d0: number, d1: number, chamfer = 0): Vec[] {
  const { p, t } = along(spine, s)
  const nx = -t[1]
  const ny = t[0]
  const at = (u: number, v: number): Vec => [p[0] + t[0] * u + nx * v, p[1] + t[1] * u + ny * v]
  const c = chamfer
  return c
    ? [at(d0 + c, -half), at(d1 - c, -half), at(d1, -half + c), at(d1, half - c), at(d1 - c, half), at(d0 + c, half), at(d0, half - c), at(d0, -half + c)]
    : [at(d0, -half), at(d1, -half), at(d1, half), at(d0, half)]
}

export interface BentSleeve {
  fill: string
  edge: string
  bands: string
  cuff: string
  /** Ærmegabet på ærmeløst tøj: stof over armens rod på brystet og kantbåndet, hvor armen kommer ud. */
  root: string
  rootEdge: string
}

/** Ærmets fyld, kontur (åben ved roden), to striber (inden for ærmet) og manchet for en løftet arm. */
export function bentSleeve(arm: UpArm): BentSleeve {
  const L = lengthOf(arm.spine)
  const cut = Math.max(L * 0.45, L - arm.tip)
  const width = (s: number) => arm.w0 + ((arm.w1 - arm.w0) * s) / L
  const end = along(arm.spine, cut)
  const head = arm.spine.slice(0, end.i + 1)
  const last = head[head.length - 1]
  const part: Vec[] = segLen(last, end.p) < 0.5 ? [...head.slice(0, -1), end.p] : [...head, end.p]
  // Bredden i hvert punkt efter buelængden; normaler fra naboerne (som armens egen kontur).
  let acc = 0
  const left: Vec[] = []
  const right: Vec[] = []
  part.forEach((p, k) => {
    if (k > 0) acc += segLen(part[k - 1], p)
    const a = part[Math.max(0, k - 1)]
    const b = part[Math.min(part.length - 1, k + 1)]
    const l = segLen(a, b) || 1
    const nx = (b[1] - a[1]) / l
    const ny = -(b[0] - a[0]) / l
    const h = (width(acc) + EASE) / 2
    left.push([p[0] + nx * h, p[1] + ny * h])
    right.push([p[0] - nx * h, p[1] - ny * h])
  })
  const loop = [...left, ...right.reverse()]
  const half = width(cut) / 2
  // Striberne går præcis ud til ærmets kant (lidt ind under konturen, der tegnes ovenpå): intet klip.
  const stripes = [cut - 13.2, cut - 5.8]
    .filter((s) => s > 4)
    .map((s) => poly(across(arm.spine, s, (width(s) + EASE) / 2 + 0.4, -1.8, 1.8)))
  // Ærmegabet: et bånd fra roden (der ligger på brystet) et stykke ud ad armen; ærmeløst tøj dækker
  // rodens åbne ende med stof og kant, så armen ser ud til at komme ud af ærmegabet.
  const r0 = Math.min(6.5, L * 0.22)
  return {
    fill: blob(loop),
    edge: spline(loop),
    bands: stripes.length ? join(...stripes) : '',
    cuff: poly(across(arm.spine, cut, half + EASE / 2 + 0.8, -2.6, 2.8, 1.4)),
    root: poly(across(arm.spine, r0, (width(r0) + EASE) / 2 + 0.6, -r0 - 1, 0.4)),
    rootEdge: poly(across(arm.spine, r0, (width(r0) + EASE) / 2 + 0.9, -1.5, 1.7, 1.1)),
  }
}

// ---------------------------------------------------------------------------------------------
// Lange ærmer på lodrette forben (review G1-r4, T5): kat, hvalp, hest og enhjørning har forben, der
// hænger lodret foran kroppen fra et skulderled midt på maven. Ærmet må ikke være en kasse, der starter
// dér: det starter ved skulderen under hovedets kant, følger forbenet og ender i en manchet lige over
// poten eller hoven. Overdelen (skulder til skulderled) er kun ærmets to sidelinjer, som trøjen selv
// tegner i sit lag (stoffet og striberne er trøjens egne, så de fortsætter i samme højde); underdelen
// (skulderleddet til manchetten) følger potens drejning med fyld, striber i trøjens højde og manchet.

export interface LongArm {
  /** Underdelen i armens ramme som én åben path: fyldet lukkes implicit, men konturen er åben foroven. */
  d: string
  /** Overdelens to sidelinjer (armens ramme) fra skulderen ned til skulderleddet. */
  seams: readonly (readonly Vec[])[]
}

/**
 * Ærmet som et rør langs den lodrette arm (armens ramme: skulderleddet i (0,0), poten nedad): halv bredde
 * `wTop` ved `top` (skulderen under hovedet) og `wBottom` ved manchetten `cuffY`; underdelen starter
 * `overlap` over skulderleddet, så pelsens rod aldrig titter frem.
 */
export function longArm(top: number, cuffY: number, wTop: number, wBottom: number, overlap = 12): LongArm {
  const w = (y: number) => wBottom + ((wTop - wBottom) * (cuffY - y)) / (cuffY - top)
  const y0 = -overlap
  const yb = cuffY + 2.2
  const r = Math.min(3, wBottom * 0.3)
  const left: Vec[] = [[-w(y0), y0], [-w((y0 + cuffY) / 2), (y0 + cuffY) / 2], [-w(yb - r), yb - r]]
  const bottom: Vec[] = [[-w(yb) + r * 0.3, yb - r * 0.15], [0, yb + 0.4], [w(yb) - r * 0.3, yb - r * 0.15]]
  const right: Vec[] = [[w(yb - r), yb - r], [w((y0 + cuffY) / 2), (y0 + cuffY) / 2], [w(y0), y0]]
  const loop = [...left, ...bottom, ...right]
  const seam = (side: 1 | -1): Vec[] => [[side * w(top), top], [side * w((top + 2) / 2), (top + 2) / 2], [side * w(2), 2]]
  return { d: spline(loop, 0.5), seams: [seam(-1), seam(1)] }
}
