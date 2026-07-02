import type { LevelDef } from '../types'
import { useGameStore } from '../store/gameStore'
import { totalRemaining } from '../game/inventory'
import { UI } from '../game/strings'
import { WORLD_UNLOCK, worldUnlocked } from '../game/progression'
import { unlockAudio } from '../game/audio'
import { LEVELS } from '../../data/levels'

type Props = { level: LevelDef }

/** Chunky arcade button: gradient face + solid "edge" that presses down. */
const CTA =
  'flex-1 rounded-2xl px-4 py-3 text-base font-black tracking-tight shadow-lg transition touch-manipulation ' +
  'border-b-4 active:translate-y-[2px] active:border-b-2 disabled:opacity-60 disabled:active:translate-y-0'

export function Controls({ level }: Props) {
  const placements = useGameStore((s) => s.placements)
  const runResult = useGameStore((s) => s.runResult)
  const dropBall = useGameStore((s) => s.dropBall)
  const resetRun = useGameStore((s) => s.resetRun)
  const clearPlacements = useGameStore((s) => s.clearPlacements)
  const selectLevel = useGameStore((s) => s.selectLevel)
  const starsByLevel = useGameStore((s) => s.starsByLevel)

  const running = runResult === 'running'
  const finished = runResult === 'won' || runResult === 'failed'
  const hasPieces = placements.length > 0

  const idx = LEVELS.findIndex((l) => l.id === level.id)
  const nextLevel = idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : undefined
  const nextUnlocked = nextLevel ? worldUnlocked(nextLevel.world, starsByLevel) : false

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {!finished ? (
          <button
            type="button"
            onClick={() => {
              unlockAudio() // create/resume the AudioContext inside the gesture (iOS)
              dropBall()
            }}
            disabled={running}
            className={`${CTA} border-sky-700 bg-gradient-to-b from-sky-400 to-sky-600 text-sky-950 hover:from-sky-300 hover:to-sky-500`}
          >
            {running ? UI.dropping : `▶ ${UI.drop}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={resetRun}
            className={`${CTA} border-sky-700 bg-gradient-to-b from-sky-400 to-sky-600 text-sky-950 hover:from-sky-300 hover:to-sky-500`}
          >
            ↻ {UI.retry}
          </button>
        )}

        <button
          type="button"
          onClick={clearPlacements}
          disabled={running || !hasPieces}
          className="rounded-2xl border-2 border-slate-600 bg-slate-800/80 px-4 py-3 text-sm font-bold text-slate-200 shadow transition touch-manipulation hover:border-slate-400 hover:bg-slate-700 active:scale-95 disabled:opacity-40"
        >
          {UI.clear}
        </button>
      </div>

      {runResult === 'won' && nextLevel && (
        <button
          type="button"
          onClick={() => nextUnlocked && selectLevel(nextLevel.id)}
          disabled={!nextUnlocked}
          className={`${CTA} border-emerald-700 bg-gradient-to-b from-emerald-400 to-emerald-600 text-emerald-950 hover:from-emerald-300 hover:to-emerald-500`}
        >
          {nextUnlocked ? `${UI.next} →` : `🔒 ${UI.locked(WORLD_UNLOCK[nextLevel.world])}`}
        </button>
      )}

      {!finished && (
        <p className="text-center text-xs font-medium text-slate-400">
          {UI.piecesLeft(totalRemaining(level, placements))}
        </p>
      )}
    </div>
  )
}
