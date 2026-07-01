import type { BallType, LevelDef, PieceType, PlacedPiece } from '../types'
import { simulate } from './simulate'
import { BALL_TYPES, PIECE_TYPES, ROTATION_STEPS } from './constants'

// ---------------------------------------------------------------------------
// Deterministic level solver core. Enumerates every valid ball-type ×
// slot→(type,rotation) assignment that respects the level's inventory limits,
// runs the headless deterministic simulation for each, and collects the ones
// that win. Shared by the `solve:levels` CLI and the test suite. No DOM, no
// wall-clock, no RNG → the same level always yields the same example solution.
// ---------------------------------------------------------------------------

export type Solution = { ballType: BallType; placements: PlacedPiece[] }

export type SolveReport = {
  levelId: string
  levelName: string
  solvable: boolean
  example: Solution | null
  solutionsFound: number
  candidatesTried: number
  stopReason: 'exhausted' | 'solutionCap' | 'candidateCap'
}

export type SolveOptions = {
  /** Stop after this many confirmed solutions (spec suggests 50). */
  maxSolutions?: number
  /** Hard cap on full candidate assignments simulated (iteration budget). */
  maxCandidates?: number
}

function allowedTypesForSlot(allowed: PieceType[], remaining: Record<PieceType, number>): PieceType[] {
  const base = allowed.length ? allowed : PIECE_TYPES
  return base.filter((t) => remaining[t] > 0)
}

/**
 * Brute-force solve a level. Backtracking over slots with inventory pruning
 * keeps the search tiny for realistic inventories (a few pieces), while the
 * candidate cap bounds the worst case. Enumeration order is fixed (slots, then
 * PIECE_TYPES order, then rotation index) so the reported example is stable.
 */
export function solveLevel(level: LevelDef, opts: SolveOptions = {}): SolveReport {
  const maxSolutions = opts.maxSolutions ?? 50
  const maxCandidates = opts.maxCandidates ?? 500_000
  const slots = level.slots

  const remaining = {} as Record<PieceType, number>
  for (const t of PIECE_TYPES) remaining[t] = level.inventory[t] ?? 0

  const solutions: Solution[] = []
  const current: PlacedPiece[] = []
  let candidatesTried = 0
  let stopReason: SolveReport['stopReason'] = 'exhausted'
  let stop = false

  function recurse(slotIdx: number, ballType: BallType): void {
    if (stop) return

    if (slotIdx === slots.length) {
      candidatesTried++
      const r = simulate(level, current, ballType)
      if (r.result === 'won') {
        solutions.push({ ballType, placements: current.map((p) => ({ ...p })) })
        if (solutions.length >= maxSolutions) {
          stopReason = 'solutionCap'
          stop = true
          return
        }
      }
      if (candidatesTried >= maxCandidates) {
        stopReason = 'candidateCap'
        stop = true
      }
      return
    }

    const slot = slots[slotIdx]!

    // Option 1: leave this slot empty.
    recurse(slotIdx + 1, ballType)
    if (stop) return

    // Option 2: place one allowed, still-available piece at each rotation.
    for (const t of allowedTypesForSlot(slot.allowedTypes, remaining)) {
      remaining[t]--
      for (let rot = 0; rot < ROTATION_STEPS.length; rot++) {
        current.push({ slotId: slot.id, type: t, rotation: rot })
        recurse(slotIdx + 1, ballType)
        current.pop()
        if (stop) break
      }
      remaining[t]++
      if (stop) return
    }
  }

  // Iron first so the default ball is preferred in the reported example.
  for (const ballType of BALL_TYPES) {
    if (stop) break
    recurse(0, ballType)
  }

  return {
    levelId: level.id,
    levelName: level.name,
    solvable: solutions.length > 0,
    example: solutions[0] ?? null,
    solutionsFound: solutions.length,
    candidatesTried,
    stopReason,
  }
}
