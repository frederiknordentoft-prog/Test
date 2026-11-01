/// <reference lib="webworker" />
/** Monte Carlo worker (classic iife build; see vite.config.ts). */
import { runMc, type McRequest } from './paths';

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (e: MessageEvent) => {
  const m = e.data as { type: 'ping' } | { type: 'mc'; req: McRequest };
  if (m.type === 'ping') {
    scope.postMessage({ type: 'pong' });
    return;
  }
  try {
    const res = await runMc(m.req);
    const transfer: Transferable[] = [res.tPts.buffer];
    for (const s of res.strands) transfer.push(s.v.buffer, s.d.buffer);
    scope.postMessage({ type: 'mc', res }, transfer);
  } catch (err) {
    scope.postMessage({ type: 'error', id: m.req.id, message: (err as Error).message });
  }
};
