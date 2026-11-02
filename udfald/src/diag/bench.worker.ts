/// <reference lib="webworker" />
import { runMc } from '../engine/mc/paths';
import { benchRequest } from './benchRequest';

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as { type: string; t?: number; n?: number; now?: number };
  const scope = self as unknown as DedicatedWorkerGlobalScope;
  if (msg.type === 'ping') {
    scope.postMessage({ type: 'pong', t: msg.t });
    return;
  }
  if (msg.type === 'mc') {
    const r = await runMc(benchRequest(msg.n ?? 5000, msg.now ?? 27));
    scope.postMessage({ type: 'mc', ms: r.ms, counts: r.counts });
  }
};

