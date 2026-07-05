import type { Mode } from './types'

export type ModeProgress = {
  solvedCount: number
  /** Laveste antal brikker brugt i en løst 'færrest brikker'-udfordring. */
  bestFewest: number | null
}

export type Progress = {
  streak: number
  perMode: Record<Mode, ModeProgress>
}

export function emptyProgress(): Progress {
  const empty = (): ModeProgress => ({ solvedCount: 0, bestFewest: null })
  return {
    streak: 0,
    perMode: { fri: empty(), balancer: empty(), ram: empty(), molekyle: empty() },
  }
}

/** Sejr: streak +1, solvedCount +1, og evt. ny bedste 'færrest brikker'. */
export function applyVictory(
  p: Progress,
  mode: Mode,
  tilesUsed: number,
  fewestMode: boolean,
): Progress {
  const m = p.perMode[mode]
  const bestFewest =
    fewestMode && (m.bestFewest === null || tilesUsed < m.bestFewest)
      ? tilesUsed
      : m.bestFewest
  return {
    streak: p.streak + 1,
    perMode: {
      ...p.perMode,
      [mode]: { solvedCount: m.solvedCount + 1, bestFewest },
    },
  }
}

/** Sprunget udfordring (ny udfordring uden at have løst den) → streak nulstilles. */
export function applySkip(p: Progress): Progress {
  return { ...p, streak: 0 }
}
