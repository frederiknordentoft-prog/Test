import { beforeEach, describe, expect, it } from 'vitest'
import { newProfileDoc } from '../data/repo/profiles'
import type { RoundSnapshot } from '../engine/types'
import { initialRoute, profileHome } from './boot'
import { resetNavForTests, useNav } from './nav'
import { DOCK_OF, DOCK_ROUTES, SCREEN_FILES, routeKey } from './routes'
import type { RouteId } from './routes'

const snap = (nodeId: RoundSnapshot['nodeId']) => ({ nodeId }) as RoundSnapshot

describe('first screen', () => {
  it('opens the grown-ups intro on a device without profiles', () => {
    expect(initialRoute({ profiles: [], activeId: null }, null)).toEqual({ id: 'parentIntro' })
  })

  it('opens the picker with two or more profiles', () => {
    expect(initialRoute({ profiles: [1, 2], activeId: null }, null)).toEqual({ id: 'profiles' })
  })

  it('goes straight to the map, or back into a stored round, with one profile', () => {
    const p = newProfileDoc('Ida', 0)
    expect(initialRoute({ profiles: [1], activeId: p.id }, p)).toEqual({ id: 'map' })
    expect(profileHome({ ...p, round: snap('w0-tal10-l1') })).toEqual({ id: 'round', node: 'w0-tal10-l1', resume: true })
    expect(profileHome({ ...p, round: snap('practice') })).toEqual({ id: 'round', node: 'practice', resume: true })
  })

  it('does not resume a placement on the map (onboarding owns it)', () => {
    const p = newProfileDoc('Ida', 1)
    expect(profileHome({ ...p, round: snap('placement') })).toEqual({ id: 'map' })
  })
})

describe('navigation', () => {
  beforeEach(() => resetNavForTests({ id: 'map' }))

  it('pushes and pops with directions', () => {
    const nav = useNav.getState()
    nav.go({ id: 'animals' })
    expect(useNav.getState()).toMatchObject({ route: { id: 'animals' }, direction: 'forward', stack: [{ id: 'map' }] })
    useNav.getState().back()
    expect(useNav.getState()).toMatchObject({ route: { id: 'map' }, direction: 'back', stack: [] })
  })

  it('falls back to the map when there is nothing to go back to', () => {
    useNav.getState().root({ id: 'shop' })
    useNav.getState().back()
    expect(useNav.getState().route).toEqual({ id: 'map' })
  })

  it('clears the stack on a root jump', () => {
    useNav.getState().go({ id: 'animals', uid: 'a1' })
    useNav.getState().root({ id: 'books' })
    expect(useNav.getState().stack).toEqual([])
  })
})

describe('routes', () => {
  it('maps every dock item to a docked route and back', () => {
    for (const [dock, route] of Object.entries(DOCK_ROUTES)) expect(DOCK_OF[route.id]).toBe(dock)
  })

  it('names one screen file per route, under child/ or parent/', () => {
    const files = Object.values(SCREEN_FILES)
    expect(new Set(files).size).toBe(files.length)
    for (const f of files) expect(f).toMatch(/^(child|parent)\/[A-Z]\w+Screen$/)
  })

  it('keys a round by its node, so a new node is a new screen', () => {
    expect(routeKey({ id: 'round', node: 'w0-tal10-l1' })).not.toBe(routeKey({ id: 'round', node: 'w0-tal10-l2' }))
    expect(routeKey({ id: 'map', region: 'w0-tal10' })).toBe(routeKey({ id: 'map' }))
    const ids: RouteId[] = Object.keys(SCREEN_FILES) as RouteId[]
    expect(ids).toHaveLength(12)
  })
})
