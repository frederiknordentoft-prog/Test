import type { LevelDef } from '../types'
import { useGameStore } from '../store/gameStore'
import { GameCanvas } from './GameCanvas'
import { InventoryBar } from './InventoryBar'
import { BallPicker } from './BallPicker'
import { Controls } from './Controls'
import { reasonText, UI } from '../game/strings'
import { LEVELS } from '../../data/levels'

type Props = { level: LevelDef }

export function GameView({ level }: Props) {
  const runResult = useGameStore((s) => s.runResult)
  const runReason = useGameStore((s) => s.runReason)
  const goToLevelSelect = useGameStore((s) => s.goToLevelSelect)
  const completed = useGameStore((s) => s.completedLevels)

  const finished = runResult === 'won' || runResult === 'failed'
  const idx = LEVELS.findIndex((l) => l.id === level.id)

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col gap-2 overflow-hidden px-3 pb-2 pt-2">
      <header className="flex shrink-0 items-center justify-between">
        <button
          type="button"
          onClick={goToLevelSelect}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-800 active:scale-95 touch-manipulation"
        >
          ← {UI.back}
        </button>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Bane {idx + 1}</div>
          <h1 className="text-base font-bold leading-tight text-slate-100">{level.name}</h1>
        </div>
        <div className="w-[68px] text-right text-emerald-400">{completed.includes(level.id) ? '✓' : ''}</div>
      </header>

      {finished && (
        <div
          role="status"
          className={[
            'shrink-0 rounded-xl px-4 py-2 text-center font-bold shadow-lg transition',
            runResult === 'won' ? 'animate-pulse bg-emerald-500/90 text-slate-900' : 'bg-rose-500/90 text-slate-50',
          ].join(' ')}
        >
          <span className="text-base">{runResult === 'won' ? UI.won : UI.failed}</span>
          <span className="ml-2 text-sm font-medium opacity-90">{reasonText(runResult, runReason)}</span>
        </div>
      )}

      {/* The board takes all remaining space and scales to fit — no scrolling. */}
      <GameCanvas level={level} />

      <div className="shrink-0 space-y-2">
        <BallPicker />
        <InventoryBar level={level} />
        <Controls level={level} />
      </div>
    </div>
  )
}
