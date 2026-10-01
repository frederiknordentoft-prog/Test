import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_PROFILES } from '../../content/catalog'
import { FRAME_COLORS, type AnswerLogEntry } from '../../engine/types'
import { emptyDaily } from '../aggregate'
import { getDb } from '../db'
import { freshDb } from '../testing/freshDb'
import { profileDoc } from '../validate'
import {
  ProfileLimitError, cleanName, createProfile, defaultName, deleteProfile, getProfile, listProfiles, newProfileDoc,
  putProfile, withProfileDefaults,
} from './profiles'

beforeEach(freshDb)
afterEach(() => vi.unstubAllGlobals())

function row(profileId: string, ts: number): AnswerLogEntry {
  return {
    profileId, ts, day: '2026-09-30', sessionId: 's', roundId: 'r', nodeId: 'w0-plus10-l1', mode: 'round', skill: 'addTo10',
    family: 'big', factId: 'add:1+1', masteryKey: 'add:1+1', kind: 'keypad', optionsCount: 0, production: true, given: 2,
    answer: 2, correct: true, ms: 2000, fast: true, errorTag: null, detectable: [], boxBefore: 0, boxAfter: 1,
    scaffold: false, replays: 0, retryOf: null, assisted: false, audioUnverified: false,
  }
}

describe('a new profile document', () => {
  it('is complete and valid with sensible defaults', () => {
    const doc = newProfileDoc('  Ada  ', 1, { now: 5 })
    const errs: string[] = []
    profileDoc(doc, 'doc', errs)
    expect(errs).toEqual([])
    expect(doc).toMatchObject({
      name: 'Ada', grade: 1, version: 1, createdAt: 5, roundIndex: 0, round: null, daysPlayed: 0, lastLearningDay: null,
      economy: { perler: 0, xp: 0, level: 1 }, settings: { sfx: true, speech: true, autoSpeak: true, calm: false },
    })
    expect(doc.id).toMatch(/^p_/)
    expect(withProfileDefaults(doc)).toEqual(doc)
  })

  it('fills fields an older document lacks', () => {
    const partial = { ...newProfileDoc('Bo', 0), settings: { sfx: false } } as unknown as Parameters<typeof withProfileDefaults>[0]
    delete (partial as Partial<typeof partial>).rewardLog
    const full = withProfileDefaults(partial)
    expect(full.rewardLog).toEqual([])
    expect(full.settings).toMatchObject({ sfx: false, speech: true })
  })

  it('cleans names and numbers unnamed players', () => {
    expect(cleanName('  Ida\n  Marie  ')).toBe('Ida Marie')
    expect(cleanName('Abcdefghijklmnopqrstuvwxyz')).toHaveLength(20)
    expect(defaultName([])).toBe('Spiller 1')
    expect(defaultName(['Spiller 1', 'Ada', 'spiller 3'])).toBe('Spiller 2')
  })
})

describe('the profile repository', () => {
  it('creates, lists, reads, stores and deletes', async () => {
    const a = await createProfile({ name: 'Ada', grade: 0, now: 1 })
    const b = await createProfile({ grade: 2, now: 2 })
    expect(b.name).toBe('Spiller 1')
    expect((await listProfiles()).map((p) => p.id)).toEqual([a.id, b.id])
    expect(await getProfile(a.id)).toEqual(a)
    await putProfile({ ...a, name: 'Ada Lovelace', economy: { ...a.economy, perler: 12 } })
    expect((await getProfile(a.id))?.economy.perler).toBe(12)
    await deleteProfile(a.id)
    expect(await getProfile(a.id)).toBeUndefined()
    expect((await listProfiles()).map((p) => p.id)).toEqual([b.id])
  })

  it(`allows at most ${MAX_PROFILES} profiles, each with its own frame colour`, async () => {
    const made = []
    for (let i = 0; i < MAX_PROFILES; i++) made.push(await createProfile({ name: `Barn ${i}`, grade: 0, frameColor: 'sky' }))
    expect(made[0].frameColor).toBe('sky')
    expect(new Set(made.map((p) => p.frameColor)).size).toBe(MAX_PROFILES)
    expect([...made.map((p) => p.frameColor)].sort()).toEqual([...FRAME_COLORS].sort())
    await expect(createProfile({ name: 'For mange', grade: 1 })).rejects.toBeInstanceOf(ProfileLimitError)
    expect(await getDb().profiles.count()).toBe(MAX_PROFILES)
    await expect(putProfile({ ...made[1], frameColor: made[0].frameColor })).rejects.toThrow()

    // a freed colour is reused
    await deleteProfile(made[2].id)
    const again = await createProfile({ grade: 3 })
    expect(again.frameColor).toBe(made[2].frameColor)
  })

  it('asks for persistent storage when the first profile is created', async () => {
    const persist = vi.fn(async () => true)
    const persisted = vi.fn(async () => false)
    vi.stubGlobal('navigator', { storage: { persist, persisted } })
    await createProfile({ name: 'Ada', grade: 0 })
    await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1))
    await createProfile({ name: 'Bo', grade: 1 })
    await new Promise((r) => setTimeout(r, 10))
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('creates profiles without the storage API too', async () => {
    vi.stubGlobal('navigator', {})
    await expect(createProfile({ name: 'Ada', grade: 0 })).resolves.toMatchObject({ name: 'Ada' })
  })

  it('leaves no row behind when a profile is deleted', async () => {
    const a = await createProfile({ name: 'Ada', grade: 0 })
    const b = await createProfile({ name: 'Bo', grade: 1 })
    const db = getDb()
    await db.answers.bulkAdd([row(a.id, 1), row(a.id, 2), row(b.id, 3), row(a.id, Number.MAX_SAFE_INTEGER)])
    await db.daily.bulkPut([emptyDaily(a.id, '2026-09-29'), emptyDaily(a.id, '2026-09-30'), emptyDaily(b.id, '2026-09-30')])

    expect(await deleteProfile(a.id)).toEqual({ answers: 3, daily: 2 })
    const everything = [
      ...(await db.profiles.toArray()),
      ...(await db.answers.toArray()),
      ...(await db.daily.toArray()),
    ] as { id?: string; profileId?: string }[]
    expect(everything.filter((r) => r.id === a.id || r.profileId === a.id)).toHaveLength(0)
    expect(await db.answers.count()).toBe(1)
    expect(await db.daily.count()).toBe(1)
  })
})
