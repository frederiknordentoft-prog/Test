// Fælles byggeklodser til arterne (ikke husets frosne dele): lemmer med åben skulder, poteputer,
// rør-haler i tre lag (sømløse led) og hjælpere til hår. Alt tegnes med primitiverne i shapes.ts.
import type { ReactNode } from 'react'
import { blob, ellipse, join, spline } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { Palette } from '../rig/types'

export const ROUND = { strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

/**
 * Et lem med åben kontur ved roden (review G0-r1, fund 8): `loop` er en lukket kontur, der starter i
 * rodens ene hjørne og slutter i det andet. Fyldet lukkes, konturen stryges åben, så lemmet ser ud til
 * at vokse ud af kroppen. `detail` (tålinjer, puder) tegnes ovenpå.
 */
export function OpenLimb({ loop, fill, stroke, sw, trim = 0, trimEnd, extra, children }: { loop: readonly Vec[]; fill: string; stroke: string; sw: number; trim?: number; trimEnd?: number; extra?: string; children?: ReactNode }) {
  // `trim` springer konturens første og sidste punkter over, så stregen slutter et stykke nede
  // på lemmet, og roden glider blødt ind i kroppen (`trimEnd`: et andet antal for slutningen). `extra`
  // er ekstra fyld uden kontur i samme path
  // (fx en kile, der lukker sprækken mellem et øre og hovedet).
  const end = trimEnd ?? trim
  const open = trim || end ? loop.slice(trim, loop.length - end) : loop
  return (
    <>
      <path d={extra ? `${blob(loop)}${extra}` : blob(loop)} fill={fill} />
      <path d={spline(open)} fill="none" stroke={stroke} strokeWidth={sw} {...ROUND} />
      {children}
    </>
  )
}

/** Poteputer på en løftet pote: én stor pude og tre tåbønner om (cx, cy), drejet `rot` grader. */
export function padsPath(cx: number, cy: number, r: number, rot = 0): string {
  const t = (rot * Math.PI) / 180
  const at = (dx: number, dy: number): Vec => [cx + dx * Math.cos(t) - dy * Math.sin(t), cy + dx * Math.sin(t) + dy * Math.cos(t)]
  const main = at(0, r * 0.28)
  const beans = [at(-r * 0.52, -r * 0.3), at(0, -r * 0.5), at(r * 0.52, -r * 0.3)]
  return join(ellipse(main[0], main[1], r * 0.42, r * 0.34, rot), ...beans.map(([x, y]) => ellipse(x, y, r * 0.17, r * 0.2, rot)))
}

/**
 * Hale som rør i tre lag, så et animeret led (halespids) samles uden søm: (1) basens kontur,
 * (2) spidsen (kontur + fyld) i sin egen gruppe, (3) basens fyld ovenpå, der dækker leddets kontur.
 * `base`/`tip` er rygrader (åbne splines); `w` er rørets bredde.
 */
export function tubeStroke(spine: readonly Vec[], w: number, color: string, extra?: { opacity?: number }) {
  return <path d={spline(spine)} fill="none" stroke={color} strokeWidth={w} strokeOpacity={extra?.opacity} {...ROUND} />
}

/** Lys/mørk farve til poteputer m.m. i silhuet: alt sort. */
export const padFill = (pal: Palette) => (pal.silhouette ? pal.fur : pal.inner)

/**
 * Et lems lukkede kontur langs en rygrad (rod → pote): bredden går fra `w0` til `w1`, og enden får
 * en rund hætte (poten). Konturen starter i rodens ene hjørne og slutter i det andet, så den kan
 * bruges direkte i OpenLimb.
 */
export function limbLoop(spine: readonly Vec[], w0: number, w1: number, cap = 6): Vec[] {
  const n = spine.length
  const nrm = spine.map((_, i) => {
    const p = spine[Math.max(0, i - 1)]
    const q = spine[Math.min(n - 1, i + 1)]
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
    return [(q[1] - p[1]) / l, -(q[0] - p[0]) / l] as Vec
  })
  const half = (i: number) => (w0 + ((w1 - w0) * i) / (n - 1)) / 2
  const left = spine.map(([x, y], i) => [x + nrm[i][0] * half(i), y + nrm[i][1] * half(i)] as Vec)
  const right = spine.map(([x, y], i) => [x - nrm[i][0] * half(i), y - nrm[i][1] * half(i)] as Vec)
  const [ex, ey] = spine[n - 1]
  const [px, py] = spine[n - 2]
  const dir = Math.atan2(ey - py, ex - px)
  const r = w1 / 2
  const capPts: Vec[] = []
  for (let k = 1; k < cap; k++) {
    const a = dir - Math.PI / 2 + (Math.PI * k) / cap
    capPts.push([ex + r * Math.cos(a), ey + r * Math.sin(a)])
  }
  return [...left, ...capPts, ...right.reverse()]
}

/**
 * Øret under en hat med ørehuller: konturen skæres ved `cut` (lokalt, over ørebasen), og bunden
 * lukkes med en blød, afrundet bue `depth` under snittet, så øret ender pænt nede i hullet, hvor
 * hattens forkant dækker det (review G0-r1, fund 3). `pts` skal starte og slutte under snittet.
 */
export function hatted(pts: readonly Vec[], cut: number, depth = 5): Vec[] {
  const first = pts.findIndex(([, y]) => y < cut)
  const rot = [...pts.slice(first), ...pts.slice(0, first)]
  const kept = rot.filter(([, y]) => y < cut)
  const [xr, yr] = kept[kept.length - 1]
  const [xl, yl] = kept[0]
  const bottom: Vec[] = [0.2, 0.4, 0.6, 0.8].map((t) => [xr + (xl - xr) * t, yr + (yl - yr) * t + depth * Math.sin(Math.PI * t) + (cut - (yr + (yl - yr) * t)) * 0.6])
  return [...kept, ...bottom]
}
