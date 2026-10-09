import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '../data/db'
import * as exportStore from '../data/export'
import { createProfile, getProfile } from '../data/repo/profiles'
import { freshDb, watchWriteTransactions } from '../data/testing/freshDb'
import { MemoryStorage, installStorage } from '../data/testing/memoryStorage'
import { registeredSkills } from '../engine/registry'
import type { ProfileDoc, ProfileId } from '../engine/types'
import { isRegionOpen, isWorldOpen } from '../meta/unlock'
import { applyGrade } from '../ui/screens/parent/dashboard/openings'
import { useProfile } from './useProfile'
import { resetSessionForTests, useSession } from './useSession'

/**
 * A child in 3. klasse gets Stjernefjeldet opened at its next load and at an import once the world
 * is ready (the integrator releases it last, in RELEASED_WORLDS); 0.–2. klasse load and import
 * exactly as stored. The import race fix (replaceLoaded) holds for such a child too.
 */

// The tests start from a build where Stjernefjeldet is not released (whatever RELEASED_WORLDS says
// today) and make every world drawn and released between two loads, as the release did.
const world = vi.hoisted(() => ({ ready: false }))
vi.mock('../meta/built', async (importOriginal) => {
  const real = await importOriginal<typeof import('../meta/built')>()
  const { SPECIES_IDS, WORLD_IDS } = await import('../engine/types')
  const { ITEMS } = await import('../content/catalog')
  const all = { species: new Set<string>(SPECIES_IDS), items: new Set<string>(ITEMS.map((i) => i.id)), released: new Set(WORLD_IDS) }
  const DRAWN = {
    get species() {
      return world.ready ? all.species : real.DRAWN.species
    },
    get items() {
      return world.ready ? all.items : real.DRAWN.items
    },
    get released() {
      return world.ready ? all.released : new Set(WORLD_IDS.filter((w) => w !== 'fjeld'))
    },
  }
  return { ...real, DRAWN }
})

// before the first open: Dexie binds IDBDatabase.transaction when it opens the database
const writes = watchWriteTransactions()
let restore: (() => void)[] = []

const state = () => useProfile.getState()
const session = () => useSession.getState()
const stored = async (id: ProfileId) => (await getDb().profiles.get(id))!
const registered = () => new Set(registeredSkills().map((d) => d.id))

/** A new load of the child, as at the next app start, with what it writes. */
async function reload(id: ProfileId): Promise<ProfileDoc> {
  await state().unload()
  const doc = await state().loadProfile(id)
  await state().flush()
  return doc!
}

/** A child onboarded in 3. klasse before Stjernefjeldet was ready (the onboarding's applyGrade). */
async function thirdGraderFromBefore(name = 'Cille'): Promise<ProfileDoc> {
  const p = await createProfile({ name, grade: 0 })
  await state().loadProfile(p.id)
  state().update((doc) => applyGrade(doc, 3, registered()))
  await state().flush()
  await state().unload()
  return stored(p.id)
}

beforeEach(async () => {
  world.ready = false
  await state().unload({ discard: true })
  await freshDb()
  resetSessionForTests()
  restore = [installStorage('localStorage', new MemoryStorage()), installStorage('sessionStorage', new MemoryStorage())]
})

afterEach(() => {
  vi.restoreAllMocks()
  writes.stop()
  restore.forEach((r) => r())
  restore = []
})

describe('a child in 3. klasse when Stjernefjeldet becomes ready', () => {
  it('gets Stjernefjeldet opened at the next load, written once, and nothing more after that', async () => {
    const before = await thirdGraderFromBefore()
    expect(before.unlocked.worlds).toEqual(['bakke', 'skov'])
    expect(isWorldOpen(before, 'fjeld')).toBe(false)

    // not ready yet: the load changes nothing and writes nothing
    writes.start()
    const same = await reload(before.id)
    expect(writes.log).toEqual([])
    expect(same).toEqual(await getProfile(before.id))

    // released between two loads
    world.ready = true
    writes.start()
    const after = await reload(before.id)
    expect(writes.log).toEqual([['answers', 'daily', 'profiles']])
    expect(after.unlocked.worlds).toEqual(['bakke', 'skov', 'fjeld'])
    expect(after.unlocked.regions).toEqual(before.unlocked.regions)
    expect(isWorldOpen(after, 'fjeld')).toBe(true)
    // its first two places open by the usual rule
    expect(isRegionOpen(after, 'w3-tabellen')).toBe(true)
    expect(isRegionOpen(after, 'w3-store-tal')).toBe(true)
    expect((await stored(before.id)).unlocked.worlds).toContain('fjeld')
    expect(state().profile).toEqual(after)

    // idempotent: the next load is the stored child as it is
    writes.start()
    const again = await reload(before.id)
    expect(writes.log).toEqual([])
    expect(again).toEqual(after)
  })

  it('leaves 0.–2. klasse exactly as stored, also once Stjernefjeldet is ready', async () => {
    world.ready = true
    for (const grade of [0, 1, 2] as const) {
      const p = await createProfile({ name: `Barn ${grade}`, grade })
      writes.start()
      const doc = await reload(p.id)
      writes.stop()
      expect(writes.log, `${grade}. klasse`).toEqual([])
      expect(doc).toEqual(await getProfile(p.id))
      expect(doc.unlocked).toEqual({ worlds: [], regions: [] })
    }
  })

  it('never lets a superseded load of the child land or write', async () => {
    const cille = await thirdGraderFromBefore()
    const bo = await createProfile({ name: 'Bo', grade: 1 })
    world.ready = true
    const first = state().loadProfile(cille.id)
    const second = state().loadProfile(bo.id)
    await Promise.all([first, second])
    await state().flush()
    expect(state().profile?.id).toBe(bo.id)
    // Cille's opening waits for her next load
    expect((await stored(cille.id)).unlocked.worlds).not.toContain('fjeld')
    expect((await reload(cille.id)).unlocked.worlds).toContain('fjeld')
  })
})

