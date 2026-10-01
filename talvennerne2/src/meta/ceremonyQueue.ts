// The end of a round (SPEC §5.8): learning first, then the things. The order is fixed —
// "Det lærte du" (keys that moved and one next goal) → stars → perler/XP → trial and fog → medal →
// level-up → growth → things → the hatch, always last. At most three ceremonies take the full
// screen, and the whole end takes at most 6 s (12 s with a hatch); the rest wait as small
// "Også i dag" cards. Everything can be skipped with one tap, nothing blocks input for more than
// 1 s, and nothing starts the next round by itself.
import type { Goal, SpeechPart } from '../engine/types'
import { totalPerler, totalXp, type Reward } from './rewards'

export type CeremonyKind =
  | 'learned' | 'stars' | 'tally' | 'trial' | 'medal' | 'levelUp' | 'growth' | 'thing' | 'hatch'

export const CEREMONY_ORDER: readonly CeremonyKind[] = [
  'learned', 'stars', 'tally', 'trial', 'medal', 'levelUp', 'growth', 'thing', 'hatch',
]

/** Planned duration of each full-screen step (ms). The summary (learned, stars, tally) is one screen of 2 s. */
export const CEREMONY_MS: Readonly<Record<CeremonyKind, number>> = {
  learned: 1000, stars: 500, tally: 500,
  trial: 2000, medal: 2000, levelUp: 2500, growth: 3000, thing: 1500, hatch: 5000,
}
/** A new animal (friend node, Stjernefølet, golden or rainbow) gets a little longer than an item. */
export const ANIMAL_MS = 2000

export const MAX_FULL_SCREEN = 3
export const MAX_END_MS = 6000
export const MAX_END_MS_WITH_HATCH = 12000
/** Input is never blocked for longer than this. */
export const MAX_BLOCK_MS = 1000
/** The hatch is three taps on the egg. */
export const HATCH_TAPS = 3

export interface CeremonyStep {
  kind: CeremonyKind
  rewards: Reward[]
  ms: number
  /** Taps are ignored for this long at the start (never more than 1 s). */
  blockMs: number
  /** One tap skips the step; the hatch skips straight to the new animal. */
  skip: 'tap' | 'reveal'
  /** The hatch needs three taps; the egg's species may have to be picked first. */
  taps?: number
  speech: SpeechPart[]
}

export interface CeremonyCard {
  kind: CeremonyKind
  reward: Reward
  speech: SpeechPart[]
}

export interface CeremonyPlan {
  /** Full-screen steps in order: the summary first, at most three ceremonies, the hatch last. */
  steps: CeremonyStep[]
  /** "Også i dag": the rest, as small cards in the same order. */
  alsoToday: CeremonyCard[]
  totalMs: number
  /** "Næste" and "Til kortet" are the same size, neither has focus, nothing starts by itself. */
  buttons: readonly ['next', 'toMap']
  autoFocus: null
  autoStart: false
}

export function kindOf(r: Reward): CeremonyKind | null {
  switch (r.t) {
    case 'learned': return 'learned'
    case 'stars': return 'stars'
    case 'answers': case 'golden': case 'spark': return 'tally'
    case 'trial': case 'helpBridge': case 'hut': case 'opened': case 'regionTier': return 'trial'
    case 'medal': case 'allGolden': return 'medal'
    case 'levelUp': return 'levelUp'
    case 'growth': case 'friendship': case 'eggFriendship': return 'growth'
    case 'item': case 'animal': case 'choice': case 'trophy': case 'goal': return 'thing'
    case 'eggReady': case 'hatch': return 'hatch'
  }
}

/**
 * How much a reward deserves the full screen (higher first). Smaller news goes to the cards: the
 * hut, a friendship trick, a trophy, a stamp, the region's colour.
 */
