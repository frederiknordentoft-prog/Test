import type { AnswerValue, Task } from './types'

/**
 * Is `given` right for this task? Numbers compare with the task's tolerance (number lines) and
 * modulo (clocks: 3:00 and 15:00 are the same hand position on an analog clock). Everything
 * else is an exact token match, or one of the accepted equivalents ('frac:2/4' for '1/2').
 */
export function isCorrect(task: Task, given: AnswerValue): boolean {
  if (typeof task.answer === 'number' && typeof given === 'number') {
    const d = task.modulo ? (((given - task.answer) % task.modulo) + task.modulo) % task.modulo : Math.abs(given - task.answer)
    const dist = task.modulo ? Math.min(d, task.modulo - d) : d
    return dist <= task.tolerance
  }
  return given === task.answer || task.accept.includes(given)
}
