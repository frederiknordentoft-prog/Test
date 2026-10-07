// Daily aggregates (SPEC §9.2, pædagogik-forslaget §5.4) as pure functions. The write path keeps
// per-day *deltas* in memory and merges them into the stored row inside the answer's transaction,
// so an aggregate is never read-modified-written outside a transaction and a failed write can simply
// be merged back into the queue.
//
// What counts where (the dashboard relies on these rules):
// - A *first try* is an answer that is neither a retry nor a golden egg. Placement answers are
//   first tries too — they are real attempts.
// - `answers` and `firstTryCorrect` count first tries, so firstTryCorrect / answers is the
//   first-try accuracy. Retries and golden eggs are logged in `answers` (the table) but not counted.
// - `bySkill` counts first tries: `fast` is correct-and-fast, `nProd` production first tries,
//   `msHist` the answer times of *correct* production first tries (<2, <4, <7, <12, <20, <35, ≥35 s),
//   `errors` wrong first tries by misconception tag.
// - `learnMs` sums the gaps between inputs inside a round — the tap that shows a question and the
//   answer — leaving out every gap over 90 s. See learnDelta().
// - `sessions` counts app starts with any activity that learning day, `rounds` finished rounds.
// - `snapshot` holds, per skill played that day, its state at the day's last round with that skill.
import { TRIAL_PASS } from '../content/curriculum'
import { SKILL_BY_ID } from '../content/skills'
import {
  MISCONCEPTION_IDS,
  type AnswerLogEntry, type DailyAggregate, type DailySkillAggregate, type KeyState, type MasteryKey,
  type MisconceptionId, type MsHistogram, type ProfileDoc, type ProfileId, type RegionId, type SkillId,
  type SkillStatus, type WorldId,
} from '../engine/types'
import type { RoundResult } from '../state/useRound'

/** Gaps between inputs longer than this are not learning time. */
export const GAP_MS = 90_000
/** Upper limits of the msHist buckets; the last bucket is ≥ 35 s. */
export const MS_HIST_LIMITS = [2_000, 4_000, 7_000, 12_000, 20_000, 35_000] as const

export type SkillSnapshot = DailyAggregate['snapshot'][SkillId] & {}

export function emptyDaily(profileId: ProfileId, day: string): DailyAggregate {
  return {
    profileId, day, learnMs: 0, playMs: 0, sessions: 0, rounds: 0, answers: 0, firstTryCorrect: 0,
    bySkill: {}, snapshot: {}, trialsPassed: [],
  }
}

const zeroHist = (): MsHistogram => [0, 0, 0, 0, 0, 0, 0]

export function msBucket(ms: number): number {
  for (let i = 0; i < MS_HIST_LIMITS.length; i++) if (ms < MS_HIST_LIMITS[i]) return i
  return MS_HIST_LIMITS.length
}

const MISCONCEPTIONS: ReadonlySet<string> = new Set(MISCONCEPTION_IDS)
export const isMisconceptionId = (tag: unknown): tag is MisconceptionId => typeof tag === 'string' && MISCONCEPTIONS.has(tag)

export function isFirstTry(e: Pick<AnswerLogEntry, 'mode' | 'retryOf'>): boolean {
  return e.mode !== 'retry' && e.mode !== 'golden' && !e.retryOf
}

/**
 * A first try that counts in the parents' statistics (accuracy, speed). The placement's answers
 * never do (pædagogik §4.2, SPEC A24): the ladder climbs until the child misses, so they would
 * pull the first day's accuracy down. The placement still shows as a round of its own (recentRounds).
 */
export function countsInStats(e: Pick<AnswerLogEntry, 'mode' | 'retryOf'>): boolean {
  return isFirstTry(e) && e.mode !== 'placement'
}

/**
 * Learning time an answer adds. Every question appears after an input (starting or resuming the
 * round, "next", confirming the strategy), approximated by `ts − ms`; the answer is the next input.
 * So the answer contributes the gap from the previous input to the question, and the thinking time
 * — each only when it is at most 90 s. With no known previous input (after a reload) only the
 * thinking time counts.
 */
