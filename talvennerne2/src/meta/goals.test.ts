import { describe, expect, it } from 'vitest'
import { GOAL_ROTATION, nextGoal, progressGoals, refreshGoals, type GoalRound, type GoalsState } from '../content/goals'
import { newProfile } from '../engine/testing/profile'
import type { Goal } from '../engine/types'
import { revisitRegions } from './progression'

const empty: GoalsState = { day: '', list: [] }
const round = (over: Partial<GoalRound> = {}): GoalRound => ({ mode: 'round', region: 'w0-tal10', bestStreak: 0, productionCorrect: 0, threeStars: false, ...over })
const kinds = (s: GoalsState) => s.list.map((g) => g.kind)
const finishAll = (s: GoalsState): GoalsState => ({ ...s, list: s.list.map((g) => ({ ...g, progress: g.need, done: true })) })

describe('"Næste tre mål" (SPEC §13.9)', () => {
  it('starts with Blandet øvelse, a region to visit and the first rotating goal', () => {
    const s = refreshGoals(empty, { day: '2026-10-01', revisit: ['w0-former'] })
    expect(s.day).toBe('2026-10-01')
    expect(s.list).toEqual([
      { kind: 'mix', need: 1, progress: 0, done: false },
      { kind: 'revisit', region: 'w0-former', need: 1, progress: 0, done: false },
      { kind: 'streak5', need: 5, progress: 0, done: false },
    ])
  })

  it('never lets a goal expire, however many days pass', () => {
    let s = refreshGoals(empty, { day: '2026-10-01', revisit: ['w0-former'] })
    s = progressGoals(s, round({ productionCorrect: 3, bestStreak: 2 })).state
    const open = s.list
    for (const day of ['2026-10-02', '2026-10-30', '2027-03-01']) {
      s = refreshGoals(s, { day, revisit: ['w0-tal20'] })
      expect(s.list).toEqual(open)
    }
  })

  it('gives new goals only on the next learning day, never more on the same day', () => {
    let s = refreshGoals(empty, { day: '2026-10-01', revisit: ['w0-former'] })
    s = finishAll(s)
    expect(refreshGoals(s, { day: '2026-10-01', revisit: ['w0-tal20'] })).toBe(s)
    const next = refreshGoals(s, { day: '2026-10-02', revisit: ['w0-tal20'] })
    expect(next.list.every((g) => !g.done)).toBe(true)
    expect(kinds(next)).toEqual(['mix', 'revisit', 'write10'])
    expect(next.list[1].region).toBe('w0-tal20')
  })

  it('replaces only the goals that are done', () => {
    let s = refreshGoals(empty, { day: '2026-10-01', revisit: ['w0-former'] })
    s = progressGoals(s, round({ mode: 'practice', region: null })).state
    const next = refreshGoals(s, { day: '2026-10-02', revisit: ['w0-tal20'] })
    expect(next.list[0]).toEqual({ kind: 'mix', need: 1, progress: 0, done: false })
    expect(next.list[1]).toBe(s.list[1])
    expect(next.list[2]).toBe(s.list[2])
  })

  it('rotates the third goal: 5 in a row, write 10 yourself, three stars', () => {
    let s = refreshGoals(empty, { day: '2026-10-01', revisit: [] })
    const third: string[] = []
    for (let d = 2; d <= 7; d++) {
      third.push(s.list[2].kind)
      s = refreshGoals(finishAll(s), { day: `2026-10-0${d}`, revisit: [] })
    }
    expect(third).toEqual([...GOAL_ROTATION, ...GOAL_ROTATION])
    // with nothing to revisit, the second goal is another kind of rotating goal
    expect(s.list[1].kind).not.toBe(s.list[2].kind)
    expect(GOAL_ROTATION).toContain(s.list[1].kind)
  })

  it('counts progress from rounds and completes each goal once', () => {
    let s = refreshGoals(empty, { day: '2026-10-01', revisit: ['w0-former'] })
    let out = progressGoals(s, round({ bestStreak: 3, productionCorrect: 6 }))
    expect(out.done).toEqual([])
    expect(out.state.list[2].progress).toBe(3)
    out = progressGoals(out.state, round({ region: 'w0-former', bestStreak: 6 }))
    expect(out.done.map((g: Goal) => g.kind)).toEqual(['revisit', 'streak5'])
    out = progressGoals(out.state, round({ mode: 'practice', region: null, bestStreak: 9 }))
    expect(out.done.map((g: Goal) => g.kind)).toEqual(['mix'])
    expect(progressGoals(out.state, round({ mode: 'practice', region: null })).done).toEqual([])
    expect(nextGoal(out.state)).toBeNull()
    // write 10 adds up over rounds; the placement never counts
    s = { day: 'x', list: [{ kind: 'write10', need: 10, progress: 0, done: false }] }
    s = progressGoals(s, round({ productionCorrect: 6 })).state
    expect(progressGoals(s, round({ mode: 'placement', productionCorrect: 9 })).state).toBe(s)
    expect(progressGoals(s, round({ productionCorrect: 6 })).done).toHaveLength(1)
    expect(progressGoals({ day: 'x', list: [{ kind: 'stars3', need: 1, progress: 0, done: false }] }, round({ threeStars: true })).done).toHaveLength(1)
  })

  it('suggests regions not played for five learning days, oldest first, then ones never played', () => {
    const at = (day: string) => Date.parse(`${day}T12:00:00Z`)
    const p = newProfile({
      nodes: {
        'w0-tal10-l1': { plays: 2, stars: 2, skipped: false, lastAt: at('2026-09-20') },
        'w0-former-l1': { plays: 1, stars: 1, skipped: false, lastAt: at('2026-09-10') },
        'w0-plus10-l1': { plays: 1, stars: 1, skipped: false, lastAt: at('2026-09-29') },
      },
    })
    const open = ['w0-tal10', 'w0-former', 'w0-plus10', 'w0-tal20'] as const
    expect(revisitRegions(p, '2026-10-01', open)).toEqual(['w0-former', 'w0-tal10', 'w0-tal20'])
  })
})
