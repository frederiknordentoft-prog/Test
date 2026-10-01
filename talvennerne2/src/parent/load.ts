// The dashboard's one read: everything stored about a profile that the pure functions need. The
// write queue is flushed first, so the last round is included.
import { answersBetween } from '../data/repo/answers'
import { allDaily } from '../data/repo/daily'
import { learningDay } from '../engine/learningDay'
import { factsOf, skillRegistry, type SkillRegistry } from '../engine/registry'
import type { ProfileDoc } from '../engine/types'
import { useProfile } from '../state/useProfile'
import { buildDashboard } from './dashboard'
import type { DashSource, Dashboard, SkillKeyIndex } from './types'

/** Answers are read for 28 learning days (now and two weeks before), plus a day for the 4 h shift. */
export const ANSWER_DAYS = 29
const DAY_MS = 86_400_000

const indexCache = new WeakMap<SkillRegistry, SkillKeyIndex>()

/** Every registered skill's keys with their family (recall: per fact, procedure: per family). */
export function keyIndexOf(reg: SkillRegistry): SkillKeyIndex {
  let index = indexCache.get(reg)
  if (!index) {
    index = {}
    for (const def of reg.all) {
      index[def.id] = def.mode === 'recall'
        ? factsOf(def).map((f) => ({ key: f.id, family: f.family }))
        : def.families.map((f) => ({ key: `${def.id}/${f.id}`, family: f.id }))
    }
    indexCache.set(reg, index)
  }
  return index
}

export interface LoadOptions {
  now?: number
  /** Defaults to the registered skills. */
  skills?: SkillRegistry
}

/** Read a profile's daily aggregates and recent answers. */
export async function loadSource(profileId: string, opts: LoadOptions = {}): Promise<DashSource> {
  const now = opts.now ?? Date.now()
  const active = useProfile.getState()
  if (active.profile?.id === profileId) await active.flush()
  const [daily, answers] = await Promise.all([allDaily(profileId), answersBetween(profileId, now - ANSWER_DAYS * DAY_MS)])
  return { daily, answers, index: keyIndexOf(opts.skills ?? skillRegistry()), today: learningDay(now), now }
}

/** The whole dashboard for a profile, and the data it was built from (to rebuild on a setting). */
export async function loadDashboard(profile: ProfileDoc, opts: LoadOptions = {}): Promise<{ source: DashSource; dashboard: Dashboard }> {
  const source = await loadSource(profile.id, opts)
  return { source, dashboard: buildDashboard(profile, source) }
}
