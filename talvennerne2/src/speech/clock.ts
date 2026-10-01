// Spoken clock times (SPEC §10.1). `minutes` is always minutes after midnight (0–1439); analog
// styles read it on a 12-hour dial, digital reads the 24-hour value.
//
// Analog phrases exist only in 5-minute steps and are whole clips in end form: `t.end.<m>` and, for
// the half-hour form at :20 and :40, `t.half.<m>` (m = minutes on the dial, 0–715). In mid form the
// phrase is built from a lead-in (`t.part.<lead>`, e.g. "fem minutter i halv") and the hour number
// in mid form, so a sentence can continue after it ("halv tre om eftermiddagen").
import type { ClipId, SpeechForm } from '../engine/types'
import { numberClips, numberWords } from './numberWords'

export type ClockStyle = 'analog' | 'analogHalfForm' | 'digital'

/** Which hour a phrase names: the current one ("over tre") or the next ("i halv fire"). */
type HourRef = 'this' | 'next'

interface Phrase {
  /** Lead-in words before the hour, '' for the full hour. */
  lead: string
  /** Clip-id key of the lead-in (`t.part.<key>`), '' for the full hour. */
  key: string
  hour: HourRef
}

/** SPEC §10.1 table, indexed by minutes past the hour / 5. */
const PHRASES: readonly Phrase[] = [
  { lead: '', key: '', hour: 'this' },
  { lead: 'fem minutter over', key: 'fem_over', hour: 'this' },
  { lead: 'ti minutter over', key: 'ti_over', hour: 'this' },
  { lead: 'kvart over', key: 'kvart_over', hour: 'this' },
  { lead: 'tyve minutter over', key: 'tyve_over', hour: 'this' },
  { lead: 'fem minutter i halv', key: 'fem_i_halv', hour: 'next' },
  { lead: 'halv', key: 'halv', hour: 'next' },
  { lead: 'fem minutter over halv', key: 'fem_over_halv', hour: 'next' },
  { lead: 'tyve minutter i', key: 'tyve_i', hour: 'next' },
  { lead: 'kvart i', key: 'kvart_i', hour: 'next' },
  { lead: 'ti minutter i', key: 'ti_i', hour: 'next' },
  { lead: 'fem minutter i', key: 'fem_i', hour: 'next' },
]

/** The half-hour form used by some teachers at :20 and :40. */
const HALF_FORM: Readonly<Record<number, Phrase>> = {
  20: { lead: 'ti minutter i halv', key: 'ti_i_halv', hour: 'next' },
  40: { lead: 'ti minutter over halv', key: 'ti_over_halv', hour: 'next' },
}

/** Every analog lead-in clip key with its words (for the catalogue). */
export const CLOCK_LEADS: Readonly<Record<string, string>> = Object.fromEntries(
  [...PHRASES, ...Object.values(HALF_FORM)].filter((p) => p.key).map((p) => [p.key, p.lead]),
)

const mod = (n: number, m: number) => ((n % m) + m) % m

/** Minutes on the 12-hour dial (0 = 12:00). */
export function dialMinutes(minutes: number): number {
  return mod(Math.round(minutes), 720)
}

/** "klokken et": the hour 1 is neuter. */
function hourWord(h: number): string {
  return numberWords(h, h === 1 ? 'n' : 'c')
}

function phraseFor(dial: number, style: ClockStyle): Phrase | null {
  const m = dial % 60
  if (m % 5 !== 0) return null
  if (style === 'analogHalfForm' && HALF_FORM[m]) return HALF_FORM[m]
  return PHRASES[m / 5]
}

/** Hour 1–12 named by a phrase at this dial position. */
function namedHour(dial: number, ref: HourRef): number {
  const h = Math.floor(dial / 60) // 0–11, 0 is twelve
  const named = ref === 'this' ? h : h + 1
  return mod(named - 1, 12) + 1
}

