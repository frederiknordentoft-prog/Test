import { create } from 'zustand'
import { learningDay } from '../engine/learningDay'
import { statusOf, upgradeMedal, learningEventsFor } from '../engine/status'
import { skillRegistry, type SkillRegistry } from '../engine/registry'
import { trialOutcome } from '../engine/trial'
import type {
  DecorId, ItemColor, ItemId, KeyState, LearningEvent, MasteryKey, ProfileDoc, RegionId, Slot, SkillId, SpeciesId, Stage,
} from '../engine/types'
import { NODE_BY_ID } from '../content/curriculum'
import { levelProgress, titleFor, eggWarmthFor } from '../content/economy'
import { nextGoal } from '../content/goals'
import * as actions from '../meta/actions'
import { eggOptions, pendingChoices, type PendingChoice } from '../meta/animals'
import { planCeremonies, type CeremonyPlan } from '../meta/ceremonyQueue'
import { applyRoundResult, goalsFor } from '../meta/progression'
import type { Reward } from '../meta/rewards'
import { unlockView, type UnlockView } from '../meta/unlock'
import { onRoundFinished, useProfile } from './useProfile'
import type { RoundResult } from './useRound'

/**
 * The game layer's glue (SPEC §5.7–5.8, §6–7). installMeta() registers the round-finished handler:
 * it works out what the round taught (learningEventsFor, from the progress captured when the round
 * started), applies the round with applyRoundResult, writes the result through useProfile.update —
 * which refuses any change that would take something earned away — and plans the ceremonies for the
 * end-of-round screen. Every action of the child outside a round goes the same way, so all of it is
 * persisted by the data layer and nothing bypasses its guard.
 */

type Progress = Pick<ProfileDoc, 'keys' | 'skillStats' | 'skillMedals'>

export interface MetaState {
  /** The end of the last finished round, for the end-of-round screen (null when dismissed). */
  ceremony: CeremonyPlan | null
  /** Its rewards in the order they happened. */
  rewards: Reward[]
  /** Rewards of the last action (a hatch, a purchase …), for its overlay. */
  lastAction: Reward[]
  /** Keys missed in the last failed trial per region: the training hut's round (PlanContext.hutKeys). */
  hutKeys: Partial<Record<RegionId, MasteryKey[]>>

  dismissCeremony(): void
  chooseStarter(species: SpeciesId): boolean
  chooseEggSpecies(species: SpeciesId): boolean
  /** The third tap on a warm egg. Returns the hatch reward, or null when the egg is not ready. */
  openEgg(species?: SpeciesId): Reward[] | null
  nameAnimal(uid: string, name: string): boolean
  setBuddy(uid: string): boolean
  setShownForm(uid: string, form: Stage | 'star'): boolean
  wear(uid: string, item: ItemId, color?: ItemColor): boolean
  takeOff(uid: string, slot: Slot): boolean
  buyItem(item: ItemId): boolean
  buyRecolor(item: ItemId, color: ItemColor): boolean
  buyDecor(id: DecorId): boolean
  placeDecor(id: DecorId, x: number, y: number): boolean
  setWish(item: ItemId | null): boolean
  /** Pick the golden animal a gold medal earned. */
  chooseGolden(species: SpeciesId): boolean
  /** Pick the rainbow animal three stars everywhere in a region earned. */
  chooseRainbow(species: SpeciesId): boolean
  /** New goals on a new learning day (call when a profile is shown; never on the same day). */
  refreshGoals(): boolean
}

let clock: () => number = () => Date.now()

function apply(result: actions.ActionResult | null): boolean {
  if (!result) return false
  const ok = useProfile.getState().update(() => result.profile)
  if (ok) useMeta.setState({ lastAction: result.rewards })
  return ok
}

const doc = () => useProfile.getState().profile

