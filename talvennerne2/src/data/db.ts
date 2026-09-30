// The one IndexedDB database of Talvennerne 2 (SPEC §9.2). The app shares its origin with about ten
// other apps on GitHub Pages, so this module is the only place that names a database, and it only
// ever names `talvennerne2`. Nothing here deletes, lists or opens anything else.
import Dexie, { type EntityTable, type Table } from 'dexie'
import type { AnswerLogEntry, DailyAggregate, ProfileDoc, ProfileId } from '../engine/types'

export const DB_NAME = 'talvennerne2'

/** Schema v1 — exactly SPEC §9.2. A later schema adds `version(2)` with an upgrade, never edits this. */
export const DB_SCHEMA_V1 = {
  profiles: 'id', // ProfileDoc (~150 KB)
  answers: '++seq, [profileId+ts], [profileId+skill+ts]', // AnswerLogEntry
  daily: '[profileId+day], profileId', // DailyAggregate
  meta: 'key', // lastPrune, schema
} as const

/** Rows in `meta`. Keys in use: 'schema' and 'lastPrune'. */
export interface MetaRow {
  key: string
  value: unknown
}

export type TalvennerneDb = Dexie & {
  profiles: EntityTable<ProfileDoc, 'id'>
  answers: EntityTable<AnswerLogEntry, 'seq'>
  daily: Table<DailyAggregate, [ProfileId, string]>
  meta: EntityTable<MetaRow, 'key'>
}

let instance: TalvennerneDb | null = null

/**
 * The database, created on first use. Dexie opens it lazily on the first query, so importing this
 * module never touches storage (a blocked or private-mode store only fails the calls that need it).
 */
export function getDb(): TalvennerneDb {
  if (instance) return instance
  // Pick up whatever IndexedDB the environment has at first use (tests install fake-indexeddb).
  const g = globalThis as { indexedDB?: IDBFactory; IDBKeyRange?: typeof IDBKeyRange }
  const db = new Dexie(DB_NAME, {
    ...(g.indexedDB ? { indexedDB: g.indexedDB } : {}),
    ...(g.IDBKeyRange ? { IDBKeyRange: g.IDBKeyRange } : {}),
  }) as TalvennerneDb
  db.version(1).stores(DB_SCHEMA_V1)
  db.on('populate', (tx) => {
    void tx.table('meta').add({ key: 'schema', value: { v: 1, createdAt: Date.now() } })
  })
  instance = db
  return db
}

/** Close the connection (tests simulate a reload with it; the next getDb() opens a fresh one). */
export function closeDb(): void {
  instance?.close()
  instance = null
}

// Explicit bounds for compound-index ranges. IndexedDB orders number < string, so these hold for
// both `ts` (number) and `day` ('YYYY-MM-DD') without relying on Dexie's environment-dependent maxKey.
export const TS_MIN = -Infinity
export const TS_MAX = Infinity
export const DAY_MIN = ''
export const DAY_MAX = '￿'
