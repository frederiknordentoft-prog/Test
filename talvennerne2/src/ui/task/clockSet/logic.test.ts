import { describe, expect, it } from 'vitest'
import { isCorrect } from '../../../engine/answer'
import { classifyAnswer } from '../../../engine/misconceptions'
import type { Task } from '../../../engine/types'
import { EXAMPLES } from '../../../dev/tasks/examples'
import {
  DIAL, angleOf, canClockSet, clockSetOwnsPrompt, clockStep, dialValue, dragHour, dragMinute, hourAngle, jumpMinute,
  knobSpot, minuteAngle, mod, pickHand, settle, snap, turn,
} from './logic'

const ex = (id: string): Task => {
  const e = Object.values(EXAMPLES).flat().find((x) => x.id === id)
  if (!e) throw new Error(id)
  return e.task
}
const half = ex('clock-half') // "halv tre" = 2:30 = 150, 3:30 (210) tagged halfPastNext

/** Turns the minute hand from where it stands through `degrees` (positive: clockwise), 10° at a time. */
function turnMinute(total: number, degrees: number): number {
  let t = total
  let a = minuteAngle(total)
  const steps = Math.ceil(Math.abs(degrees) / 10)
  for (let i = 0; i < steps; i++) {
    const next = a + degrees / steps
    t = dragMinute(t, a, next)
    a = next
  }
  return t
}

describe('the clock face', () => {
  it('measures angles clockwise from 12, y pointing down', () => {
    expect(angleOf(0, -1)).toBeCloseTo(0)
    expect(angleOf(1, 0)).toBeCloseTo(90)
    expect(angleOf(0, 1)).toBeCloseTo(180)
    expect(angleOf(-1, 0)).toBeCloseTo(270)
    expect(turn(350, 10)).toBeCloseTo(20)
    expect(turn(10, 350)).toBeCloseTo(-20)
    expect(turn(0, 180)).toBeCloseTo(180)
  })

  it('draws the hands like the AnalogClock material: hour hand 0.5° and minute hand 6° a minute', () => {
    expect(minuteAngle(150)).toBe(180)
    expect(hourAngle(150)).toBe(75)
    expect(hourAngle(870)).toBe(75)
    // the demo's finger sits on the minute hand's tip: straight up at :00, straight down at :30
    expect(knobSpot(0, 'minute').x).toBeCloseTo(0.5)
    expect(knobSpot(30, 'minute').x).toBeCloseTo(0.5)
    expect(knobSpot(30, 'minute').y).toBeGreaterThan(knobSpot(0, 'minute').y)
  })
})

describe('the skill’s step', () => {
  it('comes from the prompt, else from the skill, and is always a whole divisor of an hour', () => {
    expect(clockStep(half)).toBe(30)
    expect(clockStep(ex('clock-hour'))).toBe(60)
    expect(clockStep(ex('clock-quarter'))).toBe(15)
    expect(clockStep(ex('clock-digital'))).toBe(5)
    expect(clockStep({ ...half, prompt: { scene: 'hear' }, skill: 'clockQuarter' })).toBe(15)
    expect(clockStep({ ...half, prompt: { scene: 'hear' }, skill: 'clockFive' })).toBe(5)
    expect(clockStep({ ...half, prompt: { scene: 'clock', minutes: null, step: 7 as 5 } })).toBe(5)
    expect(clockStep({ ...half, prompt: { scene: 'clock', minutes: null, step: 1 as 5 } })).toBe(1)
  })

  it('lands a released hand on the nearest step, read on the dial (0–719)', () => {
    expect(snap(22, 30)).toBe(30)
    expect(snap(14, 30)).toBe(0)
    expect(snap(7.4, 5)).toBe(5)
    expect(settle(745.3, 5)).toBe(25)
    expect(settle(-10, 15)).toBe(705)
    expect(settle(29, 60)).toBe(0)
    expect(settle(31, 60)).toBe(60)
  })
})

