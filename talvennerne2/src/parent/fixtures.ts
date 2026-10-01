// Test fixtures for the parent dashboard: constructed profiles, answer logs and daily aggregates.
// Daily rows are built with the data layer's own delta functions, so they count exactly like the
// app does. Never imported by the app.
import { SKILL_BY_ID } from '../content/skills'
import { answerDelta, emptyDaily, mergeDaily } from '../data/aggregate'
import { emptyKey } from '../engine/mastery'
import { newProfile } from '../engine/testing/profile'
import type {
  AnswerLogEntry, Box, DailyAggregate, KeyState, MisconceptionId, MisconceptionState, ProfileDoc, SkillId, SkillStatus,
} from '../engine/types'
import { addDays } from './format'
import type { DashSource, KeyRef, SkillKeyIndex } from './types'

export const TODAY = '2026-10-01'
/** 12:00 in Copenhagen on TODAY (the learning day starts at 04:00). */
export const NOW = Date.parse(`${TODAY}T10:00:00Z`)

export const ago = (n: number): string => addDays(TODAY, -n)
export const tsOf = (day: string, hour = 10, minute = 0): number =>
  Date.parse(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`)

export function profile(over: Partial<ProfileDoc> = {}): ProfileDoc {
  return newProfile({ name: 'Ada', grade: 0, daysPlayed: 0, ...over })
}

export function key(box: number, over: Partial<KeyState> = {}): KeyState {
  return { ...emptyKey(), box: box as Box, seen: box > 0 ? 3 : 1, correct: box > 0 ? 3 : 0, lastDay: TODAY, boxDay: TODAY, ...over }
}

/** `n` recall keys `<prefix><i>` in one family. */
export function refs(prefix: string, n: number, family = 'all'): KeyRef[] {
  return Array.from({ length: n }, (_, i) => ({ key: `${prefix}${i}`, family }))
}

/** All keys of the given refs at one box (or per ref with a function). */
export function keysAt(list: readonly KeyRef[], box: number | ((i: number) => number), over: Partial<KeyState> = {}): Record<string, KeyState> {
  return Object.fromEntries(list.map((r, i) => [r.key, key(typeof box === 'number' ? box : box(i), over)]))
}

let seq = 0

export function answer(over: Partial<AnswerLogEntry> & Pick<AnswerLogEntry, 'skill'>): AnswerLogEntry {
  const day = over.day ?? TODAY
  seq += 1
  return {
    profileId: 'p1', ts: tsOf(day, 10, seq % 50), day, sessionId: 's1', roundId: `r-${day}`, nodeId: 'w0-plus10-l1', mode: 'round',
    family: SKILL_BY_ID[over.skill].families[0].id, factId: `f${seq}`, masteryKey: `k${seq}`, kind: 'keypad', optionsCount: 0,
    production: true, given: 1, answer: 1, correct: true, ms: 3000, fast: true, errorTag: null, detectable: [],
    boxBefore: 0, boxAfter: 0, scaffold: false, replays: 0, retryOf: null, assisted: false, audioUnverified: false,
    ...over,
  }
}

/** `n` answers in a skill on one day; `correct`/`fast` say how many of them are. */
export function answers(skill: SkillId, day: string, n: number, opts: { correct?: number; fast?: number; ms?: number; production?: boolean; family?: string; errorTag?: MisconceptionId } = {}): AnswerLogEntry[] {
  const correct = opts.correct ?? n
  const fast = opts.fast ?? correct
  return Array.from({ length: n }, (_, i) => answer({
    skill, day, correct: i < correct, fast: i < Math.min(fast, correct), ms: opts.ms ?? 3000, production: opts.production ?? true,
    ...(opts.family ? { family: opts.family } : {}),
    ...(i >= correct && opts.errorTag ? { errorTag: opts.errorTag } : {}),
  }))
}

export interface DayExtra {
  learnMs?: number
  playMs?: number
  rounds?: number
  snapshot?: DailyAggregate['snapshot']
}

/** Daily aggregates from answers (and per-day extras), merged like the write path does. */
export function dailyFrom(log: readonly AnswerLogEntry[], extra: Readonly<Record<string, DayExtra>> = {}): DailyAggregate[] {
  const days = new Map<string, DailyAggregate>()
  for (const a of log) {
    const delta = answerDelta(a, { learnMs: 0, newSession: false })
    const prev = days.get(a.day)
    days.set(a.day, prev ? mergeDaily(prev, delta) : delta)
  }
  for (const [day, x] of Object.entries(extra)) {
    const d = days.get(day) ?? emptyDaily('p1', day)
    days.set(day, {
      ...d,
      learnMs: d.learnMs + (x.learnMs ?? 0),
      playMs: d.playMs + (x.playMs ?? 0),
      rounds: d.rounds + (x.rounds ?? 0),
      snapshot: { ...d.snapshot, ...(x.snapshot ?? {}) },
    })
  }
  return [...days.values()].sort((a, b) => (a.day < b.day ? -1 : 1))
}

export const snap = (status: SkillStatus, meanBox = 1, share4 = 0): NonNullable<DailyAggregate['snapshot'][SkillId]> =>
  ({ status, meanBox, share2: 0, share4 })

export function source(over: Partial<DashSource> = {}): DashSource {
  return { daily: [], answers: [], index: {}, today: TODAY, now: NOW, ...over }
}

/** A flagged (or resolved) misconception with `hits` weight-1 hits on distinct facts. */
export function misconception(status: MisconceptionState['status'], hits = 3, at = NOW): MisconceptionState {
  return {
    status,
    hits: Array.from({ length: hits }, (_, i) => ({ day: ago(i), factId: `f${i}`, w: 1, production: true })),
    opps: [],
    flaggedAt: status === 'watching' ? null : at,
    resolvedAt: status === 'resolved' ? at : null,
  }
}

/** A synthetic key index for skills the register does not have yet (procedure skills need none). */
export function index(entries: Partial<Record<SkillId, readonly KeyRef[]>>): SkillKeyIndex {
  return entries
}

/** The times tables' keys by the CONVENTIONS fact ids (`mul:<a>x<b>`, smallest factor first). */
export function tableIndex(): SkillKeyIndex {
  const of = (tables: number[], exclude: number[] = []): KeyRef[] => {
    const out: KeyRef[] = []
    for (let a = 1; a <= 10; a++) {
      for (let b = a; b <= 10; b++) {
        const t = tables.find((n) => (a === n || b === n) && !exclude.includes(a) && !exclude.includes(b))
        if (t !== undefined && !out.some((r) => r.key === `mul:${a}x${b}`)) out.push({ key: `mul:${a}x${b}`, family: `t${t}` })
      }
    }
    return out
  }
  return {
    mul2510: of([2, 5, 10]),
    mul34: of([3, 4], [2, 5, 10]),
    mul6to9: of([6, 7, 8, 9], [2, 3, 4, 5, 10]),
  }
}
