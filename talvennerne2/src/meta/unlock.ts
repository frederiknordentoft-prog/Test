// What is open on the map (SPEC §5.3). Pure functions of the profile: nothing here is stored, so the
// map can never disagree with the rules, and a parent's or the placement's opening (profile.unlocked)
// is simply one more way in.
//
// - A node opens when the node before it in the region has been played once (skipped counts).
// - A region opens when its world is open, every `requires` is met (trial passed, the help bridge
//   after three failed attempts, or opened by a parent/placement), and it is one of the world's first
//   two regions or another region of the world has four played nodes.
// - The next world opens when 60 % of this world's trials are passed or all its nodes are played.
// - Blandet øvelse is always open; the training hut lights up after a failed trial.
//
// `requires` always points into the region's own chain (curriculum test), and nothing else here looks
// at a trial, so a trial in one chain never keeps a region of another chain closed.
import {
  NODE_BY_ID, REGION_BY_ID, REGIONS, WORLD_BY_ID, nodesOfRegion, regionsOfWorld, type RegionDef,
} from '../content/curriculum'
import {
  WORLD_IDS,
  type Medal, type NodeId, type ProfileDoc, type RegionId, type SkillId, type WorldId,
} from '../engine/types'
import { canAttemptTrial, helpBridgeOpen } from '../engine/trial'
import type { RegionTier } from './rewards'

type P = Pick<ProfileDoc, 'nodes' | 'trials' | 'unlocked'>

/** Share of a world's region trials that must be passed before the next world opens. */
export const WORLD_TRIAL_SHARE = 0.6
/** Played nodes in one region that open the rest of the world's regions. */
export const SIBLING_NODES = 4
/** Regions open from the start of their world (in curriculum order). */
export const OPEN_REGIONS_PER_WORLD = 2

/** Played once — or skipped by passing the region's trial from its start (or by placement). */
export function nodeDone(p: Pick<ProfileDoc, 'nodes'>, id: NodeId): boolean {
  const n = p.nodes[id]
  return !!n && (n.plays > 0 || n.skipped)
}

/** Nodes of a region that have been played (or skipped). */
export function playedNodes(p: Pick<ProfileDoc, 'nodes'>, region: RegionId): number {
  return nodesOfRegion(region).filter((n) => nodeDone(p, n.id)).length
}

export function trialPassed(p: Pick<ProfileDoc, 'trials'>, id: RegionId | WorldId): boolean {
  return (p.trials[id]?.passedAt ?? null) !== null
}

/** A `requires` entry is met by the passed trial, the help bridge, or a parent/placement opening. */
export function requirementMet(p: P, region: RegionId): boolean {
  return trialPassed(p, region) || helpBridgeOpen(p.trials[region]) || p.unlocked.regions.includes(region)
}

/** Passed region trials in a world, as a share of its regions. */
export function worldTrialShare(p: Pick<ProfileDoc, 'trials'>, world: WorldId): number {
  const regions = WORLD_BY_ID[world].regions
  if (regions.length === 0) return 0
  return regions.filter((r) => trialPassed(p, r)).length / regions.length
}

/** All region nodes of the world played once (the finale is the world's party, not a step). */
export function allWorldNodesDone(p: Pick<ProfileDoc, 'nodes'>, world: WorldId): boolean {
  return WORLD_BY_ID[world].regions.every((r) => nodesOfRegion(r).every((n) => nodeDone(p, n.id)))
}

/** The world has done enough for the next world (and its own finale) to open. */
export function worldComplete(p: P, world: WorldId): boolean {
  return worldTrialShare(p, world) >= WORLD_TRIAL_SHARE - 1e-9 || allWorldNodesDone(p, world)
}

export function isWorldOpen(p: P, world: WorldId): boolean {
  const i = WORLD_IDS.indexOf(world)
  if (i <= 0 || p.unlocked.worlds.includes(world)) return true
  const prev = WORLD_IDS[i - 1]
  return isWorldOpen(p, prev) && worldComplete(p, prev)
}

/** The region's own rule, as if its world were open (the chain test looks at exactly this). */
export function regionOpenInWorld(p: P, region: RegionDef): boolean {
  if (p.unlocked.regions.includes(region.id)) return true
  if (!region.requires.every((r) => requirementMet(p, r))) return false
  if (region.index <= OPEN_REGIONS_PER_WORLD) return true
  return regionsOfWorld(region.world).some((r) => r.id !== region.id && playedNodes(p, r.id) >= SIBLING_NODES)
}

