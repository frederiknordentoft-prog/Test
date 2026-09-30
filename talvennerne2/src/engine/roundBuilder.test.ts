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
