import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setSkillKeyIndex } from '../data/aggregate'
import { closeDb, getDb } from '../data/db'
import { createProfile } from '../data/repo/profiles'
import { freshDb, watchWriteTransactions } from '../data/testing/freshDb'
import { ceilingFor, isProduction } from '../engine/kinds'
import { learningDay } from '../engine/learningDay'
import { makeRng } from '../engine/rng'
import { buildRound } from '../engine/roundBuilder'
import { addFacts, addKeys, buildAddTask, type AddFact } from '../engine/testing/addFacts'
import type { Animal, ProfileDoc, RoundMode, TaskKind } from '../engine/types'
import { flushOnHide, lostEarnings, onRoundFinished, pendingWrites, roundHooks, useProfile } from './useProfile'
import { useRound, type AnswerRecord, type RoundPlan } from './useRound'

/**
 * The write path: every answer lands in one read-write transaction together with the profile, the
 * day and the round snapshot, a reload resumes the same task, and two children never mix.
 */

// before the first open: Dexie binds IDBDatabase.transaction when it opens the database
const writes = watchWriteTransactions()

const T0 = Date.parse('2026-09-30T10:00:00Z')
const DAY = learningDay(T0)
let clock = T0
let profile: ProfileDoc

function plan(opts: { mode?: RoundMode; seed?: number; nodeId?: RoundPlan['nodeId'] } = {}): RoundPlan {
  const { mode = 'round', seed = 1 } = opts
  const tasks = buildRound({ keys: addKeys(addFacts(10)), states: {}, roundIndex: 0, day: DAY, size: 10, rng: makeRng(seed) })
  return {
    roundId: `r-${mode}-${seed}`, sessionId: 'sess-1', mode, seed, tasks,
    nodeId: opts.nodeId ?? (mode === 'trial' ? 'w0-plus10-trial' : 'w0-plus10-l1'),
  }
}

const task = () => {
  const s = useRound.getState()
  return (s.status === 'golden' ? s.goldenTask : s.current)!
}

/** Answer the current task (1.5 s after it was shown) without moving on. */
function submit(correct = true) {
  clock += 1500
  const t = task()
  return useRound.getState().submit(correct ? t.answer : (t.answer as number) + 1)
}

/** Answer and tap "next" 0.8 s later (a wrong answer: confirm the strategy). */
function answer(correct = true) {
  submit(correct)
  clock += 800
  useRound.getState().next()
}

function record(over: Partial<AnswerRecord> & { fact?: AddFact; kind?: TaskKind; distractorTags?: Record<string, string> } = {}): AnswerRecord {
  const { fact = { id: 'add:3+4', a: 3, b: 4, answer: 7, rank: 7 }, kind = 'keypad', distractorTags, ...rest } = over
  const t = buildAddTask(fact, kind, makeRng(1), 0)
  if (distractorTags) Object.assign(t.distractorTags, distractorTags)
  return {
    task: t, given: fact.answer, correct: true, ms: 3000, fast: true, production: isProduction(t), ceiling: ceilingFor(t),
    mode: 'round', assisted: false, retryOf: null, replays: 0, ts: clock, roundId: 'r1', sessionId: 'sess-1',
    nodeId: 'w0-plus10-l1', ...rest,
  }
}

const state = () => useProfile.getState()
const stored = async (id = profile.id) => (await getDb().profiles.get(id))!
const answersOf = async (id = profile.id) => (await getDb().answers.toArray()).filter((a) => a.profileId === id)

beforeEach(async () => {
  useRound.getState().quit()
  await state().unload({ discard: true })
  await freshDb()
  clock = T0
  profile = await createProfile({ name: 'Ada', grade: 0, now: T0 })
  await state().loadProfile(profile.id)
  state().setContext({ sessionId: 'sess-1', audioVerified: true })
})

afterEach(() => {
  vi.restoreAllMocks()
  setSkillKeyIndex(null)
})

