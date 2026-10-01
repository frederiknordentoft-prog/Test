import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '../data/db'
import { createProfile } from '../data/repo/profiles'
import { freshDb } from '../data/testing/freshDb'
import { learningDay } from '../engine/learningDay'
import { makeRng } from '../engine/rng'
import { addFacts, buildAddTask } from '../engine/testing/addFacts'
import type { NodeId, RoundMode, Task } from '../engine/types'
import { roundHooks, useProfile } from '../state/useProfile'
import { MemoryStorage } from '../data/testing/memoryStorage'
import { ROUND_START_KEY, dropRoundStartMemory, installMeta, metaView, progressBefore, useMeta } from '../state/useMeta'
import { useRound } from '../state/useRound'

/**
 * The glue: a round played through useRound and the data layer ends in rewards that are saved with
 * the profile, the ceremonies are planned, and every action goes through useProfile.update.
 */

const T0 = Date.parse('2026-10-01T14:00:00Z')
let clock = T0
let uninstall: () => void = () => undefined

beforeEach(async () => {
  await useProfile.getState().unload({ discard: true })
  await freshDb()
  clock = T0
  uninstall = installMeta({ now: () => clock })
  useMeta.setState({ ceremony: null, rewards: [], lastAction: [], hutKeys: {} })
})

afterEach(() => {
  uninstall()
})

function tasks(n: number, kind: 'choice' | 'keypad' = 'keypad'): Task[] {
  const facts = addFacts(10).slice(10, 10 + n)
  return facts.map((f, i) => buildAddTask(f, kind, makeRng(i), i))
}

/** Play a whole round: `wrong` lists the first tries answered wrong. */
function playRound(nodeId: NodeId | 'practice', mode: RoundMode, list: Task[], wrong: number[] = []) {
  const id = `r-${clock}`
  useRound.getState().start({ roundId: id, sessionId: 's', mode, nodeId, seed: 1, tasks: list }, roundHooks({ now: () => clock }))
  let first = 0
  while (useRound.getState().status !== 'finished') {
    const s = useRound.getState()
    const task = s.current!
    clock += 1500
    const isFirst = !task.retryOf
    const right = !(isFirst && wrong.includes(first))
    if (isFirst) first++
    useRound.getState().submit(right ? task.answer : (task.answer as number) + 1)
    clock += 500
    useRound.getState().next()
  }
  return id
}

async function newChild() {
  const p = await createProfile({ name: 'Ada', grade: 0, now: T0 })
  await useProfile.getState().loadProfile(p.id)
  return p.id
}

