// Which worlds are built (before the first deploy). The worlds arrive wave by wave, so a world can be
// entered only when every one of its regions has a skill with a module and its friends, chests and
// finale are drawn. Until then the map shows it as "Kommer snart", whatever the child has unlocked,
// and a grown-up cannot open it: a stone never leads to an empty round, and an earned animal or thing
// is never one without a picture. The worlds become built by themselves as the skills and drawings land.
import { AVAILABLE_ITEMS } from '../art/items/registry'
import { AVAILABLE_SPECIES } from '../art/species/registry'
import { WORLDS, WORLD_BY_ID, regionsOfWorld, type RegionDef } from '../content/curriculum'
import { registeredSkills } from '../engine/registry'
import type { SkillId, WorldId } from '../engine/types'

/**
 * Worlds released to children. A built world also waits for its art review (rubric and blind
 * silhouettes), its recorded voice and a play-through: the integrator adds it here then. Until
 * that, the map shows it as "Kommer snart" like a world that is not built.
 */
export const RELEASED_WORLDS: ReadonlySet<WorldId> = new Set<WorldId>(['eng'])

/** The species and things whose drawings exist, and the worlds released. */
export interface Drawn {
  species: ReadonlySet<string>
  items: ReadonlySet<string>
  /** Worlds released to children (left out: every world). */
  released?: ReadonlySet<WorldId>
}

export const DRAWN: Drawn = { species: new Set(AVAILABLE_SPECIES), items: new Set(AVAILABLE_ITEMS), released: RELEASED_WORLDS }

/** Something to play: one of the region's own skills (not only its reviews) is registered. */
export function regionHasContent(region: RegionDef, registered: ReadonlySet<SkillId>): boolean {
  return region.skills.some((s) => !s.reviewOnly && registered.has(s.skill))
}

/**
 * Every skill the region teaches has a module. The region's first stones each ask for half of its
 * skills, so one registered skill is not enough: the other stone would have no tasks.
 */
export function regionComplete(region: RegionDef, registered: ReadonlySet<SkillId>): boolean {
  return region.skills.every((s) => s.reviewOnly || registered.has(s.skill))
}

/** The region's friend or chest is drawn. */
export function regionDrawn(region: RegionDef, drawn: Drawn = DRAWN): boolean {
  const n = region.node3
  if (n.kind === 'friend') return drawn.species.has(n.species)
  if (n.kind === 'chest') return drawn.items.has(n.item)
  return true
}

/** The world is released, every region of it is complete and its rewards are drawn. */
export function worldReady(world: WorldId, registered: ReadonlySet<SkillId>, drawn: Drawn = DRAWN): boolean {
  const regions = regionsOfWorld(world)
  return (drawn.released?.has(world) ?? true)
    && regions.length > 0
    && regions.every((r) => regionComplete(r, registered) && regionDrawn(r, drawn))
    && WORLD_BY_ID[world].finaleItems.every((i) => drawn.items.has(i))
}

let built: ReadonlyMap<WorldId, boolean> | null = null

/** Dev servers only: `?worlds=all` lets a skill be play-tested in its world before the drawings land. */
const devAllWorlds = (): boolean =>
  import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('worlds') === 'all'

/** worldReady for the skills and drawings of this build. */
export function worldBuilt(world: WorldId): boolean {
  if (devAllWorlds()) return true
  if (!built) {
    const registered = new Set(registeredSkills().map((d) => d.id))
    built = new Map(WORLDS.map((w) => [w.id, worldReady(w.id, registered)]))
  }
  return built.get(world) ?? false
}
