// What a round starts from (SPEC §5.4): the stored round when it is the one asked for, else a new
// plan for the node, Blandet øvelse or the Træningshytte — with the hooks that tie it to the
// profile (answers, snapshots, the golden egg, the skills' speed thresholds) and the statements the
// voice should fetch during the intro. PlayScreen loads this module lazily: it brings the skill
// registry and the round builder, which the first screen never needs.
import { NODE_BY_ID } from '../../../../content/curriculum'
import { learningDay } from '../../../../engine/learningDay'
import { goldenFor, planRound } from '../../../../engine/plan'
import { factsOf, skillRegistry, type SkillRegistry } from '../../../../engine/registry'
import type {
  Fact, ProfileDoc, RegionId, RoundSnapshot, SkillDef, SpeechPart, Task,
} from '../../../../engine/types'
import { factFor } from '../../../hint/hintFor'
import { hutKeysFor } from '../../../../state/useMeta'
import { roundHooks, useProfile } from '../../../../state/useProfile'
import type { RoundHooks, RoundPlan } from '../../../../state/useRound'
import { litHut, playable } from '../map/model'
import type { PlayTarget } from '../map/nodes'

export type Start =
  | { kind: 'resume'; snapshot: RoundSnapshot }
  | { kind: 'plan'; plan: RoundPlan; hutRegion: RegionId | null }
  /** Locked, a trial still resting, no lit hut, or nothing to ask yet: back to the map. */
  | { kind: 'closed' }

export interface StartContext {
  sessionId: string
  audioVerified: boolean
  now: number
  /** The hut asked for (the map's hut button); defaults to the most recently failed trial's. */
  hutRegion?: RegionId | null
  skills?: SkillRegistry
}

/**
 * Resume the stored round when it is the one asked for (the "Fortsæt turen" banner, a reload, or
 * the same stone tapped again); otherwise plan a new round, if the target can be played now.
 */
export function chooseStart(target: PlayTarget, profile: ProfileDoc, ctx: StartContext): Start {
  const stored = profile.round
  if (stored && stored.nodeId === target) return { kind: 'resume', snapshot: stored }
  if (!playable(profile, target, ctx.hutRegion)) return { kind: 'closed' }

  const reg = ctx.skills ?? skillRegistry()
  const hutRegion = target === 'hut' ? litHut(profile, ctx.hutRegion) : null
  const node = target === 'practice' || target === 'hut' ? target : NODE_BY_ID[target]
  if (!node) return { kind: 'closed' }
  const plan = planRound(node, profile, {
    skills: reg,
    day: learningDay(ctx.now),
    sessionId: ctx.sessionId,
    audioVerified: ctx.audioVerified,
    recentFast: profile.recentFast,
    ...(hutRegion ? { hutRegion, hutKeys: hutKeysFor(profile, hutRegion) } : {}),
  })
  if (plan.tasks.length === 0) return { kind: 'closed' }
  // New keys are counted into profile.newToday by the data layer when they are first answered
  // (useProfile.recordAnswer); folding plan.newKeys in here as well would count them twice.
  const { newKeys: _newKeys, ...roundPlan } = plan
  return { kind: 'plan', plan: roundPlan, hutRegion }
}

// ─── Speed thresholds ───────────────────────────────────────────────────────

const factIndex = new WeakMap<SkillDef, Map<string, Fact>>()

function factOf(def: SkillDef, id: string): Fact | undefined {
  let index = factIndex.get(def)
  if (!index) {
    index = new Map(factsOf(def).map((f) => [f.id, f]))
    factIndex.set(def, index)
  }
  return index.get(id)
}

/**
 * The skill's own "fast" threshold for a task (SkillDef.fastMs, else the family's per-kind value);
 * undefined leaves useRound's formula for the kind.
 */
export function fastMsOf(task: Task, reg: SkillRegistry): number | undefined {
  const def = reg.get(task.skill)
  if (!def) return undefined
  if (def.fastMs) {
    // a procedure instance is not among the enumerated facts: rebuilt from the task, as for its hint
    const ms = def.fastMs(factOf(def, task.factId) ?? factFor(def, task), task.kind)
    if (ms !== undefined) return ms
  }
  return def.families.find((f) => f.id === task.family)?.fastMs?.[task.kind]
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/** The round's tasks as far as they are known (the golden egg draws from their skills). */
const planLike = (start: Extract<Start, { kind: 'plan' | 'resume' }>) =>
  start.kind === 'plan'
    ? start.plan
    : {
        roundId: start.snapshot.roundId,
        nodeId: start.snapshot.nodeId,
        tasks: [...(start.snapshot.current ? [start.snapshot.current] : []), ...start.snapshot.queue],
      }

/** roundHooks for this round: the golden egg from the live profile, and the skills' speed thresholds. */
export function hooksFor(start: Extract<Start, { kind: 'plan' | 'resume' }>, ctx: Pick<StartContext, 'audioVerified' | 'skills'>): RoundHooks {
  const reg = ctx.skills ?? skillRegistry()
  const like = planLike(start)
  return roundHooks({
    golden: () => {
      const p = useProfile.getState().profile
      if (!p || like.nodeId === 'placement') return null
      return goldenFor({ roundId: like.roundId, nodeId: like.nodeId, tasks: like.tasks }, p, { skills: reg, audioVerified: ctx.audioVerified })
    },
    fastMs: (task) => fastMsOf(task, reg),
  })
}

/** Everything the round will read aloud that lives outside the always-loaded UI sprite. */
export function roundStatements(start: Extract<Start, { kind: 'plan' | 'resume' }>): SpeechPart[][] {
  const out: SpeechPart[][] = []
  for (const t of planLike(start).tasks) {
    if (t.speech.length > 0) out.push(t.speech)
    for (const clip of t.optionClips ?? []) out.push([{ clip }])
  }
  return out
}
