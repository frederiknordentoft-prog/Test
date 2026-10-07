// The grade and what a grown-up opens on the map (SPEC §8, §9.1 point 12, review P2-10). Places are
// opened through profile.unlocked, the parent's and the placement's way in (src/meta/unlock.ts):
// nothing here is a rule of its own, it only adds to that list — and never takes anything away.
//
// A child in 0.–2. class starts in Engdalen; once Stjernefjeldet is ready, a child in 3. class can
// first show Pip what it knows (the placement, SPEC A24) and starts where that fits. The grade matters:
//   - a child in 1.–3. class gets every place of the worlds below its grade opened, and its own
//     world when that is ready (gradeOpenings);
//   - a grown-up can open any region or whole world that is ready from the dashboard.
// A world is ready when every skill of its regions has a module and its friends, chests and finale
// are drawn (src/meta/built.ts): an open world opens its first regions by itself, and a stone whose
// skills have no module would lead nowhere (the round would have no tasks). As the skills and
// drawings land, the worlds become ready by themselves (and are released in RELEASED_WORLDS).
import { REGIONS, WORLDS, WORLD_BY_ID, regionsOfWorld } from '../../../../content/curriculum'
import type { Grade, ProfileDoc, RegionId, SkillId, WorldId } from '../../../../engine/types'
import { DRAWN, regionHasContent, worldReady, type Drawn } from '../../../../meta/built'
import { isRegionOpen, isWorldOpen } from '../../../../meta/unlock'

export { regionHasContent, worldReady, type Drawn }

export const GRADES: readonly Grade[] = [0, 1, 2, 3]

type Unlocked = Pick<ProfileDoc, 'nodes' | 'trials' | 'unlocked'>

export interface Openings {
  worlds: WorldId[]
  regions: RegionId[]
}

/**
 * What a grade opens (a stand-in for the placement): every region of the ready worlds below the
 * child's grade, and the ready worlds up to the child's own grade. Grade 0 opens nothing, and a world
 * that is not ready is never opened.
 */
export function gradeOpenings(grade: Grade, registered: ReadonlySet<SkillId>, drawn: Drawn = DRAWN): Openings {
  const ready = WORLDS.filter((w) => worldReady(w.id, registered, drawn))
  const worlds = ready.filter((w) => w.grade > 0 && w.grade <= grade).map((w) => w.id)
  const regions = REGIONS.filter((r) => WORLD_BY_ID[r.world].grade < grade && ready.some((w) => w.id === r.world)).map((r) => r.id)
  return { worlds, regions }
}

/** Add to profile.unlocked what is not open already (nothing is ever removed). */
export function withOpenings<P extends Unlocked>(p: P, add: Partial<Openings>): P {
  const worlds = (add.worlds ?? []).filter((w) => !p.unlocked.worlds.includes(w) && !isWorldOpen(p, w))
  const regions = (add.regions ?? []).filter((r) => !p.unlocked.regions.includes(r) && !isRegionOpen(p, r))
  if (worlds.length === 0 && regions.length === 0) return p
  return { ...p, unlocked: { worlds: [...p.unlocked.worlds, ...worlds], regions: [...p.unlocked.regions, ...regions] } }
}

/**
 * The child's grade (onboarding, or the dashboard when a child moves up a class or an onboarding was
 * left before the grade). The new grade's openings are added; a lower grade closes nothing.
 */
export function applyGrade<P extends Unlocked & Pick<ProfileDoc, 'grade'>>(p: P, grade: Grade, registered: ReadonlySet<SkillId>, drawn: Drawn = DRAWN): P {
  const graded = p.grade === grade ? p : { ...p, grade }
  return withOpenings(graded, gradeOpenings(grade, registered, drawn))
}

// ─── The dashboard's list ───────────────────────────────────────────────────

export interface RegionRow {
  id: RegionId
  name: string
  open: boolean
  /** Can be opened now: closed, in a ready world. */
  openable: boolean
}

export interface WorldRow {
  id: WorldId
  name: string
  grade: Grade
  open: boolean
  /** Every region has something to play (else: "kommer i en senere version"). */
  ready: boolean
  regions: RegionRow[]
  /** Regions that can be opened now. */
  closed: RegionId[]
}

/** Every world with its regions: open or not, and what a grown-up can open now. */
export function openingRows(p: Unlocked, registered: ReadonlySet<SkillId>, drawn: Drawn = DRAWN): WorldRow[] {
  return WORLDS.map((w) => {
    const ready = worldReady(w.id, registered, drawn)
    const regions = regionsOfWorld(w.id).map((r) => {
      const open = isRegionOpen(p, r.id)
      return { id: r.id, name: r.name, open, openable: ready && !open }
    })
    return {
      id: w.id,
      name: w.name,
      grade: w.grade,
      open: isWorldOpen(p, w.id),
      ready,
      regions,
      closed: regions.filter((r) => r.openable).map((r) => r.id),
    }
  })
}

/**
 * Open one region. Its world opens with it (the map shows one open world at a time, so a region in a
 * closed world could not be reached); the world's own first regions then open by the usual rule.
 */
export function regionOpenings(region: RegionId, registered: ReadonlySet<SkillId>, drawn: Drawn = DRAWN): Openings {
  const def = REGIONS.find((r) => r.id === region)
  if (!def || !worldReady(def.world, registered, drawn)) return { worlds: [], regions: [] }
  return { worlds: [def.world], regions: [region] }
}

/** Open a whole ready world: the world itself and every region in it. */
export function worldOpenings(world: WorldId, registered: ReadonlySet<SkillId>, drawn: Drawn = DRAWN): Openings {
  if (!worldReady(world, registered, drawn)) return { worlds: [], regions: [] }
  return { worlds: [world], regions: regionsOfWorld(world).map((r) => r.id) }
}
