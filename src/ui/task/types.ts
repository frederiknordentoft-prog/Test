import type { Task } from '../../engine/types'
import type { AnswerResult } from '../../state/useRound'

export interface TaskProps {
  task: Task
  /** `at` is where on screen the answer was given, so the sparks come out of it */
  onAnswer: (value: number, at: { x: number; y: number }) => void
  locked: boolean
  result: AnswerResult | null
  accent: string
}

export function centreOf(el: Element | null): { x: number; y: number } {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
