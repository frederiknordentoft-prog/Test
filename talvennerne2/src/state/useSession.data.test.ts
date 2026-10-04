import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '../data/db'
import * as exportStore from '../data/export'
import { BOOT_KEY, readBoot, writeBoot } from '../data/namespace'
import { createProfile } from '../data/repo/profiles'
import { freshDb } from '../data/testing/freshDb'
import { MemoryStorage, installStorage } from '../data/testing/memoryStorage'
import { makeRng } from '../engine/rng'
import { buildRound } from '../engine/roundBuilder'
import { addFacts, addKeys } from '../engine/testing/addFacts'
import { roundHooks, useProfile } from './useProfile'
import { useRound, type RoundPlan } from './useRound'
import { resetSessionForTests, useSession } from './useSession'

/** The app start, the picker rule, profile switches, deletion and the device flags. */

let local: MemoryStorage
let restore: (() => void)[] = []
let clock = Date.parse('2026-09-30T10:00:00Z')

const session = () => useSession.getState()

/** A new app start: in-memory state is gone, storage and IndexedDB stay. */
async function restart() {
  useRound.getState().quit()
  await useProfile.getState().unload()
  resetSessionForTests()
  await session().boot({ pruneDelayMs: null })
}

function plan(seed = 1): RoundPlan {
  const tasks = buildRound({ keys: addKeys(addFacts(10)), states: {}, roundIndex: 0, day: '2026-09-30', size: 10, rng: makeRng(seed) })
  return { roundId: `r${seed}`, sessionId: session().sessionId, mode: 'round', nodeId: 'w0-plus10-l1', seed, tasks }
}

function answer() {
  clock += 2000
  useRound.getState().submit(useRound.getState().current!.answer)
  clock += 800
  useRound.getState().next()
}

beforeEach(async () => {
  useRound.getState().quit()
  await useProfile.getState().unload({ discard: true })
  await freshDb()
  resetSessionForTests()
  local = new MemoryStorage()
  restore = [installStorage('localStorage', local), installStorage('sessionStorage', new MemoryStorage())]
})

afterEach(() => {
  vi.restoreAllMocks()
  restore.forEach((r) => r())
  restore = []
})

describe('boot', () => {
  it('starts empty on a new device and writes the boot object', async () => {
    await session().boot({ pruneDelayMs: null })
    expect(session()).toMatchObject({ phase: 'ready', profiles: [], activeId: null, bootStored: true, storageError: null })
    expect(readBoot()).toEqual({ v: 1, profileIds: [], lastProfileId: null, device: { followSilentSwitch: false, audioVerified: null, calm: false } })
    expect(useProfile.getState().context.sessionId).toBe(session().sessionId)
    expect(Object.keys(local.dump())).toEqual([BOOT_KEY])
  })

  it('goes straight in with one child and shows the picker with two', async () => {
    await session().boot({ pruneDelayMs: null })
    const ada = await session().createProfile({ name: 'Ada', grade: 0 })
    expect(session().activeId).toBe(ada.id)
    expect(useProfile.getState().profile?.id).toBe(ada.id)
    const firstSession = session().sessionId

    await restart()
    expect(session().sessionId).not.toBe(firstSession)
    expect(session().activeId).toBe(ada.id)
    expect(useProfile.getState().profile?.name).toBe('Ada')

    const bo = await session().createProfile({ name: 'Bo', grade: 2 }, { select: false })
    expect(session().activeId).toBe(ada.id)
    await restart()
    expect(session().activeId).toBeNull()
    expect(useProfile.getState().profile).toBeNull()
    expect(session().profiles.map((p) => p.name)).toEqual(['Ada', 'Bo'])
    expect(session().profiles[1]).toMatchObject({ id: bo.id, initial: 'B', grade: 2, level: 1, buddy: null })
    expect(session().lastProfileId).toBe(ada.id)
    expect(readBoot().profileIds).toEqual([ada.id, bo.id])
  })

  it('trusts IndexedDB over a stale boot index', async () => {
    const ada = await createProfile({ name: 'Ada', grade: 0 })
    writeBoot({ v: 1, profileIds: ['p_gone', ada.id], lastProfileId: 'p_gone', device: { followSilentSwitch: true, audioVerified: true, calm: false } })
    await session().boot({ pruneDelayMs: null })
    expect(readBoot()).toMatchObject({ profileIds: [ada.id], lastProfileId: ada.id, device: { followSilentSwitch: true, audioVerified: true } })
    expect(useProfile.getState().context.audioVerified).toBe(true)
  })

  it('still starts when localStorage is blocked', async () => {
    restore.push(installStorage('localStorage', 'getter-throws'))
    const ada = await createProfile({ name: 'Ada', grade: 0 })
    await session().boot({ pruneDelayMs: null })
    expect(session()).toMatchObject({ phase: 'ready', bootStored: false, activeId: ada.id })
  })

  it('starts empty and keeps the boot index when IndexedDB fails', async () => {
    const ada = await createProfile({ name: 'Ada', grade: 0 })
    writeBoot({ v: 1, profileIds: [ada.id], lastProfileId: ada.id, device: { followSilentSwitch: false, audioVerified: true, calm: false } })
    const before = local.dump()
    vi.spyOn(getDb().profiles, 'toArray').mockRejectedValueOnce(new Error('Connection to Indexed Database server lost'))
    await session().boot({ pruneDelayMs: null })
    expect(session()).toMatchObject({ phase: 'ready', profiles: [], activeId: null, lastProfileId: ada.id })
    expect(session().storageError).toContain('Indexed Database')
    expect(local.dump()).toEqual(before)
  })

  it('boots only once per app start', async () => {
    const a = session().boot({ pruneDelayMs: null })
    const b = session().boot({ pruneDelayMs: null })
    expect(a).toBe(b)
    await a
  })
})

