// Daily aggregates (SPEC §9.2). Written by useProfile's write queue (deltas merged in the answer's
// transaction); this module holds the queries the dashboard and the export need.
import type { DailyAggregate, ProfileId } from '../../engine/types'
import { DAY_MAX, DAY_MIN, getDb } from '../db'

export async function getDaily(profileId: ProfileId, day: string): Promise<DailyAggregate | undefined> {
  return getDb().daily.get([profileId, day])
}

/** Days with fromDay ≤ day ≤ toDay ('YYYY-MM-DD'), oldest first. */
export async function dailyBetween(profileId: ProfileId, fromDay: string = DAY_MIN, toDay: string = DAY_MAX): Promise<DailyAggregate[]> {
  return getDb().daily.where('[profileId+day]').between([profileId, fromDay], [profileId, toDay], true, true).toArray()
}

export async function allDaily(profileId: ProfileId): Promise<DailyAggregate[]> {
  return dailyBetween(profileId)
}
