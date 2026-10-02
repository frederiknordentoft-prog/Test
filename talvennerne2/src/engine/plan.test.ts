import { describe, expect, it } from 'vitest'
import { bumpNewToday, goldenFor, planRound, roundTone, type PlanContext } from './plan'
import { factsOf, makeRegistry, skillKeys, skillRegistry } from './registry'
import { FIXTURE_SKILLS, addTo10Fixture, hear20Fixture } from './testing/fixtureSkills'
import { keyAt, newProfile } from './testing/profile'
import { NODE_BY_ID } from '../content/curriculum'
import { isProduction } from './kinds'
import type { KeyState, ProfileDoc, Task } from './types'

const reg = makeRegistry(FIXTURE_SKILLS)
const DAY = '2026-09-10'
const ctx = (over: Partial<PlanContext> = {}): PlanContext => ({ skills: reg, day: DAY, sessionId: 's1', audioVerified: true, ...over })
const node = (id: string) => NODE_BY_ID[id]

/** A child well into Plusengen who is also sure of a few hear20 numbers. */
function midway(over: Partial<ProfileDoc> = {}): ProfileDoc {
  const keys: Record<string, KeyState> = {}
  skillKeys(addTo10Fixture).forEach((id, i) => {
    if (i < 10) keys[id] = keyAt(4, '2026-09-01', 2)
    else if (i < 30) keys[id] = keyAt(1, '2026-09-08', 15)
  })
  for (const id of skillKeys(hear20Fixture).slice(0, 6)) keys[id] = keyAt(4, '2026-09-01', 1)
  return newProfile({ keys, ...over })
}

describe('planning a node round', () => {
  it('fills the node\'s size with the node\'s skills plus one review from another skill', () => {
    const plan = planRound(node('w0-plus10-l1'), midway(), ctx())
    expect(plan).toMatchObject({ mode: 'round', nodeId: 'w0-plus10-l1', sessionId: 's1', roundId: 'p1:20:w0-plus10-l1' })
    expect(plan.tasks).toHaveLength(10)
    expect(plan.tasks.filter((t) => t.skill === 'hear20')).toHaveLength(1)
    expect(plan.tasks[0].kind).toBe('choice')
    expect(plan.newKeys.length).toBeGreaterThan(0)
    expect(plan.newKeys.every((k) => k.skill === 'addTo10')).toBe(true)
  })

  it('is a pure function of the profile and the seed', () => {
    expect(planRound(node('w0-plus10-l1'), midway(), ctx())).toEqual(planRound(node('w0-plus10-l1'), midway(), ctx()))
    expect(planRound(node('w0-plus10-l1'), midway(), ctx({ seed: 1 })).tasks).not.toEqual(planRound(node('w0-plus10-l1'), midway(), ctx({ seed: 2 })).tasks)
  })

  it('leaves hear* out without sound, and turned-off domains out of review', () => {
    expect(planRound(node('w0-plus10-l1'), midway(), ctx({ audioVerified: false })).tasks.some((t) => t.skill === 'hear20')).toBe(false)
    const off = midway({ settings: { ...newProfile().settings, domainsOff: ['number'] } })
    expect(planRound(node('w0-plus10-l1'), off, ctx()).tasks.some((t) => t.skill === 'hear20')).toBe(false)
  })

  it('respects the day\'s allowance of new keys', () => {
    const plan = planRound(node('w0-plus10-l1'), midway({ newToday: { day: DAY, total: 19, perSkill: {} } }), ctx())
    expect(plan.newKeys.length).toBeLessThanOrEqual(1)
    const fresh = planRound(node('w0-plus10-l1'), newProfile(), ctx())
    expect(fresh.newKeys.length).toBeLessThanOrEqual(8)
    expect(bumpNewToday({ day: '2026-09-09', total: 20, perSkill: { addTo10: 8 } }, DAY, fresh.newKeys))
      .toEqual({ day: DAY, total: fresh.newKeys.length, perSkill: { addTo10: fresh.newKeys.length } })
  })

  it('turns a tired child\'s round towards sure things on cards', () => {
    const tired = midway({ recentFirstTries: [true, false, false, true, false, false, true, false, false, false] })
    const plan = planRound(node('w0-plus10-l1'), tired, ctx())
    expect(plan.tasks.every((t) => t.kind === 'choice')).toBe(true)
    expect(plan.tasks.some((t) => t.skill === 'hear20')).toBe(false)
    expect(plan.newKeys.length).toBeLessThanOrEqual(1)
  })

  it('asks the "Skriv selv" node on the keypad from box 1', () => {
    const plan = planRound(node('w0-plus10-l3'), midway(), ctx())
    const known = plan.tasks.slice(1).filter((t) => (midway().keys[t.masteryKey]?.box ?? 0) >= 1)
    expect(known.length).toBeGreaterThan(0)
    expect(known.every((t) => t.kind === 'keypad')).toBe(true)
  })
})

