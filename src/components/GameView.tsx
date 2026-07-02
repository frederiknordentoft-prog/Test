import type { LevelDef } from '../types'
import { useGameStore } from '../store/gameStore'
import { GameCanvas } from './GameCanvas'
import { InventoryBar } from './InventoryBar'
import { BallPicker } from './BallPicker'
import { Controls } from './Controls'
import { StarRow } from './StarRow'
import { goalHint, reasonText, UI } from '../game/strings'
import { nextGoal, parFor } from '../game/progression'
import { LEVELS } from '../../data/levels'

type Props = { level: LevelDef }

const firstLevelId = LEVELS[0]?.id ?? ''

/** The 3-step interactive tutorial, shown on level 1 until it is first beaten. */
function tutorialText(placements: number, pickerOpen: boolean): string {
  if (placements === 0) return UI.tutorialPlace
  if (pickerOpen) return UI.tutorialRotate
  return UI.tutorialDrop
}

export function GameView({ level }: Props) {
  const runResult = useGameStore((s) => s.runResult)
  const runReason = useGameStore((s) => s.runReason)
  const runStars = useGameStore((s) => s.runStars)
  const goToLevelSelect = useGameStore((s) => s.goToLevelSelect)
  const starsByLevel = useGameStore((s) => s.starsByLevel)
  const tutorialSeen = useGameStore((s) => s.tutorialSeen)
  const placementCount = useGameStore((s) => s.placements.length)
  const pickerOpen = useGameStore((s) => s.openPickerSlot !== null)

  const finished = runResult === 'won' || runResult === 'failed'
  const idx = LEVELS.findIndex((l) => l.id === level.id)
  const best = starsByLevel[level.id] ?? 0
  const par = parFor(level.id)
  const showTutorial = level.id === firstLevelId && !tutorialSeen && best === 0 && runResult === 'idle'

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
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            Bane {idx + 1} · {UI.par(par)}
          </div>
          <h1 className="text-base font-bold leading-tight text-slate-100">{level.name}</h1>
        </div>
        <div className="w-[72px] text-right">
          <StarRow stars={best} />
        </div>
      </header>

      {finished && (
        <div
          role="status"
          className={[
            'shrink-0 rounded-xl px-4 py-2 text-center shadow-lg',
            runResult === 'won' ? 'bg-emerald-500/90 text-slate-900' : 'bg-rose-500/90 text-slate-50',
          ].join(' ')}
        >
          {runResult === 'won' ? (
            <>
              <div className="flex items-center justify-center gap-3">
                <span className="text-base font-bold">{UI.won}</span>
                <StarRow stars={runStars} size="lg" animate />
              </div>
              <p className="text-xs font-medium opacity-90">
                {goalHint(nextGoal(runStars), par, level.coins?.length ?? 0)}
              </p>
            </>
          ) : (
            <>
              <span className="text-base font-bold">{UI.failed}</span>
              <span className="ml-2 text-sm font-medium opacity-90">{reasonText(runResult, runReason)}</span>
            </>
          )}
        </div>
      )}

      {showTutorial && (
        <div
          role="note"
          className="shrink-0 rounded-xl border border-sky-500/50 bg-sky-500/15 px-4 py-2 text-center text-sm font-medium text-sky-200"
        >
          {tutorialText(placementCount, pickerOpen)}
        </div>
      )}

      {/* The board takes all remaining space and scales to fit — no scrolling. */}
      <GameCanvas level={level} />

      <div className="shrink-0 space-y-2">
        <BallPicker level={level} />
        <InventoryBar level={level} />
        <Controls level={level} />
      </div>
    </div>
  )
}
