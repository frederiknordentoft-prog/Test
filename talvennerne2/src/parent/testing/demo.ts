// A demo household for looking at the parent dashboard (screenshots, manual checks on the dev
// server): Ada in 1. klasse with three weeks of Engdalen behind her, and Bo in 0. klasse who has
// just started. Writes straight into IndexedDB. Never imported by the app.
import { answerDelta, emptyDaily, mergeDaily, snapshotFor } from '../../data/aggregate'
import { getDb } from '../../data/db'
import { newProfileDoc } from '../../data/repo/profiles'
import { emptyKey } from '../../engine/mastery'
import { learningDay } from '../../engine/learningDay'
import { skillRegistry } from '../../engine/registry'
import { makeRng, type Rng } from '../../engine/rng'
import type {
  AnswerLogEntry, Box, DailyAggregate, KeyState, MisconceptionId, MisconceptionState, ProfileDoc, RewardLogEntry, SkillId,
} from '../../engine/types'
import { addDays } from '../format'
import { keyIndexOf } from '../load'
import type { KeyRef } from '../types'

const DAY_MS = 86_400_000

interface Habit {
  /** First-try accuracy, share of right answers that are fast, share typed. */
  p: number
  fast: number
  prod: number
  error?: MisconceptionId
  node: string
}

const HABITS: Partial<Record<SkillId, Habit>> = {
  addTo10: { p: 0.9, fast: 0.3, prod: 0.85, error: 'countFromFirst', node: 'w0-plus10-l2' },
  count10: { p: 0.97, fast: 0.85, prod: 0.7, node: 'w0-tal10-mix' },
  hear20: { p: 0.95, fast: 0.8, prod: 0.8, node: 'w0-tal10-l3' },
  count20: { p: 0.85, fast: 0.6, prod: 0.6, node: 'w0-tal20-l1' },
  order20: { p: 0.75, fast: 0.5, prod: 0.5, node: 'w0-tal20-l2' },
  subTo10: { p: 0.78, fast: 0.45, prod: 0.6, node: 'w0-minus10-l1' },
  patterns: { p: 0.86, fast: 0.6, prod: 0, node: 'w0-former-l2' },
  shapes2D: { p: 0.8, fast: 0.5, prod: 0.3, node: 'w0-former-l1' },
  compareLength: { p: 0.7, fast: 0.6, prod: 0.5, error: 'lengthByEnd', node: 'w0-former-l3' },
}

/** Which skills Ada played, n days ago. */
const PLAN: Record<number, SkillId[]> = {
  0: ['addTo10', 'subTo10'], 1: ['addTo10', 'count20'], 2: ['addTo10', 'order20', 'compareLength'], 4: ['addTo10', 'shapes2D'],
  5: ['subTo10', 'count20'], 7: ['addTo10', 'compareLength'], 8: ['patterns', 'addTo10'], 9: ['order20', 'count20'],
  11: ['addTo10', 'patterns'], 12: ['count10', 'hear20', 'addTo10'], 15: ['addTo10', 'compareLength'], 17: ['count10', 'hear20'],
  19: ['patterns', 'compareLength'], 20: ['count10', 'addTo10'],
}

function answersFor(profileId: string, skill: SkillId, day: string, n: number, rng: Rng, roundId: string, keys: readonly KeyRef[], at: number): AnswerLogEntry[] {
  const h = HABITS[skill]!
  const out: AnswerLogEntry[] = []
  let ts = at
  for (let i = 0; i < n; i++) {
    const correct = rng.next() < h.p
    const fast = correct && rng.next() < h.fast
    const production = rng.next() < h.prod
    const ms = fast ? rng.between(1500, 3400) : correct ? rng.between(4200, 9000) : rng.between(3000, 8000)
    ts += ms + rng.between(1500, 4000)
    const { key, family } = rng.pick(keys)
    out.push({
      profileId, ts, day, sessionId: `s-${day}`, roundId, nodeId: h.node, mode: 'round', skill, family, factId: key, masteryKey: key,
      kind: production ? 'keypad' : 'choice', optionsCount: production ? 0 : 3, production, given: correct ? 1 : 2, answer: 1,
      correct, ms, fast, errorTag: !correct && h.error && rng.next() < 0.6 ? h.error : null, detectable: h.error ? [h.error] : [],
      boxBefore: 1, boxAfter: 1, scaffold: false, replays: 0, retryOf: null, assisted: false, audioUnverified: false,
    })
  }
  return out
}

