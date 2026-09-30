// Test support: an in-memory Web Storage, and one that throws like Safari's private mode. Never
// imported by the app.

export class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length(): number {
    return this.data.size
  }

  clear(): void {
    this.data = new Map()
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value))
  }

  /** Every key and value, for byte-for-byte comparisons. */
  dump(): Record<string, string> {
    return Object.fromEntries(this.data)
  }
}

/** Reads fail and writes throw QuotaExceededError, like a blocked or full store. */
export class ThrowingStorage extends MemoryStorage {
  getItem(): string | null {
    throw new Error('SecurityError')
  }

  setItem(): void {
    const err = new Error('QuotaExceededError')
    err.name = 'QuotaExceededError'
    throw err
  }

  removeItem(): void {
    throw new Error('SecurityError')
  }
}

type StorageKind = 'localStorage' | 'sessionStorage'

/** Install a storage on globalThis (Node has none); returns a restore function. */
export function installStorage(kind: StorageKind, storage: Storage | 'getter-throws' | null): () => void {
  const g = globalThis as Record<string, unknown>
  const had = Object.getOwnPropertyDescriptor(g, kind)
  if (storage === 'getter-throws') {
    Object.defineProperty(g, kind, {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
  } else {
    Object.defineProperty(g, kind, { configurable: true, writable: true, value: storage })
  }
  return () => {
    if (had) Object.defineProperty(g, kind, had)
    else delete g[kind]
  }
}
