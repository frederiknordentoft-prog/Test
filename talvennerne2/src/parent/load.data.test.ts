import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '../data/db'
import { createProfile } from '../data/repo/profiles'
import { freshDb } from '../data/testing/freshDb'
import { skillRegistry } from '../engine/registry'
import { useProfile } from '../state/useProfile'
import { ago, answers, dailyFrom, NOW, TODAY } from './fixtures'
import { ANSWER_DAYS, keyIndexOf, loadDashboard, loadSource } from './load'

describe('loading the dashboard from IndexedDB', () => {
  beforeEach(async () => {
    await useProfile.getState().unload({ discard: true })
    await freshDb()
  })

  it('reads all daily rows and the last four weeks of answers for one profile', async () => {
    const p = await createProfile({ name: 'Ada', grade: 1 })
    const other = await createProfile({ name: 'Bo', grade: 0 })
    const mine = [...answers('addTo10', TODAY, 4), ...answers('addTo10', ago(10), 3), ...answers('addTo10', ago(40), 5)].map((a) => ({ ...a, profileId: p.id }))
    const theirs = answers('count10', TODAY, 6).map((a) => ({ ...a, profileId: other.id }))
    const db = getDb()
    await db.answers.bulkAdd([...mine, ...theirs])
    await db.daily.bulkPut([...dailyFrom(mine).map((d) => ({ ...d, profileId: p.id })), ...dailyFrom(theirs).map((d) => ({ ...d, profileId: other.id }))])

    const s = await loadSource(p.id, { now: NOW })
    expect(s.today).toBe(TODAY)
    expect(s.daily.map((d) => d.day)).toEqual([ago(40), ago(10), TODAY])
    expect(s.answers).toHaveLength(7)
    expect(s.answers.every((a) => a.profileId === p.id && a.ts >= NOW - ANSWER_DAYS * 86_400_000)).toBe(true)

    const { dashboard } = await loadDashboard(p, { now: NOW })
    expect(dashboard.name).toBe('Ada')
    expect(dashboard.overview.answers).toBe(7)
    expect(dashboard.overview.total.answers).toBe(12)
    expect(dashboard.domains.find((c) => c.domain === 'addsub')!.answers).toBe(7)
  })

  it('builds the key index from the registered skills, with families', () => {
    const index = keyIndexOf(skillRegistry())
    expect(index.addTo10?.length).toBe(66)
    expect(new Set(index.addTo10?.map((r) => r.family))).toEqual(new Set(['small', 'big']))
    expect(index.order20?.map((r) => r.key)).toEqual(['order20/after', 'order20/before', 'order20/between', 'order20/bigger'])
    expect(keyIndexOf(skillRegistry())).toBe(index)
  })

  it('works for a profile with nothing stored yet', async () => {
    const p = await createProfile({ name: '', grade: 0 })
    const { dashboard } = await loadDashboard(p, { now: NOW })
    expect(dashboard.overview.answers).toBe(0)
    expect(dashboard.estimate.text).toBe('Vi ved endnu for lidt')
  })
})
