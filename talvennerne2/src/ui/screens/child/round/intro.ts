// What happens when a task appears (SPEC §3.4), as pure functions for the round screen and tests:
// the demo film (the first two times a profile meets a kind), the kind's instruction (long the first
// three times, short after that, and only when the kind changes), and the order things are read in.
import { SPOKEN_OPTION_VIEWS, type ProfileDoc, type SpeechPart, type Task, type TaskKind } from '../../../../engine/types'
import { instructionClip } from '../../../../speech/clips/ui/kinds'

export const DEMO_TIMES = 2
export const LONG_INSTRUCTION_TIMES = 3

export interface Onboarding {
  demosSeen: ProfileDoc['demosSeen']
  instructionsHeard: ProfileDoc['instructionsHeard']
}

export interface TaskIntro {
  /** Play the kind's demo film before the question. */
  demo: boolean
  /** Read the kind's instruction (and in which form), or not at all. */
  instruction: 'long' | 'short' | null
}

/**
 * The intro of a task. `prevKind` is the kind of the task before it in this round (null for the
 * first). Golden eggs and retries go straight to the question: the child has just seen the kind.
 */
export function taskIntro(task: Task, prevKind: TaskKind | null, seen: Onboarding, opts: { golden?: boolean; hasDemo?: boolean } = {}): TaskIntro {
  if (opts.golden || task.retryOf) return { demo: false, instruction: null }
  const changed = prevKind !== task.kind
  if (!changed) return { demo: false, instruction: null }
  const demos = seen.demosSeen[task.kind] ?? 0
  const heard = seen.instructionsHeard[task.kind] ?? 0
  return {
    demo: (opts.hasDemo ?? true) && demos < DEMO_TIMES,
    instruction: heard < LONG_INSTRUCTION_TIMES ? 'long' : 'short',
  }
}

/** The options read aloud one by one (unit words, relations, tokens), or none (SPEC §3.4). */
export function optionReadout(task: Task): SpeechPart[][] {
  if (!SPOKEN_OPTION_VIEWS.includes(task.optionView) || !task.optionClips) return []
  if (task.kind !== 'choice' && task.kind !== 'multiSelect' && task.kind !== 'pair' && task.kind !== 'sortOrder') return []
  return task.optionClips.map((clip) => [{ clip }])
}

export interface ReadStep {
  parts: SpeechPart[]
  /** Which option card pulses while this is read (null: none). */
  option: number | null
  /** The step is the kind's instruction (shown in the buddy's bubble). */
  instruction?: boolean
}

/**
 * Everything read when a task appears, in order: the question, the instruction (unless the demo
 * film just said it) and the spoken options.
 */
export function readout(task: Task, intro: TaskIntro): ReadStep[] {
  const steps: ReadStep[] = []
  if (task.speech.length > 0) steps.push({ parts: task.speech, option: null })
  if (intro.instruction && !intro.demo) steps.push({ parts: [{ clip: instructionClip(task.kind, intro.instruction) }], option: null, instruction: true })
  optionReadout(task).forEach((parts, i) => steps.push({ parts, option: i }))
  return steps
}

/** Profile counters after a task's intro has been shown (demo film and instruction both count). */
export function afterIntro(seen: Onboarding, kind: TaskKind, intro: TaskIntro): Onboarding {
  return {
    demosSeen: intro.demo ? { ...seen.demosSeen, [kind]: (seen.demosSeen[kind] ?? 0) + 1 } : seen.demosSeen,
    instructionsHeard: intro.instruction ? { ...seen.instructionsHeard, [kind]: (seen.instructionsHeard[kind] ?? 0) + 1 } : seen.instructionsHeard,
  }
}

/** Praise for a right answer: rotates through the list by the task's position, never twice in a row. */
export function pickRotating(list: readonly string[], index: number): string {
  return list[((index % list.length) + list.length) % list.length]
}
