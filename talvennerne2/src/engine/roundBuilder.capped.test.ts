// Rounds after today's allowance of new keys is used up (UI-fund 10 and 16): a round never asks one
// key more than CAPPED_REPEAT_MAX times; it is filled with the region's own seen keys, then the
// chain's, then review; and a node never played gets a taste of its first keys inside a round of
// review — at most TASTE_PER_DAY such keys a day, so a long session still turns to consolidation.
import { describe, expect, it } from 'vitest'
import {
  buildRound, CAPPED_REPEAT_MAX, NEW_PER_DAY, newCapsFor, slotPlan, TASTE_KEYS, TASTE_PER_DAY,
  type KeyOption, type NewCaps, type RoundOptions,
} from './roundBuilder'
import { bumpNewToday, planRound } from './plan'
import { skillKeys, skillRegistry } from './registry'
import { emptyKey } from './mastery'
import { makeRng } from './rng'
import { productKeys, sumKeys, sums } from './testing/keys'
import { keyAt, newProfile } from './testing/profile'
import { NODE_BY_ID } from '../content/curriculum'
import type { KeyState, MasteryKey, Task } from './types'

const DAY = '2026-09-10'
const SEEDS = 1000
const plus = sumKeys(sums('+'), 'addTo10')
const minus = sumKeys(sums('−'), 'subTo10')
const products = productKeys('mul2510')
const used: NewCaps = { total: 0, perSkill: {}, taste: TASTE_PER_DAY }

const seenState = (box: number, lastRound: number, day = '2026-09-08'): KeyState => keyAt(box, day, lastRound)
const isSeen = (s: KeyState | undefined) => !!s && (s.seen > 0 || s.seeded)
const counts = (tasks: readonly Task[]) => {
  const out = new Map<MasteryKey, number>()
  for (const t of tasks) out.set(t.masteryKey, (out.get(t.masteryKey) ?? 0) + 1)
  return out
}

/** Some keys of a pool seen, with random boxes (the rest unseen). */
function seeSome(pool: readonly KeyOption[], share: number, seed: number, out: Record<string, KeyState>): void {
  const rng = makeRng(seed)
  for (const k of pool) if (rng.next() < share) out[k.key] = seenState(rng.between(0, 5), rng.between(0, 19), rng.pick(['2026-09-01', '2026-09-08', DAY]))
}

function round(seed: number, over: Partial<RoundOptions>): Task[] {
  return buildRound({
    keys: plus, states: {}, roundIndex: 20, day: DAY, size: 10, rng: makeRng(seed), slots: slotPlan(10),
    newCaps: used, ...over,
  })
}

describe('a node with one seen key after the allowance (UI-fund 16: "1 + ? = 2" five times)', () => {
  it(`asks no key more than ${CAPPED_REPEAT_MAX} times and fills from the region first, then the chain (${SEEDS} seeds)`, () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const rng = makeRng(seed + 7)
      const states: Record<string, KeyState> = {}
      states[rng.pick(plus).key] = seenState(rng.between(0, 2), 3, DAY)
      seeSome(minus, rng.next() * 0.3, seed, states)
      seeSome(products, rng.next() * 0.6, seed + 1, states)
      const tasks = round(seed, { states, regionKeys: minus, chainKeys: products, reviewKeys: [] })

      for (const [key, n] of counts(tasks)) expect(n, `${seed} ${key}`).toBeLessThanOrEqual(CAPPED_REPEAT_MAX)
      // nothing new: the node has a seen key, so there is no taste
      expect(tasks.filter((t) => !isSeen(states[t.masteryKey])), `${seed}`).toEqual([])
      const regionSeen = minus.filter((k) => isSeen(states[k.key]))
      const chainSeen = products.filter((k) => isSeen(states[k.key]))
      const asked = new Set(tasks.map((t) => t.masteryKey))
      // the chain only comes in once the region's own seen keys are all in the round
      if (tasks.some((t) => t.skill === 'mul2510')) for (const k of regionSeen) expect(asked.has(k.key), `${seed} ${k.key}`).toBe(true)
      // a full round whenever there is enough to ask
      const available = 1 + regionSeen.length + chainSeen.length
      expect(tasks.length, `${seed}`).toBe(Math.min(10, CAPPED_REPEAT_MAX * available))
    }
  })
})

