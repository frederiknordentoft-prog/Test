import { ISLANDS } from '../../content/islands'
import { islandMastery, isIslandUnlocked, levelsDoneOn, useProfile } from '../../state/useProfile'
import { Backdrop } from '../components/Backdrop'
import { ProgressRing } from '../components/ProgressRing'
import { Creature } from '../../art/Creature'
import { lookFor } from '../../art/creatureGen'
import { hueOf } from './RoundScreen'
import { speak } from '../../audio/speech'
import { sfx } from '../../audio/sfx'
import { today } from '../../state/storage'

interface Props {
  onOpenIsland: (islandId: string) => void
  onOpenAlbum: () => void
  onOpenMyIsland: () => void
  onOpenParent: () => void
}

/** The world map. Every island is a subject, so the curriculum reads as geography. */
export function HomeScreen({ onOpenIsland, onOpenAlbum, onOpenMyIsland, onOpenParent }: Props) {
  const save = useProfile((s) => s.save)

  return (
    <div className={`app-height relative overflow-hidden ${save.settings.motion ? '' : 'calm'}`}>
      <Backdrop palette={{ skyFrom: '#1b1233', skyTo: '#3b2a6b', ground: '#150e29', accent: '#ffd166', glow: '#a78bfa' }} seed="kort" />

      <div className="safe-top safe-x safe-bottom relative z-10 flex h-full flex-col">
        <header className="flex items-center gap-3 px-4 pb-2 pt-3">
          <button type="button" onClick={onOpenMyIsland}
            className="tap-target grid h-12 w-12 min-h-0 place-items-center rounded-2xl bg-white/12 text-2xl ring-1 ring-white/20">
            {save.avatar}
          </button>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-widest opacity-60">Talvennerne</p>
            <p className="text-lg font-black leading-tight">
              {save.childName ? `Hej ${save.childName}!` : 'Vælg en ø'}
            </p>
          </div>
          {save.streak.count > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-white/12 px-3 py-2 text-sm font-black ring-1 ring-white/20">
              🔥 <span className="tabular-nums">{save.streak.count}</span>
            </div>
          )}
          <button type="button" onClick={onOpenAlbum} aria-label="Album"
            className="tap-target grid h-12 w-12 min-h-0 place-items-center rounded-2xl bg-white/12 text-xl ring-1 ring-white/20">
            📖
          </button>
        </header>

        <WeekStrip days={save.streak.days} />

        <div className="scroll-y flex-1 px-4 pb-4">
          <div className="mx-auto flex max-w-md flex-col gap-3">
            {ISLANDS.map((island, index) => {
              const unlocked = isIslandUnlocked(save, index)
              const done = levelsDoneOn(save, island.id)
              const mastery = islandMastery(save, index)
              const look = lookFor(island.species[0].id, 0, hueOf(island.palette.glow))

              return (
                <button
                  key={island.id}
                  type="button"
                  disabled={!unlocked}
                  aria-label={unlocked ? `${island.name} — ${island.tagline}` : `${island.name} — låst`}
                  onClick={() => {
                    sfx.whoosh()
                    onOpenIsland(island.id)
                  }}
                  onPointerDown={() => unlocked && speak(island.name)}
                  className="tap-target flex items-center gap-4 rounded-3xl p-3 text-left ring-1 ring-white/15 disabled:opacity-45"
                  style={{
                    background: unlocked
                      ? `linear-gradient(120deg, ${island.palette.skyFrom}, ${island.palette.skyTo})`
                      : 'rgba(255,255,255,0.07)',
                  }}
                >
                  <ProgressRing value={mastery} color={island.palette.accent} size={70}>
                    {unlocked ? (
                      <Creature look={look} size={46} />
                    ) : (
                      <span className="text-2xl opacity-70">🔒</span>
                    )}
                  </ProgressRing>

                  <span className="flex-1">
                    <span className="flex items-center gap-2 text-lg font-black">
                      <span>{island.emoji}</span>
                      {island.name}
                    </span>
                    <span className="block text-sm opacity-80">
                      {unlocked ? island.tagline : `Klar ${ISLANDS[index - 1].unlockAfter} ture på ${ISLANDS[index - 1].name}`}
                    </span>
                    {unlocked && (
                      <span className="mt-1.5 flex gap-1">
                        {island.levels.map((level) => (
                          <span key={level.id} className="h-1.5 w-5 rounded-full"
                            style={{ background: (save.levels[level.id] ?? 0) > 0 ? island.palette.accent : 'rgba(255,255,255,0.25)' }} />
                        ))}
                      </span>
                    )}
                  </span>

                  {unlocked && <span className="text-2xl opacity-70">{done === island.levels.length ? '⭐️' : '›'}</span>}
                </button>
              )
            })}

            <button type="button" onClick={onOpenParent}
              className="tap-target mt-2 h-14 rounded-2xl bg-white/8 text-sm font-bold uppercase tracking-widest opacity-70 ring-1 ring-white/15">
              For voksne
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


/**
 * The last seven days. A missed day is simply an empty circle — no red, no
 * "you broke your streak". The point is to invite the next day, not to punish
 * yesterday.
 */
function WeekStrip({ days }: { days: string[] }) {
  const played = new Set(days)
  const now = new Date()
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() - (6 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { key, letter: ['S', 'M', 'T', 'O', 'T', 'F', 'L'][d.getDay()], done: played.has(key) }
  })

  return (
    <div className="mx-auto mb-2 flex max-w-md items-center justify-center gap-2 px-4">
      {week.map(({ key, letter, done }) => (
        <div key={key} className="flex flex-col items-center gap-1">
          <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black transition-colors ${
            done ? 'bg-amber-300 text-[#1b1233]' : key === today() ? 'bg-white/12 ring-1 ring-white/40' : 'bg-white/8'
          }`}>
            {done ? '⭐️' : ''}
          </span>
          <span className="text-[10px] font-bold opacity-45">{letter}</span>
        </div>
      ))}
    </div>
  )
}
