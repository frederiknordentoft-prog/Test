// Path builders for the materials library and the stone path. Materials describe shapes with
// numbers and call these helpers instead of hand-writing long `d` strings. Output is compact and
// deterministic (at most 2 decimals), so markup hashes are stable.

export type V2 = readonly [number, number]

/** Compact number format (2 decimals, no -0). */
export function n(v: number): string {
  const r = Math.round(v * 100) / 100
  return Object.is(r, -0) ? '0' : String(r)
}
const pt = (p: V2) => `${n(p[0])} ${n(p[1])}`

export const deg = (a: number) => (a * Math.PI) / 180
export const polar = (cx: number, cy: number, r: number, aDeg: number): V2 => [cx + r * Math.cos(deg(aDeg)), cy + r * Math.sin(deg(aDeg))]

export function circle(cx: number, cy: number, r: number): string {
  return `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0z`
}

export function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0z`
}

export function rect(x: number, y: number, w: number, h: number): string {
  return `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`
}

export function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  if (rr === 0) return rect(x, y, w, h)
  return (
    `M${n(x + rr)} ${n(y)}h${n(w - 2 * rr)}a${n(rr)} ${n(rr)} 0 0 1 ${n(rr)} ${n(rr)}v${n(h - 2 * rr)}` +
    `a${n(rr)} ${n(rr)} 0 0 1 ${n(-rr)} ${n(rr)}h${n(-(w - 2 * rr))}a${n(rr)} ${n(rr)} 0 0 1 ${n(-rr)} ${n(-rr)}` +
    `v${n(-(h - 2 * rr))}a${n(rr)} ${n(rr)} 0 0 1 ${n(rr)} ${n(-rr)}z`
  )
}

/** Straight polygon through the points. */
export function poly(pts: readonly V2[], closed = true): string {
  return `M${pts.map(pt).join('L')}${closed ? 'z' : ''}`
}

/** Polygon with rounded corners (quadratic corner of radius ≈ r). */
export function roundPoly(pts: readonly V2[], r: number): string {
  const len = pts.length
  let d = ''
  for (let i = 0; i < len; i++) {
    const p = pts[i]
    const a = pts[(i - 1 + len) % len]
    const b = pts[(i + 1) % len]
    const da = Math.hypot(a[0] - p[0], a[1] - p[1])
    const db = Math.hypot(b[0] - p[0], b[1] - p[1])
    const ra = Math.min(r, da / 2)
    const rb = Math.min(r, db / 2)
    const p1: V2 = [p[0] + ((a[0] - p[0]) * ra) / da, p[1] + ((a[1] - p[1]) * ra) / da]
    const p2: V2 = [p[0] + ((b[0] - p[0]) * rb) / db, p[1] + ((b[1] - p[1]) * rb) / db]
    d += `${i === 0 ? 'M' : 'L'}${pt(p1)}Q${pt(p)} ${pt(p2)}`
  }
  return `${d}z`
}

export function regularPoints(cx: number, cy: number, r: number, sides: number, rotDeg = -90): V2[] {
  return Array.from({ length: sides }, (_, i) => polar(cx, cy, r, rotDeg + (360 * i) / sides))
}

export function starPoints(cx: number, cy: number, R: number, r: number, points = 5, rotDeg = -90): V2[] {
  return Array.from({ length: points * 2 }, (_, i) => polar(cx, cy, i % 2 ? r : R, rotDeg + (180 * i) / points))
}

/** Closed Catmull-Rom spline through the points (tension 1 = Catmull-Rom). */
export function blob(pts: readonly V2[], tension = 1): string {
  const k = tension / 6
  const len = pts.length
  const tan = pts.map((_, i) => {
    const prev = pts[(i - 1 + len) % len]
    const next = pts[(i + 1) % len]
    return [(next[0] - prev[0]) * k, (next[1] - prev[1]) * k] as V2
  })
  let d = `M${pt(pts[0])}`
  for (let i = 0; i < len; i++) {
    const j = (i + 1) % len
    d += `C${pt([pts[i][0] + tan[i][0], pts[i][1] + tan[i][1]])} ${pt([pts[j][0] - tan[j][0], pts[j][1] - tan[j][1]])} ${pt(pts[j])}`
  }
  return `${d}z`
}

/** Open Catmull-Rom spline. */
export function spline(pts: readonly V2[], tension = 1): string {
  const k = tension / 6
  const len = pts.length
  const tan = pts.map((_, i) => {
    const prev = pts[Math.max(0, i - 1)]
    const next = pts[Math.min(len - 1, i + 1)]
    return [(next[0] - prev[0]) * k, (next[1] - prev[1]) * k] as V2
  })
  let d = `M${pt(pts[0])}`
  for (let i = 0; i < len - 1; i++) {
    d += `C${pt([pts[i][0] + tan[i][0], pts[i][1] + tan[i][1]])} ${pt([pts[i + 1][0] - tan[i + 1][0], pts[i + 1][1] - tan[i + 1][1]])} ${pt(pts[i + 1])}`
  }
  return d
}

/** Pie sector from angle a0 to a1 (degrees, clockwise from 3 o'clock). */
export function sector(cx: number, cy: number, r: number, a0: number, a1: number): string {
  if (a1 - a0 >= 359.999) return circle(cx, cy, r)
  const p0 = polar(cx, cy, r, a0)
  const p1 = polar(cx, cy, r, a1)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M${n(cx)} ${n(cy)}L${pt(p0)}A${n(r)} ${n(r)} 0 ${large} 1 ${pt(p1)}z`
}

