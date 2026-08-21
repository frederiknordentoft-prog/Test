import { create } from 'zustand'
import type { CollectedCreature, SaveData, Settings } from './storage'
import { defaultSave, isYesterday, loadSave, today, writeSave } from './storage'
import { updateFactState, masteryOf } from '../engine/mastery'
import { ISLANDS, factsForLevel } from '../content/islands'

interface ProfileStore {
  save: SaveData
  recordAnswer: (factId: string, correct: boolean, ms: number, fastMs: number) => void
  finishRound: (levelId: string) => void
  collect: (creature: CollectedCreature) => void
  rename: (uid: string, name: string) => void
  place: (uid: string, x: number, y: number) => void
  setChild: (name: string, avatar: string) => void
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

  recordAnswer: (factId, correct, ms, fastMs) =>
    commit(set, (s) => ({
      ...s,
      facts: { ...s.facts, [factId]: updateFactState(s.facts[factId], correct, ms, s.totalRounds, fastMs) },
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
