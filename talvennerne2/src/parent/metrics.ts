// The parent dashboard's numbers (SPEC §9.1) as pure functions of the profile, its daily aggregates
// and its answer log. Nothing here is a score: statuses are counted, shares are measured, and the
// mean box is kept for the plateau rule only, never shown.
import { TABLE_SKILLS } from '../content/achievements'
import { NODE_BY_ID, REGIONS, TRIAL_PASS, WORLDS, WORLD_BY_ID, type NodeSlot } from '../content/curriculum'
import { DOMAINS, SKILLS, SKILL_BY_ID } from '../content/skills'
import { countsInStats, isFirstTry } from '../data/aggregate'
import { isSkippedAtStart, skillStatus } from '../engine/status'
import { helpBridgeOpen } from '../engine/trial'
import type {
  AnswerLogEntry, DailyAggregate, DomainId, KeyState, ProfileDoc, SkillId, SkillStatus,
} from '../engine/types'
import { isFinaleOpen, isRegionOpen, trialPassed } from '../meta/unlock'
import { familyLabel } from './familyLabels'
import { addDays, daysOf, inWindow, windowEnding } from './format'
import type {
  DashInput, DashStatus, DayBar, DomainCard, DotKind, FamilyRow, KeyRef, MedianPair, Overview, Place, RecentRound,
  SkillKeyIndex, SkillRow, SkillState, TableGrid, Tally, TrialRow, Trend, Window,
} from './types'

/** The dashboard looks back two weeks; "for 14 dage siden" is the two weeks before that. */
export const WINDOW_DAYS = 14
/** A median from fewer typed answers than this is not shown. */
export const MIN_MEDIAN = 3

type Snapshot = NonNullable<DailyAggregate['snapshot'][SkillId]>

export const DASH_RANK: Readonly<Record<DashStatus, number>> = { notStarted: 0, practising: 1, support: 2, independent: 3 }

/** Silver is "Med støtte" on the dashboard; its medal says the rest. */
export const dashStatus = (s: SkillStatus): DashStatus => (s === 'silver' ? 'support' : s)

/** The current two weeks, and the two weeks before them. */
export function windows(today: string): { now: Window; before: Window } {
  const now = windowEnding(today, WINDOW_DAYS)
  return { now, before: windowEnding(addDays(now.from, -1), WINDOW_DAYS) }
}

const share = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null)

// ─── Skills ─────────────────────────────────────────────────────────────────

/** A skill's keys: the register's, or `<skill>/<family>` for a procedure skill it does not know yet. */
export function keysOfSkill(skill: SkillId, index: SkillKeyIndex): readonly KeyRef[] {
  const known = index[skill]
  if (known && known.length > 0) return known
  const meta = SKILL_BY_ID[skill]
  return meta.mode === 'procedure' ? meta.families.map((f) => ({ key: `${skill}/${f.id}`, family: f.id })) : []
}

/** Each skill's latest snapshot on a day before `day` (all days when omitted). */
export function snapshotsBefore(daily: readonly DailyAggregate[], day?: string): Partial<Record<SkillId, Snapshot>> {
  const out: Partial<Record<SkillId, Snapshot>> = {}
  const rows = [...daily].filter((d) => day === undefined || d.day < day).sort((a, b) => (a.day < b.day ? -1 : 1))
  for (const d of rows) for (const [skill, snap] of Object.entries(d.snapshot) as [SkillId, Snapshot][]) if (snap) out[skill] = snap
  return out
}

/** Status, dot, medal and key shares of one skill. */
export function skillState(skill: SkillId, profile: ProfileDoc, index: SkillKeyIndex, last?: Snapshot): SkillState {
  const meta = SKILL_BY_ID[skill]
  const refs = keysOfSkill(skill, index)
  const states = refs.map((r) => profile.keys[r.key])
  const known = refs.length > 0
  // a skill this version cannot enumerate (an import from a newer app) keeps its last snapshot
  const status: SkillStatus = known ? skillStatus(states, profile.skillStats[skill]) : last?.status ?? 'notStarted'
  const skipped = known && isSkippedAtStart(states)
  const dash = dashStatus(status)
  const counted = states.filter((k): k is KeyState => !!k)
  return {
    skill,
    domain: meta.domain,
    grade: meta.grade,
    label: meta.label,
    status,
    dash,
    skipped,
    dot: skipped ? 'skipped' : dash,
    medal: profile.skillMedals[skill] ?? null,
    keys: refs.length,
    share4: known ? counted.filter((k) => !k.seeded && k.box >= 4).length / refs.length : last?.share4 ?? 0,
    meanBox: known ? counted.reduce((s, k) => s + k.box, 0) / refs.length : last?.meanBox ?? 0,
  }
}

