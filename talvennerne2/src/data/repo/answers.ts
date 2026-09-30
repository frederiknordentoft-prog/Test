// The answer log (SPEC §9.2). Rows are only ever added by useProfile's write queue, inside the
// transaction that also writes the profile and the day; this module holds the queries.
import type { AnswerLogEntry, ProfileId, SkillId } from '../../engine/types'
import { TS_MAX, TS_MIN, getDb } from '../db'

function byProfile(profileId: ProfileId, fromTs = TS_MIN, toTs = TS_MAX) {
  return getDb().answers.where('[profileId+ts]').between([profileId, fromTs], [profileId, toTs], true, true)
}

/** Answers with fromTs ≤ ts ≤ toTs, oldest first. */
export async function answersBetween(profileId: ProfileId, fromTs: number, toTs: number = TS_MAX): Promise<AnswerLogEntry[]> {
  return byProfile(profileId, fromTs, toTs).toArray()
}

/** The newest `limit` answers of a profile, newest first. */
export async function latestAnswers(profileId: ProfileId, limit: number): Promise<AnswerLogEntry[]> {
  return byProfile(profileId).reverse().limit(limit).toArray()
}

/** The newest `limit` answers in one skill, newest first. */
export async function latestAnswersInSkill(profileId: ProfileId, skill: SkillId, limit: number): Promise<AnswerLogEntry[]> {
  return getDb()
    .answers.where('[profileId+skill+ts]')
    .between([profileId, skill, TS_MIN], [profileId, skill, TS_MAX], true, true)
    .reverse()
    .limit(limit)
    .toArray()
}

export async function countAnswers(profileId: ProfileId): Promise<number> {
  return byProfile(profileId).count()
}

/** A log row as stored, without the auto-increment key (for export and re-adding). */
export function withoutSeq(e: AnswerLogEntry): AnswerLogEntry {
  const copy = { ...e }
  delete copy.seq
  return copy
}