describe('the write path', () => {
  it('writes each answer in exactly one read-write transaction over profiles, answers and daily', async () => {
    useRound.getState().start(plan(), roundHooks({ now: () => clock }))
    await state().flush()
    writes.start()
    try {
      for (let i = 1; i <= 5; i++) {
        answer(true)
        await state().flush()
        expect(writes.log).toHaveLength(i)
        expect(writes.log[i - 1]).toEqual(['answers', 'daily', 'profiles'])
        // the answer, the profile with the snapshot taken right after it, and the day: together
        expect(await answersOf()).toHaveLength(i)
        expect((await stored()).round?.answered).toBe(i)
        expect((await getDb().daily.get([profile.id, DAY]))?.answers).toBe(i)
      }
    } finally {
      writes.stop()
    }
  })

  it('writes nothing of an answer when its transaction fails, and everything on the retry', async () => {
    useRound.getState().start(plan(), roundHooks({ now: () => clock }))
    await state().flush()
    const first = task()
    const put = vi.spyOn(getDb().daily, 'put').mockImplementation(() => Promise.reject(new Error('disk full')) as never)
    answer(true)
    await state().flush()
    expect(state().saveError).toContain('disk full')
    expect(pendingWrites()).toBe(1)
    // all or nothing: no log row, no profile change, no day
    expect(await answersOf()).toHaveLength(0)
    const onDisk = await stored()
    expect(onDisk.round?.answered).toBe(0)
    expect(onDisk.keys[first.masteryKey]).toBeUndefined()
    expect(await getDb().daily.count()).toBe(0)
    // the child played on: the store has it
    expect(state().profile?.keys[first.masteryKey]?.seen).toBe(1)

    put.mockRestore()
    answer(true)
    await state().flush()
    expect(state().saveError).toBeNull()
    expect(pendingWrites()).toBe(0)
    expect(await answersOf()).toHaveLength(2)
    expect((await stored()).round?.answered).toBe(2)
    expect((await getDb().daily.get([profile.id, DAY]))?.answers).toBe(2)
  })

  it('keeps one waiting batch while writes fail, and can drop it for good', async () => {
    useRound.getState().start(plan(), roundHooks({ now: () => clock }))
    await state().flush()
    const put = vi.spyOn(getDb().daily, 'put').mockImplementation(() => Promise.reject(new Error('disk full')) as never)
    for (let i = 0; i < 5; i++) {
      answer(true)
      await state().flush()
      expect(pendingWrites()).toBe(1)
    }
    put.mockRestore()
    await state().flush()
    expect(await answersOf()).toHaveLength(5)
    expect((await getDb().daily.get([profile.id, DAY]))?.answers).toBe(5)

    // discarding (profile deleted or replaced by an import) also drops a failed write
    const put2 = vi.spyOn(getDb().daily, 'put').mockImplementation(() => Promise.reject(new Error('disk full')) as never)
    answer(true)
    await state().flush()
    expect(pendingWrites()).toBe(1)
    await state().unload({ discard: true })
    expect(pendingWrites()).toBe(0)
    put2.mockRestore()
    await state().flush()
    expect(await answersOf()).toHaveLength(5)
  })

  it('gives the same task 5 after a reload right after answer 4', async () => {
    useRound.getState().start(plan(), roundHooks({ now: () => clock }))
    for (let i = 0; i < 3; i++) answer(true)
    submit(true) // answer 4 — and the tab is killed before "next"
    const fifth = useRound.getState().queue[0].id
    const rest = useRound.getState().queue.slice(1).map((t) => t.id)
    await Promise.resolve() // the microtask flush has started the write
    await state().flush()

    // reload: nothing survives in memory
    closeDb()
    useRound.setState({ status: 'idle', plan: null, queue: [], current: null })
    useProfile.setState({ profile: null, status: 'empty' })
    clock += 60_000

    const doc = await state().loadProfile(profile.id)
    expect(doc?.round?.current?.id).toBe(fifth)
    useRound.getState().resume(doc!.round!, roundHooks({ now: () => clock }))
    expect(useRound.getState().current?.id).toBe(fifth)
    expect(useRound.getState().queue.map((t) => t.id)).toEqual(rest)
    expect(useRound.getState().cleared).toBe(4)
    for (let i = 0; i < 20 && useRound.getState().status !== 'finished'; i++) answer(true)
    await state().flush()
    expect(await answersOf()).toHaveLength(10)
    expect((await stored()).round).toBeNull()
  })

  it('also flushes when the page is hidden', async () => {
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    const win = new EventTarget()
    const off = flushOnHide(doc, win)
    try {
      state().trackPlay(5000, clock)
      expect(pendingWrites()).toBe(1)
      doc.visibilityState = 'hidden'
      doc.dispatchEvent(new Event('visibilitychange'))
      expect(pendingWrites()).toBe(1) // detached into the outbox, being written
      await vi.waitFor(async () => expect((await getDb().daily.get([profile.id, DAY]))?.playMs).toBe(5000))
      state().trackPlay(1000, clock)
      win.dispatchEvent(new Event('pagehide'))
      await vi.waitFor(async () => expect((await getDb().daily.get([profile.id, DAY]))?.playMs).toBe(6000))
    } finally {
      off()
    }
  })
})

