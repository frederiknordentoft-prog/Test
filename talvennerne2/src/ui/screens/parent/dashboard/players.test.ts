// "Skift spiller" and "Ny spiller" in the dashboard (review P1-1), apart from the screen: both work
// with a single child, switching unloads the child and shows "Hvem skal spille?", and a new child
// starts the onboarding from the child who was playing when the dashboard opened.
import { describe, expect, it } from 'vitest'
import type { Route } from '../../../../app/routes'
import { playersActions } from './players'

function setup(count: number) {
  const log: string[] = []
  const routes: { how: 'go' | 'root'; route: Route; direction?: string }[] = []
  const actions = playersActions({
    nav: {
      go: (route) => void routes.push({ how: 'go', route }),
      root: (route, direction) => void routes.push({ how: 'root', route, direction }),
    },
    session: {
      profileCount: () => count,
      leaveProfile: async () => void log.push('leave'),
    },
    restoreOrigin: async () => void log.push('restore'),
  })
  return { actions, log, routes }
}

describe('Skift spiller', () => {
  it('stores and unloads the child, then asks who plays — with one child too', async () => {
    for (const count of [1, 2, 6]) {
      const t = setup(count)
      await t.actions.switchPlayer()
      expect(t.log).toEqual(['leave'])
      expect(t.routes).toEqual([{ how: 'root', route: { id: 'profiles' }, direction: 'back' }])
    }
  })
})

describe('Ny spiller', () => {
  it('starts the onboarding from the child who was playing, also with a single child', async () => {
    const t = setup(1)
    expect(t.actions.canAdd()).toBe(true)
    expect(await t.actions.newPlayer()).toBe(true)
    expect(t.log).toEqual(['restore'])
    expect(t.routes).toEqual([{ how: 'go', route: { id: 'onboarding' } }])
  })

  it('does nothing at six children', async () => {
    const t = setup(6)
    expect(t.actions.canAdd()).toBe(false)
    expect(await t.actions.newPlayer()).toBe(false)
    expect(t.log).toEqual([])
    expect(t.routes).toEqual([])
  })
})
