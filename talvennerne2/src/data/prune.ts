// Retention (SPEC §9.2): the answer log keeps 90 days and at most 20 000 rows per profile, daily
// aggregates keep 3 years. It runs at start-up at most once per 24 hours, two seconds after boot
// (Safari has no requestIdleCallback), and the time of the last run is kept in `meta`.
import { learningDay } from '../engine/learningDay'
import type { ProfileId } from '../engine/types'
import { DAY_MIN, TS_MAX, TS_MIN, getDb } from './db'

export const ANSWER_MAX_AGE_DAYS = 90
export const ANSWER_MAX_ROWS = 20_000
export const DAILY_MAX_AGE_DAYS = 1096
export const PRUNE_INTERVAL_MS = 24 * 3600_000
export const PRUNE_DELAY_MS = 2000
export const LAST_PRUNE_KEY = 'lastPrune'

const DAY_MS = 86_400_000

export interface PruneResult {
  answers: number
  daily: number
}

/** Prune one profile. Each step is its own short transaction, so answers are never blocked for long. */
export async function pruneProfile(profileId: ProfileId, now: number = Date.now()): Promise<PruneResult> {
  const db = getDb()
  const oldestTs = now - ANSWER_MAX_AGE_DAYS * DAY_MS
  let answers = await db.answers
    .where('[profileId+ts]')
    .between([profileId, TS_MIN], [profileId, oldestTs], true, false)
    .delete()

  const excess = (await db.answers.where('[profileId+ts]').between([profileId, TS_MIN], [profileId, TS_MAX], true, true).count()) - ANSWER_MAX_ROWS
  if (excess > 0) {
    await db.transaction('rw', db.answers, async () => {
      const oldest = await db.answers
        .where('[profileId+ts]')
        .between([profileId, TS_MIN], [profileId, TS_MAX], true, true)
        .limit(excess)
        .primaryKeys()
      await db.answers.bulkDelete(oldest)
      answers += oldest.length
    })
  }

  const oldestDay = learningDay(now - DAILY_MAX_AGE_DAYS * DAY_MS)
  const daily = await db.daily.where('[profileId+day]').between([profileId, DAY_MIN], [profileId, oldestDay], true, false).delete()
  return { answers, daily }
}

/** Prune every profile on the device. */
export async function pruneAll(now: number = Date.now()): Promise<PruneResult> {
  const ids = (await getDb().profiles.toCollection().primaryKeys()) as ProfileId[]
  const total: PruneResult = { answers: 0, daily: 0 }
  for (const id of ids) {
    const r = await pruneProfile(id, now)
    total.answers += r.answers
    total.daily += r.daily
  }
  return total
}

/** Run pruneAll unless it ran within the last 24 hours. Resolves to null when skipped. */
export async function pruneIfDue(now: number = Date.now()): Promise<PruneResult | null> {
  const db = getDb()
  const row = await db.meta.get(LAST_PRUNE_KEY)
  const last = typeof row?.value === 'number' ? row.value : null
  // a clock that went backwards (last in the future) counts as due
  if (last !== null && last <= now && now - last < PRUNE_INTERVAL_MS) return null
  const result = await pruneAll(now)
  await db.meta.put({ key: LAST_PRUNE_KEY, value: now })
  return result
}

/**
 * Schedule the start-up prune. Returns a cancel function. Failures are swallowed: retention is
 * housekeeping and must never disturb play; it simply runs again at the next start.
 */
export function schedulePrune(delayMs: number = PRUNE_DELAY_MS, now: () => number = Date.now): () => void {
  const timer = setTimeout(() => {
    pruneIfDue(now()).catch(() => undefined)
  }, delayMs)
  return () => clearTimeout(timer)
}
