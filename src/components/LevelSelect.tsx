import { LEVELS } from '../../data/levels'
import type { LevelDef, Stars } from '../types'
import { useGameStore } from '../store/gameStore'
import { inventoryTypes } from '../game/inventory'
import { PIECE_SPECS } from '../physics/constants'
import { MAX_STARS, parFor, totalStars, WORLD_NAMES, WORLD_UNLOCK, worldUnlocked } from '../game/progression'
import { UI } from '../game/strings'
import { StarRow } from './StarRow'
import { InstallPrompt } from './InstallPrompt'

function LevelCard({ level, index, locked }: { level: LevelDef; index: number; locked: boolean }) {
  const selectLevel = useGameStore((s) => s.selectLevel)
  const stars: Stars = useGameStore((s) => s.starsByLevel[level.id] ?? 0)

  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => selectLevel(level.id)}
      className={[
        'flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition touch-manipulation',
        locked
          ? 'cursor-not-allowed border-slate-800 bg-slate-900/60 opacity-55'
          : 'border-slate-700 bg-slate-800/60 hover:border-sky-500/70 hover:bg-slate-800 active:scale-[0.98]',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <span
          className={[
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            stars === 3 ? 'bg-amber-400 text-slate-900' : stars > 0 ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-slate-200',
          ].join(' ')}
        >
          {locked ? '🔒' : index + 1}
        </span>
        <div>
          <div className="font-semibold text-slate-100">{level.name}</div>
          <div className="text-xs text-slate-400">
            <StarRow stars={stars} /> · {UI.par(parFor(level.id))}
          </div>
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
}

export function LevelSelect() {
  const starsByLevel = useGameStore((s) => s.starsByLevel)
  const resetProgress = useGameStore((s) => s.resetProgress)
  const muted = useGameStore((s) => s.muted)
  const toggleMuted = useGameStore((s) => s.toggleMuted)

  const total = totalStars(starsByLevel)

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto px-4 pb-8 pt-6">
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-slate-100">Kuglebanen</h1>
        <p className="mt-1 text-sm text-slate-400">{UI.selectTitle}</p>
        <p className="mt-1 text-sm font-semibold text-amber-400">★ {UI.totalStars(total, MAX_STARS)}</p>
      </div>

      {([1, 2, 3] as const).map((world) => {
        const levels = LEVELS.filter((l) => l.world === world)
        const unlocked = worldUnlocked(world, starsByLevel)
        return (
          <section key={world} className="space-y-2">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">
                {UI.world(world, WORLD_NAMES[world])}
              </h2>
              {!unlocked && <span className="text-xs font-semibold text-amber-400/90">🔒 {UI.locked(WORLD_UNLOCK[world])}</span>}
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {levels.map((level) => (
                <LevelCard
                  key={level.id}
                  level={level}
                  index={LEVELS.findIndex((l) => l.id === level.id)}
                  locked={!unlocked}
                />
              ))}
            </div>
          </section>
        )
      })}

      <InstallPrompt />

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={toggleMuted}
          aria-pressed={muted}
          className="text-xs text-slate-400 underline-offset-2 transition hover:text-slate-200 hover:underline touch-manipulation"
        >
          {muted ? UI.soundOff : UI.soundOn}
        </button>
        {total > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Nulstil al fremgang? Alle stjerner glemmes.')) resetProgress()
            }}
            className="text-xs text-slate-500 underline-offset-2 transition hover:text-slate-300 hover:underline touch-manipulation"
          >
            Nulstil fremgang
          </button>
        )}
      </div>
    </div>
  )
}
