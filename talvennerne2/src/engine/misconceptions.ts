// Misconception diagnostics (SPEC §4). The signatures below are frozen by the integrator — the data
// layer calls them for every answer. W1 (engine) implements the bodies; until then they are inert.
import type {
  AnswerLogEntry, AnswerValue, ErrorTag, MisconceptionId, MisconceptionState, SkillId, Task,
} from './types'

export type MisconceptionStates = Partial<Record<MisconceptionId, MisconceptionState>>

/** Error tag for a wrong answer (null when correct). Uses the task's tagged candidates first. */
export function classifyAnswer(task: Task, given: AnswerValue): ErrorTag | null {
  void task
  void given
  return null
}

/** Misconceptions this task could reveal (the opportunities). */
export function detectableOf(task: Task): MisconceptionId[] {
  void task
  return []
}

/** 'concept' or 'slip'; digitSwap is a concept only in hear*, tensOnes and placeValue1000. */
export function natureFor(id: MisconceptionId, skill: SkillId): 'concept' | 'slip' {
  void id
  void skill
  return 'concept'
}

export interface ObserveContext {
  /** First-try accuracy in this skill over the last 20 answers, 0–1 (choice evidence is ignored below 0.4). */
  skillAccuracy20: number
  /** 'YYYY-MM-DD' learning day of the answer. */
  day: string
}

/** Fold one logged answer into the per-profile misconception states (flag/resolve rules, SPEC §4.3). */
export function updateMisconceptions(prev: MisconceptionStates, entry: AnswerLogEntry, ctx: ObserveContext): MisconceptionStates {
  void entry
  void ctx
  return prev
}
