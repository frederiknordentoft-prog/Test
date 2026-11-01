/**
 * Worker support inside the artifact iframe: a worker from the page's own file, and an inlined
 * blob worker. Each gets a round-trip ping and a 5,000-path Monte Carlo benchmark.
 * The main-thread benchmark is the fallback's cost.
 */
import BenchInline from './bench.worker.ts?worker&inline';
import { DERBY, simulateOutcomes, STEP } from '../lookdev/model';
import { setCheck } from './store';

function ask<T>(w: Worker, msg: object, type: string, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`intet svar på ${timeoutMs} ms`)), timeoutMs);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== type) return;
      clearTimeout(timer);
      w.removeEventListener('message', onMsg);
      resolve(e.data as T);
    };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', (e) => {
      clearTimeout(timer);
      reject(new Error(e.message || 'worker-fejl'));
    });
    w.postMessage(msg);
  });
}

async function probe(key: string, label: string, make: () => Worker): Promise<boolean> {
  setCheck(key, { status: 'afventer', detail: 'Tester …' });
  let w: Worker | null = null;
  try {
    w = make();
    const t0 = performance.now();
    await ask(w, { type: 'ping', t: t0 }, 'pong', 2000);
    const rtt = performance.now() - t0;
    const mc = await ask<{ ms: number }>(w, { type: 'mc', n: 5000, now: 27 }, 'mc', 8000);
    setCheck(key, { status: 'ok', detail: `${label}: virker · ping ${rtt.toFixed(1)} ms · MC 5.000 stier ${mc.ms.toFixed(0)} ms`, data: { rttMs: rtt, mcMs: mc.ms } });
    return true;
  } catch (err) {
    setCheck(key, { status: 'fejl', detail: `${label}: ${(err as Error).message}` });
    return false;
  } finally {
    w?.terminate();
  }
}

export async function checkWorkers(): Promise<void> {
  const file = await probe('worker-fil', 'Worker fra egen fil', () => new Worker(new URL('./bench.worker.ts', import.meta.url)));
  const blob = await probe('worker-blob', 'Worker som blob', () => new BenchInline());
  // Main-thread cost of the same Monte Carlo (the fallback path).
  const t0 = performance.now();
  simulateOutcomes(DERBY, Math.round(27 / STEP), 0, 5000);
  const ms = performance.now() - t0;
  setCheck('mc-main', {
    status: ms < 60 ? 'ok' : 'advarsel',
    detail: `MC i hovedtråd: ${ms.toFixed(0)} ms for 5.000 stier (skal time-slices ved > 4 ms/frame)`,
    data: { ms },
  });
  setCheck('worker-mode', {
    status: file || blob ? 'ok' : 'advarsel',
    detail: file ? 'Workere virker (egen fil)' : blob ? 'Kun blob-worker virker' : 'Ingen worker: hovedtråds-MC bliver produktionsvejen',
    data: { file, blob },
  });
}
