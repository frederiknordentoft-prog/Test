// The loop's hand-overs (SPEC §2.1 in spildesign: kort → tur → belønninger → kort): how a round is
// entered from the map or the ceremonies, and where it leaves to. Kept apart from the screens so the
// tests can follow the whole loop without a DOM.
import { useNav } from '../../../../app/nav'
import type { Route, RouteOf } from '../../../../app/routes'
import { NODE_BY_ID, REGION_BY_ID } from '../../../../content/curriculum'
import type { ProfileDoc, RegionId, WorldId } from '../../../../engine/types'
import type { Reward } from '../../../../meta/rewards'
import { homeWorld, mapModel } from '../map/model'
import type { PlayTarget } from '../map/nodes'

/**
 * The round route for a target. The Træningshytte names its region with `region`, which the round
 * route does not declare yet (proposed contract change); PlayScreen falls back to the most recently
 * failed trial without it.
 */
export function roundRoute(target: PlayTarget, opts: { resume?: boolean; region?: RegionId | null } = {}): Route {
  const route: RouteOf<'round'> = { id: 'round', node: target }
  if (opts.resume) route.resume = true
  if (target === 'hut' && opts.region) route.region = opts.region
  return route
}

/** From the map: the round is pushed, so ✕ → "Til kortet" pops straight back. */
export function playFromMap(target: PlayTarget, opts: { resume?: boolean; region?: RegionId | null } = {}): void {
  useNav.getState().go(roundRoute(target, opts))
}

/** From the end of a round ("Næste"): the ceremonies are replaced, the map stays underneath. */
export function playNext(target: PlayTarget): void {
  useNav.getState().replace(roundRoute(target))
}

let last: PlayTarget | null = null

/** PlayScreen notes the round it starts, so the end of the round knows where the child was. */
export function noteRound(target: PlayTarget): void {
  last = target
}

/** The target of the last round started on this page (null after a reload into the map). */
export function lastRound(): PlayTarget | null {
  return last
}

/** The round is over (rewards next) or paused (stored, back to where the child came from). */
export function exitRound(outcome: 'paused' | 'finished'): void {
  if (outcome === 'finished') useNav.getState().replace({ id: 'ceremonies' })
  else useNav.getState().back()
}

const worldOf = (target: PlayTarget | null): WorldId | null => (target && NODE_BY_ID[target] ? NODE_BY_ID[target].world : null)

/**
 * "Til kortet" after a round: the map of the region whose fog just lifted (it is brought into view
 * and lit), else of the world the round was played in.
 */
export function mapAfterRound(rewards: readonly Reward[], last: PlayTarget | null): Route {
  const opened = rewards.find((r): r is Extract<Reward, { t: 'opened' }> => r.t === 'opened')
  const region = opened?.regions[0]
  const world = (region ? REGION_BY_ID[region]?.world : null) ?? opened?.worlds[0] ?? worldOf(last)
  return { id: 'map', ...(world ? { world } : {}), ...(region ? { region } : {}) }
}

/** "Næste" after a round: the next stone of the world the round was played in, else Blandet øvelse. */
export function nextAfterRound(profile: ProfileDoc | null, last: PlayTarget | null): PlayTarget {
  if (!profile) return 'practice'
  const world = worldOf(last) ?? homeWorld(profile)
  return mapModel(profile, world).next ?? 'practice'
}