export function learnDelta(prevInputAt: number | null, ts: number, ms: number): number {
  const gap = (g: number) => (Number.isFinite(g) && g >= 0 && g <= GAP_MS ? g : 0)
  const asked = ts - ms
  return (prevInputAt === null ? 0 : gap(asked - prevInputAt)) + gap(ms)
}

function skillDelta(e: AnswerLogEntry): DailySkillAggregate {
  const msHist = zeroHist()
  if (e.production && e.correct) msHist[msBucket(e.ms)] = 1
  const errors: DailySkillAggregate['errors'] = {}
  if (!e.correct && isMisconceptionId(e.errorTag)) errors[e.errorTag] = 1
  return {
    n: 1,
    correct: e.correct ? 1 : 0,
    fast: e.correct && e.fast ? 1 : 0,
    nProd: e.production ? 1 : 0,
    msHist,
    errors,
  }
}

/** The change one logged answer makes to its day. */
export function answerDelta(e: AnswerLogEntry, opts: { learnMs: number; newSession: boolean }): DailyAggregate {
  const d = emptyDaily(e.profileId, e.day)
  d.learnMs = Math.max(0, Math.round(opts.learnMs))
  d.sessions = opts.newSession ? 1 : 0
  if (countsInStats(e)) {
    d.answers = 1
    d.firstTryCorrect = e.correct ? 1 : 0
    d.bySkill[e.skill] = skillDelta(e)
  }
  return d
}

/** Time with animals, wardrobe, shop and books, as reported by the UI. */
export function playDelta(profileId: ProfileId, day: string, ms: number, newSession: boolean): DailyAggregate {
  const d = emptyDaily(profileId, day)
  d.playMs = Math.max(0, Math.round(ms))
  d.sessions = newSession ? 1 : 0
  return d
}

/** A finished round: one more round, the skills' state now, and a passed trial if there was one. */
export function roundDelta(
  profileId: ProfileId, day: string, snapshot: DailyAggregate['snapshot'], trialPassed: RegionId | WorldId | null,
): DailyAggregate {
  const d = emptyDaily(profileId, day)
  d.rounds = 1
  d.snapshot = snapshot
  if (trialPassed) d.trialsPassed = [trialPassed]
  return d
}

function mergeSkill(a: DailySkillAggregate | undefined, b: DailySkillAggregate): DailySkillAggregate {
  if (!a) return { ...b, msHist: [...b.msHist] as MsHistogram, errors: { ...b.errors } }
  const errors: DailySkillAggregate['errors'] = { ...a.errors }
  for (const [tag, n] of Object.entries(b.errors) as [MisconceptionId, number][]) errors[tag] = (errors[tag] ?? 0) + n
  return {
    n: a.n + b.n,
    correct: a.correct + b.correct,
    fast: a.fast + b.fast,
    nProd: a.nProd + b.nProd,
    msHist: a.msHist.map((v, i) => v + (b.msHist[i] ?? 0)) as MsHistogram,
    errors,
  }
}

/**
 * `b` applied after `a` (same profile and day): counts add up, a later snapshot entry replaces an
 * earlier one for the same skill, and passed trials are a set in first-passed order. Associative,
 * so deltas can be combined before they are merged into the stored row.
 */
export function mergeDaily(a: DailyAggregate, b: DailyAggregate): DailyAggregate {
  const bySkill: DailyAggregate['bySkill'] = { ...a.bySkill }
  for (const [skill, s] of Object.entries(b.bySkill) as [SkillId, DailySkillAggregate][]) bySkill[skill] = mergeSkill(bySkill[skill], s)
  return {
    profileId: a.profileId,
    day: a.day,
    learnMs: a.learnMs + b.learnMs,
    playMs: a.playMs + b.playMs,
    sessions: a.sessions + b.sessions,
    rounds: a.rounds + b.rounds,
    answers: a.answers + b.answers,
    firstTryCorrect: a.firstTryCorrect + b.firstTryCorrect,
    bySkill,
    snapshot: { ...a.snapshot, ...b.snapshot },
    trialsPassed: [...new Set([...a.trialsPassed, ...b.trialsPassed])],
  }
}

// ─── Skill state (SPEC §5.2) ────────────────────────────────────────────────

