import { ISLAND_BY_ID } from '../../content/islands'
import { useProfile } from '../../state/useProfile'
import { Backdrop } from '../components/Backdrop'
import { Creature } from '../../art/Creature'
import { lookFor } from '../../art/creatureGen'
import { hueOf } from './RoundScreen'
import { sfx } from '../../audio/sfx'
import { speak } from '../../audio/speech'

/** The turer on one island, laid out as a path you walk along. */
export function IslandScreen({ islandId, onStart, onBack }: {
  islandId: string
  onStart: (levelId: string) => void
  onBack: () => void
}) {
  const save = useProfile((s) => s.save)
  const island = ISLAND_BY_ID.get(islandId)
  if (!island) return null

  const times = (levelId: string) => save.levels[levelId] ?? 0
  const unlockedAt = (index: number) =>
    index === 0 || times(island.levels[index - 1].id) > 0

  return (
    <div className={`app-height relative overflow-hidden ${save.settings.motion ? '' : 'calm'}`}>
      <Backdrop palette={island.palette} seed={island.id} />

      <div className="safe-top safe-x safe-bottom relative z-10 flex h-full flex-col">
        <header className="flex items-center gap-3 px-4 pb-1 pt-3">
          <button type="button" onClick={onBack} aria-label="Tilbage til kortet"
            className="tap-target grid h-12 w-12 min-h-0 place-items-center rounded-2xl bg-black/25 text-xl ring-1 ring-white/20">
            ‹
          </button>
          <div>
            <p className="text-xl font-black leading-tight">{island.emoji} {island.name}</p>
            <p className="text-sm opacity-75">{island.tagline}</p>
          </div>
        </header>

        <div className="scroll-y flex-1 px-4 py-3">
          <div className="mx-auto flex max-w-md flex-col gap-3">
            {island.levels.map((level, index) => {
              const open = unlockedAt(index)
              const done = times(level.id)
              const stars = Math.min(done, 3)
              return (
                <button
                  key={level.id}
                  type="button"
                  disabled={!open}
                  aria-label={open ? level.name : `${level.name} — låst`}
                  onPointerDown={() => open && speak(level.name)}
                  onClick={() => { sfx.whoosh(); onStart(level.id) }}
                  className={`tap-target flex items-center gap-4 rounded-3xl px-4 py-4 text-left ring-1 disabled:opacity-40 ${
                    level.festival ? 'card-sheen ring-amber-200/50' : 'ring-white/15'
                  }`}
                  style={{ background: level.festival ? 'rgba(255, 209, 102, 0.18)' : 'rgba(255,255,255,0.09)' }}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl font-black tabular-nums"
                    style={{ background: done > 0 ? island.palette.accent : 'rgba(255,255,255,0.14)', color: done > 0 ? '#1b1233' : 'white' }}>
                    {open ? (level.festival ? '🎉' : index + 1) : '🔒'}
                  </span>
                  <span className="flex-1">
                    <span className="block text-lg font-black">{level.name}</span>
                    <span className="block text-xs uppercase tracking-widest opacity-60">
                      {level.festival ? 'Fest · alt du har lært' : `${level.size} opgaver`}
                    </span>
                  </span>
                  <span className="text-lg tracking-tight">
                    {'⭐️'.repeat(stars)}{'·'.repeat(Math.max(0, 3 - stars))}
                  </span>
                </button>
              )
            })}

            <div className="mt-3 flex items-center justify-center gap-2 opacity-80">
              {island.species.map((s, i) => {
                const found = save.creatures.some((c) => c.speciesId === s.id)
                return found ? (
                  <Creature key={s.id} look={lookFor(s.id, i, hueOf(island.palette.glow))} size={44} />
                ) : (
                  <span key={s.id} className="grid h-11 w-11 place-items-center rounded-full bg-black/25 text-lg">?</span>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
