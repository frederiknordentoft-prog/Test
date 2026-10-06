// The ladder on screen (onboarding/placement/flow.ts does the writing): the run, the question shown
// and, once it is over, the stone the first round starts on. A small store rather than component
// state, so the screen's beats and the e2e read the same question.
import { create } from 'zustand'
import type { AnswerValue, Grade, NodeId, Task } from '../../../../../engine/types'
import {
  answerPlacementTask, beginPlacement, endPlacement, placementQuestion, skipPlacement,
  type AnswerTiming, type PlacementEnv, type PlacementSession,
} from './flow'

/** idle → starting (the grade is written) → asking → ending (seeding, writing) → over. */
export type PlacementStatus = 'idle' | 'starting' | 'asking' | 'ending' | 'over'

export interface PlacementState {
  status: PlacementStatus
  session: PlacementSession | null
  /** The question on screen; it stays while the words after the answer are said. */
  task: Task | null
  /** The question on screen has its answer. */
  answered: boolean
  /** Where the first round starts, once the ladder is over and written. */
  stone: NodeId | null
  env: PlacementEnv

  /** "Vis Pip hvad du kan": false when there is nothing to ask (the end then follows at once). */
  begin(grade: Grade, env?: PlacementEnv): Promise<boolean>
  /** The answer to the question on screen: logged and folded in. Null when it does not count (twice, or none). */
  submit(value: AnswerValue, timing: AnswerTiming): boolean | null
  /** The question that comes after the one on screen (null: the ladder is over), without moving on. */
  upcoming(): Task | null
  /** Move on to the next question; null when the ladder is over. */
  next(): Task | null
  /** "Det er nok", or the last rung: seed from what was shown and write. Resolves with the first stone. */
  finish(): Promise<NodeId>
  /** "Spring over": the grade only. Resolves with the first stone. */
  skip(grade: Grade, env?: PlacementEnv): Promise<NodeId>
  reset(): void
}

const IDLE = { status: 'idle' as PlacementStatus, session: null, task: null, answered: false, stone: null, env: {} }

let ending: Promise<NodeId> | null = null

export const usePlacement = create<PlacementState>((set, get) => {
  const end = (work: () => Promise<NodeId>): Promise<NodeId> => {
    ending ??= (async () => {
      const before = get().status
      set({ status: 'ending' })
      try {
        const stone = await work()
        set({ status: 'over', stone })
        return stone
      } catch (err) {
        // nothing is lost: the next tap tries again
        ending = null
        set({ status: before })
        throw err
      }
    })()
    return ending
  }

  return {
    ...IDLE,

    async begin(grade, env = {}) {
      if (get().status !== 'idle') return get().status === 'asking'
      set({ status: 'starting', env })
      let session: PlacementSession | null
      try {
        session = await beginPlacement(grade)
      } catch (err) {
        set({ status: 'idle' })
        throw err
      }
      const task = session ? placementQuestion(session, env) : null
      set({ status: 'asking', session, task, answered: false })
      return task !== null
    },

    submit(value, timing) {
      const { status, session, task, answered } = get()
      if (status !== 'asking' || !session || !task || answered) return null
      const res = answerPlacementTask(session, task, value, timing)
      set({ session: res.session, answered: true })
      return res.correct
    },

    upcoming() {
      const { session, env } = get()
      return session && !session.run.done ? placementQuestion(session, env) : null
    },

    next() {
      if (get().status !== 'asking') return null
      const task = get().upcoming()
      set({ task, answered: false })
      return task
    },

    finish() {
      return end(() => endPlacement(get().session, get().env))
    },

    skip(grade, env = {}) {
      set({ env })
      return end(() => skipPlacement(grade, env))
    },

    reset() {
      ending = null
      set({ ...IDLE })
    },
  }
})
