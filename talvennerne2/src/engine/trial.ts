import type {
  FirstTry, LearningEvent, MasteryKey, NodeProgress, ProfileDoc, RegionId, Task, TaskKind, TrialState, WorldId,
} from './types'
import { REGIONS, TRIAL_PASS, nodesOfRegion, type NodeDef } from '../content/curriculum'
import { keysForNode, newBuildSession, type KeyContext } from './registry'
import type { KeyOption } from './roundBuilder'
import { isProduction } from './kinds'
import { makeRng, type Rng } from './rng'

/**
 * Mastery trials and world finales (SPEC §5.4–5.5). A trial is ten typed answers spread evenly over
 * the region's skills and families — no scaffold, no second chance inside the trial, no clock — and
 * it passes at 8. Every right first try lays a plank; eight planks hold the bridge. A failed trial
 * costs nothing: the best result is kept, a normal round opens the next attempt, the training hut
 * offers the missed families, and after three attempts the help bridge opens the way on regardless.
 */

/** Failed attempts before the help bridge opens. */
export const HELP_BRIDGE_AFTER = 3

export interface TrialContext extends Omit<KeyContext, 'mode' | 'houseKind'> {
  seed: number
}

type Tree = { kids: Tree[] } | { leaf: KeyOption[] }

const isProcedureKey = (k: KeyOption) => k.key === `${k.skill}/${k.family}`

function capacity(t: Tree): number {
  if ('leaf' in t) return t.leaf.some(isProcedureKey) ? Number.POSITIVE_INFINITY : t.leaf.length
  return t.kids.reduce((sum, k) => sum + capacity(k), 0)
}

/**
 * Never the same key twice in a row: take the key with the most left (ties in dealt order) that is
 * not the one just asked. This always succeeds when any order can.
 */
function spreadKeys(dealt: readonly KeyOption[]): KeyOption[] {
  const left = [...dealt]
  const out: KeyOption[] = []
  while (left.length > 0) {
    const prev = out[out.length - 1]?.key
    const count = (key: string) => left.filter((k) => k.key === key).length
    let best = -1
    for (let i = 0; i < left.length; i++) {
      if (left[i].key === prev) continue
      if (best < 0 || count(left[i].key) > count(left[best].key)) best = i
    }
    out.push(left.splice(Math.max(0, best), 1)[0])
  }
  return out
}

function groupBy<T>(items: readonly T[], by: (x: T) => string): T[][] {
  const out = new Map<string, T[]>()
  for (const x of items) {
    const k = by(x)
    const g = out.get(k)
    if (g) g.push(x)
    else out.set(k, [x])
  }
  return [...out.values()]
}

/** Even split over the branches in a random order, skipping full branches while others have room. */
function sample(t: Tree, n: number, rng: Rng): KeyOption[] {
  if ('leaf' in t) {
    const dealt = rng.shuffle(t.leaf)
    return Array.from({ length: n }, (_, i) => dealt[i % dealt.length])
  }
  const kids = rng.shuffle(t.kids)
  const room = kids.map(capacity)
  const counts = kids.map(() => 0)
  for (let i = 0, k = 0; i < n; i++) {
    let tries = 0
    while (counts[k % kids.length] >= room[k % kids.length] && tries++ < kids.length) k++
    counts[k % kids.length]++
    k++
  }
  return kids.flatMap((kid, i) => (counts[i] > 0 ? sample(kid, counts[i], rng) : []))
}

/** The region a finale key comes from (the first region of the world that lists its skill). */
function regionOf(key: KeyOption, world: string): string {
  return REGIONS.find((r) => r.world === world && r.skills.some((s) => s.skill === key.skill && !s.reviewOnly))?.id ?? key.skill
}

/**
 * The trial's tasks: production only, stratified over skills and then families (a finale first
 * over its regions). The same key never comes twice in a row.
 */
