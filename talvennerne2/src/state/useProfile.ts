import { create } from 'zustand'
import { SKILL_BY_ID } from '../content/skills'
import {
  answerDelta, emptyDaily, isFirstTry, learnDelta, mergeDaily, passedTrialOf, playDelta, roundDelta,
  snapshotFor,
} from '../data/aggregate'
import { getDb } from '../data/db'
import { newId } from '../data/ids'
import { withoutSeq } from '../data/repo/answers'
import { getProfile } from '../data/repo/profiles'
import { learningDay } from '../engine/learningDay'
import { countsForMastery, updateKey } from '../engine/mastery'
import { classifyAnswer, detectableOf, updateMisconceptions } from '../engine/misconceptions'
import { offeredTagsOf } from '../engine/tasks'
import {
  SKILL_IDS,
  type AnswerLogEntry, type DailyAggregate, type MasteryKey, type Medal, type ProfileDoc,
  type ProfileId, type ProfileSettings, type RoundSnapshot, type SkillId,
} from '../engine/types'
import type { AnswerRecord, RoundHooks, RoundResult } from './useRound'

/**
 * The active child's profile and the write path to IndexedDB (SPEC §9.2 "Skrivesti").
 *
 * The ProfileDoc in this store is the truth while the child plays: every change is applied here
 * synchronously and then queued. A queued batch is written in ONE read-write transaction over
 * `profiles`, `answers` and `daily`, so an answer never reaches the disk without the profile and the
 * day it changed, nor they without it. useRound calls hooks.answer() and hooks.snapshot() in the same
 * tick, and the queue is flushed in a microtask, so each answer and the round snapshot taken right
 * after it land in the same transaction. The queue is also flushed on visibilitychange → hidden and
 * pagehide, before another profile is loaded, and on flush().
 *
 * Batches are written one after another in the order they were made. A failed write stays at the
 * front of the queue and is retried (after 3 s, or with the next flush); the child plays on.
 */

export interface ProfileContext {
  /** The current app start (set by useSession). Play time and sessions are counted per session. */
  sessionId: string
  /** The device passed the sound check; answers are logged as audioUnverified otherwise. */
  audioVerified: boolean
}

export interface ProfileStore {
  profile: ProfileDoc | null
  status: 'empty' | 'loading' | 'ready'
  /** Message of the last failed write, null after a successful one. */
  saveError: string | null
  context: ProfileContext

  setContext(patch: Partial<ProfileContext>): void
  /** Write what is pending, then load a profile (null when it does not exist). */
  loadProfile(id: ProfileId): Promise<ProfileDoc | null>
  /** Write what is pending and forget the profile; `discard` drops the pending writes instead. */
  unload(opts?: { discard?: boolean }): Promise<void>
  /** One evaluated answer: mastery, stats, misconceptions, the log row and the day. */
  recordAnswer(rec: AnswerRecord): AnswerLogEntry | null
  /** The round's resume point (null when the round is over or abandoned). */
  saveRound(snapshot: RoundSnapshot | null): void
  /** A finished round: roundIndex + 1, the day's rounds, skill snapshot and passed trial. */
  finishRound(result: RoundResult): void
  /**
   * General change for the game layer (economy, animals, inventory …). `fn` returns a new document;
   * id, frameColor and createdAt cannot change, and a change that loses anything earned is refused
   * (SPEC §13.11). Returns whether the change was applied.
   */
  update(fn: (doc: ProfileDoc) => ProfileDoc): boolean
  setSettings(patch: Partial<ProfileSettings>): void
  /** Time with animals, wardrobe, shop or books, reported by the UI (clamped to 30 min per call). */
  trackPlay(ms: number, at?: number): void
  /** Write everything queued so far. Never rejects; see saveError. */
  flush(): Promise<void>
}

const MAX_MS = 120_000
const RECENT_FIRST_TRIES = 10
const ACCURACY_WINDOW = 20
const PROD_DAYS_KEPT = 30
const PLAY_MAX_MS = 30 * 60_000
const RETRY_MS = 3000

// ─── Per-profile caches (not persisted; rebuilt on load) ───────────────────

