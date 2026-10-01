// What the parent dashboard computes (SPEC §9.1). Everything in src/parent is a pure function of
// these inputs: the profile, the stored daily aggregates and answer log, the skill register's keys
// and a fixed "today". load.ts is the only module that reads IndexedDB.
import type {
  AnswerLogEntry, Box, DailyAggregate, DomainId, Grade, Medal, MasteryKey, MisconceptionId, ProfileDoc, RegionId,
  RewardLogEntry, SkillId, SkillStatus, WorldId,
} from '../engine/types'

/** One mastery key of a skill and the family it belongs to. */
export interface KeyRef {
  key: MasteryKey
  family: string
}

/** Every mastery key per registered skill (recall: one per fact, procedure: one per family). */
export type SkillKeyIndex = Partial<Record<SkillId, readonly KeyRef[]>>

/** Raw data for one profile, read once when the dashboard opens. */
export interface DashSource {
  /** Daily aggregates of the profile, any order. */
  daily: readonly DailyAggregate[]
  /** The answer log since at least 28 learning days before `today`, any order. */
  answers: readonly AnswerLogEntry[]
  index: SkillKeyIndex
  /** Learning day of `now` ('YYYY-MM-DD'). */
  today: string
  now: number
}

export interface DashInput extends DashSource {
  profile: ProfileDoc
}

/**
 * The four levels the dashboard shows (silver counts as "Med støtte": the spec's dots and counts
 * have four levels; the medal shows the rest).
 */
export type DashStatus = 'notStarted' | 'practising' | 'support' | 'independent'
/** A dot on the curriculum map: a status, or "Sprunget over ved start" (dashed). */
export type DotKind = DashStatus | 'skipped'

export interface Window {
  /** First learning day of the window (inclusive). */
  from: string
  /** Last learning day of the window (inclusive). */
  to: string
}

/** First tries in one skill over a window, summed from the daily aggregates. */
export interface Tally {
  n: number
  correct: number
  /** Correct and fast. */
  fast: number
  nProd: number
}

export interface DayBar {
  day: string
  learnMs: number
  playMs: number
  /** First tries that day. */
  answers: number
  active: boolean
}

export interface Place {
  world: WorldId
  worldName: string
  region: RegionId | null
  regionName: string | null
}

export interface Overview {
  /** The last 14 learning days, oldest first. */
  days: DayBar[]
  activeDays: number
  rounds: number
  /** First tries. */
  answers: number
  firstTryCorrect: number
  /** firstTryCorrect / answers, null without answers. */
  accuracy: number | null
  learnMs: number
  playMs: number
  place: Place | null
  /** All kept days: first tries and days with answers (the grade estimate's evidence). */
  total: { answers: number; activeDays: number }
}

export interface SkillState {
  skill: SkillId
  domain: DomainId
  grade: Grade
  label: string
  /** The engine's status (SPEC §5.2). */
  status: SkillStatus
  /** The dashboard's four levels. */
  dash: DashStatus
  /** Seeded by placement and not yet confirmed by a typed answer. */
  skipped: boolean
  dot: DotKind
  medal: Medal | null
  /** Number of mastery keys (0 when the skill is not registered yet). */
  keys: number
  /** 0–1: keys in box 4–5 (seeded keys never count). */
  share4: number
  /** Mean box of the keys, 0–5 (not shown: no score, no sparkline). */
  meanBox: number
}

export interface MedianPair {
  /** Median ms of correct typed first tries in the last 14 days. */
  now: number | null
  /** The same for the 14 days before that. */
  before: number | null
}

export interface FamilyRow {
  family: string
  label: string
  keys: number
  /** Keys answered at least once. */
  seen: number
  share4: number
  /** First tries in the last 14 days. */
  answers: number
  accuracy: number | null
}

export interface SkillRow extends SkillState {
  lastPractised: string | null
  /** First tries in the last 14 days. */
  answers: number
  accuracy: number | null
  /** Share of the 14 days' first tries that were right and fast. */
  fastShare: number | null
  /** Share of the 14 days' first tries that were right but slow. */
  slowShare: number | null
  median: MedianPair
  families: FamilyRow[]
}

export interface Trend {
  up: SkillId[]
  down: SkillId[]
}

export interface DomainCard {
  domain: DomainId
  label: string
  group: string
  /** Switched off in the settings. */
  off: boolean
  /** Skills up to the child's grade + 1 (the denominator). */
  scope: SkillId[]
  counts: Record<DotKind, number>
  /** Started skills above the child's grade + 1. */
  ahead: SkillId[]
  trend: Trend
  answers: number
  accuracy: number | null
  median: MedianPair
  /** Learning time in the last 14 days, the day's time shared out by first tries. */
  learnMs: number
  /** Rows to show: the scope plus started skills above it. */
  rows: SkillRow[]
}

export interface TableCell {
  a: number
  b: number
  /** `mul:<min>x<max>`, null for 1 · 1 (no table skill has it). */
  key: MasteryKey | null
  skill: SkillId | null
  box: Box
  seen: boolean
}

export interface TableGrid {
  /** False until a multiplication skill is registered or played. */
  available: boolean
  /** rows[a − 1][b − 1] for a, b = 1–10. */
  rows: TableCell[][]
}

export interface TrialRow {
  id: RegionId | WorldId
  kind: 'trial' | 'finale'
  name: string
  worldName: string
  state: 'passed' | 'open'
  attempts: number
  best: number
  size: number
  passedAt: number | null
  /** Three attempts without passing: the help bridge lets the child on regardless. */
  bridge: boolean
}

export interface RecentRound {
  roundId: string
  ts: number
  day: string
  where: string
  tasks: number
  firstTryCorrect: number
}

export interface RewardRow {
  ts: number
  kind: RewardLogEntry['kind']
  what: string
  why: string
}

export interface RewardDay {
  day: string
  /** Perler earned that day, summed (null when none). */
  perler: number | null
  rows: RewardRow[]
}

export interface Sign {
  id: MisconceptionId
  nature: 'concept' | 'slip'
  title: string
  example: string
  parent: string
  homeTip: string
  /** Where it shows up, e.g. "7-tabellen" or a skill label. */
  where: string[]
  skills: SkillId[]
  flaggedAt: number | null
  resolvedAt: number | null
  /** Evidence weight in the window (orders the signs). */
  weight: number
}

export interface Signs {
  /** "Vi har set tegn på …": at most two concepts. */
  concepts: Sign[]
  /** "Typiske fejl lige nu". */
  slips: Sign[]
  /** "Ser ud til at være på plads". */
  resolved: Sign[]
}

export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6'

export interface Recommendation {
  rule: RuleId
  title: string
  text: string
  skill?: SkillId
  misconception?: MisconceptionId
  region?: RegionId | WorldId
}

export interface GradeEstimate {
  /** ≥ 150 answers and ≥ 5 active days. */
  enough: boolean
  /** The highest whole grade the child has mostly covered, or null. */
  grade: Grade | null
  text: string
  /** Core skills at "Kan selv". */
  independent: SkillId[]
  answers: number
  activeDays: number
}

export interface Dashboard {
  name: string
  grade: Grade
  today: string
  overview: Overview
  skills: Record<SkillId, SkillState>
  domains: DomainCard[]
  trend: Trend
  tables: TableGrid
  trials: TrialRow[]
  recentRounds: RecentRound[]
  rewards: RewardDay[]
  signs: Signs
  recommendations: Recommendation[]
  estimate: GradeEstimate
}
