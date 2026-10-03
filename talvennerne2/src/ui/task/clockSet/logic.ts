// clockSet (SPEC §3.2), the part without React: which hand a finger takes, how the hands move, the
// skill's step and the answer in minutes. The hands are geared like a real clock: the minute hand
// turned once round moves the hour hand one hour on, and the hour hand dragged by itself jumps whole
// hours. So every position the child can make is a real time — "halv tre" set with the hour hand
// just past three reads as 3:30, and that is how the halfPastNext idea shows in the answer.
import type { SkillId, Task } from '../../../engine/types'

export type Hand = 'minute' | 'hour'

/** One turn of the analog dial in minutes. */
export const DIAL = 720

// Clock units of the AnalogClock material (viewBox 200 by 206, centre (100, 100), face radius 80).
export const CENTRE = 100
export const VIEW_W = 200
export const VIEW_H = 206
const MINUTE_LEN = 68
const HOUR_LEN = 46
/** A finger this close to a hand (clock units) takes that hand. */
const GRAB = 22
/** Presses on the hub are ignored: both hands start there. */
const HUB = 9
/** Away from both hands: outside this radius the minute hand jumps to the finger, inside it the hour hand. */
const OUTER = 50
/** Where the round grab knobs sit on the hands (clock units from the centre): at the minute hand's tip, clear of the numbers. */
export const KNOB = { minute: 66, hour: 36 } as const

export const mod = (v: number, m: number) => ((v % m) + m) % m

/** Steps per skill when the prompt is not a clock (the prompt's own step wins). */
const STEP_BY_SKILL: Partial<Record<SkillId, number>> = {
  clockHour: 60,
  clockHalf: 30,
  clockQuarter: 15,
  clockFive: 5,
  clockDigital: 5,
  clockElapsed: 15,
}

/** Minutes the minute hand snaps to: the prompt's step (60/30/15/5, 1 allowed), else the skill's. */
export function clockStep(task: Task): number {
  const p = task.prompt
  const raw = p.scene === 'clock' ? p.step : (STEP_BY_SKILL[task.skill] ?? 5)
  return Number.isInteger(raw) && raw >= 1 && 60 % raw === 0 ? raw : 5
}

/** The nearest step. */
export const snap = (minutes: number, step: number) => Math.round(minutes / step) * step

/** Angle in degrees clockwise from 12 o'clock (0–360) of a point (dx, dy) from the centre, y down. */
export function angleOf(dx: number, dy: number): number {
  return mod((Math.atan2(dx, -dy) * 180) / Math.PI, 360)
}

/** The short way from angle a to angle b, in degrees (−180, 180]. */
export function turn(a: number, b: number): number {
  const d = mod(b - a, 360)
  return d > 180 ? d - 360 : d
}

export const minuteAngle = (minutes: number) => mod(minutes, 60) * 6
export const hourAngle = (minutes: number) => mod(minutes, DIAL) * 0.5

/**
 * The minute hand dragged from one angle to the next: the time moves with it, the hour hand follows
 * like a gear (round past 12 is the next hour, back past 12 the one before).
 */
export function dragMinute(total: number, fromAngle: number, toAngle: number): number {
  return total + turn(fromAngle, toAngle) / 6
}

/** The hour hand dragged to an angle: it jumps whole hours and the minutes stay where they are. */
export function dragHour(total: number, angle: number): number {
  const m = mod(Math.round(total), 60)
  const h = mod(Math.round((angle - m * 0.5) / 30), 12)
  return h * 60 + m
}

/** A press away from the hands sends the minute hand there the short way round (the hour follows). */
export function jumpMinute(total: number, angle: number): number {
  return total + turn(minuteAngle(total), angle) / 6
}

/** Distance from point (x, y) to the hand from the centre out to `len` at `angle` (clock units, centre at 0). */
function handDistance(x: number, y: number, angle: number, len: number): number {
  const a = (angle * Math.PI) / 180
  const ux = Math.sin(a)
  const uy = -Math.cos(a)
  const t = Math.max(0, Math.min(len, x * ux + y * uy))
  return Math.hypot(x - t * ux, y - t * uy)
}

export interface Grab {
  hand: Hand
  /** The hand jumps to the finger first (a press away from both hands). */
  jump: boolean
}

/**
 * Which hand a press takes, (x, y) in clock units from the centre. Close to a hand: that hand (where
 * both lie on top of each other, the hour hand within its own length, the minute hand beyond it).
 * Away from both: the minute hand in the outer ring, the hour hand inside it. The hub: nothing.
 */
export function pickHand(total: number, x: number, y: number): Grab | null {
  const r = Math.hypot(x, y)
  if (r < HUB || r > VIEW_W / 2) return null
  const dm = handDistance(x, y, minuteAngle(total), MINUTE_LEN)
  const dh = handDistance(x, y, hourAngle(total), HOUR_LEN)
  const nearM = dm <= GRAB
  const nearH = dh <= GRAB
  if (nearM && nearH) {
    if (Math.abs(dm - dh) < 4) return { hand: r <= HOUR_LEN + 4 ? 'hour' : 'minute', jump: false }
    return { hand: dm < dh ? 'minute' : 'hour', jump: false }
  }
  if (nearM) return { hand: 'minute', jump: false }
  if (nearH) return { hand: 'hour', jump: false }
  return { hand: r >= OUTER ? 'minute' : 'hour', jump: true }
}

/** Where a time lands: the minute hand on the step, and the dial reading 0–719. */
export function settle(raw: number, step: number): number {
  return mod(snap(raw, step), DIAL)
}

/**
 * Where the hands start: the task's own start (Task.dialStart, on the step and never the answer, so
 * touching the hands and ticking is never a free answer), 12:00 for a task without one.
 */
export const startOf = (task: Pick<Task, 'dialStart'>): number => mod(Math.round(task.dialStart ?? 0), DIAL)

/**
 * The answer for a dial reading: minutes 0–719 on the analog dial. A 24-hour task (Task.modulo 1440)
 * cannot be told apart on an analog face, so the reading is placed in the answer's half of the day:
 * 2:30 set for "14:30" is 870, and a wrong 3:30 is 930.
 */
export function dialValue(task: Pick<Task, 'modulo' | 'answer'>, total: number): number {
  const m = mod(Math.round(total), DIAL)
  if (task.modulo === 1440 && typeof task.answer === 'number') return m + DIAL * Math.floor(mod(task.answer, 1440) / DIAL)
  return m
}

/** A clock can be set for any task whose answer is a time in minutes. */
export const canClockSet = (t: Pick<Task, 'answer'>) => typeof t.answer === 'number' && Number.isFinite(t.answer)

/** An empty analog face as the prompt is the answer surface itself: the view draws it, the card is left out. */
export const clockSetOwnsPrompt = (t: Task) => t.prompt.scene === 'clock' && t.prompt.minutes === null && !t.prompt.digital

/** The tip of a hand at `minutes`, as a fraction of the clock's box (for the demo's finger). */
export function knobSpot(minutes: number, hand: Hand): { x: number; y: number } {
  const a = ((hand === 'minute' ? minuteAngle(minutes) : hourAngle(minutes)) * Math.PI) / 180
  const r = KNOB[hand]
  return { x: (CENTRE + r * Math.sin(a)) / VIEW_W, y: (CENTRE - r * Math.cos(a)) / VIEW_H }
}