/** Open arc (for rims, hop arrows). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = polar(cx, cy, r, a0)
  const p1 = polar(cx, cy, r, a1)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  const sweep = a1 > a0 ? 1 : 0
  return `M${pt(p0)}A${n(r)} ${n(r)} 0 ${large} ${sweep} ${pt(p1)}`
}

/** Line segments as one path: [[x1,y1,x2,y2], …]. Used for ticks and grids (one element). */
export function segments(list: readonly (readonly [number, number, number, number])[]): string {
  return list.map(([x1, y1, x2, y2]) => `M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`).join('')
}

/** Several closed shapes as one path. */
export const join = (...ds: string[]) => ds.join('')

/**
 * Cel-shade crescent for a disc (SPEC §1.1 style): the part of the disc (cx, cy, r) that is NOT
 * covered by the same disc shifted by (-dx, -dy). With (dx, dy) pointing down-right this is the
 * shade half-moon at the lower right, as one exact path (no clip needed).
 */
export function lune(cx: number, cy: number, r: number, dx: number, dy: number): string {
  const d = Math.hypot(dx, dy)
  if (d === 0 || d >= 2 * r) return ''
  const ux = dx / d
  const uy = dy / d
  const mx = cx - dx / 2
  const my = cy - dy / 2
  const h = Math.sqrt(r * r - (d / 2) ** 2)
  const p1: V2 = [mx - uy * h, my + ux * h]
  const p2: V2 = [mx + uy * h, my - ux * h]
  const sweepThrough = (c: V2, from: V2, via: V2, to: V2) => {
    const ang = (p: V2) => Math.atan2(p[1] - c[1], p[0] - c[0])
    const tau = Math.PI * 2
    const norm = (a: number) => ((a % tau) + tau) % tau
    const a0 = ang(from)
    return norm(ang(via) - a0) < norm(ang(to) - a0) ? 1 : 0
  }
  const c1: V2 = [cx, cy]
  const c2: V2 = [cx - dx, cy - dy]
  const far: V2 = [cx + ux * r, cy + uy * r]
  const inner: V2 = [c2[0] + ux * r, c2[1] + uy * r]
  const s1 = sweepThrough(c1, p1, far, p2)
  const s2 = sweepThrough(c2, p2, inner, p1)
  return `M${pt(p1)}A${n(r)} ${n(r)} 0 1 ${s1} ${pt(p2)}A${n(r)} ${n(r)} 0 0 ${s2} ${pt(p1)}z`
}

/** Deterministic pseudo-random in [0,1) from an integer (for pebble shapes, scattered things). */
export function hash01(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