describe('useMeta', () => {
  it('turns a finished round into saved rewards and an end-of-round plan', async () => {
    const id = await newChild()
    expect(useMeta.getState().chooseStarter('cat')).toBe(true)
    playRound('w0-plus10-l1', 'round', tasks(10))
    const { ceremony, rewards } = useMeta.getState()
    expect(ceremony?.steps[0].kind).toBe('learned')
    expect(rewards.find((r) => r.t === 'answers')).toMatchObject({ correct: 10, perler: 10 })
    expect(rewards.find((r) => r.t === 'stars')).toMatchObject({ node: 'w0-plus10-l1', stars: 3 })
    // the keys that moved come from the progress captured when the round started
    const learned = rewards[0]
    expect(learned.t === 'learned' && learned.promoted.length).toBeGreaterThan(0)
    const p = useProfile.getState().profile!
    expect(p.economy.perler).toBeGreaterThanOrEqual(10 + 4)
    expect(p.nodes['w0-plus10-l1']).toMatchObject({ plays: 1, stars: 3 })
    expect(p.goals.list).toHaveLength(3)
    await useProfile.getState().flush()
    const saved = await getDb().profiles.get(id)
    expect(saved?.economy).toEqual(p.economy)
    expect(saved?.animals.map((a) => a.uid)).toEqual(['starter-cat'])
    useMeta.getState().dismissCeremony()
    expect(useMeta.getState().ceremony).toBeNull()
  })

  it('rebuilds the starting progress from the saved keys after a reload', async () => {
    const store = new MemoryStorage()
    const had = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    Object.defineProperty(globalThis, 'sessionStorage', { value: store, configurable: true })
    try {
      await newChild()
      const list = tasks(3)
      useRound.getState().start({ roundId: 'r-reload', sessionId: 's', mode: 'round', nodeId: 'w0-plus10-l1', seed: 1, tasks: list }, roundHooks({ now: () => clock }))
      const before = useProfile.getState().profile!
      expect(JSON.parse(store.getItem(ROUND_START_KEY)!)).toMatchObject({ roundId: 'r-reload', profileId: before.id })
      for (const t of list.slice(0, 2)) {
        clock += 1500
        useRound.getState().submit(t.answer)
        useRound.getState().next()
      }
      // the page reloads: what was in memory is gone, the sessionStorage copy is left
      dropRoundStartMemory()
      const mid = useProfile.getState().profile!
      expect(mid.keys[list[0].masteryKey]).toBeDefined()
      const rebuilt = progressBefore(mid, 'r-reload')
      for (const t of list) expect(rebuilt.keys[t.masteryKey]).toEqual(before.keys[t.masteryKey])
      // the rest of the profile is today's, untouched
      expect(rebuilt.skillMedals).toBe(mid.skillMedals)
      // finishing the round cleans up after itself
      clock += 1500
      useRound.getState().submit(list[2].answer)
      useRound.getState().next()
      expect(store.getItem(ROUND_START_KEY)).toBeNull()
    } finally {
      if (had) Object.defineProperty(globalThis, 'sessionStorage', had)
      else delete (globalThis as { sessionStorage?: Storage }).sessionStorage
    }
  })

  it('remembers the missed keys of a failed trial for the training hut', async () => {
    await newChild()
    useMeta.getState().chooseStarter('rabbit')
    const list = tasks(10)
    playRound('w0-plus10-trial', 'trial', list, [0, 1, 2, 3])
    expect(useMeta.getState().hutKeys['w0-plus10']).toEqual(list.slice(0, 4).map((t) => t.masteryKey))
    expect(useMeta.getState().rewards.some((r) => r.t === 'hut')).toBe(true)
    expect(metaView(useProfile.getState().profile!).unlock.huts).toEqual(['w0-plus10'])
  })

  it('saves every action through the profile store, and refuses what is not allowed', async () => {
    await newChild()
    const meta = useMeta.getState()
    expect(meta.chooseStarter('dragon')).toBe(false)
    expect(meta.chooseStarter('puppy')).toBe(true)
    expect(meta.chooseStarter('cat')).toBe(false)
    const uid = useProfile.getState().profile!.animals[0].uid
    expect(meta.nameAnimal(uid, 'Bobo')).toBe(true)
    expect(meta.buyItem('pirat-face')).toBe(false)
    useProfile.getState().update((p) => ({ ...p, economy: { ...p.economy, perler: 300 } }))
    expect(meta.setWish('pirat-face')).toBe(true)
    expect(metaView(useProfile.getState().profile!).wish).toBe(1)
    expect(meta.buyItem('pirat-face')).toBe(true)
    expect(useMeta.getState().lastAction).toEqual([{ t: 'item', item: 'pirat-face', source: { kind: 'shop', price: 80 } }])
    expect(meta.buyRecolor('pirat-face', 2)).toBe(true)
    expect(meta.wear(uid, 'pirat-face', 2)).toBe(true)
    expect(meta.buyDecor('pynt-baenk')).toBe(true)
    expect(meta.placeDecor('pynt-baenk', 0.2, 0.9)).toBe(true)
    const p = useProfile.getState().profile!
    expect(p.economy).toMatchObject({ perler: 300 - 80 - 25 - 80, wish: null })
    expect(p.animals[0]).toMatchObject({ name: 'Bobo', outfit: { face: { item: 'pirat-face', color: 2 } } })
    expect(p.decor['pynt-baenk']).toMatchObject({ x: 0.2, y: 0.9 })
    // the egg: warm it, pick the species, open it
    useProfile.getState().update((q) => ({ ...q, economy: { ...q.economy, eggWarmth: 15 } }))
    expect(metaView(useProfile.getState().profile!).eggReady).toBe(true)
    const hatch = meta.openEgg()
    expect(hatch?.[0]).toMatchObject({ t: 'hatch', egg: 1, animal: { species: 'puppy' } })
    expect(meta.setBuddy(hatch![0].t === 'hatch' ? hatch![0].animal.uid : '')).toBe(true)
    await useProfile.getState().flush()
    const saved = await getDb().profiles.get(p.id)
    expect(saved?.animals).toHaveLength(2)
    expect(saved?.economy.perler).toBe(115)
  })

  it('sets the goals of the day when a profile is loaded, and no more that day', async () => {
    await newChild()
    await Promise.resolve()
    const goals = useProfile.getState().profile!.goals
    expect(goals.day).toBe(learningDay(T0))
    expect(goals.list).toHaveLength(3)
    expect(useMeta.getState().refreshGoals()).toBe(false)
  })
})
