// The game layer's answer to a finished round (SPEC §5.2–5.8, §6.2–6.3, §7.2, §13): stars, perler
// and XP, mastery sparks and medals, trials and the finale, friend and chest nodes, the mastery
// animals, the egg, friendship and growth, levels and their items, trophies, the three goals and the
// reward log. One pure, deterministic function: the same profile, round and events give the same
// result, and nothing the child has earned is ever taken away — perler only grow here, the inventory
// and the animals only gain entries, medals only rise.
import { NODE_BY_ID, REGION_BY_ID, REGIONS, type NodeDef } from '../content/curriculum'
import { ITEMS } from '../content/catalog'
import {
  EGG, FRIENDSHIP, PERLER, STAR_RULES, XP, eggWarmthFor, levelForXp, titleAt,
} from '../content/economy'
import { goldCount, newTrophies, silverCount, trophyPerler, type AchievementRound } from '../content/achievements'
import { nextGoal, progressGoals, refreshGoals, REVISIT_AFTER_DAYS, type GoalRound } from '../content/goals'
import { daysBetween, learningDay } from '../engine/learningDay'
import { helpBridgeOpen, nextTrialState, skipRegionNodes, trialOutcome } from '../engine/trial'
import type {
  Box, ItemId, ItemSource, LearningEvent, Medal, NodeId, NodeProgress, ProfileDoc, RegionId, SkillId,
} from '../engine/types'
import type { RoundResult } from '../state/useRound'
import {
  befriendIn, eggOptions, friendAnimal, goldMedalsOfWorld, MAGIC_PER_WORLD, rainbowRegions, starFoal, worldOfSkill,
  speciesOfWorld,
} from './animals'
import { appendLog, logEntries, type Reward } from './rewards'
import { newlyOpened, regionTier, trialPassed, unlockView } from './unlock'

export interface RoundContext {
  /** learningEventsFor(before the round, after it): keys that moved, statuses, medals. */
  events: readonly LearningEvent[]
  /** Learning day of the round's end. */
  day: string
  /** Epoch ms of the round's end. */
  now: number
}

export interface RoundOutcome {
  profile: ProfileDoc
  rewards: Reward[]
}

/** The round result as far as the meta layer reads it. */
export type MetaRound = Pick<RoundResult,
  'roundId' | 'mode' | 'nodeId' | 'total' | 'cleared' | 'firstTries' | 'bestStreak' | 'goldenCaught' | 'endedAt'>

const MEDAL_ORDER: readonly Medal[] = ['bronze', 'silver', 'gold']
const medalRank = (m: Medal | undefined) => (m ? MEDAL_ORDER.indexOf(m) + 1 : 0)

/** Right answers in the round: every task ends right in a round with retries; a trial has no retries. */
export function correctAnswers(r: Pick<MetaRound, 'mode' | 'cleared' | 'firstTries'>): number {
  if (r.mode === 'placement') return 0
  if (r.mode === 'trial' || r.mode === 'finale') return r.firstTries.filter((f) => f.correct).length
  return r.cleared
}

/** Stars a map round earns by itself (SPEC §5.5): finished 1, at most 2 mistakes 2, at most 1 and 3 typed answers 3. */
export function roundStars(r: Pick<MetaRound, 'total' | 'cleared' | 'firstTries'>): 0 | 1 | 2 | 3 {
  if (r.total === 0 || r.cleared < r.total) return 0
  const wrong = r.firstTries.filter((f) => !f.correct).length
  const typed = r.firstTries.filter((f) => f.production).length
  if (wrong <= STAR_RULES.maxMistakesFor3 && typed >= STAR_RULES.minProductionFor3) return 3
  return wrong <= STAR_RULES.maxMistakesFor2 ? 2 : 1
}

// ─── Items ──────────────────────────────────────────────────────────────────

function itemDue(p: ProfileDoc, s: ItemSource, counts: { silver: number; gold: number }): boolean {
  switch (s.kind) {
    case 'level': return p.economy.level >= s.level
    case 'chest': return (p.nodes[s.nodeId]?.plays ?? 0) > 0
    case 'finale': return trialPassed(p, s.world)
    case 'medal': return (s.tier === 'silver' ? counts.silver : counts.gold) >= s.count
    case 'shop': return false
  }
}