export function weightOf(r: Reward): number {
  switch (r.t) {
    // an egg the child left for later waits on a card (and on the map), it is not shown again
    case 'eggReady': return r.fresh ? 100 : 0
    case 'hatch': return 100
    case 'trial': return r.passed ? 90 : 80
    case 'animal': return 85
    case 'choice': return 84
    case 'medal': return r.medal === 'gold' ? 75 : r.medal === 'silver' ? 72 : 70
    case 'growth': return 65
    case 'levelUp': return 60
    case 'item': return r.source.kind === 'level' ? 50 : 55
    case 'opened': return 45
    default: return 0
  }
}

function msOf(kind: CeremonyKind, rs: readonly Reward[]): number {
  if (kind === 'thing' && rs.some((r) => r.t === 'animal' || r.t === 'choice')) return ANIMAL_MS
  return CEREMONY_MS[kind]
}

const clip = (id: string): SpeechPart => ({ clip: id })

/** What the step says (the screens add names, numbers and the next goal's own words). */
export function speechFor(kind: CeremonyKind, rs: readonly Reward[]): SpeechPart[] {
  const r = rs[0]
  switch (kind) {
    case 'learned': return [clip('s.reward.learned')]
    case 'stars': {
      const s = rs.find((x) => x.t === 'stars')
      const n = s && s.t === 'stars' ? s.stars - s.from : 1
      return [clip(n >= 3 ? 's.reward.stars.3' : n === 2 ? 's.reward.stars.2' : 's.reward.stars.1')]
    }
    case 'tally': return [clip('s.reward.tally')]
    case 'trial':
      if (r.t === 'trial') {
        if (r.finale && r.passed) return [clip('s.reward.finale.passed')]
        return [clip(r.passed ? 's.reward.trial.passed' : 's.reward.trial.ready')]
      }
      if (r.t === 'helpBridge') return [clip('s.reward.helpBridge')]
      if (r.t === 'hut') return [clip('s.reward.hut')]
      if (r.t === 'regionTier') return [clip('s.reward.regionTier')]
      return [clip(r.t === 'opened' && r.worlds.length > 0 ? 's.reward.world.open' : 's.reward.region.open')]
    case 'medal':
      if (r.t === 'medal') return [clip(`s.reward.medal.${r.medal}`)]
      return [clip('s.reward.allGolden')]
    case 'levelUp': return [clip('s.reward.level')]
    case 'growth':
      if (r.t === 'growth') return [clip(r.star ? 's.reward.growth.star' : r.stage === 3 ? 's.reward.growth.grown' : 's.reward.growth.young')]
      if (r.t === 'friendship') return [clip(`s.reward.friendship.${r.unlock}`)]
      return [clip('s.reward.egg.friendship')]
    case 'thing':
      switch (r.t) {
        case 'animal':
          if (r.animal.source === 'starFoal') return [clip('s.reward.starfoal')]
          if (r.animal.source === 'gold' || r.animal.source === 'rainbow') return [clip('s.reward.animal.magic')]
          return [clip(r.newSpecies ? 's.reward.animal.friend' : 's.reward.animal.color')]
        case 'choice': return [clip(r.kind === 'gold' ? 's.reward.gold.choose' : 's.reward.rainbow.choose')]
        case 'trophy': return [clip('s.reward.trophy')]
        case 'goal': return [clip('s.reward.goal.done')]
        case 'item': return [clip(r.source.kind === 'chest' ? 's.reward.chest' : 's.reward.item.new')]
        default: return []
      }
    case 'hatch':
      if (r.t === 'eggReady' && r.species === null) return [clip('s.reward.egg.ready'), clip('s.reward.egg.choose')]
      return [clip('s.reward.egg.ready')]
  }
}

interface Group { kind: CeremonyKind; rewards: Reward[]; weight: number }

/**
 * Plan the end of a round from its rewards. `nextGoal` is shown with "Det lærte du" when the rewards
 * carry none.
 */
