import type { Fact, KeyState, MasteryKey, NodeId, ProfileDoc, RegionId, RoundMode, SkillId, Task } from './types'
import { NODE_BY_ID, REGIONS, REGION_BY_ID, nodesOfRegion, type NodeDef, type RegionDef, type RegionSkill } from '../content/curriculum'
import { SKILL_BY_ID } from '../content/skills'
import {
  factsOf, goldenTask, keyInfo, keysForNode, keysForSkills, newBuildSession, skillRegistry,
  type BuildSession, type SkillRegistry,
} from './registry'
import { buildRound, newCapsFor, slotPlan, type KeyOption, type RoundTone, type SlotPlan } from './roundBuilder'
import { flaggedIds } from './misconceptions'
import { trialTasks } from './trial'
import { hashSeed, makeRng, type Rng } from './rng'

/**
 * Round plans for useRound.start (SPEC §5.3–5.4): a map node, Blandet øvelse (due keys from every
 * skill the child has started), the Træningshytte (the families missed in a failed trial) and the
 * mastery trials. A plan is a pure function of the profile and a seed, so the same round can be
 * rebuilt in a test from its roundId.
 */

export interface PlanContext {
  /** Defaults to the registered skills. */
  skills?: SkillRegistry
  /** Learning day of now. */
  day: string
  sessionId: string
  roundId?: string
  /** Defaults to a hash of profile id, node and roundIndex. */
  seed?: number
  /** The sound check passed: without it hear* skills are left out. */
  audioVerified: boolean
  /**
   * Answered right and quickly, parallel to profile.recentFirstTries (which holds right/wrong
   * only). The warm round needs ten quick right answers; without this, ten right answers do.
   */
  recentFast?: readonly boolean[]
  /** Træningshytte: the keys missed in the region's last failed trial (TrialOutcome.missed). */
  hutKeys?: readonly MasteryKey[]
  /** Træningshytte: the region whose trial failed. */
  hutRegion?: RegionId
}

export interface PlannedRound {
  roundId: string
  sessionId: string
  mode: RoundMode
  nodeId: NodeId | 'practice' | 'hut'
  seed: number
  tasks: Task[]
  /** Keys asked for the first time: fold them into profile.newToday with bumpNewToday. */
  newKeys: { key: MasteryKey; skill: SkillId }[]
}

/** Fatigue: under 50 % right first tries over the last 10. Warm: the last 10 all right (and quick). */
export function roundTone(recent: readonly boolean[], recentFast?: readonly boolean[]): RoundTone {
  const last = recent.slice(-10)
  if (last.length < 10) return 'normal'
  if (last.filter(Boolean).length < 5) return 'fatigue'
  const fast = recentFast?.slice(-10)
  if (last.every(Boolean) && (!fast || (fast.length === 10 && fast.every(Boolean)))) return 'warm'
  return 'normal'
}

const seenOrSeeded = (s: KeyState | undefined) => !!s && (s.seen > 0 || s.seeded)

export function planRound(node: NodeDef | 'practice' | 'hut', profile: ProfileDoc, ctx: PlanContext): PlannedRound {
  const reg = ctx.skills ?? skillRegistry()
  const nodeId = typeof node === 'string' ? node : node.id
  const seed = ctx.seed ?? hashSeed(`${profile.id}:${nodeId}:${profile.roundIndex}`)
  const roundId = ctx.roundId ?? `${profile.id}:${profile.roundIndex}:${nodeId}`
  // The plan rotates the diagnostic card on a private copy of profile.offeredTags, so several card
  // tasks in one round do not all aim at the same misconception. The profile's own count is kept by
  // the data layer when an answer is recorded (offeredTagsOf); a plan never writes it.
  const session = newBuildSession(profile.offeredTags)
  const env: Env = { reg, session, profile, ctx, rng: makeRng(seed) }

  let mode: RoundMode
  let tasks: Task[]
  if (node === 'practice') {
    mode = 'practice'
    tasks = practiceTasks(env)
  } else if (node === 'hut') {
    mode = 'hut'
    tasks = hutTasks(env)
  } else if (node.slot === 'trial' || node.slot === 'finale') {
    mode = node.slot === 'finale' ? 'finale' : 'trial'
    tasks = trialTasks(node, { skills: reg, states: profile.keys, audioVerified: ctx.audioVerified, session, seed })
  } else {
    mode = 'round'
    tasks = nodeTasks(node, env)
  }

  const newKeys: PlannedRound['newKeys'] = []
  const seenKeys = new Set<MasteryKey>()
  for (const t of tasks) {
    if (seenKeys.has(t.masteryKey)) continue
    seenKeys.add(t.masteryKey)
    if (!seenOrSeeded(profile.keys[t.masteryKey])) newKeys.push({ key: t.masteryKey, skill: t.skill })
  }
  return { roundId, sessionId: ctx.sessionId, mode, nodeId, seed, tasks, newKeys }
}

