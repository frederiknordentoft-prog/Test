// Danish wording and number formats for the parent dashboard, and calendar arithmetic on learning
// days ('YYYY-MM-DD'). Plain adult text: no scores, no streaks, no judgement in the words.
import { learningDay } from '../engine/learningDay'
import type { Medal } from '../engine/types'
import type { DotKind, Window } from './types'

const DAY_MS = 86_400_000

/** The learning day `n` days after `day` (negative: before). */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** The `length` learning days ending with `to`. */
export function windowEnding(to: string, length: number): Window {
  return { from: addDays(to, -(length - 1)), to }
}

export const inWindow = (day: string, w: Window): boolean => day >= w.from && day <= w.to

/** Every day of a window, oldest first. */
export function daysOf(w: Window): string[] {
  const out: string[] = []
  for (let d = w.from; d <= w.to; d = addDays(d, 1)) out.push(d)
  return out
}

const MONTHS = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']
const WEEKDAYS = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør']
const WEEKDAYS_LONG = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']

const utc = (day: string) => new Date(`${day}T00:00:00Z`)

/** '2026-09-29' → '29. sep.' */
export function fmtDate(day: string): string {
  const d = utc(day)
  return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`
}

/** '2026-09-29' → 'tir' */
export const fmtWeekday = (day: string): string => WEEKDAYS[utc(day).getUTCDay()]

/** '2026-09-29' → 'tirsdag 29. sep.' */
export const fmtLongDate = (day: string): string => `${WEEKDAYS_LONG[utc(day).getUTCDay()]} ${fmtDate(day)}`

/** 'i dag', 'i går', 'for 4 dage siden' (up to two weeks), else the date. */
export function fmtRelativeDay(day: string, today: string): string {
  const n = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY_MS)
  if (n <= 0) return 'i dag'
  if (n === 1) return 'i går'
  if (n < 14) return `for ${n} dage siden`
  return fmtDate(day)
}

/** The date of a timestamp, as its learning day. */
export const fmtTsDate = (ts: number): string => fmtDate(learningDay(ts))

/** '0 min', 'under 1 min', '12 min', '1 t 5 min'. */
export function fmtMinutes(ms: number): string {
  if (!(ms > 0)) return '0 min'
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'under 1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest ? `${h} t ${rest} min` : `${h} t`
}

/** '4,2 s' */
export function fmtSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`
}

/** '87 %' (a measured share, never a score). */
export function fmtPercent(share: number): string {
  return `${Math.round(share * 100)} %`
}

export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

/** Words for the curriculum dots (SPEC §9.1). */
export const DOT_LABEL: Readonly<Record<DotKind, string>> = {
  notStarted: 'Ikke startet',
  practising: 'Øver',
  support: 'Med støtte',
  independent: 'Kan selv',
  skipped: 'Sprunget over ved start',
}

/** Order on the curriculum map's legend and in the domain counts. */
export const DOT_ORDER: readonly DotKind[] = ['independent', 'support', 'practising', 'skipped', 'notStarted']

export const MEDAL_LABEL: Readonly<Record<Medal, string>> = { bronze: 'bronze', silver: 'sølv', gold: 'guld' }

/** 'Kan selv 3 · Med støtte 2 · Øver 1 · Ikke startet 4' (kinds with 0 are left out, except when all are). */
export function countsText(counts: Readonly<Record<DotKind, number>>): string {
  const parts = DOT_ORDER.filter((k) => counts[k] > 0).map((k) => `${DOT_LABEL[k]} ${counts[k]}`)
  return parts.length > 0 ? parts.join(' · ') : 'Ingen færdigheder endnu'
}

/** '+2 færdigheder rykket op · 1 ser ud til at være glemt' */
export function trendText(up: number, down: number): string {
  const parts: string[] = []
  if (up > 0) parts.push(`+${up} ${plural(up, 'færdighed', 'færdigheder')} rykket op`)
  if (down > 0) parts.push(`${down} ser ud til at være glemt`)
  return parts.length > 0 ? parts.join(' · ') : 'Ingen ændringer de sidste 14 dage'
}

/** The child's name, or a neutral word when it is empty. */
export const nameOf = (name: string): string => name.trim() || 'Barnet'

/** 'Ada' → 'Adas', 'Mads' → 'Mads'' (Danish genitive). */
export function genitive(name: string): string {
  const n = nameOf(name)
  return /[sxz]$/i.test(n) ? `${n}'` : `${n}s`
}
