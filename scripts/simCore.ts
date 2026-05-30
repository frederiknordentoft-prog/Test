// ============================================================
// Shared per-deal simulation logic (used by simChunk workers).
// Measurement only — no game/economy logic is modified here.
// ============================================================

import { deal } from '../src/engine/klondike';
import { solve } from '../src/solver/solver';
import { playHeuristic, PlayerOpts } from '../src/solver/player';
import { DEFAULT_PAYTABLE_MIX, Paytable, payoutMultiplier, roundBucket } from '../src/economy/paytable';
import { DEFAULT_PROGRESS, progressMultiplier } from '../src/economy/progress';

export const PT: Paytable = DEFAULT_PAYTABLE_MIX;
export const PROG = DEFAULT_PROGRESS;

export const PLAYERS: Record<string, Omit<PlayerOpts, 'seed'>> = {
  expert: { errorRate: 0.03, foundationGreed: 0.05, maxRounds: 0 },
  good: { errorRate: 0.12, foundationGreed: 0.2, maxRounds: 0 },
  casual: { errorRate: 0.3, foundationGreed: 0.45, maxRounds: 0 },
};

const bucketKey = (n: number) => String(roundBucket(n));
export const emptyHist = (): Record<string, number> => ({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6plus': 0 });

export interface PlayerPartial {
  solved: number;
  gaveUp: number;
  roundPayoutSum: number;
  progressPayoutSum: number;
}

export interface MainPartial {
  count: number;
  cls: { solvable: number; unsolvable: number; unknown: number };
  provenHist: Record<string, number>;
  unprovenHist: Record<string, number>;
  provenSolvable: number;
  unprovenSolvable: number;
  allSolvable: number;
  ceilProvenPayoutSum: number;
  ceilNaivePayoutSum: number;
  players: Record<string, PlayerPartial>;
}

export function runMainChunk(startSeed: number, count: number, budget: number): MainPartial {
  const p: MainPartial = {
    count,
    cls: { solvable: 0, unsolvable: 0, unknown: 0 },
    provenHist: emptyHist(),
    unprovenHist: emptyHist(),
    provenSolvable: 0,
    unprovenSolvable: 0,
    allSolvable: 0,
    ceilProvenPayoutSum: 0,
    ceilNaivePayoutSum: 0,
    players: {},
  };
  for (const k of Object.keys(PLAYERS)) p.players[k] = { solved: 0, gaveUp: 0, roundPayoutSum: 0, progressPayoutSum: 0 };

  for (let seed = startSeed; seed < startSeed + count; seed++) {
    const g = deal(seed);
    const res = solve(g, budget);
    p.cls[res.status]++;

    if (res.status === 'solvable' && res.minRounds != null) {
      p.allSolvable++;
      p.ceilNaivePayoutSum += payoutMultiplier(PT, true, res.minRounds);
      if (res.minRoundsProven) {
        p.provenSolvable++;
        p.provenHist[bucketKey(res.minRounds)]++;
        p.ceilProvenPayoutSum += payoutMultiplier(PT, true, res.minRounds);
      } else {
        p.unprovenSolvable++;
        p.unprovenHist[bucketKey(res.minRounds)]++;
      }
    }

    for (const [name, opts] of Object.entries(PLAYERS)) {
      const r = playHeuristic(g, { ...opts, seed });
      const t = p.players[name];
      if (r.solved) {
        t.solved++;
        t.roundPayoutSum += payoutMultiplier(PT, true, r.rounds);
      } else {
        t.gaveUp++;
        t.progressPayoutSum += progressMultiplier(r.foundationFraction, PROG);
      }
    }
  }
  return p;
}

export interface SensPartial {
  count: number;
  solvable: number;
  unsolvable: number;
  unknown: number;
  proven: number;
  nodesSum: number;
}

export function runSensChunk(startSeed: number, count: number, budget: number): SensPartial {
  const p: SensPartial = { count, solvable: 0, unsolvable: 0, unknown: 0, proven: 0, nodesSum: 0 };
  for (let seed = startSeed; seed < startSeed + count; seed++) {
    const res = solve(deal(seed), budget);
    p[res.status]++;
    p.nodesSum += res.nodesVisited;
    if (res.status === 'solvable' && res.minRoundsProven) p.proven++;
  }
  return p;
}

export function mergeMain(parts: MainPartial[]): MainPartial {
  const out = runMainChunk(1, 0, 1); // empty shell with player keys
  for (const p of parts) {
    out.count += p.count;
    out.cls.solvable += p.cls.solvable;
    out.cls.unsolvable += p.cls.unsolvable;
    out.cls.unknown += p.cls.unknown;
    out.provenSolvable += p.provenSolvable;
    out.unprovenSolvable += p.unprovenSolvable;
    out.allSolvable += p.allSolvable;
    out.ceilProvenPayoutSum += p.ceilProvenPayoutSum;
    out.ceilNaivePayoutSum += p.ceilNaivePayoutSum;
    for (const b of Object.keys(out.provenHist)) {
      out.provenHist[b] += p.provenHist[b];
      out.unprovenHist[b] += p.unprovenHist[b];
    }
    for (const name of Object.keys(out.players)) {
      out.players[name].solved += p.players[name].solved;
      out.players[name].gaveUp += p.players[name].gaveUp;
      out.players[name].roundPayoutSum += p.players[name].roundPayoutSum;
      out.players[name].progressPayoutSum += p.players[name].progressPayoutSum;
    }
  }
  return out;
}

export function mergeSens(parts: SensPartial[]): SensPartial {
  const out: SensPartial = { count: 0, solvable: 0, unsolvable: 0, unknown: 0, proven: 0, nodesSum: 0 };
  for (const p of parts) {
    out.count += p.count;
    out.solvable += p.solvable;
    out.unsolvable += p.unsolvable;
    out.unknown += p.unknown;
    out.proven += p.proven;
    out.nodesSum += p.nodesSum;
  }
  return out;
}
