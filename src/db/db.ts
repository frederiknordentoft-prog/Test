import Dexie, { type Table } from 'dexie'
import type { BallType, PlacedPiece, Stars } from '../types'
import type { View } from '../store/gameStore'
import { BALL_TYPES } from '../physics/constants'

// Single-table persistence: one `gameProgress` row holds the current level id,
// the in-progress placements, the chosen ball, the star ledger and the
// preferences. A fixed primary key means we always upsert the same row.
//
// Schema v2 (Kuglebanen 2.0): the game is live with real users, so the v1→v2
// upgrade must NEVER throw on a v1 row. v1 progress (completedLevels — a
// different economy) intentionally resets; the ball preference carries over.

export type ProgressRow = {
  id: string
  view: View
  currentLevelId: string
  placements: PlacedPiece[]
  ballType: BallType
  muted: boolean
  tutorialSeen: boolean
  starsByLevel: Record<string, Stars>
}

type LegacyRow = Partial<ProgressRow> & { completedLevels?: string[] }

class KuglebanenDB extends Dexie {
  gameProgress!: Table<ProgressRow, string>

  constructor() {
    super('kuglebanen')
    this.version(1).stores({ gameProgress: 'id' })
    this.version(2)
      .stores({ gameProgress: 'id' })
      .upgrade((tx) =>
        tx
          .table('gameProgress')
          .toCollection()
          .modify((row: LegacyRow) => {
            // Defensive per-field defaults — a malformed v1 row must migrate,
            // not throw.
            row.view = 'levelSelect'
            row.currentLevelId = ''
            row.placements = []
            if (!row.ballType || !BALL_TYPES.includes(row.ballType)) row.ballType = 'iron'
            row.muted = typeof row.muted === 'boolean' ? row.muted : false
            row.tutorialSeen = false
            row.starsByLevel = {}
            delete row.completedLevels
          }),
      )
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
