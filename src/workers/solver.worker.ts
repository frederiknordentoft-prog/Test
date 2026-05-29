// ============================================================
// Web worker: keeps solver work (deal generation, solving,
// hints, benchmarks) off the main thread so the UI never freezes.
// ============================================================

import { GameState, Move } from '../engine/types';
import { solve, hint } from '../solver/solver';
import { generateSolvableDeal, generateAnyDeal, dealFromSeed } from '../solver/dealgen';

export type WorkerRequest =
  | { id: number; kind: 'generate'; solvableOnly: boolean; nodeBudget: number }
  | { id: number; kind: 'solve'; state: GameState; nodeBudget: number }
  | { id: number; kind: 'hint'; state: GameState; nodeBudget: number }
  | { id: number; kind: 'dealSeed'; seed: number };

export type WorkerResponse =
  | { id: number; kind: 'generate'; deal: ReturnType<typeof dealFromSeed> | undefined }
  | {
      id: number;
      kind: 'solve';
      status: 'solvable' | 'unsolvable' | 'unknown';
      minRounds?: number;
      minRoundsProven: boolean;
      nodesVisited: number;
    }
  | { id: number; kind: 'hint'; move?: Move }
  | { id: number; kind: 'dealSeed'; deal: ReturnType<typeof dealFromSeed> };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  switch (msg.kind) {
    case 'generate': {
      const d = msg.solvableOnly
        ? generateSolvableDeal(msg.nodeBudget)
        : generateAnyDeal(msg.nodeBudget);
      const res: WorkerResponse = { id: msg.id, kind: 'generate', deal: d };
      (self as unknown as Worker).postMessage(res);
      break;
    }
    case 'solve': {
      const r = solve(msg.state, msg.nodeBudget);
      const res: WorkerResponse = {
        id: msg.id,
        kind: 'solve',
        status: r.status,
        minRounds: r.minRounds,
        minRoundsProven: r.minRoundsProven,
        nodesVisited: r.nodesVisited,
      };
      (self as unknown as Worker).postMessage(res);
      break;
    }
    case 'hint': {
      const m = hint(msg.state, msg.nodeBudget);
      const res: WorkerResponse = { id: msg.id, kind: 'hint', move: m };
      (self as unknown as Worker).postMessage(res);
      break;
    }
    case 'dealSeed': {
      const res: WorkerResponse = { id: msg.id, kind: 'dealSeed', deal: dealFromSeed(msg.seed) };
      (self as unknown as Worker).postMessage(res);
      break;
    }
  }
};
