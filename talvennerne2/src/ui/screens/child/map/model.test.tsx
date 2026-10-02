import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { nodesOfRegion } from '../../../../content/curriculum'
import { newProfileDoc } from '../../../../data/repo/profiles'
import { keyAt } from '../../../../engine/testing/profile'
import type { NodeId, NodeProgress, ProfileDoc, RoundSnapshot } from '../../../../engine/types'
import { chooseStarter } from '../../../../meta/actions'
import { AVAILABLE_ITEMS } from '../../../../art/items/registry'
import { MapView } from './MapView'
import { homeWorld, litHut, mapModel, playable, type MapModel, type StoneView } from './model'

/**
 * What the map shows (SPEC §5.3–5.7): a new child sees two places open and the rest closed but
 * visible, with the first stone suggested; a child further on sees stars, the bridge that holds,
 * the bridge resting after a failed try with the hut lit beside it, the stored round, and the fog
 * lifted over the regions their stones opened.
 */

const T = Date.parse('2026-10-01T15:00:00Z')

function newChild(): ProfileDoc {
  const p = newProfileDoc('Ada', 0, { id: 'kid', now: T })
  return chooseStarter(p, 'rabbit', { now: T })!.profile
}

const played = (stars: NodeProgress['stars'], over: Partial<NodeProgress> = {}): NodeProgress => ({ plays: 1, stars, skipped: false, lastAt: T, ...over })

function experienced(): ProfileDoc {
  const p = newChild()
  const nodes: ProfileDoc['nodes'] = {}
  for (const n of nodesOfRegion('w0-tal10')) nodes[n.id] = played(n.slot === 'trial' ? 3 : 2)
  for (const n of nodesOfRegion('w0-plus10').slice(0, 3)) nodes[n.id] = played(3)
  nodes['w0-plus10-trial'] = played(0)
  const round: RoundSnapshot = {
    v: 1, roundId: 'r', sessionId: 's', mode: 'round', nodeId: 'w0-plus10-l3', seed: 1, queue: [], current: null, phase: 'asking',
    answered: 3, total: 10, firstTries: [], streak: 0, bestStreak: 3, mistakes: 0, goldenUsed: false, goldenCaught: false,
    planks: 0, startedAt: T,
  }
  return {
    ...p,
    roundIndex: 12,
    nodes,
    trials: {
      'w0-tal10': { attempts: 1, failed: 0, best: 10, passedAt: T, lastAttemptRound: 6 },
      'w0-plus10': { attempts: 2, failed: 2, best: 7, passedAt: null, lastAttemptRound: 11, missed: ['add:3+4'] },
    },
    skillMedals: { count10: 'gold', hear20: 'silver', order20: 'silver' },
    keys: { 'add:3+4': keyAt(1, '2026-09-30') },
    economy: { ...p.economy, perler: 57, xp: 420, level: 3, eggWarmth: 20 },
    round,
  }
}

const stone = (m: MapModel, id: NodeId): StoneView => {
  for (const r of m.regions) for (const s of r.stones) if (s.id === id) return s
  if (m.finale.id === id) return m.finale
  throw new Error(`no stone ${id}`)
}

