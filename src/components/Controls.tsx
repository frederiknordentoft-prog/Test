import type { LevelDef } from '../types'
import { useGameStore } from '../store/gameStore'
import { totalRemaining } from '../game/inventory'
import { UI } from '../game/strings'
import { LEVELS } from '../../data/levels'

type Props = { level: LevelDef }

export function Controls({ level }: Props) {
  const placements = useGameStore((s) => s.placements)
  const runResult = useGameStore((s) => s.runResult)
  const dropBall = useGameStore((s) => s.dropBall)
  const resetRun = useGameStore((s) => s.resetRun)
  const clearPlacements = useGameStore((s) => s.clearPlacements)
  const selectLevel = useGameStore((s) => s.selectLevel)

  const running = runResult === 'running'
  const finished = runResult === 'won' || runResult === 'failed'
  const hasPieces = placements.length > 0

  const idx = LEVELS.findIndex((l) => l.id === level.id)
  const nextLevel = idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : undefined

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {!finished ? (
          <button
            type="button"
            onClick={dropBall}
            disabled={running}
            className="flex-1 rounded-xl bg-sky-500 px-4 py-3 text-base font-bold text-slate-900 shadow-lg transition touch-manipulation hover:bg-sky-400 active:scale-95 disabled:opacity-60"
          >
            {running ? UI.dropping : UI.drop}
          </button>
        ) : (
          <button
            type="button"
            onClick={resetRun}
            className="flex-1 rounded-xl bg-sky-500 px-4 py-3 text-base font-bold text-slate-900 shadow-lg transition touch-manipulation hover:bg-sky-400 active:scale-95"
          >
            {UI.retry}
          </button>
        )}

        <button
          type="button"
          onClick={clearPlacements}
          disabled={running || !hasPieces}
          className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-200 transition touch-manipulation hover:bg-slate-800 active:scale-95 disabled:opacity-40"
        >
          {UI.clear}
        </button>
      </div>

      {runResult === 'won' && nextLevel && (
        <button
          type="button"
          onClick={() => selectLevel(nextLevel.id)}
          className="rounded-xl bg-emerald-500 px-4 py-3 text-base font-bold text-slate-900 shadow-lg transition touch-manipulation hover:bg-emerald-400 active:scale-95"
        >
          {UI.next} →
        </button>
      )}

      <p className="text-center text-xs text-slate-400">{UI.piecesLeft(totalRemaining(level, placements))}</p>
    </div>
  )
}
