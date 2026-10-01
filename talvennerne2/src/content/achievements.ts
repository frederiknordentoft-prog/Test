// The 34 trophies of src/content/catalog.ts as conditions on the profile (SPEC §13.1, §7.2).
// A trophy is checked after every round and every action; once earned it is kept for good, even if
// the condition stops holding (a box can fall, a trophy cannot). "Dage spillet i alt" never resets
// and needs no streak: 3, 7, 14, 30 and 100 days in total.
import { ITEMS, TROPHIES, type TrophyMeta } from './catalog'
import {
  SET_IDS, SPECIES_IDS,
  type ProfileDoc, type RoundMode, type SetId, type SkillId, type TrophyId, type WorldId,
} from '../engine/types'
import { REGIONS } from './curriculum'

/** What a finished round adds to the profile, for the two trophies that are about one round. */
export interface AchievementRound {
  mode: RoundMode
  /** A whole map round or practice round without a wrong first try. */
  perfect: boolean
  /** A trial or finale passed without a wrong answer. */
  trialPerfect: boolean
}

export interface AchievementDef {
  id: TrophyId
  met(p: ProfileDoc, round: AchievementRound | null): boolean
  /** Where the child stands, for the trophy room's bar (never shown as "N more"). */
  progress?(p: ProfileDoc): { have: number; need: number }
}

/** The multiplication table: "Hele gangetabellen" is "Kan selv" in all three table skills. */
export const TABLE_SKILLS: readonly SkillId[] = ['mul2510', 'mul34', 'mul6to9']

const days = (n: number) => (p: ProfileDoc) => ({ have: Math.min(n, p.daysPlayed), need: n })
const count = (have: number, need: number) => ({ have: Math.min(have, need), need })

export const goldCount = (p: Pick<ProfileDoc, 'skillMedals'>): number =>
  Object.values(p.skillMedals).filter((m) => m === 'gold').length
export const silverCount = (p: Pick<ProfileDoc, 'skillMedals'>): number =>
  Object.values(p.skillMedals).filter((m) => m === 'silver' || m === 'gold').length
export const box5Count = (p: Pick<ProfileDoc, 'keys'>): number =>
  Object.values(p.keys).filter((k) => k.box === 5).length
export const regionTrialsPassed = (p: Pick<ProfileDoc, 'trials'>): number =>
  REGIONS.filter((r) => (p.trials[r.id]?.passedAt ?? null) !== null).length

const setItems = (set: SetId) => ITEMS.filter((i) => i.set === set).map((i) => i.id)
const ownedOf = (p: ProfileDoc, set: SetId) => setItems(set).filter((id) => !!p.inventory[id]).length

function setTrophy(set: SetId): AchievementDef {
  return {
    id: `set-${set}` as TrophyId,
    met: (p) => ownedOf(p, set) === setItems(set).length,
    progress: (p) => count(ownedOf(p, set), setItems(set).length),
  }
}

function worldTrophy(world: WorldId): AchievementDef {
  return { id: `world-${world}` as TrophyId, met: (p) => (p.trials[world]?.passedAt ?? null) !== null }
}

function daysTrophy(n: number): AchievementDef {
  return { id: `days-${n}` as TrophyId, met: (p) => p.daysPlayed >= n, progress: days(n) }
}

const species = (p: ProfileDoc) => new Set(p.animals.map((a) => a.species)).size

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  daysTrophy(3), daysTrophy(7), daysTrophy(14), daysTrophy(30), daysTrophy(100),
  ...SET_IDS.map(setTrophy),
  worldTrophy('eng'), worldTrophy('bakke'), worldTrophy('skov'), worldTrophy('fjeld'),
  { id: 'trials-10', met: (p) => regionTrialsPassed(p) >= 10, progress: (p) => count(regionTrialsPassed(p), 10) },
  { id: 'first-gold', met: (p) => goldCount(p) >= 1 },
  { id: 'gold-10', met: (p) => goldCount(p) >= 10, progress: (p) => count(goldCount(p), 10) },
  { id: 'keys5-100', met: (p) => box5Count(p) >= 100, progress: (p) => count(box5Count(p), 100) },
  { id: 'keys5-500', met: (p) => box5Count(p) >= 500, progress: (p) => count(box5Count(p), 500) },
  { id: 'perfect-round', met: (_p, r) => !!r?.perfect },
  { id: 'trial-perfect', met: (_p, r) => !!r?.trialPerfect },
  {
    id: 'table-complete',
    met: (p) => TABLE_SKILLS.every((s) => p.skillMedals[s] === 'gold'),
    progress: (p) => count(TABLE_SKILLS.filter((s) => p.skillMedals[s] === 'gold').length, TABLE_SKILLS.length),
  },
  { id: 'animals-5', met: (p) => p.animals.length >= 5, progress: (p) => count(p.animals.length, 5) },
  { id: 'animals-15', met: (p) => p.animals.length >= 15, progress: (p) => count(p.animals.length, 15) },
  { id: 'animals-30', met: (p) => p.animals.length >= 30, progress: (p) => count(p.animals.length, 30) },
  { id: 'first-star-form', met: (p) => p.animals.some((a) => a.star) },
  { id: 'all-species', met: (p) => species(p) >= SPECIES_IDS.length, progress: (p) => count(species(p), SPECIES_IDS.length) },
  { id: 'first-rainbow', met: (p) => p.animals.some((a) => a.colorway === 'rainbow') },
]

export const ACHIEVEMENT_BY_ID: Readonly<Record<TrophyId, AchievementDef>> =
  Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])) as Record<TrophyId, AchievementDef>

const TROPHY_META: Readonly<Record<TrophyId, TrophyMeta>> =
  Object.fromEntries(TROPHIES.map((t) => [t.id, t])) as Record<TrophyId, TrophyMeta>

/** Perler a trophy gives (5, 10 or 15, from the catalogue). */
export const trophyPerler = (id: TrophyId): number => TROPHY_META[id].perler

/** Trophies whose condition holds now and that the child does not have yet, in catalogue order. */
export function newTrophies(p: ProfileDoc, round: AchievementRound | null): TrophyId[] {
  return ACHIEVEMENTS.filter((a) => p.achievements[a.id] === undefined && a.met(p, round)).map((a) => a.id)
}
