/**
 * A learning day is the local calendar date of (ts − 4 h). A session that runs past midnight
 * still belongs to the evening it started in, and 04:00 is the boundary (SPEC §5.1). The
 * result is 'YYYY-MM-DD', which sorts and compares as text.
 */
export const DAY_SHIFT_MS = 4 * 3600_000

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string | undefined): Intl.DateTimeFormat {
  const key = timeZone ?? ''
  let f = formatters.get(key)
  if (!f) {
    // sv-SE formats dates as YYYY-MM-DD
    f = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', ...(timeZone ? { timeZone } : {}) })
    formatters.set(key, f)
  }
  return f
}

/** `timeZone` is for tests; the app always uses the device's local time. */
export function learningDay(ts: number, timeZone?: string): string {
  return formatter(timeZone).format(new Date(ts - DAY_SHIFT_MS))
}

/** Whole calendar days from day `a` to day `b` (negative when b is earlier). '' counts as long ago. */
export function daysBetween(a: string, b: string): number {
  if (!a) return Number.POSITIVE_INFINITY
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}
