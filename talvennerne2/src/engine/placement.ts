import type { Fact, Grade, KeyState, ProfileDoc, RegionId, SkillDef, Task, TaskKind, WorldId } from './types'
import { WORLD_IDS } from './types'
import { SKILL_BY_ID, DOMAIN_BY_ID } from '../content/skills'
import { REGIONS, nodesOfRegion } from '../content/curriculum'
import { CHECKPOINT, LADDER, passedOver, seedStage } from './ladder'
import { factsOf, kindsOf, needsAudio, skillKeys, skillRegistry, type SkillRegistry } from './registry'
import { buildTask } from './tasks'
import { isProduction } from './kinds'
import { emptyKey } from './mastery'
import { hashSeed, makeRng } from './rng'

/**
 * "Vis Pip hvad du kan" (SPEC §8, pædagogik-forslaget §4.2): a short ladder of typed questions that
 * finds roughly where a child in 1.–3. klasse stands, so they do not start with counting to five.
 * It jumps two rungs at a time while the child succeeds, steps back one on the first miss and then
 * climbs one at a time until the next miss. Two questions per rung, both right to pass, never more
 * than 18 questions. What it seeds is deliberately modest: box 2, marked as seeded, so the dashboard
 * never claims more than the child has shown.
 */

// The rungs and how far a result reaches are data the map reads too (ladder.ts).
export { LADDER, passedOver, seedStage, stageOf, type Checkpoint } from './ladder'

export const PLACEMENT_MAX_TASKS = 18
export const TASKS_PER_CHECKPOINT = 2

/** One grade below the child's: 1. kl. starts at L1, 2. kl. at L3, 3. kl. at L5; 0. kl. skips placement. */
export const PLACEMENT_START: Readonly<Record<Grade, string | null>> = { 0: null, 1: 'L1', 2: 'L3', 3: 'L5' }

export interface PlacementRun {
  grade: Grade
  seed: number
  /** Checkpoint ids in play: without verified sound the hear* rungs are left out. */
  ladder: string[]
  /** Index into `ladder` of the current checkpoint. */
  index: number
  phase: 'jump' | 'step'
  /** Answers at the current checkpoint. */
  results: boolean[]
  asked: number
  passed: string[]
  failed: string[]
  done: boolean
}

/** The ladder can run once every skill on it is registered (wave 3); before that every child starts in Engdalen. */
export function placementAvailable(reg: SkillRegistry = skillRegistry()): boolean {
  return LADDER.every((c) => reg.get(c.skill) !== undefined)
}

export function startPlacement(grade: Grade, seed: number, audioVerified: boolean): PlacementRun | null {
  const start = PLACEMENT_START[grade]
  if (!start) return null
  const ladder = LADDER.filter((c) => audioVerified || !needsAudio(c.skill)).map((c) => c.id)
  return { grade, seed, ladder, index: ladder.indexOf(start), phase: 'jump', results: [], asked: 0, passed: [], failed: [], done: false }
}

/**
 * The next question, or null when the ladder is done. It is a pure function of the run, so a reload
 * asks the same question again.
 */
export function placementTask(run: PlacementRun, reg: SkillRegistry = skillRegistry()): Task | null {
  if (run.done) return null
  const cp = CHECKPOINT[run.ladder[run.index]]
  const def = reg.get(cp.skill)
  if (!def) return null
  const nth = run.results.length
  const rng = makeRng(hashSeed(`${run.seed}:${cp.id}`))
  const facts = candidateFacts(def)
  // two different questions per checkpoint, drawn from the harder half (and two families where there are two)
  const pair = rng.shuffle(facts)
  const second = pair.find((f) => f.family !== pair[0].family) ?? pair[1] ?? pair[0]
  let fact = nth === 0 ? pair[0] : second
  if (def.mode === 'procedure' && def.instance) {
    const family = def.families.find((f) => f.id === fact.family)
    if (family) fact = def.instance(family, makeRng(hashSeed(`${run.seed}:${cp.id}:${nth}`)), new Set([pair[0].id]))
  }
  // the checkpoint's kind first, then the skill's other production kinds: those this fact is asked in
  const own = kindsOf(def, fact)
  const kinds: TaskKind[] = own.includes(cp.kind) ? [cp.kind] : []
  kinds.push(...SKILL_BY_ID[def.id].production.filter((k) => k !== cp.kind && own.includes(k)))
  let task: Task | null = null
  for (const kind of kinds) {
    task = buildTask(def, fact, kind, makeRng(hashSeed(`${run.seed}:${cp.id}:${nth}:task`)), run.asked, { mode: 'placement' }).task
    if (isProduction(task)) return task
  }
  return task
}

/** Facts in the skill's own grade (no family above it), upper half by rank, that say something about the rung. */
function candidateFacts(def: SkillDef): Fact[] {
  const inGrade = factsOf(def).filter((f) => (def.families.find((fam) => fam.id === f.family)?.grade ?? def.grade) <= def.grade)
  const sorted = [...(inGrade.length > 0 ? inGrade : factsOf(def))].sort((a, b) => a.rank - b.rank)
  const upper = sorted.slice(Math.floor(sorted.length / 2))
  const telling = upper.filter(saysSomething)
  return telling.length >= TASKS_PER_CHECKPOINT ? telling : upper
}

