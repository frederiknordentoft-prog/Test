// Test helper: a simulated child who plays sessions of rounds through the whole curriculum, for the
// economy's acceptance checks (SPEC §5.7). Never imported by the app.
//
// The child is a model (right first tries on choice and typed tasks, share of quick answers, trial
// pass rate). Everything else is the real thing: mastery.updateKey, status.learningEventsFor,
// trial.ts, unlock.ts and progression.applyRoundResult. Skills that are not registered yet get
// stand-in keys of a realistic number, so the later worlds can be played before their skills exist.
// One session is one learning day; a seed makes every run identical.
import { NODES, nodesOfRegion, regionsOfWorld, type NodeDef, type RegionSkill } from '../../content/curriculum'
import { SKILLS, SKILL_BY_ID } from '../../content/skills'
import { DECOR, ITEMS } from '../../content/catalog'
import { RECOLOR_PRICE, RECOLORS_PER_ITEM } from '../../content/economy'
import { emptyKey, isDue, updateKey } from '../../engine/mastery'
import { factsOf, makeRegistry, skillRegistry, type SkillRegistry } from '../../engine/registry'
import { hashSeed, makeRng, type Rng } from '../../engine/rng'
import { learningEventsFor } from '../../engine/status'
import { canAttemptTrial, helpBridgeOpen } from '../../engine/trial'
import {
  WORLD_IDS,
  type FirstTry, type ItemColor, type KeyState, type MasteryKey, type ProfileDoc, type RegionId, type RoundMode,
  type SkillDef, type SkillId, type SpeciesId,
} from '../../engine/types'
import { newProfile } from '../../engine/testing/profile'
import { buyDecor, buyItem, buyRecolor, chooseMagic, chooseStarter, openEgg, chooseEggSpecies } from '../actions'
import { eggIsReady, eggOptions, pendingChoices } from '../animals'
import { applyRoundResult, type MetaRound } from '../progression'
import type { Reward } from '../rewards'
import { hutRegions, isFinaleOpen, isNodeOpen, isRegionOpen, isWorldOpen, nodeDone, trialPassed } from '../unlock'

// ─── The child ──────────────────────────────────────────────────────────────

export interface ChildModel {
  /** Right first tries on choice tasks. */
  choice: number
  /** Right first tries on typed (production) tasks. */
  production: number
  /** Share of right answers that are quick enough to move a box. */
  fast: number
  /** Chance to pass a trial or finale; without it each answer is drawn on its own. */
  trialPass?: number
  /** Buys the cheapest thing it can afford after every round. */
  spender?: boolean
}

export const CHILD_85: ChildModel = { choice: 0.85, production: 0.85, fast: 0.8, trialPass: 0.7 }
/** SPEC §5.7: both children pass 70 % of their trials; only their answers differ. */
export const CHILD_50: ChildModel = { choice: 0.5, production: 0.5, fast: 0.6, trialPass: 0.7 }
/** Taps a card at random (one in three) and cannot type an answer it does not know. */
export const GUESSER: ChildModel = { choice: 1 / 3, production: 0.05, fast: 0.5 }

// ─── Stand-in skills ────────────────────────────────────────────────────────

/** Fact counts for recall skills that are not registered yet (estimates from the skill tables). */
const RECALL_KEYS: Partial<Record<SkillId, number>> = {
  doubles: 10, halves: 10, addTo20: 36, subTo20: 36, groupsOf: 20, mul2510: 27, shareEqually: 16, mul34: 18,
  mul6to9: 30, div2510: 27, divAll: 48, missingPart10: 36, sidesCorners: 12, shapes3D: 12, composeShapes: 10,
  clockHour: 12, clockHalf: 12, clockQuarter: 24, coinNames: 9, weightCompare: 10, unitChoice: 12, halfShape: 8,
  fractionShape: 10,
}

function standIn(id: SkillId): SkillDef {
  const meta = SKILL_BY_ID[id]
  const n = RECALL_KEYS[id] ?? 12
  const facts = meta.mode === 'recall'
    ? Array.from({ length: n }, (_, i) => {
      const family = meta.families[i % meta.families.length].id
      return { id: `sim:${id}:${family}:${i}`, skill: id, family, operands: [i], answer: i, rank: i }
    })
    : []
  return { ...meta, canDo: `s.cando.${id}`, enumerate: () => facts } as unknown as SkillDef
}

