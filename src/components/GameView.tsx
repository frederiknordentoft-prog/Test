import type { LevelDef } from '../types'
import { useGameStore } from '../store/gameStore'
import { GameCanvas } from './GameCanvas'
import { InventoryBar } from './InventoryBar'
import { Controls } from './Controls'
import { reasonText, UI } from '../game/strings'
import { LEVELS } from '../../data/levels'

type Props = { level: LevelDef }

export function GameView({ level }: Props) {
  const runResult = useGameStore((s) => s.runResult)
  const runReason = useGameStore((s) => s.runReason)
  const placements = useGameStore((s) => s.placements)
  const goToLevelSelect = useGameStore((s) => s.goToLevelSelect)
  const completed = useGameStore((s) => s.completedLevels)

  const finished = runResult === 'won' || runResult === 'failed'
  const idx = LEVELS.findIndex((l) => l.id === level.id)

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-3 px-3 pb-4 pt-2">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={goToLevelSelect}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-800 active:scale-95 touch-manipulation"
        >
          ← {UI.back}
        </button>
        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-slate-500">Bane {idx + 1}</div>
          <h1 className="text-lg font-bold text-slate-100">{level.name}</h1>
        </div>
        <div className="w-[68px] text-right text-emerald-400">
          {completed.includes(level.id) ? '✓' : ''}
        </div>
      </header>

      {finished && (
        <div
          role="status"
          className={[
            'rounded-xl px-4 py-2 text-center font-bold shadow-lg transition',
            runResult === 'won'
              ? 'animate-pulse bg-emerald-500/90 text-slate-900'
              : 'bg-rose-500/90 text-slate-50',
          ].join(' ')}
        >
          <span className="text-lg">{runResult === 'won' ? UI.won : UI.failed}</span>
          <span className="ml-2 text-sm font-medium opacity-90">{reasonText(runResult, runReason)}</span>
        </div>
      )}

      <GameCanvas level={level} />

      {!finished && placements.length === 0 && runResult === 'idle' && (
        <p className="text-center text-xs text-slate-500">{UI.hintPlace}</p>
      )}

      <InventoryBar level={level} />
      <Controls level={level} />
    </div>
  )
}
