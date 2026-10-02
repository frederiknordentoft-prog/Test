// share (SPEC §3.2), the part without React: what is shared among how many plates, and what the
// plates hand in. The answer is how many each plate got when they all got the same; an uneven deal
// is −1, which the engine tags shareUnequal (src/engine/misconceptions.ts). A task that asks for the
// deal itself (answerType 'set') gets the plates' counts, largest first: '4|4|4'.
import type { AnswerValue, Task } from '../../../engine/types'

export const SHARE_UNEQUAL = -1
/** More things than this are not dealt one by one (the task falls back to cards or keys). */
export const MAX_THINGS = 40
export const MAX_PLATES = 10

export interface ShareSetup {
  total: number
  plates: number
  thing: string
}

const ok = (total: number, plates: number, thing: string): ShareSetup | null =>
  Number.isInteger(total) && Number.isInteger(plates) && total >= 1 && total <= MAX_THINGS && plates >= 2 && plates <= MAX_PLATES
    ? { total, plates, thing }
    : null

/**
 * The deal a task describes: the `share` scene (things among recipients), or an equation "a : b"
 * (a things on b plates; carrots, as on the meadow). Null when the task cannot be dealt out.
 */
export function shareSetup(task: Pick<Task, 'prompt'>): ShareSetup | null {
  const p = task.prompt
  if (p.scene === 'share') return ok(p.total, p.recipients, p.thing || 'carrot')
  if (p.scene === 'equation') {
    const t = p.terms
    const a = t[0]
    const op = t[1]
    const b = t[2]
    if (a && b && op && 'n' in a && 'n' in b && 'op' in op && op.op === ':') return ok(a.n, b.n, 'carrot')
  }
  return null
}

/** A deal can be played when there is one, and the answer is a count (or the counts as a set). */
export const canShare = (t: Pick<Task, 'prompt' | 'answer' | 'answerType'>) =>
  shareSetup(t) !== null && (typeof t.answer === 'number' || t.answerType === 'set')

/** The share scene is the pile and the plates themselves: the view draws it, the card is left out. */
export const shareOwnsPrompt = (t: Task) => t.prompt.scene === 'share' && shareSetup(t) !== null

/** What the plates hand in: the count each got (equal), −1 (uneven), or the counts as a set. */
export function shareValue(task: Pick<Task, 'answerType'>, counts: readonly number[]): AnswerValue {
  if (task.answerType === 'set') return [...counts].sort((a, b) => b - a).join('|')
  if (counts.length === 0) return SHARE_UNEQUAL
  return counts.every((c) => c === counts[0]) ? counts[0] : SHARE_UNEQUAL
}

/** The plates that picture an answer value (the confirm button: every plate with the same count). */
export function countsOf(task: Pick<Task, 'prompt'>, value: AnswerValue): number[] | null {
  const setup = shareSetup(task)
  if (typeof value === 'string') {
    const counts = value.split('|').map(Number)
    return counts.every((c) => Number.isInteger(c) && c >= 0) ? counts : null
  }
  if (!setup || value < 0) return null
  return Array.from({ length: setup.plates }, () => value)
}

/**
 * Where a newly given thing goes: the last thing in the pile (the pile empties from the end, so the
 * things left keep their places).
 */
export function nextFromPile(pile: readonly number[]): number | null {
  return pile.length > 0 ? pile[pile.length - 1] : null
}

// The struck answer is the child's own deal: the view remembers the counts it handed in.
const deals = new Map<string, number[]>()
const dealKey = (taskId: string, value: AnswerValue) => `${taskId}\u0000${String(value)}`

export function rememberDeal(taskId: string, value: AnswerValue, counts: readonly number[]): void {
  deals.delete(dealKey(taskId, value))
  deals.set(dealKey(taskId, value), [...counts])
  while (deals.size > 8) deals.delete(deals.keys().next().value as string)
}

export function rememberedDeal(taskId: string, value: AnswerValue): number[] | null {
  return deals.get(dealKey(taskId, value)) ?? null
}
