import { LEVELS } from '../../data/levels'
import { useGameStore } from '../store/gameStore'
import { inventoryTypes } from '../game/inventory'
import { PIECE_SPECS } from '../physics/constants'
import { UI } from '../game/strings'
import { InstallPrompt } from './InstallPrompt'

export function LevelSelect() {
  const selectLevel = useGameStore((s) => s.selectLevel)
  const completed = useGameStore((s) => s.completedLevels)
  const resetProgress = useGameStore((s) => s.resetProgress)

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto px-4 pb-8 pt-6">
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-slate-100">Kuglebanen</h1>
        <p className="mt-1 text-sm text-slate-400">{UI.selectTitle}</p>
        <p className="mt-1 text-xs text-emerald-400">
          {completed.length} af {LEVELS.length} klaret
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {LEVELS.map((level, i) => {
          const done = completed.includes(level.id)
          return (
            <button
              key={level.id}
              type="button"
              onClick={() => selectLevel(level.id)}
              className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-left transition hover:border-sky-500/70 hover:bg-slate-800 active:scale-[0.98] touch-manipulation"
            >
              <div className="flex items-center gap-3">
                <span
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold',
                    done ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-slate-200',
                  ].join(' ')}
                >
                  {done ? '✓' : i + 1}
                </span>
                <div>
                  <div className="font-semibold text-slate-100">{level.name}</div>
                  <div className="text-xs text-slate-400">{done ? UI.completed : `Bane ${i + 1}`}</div>
                </div>
              </div>
              <div className="flex gap-1">
                {inventoryTypes(level).map((t) => (
                  <span key={t} className="text-lg" style={{ color: PIECE_SPECS[t].color }} title={PIECE_SPECS[t].label}>
                    {PIECE_SPECS[t].glyph}
                  </span>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <InstallPrompt />

      {completed.length > 0 && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Nulstil al fremgang? Alle klarede baner glemmes.')) resetProgress()
          }}
          className="mx-auto mt-1 text-xs text-slate-500 underline-offset-2 transition hover:text-slate-300 hover:underline touch-manipulation"
        >
          Nulstil fremgang
        </button>
      )}
    </div>
  )
}