let simReg: SkillRegistry | null = null
/** The registered skills, plus stand-ins for every skill not built yet. */
export function simRegistry(): SkillRegistry {
  if (simReg) return simReg
  const real = skillRegistry()
  simReg = makeRegistry(SKILLS.map((m) => real.get(m.id) ?? standIn(m.id)))
  return simReg
}

interface SimKey { key: MasteryKey; skill: SkillId; family: string; procedure: boolean }

const keyCache = new Map<string, SimKey[]>()
function keysOf(entry: RegionSkill): SimKey[] {
  const id = `${entry.skill}|${(entry.families ?? []).join(',')}`
  let keys = keyCache.get(id)
  if (keys) return keys
  const def = simRegistry().get(entry.skill)!
  const procedure = def.mode === 'procedure'
  const all: SimKey[] = procedure
    ? def.families.map((f) => ({ key: `${def.id}/${f.id}`, skill: def.id, family: f.id, procedure }))
    : factsOf(def).map((f) => ({ key: f.id, skill: def.id, family: f.family, procedure }))
  keys = entry.families ? all.filter((k) => entry.families!.includes(k.family)) : all
  keyCache.set(id, keys)
  return keys
}

/** Every key of every skill (for Blandet øvelse). */
function allKeys(): SimKey[] {
  return SKILLS.flatMap((m) => keysOf({ skill: m.id }))
}

// ─── Days and time ──────────────────────────────────────────────────────────

const DAY0 = Date.UTC(2026, 0, 5, 15, 0, 0)
const DAY_MS = 86_400_000
/** Learning day of a timestamp in UTC (the simulation's clock). */
const dayOf = (ts: number) => new Date(ts - 4 * 3600_000).toISOString().slice(0, 10)

// ─── The simulation ─────────────────────────────────────────────────────────

export interface RoundLog {
  session: number
  round: number
  mode: RoundMode
  node: string
  rewards: Reward[]
  /** Perler earned in the round (purchases not counted). */
  perler: number
  xp: number
  level: number
}

export interface SessionLog {
  session: number
  rounds: RoundLog[]
  /** Rewards of the session's actions outside rounds (starter, hatching, choices). */
  actions: Reward[]
  level: number
  perler: number
  earned: number
  animals: number
  items: number
}

interface Task { k: SimKey; production: boolean; review: boolean }

export class Sim {
  profile: ProfileDoc
  readonly rng: Rng
  readonly sessions: SessionLog[] = []
  /** All perler ever earned (purchases do not subtract). */
  earned = 0
  /** Every gold medal as it came: the evidence behind it at that moment. */
  readonly golds: { skill: SkillId; prodCorrect: number; prodDays: number; session: number }[] = []
  private instance = 0
  private ts = DAY0
  private session = 0

  constructor(readonly child: ChildModel, seed = 1, readonly starter: SpeciesId = 'rabbit') {
    this.rng = makeRng(seed)
    this.profile = newProfile({ id: `sim-${seed}`, roundIndex: 0, grade: 0, unlocked: { worlds: [], regions: [] } })
  }

  get day(): string {
    return dayOf(this.ts)
  }

  /** Session 1 is onboarding and three rounds; every later session five rounds, one session a day. */
  playSessions(n: number): this {
    for (let i = 0; i < n; i++) this.playSession()
    return this
  }

