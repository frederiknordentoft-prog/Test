// worker_threads entry: runs one simulator job per message and posts the result back.
import { parentPort } from 'node:worker_threads';
import { runJob, type Job } from './core.ts';

function transferables(v: unknown, out: ArrayBuffer[] = []): ArrayBuffer[] {
  if (v && typeof v === 'object') {
    if (ArrayBuffer.isView(v)) {
      const b = (v as ArrayBufferView).buffer;
      if (b instanceof ArrayBuffer && !out.includes(b)) out.push(b);
    } else for (const k of Object.keys(v as object)) transferables((v as Record<string, unknown>)[k], out);
  }
  return out;
}

parentPort!.on('message', (msg: { id: number; job: Job }) => {
  try {
    const res = runJob(msg.job);
    parentPort!.postMessage({ id: msg.id, res }, transferables(res));
  } catch (e) {
    parentPort!.postMessage({ id: msg.id, err: String((e as Error)?.stack ?? e) });
  }
});