export const useMeta = create<MetaState>((set) => ({
  ceremony: null,
  rewards: [],
  lastAction: [],
  hutKeys: {},

  dismissCeremony() {
    set({ ceremony: null })
  },
  chooseStarter(species) {
    const p = doc()
    return !!p && apply(actions.chooseStarter(p, species, { now: clock() }))
  },
  chooseEggSpecies(species) {
    const p = doc()
    return !!p && apply(actions.chooseEggSpecies(p, species))
  },
  openEgg(species) {
    const p = doc()
    const result = p ? actions.openEgg(p, { now: clock() }, species) : null
    return apply(result) ? result!.rewards : null
  },
  nameAnimal(uid, name) {
    const p = doc()
    return !!p && apply(actions.nameAnimal(p, uid, name))
  },
  setBuddy(uid) {
    const p = doc()
    return !!p && apply(actions.setBuddy(p, uid))
  },
  setShownForm(uid, form) {
    const p = doc()
    return !!p && apply(actions.setShownForm(p, uid, form))
  },
  wear(uid, item, color = 0) {
    const p = doc()
    return !!p && apply(actions.wear(p, uid, item, color))
  },
  takeOff(uid, slot) {
    const p = doc()
    return !!p && apply(actions.takeOff(p, uid, slot))
  },
  buyItem(item) {
    const p = doc()
    return !!p && apply(actions.buyItem(p, item, { now: clock() }))
  },
  buyRecolor(item, color) {
    const p = doc()
    return !!p && apply(actions.buyRecolor(p, item, color, { now: clock() }))
  },
  buyDecor(id) {
    const p = doc()
    return !!p && apply(actions.buyDecor(p, id, { now: clock() }))
  },
  placeDecor(id, x, y) {
    const p = doc()
    return !!p && apply(actions.placeDecor(p, id, x, y))
  },
  setWish(item) {
    const p = doc()
    return !!p && apply(actions.setWish(p, item))
  },
  chooseGolden(species) {
    const p = doc()
    return !!p && apply(actions.chooseMagic(p, 'gold', species, { now: clock() }))
  },
  chooseRainbow(species) {
    const p = doc()
    return !!p && apply(actions.chooseMagic(p, 'rainbow', species, { now: clock() }))
  },
  refreshGoals() {
    const day = learningDay(clock())
    return useProfile.getState().update((p) => {
      const goals = goalsFor(p, day)
      return goals === p.goals ? p : { ...p, goals }
    })
  },
}))

// ─── What the map and the HUD read ──────────────────────────────────────────

export interface MetaView {
  unlock: UnlockView
  level: number
  title: string
  /** 0–1 towards the next level (the XP ring; no numbers for the child). */
  levelProgress: number
  /** 0–1 egg warmth (the egg meter). */
  egg: number
  eggReady: boolean
  /** Species the egg can be (grey in the picker when a species is complete). */
  eggOptions: SpeciesId[]
  /** Golden and rainbow animals waiting to be picked. */
  pending: PendingChoice[]
  /** 0–1 towards the pinned wish, or null without one. */
  wish: number | null
}

export function metaView(p: ProfileDoc): MetaView {
  const need = eggWarmthFor(p.economy.eggsHatched + 1)
  return {
    unlock: unlockView(p),
    level: p.economy.level,
    title: titleFor(p.economy.level).title,
    levelProgress: levelProgress(p.economy.xp),
    egg: Math.min(1, p.economy.eggWarmth / need),
    eggReady: p.economy.eggWarmth >= need,
    eggOptions: eggOptions(p),
    pending: pendingChoices(p),
    wish: actions.wishProgress(p),
  }
}

// ─── The progress a round started from ──────────────────────────────────────

/** sessionStorage: the round's own keys before it started, so a reload mid-round still finds them. */
export const ROUND_START_KEY = 'talvennerne2.meta.roundStart'

interface RoundStart {
  roundId: string
  profileId: string
  /** In memory: the whole progress at the start (immutable objects, so this is only references). */
  progress: Progress | null
  /** Persisted: the round's keys and skill stats as they were (null = not there yet). */
  keys: Record<MasteryKey, KeyState | null>
  stats: Partial<Record<SkillId, { prodCorrect: number; prodDays: string[] } | null>>
}

let roundStart: RoundStart | null = null

