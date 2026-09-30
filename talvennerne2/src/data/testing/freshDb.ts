// Test support: start every test on an empty `talvennerne2` database. Never imported by the app.
import { closeDb, getDb } from '../db'

export async function freshDb(): Promise<void> {
  await getDb().delete()
  closeDb()
}

export interface WriteTransactionWatch {
  /** Store names (sorted) of every read-write transaction opened while recording. */
  log: string[][]
  start(): void
  stop(): void
}

let watch: WriteTransactionWatch | null = null

/**
 * Count the read-write IndexedDB transactions the code opens, at the IDBDatabase level below Dexie.
 * Dexie binds IDBDatabase.transaction when it opens a database, so call this before the first
 * getDb() of the test file (freshDb() in beforeEach then reopens with the counter in place).
 */
export function watchWriteTransactions(): WriteTransactionWatch {
  if (watch) return watch
  const proto = (globalThis as { IDBDatabase?: { prototype: IDBDatabase } }).IDBDatabase!.prototype
  const original = proto.transaction
  let recording = false
  const w: WriteTransactionWatch = {
    log: [],
    start() {
      w.log.length = 0
      recording = true
    },
    stop() {
      recording = false
    },
  }
  proto.transaction = function (this: IDBDatabase, stores: string | string[], mode?: IDBTransactionMode, options?: IDBTransactionOptions) {
    if (recording && mode === 'readwrite') w.log.push((Array.isArray(stores) ? [...stores] : [stores]).sort())
    return original.call(this, stores, mode, options)
  } as typeof original
  watch = w
  return w
}
