import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '../data/db'
import { createProfile } from '../data/repo/profiles'
import { freshDb } from '../data/testing/freshDb'
import { makeRng } from '../engine/rng'
import { buildAddTask } from '../engine/testing/addFacts'
import { useProfile } from './useProfile'

// The diagnostics bodies belong to the engine; here they fail on purpose.
vi.mock('../engine/misconceptions', () => ({
  classifyAnswer: () => {
    throw new Error('classify broke')
  },
  detectableOf: () => {
    throw new Error('detectable broke')
  },
  updateMisconceptions: () => {
    throw new Error('update broke')
  },
}))

beforeEach(async () => {
  await useProfile.getState().unload({ discard: true })
  await freshDb()
})

describe('guards on the write path', () => {
  it('never lets a failing diagnostic stop the round', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const p = await createProfile({ name: 'Ada', grade: 0 })
    await useProfile.getState().loadProfile(p.id)
    const task = buildAddTask({ id: 'add:2+2', a: 2, b: 2, answer: 4, rank: 4 }, 'keypad', makeRng(1), 0)
    const entry = useProfile.getState().recordAnswer({
      task, given: 5, correct: false, ms: 4000, fast: false, production: true, ceiling: 5, mode: 'round', assisted: false,
      retryOf: null, replays: 0, ts: Date.now(), roundId: 'r1', sessionId: 's1', nodeId: 'w0-plus10-l1',
    })
    expect(entry).toMatchObject({ errorTag: null, detectable: [], correct: false })
    expect(errors).toHaveBeenCalledTimes(3)
    await useProfile.getState().flush()
    expect(await getDb().answers.count()).toBe(1)
    expect(useProfile.getState().profile?.misconceptions).toEqual({})
  })

  it('keeps the loaded profile when reading another one fails', async () => {
    const a = await createProfile({ name: 'Ada', grade: 0 })
    const b = await createProfile({ name: 'Bo', grade: 0 })
    await useProfile.getState().loadProfile(a.id)
    vi.spyOn(getDb().profiles, 'get').mockRejectedValueOnce(new Error('UnknownError'))
    await expect(useProfile.getState().loadProfile(b.id)).rejects.toThrow('UnknownError')
    expect(useProfile.getState()).toMatchObject({ status: 'ready', profile: { id: a.id } })
  })
})
