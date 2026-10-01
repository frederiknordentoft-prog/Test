// "Næste tre mål" (SPEC §13.9): three small goals that never expire and never count down.
//   1. Play Blandet øvelse.
//   2. Visit a region not played for 5 learning days or more (one never played counts too).
//   3. Rotates: 5 right in a row → write 10 answers yourself → get three stars on a round.
// A goal done gives one stamp in the stamp book (numbered, no dates). Done goals are replaced only on
// the next learning day, so there is never "one more goal" to chase today. This file is pure: the
// caller passes the learning day as text and the regions worth revisiting.
import type { Goal, GoalKind, RegionId, RoundMode } from '../engine/types'

export const GOAL_COUNT = 3
export const REVISIT_AFTER_DAYS = 5
export const GOAL_ROTATION: readonly GoalKind[] = ['streak5', 'write10', 'stars3']
export const GOAL_NEED: Readonly<Record<GoalKind, number>> = { mix: 1, revisit: 1, streak5: 5, write10: 10, stars3: 1 }

export interface GoalsState { day: string; list: Goal[] }

export interface GoalInput {
  /** Learning day now ('YYYY-MM-DD'). */
  day: string
  /** Open regions worth a visit, best first (never played, then longest ago; ≥ 5 learning days). */
  revisit: readonly RegionId[]
}

const goal = (kind: GoalKind, region?: RegionId): Goal => ({
  kind, need: GOAL_NEED[kind], progress: 0, done: false, ...(region ? { region } : {}),
})

const nextInRotation = (prev: GoalKind | undefined): GoalKind => {
  const i = prev ? GOAL_ROTATION.indexOf(prev) : -1
  return GOAL_ROTATION[(i + 1) % GOAL_ROTATION.length]
}

/**
 * The goals for `input.day`. On the same learning day nothing changes (done goals stay done and
 * show their stamp). On a new learning day each done goal is replaced and every open goal stays as it
 * is — goals never expire.
 */
export function refreshGoals(prev: GoalsState, input: GoalInput): GoalsState {
  const full = prev.list.length === GOAL_COUNT
  if (full && input.day <= prev.day) return prev
  if (full && prev.list.every((g) => !g.done)) return prev.day === input.day ? prev : { ...prev, day: input.day }

  const [mix, visit, rotating] = [prev.list[0], prev.list[1], prev.list[2]]
  const third = !rotating || rotating.done ? goal(nextInRotation(rotating?.kind ?? lastRotation(prev.list))) : rotating
  const first = !mix || mix.done ? goal('mix') : mix
  let second = visit
  if (!visit || visit.done) {
    const region = input.revisit.find((r) => r !== visit?.region)
    // nothing to revisit yet: a second rotating goal, never the same kind as the third
    second = region ? goal('revisit', region) : goal(GOAL_ROTATION.find((k) => k !== third.kind && k !== visit?.kind) ?? 'write10')
  }
  return { day: input.day, list: [first, second, third] }
}

function lastRotation(list: readonly Goal[]): GoalKind | undefined {
  for (let i = list.length - 1; i >= 0; i--) if (GOAL_ROTATION.includes(list[i].kind)) return list[i].kind
  return undefined
}

/** What a finished round did, as far as the goals care. */
export interface GoalRound {
  mode: RoundMode
  /** The map region the round was played in (null for practice, the hut and placement). */
  region: RegionId | null
  bestStreak: number
  /** Right typed answers on the first try. */
  productionCorrect: number
  /** The round met the three-star rule (new stars or not). */
  threeStars: boolean
}

/** Goals after a round; `done` lists the goals this round completed (one stamp each). */
export function progressGoals(state: GoalsState, round: GoalRound): { state: GoalsState; done: Goal[] } {
  if (round.mode === 'placement') return { state, done: [] }
  const done: Goal[] = []
  const list = state.list.map((g) => {
    if (g.done) return g
    let progress = g.progress
    switch (g.kind) {
      case 'mix':
        if (round.mode === 'practice') progress = g.need
        break
      case 'revisit':
        if (round.region && round.region === g.region) progress = g.need
        break
      case 'streak5':
        progress = Math.max(progress, Math.min(g.need, round.bestStreak))
        break
      case 'write10':
        progress = Math.min(g.need, progress + round.productionCorrect)
        break
      case 'stars3':
        if (round.threeStars) progress = g.need
        break
    }
    if (progress === g.progress) return g
    const next: Goal = { ...g, progress, done: progress >= g.need }
    if (next.done) done.push(next)
    return next
  })
  return { state: done.length > 0 || list.some((g, i) => g !== state.list[i]) ? { ...state, list } : state, done }
}

/** The first goal still open (shown with "Det lærte du"), or null. */
export function nextGoal(state: GoalsState): Goal | null {
  return state.list.find((g) => !g.done) ?? null
}
