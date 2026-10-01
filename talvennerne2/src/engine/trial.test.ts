import { describe, expect, it } from 'vitest'
import {
  HELP_BRIDGE_AFTER, canAttemptTrial, helpBridgeOpen, nextTrialState, skipRegionNodes, trialEvents, trialOutcome, trialTasks,
} from './trial'
import { makeRegistry } from './registry'
import { FIXTURE_SKILLS } from './testing/fixtureSkills'
import { NODE_BY_ID } from '../content/curriculum'
import { isProduction } from './kinds'
import type { FirstTry, Task } from './types'

const reg = makeRegistry(FIXTURE_SKILLS)
const ctx = (seed: number, audioVerified = true) => ({ skills: reg, states: {}, audioVerified, seed })
const tally = (tasks: readonly Task[], by: (t: Task) => string) =>
  tasks.reduce<Record<string, number>>((acc, t) => ({ ...acc, [by(t)]: (acc[by(t)] ?? 0) + 1 }), {})
const tries = (right: number, total: number): FirstTry[] =>
  Array.from({ length: total }, (_, i) => ({ key: `k${i}`, skill: 'addTo10', correct: i < right, production: true, fast: true }))

describe('mastery trial tasks (SPEC §5.4)', () => {
  it('asks ten typed answers, spread evenly over the families, never the same key twice in a row', () => {
    for (let seed = 0; seed < 100; seed++) {
      const tasks = trialTasks(NODE_BY_ID['w2-veksling-trial'], ctx(seed))
      expect(tasks).toHaveLength(10)
      for (const t of tasks) {
        expect(isProduction(t)).toBe(true)
        expect(t.scaffold).toBe(false)
      }
      expect(Object.values(tally(tasks, (t) => t.family))).toEqual([2, 2, 2, 2, 2])
      for (let i = 1; i < tasks.length; i++) expect(tasks[i].masteryKey).not.toBe(tasks[i - 1].masteryKey)
      expect(new Set(tasks.map((t) => t.factId)).size).toBe(10)
    }
  })

  it('spreads a recall skill over its families with different facts', () => {
    for (let seed = 0; seed < 50; seed++) {
      const tasks = trialTasks(NODE_BY_ID['w0-plus10-trial'], ctx(seed))
      expect(tally(tasks, (t) => t.family)).toEqual({ small: 5, big: 5 })
      expect(new Set(tasks.map((t) => t.factId)).size).toBe(10)
      expect(tasks.every((t) => t.kind === 'keypad')).toBe(true)
    }
  })

  it('makes the finale twelve tasks, spread over the world\'s regions first', () => {
    for (let seed = 0; seed < 50; seed++) {
      const tasks = trialTasks(NODE_BY_ID['eng-finale'], ctx(seed))
      expect(tasks).toHaveLength(12)
      expect(tally(tasks, (t) => t.skill)).toEqual({ hear20: 6, addTo10: 6 })
      expect(tasks.every(isProduction)).toBe(true)
    }
    const silent = trialTasks(NODE_BY_ID['eng-finale'], ctx(1, false))
    expect(silent.every((t) => t.skill === 'addTo10')).toBe(true)
  })

  it('is reproducible from its seed', () => {
    expect(trialTasks(NODE_BY_ID['w2-veksling-trial'], ctx(9))).toEqual(trialTasks(NODE_BY_ID['w2-veksling-trial'], ctx(9)))
  })
})

describe('trial outcome (SPEC §5.4–5.5)', () => {
  it('passes at 8 of 10 and the finale at 10 of 12', () => {
    expect(trialOutcome(tries(8, 10), 'trial').passed).toBe(true)
    expect(trialOutcome(tries(7, 10), 'trial').passed).toBe(false)
    expect(trialOutcome(tries(10, 12), 'finale').passed).toBe(true)
    expect(trialOutcome(tries(9, 12), 'finale').passed).toBe(false)
  })

  it('gives one star for passing, two for at most one mistake, three for none', () => {
    expect(trialOutcome(tries(8, 10), 'trial').stars).toBe(1)
    expect(trialOutcome(tries(9, 10), 'trial').stars).toBe(2)
    expect(trialOutcome(tries(10, 10), 'trial')).toMatchObject({ stars: 3, perfect: true, score: 10 })
    expect(trialOutcome(tries(7, 10), 'trial').stars).toBe(0)
  })

  it('lists the missed keys for the training hut', () => {
    expect(trialOutcome(tries(7, 10), 'trial').missed).toEqual(['k7', 'k8', 'k9'])
  })

  it('keeps the best score, not the planks', () => {
    let s = nextTrialState(undefined, trialOutcome(tries(7, 10), 'trial'), 20, 1000)
    s = nextTrialState(s, trialOutcome(tries(5, 10), 'trial'), 22, 2000)
    expect(s).toEqual({ attempts: 2, failed: 2, best: 7, passedAt: null, lastAttemptRound: 22 })
    s = nextTrialState(s, trialOutcome(tries(9, 10), 'trial'), 24, 3000)
    expect(s.passedAt).toBe(3000)
    expect(nextTrialState(s, trialOutcome(tries(2, 10), 'trial'), 26, 4000).passedAt).toBe(3000)
  })

  it('needs one normal round between attempts', () => {
    expect(canAttemptTrial(undefined, 5)).toBe(true)
    const s = nextTrialState(undefined, trialOutcome(tries(7, 10), 'trial'), 20, 1000)
    expect(canAttemptTrial(s, 21)).toBe(false) // right after the trial itself
    expect(canAttemptTrial(s, 22)).toBe(true) // one round later
  })

  it('opens the help bridge after three failed attempts, unless passed', () => {
    let s = undefined as ReturnType<typeof nextTrialState> | undefined
    for (let i = 0; i < HELP_BRIDGE_AFTER; i++) {
      expect(helpBridgeOpen(s)).toBe(false)
      s = nextTrialState(s, trialOutcome(tries(6, 10), 'trial'), 20 + 2 * i, i)
    }
    expect(helpBridgeOpen(s)).toBe(true)
    expect(helpBridgeOpen(nextTrialState(s, trialOutcome(tries(8, 10), 'trial'), 30, 9))).toBe(false)
  })

  it('marks the unplayed lessons skipped when a trial is passed from the start', () => {
    const nodes = skipRegionNodes({ 'w0-plus10-l1': { plays: 2, stars: 3, skipped: false, lastAt: 5 } }, 'w0-plus10', 99)
    expect(nodes['w0-plus10-l1']).toEqual({ plays: 2, stars: 3, skipped: false, lastAt: 5 })
    for (const slot of ['l2', 'l3', 'mix']) expect(nodes[`w0-plus10-${slot}` as keyof typeof nodes]?.skipped).toBe(true)
    expect(nodes['w0-plus10-friend']).toBeUndefined()
    expect(nodes['w0-plus10-trial']).toBeUndefined()
  })

  it('tells the game layer about a pass', () => {
    expect(trialEvents('w0-plus10', trialOutcome(tries(10, 10), 'trial'))).toEqual([{ t: 'trialPassed', trial: 'w0-plus10', score: 10, perfect: true }])
    expect(trialEvents('w0-plus10', trialOutcome(tries(3, 10), 'trial'))).toEqual([])
  })
})
