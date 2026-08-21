import { ISLANDS, LEVEL_BY_ID } from '../../content/islands'
import { islandMastery, isIslandUnlocked, levelsDoneOn, useProfile } from '../../state/useProfile'
import { today } from '../../state/storage'
import { Backdrop } from '../components/Backdrop'
import { ProgressRing } from '../components/ProgressRing'
import { Creature } from '../../art/Creature'
import { lookFor } from '../../art/creatureGen'
import { hueOf } from './RoundScreen'
import { speak } from '../../audio/speech'
import { sfx } from '../../audio/sfx'

interface Props {
  onOpenIsland: (islandId: string) => void
  onOpenAlbum: () => void
  onOpenMyIsland: () => void
  onOpenParent: () => void
  onPlayNext: () => void
  onResume: () => void
}

/** The world map. Every island is a subject, so the curriculum reads as geography. */
export function HomeScreen({ onOpenIsland, onOpenAlbum, onOpenMyIsland, onOpenParent, onPlayNext, onResume }: Props) {
  const save = useProfile((s) => s.save)
  const paused = save.pausedRound
  const pausedLevel = paused ? LEVEL_BY_ID.get(paused.levelId) : undefined

  return (
    <div className={`app-height relative overflow-hidden ${save.settings.motion ? '' : 'calm'}`}>
      <Backdrop palette={{ skyFrom: '#1b1233', skyTo: '#3b2a6b', ground: '#150e29', accent: '#ffd166', glow: '#a78bfa' }} seed="kort" />

      <div className="safe-top safe-x safe-bottom relative z-10 flex h-full flex-col">
        <header className="flex items-center gap-3 px-4 pb-2 pt-3">
          <button type="button" onClick={onOpenMyIsland} aria-label="Min ø"
            className="tap-target grid h-12 w-12 min-h-0 place-items-center rounded-2xl bg-white/12 text-2xl ring-1 ring-white/25">
            {save.avatar}
          </button>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">Talvennerne</p>
            <p className="text-lg font-black leading-tight">
              {save.childName ? `Hej ${save.childName}!` : 'Vælg en ø'}
            </p>
          </div>
          {save.streak.count > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-white/12 px-3 py-2 text-sm font-black ring-1 ring-white/25">
              🔥 <span className="tabular-nums">{save.streak.count}</span>
            </div>
          )}
          <button type="button" onClick={onOpenAlbum} aria-label="Album"
            className="tap-target grid h-12 w-12 min-h-0 place-items-center rounded-2xl bg-white/12 text-xl ring-1 ring-white/25">
            📖
          </button>
        </header>

        <WeekStrip days={save.streak.days} />

        {/* One tap to the next turn. A six-year-old should not have to navigate. */}
        <div className="px-4 pb-3">
          <div className="mx-auto max-w-md">
            {paused && pausedLevel ? (
              <button type="button" onClick={() => { sfx.whoosh(); onResume() }}
                aria-label={`Fortsæt turen ${pausedLevel.level.name}`}
                className="tap-target card-sheen flex h-20 w-full items-center gap-4 rounded-3xl px-5 text-left ring-2 ring-amber-200/60"
                style={{ background: 'rgba(255, 209, 102, 0.2)' }}>
                <span className="text-3xl">⏸️</span>
                <span className="flex-1">
                  <span className="block text-lg font-black">Fortsæt turen</span>
                  <span className="block text-sm opacity-90">
                    {pausedLevel.island.name} · {pausedLevel.level.name} · {paused.answered} af {paused.total} klaret
                  </span>
                </span>
                <span className="text-2xl">›</span>
              </button>
            ) : (
              <button type="button" onClick={() => { sfx.whoosh(); onPlayNext() }}
                className="tap-target h-20 w-full rounded-3xl bg-white/95 text-2xl font-black text-[#1b1233] shadow-[0_7px_0_rgba(0,0,0,0.32)]">
                ▶︎ Spil videre
              </button>
            )}
          </div>
        </div>

        <div className="scroll-y flex-1 px-4 pb-4">
          <div className="mx-auto flex max-w-md flex-col gap-3">
            {ISLANDS.map((island, index) => {
              const unlocked = isIslandUnlocked(save, index)
              const done = levelsDoneOn(save, island.id)
              const mastery = islandMastery(save, index)
              const look = lookFor(island.species[0].id, 0, hueOf(island.palette.glow))
              const previous = ISLANDS[index - 1]
              const towards = previous ? levelsDoneOn(save, previous.id) : 0

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
                  className="tap-target flex items-center gap-4 rounded-3xl p-3 text-left ring-1 ring-white/15"
                  style={{
                    // dim the card, never the words on it — the sentence explaining
                    // how to open an island used to be the least readable thing on screen
                    background: unlocked
                      ? `linear-gradient(120deg, ${island.palette.skyFrom}, ${island.palette.skyTo})`
                      : 'rgba(255,255,255,0.06)',
                    opacity: unlocked ? 1 : 0.92,
                  }}
                >
                  <ProgressRing value={unlocked ? mastery : towards / (previous?.unlockAfter ?? 1)}
                    color={unlocked ? island.palette.accent : 'rgba(255,255,255,0.5)'} size={70}>
                    {unlocked ? <Creature look={look} size={46} /> : <span className="text-2xl">🔒</span>}
                  </ProgressRing>

                  <span className="flex-1">
                    <span className="flex items-center gap-2 text-lg font-black">
                      <span>{island.emoji}</span>
                      {island.name}
                    </span>
                    <span className="block text-sm opacity-90">
                      {unlocked
                        ? island.tagline
                        : `${towards} af ${previous.unlockAfter} ture på ${previous.name}`}
                    </span>
                    {unlocked && (
                      <span className="mt-1.5 flex gap-1">
                        {island.levels.map((level) => (
                          <span key={level.id} className="h-1.5 w-5 rounded-full"
                            style={{ background: (save.levels[level.id] ?? 0) > 0 ? island.palette.accent : 'rgba(255,255,255,0.3)' }} />
                        ))}
                      </span>
                    )}
                  </span>

                  <span className="text-2xl opacity-90">{unlocked ? (done === island.levels.length ? '⭐️' : '›') : ''}</span>
                </button>
              )
            })}

            <button type="button" onClick={onOpenParent}
              className="tap-target mt-2 h-14 rounded-2xl bg-white/10 text-sm font-bold uppercase tracking-widest opacity-85 ring-1 ring-white/20">
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
            done ? 'bg-amber-300 text-[#1b1233]' : key === today() ? 'bg-white/14 ring-1 ring-white/50' : 'bg-white/10'
          }`}>
            {done ? '⭐️' : ''}
          </span>
          <span className="text-[10px] font-bold opacity-75">{letter}</span>
        </div>
      ))}
    </div>
  )
}
