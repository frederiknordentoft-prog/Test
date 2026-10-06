// "Vis Pip hvad du kan" in the onboarding (SPEC §8): what the placement does to the stores, apart
// from the screen. The ladder itself is src/engine/placement.ts.
//
//   placementOffered     3. klasse only, every ladder skill registered and Stjernefjeldet built
//                        (worldBuilt: released, or ?worlds=all on a dev server). Otherwise the
//                        onboarding runs as before and everyone starts in Engdalen.
//   beginPlacement       the grade is written first, the way finishOnboarding writes it, so a reload
//                        in the middle of the ladder lands on the map as if it had been skipped
//   answerPlacementTask  one answer: logged as mode 'placement' (it never moves a box), folded into the run
//   endPlacement         "Det er nok" or the last rung: seeds from what was shown (box 2, `seeded`),
//                        writes, and finds the stone the first round starts on
//   skipPlacement        "Spring over": the grade only, nothing seeded, the placement not done
//   firstStone           the map's own next stone in the child's home world (map/model.ts), so the
//                        first round is the stone the map itself would suggest
//   startOnStone         the map, with that round pushed on top as if tapped there (play/flow.ts)
import { useNav } from '../../../../../app/nav'
import { worldBuilt } from '../../../../../meta/built'
import { isCorrect } from '../../../../../engine/answer'
import { ceilingFor, defaultFastMs, isProduction } from '../../../../../engine/kinds'
import { learningDay } from '../../../../../engine/learningDay'
import {
  answerPlacement, placementAvailable, placementResult, placementTask, seedFromPlacement, startPlacement,
  type PlacementRun,
} from '../../../../../engine/placement'
import { skillRegistry, type SkillRegistry } from '../../../../../engine/registry'
import { hashSeed } from '../../../../../engine/rng'
import type { AnswerValue, Grade, NodeId, ProfileDoc, Task, WorldId } from '../../../../../engine/types'
import { useProfile } from '../../../../../state/useProfile'
import { useSession } from '../../../../../state/useSession'
import { homeWorld, mapModel } from '../../map/model'
import { playFromMap } from '../../play/flow'
import { applyOnboardingGrade, firstNode } from '../flow'

/** The only grade the onboarding offers the ladder to (0.–2. klasse start in Engdalen as before). */
export const PLACEMENT_GRADE: Grade = 3

/** What the placement reads from the build; tests hand in their own. */
export interface PlacementEnv {
  /** The ladder's skills (default: the registered ones). */
  skills?: SkillRegistry
  /** Which worlds can be entered (default: worldBuilt). */
  built?: (world: WorldId) => boolean
  now?: () => number
}

/** The ladder is offered: 3. klasse, every ladder skill registered and Stjernefjeldet built. */
export function placementOffered(grade: Grade | null, env: PlacementEnv = {}): boolean {
  if (grade !== PLACEMENT_GRADE) return false
  if (!(env.built ?? worldBuilt)('fjeld')) return false
  return placementAvailable(env.skills ?? skillRegistry())
}

/** A ladder in progress: the run, and the ids its answers are logged under. */
export interface PlacementSession {
  run: PlacementRun
  roundId: string
  sessionId: string
}

/**
 * Write the grade (and its openings), then start the ladder one grade below the child's. Null when
 * there is no child or no ladder for the grade. Without a verified sound the hear* rungs are left out.
 */
export async function beginPlacement(grade: Grade): Promise<PlacementSession | null> {
  await applyOnboardingGrade(grade)
  const { profile, context } = useProfile.getState()
  if (!profile) return null
  const run = startPlacement(grade, hashSeed(`${profile.id}:placement:${profile.roundIndex}`), context.audioVerified)
  if (!run) return null
  return { run, roundId: `${profile.id}:${profile.roundIndex}:placement`, sessionId: context.sessionId }
}

/** The question to ask now, or null when the ladder is over. Pure: a reload would ask it again. */
export function placementQuestion(s: PlacementSession, env: PlacementEnv = {}): Task | null {
  return placementTask(s.run, env.skills ?? skillRegistry())
}

export interface AnswerTiming {
  /** Thinking time: from the end of the reading, without "Hør igen". */
  ms: number
  replays: number
  ts: number
}

/**
 * One answer: logged (mode 'placement': it never moves a box, is never evidence of a misconception
 * and never counts towards the child's recent first tries) and folded into the run.
 */
export function answerPlacementTask(s: PlacementSession, task: Task, given: AnswerValue, t: AnswerTiming): { session: PlacementSession; correct: boolean } {
  const correct = isCorrect(task, given)
  const ms = Math.max(0, Math.round(t.ms))
  useProfile.getState().recordAnswer({
    task, given, correct, ms, fast: ms <= defaultFastMs(task), production: isProduction(task), ceiling: ceilingFor(task),
    mode: 'placement', assisted: false, retryOf: null, replays: t.replays, ts: t.ts,
    roundId: s.roundId, sessionId: s.sessionId, nodeId: 'placement',
  })
  return { session: { ...s, run: answerPlacement(s.run, correct) }, correct }
}

/**
 * The end of the ladder ("Det er nok" or the last rung): what was shown counts. With at least one
 * answer the profile is seeded from the highest passed rung (or only marked done when none passed);
 * with none it is as if the ladder was skipped. Returns the stone the first round starts on.
 */
export async function endPlacement(s: PlacementSession | null, env: PlacementEnv = {}): Promise<NodeId> {
  const store = useProfile.getState()
  if (s && s.run.asked > 0) {
    const now = env.now?.() ?? Date.now()
    const ctx = { day: learningDay(now), now, ...(env.skills ? { skills: env.skills } : {}) }
    store.update((p) => seedFromPlacement(p, placementResult(s.run), ctx))
  }
  await store.flush()
  await useSession.getState().refreshProfiles()
  return firstStone(useProfile.getState().profile, env.built)
}

/** "Spring over": the grade and its openings, nothing seeded. Returns the first round's stone. */
export async function skipPlacement(grade: Grade, env: PlacementEnv = {}): Promise<NodeId> {
  await applyOnboardingGrade(grade)
  return firstStone(useProfile.getState().profile, env.built)
}

/** The next stone the map suggests in the child's home world (Tællelunden when there is none). */
export function firstStone(p: ProfileDoc | null, built: (world: WorldId) => boolean = worldBuilt): NodeId {
  if (!p) return firstNode()
  return mapModel(p, homeWorld(p, built), built).next ?? firstNode()
}

/** The first round on that stone, on top of the map: as if the child had tapped it there. */
export function startOnStone(stone: NodeId): void {
  useNav.getState().root({ id: 'map' })
  playFromMap(stone)
}
