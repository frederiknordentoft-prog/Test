import type { AnswerMode, Box, KeyState } from './types'
import { daysBetween } from './learningDay'

/**
 * Leitner boxes with a speed component and a standard of evidence (V1's model, SPEC §5.1).
 *
 * Knowing a fact and recalling it are different things, so only a correct answer that was also
 * quick promotes; a correct but slow one holds position. A wrong answer drops two boxes rather
 * than resetting — one bad moment must not erase a week's work.
 *
 * Picking from a few cards is not the same as knowing, so guessable tasks stop at box 3 (box 2 for
 * coin flips; see kinds.ts). Box 4 needs production on a later learning day than box 3 was reached,
 * box 5 production at least three days after box 4, and both at least eight hours apart — that is
 * what makes "Kan selv" on the parent dashboard mean something.
 */

export const MAX_BOX = 5
export const DUE_ROUNDS = [0, 1, 2, 4, 8, 16] as const
export const DUE_DAYS = [0, 0, 0, 1, 3, 7] as const
const MIN_GAP_MS = 8 * 3600_000
/** Procedure families: correct instance ids remembered to stop farming one sum. */
const RECENT_LIMIT = 5

export function emptyKey(): KeyState {
  return {
    box: 0, seen: 0, correct: 0, lastRound: -999, lastDay: '', boxDay: '', boxAt: 0, avgMs: 0,
    recent: [], pendingInstance: null, seeded: false,
  }
}

export interface AnswerForMastery {
  correct: boolean
  /** Answered within fastMs (after replays are credited). */
  fast: boolean
  production: boolean
  /** ceilingFor(task): 5 for production, 3 for choice, 2 for coin-flip tasks. */
  ceiling: number
  ms: number
  ts: number
  /** Learning day of ts. */
  day: string
  roundIndex: number
  mode: AnswerMode
  assisted: boolean
  retryOf: string | null
  /** Procedure keys need two different fresh instances per promotion. */
  procedure: boolean
  /** The fact id that was asked (an instance id for procedure families). */
  instanceId: string
}

/** Answers that never move a box: retries, answers after help, placement and a missed golden egg. */
export function countsForMastery(a: Pick<AnswerForMastery, 'mode' | 'assisted' | 'retryOf' | 'correct'>): boolean {
  if (a.retryOf || a.assisted) return false
  if (a.mode === 'placement' || a.mode === 'retry') return false
  if (a.mode === 'golden' && !a.correct) return false
  return true
}

function canReach(target: number, s: KeyState, a: AnswerForMastery): boolean {
  if (target <= 3) return true
  if (!a.production) return false
  if (a.ts - s.boxAt < MIN_GAP_MS) return false
  if (target === 4) return daysBetween(s.boxDay, a.day) >= 1
  // box 5: at least three learning days after box 4 was reached
  return daysBetween(s.boxDay, a.day) >= 3
}

export function updateKey(prev: KeyState | undefined, a: AnswerForMastery): KeyState {
  const s = prev ?? emptyKey()
  if (!countsForMastery(a)) return s

  const seen = s.seen + 1
  const avgMs = s.seen === 0 ? a.ms : Math.round(s.avgMs * 0.7 + a.ms * 0.3)
  const base: KeyState = {
    ...s, seen, avgMs, correct: s.correct + (a.correct ? 1 : 0), lastRound: a.roundIndex, lastDay: a.day,
  }

  if (!a.correct) {
    const box = Math.max(0, s.box - 2) as Box
    return box === s.box
      ? { ...base, pendingInstance: null }
      : { ...base, box, boxDay: a.day, boxAt: a.ts, pendingInstance: null }
  }

  const recent = a.procedure
    ? [...s.recent.filter((id) => id !== a.instanceId), a.instanceId].slice(-RECENT_LIMIT)
    : s.recent
  const confirmed = a.production ? { seeded: false } : {}

  // correct but slow, or already as high as this kind of task can prove: hold position
  if (!a.fast || s.box >= a.ceiling || s.box >= MAX_BOX) return { ...base, ...confirmed, recent }

  const target = s.box + 1
  if (!canReach(target, s, a)) return { ...base, ...confirmed, recent }

  if (a.procedure) {
    // two quick, correct answers on two different fresh instances per step
    if (s.recent.includes(a.instanceId)) return { ...base, ...confirmed, recent }
    if (s.pendingInstance === null || s.pendingInstance === a.instanceId) {
      return { ...base, ...confirmed, recent, pendingInstance: a.instanceId }
    }
  }

  return {
    ...base, ...confirmed, recent, box: target as Box, boxDay: a.day, boxAt: a.ts, pendingInstance: null,
  }
}

/** Due when it has rested enough rounds and enough learning days for its box. */
export function isDue(state: KeyState, roundIndex: number, day: string): boolean {
  const box = Math.min(state.box, MAX_BOX)
  return roundIndex - state.lastRound >= DUE_ROUNDS[box] && daysBetween(state.lastDay, day) >= DUE_DAYS[box]
}

/** 0–1, mean box over a set of keys (unseen keys count as 0). */
export function masteryOf(keys: readonly string[], states: Readonly<Record<string, KeyState>>): number {
  if (keys.length === 0) return 0
  let total = 0
  for (const k of keys) total += (states[k]?.box ?? 0) / MAX_BOX
  return total / keys.length
}
