// Parametriske primitiver. Dette er den ENESTE fil i src/art, hvor path-strenge bygges i hånden;
// artsfiler og genstande beskriver former med punkter og kalder hjælperne her (lint: ingen
// `d`-literal over 40 tegn uden for shapes.ts).
import type { Pt } from './types'

export type Vec = readonly [number, number]

/** Kompakt, deterministisk talformat (1 decimal). */
export function n(v: number): string {
  const r = Math.round(v * 10) / 10
  return Object.is(r, -0) ? '0' : String(r)
}
const p = (v: Vec) => `${n(v[0])} ${n(v[1])}`

export const vec = (pt: Pt): Vec => [pt.x, pt.y]
export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]]
export const lerp = (a: Vec, b: Vec, t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** Flyt, rotér (grader) og skalér punkter om `about` (standard origo). */
export function xf(
  pts: readonly Vec[],
  o: { dx?: number; dy?: number; rot?: number; sx?: number; sy?: number; about?: Vec },
): Vec[] {
  const [ax, ay] = o.about ?? [0, 0]
  const r = ((o.rot ?? 0) * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  const sx = o.sx ?? 1
  const sy = o.sy ?? sx
  return pts.map(([x, y]) => {
    const lx = (x - ax) * sx
    const ly = (y - ay) * sy
    return [ax + lx * cos - ly * sin + (o.dx ?? 0), ay + lx * sin + ly * cos + (o.dy ?? 0)] as Vec
  })
}

/** Spejl punkter om den lodrette linje x = cx. */
export const mirrorX = (pts: readonly Vec[], cx = 0): Vec[] => pts.map(([x, y]) => [2 * cx - x, y] as Vec)

/**
 * Symmetrisk lukket løkke ud fra venstre halvdel, ordnet fra toppen (på midterlinjen) til bunden
 * (på midterlinjen). Højre halvdel spejles og vendes, så løkken går rundt uden dobbeltpunkter.
 */
export function symmetric(half: readonly Vec[], cx = 0): Vec[] {
  const inner = half.slice(1, -1)
  const right = mirrorX(inner, cx).reverse()
  return [...half, ...right]
}

function tangents(pts: readonly Vec[], closed: boolean, tension: number): Vec[] {
  const k = tension / 6
  const len = pts.length
  return pts.map((_, i) => {
    const prev = pts[closed ? (i - 1 + len) % len : Math.max(0, i - 1)]
    const next = pts[closed ? (i + 1) % len : Math.min(len - 1, i + 1)]
    return [(next[0] - prev[0]) * k, (next[1] - prev[1]) * k] as Vec
  })
}

/** Lukket Catmull-Rom-spline gennem punkterne (tension 1 = Catmull-Rom, lavere = strammere). */
export function blob(pts: readonly Vec[], tension = 1): string {
  const t = tangents(pts, true, tension)
  let d = `M${p(pts[0])}`
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    d += `C${p(add(pts[i], t[i]))} ${p([pts[j][0] - t[j][0], pts[j][1] - t[j][1]])} ${p(pts[j])}`
  }
  return `${d}Z`
}

/** Symmetrisk blob om x = cx ud fra venstre halvdel (top → bund). */
export const symBlob = (half: readonly Vec[], cx = 0, tension = 1) => blob(symmetric(half, cx), tension)

/** Åben Catmull-Rom-spline (til konturer der ikke må lukkes, knurhår, øjenlåg). */
export function spline(pts: readonly Vec[], tension = 1): string {
  const t = tangents(pts, false, tension)
  let d = `M${p(pts[0])}`
  for (let i = 0; i < pts.length - 1; i++) {
    d += `C${p(add(pts[i], t[i]))} ${p([pts[i + 1][0] - t[i + 1][0], pts[i + 1][1] - t[i + 1][1]])} ${p(pts[i + 1])}`
  }
  return d
}

/** Bakkekam (scener): en blød, åben kurve gennem punkterne (venstre → højre), lukket lodret ned til `bottom`. */
export function ridge(pts: readonly Vec[], bottom: number, tension = 1): string {
  const first = pts[0]
  const last = pts[pts.length - 1]
  return `${spline(pts, tension)}L${p([last[0], bottom])}L${p([first[0], bottom])}Z`
}

/** Rette linjestykker. */
export function poly(pts: readonly Vec[], closed = true): string {
  return `M${pts.map(p).join('L')}${closed ? 'Z' : ''}`
}

/** Andengradskurve fra a over kontrolpunkt c til b (åben). */
export const quad = (a: Vec, c: Vec, b: Vec) => `M${p(a)}Q${p(c)} ${p(b)}`

/** Kubisk kurve (åben). */
export const cubic = (a: Vec, c1: Vec, c2: Vec, b: Vec) => `M${p(a)}C${p(c1)} ${p(c2)} ${p(b)}`

/** Kubisk håndtagsfaktor for en superellipse med eksponent e (e = 2 → 0,5523). */
export const squircleK = (e: number) => (8 * 2 ** (-1 / e) - 4) / 3

export interface BunSpec {
  cx: number
  /** y for siderne (bredeste sted). */
  cy: number
  rx: number
  /** Afstand fra siderne op til toppen og ned til bunden. */
  top: number
  bottom: number
  /** Eksponenter (2 = ellipse, højere = mere firkantet) for øvre og nedre halvdel. */
  eTop?: number
  eBottom?: number
  /** Gør toppen smallere end bunden (0 = lige), fx 0.08 → toppens håndtag trækkes ind. */
  taper?: number
}

/**
 * Bolle/æg-form af 4 kubiske segmenter: hoved (bredest ved kinderne), krop (flad bund).
 * Glat (C1) i alle 4 samlinger.
 */
export function bun(s: BunSpec): string {
  const kt = squircleK(s.eTop ?? 2)
  const kb = squircleK(s.eBottom ?? 2)
  const taper = s.taper ?? 0
  const T: Vec = [s.cx, s.cy - s.top]
  const R: Vec = [s.cx + s.rx, s.cy]
  const B: Vec = [s.cx, s.cy + s.bottom]
  const L: Vec = [s.cx - s.rx, s.cy]
  const hx = s.rx * kt * (1 - taper)
  return (
    `M${p(T)}` +
    `C${p([T[0] + hx, T[1]])} ${p([R[0], R[1] - s.top * kt])} ${p(R)}` +
    `C${p([R[0], R[1] + s.bottom * kb])} ${p([B[0] + s.rx * kb, B[1]])} ${p(B)}` +
    `C${p([B[0] - s.rx * kb, B[1]])} ${p([L[0], L[1] + s.bottom * kb])} ${p(L)}` +
    `C${p([L[0], L[1] - s.top * kt])} ${p([T[0] - hx, T[1]])} ${p(T)}Z`
  )
}

/** Superellipse (e = 2 er en ellipse). */
export const superellipse = (cx: number, cy: number, rx: number, ry: number, e = 2) =>
  bun({ cx, cy, rx, top: ry, bottom: ry, eTop: e, eBottom: e })

/** Ellipse som path (kan roteres i grader om centrum). */
export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0): string {
  if (rot === 0) return superellipse(cx, cy, rx, ry)
  const k = squircleK(2)
  const base: Vec[] = [
    [0, -ry], [rx * k, -ry], [rx, -ry * k], [rx, 0], [rx, ry * k], [rx * k, ry], [0, ry],
    [-rx * k, ry], [-rx, ry * k], [-rx, 0], [-rx, -ry * k], [-rx * k, -ry],
  ]
  const q = xf(base, { rot, dx: cx, dy: cy })
  return `M${p(q[0])}C${p(q[1])} ${p(q[2])} ${p(q[3])}C${p(q[4])} ${p(q[5])} ${p(q[6])}C${p(q[7])} ${p(q[8])} ${p(q[9])}C${p(q[10])} ${p(q[11])} ${p(q[0])}Z`
}