export function skillStates(profile: ProfileDoc, index: SkillKeyIndex, daily: readonly DailyAggregate[]): Record<SkillId, SkillState> {
  const last = snapshotsBefore(daily)
  return Object.fromEntries(SKILLS.map((m) => [m.id, skillState(m.id, profile, index, last[m.id])])) as Record<SkillId, SkillState>
}

/**
 * Status changes over the window: the status at its start (the last snapshot before it; a skill
 * with none had not been played) against the status now. Up and down are counted in the
 * dashboard's four levels, so a change is one the parent can see on the dots. A skill skipped at
 * start (seeded, not yet confirmed) has the dashed dot, not a status, so it has not moved (QA3b).
 */
export function trendOf(skills: readonly SkillId[], states: Readonly<Record<SkillId, SkillState>>, before: Partial<Record<SkillId, Snapshot>>): Trend {
  const up: SkillId[] = []
  const down: SkillId[] = []
  for (const skill of skills) {
    if (states[skill].dot === 'skipped') continue
    const then = before[skill] ? dashStatus(before[skill].status) : 'notStarted'
    const now = states[skill].dash
    if (DASH_RANK[now] > DASH_RANK[then]) up.push(skill)
    else if (DASH_RANK[now] < DASH_RANK[then]) down.push(skill)
  }
  return { up, down }
}

// ─── Tallies and times ──────────────────────────────────────────────────────

/** First tries per skill over a window, from the daily aggregates. */
export function tallies(daily: readonly DailyAggregate[], w: Window): Partial<Record<SkillId, Tally>> {
  const out: Partial<Record<SkillId, Tally>> = {}
  for (const d of daily) {
    if (!inWindow(d.day, w)) continue
    for (const [skill, s] of Object.entries(d.bySkill) as [SkillId, NonNullable<DailyAggregate['bySkill'][SkillId]>][]) {
      const t = (out[skill] ??= { n: 0, correct: 0, fast: 0, nProd: 0 })
      t.n += s.n
      t.correct += s.correct
      t.fast += s.fast
      t.nProd += s.nProd
    }
  }
  return out
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const v = [...values].sort((a, b) => a - b)
  const mid = v.length >> 1
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

/** Time to a correct typed first try: the median now and two weeks earlier (each needs ≥ 3 answers). */
export function medianPair(answers: readonly AnswerLogEntry[], today: string, keep: (a: AnswerLogEntry) => boolean): MedianPair {
  const { now, before } = windows(today)
  const times = (w: Window) => answers.filter((a) => keep(a) && a.production && a.correct && countsInStats(a) && inWindow(a.day, w)).map((a) => a.ms)
  const of = (w: Window) => {
    const t = times(w)
    return t.length >= MIN_MEDIAN ? median(t) : null
  }
  return { now: of(now), before: of(before) }
}

/** Learning time per domain over a window: each day's learning time shared out by its first tries. */
export function learnByDomain(daily: readonly DailyAggregate[], w: Window): Record<DomainId, number> {
  const out = Object.fromEntries(DOMAINS.map((d) => [d.id, 0])) as Record<DomainId, number>
  for (const d of daily) {
    if (!inWindow(d.day, w) || d.learnMs <= 0) continue
    const entries = Object.entries(d.bySkill) as [SkillId, { n: number }][]
    const total = entries.reduce((s, [, x]) => s + x.n, 0)
    if (total === 0) continue
    for (const [skill, x] of entries) out[SKILL_BY_ID[skill].domain] += (d.learnMs * x.n) / total
  }
  return out
}

// ─── Overview ───────────────────────────────────────────────────────────────

/** Where the child plays now: the region of the node played last. */
export function currentPlace(profile: Pick<ProfileDoc, 'nodes'>): Place | null {
  let best: { id: string; at: number } | null = null
  for (const [id, n] of Object.entries(profile.nodes)) {
    if (n && n.plays > 0 && NODE_BY_ID[id] && (!best || n.lastAt > best.at)) best = { id, at: n.lastAt }
  }
  if (!best) return null
  const node = NODE_BY_ID[best.id]
  const region = node.region ? REGIONS.find((r) => r.id === node.region) ?? null : null
  return { world: node.world, worldName: WORLD_BY_ID[node.world].name, region: region?.id ?? null, regionName: region?.name ?? null }
}

export function overview(input: Pick<DashInput, 'profile' | 'daily' | 'today'>): Overview {
  const w = windowEnding(input.today, WINDOW_DAYS)
  const byDay = new Map(input.daily.map((d) => [d.day, d]))
  const days: DayBar[] = daysOf(w).map((day) => {
    const d = byDay.get(day)
    const answers = d?.answers ?? 0
    return { day, learnMs: d?.learnMs ?? 0, playMs: d?.playMs ?? 0, answers, active: answers > 0 }
  })
  const inside = input.daily.filter((d) => inWindow(d.day, w))
  const sum = (f: (d: DailyAggregate) => number) => inside.reduce((s, d) => s + f(d), 0)
  const answers = sum((d) => d.answers)
  const firstTryCorrect = sum((d) => d.firstTryCorrect)
  return {
    days,
    activeDays: days.filter((d) => d.active).length,
    rounds: sum((d) => d.rounds),
    answers,
    firstTryCorrect,
    accuracy: share(firstTryCorrect, answers),
    learnMs: sum((d) => d.learnMs),
    playMs: sum((d) => d.playMs),
    place: currentPlace(input.profile),
    total: {
      answers: input.daily.reduce((s, d) => s + d.answers, 0),
      activeDays: Math.max(input.daily.filter((d) => d.answers > 0).length, input.profile.daysPlayed),
    },
  }
}

// ─── Skill rows and domain cards ────────────────────────────────────────────

/** The latest learning day the skill was practised (daily aggregates first, keys as a fallback). */
export function lastPractised(skill: SkillId, daily: readonly DailyAggregate[], refs: readonly KeyRef[], profile: ProfileDoc): string | null {
  let last: string | null = null
  for (const d of daily) if ((d.bySkill[skill]?.n ?? 0) > 0 && (!last || d.day > last)) last = d.day
  for (const r of refs) {
    const k = profile.keys[r.key]
    if (k && k.seen > 0 && k.lastDay && (!last || k.lastDay > last)) last = k.lastDay
  }
  return last
}

export function skillRow(state: SkillState, input: DashInput, tally: Tally | undefined): SkillRow {
  const { profile, index, answers, today, daily } = input
  const refs = keysOfSkill(state.skill, index)
  const w = windowEnding(today, WINDOW_DAYS)
  const tries = answers.filter((a) => a.skill === state.skill && countsInStats(a) && inWindow(a.day, w))
  const order = SKILL_BY_ID[state.skill].families.map((f) => f.id)
  const byFamily = new Map<string, KeyRef[]>()
  for (const r of refs) byFamily.set(r.family, [...(byFamily.get(r.family) ?? []), r])
  const families: FamilyRow[] = [...byFamily.entries()]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([family, keys]) => {
      const ks = keys.map((r) => profile.keys[r.key]).filter((k): k is KeyState => !!k)
      const mine = tries.filter((a) => a.family === family)
      return {
        family,
        label: familyLabel(state.skill, family),
        keys: keys.length,
        seen: ks.filter((k) => k.seen > 0).length,
        share4: ks.filter((k) => !k.seeded && k.box >= 4).length / keys.length,
        answers: mine.length,
        accuracy: share(mine.filter((a) => a.correct).length, mine.length),
      }
    })
  const n = tally?.n ?? 0
  return {
    ...state,
    lastPractised: lastPractised(state.skill, daily, refs, profile),
    answers: n,
    accuracy: share(tally?.correct ?? 0, n),
    fastShare: share(tally?.fast ?? 0, n),
    slowShare: tally ? share(tally.correct - tally.fast, n) : null,
    median: medianPair(answers, today, (a) => a.skill === state.skill),
    families,
  }
}