  playSession(): SessionLog {
    this.session += 1
    this.ts = DAY0 + (this.session - 1) * DAY_MS
    const log: SessionLog = { session: this.session, rounds: [], actions: [], level: 0, perler: 0, earned: 0, animals: 0, items: 0 }
    if (this.session === 1) {
      const start = chooseStarter(this.profile, this.starter, { now: this.ts })!
      this.profile = start.profile
      log.actions.push(...start.rewards)
      this.earned += start.rewards.reduce((s, r) => s + ('perler' in r ? r.perler : 0), 0)
    }
    const rounds = this.session === 1 ? 3 : 5
    for (let r = 0; r < rounds; r++) {
      // from the second session on, the child follows the first two goals: a visit to a region not
      // played for a while, and Blandet øvelse to end the day
      const practice = this.session > 1 && r === rounds - 1
      const visit = this.session > 1 && r === rounds - 2 ? this.revisit() : null
      log.rounds.push(this.playRound(practice ? { kind: 'practice' } : visit ?? this.next()))
      log.actions.push(...this.afterRound())
    }
    log.level = this.profile.economy.level
    log.perler = this.profile.economy.perler
    log.earned = this.earned
    log.animals = this.profile.animals.length
    log.items = Object.keys(this.profile.inventory).length
    this.sessions.push(log)
    return log
  }

  /** What the child plays next: the first open region with work left, its trial, the finale, or practice. */
  next(): Activity {
    const p = this.profile
    for (const world of WORLD_IDS) {
      if (!isWorldOpen(p, world)) continue
      for (const region of regionsOfWorld(world)) {
        if (!isRegionOpen(p, region.id)) continue
        const nodes = nodesOfRegion(region.id)
        const open = nodes.find((n) => n.slot !== 'trial' && !nodeDone(p, n.id) && isNodeOpen(p, n.id))
        if (open) return { kind: 'node', node: open }
        if (trialPassed(p, region.id) || helpBridgeOpen(p.trials[region.id])) continue
        if (canAttemptTrial(p.trials[region.id], p.roundIndex)) return { kind: 'node', node: nodes.find((n) => n.slot === 'trial')! }
        return hutRegions(p).includes(region.id) ? { kind: 'hut', region: region.id } : { kind: 'node', node: nodes.find((n) => n.slot === 'mix')! }
      }
      // the finale is the world's party: tried when ready, and left for later after three misses
      const finale = p.trials[world]
      if (isFinaleOpen(p, world) && !trialPassed(p, world) && (finale?.failed ?? 0) < 3) {
        if (canAttemptTrial(finale, p.roundIndex)) return { kind: 'node', node: NODES.find((n) => n.id === `${world}-finale`)! }
        return { kind: 'practice' }
      }
    }
    // everything open is done: polish a node without three stars, else practice
    const polish = NODES.find((n) => n.slot !== 'trial' && n.slot !== 'finale' && isNodeOpen(p, n.id) && (p.nodes[n.id]?.stars ?? 0) < 3)
    return polish ? { kind: 'node', node: polish } : { kind: 'practice' }
  }

  /** Goal 2: the region to visit, at its mix node when that is open, else its first open node. */
  revisit(): Activity | null {
    const goal = this.profile.goals.list.find((g) => g.kind === 'revisit' && !g.done)
    if (!goal?.region || !isRegionOpen(this.profile, goal.region)) return null
    const nodes = nodesOfRegion(goal.region)
    const mix = nodes.find((n) => n.slot === 'mix')!
    if (isNodeOpen(this.profile, mix.id)) return { kind: 'node', node: mix }
    const open = nodes.find((n) => n.slot !== 'trial' && isNodeOpen(this.profile, n.id))
    return open ? { kind: 'node', node: open } : null
  }

  /** Play one activity and apply the result. */
  playRound(a: Activity): RoundLog {
    const before = this.profile
    const mode: RoundMode = a.kind === 'practice' ? 'practice' : a.kind === 'hut' ? 'hut' : a.node.slot === 'trial' ? 'trial' : a.node.slot === 'finale' ? 'finale' : 'round'
    const tasks = this.plan(a, mode)
    const result = this.answer(tasks, mode, a)
    const after = { ...this.profile, roundIndex: this.profile.roundIndex + 1 }
    const events = learningEventsFor(before, after, simRegistry())
    for (const e of events) {
      if (e.t === 'medal' && e.medal === 'gold') {
        const st = after.skillStats[e.skill]
        this.golds.push({ skill: e.skill, prodCorrect: st?.prodCorrect ?? 0, prodDays: new Set(st?.prodDays ?? []).size, session: this.session })
      }
    }
    const out = applyRoundResult(after, result, { events, day: this.day, now: this.ts })
    const perler = out.profile.economy.perler - after.economy.perler
    this.earned += perler
    this.profile = out.profile
    this.ts += 3 * 60_000
    return {
      session: this.session, round: this.profile.roundIndex, mode, node: String(result.nodeId), rewards: out.rewards, perler,
      xp: out.profile.economy.xp - after.economy.xp, level: out.profile.economy.level,
    }
  }

