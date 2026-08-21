import { beforeEach, describe, expect, it } from 'vitest'
import { useRound } from './useRound'
import { useProfile } from './useProfile'
import { defaultSave } from './storage'
import { ISLANDS } from '../content/islands'

/**
 * The round is a small state machine with three ways to leave a task behind —
 * answering it, the golden-egg detour, and walking away — and every one of them
 * has been a source of miscounting. These lock the invariant down: a round of ten
 * clears exactly ten, whatever happens in the middle.
 */

const FIRST_LEVEL = ISLANDS[0].levels[0].id

function answerCurrent(correct: boolean) {
  const s = useRound.getState()
  const task = s.status === 'golden' ? s.goldenTask! : s.current!
  s.submit(correct ? task.answer : task.answer + 1)
  useRound.getState().next()
}

/** Play the round out, getting everything right, and report how many were cleared. */
function playToEnd(maxSteps = 60): number {
  let steps = 0
  while (useRound.getState().status !== 'finished' && steps++ < maxSteps) answerCurrent(true)
  return useRound.getState().answered
}

describe('a round', () => {
  beforeEach(() => {
    useProfile.getState().replaceSave(defaultSave())
    useRound.getState().quit()
  })

  it('clears exactly as many tasks as it set out', () => {
    useRound.getState().start(FIRST_LEVEL)
    const total = useRound.getState().total
    expect(playToEnd()).toBe(total)
  })

  it('still clears exactly ten when one is missed on the way', () => {
    useRound.getState().start(FIRST_LEVEL)
    const total = useRound.getState().total
    answerCurrent(false)
    expect(playToEnd()).toBe(total)
  })

  it('does not count a task twice when the child pauses mid-round', () => {
    useRound.getState().start(FIRST_LEVEL)
    const total = useRound.getState().total
    answerCurrent(true)
    answerCurrent(true)

    useRound.getState().pause()
    expect(useProfile.getState().save.pausedRound).not.toBeNull()
    useRound.getState().resume()
    expect(useProfile.getState().save.pausedRound).toBeNull()

    expect(playToEnd()).toBe(total)
  })

  it('does not count a task twice when the child pauses during the golden egg', () => {
    useRound.getState().start(FIRST_LEVEL)
    const total = useRound.getState().total
    // three in a row is what summons the egg
    answerCurrent(true)
    answerCurrent(true)
    answerCurrent(true)
    expect(useRound.getState().status).toBe('golden')

    useRound.getState().pause()
    useRound.getState().resume()
    expect(useRound.getState().status).toBe('playing')

    expect(playToEnd()).toBe(total)
  })

  it('brings back the same task, count and streak after a pause', () => {
    useRound.getState().start(FIRST_LEVEL)
    answerCurrent(true)
    answerCurrent(true)
    const before = useRound.getState()
    const snapshot = {
      current: before.current?.id,
      answered: before.answered,
      queue: before.queue.length,
      streak: before.streak,
    }

    useRound.getState().pause()
    useRound.getState().resume()

    const after = useRound.getState()
    expect({
      current: after.current?.id,
      answered: after.answered,
      queue: after.queue.length,
      streak: after.streak,
    }).toEqual(snapshot)
  })

  it('leaves a missed fact in the round rather than dropping it', () => {
    useRound.getState().start(FIRST_LEVEL)
    const missed = useRound.getState().current!.factId
    answerCurrent(false)
    const s = useRound.getState()
    expect(s.queue.some((t) => t.factId === missed) || s.current?.factId === missed).toBe(true)
  })

  it('does not let a missed golden egg cost the child anything', () => {
    useRound.getState().start(FIRST_LEVEL)
    for (let i = 0; i < 3; i++) answerCurrent(true)
    expect(useRound.getState().status).toBe('golden')

    const goldenFact = useRound.getState().goldenTask!.factId
    const before = useProfile.getState().save.facts[goldenFact]?.box ?? 0
    const s = useRound.getState()
    s.submit(s.goldenTask!.answer + 1)
    expect(useProfile.getState().save.facts[goldenFact]?.box ?? 0).toBe(before)
  })
})