describe('recording an answer', () => {
  it('updates mastery, production evidence, new keys, first tries, days played and the log row', () => {
    const entry = state().recordAnswer(record({ ms: 2500 }))!
    const doc = state().profile!
    expect(doc.keys['add:3+4']).toMatchObject({ box: 1, seen: 1, correct: 1, lastDay: DAY })
    expect(doc.skillStats.addTo10).toEqual({ prodCorrect: 1, prodDays: [DAY] })
    expect(doc.newToday).toEqual({ day: DAY, total: 1, perSkill: { addTo10: 1 } })
    expect(doc.recentFirstTries).toEqual([true])
    expect(doc.daysPlayed).toBe(1)
    expect(doc.lastLearningDay).toBe(DAY)
    expect(entry).toMatchObject({
      profileId: profile.id, day: DAY, skill: 'addTo10', masteryKey: 'add:3+4', kind: 'keypad', production: true,
      given: 7, answer: 7, correct: true, ms: 2500, boxBefore: 0, boxAfter: 1, errorTag: null, detectable: [],
      audioUnverified: false, optionsCount: 0, retryOf: null,
    })

    // the same key again: not new; a second day counts as a day played
    clock += 24 * 3600_000
    state().recordAnswer(record({ ts: clock }))
    const next = state().profile!
    expect(next.newToday.total).toBe(0)
    expect(next.daysPlayed).toBe(2)
    expect(next.skillStats.addTo10?.prodDays).toEqual([DAY, learningDay(clock)])
  })

  it('does not move mastery for retries, help or placement, and counts only real first tries', () => {
    state().recordAnswer(record({ correct: false, given: 8, fast: false }))
    const after = state().profile!.keys['add:3+4']
    expect(after.box).toBe(0)
    state().recordAnswer(record({ mode: 'retry', retryOf: 'add:3+4#0' }))
    state().recordAnswer(record({ assisted: true }))
    state().recordAnswer(record({ mode: 'placement', fact: { id: 'add:5+2', a: 5, b: 2, answer: 7, rank: 7 } }))
    const doc = state().profile!
    expect(doc.keys['add:3+4']).toEqual(after)
    expect(doc.keys['add:5+2']).toBeUndefined()
    expect(doc.skillStats.addTo10).toBeUndefined()
    // placement is not a round: it does not feed the fatigue window
    expect(doc.recentFirstTries).toEqual([false, true])
  })

  it('logs whether the sound check passed', () => {
    state().setContext({ audioVerified: false })
    expect(state().recordAnswer(record())?.audioUnverified).toBe(true)
  })

  it('counts the diagnostic distractors a child was shown (not again on a retry)', () => {
    const tags = { '8': 'countFromFirst', '6': 'near', '9': 'countFromFirst', '1': 'wrongOperation' }
    state().recordAnswer(record({ kind: 'choice', distractorTags: tags }))
    state().recordAnswer(record({ kind: 'choice', distractorTags: tags, mode: 'retry', retryOf: 'x' }))
    expect(state().profile!.offeredTags).toEqual({ countFromFirst: 1, wrongOperation: 1 })
  })

  it('keeps the last ten first tries across rounds', () => {
    for (let i = 0; i < 12; i++) state().recordAnswer(record({ correct: i % 3 !== 0, given: i % 3 !== 0 ? 7 : 8 }))
    expect(state().profile!.recentFirstTries).toHaveLength(10)
  })
})