  /** Replay a node (for the farming check). */
  replay(nodeId: string): RoundLog {
    const node = NODES.find((n) => n.id === nodeId)!
    const log = this.playRound({ kind: 'node', node })
    this.afterRound()
    return log
  }

  /** Open a ready egg, pick earned golden and rainbow animals, and (a spender) shop. */
  afterRound(): Reward[] {
    const out: Reward[] = []
    const now = this.ts
    while (eggIsReady(this.profile) && eggOptions(this.profile).length > 0) {
      if (!this.profile.economy.eggSpecies) {
        const options = eggOptions(this.profile)
        this.profile = chooseEggSpecies(this.profile, options[this.rng.int(options.length)])!.profile
      }
      const hatched = openEgg(this.profile, { now })
      if (!hatched) break
      this.profile = hatched.profile
      out.push(...hatched.rewards)
    }
    for (let guard = 0; guard < 10; guard++) {
      const pending = pendingChoices(this.profile)[0]
      if (!pending || pending.options.length === 0) break
      const chosen = chooseMagic(this.profile, pending.kind, pending.options[0], { now })
      if (!chosen) break
      this.profile = chosen.profile
      out.push(...chosen.rewards)
    }
    const actionPerler = out.reduce((s, r) => s + ('perler' in r ? r.perler : 0), 0)
    this.earned += actionPerler
    if (this.child.spender) this.shop(now)
    return out
  }

  /** Buy the cheapest thing on the shelf while the perler last. */
  private shop(now: number): void {
    for (;;) {
      const p = this.profile
      const offers: { price: number; buy: () => ProfileDoc | null }[] = []
      for (const i of ITEMS) {
        if (i.source.kind === 'shop' && !p.inventory[i.id]) offers.push({ price: i.source.price, buy: () => buyItem(p, i.id, { now })?.profile ?? null })
        const entry = p.inventory[i.id]
        if (entry) {
          for (const c of [1, 2] as ItemColor[]) if (!entry.colors.includes(c)) offers.push({ price: RECOLOR_PRICE, buy: () => buyRecolor(p, i.id, c, { now })?.profile ?? null })
        }
      }
      for (const d of DECOR) if (!p.decor[d.id]) offers.push({ price: d.price, buy: () => buyDecor(p, d.id, { now })?.profile ?? null })
      const best = offers.filter((o) => o.price <= p.economy.perler).sort((a, b) => a.price - b.price)[0]
      if (!best) return
      const next = best.buy()
      if (!next) return
      this.profile = next
    }
  }

  /** Everything the shelf holds is bought (shop sets, decor, both recolours of all 74 items). */
  shopEmptied(): boolean {
    const p = this.profile
    if (DECOR.some((d) => !p.decor[d.id])) return false
    return ITEMS.every((i) => {
      const e = p.inventory[i.id]
      return !!e && e.colors.length === 1 + RECOLORS_PER_ITEM
    })
  }

  // ─── Rounds ─────────────────────────────────────────────────────────────