const sourceOrder = (s: ItemSource) =>
  s.kind === 'level' ? s.level : s.kind === 'medal' ? 100 + s.count : s.kind === 'chest' ? 200 : 300

/** Items earned but not yet in the inventory (levels, chests, finales, medal counts), in a sensible order. */
export function dueItems(p: ProfileDoc): ItemId[] {
  const counts = { silver: silverCount(p), gold: goldCount(p) }
  return ITEMS.filter((i) => !p.inventory[i.id] && itemDue(p, i.source, counts))
    .sort((a, b) => sourceOrder(a.source) - sourceOrder(b.source))
    .map((i) => i.id)
}

/** Put every due item in the inventory. */
export function grantDueItems(p: ProfileDoc, now: number): { profile: ProfileDoc; rewards: Reward[] } {
  const due = dueItems(p)
  if (due.length === 0) return { profile: p, rewards: [] }
  const inventory = { ...p.inventory }
  const rewards: Reward[] = []
  for (const id of due) {
    inventory[id] = { at: now, colors: [0] }
    rewards.push({ t: 'item', item: id, source: ITEMS.find((i) => i.id === id)!.source })
  }
  return { profile: { ...p, inventory }, rewards }
}

/** New trophies with their perler. */
export function grantTrophies(p: ProfileDoc, round: AchievementRound | null, now: number): { profile: ProfileDoc; rewards: Reward[] } {
  const ids = newTrophies(p, round)
  if (ids.length === 0) return { profile: p, rewards: [] }
  const achievements = { ...p.achievements }
  let perler = p.economy.perler
  const rewards: Reward[] = []
  for (const id of ids) {
    achievements[id] = now
    perler += trophyPerler(id)
    rewards.push({ t: 'trophy', id, perler: trophyPerler(id) })
  }
  return { profile: { ...p, achievements, economy: { ...p.economy, perler } }, rewards }
}

// ─── Goals ──────────────────────────────────────────────────────────────────

/** Open regions worth a visit for goal 2: played ≥ 5 learning days ago (oldest first), then never played. */
export function revisitRegions(p: ProfileDoc, day: string, open: readonly RegionId[]): RegionId[] {
  const last = new Map<RegionId, number>()
  for (const [id, n] of Object.entries(p.nodes) as [NodeId, NodeProgress][]) {
    const region = NODE_BY_ID[id]?.region
    if (!region || n.plays === 0) continue
    last.set(region, Math.max(last.get(region) ?? 0, n.lastAt))
  }
  const stale = open.filter((r) => last.has(r) && daysBetween(learningDay(last.get(r)!), day) >= REVISIT_AFTER_DAYS)
    .sort((a, b) => last.get(a)! - last.get(b)!)
  const fresh = open.filter((r) => !last.has(r))
  return [...stale, ...fresh]
}

/** profile.goals for `day` (new goals only on a new learning day; open ones never expire). */
export function goalsFor(p: ProfileDoc, day: string): ProfileDoc['goals'] {
  return refreshGoals(p.goals, { day, revisit: revisitRegions(p, day, unlockView(p).regions) })
}

// ─── The round ──────────────────────────────────────────────────────────────

/**
 * Apply a finished round. `profile` is the document after the data layer booked the round
 * (useProfile.finishRound has already counted it in roundIndex); `ctx.events` are its learning
 * events. Returns the new document and the rewards in the order they happened.
 */
