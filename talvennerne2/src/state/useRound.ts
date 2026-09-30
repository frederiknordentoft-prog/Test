import { create } from 'zustand'
import type { AnswerMode, AnswerValue, FirstTry, RoundMode, RoundSnapshot, Task } from '../engine/types'
import { isCorrect } from '../engine/answer'
import { ceilingFor, defaultFastMs, isProduction } from '../engine/kinds'

/**
 * The round state machine, ported from V1 (SPEC §3.5, §5.4). It knows nothing about storage: the
 * caller passes hooks that record answers, persist a snapshot after every change, and hand out
 * rewards when the round is over. That keeps the three ways of leaving a task behind — answering,
 * the golden-egg detour and pausing — testable on their own, and every one of them has been a
 * source of miscounting in V1.
 *
 * Flow per task: asking → (correct) answered → next() · (wrong) teaching → confirm().
 * A mistake shows the strategy and waits for the child to tap the right answer; the task comes
 * back two places later (not in trials or placement). Three correct in a row may summon the golden
 * egg: once per round, never as the last task, always skippable, and only a caught egg counts.
 */

export type RoundStatus = 'idle' | 'asking' | 'answered' | 'teaching' | 'golden' | 'finished'

export interface AnswerResult {
  correct: boolean
  given: AnswerValue
  answer: AnswerValue
  golden: boolean
}

/** Everything the data layer needs to update mastery and write the answer log. */
export interface AnswerRecord {
  task: Task
  given: AnswerValue
  correct: boolean
  ms: number
  fast: boolean
  production: boolean
  ceiling: number
  mode: AnswerMode
  assisted: boolean
  retryOf: string | null
  replays: number
  ts: number
  roundId: string
  sessionId: string
  nodeId: string
}

export interface RoundResult {
  roundId: string
  sessionId: string
  mode: RoundMode
  nodeId: RoundSnapshot['nodeId']
  total: number
  cleared: number
  firstTries: FirstTry[]
  mistakes: number
  bestStreak: number
  goldenCaught: boolean
  planks: number
  startedAt: number
  endedAt: number
}

export interface RoundPlan {
  roundId: string
  sessionId: string
  mode: RoundMode
  nodeId: RoundSnapshot['nodeId']
  seed: number
  tasks: Task[]
}

export interface RoundHooks {
  /** Every evaluated answer: first tries, retries and caught golden eggs. A missed egg is never recorded. */
  answer(rec: AnswerRecord): void
  /** Persist the resume point after every change; null when the round is over or abandoned. */
  snapshot(s: RoundSnapshot | null): void
  finish(result: RoundResult): void
  now(): number
  /** Builds the golden-egg task; omit for rounds without an egg. */
  golden?(): Task | null
  /** SkillDef override of the speed threshold; defaults to the kind's formula. */
  fastMs?(task: Task): number | undefined
}

const MAX_MS = 120_000
const RETRY_MODES: readonly RoundMode[] = ['round', 'practice', 'hut']
const EGG_MODES: readonly RoundMode[] = ['round', 'practice', 'hut']
const TRIAL_MODES: readonly RoundMode[] = ['trial', 'finale']

interface RoundState {
  status: RoundStatus
  plan: Omit<RoundPlan, 'tasks'> | null
  queue: Task[]
  current: Task | null
  goldenTask: Task | null
  total: number
  /** Tasks done: correct answers, plus wrong ones in modes without a retry. */
  cleared: number
  firstTries: FirstTry[]
  streak: number
  bestStreak: number
  mistakes: number
  goldenUsed: boolean
  goldenCaught: boolean
  planks: number
  startedAt: number
  askedAt: number
  replayMs: number
  replays: number
  assisted: boolean
  lastResult: AnswerResult | null

  start(plan: RoundPlan, hooks: RoundHooks): void
  resume(snapshot: RoundSnapshot, hooks: RoundHooks): void
  /** The question is on screen and has been read out: the answer clock starts now. */
  startClock(): void
  /** "Hør igen": the replay's duration is not counted as thinking time. */
  replay(durationMs: number): void
  /** The lightbulb scaffold was opened: the answer is logged as assisted. */
  help(): void
  submit(value: AnswerValue): AnswerResult
  /** After a correct answer (or the golden egg): maybe the egg, else the next task. */
  next(): void
  /** After a mistake: the child tapped the right answer, so move on (not logged as an answer). */
  confirm(): void
  skipGolden(): void
  /** ✕: store the round and leave. Returns 'finished' when it was the last task (show the rewards). */
  pause(): 'paused' | 'finished' | 'idle'
  quit(): void
}

