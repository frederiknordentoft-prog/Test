import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, it, expect } from 'vitest'

// Dexie schema v2 migration proof: the game is live, so hydrating a database
// that contains a v1 `gameProgress` row must never throw. Progress resets by
// design (new star economy); the ball preference carries over.

describe('Dexie v1 → v2 migration', () => {
  it('migrates a v1 row without throwing and carries the ball preference', async () => {
    // 1) Create a database exactly as Kuglebanen v1 did, with a v1-shaped row.
    const v1 = new Dexie('kuglebanen')
    v1.version(1).stores({ gameProgress: 'id' })
    await v1.open()
    await v1.table('gameProgress').put({
      id: 'current',
      view: 'game',
      currentLevelId: 'l4', // a v1 level id that no longer exists
      placements: [{ slotId: 'a', type: 'spinner', rotation: 5 }], // v1 piece type!
      ballType: 'basketball',
      completedLevels: ['l1', 'l2', 'l3'],
    })
    v1.close()

    // 2) Open through the real app database (schema v2 + upgrade path).
    const { db, loadProgress } = await import('./db')
    const row = await loadProgress()

    expect(row).toBeTruthy()
    expect(row!.ballType).toBe('basketball') // preference kept
    expect(row!.starsByLevel).toEqual({}) // progress reset by design
    expect(row!.placements).toEqual([])
    expect(row!.view).toBe('levelSelect')
    expect(row!.tutorialSeen).toBe(false)
    expect(row!.muted).toBe(false)
    expect('completedLevels' in row!).toBe(false)
    db.close()
  })
})
