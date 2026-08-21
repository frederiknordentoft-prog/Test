import { create } from 'zustand'
import type { Task } from '../engine/types'
import { buildRound } from '../engine/roundBuilder'
import { buildTask } from '../engine/tasks'
import { hashSeed, makeRng } from '../engine/rng'
import { ISLANDS, LEVEL_BY_ID, factsForLevel } from '../content/islands'
import { fastMsFor, useProfile } from './useProfile'

export type RoundStatus = 'idle' | 'playing' | 'golden' | 'finished'
export interface AnswerResult {
  correct: boolean
  given: number
  answer: number
  golden: boolean
}

interface RoundStore {
  status: RoundStatus
  islandIndex: number
  levelId: string
  queue: Task[]
  current: Task | null
  goldenTask: Task | null
  goldenCaught: boolean
  goldenUsed: boolean
  /** tasks cleared, counting a repeat of the same fact as its own task */
  answered: number
  /** distinct facts got right at least once — used for the round summary */
  solvedFacts: string[]
  total: number
  streak: number
  bestStreak: number
  mistakes: number
  askedAt: number
  lastResult: AnswerResult | null

  start: (levelId: string) => void
  submit: (value: number) => AnswerResult
  next: () => void
  skipGolden: () => void
  quit: () => void
}

/** The extra sum on the escaping golden egg: harder than the round, never unfair. */
function makeGoldenTask(levelId: string, islandIndex: number, seed: number): Task | null {
  const entry = LEVEL_BY_ID.get(levelId)
  if (!entry) return null
  const pool = factsForLevel(entry.level, islandIndex)
  if (pool.length === 0) return null
  const harder = pool.slice(Math.floor(pool.length / 2))
  const rng = makeRng(seed)
  return buildTask(rng.pick(harder.length ? harder : pool), 'choice', rng, 999)
}

export const useRound = create<RoundStore>((set, get) => ({
  status: 'idle',
  islandIndex: 0,
  levelId: '',
  queue: [],
  current: null,
  goldenTask: null,
  goldenCaught: false,
  goldenUsed: false,
  answered: 0,
  solvedFacts: [],
  total: 0,
  streak: 0,
  bestStreak: 0,
  mistakes: 0,
  askedAt: 0,
  lastResult: null,

  start: (levelId) => {
    const entry = LEVEL_BY_ID.get(levelId)
    if (!entry) return
    const islandIndex = ISLANDS.findIndex((i) => i.id === entry.island.id)
    const { save } = useProfile.getState()
    const rng = makeRng(hashSeed(`${levelId}:${save.totalRounds}`))
    const tasks = buildRound({
      facts: factsForLevel(entry.level, islandIndex),
      states: save.facts,
      roundIndex: save.totalRounds,
      size: entry.level.size,
      kinds: entry.level.kinds,
      rng,
    })
    set({
      status: 'playing',
      islandIndex,
      levelId,
      queue: tasks.slice(1),
      current: tasks[0] ?? null,
      goldenTask: null,
      goldenCaught: false,
      goldenUsed: false,
      answered: 0,
      solvedFacts: [],
      total: tasks.length,
      streak: 0,
      bestStreak: 0,
      mistakes: 0,
      askedAt: Date.now(),
      lastResult: null,
    })
  },

  submit: (value) => {
    const s = get()
    const task = s.status === 'golden' ? s.goldenTask : s.current
    if (!task || s.lastResult) return { correct: false, given: value, answer: 0, golden: false }

    const correct = value === task.answer
    const ms = Date.now() - s.askedAt
    const golden = s.status === 'golden'
    useProfile.getState().recordAnswer(task.factId, correct, ms, fastMsFor(task.kind, task.answer))

    if (golden) {
      set({ goldenCaught: correct, lastResult: { correct, given: value, answer: task.answer, golden: true } })
      return { correct, given: value, answer: task.answer, golden: true }
    }

    if (correct) {
      const streak = s.streak + 1
      set({
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
        answered: s.answered + 1,
        solvedFacts: s.solvedFacts.includes(task.factId) ? s.solvedFacts : [...s.solvedFacts, task.factId],
        lastResult: { correct, given: value, answer: task.answer, golden: false },
      })
    } else {
      // Put it back a couple of places instead of moving on. The child meets it
      // again inside the same round, while it is still fresh — and gets it right.
      const again: Task = { ...task, id: `${task.factId}#retry${s.mistakes}` }
      const queue = s.queue.slice()
      queue.splice(Math.min(2, queue.length), 0, again)
      set({
        streak: 0,
        mistakes: s.mistakes + 1,
        queue,
        lastResult: { correct, given: value, answer: task.answer, golden: false },
      })
    }
    return { correct, given: value, answer: task.answer, golden }
  },

  next: () => {
    const s = get()

    // Three in a row unlocks the chase — once per round, and never as the last
    // task. Only from the normal flow: the golden question itself never spawns
    // another one.
    if (s.status !== 'golden' && s.lastResult?.correct && s.streak > 0 && s.streak % 3 === 0 && !s.goldenUsed && s.queue.length > 1) {
      const golden = makeGoldenTask(s.levelId, s.islandIndex, hashSeed(`${s.levelId}:golden:${s.answered}`))
      if (golden) {
        set({ status: 'golden', goldenTask: golden, goldenUsed: true, lastResult: null, askedAt: Date.now() })
        return
      }
    }

    // Coming back from the chase lands here too, so the round always moves on to
    // the next task instead of re-asking the one that triggered the egg.
    if (s.queue.length === 0) {
      set({ status: 'finished', current: null, goldenTask: null, lastResult: null })
      useProfile.getState().finishRound(s.levelId)
      return
    }
    set({
      status: 'playing',
      goldenTask: null,
      current: s.queue[0],
      queue: s.queue.slice(1),
      lastResult: null,
      askedAt: Date.now(),
    })
  },

  skipGolden: () => get().next(),

  quit: () => set({ status: 'idle', current: null, queue: [], goldenTask: null, lastResult: null }),
}))
