import { ISLANDS } from '../../content/islands'
import { useProfile } from '../../state/useProfile'
import { sfx } from '../../audio/sfx'
import { Backdrop } from '../components/Backdrop'
import { Creature } from '../../art/Creature'
import { lookFor } from '../../art/creatureGen'
import { hueOf } from './RoundScreen'
import { speak } from '../../audio/speech'

/** The collection. Empty slots are the whole point — they are what pulls a child back. */
export function AlbumScreen({ onBack }: { onBack: () => void }) {
  const save = useProfile((s) => s.save)
  const setBuddy = useProfile((s) => s.setBuddy)
  const found = save.creatures.length
  const buddyUid = save.buddyUid || save.creatures[save.creatures.length - 1]?.uid
  const total = ISLANDS.reduce((n, i) => n + i.species.length, 0)

  return (
    <div className={`app-height relative overflow-hidden ${save.settings.motion ? '' : 'calm'}`}>
      <Backdrop palette={{ skyFrom: '#1b1233', skyTo: '#33245f', ground: '#150e29', accent: '#ffd166', glow: '#a78bfa' }} seed="album" />

      <div className="safe-top safe-x safe-bottom relative z-10 flex h-full flex-col">
        <header className="flex items-center gap-3 px-4 pb-1 pt-3">
          <button type="button" onClick={onBack} aria-label="Tilbage"
            className="tap-target grid h-12 w-12 min-h-0 place-items-center rounded-2xl bg-black/25 text-xl ring-1 ring-white/20">‹</button>
          <div>
            <p className="text-xl font-black leading-tight">📖 Album</p>
            <p className="text-sm opacity-90">
              {found} {found === 1 ? 'talven' : 'talvenner'} · {new Set(save.creatures.map((c) => c.speciesId)).size} af {total} slags
            </p>
          </div>
        </header>

        {found > 0 && (
          <p className="px-4 pb-1 text-center text-sm opacity-85">
            Tryk på en talven for at tage den med på tur
          </p>
        )}

        <div className="scroll-y flex-1 px-4 py-3">
          <div className="mx-auto flex max-w-md flex-col gap-5">
            {ISLANDS.map((island) => (
              <section key={island.id}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-widest opacity-70">
                  <span>{island.emoji}</span> {island.name}
                </h2>
                <div className="grid grid-cols-3 gap-2.5">
                  {island.species.map((species) => {
                    const mine = save.creatures.filter((c) => c.speciesId === species.id)
                    const best = mine.find((c) => c.golden) ?? mine[0]
                    const isBuddy = best !== undefined && best.uid === buddyUid
                    return (
                      <button key={species.id} type="button" disabled={!best}
                        aria-label={best ? `Tag ${best.name} med på tur` : `${species.name} ikke fundet`}
                        onClick={() => { if (best) { sfx.pop(); setBuddy(best.uid); speak(`${best.name} kommer med!`) } }}
                        onPointerDown={() => best && speak(best.name)}
                        className="relative flex flex-col items-center gap-1 rounded-2xl px-1 py-3 ring-1 transition-transform active:scale-95"
                        style={{
                          background: best ? `linear-gradient(150deg, ${island.palette.skyFrom}, ${island.palette.skyTo})` : 'rgba(255,255,255,0.05)',
                          boxShadow: isBuddy ? `0 0 0 3px ${island.palette.accent}` : 'none',
                          ['--tw-ring-color' as string]: 'rgba(255,255,255,0.14)',
                        }}>
                        {isBuddy && (
                          <span className="absolute -top-2 right-1 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-black text-[#1b1233]">
                            med på tur
                          </span>
                        )}
                        {best ? (
                          <>
                            <Creature look={lookFor(species.id, best.variant, hueOf(island.palette.glow))} size={62} golden={best.golden} />
                            <span className="max-w-full truncate px-1 text-sm font-black">{best.name}</span>
                            <span className="text-[10px] uppercase tracking-widest opacity-85">
                              {species.name}{mine.length > 1 ? ` ×${mine.length}` : ''}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="grid h-[62px] w-[62px] place-items-center text-3xl opacity-50">?</div>
                            <span className="text-sm font-black opacity-55">???</span>
                            <span className="text-[10px] uppercase tracking-widest opacity-50">ikke fundet</span>
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
