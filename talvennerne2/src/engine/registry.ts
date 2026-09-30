import {
  SKILL_IDS,
  type Fact, type FamilyDef, type KeyState, type MasteryKey, type MisconceptionId, type RoundMode, type SkillDef,
  type SkillId, type Task, type TaskKind,
} from './types'
import { SKILL_BY_ID } from '../content/skills'
import type { NodeDef, RegionSkill } from '../content/curriculum'
import { hashSeed, makeRng, type Rng } from './rng'
import type { BuildExtra, KeyOption } from './roundBuilder'
import { buildTask, isMisconceptionId, masteryKeyOf, operationOfPrompt, type Operation } from './tasks'

/**
 * The skill register (SPEC §2.4). Every file in src/engine/skills/<domain>/ default-exports one
 * SkillDef; there are no index files to keep in sync, so adding a skill is adding a file. The
 * registry also turns a map node's skill list into mastery keys the round builder can ask.
 */

const SKILL_ID_SET: ReadonlySet<string> = new Set(SKILL_IDS)

export function isSkillDef(x: unknown): x is SkillDef {
  if (!x || typeof x !== 'object') return false
  const d = x as Partial<SkillDef>
  return typeof d.id === 'string' && SKILL_ID_SET.has(d.id) && typeof d.enumerate === 'function' &&
    typeof d.candidates === 'function' && Array.isArray(d.kinds) && Array.isArray(d.families)
}

/** Default exports that are SkillDefs, in path order; tests, oracles and helper files are skipped. */
export function collectSkills(modules: Readonly<Record<string, unknown>>): SkillDef[] {
  return Object.keys(modules)
    .filter((path) => !/\.(test|oracle)\.ts$/.test(path))
    .sort()
    .map((path) => (modules[path] as { default?: unknown } | undefined)?.default)
    .filter(isSkillDef)
}

export interface SkillRegistry {
  readonly all: readonly SkillDef[]
  get(id: SkillId): SkillDef | undefined
}

export function makeRegistry(defs: readonly SkillDef[]): SkillRegistry {
  const byId = new Map<SkillId, SkillDef>()
  for (const d of defs) {
    if (byId.has(d.id)) throw new Error(`skill ${d.id} is registered twice`)
    byId.set(d.id, d)
  }
  const all = [...byId.values()]
  return { all, get: (id) => byId.get(id) }
}

// Negative patterns keep tests and oracles out of the bundle: an eager glob imports what it matches.
const MODULES = import.meta.glob(['./skills/*/*.ts', '!./skills/*/*.test.ts', '!./skills/*/*.oracle.ts'], { eager: true })

let registered: SkillRegistry | null = null
export function skillRegistry(): SkillRegistry {
  return (registered ??= makeRegistry(collectSkills(MODULES)))
}
export const registeredSkills = (): readonly SkillDef[] => skillRegistry().all
export const getSkill = (id: SkillId): SkillDef | undefined => skillRegistry().get(id)

// ─── Facts and keys ─────────────────────────────────────────────────────────

const factCache = new WeakMap<SkillDef, readonly Fact[]>()
/** def.enumerate(), computed once per SkillDef. */
export function factsOf(def: SkillDef): readonly Fact[] {
  let facts = factCache.get(def)
  if (!facts) factCache.set(def, (facts = def.enumerate()))
  return facts
}

/** Every mastery key of a skill: its facts (recall) or its families (procedure). */
export function skillKeys(def: SkillDef): MasteryKey[] {
  return def.mode === 'recall' ? factsOf(def).map((f) => f.id) : def.families.map((f) => `${def.id}/${f.id}`)
}

/**
 * Every mastery key per registered skill (recall: fact ids, procedure: `skill/family`), for the data
 * layer's setSkillKeyIndex in src/data/aggregate.ts.
 */
export function skillKeyIndex(reg: SkillRegistry = skillRegistry()): Partial<Record<SkillId, MasteryKey[]>> {
  const out: Partial<Record<SkillId, MasteryKey[]>> = {}
  for (const def of reg.all) out[def.id] = skillKeys(def)
  return out
}

export interface KeyInfo { skill: SkillId; family: string }

const indexCache = new WeakMap<SkillRegistry, Map<MasteryKey, KeyInfo>>()
/** Which skill and family a mastery key belongs to. Procedure keys name it; recall keys are looked up. */
export function keyInfo(key: MasteryKey, reg: SkillRegistry = skillRegistry()): KeyInfo | undefined {
  let index = indexCache.get(reg)
  if (!index) {
    index = new Map()
    for (const def of reg.all) {
      if (def.mode === 'recall') for (const f of factsOf(def)) index.set(f.id, { skill: def.id, family: f.family })
      else for (const fam of def.families) index.set(`${def.id}/${fam.id}`, { skill: def.id, family: fam.id })
    }
    indexCache.set(reg, index)
  }
  const hit = index.get(key)
  if (hit) return hit
  const slash = key.indexOf('/')
  const skill = key.slice(0, slash)
  return slash > 0 && SKILL_ID_SET.has(skill) ? { skill: skill as SkillId, family: key.slice(slash + 1) } : undefined
}

