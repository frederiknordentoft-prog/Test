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

/** The regions the seeding passes over from P: every skill of the region lies below stage(P). None without P. */
export function passedOver(P: string | null): RegionId[] {
  if (!P || !CHECKPOINT[P]) return []
  const stage = seedStage(P)
  return REGIONS.filter((r) => r.skills.every((s) => SKILL_BY_ID[s.skill].stage < stage)).map((r) => r.id)
}

export interface PlacedStart {
  /** The first region (in curriculum order) the placement did not pass over: the first round starts there. */
  region: RegionId
  /** Its world: the world P belongs to, and the child's home world until it is complete. */
  world: WorldId
  /** The regions passed over: the map suggests their friend, chest and trial last. */
  over: ReadonlySet<RegionId>
}

/**
 * Where a finished placement put the child (SPEC A24, review app-w3-r1 P2-4). Null without one: a
 * child who skipped the ladder, stopped before a rung was decided (passed or failed; QA3b), or was
 * never offered it (0.–2. klasse) is placed by the grade as before. A placement that passed no rung
 * passes nothing over, so that child starts in Tællelunden.
 */
export function placedStart(placement: PlacementState | undefined): PlacedStart | null {
  if (!placement?.done) return null
  const over = new Set(passedOver(placement.highest))
  const first = REGIONS.find((r) => !over.has(r.id))
  return first ? { region: first.id, world: first.world, over } : null
}
