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
import { AVAILABLE_SPECIES } from '../../../../art/species/registry'
import { STARTERS } from '../../../../content/catalog'
import { regionsOfWorld } from '../../../../content/curriculum'
import { isRegionOpen } from '../../../../meta/unlock'
import {
  finishOnboarding, firstNode, hatchFirstFriend, nameFriend, newProfileId, offeredStarters, resetOnboardingForTests, starterLooks,
} from './flow'

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

describe('the eggs (review P1-2, P2-9)', () => {
  it('offers only the starters that are drawn, all four once they are', () => {
    expect(offeredStarters()).toEqual(STARTERS.filter((s) => (AVAILABLE_SPECIES as readonly string[]).includes(s)))
    expect(offeredStarters(() => true)).toEqual(['rabbit', 'cat', 'puppy', 'horse'])
    expect(offeredStarters((s) => s !== 'puppy')).toEqual(['rabbit', 'cat', 'horse'])
  })

  it('shows each baby in the breed and colour it hatches with', async () => {
    let i = 0
    for (const species of STARTERS) {
      const id = newProfileId()
      const looks = starterLooks(id)
      expect(Object.keys(looks).sort()).toEqual([...STARTERS].sort())
      const friend = await hatchFirstFriend({ name: `Barn ${++i}`, species, id })
      expect(useProfile.getState().profile?.id).toBe(id)
      expect(friend, species).toMatchObject({ species, breed: looks[species]!.breed, colorway: looks[species]!.colorway, stage: 1 })
      await useProfile.getState().flush()
      expect((await getProfile(id))?.animals[0]).toMatchObject({ breed: looks[species]!.breed, colorway: looks[species]!.colorway })
    }
  })

  it('draws different colours for different children, as before', () => {
    const colours = new Set(Array.from({ length: 24 }, () => starterLooks(newProfileId()).cat!.colorway))
    expect(colours.size).toBeGreaterThan(1)
  })
})

describe('the grade (review P2-10)', () => {
  it('opens all of Engdalen from 1. class, and nothing more in 0. class', async () => {
    await hatchFirstFriend({ name: 'Bo', species: 'cat', id: newProfileId() })
    await finishOnboarding(2)
    const p = useProfile.getState().profile!
    expect(p.grade).toBe(2)
    for (const r of regionsOfWorld('eng')) expect(isRegionOpen(p, r.id), r.id).toBe(true)
    // Hestebakkerne has nothing to play yet: it stays closed
    expect(p.unlocked.worlds).toEqual([])
    const stored = await getProfile(p.id)
    expect(stored?.unlocked.regions).toEqual(p.unlocked.regions)
  })

  it('keeps the first two places of Engdalen in 0. class', async () => {
    await hatchFirstFriend({ name: 'Liv', species: 'rabbit' })
    await finishOnboarding(0)
    const p = useProfile.getState().profile!
    expect(p.unlocked).toEqual({ worlds: [], regions: [] })
    expect(regionsOfWorld('eng').filter((r) => isRegionOpen(p, r.id)).map((r) => r.id)).toEqual(['w0-tal10', 'w0-former'])
  })
})