/** First-try results per skill, oldest first (for skillAccuracy20). */
let recentBySkill = new Map<SkillId, boolean[]>()
/** Mastery key → skill, for keys seen in the log or in play (the snapshot's key lists). */
let keySkill = new Map<MasteryKey, SkillId>()
/** `${profileId}|${roundId}` → time of the last input in that round (learning time). */
const lastInputAt = new Map<string, number>()
/** `${profileId}|${sessionId}|${day}` already counted in daily.sessions. */
const countedSessions = new Set<string>()
let loadToken = 0

function resetCaches(): void {
  recentBySkill = new Map()
  keySkill = new Map()
  lastInputAt.clear()
}

function knownKeysOf(skill: SkillId): MasteryKey[] {
  const out: MasteryKey[] = []
  for (const [key, s] of keySkill) if (s === skill) out.push(key)
  return out
}

// ─── Write queue ────────────────────────────────────────────────────────────

interface Batch {
  profileId: ProfileId
  doc: ProfileDoc | null
  answers: AnswerLogEntry[]
  /** Per-day deltas, merged into the stored rows inside the transaction. */
  daily: Map<string, DailyAggregate>
}

let pending: Batch | null = null
const outbox: Batch[] = []
let scheduled = false
let writing: Promise<void> | null = null
/** The batch whose transaction is running. */
let inFlight: Batch | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null

function enqueue(profileId: ProfileId, change: { doc?: ProfileDoc; answer?: AnswerLogEntry; daily?: DailyAggregate }): void {
  // a batch never mixes profiles
  if (pending && pending.profileId !== profileId) detach()
  const fresh: Batch = { profileId, doc: null, answers: [], daily: new Map() }
  const b = (pending ??= fresh)
  if (change.doc) b.doc = change.doc
  if (change.answer) b.answers.push(change.answer)
  if (change.daily) {
    const prev = b.daily.get(change.daily.day)
    b.daily.set(change.daily.day, prev ? mergeDaily(prev, change.daily) : change.daily)
  }
  if (!scheduled) {
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      void flushQueue()
    })
  }
}

function mergeBatch(into: Batch, b: Batch): void {
  if (b.doc) into.doc = b.doc
  into.answers.push(...b.answers)
  for (const [day, delta] of b.daily) {
    const prev = into.daily.get(day)
    into.daily.set(day, prev ? mergeDaily(prev, delta) : delta)
  }
}

function detach(): void {
  if (!pending) return
  const last = outbox[outbox.length - 1]
  // join a batch of the same child that is still waiting (a failed write, or one queued behind the
  // write in flight): one transaction later instead of a growing queue
  if (last && last !== inFlight && last.profileId === pending.profileId) mergeBatch(last, pending)
  else outbox.push(pending)
  pending = null
}

async function writeBatch(b: Batch): Promise<void> {
  const db = getDb()
  await db.transaction('rw', [db.profiles, db.answers, db.daily], async () => {
    // never bring back a profile that was deleted in the meantime
    if ((await db.profiles.where('id').equals(b.profileId).count()) === 0) return
    if (b.doc) await db.profiles.put(b.doc)
    if (b.answers.length > 0) await db.answers.bulkAdd(b.answers.map(withoutSeq))
    for (const delta of b.daily.values()) {
      const stored = await db.daily.get([b.profileId, delta.day])
      await db.daily.put(stored ? mergeDaily({ ...emptyDaily(b.profileId, delta.day), ...stored }, delta) : delta)
    }
  })
}

/** A value IndexedDB cannot clone (a function slipped into the document) fails forever; strip it. */
function sanitize(b: Batch): void {
  const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
  if (b.doc) b.doc = plain(b.doc)
  b.answers = b.answers.map((e) => plain(e))
}