export const circle = (cx: number, cy: number, r: number) => superellipse(cx, cy, r, r)

/** Elliptisk bue (åben) fra vinkel a0 til a1 (grader, 0 = højre, 90 = ned). */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): string {
  const r0 = (a0 * Math.PI) / 180
  const r1 = (a1 * Math.PI) / 180
  const s: Vec = [cx + rx * Math.cos(r0), cy + ry * Math.sin(r0)]
  const e: Vec = [cx + rx * Math.cos(r1), cy + ry * Math.sin(r1)]
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  const sweep = a1 > a0 ? 1 : 0
  return `M${p(s)}A${n(rx)} ${n(ry)} 0 ${large} ${sweep} ${p(e)}`
}

/**
 * Halvmåne langs bunden af en ellipse: ydre bue fra vinkel a0 til a1 (gennem 90° = bunden) og en
 * blødere indre kurve tilbage. `thick` er tykkelsen midt på. Bruges til iris-ringen og skygger.
 */
export function lune(cx: number, cy: number, rx: number, ry: number, thick: number, a0 = 25, a1 = 155): string {
  const at = (a: number): Vec => {
    const r = (a * Math.PI) / 180
    return [cx + rx * Math.cos(r), cy + ry * Math.sin(r)]
  }
  const s = at(a0)
  const e = at(a1)
  const mid = ((a0 + a1) / 2) * (Math.PI / 180)
  const outer: Vec = [cx + rx * Math.cos(mid), cy + ry * Math.sin(mid)]
  // Kontrolpunktet placeres, så kurvens midte ligger `thick` inden for den ydre bue.
  const target: Vec = [outer[0] - Math.cos(mid) * thick, outer[1] - Math.sin(mid) * thick]
  const c: Vec = [2 * target[0] - (s[0] + e[0]) / 2, 2 * target[1] - (s[1] + e[1]) / 2]
  const large = a1 - a0 > 180 ? 1 : 0
  return `M${p(s)}A${n(rx)} ${n(ry)} 0 ${large} 1 ${p(e)}Q${p(c)} ${p(s)}Z`
}

