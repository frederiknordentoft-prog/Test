import type { AnswerValue, Task } from './types'

/** Kinds whose answer is an unordered set of tokens joined by '|' (sortOrder and fillSlots keep their order). */
const SET_KINDS: ReadonlySet<Task['kind']> = new Set(['multiSelect', 'grid', 'pay', 'share', 'colorParts'])

/** The canonical form of a set answer: its tokens sorted, so the order of taps never matters. */
export function canonicalSet(value: string): string {
  return value.split('|').filter((t) => t !== '').sort().join('|')
}

/**
 * Is `given` right for this task? Numbers compare with the task's tolerance (number lines) and
 * modulo (clocks: 3:00 and 15:00 are the same hand position on an analog clock). Set answers
 * (multiSelect, grid, pay, share, colorParts) compare as multisets. Everything else is an exact token match, or one
 * of the accepted equivalents ('frac:2/4' for '1/2').
 */
export function isCorrect(task: Task, given: AnswerValue): boolean {
  if (typeof task.answer === 'number' && typeof given === 'number') {
    const d = task.modulo ? (((given - task.answer) % task.modulo) + task.modulo) % task.modulo : Math.abs(given - task.answer)
    const dist = task.modulo ? Math.min(d, task.modulo - d) : d
    return dist <= task.tolerance
  }
  if (given === task.answer || task.accept.includes(given)) return true
  if (SET_KINDS.has(task.kind) && typeof given === 'string') {
    const g = canonicalSet(given)
    return [task.answer, ...task.accept].some((a) => typeof a === 'string' && canonicalSet(a) === g)
  }
  return false
}
