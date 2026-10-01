import { describe, expect, it } from 'vitest'
import { buildRound, GUESSABLE_CEILING } from './roundBuilder'
import { emptyKey } from './mastery'
import { hashSeed, makeRng } from './rng'
import { addFacts, addKeys } from './testing/addFacts'
import type { KeyState } from './types'

const DAY = '2026-09-01'
const keys = addKeys(addFacts(10))
const small = addKeys(addFacts(2)) // 6 facts

const state = (box: number, lastRound = 0): KeyState => ({ ...emptyKey(), box: box as KeyState['box'], seen: 3, lastRound, lastDay: DAY, boxDay: DAY })
const round = (seed: number, states: Record<string, KeyState> = {}, pool = keys, size = 10) =>
  buildRound({ keys: pool, states, roundIndex: 20, day: DAY, size, rng: makeRng(seed) })

describe('round building (ported from V1)', () => {
  it('always fills the round', () => {
    for (let seed = 0; seed < 50; seed++) expect(round(seed)).toHaveLength(10)
  })

  it('never asks the same key twice when the pool is big enough', () => {
    for (let seed = 0; seed < 50; seed++) {
      const ids = round(seed).map((t) => t.masteryKey)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('repeats keys rather than cutting the round short on a tiny pool', () => {
    const tasks = round(3, {}, small)
    expect(tasks).toHaveLength(10)
  })

  it('never puts the same key back to back', () => {
    for (let seed = 0; seed < 100; seed++) {
      const tasks = round(seed, {}, small)
      for (let i = 1; i < tasks.length; i++) expect(tasks[i].masteryKey).not.toBe(tasks[i - 1].masteryKey)
    }
  })

  it('opens with something the child can already do', () => {
    const states: Record<string, KeyState> = {}
    keys.slice(0, 20).forEach((k, i) => (states[k.key] = state(i < 4 ? 4 : 1, i)))
    for (let seed = 0; seed < 30; seed++) {
      const first = round(seed, states)[0]
      expect(states[first.masteryKey]?.box ?? 0).toBeGreaterThanOrEqual(3)
    }
  })

  it('mixes roughly two solid, five shaky and three new', () => {
    const states: Record<string, KeyState> = {}
    keys.slice(0, 10).forEach((k) => (states[k.key] = state(4)))
    keys.slice(10, 30).forEach((k) => (states[k.key] = state(1)))
    const tasks = round(7, states)
    const solid = tasks.filter((t) => (states[t.masteryKey]?.box ?? 0) >= 3).length
    const fresh = tasks.filter((t) => !states[t.masteryKey]).length
    expect(solid).toBe(2)
    expect(fresh).toBe(3)
  })

  it('does not park the right answer in the same slot three times running', () => {
    for (let seed = 0; seed < 100; seed++) {
      let run = 0
      let prev = -1
      for (const t of round(seed)) {
        const slot = t.kind === 'choice' ? t.options.indexOf(t.answer) : -1
        run = slot >= 0 && slot === prev ? run + 1 : 1
        prev = slot
        expect(run).toBeLessThan(3)
      }
    }
  })

  it('is reproducible from its seed', () => {
    expect(round(hashSeed('w0-plus10-l1:3'))).toEqual(round(hashSeed('w0-plus10-l1:3')))
  })

  it('asks the hard way once cards have taken a key as far as they can', () => {
    const states: Record<string, KeyState> = {}
    keys.forEach((k) => (states[k.key] = state(GUESSABLE_CEILING)))
    for (const t of round(11, states)) expect(t.kind).toBe('keypad')
  })

  it('leaves a nearly-there key on cards when the node has nothing else', () => {
    const states: Record<string, KeyState> = {}
    const cardsOnly = addKeys(addFacts(10), ['choice'])
    cardsOnly.forEach((k) => (states[k.key] = state(GUESSABLE_CEILING)))
    for (const t of round(5, states, cardsOnly)) expect(t.kind).toBe('choice')
  })

  it('only uses the kinds a key allows', () => {
    for (let seed = 0; seed < 30; seed++) for (const t of round(seed)) expect(['choice', 'keypad']).toContain(t.kind)
  })

  it('asks production from box 1 on the "Skriv selv" node and always in trials', () => {
    const states: Record<string, KeyState> = {}
    keys.forEach((k) => (states[k.key] = state(1)))
    const l3 = buildRound({ keys, states, roundIndex: 20, day: DAY, size: 10, rng: makeRng(2), production: 'fromBox1' })
    expect(l3.every((t) => t.kind === 'keypad')).toBe(true)
    const trial = buildRound({ keys, states: {}, roundIndex: 20, day: DAY, size: 10, rng: makeRng(2), production: 'only' })
    expect(trial.every((t) => t.kind === 'keypad')).toBe(true)
  })
})

// ─── V2: slots and the arc (SPEC §5.4, §15.1) ───────────────────────────────

import { newCapsFor, slotPlan, type BuildExtra, type KeyOption, type NewCaps, type RoundOptions, type SlotPlan } from './roundBuilder'
import { productKeys, sumKeys, sums } from './testing/keys'
import type { MisconceptionId, Task, TaskKind } from './types'
import type { Rng } from './rng'

const V2_DAY = '2026-09-10'
const plus = sumKeys(sums('+'), 'addTo10')
const minus = sumKeys(sums('−'), 'subTo10')
const nodeKeys = [...plus, ...minus]
const reviewPool = productKeys('mul2510')
const V2_SKILLS = new Set(['addTo10', 'subTo10'])

/** A random but plausible profile: some keys new, some shaky, some sure; review keys sure and due. */
function randomStates(seed: number, pool: readonly KeyOption[] = nodeKeys): Record<string, KeyState> {
  const rng = makeRng(seed)
  const out: Record<string, KeyState> = {}
  for (const k of pool) {
    const r = rng.next()
    if (r < 0.4) continue
    const box = r < 0.8 ? rng.between(0, 2) : rng.between(3, 5)
    out[k.key] = state(box, rng.between(0, 19))
    out[k.key].lastDay = rng.pick(['2026-09-01', '2026-09-08', V2_DAY])
  }
  for (const k of reviewPool) if (rng.next() < 0.5) out[k.key] = { ...state(rng.between(3, 5), 0), lastDay: '2026-09-01' }
  return out
}

function v2(seed: number, over: Partial<RoundOptions> = {}): Task[] {
  const states = over.states ?? randomStates(seed)
  return buildRound({
    keys: nodeKeys, states, roundIndex: 20, day: V2_DAY, size: 10, rng: makeRng(seed), slots: slotPlan(10),
    reviewKeys: reviewPool, newCaps: { total: 20, perSkill: {} }, ...over,
  })
}

const isSeen = (s: KeyState | undefined) => !!s && (s.seen > 0 || s.seeded)
const opOf = (t: Task) => (t.prompt.scene === 'equation' ? t.prompt.terms.find((x) => 'op' in x && x.op !== '=') : undefined)

function maxRun(tasks: readonly Task[]): number {
  let best = 0
  let run = 0
  let prev: unknown
  for (const t of tasks) {
    const op = opOf(t) && 'op' in opOf(t)! ? (opOf(t) as { op: string }).op : null
    run = op !== null && op === prev ? run + 1 : 1
    prev = op
    best = Math.max(best, run)
  }
  return best
}

/** Could the multiset of operations be laid out with at most three alike in a row? */
function runFeasible(tasks: readonly Task[]): boolean {
  const counts = new Map<string, number>()
  for (const t of tasks) {
    const op = (opOf(t) as { op: string } | undefined)?.op ?? `none${t.id}`
    counts.set(op, (counts.get(op) ?? 0) + 1)
  }
  return [...counts.values()].every((c) => c <= 3 * (tasks.length - c + 1))
}

describe('round building V2 over 1000 seeds (SPEC §5.4)', () => {
  const rounds = Array.from({ length: 1000 }, (_, seed) => {
    const states = randomStates(seed)
    return { seed, states, tasks: v2(seed, { states }) }
  })

  it('fills the round from the node', () => {
    for (const { tasks } of rounds) expect(tasks).toHaveLength(10)
  })

  it('opens with a sure key on cards whenever the node has one', () => {
    for (const { states, tasks } of rounds) {
      const anySure = nodeKeys.some((k) => isSeen(states[k.key]) && states[k.key].box >= 3)
      if (anySure) expect(states[tasks[0].masteryKey]?.box ?? 0).toBeGreaterThanOrEqual(3)
      expect(tasks[0].kind).toBe('choice')
    }
  })

  it('never asks the same key twice in a row', () => {
    for (const { tasks } of rounds) for (let i = 1; i < tasks.length; i++) expect(tasks[i].masteryKey).not.toBe(tasks[i - 1].masteryKey)
  })

  it('never has more than three of one operation in a row when it can be avoided', () => {
    let checked = 0
    for (const { tasks } of rounds) {
      if (!runFeasible(tasks)) continue
      checked++
      expect(maxRun(tasks)).toBeLessThanOrEqual(3)
    }
    expect(checked).toBe(1000)
  })

  it('never ends on a first meeting', () => {
    for (const { states, tasks } of rounds) {
      const last = tasks[tasks.length - 1]
      const earlier = tasks.slice(0, -1).some((t) => t.masteryKey === last.masteryKey)
      expect(isSeen(states[last.masteryKey]) || earlier).toBe(true)
    }
  })

  it('takes one review task from another skill when a sure, due key exists there', () => {
    for (const { states, tasks } of rounds) {
      const reviewable = reviewPool.some((k) => isSeen(states[k.key]) && states[k.key].box >= 3)
      const others = tasks.filter((t) => !V2_SKILLS.has(t.skill))
      expect(others.length).toBe(reviewable ? 1 : 0)
      for (const t of others) expect(states[t.masteryKey].box).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps new material under the daily caps', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const states = randomStates(seed)
      const caps: NewCaps = { total: 3, perSkill: { addTo10: 1 } }
      const tasks = v2(seed, { states, newCaps: caps })
      const fresh = new Set(tasks.filter((t) => !isSeen(states[t.masteryKey])).map((t) => t.masteryKey))
      expect(fresh.size).toBeLessThanOrEqual(3)
      expect([...fresh].filter((k) => k.startsWith('add:')).length).toBeLessThanOrEqual(1)
    }
  })

  it('is reproducible from its seed', () => {
    expect(v2(77)).toEqual(v2(77))
  })
})

describe('round building V2: tones, slots and small pools', () => {
  const seeded = (sure: number, shaky: number): Record<string, KeyState> => {
    const out: Record<string, KeyState> = {}
    plus.slice(0, sure).forEach((k) => (out[k.key] = { ...state(4, 0), lastDay: '2026-09-01' }))
    plus.slice(sure, sure + shaky).forEach((k) => (out[k.key] = state(1, 10)))
    for (const k of reviewPool.slice(0, 5)) out[k.key] = { ...state(4, 0), lastDay: '2026-09-01' }
    return out
  }
  const count = (tasks: readonly Task[], states: Record<string, KeyState>) => ({
    sure: tasks.filter((t) => V2_SKILLS.has(t.skill) && (states[t.masteryKey]?.box ?? 0) >= 3).length,
    shaky: tasks.filter((t) => isSeen(states[t.masteryKey]) && states[t.masteryKey].box < 3).length,
    fresh: tasks.filter((t) => !isSeen(states[t.masteryKey])).length,
    review: tasks.filter((t) => !V2_SKILLS.has(t.skill)).length,
  })

  it('normal: 1 sure, 5 shaky + 1 targeted-or-shaky, 2 new, 1 review', () => {
    const states = seeded(10, 20)
    const tasks = v2(3, { states, keys: plus })
    expect(count(tasks, states)).toEqual({ sure: 1, shaky: 6, fresh: 2, review: 1 })
  })

  it('fatigue: 4 sure, 5 shaky, 1 new, no review, all on cards', () => {
    const states = seeded(10, 20)
    const tasks = v2(3, { states, keys: plus, slots: slotPlan(10, 'fatigue'), tone: 'fatigue' })
    expect(count(tasks, states)).toEqual({ sure: 4, shaky: 5, fresh: 1, review: 0 })
    expect(tasks.every((t) => t.kind === 'choice')).toBe(true)
  })

  it('warm: 1 sure, 4 shaky, 4 new, 1 review', () => {
    const states = seeded(10, 20)
    const tasks = v2(3, { states, keys: plus, slots: slotPlan(10, 'warm'), tone: 'warm' })
    expect(count(tasks, states)).toEqual({ sure: 1, shaky: 4, fresh: 4, review: 1 })
  })

  it('mix nodes: seven from the region and three review', () => {
    const states = seeded(10, 20)
    expect(slotPlan(10, 'normal', 3)).toEqual({ secure: 1, shaky: 4, fresh: 1, review: 3, targeted: 1 })
    expect(count(v2(3, { states, keys: plus, slots: slotPlan(10, 'normal', 3) }), states).review).toBe(3)
  })

  it('regions with eight-task rounds get eight', () => {
    const plan: SlotPlan = slotPlan(8)
    expect(plan.secure + plan.shaky + plan.fresh + plan.review + plan.targeted).toBe(8)
    expect(v2(5, { size: 8, slots: plan })).toHaveLength(8)
  })

  it('aims the targeted slot at a flagged misconception', () => {
    const states = seeded(10, 20)
    for (let seed = 0; seed < 50; seed++) {
      const aimed: { key: string; target: readonly MisconceptionId[] }[] = []
      const spied = plus.map((k) => ({
        ...k,
        build: (kind: TaskKind, rng: Rng, i: number, extra?: BuildExtra) => {
          if (extra?.target) aimed.push({ key: k.key, target: extra.target })
          return k.build(kind, rng, i, extra)
        },
      }))
      v2(seed, { states, keys: spied, flagged: ['countFromFirst'] })
      expect(aimed).toHaveLength(1)
      expect(aimed[0].target).toEqual(['countFromFirst'])
      expect(plus.find((k) => k.key === aimed[0].key)?.detectable).toContain('countFromFirst')
      expect(isSeen(states[aimed[0].key])).toBe(true)
    }
    // no key can show the flagged idea: the slot goes to one more shaky key
    const plain = v2(3, { states, keys: plus, flagged: ['sizeIsWeight'] })
    expect(count(plain, states)).toEqual({ sure: 1, shaky: 6, fresh: 2, review: 1 })
  })

  it('repeats a tiny pool without back-to-back repeats and ends on a repeat', () => {
    const tiny = plus.slice(0, 3)
    for (let seed = 0; seed < 200; seed++) {
      const tasks = v2(seed, { keys: tiny, states: {}, reviewKeys: [] })
      expect(tasks).toHaveLength(10)
      for (let i = 1; i < 10; i++) expect(tasks[i].masteryKey).not.toBe(tasks[i - 1].masteryKey)
      expect(tasks.slice(0, 9).some((t) => t.masteryKey === tasks[9].masteryKey)).toBe(true)
    }
  })

  it('asks the "Skriv selv" node on the keypad from box 1, after an opener on cards', () => {
    const states: Record<string, KeyState> = {}
    plus.forEach((k) => (states[k.key] = state(1, 10)))
    const tasks = v2(4, { states, keys: plus, reviewKeys: [], production: 'fromBox1' })
    expect(tasks[0].kind).toBe('choice')
    expect(tasks.slice(1).every((t) => t.kind === 'keypad')).toBe(true)
  })

  it('is never empty while the node has keys, even with the day\'s allowance used up', () => {
    const tasks = v2(1, { keys: plus, states: {}, reviewKeys: [], newCaps: { total: 0, perSkill: {} } })
    expect(tasks).toHaveLength(10)
    expect(new Set(tasks.map((t) => t.masteryKey)).size).toBeLessThanOrEqual(2)
    expect(v2(1, { keys: [], states: {} })).toEqual([])
  })

  it('puts the focus keys first (the training hut)', () => {
    const states = seeded(10, 20)
    const focus = new Set([plus[25].key, plus[26].key, plus[27].key])
    const tasks = v2(9, { states, keys: plus, focus, slots: { secure: 1, shaky: 9, fresh: 0, review: 0, targeted: 0 }, newCaps: { total: 0, perSkill: {} } })
    for (const key of focus) expect(tasks.some((t) => t.masteryKey === key)).toBe(true)
  })

  it('turns profile.newToday into what is left today', () => {
    expect(newCapsFor({ day: V2_DAY, total: 12, perSkill: { addTo10: 8, subTo10: 3 } }, V2_DAY)).toEqual({ total: 8, perSkill: { addTo10: 0, subTo10: 5 } })
    expect(newCapsFor({ day: '2026-09-09', total: 20, perSkill: { addTo10: 8 } }, V2_DAY)).toEqual({ total: 20, perSkill: {} })
  })
})
