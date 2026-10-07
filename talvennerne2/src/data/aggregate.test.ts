import { afterEach, describe, expect, it } from 'vitest'
import {
  GAP_MS, answerDelta, countsInStats, emptyDaily, isFirstTry, keysOfSkill, learnDelta, mergeDaily, msBucket, passedTrialOf, playDelta, roundDelta,
  setSkillKeyIndex, skillSnapshot, snapshotFor,
} from './aggregate'
import { emptyKey } from '../engine/mastery'
import type { AnswerLogEntry, Box, KeyState } from '../engine/types'

function entry(over: Partial<AnswerLogEntry> = {}): AnswerLogEntry {
  return {
    profileId: 'p_1', ts: 1_000_000, day: '2026-09-30', sessionId: 's', roundId: 'r', nodeId: 'w0-plus10-l1', mode: 'round',
    skill: 'addTo10', family: 'big', factId: 'add:3+4', masteryKey: 'add:3+4', kind: 'keypad', optionsCount: 0,
    production: true, given: 7, answer: 7, correct: true, ms: 3000, fast: true, errorTag: null, detectable: [],
    boxBefore: 1, boxAfter: 2, scaffold: false, replays: 0, retryOf: null, assisted: false, audioUnverified: false,
    ...over,
  }
}

const key = (box: Box, over: Partial<KeyState> = {}): KeyState => ({ ...emptyKey(), box, seen: 3, ...over })

afterEach(() => setSkillKeyIndex(null))

describe('learning time', () => {
  it('adds the gap to the question and the thinking time, each only up to 90 s', () => {
    // previous answer at 0, question shown at 800, answered at 3800
    expect(learnDelta(0, 3800, 3000)).toBe(3800)
    // a pause of five minutes before the question: only the thinking time counts
    expect(learnDelta(0, 300_000 + 4000, 4000)).toBe(4000)
    // staring at a question for two minutes (ms capped at 120 s): nothing counts
    expect(learnDelta(0, 1000 + 120_000, 120_000)).toBe(1000)
    expect(learnDelta(0, GAP_MS + 1000, GAP_MS)).toBe(GAP_MS + 1000)
    expect(learnDelta(0, GAP_MS + 1 + 1000, GAP_MS + 1)).toBe(1000)
    // unknown previous input (after a reload): the thinking time only
    expect(learnDelta(null, 50_000, 6000)).toBe(6000)
  })
})

describe('daily deltas', () => {
  it('buckets production times in <2, <4, <7, <12, <20, <35, ≥35 s', () => {
    expect([0, 1999, 2000, 3999, 6999, 11_999, 19_999, 34_999, 35_000, 120_000].map(msBucket)).toEqual([0, 0, 1, 1, 2, 3, 4, 5, 6, 6])
  })

  it('counts first tries only, and times only correct production answers', () => {
    const d = answerDelta(entry({ ms: 5000 }), { learnMs: 5000, newSession: true })
    expect(d).toMatchObject({ answers: 1, firstTryCorrect: 1, sessions: 1, learnMs: 5000 })
    expect(d.bySkill.addTo10).toEqual({ n: 1, correct: 1, fast: 1, nProd: 1, msHist: [0, 0, 1, 0, 0, 0, 0], errors: {} })

    const wrong = answerDelta(entry({ correct: false, given: 8, fast: false, errorTag: 'countFromFirst' }), { learnMs: 0, newSession: false })
    expect(wrong.bySkill.addTo10).toEqual({ n: 1, correct: 0, fast: 0, nProd: 1, msHist: [0, 0, 0, 0, 0, 0, 0], errors: { countFromFirst: 1 } })
    const near = answerDelta(entry({ correct: false, errorTag: 'near' }), { learnMs: 0, newSession: false })
    expect(near.bySkill.addTo10?.errors).toEqual({})

    const choice = answerDelta(entry({ production: false, kind: 'choice', optionsCount: 3 }), { learnMs: 0, newSession: false })
    expect(choice.bySkill.addTo10).toMatchObject({ nProd: 0, msHist: [0, 0, 0, 0, 0, 0, 0] })

    for (const mode of ['retry', 'golden'] as const) {
      const d2 = answerDelta(entry({ mode, retryOf: mode === 'retry' ? 'add:3+4#0' : null }), { learnMs: 2000, newSession: false })
      expect(d2).toMatchObject({ answers: 0, firstTryCorrect: 0, learnMs: 2000, bySkill: {} })
    }
  })

  it('leaves the placement out of the statistics but keeps its learning time (pædagogik §4.2, SPEC A24)', () => {
    const placed = entry({ mode: 'placement', nodeId: 'placement' })
    expect(isFirstTry(placed)).toBe(true) // recentRounds still lists the placement as a round
    expect(countsInStats(placed)).toBe(false)
    expect(countsInStats(entry())).toBe(true)
    for (const correct of [true, false]) {
      const d = answerDelta({ ...placed, correct }, { learnMs: 3000, newSession: true })
      expect(d).toMatchObject({ answers: 0, firstTryCorrect: 0, learnMs: 3000, sessions: 1, bySkill: {} })
    }
  })

  it('merges associatively; later snapshots win and trials are a set', () => {
    const a = answerDelta(entry(), { learnMs: 1000, newSession: true })
    const b = mergeDaily(playDelta('p_1', '2026-09-30', 60_000, false), roundDelta('p_1', '2026-09-30', {
      addTo10: { meanBox: 1, share2: 0.2, share4: 0, status: 'practising' },
    }, 'w0-plus10'))
    const c = mergeDaily(answerDelta(entry({ correct: false, fast: false, errorTag: 'tableNeighbour' }), { learnMs: 3000, newSession: false }), roundDelta('p_1', '2026-09-30', {
      addTo10: { meanBox: 1.5, share2: 0.4, share4: 0, status: 'practising' },
    }, 'w0-plus10'))
    const left = mergeDaily(mergeDaily(a, b), c)
    const right = mergeDaily(a, mergeDaily(b, c))
    expect(left).toEqual(right)
    expect(left).toMatchObject({ learnMs: 4000, playMs: 60_000, sessions: 1, rounds: 2, answers: 2, firstTryCorrect: 1, trialsPassed: ['w0-plus10'] })
    expect(left.snapshot.addTo10?.meanBox).toBe(1.5)
    expect(left.bySkill.addTo10).toEqual({ n: 2, correct: 1, fast: 1, nProd: 2, msHist: [0, 1, 0, 0, 0, 0, 0], errors: { tableNeighbour: 1 } })
    expect(mergeDaily(emptyDaily('p_1', '2026-09-30'), left)).toEqual(left)
  })
})

