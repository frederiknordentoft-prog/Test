// Everything the dashboard shows for one profile, from one pure call. load.ts reads the data;
// the screen rebuilds with the live profile (a changed setting) without reading again.
import type { ProfileDoc, SkillId } from '../engine/types'
import { gradeEstimate } from './gradeEstimate'
import { WINDOW_DAYS, domainCards, overview, recentRounds, skillStates, snapshotsBefore, tableGrid, trendOf, trialRows } from './metrics'
import { windowEnding } from './format'
import { recommend } from './recommend'
import { rewardDays } from './rewardText'
import { signs } from './signs'
import type { DashSource, Dashboard, SkillRow } from './types'

export function buildDashboard(profile: ProfileDoc, source: DashSource): Dashboard {
  const input = { ...source, profile }
  const states = skillStates(profile, source.index, source.daily)
  const domains = domainCards(input, states)
  const rows: Partial<Record<SkillId, SkillRow>> = {}
  for (const d of domains) for (const r of d.rows) rows[r.skill] = r
  const shown = domains.flatMap((d) => d.rows.map((r) => r.skill))
  const ov = overview(input)
  const sg = signs(input)
  return {
    name: profile.name,
    grade: profile.grade,
    today: source.today,
    overview: ov,
    skills: states,
    domains,
    trend: trendOf(shown, states, snapshotsBefore(source.daily, windowEnding(source.today, WINDOW_DAYS).from)),
    tables: tableGrid(profile, source.index),
    trials: trialRows(profile),
    recentRounds: recentRounds(source.answers),
    rewards: rewardDays(profile),
    signs: sg,
    recommendations: recommend({ ...input, name: profile.name, states, rows, signs: sg }),
    estimate: gradeEstimate(states, ov.total),
  }
}