/**
 * All mastery keys of a skill. The engine registry knows them (recall: enumerate(); procedure: one
 * key per family) and is plugged in with setSkillKeyIndex() once it exists. Until then procedure
 * skills use `<skill>/<family>` from content/skills.ts and recall skills the keys seen so far.
 */
export type SkillKeyIndex = (skill: SkillId) => readonly MasteryKey[] | null | undefined

let skillKeyIndex: SkillKeyIndex | null = null

export function setSkillKeyIndex(index: SkillKeyIndex | null): void {
  skillKeyIndex = index
}

export function keysOfSkill(skill: SkillId, known: Iterable<MasteryKey> = []): MasteryKey[] {
  const fromIndex = skillKeyIndex?.(skill)
  if (fromIndex && fromIndex.length > 0) return [...new Set(fromIndex)]
  const meta = SKILL_BY_ID[skill]
  if (meta?.mode === 'procedure') return meta.families.map((f) => `${skill}/${f.id}`)
  return [...new Set(known)]
}

const round3 = (x: number) => Math.round(x * 1000) / 1000

/**
 * Status of one skill from its keys and its correct production answers:
 * Kan selv (independent) ≥ 80 % of the keys in box 4–5 and ≥ max(12, 2·keys) correct production
 * answers on ≥ 3 learning days · Sølv ≥ 50 % in box 4–5 and ≥ max(8, keys) on ≥ 2 days ·
 * Kan med støtte ≥ 70 % in box ≥ 2, seeded keys only once confirmed · Øver: seen at least once.
 */
export function skillSnapshot(
  keys: readonly MasteryKey[],
  states: Readonly<Record<MasteryKey, KeyState>>,
  stats: { prodCorrect: number; prodDays: readonly string[] } | undefined,
): SkillSnapshot {
  const n = keys.length
  if (n === 0) return { meanBox: 0, share2: 0, share4: 0, status: 'notStarted' }
  let boxSum = 0
  let at2 = 0
  let at4 = 0
  let seen = false
  for (const k of keys) {
    const s = states[k]
    if (!s) continue
    boxSum += s.box
    if (s.box >= 2 && !s.seeded) at2 += 1
    if (s.box >= 4) at4 += 1
    if (s.seen > 0) seen = true
  }
  const share2 = at2 / n
  const share4 = at4 / n
  const prod = stats?.prodCorrect ?? 0
  const days = stats?.prodDays.length ?? 0
  let status: SkillStatus = 'practising'
  if (!seen) status = 'notStarted'
  else if (share4 >= 0.8 && prod >= Math.max(12, 2 * n) && days >= 3) status = 'independent'
  else if (share4 >= 0.5 && prod >= Math.max(8, n) && days >= 2) status = 'silver'
  else if (share2 >= 0.7) status = 'support'
  return { meanBox: round3(boxSum / n), share2: round3(share2), share4: round3(share4), status }
}

/** Snapshot entries for the given skills of a profile. */
export function snapshotFor(
  profile: Pick<ProfileDoc, 'keys' | 'skillStats'>,
  skills: Iterable<SkillId>,
  knownKeys: (skill: SkillId) => Iterable<MasteryKey> = () => [],
): DailyAggregate['snapshot'] {
  const out: DailyAggregate['snapshot'] = {}
  for (const skill of new Set(skills)) {
    out[skill] = skillSnapshot(keysOfSkill(skill, knownKeys(skill)), profile.keys, profile.skillStats[skill])
  }
  return out
}

/** The region trial or world finale a finished round passed, if any (SPEC §5.4: 8/10 and 10/12). */
export function passedTrialOf(result: Pick<RoundResult, 'mode' | 'nodeId' | 'planks'>): RegionId | WorldId | null {
  const node = String(result.nodeId)
  if (result.mode === 'trial' && node.endsWith('-trial') && result.planks >= TRIAL_PASS.trial.pass) {
    return node.slice(0, -'-trial'.length) as RegionId
  }
  if (result.mode === 'finale' && node.endsWith('-finale') && result.planks >= TRIAL_PASS.finale.pass) {
    return node.slice(0, -'-finale'.length) as WorldId
  }
  return null
}