async function drain(): Promise<void> {
  while (outbox.length > 0) {
    const b = outbox[0]
    inFlight = b
    try {
      await writeBatch(b)
    } catch (err) {
      if ((err as { name?: string })?.name === 'DataCloneError') sanitize(b)
      useProfile.setState({ saveError: err instanceof Error ? err.message : String(err) })
      if (!retryTimer) {
        retryTimer = setTimeout(() => {
          retryTimer = null
          void flushQueue()
        }, RETRY_MS)
      }
      return
    } finally {
      inFlight = null
    }
    // remove by identity: unload({ discard }) may have filtered the outbox meanwhile
    const i = outbox.indexOf(b)
    if (i >= 0) outbox.splice(i, 1)
    if (useProfile.getState().saveError !== null) useProfile.setState({ saveError: null })
  }
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

function flushQueue(): Promise<void> {
  detach()
  if (!writing) {
    writing = drain().finally(() => {
      writing = null
    })
  }
  return writing
}

function dropQueued(profileId: ProfileId): void {
  if (pending?.profileId === profileId) pending = null
  // a batch in flight cannot be recalled; unload() waits for it and drops it if it failed
  for (let i = outbox.length - 1; i >= 0; i--) if (outbox[i].profileId === profileId && outbox[i] !== inFlight) outbox.splice(i, 1)
}

/** Batches not yet written (for a "saving…" hint and tests). */
export function pendingWrites(): number {
  return outbox.length + (pending ? 1 : 0)
}

// ─── Guards ─────────────────────────────────────────────────────────────────

const MEDAL_RANK: Record<Medal, number> = { bronze: 1, silver: 2, gold: 3 }

/** What a change would take away from the child, or null (SPEC §13.11: nothing earned is lost). */
export function lostEarnings(prev: ProfileDoc, next: ProfileDoc): string | null {
  const uids = new Set(next.animals.map((a) => a.uid))
  const animal = prev.animals.find((a) => !uids.has(a.uid))
  if (animal) return `dyret ${animal.uid}`
  for (const [item, entry] of Object.entries(prev.inventory)) {
    const now = next.inventory[item as keyof ProfileDoc['inventory']]
    if (!now) return `genstanden ${item}`
    if (entry && entry.colors.some((c) => !now.colors.includes(c))) return `en farve på ${item}`
  }
  for (const id of Object.keys(prev.decor)) if (!(id in next.decor)) return `pynten ${id}`
  for (const id of Object.keys(prev.achievements)) if (!(id in next.achievements)) return `trofæet ${id}`
  for (const [skill, medal] of Object.entries(prev.skillMedals) as [SkillId, Medal][]) {
    const now = next.skillMedals[skill]
    if (!now || MEDAL_RANK[now] < MEDAL_RANK[medal]) return `medaljen i ${skill}`
  }
  if (next.stamps < prev.stamps) return 'stempler'
  if (next.daysPlayed < prev.daysPlayed) return 'dage spillet'
  if (next.economy.xp < prev.economy.xp || next.economy.level < prev.economy.level) return 'niveau'
  if (next.economy.eggsHatched < prev.economy.eggsHatched) return 'klækkede æg'
  return null
}

// ─── Store ──────────────────────────────────────────────────────────────────

/** Diagnostics must never stop a child's round: a failing call is reported and skipped. */
function safely<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch (err) {
    console.error(err)
    return fallback
  }
}

function markSession(profileId: ProfileId, sessionId: string, day: string): boolean {
  const key = `${profileId}|${sessionId}|${day}`
  if (countedSessions.has(key)) return false
  countedSessions.add(key)
  return true
}

async function loadCaches(profileId: ProfileId): Promise<{ recent: Map<SkillId, boolean[]>; keys: Map<MasteryKey, SkillId> }> {
  const db = getDb()
  const recent = new Map<SkillId, boolean[]>()
  const keys = new Map<MasteryKey, SkillId>()
  const rows = await db.transaction('r', db.answers, () =>
    Promise.all(
      SKILL_IDS.map((skill) =>
        db.answers
          .where('[profileId+skill+ts]')
          .between([profileId, skill, -Infinity], [profileId, skill, Infinity], true, true)
          .reverse()
          .limit(2 * ACCURACY_WINDOW)
          .toArray(),
      ),
    ),
  )
  SKILL_IDS.forEach((skill, i) => {
    const newestFirst = rows[i]
    for (const e of newestFirst) keys.set(e.masteryKey, skill)
    const tries = newestFirst.filter(isFirstTry).slice(0, ACCURACY_WINDOW).map((e) => e.correct).reverse()
    if (tries.length > 0) recent.set(skill, tries)
  })
  return { recent, keys }
}