export function applyRoundResult(profile: ProfileDoc, result: MetaRound, ctx: RoundContext): RoundOutcome {
  if (result.mode === 'placement') return { profile, rewards: [] }
  const { now, day } = ctx
  const opened0 = unlockView(profile)
  const tiers0 = REGIONS.map((r) => regionTier(profile, r.id))
  let p: ProfileDoc = { ...profile, economy: { ...profile.economy } }
  const rewards: Reward[] = []
  let friendship = 0
  const earn = (perler: number, xp: number) => {
    p.economy.perler += perler
    p.economy.xp += xp
  }

  // "Dage spillet i alt" (the data layer counts it with the first answer of the day; this keeps the
  // count right when it has not)
  if (p.lastLearningDay === null || day > p.lastLearningDay) {
    p.daysPlayed += 1
    p.lastLearningDay = day
  }

  // right answers and the golden egg
  const correct = correctAnswers(result)
  earn(correct * PERLER.correct, correct * XP.correct)
  rewards.push({ t: 'answers', correct, perler: correct * PERLER.correct, xp: correct * XP.correct })
  let warmth = correct * EGG.perCorrect
  friendship += correct * FRIENDSHIP.perCorrect
  if (result.goldenCaught) {
    earn(PERLER.golden, XP.golden)
    warmth += EGG.golden
    friendship += FRIENDSHIP.perCorrect
    rewards.push({ t: 'golden', perler: PERLER.golden, xp: XP.golden, warmth: EGG.golden })
  }

  // the node: plays, stars, trial
  const node: NodeDef | undefined = NODE_BY_ID[result.nodeId]
  let threeStarRound = false
  let trialPerfect = false
  const firstVisit = !!node && (p.nodes[node.id]?.plays ?? 0) === 0
  if (node && (result.mode === 'round' || result.mode === 'trial' || result.mode === 'finale')) {
    const trialMode = result.mode === 'trial' || result.mode === 'finale'
    const outcome = trialMode ? trialOutcome(result.firstTries, result.mode as 'trial' | 'finale') : null
    const stars = outcome ? outcome.stars : roundStars(result)
    threeStarRound = stars === 3
    const prev = p.nodes[node.id]
    const had = prev?.stars ?? 0
    const best = Math.max(had, stars) as NodeProgress['stars']
    p.nodes = { ...p.nodes, [node.id]: { plays: (prev?.plays ?? 0) + 1, stars: best, skipped: prev?.skipped ?? false, lastAt: now } }
    if (best > had) {
      let perler = 0
      for (let s = had + 1; s <= best; s++) perler += PERLER.star[s]
      const xp = (best - had) * XP.star
      earn(perler, xp)
      rewards.push({ t: 'stars', node: node.id, from: had as 0 | 1 | 2, stars: best as 1 | 2 | 3, perler, xp })
    }

    if (outcome) {
      const id = result.mode === 'finale' ? node.world : node.region!
      const before = p.trials[id]
      const wasPassed = (before?.passedAt ?? null) !== null
      // finishRound has already moved roundIndex past this round; the attempt belongs to the one before
      const after = nextTrialState(before, outcome, p.roundIndex - 1, now)
      p.trials = { ...p.trials, [id]: after }
      const first = outcome.passed && !wasPassed
      const perler = first ? (result.mode === 'finale' ? PERLER.finale : PERLER.trial) : 0
      const xp = first ? (result.mode === 'finale' ? XP.finale : XP.trial) : 0
      earn(perler, xp)
      let skipped: NodeId[] = []
      if (first && result.mode === 'trial') {
        const nodes = skipRegionNodes(p.nodes, id as RegionId, now)
        skipped = (Object.keys(nodes) as NodeId[]).filter((n) => nodes[n]?.skipped && !p.nodes[n]?.skipped)
        p.nodes = nodes
      }
      trialPerfect = outcome.perfect
      rewards.push({
        t: 'trial', trial: id, finale: result.mode === 'finale', passed: outcome.passed, first, score: outcome.score,
        total: outcome.total, best: after.best, perfect: outcome.perfect, perler, xp, skipped,
      })
      if (!outcome.passed && !wasPassed && result.mode === 'trial') {
        rewards.push({ t: 'hut', region: id as RegionId })
        if (helpBridgeOpen(after) && !helpBridgeOpen(before)) rewards.push({ t: 'helpBridge', region: id as RegionId })
      }
    }
  }

  // mastery sparks and medals. A node that already had three stars pays the base rate only — one
  // perle per right answer and the golden egg (spildesign §4.5): learning there still brings XP,
  // friendship and its ceremony, but replaying a finished node is never worth more than playing.
  const baseRateOnly = !!node && result.mode === 'round' && (profile.nodes[node.id]?.stars ?? 0) === 3
  const paid = (perler: number) => (baseRateOnly ? 0 : perler)
  const sparks: Reward[] = []
  for (const e of ctx.events) {
    if (e.t !== 'keyPromoted' || (e.box !== 3 && e.box !== 5)) continue
    const perler = paid(e.box === 3 ? PERLER.spark3 : PERLER.spark5)
    const xp = e.box === 3 ? XP.spark3 : XP.spark5
    earn(perler, xp)
    friendship += FRIENDSHIP.perSpark
    sparks.push({ t: 'spark', key: e.key, skill: e.skill, box: e.box, perler, xp })
  }
  rewards.push(...sparks)
  for (const e of ctx.events) {
    if (e.t !== 'medal') continue
    const had = p.skillMedals[e.skill]
    if (medalRank(e.medal) <= medalRank(had)) continue
    // a skill that jumps a tier still gets every medal on the way
    for (const tier of MEDAL_ORDER.slice(medalRank(had), medalRank(e.medal))) {
      earn(paid(PERLER.medal[tier]), XP.medal[tier])
      rewards.push({ t: 'medal', skill: e.skill, medal: tier, perler: paid(PERLER.medal[tier]), xp: XP.medal[tier] })
    }
    p.skillMedals = { ...p.skillMedals, [e.skill]: e.medal }
    if (e.medal === 'gold') rewards.push(...goldAnimal(p, e.skill, now, (next) => (p = next), paid(PERLER.allGolden)))
  }

  // friend node: the species for eggs and a first animal (or a new colour or breed)
  if (node && firstVisit && result.mode === 'round' && node.slot === 'friend') {
    const region = REGION_BY_ID[node.region!]
    if (region.node3.kind === 'friend') {
      const species = region.node3.species
      const isNew = !p.animals.some((a) => a.species === species)
      const animal = friendAnimal(p, species, node.id, now)
      if (animal) {
        p.animals = [...p.animals, animal]
        rewards.push({ t: 'animal', animal, newSpecies: isNew })
      } else {
        friendship += EGG.allFoundFriendship
      }
    }
  }

  // three stars on every node of a region: a rainbow animal from its world (at most four per world)
  if (node?.region && threeStarRound) {
    const world = node.world
    const was = Math.min(MAGIC_PER_WORLD, rainbowRegions(profile, world))
    const now3 = Math.min(MAGIC_PER_WORLD, rainbowRegions(p, world))
    if (now3 > was) {
      const owned = new Set(p.animals.filter((a) => a.source === 'rainbow').map((a) => a.species))
      rewards.push({ t: 'choice', kind: 'rainbow', world, options: speciesOfWorld(world).filter((s) => !owned.has(s)) })
    }
  }

  // the buddy's friendship and growth
  const befriended = befriendIn(p.animals, p.buddyUid, friendship)
  p.animals = befriended.animals
  rewards.push(...befriended.rewards)

  // the egg
  p.economy.eggWarmth += warmth
  rewards.push(...eggStep(p, warmth, (next) => (p = next)))

  // levels and their items
  const level = levelForXp(p.economy.xp)
  for (let l = p.economy.level + 1; l <= level; l++) {
    p.economy.perler += PERLER.levelUp
    rewards.push({ t: 'levelUp', level: l, title: titleAt(l)?.title ?? null, perler: PERLER.levelUp })
  }
  p.economy.level = Math.max(p.economy.level, level)
  const items = grantDueItems(p, now)
  p = items.profile
  rewards.push(...items.rewards)

  // the map: fog that lifts, colour that comes back
  const opened = newlyOpened(opened0, unlockView(p))
  if (opened.worlds.length > 0 || opened.regions.length > 0) rewards.push({ t: 'opened', ...opened })
  REGIONS.forEach((r, i) => {
    const tier = regionTier(p, r.id)
    if (tier !== tiers0[i]) rewards.push({ t: 'regionTier', region: r.id, tier })
  })

  // the three goals: new ones only on a new learning day, then this round's progress
  p.goals = goalsFor(p, day)
  const goalRound: GoalRound = {
    mode: result.mode,
    region: node?.region ?? null,
    bestStreak: result.bestStreak,
    productionCorrect: result.firstTries.filter((f) => f.correct && f.production).length,
    threeStars: threeStarRound,
  }
  const goals = progressGoals(p.goals, goalRound)
  p.goals = goals.state
  for (const g of goals.done) {
    p.stamps += 1
    rewards.push({ t: 'goal', goal: g, stamp: p.stamps })
  }

  // trophies (after everything they look at)
  const trophyRound: AchievementRound = {
    mode: result.mode,
    perfect: (result.mode === 'round' || result.mode === 'practice' || result.mode === 'hut') &&
      result.total >= 8 && result.cleared >= result.total && result.firstTries.every((f) => f.correct),
    trialPerfect,
  }
  const trophies = grantTrophies(p, trophyRound, now)
  p = trophies.profile
  rewards.push(...trophies.rewards)

  // "Det lærte du" comes first
  rewards.unshift(learned(ctx.events, result, nextGoal(p.goals)))

  p.rewardLog = appendLog(p.rewardLog, logEntries(rewards, now, `round:${result.nodeId}`))
  return { profile: p, rewards }
}

