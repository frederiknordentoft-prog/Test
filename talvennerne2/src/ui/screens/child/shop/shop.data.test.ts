import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DECOR, ITEMS } from '../../../../content/catalog'
import { getDb } from '../../../../data/db'
import { createProfile } from '../../../../data/repo/profiles'
import { freshDb } from '../../../../data/testing/freshDb'
import type { ItemColor, ItemId, ProfileDoc, ProfileId } from '../../../../engine/types'
import { totalPerler } from '../../../../meta/rewards'
import { installMeta, metaView, useMeta } from '../../../../state/useMeta'
import { pendingWrites, useProfile } from '../../../../state/useProfile'
import { everyItemDrawn } from '../wardrobe/drawn'
import { buy } from './buy'
import { priceOf, wishView, type Purchase } from './model'

/**
 * Buying through the game layer against a real (fake) IndexedDB (SPEC §5.7, §13.11): perler go down by
 * the fixed price and only when the thing is the child's; a refused purchase changes nothing; a failed
 * write loses nothing and never charges twice; it all survives a reload.
 */

const T0 = Date.parse('2026-10-01T14:00:00Z')
let uninstall: () => void = () => undefined

beforeEach(async () => {
  await useProfile.getState().unload({ discard: true })
  await freshDb()
  uninstall = installMeta({ now: () => T0 })
  useMeta.setState({ ceremony: null, rewards: [], lastAction: [], hutKeys: {} })
})

afterEach(() => {
  vi.restoreAllMocks()
  uninstall()
})

const state = () => useProfile.getState()
const profile = () => state().profile!

async function childWith(perler: number, inventory: Partial<Record<ItemId, ItemColor[]>> = {}): Promise<ProfileId> {
  const p = await createProfile({ name: 'Ada', grade: 0, now: T0 })
  await state().loadProfile(p.id)
  expect(useMeta.getState().chooseStarter('rabbit')).toBe(true)
  const inv: ProfileDoc['inventory'] = {}
  for (const [item, colors] of Object.entries(inventory) as [ItemId, ItemColor[]][]) inv[item] = { at: T0, colors }
  state().update((q) => ({ ...q, economy: { ...q.economy, perler }, inventory: { ...q.inventory, ...inv } }))
  await state().flush()
  return p.id
}

async function onDisk(id: ProfileId): Promise<ProfileDoc> {
  await state().flush()
  return (await getDb().profiles.get(id))!
}

async function reload(id: ProfileId): Promise<ProfileDoc> {
  await state().unload()
  await state().loadProfile(id)
  return profile()
}

describe('buying', () => {
  it('takes the fixed price of a shop thing, gives the thing, and keeps it through a reload', async () => {
    const id = await childWith(300)
    expect(buy({ kind: 'item', item: 'pirat-head' })).toBe(true)
    expect(profile().economy.perler).toBe(180)
    expect(profile().inventory['pirat-head']).toEqual({ at: T0, colors: [0] })
    expect(useMeta.getState().lastAction).toEqual([{ t: 'item', item: 'pirat-head', source: { kind: 'shop', price: 120 } }])
    expect(profile().rewardLog.at(-1)).toMatchObject({ kind: 'item', what: 'pirat-head', why: 'shop' })
    expect((await onDisk(id)).economy.perler).toBe(180)
    const back = await reload(id)
    expect(back.economy.perler).toBe(180)
    expect(back.inventory['pirat-head']?.colors).toEqual([0])
  })

  it('sells a new colour for 25 perler and keeps the thing and its other colours', async () => {
    const id = await childWith(60, { 'hverdag-head': [0] })
    expect(buy({ kind: 'color', item: 'hverdag-head', color: 2 })).toBe(true)
    expect(profile().economy.perler).toBe(35)
    expect(profile().inventory['hverdag-head']?.colors).toEqual([0, 2])
    expect(buy({ kind: 'color', item: 'hverdag-head', color: 1 })).toBe(true)
    expect(profile().inventory['hverdag-head']?.colors).toEqual([0, 1, 2])
    expect(profile().economy.perler).toBe(10)
    // the new colour can be worn at once
    expect(useMeta.getState().wear('starter-rabbit', 'hverdag-head', 1)).toBe(true)
    const back = await reload(id)
    expect(back.inventory['hverdag-head']?.colors).toEqual([0, 1, 2])
    expect(back.animals[0].outfit.head).toEqual({ item: 'hverdag-head', color: 1 })
  })

  it('sells decor once, at its price, and puts it in the animal garden', async () => {
    const id = await childWith(200)
    expect(buy({ kind: 'decor', id: 'pynt-traehus' })).toBe(true)
    expect(profile().economy.perler).toBe(50)
    expect(profile().decor['pynt-traehus']).toMatchObject({ at: T0, x: 0.5, y: 0.7 })
    expect(buy({ kind: 'decor', id: 'pynt-traehus' })).toBe(false)
    expect(profile().economy.perler).toBe(50)
    expect((await reload(id)).decor['pynt-traehus']).toBeDefined()
  })
})

