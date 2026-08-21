import { useMemo, useState } from 'react'
import { ISLANDS, LEVEL_BY_ID } from '../../content/islands'
import { CREATURE_NAMES } from '../../content/names'
import { useProfile } from '../../state/useProfile'
import { useRound } from '../../state/useRound'
import { Backdrop } from '../components/Backdrop'
import { BigButton } from '../components/BigButton'
import { Creature, Egg } from '../../art/Creature'
import { lookFor } from '../../art/creatureGen'
import { hueOf } from './RoundScreen'
import { hashSeed, makeRng } from '../../engine/rng'
import { fx } from '../../fx/particles'
import { sfx } from '../../audio/sfx'
import { haptics } from '../../fx/haptics'
import { speak } from '../../audio/speech'

type Step = 'summary' | 'egg' | 'name' | 'done'

/**
 * The end of every round.
 *
 * There is always a creature — what varies is which one, not whether. A child who
 * sometimes gets nothing learns that practising might be pointless; a child who
 * always gets *something* comes back to find out what.
 */
export function RewardScreen({ onDone, onAgain }: { onDone: () => void; onAgain: () => void }) {
  const round = useRound()
  const save = useProfile((s) => s.save)
  const collect = useProfile((s) => s.collect)
  const [step, setStep] = useState<Step>('summary')
  const [cracks, setCracks] = useState(0)
  const [chosenName, setChosenName] = useState('')

  const entry = LEVEL_BY_ID.get(round.levelId)
  const island = entry?.island ?? ISLANDS[0]

  // prefer a species the child has not met yet — the album is the pull
  const prize = useMemo(() => {
    const rng = makeRng(hashSeed(`${round.levelId}:${save.totalRounds}:${round.bestStreak}`))
    const missing = island.species.filter((s) => !save.creatures.some((c) => c.speciesId === s.id))
    const species = missing.length > 0 ? missing[rng.int(missing.length)] : island.species[rng.int(island.species.length)]
    const variant = rng.int(1000)
    return {
      species,
      variant,
      look: lookFor(species.id, variant, hueOf(island.palette.glow)),
      suggestions: rng.shuffle(CREATURE_NAMES).slice(0, 6),
    }
    // deliberately frozen for the life of this screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const golden = round.goldenCaught

  const crack = (event: React.PointerEvent) => {
    const next = cracks + 1
    setCracks(next)
    haptics.tap()
    const { clientX: x, clientY: y } = event
    if (next >= 3) {
      sfx.hatch()
      haptics.hatch()
      fx.golden(x, y)
      fx.celebrate(window.innerWidth, window.innerHeight)
      window.setTimeout(() => {
        setStep('name')
        speak(`Du fik en ${prize.species.name}!`)
      }, 620)
    } else {
      sfx.pop()
      fx.gentle(x, y)
    }
  }

  const keep = () => {
    collect({
      uid: `${prize.species.id}-${Date.now()}`,
      speciesId: prize.species.id,
      islandId: island.id,
      variant: prize.variant,
      name: chosenName.trim() || prize.species.name,
      golden,
      foundAt: Date.now(),
      x: 0.2 + Math.random() * 0.6,
      y: 0.45 + Math.random() * 0.4,
    })
    setStep('done')
  }

  return (
    <div className={`app-height relative overflow-hidden ${save.settings.motion ? '' : 'calm'}`}>
      <Backdrop palette={island.palette} seed={`${island.id}-fest`} />

      <div className="safe-top safe-x safe-bottom relative z-10 flex h-full flex-col items-center justify-center gap-6 px-5">
        {step === 'summary' && (
          <div className="pop-in flex w-full max-w-sm flex-col items-center gap-6 rounded-[2rem] bg-[#1b1233]/70 p-6 ring-1 ring-white/15 backdrop-blur-sm">
            <p className="text-center text-3xl font-black">{entry?.level.name}</p>
            <div className="grid w-full grid-cols-3 gap-3 text-center">
              <Stat value={`${round.answered}`} label="rigtige" accent={island.palette.accent} />
              <Stat value={`${round.bestStreak}`} label="i træk" accent={island.palette.accent} />
              <Stat value={golden ? '⭐️' : round.mistakes === 0 ? '✨' : `${round.mistakes}`}
                label={golden ? 'guldæg' : round.mistakes === 0 ? 'fejlfri' : 'øve mere'} accent={island.palette.accent} />
            </div>
            <BigButton tone="gold" className="h-16 w-full text-2xl" onPress={() => { sfx.whoosh(); setStep('egg') }}>
              Åbn ægget
            </BigButton>
          </div>
        )}

        {step === 'egg' && (
          <div className="flex flex-col items-center gap-6">
            <p className="text-xl font-bold opacity-85">Tryk på ægget!</p>
            <button type="button" onPointerDown={crack} aria-label="Slå på ægget"
              className="grid place-items-center rounded-full p-2 active:scale-95">
              <Egg hue={golden ? 45 : hueOf(island.palette.accent)} size={220}
                cracked={cracks > 0} className={cracks > 0 ? 'egg-wobble' : 'drift'} />
            </button>
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2.5 w-8 rounded-full transition-colors"
                  style={{ background: i < cracks ? island.palette.accent : 'rgba(255,255,255,0.22)' }} />
              ))}
            </div>
          </div>
        )}

        {step === 'name' && (
          <div className="pop-in scroll-y flex max-h-full w-full max-w-sm flex-col items-center gap-4 rounded-[2rem] bg-[#1b1233]/75 p-5 ring-1 ring-white/15 backdrop-blur-sm">
            <Creature look={prize.look} mood="cheer" size={168} golden={golden} />
            <p className="text-center text-2xl font-black">
              {golden && <span className="text-amber-200">Sjælden! </span>}
              En {prize.species.name}
            </p>
            <p className="text-sm opacity-75">Hvad skal den hedde?</p>

            <div className="flex flex-wrap justify-center gap-2">
              {prize.suggestions.map((name) => (
                <button key={name} type="button"
                  onClick={() => { sfx.tap(); setChosenName(name); speak(name) }}
                  className={`tap-target min-h-0 rounded-full px-4 py-2.5 text-base font-black ring-1 transition-colors ${
                    chosenName === name ? 'bg-white text-[#1b1233] ring-white' : 'bg-white/20 ring-white/40'
                  }`}>
                  {name}
                </button>
              ))}
            </div>

            <input
              value={chosenName}
              onChange={(e) => setChosenName(e.target.value.slice(0, 14))}
              placeholder="… eller skriv selv"
              aria-label="Navn på din talven"
              className="w-full rounded-2xl bg-black/45 px-4 py-3 text-center text-lg font-bold ring-1 ring-white/30 outline-none placeholder:opacity-75 focus:ring-white/70"
            />

            <BigButton tone="primary" className="h-16 w-full text-2xl" onPress={keep}>
              Behold {chosenName.trim() || prize.species.name}
            </BigButton>
          </div>
        )}

        {/* The moment the child most wants to go again is right here. Do not make
            them walk back through the map to do it. */}
        {step === 'done' && (
          <div className="pop-in flex w-full max-w-sm flex-col items-center gap-5 rounded-[2rem] bg-[#1b1233]/75 p-6 ring-1 ring-white/15 backdrop-blur-sm">
            <Creature look={prize.look} mood="cheer" size={124} golden={golden} />
            <p className="text-center text-xl font-black">
              {chosenName.trim() || prize.species.name} flyttede ind på din ø
            </p>
            <div className="flex w-full flex-col gap-2">
              <BigButton tone="gold" className="h-16 w-full text-2xl" onPress={() => { sfx.whoosh(); onAgain() }}>
                ▶︎ En tur mere
              </BigButton>
              <BigButton tone="soft" className="h-14 w-full text-lg" onPress={onDone}>
                Til kortet
              </BigButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div className="rounded-2xl bg-black/25 px-2 py-3 ring-1 ring-white/15">
      <div className="text-3xl font-black tabular-nums" style={{ color: accent }}>{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-widest opacity-85">{label}</div>
    </div>
  )
}
