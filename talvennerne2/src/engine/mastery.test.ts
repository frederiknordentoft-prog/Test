import { describe, expect, it } from 'vitest'
import { emptyKey, isDue, masteryOf, MAX_BOX, updateKey, type AnswerForMastery } from './mastery'
import { daysBetween, learningDay } from './learningDay'
import type { KeyState } from './types'

const TZ = 'Europe/Copenhagen'
const H = 3600_000
/** 2026-09-01 10:00 in Copenhagen (UTC+2). */
const T0 = Date.parse('2026-09-01T08:00:00Z')

function ans(over: Partial<AnswerForMastery> = {}): AnswerForMastery {
  const ts = over.ts ?? T0
  return {
    correct: true, fast: true, production: false, ceiling: 3, ms: 2000, ts, day: learningDay(ts, TZ),
    roundIndex: 1, mode: 'round', assisted: false, retryOf: null, procedure: false, instanceId: 'add:3+4', ...over,
  }
}
const keypad = (over: Partial<AnswerForMastery> = {}) => ans({ production: true, ceiling: 5, ...over })
const at = (box: number, over: Partial<KeyState> = {}): KeyState =>
  ({ ...emptyKey(), box: box as KeyState['box'], seen: 5, lastDay: '2026-09-01', boxDay: '2026-09-01', boxAt: T0, ...over })

describe('mastery (V1 rules)', () => {
  it('promotes a quick correct answer', () => {
    expect(updateKey(undefined, ans()).box).toBe(1)
  })

  it('holds position when the answer is right but slow — knowing is not recalling', () => {
    expect(updateKey(at(2), ans({ fast: false })).box).toBe(2)
  })

  it('drops two boxes on a mistake, never below zero', () => {
    expect(updateKey(at(3), ans({ correct: false })).box).toBe(1)
    expect(updateKey(at(1), ans({ correct: false })).box).toBe(0)
  })

  it('will not let picking from cards prove a key is known', () => {
    let s: KeyState | undefined
    for (let i = 0; i < 10; i++) s = updateKey(s, ans({ ts: T0 + i * 24 * H, day: learningDay(T0 + i * 24 * H, TZ) }))
    expect(s!.box).toBe(3)
  })

  it('stops a coin-flip task (true/false) at box 2', () => {
    let s: KeyState | undefined
    for (let i = 0; i < 6; i++) s = updateKey(s, ans({ ceiling: 2 }))
    expect(s!.box).toBe(2)
  })

  it('lets a typed answer carry a key the rest of the way, on later days', () => {
    let s: KeyState | undefined
    let ts = T0
    for (let day = 0; day < 12; day++) {
      ts = T0 + day * 24 * H
      s = updateKey(s, keypad({ ts, day: learningDay(ts, TZ) }))
    }
    expect(s!.box).toBe(MAX_BOX)
  })

  it('never demotes a proven key just because it came back as cards', () => {
    expect(updateKey(at(5), ans()).box).toBe(5)
  })

  it('rests a well-known key for longer than a shaky one', () => {
    const shaky = at(1, { lastRound: 10, lastDay: '2026-09-01' })
    const solid = at(5, { lastRound: 10, lastDay: '2026-09-01' })
    expect(isDue(shaky, 11, '2026-09-01')).toBe(true)
    expect(isDue(solid, 11, '2026-09-01')).toBe(false)
    expect(isDue(solid, 26, '2026-09-08')).toBe(true)
  })

  it('reports mastery as a fraction of the whole set', () => {
    expect(masteryOf(['a', 'b'], { a: at(5), b: at(0) })).toBeCloseTo(0.5)
    expect(masteryOf([], {})).toBe(0)
  })
})