/** Forget the in-memory copy, as a page reload does (tests use it to reach the sessionStorage copy). */
export function dropRoundStartMemory(): void {
  roundStart = null
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

function capture(p: ProfileDoc): void {
  const snap = p.round
  if (!snap) return
  const tasks = [...(snap.current ? [snap.current] : []), ...snap.queue]
  const keys: RoundStart['keys'] = {}
  const stats: RoundStart['stats'] = {}
  for (const t of tasks) {
    keys[t.masteryKey] = p.keys[t.masteryKey] ?? null
    stats[t.skill] = p.skillStats[t.skill] ?? null
  }
  roundStart = { roundId: snap.roundId, profileId: p.id, progress: { keys: p.keys, skillStats: p.skillStats, skillMedals: p.skillMedals }, keys, stats }
  try {
    storage()?.setItem(ROUND_START_KEY, JSON.stringify({ ...roundStart, progress: null }))
  } catch {
    // storage full or blocked: the in-memory copy still serves this page
  }
}

function stored(roundId: string, profileId: string): RoundStart | null {
  if (roundStart && roundStart.roundId === roundId && roundStart.profileId === profileId) return roundStart
  try {
    const raw = storage()?.getItem(ROUND_START_KEY)
    const parsed = raw ? (JSON.parse(raw) as RoundStart) : null
    return parsed && parsed.roundId === roundId && parsed.profileId === profileId ? parsed : null
  } catch {
    return null
  }
}

/** The progress before the round: captured at its start, rebuilt from the saved keys after a reload. */
export function progressBefore(after: ProfileDoc, roundId: string): Progress {
  const start = stored(roundId, after.id)
  if (start?.progress) return start.progress
  if (!start) return { keys: after.keys, skillStats: after.skillStats, skillMedals: after.skillMedals }
  const keys = { ...after.keys }
  for (const [k, v] of Object.entries(start.keys)) {
    if (v) keys[k] = v
    else delete keys[k]
  }
  const skillStats = { ...after.skillStats }
  for (const [s, v] of Object.entries(start.stats) as [SkillId, RoundStart['stats'][SkillId]][]) {
    if (v) skillStats[s] = v
    else delete skillStats[s]
  }
  return { keys, skillStats, skillMedals: after.skillMedals }
}

/** Medals the round's skills have reached but the profile does not hold yet (never lost to a reload). */
function medalCatchUp(after: ProfileDoc, skills: readonly SkillId[], events: readonly LearningEvent[], reg: SkillRegistry): LearningEvent[] {
  const out: LearningEvent[] = []
  for (const skill of new Set(skills)) {
    if (events.some((e) => e.t === 'medal' && e.skill === skill)) continue
    const had = after.skillMedals[skill]
    const medal = upgradeMedal(had, statusOf(skill, after, reg))
    if (medal && medal !== had) out.push({ t: 'medal', skill, medal })
  }
  return out
}

function safely<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch (err) {
    console.error(err)
    return fallback
  }
}

/** What the game layer does with a finished round (exported for tests). */
export function handleRoundFinished(result: RoundResult, reg: SkillRegistry = skillRegistry()): Reward[] {
  const after = useProfile.getState().profile
  if (!after || result.mode === 'placement') return []
  const before = progressBefore(after, result.roundId)
  const events = safely(() => learningEventsFor(before, after, reg), [])
  events.push(...safely(() => medalCatchUp(after, result.firstTries.map((f) => f.skill), events, reg), []))
  const { profile, rewards } = applyRoundResult(after, result, { events, day: learningDay(result.endedAt), now: result.endedAt })
  if (!useProfile.getState().update(() => profile)) {
    // the store refused (it never lets anything earned go): celebrate nothing that was not saved
    useMeta.setState({ ceremony: null, rewards: [] })
    return []
  }

  const hutKeys = { ...useMeta.getState().hutKeys }
  const region = NODE_BY_ID[result.nodeId]?.region
  if (result.mode === 'trial' && region) {
    const outcome = trialOutcome(result.firstTries, 'trial')
    if (outcome.passed) delete hutKeys[region]
    else hutKeys[region] = outcome.missed
  }
  const saved = useProfile.getState().profile ?? profile
  useMeta.setState({ ceremony: planCeremonies(rewards, { nextGoal: nextGoal(saved.goals) }), rewards, hutKeys })
  if (roundStart?.roundId === result.roundId) roundStart = null
  try {
    storage()?.removeItem(ROUND_START_KEY)
  } catch {
    // nothing to clean up
  }
  return rewards
}

export interface MetaOptions {
  now?: () => number
  /** Defaults to the registered skills. */
  skills?: SkillRegistry
}

/**
 * Start the game layer: the round-finished handler, the capture of each round's starting progress,
 * and the goals of the day when a profile is loaded. Returns a function that stops it all.
 */
export function installMeta(opts: MetaOptions = {}): () => void {
  if (opts.now) clock = opts.now
  const reg = opts.skills
  const off = onRoundFinished((result) => {
    handleRoundFinished(result, reg ?? skillRegistry())
  })
  let lastProfile: string | null = null
  const unsub = useProfile.subscribe((state) => {
    const p = state.profile
    if (!p) {
      lastProfile = null
      return
    }
    // a round that has just started: remember what the child knew before it
    const snap = p.round
    if (snap && snap.answered === 0 && snap.firstTries.length === 0 && (roundStart?.roundId !== snap.roundId || roundStart.profileId !== p.id)) capture(p)
    if (p.id !== lastProfile) {
      lastProfile = p.id
      queueMicrotask(() => useMeta.getState().refreshGoals())
    }
  })
  return () => {
    off()
    unsub()
    clock = () => Date.now()
  }
}
