// colorParts (SPEC §3.2), the part without React: the figure a task asks to colour and the answer
// (the drawing is in geometry.ts). The answer is the fraction coloured, 'frac:<coloured>/<parts>' —
// the skill lists equal fractions in Task.accept ('frac:2/4' for 1/2). A task that asks for
// particular parts (answerType 'set') gets them as 'p0|p2'.
import type { AnswerValue, Task } from '../../../engine/types'

/** The contract has circle, rect and bar; 'square' is drawn too (proposed for the fraction scene). */
export type PartsShape = 'circle' | 'rect' | 'bar' | 'square'
const SHAPES: readonly string[] = ['circle', 'rect', 'bar', 'square']

export const MAX_PARTS = 12

export interface Frac {
  n: number
  d: number
}

export interface PartsSetup {
  shape: PartsShape
  parts: number
  /** Equal parts (a deliberately unequal cut is drawn as such). */
  equal: boolean
  /** The fraction asked for, shown as the question: 'frac:3/4' → 3/4. */
  target: Frac | null
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** 'frac:3/4' → { n: 3, d: 4 }. */
export function fracOf(v: AnswerValue): Frac | null {
  if (typeof v !== 'string') return null
  const m = /^frac:(\d+)\/(\d+)$/.exec(v)
  if (!m) return null
  const f = { n: Number(m[1]), d: Number(m[2]) }
  return f.d > 0 && f.n <= f.d ? f : null
}

/** The figure: the prompt's fraction scene, else a circle cut into the answer's denominator. */
export function partsSetup(task: Pick<Task, 'prompt' | 'answer'>): PartsSetup {
  const target = fracOf(task.answer)
  const p = task.prompt
  if (p.scene === 'fraction') {
    const shape = SHAPES.includes(p.shape) ? (p.shape as PartsShape) : 'circle'
    return { shape, parts: clamp(Math.round(p.parts) || 2, 2, MAX_PARTS), equal: p.equal !== false, target }
  }
  return { shape: 'circle', parts: clamp(target?.d ?? 4, 2, MAX_PARTS), equal: true, target }
}

/** Colouring can answer a fraction token, or a set of parts. */
export const canColorParts = (t: Pick<Task, 'answer' | 'answerType'>) =>
  fracOf(t.answer) !== null || (t.answerType === 'set' && typeof t.answer === 'string' && /^p\d+(\|p\d+)*$/.test(t.answer))

/** The figure is the prompt itself: the view draws it, the card is left out. */
export const colorPartsOwnsPrompt = (t: Task) => t.prompt.scene === 'fraction'

/** What the coloured parts hand in. */
export function partsValue(task: Pick<Task, 'answerType'>, on: readonly number[], parts: number): AnswerValue {
  if (task.answerType === 'set') return [...on].sort((a, b) => a - b).map((i) => `p${i}`).join('|')
  return `frac:${on.length}/${parts}`
}

/** The parts that picture an answer value: listed parts, or the first k of the figure's parts. */
export function partsOfValue(value: AnswerValue, parts: number): number[] {
  if (typeof value === 'string' && /^p\d+(\|p\d+)*$/.test(value)) {
    return [...new Set(value.split('|').map((t) => Number(t.slice(1))))].filter((i) => i < parts).sort((a, b) => a - b)
  }
  const f = fracOf(value)
  if (!f) return []
  const k = clamp(Math.round((f.n / f.d) * parts), 0, parts)
  return Array.from({ length: k }, (_, i) => i)
}

// The struck answer is the child's own colouring: the view remembers the parts it handed in.
const colourings = new Map<string, number[]>()
const colouringKey = (taskId: string, value: AnswerValue) => `${taskId}\u0000${String(value)}`

export function rememberColouring(taskId: string, value: AnswerValue, on: readonly number[]): void {
  colourings.delete(colouringKey(taskId, value))
  colourings.set(colouringKey(taskId, value), [...on])
  while (colourings.size > 8) colourings.delete(colourings.keys().next().value as string)
}

export function rememberedColouring(taskId: string, value: AnswerValue): number[] | null {
  return colourings.get(colouringKey(taskId, value)) ?? null
}
