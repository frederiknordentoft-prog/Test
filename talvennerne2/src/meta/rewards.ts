// Typed reward events (SPEC §5.7–5.8, §6.2–6.3). progression.ts and actions.ts return them, the
// ceremony queue orders them, and the reward log (shown to parents) is written from them.
import type {
  Animal, Box, Goal, ItemId, ItemSource, MasteryKey, Medal, NodeId, ProfileDoc, RegionId, RewardLogEntry,
  SkillId, SkillStatus, SpeciesId, Stage, TrophyId, WorldId,
} from '../engine/types'
import type { FriendshipUnlock } from '../content/economy'

export type RegionTier = 'start' | 'bronze' | 'silver' | 'gold'

export type Reward =
  /** "Det lærte du": keys that moved up, first right answers in a family, skills that rose, and one next goal. */
  | { t: 'learned'; promoted: { key: MasteryKey; skill: SkillId; box: Box }[]; firsts: { skill: SkillId; family: string }[]
      statuses: { skill: SkillId; status: SkillStatus }[]; practiced: SkillId[]; next: Goal | null }
  /** Right answers in the round (retries and helped answers count). */
  | { t: 'answers'; correct: number; perler: number; xp: number }
  | { t: 'golden'; perler: number; xp: number; warmth: number }
  /** New stars on a node: `from` was the best before, `stars` the best now. */
  | { t: 'stars'; node: NodeId; from: 0 | 1 | 2; stars: 1 | 2 | 3; perler: number; xp: number }
  /** Mastery spark: a key reached box 3 or 5. */
  | { t: 'spark'; key: MasteryKey; skill: SkillId; box: 3 | 5; perler: number; xp: number }
  | { t: 'trial'; trial: RegionId | WorldId; finale: boolean; passed: boolean; first: boolean; score: number; total: number
      best: number; perfect: boolean; perler: number; xp: number; skipped: NodeId[] }
  /** Three attempts without passing: the rope bridge opens the way on. */
  | { t: 'helpBridge'; region: RegionId }
  /** A failed trial lights the training hut by the gate. */
  | { t: 'hut'; region: RegionId }
  /** The fog lifts: new regions or worlds on the map. */
  | { t: 'opened'; worlds: WorldId[]; regions: RegionId[] }
  | { t: 'regionTier'; region: RegionId; tier: RegionTier }
  | { t: 'medal'; skill: SkillId; medal: Medal; perler: number; xp: number }
  /** A gold medal when the four golden animals of its world are already found. */
  | { t: 'allGolden'; skill: SkillId; world: WorldId; perler: number }
  | { t: 'levelUp'; level: number; title: string | null; perler: number }
  | { t: 'item'; item: ItemId; source: ItemSource }
  /** A new animal (starter, friend node, Stjernefølet, golden or rainbow). Hatching is its own event. */
  | { t: 'animal'; animal: Animal; newSpecies: boolean }
  /** The child may pick a golden or a rainbow animal from a world (waits until chosen). */
  | { t: 'choice'; kind: 'gold' | 'rainbow'; world: WorldId; options: SpeciesId[] }
  /** The egg is warm enough. `species` is the child's choice so far (null: choose first). */
  | { t: 'eggReady'; species: SpeciesId | null; options: SpeciesId[]; fresh: boolean }
  | { t: 'hatch'; animal: Animal; egg: number }
  /** Nothing left to hatch: the egg's warmth became friendship for the buddy. */
  | { t: 'eggFriendship'; uid: string; amount: number }
  | { t: 'growth'; uid: string; stage: Stage; star: boolean }
  /** A new trick, cheer or call at a friendship level that is not a growth step. */
  | { t: 'friendship'; uid: string; level: number; unlock: FriendshipUnlock }
  | { t: 'trophy'; id: TrophyId; perler: number }
  /** A goal done: one more stamp in the stamp book. */
  | { t: 'goal'; goal: Goal; stamp: number }