describe('a finished round', () => {
  it('books the round: index, day, skill snapshot, handlers', async () => {
    setSkillKeyIndex((skill) => (skill === 'addTo10' ? addFacts(10).map((f) => f.id) : null))
    const seen: string[] = []
    const off = onRoundFinished((r) => seen.push(`global:${r.roundId}`))
    useRound.getState().start(plan(), roundHooks({ now: () => clock, onFinish: (r) => seen.push(`round:${r.roundId}`) }))
    for (let i = 0; i < 20 && useRound.getState().status !== 'finished'; i++) answer(true)
    off()
    await state().flush()
    expect(seen).toEqual(['round:r-round-1', 'global:r-round-1'])
    const doc = await stored()
    expect(doc.roundIndex).toBe(1)
    expect(doc.round).toBeNull()
    const day = (await getDb().daily.get([profile.id, DAY]))!
    expect(day).toMatchObject({ rounds: 1, answers: 10, firstTryCorrect: 10, sessions: 1, trialsPassed: [] })
    expect(day.snapshot.addTo10?.status).toBe('practising')
    expect(day.snapshot.addTo10?.meanBox).toBeCloseTo(10 / 66, 3)
    // learning time: 1.5 s thinking + 0.8 s to "next" per task, all well under 90 s
    expect(day.learnMs).toBe(10 * 1500 + 9 * 800)
  })

  it('records a passed mastery trial', async () => {
    useRound.getState().start(plan({ mode: 'trial' }), roundHooks({ now: () => clock }))
    answer(false)
    for (let i = 0; i < 20 && useRound.getState().status !== 'finished'; i++) answer(true)
    await state().flush()
    expect((await getDb().daily.get([profile.id, DAY]))?.trialsPassed).toEqual(['w0-plus10'])
  })

  it('leaves a long pause out of the learning time', async () => {
    useRound.getState().start(plan(), roundHooks({ now: () => clock }))
    answer(true)
    answer(true)
    expect(useRound.getState().pause()).toBe('paused')
    const snap = state().profile!.round!
    clock += 10 * 60_000
    useRound.getState().resume(snap, roundHooks({ now: () => clock }))
    answer(true)
    await state().flush()
    // answer 1, "next" and answer 2, then only the third answer's thinking time: the "next" tap before
    // the pause is not seen, and the ten minutes away are left out
    expect((await getDb().daily.get([profile.id, DAY]))?.learnMs).toBe(1500 + 800 + 1500 + 1500)
  })

  it('counts play time and one session per app start and day', async () => {
    state().trackPlay(90_000, clock)
    state().trackPlay(3 * 3600_000, clock) // clamped to 30 min
    state().trackPlay(-5, clock)
    state().recordAnswer(record())
    await state().flush()
    expect(await getDb().daily.get([profile.id, DAY])).toMatchObject({ playMs: 90_000 + 30 * 60_000, sessions: 1 })
  })
})