export function trialTasks(node: NodeDef, ctx: TrialContext): Task[] {
  const finale = node.slot === 'finale'
  const size = finale ? TRIAL_PASS.finale.size : TRIAL_PASS.trial.size
  const rng = makeRng(ctx.seed)
  const session = ctx.session ?? newBuildSession()
  const keys = keysForNode({ skills: node.skills, houseKind: null }, { ...ctx, session, mode: finale ? 'finale' : 'trial' })
    .filter((k) => !k.reviewOnly && k.production.length > 0)
  if (keys.length === 0) return []

  const bySkill = (ks: readonly KeyOption[]): Tree => ({
    kids: groupBy(ks, (k) => k.skill).map((skillKeys) => ({ kids: groupBy(skillKeys, (k) => k.family ?? k.key).map((leaf) => ({ leaf })) })),
  })
  const tree: Tree = finale ? { kids: groupBy(keys, (k) => regionOf(k, node.world)).map(bySkill) } : bySkill(keys)
  const chosen = spreadKeys(rng.shuffle(sample(tree, size, rng)))

  return chosen.map((k, i) => {
    let task: Task | null = null
    for (const kind of rng.shuffle(k.production) as TaskKind[]) {
      task = k.build(kind, rng, i)
      if (isProduction(task)) break
    }
    return task!
  })
}

export interface TrialOutcome {
  /** Right first tries (= planks laid). */
  score: number
  total: number
  passed: boolean
  perfect: boolean
  /** Bestået 1, at most one mistake 2, none 3 (SPEC §5.5); 0 when not passed. */
  stars: 0 | 1 | 2 | 3
  /** Keys answered wrong: the training hut's round. */
  missed: MasteryKey[]
}

export function trialOutcome(firstTries: readonly FirstTry[], mode: 'trial' | 'finale'): TrialOutcome {
  const score = firstTries.filter((f) => f.correct).length
  const total = firstTries.length
  const mistakes = total - score
  const passed = score >= TRIAL_PASS[mode].pass
  const stars = !passed ? 0 : mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1
  const missed = [...new Set(firstTries.filter((f) => !f.correct).map((f) => f.key))]
  return { score, total, passed, perfect: passed && mistakes === 0, stars, missed }
}

/**
 * Record an attempt. `roundIndex` is profile.roundIndex the trial was played at; planks are not
 * kept between attempts, only the best score ("Bedst: 7 planker").
 */
export function nextTrialState(prev: TrialState | undefined, outcome: TrialOutcome, roundIndex: number, now: number): TrialState {
  const s = prev ?? { attempts: 0, failed: 0, best: 0, passedAt: null, lastAttemptRound: -999 }
  return {
    attempts: s.attempts + 1,
    failed: s.failed + (outcome.passed ? 0 : 1),
    best: Math.max(s.best, outcome.score),
    passedAt: s.passedAt ?? (outcome.passed ? now : null),
    lastAttemptRound: roundIndex,
  }
}

/**
 * A new attempt needs one normal round since the last one. Every finished round — the trial itself
 * included — moves profile.roundIndex on by one, so that is two steps after the attempt.
 */
export function canAttemptTrial(state: TrialState | undefined, roundIndex: number): boolean {
  if (!state || state.attempts === 0) return true
  return roundIndex - state.lastAttemptRound >= 2
}

/** After three failed attempts the rope bridge opens the way on, whatever the score. */
export function helpBridgeOpen(state: TrialState | undefined): boolean {
  return !!state && state.passedAt === null && state.failed >= HELP_BRIDGE_AFTER
}

/**
 * "Spring over": a trial passed from the region's start marks the lessons not yet played as
 * skipped. Friend and chest nodes stay as they are, so the animal and the chest can still be fetched.
 */
export function skipRegionNodes(nodes: ProfileDoc['nodes'], region: RegionId, now: number): ProfileDoc['nodes'] {
  const out = { ...nodes }
  for (const n of nodesOfRegion(region)) {
    if (n.slot !== 'l1' && n.slot !== 'l2' && n.slot !== 'l3' && n.slot !== 'mix') continue
    const prev: NodeProgress | undefined = out[n.id]
    if (prev && prev.plays > 0) continue
    out[n.id] = { plays: 0, stars: 0, lastAt: now, ...prev, skipped: true }
  }
  return out
}

export function trialEvents(trial: RegionId | WorldId, outcome: TrialOutcome): LearningEvent[] {
  return outcome.passed ? [{ t: 'trialPassed', trial, score: outcome.score, perfect: outcome.perfect }] : []
}