function learned(events: readonly LearningEvent[], result: MetaRound, next: ReturnType<typeof nextGoal>): Reward {
  const promoted: { key: string; skill: SkillId; box: Box }[] = []
  const firsts: { skill: SkillId; family: string }[] = []
  const statuses: Extract<Reward, { t: 'learned' }>['statuses'] = []
  for (const e of events) {
    if (e.t === 'keyPromoted') promoted.push({ key: e.key, skill: e.skill, box: e.box })
    else if (e.t === 'familyFirstCorrect') firsts.push({ skill: e.skill, family: e.family })
    else if (e.t === 'skillStatus') statuses.push({ skill: e.skill, status: e.status })
  }
  promoted.sort((a, b) => b.box - a.box)
  const practiced = [...new Set(result.firstTries.map((f) => f.skill))]
  return { t: 'learned', promoted, firsts, statuses, practiced, next }
}

/**
 * A gold medal: the first ever brings the Stjernefølet; later ones let the child pick a golden animal
 * of the medal's world, and once all four of that world are found (or waiting) it gives perler.
 */
function goldAnimal(p: ProfileDoc, skill: SkillId, now: number, set: (p: ProfileDoc) => void, allGolden: number): Reward[] {
  if (!p.animals.some((a) => a.source === 'starFoal')) {
    const foal = starFoal(p, skill, now)
    set({ ...p, animals: [...p.animals, foal] })
    return [{ t: 'animal', animal: foal, newSpecies: !p.animals.some((a) => a.species === 'unicorn') }]
  }
  const world = worldOfSkill(skill)
  if (!world) return []
  if (goldMedalsOfWorld(p, world) > MAGIC_PER_WORLD) {
    set({ ...p, economy: { ...p.economy, perler: p.economy.perler + allGolden } })
    return [{ t: 'allGolden', skill, world, perler: allGolden }]
  }
  const owned = new Set(p.animals.filter((a) => a.source === 'gold').map((a) => a.species))
  return [{ t: 'choice', kind: 'gold', world, options: speciesOfWorld(world).filter((s) => !owned.has(s)) }]
}