// ─── Validation against the metadata table ─────────────────────────────────

/** Problems with a SkillDef compared with SKILL_BY_ID in src/content/skills.ts (empty when it agrees). */
export function validateSkill(def: SkillDef): string[] {
  const meta = SKILL_BY_ID[def.id]
  const out: string[] = []
  if (!meta) return [`${def.id}: unknown skill id`]
  const same = <T>(what: string, a: T, b: T) => {
    if (a !== b) out.push(`${def.id}: ${what} is ${String(a)}, expected ${String(b)}`)
  }
  same('domain', def.domain, meta.domain)
  same('grade', def.grade, meta.grade)
  same('stage', def.stage, meta.stage)
  same('mode', def.mode, meta.mode)
  same('kinds', [...def.kinds].sort().join(','), [...meta.kinds].sort().join(','))
  same('families', def.families.map((f) => f.id).join(','), meta.families.map((f) => f.id).join(','))
  for (const f of def.families) {
    same(`grade of family ${f.id}`, f.grade ?? def.grade, meta.families.find((m) => m.id === f.id)?.grade ?? meta.grade)
  }
  if (def.mode === 'procedure' && typeof def.instance !== 'function') out.push(`${def.id}: a procedure skill needs instance()`)

  const facts = factsOf(def)
  const families = new Set(def.families.map((f) => f.id))
  const ids = new Set<string>()
  for (const f of facts) {
    if (f.skill !== def.id) out.push(`${def.id}: fact ${f.id} says skill ${f.skill}`)
    if (!families.has(f.family)) out.push(`${def.id}: fact ${f.id} has unknown family ${f.family}`)
    if (ids.has(f.id)) out.push(`${def.id}: fact id ${f.id} appears twice`)
    ids.add(f.id)
  }
  for (const fam of def.families) {
    if (!facts.some((f) => f.family === fam.id)) out.push(`${def.id}: family ${fam.id} has no facts`)
  }
  return out
}

// ─── Keys for a node ────────────────────────────────────────────────────────

/** Per-plan state shared by every key's build(): what was offered and which instances were used. */
export interface BuildSession {
  /** profile.offeredTags plus what this plan has shown so far (the diagnostic card rotates on it). */
  offered: Partial<Record<MisconceptionId, number>>
  /** Instances already asked in this plan, per procedure key. */
  used: Map<MasteryKey, Set<string>>
}

export const newBuildSession = (offered: Partial<Record<MisconceptionId, number>> = {}): BuildSession =>
  ({ offered: { ...offered }, used: new Map() })

export interface KeyContext {
  /** Defaults to the registered skills. */
  skills?: SkillRegistry
  states: Readonly<Record<MasteryKey, KeyState>>
  /** hear* skills stay hidden until the sound check has passed (SPEC §5.4, §8). */
  audioVerified: boolean
  mode?: RoundMode | 'golden'
  /** The node's house kind goes first in every key's kinds. */
  houseKind?: TaskKind | null
  session?: BuildSession
}

/** Skills that are only a question when the child can hear it. */
export const needsAudio = (skill: SkillId): boolean => skill.startsWith('hear')

/** A world finale lists a skill once per region; merge them, keeping the widest restriction. */
function mergeEntries(entries: readonly RegionSkill[]): RegionSkill[] {
  const out = new Map<SkillId, RegionSkill>()
  for (const e of entries) {
    const prev = out.get(e.skill)
    if (!prev) {
      out.set(e.skill, { ...e })
      continue
    }
    out.set(e.skill, {
      skill: e.skill,
      ...(prev.families && e.families ? { families: [...new Set([...prev.families, ...e.families])] } : {}),
      ...(prev.max !== undefined && e.max !== undefined ? { max: Math.max(prev.max, e.max) } : {}),
      ...(prev.reviewOnly && e.reviewOnly ? { reviewOnly: true } : {}),
    })
  }
  return [...out.values()]
}

const PREFIX_OPS: Readonly<Record<string, Operation>> = { add: '+', ten: '+', dbl: '+', mp: '+', sub: '−', mul: '·', div: ':', hlf: ':' }

function operationOf(def: SkillDef, fact: Fact): Operation | null {
  const byId = PREFIX_OPS[fact.id.slice(0, fact.id.indexOf(':'))]
  if (byId) return byId
  const kind = def.kinds[0]
  return kind ? operationOfPrompt(def.prompt(fact, kind, makeRng(hashSeed(fact.id)))) : null
}

function misconceptionsOf(def: SkillDef, facts: readonly Fact[]): MisconceptionId[] {
  const out = new Set<MisconceptionId>()
  for (const f of facts) for (const c of def.candidates(f)) if (isMisconceptionId(c.tag)) out.add(c.tag)
  return [...out]
}

