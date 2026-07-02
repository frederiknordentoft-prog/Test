import { useEffect } from 'react'
import type { LevelDef } from '../types'
import { useGameStore } from '../store/gameStore'
import { GameCanvas } from './GameCanvas'
import { InventoryBar } from './InventoryBar'
import { BallPicker } from './BallPicker'
import { Controls } from './Controls'
import { StarRow } from './StarRow'
import { goalHint, reasonText, UI } from '../game/strings'
import { nextGoal, parFor } from '../game/progression'
import { unlockAudio } from '../game/audio'
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

  // PC keyboard: Space/Enter = slip/prøv igen · Esc = luk vinkelvælgeren.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useGameStore.getState()
      if (e.key === 'Escape') {
        s.closePicker()
        return
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (s.runResult === 'idle') {
          unlockAudio()
          s.dropBall()
        } else if (s.runResult === 'won' || s.runResult === 'failed') {
          s.resetRun()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-2 overflow-hidden px-3 pb-2 pt-2 lg:max-w-6xl lg:flex-row lg:items-stretch lg:gap-8 lg:px-8 lg:pb-4">
      {/* Left: header + status + the board. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <header className="flex shrink-0 items-center justify-between">
          <button
            type="button"
            onClick={goToLevelSelect}
            className="rounded-xl border-2 border-slate-600 bg-slate-800/70 px-3 py-1.5 text-sm font-semibold text-slate-200 shadow transition hover:border-slate-400 hover:bg-slate-700 active:scale-95 touch-manipulation"
          >
            ← {UI.back}
          </button>
          <div className="text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Bane {idx + 1} · {UI.par(par)}
            </div>
            <h1 className="text-base font-black leading-tight tracking-tight text-slate-100 lg:text-xl">
              {level.name}
            </h1>
          </div>
          <div className="w-[72px] text-right">
            <StarRow stars={best} />
          </div>
        </header>

        {finished && (
          <div
            role="status"
            className={[
              'shrink-0 rounded-2xl px-4 py-2 text-center shadow-xl ring-2',
              runResult === 'won'
                ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-emerald-950 ring-emerald-200/60'
                : 'bg-gradient-to-b from-rose-400 to-rose-600 text-rose-50 ring-rose-200/50',
            ].join(' ')}
          >
            {runResult === 'won' ? (
              <>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-lg font-black tracking-tight">{UI.won}</span>
                  <StarRow stars={runStars} size="lg" animate />
                </div>
                <p className="text-xs font-semibold opacity-90">
                  {goalHint(nextGoal(runStars), par, level.coins?.length ?? 0)}
                </p>
              </>
            ) : (
              <>
                <span className="text-lg font-black tracking-tight">{UI.failed}</span>
                <span className="ml-2 text-sm font-semibold opacity-90">{reasonText(runResult, runReason)}</span>
              </>
            )}
          </div>
        )}

        {showTutorial && (
          <div
            role="note"
            className="shrink-0 rounded-2xl border-2 border-sky-400/50 bg-sky-500/15 px-4 py-2 text-center text-sm font-semibold text-sky-200 shadow-lg"
          >
            {tutorialText(placementCount, pickerOpen)}
          </div>
        )}

        {/* The board takes all remaining space and scales to fit — no scrolling. */}
        <GameCanvas level={level} />
      </div>

      {/* Right (desktop) / below (mobile): ball, palette, actions. */}
      <aside className="shrink-0 space-y-2 lg:flex lg:w-80 lg:flex-col lg:justify-center lg:gap-3 lg:space-y-0">
        <BallPicker level={level} />
        <InventoryBar level={level} />
        <Controls level={level} />
        <p className="hidden text-center text-[11px] text-slate-500 lg:block">
          ⌨ Mellemrum: slip kuglen · Esc: luk vinkelvælgeren
        </p>
      </aside>
    </div>
  )
}