describe('switching profiles', () => {
  it('stores the running round of the first child before loading the second', async () => {
    await session().boot({ pruneDelayMs: null })
    const ada = await session().createProfile({ name: 'Ada', grade: 0 })
    const bo = await session().createProfile({ name: 'Bo', grade: 1 }, { select: false })
    await session().selectProfile(ada.id)

    useRound.getState().start(plan(3), roundHooks({ now: () => clock }))
    answer()
    answer()
    const next = useRound.getState().current!.id
    await session().selectProfile(bo.id)
    expect(useRound.getState().status).toBe('idle')
    expect(session().activeId).toBe(bo.id)
    expect(useProfile.getState().profile?.id).toBe(bo.id)
    expect(useProfile.getState().profile?.round).toBeNull()

    const saved = (await getDb().profiles.get(ada.id))!
    expect(saved.round?.current?.id).toBe(next)
    expect(saved.round?.answered).toBe(2)
    expect(readBoot().lastProfileId).toBe(bo.id)

    // back to Ada: her round is waiting
    const doc = await session().selectProfile(ada.id)
    expect(doc?.round?.current?.id).toBe(next)
  })

  it('leaves to the picker after saving', async () => {
    await session().boot({ pruneDelayMs: null })
    const ada = await session().createProfile({ name: 'Ada', grade: 0 })
    useRound.getState().start(plan(), roundHooks({ now: () => clock }))
    answer()
    await session().leaveProfile()
    expect(session().activeId).toBeNull()
    expect((await getDb().profiles.get(ada.id))?.round?.answered).toBe(1)
  })
})

