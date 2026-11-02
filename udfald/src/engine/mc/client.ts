/**
 * Where Monte Carlo runs: a worker from the page's own file, else an inlined classic blob worker
 * (the only kind that runs in an opaque-origin sandbox), else the main thread in 4 ms slices.
 * At most one request is in flight; newer requests replace a queued one.
 */
import McInline from './mc.worker.ts?worker&inline';
import { runMc, type McRequest, type McResult } from './paths';

export type McMode = 'worker (fil)' | 'worker (blob)' | 'hovedtråd' | '…';

function ping(w: Worker): Promise<boolean> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 1500);
    w.onmessage = (e) => {
      if (e.data?.type === 'pong') {
        clearTimeout(t);
        resolve(true);
      }
    };
    w.onerror = () => {
      clearTimeout(t);
      resolve(false);
    };
    try {
      w.postMessage({ type: 'ping' });
    } catch {
      clearTimeout(t);
      resolve(false);
    }
  });
}

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

export class McClient {
  mode: McMode = '…';
  lastMs = 0;
  private w: Worker | null = null;
  private disposed = false;
  private busy = false;
  private queued: { req: McRequest; resolve: (r: McResult | null) => void } | null = null;
  private current: ((r: McResult | null) => void) | null = null;
  private ready: Promise<McMode>;

  constructor(prefer: 'auto' | 'main' = 'auto') {
    this.ready = prefer === 'main' ? Promise.resolve((this.mode = 'hovedtråd')) : this.init();
  }

  private async init(): Promise<McMode> {
    const candidates: [McMode, () => Worker][] = [
      ['worker (fil)', () => new Worker(new URL('./mc.worker.ts', import.meta.url))],
      ['worker (blob)', () => new McInline()],
    ];
    for (const [mode, make] of candidates) {
      let w: Worker | null = null;
      try {
        w = make();
      } catch {
        continue;
      }
      const ok = await ping(w);
      if (this.disposed) {
        w.terminate();
        return this.mode;
      }
      if (ok) {
        this.w = w;
        this.mode = mode;
        w.onmessage = (e) => this.onMessage(e);
        w.onerror = () => this.finish(null);
        return mode;
      }
      w.terminate();
    }
    this.mode = 'hovedtråd';
    return this.mode;
  }

  private onMessage(e: MessageEvent): void {
    if (e.data?.type === 'mc') {
      this.lastMs = e.data.res.ms;
      this.finish(e.data.res as McResult);
    } else if (e.data?.type === 'error') this.finish(null);
  }

  private finish(r: McResult | null): void {
    const cb = this.current;
    this.current = null;
    this.busy = false;
    cb?.(r);
    const q = this.queued;
    this.queued = null;
    if (q) this.dispatch(q.req, q.resolve);
  }

  /** Resolves with the result, or null if the request was superseded or failed. */
  async run(req: McRequest): Promise<McResult | null> {
    await this.ready;
    if (this.disposed) return null;
    return new Promise((resolve) => {
      if (this.busy) {
        this.queued?.resolve(null);
        this.queued = { req, resolve };
        return;
      }
      this.dispatch(req, resolve);
    });
  }

  private dispatch(req: McRequest, resolve: (r: McResult | null) => void): void {
    this.busy = true;
    this.current = resolve;
    if (this.w) {
      this.w.postMessage({ type: 'mc', req });
      return;
    }
    void runMc(req, nextFrame)
      .then((r) => {
        this.lastMs = r.ms;
        this.finish(r);
      })
      .catch(() => this.finish(null));
  }

  dispose(): void {
    this.disposed = true;
    this.w?.terminate();
    this.w = null;
    this.queued?.resolve(null);
    this.queued = null;
  }
}