/** Punkter på en ellipse. */
export function ring(cx: number, cy: number, rx: number, ry: number, count: number, phase = 0): Vec[] {
  return Array.from({ length: count }, (_, i) => {
    const a = ((phase + (360 * i) / count) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Vec
  })
}

/**
 * Fnugget "sky"-kontur (halekvast, uld, manke): buer mellem punkter på en ellipse, der buler udad.
 * `puff` er buernes radius relativt til korden (0,5 = halvcirkler).
 */
export function scallop(cx: number, cy: number, rx: number, ry: number, lobes: number, puff = 0.62, phase = -90, rot = 0): string {
  const base = ring(cx, cy, rx, ry, lobes, phase)
  const pts = rot ? xf(base, { rot, about: [cx, cy] }) : base
  let d = `M${p(pts[0])}`
  for (let i = 0; i < lobes; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % lobes]
    const r = Math.hypot(b[0] - a[0], b[1] - a[1]) * puff
    d += `A${n(r)} ${n(r)} 0 0 1 ${p(b)}`
  }
  return `${d}Z`
}

/**
 * Glimt/stjerne med indadbuede sider (4 = glimmer ✦, 5 = stjerne). `inner` er kontrolpunkternes
 * radius: lille = spids glimt, stor = buttet stjerne.
 */
export function star(cx: number, cy: number, r: number, inner: number, points = 4, rot = 0): string {
  const at = (rad: number, a: number): Vec => {
    const t = ((rot + a - 90) * Math.PI) / 180
    return [cx + rad * Math.cos(t), cy + rad * Math.sin(t)]
  }
  let d = `M${p(at(r, 0))}`
  for (let i = 0; i < points; i++) {
    const a0 = (360 * i) / points
    const a1 = (360 * (i + 1)) / points
    d += `Q${p(at(inner, (a0 + a1) / 2))} ${p(at(r, a1))}`
  }
  return `${d}Z`
}

/** Kapsel (pølse) fra a til b med radius r – poter, ben. */
export function capsule(a: Vec, b: Vec, ra: number, rb = ra): string {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  const nx = Math.cos(ang + Math.PI / 2)
  const ny = Math.sin(ang + Math.PI / 2)
  const a1: Vec = [a[0] + nx * ra, a[1] + ny * ra]
  const a2: Vec = [a[0] - nx * ra, a[1] - ny * ra]
  const b1: Vec = [b[0] + nx * rb, b[1] + ny * rb]
  const b2: Vec = [b[0] - nx * rb, b[1] - ny * rb]
  return `M${p(a1)}L${p(b1)}A${n(rb)} ${n(rb)} 0 0 0 ${p(b2)}L${p(a2)}A${n(ra)} ${n(ra)} 0 0 0 ${p(a1)}Z`
}

/** Ret streg fra a til b. */
export const line = (a: Vec, b: Vec) => `M${p(a)}L${p(b)}`

/**
 * Den del af en ellipse, der ligger under en (let skrå) linje – halvt lukkede øjne.
 * `cut` er linjens y midt på, `tilt` hvor meget højre ende ligger lavere end venstre.
 */
