import { describe, expect, it, vi } from 'vitest'
import { newProfileDoc } from '../../../../data/repo/profiles'
import type { ProfileDoc, ProfileId } from '../../../../engine/types'
import type { Route } from '../../../../app/routes'
import { canAddProfile, pickerActions } from './rules'

function setup(count: number) {
  const docs = new Map<ProfileId, ProfileDoc>()
  for (let i = 0; i < count; i++) {
    const d = newProfileDoc(`Barn ${i + 1}`, 0)
    docs.set(d.id, d)
  }
  const passes: (() => void)[] = []
  const routes: { how: 'go' | 'root'; route: Route }[] = []
  const deleted: ProfileId[] = []
  const gate = { open: vi.fn((onPass: () => void) => void passes.push(onPass)) }
  const actions = pickerActions({
    gate,
    nav: {
      go: (route) => void routes.push({ how: 'go', route }),
      root: (route) => void routes.push({ how: 'root', route }),
    },
    session: {
      profileCount: () => docs.size,
      selectProfile: async (id) => docs.get(id) ?? null,
      deleteProfile: async (id) => {
        deleted.push(id)
        docs.delete(id)
      },
    },
    home: (p) => (p.round ? { id: 'round', node: p.round.nodeId as never, resume: true } : { id: 'map' }),
  })
  /** The grown-up answers the sum. */
  const pass = () => passes.shift()?.()
  return { docs, gate, actions, routes, deleted, pass, ids: [...docs.keys()] }
}

describe('profile picker rules (SPEC §8)', () => {
  it('allows at most six players', () => {
    expect(canAddProfile(0)).toBe(true)
    expect(canAddProfile(5)).toBe(true)
    expect(canAddProfile(6)).toBe(false)
  })

  it('puts "+ Ny spiller" behind the gate', () => {
    const t = setup(2)
    expect(t.actions.add()).toBe(true)
    expect(t.gate.open).toHaveBeenCalledTimes(1)
    expect(t.routes).toEqual([])
    t.pass()
    expect(t.routes).toEqual([{ how: 'go', route: { id: 'onboarding' } }])
  })

  it('offers no new player at six, and asks for no sum then', () => {
    const t = setup(6)
    expect(t.actions.add()).toBe(false)
    expect(t.gate.open).not.toHaveBeenCalled()
    expect(t.routes).toEqual([])
  })

  it('puts "Slet" behind the gate', () => {
    const t = setup(3)
    const unlocked = vi.fn()
    t.actions.unlockDelete(unlocked)
    expect(t.gate.open).toHaveBeenCalledTimes(1)
    expect(unlocked).not.toHaveBeenCalled()
    t.pass()
    expect(unlocked).toHaveBeenCalledTimes(1)
  })

  it('deletes after the confirmation and starts over with the intro when nobody is left', async () => {
    const t = setup(2)
    await t.actions.remove(t.ids[0])
    expect(t.deleted).toEqual([t.ids[0]])
    expect(t.routes).toEqual([])
    await t.actions.remove(t.ids[1])
    expect(t.routes).toEqual([{ how: 'root', route: { id: 'parentIntro' } }])
  })

  it('opens the dashboard only behind the gate', () => {
    const t = setup(2)
    t.actions.adult()
    expect(t.routes).toEqual([])
    t.pass()
    expect(t.routes).toEqual([{ how: 'go', route: { id: 'parent' } }])
  })

  it('plays as the tapped child, from its own start', async () => {
    const t = setup(2)
    expect(await t.actions.choose(t.ids[1])).toBe(true)
    expect(t.routes).toEqual([{ how: 'root', route: { id: 'map' } }])
    expect(t.gate.open).not.toHaveBeenCalled()
    expect(await t.actions.choose('gone')).toBe(false)
  })
})