describe('an imported child in 3. klasse', () => {
  it('arrives with Stjernefjeldet open, as a new child and over the active child; 0.–2. klasse as in the file', async () => {
    await session().boot({ pruneDelayMs: null })
    const ada = await session().createProfile({ name: 'Ada', grade: 0 })
    const bo = await thirdGraderFromBefore('Bo')
    const kim = await createProfile({ name: 'Kim', grade: 2 })
    const file = await session().exportProfiles([bo.id, kim.id])
    const [boFile, kimFile] = file.profiles
    expect(boFile.doc.unlocked.worlds).not.toContain('fjeld')
    await session().selectProfile(ada.id)
    world.ready = true

    const copy = await session().importProfile(boFile, { mode: 'new' })
    expect(copy.unlocked.worlds).toEqual(['bakke', 'skov', 'fjeld'])
    expect((await stored(copy.id)).unlocked.worlds).toContain('fjeld')

    const kimCopy = await session().importProfile(kimFile, { mode: 'new' })
    expect((await stored(kimCopy.id)).unlocked).toEqual(kimFile.doc.unlocked)

    // over the active child: Ada stays loaded and becomes the file's child, Stjernefjeldet open
    const replaced = await session().importProfile(boFile, { mode: 'replace', profileId: ada.id })
    expect(replaced.id).toBe(ada.id)
    expect(state().profile).toMatchObject({ id: ada.id, name: 'Bo', grade: 3 })
    expect(isWorldOpen(state().profile!, 'fjeld')).toBe(true)
    await state().flush()
    expect((await stored(ada.id)).unlocked.worlds).toContain('fjeld')
  })

  it('keeps the import race fix: the imported child stays loaded and the next write keeps it', async () => {
    await session().boot({ pruneDelayMs: null })
    const cille = await thirdGraderFromBefore()
    await session().refreshProfiles()
    await session().selectProfile(cille.id)
    const file = await session().exportProfiles([cille.id])
    const entry = { ...file.profiles[0], doc: { ...file.profiles[0].doc, stamps: 9 } }
    world.ready = true
    // the dashboard selects the last child whenever none is loaded, and the import chunk resolves late
    const storeImport = exportStore.importProfile
    vi.spyOn(exportStore, 'importProfile').mockImplementation(async (e, t) => {
      // a setting changed on the old document while the file is being stored
      state().setSettings({ domainsOff: ['money'] })
      await new Promise((r) => setTimeout(r, 10))
      return storeImport(e, t)
    })
    const picks: string[] = []
    const unsubscribe = useProfile.subscribe((s, prev) => {
      if (prev.profile && !s.profile && session().profiles.length > 0) {
        picks.push(cille.id)
        void session().selectProfile(cille.id)
      }
    })
    try {
      await session().importProfile(entry, { mode: 'replace', profileId: cille.id })
      await new Promise((r) => setTimeout(r, 50))
    } finally {
      unsubscribe()
    }
    expect(picks.length).toBeLessThanOrEqual(1)
    expect(session().activeId).toBe(cille.id)
    expect(state().profile?.stamps).toBe(9)
    expect(state().profile?.settings.domainsOff).not.toContain('money')
    expect(isWorldOpen(state().profile!, 'fjeld')).toBe(true)
    // a setting changed after the import is written on top of the imported child, not the old one
    state().setSettings({ domainsOff: ['number'] })
    await state().flush()
    const after = await stored(cille.id)
    expect(after.stamps).toBe(9)
    expect(after.settings.domainsOff).toEqual(['number'])
    expect(after.unlocked.worlds).toContain('fjeld')
  })
})
