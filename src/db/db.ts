import Dexie, { type Table } from 'dexie'
import type { PlacedPiece } from '../types'
import type { View } from '../store/gameStore'

// Single-table persistence, exactly as specified: one `gameProgress` row holds
// the current level id, the in-progress placements, and the completed levels.
// A fixed primary key means we always upsert the same singleton row.

export type ProgressRow = {
  id: string
  view: View
  currentLevelId: string
  placements: PlacedPiece[]
  completedLevels: string[]
}

class KuglebanenDB extends Dexie {
  gameProgress!: Table<ProgressRow, string>

  constructor() {
    super('kuglebanen')
    this.version(1).stores({ gameProgress: 'id' })
  }
}

export const db = new KuglebanenDB()
export const PROGRESS_KEY = 'current'

export async function loadProgress(): Promise<ProgressRow | undefined> {
  return db.gameProgress.get(PROGRESS_KEY)
}

export async function saveProgress(row: Omit<ProgressRow, 'id'>): Promise<void> {
  await db.gameProgress.put({ id: PROGRESS_KEY, ...row })
}
