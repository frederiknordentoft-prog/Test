import { describe, expect, it } from 'vitest'
import { NODES, REGIONS, nodesOfRegion, regionsOfWorld } from '../content/curriculum'
import { makeRng, type Rng } from '../engine/rng'
import { newProfile } from '../engine/testing/profile'
import { CHAIN_IDS, WORLD_IDS, type NodeId, type ProfileDoc, type RegionId, type TrialState } from '../engine/types'
import {
  hutRegions, isFinaleOpen, isNodeOpen, isRegionOpen, isWorldOpen, newlyOpened, practiceOpen, regionOpenInWorld,
  regionTier, trialReady, unlockView, worldTrialShare,
} from './unlock'

const fresh = (over: Partial<ProfileDoc> = {}) => newProfile({ unlocked: { worlds: [], regions: [] }, roundIndex: 0, ...over })
const played = (ids: string[], over: Partial<ProfileDoc['nodes'][NodeId]> = {}): ProfileDoc['nodes'] =>
  Object.fromEntries(ids.map((id) => [id, { plays: 1, stars: 1, skipped: false, lastAt: 1, ...over }]))
const passed = (): TrialState => ({ attempts: 1, failed: 0, best: 9, passedAt: 1, lastAttemptRound: 0 })
const failed = (n: number): TrialState => ({ attempts: n, failed: n, best: 6, passedAt: null, lastAttemptRound: 0 })
const allNodesOf = (region: RegionId) => nodesOfRegion(region).map((n) => n.id)

describe('regions (SPEC §5.3)', () => {
  it('opens the first world and its first two regions from the start', () => {
    const p = fresh()
    expect(isWorldOpen(p, 'eng')).toBe(true)
    expect(isWorldOpen(p, 'bakke')).toBe(false)
    expect(REGIONS.filter((r) => isRegionOpen(p, r.id)).map((r) => r.id)).toEqual(['w0-tal10', 'w0-former'])
  })

  it('opens the rest of a world when another region of it has four played nodes', () => {
    const three = fresh({ nodes: played(allNodesOf('w0-tal10').slice(0, 3)) })
    expect(isRegionOpen(three, 'w0-plus10')).toBe(false)
    const four = fresh({ nodes: played(allNodesOf('w0-tal10').slice(0, 4)) })
    expect(isRegionOpen(four, 'w0-plus10')).toBe(true)
    expect(isRegionOpen(four, 'w0-tal20')).toBe(true)
    expect(isRegionOpen(four, 'w0-tiervenner')).toBe(true)
    // Minusbækken also needs Plusengen's trial
    expect(isRegionOpen(four, 'w0-minus10')).toBe(false)
    expect(isRegionOpen({ ...four, trials: { 'w0-plus10': passed() } }, 'w0-minus10')).toBe(true)
  })

  it('counts nodes skipped by the trial as played', () => {
    const p = fresh({ nodes: played(allNodesOf('w0-former').slice(0, 4), { plays: 0, skipped: true }) })
    expect(isRegionOpen(p, 'w0-plus10')).toBe(true)
  })

  it('meets a requirement with the help bridge after exactly three failed attempts', () => {
    const base = { nodes: played(allNodesOf('w0-tal10')) }
    expect(isRegionOpen(fresh({ ...base, trials: { 'w0-plus10': failed(2) } }), 'w0-minus10')).toBe(false)
    expect(isRegionOpen(fresh({ ...base, trials: { 'w0-plus10': failed(3) } }), 'w0-minus10')).toBe(true)
    expect(unlockView(fresh({ ...base, trials: { 'w0-plus10': failed(3) } })).bridges).toEqual(['w0-plus10'])
  })

  it('lets a parent or the placement open regions (and meet requirements with them)', () => {
    const p = fresh({ unlocked: { worlds: [], regions: ['w0-plus10', 'w1-tiere'] } })
    expect(isRegionOpen(p, 'w0-plus10')).toBe(true)
    expect(isRegionOpen(p, 'w1-tiere')).toBe(true)
    expect(isRegionOpen({ ...p, nodes: played(allNodesOf('w0-tal10').slice(0, 4)) }, 'w0-minus10')).toBe(true)
  })

  it('has every requires inside its own chain', () => {
    for (const r of REGIONS) for (const q of r.requires) expect(REGIONS.find((x) => x.id === q)!.chain, r.id).toBe(r.chain)
  })
})

