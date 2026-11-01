/// <reference lib="webworker" />
/** Computes look-dev fan frames off the main thread (classic worker; see vite.config.ts). */
import { buildTable, computeFrame, DERBY, SCENARIOS } from './model';

const tab = buildTable(DERBY);
const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (e: MessageEvent) => {
  const m = e.data as { type: string; id?: number; scId?: string; now?: number };
  if (m.type === 'ping') {
    scope.postMessage({ type: 'pong' });
    return;
  }
  if (m.type === 'frame') {
    const sc = SCENARIOS.find((s) => s.id === m.scId) ?? SCENARIOS[0];
    const t0 = performance.now();
    const frame = computeFrame(DERBY, tab, sc, m.now);
    const ms = performance.now() - t0;
    const transfer: Transferable[] = [frame.history.buffer];
    for (const s of frame.strands) transfer.push(s.d.buffer, s.v.buffer);
    scope.postMessage({ type: 'frame', id: m.id, frame, ms }, transfer);
  }
};
