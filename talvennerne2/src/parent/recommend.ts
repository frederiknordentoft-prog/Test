// Recommendations (SPEC §9.1 point 8): at most three, by rule priority R1–R6. Each is something a
// parent can do away from the screen, said calmly; none of them judges the child.
//
// R1 a concept flag with its home tip · R2 right but slow (accuracy ≥ 85 %, < 40 % fast, ≥ 20
// answers in 14 days) · R3 a plateau (for the times tables: the table with the lowest mean box) ·
// R4 forgotten · R5 "Med støtte" without typed answers for 7 days · R6 "Klar til: {region}".
import { NODE_BY_ID, REGIONS, REGION_BY_ID, WORLD_BY_ID, nodesOfRegion, type RegionDef } from '../content/curriculum'
import { SKILL_BY_ID } from '../content/skills'
import { isFirstTry } from '../data/aggregate'
import { placedRank, placedStart, type PlacedStart } from '../engine/ladder'
import { daysBetween, learningDay } from '../engine/learningDay'
import { WORLD_IDS, type AnswerLogEntry, type DailyAggregate, type Medal, type ProfileDoc, type SkillId } from '../engine/types'
import { isRegionOpen, nodeDone, playedNodes, trialPassed, worldComplete } from '../meta/unlock'
import { addDays, inWindow, nameOf, windowEnding } from './format'
import { DASH_RANK, WINDOW_DAYS, currentPlace, dashStatus, keysOfSkill, snapshotsBefore } from './metrics'
import { afterAt, personal } from './signs'
import { productionTip, tableTip, tipFor } from './tips'
import type { DashStatus, Recommendation, RuleId, SkillKeyIndex, SkillRow, SkillState, Signs } from './types'

export const MAX_RECOMMENDATIONS = 3

/** R2: right but slow. */
export const R2 = { minAnswers: 20, minAccuracy: 0.85, maxFast: 0.4 } as const
/** R3: practised a lot without moving. */
export const R3 = { minAnswers: 30, minDays: 3, maxGain: 0.25 } as const
/** R5: days without a typed answer. */
export const R5_DAYS = 7
/** R4: days a skill must have been below what it once reached before it counts as forgotten. */
export const FORGOTTEN_AFTER_DAYS = 7

/** How many recommendations one rule may give. */
const CAP: Readonly<Record<RuleId, number>> = { R1: 2, R2: 2, R3: 1, R4: 2, R5: 1, R6: 1 }

/** The lowest status a medal says the child once reached. */
const MEDAL_FLOOR: Readonly<Record<Medal, DashStatus>> = { bronze: 'support', silver: 'support', gold: 'independent' }

export interface RecommendInput {
  name: string
  profile: ProfileDoc
  today: string
  answers: readonly AnswerLogEntry[]
  daily: readonly DailyAggregate[]
  index: SkillKeyIndex
  states: Readonly<Record<SkillId, SkillState>>
  /** 14-day rows of the skills shown on the dashboard. */
  rows: Readonly<Partial<Record<SkillId, SkillRow>>>
  signs: Signs
}

const quote = (skill: SkillId) => `»${SKILL_BY_ID[skill].label}«`

function r1(x: RecommendInput, name: string): Recommendation[] {
  return x.signs.concepts.map((s) => ({
    rule: 'R1',
    title: `Vi har set tegn på, at ${name} ${afterAt(s.title)}`,
    text: `${personal(s.parent, name)} Prøv derhjemme: ${s.homeTip}`,
    misconception: s.id,
    ...(s.skills[0] ? { skill: s.skills[0] } : {}),
  }))
}

function r2(x: RecommendInput, name: string, on: (s: SkillId) => boolean): Recommendation[] {
  return Object.values(x.rows)
    .filter((r): r is SkillRow => !!r && on(r.skill) && r.answers >= R2.minAnswers)
    .filter((r) => (r.accuracy ?? 0) >= R2.minAccuracy && (r.fastShare ?? 1) < R2.maxFast)
    .sort((a, b) => b.answers - a.answers)
    .map((r) => ({
      rule: 'R2',
      title: `Hurtighed i ${quote(r.skill)}`,
      text: `${name} regner ${quote(r.skill)} rigtigt, men bruger stadig tid på det. Det er helt normalt – hurtighed kommer med små, hyppige gentagelser. Prøv ${tipFor(r.skill, name)}.`,
      skill: r.skill,
    }))
}

/** Mean box per family of a skill (keys never answered count as box 0). */
function familyMeans(skill: SkillId, x: RecommendInput): [string, number][] {
  const sums = new Map<string, { box: number; n: number }>()
  for (const r of keysOfSkill(skill, x.index)) {
    const s = sums.get(r.family) ?? { box: 0, n: 0 }
    s.box += x.profile.keys[r.key]?.box ?? 0
    s.n += 1
    sums.set(r.family, s)
  }
  return [...sums.entries()].map(([f, s]) => [f, s.box / s.n])
}