describe('tone of the next round (SPEC §5.4)', () => {
  it('reads fatigue and warmth from the last ten first tries', () => {
    expect(roundTone([true, true, true])).toBe('normal')
    expect(roundTone(Array(10).fill(false).map((_, i) => i < 4))).toBe('fatigue')
    expect(roundTone(Array(10).fill(true))).toBe('warm')
    expect(roundTone(Array(10).fill(true), Array(10).fill(true).map((_, i) => i !== 3))).toBe('normal')
    expect(roundTone(Array(10).fill(true), Array(10).fill(true))).toBe('warm')
  })
})

describe('other plans', () => {
  it('Blandet øvelse asks only what the child has met, nothing new', () => {
    const plan = planRound('practice', midway(), ctx())
    expect(plan.mode).toBe('practice')
    expect(plan.nodeId).toBe('practice')
    expect(plan.tasks).toHaveLength(10)
    expect(plan.newKeys).toEqual([])
    expect(new Set(plan.tasks.map((t) => t.skill))).toEqual(new Set(['addTo10', 'hear20']))
  })

  it('Blandet øvelse for a brand-new child starts in Tællelunden', () => {
    const plan = planRound('practice', newProfile(), ctx())
    expect(plan.tasks.length).toBeGreaterThan(0)
    expect(plan.tasks.every((t) => t.skill === 'hear20')).toBe(true)
  })

  it('the training hut asks the families missed in the trial', () => {
    const missed = ['add:3+4', 'add:5+5', 'add:6+2']
    const profile = midway()
    for (const id of missed) profile.keys[id] = keyAt(1, '2026-09-08', 18)
    const plan = planRound('hut', profile, ctx({ hutRegion: 'w0-plus10', hutKeys: missed }))
    expect(plan.mode).toBe('hut')
    for (const id of missed) expect(plan.tasks.some((t) => t.masteryKey === id)).toBe(true)
    expect(plan.newKeys).toEqual([])
  })

  it('trials and finales are typed answers only', () => {
    const trial = planRound(node('w0-plus10-trial'), midway(), ctx())
    expect(trial.mode).toBe('trial')
    expect(trial.tasks).toHaveLength(10)
    expect(trial.tasks.every(isProduction)).toBe(true)
    const finale = planRound(node('eng-finale'), midway(), ctx())
    expect(finale.mode).toBe('finale')
    expect(finale.tasks).toHaveLength(12)
  })

  it('gives every plan a golden egg on cards', () => {
    for (const plan of [planRound(node('w0-plus10-l1'), midway(), ctx()), planRound('practice', midway(), ctx())]) {
      const egg = goldenFor(plan, midway(), ctx())
      expect(egg?.kind).toBe('choice')
      expect(goldenFor(plan, midway(), ctx())).toEqual(egg)
    }
  })
})

// ─── The first rounds vary (review r1 P2-11) ────────────────────────────────