/**
 * The egg after this round's warmth: ready to hatch (the child opens it), or — when every unlocked
 * species has been found in every breed and colour — the warmth becomes friendship for the buddy.
 */
function eggStep(p: ProfileDoc, added: number, set: (p: ProfileDoc) => void): Reward[] {
  const need = eggWarmthFor(p.economy.eggsHatched + 1)
  if (p.economy.eggWarmth < need) return []
  const options = eggOptions(p)
  if (options.length > 0) {
    const species = p.economy.eggSpecies && options.includes(p.economy.eggSpecies) ? p.economy.eggSpecies : null
    return [{ t: 'eggReady', species, options, fresh: p.economy.eggWarmth - added < need }]
  }
  if (!p.buddyUid || !p.animals.some((a) => a.uid === p.buddyUid)) return []
  const out: Reward[] = []
  let warmth = p.economy.eggWarmth
  let amount = 0
  while (warmth >= need) {
    warmth -= need
    amount += EGG.allFoundFriendship
  }
  const befriended = befriendIn(p.animals, p.buddyUid, amount)
  set({ ...p, animals: befriended.animals, economy: { ...p.economy, eggWarmth: warmth } })
  out.push({ t: 'eggFriendship', uid: p.buddyUid, amount }, ...befriended.rewards)
  return out
}
