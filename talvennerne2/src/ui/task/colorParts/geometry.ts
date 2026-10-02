// colorParts geometry: the figure cut into parts, one path per part, drawn by the view, the demo
// and the faces (loaded with the colorParts chunk; logic.ts holds what the round needs up front).
// Parts are numbered clockwise from 12 o'clock on a circle and row by row, left to right, on the
// rectangles.
import { circle, n, polar, sector, segments } from '../../../art/materials/geom'
import { MAX_PARTS } from './logic'
import type { PartsShape } from './logic'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export interface PartsGeometry {
  w: number
  h: number
  /** One closed path per part. */
  parts: string[]
  /** The cuts between parts, as one path. */
  cuts: string
  /** The figure's outline. */
  outline: string
  /** A soft highlight stroke along the top. */
  shine: string
  rows: number
  cols: number
  /** Each part's size: a rectangle's cell (w and h), a circle's sector (its angle in degrees, radius in w). */
  sizes: { w: number; h: number; deg?: number }[]
}

/** Clearly unequal cuts (a halfShape-style figure), never accidentally equal. */
const UNEQUAL: Record<number, number[]> = {
  2: [0.64, 0.36],
  3: [0.46, 0.32, 0.22],
  4: [0.36, 0.28, 0.2, 0.16],
  5: [0.3, 0.24, 0.2, 0.15, 0.11],
  6: [0.26, 0.21, 0.17, 0.14, 0.12, 0.1],
}
const weights = (parts: number, equal: boolean) => (equal || !UNEQUAL[parts] ? Array.from({ length: parts }, () => 1 / parts) : UNEQUAL[parts])

/** Rows and columns of a rectangle cut into `parts` (cells big enough to tap on a phone). */
export function gridOf(shape: Exclude<PartsShape, 'circle'>, parts: number): [rows: number, cols: number] {
  // a bar of six or more is two rows on a phone, so every part stays a 60 px target
  if (shape === 'bar') return parts >= 6 && parts % 2 === 0 ? [2, parts / 2] : [1, parts]
  const square: Record<number, [number, number]> = { 4: [2, 2], 6: [2, 3], 8: [2, 4], 9: [3, 3], 10: [2, 5], 12: [3, 4] }
  const rect: Record<number, [number, number]> = { 6: [2, 3], 8: [2, 4], 9: [3, 3], 10: [2, 5], 12: [3, 4] }
  return (shape === 'square' ? square[parts] : rect[parts]) ?? [1, parts]
}

/** A rectangle with only the given corners rounded (tl, tr, br, bl). */
function cell(x: number, y: number, w: number, h: number, r: [number, number, number, number]): string {
  const [tl, tr, br, bl] = r.map((v) => Math.min(v, w / 2, h / 2))
  const arc = (rad: number, ex: number, ey: number) => (rad ? `A${n(rad)} ${n(rad)} 0 0 1 ${n(ex)} ${n(ey)}` : '')
  return (
    `M${n(x + tl)} ${n(y)}H${n(x + w - tr)}${arc(tr, x + w, y + tr)}` +
    `V${n(y + h - br)}${arc(br, x + w - br, y + h)}` +
    `H${n(x + bl)}${arc(bl, x, y + h - bl)}` +
    `V${n(y + tl)}${arc(tl, x + tl, y)}z`
  )
}

export function partsGeometry(shape: PartsShape, parts: number, equal = true): PartsGeometry {
  const p = clamp(Math.round(parts), 1, MAX_PARTS)
  const w = weights(p, equal)
  if (shape === 'circle') {
    const S = 240
    const c = S / 2
    const r = 110
    let a = -90
    const starts: number[] = []
    const paths = w.map((f) => {
      const a0 = a
      a += f * 360
      starts.push(a0)
      return sector(c, c, r, a0, a)
    })
    const cuts = p > 1 ? segments(starts.map((a0) => {
      const [x, y] = polar(c, c, r, a0)
      return [c, c, x, y] as const
    })) : ''
    const [hx0, hy0] = polar(c, c, r - 12, 200)
    const [hx1, hy1] = polar(c, c, r - 12, 250)
    return {
      w: S,
      h: S,
      parts: paths,
      cuts,
      outline: circle(c, c, r),
      shine: `M${n(hx0)} ${n(hy0)}A${r - 12} ${r - 12} 0 0 1 ${n(hx1)} ${n(hy1)}`,
      rows: 1,
      cols: p,
      sizes: w.map((f) => ({ w: r, h: r, deg: f * 360 })),
    }
  }
  const [rows, cols] = gridOf(shape, p)
  const box = shape === 'square' ? { W: 224, H: 224 } : shape === 'bar' ? { W: 320, H: rows === 1 ? 84 : 150 } : { W: 270, H: rows === 1 ? 170 : 180 }
  const m = 6
  const x0 = m
  const y0 = m
  const iw = box.W - 2 * m
  const ih = box.H - 2 * m
  const R = shape === 'bar' ? 14 : 18
  // one row may be cut unequally; a grid is always equal
  const colW = rows === 1 ? w.map((f) => f * iw) : Array.from({ length: cols }, () => iw / cols)
  const rowH = ih / rows
  const paths: string[] = []
  const sizes: { w: number; h: number }[] = []
  for (let r = 0; r < rows; r++) {
    let x = x0
    for (let col = 0; col < cols && paths.length < p; col++) {
      const cw = colW[col]
      const last = col === cols - 1 || paths.length === p - 1
      const top = r === 0
      const bottom = r === rows - 1
      paths.push(cell(x, y0 + r * rowH, cw, rowH, [top && col === 0 ? R : 0, top && last ? R : 0, bottom && last ? R : 0, bottom && col === 0 ? R : 0]))
      sizes.push({ w: cw, h: rowH })
      x += cw
    }
  }
  const verticals: (readonly [number, number, number, number])[] = []
  let x = x0
  for (let col = 0; col < cols - 1; col++) {
    x += colW[col]
    verticals.push([x, y0, x, y0 + ih] as const)
  }
  const horizontals = Array.from({ length: rows - 1 }, (_, r) => [x0, y0 + (r + 1) * rowH, x0 + iw, y0 + (r + 1) * rowH] as const)
  const outline = cell(x0, y0, iw, ih, [R, R, R, R])
  return {
    w: box.W,
    h: box.H,
    parts: paths,
    cuts: segments([...verticals, ...horizontals]),
    outline,
    shine: `M${n(x0 + 14)} ${n(y0 + 10)}H${n(x0 + iw * 0.38)}`,
    rows,
    cols,
    sizes,
  }
}

/** The middle of each equal part as a fraction of the figure's box (where the demo's finger taps). */
export function partCentres(shape: PartsShape, parts: number): { x: number; y: number }[] {
  const g = partsGeometry(shape, parts)
  if (shape === 'circle') {
    return Array.from({ length: g.parts.length }, (_, i) => {
      const [x, y] = polar(g.w / 2, g.h / 2, 64, -90 + ((i + 0.5) * 360) / g.parts.length)
      return { x: x / g.w, y: y / g.h }
    })
  }
  return Array.from({ length: g.parts.length }, (_, i) => ({
    x: (Math.floor(i % g.cols) + 0.5) / g.cols,
    y: (Math.floor(i / g.cols) + 0.5) / g.rows,
  }))
}