  private plan(a: Activity, mode: RoundMode): Task[] {
    const p = this.profile
    const rng = this.rng
    const state = (k: SimKey) => p.keys[k.key]
    const seen = (k: SimKey) => (state(k)?.seen ?? 0) > 0 || !!state(k)?.seeded
    const due = (k: SimKey) => { const s = state(k); return !s || isDue(s, p.roundIndex, this.day) }
    const byNeed = (a: SimKey, b: SimKey) =>
      Number(due(b)) - Number(due(a)) || (state(a)?.box ?? 0) - (state(b)?.box ?? 0) || (state(a)?.lastRound ?? 0) - (state(b)?.lastRound ?? 0)

    if (mode === 'trial' || mode === 'finale') {
      const node = (a as { node: NodeDef }).node
      const bySkill = new Map<SkillId, SimKey[]>()
      for (const e of node.skills.filter((s) => !s.reviewOnly)) bySkill.set(e.skill, [...(bySkill.get(e.skill) ?? []), ...keysOf(e)])
      const skills = rng.shuffle([...bySkill.keys()])
      const size = mode === 'finale' ? 12 : 10
      return Array.from({ length: size }, (_, i) => {
        const ks = bySkill.get(skills[i % skills.length])!
        return { k: ks[rng.int(ks.length)], production: true, review: false }
      })
    }

    let pool: SimKey[]
    let review: SimKey[] = []
    let size = 10
    let node: NodeDef | null = null
    if (a.kind === 'practice') pool = allKeys().filter(seen)
    else if (a.kind === 'hut') pool = nodesOfRegion(a.region).find((n) => n.slot === 'trial')!.skills.flatMap(keysOf)
    else {
      node = a.node
      size = node.size
      pool = node.skills.filter((s) => !s.reviewOnly).flatMap(keysOf)
      // the review slot: keys the child is sure of in other skills (three in a mix node)
      const inNode = new Set(pool.map((k) => k.skill))
      review = [
        ...node.skills.filter((s) => s.reviewOnly).flatMap(keysOf).filter(seen),
        ...allKeys().filter((k) => !inNode.has(k.skill) && (state(k)?.box ?? 0) >= 3),
      ]
    }
    if (pool.length === 0) pool = allKeys().filter(seen)
    if (pool.length === 0) pool = keysOf({ skill: 'count10' })

    const chosen: SimKey[] = []
    const take = (ks: SimKey[], n: number) => {
      for (const k of ks) {
        if (n <= 0) break
        if (chosen.includes(k)) continue
        chosen.push(k)
        n--
      }
    }
    const shaky = pool.filter((k) => seen(k) && (state(k)?.box ?? 0) <= 2).sort(byNeed)
    const secure = pool.filter((k) => seen(k) && (state(k)?.box ?? 0) >= 3).sort(byNeed)
    const fresh = a.kind === 'node' ? pool.filter((k) => !seen(k)) : []
    const reviewN = node ? Math.min(node.review > 0 ? node.review : 1, review.length) : 0

    take(secure.filter(due), a.kind === 'practice' ? 3 : 1)
    take(shaky.filter(due), a.kind === 'practice' ? 6 : 5)
    take(this.freshAllowed(fresh), 2)
    take(rng.shuffle(review.filter(due)), reviewN)
    take(shaky, 1)
    // fill: more new keys within the caps, then whatever needs it most, then repeats
    take(this.freshAllowed(fresh.filter((k) => !chosen.includes(k))), size - chosen.length)
    take([...shaky, ...secure], size - chosen.length)
    while (chosen.length < size) chosen.push(pool[rng.int(pool.length)])

    return rng.shuffle(chosen.slice(0, size)).map((k) => {
      const box = state(k)?.box ?? 0
      const isReview = !pool.includes(k)
      let production = box >= 3
      if (!production && node?.production === 'fromBox1' && box >= 1) production = true
      if (!production && node?.houseKind !== 'choice' && rng.next() < 0.35) production = true
      return { k, production, review: isReview }
    })
  }

  /** New keys the caps allow today (8 per skill, 20 per learning day). */
  private freshAllowed(fresh: SimKey[]): SimKey[] {
    const nt = this.profile.newToday.day === this.day ? this.profile.newToday : { day: this.day, total: 0, perSkill: {} as Partial<Record<SkillId, number>> }
    const per = { ...nt.perSkill }
    let total = nt.total
    const out: SimKey[] = []
    for (const k of fresh) {
      if (total >= 20) break
      if ((per[k.skill] ?? 0) >= 8) continue
      per[k.skill] = (per[k.skill] ?? 0) + 1
      total++
      out.push(k)
    }
    return out
  }

