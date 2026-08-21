import type { FactState, FactStates } from './types'

/**
 * Leitner boxes with a speed component.
 *
 * Knowing a fact and *recalling* it are different things: a child who works out
 * 8 + 5 on their fingers in twelve seconds has not learned it yet. So a correct
 * answer only promotes when it was also reasonably quick. A wrong answer drops
 * two boxes rather than resetting to zero — one bad moment must not erase a
 * week's work, which is exactly how a child decides an app is unfair.
 */

export const MAX_BOX = 5

/** How many rounds a fact rests before it is due again, per box. */
const DUE_AFTER = [0, 1, 2, 4, 8, 16]

export function emptyState(): FactState {
  return { box: 0, seen: 0, correct: 0, lastRound: -999, avgMs: 0 }
}

export function updateFactState(
  prev: FactState | undefined,
  correct: boolean,
  ms: number,
  roundIndex: number,
  fastMs: number,
): FactState {
  const s = prev ?? emptyState()
  const seen = s.seen + 1
  // rolling average, weighted towards recent attempts
  const avgMs = s.seen === 0 ? ms : Math.round(s.avgMs * 0.7 + ms * 0.3)

  let box = s.box
  if (correct) {
    if (ms <= fastMs) box = Math.min(MAX_BOX, s.box + 1)
    // correct but slow: hold position — they can do it, they just can't recall it yet
  } else {
    box = Math.max(0, s.box - 2)
  }

  return { box, seen, correct: s.correct + (correct ? 1 : 0), lastRound: roundIndex, avgMs }
}

export function isDue(state: FactState, roundIndex: number): boolean {
  return roundIndex - state.lastRound >= DUE_AFTER[Math.min(state.box, MAX_BOX)]
}

/** 0–1, how well this child knows a set of facts. Used for island progress rings. */
export function masteryOf(factIds: readonly string[], states: FactStates): number {
  if (factIds.length === 0) return 0
  let total = 0
  for (const id of factIds) total += (states[id]?.box ?? 0) / MAX_BOX
  return total / factIds.length
}
