// The loop's hand-overs (SPEC §2.1 in spildesign: kort → tur → belønninger → kort): how a round is
// entered from the map or the ceremonies, and where it leaves to. Kept apart from the screens so the
// tests can follow the whole loop without a DOM.
import { useNav } from '../../../../app/nav'
import type { Route } from '../../../../app/routes'
import type { RegionId } from '../../../../engine/types'
import type { PlayTarget } from '../map/nodes'

/**
 * The round route for a target. The Træningshytte names its region with `region`, which the round
 * route does not declare yet (proposed contract change); PlayScreen falls back to the most recently
 * failed trial without it.
 */
export function roundRoute(target: PlayTarget, opts: { resume?: boolean; region?: RegionId | null } = {}): Route {
  const route: Route & { region?: RegionId } = { id: 'round', node: target }
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