function keysWith(list: readonly string[], boxes: (i: number) => number, day: string, over: Partial<KeyState> = {}): Record<string, KeyState> {
  return Object.fromEntries(list.map((k, i) => {
    const box = boxes(i)
    return [k, { ...emptyKey(), box: box as Box, seen: box > 0 ? 4 + (i % 5) : 2, correct: box > 0 ? 3 + (i % 4) : 1, lastDay: day, boxDay: day, boxAt: 0, ...over }]
  }))
}

const flag = (status: MisconceptionState['status'], at: number, day: string): MisconceptionState => ({
  status,
  hits: status === 'flagged' ? [0, 1, 2, 3].map((i) => ({ day: addDays(day, -2 * i), factId: `f${i}`, w: 1, production: true })) : [],
  opps: [],
  flaggedAt: at - 9 * DAY_MS,
  resolvedAt: status === 'resolved' ? at - 2 * DAY_MS : null,
})

/** Build Ada and Bo and store them. Returns their ids. */
export async function seedDemo(now: number = Date.now()): Promise<{ ada: string; bo: string }> {
  const rng = makeRng(20261001)
  const index = keyIndexOf(skillRegistry())
  const refsOf = (s: SkillId) => index[s] ?? []
  const keysOf = (s: SkillId) => refsOf(s).map((r) => r.key)
  const today = learningDay(now)
  const dayAt = (n: number) => addDays(today, -n)
  /** A morning time on the learning day n days ago (never later than an hour before now). */
  const tsAt = (n: number) => Math.min(Date.parse(`${dayAt(n)}T07:00:00Z`), now - 3_600_000)

  // ── Ada ──
  const ada = newProfileDoc('Ada', 1, { frameColor: 'coral', now: now - 22 * DAY_MS })
  const log: AnswerLogEntry[] = []
  const extra = new Map<string, Partial<DailyAggregate>>()
  for (const [n, skills] of Object.entries(PLAN)) {
    const day = dayAt(Number(n))
    let at = tsAt(Number(n))
    skills.forEach((skill, r) => {
      const answers = answersFor(ada.id, skill, day, 10, rng, `r-${day}-${r}`, refsOf(skill), at)
      log.push(...answers)
      at = answers[answers.length - 1].ts + 60_000
    })
    extra.set(day, { rounds: skills.length, playMs: Number(n) % 3 === 0 ? rng.between(3, 12) * 60_000 : 0 })
  }

  const k = (s: SkillId, boxes: (i: number) => number, over: Partial<KeyState> = {}) => keysWith(keysOf(s), boxes, dayAt(1), over)
  const keys = {
    ...k('count10', (i) => (i < 24 ? 5 : 4)),
    ...k('hear20', (i) => (i < 18 ? 5 : 3)),
    ...k('compareLength', () => 3),
    ...k('count20', (i) => (i < 15 ? 2 + (i % 2) : 1)),
    ...k('order20', (i) => [3, 2, 1, 0][i]),
    ...k('addTo10', (i) => (i < 36 ? 4 : i < 56 ? 2 : 1)),
    ...k('subTo10', (i) => (i < 20 ? 2 : i < 30 ? 1 : 0)),
    ...k('tenFriends', () => 2, { seeded: true, seen: 0, correct: 0 }),
    ...k('patterns', (i) => [3, 3, 2, 2, 1][i]),
    ...k('shapes2D', (i) => (i < 18 ? 1 + (i % 2) : 0)),
  }
  for (const s of ['subTo10', 'shapes2D'] as SkillId[]) {
    for (const key of keysOf(s)) if (keys[key].box === 0 && keys[key].seen === 2) delete keys[key]
  }
  const days = (n: number) => Array.from({ length: n }, (_, i) => dayAt(2 + 3 * i))
  const adaDoc: ProfileDoc = {
    ...ada,
    daysPlayed: Object.keys(PLAN).length,
    lastLearningDay: today,
    placement: { done: true, at: now - 21 * DAY_MS, highest: 'L2' },
    keys,
    skillStats: {
      count10: { prodCorrect: 80, prodDays: days(5) }, hear20: { prodCorrect: 52, prodDays: days(4) },
      compareLength: { prodCorrect: 30, prodDays: days(3) }, addTo10: { prodCorrect: 90, prodDays: days(4) },
      count20: { prodCorrect: 14, prodDays: days(2) }, subTo10: { prodCorrect: 12, prodDays: days(2) },
    },
    skillMedals: { count10: 'gold', hear20: 'gold', compareLength: 'gold', addTo10: 'silver', count20: 'bronze', patterns: 'bronze' },
    nodes: Object.fromEntries(
      ['w0-tal10-l1', 'w0-tal10-l2', 'w0-tal10-friend', 'w0-tal10-l3', 'w0-tal10-mix', 'w0-former-l1', 'w0-former-l2', 'w0-former-chest', 'w0-former-l3', 'w0-plus10-l1', 'w0-plus10-l2', 'w0-tal20-l1', 'w0-tal20-l2', 'w0-minus10-l1']
        .map((id, i) => [id, { plays: 1 + (i % 3), stars: (1 + (i % 3)) as 1 | 2 | 3, skipped: false, lastAt: now - (14 - i) * DAY_MS / 2 }]),
    ),
    trials: {
      'w0-tal10': { attempts: 1, failed: 0, best: 9, passedAt: now - 12 * DAY_MS, lastAttemptRound: 8 },
      'w0-former': { attempts: 1, failed: 1, best: 7, passedAt: null, lastAttemptRound: 15 },
    },
    unlocked: { worlds: ['eng'], regions: [] },
    roundIndex: 28,
    misconceptions: {
      lengthByEnd: flag('flagged', now, today),
      countFromFirst: flag('flagged', now, today),
      digitSwap: flag('resolved', now, today),
    },
    economy: { perler: 146, xp: 620, level: 4, eggWarmth: 30, eggsHatched: 1, eggSpecies: null, wish: null },
    animals: [
      { uid: 'starter-rabbit', species: 'rabbit', breed: 'upright', colorway: 'c2', name: 'Snuske', friendship: 60, stage: 2, star: false, shown: 2, outfit: {}, foundAt: now - 21 * DAY_MS, source: 'starter' },
      { uid: 'friend-cat', species: 'cat', breed: 'domestic', colorway: 'c1', name: 'Mis', friendship: 20, stage: 1, star: false, shown: 1, outfit: {}, foundAt: now - 4 * DAY_MS, source: 'friend' },
    ],
    buddyUid: 'starter-rabbit',
    inventory: { 'opdager-head': { at: now - 9 * DAY_MS, colors: [0] } },
    achievements: { 'days-3': now - 18 * DAY_MS, 'days-7': now - 9 * DAY_MS },
    rewardLog: ([
      ...[20, 19, 17, 15, 12, 11, 9, 8, 7, 5, 4, 2, 1, 0].map((n): RewardLogEntry => ({ ts: tsAt(n) + 1_800_000, kind: 'perler', what: String(8 + (n % 5) * 3), why: 'round:w0-plus10-l2' })),
      { ts: tsAt(12) + 900_000, kind: 'stars', what: 'w0-tal10-mix:3', why: 'round:w0-tal10-mix' },
      { ts: tsAt(12) + 950_000, kind: 'medal', what: 'gold:count10', why: 'medal:gold:count10' },
      { ts: tsAt(9) + 900_000, kind: 'item', what: 'opdager-head', why: 'node:w0-former-chest' },
      { ts: tsAt(9) + 950_000, kind: 'trophy', what: 'days-7', why: 'round:w0-former-chest' },
      { ts: tsAt(4) + 900_000, kind: 'animal', what: 'cat:domestic:c1', why: 'friend:round:w0-plus10-friend' },
      { ts: tsAt(2) + 900_000, kind: 'level', what: '4', why: 'level:4' },
      { ts: tsAt(1) + 900_000, kind: 'medal', what: 'silver:addTo10', why: 'medal:silver:addTo10' },
      { ts: tsAt(1) + 950_000, kind: 'growth', what: 'starter-rabbit:2', why: 'friendship' },
    ] satisfies RewardLogEntry[]).sort((a, b) => a.ts - b.ts),
  }

  // daily rows: the log through the data layer's own deltas, plus time, rounds and snapshots
  const daily = new Map<string, DailyAggregate>()
  for (const a of log) {
    const d = answerDelta(a, { learnMs: a.ms + 2500, newSession: false })
    daily.set(a.day, daily.has(a.day) ? mergeDaily(daily.get(a.day)!, d) : d)
  }
  for (const [day, x] of extra) {
    const d = daily.get(day) ?? emptyDaily(ada.id, day)
    daily.set(day, { ...d, rounds: x.rounds ?? 0, playMs: x.playMs ?? 0, sessions: 1 })
  }
  const keysOfSkill = (s: SkillId) => keysOf(s)
  const before = dayAt(20)
  daily.set(before, {
    ...daily.get(before)!,
    snapshot: {
      addTo10: { meanBox: 1.2, share2: 0.4, share4: 0.1, status: 'practising' },
      count20: { meanBox: 0.8, share2: 0.3, share4: 0, status: 'practising' },
      compareLength: { meanBox: 4.6, share2: 1, share4: 0.88, status: 'independent' },
      count10: { meanBox: 4.8, share2: 1, share4: 1, status: 'independent' },
      hear20: { meanBox: 4.5, share2: 1, share4: 0.86, status: 'independent' },
    },
  })
  daily.set(today, { ...daily.get(today)!, snapshot: snapshotFor(adaDoc, ['addTo10', 'subTo10'], keysOfSkill) })

  // ── Bo ──
  const bo = newProfileDoc('Bo', 0, { frameColor: 'leaf', now: now - 3 * DAY_MS })
  const boLog = [
    ...answersFor(bo.id, 'count10', dayAt(1), 10, rng, 'b1', refsOf('count10'), tsAt(1)),
    ...answersFor(bo.id, 'count10', dayAt(0), 8, rng, 'b2', refsOf('count10'), tsAt(0)),
  ]
  const boDaily = new Map<string, DailyAggregate>()
  for (const a of boLog) {
    const d = answerDelta(a, { learnMs: a.ms + 2500, newSession: false })
    boDaily.set(a.day, boDaily.has(a.day) ? mergeDaily(boDaily.get(a.day)!, d) : { ...d, rounds: 1 })
  }
  const boDoc: ProfileDoc = {
    ...bo,
    daysPlayed: 2,
    lastLearningDay: today,
    keys: keysWith(keysOf('count10').slice(0, 12), (i) => (i < 6 ? 2 : 1), dayAt(0)),
    nodes: { 'w0-tal10-l1': { plays: 2, stars: 2, skipped: false, lastAt: now - 3_600_000 } },
  }

  const db = getDb()
  await db.transaction('rw', [db.profiles, db.answers, db.daily], async () => {
    for (const id of [ada.id, bo.id]) {
      await db.answers.where('[profileId+ts]').between([id, -Infinity], [id, Infinity]).delete()
      await db.daily.where('profileId').equals(id).delete()
    }
    await db.profiles.bulkPut([adaDoc, boDoc])
    await db.answers.bulkAdd([...log, ...boLog])
    await db.daily.bulkPut([...daily.values(), ...boDaily.values()])
  })
  return { ada: ada.id, bo: bo.id }
}