function r3(x: RecommendInput, name: string, on: (s: SkillId) => boolean): Recommendation[] {
  const w = windowEnding(x.today, WINDOW_DAYS)
  const before = snapshotsBefore(x.daily, w.from)
  const inside = [...x.daily].filter((d) => inWindow(d.day, w)).sort((a, b) => (a.day < b.day ? -1 : 1))
  const out: { rec: Recommendation; n: number }[] = []
  for (const r of Object.values(x.rows)) {
    if (!r || !on(r.skill) || r.answers < R3.minAnswers) continue
    if (r.dash !== 'practising' && r.dash !== 'support') continue
    const days = inside.filter((d) => (d.bySkill[r.skill]?.n ?? 0) > 0).length
    if (days < R3.minDays) continue
    const then = before[r.skill] ?? inside.find((d) => d.snapshot[r.skill])?.snapshot[r.skill]
    if (!then || r.dash !== dashStatus(then.status)) continue
    if (r.meanBox - then.meanBox > R3.maxGain) continue
    const table = /^mul/.test(r.skill)
      ? familyMeans(r.skill, x).sort((a, b) => a[1] - b[1])[0]?.[0].match(/^t(\d+)$/)?.[1]
      : undefined
    out.push({
      n: r.answers,
      rec: table
        ? {
            rule: 'R3',
            title: `${table}-tabellen driller lidt`,
            text: `${name} har øvet ${quote(r.skill)} meget de sidste to uger, men det står lidt stille. Den tabel, der driller mest, er ${table}-tabellen. Prøv ${tableTip(Number(table))}.`,
            skill: r.skill,
          }
        : {
            rule: 'R3',
            title: `${quote(r.skill)} står lidt stille`,
            text: `${name} har øvet ${quote(r.skill)} meget de sidste to uger, men det står lidt stille. Det er normalt, og det går over. Prøv ${tipFor(r.skill, name)}.`,
            skill: r.skill,
          },
    })
  }
  return out.sort((a, b) => b.n - a.n).map((o) => o.rec)
}

/**
 * The latest learning day the skill is known to have been at `level` or above: a day that ended there
 * (its daily snapshot), or the day of a medal that says so (the reward log). Null when nothing says.
 */
function lastDayAt(skill: SkillId, level: DashStatus, x: Pick<RecommendInput, 'daily' | 'profile'>): string | null {
  let last: string | null = null
  const seen = (day: string) => {
    if (last === null || day > last) last = day
  }
  for (const d of x.daily) {
    const snap = d.snapshot[skill]
    if (snap && DASH_RANK[dashStatus(snap.status)] >= DASH_RANK[level]) seen(d.day)
  }
  for (const e of x.profile.rewardLog) {
    if (e.kind !== 'medal') continue
    const [medal, of] = e.what.split(':') as [Medal, SkillId]
    const floor = MEDAL_FLOOR[medal]
    if (of === skill && floor && DASH_RANK[floor] >= DASH_RANK[level]) seen(learningDay(e.ts))
  }
  return last
}

/**
 * Skills that look forgotten: below the status they had two weeks ago, or below an earned medal —
 * and below it for at least a week (review app-w2-r1 P2-8). A few slips on the day of a medal or a
 * passed trial are not forgetting: the child has just shown the skill, and the boxes come back with
 * practice. A medal with no date on record (an old one) counts as long ago.
 */
export function forgotten(x: Pick<RecommendInput, 'states' | 'daily' | 'today' | 'profile'>): SkillId[] {
  const w = windowEnding(x.today, WINDOW_DAYS)
  const before = snapshotsBefore(x.daily, w.from)
  const out: SkillId[] = []
  for (const s of Object.values(x.states)) {
    const then = before[s.skill]
    let level: DashStatus = then ? dashStatus(then.status) : 'notStarted'
    // a skill this version cannot enumerate has no live status to compare with its medal
    if (s.keys > 0 && s.medal && DASH_RANK[MEDAL_FLOOR[s.medal]] > DASH_RANK[level]) level = MEDAL_FLOOR[s.medal]
    if (DASH_RANK[s.dash] >= DASH_RANK[level]) continue
    const since = lastDayAt(s.skill, level, x)
    if (since !== null && daysBetween(since, x.today) < FORGOTTEN_AFTER_DAYS) continue
    out.push(s.skill)
  }
  const rank = (s: SkillId) => (x.states[s].medal === 'gold' ? 0 : x.states[s].medal ? 1 : 2)
  return out.sort((a, b) => rank(a) - rank(b))
}

function r4(x: RecommendInput, name: string, on: (s: SkillId) => boolean): Recommendation[] {
  return forgotten(x).filter(on).map((skill) => ({
    rule: 'R4',
    title: `Genopfrisk ${quote(skill)}`,
    text: `${name} har kunnet ${quote(skill)} sikrere end lige nu. Lidt gentagelse får det som regel hurtigt tilbage. Prøv ${tipFor(skill, name)}.`,
    skill,
  }))
}