describe('deleting, exporting and importing', () => {
  it('deletes the active child with all rows and forgets it in the boot object', async () => {
    await session().boot({ pruneDelayMs: null })
    const ada = await session().createProfile({ name: 'Ada', grade: 0 })
    const bo = await session().createProfile({ name: 'Bo', grade: 0 }, { select: false })
    useRound.getState().start(plan(), roundHooks({ now: () => clock }))
    answer()
    answer()
    await session().deleteProfile(ada.id)
    // a write queued for Ada after the deletion must not bring her back
    await useProfile.getState().flush()
    expect(session().activeId).toBeNull()
    expect(session().profiles.map((p) => p.id)).toEqual([bo.id])
    expect(readBoot()).toMatchObject({ profileIds: [bo.id], lastProfileId: null })
    const db = getDb()
    expect(await db.profiles.get(ada.id)).toBeUndefined()
    expect((await db.answers.toArray()).filter((a) => a.profileId === ada.id)).toHaveLength(0)
    expect((await db.daily.toArray()).filter((d) => d.profileId === ada.id)).toHaveLength(0)
  })

  it('exports with the last answers and restores the active child', async () => {
    await session().boot({ pruneDelayMs: null })
    const ada = await session().createProfile({ name: 'Ada', grade: 0 })
    useRound.getState().start(plan(), roundHooks({ now: () => clock }))
    answer()
    answer()
    const file = await session().exportProfiles([ada.id])
    expect(file.profiles[0].answers).toHaveLength(2)
    expect(file.profiles[0].doc.round?.answered).toBe(2)

    answer()
    const restored = await session().importProfile(file.profiles[0], { mode: 'replace', profileId: ada.id })
    expect(restored.id).toBe(ada.id)
    expect(session().activeId).toBe(ada.id)
    expect(useProfile.getState().profile?.round?.answered).toBe(2)
    await useProfile.getState().flush()
    expect((await getDb().answers.toArray()).filter((a) => a.profileId === ada.id)).toHaveLength(2)

    const copy = await session().importProfile(file.profiles[0], { mode: 'new' })
    expect(session().profiles.map((p) => p.id)).toEqual([ada.id, copy.id])
    expect(readBoot().profileIds).toEqual([ada.id, copy.id])
  })

  it('keeps the imported child loaded when the dashboard picks a child meanwhile, and the next write keeps it', async () => {
    await session().boot({ pruneDelayMs: null })
    const ada = await session().createProfile({ name: 'Ada', grade: 0 })
    const file = await session().exportProfiles([ada.id])
    const entry = { ...file.profiles[0], doc: { ...file.profiles[0].doc, stamps: 9 } }
    // the dashboard selects the last child whenever none is loaded (React runs that effect in the
    // same microtask as the store change; review of the release, "Erstat …s data")
    const picks: string[] = []
    // in the browser the import chunk resolves a task later than the dashboard's pick reads the child
    const storeImport = exportStore.importProfile
    vi.spyOn(exportStore, 'importProfile').mockImplementation(async (e, t) => {
      await new Promise((r) => setTimeout(r, 10))
      return storeImport(e, t)
    })
    const unsubscribe = useProfile.subscribe((s, prev) => {
      if (prev.profile && !s.profile && session().profiles.length > 0) {
        picks.push(ada.id)
        void session().selectProfile(ada.id)
      }
    })
    try {
      await session().importProfile(entry, { mode: 'replace', profileId: ada.id })
      await new Promise((r) => setTimeout(r, 50))
    } finally {
      unsubscribe()
    }
    expect(useProfile.getState().profile?.stamps).toBe(9)
    expect(session().activeId).toBe(ada.id)
    // a setting changed after the import is written on top of the imported child, not the old one
    useProfile.getState().setSettings({ domainsOff: ['number'] })
    await useProfile.getState().flush()
    const stored = await getDb().profiles.get(ada.id)
    expect(stored?.stamps).toBe(9)
    expect(stored?.settings.domainsOff).toEqual(['number'])
    expect(picks.length).toBeLessThanOrEqual(1)
  })

  it('writes nothing of the old child while its document is replaced', async () => {
    await session().boot({ pruneDelayMs: null })
    const ada = await session().createProfile({ name: 'Ada', grade: 0 })
    const file = await session().exportProfiles([ada.id])
    const entry = { ...file.profiles[0], doc: { ...file.profiles[0].doc, stamps: 4 } }
    const storeImport = exportStore.importProfile
    vi.spyOn(exportStore, 'importProfile').mockImplementation(async (e, t) => {
      // a setting changed on the old document while the file is being stored
      useProfile.getState().setSettings({ domainsOff: ['money'] })
      await new Promise((r) => setTimeout(r, 10))
      return storeImport(e, t)
    })
    await session().importProfile(entry, { mode: 'replace', profileId: ada.id })
    await useProfile.getState().flush()
    const stored = await getDb().profiles.get(ada.id)
    expect(stored?.stamps).toBe(4)
    expect(stored?.settings.domainsOff).not.toContain('money')
    expect(useProfile.getState().profile?.stamps).toBe(4)
    expect(useProfile.getState().profile?.settings.domainsOff).not.toContain('money')
  })
})

describe('device flags', () => {
  it('keeps the sound check result and logs answers accordingly', async () => {
    await session().boot({ pruneDelayMs: null })
    await session().createProfile({ name: 'Ada', grade: 0 })
    session().setAudioVerified(false)
    expect(readBoot().device.audioVerified).toBe(false)
    useRound.getState().start(plan(), roundHooks({ now: () => clock }))
    answer()
    session().setAudioVerified(true)
    answer()
    session().setDevice({ followSilentSwitch: true, calm: true })
    await useProfile.getState().flush()
    const logged = await getDb().answers.toArray()
    expect(logged.map((a) => a.audioUnverified)).toEqual([true, false])
    expect(readBoot().device).toEqual({ followSilentSwitch: true, audioVerified: true, calm: true })
    await restart()
    expect(session().device).toEqual({ followSilentSwitch: true, audioVerified: true, calm: true })
  })
})