describe('a node never played after the allowance (UI-fund 10: a round of other regions only)', () => {
  it(`gets a taste of its first ${TASTE_KEYS} keys inside review, no key more than twice (${SEEDS} seeds)`, () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const rng = makeRng(seed + 11)
      const states: Record<string, KeyState> = {}
      seeSome(minus, rng.next(), seed, states)
      seeSome(products, rng.next(), seed + 1, states)
      const review = products.filter((k) => (states[k.key]?.box ?? 0) >= 3)
      const tasks = round(seed, { states, chainKeys: minus, reviewKeys: review, startedKeys: [...minus, ...products] })

      for (const [key, n] of counts(tasks)) expect(n, `${seed} ${key}`).toBeLessThanOrEqual(CAPPED_REPEAT_MAX)
      const fresh = new Set(tasks.filter((t) => !isSeen(states[t.masteryKey])).map((t) => t.masteryKey))
      // the taste: exactly the node's first keys (rank order), and never more than TASTE_KEYS
      const first = [...plus].sort((a, b) => a.rank - b.rank).slice(0, TASTE_KEYS).map((k) => k.key)
      expect([...fresh].sort(), `${seed}`).toEqual([...first].sort())
      // never ends on a first meeting
      expect(states[tasks[tasks.length - 1].masteryKey] !== undefined || tasks.filter((t) => t.masteryKey === tasks[tasks.length - 1].masteryKey).length > 1, `${seed}`).toBe(true)
      const seenAvailable = [...minus, ...products].filter((k) => isSeen(states[k.key])).length
      expect(tasks.length, `${seed}`).toBe(Math.min(10, CAPPED_REPEAT_MAX * (TASTE_KEYS + seenAvailable)))
    }
  })

  it('opens on a sure key when there is one, not on the taste', () => {
    for (let seed = 0; seed < 200; seed++) {
      const states: Record<string, KeyState> = {}
      for (const k of products) states[k.key] = seenState(4, 2)
      const tasks = round(seed, { states, reviewKeys: products, startedKeys: products })
      expect(states[tasks[0].masteryKey]?.box ?? 0, `${seed}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('tastes nothing once the day\'s tastes are used, while there is other material', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const states: Record<string, KeyState> = {}
      seeSome(products, 0.5, seed, states)
      if (!products.some((k) => isSeen(states[k.key]))) continue
      const tasks = round(seed, { states, startedKeys: products, newCaps: { total: 0, perSkill: {}, taste: 0 } })
      expect(tasks.filter((t) => !isSeen(states[t.masteryKey])), `${seed}`).toEqual([])
      for (const [, n] of counts(tasks)) expect(n).toBeLessThanOrEqual(CAPPED_REPEAT_MAX)
    }
  })
})

describe('the guardrail: a long session turns to consolidation', () => {
  it(`introduces at most ${NEW_PER_DAY} + ${TASTE_PER_DAY} keys a day however many new nodes are visited`, () => {
    const pools = [plus, minus, products, sumKeys(sums('+', 20).filter((f) => f.a + f.b > 10), 'addTo20')]
    for (let seed = 0; seed < 100; seed++) {
      const states: Record<string, KeyState> = {}
      let newToday = { day: DAY, total: 0, perSkill: {} as Record<string, number> }
      for (let r = 0; r < 16; r++) {
        const keys = pools[(seed + r) % pools.length]
        const tasks = buildRound({
          keys, states, roundIndex: 20 + r, day: DAY, size: 10, rng: makeRng(seed * 31 + r), slots: slotPlan(10),
          startedKeys: pools.flat().filter((k) => !keys.includes(k)), newCaps: newCapsFor(newToday, DAY),
        })
        const fresh = [...new Map(tasks.filter((t) => !isSeen(states[t.masteryKey])).map((t) => [t.masteryKey, t.skill])).entries()]
        for (const [key] of fresh) states[key] = { ...emptyKey(), seen: 1, box: 1, lastDay: DAY, boxDay: DAY, lastRound: 20 + r }
        newToday = bumpNewToday(newToday, DAY, fresh.map(([, skill]) => ({ skill })))
      }
      expect(newToday.total, `${seed}`).toBeLessThanOrEqual(NEW_PER_DAY + TASTE_PER_DAY)
    }
  })
})

describe('planning with the real skills (the rounds seen in Figurhaven and Tierhoppet)', () => {
  const reg = skillRegistry()
  const ctx = { skills: reg, day: DAY, sessionId: 's1', audioVerified: true }

  it('gives Figurhaven a taste and review after a day of Gangegrotten, never a round of shareEqually only', () => {
    const keys: Record<string, KeyState> = {}
    for (const skill of ['groupsOf', 'mul2510', 'shareEqually'] as const) {
      for (const id of skillKeys(reg.get(skill)!)) keys[id] = keyAt(1, DAY, 19)
    }
    const profile = newProfile({ keys, newToday: { day: DAY, total: 20, perSkill: { groupsOf: 8, mul2510: 8, shareEqually: 4 } } })
    for (let seed = 0; seed < 50; seed++) {
      const plan = planRound(NODE_BY_ID['w2-figurer-l1'], profile, { ...ctx, seed })
      expect(plan.newKeys.length, `${seed}`).toBeLessThanOrEqual(TASTE_KEYS)
      expect(plan.tasks.some((t) => ['composeShapes', 'symmetry', 'shapes3D'].includes(t.skill)), `${seed}`).toBe(true)
      for (const [key, n] of counts(plan.tasks)) expect(n, `${seed} ${key}`).toBeLessThanOrEqual(CAPPED_REPEAT_MAX)
    }
  })

  it('fills Tierhoppet l2 with the region\'s seen keys instead of one key five times', () => {
    const tens = reg.get('tens100')!
    const keys: Record<string, KeyState> = {}
    for (const id of skillKeys(tens)) keys[id] = keyAt(1, DAY, 19)
    const node = NODE_BY_ID['w1-tiere-l2']
    const nodeSkill = node.skills[0].skill
    const one = skillKeys(reg.get(nodeSkill)!)[0]
    keys[one] = keyAt(1, DAY, 19)
    const profile = newProfile({ keys, newToday: { day: DAY, total: 20, perSkill: {} } })
    for (let seed = 0; seed < 50; seed++) {
      const plan = planRound(node, profile, { ...ctx, seed })
      expect(plan.newKeys, `${seed}`).toEqual([])
      for (const [key, n] of counts(plan.tasks)) expect(n, `${seed} ${key}`).toBeLessThanOrEqual(CAPPED_REPEAT_MAX)
      expect(plan.tasks.some((t) => t.skill === 'tens100'), `${seed}`).toBe(true)
    }
  })
})
