// Danish date / time / countdown formatting. Pure functions.

const weekdayFmt = new Intl.DateTimeFormat('da-DK', { weekday: 'long' });
const timeFmt = new Intl.DateTimeFormat('da-DK', { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long' });

const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Local midnight for a timestamp, as epoch ms. */
function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole calendar days from `now`'s day to `ts`'s day (can be negative). */
function dayDelta(ts: number, now: number): number {
  return Math.round((startOfDay(ts) - startOfDay(now)) / 86400000);
}

/** "kl. 08.00" — Danish already uses a dot as the time separator. */
export function formatTime(ts: number): string {
  return `kl. ${timeFmt.format(ts)}`;
}

/**
 * Human day + time, relative when close:
 *   "I dag kl. 14.00" · "I morgen kl. 08.00" · "I går kl. 20.00" · "Lørdag kl. 08.00".
 * Beyond a week either way, falls back to an explicit date.
 */
export function formatDayTime(ts: number, now: number = Date.now()): string {
  const delta = dayDelta(ts, now);
  const time = formatTime(ts);
  if (delta === 0) return `I dag ${time}`;
  if (delta === 1) return `I morgen ${time}`;
  if (delta === -1) return `I går ${time}`;
  if (delta > 1 && delta < 7) return `${cap(weekdayFmt.format(ts))} ${time}`;
  // Far away: include the date for clarity.
  return `${cap(weekdayFmt.format(ts))} d. ${dateFmt.format(ts)} ${time}`;
}

/** Short label for calendar grouping headers: "Lørdag d. 12. juli". */
export function formatDateHeading(ts: number): string {
  return `${cap(weekdayFmt.format(ts))} d. ${dateFmt.format(ts)}`;
}

export interface Countdown {
  /** Signed milliseconds until the target (negative once it has passed). */
  ms: number;
  overdue: boolean;
  /** "2 t 15 min" · "8 min" · "nu". */
  label: string;
}

export function countdown(target: number, now: number = Date.now()): Countdown {
  const ms = target - now;
  const overdue = ms < 0;
  const total = Math.abs(ms);
  const mins = Math.floor(total / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;

  let label: string;
  if (mins <= 0) {
    label = 'nu';
  } else if (days > 0) {
    label = `${days} d ${hours} t`;
  } else if (hours > 0) {
    label = `${hours} t ${minutes} min`;
  } else {
    label = `${minutes} min`;
  }
  return { ms, overdue, label };
}

/** Grams etc. — plain integer with a Danish unit. */
export function grams(n: number): string {
  return `${n} g`;
}

/** Epoch ms → local "YYYY-MM-DDTHH:MM" for <input type="datetime-local">. */
export function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}

/** Parse a datetime-local value (local wall time) back to epoch ms; NaN if invalid. */
export function fromDatetimeLocal(value: string): number {
  return new Date(value).getTime();
}

/** A sensible default target: the next day at 17:00 local. */
export function defaultFinish(now: number = Date.now()): number {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(17, 0, 0, 0);
  return d.getTime();
}

/** Absolute weekday + date + time — for print/paper, where "I dag" is meaningless. */
export function formatDayTimeAbsolute(ts: number): string {
  return `${cap(weekdayFmt.format(ts))} d. ${dateFmt.format(ts)} kl. ${timeFmt.format(ts)}`;
}

/** Cold-proof duration as Danish text: "15 t 31 min" / "12 t". */
export function formatColdProof(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} t` : `${h} t ${m} min`;
}