describe('skill state for the daily snapshot (SPEC §5.2)', () => {
  const keys = ['k1', 'k2', 'k3', 'k4', 'k5']
  const stats = (prodCorrect: number, days: number) => ({ prodCorrect, prodDays: Array.from({ length: days }, (_, i) => `2026-09-0${i + 1}`) })

  it('grades not started, practising, support, silver and independent', () => {
    expect(skillSnapshot(keys, {}, undefined).status).toBe('notStarted')
    expect(skillSnapshot(keys, { k1: key(1) }, undefined)).toEqual({ meanBox: 0.2, share2: 0, share4: 0, status: 'practising' })
    const four = { k1: key(2), k2: key(2), k3: key(3), k4: key(2), k5: key(0) }
    expect(skillSnapshot(keys, four, undefined).status).toBe('support')
    const silver = { k1: key(4), k2: key(5), k3: key(4), k4: key(2), k5: key(1) }
    expect(skillSnapshot(keys, silver, stats(8, 2)).status).toBe('silver')
    expect(skillSnapshot(keys, silver, stats(7, 2)).status).toBe('support')
    expect(skillSnapshot(keys, silver, stats(8, 1)).status).toBe('support')
    const gold = { k1: key(4), k2: key(5), k3: key(4), k4: key(5), k5: key(2) }
    expect(skillSnapshot(keys, gold, stats(12, 3)).status).toBe('independent')
    expect(skillSnapshot(keys, gold, stats(12, 2)).status).toBe('silver')
  })

  it('counts seeded keys towards support only once confirmed', () => {
    const seeded = Object.fromEntries(keys.map((k) => [k, key(2, { seeded: true, seen: 0 })]))
    expect(skillSnapshot(keys, seeded, undefined)).toMatchObject({ share2: 0, status: 'notStarted', meanBox: 2 })
    const confirmed = { ...seeded, k1: key(2, { seen: 1 }), k2: key(3, { seen: 1 }), k3: key(2, { seen: 1 }), k4: key(2, { seen: 2 }) }
    expect(skillSnapshot(keys, confirmed, undefined)).toMatchObject({ share2: 0.8, status: 'support' })
  })

  it('finds the keys of a skill: registry, procedure families, else the keys seen', () => {
    expect(keysOfSkill('order20')).toEqual(['order20/after', 'order20/before', 'order20/between', 'order20/bigger'])
    expect(keysOfSkill('addTo10', ['add:1+1', 'add:2+2', 'add:1+1'])).toEqual(['add:1+1', 'add:2+2'])
    setSkillKeyIndex((skill) => (skill === 'addTo10' ? ['add:0+0', 'add:0+1', 'add:1+0', 'add:1+1'] : null))
    expect(keysOfSkill('addTo10', ['add:1+1'])).toHaveLength(4)
    const snap = snapshotFor({ keys: { 'add:1+1': key(4) }, skillStats: {} }, ['addTo10', 'addTo10'])
    expect(Object.keys(snap)).toEqual(['addTo10'])
    expect(snap.addTo10).toMatchObject({ meanBox: 1, share4: 0.25 })
  })
})

describe('mastery trials', () => {
  it('knows a passed region trial and world finale', () => {
    expect(passedTrialOf({ mode: 'trial', nodeId: 'w0-plus10-trial', planks: 8 })).toBe('w0-plus10')
    expect(passedTrialOf({ mode: 'trial', nodeId: 'w0-plus10-trial', planks: 7 })).toBeNull()
    expect(passedTrialOf({ mode: 'finale', nodeId: 'eng-finale', planks: 10 })).toBe('eng')
    expect(passedTrialOf({ mode: 'finale', nodeId: 'eng-finale', planks: 9 })).toBeNull()
    expect(passedTrialOf({ mode: 'round', nodeId: 'w0-plus10-l1', planks: 10 })).toBeNull()
  })
})