interface Env {
  reg: SkillRegistry
  session: BuildSession
  profile: ProfileDoc
  ctx: PlanContext
  rng: Rng
}

const keyCtx = (env: Env) => ({ skills: env.reg, states: env.profile.keys, audioVerified: env.ctx.audioVerified, session: env.session, mode: 'round' as const })

const answerCache = new WeakMap<SkillRegistry, Map<string, Fact['answer']>>()

/**
 * Recall keys carry their fact's answer, so the round builder can spread a round over different
 * numbers (review r1 P2-11). A family key (`skill/family`) has no single answer and is left as it is.
 */
export function withAnswers(keys: readonly KeyOption[], reg: SkillRegistry): KeyOption[] {
  let answers = answerCache.get(reg)
  if (!answers) {
    answers = new Map()
    for (const def of reg.all) if (def.mode === 'recall') for (const f of factsOf(def)) answers.set(f.id, f.answer)
    answerCache.set(reg, answers)
  }
  return keys.map((k) => {
    const answer = k.key.includes('/') ? undefined : answers.get(k.key)
    return answer === undefined ? k : { ...k, answer }
  })
}

function nodeTasks(node: NodeDef, env: Env): Task[] {
  const { profile, ctx } = env
  const tone = roundTone(profile.recentFirstTries, ctx.recentFast)
  const started = startedKeys(node.skills, env)
  const region = node.region ? REGION_BY_ID[node.region] : undefined
  return buildRound({
    keys: withAnswers(keysForNode(node, keyCtx(env)), env.reg),
    states: profile.keys,
    roundIndex: profile.roundIndex,
    day: ctx.day,
    size: node.size,
    rng: env.rng,
    production: node.production,
    slots: slotPlan(node.size, tone, node.review > 0 ? node.review : 1),
    tone,
    reviewKeys: withAnswers(started.filter((k) => (profile.keys[k.key]?.box ?? 0) >= 3), env.reg),
    // with today's allowance used up, the round is filled from the region, the chain, then review
    // (roundBuilder: CAPPED_REPEAT_MAX, UI-fund 10 and 16)
    regionKeys: region ? withAnswers(onKeys(region.skills, env), env.reg) : [],
    chainKeys: region ? withAnswers(onKeys(chainSkills(region), env), env.reg) : [],
    startedKeys: withAnswers(started, env.reg),
    flagged: flaggedIds(profile.misconceptions),
    newCaps: newCapsFor(profile.newToday, ctx.day),
  })
}

/** The skills of the other regions in the region's chain (Urtårnet before Urtårnets top …). */
function chainSkills(region: RegionDef): RegionSkill[] {
  return REGIONS.filter((r) => r.chain === region.chain && r.id !== region.id).flatMap((r) => r.skills)
}

/** The keys of these skills (with their families), minus the domains a parent turned off. */
function onKeys(skills: readonly RegionSkill[], env: Env): KeyOption[] {
  const off = new Set(env.profile.settings.domainsOff)
  return keysForSkills(skills.filter((s) => !off.has(SKILL_BY_ID[s.skill].domain)), keyCtx(env))
}

/** Skills the child has started (a key answered or seeded), minus the domains a parent turned off. */
function startedSkills(env: Env, exclude: ReadonlySet<SkillId> = new Set()): SkillId[] {
  const off = new Set(env.profile.settings.domainsOff)
  const out = new Set<SkillId>()
  for (const key of Object.keys(env.profile.keys)) {
    if (!seenOrSeeded(env.profile.keys[key])) continue
    const info = keyInfo(key, env.reg)
    if (!info || exclude.has(info.skill) || off.has(SKILL_BY_ID[info.skill].domain)) continue
    out.add(info.skill)
  }
  return [...out].sort()
}