export type RewardType = Reward['t']

/** Perler in a reward (0 when it pays none). */
export function perlerOf(r: Reward): number {
  return 'perler' in r ? r.perler : 0
}

/** XP in a reward (0 when it pays none). */
export function xpOf(r: Reward): number {
  return 'xp' in r ? r.xp : 0
}

export const totalPerler = (rs: readonly Reward[]): number => rs.reduce((s, r) => s + perlerOf(r), 0)
export const totalXp = (rs: readonly Reward[]): number => rs.reduce((s, r) => s + xpOf(r), 0)

/** Rewards that are more than the steady trickle of perler for answers (SPEC §5.7 acceptance 2–3). */
export function isRewardEvent(r: Reward): boolean {
  switch (r.t) {
    case 'learned': case 'answers': case 'golden': case 'hut':
      return false
    case 'trial':
      return r.passed
    default:
      return true
  }
}

/**
 * The big moments — the full-screen ceremonies of SPEC §5.8: a hatch or a new animal, growth, a
 * medal, a new thing (earned or bought), a level-up, a passed trial or finale, and the map opening
 * up (fog that lifts, the help bridge).
 */
export function isBigCeremony(r: Reward): boolean {
  switch (r.t) {
    case 'hatch': case 'animal': case 'growth': case 'medal': case 'item': case 'choice': case 'levelUp':
    case 'opened': case 'helpBridge':
      return true
    case 'trial':
      return r.passed
    default:
      return false
  }
}

// ─── Reward log (parents see what was earned and how) ─────────────────────

export const REWARD_LOG_MAX = 200

/** Log rows for the rewards that leave something behind. */
export function logEntries(rewards: readonly Reward[], ts: number, why: string): RewardLogEntry[] {
  const out: RewardLogEntry[] = []
  let perler = 0
  for (const r of rewards) {
    perler += perlerOf(r)
    switch (r.t) {
      case 'stars':
        out.push({ ts, kind: 'stars', what: `${r.node}:${r.stars}`, why })
        break
      case 'medal':
        out.push({ ts, kind: 'medal', what: `${r.medal}:${r.skill}`, why: `medal:${r.medal}:${r.skill}` })
        break
      case 'levelUp':
        out.push({ ts, kind: 'level', what: String(r.level), why: `level:${r.level}` })
        break
      case 'item':
        out.push({ ts, kind: 'item', what: r.item, why: itemWhy(r.source) })
        break
      case 'animal':
        out.push({ ts, kind: 'animal', what: animalWhat(r.animal), why: `${r.animal.source}:${why}` })
        break
      case 'hatch':
        out.push({ ts, kind: 'animal', what: animalWhat(r.animal), why: `egg:${r.egg}` })
        break
      case 'growth':
        out.push({ ts, kind: 'growth', what: `${r.uid}:${r.star ? 'star' : r.stage}`, why: 'friendship' })
        break
      case 'trophy':
        out.push({ ts, kind: 'trophy', what: r.id, why })
        break
      default:
        break
    }
  }
  if (perler > 0) out.unshift({ ts, kind: 'perler', what: String(perler), why })
  return out
}

function itemWhy(s: ItemSource): string {
  switch (s.kind) {
    case 'level': return `level:${s.level}`
    case 'chest': return `node:${s.nodeId}`
    case 'finale': return `finale:${s.world}`
    case 'medal': return `medal:${s.tier}:${s.count}`
    case 'shop': return 'shop'
  }
}

const animalWhat = (a: Animal) => `${a.species}:${a.breed}:${a.colorway}`

/** profile.rewardLog with new rows appended (newest last, the last 200 kept). */
export function appendLog(log: ProfileDoc['rewardLog'], rows: readonly RewardLogEntry[]): ProfileDoc['rewardLog'] {
  if (rows.length === 0) return log
  return [...log, ...rows].slice(-REWARD_LOG_MAX)
}
