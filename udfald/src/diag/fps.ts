/** rAF sampler: frame interval p50/p95, estimated refresh rate, dropped frames, long tasks. */
import { setCheck } from './store';

const N = 240;
const dts = new Float32Array(N);
let n = 0;
let idx = 0;
let last = 0;
let longTasks = 0;

export interface FpsStats { p50: number; p95: number; hz: number; dropped: number }
let stats: FpsStats = { p50: 0, p95: 0, hz: 0, dropped: 0 };
export const getFps = (): FpsStats => stats;

export function startFpsSampler(): void {
  try {
    new PerformanceObserver((list) => {
      longTasks += list.getEntries().filter((e) => e.duration > 50).length;
    }).observe({ type: 'longtask', buffered: false });
  } catch {
    /* Safari has no longtask entries */
  }
  const loop = (t: number) => {
    if (last && document.visibilityState === 'visible') {
      dts[idx] = t - last;
      idx = (idx + 1) % N;
      n = Math.min(N, n + 1);
    }
    last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  setInterval(() => {
    if (n < 30) return;
    const a = Array.from(dts.subarray(0, n)).sort((x, y) => x - y);
    const p50 = a[Math.floor(n * 0.5)];
    const p95 = a[Math.floor(n * 0.95)];
    const hz = Math.round(1000 / p50);
    const dropped = a.filter((d) => d > p50 * 1.5).length / n;
    stats = { p50, p95, hz, dropped };
    setCheck('fps', {
      status: p95 <= 20 ? 'ok' : p95 <= 34 ? 'advarsel' : 'fejl',
      detail: `${hz} Hz · p95 ${p95.toFixed(1)} ms · tabte ${(dropped * 100).toFixed(1)} %${longTasks ? ` · long tasks ${longTasks}` : ''}`,
      data: { p50, p95, hz, dropped, longTasks },
    });
  }, 1000);
}