const emptyCounts = (): Record<DotKind, number> => ({ notStarted: 0, practising: 0, support: 0, independent: 0, skipped: 0 })

/** Skills shown for a domain: up to the child's grade + 1, plus any started above that. */
export function domainScope(domain: DomainId, grade: number, states: Readonly<Record<SkillId, SkillState>>): { scope: SkillId[]; ahead: SkillId[] } {
  const skills = SKILLS.filter((m) => m.domain === domain)
  return {
    scope: skills.filter((m) => m.grade <= grade + 1).map((m) => m.id),
    ahead: skills.filter((m) => m.grade > grade + 1 && states[m.id].status !== 'notStarted').map((m) => m.id),
  }
}

export function domainCards(input: DashInput, states: Readonly<Record<SkillId, SkillState>>): DomainCard[] {
  const { profile, daily, answers, today } = input
  const w = windowEnding(today, WINDOW_DAYS)
  const t = tallies(daily, w)
  const before = snapshotsBefore(daily, w.from)
  const learn = learnByDomain(daily, w)
  return DOMAINS.map((d) => {
    const { scope, ahead } = domainScope(d.id, profile.grade, states)
    const counts = emptyCounts()
    for (const s of scope) counts[states[s].dot] += 1
    const shown = [...scope, ...ahead]
    const n = shown.reduce((s, id) => s + (t[id]?.n ?? 0), 0)
    const correct = shown.reduce((s, id) => s + (t[id]?.correct ?? 0), 0)
    return {
      domain: d.id,
      label: d.label,
      group: d.group,
      off: profile.settings.domainsOff.includes(d.id),
      scope,
      counts,
      ahead,
      trend: trendOf(shown, states, before),
      answers: n,
      accuracy: share(correct, n),
      median: medianPair(answers, today, (a) => SKILL_BY_ID[a.skill]?.domain === d.id),
      learnMs: learn[d.id],
      rows: shown.map((id) => skillRow(states[id], input, t[id])),
    }
  })
}

