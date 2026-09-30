import type { KeyState, LearningEvent, MasteryKey, Medal, ProfileDoc, SkillId, SkillStatus } from './types'
import { factsOf, keyInfo, skillKeys, skillRegistry, type SkillRegistry } from './registry'

/**
 * Skill status and medals (SPEC §5.2). The dashboard status follows the boxes and may fall again;
 * a medal is permanent. Silver and gold also need correct typed answers spread over learning days,
 * because boxes alone could be reached in one long afternoon — "Kan selv" has to mean the child
 * still knew it after a night's sleep.
 */

export const STATUS_ORDER: readonly SkillStatus[] = ['notStarted', 'practising', 'support', 'silver', 'independent']
export const statusRank = (s: SkillStatus): number => STATUS_ORDER.indexOf(s)
const MEDAL_ORDER: readonly Medal[] = ['bronze', 'silver', 'gold']

export interface SkillStats { prodCorrect: number; prodDays: readonly string[] }

/** The skill's status from all of its keys (unseen keys as undefined) and its production stats. */
export function skillStatus(keys: readonly (KeyState | undefined)[], stats: SkillStats | undefined): SkillStatus {
  const n = keys.length
  if (n === 0 || !keys.some((k) => k && k.seen > 0)) return 'notStarted'
  // a key seeded by placement counts once the child has confirmed it with a typed answer
  const share = (pred: (k: KeyState) => boolean) => keys.filter((k) => k && !k.seeded && pred(k)).length / n
  const high = share((k) => k.box >= 4)
  const correct = stats?.prodCorrect ?? 0
  const days = new Set(stats?.prodDays ?? []).size
  if (high >= 0.8 && correct >= Math.max(12, 2 * n) && days >= 3) return 'independent'
  if (high >= 0.5 && correct >= Math.max(8, n) && days >= 2) return 'silver'
  if (share((k) => k.box >= 2) >= 0.7) return 'support'
  return 'practising'
}

export function medalFor(status: SkillStatus): Medal | null {
  return status === 'independent' ? 'gold' : status === 'silver' ? 'silver' : status === 'support' ? 'bronze' : null
}

/** Medals only go up. */
export function upgradeMedal(prev: Medal | undefined, status: SkillStatus): Medal | undefined {
  const earned = medalFor(status)
  if (!earned) return prev
  if (!prev) return earned
  return MEDAL_ORDER.indexOf(earned) > MEDAL_ORDER.indexOf(prev) ? earned : prev
}

/** Status of one registered skill in a profile. */
export function statusOf(skill: SkillId, profile: Pick<ProfileDoc, 'keys' | 'skillStats'>, reg: SkillRegistry = skillRegistry()): SkillStatus {
  const def = reg.get(skill)
  if (!def) return 'notStarted'
  return skillStatus(skillKeys(def).map((k) => profile.keys[k]), profile.skillStats[skill])
}

/** Seeded by placement and not yet confirmed: the dashboard shows "Sprunget over ved start". */
export function isSkippedAtStart(keys: readonly (KeyState | undefined)[]): boolean {
  return keys.some((k) => k?.seeded) && !keys.some((k) => k && !k.seeded && k.correct > 0)
}

type Progress = Pick<ProfileDoc, 'keys' | 'skillStats' | 'skillMedals'>

function familyKeys(skill: SkillId, family: string, reg: SkillRegistry): MasteryKey[] {
  const def = reg.get(skill)
  if (!def || def.mode === 'procedure') return [`${skill}/${family}`]
  return factsOf(def).filter((f) => f.family === family).map((f) => f.id)
}

/**
 * What changed between two snapshots of a profile, as events for the game layer: keys that moved
 * up a box, skills that reached a higher status, new medals and the first correct answer in a
 * family. Status drops are not events — nothing earned is ever taken away.
 */
export function learningEventsFor(before: Progress, after: Progress, reg: SkillRegistry = skillRegistry()): LearningEvent[] {
  const events: LearningEvent[] = []
  const touched = new Set<SkillId>()
  const firstInFamily = new Map<string, { skill: SkillId; family: string }>()

  for (const key of Object.keys(after.keys)) {
    const a = after.keys[key]
    const b = before.keys[key]
    if (a === b) continue
    const info = keyInfo(key, reg)
    if (!info) continue
    touched.add(info.skill)
    if (a.box > (b?.box ?? 0)) events.push({ t: 'keyPromoted', key, skill: info.skill, box: a.box })
    if ((b?.correct ?? 0) === 0 && a.correct > 0) firstInFamily.set(`${info.skill}/${info.family}`, info)
  }
  for (const skill of Object.keys(after.skillStats) as SkillId[]) {
    if (after.skillStats[skill] !== before.skillStats[skill]) touched.add(skill)
  }

  for (const { skill, family } of firstInFamily.values()) {
    if (familyKeys(skill, family, reg).every((k) => (before.keys[k]?.correct ?? 0) === 0)) {
      events.push({ t: 'familyFirstCorrect', skill, family })
    }
  }

  for (const skill of touched) {
    const def = reg.get(skill)
    if (!def) continue
    const keys = skillKeys(def)
    const was = skillStatus(keys.map((k) => before.keys[k]), before.skillStats[skill])
    const now = skillStatus(keys.map((k) => after.keys[k]), after.skillStats[skill])
    if (statusRank(now) > statusRank(was)) events.push({ t: 'skillStatus', skill, status: now })
    const had = before.skillMedals[skill]
    const medal = upgradeMedal(had, now)
    if (medal && medal !== had) events.push({ t: 'medal', skill, medal })
  }
  return events
}

/** profile.skillMedals with the medal events applied. */
export function applyMedals(medals: ProfileDoc['skillMedals'], events: readonly LearningEvent[]): ProfileDoc['skillMedals'] {
  const out = { ...medals }
  for (const e of events) if (e.t === 'medal') out[e.skill] = e.medal
  return out
}
