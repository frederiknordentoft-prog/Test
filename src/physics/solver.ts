import type { BallType, LevelDef, PieceType, PlacedPiece } from '../types'
import { simulate } from './simulate'
import { PIECE_TYPES, ROTATION_DOMAINS } from './constants'

// ---------------------------------------------------------------------------
// Deterministic level solver 2.0. Exhaustively enumerates every valid
// ball × slot → (type, rotation-in-domain) assignment that respects the
// level's inventory, runs the headless deterministic simulation for each, and
// derives the star economy:
//   ★1  some assignment wins
//   ★2  some winning assignment collects ALL coins ("coin-complete")
//   par the minimum piece count over coin-complete wins (== the first depth an
//       iterative deepening search would find one at; the exhaustive pass is
//       needed for the density metric anyway, so par falls out of it)
//   ★3  ★2 within par pieces — achievable by definition whenever ★2 is
// plus the solution density (★1 winners / candidates tried), the measured
// difficulty signal the level curve is tuned against.
//
// No DOM, no wall-clock, no RNG → the same level always yields the same
// report. A clock may be INJECTED (opts.now) by the CLI to enforce a time
// budget; src/ itself never reads one, and shipped levels are designed to
// exhaust their search space long before any budget bites.
// ---------------------------------------------------------------------------

export type Solution = { ballType: BallType; placements: PlacedPiece[] }

export type LevelSolveReport = {
  levelId: string
  levelName: string
  world: number
  /** Minimum piece count over coin-complete wins; -1 if none exists. */
  par: number
  star1: boolean
  star2: boolean
  star3: boolean
  /** A coin-complete win at par (fewest pieces; ties broken by the level's
   *  ball order, then enumeration order). */
  example: Solution | null
  /** ★1 winners / candidates tried — comparable across levels when the search
   *  was exhausted. */
  solutionDensity: number
  candidatesTried: number
  star1Wins: number
  /** Balls that win with ZERO pieces — must be empty for a real puzzle. */
  emptyWinBalls: BallType[]
  stopReason: 'exhausted' | 'candidateCap' | 'timeBudget'
  /** Filled in by the caller if it injected a clock; 0 otherwise. */
  elapsedMs: number
}

export type SolveOptions = {
  /** Hard cap on candidate (placement × ball) simulations. */
  maxCandidates?: number
  /** Optional time budget — only enforced when `now` is also provided. */
  timeBudgetMs?: number
  /** Clock injection point for the CLI. Never used in the browser/tests. */
  now?: () => number
}

function allowedTypesForSlot(allowed: PieceType[], remaining: Record<PieceType, number>): PieceType[] {
  const base = allowed.length ? allowed : PIECE_TYPES
  return base.filter((t) => remaining[t] > 0)
}

export function solveLevel(level: LevelDef, opts: SolveOptions = {}): LevelSolveReport {
  const maxCandidates = opts.maxCandidates ?? 500_000
  const startedAt = opts.now?.() ?? 0
  const deadline =
    opts.now && opts.timeBudgetMs !== undefined ? startedAt + opts.timeBudgetMs : Infinity

  const slots = level.slots
  const coinCount = level.coins?.length ?? 0

  const remaining = {} as Record<PieceType, number>
  for (const t of PIECE_TYPES) remaining[t] = level.inventory[t] ?? 0

  const current: PlacedPiece[] = []
  let candidatesTried = 0
  let star1Wins = 0
  const emptyWinBalls: BallType[] = []
  let best: { size: number; ballIdx: number; solution: Solution } | null = null
  let stopReason: LevelSolveReport['stopReason'] = 'exhausted'
  let stop = false

  function leaf(): void {
    for (let ballIdx = 0; ballIdx < level.balls.length; ballIdx++) {
      const ballType = level.balls[ballIdx] as BallType
      if (candidatesTried >= maxCandidates) {
        stopReason = 'candidateCap'
        stop = true
        return
      }
      if (opts.now && opts.now() > deadline) {
        stopReason = 'timeBudget'
        stop = true
        return
      }
      candidatesTried++
      const r = simulate(level, current, ballType)
      if (r.result !== 'won') continue
      star1Wins++
      if (current.length === 0 && !emptyWinBalls.includes(ballType)) emptyWinBalls.push(ballType)
      const coinComplete = r.coinsCollected.length === coinCount
      if (!coinComplete) continue
      const size = current.length
      if (best === null || size < best.size || (size === best.size && ballIdx < best.ballIdx)) {
        best = {
          size,
          ballIdx,
          solution: { ballType, placements: current.map((p) => ({ ...p })) },
        }
      }
    }
  }

  // Backtracking over slots with inventory pruning. Enumeration order is fixed
  // (slot order, empty-first, PIECE_TYPES order, domain order) so the reported
  // example is stable across runs.
  function recurse(slotIdx: number): void {
    if (stop) return
    if (slotIdx === slots.length) {
      leaf()
      return
    }
    const slot = slots[slotIdx]!

    // Option 1: leave this slot empty.
    recurse(slotIdx + 1)
    if (stop) return

    // Option 2: each allowed, still-available piece at each domain rotation.
    for (const t of allowedTypesForSlot(slot.allowedTypes, remaining)) {
      remaining[t]--
      for (const rot of ROTATION_DOMAINS[t]) {
        current.push({ slotId: slot.id, type: t, rotation: rot })
        recurse(slotIdx + 1)
        current.pop()
        if (stop) break
      }
      remaining[t]++
      if (stop) return
    }
  }

  recurse(0)

  // TS cannot see the closure mutation of `best` inside leaf() (TS#9998).
  const b = best as { size: number; ballIdx: number; solution: Solution } | null
  return {
    levelId: level.id,
    levelName: level.name,
    world: level.world,
    par: b ? b.size : -1,
    star1: star1Wins > 0,
    star2: b !== null,
    star3: b !== null,
    example: b ? b.solution : null,
    solutionDensity: candidatesTried > 0 ? star1Wins / candidatesTried : 0,
    candidatesTried,
    star1Wins,
    emptyWinBalls,
    stopReason,
    elapsedMs: opts.now ? opts.now() - startedAt : 0,
  }
}