// ─── Times table ────────────────────────────────────────────────────────────

/** 10 · 10 products coloured by box. Empty until a multiplication skill is registered or played. */
export function tableGrid(profile: Pick<ProfileDoc, 'keys'>, index: SkillKeyIndex): TableGrid {
  const owner = new Map<string, SkillId>()
  for (const s of TABLE_SKILLS) for (const r of index[s] ?? []) owner.set(r.key, s)
  const played = Object.keys(profile.keys).some((k) => k.startsWith('mul:'))
  const rows = Array.from({ length: 10 }, (_, i) =>
    Array.from({ length: 10 }, (_, j) => {
      const a = i + 1
      const b = j + 1
      const id = `mul:${Math.min(a, b)}x${Math.max(a, b)}`
      const k = profile.keys[id]
      const key = owner.has(id) || k ? id : null
      return { a, b, key, skill: owner.get(id) ?? null, box: k?.box ?? 0, seen: (k?.seen ?? 0) > 0 }
    }),
  )
  return { available: owner.size > 0 || played, rows }
}

// ─── Trials, rounds ─────────────────────────────────────────────────────────

/** Region trials and world finales that are open or passed, in curriculum order. */
export function trialRows(profile: ProfileDoc): TrialRow[] {
  const out: TrialRow[] = []
  for (const r of REGIONS) {
    const t = profile.trials[r.id]
    const passed = trialPassed(profile, r.id)
    if (!passed && !isRegionOpen(profile, r.id)) continue
    out.push({
      id: r.id, kind: 'trial', name: r.name, worldName: WORLD_BY_ID[r.world].name, state: passed ? 'passed' : 'open',
      attempts: t?.attempts ?? 0, best: t?.best ?? 0, size: TRIAL_PASS.trial.size, passedAt: t?.passedAt ?? null, bridge: helpBridgeOpen(t),
    })
  }
  for (const w of WORLDS) {
    const t = profile.trials[w.id]
    const passed = trialPassed(profile, w.id)
    if (!passed && !isFinaleOpen(profile, w.id)) continue
    out.push({
      id: w.id, kind: 'finale', name: `${w.name}s finale`, worldName: w.name, state: passed ? 'passed' : 'open',
      attempts: t?.attempts ?? 0, best: t?.best ?? 0, size: TRIAL_PASS.finale.size, passedAt: t?.passedAt ?? null, bridge: false,
    })
  }
  return out
}

const SLOT_NAME: Readonly<Record<NodeSlot, string>> = {
  l1: '1. tur', l2: '2. tur', friend: 'venneturen', chest: 'kisteturen', l3: '3. tur', mix: 'blandet tur', trial: 'mesterprøven', finale: 'finalen',
}

/** 'Plusengen · 2. tur', 'Blandet øvelse', 'Indplacering' … */
export function nodeName(nodeId: string): string {
  if (nodeId === 'practice') return 'Blandet øvelse'
  if (nodeId === 'hut') return 'Træningshytten'
  if (nodeId === 'placement') return 'Indplacering'
  const node = NODE_BY_ID[nodeId]
  if (!node) return 'En tur'
  const place = node.region ? REGIONS.find((r) => r.id === node.region)?.name : WORLD_BY_ID[node.world].name
  return `${place ?? WORLD_BY_ID[node.world].name} · ${SLOT_NAME[node.slot]}`
}

/** The latest rounds in the answer log, newest first (first tries only). */
export function recentRounds(answers: readonly AnswerLogEntry[], limit = 8): RecentRound[] {
  const rounds = new Map<string, RecentRound>()
  for (const a of answers) {
    const r = rounds.get(a.roundId) ?? { roundId: a.roundId, ts: a.ts, day: a.day, where: nodeName(a.mode === 'placement' ? 'placement' : a.nodeId), tasks: 0, firstTryCorrect: 0 }
    if (a.ts < r.ts) Object.assign(r, { ts: a.ts, day: a.day })
    if (isFirstTry(a)) {
      r.tasks += 1
      if (a.correct) r.firstTryCorrect += 1
    }
    rounds.set(a.roundId, r)
  }
  return [...rounds.values()].filter((r) => r.tasks > 0).sort((a, b) => b.ts - a.ts).slice(0, limit)
}
