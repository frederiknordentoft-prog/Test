import { create } from 'zustand'
import type { TaskKind } from '../engine/types'
import type { CollectedCreature, PausedRound, SaveData, Settings } from './storage'
import { defaultSave, isYesterday, loadSave, today, writeSave } from './storage'
import { updateFactState, masteryOf } from '../engine/mastery'
import { ISLANDS, factsForLevel } from '../content/islands'

interface ProfileStore {
  save: SaveData
  recordAnswer: (factId: string, correct: boolean, ms: number, fastMs: number, kind: TaskKind) => void
  finishRound: (levelId: string) => void
  collect: (creature: CollectedCreature) => void
  rename: (uid: string, name: string) => void
  place: (uid: string, x: number, y: number) => void
  setChild: (name: string, avatar: string) => void
  setIslandUnlocked: (islandId: string, open: boolean) => void
  setBuddy: (uid: string) => void
  savePausedRound: (paused: PausedRound | null) => void
  openThroughGrade: (grade: 0 | 1 | 2) => void
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  replaceSave: (data: SaveData) => void
  reset: () => void
}

function commit(set: (fn: (s: ProfileStore) => Partial<ProfileStore>) => void, mutate: (s: SaveData) => SaveData) {
  set((store) => {
    const next = mutate(store.save)
    writeSave(next)
    return { save: next }
  })
}

export const useProfile = create<ProfileStore>((set) => ({
  save: loadSave(),

  recordAnswer: (factId, correct, ms, fastMs, kind) =>
    commit(set, (s) => ({
      ...s,
      facts: { ...s.facts, [factId]: updateFactState(s.facts[factId], correct, ms, s.totalRounds, fastMs, kind) },
      totalCorrect: s.totalCorrect + (correct ? 1 : 0),
    })),

  finishRound: (levelId) =>
    commit(set, (s) => {
      const day = today()
      const alreadyToday = s.streak.lastDay === day
      const continues = s.streak.lastDay !== null && isYesterday(s.streak.lastDay)
      const count = alreadyToday ? s.streak.count : continues ? s.streak.count + 1 : 1
      return {
        ...s,
        pausedRound: null,
        levels: { ...s.levels, [levelId]: (s.levels[levelId] ?? 0) + 1 },
        totalRounds: s.totalRounds + 1,
        streak: {
          count,
          best: Math.max(s.streak.best, count),
          lastDay: day,
          days: alreadyToday ? s.streak.days : [...s.streak.days, day].slice(-90),
        },
      }
    }),

  collect: (creature) => commit(set, (s) => ({ ...s, creatures: [...s.creatures, creature] })),

  rename: (uid, name) =>
    commit(set, (s) => ({ ...s, creatures: s.creatures.map((c) => (c.uid === uid ? { ...c, name } : c)) })),

  place: (uid, x, y) =>
    commit(set, (s) => ({ ...s, creatures: s.creatures.map((c) => (c.uid === uid ? { ...c, x, y } : c)) })),

  setChild: (childName, avatar) => commit(set, (s) => ({ ...s, childName, avatar, onboarded: true })),

  setBuddy: (uid) => commit(set, (s) => ({ ...s, buddyUid: uid })),

  savePausedRound: (pausedRound) => commit(set, (s) => ({ ...s, pausedRound })),

  setIslandUnlocked: (islandId, open) =>
    commit(set, (s) => ({
      ...s,
      unlockedIslands: open
        ? [...new Set([...s.unlockedIslands, islandId])]
        : s.unlockedIslands.filter((id) => id !== islandId),
    })),

  /** Open everything up to and including a school year, in one tap. */
  openThroughGrade: (grade) =>
    commit(set, (s) => ({
      ...s,
      unlockedIslands: ISLANDS.filter((i) => i.grade <= grade).map((i) => i.id),
    })),

  setSetting: (key, value) => commit(set, (s) => ({ ...s, settings: { ...s.settings, [key]: value } })),

  replaceSave: (data) => commit(set, () => data),

  reset: () => commit(set, () => defaultSave()),
}))

// ---- derived helpers (plain functions so they can be used outside components) ----

export function levelsDoneOn(save: SaveData, islandId: string): number {
  const island = ISLANDS.find((i) => i.id === islandId)
  if (!island) return 0
  return island.levels.filter((l) => (save.levels[l.id] ?? 0) > 0).length
}

/**
 * An island opens when enough turer on the previous one are done. Gating hard on
 * full mastery would leave a six-year-old stuck staring at a padlock, which is
 * exactly how a child decides an app is not for them.
 */
export function isIslandUnlocked(save: SaveData, index: number): boolean {
  if (index === 0) return true
  if (save.unlockedIslands.includes(ISLANDS[index].id)) return true
  const previous = ISLANDS[index - 1]
  return levelsDoneOn(save, previous.id) >= previous.unlockAfter
}

export function islandMastery(save: SaveData, index: number): number {
  const island = ISLANDS[index]
  const ids = new Set<string>()
  island.levels.forEach((level) => {
    if (level.festival) return
    for (const f of factsForLevel(level, index)) ids.add(f.id)
  })
  return masteryOf([...ids], save.facts)
}

/** How quickly an answer must arrive to count as "known", not "worked out". */
export function fastMsFor(kind: string, answer: number): number {
  const base = kind === 'keypad' ? 7000 : kind === 'pair' ? 7000 : 5000
  return answer > 20 ? base + 3000 : base
}


/** The talven that comes along on a round: the chosen one, else the newest. */
export function buddyOf(save: SaveData): SaveData['creatures'][number] | undefined {
  return save.creatures.find((c) => c.uid === save.buddyUid) ?? save.creatures[save.creatures.length - 1]
}


/**
 * The turn a child would pick if nobody asked them to navigate: the first
 * unfinished one on the furthest island that is open to them. Everything done →
 * the last festival round, which is worth replaying.
 */
export function nextLevel(save: SaveData): { islandId: string; levelId: string } | null {
  let fallback: { islandId: string; levelId: string } | null = null
  for (let i = 0; i < ISLANDS.length; i++) {
    if (!isIslandUnlocked(save, i)) break
    const island = ISLANDS[i]
    fallback = { islandId: island.id, levelId: island.levels[island.levels.length - 1].id }
    for (let l = 0; l < island.levels.length; l++) {
      const level = island.levels[l]
      const open = l === 0 || (save.levels[island.levels[l - 1].id] ?? 0) > 0
      if (open && (save.levels[level.id] ?? 0) === 0) return { islandId: island.id, levelId: level.id }
    }
  }
  return fallback
}