describe('general changes from the game layer', () => {
  const rabbit: Animal = {
    uid: 'a1', species: 'rabbit', breed: 'upright', colorway: 'c1', name: 'Hop', friendship: 0, stage: 1, star: false,
    shown: 1, outfit: {}, foundAt: T0, source: 'starter',
  }

  it('persists a change and keeps id, frame colour and creation time fixed', async () => {
    expect(state().update((d) => ({ ...d, animals: [rabbit], buddyUid: 'a1', economy: { ...d.economy, perler: 20 }, frameColor: 'rose', createdAt: 1 }))).toBe(true)
    await state().flush()
    const doc = await stored()
    expect(doc.animals).toHaveLength(1)
    expect(doc.economy.perler).toBe(20)
    expect(doc.frameColor).toBe(profile.frameColor)
    expect(doc.createdAt).toBe(profile.createdAt)
    expect(state().update((d) => ({ ...d, id: 'p_other' }))).toBe(false)
  })

  it('refuses a change that would take something earned away (SPEC §13.11)', async () => {
    state().update((d) => ({ ...d, animals: [rabbit], inventory: { 'hverdag-head': { at: T0, colors: [0, 1] } }, skillMedals: { addTo10: 'silver' } }))
    const before = state().profile!
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(state().update((d) => ({ ...d, animals: [] }))).toBe(false)
    expect(state().update((d) => ({ ...d, inventory: { 'hverdag-head': { at: T0, colors: [0] } } }))).toBe(false)
    expect(state().update((d) => ({ ...d, skillMedals: { addTo10: 'bronze' } }))).toBe(false)
    expect(state().profile).toBe(before)
    // spending pearls on a new thing is fine
    expect(state().update((d) => ({ ...d, economy: { ...d.economy, perler: 0 }, inventory: { ...d.inventory, 'pirat-head': { at: T0, colors: [0] } } }))).toBe(true)
    expect(lostEarnings(before, { ...before, stamps: before.stamps + 1 })).toBeNull()
  })

  it('changes settings', async () => {
    state().setSettings({ calm: true, domainsOff: ['clock'] })
    await state().flush()
    expect((await stored()).settings).toMatchObject({ calm: true, domainsOff: ['clock'], sfx: true })
  })
})

describe('two profiles', () => {
  it('are kept apart, also when a round of the first child is still running', async () => {
    const hooksA = roundHooks({ now: () => clock })
    useRound.getState().start(plan({ seed: 1 }), hooksA)
    for (let i = 0; i < 3; i++) answer(true)
    await state().flush()
    const aKeys = Object.keys(state().profile!.keys)

    const bo = await createProfile({ name: 'Bo', grade: 1, now: T0 })
    await state().loadProfile(bo.id)
    // the first child's round is still on screen: its hooks must not write into Bo
    answer(true)
    answer(true)
    await state().flush()
    expect(state().profile!.keys).toEqual({})
    expect(await answersOf(bo.id)).toHaveLength(0)

    useRound.getState().start(plan({ seed: 7 }), roundHooks({ now: () => clock }))
    answer(true)
    answer(false)
    await state().flush()

    const a = await stored(profile.id)
    const b = await stored(bo.id)
    expect(Object.keys(a.keys).sort()).toEqual([...aKeys].sort())
    expect(a.round?.answered).toBe(3)
    expect(b.round?.roundId).toBe('r-round-7')
    expect(await answersOf(profile.id)).toHaveLength(3)
    expect(await answersOf(bo.id)).toHaveLength(2)
    expect((await getDb().daily.get([profile.id, DAY]))?.answers).toBe(3)
    expect((await getDb().daily.get([bo.id, DAY]))?.answers).toBe(2)
    expect((await answersOf(bo.id)).every((e) => e.profileId === bo.id)).toBe(true)

    // and after a reload
    closeDb()
    expect((await state().loadProfile(profile.id))?.keys).toEqual(a.keys)
    expect(Object.keys((await state().loadProfile(bo.id))!.keys).length).toBeGreaterThan(0)
  })
})
