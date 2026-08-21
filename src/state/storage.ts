import type { FactStates, Task } from '../engine/types'

export const SAVE_VERSION = 2
const KEY = 'talvennerne.save'

export interface Settings {
  sound: boolean
  speech: boolean
  /** read every question aloud without being asked */
  autoSpeak: boolean
  /** false = fewer particles and gentler animation */
  motion: boolean
}

export interface CollectedCreature {
  uid: string
  speciesId: string
  islandId: string
  /** seed for this individual's appearance */
  variant: number
  name: string
  golden: boolean
  foundAt: number
  /** placement on "min ø", 0–1 of the width/height */
  x: number
  y: number
}

/**
 * A round the child walked away from. Kept whole so it can be picked up exactly
 * where it was — a call to dinner should not cost eight right answers.
 */
export interface PausedRound {
  levelId: string
  islandIndex: number
  queue: Task[]
  current: Task
  answered: number
  solvedFacts: string[]
  total: number
  streak: number
  bestStreak: number
  mistakes: number
  goldenUsed: boolean
  goldenCaught: boolean
}

export interface SaveData {
  version: number
  /** true once the welcome screen has been through, so it never comes back */
  onboarded: boolean
  childName: string
  avatar: string
  facts: FactStates
  /** level id → how many times it has been completed */
  levels: Record<string, number>
  creatures: CollectedCreature[]
  /** islands a grown-up opened from the parent panel, regardless of progress */
  unlockedIslands: string[]
  /** the talven the child takes along on a round; empty = the most recent one */
  buddyUid: string
  pausedRound: PausedRound | null
  settings: Settings
  streak: { count: number; best: number; lastDay: string | null; days: string[] }
  totalRounds: number
  totalCorrect: number
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    onboarded: false,
    childName: '',
    avatar: '🦊',
    facts: {},
    levels: {},
    creatures: [],
    unlockedIslands: [],
    buddyUid: '',
    pausedRound: null,
    settings: { sound: true, speech: true, autoSpeak: true, motion: true },
    streak: { count: 0, best: 0, lastDay: null, days: [] },
    totalRounds: 0,
    totalCorrect: 0,
  }
}

/**
 * Bring an older save forward. There is only one version so far, but the shape is
 * here from day one: a child's collection is weeks of work and must survive every
 * future change to this file.
 */
function migrate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Partial<SaveData>
  if (typeof data.version !== 'number') return null
  const base = defaultSave()
  return {
    ...base,
    ...data,
    version: SAVE_VERSION,
    facts: { ...data.facts },
    levels: { ...data.levels },
    creatures: Array.isArray(data.creatures) ? data.creatures : [],
    unlockedIslands: Array.isArray(data.unlockedIslands) ? data.unlockedIslands : [],
    pausedRound: data.pausedRound ?? null,
    settings: { ...base.settings, ...data.settings },
    streak: { ...base.streak, ...data.streak },
  }
}

/** localStorage throws in private mode and when site data is blocked. Never let that break the game. */
function safeGet(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function loadSave(): SaveData {
  const raw = safeGet()
  if (!raw) return defaultSave()
  try {
    return migrate(JSON.parse(raw)) ?? defaultSave()
  } catch {
    return defaultSave()
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // out of quota or storage blocked — the session still plays, it just won't persist
  }
}

/**
 * iOS clears script-writable storage after about a week of not visiting a site.
 * Home-screen web apps are exempt, but asking for persistence costs nothing.
 */
export function requestPersistence(): void {
  void navigator.storage?.persist?.().catch(() => undefined)
}

export function exportSave(data: SaveData): string {
  return JSON.stringify(data, null, 2)
}

export function importSave(text: string): SaveData | null {
  try {
    return migrate(JSON.parse(text))
  } catch {
    return null
  }
}

/** Local calendar day, used for the daily streak. Not UTC — bedtime is local. */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isYesterday(day: string): boolean {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return day === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
