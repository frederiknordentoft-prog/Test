// Test support: start every test on an empty `talvennerne2` database. Never imported by the app.
import { closeDb, getDb } from '../db'

export async function freshDb(): Promise<void> {
  await getDb().delete()
  closeDb()
}

/**
 * Count the read-write IndexedDB transactions the code opens (at the IDBDatabase level, below Dexie).
 * Returns the log and a restore function.
 */
export function countWriteTransactions(): { log: string[][]; restore: () => void } {
  const proto = (globalThis as { IDBDatabase?: { prototype: IDBDatabase } }).IDBDatabase!.prototype
  const original = proto.transaction
  const log: string[][] = []
  proto.transaction = function (this: IDBDatabase, stores: string | string[], mode?: IDBTransactionMode, options?: IDBTransactionOptions) {
    if (mode === 'readwrite') log.push((Array.isArray(stores) ? [...stores] : [stores]).sort())
    return original.call(this, stores, mode, options)
  } as typeof original
  return {
    log,
    restore: () => {
      proto.transaction = original
    },
  }
}