export function planCeremonies(rewards: readonly Reward[], opts: { nextGoal?: Goal | null } = {}): CeremonyPlan {
  const byKind = new Map<CeremonyKind, Reward[]>()
  for (const r of rewards) {
    const kind = kindOf(r)
    if (!kind) continue
    const list = byKind.get(kind)
    if (list) list.push(r)
    else byKind.set(kind, [r])
  }

  // the summary screen: always "Det lærte du", then the stars and the count-up when there are any
  const steps: CeremonyStep[] = []
  const learned = byKind.get('learned') ?? [{
    t: 'learned', promoted: [], firsts: [], statuses: [], practiced: [], next: opts.nextGoal ?? null,
  } satisfies Reward]
  const summary: [CeremonyKind, Reward[]][] = [['learned', learned]]
  if (byKind.has('stars')) summary.push(['stars', byKind.get('stars')!])
  const tally = byKind.get('tally') ?? []
  if (totalPerler(tally) > 0 || totalXp(tally) > 0) summary.push(['tally', tally])
  for (const [kind, rs] of summary) steps.push(step(kind, rs))

  // ceremonies: one group per kind and per big reward; each reward's weight decides who gets the screen
  const groups: Group[] = []
  const cards: CeremonyCard[] = []
  for (const kind of CEREMONY_ORDER.slice(3)) {
    for (const r of byKind.get(kind) ?? []) {
      const weight = weightOf(r)
      if (weight <= 0) cards.push({ kind, reward: r, speech: speechFor(kind, [r]) })
      else groups.push({ kind, rewards: [r], weight })
    }
  }
  // a trial step also lifts the fog it opened
  const trial = groups.find((g) => g.kind === 'trial' && g.rewards[0].t === 'trial')
  const fog = groups.find((g) => g.rewards[0].t === 'opened')
  if (trial && fog) {
    trial.rewards.push(fog.rewards[0])
    groups.splice(groups.indexOf(fog), 1)
  }

  // the hatch is the climax and always gets its screen; then the weightiest that fit the time
  const hatch = groups.find((g) => g.kind === 'hatch')
  const budget = hatch ? MAX_END_MS_WITH_HATCH : MAX_END_MS
  let used = steps.reduce((s, x) => s + x.ms, 0)
  const chosen = new Set<Group>()
  if (hatch) {
    chosen.add(hatch)
    used += msOf('hatch', hatch.rewards)
  }
  const ranked = [...groups].sort((a, b) => b.weight - a.weight || CEREMONY_ORDER.indexOf(a.kind) - CEREMONY_ORDER.indexOf(b.kind))
  for (const g of ranked) {
    if (chosen.size >= MAX_FULL_SCREEN) break
    if (chosen.has(g)) continue
    const ms = msOf(g.kind, g.rewards)
    if (used + ms > budget) continue
    chosen.add(g)
    used += ms
  }
  const full = groups.filter((g) => chosen.has(g))
    .sort((a, b) => CEREMONY_ORDER.indexOf(a.kind) - CEREMONY_ORDER.indexOf(b.kind) || b.weight - a.weight)
  for (const g of full) steps.push(step(g.kind, g.rewards))
  for (const g of groups) if (!chosen.has(g)) for (const r of g.rewards) cards.push({ kind: g.kind, reward: r, speech: speechFor(g.kind, [r]) })
  cards.sort((a, b) => CEREMONY_ORDER.indexOf(a.kind) - CEREMONY_ORDER.indexOf(b.kind))

  return {
    steps,
    alsoToday: cards,
    totalMs: steps.reduce((s, x) => s + x.ms, 0),
    buttons: ['next', 'toMap'],
    autoFocus: null,
    autoStart: false,
  }
}

function step(kind: CeremonyKind, rewards: Reward[]): CeremonyStep {
  const ms = msOf(kind, rewards)
  return {
    kind,
    rewards,
    ms,
    blockMs: Math.min(MAX_BLOCK_MS, kind === 'hatch' ? 300 : 400),
    skip: kind === 'hatch' ? 'reveal' : 'tap',
    ...(kind === 'hatch' ? { taps: HATCH_TAPS } : {}),
    speech: speechFor(kind, rewards),
  }
}