/**
 * A sum, difference or product with 0 or 1 in it ("10 − 0", "9 + 1", "1 · 9") or nothing left
 * ("8 − 8") is answered by counting one step, or without the rung's skill at all, so two of them
 * could pass a rung on nothing (review app-w3-r1 P3-8: "10 − 0" and "5 − 0" on L4). Fact ids follow
 * CONVENTIONS (`add:`, `sub:`, `mul:`); other skills' questions are all kept.
 */
export function saysSomething(f: Fact): boolean {
  if (!/^(add|sub|mul):/.test(f.id)) return true
  return f.operands.every((n) => n > 1) && f.answer !== 0
}

/** Fold in one answer. Both questions right passes a checkpoint; a miss ends it at once. */
export function answerPlacement(run: PlacementRun, correct: boolean): PlacementRun {
  if (run.done) return run
  const results = [...run.results, correct]
  const asked = run.asked + 1
  if (correct && results.length < TASKS_PER_CHECKPOINT) return { ...run, results, asked }

  const id = run.ladder[run.index]
  const passed = correct ? [...run.passed, id] : run.passed
  const failed = correct ? run.failed : [...run.failed, id]
  let next: number
  let phase = run.phase
  if (correct) {
    if (phase === 'jump') {
      next = run.index + 2
      // past the top rung: try the last one on the way up
      if (next >= run.ladder.length && run.index + 1 < run.ladder.length) {
        next = run.index + 1
        phase = 'step'
      }
    } else next = run.index + 1
  } else if (phase === 'jump') {
    next = run.index - 1
    phase = 'step'
  } else next = -1

  const nextId = run.ladder[next]
  const done = next < 0 || next >= run.ladder.length || failed.includes(nextId) || passed.includes(nextId) ||
    asked + TASKS_PER_CHECKPOINT > PLACEMENT_MAX_TASKS
  return { ...run, results: [], asked, passed, failed, phase, index: done ? run.index : next, done }
}

/** P: the highest passed checkpoint, or null. */
export function placementResult(run: Pick<PlacementRun, 'passed'>): string | null {
  let best: string | null = null
  for (const c of LADDER) if (run.passed.includes(c.id)) best = c.id
  return best
}

export interface SeedContext {
  skills?: SkillRegistry
  day: string
  now: number
}

/**
 * Seed a profile from P. Core skills (number, place, addsub, muldiv) with stage ≤ stage(P) get
 * every key in box 2 marked `seeded`; a key already at box 2 or more keeps what the child earned.
 * stage(P) is seedStage(P): the highest stage of the rungs up to P, never less than P's own.
 * Regions whose skills all lie below stage(P) open with their lessons marked skipped (friend and
 * chest nodes stay to be fetched, the trial stays to be taken), and so do their worlds and the world
 * after one that opened completely.
 */
export function seedFromPlacement(profile: ProfileDoc, P: string | null, ctx: SeedContext): ProfileDoc {
  const placement = { done: true, at: ctx.now, highest: P }
  if (!P || !CHECKPOINT[P]) return { ...profile, placement }
  const reg = ctx.skills ?? skillRegistry()
  const stage = seedStage(P)

  const keys: Record<string, KeyState> = { ...profile.keys }
  for (const meta of Object.values(SKILL_BY_ID)) {
    if (!DOMAIN_BY_ID[meta.domain].core || meta.stage > stage) continue
    const def = reg.get(meta.id)
    const ids = def ? skillKeys(def) : meta.mode === 'procedure' ? meta.families.map((f) => `${meta.id}/${f.id}`) : []
    for (const id of ids) {
      const prev = keys[id]
      if (prev && prev.box >= 2) continue
      keys[id] = {
        ...(prev ?? emptyKey()), box: 2, seeded: true, boxDay: ctx.day, boxAt: ctx.now,
        lastDay: prev?.lastDay || ctx.day, lastRound: prev && prev.lastRound > -999 ? prev.lastRound : profile.roundIndex,
      }
    }
  }

  const opened: RegionId[] = passedOver(P)
  const nodes = { ...profile.nodes }
  for (const region of opened) {
    for (const n of nodesOfRegion(region)) {
      if (n.slot === 'friend' || n.slot === 'chest' || n.slot === 'trial') continue
      const prev = nodes[n.id]
      nodes[n.id] = { plays: 0, stars: 0, lastAt: ctx.now, ...prev, skipped: prev ? prev.skipped || prev.plays === 0 : true }
    }
  }
  const regions = [...new Set([...profile.unlocked.regions, ...opened])]
  const worlds = new Set<WorldId>([...profile.unlocked.worlds, 'eng'])
  WORLD_IDS.forEach((w, i) => {
    const inWorld = REGIONS.filter((r) => r.world === w)
    if (inWorld.some((r) => opened.includes(r.id))) worlds.add(w)
    if (inWorld.length > 0 && inWorld.every((r) => opened.includes(r.id)) && WORLD_IDS[i + 1]) worlds.add(WORLD_IDS[i + 1])
  })

  return { ...profile, placement, keys, nodes, unlocked: { worlds: WORLD_IDS.filter((w) => worlds.has(w)), regions } }
}