let hooks: RoundHooks | null = null

const EMPTY = {
  status: 'idle' as RoundStatus,
  plan: null,
  queue: [],
  current: null,
  goldenTask: null,
  total: 0,
  cleared: 0,
  firstTries: [],
  streak: 0,
  bestStreak: 0,
  mistakes: 0,
  goldenUsed: false,
  goldenCaught: false,
  planks: 0,
  startedAt: 0,
  askedAt: 0,
  replayMs: 0,
  replays: 0,
  assisted: false,
  lastResult: null,
}

function answerMode(mode: RoundMode, golden: boolean, task: Task): AnswerMode {
  if (golden) return 'golden'
  if (task.retryOf) return 'retry'
  if (mode === 'finale') return 'trial'
  return mode
}

export const useRound = create<RoundState>((set, get) => {
  const now = () => hooks?.now() ?? Date.now()

  /** The resume point: the task that would be asked next, with no pending feedback. */
  function toSnapshot(s: Pick<RoundState, 'plan' | 'queue' | 'current' | 'total' | 'cleared' | 'firstTries' | 'streak' | 'bestStreak' | 'mistakes' | 'goldenUsed' | 'goldenCaught' | 'planks' | 'startedAt'>): RoundSnapshot | null {
    if (!s.plan) return null
    return {
      v: 1,
      roundId: s.plan.roundId,
      sessionId: s.plan.sessionId,
      mode: s.plan.mode,
      nodeId: s.plan.nodeId,
      seed: s.plan.seed,
      queue: s.queue,
      current: s.current,
      phase: 'asking',
      answered: s.cleared,
      total: s.total,
      firstTries: s.firstTries,
      streak: s.streak,
      bestStreak: s.bestStreak,
      mistakes: s.mistakes,
      goldenUsed: s.goldenUsed,
      goldenCaught: s.goldenCaught,
      planks: s.planks,
      startedAt: s.startedAt,
    }
  }

  function finish() {
    const s = get()
    set({ status: 'finished', current: null, goldenTask: null, lastResult: null })
    hooks?.snapshot(null)
    if (s.plan) {
      hooks?.finish({
        roundId: s.plan.roundId, sessionId: s.plan.sessionId, mode: s.plan.mode, nodeId: s.plan.nodeId,
        total: s.total, cleared: s.cleared, firstTries: s.firstTries, mistakes: s.mistakes, bestStreak: s.bestStreak,
        goldenCaught: s.goldenCaught, planks: s.planks, startedAt: s.startedAt, endedAt: now(),
      })
    }
  }

  /** Move to the next task, or finish. Never summons the golden egg. */
  function advance() {
    const s = get()
    if (s.queue.length === 0) {
      finish()
      return
    }
    set({
      status: 'asking', goldenTask: null, current: s.queue[0], queue: s.queue.slice(1), lastResult: null,
      askedAt: now(), replayMs: 0, replays: 0, assisted: false,
    })
  }

  return {
    ...EMPTY,

    start(plan, h) {
      hooks = h
      const { tasks, ...meta } = plan
      const t = now()
      set({
        ...EMPTY,
        status: tasks.length ? 'asking' : 'finished',
        plan: meta,
        queue: tasks.slice(1),
        current: tasks[0] ?? null,
        total: tasks.length,
        startedAt: t,
        askedAt: t,
      })
      hooks.snapshot(toSnapshot(get()))
    },

    resume(snap, h) {
      hooks = h
      set({
        ...EMPTY,
        status: 'asking',
        plan: { roundId: snap.roundId, sessionId: snap.sessionId, mode: snap.mode, nodeId: snap.nodeId, seed: snap.seed },
        queue: snap.queue,
        current: snap.current,
        total: snap.total,
        cleared: snap.answered,
        firstTries: snap.firstTries,
        streak: snap.streak,
        bestStreak: snap.bestStreak,
        mistakes: snap.mistakes,
        goldenUsed: snap.goldenUsed,
        goldenCaught: snap.goldenCaught,
        planks: snap.planks,
        startedAt: snap.startedAt,
        // the clock starts again now — a pause is not slowness
        askedAt: now(),
      })
      // saved right after the last answer: the round is over, hand out the rewards
      if (!snap.current) finish()
    },

    startClock() {
      set({ askedAt: now(), replayMs: 0 })
    },

    replay(durationMs) {
      const s = get()
      set({ replayMs: s.replayMs + Math.max(0, durationMs), replays: s.replays + 1 })
    },

    help() {
      set({ assisted: true })
    },

    submit(value) {
      const s = get()
      const golden = s.status === 'golden'
      const task = golden ? s.goldenTask : s.current
      if (!task || !s.plan || (s.status !== 'asking' && !golden)) {
        return { correct: false, given: value, answer: task?.answer ?? '', golden }
      }

      const correct = isCorrect(task, value)
      const t = now()
      const ms = Math.min(MAX_MS, Math.max(0, t - s.askedAt - s.replayMs))
      const fastMs = hooks?.fastMs?.(task) ?? defaultFastMs(task)
      const production = isProduction(task)
      const result: AnswerResult = { correct, given: value, answer: task.answer, golden }

      // A missed egg must not cost anything — daring to try is never punished. Only a caught
      // egg reaches the mastery model and the log.
      if (!golden || correct) {
        hooks?.answer({
          task, given: value, correct, ms, fast: ms <= fastMs, production, ceiling: ceilingFor(task),
          mode: answerMode(s.plan.mode, golden, task), assisted: s.assisted, retryOf: task.retryOf,
          replays: s.replays, ts: t, roundId: s.plan.roundId, sessionId: s.plan.sessionId, nodeId: s.plan.nodeId,
        })
      }

      if (golden) {
        set({ goldenCaught: correct, lastResult: result, status: 'answered' })
        hooks?.snapshot(toSnapshot({ ...get(), current: s.queue[0] ?? null, queue: s.queue.slice(1) }))
        return result
      }

      const firstTries = task.retryOf
        ? s.firstTries
        : [...s.firstTries, { key: task.masteryKey, skill: task.skill, correct, production, fast: ms <= fastMs }]
      const isTrial = TRIAL_MODES.includes(s.plan.mode)
      const planks = isTrial && correct && !task.retryOf ? s.planks + 1 : s.planks

      let queue = s.queue
      let cleared = s.cleared
      if (correct) {
        cleared += 1
        const streak = s.streak + 1
        set({ streak, bestStreak: Math.max(s.bestStreak, streak), cleared, firstTries, planks, lastResult: result, status: 'answered' })
      } else {
        if (RETRY_MODES.includes(s.plan.mode)) {
          // Put it back a couple of places instead of moving on: the child meets it again while
          // it is still fresh — and gets it right.
          const again: Task = { ...task, id: `${task.factId}#retry${s.mistakes}`, retryOf: task.retryOf ?? task.id }
          queue = s.queue.slice()
          queue.splice(Math.min(2, queue.length), 0, again)
        } else {
          cleared += 1
        }
        set({ streak: 0, mistakes: s.mistakes + 1, queue, cleared, firstTries, planks, lastResult: result, status: 'teaching' })
      }
      // persist the resume point: this task is done, the next one is up
      hooks?.snapshot(toSnapshot({ ...get(), current: queue[0] ?? null, queue: queue.slice(1) }))
      return result
    },

    next() {
      const s = get()
      if (s.status === 'teaching') {
        get().confirm()
        return
      }
      // Three in a row unlocks the chase — once per round, never as the last task, and never from
      // the golden question itself.
      const eggAllowed = s.plan && EGG_MODES.includes(s.plan.mode) && hooks?.golden
      if (
        eggAllowed && s.status === 'answered' && !s.lastResult?.golden && s.lastResult?.correct &&
        s.streak > 0 && s.streak % 3 === 0 && !s.goldenUsed && s.queue.length > 1
      ) {
        const egg = hooks!.golden!()
        if (egg) {
          set({ status: 'golden', goldenTask: egg, goldenUsed: true, lastResult: null, askedAt: now(), replayMs: 0, replays: 0, assisted: false })
          return
        }
      }
      // coming back from the chase lands here too, so the round moves on instead of re-asking
      advance()
    },

    confirm() {
      if (get().status !== 'teaching') return
      advance()
    },

    skipGolden() {
      if (get().status === 'golden') advance()
    },

    pause() {
      const s = get()
      if (s.status === 'idle') return 'idle'
      if (s.status === 'finished') return 'finished'
      // A task already answered — the beat after a correct answer, the strategy after a mistake, or
      // the golden egg — is done: move past it before storing, without summoning the egg, so it is
      // not counted twice on resume.
      if (s.status === 'answered' || s.status === 'teaching' || s.status === 'golden') advance()
      // pausing after the very last answer ends the round with its full reward
      if (get().status === 'finished') return 'finished'
      hooks?.snapshot(toSnapshot(get()))
      set({ ...EMPTY })
      return 'paused'
    },

    quit() {
      hooks?.snapshot(null)
      set({ ...EMPTY })
    },
  }
})