export function ellipseBelow(cx: number, cy: number, rx: number, ry: number, cut: number, tilt = 0): string {
  const dy = cut - cy
  const w = rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)))
  return `M${p([cx - w, cut - tilt / 2])}A${n(rx)} ${n(ry)} 0 1 0 ${p([cx + w, cut + tilt / 2])}Z`
}

/**
 * Den del af en ellipse, der ligger over et buet underlåg (genert knib: kinderne skubber op).
 * `cut` er underlågets y i enderne, `lift` hvor meget midten buer op.
 */
export function ellipseAbove(cx: number, cy: number, rx: number, ry: number, cut: number, lift: number): string {
  const dy = cut - cy
  const w = rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)))
  return `M${p([cx - w, cut])}A${n(rx)} ${n(ry)} 0 1 1 ${p([cx + w, cut])}Q${p([cx, cut - 2 * lift])} ${p([cx - w, cut])}Z`
}

/** D-formet åben mund: let buet overlæbe fra venstre til højre og en dyb, rund bund. */
export function dMouth(cx: number, top: number, w: number, depth: number, lip = 1.6): string {
  return (
    `M${p([cx - w, top])}Q${p([cx, top + lip])} ${p([cx + w, top])}` +
    `C${p([cx + w * 0.9, top + depth])} ${p([cx - w * 0.9, top + depth])} ${p([cx - w, top])}Z`
  )
}

/** Dråbe med spids opad (svedperle). r er den runde bunds radius. */
export function drop(cx: number, cy: number, r: number): string {
  return (
    `M${p([cx, cy - 1.9 * r])}C${p([cx + 0.35 * r, cy - 1.25 * r])} ${p([cx + r, cy - 0.6 * r])} ${p([cx + r, cy + 0.1 * r])}` +
    `A${n(r)} ${n(r)} 0 0 1 ${p([cx - r, cy + 0.1 * r])}` +
    `C${p([cx - r, cy - 0.6 * r])} ${p([cx - 0.35 * r, cy - 1.25 * r])} ${p([cx, cy - 1.9 * r])}Z`
  )
}

/** Z-form (søvn) af rette streger. */
export function zee(cx: number, cy: number, s: number): string {
  return poly(
    [
      [cx - s, cy - s],
      [cx + s, cy - s],
      [cx - s, cy + s],
      [cx + s, cy + s],
    ],
    false,
  )
}

/** Rektangel (evt. afrundet). */
export function rect(x: number, y: number, w: number, h: number, r = 0): string {
  if (r <= 0) return poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]])
  const q = Math.min(r, w / 2, h / 2)
  return (
    `M${p([x + q, y])}L${p([x + w - q, y])}Q${p([x + w, y])} ${p([x + w, y + q])}` +
    `L${p([x + w, y + h - q])}Q${p([x + w, y + h])} ${p([x + w - q, y + h])}` +
    `L${p([x + q, y + h])}Q${p([x, y + h])} ${p([x, y + h - q])}` +
    `L${p([x, y + q])}Q${p([x, y])} ${p([x + q, y])}Z`
  )
}

/** Saml flere delstier til én path (færre elementer). */
export const join = (...ds: (string | false | null | undefined)[]) => ds.filter(Boolean).join('')

/** Stor firkant med et hul (evenodd): bruges til cel-skygge, der klippes til en krop. */
export const outside = (hole: string, box = 400) => `${rect(-box, -box, box * 2, box * 2)}${hole}`

/**
 * Cel-skygge uden klip: tegn formen i skyggefarven og læg denne "lyse kopi" ovenpå – formen krympet
 * mod lyspunktet (øverst til venstre). For konvekse former ligger kopien altid inden i originalen,
 * så skyggen bliver en halvmåne, tykkest nederst til højre.
 */
export function litCopy(pts: readonly Vec[], light: Vec, k = 0.9): Vec[] {
  return xf(pts, { sx: k, about: light })
}

/**
 * Bånd mellem to vandrette kurver (fx en strikket kant), afgrænset af x0..x1. `sag` er hvor meget
 * midten hænger ned; underkanten kan hænge mere (`sagBottom`), fx en krave der spidser til.
 */
export function band(x0: number, x1: number, top: number, bottom: number, sag = 0, sagBottom = sag): string {
  const mx = (x0 + x1) / 2
  return (
    `M${p([x0, top])}Q${p([mx, top + sag * 2])} ${p([x1, top])}` +
    `L${p([x1, bottom])}Q${p([mx, bottom + sagBottom * 2])} ${p([x0, bottom])}Z`
  )
}

