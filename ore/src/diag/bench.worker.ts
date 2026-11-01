/// <reference lib="webworker" />
import { DERBY, simulateOutcomes, STEP } from '../lookdev/model';

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as { type: string; t?: number; n?: number; now?: number };
  if (msg.type === 'ping') {
    (self as DedicatedWorkerGlobalScope).postMessage({ type: 'pong', t: msg.t });
    return;
  }
  if (msg.type === 'mc') {
    const t0 = performance.now();
    const out = simulateOutcomes(DERBY, Math.round((msg.now ?? 27) / STEP), 0, msg.n ?? 5000);
    const ms = performance.now() - t0;
    const counts = [0, 0, 0];
    for (const o of out) counts[o]++;
    (self as DedicatedWorkerGlobalScope).postMessage({ type: 'mc', ms, counts });
  }
};