describe('mastery (V2 evidence over days)', () => {
  it('uses 04:00 as the learning-day boundary', () => {
    expect(learningDay(Date.parse('2026-09-01T21:50:00Z'), TZ)).toBe('2026-09-01') // 23:50
    expect(learningDay(Date.parse('2026-09-01T22:10:00Z'), TZ)).toBe('2026-09-01') // 00:10 the next night
    expect(learningDay(Date.parse('2026-09-02T02:10:00Z'), TZ)).toBe('2026-09-02') // 04:10
  })

  it('does not reach box 4 across midnight: 23:50 → 00:10 is the same learning day', () => {
    const late = Date.parse('2026-09-01T21:50:00Z')
    const s3 = updateKey(at(2, { boxDay: '2026-08-30', boxAt: late - 48 * H }), keypad({ ts: late, day: learningDay(late, TZ) }))
    expect(s3.box).toBe(3)
    const after = late + 20 * 60_000
    expect(updateKey(s3, keypad({ ts: after, day: learningDay(after, TZ) })).box).toBe(3)
  })

  it('reaches box 4 on a later learning day, at least 8 hours later', () => {
    const next = T0 + 24 * H
    expect(updateKey(at(3), keypad({ ts: next, day: learningDay(next, TZ) })).box).toBe(4)
    const early = Date.parse('2026-09-02T02:30:00Z') // 04:30 next learning day but only 6.5 h after 22:00
    const s = at(3, { boxAt: Date.parse('2026-09-01T20:00:00Z') })
    expect(updateKey(s, keypad({ ts: early, day: learningDay(early, TZ) })).box).toBe(3)
  })

  it('needs production for box 4 and 5', () => {
    const next = T0 + 24 * H
    expect(updateKey(at(3), ans({ ts: next, day: learningDay(next, TZ), ceiling: 5 })).box).toBe(3)
  })

  it('reaches box 5 only three learning days after box 4', () => {
    const s4 = at(4, { boxDay: '2026-09-02', boxAt: T0 + 24 * H })
    const d2 = T0 + 3 * 24 * H
    const d3 = T0 + 4 * 24 * H
    expect(updateKey(s4, keypad({ ts: d2, day: learningDay(d2, TZ) })).box).toBe(4)
    expect(updateKey(s4, keypad({ ts: d3, day: learningDay(d3, TZ) })).box).toBe(5)
  })

  it('handles the switch to winter time on 2026-10-25', () => {
    expect(learningDay(Date.parse('2026-10-25T01:30:00Z'), TZ)).toBe('2026-10-24') // 02:30 CET
    expect(learningDay(Date.parse('2026-10-25T03:30:00Z'), TZ)).toBe('2026-10-25') // 04:30 CET
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
  })

  it('lets a simulated child reach box 5 no earlier than day 5', () => {
    let s: KeyState | undefined
    let reached = -1
    for (let day = 0; day < 10 && reached < 0; day++) {
      for (let k = 0; k < 6; k++) {
        const ts = T0 + day * 24 * H + k * 5 * 60_000
        s = updateKey(s, keypad({ ts, day: learningDay(ts, TZ), roundIndex: day * 10 + k }))
      }
      if (s!.box === 5) reached = day + 1
    }
    expect(reached).toBe(5)
  })

  it('never moves a box on a retry, an assisted answer, placement or a missed golden egg', () => {
    const s = at(2)
    expect(updateKey(s, ans({ retryOf: 'x#0' }))).toBe(s)
    expect(updateKey(s, ans({ assisted: true }))).toBe(s)
    expect(updateKey(s, ans({ mode: 'placement', correct: false }))).toBe(s)
    expect(updateKey(s, ans({ mode: 'golden', correct: false }))).toBe(s)
    expect(updateKey(s, ans({ mode: 'golden' })).box).toBe(3)
  })

  it('needs two different fresh instances per step for procedure families', () => {
    const p = (instanceId: string) => ans({ procedure: true, instanceId })
    let s = updateKey(undefined, p('add:38+45'))
    expect(s.box).toBe(0)
    s = updateKey(s, p('add:38+45'))
    expect(s.box).toBe(0)
    s = updateKey(s, p('add:27+36'))
    expect(s.box).toBe(1)
    // an instance answered recently cannot be farmed for the next step
    s = updateKey(s, p('add:27+36'))
    expect(s.box).toBe(1)
  })

  it('clears the placement seed once the child answers the key with production', () => {
    const seeded = at(2, { seeded: true })
    expect(updateKey(seeded, ans()).seeded).toBe(true)
    expect(updateKey(seeded, keypad()).seeded).toBe(false)
  })
})