/** Analog words for times that are not on a 5-minute step (only reachable through fallbacks). */
function oddAnalogWords(dial: number): string {
  const m = dial % 60
  const unit = (k: number) => `${numberWords(k)} ${k === 1 ? 'minut' : 'minutter'}`
  if (m < 30) return `${unit(m)} over ${hourWord(namedHour(dial, 'this'))}`
  return `${unit(60 - m)} i ${hourWord(namedHour(dial, 'next'))}`
}

/** Danish words for a clock time, e.g. 145 analog → "fem minutter i halv tre", 845 digital → "fjorten nul fem". */
export function clockWords(minutes: number, style: ClockStyle): string {
  if (style === 'digital') return digitalWords(minutes)
  const dial = dialMinutes(minutes)
  const p = phraseFor(dial, style)
  if (!p) return oddAnalogWords(dial)
  const hour = hourWord(namedHour(dial, p.hour))
  return p.lead ? `${p.lead} ${hour}` : hour
}

/** Clip ids for a clock time in the given form. */
export function clockClips(minutes: number, style: ClockStyle, form: SpeechForm): ClipId[] {
  if (style === 'digital') return digitalClips(minutes, form)
  const dial = dialMinutes(minutes)
  const p = phraseFor(dial, style)
  // Not a 5-minute step: no recording exists, so the voice falls back to the device voice.
  if (!p) return [`t.${form}.${dial}`]
  if (form === 'end') return [p === HALF_FORM[dial % 60] ? `t.half.${dial}` : `t.end.${dial}`]
  const h = namedHour(dial, p.hour)
  const hourClips = numberClips(h, 'mid', h === 1 ? 'n' : 'c')
  return p.key ? [`t.part.${p.key}`, ...hourClips] : hourClips
}

// ─── Digital ────────────────────────────────────────────────────────────────

function digitalParts(minutes: number): [number, number] {
  const m = mod(Math.round(minutes), 1440)
  return [Math.floor(m / 60), m % 60]
}

/** "fjorten treogtyve", "fjorten nul fem", "fjorten nul nul", "et nul et". */
export function digitalWords(minutes: number): string {
  const [h, m] = digitalParts(minutes)
  const hour = hourWord(h)
  if (m === 0) return `${hour} nul nul`
  if (m < 10) return `${hour} nul ${numberWords(m, m === 1 ? 'n' : 'c')}`
  return `${hour} ${numberWords(m)}`
}

function digitalClips(minutes: number, form: SpeechForm): ClipId[] {
  const [h, m] = digitalParts(minutes)
  const hour = numberClips(h, 'mid', h === 1 ? 'n' : 'c')
  if (m === 0) return [...hour, 'n.mid.0', `n.${form}.0`]
  if (m < 10) return [...hour, 'n.mid.0', ...numberClips(m, form, m === 1 ? 'n' : 'c')]
  return [...hour, ...numberClips(m, form)]
}

// ─── Time of day ────────────────────────────────────────────────────────────

export type DayPart = 'nat' | 'morgen' | 'eftermiddag' | 'aften'

/** 5–11 morgen, 12–17 eftermiddag, 18–23 aften (SPEC §10.1); 0–4 is night. */
export function dayPart(minutes: number): DayPart {
  const h = digitalParts(minutes)[0]
  if (h < 5) return 'nat'
  if (h < 12) return 'morgen'
  if (h < 18) return 'eftermiddag'
  return 'aften'
}

export const DAY_PART_WORDS: Readonly<Record<DayPart, string>> = {
  nat: 'om natten',
  morgen: 'om morgenen',
  eftermiddag: 'om eftermiddagen',
  aften: 'om aftenen',
}

/** "om eftermiddagen" for 14:30. */
export function dayPartWords(minutes: number): string {
  return DAY_PART_WORDS[dayPart(minutes)]
}

/**
 * The clip that follows an analog time in mid form to say the time of day:
 * `[{ clock: { minutes, style: 'analog', form: 'mid' } }, { clip: dayPartClip(minutes) }]`
 * speaks "halv tre om eftermiddagen".
 */
export function dayPartClip(minutes: number): ClipId {
  return `t.part.${dayPart(minutes)}`
}