/** A random state of the map: plays, skips and trial results everywhere. */
function randomProfile(rng: Rng): ProfileDoc {
  const nodes: ProfileDoc['nodes'] = {}
  for (const n of NODES) {
    const roll = rng.next()
    if (roll < 0.45) continue
    nodes[n.id] = { plays: roll < 0.9 ? 1 + rng.int(3) : 0, stars: rng.int(4) as 0 | 1 | 2 | 3, skipped: roll >= 0.9, lastAt: 1 }
  }
  return fresh({ nodes, trials: randomTrials(rng, REGIONS.map((r) => r.id)) })
}

function randomTrials(rng: Rng, regions: readonly RegionId[]): ProfileDoc['trials'] {
  const trials: ProfileDoc['trials'] = {}
  for (const r of regions) {
    const roll = rng.int(5)
    if (roll === 0) continue
    trials[r] = roll === 1 ? passed() : failed(roll - 1)
  }
  return trials
}

describe('chains are independent (SPEC §5.3 test)', () => {
  it('no trial outside chain K ever changes whether a region of K is open', () => {
    const rng = makeRng(20261001)
    for (let i = 0; i < 300; i++) {
      const p = randomProfile(rng)
      for (const chain of CHAIN_IDS) {
        const outside = REGIONS.filter((r) => r.chain !== chain).map((r) => r.id)
        const changed: ProfileDoc = { ...p, trials: { ...p.trials, ...randomTrials(rng, outside) } }
        for (const r of outside) if (!(r in changed.trials) || rng.next() < 0.3) delete changed.trials[r]
        const allWorlds = { worlds: [...WORLD_IDS], regions: [] }
        for (const region of REGIONS.filter((r) => r.chain === chain)) {
          expect(regionOpenInWorld(changed, region), region.id).toBe(regionOpenInWorld(p, region))
          // with its world open, the region itself agrees as well
          expect(isRegionOpen({ ...changed, unlocked: allWorlds }, region.id)).toBe(isRegionOpen({ ...p, unlocked: allWorlds }, region.id))
        }
      }
    }
  })

  it('never locks for good: failing every trial three times, playing what is open opens everything', () => {
    let p = fresh({ trials: Object.fromEntries(REGIONS.map((r) => [r.id, failed(3)])) })
    // play every open node, again and again, until nothing new opens
    for (let changed = true; changed;) {
      const open = unlockView(p).nodes.filter((id) => !p.nodes[id])
      changed = open.length > 0
      p = { ...p, nodes: { ...p.nodes, ...played(open) } }
    }
    for (const world of WORLD_IDS) expect(isWorldOpen(p, world), world).toBe(true)
    for (const region of REGIONS) expect(isRegionOpen(p, region.id), region.id).toBe(true)
    expect(NODES.every((n) => isNodeOpen(p, n.id))).toBe(true)
  })
})

describe('worlds (SPEC §5.3)', () => {
  const engRegions = regionsOfWorld('eng').map((r) => r.id)

  it('opens the next world at 60 % of the trials passed', () => {
    const trialsPassed = (n: number) => Object.fromEntries(engRegions.slice(0, n).map((r) => [r, passed()]))
    expect(worldTrialShare(fresh({ trials: trialsPassed(3) }), 'eng')).toBe(0.5)
    expect(isWorldOpen(fresh({ trials: trialsPassed(3) }), 'bakke')).toBe(false)
    expect(isWorldOpen(fresh({ trials: trialsPassed(4) }), 'bakke')).toBe(true)
    // the help bridge is not a pass
    expect(isWorldOpen(fresh({ trials: { ...trialsPassed(3), 'w0-tal20': failed(3) } }), 'bakke')).toBe(false)
  })

  it('opens the next world when every node of this one has been played once', () => {
    const all = engRegions.flatMap(allNodesOf)
    expect(isWorldOpen(fresh({ nodes: played(all.slice(1)) }), 'bakke')).toBe(false)
    expect(isWorldOpen(fresh({ nodes: played(all) }), 'bakke')).toBe(true)
    expect(isWorldOpen(fresh({ nodes: played(all) }), 'skov')).toBe(false)
  })

  it('lets a parent or the placement open a world', () => {
    const p = fresh({ unlocked: { worlds: ['eng', 'bakke'], regions: [] } })
    expect(isWorldOpen(p, 'bakke')).toBe(true)
    expect(isRegionOpen(p, 'w1-tal100')).toBe(true)
    expect(isRegionOpen(p, 'w1-tieren')).toBe(false)
  })

  it('opens the finale with the next world', () => {
    const trials = Object.fromEntries(engRegions.slice(0, 4).map((r) => [r, passed()]))
    expect(isFinaleOpen(fresh(), 'eng')).toBe(false)
    expect(isFinaleOpen(fresh({ trials }), 'eng')).toBe(true)
    expect(isNodeOpen(fresh({ trials }), 'eng-finale')).toBe(true)
  })
})