/**
 * Blødt bånd med afrundede ender (hueombuk, pandebånd): to parabler (top/bund) der følger
 * hovedets rundning, lukket med runde ender.
 */
export function softBand(x0: number, x1: number, top: number, bottom: number, sag = 0, sagBottom = sag): string {
  const mx = (x0 + x1) / 2
  const half = (x1 - x0) / 2
  const k = 4
  const at = (t: number, y: number, s: number): Vec => {
    const x = mx + half * t
    return [x, y + s * (1 - t * t)]
  }
  const topPts: Vec[] = []
  const botPts: Vec[] = []
  for (let i = -k; i <= k; i++) topPts.push(at(i / k, top, sag))
  for (let i = k; i >= -k; i--) botPts.push(at(i / k, bottom, sagBottom))
  const r = (bottom - top) / 2
  const endR: Vec = [x1 + r * 0.55, (top + bottom) / 2]
  const endL: Vec = [x0 - r * 0.55, (top + bottom) / 2]
  return blob([...topPts, endR, ...botPts, endL], 0.85)
}

/** Korte lodrette streger (ribkant, strik) som én path. */
export function ribs(x0: number, x1: number, top: number, bottom: number, count: number, sag = 0): string {
  const mx = (x0 + x1) / 2
  const half = (x1 - x0) / 2
  let d = ''
  for (let i = 1; i < count; i++) {
    const x = x0 + ((x1 - x0) * i) / count
    const t = 1 - ((x - mx) / half) ** 2
    d += `M${p([x, top + sag * t])}L${p([x, bottom + sag * t])}`
  }
  return d
}

/** Transform-streng: translate → rotate → scale (SVG-rækkefølge). */
export function tf(o: { x?: number; y?: number; rot?: number; sx?: number; sy?: number }): string | undefined {
  const parts: string[] = []
  if (o.x || o.y) parts.push(`translate(${n(o.x ?? 0)} ${n(o.y ?? 0)})`)
  if (o.rot) parts.push(`rotate(${n(o.rot)})`)
  const sx = o.sx ?? 1
  const sy = o.sy ?? sx
  if (sx !== 1 || sy !== 1) parts.push(sx === sy ? `scale(${fmt3(sx)})` : `scale(${fmt3(sx)} ${fmt3(sy)})`)
  return parts.length ? parts.join(' ') : undefined
}

/** Skalafaktorer skal have 3 decimaler (små fejl syner ved store tegninger). */
export function fmt3(v: number): string {
  const r = Math.round(v * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

// ---------------------------------------------------------------------------------------------
// Hår og pels (kat, hest, enhjørning): lokker, totter og forskudte konturer.

/** Enhedsnormalen (mod venstre i løberetningen) i hvert punkt af en polyline. */
function normalsOf(pts: readonly Vec[], closed: boolean): Vec[] {
  const len = pts.length
  return pts.map((_, i) => {
    const prev = pts[closed ? (i - 1 + len) % len : Math.max(0, i - 1)]
    const next = pts[closed ? (i + 1) % len : Math.min(len - 1, i + 1)]
    const dx = next[0] - prev[0]
    const dy = next[1] - prev[1]
    const l = Math.hypot(dx, dy) || 1
    return [dy / l, -dx / l] as Vec
  })
}

/**
 * Forskyd en lukket kontur `d` enheder udad (negativ = indad). Punkterne skal gå med uret i
 * skærmkoordinater (y nedad), som alle former fra `symmetric` gør. Bruges til OutlineFn's `inflate`.
 */
export function offsetLoop(pts: readonly Vec[], d: number): Vec[] {
  if (!d) return [...pts]
  const nn = normalsOf(pts, true)
  return pts.map(([x, y], i) => [x - nn[i][0] * d, y - nn[i][1] * d] as Vec)
}

/**
 * Bånd langs en rygrad (lok, hale, manke): lukket kontur, hvor `widths` er den fulde bredde i hvert
 * punkt (et tal = samme bredde hele vejen). Bredde 0 i enden giver en spids lok.
 */
export function ribbon(spine: readonly Vec[], widths: readonly number[] | number): Vec[] {
  const nn = normalsOf(spine, false)
  const w = (i: number) => (typeof widths === 'number' ? widths : widths[Math.min(i, widths.length - 1)]) / 2
  const left = spine.map(([x, y], i) => [x + nn[i][0] * w(i), y + nn[i][1] * w(i)] as Vec)
  const right = spine.map(([x, y], i) => [x - nn[i][0] * w(i), y - nn[i][1] * w(i)] as Vec)
  // Spidse ender (bredde 0) giver to ens punkter; det ene fjernes, så splinen ikke får et knæk.
  const tail = w(spine.length - 1) < 0.05 ? right.slice(0, -1) : right
  return [...left, ...tail.reverse()]
}

/**
 * Pelstotter rundt om en ellipse (krave, pjusket hale, kindtotter): skiftevis spidser og dale.
 * `depth` er dalenes dybde, `swirl` drejer spidserne (grader) så totterne ser strøgne ud, og
 * `jitter` gør dybderne en anelse uens (deterministisk).
 */
export function tufts(
  cx: number, cy: number, rx: number, ry: number, count: number,
  o: { depth?: number; swirl?: number; jitter?: number; phase?: number; from?: number; to?: number } = {},
): Vec[] {
  const depth = o.depth ?? 0.16
  const swirl = o.swirl ?? 0
  const jitter = o.jitter ?? 0
  const phase = o.phase ?? -90
  const from = o.from ?? 0
  const to = o.to ?? 360
  const full = to - from >= 360
  const steps = full ? count * 2 : count * 2 + 1
  const pts: Vec[] = []
  for (let i = 0; i < steps; i++) {
    const tip = i % 2 === 0
    const a = ((phase + from + ((to - from) * i) / (count * 2) + (tip ? swirl : 0)) * Math.PI) / 180
    const k = tip ? 1 - jitter * (0.5 + 0.5 * Math.sin(i * 2.7 + 1.3)) : 1 - depth
    pts.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)])
  }
  return pts
}