describe('the gear between the hands', () => {
  it('moves the hour hand with the minute hand: once round is one hour, back past 12 the hour before', () => {
    // 12:00, the long hand clockwise to the 6: 12:30, the short hand halfway to 1
    const t = turnMinute(0, 180)
    expect(t).toBeCloseTo(30)
    expect(hourAngle(t)).toBeCloseTo(15)
    // on round past 12: 1:10
    expect(turnMinute(t, 240)).toBeCloseTo(70)
    // from 12:10 back past 12: 11:50
    expect(settle(turnMinute(10, -120), 5)).toBe(710)
  })

  it('jumps the hour hand whole hours and keeps the minutes', () => {
    expect(dragHour(30, 75)).toBe(150) // pointing between 2 and 3 → 2:30
    expect(dragHour(30, 105)).toBe(210) // between 3 and 4 → 3:30
    expect(dragHour(150, 310)).toBe(630) // 10:30
    expect(dragHour(165, 20)).toBe(45) // kvart i et: 12:45 (the hand just before 1)
    expect(dragHour(165, 2)).toBe(705) // nearer to where it stands at 11:45
  })

  it('sends the minute hand the short way to a press away from the hands', () => {
    expect(settle(jumpMinute(0, 270), 15)).toBe(705) // 12:00 → 11:45
    expect(settle(jumpMinute(0, 90), 15)).toBe(15)
  })

  it('only ever shows real times: the hour hand is where the minutes put it', () => {
    let t = 0
    for (const [hand, angle] of [['m', 200], ['h', 95], ['m', -50], ['h', 300], ['m', 400]] as const) {
      t = hand === 'm' ? turnMinute(t, angle) : dragHour(t, angle)
      const v = settle(t, 5)
      expect(hourAngle(v)).toBeCloseTo(mod(Math.floor(v / 60) * 30 + (v % 60) * 0.5, 360))
    }
  })
})

describe('"halv tre" — the halfPastNext idea shows in the answer', () => {
  it('2:30 is set with the hour hand past the 2; the hour hand past the 3 makes 3:30', () => {
    // the child turns the long hand to 6 (12:30), then drags the short hand
    const t = turnMinute(0, 180)
    const right = dialValue(half, settle(dragHour(t, 75), clockStep(half)))
    const wrong = dialValue(half, settle(dragHour(t, 96), clockStep(half)))
    expect(right).toBe(150)
    expect(wrong).toBe(210)
    expect(isCorrect(half, right)).toBe(true)
    expect(isCorrect(half, wrong)).toBe(false)
    expect(classifyAnswer(half, wrong)).toBe('halfPastNext')
  })

  it('cannot be set to "the 3 and the 6" without meaning 3:30: the hour hand never stands on the 3 at half past', () => {
    for (let h = 0; h < 12; h++) {
      const v = dragHour(30, h * 30)
      expect(hourAngle(v) % 30).toBeCloseTo(15)
    }
  })
})

describe('which hand a finger takes', () => {
  it('takes the hand under the finger (the hour hand along its own length where they overlap)', () => {
    // 12:00, both hands straight up
    expect(pickHand(0, 0, -64)).toEqual({ hand: 'minute', jump: false })
    expect(pickHand(0, 0, -30)).toEqual({ hand: 'hour', jump: false })
    // 3:00: the hour hand to the right, the minute hand up
    expect(pickHand(180, 30, 2)).toEqual({ hand: 'hour', jump: false })
    expect(pickHand(180, 3, -60)).toEqual({ hand: 'minute', jump: false })
  })

  it('sends the nearer one to a press away from both, and ignores the hub', () => {
    expect(pickHand(0, -62, 0)).toEqual({ hand: 'minute', jump: true })
    expect(pickHand(0, -30, 10)).toEqual({ hand: 'hour', jump: true })
    expect(pickHand(0, 2, 3)).toBeNull()
    expect(pickHand(0, 0, -120)).toBeNull()
  })
})

describe('the answer in minutes', () => {
  it('is the dial reading on an analog task, and in the answer’s half of the day on a 24-hour one', () => {
    expect(dialValue(half, 150)).toBe(150)
    expect(dialValue(half, 870)).toBe(150)
    const digital = ex('clock-digital') // 14:30, modulo 1440
    expect(digital.modulo).toBe(1440)
    expect(dialValue(digital, 150)).toBe(870)
    expect(isCorrect(digital, dialValue(digital, 150))).toBe(true)
    expect(dialValue(digital, 210)).toBe(930)
    expect(isCorrect(digital, dialValue(digital, 210))).toBe(false)
    // a morning time on a 24-hour task stays in the morning
    expect(dialValue({ modulo: 1440, answer: 150 }, 150)).toBe(150)
  })

  it('answers every harness example right with its answer and wrong with its wrong answer', () => {
    for (const e of EXAMPLES.clockSet) {
      const t = e.task
      expect(canClockSet(t)).toBe(true)
      expect(isCorrect(t, dialValue(t, mod(t.answer as number, DIAL))), e.id).toBe(true)
      expect(isCorrect(t, dialValue(t, mod(e.wrong as number, DIAL))), e.id).toBe(false)
    }
  })

  it('draws an empty clock prompt itself, never a digital clock or a time', () => {
    expect(clockSetOwnsPrompt(half)).toBe(true)
    expect(clockSetOwnsPrompt(ex('clock-digital'))).toBe(false)
    expect(clockSetOwnsPrompt({ ...half, prompt: { scene: 'clock', minutes: 150, step: 30 } })).toBe(false)
    expect(clockSetOwnsPrompt({ ...half, prompt: { scene: 'hear' } })).toBe(false)
    expect(canClockSet({ answer: 'frac:1/2' })).toBe(false)
  })
})