describe('nodes, the hut and practice (SPEC §5.3)', () => {
  const ids = allNodesOf('w0-tal10')

  it('opens each node when the one before it is played; the trial is open from the start', () => {
    const open = (p: ProfileDoc) => ids.filter((id) => isNodeOpen(p, id))
    expect(open(fresh())).toEqual(['w0-tal10-l1', 'w0-tal10-trial'])
    expect(open(fresh({ nodes: played(ids.slice(0, 1)) }))).toEqual(['w0-tal10-l1', 'w0-tal10-l2', 'w0-tal10-trial'])
    expect(open(fresh({ nodes: played(ids.slice(0, 5)) }))).toEqual(ids)
    // skipped by the trial: the friend node can still be fetched
    const skipped = fresh({ nodes: played(['w0-tal10-l1', 'w0-tal10-l2'], { plays: 0, skipped: true }) })
    expect(isNodeOpen(skipped, 'w0-tal10-friend')).toBe(true)
    expect(isNodeOpen(fresh(), 'w0-plus10-l1')).toBe(false)
  })

  it('needs one normal round between two attempts at a trial', () => {
    const trials = { 'w0-tal10': { ...failed(1), lastAttemptRound: 10 } }
    expect(trialReady(fresh({ trials, roundIndex: 11 }), 'w0-tal10')).toBe(false)
    expect(trialReady(fresh({ trials, roundIndex: 12 }), 'w0-tal10')).toBe(true)
    expect(trialReady(fresh({ trials: { 'w0-tal10': passed() }, roundIndex: 50 }), 'w0-tal10')).toBe(false)
  })

  it('lights the training hut after a failed trial until it is passed', () => {
    expect(hutRegions(fresh())).toEqual([])
    expect(hutRegions(fresh({ trials: { 'w0-tal10': failed(1) } }))).toEqual(['w0-tal10'])
    expect(hutRegions(fresh({ trials: { 'w0-tal10': { ...failed(1), passedAt: 5 } } }))).toEqual([])
  })

  it('always has Blandet øvelse', () => {
    expect(practiceOpen()).toBe(true)
  })

  it('lists what opened between two states', () => {
    const before = unlockView(fresh())
    const after = unlockView(fresh({ nodes: played(ids.slice(0, 4)) }))
    expect(newlyOpened(before, after)).toEqual({ worlds: [], regions: ['w0-plus10', 'w0-tal20', 'w0-tiervenner'] })
  })
})

describe('the region colour (SPEC §5.6)', () => {
  it('is the highest tier half of the region has reached, and never fades', () => {
    // Tællelunden: count10, hear20, order20
    expect(regionTier(fresh(), 'w0-tal10')).toBe('start')
    expect(regionTier(fresh({ skillMedals: { count10: 'bronze' } }), 'w0-tal10')).toBe('start')
    expect(regionTier(fresh({ skillMedals: { count10: 'bronze', hear20: 'silver' } }), 'w0-tal10')).toBe('bronze')
    expect(regionTier(fresh({ skillMedals: { count10: 'gold', hear20: 'silver', order20: 'bronze' } }), 'w0-tal10')).toBe('silver')
    expect(regionTier(fresh({ skillMedals: { count10: 'gold', hear20: 'gold' } }), 'w0-tal10')).toBe('gold')
    // review-only skills do not count (Minusbækken is subTo10 alone)
    expect(regionTier(fresh({ skillMedals: { subTo10: 'gold' } }), 'w0-minus10')).toBe('gold')
  })
})
