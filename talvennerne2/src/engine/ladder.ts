// The placement's ladder as data (SPEC §8, A24): its fourteen rungs, how far a result reaches, the
// regions the seeding passes over and where a placed child starts. Kept apart from placement.ts (the
// questions and the seeding), so the map and the goals can follow a placement without loading the
// ladder's question code: this file reads only the content tables.
import { REGIONS } from '../content/curriculum'
import { SKILL_BY_ID } from '../content/skills'
import type { PlacementState, RegionId, SkillId, TaskKind, WorldId } from './types'

export interface Checkpoint { id: string; skill: SkillId; kind: TaskKind }

export const LADDER: readonly Checkpoint[] = [
  { id: 'L1', skill: 'count10', kind: 'countTap' },
  { id: 'L2', skill: 'hear20', kind: 'keypad' },
  { id: 'L3', skill: 'addTo10', kind: 'keypad' },
  { id: 'L4', skill: 'subTo10', kind: 'keypad' },
  { id: 'L5', skill: 'addTo20', kind: 'keypad' },
  { id: 'L6', skill: 'subTo20', kind: 'keypad' },
  { id: 'L7', skill: 'hear100', kind: 'keypad' },
  { id: 'L8', skill: 'tensOnes', kind: 'keypad' },
  { id: 'L9', skill: 'add100Carry', kind: 'keypad' },
  { id: 'L10', skill: 'sub100Borrow', kind: 'keypad' },
  { id: 'L11', skill: 'hear1000', kind: 'keypad' },
  { id: 'L12', skill: 'mul2510', kind: 'keypad' },
  { id: 'L13', skill: 'add1000', kind: 'keypad' },
  { id: 'L14', skill: 'mul6to9', kind: 'keypad' },
]

export const CHECKPOINT: Readonly<Record<string, Checkpoint>> = Object.fromEntries(LADDER.map((c) => [c.id, c]))

export const stageOf = (checkpoint: string): number => SKILL_BY_ID[CHECKPOINT[checkpoint].skill].stage

/**
 * How far seeding reaches from P: the highest stage of the rungs up to P. The ladder climbs by
 * difficulty, and its stages are not in that order (hear100 at L7 is stage 1.2, addTo20 at L5 is
 * 1.4), so a child placed at L7 or L8 has shown L5 too, and a rung the jump left out counts as passed.
 */
export function seedStage(checkpoint: string): number {
  const i = LADDER.findIndex((c) => c.id === checkpoint)
  return Math.max(...LADDER.slice(0, i + 1).map((c) => SKILL_BY_ID[c.skill].stage))
}

/** The skills of the rungs the child did not pass (placement.failed): never seeded, never passed over. */
export const failedSkills = (failed: readonly string[] = []): Set<SkillId> =>
  new Set(failed.filter((id) => CHECKPOINT[id]).map((id) => CHECKPOINT[id].skill))

/**
 * The regions the seeding passes over from P (SPEC A24): regions of the chain `tal` only, since the
 * ladder asks about numbers and sums alone (shapes, clocks, money and measures are learned as
 * normal), whose skills all lie below seedStage(P), none of them the skill of a rung the child did
 * not pass (`failed`). None without P.
 */
export function passedOver(P: string | null, failed: readonly string[] = []): RegionId[] {
  if (!P || !CHECKPOINT[P]) return []
  const stage = seedStage(P)
  const missed = failedSkills(failed)
  return REGIONS.filter((r) => r.chain === 'tal' && r.skills.every((s) => SKILL_BY_ID[s.skill].stage < stage && !missed.has(s.skill)))
    .map((r) => r.id)
}

export interface PlacedStart {
  /** The first region of the chain `tal` the placement did not pass over: the first round starts there. */
  region: RegionId
  /** Its world: the child's home world until it is complete. */
  world: WorldId
  /** The regions passed over: the map suggests their friend, chest and trial last. */
  over: ReadonlySet<RegionId>
}

/**
 * Where a finished placement put the child (SPEC A24, review app-w3-r1 P2-4, QA3b). Null without
 * one: a child who skipped the ladder, said "Det er nok" before passing a rung, or was never offered
 * it (0.–2. klasse) is placed by the grade as before. A ladder that ended by itself with no rung
 * passed passes nothing over, so that child starts in Tællelunden.
 */
export function placedStart(placement: PlacementState | undefined): PlacedStart | null {
  if (!placement?.done) return null
  const over = new Set(passedOver(placement.highest, placement.failed))
  const first = REGIONS.find((r) => r.chain === 'tal' && !over.has(r.id))
  return first ? { region: first.id, world: first.world, over } : null
}

/**
 * How soon a placed child is led to a region (the map's next stone, the goals): 0 the start, 1 a
 * region not passed over, 2 one passed over (its friend, chest and trial still wait).
 */
export const placedRank = (placed: PlacedStart, region: RegionId): number =>
  region === placed.region ? 0 : placed.over.has(region) ? 2 : 1
