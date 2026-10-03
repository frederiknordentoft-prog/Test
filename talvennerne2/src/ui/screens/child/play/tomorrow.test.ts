import { describe, expect, it } from 'vitest'
import { NODE_BY_ID } from '../../../../content/curriculum'
import { learningDay } from '../../../../engine/learningDay'
import { OWN_SHARE_MIN, planRound } from '../../../../engine/plan'
import { skillKeys, skillRegistry } from '../../../../engine/registry'
import { keyAt, newProfile } from '../../../../engine/testing/profile'
import type { KeyState, NodeId, NodeProgress, ProfileDoc } from '../../../../engine/types'
import { hasClip, clipText } from '../../../../speech/catalog'
import { chooseStart, type StartContext } from './prepare'

/**
 * A stone counts for the stone (stars, friend, chest, played) only when at least half of its round
 * is its own (QA2 P2-1, SPEC A15). A stone never played, reached after today's new keys and the taste
 * (A13) are used up, cannot give its own material: no round starts, and the intro offers Blandet
 * øvelse instead — so a long day never hands out a chest or a friend for other regions' tasks. A
 * fresh day, and a stone already played, run as before.
 */

const NOW = Date.parse('2026-09-10T10:00:00')
const DAY = learningDay(NOW)
const reg = skillRegistry()
const ctx = (over: Partial<StartContext> = {}): StartContext => ({ sessionId: 's-test', audioVerified: true, now: NOW, ...over })
const played = (plays = 2): NodeProgress => ({ plays, stars: 2, skipped: false, lastAt: NOW - 60_000 })

/** A child who has played Tællelunden and Plusengen all morning: today's new keys and the taste are used. */
function longDay(nodes: Partial<Record<NodeId, NodeProgress>> = {}, over: Partial<ProfileDoc> = {}): ProfileDoc {
  const keys: Record<string, KeyState> = {}
  for (const skill of ['count10', 'hear20', 'order20', 'addTo10'] as const) {
    for (const k of skillKeys(reg.get(skill)!)) keys[k] = keyAt(2, DAY, 19)
  }
  return newProfile({
    grade: 0,
    keys,
    nodes: {
      'w0-tal10-l1': played(), 'w0-tal10-l2': played(), 'w0-tal10-friend': played(1),
      'w0-plus10-l1': played(), 'w0-plus10-l2': played(), 'w0-plus10-friend': played(1),
      ...nodes,
    },
    newToday: { day: DAY, total: 24, perSkill: { count10: 8, hear20: 8, addTo10: 8 } },
    ...over,
  })
}

describe('a stone that cannot give its own material today (QA2 P2-1)', () => {
  it('says so instead of starting a round of other regions\' tasks', () => {
    const p = longDay()
    expect(planRound(NODE_BY_ID['w0-former-l1'], p, { day: DAY, sessionId: 's', audioVerified: true }).ownShare).toBeLessThan(OWN_SHARE_MIN)
    expect(chooseStart('w0-former-l1', p, ctx())).toEqual({ kind: 'tomorrow' })
  })

  it('gives no chest for a round without the region\'s own tasks', () => {
    // Formhaven's first stones were played on an earlier day without its own keys being met
    const p = longDay({ 'w0-former-l1': played(1), 'w0-former-l2': played(1) })
    expect(NODE_BY_ID['w0-former-chest']).toBeDefined()
    expect(chooseStart('w0-former-chest', p, ctx())).toEqual({ kind: 'tomorrow' })
  })

  it('starts the round on a fresh day, all of it the stone\'s own', () => {
    const p = longDay({}, { newToday: { day: '2026-09-09', total: 24, perSkill: {} } })
    const start = chooseStart('w0-former-l1', p, ctx())
    expect(start.kind).toBe('plan')
    const plan = planRound(NODE_BY_ID['w0-former-l1'], p, { day: DAY, sessionId: 's', audioVerified: true })
    expect(plan.ownShare).toBeGreaterThanOrEqual(OWN_SHARE_MIN)
    expect(newProfile().newToday.day).toBe('')
    expect(chooseStart('w0-tal10-l1', newProfile({ grade: 0 }), ctx()).kind).toBe('plan')
  })

  it('runs a stone already played as before (A13), and Blandet øvelse always', () => {
    const p = longDay({ 'w0-former-l1': played(1) })
    expect(chooseStart('w0-former-l1', p, ctx()).kind).toBe('plan')
    expect(chooseStart('practice', longDay(), ctx()).kind).toBe('plan')
  })

  it('reports the share of the stone\'s own tasks, and 1 where there is no stone to give', () => {
    const fresh = newProfile({ grade: 0 })
    const plan = planRound(NODE_BY_ID['w0-tal10-l1'], fresh, { day: DAY, sessionId: 's', audioVerified: true })
    expect(plan.ownShare).toBe(1)
    expect(planRound('practice', longDay(), { day: DAY, sessionId: 's', audioVerified: true }).ownShare).toBe(1)
  })

  it('has Pip\'s line without numbers, a countdown or a clock', () => {
    expect(hasClip('s.play.tomorrow')).toBe(true)
    const line = clipText('s.play.tomorrow')
    expect(line).toBe('Her er der nyt i morgen. Nu kan du øve det, du har lært.')
    expect(line).not.toMatch(/\d|time|minut|kom tilbage|venter/i)
    expect(clipText('s.map.practice')).toBe('Blandet øvelse')
  })
})
