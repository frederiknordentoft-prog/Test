// Test helper: a complete, empty ProfileDoc. Never imported by the app.
import type { KeyState, ProfileDoc } from '../types'
import { emptyKey } from '../mastery'

export function newProfile(over: Partial<ProfileDoc> = {}): ProfileDoc {
  return {
    id: 'p1', version: 1, name: 'Test', grade: 1, frameColor: 'sky', createdAt: 0,
    settings: { sfx: true, speech: true, autoSpeak: true, calm: false, domainsOff: [] },
    placement: { done: false, at: null, highest: null },
    keys: {}, skillStats: {}, skillMedals: {}, nodes: {}, trials: {},
    unlocked: { worlds: ['eng'], regions: [] },
    roundIndex: 20,
    newToday: { day: '', total: 0, perSkill: {} },
    offeredTags: {}, misconceptions: {},
    economy: { perler: 0, xp: 0, level: 1, eggWarmth: 0, eggsHatched: 0, eggSpecies: null, wish: null },
    animals: [], buddyUid: null, inventory: {}, decor: {}, achievements: {},
    goals: { day: '', list: [] }, stamps: 0, daysPlayed: 0, lastLearningDay: null,
    demosSeen: {}, instructionsHeard: {}, recentFirstTries: [], round: null, rewardLog: [],
    ...over,
  }
}

/** A key that has been answered: `box`, seen a few times, last asked in round `lastRound` on `day`. */
export function keyAt(box: number, day: string, lastRound = 0, over: Partial<KeyState> = {}): KeyState {
  return { ...emptyKey(), box: box as KeyState['box'], seen: 3, correct: 3, lastRound, lastDay: day, boxDay: day, ...over }
}
