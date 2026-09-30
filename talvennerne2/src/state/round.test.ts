import { beforeEach, describe, expect, it } from 'vitest'
import { useRound, type AnswerRecord, type RoundHooks, type RoundPlan, type RoundResult } from './useRound'
import { buildRound } from '../engine/roundBuilder'
import { makeRng } from '../engine/rng'
import { updateKey } from '../engine/mastery'
import { addFacts, addKeys, buildAddTask } from '../engine/testing/addFacts'
import type { KeyState, RoundMode, RoundSnapshot, Task } from '../engine/types'

/**
 * The round is a small state machine with three ways to leave a task behind — answering it, the
 * golden-egg detour and walking away — and every one of them has been a source of miscounting.
 * These lock the invariant down: a round of ten clears exactly ten, whatever happens in between.
 */

let clock = 0
let answers: AnswerRecord[] = []
let snapshot: RoundSnapshot | null = null
let finished: RoundResult[] = []
let keys: Record<string, KeyState> = {}

const hooks: RoundHooks = {
  answer(rec) {
    answers.push(rec)
    keys[rec.task.masteryKey] = updateKey(keys[rec.task.masteryKey], {
      correct: rec.correct, fast: rec.fast, production: rec.production, ceiling: rec.ceiling, ms: rec.ms, ts: rec.ts,
      day: '2026-09-01', roundIndex: 1, mode: rec.mode, assisted: rec.assisted, retryOf: rec.retryOf, procedure: false,
      instanceId: rec.task.factId,
    })
  },
  snapshot(s) {
    snapshot = s ? structuredClone(s) : null
  },
  finish(r) {
    finished.push(r)
  },
  now: () => clock,
  golden: () => buildAddTask({ id: 'add:6+3', a: 6, b: 3, answer: 9, rank: 9 }, 'choice', makeRng(99), 999),
}

function plan(mode: RoundMode = 'round', seed = 1): RoundPlan {
  const tasks = buildRound({ keys: addKeys(addFacts(10)), states: {}, roundIndex: 0, day: '2026-09-01', size: 10, rng: makeRng(seed) })
  return { roundId: `r${seed}`, sessionId: 's1', mode, nodeId: mode === 'trial' ? 'w0-plus10-trial' : 'w0-plus10-l1', seed, tasks }
}

const task = (): Task => {
  const s = useRound.getState()
  return (s.status === 'golden' ? s.goldenTask : s.current)!
}

function answerCurrent(correct: boolean) {
  clock += 1500
  const t = task()
  useRound.getState().submit(correct ? t.answer : (t.answer as number) + 1)
  clock += 800
  useRound.getState().next()
}

function playToEnd(maxSteps = 60): number {
  let steps = 0
  while (useRound.getState().status !== 'finished' && steps++ < maxSteps) answerCurrent(true)
  return useRound.getState().cleared
}