function r5(x: RecommendInput, name: string, on: (s: SkillId) => boolean): Recommendation[] {
  const since = addDays(x.today, -(R5_DAYS - 1))
  const typed = new Set(x.answers.filter((a) => a.production && isFirstTry(a) && a.day >= since).map((a) => a.skill))
  for (const d of x.daily) {
    if (d.day < since) continue
    for (const [skill, s] of Object.entries(d.bySkill)) if ((s?.nProd ?? 0) > 0) typed.add(skill as SkillId)
  }
  return Object.values(x.states)
    .filter((s) => s.dash === 'support' && !s.skipped && on(s.skill) && !typed.has(s.skill))
    .sort((a, b) => ((x.rows[b.skill]?.lastPractised ?? '') > (x.rows[a.skill]?.lastPractised ?? '') ? 1 : -1))
    .map((s) => ({
      rule: 'R5',
      title: `Næste skridt i ${quote(s.skill)}`,
      text: `${name} kan ${quote(s.skill)} med støtte, men har ikke skrevet svarene selv den sidste uge. »Kan selv« kræver, at barnet skriver svaret selv på to forskellige dage. Prøv ${productionTip(name)}.`,
      skill: s.skill,
    }))
}

/**
 * The grades R6 may point into after a finished placement (SPEC A24, QA3c P2-3): from the start
 * region's world, and no world above it the child has not reached yet — by playing there, or as the
 * home world moves up (worldComplete). Null without a placement: the grade decides, as before.
 */
function placedWorlds(p: ProfileDoc): { placed: PlacedStart; from: number; upTo: number } | null {
  const placed = placedStart(p.placement)
  if (!placed) return null
  let upTo = WORLD_IDS.indexOf(placed.world)
  while (upTo + 1 < WORLD_IDS.length && worldComplete(p, WORLD_IDS[upTo])) upTo++
  for (const [id, n] of Object.entries(p.nodes)) {
    const world = NODE_BY_ID[id]?.world
    if (n && n.plays > 0 && world) upTo = Math.max(upTo, WORLD_IDS.indexOf(world))
  }
  return { placed, from: WORLD_BY_ID[placed.world].grade, upTo: WORLD_BY_ID[WORLD_IDS[upTo]].grade }
}

function r6(x: RecommendInput, name: string, on: (s: SkillId) => boolean): Recommendation[] {
  // Forward only (review app-w2-r1 P2-8): never a world below the child's grade or below the world
  // they play in now, and in that world no new place before the one they play in now. After a
  // placement the start region's world takes the grade's place, and the worlds above it wait until
  // the child gets there: no "Klar til: Tabeltoppen" for a child the ladder put in Hundredemarken.
  const here = currentPlace(x.profile)
  const at = here?.region ? REGION_BY_ID[here.region] : undefined
  const placed = placedWorlds(x.profile)
  const grade = (r: RegionDef) => WORLD_BY_ID[r.world].grade
  const floor = Math.max(placed ? placed.from : x.profile.grade, here ? WORLD_BY_ID[here.world].grade : 0)
  const regions = REGIONS.filter(
    (r) => grade(r) >= floor && (!placed || grade(r) <= placed.upTo) &&
      r.skills.some((s) => on(s.skill)) && isRegionOpen(x.profile, r.id),
  )
  const ahead = (r: RegionDef) => !at || r.world !== at.world || r.index > at.index
  const trials: Recommendation[] = regions
    .filter((r) => !trialPassed(x.profile, r.id) && nodesOfRegion(r.id).every((n) => n.slot === 'trial' || nodeDone(x.profile, n.id)))
    .map((r) => ({
      rule: 'R6',
      title: `Klar til: mesterprøven i ${r.name}`,
      text: `${name} har spillet turene i ${r.name}. Mesterprøven er det næste skridt, når ${name} har lyst – den kan tages om, så tit det skal være.`,
      region: r.id,
    }))
  const fresh: Recommendation[] = regions
    .filter((r) => ahead(r) && playedNodes(x.profile, r.id) === 0)
    // as on the map: the start region first, then the regions the placement did not pass over
    .sort((a, b) => (placed ? placedRank(placed.placed, a.id) - placedRank(placed.placed, b.id) : 0))
    .map((r) => ({
      rule: 'R6',
      title: `Klar til: ${r.name}`,
      text: `${r.name} i ${WORLD_BY_ID[r.world].name} er åben, og ${name} har ikke været der endnu. Den ligger på kortet.`,
      region: r.id,
    }))
  return [...trials, ...fresh]
}

/** At most three recommendations, in rule order, never two about the same skill. */
export function recommend(x: RecommendInput): Recommendation[] {
  const name = nameOf(x.name)
  const off = new Set(x.profile.settings.domainsOff)
  const on = (s: SkillId) => !off.has(SKILL_BY_ID[s].domain)
  const groups: Recommendation[][] = [r1(x, name), r2(x, name, on), r3(x, name, on), r4(x, name, on), r5(x, name, on), r6(x, name, on)]
  const out: Recommendation[] = []
  const used = new Set<string>()
  for (const group of groups) {
    let taken = 0
    for (const rec of group) {
      if (out.length >= MAX_RECOMMENDATIONS || taken >= CAP[rec.rule]) break
      if (rec.skill && used.has(rec.skill)) continue
      if (rec.skill) used.add(rec.skill)
      out.push(rec)
      taken += 1
    }
  }
  return out
}
