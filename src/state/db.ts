import Dexie, { type EntityTable } from 'dexie'
import { emptyProgress, type Progress } from '../game/scoring'

type ProgressRow = {
  id: string
  data: Progress
}

const db = new Dexie('vaegtskaalen') as Dexie & {
  progress: EntityTable<ProgressRow, 'id'>
}

db.version(1).stores({
  progress: 'id',
})

export async function loadProgress(): Promise<Progress> {
  try {
    const row = await db.progress.get('progress')
    if (row?.data) {
      // Flet med tom struktur så nye modes ikke vælter gamle gemmer
      const empty = emptyProgress()
      return {
        streak: row.data.streak ?? 0,
        perMode: { ...empty.perMode, ...row.data.perMode },
      }
    }
  } catch {
    // IndexedDB utilgængelig (privat browsing m.m.) → frisk start
  }
  return emptyProgress()
}

export async function saveProgress(data: Progress): Promise<void> {
  try {
    await db.progress.put({ id: 'progress', data })
  } catch {
    // Persistens er best-effort
  }
}
