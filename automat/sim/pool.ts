// Tiny worker pool (≤ 2 workers — other agents share the 4-core box; NL_WORKERS=1 to go lower).
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import type { Job } from './core.ts';

export class Pool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: { job: Job; resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = [];
  private pending = new Map<Worker, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  private seq = 0;
  readonly size: number;

  constructor(size = Number(process.env.NL_WORKERS ?? 2)) {
    this.size = Math.max(1, Math.min(2, size, cpus().length - 1));
    for (let i = 0; i < this.size; i++) {
      const w = new Worker(new URL('./worker.ts', import.meta.url));
      w.on('message', (m: { id: number; res?: unknown; err?: string }) => {
        const p = this.pending.get(w);
        this.pending.delete(w);
        this.idle.push(w);
        if (p) {
          if (m.err) p.reject(new Error(m.err));
          else p.resolve(m.res);
        }
        this.pump();
      });
      w.on('error', (e) => {
        const p = this.pending.get(w);
        if (p) p.reject(e);
      });
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  run<T>(job: Job): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ job, resolve: resolve as (v: unknown) => void, reject });
      this.pump();
    });
  }

  /** Splits `count` items into `chunks` jobs built by `make(from, count, chunkIndex)`. */
  map<T>(count: number, chunks: number, make: (from: number, n: number, k: number) => Job): Promise<T[]> {
    const jobs: Promise<T>[] = [];
    const per = Math.ceil(count / chunks);
    for (let k = 0, from = 0; from < count; k++, from += per) jobs.push(this.run<T>(make(from, Math.min(per, count - from), k)));
    return Promise.all(jobs);
  }

  private pump(): void {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      const q = this.queue.shift()!;
      this.pending.set(w, { resolve: q.resolve, reject: q.reject });
      w.postMessage({ id: ++this.seq, job: q.job });
    }
  }

  async close(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}
