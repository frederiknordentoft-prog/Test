// Shared by the clock skills of 1.–2. klasse (clockHour, clockHalf, clockQuarter): times on the analog
// dial, the wrong clocks the cards and the clockSet answers are classified by, the spoken question
// and the strategy pictures. No SkillDef default export, so the registry skips it.
//
// Answer model (SPEC §3.1): minutes on the 12-hour dial, 0–719 (0 is 12:00), answerType 'minutes';
// the task builder gives every analog clock task modulo 720, so 3:00 and 15:00 are the same answer.
// Every value here is kept on the dial (0–719): a wrong clock is never the answer "after modulo".
//
// Kinds: choice is "Find uret, der viser klokken halv tre." with three analog clocks as cards
// (optionView 'clock', the prompt is only the spoken sentence: { scene: 'hear' }); clockSet
// (production) is "Stil uret, så klokken er halv tre." on an empty dial: { scene: 'clock',
// minutes: null, step, h24: false }, where the step (60/30/15) is what the minute hand snaps to.
import type { Candidate, ErrorTag, HintVisual, Prompt, SpeechForm, SpeechPart, TaskKind } from '../../types'
import { num, say, tagged, type Entry } from '../number/kit'

/** One turn of the analog dial in minutes. */
export const DIAL = 720

/** A time on the 12-hour dial, 0–719. */
export const dial = (minutes: number): number => ((Math.round(minutes) % DIAL) + DIAL) % DIAL

/** 1–12 → the next and the previous hour on the dial (12 → 1, 1 → 12). */
export const nextHour = (h: number): number => (h % 12) + 1
export const prevHour = (h: number): number => ((h + 10) % 12) + 1

/** The dial position of a whole hour 1–12 ("klokken tolv" is 0). */
export const hourAt = (h: number): number => dial(h * 60)

/** An hour number as the clock says it: "et", "to" … "tolv" (1 is neuter, as in "klokken et"). */
export const hourNum = (h: number, form: SpeechForm = 'end'): SpeechPart => num(h, form, h === 1 ? 'n' : 'c')

/** The time in words, e.g. "halv tre" (end form: the whole phrase clip `t.end.<m>`). */
export const clockSays = (minutes: number, form: SpeechForm = 'end'): SpeechPart => ({ clock: { minutes: dial(minutes), style: 'analog', form } })

// ─── Hands ──────────────────────────────────────────────────────────────────

/** Hand angles in degrees clockwise from 12, as the AnalogClock material draws them. */
const hourAngle = (t: number): number => dial(t) * 0.5
const minuteAngle = (t: number): number => (dial(t) % 60) * 6
const angleGap = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

/**
 * The clock a child picks or sets when the hands are swapped (handsSwapped): the long hand where the
 * short one should be and the other way round — 3:00 becomes 12:15, halv tre (2:30) about 6:13.
 * The clock is a real, geared one (the short hand a little past its number). Null when the swap
 * looks like the answer itself (12:00, or 6:30 and 5:33 with both hands pointing down).
 */
export function swappedHands(t: number): number | null {
  const m = Math.round(hourAngle(t) / 6) % 60
  const h = ((Math.round((minuteAngle(t) - m / 2) / 30) % 12) + 12) % 12
  const s = dial(h * 60 + m)
  const apart = Math.max(angleGap(hourAngle(s), hourAngle(t)), angleGap(minuteAngle(s), minuteAngle(t)))
  return s === dial(t) || apart < 30 ? null : s
}

// ─── Candidates, prompts, speech ────────────────────────────────────────────

/** Tagged wrong clocks on the dial (one tag per value, never the answer; null entries are skipped). */
export function clockCandidates(answer: number, entries: Iterable<readonly [value: number | null, tag: ErrorTag]>): Candidate[] {
  const out: Entry[] = []
  for (const [value, tag] of entries) if (value !== null) out.push([dial(value), tag])
  return tagged(dial(answer), out)
}

/** clockSet sets the time on an empty dial; choice asks with the voice only. */
export function clockPrompt(kind: TaskKind, step: 60 | 30 | 15): Prompt {
  return kind === 'clockSet' ? { scene: 'clock', minutes: null, step, h24: false } : { scene: 'hear' }
}

/** "Stil uret, så klokken er halv tre." · "Find uret, der viser klokken halv tre." */
export function clockQuestion(t: number, kind: TaskKind): SpeechPart[] {
  return [say(kind === 'clockSet' ? 'frag.stil_uret_saa_klokken_er' : 's.clock.findClock'), clockSays(t, 'end')]
}

/** The answer's clock as a strategy picture. */
export const clockAt = (t: number, step: 60 | 30 | 15): HintVisual => ({ scene: 'clock', minutes: dial(t), step })

/** The minute hand sweeping from one time to the next (the hour hand moving with it). */
export const clockMove = (from: number, to: number): HintVisual => ({ scene: 'clockMove', from: dial(from), to: dial(to) })

/**
 * Introduction order of the named hours: the four the dial is built on first (12, 3, 6, 9), then the
 * others in order.
 */
export const HOUR_ORDER: readonly number[] = [3, 6, 9, 12, 1, 2, 4, 5, 7, 8, 10, 11]
