import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyDaily } from './aggregate'
import { getDb } from './db'
import {
  ANSWER_MAX_ROWS, LAST_PRUNE_KEY, PRUNE_DELAY_MS, PRUNE_INTERVAL_MS, pruneAll, pruneIfDue, pruneProfile, schedulePrune,
} from './prune'
import { createProfile } from './repo/profiles'
import { freshDb } from './testing/freshDb'
import { learningDay } from '../engine/learningDay'
import type { AnswerLogEntry } from '../engine/types'

const DAY = 86_400_000
const NOW = Date.parse('2026-09-30T12:00:00Z')

function row(profileId: string, ts: number): AnswerLogEntry {
  return {
    profileId, ts, day: learningDay(ts), sessionId: 's', roundId: 'r', nodeId: 'w0-plus10-l1', mode: 'round', skill: 'addTo10',
    family: 'big', factId: 'add:1+1', masteryKey: 'add:1+1', kind: 'keypad', optionsCount: 0, production: true, given: 2,
    answer: 2, correct: true, ms: 2000, fast: true, errorTag: null, detectable: [], boxBefore: 0, boxAfter: 1,
    scaffold: false, replays: 0, retryOf: null, assisted: false, audioUnverified: false,
  }
}

beforeEach(freshDb)
afterEach(() => vi.useRealTimers())

describe('retention', () => {
  it('keeps 90 days of answers and 3 years of days', async () => {
    const a = await createProfile({ name: 'Ada', grade: 0 })
    const b = await createProfile({ name: 'Bo', grade: 0 })
    const db = getDb()
    await db.answers.bulkAdd([
      row(a.id, NOW - 91 * DAY), row(a.id, NOW - 90 * DAY - 1), row(a.id, NOW - 89 * DAY), row(a.id, NOW),
      row(b.id, NOW - 200 * DAY),
    ])
    await db.daily.bulkPut([
      emptyDaily(a.id, learningDay(NOW - 1100 * DAY)), emptyDaily(a.id, learningDay(NOW - 1000 * DAY)), emptyDaily(a.id, learningDay(NOW)),
    ])
    expect(await pruneProfile(a.id, NOW)).toEqual({ answers: 2, daily: 1 })
    const left = await db.answers.toArray()
    expect(left.filter((r) => r.profileId === a.id).map((r) => r.ts)).toEqual([NOW - 89 * DAY, NOW])
    expect(left.filter((r) => r.profileId === b.id)).toHaveLength(1)
    expect((await db.daily.toArray()).map((d) => d.day)).toEqual([learningDay(NOW - 1000 * DAY), learningDay(NOW)])

    expect(await pruneAll(NOW)).toEqual({ answers: 1, daily: 0 })
    expect(await db.answers.count()).toBe(2)
  })

  it(`keeps at most ${ANSWER_MAX_ROWS} answers per profile, dropping the oldest`, async () => {
    const a = await createProfile({ name: 'Ada', grade: 0 })
    const b = await createProfile({ name: 'Bo', grade: 0 })
    const db = getDb()
    const rows = Array.from({ length: ANSWER_MAX_ROWS + 25 }, (_, i) => row(a.id, NOW - 10 * DAY + i * 1000))
    await db.answers.bulkAdd([...rows, row(b.id, NOW)])
    expect(await pruneProfile(a.id, NOW)).toEqual({ answers: 25, daily: 0 })
    const kept = await db.answers.where('[profileId+ts]').between([a.id, -Infinity], [a.id, Infinity]).toArray()
    expect(kept).toHaveLength(ANSWER_MAX_ROWS)
    expect(kept[0].ts).toBe(NOW - 10 * DAY + 25 * 1000)
    expect(await db.answers.where('[profileId+ts]').between([b.id, -Infinity], [b.id, Infinity]).count()).toBe(1)
  }, 30_000)

  it('runs at most once per 24 hours and records the run in meta', async () => {
    const a = await createProfile({ name: 'Ada', grade: 0 })
    const db = getDb()
    await db.answers.add(row(a.id, NOW - 100 * DAY))
    expect(await pruneIfDue(NOW)).toEqual({ answers: 1, daily: 0 })
    expect((await db.meta.get(LAST_PRUNE_KEY))?.value).toBe(NOW)

    await db.answers.add(row(a.id, NOW - 100 * DAY))
    expect(await pruneIfDue(NOW + PRUNE_INTERVAL_MS - 1)).toBeNull()
    expect(await db.answers.count()).toBe(1)
    expect(await pruneIfDue(NOW + PRUNE_INTERVAL_MS)).toEqual({ answers: 1, daily: 0 })
    // a clock that went backwards does not block pruning forever
    expect(await pruneIfDue(NOW - DAY)).not.toBeNull()
  })

  it('is scheduled two seconds after start with setTimeout', async () => {
    const a = await createProfile({ name: 'Ada', grade: 0 })
    const db = getDb()
    await db.answers.add(row(a.id, NOW - 100 * DAY))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    schedulePrune(PRUNE_DELAY_MS, () => NOW)
    vi.advanceTimersByTime(PRUNE_DELAY_MS - 1)
    vi.useRealTimers()
    expect(await db.answers.count()).toBe(1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    schedulePrune(PRUNE_DELAY_MS, () => NOW)
    vi.advanceTimersByTime(PRUNE_DELAY_MS)
    vi.useRealTimers()
    await vi.waitFor(async () => expect(await db.answers.count()).toBe(0))

    // a cancelled schedule never runs
    await db.meta.delete(LAST_PRUNE_KEY)
    await db.answers.add(row(a.id, NOW - 100 * DAY))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const cancel = schedulePrune(PRUNE_DELAY_MS, () => NOW)
    cancel()
    vi.advanceTimersByTime(PRUNE_DELAY_MS * 2)
    vi.useRealTimers()
    await new Promise((r) => setTimeout(r, 20))
    expect(await db.answers.count()).toBe(1)
  })
})