/** Keys of the other skills the child has started: the sure ones are the review slot's. */
function startedKeys(nodeSkills: readonly RegionSkill[], env: Env): KeyOption[] {
  const inNode = new Set(nodeSkills.filter((s) => !s.reviewOnly).map((s) => s.skill))
  const skills = startedSkills(env, inNode)
  return keysForSkills(skills.map((skill) => ({ skill })), keyCtx(env))
}

const practicePlan = (size: number, tone: RoundTone): SlotPlan =>
  tone === 'fatigue'
    ? { secure: Math.round(size * 0.4), shaky: size - Math.round(size * 0.4), fresh: 0, review: 0, targeted: 0 }
    : { secure: 3, shaky: size - 4, fresh: 0, review: 0, targeted: 1 }

/** Blandet øvelse: due keys from every started skill, nothing new; a new child gets Tællelunden. */
function practiceTasks(env: Env): Task[] {
  const { profile, ctx } = env
  const size = 10
  const keys = withAnswers(keysForSkills(startedSkills(env).map((skill) => ({ skill })), keyCtx(env))
    .filter((k) => seenOrSeeded(profile.keys[k.key])), env.reg)
  if (keys.length === 0) {
    const first = NODE_BY_ID['w0-tal10-l1']
    return first ? nodeTasks(first, env) : []
  }
  const tone = roundTone(profile.recentFirstTries, ctx.recentFast)
  return buildRound({
    keys, states: profile.keys, roundIndex: profile.roundIndex, day: ctx.day, size, rng: env.rng,
    slots: practicePlan(size, tone), tone, flagged: flaggedIds(profile.misconceptions), newCaps: { total: 0, perSkill: {} },
  })
}

/** Træningshytte: the missed families first, the rest of the region's known keys around them. */
function hutTasks(env: Env): Task[] {
  const { profile, ctx } = env
  const region = ctx.hutRegion ? REGION_BY_ID[ctx.hutRegion] : undefined
  const trial = region ? nodesOfRegion(region.id).find((n) => n.slot === 'trial') : undefined
  if (!region || !trial) return practiceTasks(env)
  const size = region.roundSize
  return buildRound({
    keys: withAnswers(keysForNode({ skills: trial.skills, houseKind: null }, keyCtx(env)), env.reg),
    states: profile.keys, roundIndex: profile.roundIndex, day: ctx.day, size, rng: env.rng,
    slots: { secure: 1, shaky: size - 1, fresh: 0, review: 0, targeted: 0 },
    focus: new Set(ctx.hutKeys ?? []), newCaps: { total: 0, perSkill: {} },
  })
}

/**
 * The golden-egg hook for useRound: a harder fact on cards from the plan's node, or — for practice
 * and the hut — from the skills the plan asks.
 */
export function goldenFor(plan: Pick<PlannedRound, 'roundId' | 'nodeId' | 'tasks'>, profile: ProfileDoc, ctx: Pick<PlanContext, 'skills' | 'audioVerified'>): Task | null {
  const node = NODE_BY_ID[plan.nodeId]
  const skills = node ? node.skills : [...new Set(plan.tasks.map((t) => t.skill))].map((skill) => ({ skill }))
  return goldenTask({ skills, houseKind: null }, {
    skills: ctx.skills, states: profile.keys, audioVerified: ctx.audioVerified, seed: hashSeed(`${plan.roundId}:golden`),
  })
}

/** profile.newToday after a plan introduced `newKeys` (a new learning day starts from zero). */
export function bumpNewToday(newToday: ProfileDoc['newToday'], day: string, newKeys: readonly { skill: SkillId }[]): ProfileDoc['newToday'] {
  const base = newToday.day === day ? newToday : { day, total: 0, perSkill: {} }
  const perSkill = { ...base.perSkill }
  for (const k of newKeys) perSkill[k.skill] = (perSkill[k.skill] ?? 0) + 1
  return { day, total: base.total + newKeys.length, perSkill }
}