export function isRegionOpen(p: P, region: RegionId): boolean {
  const def = REGION_BY_ID[region]
  if (!def) return false
  if (p.unlocked.regions.includes(region)) return true
  return isWorldOpen(p, def.world) && regionOpenInWorld(p, def)
}

/** The world finale opens when the world is complete enough to open the next one. */
export function isFinaleOpen(p: P, world: WorldId): boolean {
  return isWorldOpen(p, world) && worldComplete(p, world)
}

/**
 * A map node is open: the first lesson when its region is, every later node when the one before it
 * is done. The trial can always be tried from the region's start ("Spring over"); whether a retry is
 * allowed yet is trialReady().
 */
export function isNodeOpen(p: P, id: NodeId): boolean {
  const def = NODE_BY_ID[id]
  if (!def) return false
  if (def.slot === 'finale') return isFinaleOpen(p, def.world)
  if (!def.region || !isRegionOpen(p, def.region)) return false
  const nodes = nodesOfRegion(def.region)
  const i = nodes.findIndex((n) => n.id === id)
  if (i < 0) return false
  if (i === 0 || nodes[i].slot === 'trial') return true
  return nodeDone(p, nodes[i - 1].id)
}

/** The trial (or finale) can be attempted now: open, not passed, and a normal round since the last try. */
export function trialReady(p: P & Pick<ProfileDoc, 'roundIndex'>, id: RegionId | WorldId): boolean {
  const open = (WORLD_IDS as readonly string[]).includes(id)
    ? isFinaleOpen(p, id as WorldId)
    : isRegionOpen(p, id as RegionId)
  return open && !trialPassed(p, id) && canAttemptTrial(p.trials[id], p.roundIndex)
}

/** Regions whose training hut is lit: a trial failed and not passed since. */
export function hutRegions(p: Pick<ProfileDoc, 'trials'>): RegionId[] {
  return REGIONS.filter((r) => {
    const t = p.trials[r.id]
    return !!t && t.failed > 0 && t.passedAt === null
  }).map((r) => r.id)
}

/** Blandet øvelse is always open (it needs no unlock; listed for the map). */
export const practiceOpen = (): true => true

export interface UnlockView {
  worlds: WorldId[]
  regions: RegionId[]
  nodes: NodeId[]
  finales: WorldId[]
  huts: RegionId[]
  bridges: RegionId[]
}

/** Everything open now, in curriculum order. */
export function unlockView(p: P): UnlockView {
  const worlds = WORLD_IDS.filter((w) => isWorldOpen(p, w))
  const regions = REGIONS.filter((r) => isRegionOpen(p, r.id)).map((r) => r.id)
  const nodes: NodeId[] = []
  for (const r of regions) for (const n of nodesOfRegion(r)) if (isNodeOpen(p, n.id)) nodes.push(n.id)
  const finales = WORLD_IDS.filter((w) => isFinaleOpen(p, w))
  for (const w of finales) nodes.push(`${w}-finale`)
  const bridges = REGIONS.filter((r) => helpBridgeOpen(p.trials[r.id])).map((r) => r.id)
  return { worlds, regions, nodes, finales, huts: hutRegions(p), bridges }
}

/** Worlds and regions open in `after` but not in `before` (the fog that lifts). */
export function newlyOpened(before: UnlockView, after: UnlockView): { worlds: WorldId[]; regions: RegionId[] } {
  return {
    worlds: after.worlds.filter((w) => !before.worlds.includes(w)),
    regions: after.regions.filter((r) => !before.regions.includes(r)),
  }
}

// ─── The region's colour (SPEC §5.6) ───────────────────────────────────────

const TIER_MEDAL: readonly [RegionTier, Medal][] = [['gold', 'gold'], ['silver', 'silver'], ['bronze', 'bronze']]
const MEDAL_RANK: Readonly<Record<Medal, number>> = { bronze: 1, silver: 2, gold: 3 }

/**
 * The highest tier T where at least half of the region's skills have reached T. Medals are used
 * rather than the live status, so colour that has come back never fades again (SPEC §13.11).
 */
export function regionTier(p: Pick<ProfileDoc, 'skillMedals'>, region: RegionId): RegionTier {
  const def = REGION_BY_ID[region]
  if (!def) return 'start'
  const skills = [...new Set(def.skills.filter((s) => !s.reviewOnly).map((s) => s.skill))] as SkillId[]
  if (skills.length === 0) return 'start'
  for (const [tier, medal] of TIER_MEDAL) {
    const reached = skills.filter((s) => {
      const m = p.skillMedals[s]
      return !!m && MEDAL_RANK[m] >= MEDAL_RANK[medal]
    }).length
    if (reached / skills.length >= 0.5) return tier
  }
  return 'start'
}