describe('a new child\'s first rounds vary, inside the rules of SPEC §5.4', () => {
  const real = skillRegistry()
  const SEEDS = 300
  const play = (seed: number, nodeId: string, audioVerified: boolean, profile = newProfile({ grade: 0 })) =>
    planRound(node(nodeId), profile, { skills: real, day: DAY, sessionId: 's1', audioVerified, seed })
  const answerOf = (t: Task) => String(t.answer)
  const firstRounds = [true, false].flatMap((audio) => ['w0-tal10-l1', 'w0-tal10-l2', 'w0-plus10-l1'].flatMap((id) =>
    Array.from({ length: SEEDS }, (_, seed) => ({ id, audio, seed, plan: play(seed, id, audio) }))))

  it('asks no answer more than twice in a round where the node has enough different keys', () => {
    for (const { id, plan } of firstRounds) {
      if (id === 'w0-tal10-l2') continue // order20 keys are families: their answers are drawn fresh each time
      const counts = new Map<string, number>()
      for (const t of plan.tasks) counts.set(answerOf(t), (counts.get(answerOf(t)) ?? 0) + 1)
      expect(Math.max(...counts.values()), `${id}: ${plan.tasks.map(answerOf).join(' ')}`).toBeLessThanOrEqual(2)
    }
  })

  it('does not ask the same answer twice in a row', () => {
    for (const { plan } of firstRounds) {
      const answers = plan.tasks.map((t) => t.masteryKey.includes('/') ? null : answerOf(t))
      for (let i = 1; i < answers.length; i++) if (answers[i] !== null) expect(answers[i], plan.tasks.map(answerOf).join(' ')).not.toBe(answers[i - 1])
    }
  })

  it('asks a share of the free tasks in the node\'s other kinds, and always more than one kind', () => {
    let free = 0
    let other = 0
    for (const { plan } of firstRounds) {
      const kinds = new Set(plan.tasks.map((t) => t.kind))
      expect(kinds.size, plan.tasks.map((t) => t.kind).join(' ')).toBeGreaterThanOrEqual(2)
      expect(plan.tasks[0].kind).toBe('choice')
      // the opener is on cards and a repeat is asked another way on purpose; the first meeting of
      // every other key is free to vary (a first round has every key in box 0)
      const met = new Set([plan.tasks[0].masteryKey])
      for (const t of plan.tasks.slice(1)) {
        if (met.has(t.masteryKey)) continue
        met.add(t.masteryKey)
        if ((real.get(t.skill)?.kinds.length ?? 0) < 2) continue
        free++
        if (t.kind !== 'choice') other++
      }
    }
    // SPEC §5.4: the house kind, and 35 % of the time one of the others
    expect(other / free).toBeGreaterThan(0.25)
    expect(other / free).toBeLessThan(0.45)
  })

  it('lets the skills of a node take turns with new keys, each in its own rank order', () => {
    for (const { id, audio, plan } of firstRounds) {
      if (id !== 'w0-tal10-l1' || !audio) continue
      const fresh = plan.newKeys.map((k) => k.skill)
      const count = (skill: string) => fresh.filter((s) => s === skill).length
      // both skills come, about as often (the opener and the closer are the first hear20 key)
      expect(Math.abs(count('count10') - count('hear20'))).toBeLessThanOrEqual(1)
      // and the tasks alternate between them after the opener
      const order = plan.tasks.slice(1, -1).map((t) => t.skill)
      const switches = order.filter((s, i) => i > 0 && s !== order[i - 1]).length
      expect(switches, order.join(' ')).toBeGreaterThanOrEqual(3)
      for (const skill of new Set(fresh)) {
        const def = real.get(skill)!
        const rank = new Map(factsOf(def).map((f) => [f.id, f.rank]))
        const ranks = plan.newKeys.filter((k) => k.skill === skill).map((k) => rank.get(k.key)!)
        const lowest = [...rank.values()].sort((a, b) => a - b)
        // a key is only passed over while its answer is in the round twice: never far down the list
        expect(Math.max(...ranks)).toBeLessThanOrEqual(lowest[ranks.length * 4])
      }
    }
  })

  it('introduces count10 in its own rank order, two ways of seeing each number at a time', () => {
    for (const { id, audio, plan } of firstRounds) {
      if (id !== 'w0-tal10-l1' || audio) continue
      expect(plan.tasks[0].masteryKey).toBe('c10:scatter:1')
      // the first numbers spread out and on a die, no number more than twice; their fingers and
      // ten-frames wait for a later round (the cap of eight new keys per skill and day holds)
      expect(new Set(plan.newKeys.map((k) => k.key))).toEqual(new Set([
        'c10:scatter:1', 'c10:scatter:2', 'c10:dice:2', 'c10:scatter:3', 'c10:dice:3', 'c10:scatter:4', 'c10:dice:4', 'c10:scatter:5',
      ]))
    }
  })

  it('is the same round for the same seed', () => {
    expect(play(5, 'w0-tal10-l1', true)).toEqual(play(5, 'w0-tal10-l1', true))
  })
})
