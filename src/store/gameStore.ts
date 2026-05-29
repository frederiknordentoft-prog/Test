// ============================================================
// Central game store (Zustand). Owns the live game state, undo
// stack, balance, session stats, jackpot, and the deal pool.
// ============================================================

import { create } from 'zustand';
import { Deal, GameState, Move, suitOf, rankOf } from '../engine/types';
import { applyMove, isWin, legalMoves, foundationCount } from '../engine/klondike';
import { computePayout } from '../economy/paytable';
import { progressPayout } from '../economy/progress';
import {
  JackpotState,
  loadJackpot,
  saveJackpot,
  processJackpot,
  resetJackpot,
} from '../economy/jackpot';
import {
  SessionStats,
  emptyStats,
  recordGame,
} from '../economy/stats';
import { DealPool, solverClient } from '../workers/solverClient';
import { useConfig, activePaytable } from './configStore';

export type Source =
  | { kind: 'waste' }
  | { kind: 'tableau'; col: number; idx: number }
  | { kind: 'foundation'; suit: number };

export type Target = { kind: 'foundation'; suit: number } | { kind: 'tableau'; col: number };

export type Status = 'idle' | 'playing' | 'won' | 'lost';

export interface LastResult {
  solved: boolean;
  rounds: number;
  minRounds?: number;
  minRoundsProven?: boolean;
  payout: number;
  roundPayout: number;
  progressPayout: number;
  foundationFraction: number;
  jackpotWon: number;
  jackpotHit: boolean;
}

interface GameStore {
  balance: number;
  deal: Deal | null;
  state: GameState | null;
  undoStack: GameState[];
  selected: Source | null;
  hintMove: Move | null;
  status: Status;
  lastResult: LastResult | null;
  stats: SessionStats;
  jackpot: JackpotState;
  poolSize: number;
  generating: boolean;

  init: () => void;
  newGame: () => Promise<void>;
  draw: () => void;
  clickSource: (src: Source) => void;
  clickTarget: (tgt: Target) => void;
  autoFoundation: (src: Source) => void;
  clearSelection: () => void;
  undo: () => void;
  giveUp: () => void;
  requestHint: () => Promise<void>;
  clearResult: () => void;
  resetSession: () => void;
  resetJackpotPool: () => void;
  resetPool: () => void;
  addFunds: (amount: number) => void;
}

const BALANCE_KEY = 'kabale.balance.v1';
const DEFAULT_BALANCE = 1000;

function loadBalance(): number {
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    if (raw != null) return JSON.parse(raw) as number;
  } catch {
    /* ignore */
  }
  return DEFAULT_BALANCE;
}
function saveBalance(b: number) {
  try {
    localStorage.setItem(BALANCE_KEY, JSON.stringify(b));
  } catch {
    /* ignore */
  }
}

let pool: DealPool | null = null;

/** Find the legal Move that matches a source -> target intent, or null. */
function findMatchingMove(state: GameState, src: Source, tgt: Target): Move | null {
  const moves = legalMoves(state);
  if (src.kind === 'waste') {
    if (tgt.kind === 'foundation') return moves.find((m) => m.type === 'wf') ?? null;
    return moves.find((m) => m.type === 'wt' && m.to === tgt.col) ?? null;
  }
  if (src.kind === 'foundation') {
    if (tgt.kind === 'tableau')
      return moves.find((m) => m.type === 'ft' && m.suit === src.suit && m.to === tgt.col) ?? null;
    return null;
  }
  // tableau source
  const up = state.tableau[src.col].up;
  const count = up.length - src.idx;
  if (tgt.kind === 'foundation') {
    if (count !== 1) return null; // only the single top card can go to foundation
    return moves.find((m) => m.type === 'tf' && m.from === src.col) ?? null;
  }
  return (
    moves.find((m) => m.type === 'tt' && m.from === src.col && m.to === tgt.col && m.count === count) ??
    null
  );
}