describe('the map of a new child', () => {
  const m = mapModel(newChild(), 'eng')

  it('opens Engdalen with its first two places, and shows every other place closed', () => {
    expect(m.worlds.map((w) => [w.id, w.open])).toEqual([['eng', true], ['bakke', false], ['skov', false], ['fjeld', false]])
    expect(m.regions.map((r) => [r.id, r.open])).toEqual([
      ['w0-tal10', true], ['w0-former', true], ['w0-plus10', false], ['w0-tal20', false], ['w0-minus10', false], ['w0-tiervenner', false],
    ])
    expect(m.regions.find((r) => r.id === 'w0-plus10')?.lock).toEqual({ kind: 'more' })
    expect(m.regions.find((r) => r.id === 'w0-minus10')?.lock).toEqual({ kind: 'requires', regions: ['w0-plus10'] })
    for (const r of m.regions.filter((x) => !x.open)) for (const s of r.stones) expect(s.state).toBe('locked')
    expect(m.finale.state).toBe('locked')
    expect(m.beyond).toMatchObject({ id: 'bakke', open: false })
  })

  it('suggests the first stone and opens the stones one by one; the bridge can be tried from the start', () => {
    expect(m.next).toBe('w0-tal10-l1')
    expect(stone(m, 'w0-tal10-l1')).toMatchObject({ state: 'open', next: true, playable: true, stars: 0 })
    for (const id of ['w0-tal10-l2', 'w0-tal10-friend', 'w0-tal10-l3', 'w0-tal10-mix'] as NodeId[]) expect(stone(m, id).state).toBe('locked')
    expect(stone(m, 'w0-tal10-trial')).toMatchObject({
      state: 'open', playable: true, trial: { attempts: 0, passed: false, resting: false, fromStart: true, pass: 8, size: 10 },
    })
  })

  it('shows the friend and the chest before they are won', () => {
    expect(stone(m, 'w0-tal10-friend').friend).toEqual({ species: 'rabbit', met: false })
    expect(stone(m, 'w0-former-chest').chest).toEqual({ item: 'opdager-head', opened: false })
  })

  it('keeps the HUD free of anything but the meters, the level and the perler', () => {
    expect(m.hud).toMatchObject({ level: 1, perler: 0, egg: 0, eggReady: false, heart: 0, wish: null })
    expect(m.hud.title.title).toBe('Nybegynder')
    expect(m.resume).toBeNull()
    expect(m.huts).toEqual([])
    expect(m.goals).toEqual([])
  })

  it('draws it so: the next stone lit, the closed ones locked, the closed worlds locked', () => {
    const html = renderToStaticMarkup(
      <MapView model={m} frame="sky" onWorld={() => undefined} onPlay={() => undefined} onBuddy={() => undefined} onAdult={() => undefined} />,
    )
    expect(html.match(/data-stone="/g)).toHaveLength(37)
    expect(html.match(/data-state="locked"/g)?.length).toBe(33)
    expect(html).toMatch(/data-stone="w0-tal10-l1"[^>]*data-next=""/)
    expect(html.match(/class="tv-world[^"]*is-locked/g)).toHaveLength(3)
    expect(html).toContain('data-tile="next"')
    expect(html).toContain('data-tile="practice"')
    expect(html).not.toContain('data-tile="resume"')
    // no numbers about currency on the path, and every stone is a button
    expect(html.match(/<button[^>]*data-stone=/g)).toHaveLength(37)
  })
})

describe('switching player and the wish on the map (review P1-1, P1-3)', () => {
  const m = mapModel(newChild(), 'eng')
  const view = (extra: Partial<Parameters<typeof MapView>[0]> = {}) =>
    renderToStaticMarkup(
      <MapView model={m} frame="sky" onWorld={() => undefined} onPlay={() => undefined} onBuddy={() => undefined} onAdult={() => undefined} {...extra} />,
    )

  it('shows the child\'s letter to switch player only when there are siblings (the screen decides)', () => {
    expect(view()).not.toContain('data-switch-player')
    const html = view({ switcher: { initial: 'A', frame: 'sky', onSwitch: () => undefined } })
    expect(html).toMatch(/<button[^>]*aria-label="Skift spiller"[^>]*data-switch-player=""/)
    expect(html).toContain('>A</span>')
  })

  it('shows the wish meter only for a thing that is drawn', () => {
    const p = newChild()
    const wish = (item: 'hverdag-head' | 'pirat-body') => mapModel({ ...p, economy: { ...p.economy, wish: item, perler: 30 } }, 'eng').hud.wish
    expect(wish('hverdag-head')).not.toBeNull()
    if (!AVAILABLE_ITEMS.includes('pirat-body')) expect(wish('pirat-body')).toBeNull()
  })
})

describe('the map of a child further on', () => {
  const p = experienced()
  const m = mapModel(p, 'eng')

  it('shows the stars, the bridge that holds, and the colour that came back', () => {
    const tal10 = m.regions.find((r) => r.id === 'w0-tal10')!
    expect(tal10.stones.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done', 'done'])
    expect(tal10.stones.map((s) => s.stars)).toEqual([2, 2, 2, 2, 2, 3])
    expect(stone(m, 'w0-tal10-trial').trial).toMatchObject({ passed: true, best: 10 })
    expect(stone(m, 'w0-tal10-friend').friend).toEqual({ species: 'rabbit', met: true })
    expect(tal10.tier).toBe('silver')
    expect(m.regions.find((r) => r.id === 'w0-former')?.tier).toBe('start')
  })

  it('lifts the fog where four stones were played; a trial still keeps its own chain closed', () => {
    const open = Object.fromEntries(m.regions.map((r) => [r.id, r.open]))
    expect(open).toEqual({
      'w0-tal10': true, 'w0-former': true, 'w0-plus10': true, 'w0-tal20': true, 'w0-minus10': false, 'w0-tiervenner': true,
    })
    expect(m.regions.find((r) => r.id === 'w0-minus10')?.lock).toEqual({ kind: 'requires', regions: ['w0-plus10'] })
    expect(m.regions.filter((r) => r.fresh).map((r) => r.id)).toEqual(['w0-tal20', 'w0-tiervenner'])
  })

  it('rests the bridge after a failed try, lights the hut, and keeps the round to continue', () => {
    const trial = stone(m, 'w0-plus10-trial')
    expect(trial).toMatchObject({ state: 'open', playable: false, trial: { attempts: 2, best: 7, passed: false, resting: true } })
    expect(m.huts).toEqual(['w0-plus10'])
    expect(m.regions.find((r) => r.id === 'w0-plus10')?.hut).toBe(true)
    expect(playable(p, 'hut', 'w0-plus10')).toBe(true)
    expect(playable(p, 'hut', 'w0-tal10')).toBe(true)
    expect(litHut(p, 'w0-tal10')).toBe('w0-plus10')
    expect(playable(p, 'w0-plus10-trial')).toBe(false)
    // one normal round later the bridge is ready again
    expect(playable({ ...p, roundIndex: 13 }, 'w0-plus10-trial')).toBe(true)
    expect(m.resume).toEqual({ target: 'w0-plus10-l3', mode: 'round' })
  })

  it('suggests the first stone left in the first open place, and the HUD shows the egg, perler and level', () => {
    expect(m.next).toBe('w0-former-l1')
    expect(m.hud).toMatchObject({ level: 3, perler: 57, egg: 1, eggReady: true })
    const html = renderToStaticMarkup(
      <MapView model={m} frame="sky" onWorld={() => undefined} onPlay={() => undefined} onBuddy={() => undefined} onAdult={() => undefined} />,
    )
    expect(html).toContain('data-tile="resume"')
    expect(html).toContain('data-hut="w0-plus10"')
    expect(html).toContain('data-perler="57"')
    expect(html).toMatch(/data-tier-lights="2"/)
  })
})

describe('the world shown first', () => {
  it('is the furthest open world with something left to play', () => {
    const p = newChild()
    expect(homeWorld(p)).toBe('eng')
    expect(homeWorld({ ...p, unlocked: { worlds: ['bakke'], regions: [] } })).toBe('bakke')
  })
})