describe('a round', () => {
  beforeEach(() => {
    clock = 1_000_000
    answers = []
    snapshot = null
    finished = []
    keys = {}
    useRound.getState().quit()
    snapshot = null
  })

  it('clears exactly as many tasks as it set out', () => {
    useRound.getState().start(plan(), hooks)
    expect(playToEnd()).toBe(10)
    expect(finished).toHaveLength(1)
    expect(snapshot).toBeNull()
  })

  it('still clears exactly ten when one is missed on the way, and brings the miss back', () => {
    useRound.getState().start(plan(), hooks)
    const missed = task().factId
    answerCurrent(false)
    const s = useRound.getState()
    expect(s.queue.some((t) => t.factId === missed && t.retryOf) || s.current?.factId === missed).toBe(true)
    expect(playToEnd()).toBe(10)
    const retry = answers.find((a) => a.task.factId === missed && a.retryOf)
    expect(retry?.mode).toBe('retry')
  })

  it('waits on the strategy after a mistake until the child confirms', () => {
    useRound.getState().start(plan(), hooks)
    const first = task().id
    clock += 1000
    useRound.getState().submit((task().answer as number) + 1)
    expect(useRound.getState().status).toBe('teaching')
    expect(useRound.getState().current?.id).toBe(first)
    useRound.getState().confirm()
    expect(useRound.getState().status).toBe('asking')
    expect(useRound.getState().current?.id).not.toBe(first)
  })

  it('does not count a task twice when the child pauses mid-round', () => {
    useRound.getState().start(plan(), hooks)
    answerCurrent(true)
    answerCurrent(true)
    expect(useRound.getState().pause()).toBe('paused')
    expect(snapshot).not.toBeNull()
    useRound.getState().resume(snapshot!, hooks)
    expect(playToEnd()).toBe(10)
  })

  it('does not count a task twice when the child pauses during the golden egg', () => {
    useRound.getState().start(plan(), hooks)
    answerCurrent(true)
    answerCurrent(true)
    answerCurrent(true)
    expect(useRound.getState().status).toBe('golden')
    useRound.getState().pause()
    useRound.getState().resume(snapshot!, hooks)
    expect(useRound.getState().status).toBe('asking')
    expect(playToEnd()).toBe(10)
  })

  it('does not summon the egg or keep the answered task when paused right after the third correct answer (A3)', () => {
    useRound.getState().start(plan(), hooks)
    answerCurrent(true)
    answerCurrent(true)
    clock += 1500
    const third = task()
    useRound.getState().submit(third.answer)
    // the child taps ✕ inside the celebration beat, before next()
    expect(useRound.getState().pause()).toBe('paused')
    expect(snapshot!.current?.id).not.toBe(third.id)
    expect(snapshot!.goldenUsed).toBe(false)
    useRound.getState().resume(snapshot!, hooks)
    expect(useRound.getState().status).toBe('asking')
    expect(playToEnd()).toBe(10)
  })

  it('ends with the full reward when paused after the very last answer (A3)', () => {
    useRound.getState().start(plan(), hooks)
    for (let i = 0; i < 20 && useRound.getState().queue.length > 0; i++) answerCurrent(true)
    clock += 1500
    useRound.getState().submit(task().answer)
    expect(useRound.getState().pause()).toBe('finished')
    expect(useRound.getState().status).toBe('finished')
    expect(finished).toHaveLength(1)
    expect(finished[0].cleared).toBe(10)
  })

  it('brings back the same task, count and streak after a pause', () => {
    useRound.getState().start(plan(), hooks)
    answerCurrent(true)
    answerCurrent(true)
    const before = useRound.getState()
    const snap = { current: before.current?.id, cleared: before.cleared, queue: before.queue.length, streak: before.streak }
    useRound.getState().pause()
    useRound.getState().resume(snapshot!, hooks)
    const after = useRound.getState()
    expect({ current: after.current?.id, cleared: after.cleared, queue: after.queue.length, streak: after.streak }).toEqual(snap)
  })

  it('resumes after a reload on the task after the last answer', () => {
    useRound.getState().start(plan(), hooks)
    while (useRound.getState().cleared < 4) {
      if (useRound.getState().status === 'golden') useRound.getState().skipGolden()
      else answerCurrent(true)
    }
    if (useRound.getState().status === 'golden') useRound.getState().skipGolden()
    const fifth = useRound.getState().current!.id
    // the tab is killed right after the fifth answer, before next()
    clock += 1500
    useRound.getState().submit(task().answer)
    const saved = structuredClone(snapshot!)
    useRound.setState({ status: 'idle', current: null, queue: [] })
    useRound.getState().resume(saved, hooks)
    expect(useRound.getState().current?.id).not.toBe(fifth)
    expect(useRound.getState().cleared).toBe(5)
  })

  it('does not let a missed golden egg cost the child anything', () => {
    useRound.getState().start(plan(), hooks)
    for (let i = 0; i < 3; i++) answerCurrent(true)
    expect(useRound.getState().status).toBe('golden')
    const egg = useRound.getState().goldenTask!
    const before = keys[egg.masteryKey]?.box ?? 0
    const logged = answers.length
    useRound.getState().submit((egg.answer as number) + 1)
    expect(keys[egg.masteryKey]?.box ?? 0).toBe(before)
    expect(answers).toHaveLength(logged)
  })

  it('logs a caught egg as golden', () => {
    useRound.getState().start(plan(), hooks)
    for (let i = 0; i < 3; i++) answerCurrent(true)
    useRound.getState().submit(useRound.getState().goldenTask!.answer)
    expect(answers.at(-1)?.mode).toBe('golden')
    expect(useRound.getState().goldenCaught).toBe(true)
  })

  it('never re-queues or offers the egg in a mastery trial, and counts planks', () => {
    useRound.getState().start(plan('trial'), hooks)
    answerCurrent(false)
    for (let i = 0; i < 20 && useRound.getState().status !== 'finished'; i++) {
      expect(useRound.getState().status).not.toBe('golden')
      answerCurrent(true)
    }
    expect(finished[0].planks).toBe(9)
    expect(finished[0].cleared).toBe(10)
    expect(answers.every((a) => a.retryOf === null)).toBe(true)
  })

  it('credits replays and marks answers after help as assisted', () => {
    useRound.getState().start(plan(), hooks)
    useRound.getState().startClock()
    clock += 9000
    useRound.getState().replay(4000)
    useRound.getState().help()
    useRound.getState().submit(task().answer)
    expect(answers[0].ms).toBe(5000)
    expect(answers[0].assisted).toBe(true)
    expect(answers[0].replays).toBe(1)
  })
})