export const useProfile = create<ProfileStore>((set, get) => ({
  profile: null,
  status: 'empty',
  saveError: null,
  context: { sessionId: newId('s'), audioVerified: false },

  setContext(patch) {
    set({ context: { ...get().context, ...patch } })
  },

  async loadProfile(id) {
    const token = ++loadToken
    await flushQueue()
    set({ status: 'loading' })
    try {
      const doc = await getProfile(id)
      if (token !== loadToken) return get().profile
      if (!doc) {
        resetCaches()
        set({ profile: null, status: 'empty' })
        return null
      }
      const loaded = await loadCaches(id)
      if (token !== loadToken) return get().profile
      resetCaches()
      recentBySkill = loaded.recent
      keySkill = loaded.keys
      set({ profile: doc, status: 'ready' })
      return doc
    } catch (err) {
      // storage failed: stay with what was loaded before
      if (token === loadToken) set({ status: get().profile ? 'ready' : 'empty' })
      throw err
    }
  },

  async unload(opts = {}) {
    loadToken += 1
    const id = get().profile?.id
    if (opts.discard && id) {
      dropQueued(id)
      await (writing ?? Promise.resolve())
      dropQueued(id)
    } else {
      await flushQueue()
    }
    resetCaches()
    set({ profile: null, status: 'empty' })
  },

  recordAnswer(rec) {
    const doc = get().profile
    if (!doc) return null
    const { task } = rec
    const skill = task.skill
    const day = learningDay(rec.ts)
    const counts = countsForMastery(rec)
    const firstTry = isFirstTry(rec)

    // mastery
    const prevKey = doc.keys[task.masteryKey]
    const nextKey = updateKey(prevKey, {
      correct: rec.correct, fast: rec.fast, production: rec.production, ceiling: rec.ceiling, ms: rec.ms, ts: rec.ts, day,
      roundIndex: doc.roundIndex, mode: rec.mode, assisted: rec.assisted, retryOf: rec.retryOf,
      procedure: SKILL_BY_ID[skill]?.mode === 'procedure', instanceId: task.factId,
    })
    // procedure families remember the last 10 instances asked, so the next one is fresh
    const procedure = SKILL_BY_ID[skill]?.mode === 'procedure'
    const drawnKey = procedure && !rec.retryOf
      ? { ...nextKey, drawn: [...(nextKey.drawn ?? []).filter((id) => id !== task.factId), task.factId].slice(-10) }
      : nextKey
    const keys = counts ? { ...doc.keys, [task.masteryKey]: drawnKey } : doc.keys

    // the log row
    const entry: AnswerLogEntry = {
      profileId: doc.id, ts: rec.ts, day, sessionId: rec.sessionId, roundId: rec.roundId, nodeId: rec.nodeId, mode: rec.mode,
      skill, family: task.family, factId: task.factId, masteryKey: task.masteryKey, kind: task.kind,
      optionsCount: task.options.length, production: rec.production, given: rec.given, answer: task.answer,
      correct: rec.correct, ms: Math.min(MAX_MS, Math.max(0, Math.round(rec.ms))), fast: rec.fast,
      errorTag: rec.correct ? null : safely(() => classifyAnswer(task, rec.given), null),
      detectable: safely(() => detectableOf(task), []),
      boxBefore: prevKey?.box ?? 0, boxAfter: counts ? nextKey.box : prevKey?.box ?? 0, scaffold: task.scaffold,
      replays: rec.replays, retryOf: rec.retryOf, assisted: rec.assisted, audioUnverified: !get().context.audioVerified,
      ...(task.contrast ? { contrast: task.contrast } : {}),
    }

    // misconceptions, with this skill's first-try accuracy over the last 20 (this answer included)
    const window = recentBySkill.get(skill) ?? []
    const nextWindow = firstTry ? [...window, rec.correct].slice(-ACCURACY_WINDOW) : window
    const skillAccuracy20 = nextWindow.length > 0 ? nextWindow.filter(Boolean).length / nextWindow.length : 1
    const misconceptions = safely(() => updateMisconceptions(doc.misconceptions, entry, { skillAccuracy20, day, contrast: task.contrast }), doc.misconceptions)

    // correct production answers and their learning days (medal evidence)
    let skillStats = doc.skillStats
    if (counts && rec.correct && rec.production) {
      const st = doc.skillStats[skill] ?? { prodCorrect: 0, prodDays: [] }
      const prodDays = st.prodDays.includes(day) ? st.prodDays : [...st.prodDays, day].slice(-PROD_DAYS_KEPT)
      skillStats = { ...doc.skillStats, [skill]: { prodCorrect: st.prodCorrect + 1, prodDays } }
    }

    // new keys today (caps: 8 per skill, 20 per learning day)
    let newToday = doc.newToday.day === day ? doc.newToday : { day, total: 0, perSkill: {} }
    if (counts && (prevKey?.seen ?? 0) === 0 && nextKey.seen > 0) {
      newToday = { day, total: newToday.total + 1, perSkill: { ...newToday.perSkill, [skill]: (newToday.perSkill[skill] ?? 0) + 1 } }
    }

    // diagnostic distractors shown to the child (rotation, SPEC §4.1)
    let offeredTags = doc.offeredTags
    // only the cards actually shown count: distractorTags also holds every tagged candidate
    if (!rec.retryOf) {
      const tags = offeredTagsOf(task)
      if (tags.length > 0) {
        offeredTags = { ...doc.offeredTags }
        for (const tag of tags) offeredTags[tag] = (offeredTags[tag] ?? 0) + 1
      }
    }

    const newDay = doc.lastLearningDay === null || day > doc.lastLearningDay
    const next: ProfileDoc = {
      ...doc,
      keys,
      skillStats,
      newToday,
      offeredTags,
      misconceptions,
      recentFirstTries: firstTry && rec.mode !== 'placement'
        ? [...doc.recentFirstTries, rec.correct].slice(-RECENT_FIRST_TRIES)
        : doc.recentFirstTries,
      recentFast: firstTry && rec.mode !== 'placement'
        ? [...(doc.recentFast ?? []), rec.correct && rec.fast].slice(-RECENT_FIRST_TRIES)
        : doc.recentFast,
      daysPlayed: newDay ? doc.daysPlayed + 1 : doc.daysPlayed,
      lastLearningDay: newDay ? day : doc.lastLearningDay,
    }

    // the day
    const inputKey = `${doc.id}|${rec.roundId}`
    const learnMs = learnDelta(lastInputAt.get(inputKey) ?? null, rec.ts, entry.ms)
    lastInputAt.set(inputKey, rec.ts)
    const delta = answerDelta(entry, { learnMs, newSession: markSession(doc.id, rec.sessionId, day) })

    recentBySkill.set(skill, nextWindow)
    keySkill.set(task.masteryKey, skill)
    set({ profile: next })
    enqueue(doc.id, { doc: next, answer: entry, daily: delta })
    return entry
  },

  saveRound(snapshot) {
    const doc = get().profile
    if (!doc) return
    if (snapshot && snapshot.answered === 0 && snapshot.firstTries.length === 0) {
      // the round just started: the tap that started it is its first input
      const key = `${doc.id}|${snapshot.roundId}`
      if (!lastInputAt.has(key)) lastInputAt.set(key, snapshot.startedAt)
    }
    const next = { ...doc, round: snapshot }
    set({ profile: next })
    enqueue(doc.id, { doc: next })
  },

  finishRound(result) {
    const doc = get().profile
    if (!doc) return
    for (const f of result.firstTries) keySkill.set(f.key, f.skill)
    lastInputAt.delete(`${doc.id}|${result.roundId}`)
    const next: ProfileDoc = { ...doc, roundIndex: doc.roundIndex + 1 }
    const snapshot = snapshotFor(next, result.firstTries.map((f) => f.skill), knownKeysOf)
    const delta = roundDelta(doc.id, learningDay(result.endedAt), snapshot, passedTrialOf(result))
    set({ profile: next })
    enqueue(doc.id, { doc: next, daily: delta })
  },

  update(fn) {
    const doc = get().profile
    if (!doc) return false
    const changed = fn(doc)
    if (!changed || changed === doc) return false
    if (changed.id !== doc.id) {
      console.warn('useProfile.update: id kan ikke ændres')
      return false
    }
    const next: ProfileDoc = { ...changed, frameColor: doc.frameColor, createdAt: doc.createdAt }
    const lost = lostEarnings(doc, next)
    if (lost) {
      console.warn(`useProfile.update afvist: ${lost} ville gå tabt`)
      return false
    }
    set({ profile: next })
    enqueue(doc.id, { doc: next })
    return true
  },

  setSettings(patch) {
    get().update((doc) => ({ ...doc, settings: { ...doc.settings, ...patch } }))
  },

  trackPlay(ms, at = Date.now()) {
    const doc = get().profile
    if (!doc || !Number.isFinite(ms) || ms <= 0) return
    const day = learningDay(at)
    const newSession = markSession(doc.id, get().context.sessionId, day)
    enqueue(doc.id, { daily: playDelta(doc.id, day, Math.min(ms, PLAY_MAX_MS), newSession) })
  },

  flush() {
    return flushQueue()
  },
}))

