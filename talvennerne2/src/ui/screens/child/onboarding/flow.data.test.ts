import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetNavForTests, useNav } from '../../../../app/nav'
import { NODE_BY_ID } from '../../../../content/curriculum'
import { ProfileLimitError, createProfile, getProfile } from '../../../../data/repo/profiles'
import { freshDb } from '../../../../data/testing/freshDb'
import { MemoryStorage, installStorage } from '../../../../data/testing/memoryStorage'
import { readBoot } from '../../../../data/namespace'
import { useProfile } from '../../../../state/useProfile'
import { resetSessionForTests, useSession } from '../../../../state/useSession'
import { finishOnboarding, firstNode, hatchFirstFriend, nameFriend, resetOnboardingForTests } from './flow'

/** Onboarding against a real (fake) IndexedDB: profile → starter → name → grade → first round. */

let restore: (() => void)[] = []

beforeEach(async () => {
  await useProfile.getState().unload({ discard: true })
  await freshDb()
  resetSessionForTests()
  resetOnboardingForTests()
  restore = [installStorage('localStorage', new MemoryStorage()), installStorage('sessionStorage', new MemoryStorage())]
  await useSession.getState().boot({ pruneDelayMs: null })
  resetNavForTests({ id: 'onboarding' })
})

afterEach(() => {
  restore.forEach((r) => r())
  restore = []
})

describe('onboarding flow (SPEC §8)', () => {
  it('starts every child at the first node of Engdalen', () => {
    expect(firstNode()).toBe('w0-tal10-l1')
    expect(NODE_BY_ID[firstNode()]).toMatchObject({ world: 'eng', slot: 'l1' })
  })

  it('creates the child at the hatch, with the chosen friend as buddy', async () => {
    const friend = await hatchFirstFriend({ name: 'Ida', species: 'cat' })
    expect(friend).toMatchObject({ species: 'cat', source: 'starter', stage: 1, uid: 'starter-cat' })
    const p = useProfile.getState().profile!
    expect(p.name).toBe('Ida')
    expect(p.buddyUid).toBe(friend.uid)
    expect(p.animals).toHaveLength(1)
    // the hatched animal is the stored one: same breed and colour after the write
    await useProfile.getState().flush()
    const stored = await getProfile(p.id)
    expect(stored?.animals[0]).toMatchObject({ species: 'cat', breed: friend.breed, colorway: friend.colorway })
    expect(useSession.getState()).toMatchObject({ activeId: p.id })
    expect(useSession.getState().profiles.map((s) => s.name)).toEqual(['Ida'])
    expect(readBoot().profileIds).toEqual([p.id])
  })

  it('names the friend, sets the grade and goes to the first round on the map', async () => {
    const friend = await hatchFirstFriend({ name: '', species: 'rabbit' })
    nameFriend(friend.uid, 'Kløver')
    const node = await finishOnboarding(2)
    expect(node).toBe('w0-tal10-l1')
    expect(useNav.getState().route).toEqual({ id: 'round', node: 'w0-tal10-l1' })
    expect(useNav.getState().stack).toEqual([{ id: 'map' }])

    const id = useProfile.getState().profile!.id
    const stored = await getProfile(id)
    expect(stored).toMatchObject({ name: 'Spiller 1', grade: 2, buddyUid: friend.uid })
    expect(stored?.animals[0].name).toBe('Kløver')
    // the picker's summary follows
    expect(useSession.getState().profiles[0]).toMatchObject({ grade: 2, buddy: { name: 'Kløver' } })
  })

  it('keeps a typed name of at most 14 characters', async () => {
    const friend = await hatchFirstFriend({ name: 'Bo', species: 'puppy' })
    nameFriend(friend.uid, '  Fru Snusegrisen den Første ')
    await finishOnboarding(0)
    const stored = await getProfile(useProfile.getState().profile!.id)
    expect(stored?.animals[0].name).toBe('Fru Snusegrise')
    expect(stored?.grade).toBe(0)
  })

  it('gives the horse as the Shetland foal', async () => {
    const friend = await hatchFirstFriend({ name: 'Liv', species: 'horse' })
    expect(friend).toMatchObject({ species: 'horse', breed: 'shetland' })
  })

  it('numbers the next unnamed child after the ones there are', async () => {
    await createProfile({ name: '', grade: 1 })
    await useSession.getState().refreshProfiles()
    await hatchFirstFriend({ name: '   ', species: 'cat' })
    expect(useProfile.getState().profile?.name).toBe('Spiller 2')
    expect(useSession.getState().profiles).toHaveLength(2)
  })

  it('refuses a seventh child', async () => {
    for (let i = 0; i < 6; i++) await createProfile({ name: `Barn ${i}`, grade: 0 })
    await useSession.getState().refreshProfiles()
    await expect(hatchFirstFriend({ name: 'Syv', species: 'cat' })).rejects.toBeInstanceOf(ProfileLimitError)
    expect(useSession.getState().profiles).toHaveLength(6)
  })
})
