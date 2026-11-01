/**
 * Where fan frames are computed: a worker from the page's own file, else an inlined classic
 * blob worker, else the main thread. Each candidate must answer a ping within 1.5 s.
 */
import FrameInline from './frame.worker.ts?worker&inline';
import { buildTable, computeFrame, DERBY, SCENARIOS, type FanFrame, type Table } from './model';

export type Mode = 'worker (fil)' | 'worker (blob)' | 'hovedtråd';

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
    w.postMessage({ type: 'ping' });
  });
}

export class FrameClient {
  mode: Mode = 'hovedtråd';
  lastMs = 0;
  private w: Worker | null = null;
  private seq = 0;
  private waiting = new Map<number, (f: FanFrame) => void>();
  private tab: Table | null = null;

  async init(): Promise<Mode> {
    const candidates: [Mode, () => Worker][] = [
      ['worker (fil)', () => new Worker(new URL('./frame.worker.ts', import.meta.url))],
      ['worker (blob)', () => new FrameInline()],
    ];
    for (const [mode, make] of candidates) {
      let w: Worker | null = null;
      try {
        w = make();
      } catch {
        continue;
      }
      if (await ping(w)) {
        this.w = w;
        this.mode = mode;
        w.onmessage = (e) => {
          if (e.data?.type !== 'frame') return;
          this.lastMs = e.data.ms;
          this.waiting.get(e.data.id)?.(e.data.frame as FanFrame);
          this.waiting.delete(e.data.id);
        };
        return mode;
      }
      w.terminate();
    }
    this.mode = 'hovedtråd';
    return this.mode;
  }

  compute(scId: string, now: number): Promise<FanFrame> {
    if (this.w) {
      const id = ++this.seq;
      return new Promise((resolve) => {
        this.waiting.set(id, resolve);
        this.w?.postMessage({ type: 'frame', id, scId, now });
      });
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        this.tab ??= buildTable(DERBY);
        const t0 = performance.now();
        const sc = SCENARIOS.find((s) => s.id === scId) ?? SCENARIOS[0];
        const f = computeFrame(DERBY, this.tab, sc, now);
        this.lastMs = performance.now() - t0;
        resolve(f);
      }, 0);
    });
  }

  dispose(): void {
    this.w?.terminate();
    this.w = null;
  }
}
