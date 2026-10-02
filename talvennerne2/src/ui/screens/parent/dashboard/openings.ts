// The grade and what a grown-up opens on the map (SPEC §8, §9.1 point 12, review P2-10). Places are
// opened through profile.unlocked, the parent's and the placement's way in (src/meta/unlock.ts):
// nothing here is a rule of its own, it only adds to that list — and never takes anything away.
//
// Until the placement exists, every child starts in Engdalen. The grade still matters:
//   - a child in 1.–3. class gets every place of the worlds below its grade opened, and its own
//     world when that has something to play (gradeOpenings);
//   - a grown-up can open any world or region with something to play from the dashboard.
// A world or region whose skills have no module in the registry yet is never opened: its stones
// would lead nowhere. As skills are registered, those places become openable by themselves.
import { REGIONS, WORLDS, WORLD_BY_ID, regionsOfWorld, type RegionDef } from '../../../../content/curriculum'
import type { Grade, ProfileDoc, RegionId, SkillId, WorldId } from '../../../../engine/types'
import { isRegionOpen, isWorldOpen } from '../../../../meta/unlock'

export const GRADES: readonly Grade[] = [0, 1, 2, 3]

type Unlocked = Pick<ProfileDoc, 'nodes' | 'trials' | 'unlocked'>

/** Something to play: one of the region's own skills (not only its reviews) is registered. */
export function regionHasContent(region: RegionDef, registered: ReadonlySet<SkillId>): boolean {
  return region.skills.some((s) => !s.reviewOnly && registered.has(s.skill))
}

export function worldHasContent(world: WorldId, registered: ReadonlySet<SkillId>): boolean {
  return regionsOfWorld(world).some((r) => regionHasContent(r, registered))
}

export interface Openings {
  worlds: WorldId[]
  regions: RegionId[]
}

/**
 * What a grade opens (a stand-in for the placement): every region with something to play in the
 * worlds below the child's grade, and the worlds up to the child's own grade that have something to
 * play. Grade 0 opens nothing; so does a grade whose worlds are still empty.
 */
export function gradeOpenings(grade: Grade, registered: ReadonlySet<SkillId>): Openings {
  const worlds = WORLDS.filter((w) => w.grade > 0 && w.grade <= grade && worldHasContent(w.id, registered)).map((w) => w.id)
  const regions = REGIONS.filter((r) => WORLD_BY_ID[r.world].grade < grade && regionHasContent(r, registered)).map((r) => r.id)
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
export function applyGrade<P extends Unlocked & Pick<ProfileDoc, 'grade'>>(p: P, grade: Grade, registered: ReadonlySet<SkillId>): P {
  const graded = p.grade === grade ? p : { ...p, grade }
  return withOpenings(graded, gradeOpenings(grade, registered))
}

// ─── The dashboard's list ───────────────────────────────────────────────────

export interface RegionRow {
  id: RegionId
  name: string
  open: boolean
  /** Can be opened now: closed, and something to play there. */
  openable: boolean
}

export interface WorldRow {
  id: WorldId
  name: string
  grade: Grade
  open: boolean
  /** Something to play in the world (else: "kommer senere"). */
  ready: boolean
  regions: RegionRow[]
  /** Regions that can be opened now. */
  closed: RegionId[]
}

/** Every world with its regions: open or not, and what a grown-up can open now. */
export function openingRows(p: Unlocked, registered: ReadonlySet<SkillId>): WorldRow[] {
  return WORLDS.map((w) => {
    const ready = worldHasContent(w.id, registered)
    const regions = regionsOfWorld(w.id).map((r) => {
      const open = isRegionOpen(p, r.id)
      return { id: r.id, name: r.name, open, openable: !open && regionHasContent(r, registered) }
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
export function regionOpenings(region: RegionId, registered: ReadonlySet<SkillId>): Openings {
  const def = REGIONS.find((r) => r.id === region)
  if (!def || !regionHasContent(def, registered)) return { worlds: [], regions: [] }
  return { worlds: [def.world], regions: [region] }
}

/** Open a whole world: the world itself and every region in it with something to play. */
export function worldOpenings(world: WorldId, registered: ReadonlySet<SkillId>): Openings {
  if (!worldHasContent(world, registered)) return { worlds: [], regions: [] }
  return {
    worlds: [world],
    regions: regionsOfWorld(world).filter((r) => regionHasContent(r, registered)).map((r) => r.id),
  }
}
