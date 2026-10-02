// Shared contract for the task kinds (SPEC §3.2). Every kind lives in src/ui/task/<kind>/ with a
// View (the interaction), a Demo (the ghost-hand film, SPEC §3.4) and a Face (a compact picture of
// one answer value: the struck answer after a mistake and the big confirm button). The round screen
// only talks to a kind through this module, so adding a kind in wave 2 or 3 is adding a folder and
// one line in registry.ts.
import type { ComponentType } from 'react'
import type { AnswerValue, Task } from '../../engine/types'

/**
 * input: the child is answering · correct/wrong: the answer is in and shown in place (wrong is
 * struck, then the round screen swaps in the strategy panel) · idle: visible but not interactive
 * (the demo film or the golden egg's entrance is playing).
 */
export type ViewMode = 'input' | 'correct' | 'wrong' | 'idle'

/** What a view wants shown in the prompt's answer blank while the child works (keypad digits). */
export interface Draft {
  text: string
  /** Unit after the number ('kr', 'cm', 'm'). */
  unit?: string | null
}

export interface TaskViewProps {
  task: Task
  mode: ViewMode
  /** The submitted answer while mode is correct or wrong. */
  given: AnswerValue | null
  onSubmit(value: AnswerValue): void
  /** Any touch on the task: the lightbulb's 10 s idle timer starts again. */
  onActivity(): void
  /** Shown in the prompt's equation blank (null clears it). */
  onDraft(draft: Draft | null): void
  /** Index of the option the voice is naming right now (spoken option views pulse), else null. */
  speaking: number | null
}

export type FaceSize = 'sm' | 'md' | 'lg'

export interface FaceProps {
  task: Task
  value: AnswerValue
  size: FaceSize
}

export interface DemoProps {
  /** The film is over (or was tapped away). */
  onDone(): void
  /** The task the film introduces: its example matches the task's skill, never the task itself (review r1 P2-8). */
  task?: Task | null
}

export interface KindModule {
  View: ComponentType<TaskViewProps>
  Demo: ComponentType<DemoProps>
  Face: ComponentType<FaceProps>
  /**
   * The view draws the question itself (pair draws its own bubble sum, multiSelect its items), so
   * the round screen leaves the prompt card out instead of showing the same thing twice.
   */
  ownsPrompt?(task: Task): boolean
  /** Its Face is a row of several things (an order, a set): the error flow stacks it. */
  wideFace?: boolean
}
