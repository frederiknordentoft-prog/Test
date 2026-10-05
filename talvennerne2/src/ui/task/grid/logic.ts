// grid (SPEC §3.2, A21), the part without React: what a grid task asks and what the view hands in
// (the drawing's geometry is in geometry.ts). The view is for points only (PLAYABLE.grid):
//   place — "Sæt punktet tre, to.": the child taps a crossing of the net (a new tap or a drag moves the
//           point); the answer is one token, 'pt:3,2'.
//   read  — a point is drawn: the child taps its number on the axis below and on the axis to the left;
//           the answer is the two tokens 'x:3|y:2', a set (the order of the taps never matters).
// A number asked over a net (symmetry: "Hvor mange felter mangler?") is no point: it stays on the keypad.
import type { AnswerValue, Task } from '../../../engine/types'

export type GridMode = 'place' | 'read'
export type Axis = 'x' | 'y'

export interface Pt {
  x: number
  y: number
}

export interface GridSetup {
  /** Squares across and up: the axes run 0–w and 0–h. */
  w: number
  h: number
  mode: GridMode
  /** place: the point asked for. read: the point drawn. */
  point: Pt
}

const PT = /^pt:(\d+),(\d+)$/
const XY = /^x:(\d+)\|y:(\d+)$/

/** The point an answer value names: 'pt:3,2', or 'x:3|y:2' with its tokens in either order. */
export function pointOf(v: AnswerValue | null | undefined): Pt | null {
  if (typeof v !== 'string') return null
  const one = PT.exec(v)
  if (one) return { x: Number(one[1]), y: Number(one[2]) }
  const both = XY.exec(v.split('|').sort().join('|'))
  return both ? { x: Number(both[1]), y: Number(both[2]) } : null
}

/** What a task asks of the net, or null when it is no point task (it falls back to cards or keys). */
export function gridSetup(task: Pick<Task, 'prompt' | 'answer' | 'answerType'>): GridSetup | null {
  const p = task.prompt
  if (p.scene !== 'grid' || !p.coords || task.answerType !== 'set' || typeof task.answer !== 'string') return null
  const mode: GridMode | null = PT.test(task.answer) ? 'place' : XY.test(task.answer) ? 'read' : null
  const asked = pointOf(task.answer)
  const fits = (q: Pt) => q.x >= 0 && q.y >= 0 && q.x <= p.w && q.y <= p.h
  if (!mode || !asked || !fits(asked) || p.w < 1 || p.h < 1 || p.w > 10 || p.h > 10) return null
  if (mode === 'place') return { w: p.w, h: p.h, mode, point: asked }
  // reading needs the point on the net; the drawn point is the one the answer names
  if (!p.point) return null
  const drawn = { x: p.point[0], y: p.point[1] }
  return fits(drawn) ? { w: p.w, h: p.h, mode, point: drawn } : null
}

/** A point task can be played on the net; anything else (a count, a cell) falls back. */
export const canGrid = (t: Pick<Task, 'prompt' | 'answer' | 'answerType'>) => gridSetup(t) !== null

/** The net is the answer surface: the view draws it, so the round leaves the prompt card out. */
export const gridOwnsPrompt = (t: Task) => canGrid(t)

/** What the view hands in. */
export const placeValue = (q: Pt) => `pt:${q.x},${q.y}`
export const readValue = (x: number, y: number) => `x:${x}|y:${y}`