  private answer(tasks: Task[], mode: RoundMode, a: Activity): MetaRound {
    const rng = this.rng
    const trial = mode === 'trial' || mode === 'finale'
    // a trial's outcome follows the model's pass rate when it has one
    let trialRight: boolean[] | null = null
    if (trial && this.child.trialPass !== undefined) {
      const pass = this.child.trialPass > 0 && rng.next() < this.child.trialPass
      const n = tasks.length
      const need = mode === 'finale' ? 10 : 8
      const score = pass ? need + (rng.next() < 0.45 ? 0 : rng.next() < 0.6 ? 1 : 2) : need - 1 - (rng.next() < 0.75 ? 0 : 1)
      const wrong = new Set(rng.shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, n - Math.min(n, score)))
      trialRight = tasks.map((_, i) => !wrong.has(i))
    }

    const firstTries: FirstTry[] = []
    let streak = 0
    let bestStreak = 0
    let goldenUsed = false
    let goldenCaught = false
    let keys = this.profile.keys
    let stats = this.profile.skillStats
    let newToday = this.profile.newToday.day === this.day ? this.profile.newToday : { day: this.day, total: 0, perSkill: {} }
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]
      const p = t.production ? this.child.production : this.child.choice
      const correct = trialRight ? trialRight[i] : rng.next() < p
      const fast = correct && rng.next() < this.child.fast
      const prev: KeyState | undefined = keys[t.k.key]
      const next = updateKey(prev, {
        correct, fast, production: t.production, ceiling: t.production ? 5 : 3, ms: fast ? 2500 : 7000, ts: this.ts + i * 15_000,
        day: this.day, roundIndex: this.profile.roundIndex, mode: mode === 'finale' ? 'trial' : mode === 'placement' ? 'round' : mode,
        assisted: false, retryOf: null, procedure: t.k.procedure, instanceId: t.k.procedure ? `${t.k.key}#${++this.instance}` : t.k.key,
      })
      if ((prev?.seen ?? 0) === 0) {
        newToday = { day: this.day, total: newToday.total + 1, perSkill: { ...newToday.perSkill, [t.k.skill]: (newToday.perSkill[t.k.skill as SkillId] ?? 0) + 1 } }
      }
      keys = { ...keys, [t.k.key]: next ?? emptyKey() }
      if (correct && t.production) {
        const st = stats[t.k.skill] ?? { prodCorrect: 0, prodDays: [] }
        stats = { ...stats, [t.k.skill]: { prodCorrect: st.prodCorrect + 1, prodDays: st.prodDays.includes(this.day) ? st.prodDays : [...st.prodDays, this.day].slice(-30) } }
      }
      firstTries.push({ key: t.k.key, skill: t.k.skill, correct, production: t.production, fast })
      if (correct) {
        streak++
        bestStreak = Math.max(bestStreak, streak)
        // three in a row: the golden egg, once a round, never on the last task
        if (!trial && !goldenUsed && streak % 3 === 0 && i < tasks.length - 2) {
          // a missed egg costs nothing, not even the streak
          goldenUsed = true
          goldenCaught = rng.next() < this.child.choice
        }
      } else {
        streak = 0
        if (!trial) {
          // the retry comes back a little later and is answered right after the strategy
          while (rng.next() >= Math.max(0.8, p)) streak = 0
          streak = 1
        }
      }
    }
    const newDay = this.profile.lastLearningDay === null || this.day > this.profile.lastLearningDay
    this.profile = {
      ...this.profile, keys, skillStats: stats, newToday,
      daysPlayed: newDay ? this.profile.daysPlayed + 1 : this.profile.daysPlayed,
      lastLearningDay: newDay ? this.day : this.profile.lastLearningDay,
    }
    const nodeId = a.kind === 'node' ? a.node.id : a.kind
    return {
      roundId: `${this.profile.id}:${this.profile.roundIndex}`, mode, nodeId, total: tasks.length,
      cleared: tasks.length, firstTries, bestStreak, goldenCaught, endedAt: this.ts + tasks.length * 15_000,
    }
  }
}

export type Activity = { kind: 'node'; node: NodeDef } | { kind: 'practice' } | { kind: 'hut'; region: RegionId }

/** A seed per child kind, so the three runs differ but each is fixed. */
export const seedOf = (name: string) => hashSeed(`economy-sim:${name}`)
