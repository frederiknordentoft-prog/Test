// Profiles (SPEC §8, §9.2). At most six children per device, each with a fixed frame colour that no
// sibling shares. Deleting a profile removes every row that carries its id, in one transaction.
import { MAX_PROFILES } from '../../content/catalog'
import { FRAME_COLORS, type FrameColor, type Grade, type ProfileDoc, type ProfileId } from '../../engine/types'
import { TS_MAX, TS_MIN, getDb } from '../db'
import { newId } from '../ids'

/** Shape version of ProfileDoc; bump it with a pure migrate step when the document changes. */
export const PROFILE_VERSION = 1
export const NAME_MAX_LENGTH = 20

export class ProfileLimitError extends Error {
  constructor() {
    super(`Der kan højst være ${MAX_PROFILES} spillere på denne enhed.`)
    this.name = 'ProfileLimitError'
  }
}

export class ProfileNotFoundError extends Error {
  constructor(id: ProfileId) {
    super(`Spilleren findes ikke længere (${id}).`)
    this.name = 'ProfileNotFoundError'
  }
}

export interface NewProfileOptions {
  id?: ProfileId
  frameColor?: FrameColor
  now?: number
}

/** A complete, valid profile for a child who has not played yet. */
export function newProfileDoc(name: string, grade: Grade, opts: NewProfileOptions = {}): ProfileDoc {
  return {
    id: opts.id ?? newId('p'),
    version: PROFILE_VERSION,
    name: cleanName(name),
    grade,
    frameColor: opts.frameColor ?? FRAME_COLORS[0],
    createdAt: opts.now ?? Date.now(),
    settings: { sfx: true, speech: true, autoSpeak: true, calm: false, domainsOff: [] },
    placement: { done: false, at: null, highest: null },
    keys: {},
    skillStats: {},
    skillMedals: {},
    nodes: {},
    trials: {},
    unlocked: { worlds: [], regions: [] },
    roundIndex: 0,
    newToday: { day: '', total: 0, perSkill: {} },
    offeredTags: {},
    misconceptions: {},
    economy: { perler: 0, xp: 0, level: 1, eggWarmth: 0, eggsHatched: 0, eggSpecies: null, wish: null },
    animals: [],
    buddyUid: null,
    inventory: {},
    decor: {},
    achievements: {},
    goals: { day: '', list: [] },
    stamps: 0,
    daysPlayed: 0,
    lastLearningDay: null,
    demosSeen: {},
    instructionsHeard: {},
    recentFirstTries: [],
    round: null,
    rewardLog: [],
  }
}

/**
 * Fill fields a stored document lacks with the defaults (a document written by this version has
 * them all, and then the result equals the input). Used when loading and importing.
 */
export function withProfileDefaults(doc: ProfileDoc): ProfileDoc {
  const base = newProfileDoc(doc.name ?? '', doc.grade ?? 0, { id: doc.id, frameColor: doc.frameColor, now: doc.createdAt })
  return {
    ...base,
    ...doc,
    settings: { ...base.settings, ...doc.settings },
    placement: { ...base.placement, ...doc.placement },
    unlocked: { ...base.unlocked, ...doc.unlocked },
    newToday: { ...base.newToday, ...doc.newToday },
    economy: { ...base.economy, ...doc.economy },
    goals: { ...base.goals, ...doc.goals },
  }
}

/** Trimmed, single-spaced, without control characters, at most 20 characters. */
export function cleanName(name: string): string {
  const flat = name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return Array.from(flat).slice(0, NAME_MAX_LENGTH).join('').trim()
}

/** "Spiller N" with the smallest N that no profile uses. */
export function defaultName(taken: readonly string[]): string {
  const used = new Set(taken.map((n) => n.trim().toLowerCase()))
  for (let n = 1; ; n++) {
    const name = `Spiller ${n}`
    if (!used.has(name.toLowerCase())) return name
  }
}

export function freeFrameColors(used: readonly FrameColor[]): FrameColor[] {
  return FRAME_COLORS.filter((c) => !used.includes(c))
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/** All profiles, oldest first (the picker keeps a stable order). */
export async function listProfiles(): Promise<ProfileDoc[]> {
  const all = await getDb().profiles.toArray()
  return all.map(withProfileDefaults).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

export async function getProfile(id: ProfileId): Promise<ProfileDoc | undefined> {
  const doc = await getDb().profiles.get(id)
  return doc ? withProfileDefaults(doc) : undefined
}

export async function countProfiles(): Promise<number> {
  return getDb().profiles.count()
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export interface CreateProfileInput {
  /**
   * Optional id chosen in advance (a fresh newId('p')). Onboarding draws the first friend's breed
   * and colour from the profile id, so it picks the id before the eggs are shown: the baby peeking
   * out of an egg is the one that hatches (review P2-9).
   */
  id?: ProfileId
  /** Optional; "Spiller N" when empty. */
  name?: string
  grade: Grade
  /** Used when free, otherwise the first free colour. */
  frameColor?: FrameColor
  now?: number
}

/**
 * Create a profile. Throws ProfileLimitError at six. The first profile on the device also asks the
 * browser to keep storage persistent (iOS evicts script storage after about a week otherwise).
 */
export async function createProfile(input: CreateProfileInput): Promise<ProfileDoc> {
  const db = getDb()
  const { doc, first } = await db.transaction('rw', db.profiles, async () => {
    const all = await db.profiles.toArray()
    if (all.length >= MAX_PROFILES) throw new ProfileLimitError()
    const free = freeFrameColors(all.map((p) => p.frameColor))
    const frameColor = input.frameColor && free.includes(input.frameColor) ? input.frameColor : free[0]
    const name = cleanName(input.name ?? '') || defaultName(all.map((p) => p.name))
    const created = newProfileDoc(name, input.grade, { id: input.id, frameColor, now: input.now })
    await db.profiles.add(created)
    return { doc: created, first: all.length === 0 }
  })
  if (first) void requestPersistentStorage()
  return doc
}

/**
 * Store a whole profile document (import and tests; play goes through useProfile's write queue).
 * The frame colour must not collide with another profile's.
 */
export async function putProfile(doc: ProfileDoc): Promise<void> {
  const db = getDb()
  await db.transaction('rw', db.profiles, async () => {
    const others = (await db.profiles.toArray()).filter((p) => p.id !== doc.id)
    if (others.length >= MAX_PROFILES) throw new ProfileLimitError()
    if (others.some((p) => p.frameColor === doc.frameColor)) throw new Error(`Rammefarven ${doc.frameColor} er optaget.`)
    await db.profiles.put(doc)
  })
}

/** "Slet profil": the profile, its answers and its daily aggregates, all or nothing. */
export async function deleteProfile(id: ProfileId): Promise<{ answers: number; daily: number }> {
  const db = getDb()
  return db.transaction('rw', [db.profiles, db.answers, db.daily], async () => {
    await db.profiles.delete(id)
    const answers = await db.answers.where('[profileId+ts]').between([id, TS_MIN], [id, TS_MAX], true, true).delete()
    const daily = await db.daily.where('profileId').equals(id).delete()
    return { answers, daily }
  })
}

/** Ask for persistent storage where the API exists; never throws. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = (globalThis as { navigator?: Navigator }).navigator?.storage
    if (!storage || typeof storage.persist !== 'function') return false
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return true
    return await storage.persist()
  } catch {
    return false
  }
}
