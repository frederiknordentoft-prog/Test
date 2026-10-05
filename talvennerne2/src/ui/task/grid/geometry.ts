// grid (SPEC §3.2, A21): where things sit on the drawing of the net, in drawing units — the crossings,
// the axis numbers, and the HTML tap layers over the svg (the view and the demo film; the round's
// registry only needs logic.ts).
import type { Axis, Pt } from './logic'

/**
 * Drawing units. One square is CELL wide; the bands below and left of the net hold the axis numbers
 * and are the read mode's tap strips, PAD.b and PAD.l deep (≥ 60 px at every size the view is drawn).
 */
export const CELL = 40
export const PAD = { l: 68, r: 26, t: 26, b: 68 } as const

export const frameOf = (w: number, h: number) => ({ W: PAD.l + w * CELL + PAD.r, H: PAD.t + h * CELL + PAD.b })
/** Drawing x of the crossing column x, and drawing y of the crossing row y on a net h high. */
export const ux = (x: number) => PAD.l + x * CELL
export const uy = (h: number, y: number) => PAD.t + (h - y) * CELL

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** The crossing nearest a point in drawing units, kept on the net. */
export function crossingAt(u: number, v: number, w: number, h: number): Pt {
  return { x: clamp(Math.round((u - PAD.l) / CELL), 0, w), y: clamp(Math.round(h - (v - PAD.t) / CELL), 0, h) }
}

/** The number on an axis nearest a press along it (drawing units): x along the bottom, y up the left. */
export function axisAt(axis: Axis, unit: number, w: number, h: number): number {
  return axis === 'x' ? clamp(Math.round((unit - PAD.l) / CELL), 0, w) : clamp(Math.round(h - (unit - PAD.t) / CELL), 0, h)
}

/** A box in drawing units as percentages of the drawing (for the HTML layers over the svg). */
export function percentBox(w: number, h: number, left: number, top: number, width: number, height: number) {
  const { W, H } = frameOf(w, h)
  const pc = (a: number, b: number) => `${((100 * a) / b).toFixed(3)}%`
  return { left: pc(left, W), top: pc(top, H), width: pc(width, W), height: pc(height, H) }
}

/** The tap layers: the net with half a square round it (place), and the two bands of numbers (read). */
export function layers(w: number, h: number) {
  const half = CELL / 2
  return {
    board: percentBox(w, h, ux(0) - half, uy(h, h) - half, (w + 1) * CELL, (h + 1) * CELL),
    x: percentBox(w, h, ux(0) - half, uy(h, 0), (w + 1) * CELL, PAD.b),
    y: percentBox(w, h, 0, uy(h, h) - half, PAD.l, (h + 1) * CELL),
  }
}

/** A step on the keyboard: arrows move a point (or a number) one square, kept on the net. */
export function stepped(q: Pt, key: string, w: number, h: number): Pt | null {
  const d: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
  const s = d[key]
  return s ? { x: clamp(q.x + s[0], 0, w), y: clamp(q.y + s[1], 0, h) } : null
}
