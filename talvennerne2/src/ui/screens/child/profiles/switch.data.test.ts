// One child, then siblings (review P1-1), against a real (fake) IndexedDB: the app still goes straight
// in with one child, but the picker can be reached — from the dashboard's "Skift spiller" — and shows
// that child and "+ Ny spiller"; with two or more children a child switches from the map without the
// gate, and the child who played is written and unloaded first.
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initialRoute } from '../../../../app/boot'
import { resetNavForTests, useNav } from '../../../../app/nav'
import { getProfile } from '../../../../data/repo/profiles'
import { freshDb } from '../../../../data/testing/freshDb'
import { MemoryStorage, installStorage } from '../../../../data/testing/memoryStorage'
import { useMeta } from '../../../../state/useMeta'
import { useProfile } from '../../../../state/useProfile'
import { resetSessionForTests, useSession } from '../../../../state/useSession'
import { playersActions } from '../../parent/dashboard/players'
import { switchPlayer } from '../map/switch'
import { canAddProfile } from './rules'

let restore: (() => void)[] = []

beforeEach(async () => {
  await useProfile.getState().unload({ discard: true })
  await freshDb()
  resetSessionForTests()
  restore = [installStorage('localStorage', new MemoryStorage()), installStorage('sessionStorage', new MemoryStorage())]
  await useSession.getState().boot({ pruneDelayMs: null })
  resetNavForTests({ id: 'map' })
})

afterEach(() => {
  restore.forEach((r) => r())
  restore = []
})

async function child(name: string, species: 'cat' | 'rabbit' | 'horse') {
  const doc = await useSession.getState().createProfile({ name, grade: 0 })
  useMeta.getState().chooseStarter(species)
  await useProfile.getState().flush()
  return doc.id
}

/** A new app start on the same device. */
async function restart() {
  await useProfile.getState().unload()
  resetSessionForTests()
  await useSession.getState().boot({ pruneDelayMs: null })
}

const dashboard = () =>
  playersActions({
    nav: useNav.getState(),
    session: { profileCount: () => useSession.getState().profiles.length, leaveProfile: () => useSession.getState().leaveProfile() },
    restoreOrigin: async () => undefined,
  })

describe('a single child', () => {
  it('still starts straight in, and "Skift spiller" shows the picker with the child and "+ Ny spiller"', async () => {
    const ida = await child('Ida', 'cat')
    await restart()
    expect(useSession.getState().activeId).toBe(ida)
    expect(initialRoute(useSession.getState(), useProfile.getState().profile)).toEqual({ id: 'map' })

    await dashboard().switchPlayer()
    expect(useSession.getState().activeId).toBeNull()
    expect(useProfile.getState().profile).toBeNull()
    expect(useNav.getState()).toMatchObject({ route: { id: 'profiles' }, stack: [] })

    // what the picker draws: the one child, and room for "+ Ny spiller" (the click-through looks at it)
    expect(useSession.getState().profiles.map((p) => p.id)).toEqual([ida])
    expect(canAddProfile(useSession.getState().profiles.length)).toBe(true)
  })

  it('"Ny spiller" in the dashboard goes to the onboarding on top of it', async () => {
    await child('Ida', 'cat')
    useNav.getState().go({ id: 'parent' })
    expect(await dashboard().newPlayer()).toBe(true)
    expect(useNav.getState().route).toEqual({ id: 'onboarding' })
    expect(useNav.getState().stack.map((r) => r.id)).toEqual(['map', 'parent'])
  })
})

describe('siblings', () => {
  it('switch from the map without the gate; the child who played is written first', async () => {
    await child('Ida', 'cat')
    const bo = await child('Bo', 'rabbit')
    expect(useSession.getState().activeId).toBe(bo)
    useProfile.getState().update((p) => ({ ...p, economy: { ...p.economy, perler: 42 } }))
    await switchPlayer()
    expect(useSession.getState().activeId).toBeNull()
    expect(useNav.getState()).toMatchObject({ route: { id: 'profiles' }, stack: [] })
    expect((await getProfile(bo))?.economy.perler).toBe(42)
    expect(useSession.getState().profiles).toHaveLength(2)
  })
})