function orderKinds(kinds: readonly TaskKind[], house: TaskKind | null | undefined): TaskKind[] {
  return house && kinds.includes(house) ? [house, ...kinds.filter((k) => k !== house)] : [...kinds]
}

/**
 * Mastery keys for a list of region skills, with the region's restrictions applied: only the named
 * families, only facts whose operands and answer are ≤ max, review-only skills marked. A recall
 * skill gives one key per fact; a procedure skill one key per family, whose build() draws a fresh
 * seeded instance that avoids the family's recent instances and those already used in this plan.
 */
export function keysForSkills(entries: readonly RegionSkill[], ctx: KeyContext): KeyOption[] {
  const reg = ctx.skills ?? skillRegistry()
  const session = ctx.session ?? newBuildSession()
  const out: KeyOption[] = []

  for (const entry of mergeEntries(entries)) {
    const def = reg.get(entry.skill)
    if (!def) continue
    if (!ctx.audioVerified && needsAudio(def.id)) continue
    const meta = SKILL_BY_ID[def.id]
    const kinds = orderKinds(def.kinds, ctx.houseKind)
    const production = kinds.filter((k) => meta.production.includes(k))
    const famOk = (id: string) => !entry.families || entry.families.includes(id)
    const max = entry.max
    const fits = (f: Fact) =>
      max === undefined || (f.operands.every((o) => o <= max) && (typeof f.answer !== 'number' || f.answer <= max))
    const reviewOnly = entry.reviewOnly ? { reviewOnly: true } : {}

    const make = (fact: Fact, kind: TaskKind, rng: Rng, occurrence: number, extra?: BuildExtra): Task => {
      const built = buildTask(def, fact, kind, rng, occurrence, {
        box: ctx.states[masteryKeyOf(def, fact)]?.box ?? 0,
        mode: ctx.mode,
        offered: session.offered,
        target: extra?.target,
      })
      for (const m of built.offered) session.offered[m] = (session.offered[m] ?? 0) + 1
      return built.task
    }

    if (def.mode === 'recall') {
      for (const fact of factsOf(def)) {
        if (!famOk(fact.family) || !fits(fact)) continue
        out.push({
          key: fact.id, skill: def.id, family: fact.family, rank: fact.rank, kinds, production,
          detectable: misconceptionsOf(def, [fact]), op: operationOf(def, fact), ...reviewOnly,
          build: (kind, rng, occurrence, extra) => make(fact, kind, rng, occurrence, extra),
        })
      }
      continue
    }

    for (const fam of def.families) {
      if (!famOk(fam.id)) continue
      const canon = factsOf(def).filter((f) => f.family === fam.id)
      const pool = canon.filter(fits)
      if (pool.length === 0) continue
      const key = `${def.id}/${fam.id}`
      out.push({
        key, skill: def.id, family: fam.id, rank: fam.rank, kinds, production,
        detectable: misconceptionsOf(def, pool), op: operationOf(def, pool[0]), ...reviewOnly,
        build(kind, rng, occurrence, extra) {
          const used = session.used.get(key) ?? new Set<string>()
          session.used.set(key, used)
          const avoid = new Set([...(ctx.states[key]?.recent ?? []), ...used])
          const fact = drawInstance(def, fam, rng, avoid, fits, pool)
          used.add(fact.id)
          return make(fact, kind, rng, occurrence, extra)
        },
      })
    }
  }
  return out
}

/** A fresh instance of a family inside the region's limits, falling back to the canonical facts. */
function drawInstance(def: SkillDef, fam: FamilyDef, rng: Rng, avoid: ReadonlySet<string>, fits: (f: Fact) => boolean, pool: readonly Fact[]): Fact {
  if (def.instance) {
    for (let i = 0; i < 40; i++) {
      const f = def.instance(fam, rng, avoid)
      if (fits(f) && !avoid.has(f.id)) return f
    }
  }
  const fresh = pool.filter((f) => !avoid.has(f.id))
  return rng.pick(fresh.length > 0 ? fresh : pool)
}

/** Keys for a map node: its skills with the region's restrictions, house kind first. */
export function keysForNode(node: Pick<NodeDef, 'skills' | 'houseKind'>, ctx: KeyContext): KeyOption[] {
  return keysForSkills(node.skills, { ...ctx, houseKind: node.houseKind })
}

/**
 * The golden egg: a harder fact from the node's pool (upper half by rank), always on cards — it
 * runs away, so there is no time for a keypad, and it never shows the scaffold.
 */
export function goldenTask(node: Pick<NodeDef, 'skills' | 'houseKind'>, ctx: KeyContext & { seed: number }): Task | null {
  const keys = keysForNode(node, { ...ctx, mode: 'golden' }).filter((k) => k.kinds.includes('choice') && !k.reviewOnly)
  if (keys.length === 0) return null
  const sorted = [...keys].sort((a, b) => a.rank - b.rank)
  const rng = makeRng(ctx.seed)
  const pick = rng.pick(sorted.slice(Math.floor(sorted.length / 2)))
  return pick.build('choice', rng, 999)
}
