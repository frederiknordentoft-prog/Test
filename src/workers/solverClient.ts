// ============================================================
// Main-thread client for the solver worker. Manages request IDs,
// promises, and a background pool of pre-verified deals so that
// starting a game never blocks on solving.
// ============================================================

import { Deal, GameState, Move } from '../engine/types';
import { randomSeed } from '../engine/rng';
import type { WorkerRequest, WorkerResponse } from './solver.worker';

type Pending = (res: WorkerResponse) => void;

/** Distributive Omit so each union member keeps its own keys. */
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

class SolverClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor() {
    this.worker = new Worker(new URL('./solver.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const cb = this.pending.get(e.data.id);
      if (cb) {
        this.pending.delete(e.data.id);
        cb(e.data);
      }
    };
  }

  private send<T extends WorkerResponse>(req: DistributiveOmit<WorkerRequest, 'id'>): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve) => {
      this.pending.set(id, resolve as Pending);
      this.worker.postMessage({ ...req, id } as WorkerRequest);
    });
  }

  async generate(solvableOnly: boolean, nodeBudget: number, maxRounds: number): Promise<Deal | undefined> {
    const r = await this.send<Extract<WorkerResponse, { kind: 'generate' }>>({
      kind: 'generate',
      solvableOnly,
      nodeBudget,
      maxRounds,
    });
    return r.deal;
  }

  async solve(state: GameState, nodeBudget: number, maxRounds: number) {
    return this.send<Extract<WorkerResponse, { kind: 'solve' }>>({
      kind: 'solve',
      state,
      nodeBudget,
      maxRounds,
    });
  }

  async hint(state: GameState, nodeBudget: number, maxRounds: number): Promise<Move | undefined> {
    const r = await this.send<Extract<WorkerResponse, { kind: 'hint' }>>({
      kind: 'hint',
      state,
      nodeBudget,
      maxRounds,
    });
    return r.move;
  }

  async dealSeed(seed: number): Promise<Deal> {
    const r = await this.send<Extract<WorkerResponse, { kind: 'dealSeed' }>>({
      kind: 'dealSeed',
      seed,
    });
    return r.deal;
  }
}

export const solverClient = new SolverClient();

// ---------- background deal pool ----------

export class DealPool {
  private pool: Deal[] = [];
  private filling = false;

  constructor(
    private target: () => number,
    private solvableOnly: () => boolean,
    private nodeBudget: () => number,
    private maxRounds: () => number,
    private onChange?: (size: number) => void,
  ) {}

  size() {
    return this.pool.length;
  }

  /** Take a deal from the pool (or generate one on demand if empty). */
  async take(): Promise<Deal> {
    const d = this.pool.shift();
    this.onChange?.(this.pool.length);
    void this.fill(); // top up in the background
    if (d) return d;
    // Pool drained (cold start). In solvable-only mode we must verify; in mix
    // mode hand out an instant unclassified deal (the game store classifies it
    // in the background) so gameplay never blocks.
    if (this.solvableOnly()) {
      const fresh = await solverClient.generate(true, this.nodeBudget(), this.maxRounds());
      if (fresh) return fresh;
    }
    return solverClient.dealSeed(randomSeed());
  }

  /** Keep generating until the pool reaches its target size. */
  async fill(): Promise<void> {
    if (this.filling) return;
    this.filling = true;
    try {
      while (this.pool.length < this.target()) {
        const d = await solverClient.generate(this.solvableOnly(), this.nodeBudget(), this.maxRounds());
        if (d) {
          this.pool.push(d);
          this.onChange?.(this.pool.length);
        }
      }
    } finally {
      this.filling = false;
    }
  }

  /** Drop the current pool (e.g. when solvableOnly toggles) and refill. */
  reset() {
    this.pool = [];
    this.onChange?.(0);
    void this.fill();
  }
}
