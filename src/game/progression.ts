import type { LevelDef, Stars } from '../types'
import type { SimResult } from '../physics/simulate'
import { LEVELS } from '../../data/levels'
import report from '../../solver-report.json'

// ---------------------------------------------------------------------------
// The star economy (kravspec §5). Par is DERIVED by the solver — the app reads
// it from the committed, CI-verified solver-report.json and never hand-authors
// it. Stars are nested: ★3 ⊆ ★2 ⊆ ★1.
// ---------------------------------------------------------------------------

/** Solver-derived par (minimum pieces for a coin-complete win) per level. */
export const PAR_BY_LEVEL: Record<string, number> = Object.fromEntries(
  report.levels.map((l) => [l.levelId, l.par]),
)

export function parFor(levelId: string): number {
  return PAR_BY_LEVEL[levelId] ?? 3
}

/** Stars unlock worlds: 2 opens at 6★, 3 at 16★ (max 42★). */
export const WORLD_UNLOCK: Record<1 | 2 | 3, number> = { 1: 0, 2: 6, 3: 16 }

export const WORLD_NAMES: Record<1 | 2 | 3, string> = {
  1: 'Værkstedet',
  2: 'Maskinhallen',
  3: 'Mesterprøven',
}

export const MAX_STARS = LEVELS.length * 3

export function totalStars(starsByLevel: Record<string, Stars>): number {
  return Object.values(starsByLevel).reduce((sum: number, s) => sum + s, 0)
}

export function worldUnlocked(world: 1 | 2 | 3, starsByLevel: Record<string, Stars>): boolean {
  return totalStars(starsByLevel) >= WORLD_UNLOCK[world]
}

/**
 * Score a finished run: ★1 target hit · ★2 + all the level's coins in the
 * same run · ★3 = ★2 within par pieces.
 */
export function starsForRun(level: LevelDef, sim: SimResult, placementCount: number): Stars {
  if (sim.result !== 'won') return 0
  const coinCount = level.coins?.length ?? 0
  const coinComplete = sim.coinsCollected.length === coinCount
  if (!coinComplete) return 1
  return placementCount <= parFor(level.id) ? 3 : 2
}

/** What the player is still missing on this level — drives the retry hint. */
export function nextGoal(stars: Stars): 'win' | 'coins' | 'par' | 'done' {
  if (stars === 0) return 'win'
  if (stars === 1) return 'coins'
  if (stars === 2) return 'par'
  return 'done'
}
