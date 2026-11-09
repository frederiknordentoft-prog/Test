/** Minimal typed emitter. */
export class Emitter<T> {
  private listeners = new Set<(e: T) => void>();
  on(fn: (e: T) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(e: T): void {
    for (const fn of this.listeners) fn(e);
  }
  clear(): void {
    this.listeners.clear();
  }
}