describe('a purchase that cannot happen changes nothing', () => {
  it('refuses without enough perler — in memory and on disk', async () => {
    const id = await childWith(119, { 'hverdag-head': [0] })
    const before = profile()
    const disk = await onDisk(id)
    const said = useMeta.getState().lastAction
    const refused: Purchase[] = [
      { kind: 'item', item: 'pirat-head' }, // 120
      { kind: 'item', item: 'pirat-body' }, // 180
      { kind: 'decor', id: 'pynt-springvand' }, // 150
    ]
    for (const x of refused) expect(buy(x), JSON.stringify(x)).toBe(false)
    expect(profile()).toBe(before)
    expect(await onDisk(id)).toEqual(disk)
    expect(useMeta.getState().lastAction).toBe(said)
  })

  it('never sells what is not for sale, what the child has, or a colour of a thing they do not have', async () => {
    const id = await childWith(1000, { 'hverdag-head': [0, 1], 'pirat-face': [0] })
    const before = profile()
    const refused: Purchase[] = [
      { kind: 'item', item: 'hverdag-neck' }, // a level thing
      { kind: 'item', item: 'talmagiker-head' }, // a mastery thing
      { kind: 'item', item: 'opdager-head' }, // a chest thing
      { kind: 'item', item: 'pirat-face' }, // already the child's
      { kind: 'color', item: 'hverdag-head', color: 1 }, // already the child's
      { kind: 'color', item: 'hverdag-head', color: 0 }, // comes with the thing
      { kind: 'color', item: 'pirat-head', color: 2 }, // the thing is not the child's
    ]
    for (const x of refused) expect(buy(x), JSON.stringify(x)).toBe(false)
    expect(profile()).toBe(before)
    expect((await onDisk(id)).economy.perler).toBe(1000)
  })

  it('needs a loaded child', async () => {
    await state().unload()
    expect(buy({ kind: 'item', item: 'pirat-head' })).toBe(false)
  })
})

