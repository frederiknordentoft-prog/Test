import { describe, expect, it } from 'vitest'
import { applyMedals, isSkippedAtStart, learningEventsFor, medalFor, skillStatus, statusOf, upgradeMedal } from './status'
import { makeRegistry, skillKeys } from './registry'
import { FIXTURE_SKILLS, addTo10Fixture } from './testing/fixtureSkills'
import { emptyKey } from './mastery'
import { newProfile } from './testing/profile'
import type { KeyState } from './types'

const reg = makeRegistry(FIXTURE_SKILLS)
const k = (box: number, over: Partial<KeyState> = {}): KeyState => ({ ...emptyKey(), box: box as KeyState['box'], seen: 4, correct: 3, ...over })
const many = (n: number, box: number, over: Partial<KeyState> = {}) => Array.from({ length: n }, () => k(box, over))
const stats = (prodCorrect: number, days: number) => ({ prodCorrect, prodDays: Array.from({ length: days }, (_, i) => `2026-09-0${i + 1}`) })

describe('skill status (SPEC §5.2)', () => {
  it('is not started before any attempt and practising after one', () => {
    expect(skillStatus([undefined, undefined], undefined)).toBe('notStarted')
    expect(skillStatus([k(0), undefined], undefined)).toBe('practising')
    expect(skillStatus([], undefined)).toBe('notStarted')
  })

  it('reaches "with support" at 70 % of the keys in box 2 or more', () => {
    expect(skillStatus([...many(7, 2), ...many(3, 0)], undefined)).toBe('support')
    expect(skillStatus([...many(6, 2), ...many(4, 0)], undefined)).toBe('practising')
  })

  it('counts a key seeded by placement only once it is confirmed', () => {
    const seeded = many(10, 2, { seeded: true, seen: 0, correct: 0 })
    expect(skillStatus(seeded, undefined)).toBe('notStarted')
    expect(skillStatus([k(1), ...seeded.slice(1)], undefined)).toBe('practising')
    expect(isSkippedAtStart(seeded)).toBe(true)
    expect(isSkippedAtStart([k(3), ...seeded.slice(1)])).toBe(false)
  })

  it('needs typed answers on two days for silver and three for gold', () => {
    const half = [...many(5, 4), ...many(5, 2)]
    expect(skillStatus(half, stats(10, 2))).toBe('silver')
    expect(skillStatus(half, stats(10, 1))).toBe('support')
    expect(skillStatus(half, stats(7, 2))).toBe('support') // max(8, 10 keys) = 10
    const most = [...many(8, 5), ...many(2, 3)]
    expect(skillStatus(most, stats(20, 3))).toBe('independent')
    expect(skillStatus(most, stats(19, 3))).toBe('silver') // max(12, 2 · 10) = 20
    expect(skillStatus(most, stats(20, 2))).toBe('silver')
  })

  it('reads a registered skill from a profile', () => {
    const keys = Object.fromEntries(skillKeys(addTo10Fixture).map((id) => [id, k(5)]))
    expect(statusOf('addTo10', { keys, skillStats: { addTo10: stats(200, 4) } }, reg)).toBe('independent')
    expect(statusOf('mul6to9', { keys, skillStats: {} }, reg)).toBe('notStarted')
  })
})

describe('medals', () => {
  it('follow the status and never go down', () => {
    expect(medalFor('support')).toBe('bronze')
    expect(medalFor('silver')).toBe('silver')
    expect(medalFor('independent')).toBe('gold')
    expect(medalFor('practising')).toBeNull()
    expect(upgradeMedal(undefined, 'practising')).toBeUndefined()
    expect(upgradeMedal('silver', 'support')).toBe('silver')
    expect(upgradeMedal('bronze', 'independent')).toBe('gold')
  })
})

describe('learning events', () => {
  const before = newProfile()

  it('reports promoted keys, the first right answer in a family, new statuses and medals', () => {
    const keys: Record<string, KeyState> = { 'add:2+3': k(1, { correct: 1 }) }
    const after = { ...before, keys }
    const events = learningEventsFor(before, after, reg)
    expect(events).toContainEqual({ t: 'keyPromoted', key: 'add:2+3', skill: 'addTo10', box: 1 })
    expect(events).toContainEqual({ t: 'familyFirstCorrect', skill: 'addTo10', family: 'small' })
    expect(events).toContainEqual({ t: 'skillStatus', skill: 'addTo10', status: 'practising' })
    expect(events.some((e) => e.t === 'medal')).toBe(false)
  })

  it('does not repeat familyFirstCorrect once the family has a right answer', () => {
    const one = { ...before, keys: { 'add:2+3': k(1, { correct: 1 }) } }
    const two = { ...one, keys: { ...one.keys, 'add:1+3': k(1, { correct: 1 }) } }
    expect(learningEventsFor(one, two, reg).some((e) => e.t === 'familyFirstCorrect')).toBe(false)
  })

  it('awards the medal when the status earns it, and applies it', () => {
    const all = skillKeys(addTo10Fixture)
    // 32 of 66 keys in box 4 is support; the 33rd makes half, and 70 typed answers on 2 days carry silver
    const one = {
      ...before, keys: Object.fromEntries(all.map((id, i) => [id, k(i < 32 ? 4 : 3)])),
      skillStats: { addTo10: stats(70, 2) }, skillMedals: { addTo10: 'bronze' as const },
    }
    const two = { ...one, keys: { ...one.keys, [all[65]]: k(4) } }
    const events = learningEventsFor(one, two, reg)
    expect(events).toContainEqual({ t: 'medal', skill: 'addTo10', medal: 'silver' })
    expect(applyMedals({}, events)).toEqual({ addTo10: 'silver' })
    // a status that falls again is not an event, and the medal stays
    const three = { ...two, skillMedals: { addTo10: 'silver' as const }, keys: { ...two.keys, [all[0]]: k(2) } }
    expect(learningEventsFor(two, three, reg).filter((e) => e.t !== 'keyPromoted')).toEqual([])
  })

  it('reports procedure families by their key', () => {
    const after = { ...before, keys: { 'add100Carry/nearTen': k(2, { correct: 2 }) } }
    expect(learningEventsFor(before, after, reg)).toContainEqual({ t: 'familyFirstCorrect', skill: 'add100Carry', family: 'nearTen' })
  })
})