/**
 * Pigkant af buer (pindsvinets pigkappe): `count` bløde pigge rundt om en ellipse fra vinkel `from` til
 * `to` (grader, 0 = højre, 90 = ned; med uret). Hver pig er to konvekse buer, der mødes i en blød spids
 * på ellipsen; dalene ligger `depth` (andel af radius) inde. `swirl` drejer spidserne (grader), så
 * piggene ser strøgne ud, og `bulge` er buernes krumning (0,5 = kvartcirkel, 1 = halvcirkel). En åben
 * bue (to − from < 360) lukkes med en ret linje mellem endedalene (den skjules bag hoved eller krop).
 */
export function spikes(
  cx: number, cy: number, rx: number, ry: number, count: number,
  o: { depth?: number; swirl?: number; bulge?: number; from?: number; to?: number } = {},
): string {
  const depth = o.depth ?? 0.18
  const swirl = o.swirl ?? 0
  const half = (Math.min(1, Math.max(0.05, o.bulge ?? 0.5)) * Math.PI) / 2
  const from = o.from ?? 0
  const to = o.to ?? 360
  const at = (deg: number, k: number): Vec => {
    const t = (deg * Math.PI) / 180
    return [cx + rx * k * Math.cos(t), cy + ry * k * Math.sin(t)]
  }
  // Buen fra a til b buler udad (med uret rundt om ellipsen); radius ud fra korden og buens vinkel.
  const arcTo = (a: Vec, b: Vec) => {
    const r = Math.hypot(b[0] - a[0], b[1] - a[1]) / (2 * Math.sin(half))
    return `A${n(r)} ${n(r)} 0 0 1 ${p(b)}`
  }
  const step = (to - from) / count
  let prev = at(from, 1 - depth)
  let d = `M${p(prev)}`
  for (let i = 0; i < count; i++) {
    const tip = at(from + step * (i + 0.5) + swirl, 1)
    const next = at(from + step * (i + 1), 1 - depth)
    d += arcTo(prev, tip) + arcTo(tip, next)
    prev = next
  }
  return `${d}Z`
}

/** Punkter på en ellipse-bue fra vinkel a0 til a1 (grader, 0 = højre, 90 = ned), inkl. enderne. */
export function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, count: number): Vec[] {
  return Array.from({ length: count }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / (count - 1)) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Vec
  })
}

/** Skalér normaliserede punkter (u, v ∈ ca. −1…1) ind i en ellipse-ramme. */
export const frame = (pts: readonly Vec[], cx: number, cy: number, rx: number, ry: number): Vec[] =>
  pts.map(([u, v]) => [cx + u * rx, cy + v * ry] as Vec)