describe('nothing is lost', () => {
  it('only lowers perler by the fixed price (a full set adds its trophy), and never takes a thing, a colour or decor away', async () => {
    await childWith(2000, { 'hverdag-head': [0] })
    const plan: Purchase[] = [
      ...ITEMS.filter((i) => i.set === 'fest').map((i): Purchase => ({ kind: 'item', item: i.id })),
      { kind: 'color', item: 'fest-head', color: 1 },
      { kind: 'color', item: 'hverdag-head', color: 2 },
      ...DECOR.map((d): Purchase => ({ kind: 'decor', id: d.id })),
      { kind: 'item', item: 'fest-head' },
      { kind: 'item', item: 'pirat-back' },
      { kind: 'item', item: 'pirat-back' },
    ]
    for (const x of plan) {
      const before = profile()
      const ok = buy(x)
      const after = profile()
      // a completed set earns its trophy, and the trophy brings perler of its own
      const earned = ok ? totalPerler(useMeta.getState().lastAction) : 0
      expect(after.economy.perler, JSON.stringify(x)).toBe(ok ? before.economy.perler - priceOf(x)! + earned : before.economy.perler)
      for (const [item, e] of Object.entries(before.inventory)) for (const c of e!.colors) expect(after.inventory[item as ItemId]?.colors).toContain(c)
      for (const d of Object.keys(before.decor)) expect(after.decor).toHaveProperty(d)
      expect(after.animals).toEqual(before.animals)
    }
    // the whole Fest set earned its trophy; all the decor and the cape were bought once each
    expect(profile().achievements['set-fest']).toBeDefined()
    expect(Object.keys(profile().decor)).toHaveLength(DECOR.length)
    expect(profile().inventory['pirat-back']?.colors).toEqual([0])
    expect(profile().economy.perler).toBe(2000 - 760 + 10 - 2 * 25 - 770 - 180)
  })

  it('loses nothing when a write fails: the purchase is saved whole on the retry, and paid once', async () => {
    const id = await childWith(300)
    const put = vi.spyOn(getDb().profiles, 'put').mockImplementation(() => Promise.reject(new Error('disk full')) as never)
    expect(buy({ kind: 'item', item: 'fest-head' })).toBe(true)
    await state().flush()
    expect(state().saveError).toContain('disk full')
    expect(pendingWrites()).toBe(1)
    // all or nothing on disk: no perler gone without the thing
    put.mockRestore()
    const stale = (await getDb().profiles.get(id))!
    expect(stale.economy.perler).toBe(300)
    expect(stale.inventory['fest-head']).toBeUndefined()
    // the child still has it, and the retry writes it once
    expect(profile().inventory['fest-head']).toBeDefined()
    await state().flush()
    expect(state().saveError).toBeNull()
    const saved = await onDisk(id)
    expect(saved.economy.perler).toBe(180)
    expect(saved.inventory['fest-head']?.colors).toEqual([0])
    const back = await reload(id)
    expect(back.economy.perler).toBe(180)
  })
})

describe('the wish', () => {
  it('is pinned, fills with perler, is fulfilled and unpinned by buying it, and survives a reload', async () => {
    const id = await childWith(60)
    expect(useMeta.getState().setWish('pirat-body')).toBe(true)
    // the wish's own rules (the pirate set is not drawn yet; the shop hides it until it is)
    expect(wishView(profile(), everyItemDrawn)).toEqual({ item: 'pirat-body', progress: 60 / 180, buyable: false })
    expect(metaView(profile()).wish).toBeCloseTo(1 / 3)
    expect((await reload(id)).economy.wish).toBe('pirat-body')

    state().update((q) => ({ ...q, economy: { ...q.economy, perler: 200 } }))
    expect(wishView(profile(), everyItemDrawn)).toMatchObject({ progress: 1, buyable: true })
    expect(buy({ kind: 'item', item: 'pirat-body' })).toBe(true)
    expect(profile().economy).toMatchObject({ perler: 20, wish: null })
    expect(wishView(profile(), everyItemDrawn)).toBeNull()
    const back = await reload(id)
    expect(back.economy.wish).toBeNull()
    expect(back.inventory['pirat-body']).toBeDefined()
  })

  it('can be changed and unpinned, but never pinned on the child\'s own thing', async () => {
    await childWith(0, { 'pirat-head': [0] })
    expect(useMeta.getState().setWish('pirat-head')).toBe(false)
    expect(useMeta.getState().setWish('fodbold-body')).toBe(true)
    expect(useMeta.getState().setWish('vinter-hand')).toBe(true)
    expect(profile().economy.wish).toBe('vinter-hand')
    expect(useMeta.getState().setWish(null)).toBe(true)
    expect(profile().economy.wish).toBeNull()
    expect(profile().economy.perler).toBe(0)
  })
})
