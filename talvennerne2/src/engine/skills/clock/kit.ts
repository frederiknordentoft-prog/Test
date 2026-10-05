// Shared by the clock skills of 1.–3. klasse (clockHour, clockHalf, clockQuarter; clockFive, clockDigital,
// clockElapsed): times on the analog dial, the wrong clocks the cards and the clockSet answers are classified
// by, the spoken question and the strategy pictures. No SkillDef default export, so the registry skips it.
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
import type { ClockStyle } from '../../../speech/clock'
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

/** The dial's steps: whole, half and quarter hours, five minutes (SPEC §3.2 clockSet). */
export type ClockStep = 60 | 30 | 15 | 5

/** The hour the short hand has passed, 1–12 (2:45 → 2, 12:30 → 12). */
export const hourOf = (t: number): number => Math.floor(dial(t) / 60) || 12

/**
 * The time in words, e.g. "halv tre" (end form: the whole phrase clip `t.end.<m>`); the half form says
 * :20 and :40 with "halv" (`t.half.<m>`: "ti minutter i halv tre").
 */
export const clockSays = (minutes: number, form: SpeechForm = 'end', style: ClockStyle = 'analog'): SpeechPart => ({ clock: { minutes: dial(minutes), style, form } })

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

/**
 * The wrong clocks a presentation can actually be given (SkillExtras.candidatesFor). Cards can show any
 * clock; the clockSet dial snaps the minute hand to the skill's step, so a clock between the steps — the
 * swapped hands, 12:15 on a whole-hour dial — can never be set there. Counting it as an opportunity
 * anyway would leave its misconception unflaggable (SPEC §4.3: a flag needs production hits).
 */
export function clockCandidatesFor(all: readonly Candidate[], kind: TaskKind, step: ClockStep): Candidate[] {
  return kind === 'clockSet' ? all.filter((c) => typeof c.value === 'number' && dial(c.value) % step === 0) : [...all]
}

/** clockSet sets the time on an empty dial; choice asks with the voice only. */
export function clockPrompt(kind: TaskKind, step: ClockStep): Prompt {
  return kind === 'clockSet' ? { scene: 'clock', minutes: null, step, h24: false } : { scene: 'hear' }
}

/** "Stil uret, så klokken er halv tre." · "Find uret, der viser klokken halv tre." */
export function clockQuestion(t: number, kind: TaskKind, style?: ClockStyle): SpeechPart[] {
  return [say(kind === 'clockSet' ? 'frag.stil_uret_saa_klokken_er' : 's.clock.findClock'), clockSays(t, 'end', style)]
}

/** The answer's clock as a strategy picture. */
export const clockAt = (t: number, step: ClockStep): HintVisual => ({ scene: 'clock', minutes: dial(t), step })

/** The minute hand sweeping from one time to the next (the hour hand moving with it). */
export const clockMove = (from: number, to: number): HintVisual => ({ scene: 'clockMove', from: dial(from), to: dial(to) })

/**
 * Introduction order of the named hours: the four the dial is built on first (12, 3, 6, 9), then the
 * others in order.
 */
export const HOUR_ORDER: readonly number[] = [3, 6, 9, 12, 1, 2, 4, 5, 7, 8, 10, 11]

// ─── 3. klasse ──────────────────────────────────────────────────────────────

/** halfPastNext, said before the strategy: "Halv tre er en halv time før tre." */
export const halfIsBefore = (h: number): SpeechPart[] => [clockSays(hourAt(h) - 30, 'mid'), say('hint.clock.halfBefore'), hourNum(h, 'end')]

/**
 * hourHandMisread past the half hour: "Se godt på den lille viser. Ved ti minutter i tre er den endnu ikke
 * nået til tre."
 */
export const notYetAt = (t: number, style?: ClockStyle): SpeechPart[] => [
  say('hint.clock.lookSmall'), say('hint.clock.at'), clockSays(t, 'mid', style), say('hint.clock5.notYet'), hourNum(nextHour(hourOf(t)), 'end'),
]