export const useGame = create<GameStore>((set, get) => {
  // --- internal helpers ---

  const ensurePool = () => {
    if (!pool) {
      pool = new DealPool(
        () => useConfig.getState().poolTarget as number,
        () => useConfig.getState().solvableOnly,
        () => useConfig.getState().genNodeBudget,
        (size) => set({ poolSize: size }),
      );
      void pool.fill();
    }
    return pool;
  };

  const commit = (next: GameState) => {
    const prev = get().state;
    const stack = prev ? [...get().undoStack, prev] : get().undoStack;
    set({ state: next, undoStack: stack, hintMove: null, selected: null });
    if (isWin(next)) finalize(true, next);
  };

  const finalize = (solved: boolean, finalState: GameState) => {
    const cfg = useConfig.getState();
    const deal = get().deal;
    const rounds = finalState.rounds;
    const foundationFraction = foundationCount(finalState) / 52;

    // Solved -> round paytable. Unsolved -> threshold progress payout.
    const roundPayout = solved ? computePayout(activePaytable(cfg), cfg.stake, true, rounds) : 0;
    const progressPay = solved ? 0 : progressPayout(foundationFraction, cfg.stake, cfg);
    const payout = roundPayout + progressPay;

    // Jackpot: every finished game is a "paid game" (stake already deducted).
    const jp = processJackpot(get().jackpot, cfg.jackpot, cfg.stake, solved, Math.random());
    saveJackpot(jp.state);

    const result: LastResult = {
      solved,
      rounds,
      minRounds: deal?.minRounds,
      minRoundsProven: deal?.minRoundsProven,
      payout,
      roundPayout,
      progressPayout: progressPay,
      foundationFraction,
      jackpotWon: jp.amountWon,
      jackpotHit: jp.hit,
    };

    const stats = recordGame(get().stats, {
      stake: cfg.stake,
      solved,
      rounds,
      payout,
      roundPayout,
      progressPayout: progressPay,
      minRounds: deal?.minRounds,
      minRoundsProven: deal?.minRoundsProven,
      dealStatus: deal?.status,
    });

    const balance = get().balance + payout + jp.amountWon;
    saveBalance(balance);

    set({
      status: solved ? 'won' : 'lost',
      lastResult: result,
      stats,
      jackpot: jp.state,
      balance,
      selected: null,
      hintMove: null,
    });
  };

  return {
    balance: loadBalance(),
    deal: null,
    state: null,
    undoStack: [],
    selected: null,
    hintMove: null,
    status: 'idle',
    lastResult: null,
    stats: emptyStats(),
    jackpot: loadJackpot(useConfig.getState().jackpot),
    poolSize: 0,
    generating: false,

    init() {
      ensurePool();
    },

    async newGame() {
      const cfg = useConfig.getState();
      if (get().balance < cfg.stake) return; // not enough funds
      set({ generating: true, status: 'idle', lastResult: null, selected: null, hintMove: null });
      const p = ensurePool();
      const deal = await p.take();
      // Charge the stake now.
      const balance = get().balance - cfg.stake;
      saveBalance(balance);
      set({
        deal,
        state: deal.state,
        undoStack: [],
        status: 'playing',
        generating: false,
        balance,
      });
      // If the deal isn't classified / benchmarked yet (e.g. an instant
      // cold-start deal), classify + benchmark it in the background so the
      // skill-gap and classification stats can be shown.
      if (deal.status == null || deal.minRounds == null) {
        void solverClient.solve(deal.state, cfg.benchNodeBudget).then((r) => {
          if (get().deal === deal) {
            set({
              deal: {
                ...deal,
                status: r.status,
                minRounds: r.status === 'solvable' ? r.minRounds : undefined,
                minRoundsProven: r.minRoundsProven,
              },
            });
          }
        });
      }
    },

    draw() {
      const s = get().state;
      if (!s || get().status !== 'playing') return;
      const cfg = useConfig.getState();
      if (s.stock.length > 0) {
        commit(applyMove(s, { type: 'draw' }));
      } else if (s.waste.length > 0) {
        // Recycling consumes a round; enforce max-rounds as a bust.
        if (cfg.maxRounds > 0 && s.rounds + 1 > cfg.maxRounds) {
          finalize(false, s);
          return;
        }
        commit(applyMove(s, { type: 'recycle' }));
      }
    },

    clickSource(src) {
      const s = get().state;
      if (!s || get().status !== 'playing') return;
      const cur = get().selected;
      // Clicking the already-selected source clears it.
      if (cur && JSON.stringify(cur) === JSON.stringify(src)) {
        set({ selected: null });
        return;
      }
      // If a source is already selected and the new click is a tableau column,
      // treat it as a move target instead.
      if (cur && src.kind === 'tableau') {
        const move = findMatchingMove(s, cur, { kind: 'tableau', col: src.col });
        if (move) {
          commit(applyMove(s, move));
          return;
        }
      }
      set({ selected: src, hintMove: null });
    },

    clickTarget(tgt) {
      const s = get().state;
      if (!s || get().status !== 'playing') return;
      const src = get().selected;
      if (!src) return;
      const move = findMatchingMove(s, src, tgt);
      if (move) commit(applyMove(s, move));
      else set({ selected: null });
    },

    autoFoundation(src) {
      const s = get().state;
      if (!s || get().status !== 'playing') return;
      const move = findMatchingMove(s, src, { kind: 'foundation', suit: 0 });
      // findMatchingMove ignores the suit for wf/tf, so it finds the correct one.
      if (move) commit(applyMove(s, move));
    },

    clearSelection() {
      set({ selected: null });
    },

    undo() {
      if (get().status !== 'playing') return;
      const stack = get().undoStack;
      if (stack.length === 0) return;
      const cfg = useConfig.getState();
      const prev = { ...stack[stack.length - 1] };
      if (cfg.undoPenalty) prev.rounds += 1; // undo costs a penalty round
      set({
        state: prev,
        undoStack: stack.slice(0, -1),
        selected: null,
        hintMove: null,
      });
    },

    giveUp() {
      const s = get().state;
      if (!s || get().status !== 'playing') return;
      finalize(false, s);
    },

    async requestHint() {
      const s = get().state;
      if (!s || get().status !== 'playing') return;
      const cfg = useConfig.getState();
      const move = await solverClient.hint(s, cfg.hintNodeBudget);
      if (move && get().status === 'playing') set({ hintMove: move });
    },

    clearResult() {
      set({ lastResult: null });
    },

    resetSession() {
      set({ stats: emptyStats(), balance: DEFAULT_BALANCE });
      saveBalance(DEFAULT_BALANCE);
    },

    resetJackpotPool() {
      const cfg = useConfig.getState();
      const jp = resetJackpot(cfg.jackpot);
      saveJackpot(jp);
      set({ jackpot: jp });
    },

    resetPool() {
      ensurePool().reset();
    },

    addFunds(amount) {
      const balance = get().balance + amount;
      saveBalance(balance);
      set({ balance });
    },
  };
});

// Re-export tiny helpers used by components.
export { foundationCount, suitOf, rankOf };