// ─── Round hooks ────────────────────────────────────────────────────────────

export type RoundFinishHandler = (result: RoundResult) => void

const finishHandlers = new Set<RoundFinishHandler>()

/**
 * The game layer registers what happens when a round is over (rewards, stars, trials, ceremonies).
 * Handlers run after the data layer has booked the round. Returns an unregister function.
 */
export function onRoundFinished(handler: RoundFinishHandler): () => void {
  finishHandlers.add(handler)
  return () => {
    finishHandlers.delete(handler)
  }
}

export interface RoundHookOptions {
  now?: () => number
  /** SkillDef speed thresholds (passed through to useRound). */
  fastMs?: RoundHooks['fastMs']
  /** Golden-egg task builder (passed through; omit for rounds without an egg). */
  golden?: RoundHooks['golden']
  /** Called for this round only, after the data layer and before the registered handlers. */
  onFinish?: RoundFinishHandler
}

/**
 * RoundHooks for useRound, bound to the profile that is active now. If another profile has been
 * loaded since (a profile switch), the hooks do nothing: a round never writes into another child.
 */
export function roundHooks(opts: RoundHookOptions = {}): RoundHooks {
  const owner = useProfile.getState().profile?.id ?? null
  const mine = () => owner !== null && useProfile.getState().profile?.id === owner
  const hooks: RoundHooks = {
    answer(rec) {
      if (mine()) useProfile.getState().recordAnswer(rec)
    },
    snapshot(s) {
      if (mine()) useProfile.getState().saveRound(s)
    },
    finish(result) {
      if (!mine()) return
      useProfile.getState().finishRound(result)
      for (const handler of [...(opts.onFinish ? [opts.onFinish] : []), ...finishHandlers]) {
        try {
          handler(result)
        } catch (err) {
          console.error(err)
        }
      }
    },
    now: opts.now ?? (() => Date.now()),
  }
  if (opts.fastMs) hooks.fastMs = opts.fastMs
  if (opts.golden) hooks.golden = opts.golden
  return hooks
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

/**
 * Flush when the page is hidden or unloaded. iOS may kill a backgrounded tab without pagehide, so
 * visibilitychange → hidden is the one that matters; pagehide is the desktop fallback.
 */
export function flushOnHide(doc: EventTarget & { visibilityState?: string }, win: EventTarget): () => void {
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') void flushQueue()
  }
  const onPageHide = () => void flushQueue()
  doc.addEventListener('visibilitychange', onVisibility)
  win.addEventListener('pagehide', onPageHide)
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility)
    win.removeEventListener('pagehide', onPageHide)
  }
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') flushOnHide(document, window)
