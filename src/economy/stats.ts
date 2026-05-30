// ============================================================
// Live session statistics: RTP, hit frequency, round
// distribution, skill gap (actual vs. optimal rounds).
// ============================================================

import { Paytable, roundBucket } from './paytable';

export interface SessionStats {
  games: number;
  wins: number;
  paidGames: number; // games that paid > 0 (incl. base game payout)
  totalStaked: number;
  totalPaid: number; // base-game payouts only (excl. jackpot) = round + progress
  totalPaidRound: number; // payouts from solved games (round paytable)
  totalPaidProgress: number; // payouts from unsolved games (progress payout)
  biggestWin: number;
  // round distribution among solved games, keyed by bucket label
  roundDist: Record<string, number>;
  // skill gap accumulators (solved games with a known benchmark)
  actualRoundsSum: number;
  optimalRoundsSum: number;
  benchmarkedGames: number;
  unprovenBenchmarks: number; // benchmarked games whose minRounds wasn't proven optimal
  // deal classification counts of played deals
  classCounts: { solvable: number; unsolvable: number; unknown: number };
}

export function emptyStats(): SessionStats {
  return {
    games: 0,
    wins: 0,
    paidGames: 0,
    totalStaked: 0,
    totalPaid: 0,
    totalPaidRound: 0,
    totalPaidProgress: 0,
    biggestWin: 0,
    roundDist: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6plus': 0 },
    actualRoundsSum: 0,
    optimalRoundsSum: 0,
    benchmarkedGames: 0,
    unprovenBenchmarks: 0,
    classCounts: { solvable: 0, unsolvable: 0, unknown: 0 },
  };
}

export interface GameResult {
  stake: number;
  solved: boolean;
  rounds: number;
  payout: number; // total base-game payout (excl. jackpot)
  roundPayout: number; // payout from the round paytable (solved games)
  progressPayout: number; // payout from progress (unsolved games)
  minRounds?: number; // solver benchmark
  minRoundsProven?: boolean;
  dealStatus?: 'solvable' | 'unsolvable' | 'unknown';
}

export function recordGame(stats: SessionStats, r: GameResult): SessionStats {
  const next: SessionStats = {
    ...stats,
    roundDist: { ...stats.roundDist },
    classCounts: { ...stats.classCounts },
    games: stats.games + 1,
    wins: stats.wins + (r.solved ? 1 : 0),
    paidGames: stats.paidGames + (r.payout > 0 ? 1 : 0),
    totalStaked: stats.totalStaked + r.stake,
    totalPaid: stats.totalPaid + r.payout,
    totalPaidRound: stats.totalPaidRound + r.roundPayout,
    totalPaidProgress: stats.totalPaidProgress + r.progressPayout,
    biggestWin: Math.max(stats.biggestWin, r.payout),
  };
  const cls = r.dealStatus ?? 'unknown';
  next.classCounts[cls] += 1;
  if (r.solved) {
    const bucket = String(roundBucket(r.rounds));
    next.roundDist[bucket] = (next.roundDist[bucket] ?? 0) + 1;
    if (r.minRounds != null) {
      next.actualRoundsSum += r.rounds;
      next.optimalRoundsSum += r.minRounds;
      next.benchmarkedGames += 1;
      if (r.minRoundsProven === false) next.unprovenBenchmarks += 1;
    }
  }
  return next;
}

export function rtp(stats: SessionStats): number {
  if (stats.totalStaked === 0) return 0;
  return (stats.totalPaid / stats.totalStaked) * 100;
}

/** RTP from solved games only (round paytable). */
export function roundRtp(stats: SessionStats): number {
  if (stats.totalStaked === 0) return 0;
  return (stats.totalPaidRound / stats.totalStaked) * 100;
}

/** RTP from unsolved games' progress payouts. */
export function progressRtp(stats: SessionStats): number {
  if (stats.totalStaked === 0) return 0;
  return (stats.totalPaidProgress / stats.totalStaked) * 100;
}

export function hitFrequency(stats: SessionStats): number {
  if (stats.games === 0) return 0;
  return (stats.paidGames / stats.games) * 100;
}

export function avgActualRounds(stats: SessionStats): number {
  return stats.benchmarkedGames ? stats.actualRoundsSum / stats.benchmarkedGames : 0;
}
export function avgOptimalRounds(stats: SessionStats): number {
  return stats.benchmarkedGames ? stats.optimalRoundsSum / stats.benchmarkedGames : 0;
}

/**
 * Theoretical RTP of a paytable given a round distribution (as fractions),
 * the win rate, and the fraction of fails. Used to show the optimal ceiling
 * when fed the solver's benchmark distribution.
 */
export function theoreticalRtp(pt: Paytable, dist: Record<string, number>): number {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let ev = 0;
  for (const [bucket, count] of Object.entries(dist)) {
    const mult = (pt as unknown as Record<string, number>)[bucket] ?? 0;
    ev += (count / total) * mult;
  }
  return ev * 100;
}
