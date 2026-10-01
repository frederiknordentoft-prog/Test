// The hatch, always the last ceremony (SPEC §5.7–5.8, §6.2): pick the egg's species when it is not
// chosen yet, tap the egg three times (it wobbles and cracks), and the new friend pops out to be
// named. "Næste" opens the egg at once (the reveal is never skipped); while the species is still
// to be picked it leaves the egg warm for later — nothing is lost.
import { useCallback, useEffect, useRef, useState } from 'react'
import { playSfx } from '../../../../audio/sfx'
import type { Animal, SpeciesId } from '../../../../engine/types'
import { HATCH_TAPS } from '../../../../meta/ceremonyQueue'
import type { Reward } from '../../../../meta/rewards'
import { useMeta } from '../../../../state/useMeta'
import { useProfile } from '../../../../state/useProfile'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { Egg } from './Egg'
import { NewFriend, PickAnimal } from './Steps'

export interface HatchScreenProps {
  reward: Extract<Reward, { t: 'eggReady' }>
  /** The parent's "Næste". */
  nextSignal: number
  onAdvance(): void
}

export function HatchScreen({ reward, nextSignal, onAdvance }: HatchScreenProps) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const chosen = useProfile((s) => s.profile?.economy.eggSpecies ?? null)
  const options = reward.options
  const [species, setSpecies] = useState<SpeciesId | null>(
    () => reward.species ?? (chosen && options.includes(chosen) ? chosen : null) ?? (options.length === 1 ? options[0] : null),
  )
  const [taps, setTaps] = useState(0)
  const [born, setBorn] = useState<Animal | null>(null)
  const [wobble, setWobble] = useState(0)
  const signal = useRef(nextSignal)

  const open = useCallback(
    (sp: SpeciesId) => {
      const rewards = useMeta.getState().openEgg(sp)
      const hatch = rewards?.find((r): r is Extract<Reward, { t: 'hatch' }> => r.t === 'hatch')
      if (!hatch) {
        onAdvance()
        return
      }
      playSfx('klaek')
      setBorn(hatch.animal)
    },
    [onAdvance],
  )

  useEffect(() => {
    if (nextSignal === signal.current) return
    signal.current = nextSignal
    if (born || !species) onAdvance()
    else open(species)
  }, [nextSignal, born, species, open, onAdvance])

  const pick = (sp: SpeciesId) => {
    if (useProfile.getState().profile?.economy.eggSpecies !== sp) useMeta.getState().chooseEggSpecies(sp)
    setSpecies(sp)
    speech.speak([{ clip: 's.reward.egg.ready' }])
  }

  const tap = () => {
    if (!species || born) return
    const n = taps + 1
    setTaps(n)
    setWobble((w) => w + 1)
    playSfx('pop')
    if (n >= HATCH_TAPS) open(species)
    else speech.speak([{ clip: 's.reward.egg.tap' }])
  }

  if (born) return <NewFriend animal={born} title="s.reward.egg.hatched" />
  if (!species) return <PickAnimal title="s.reward.egg.choose" options={options} onPick={pick} />
  return (
    <div className="tv-cer-hatch" data-cer-hatch={taps}>
      <button
        type="button"
        className="tv-cer-hatch__egg tv-touch"
        aria-label={speech.text(taps === 0 ? 's.reward.egg.ready' : 's.reward.egg.tap')}
        onClick={(e) => {
          e.stopPropagation()
          tap()
        }}
        data-egg=""
        {...pressProps}
      >
        <span className="tv-cer-hatch__glow" aria-hidden />
        <Egg taps={taps} open={false} className="tv-cer-hatch__shell" key={wobble} />
      </button>
      <SpokenText as="h1" clip={taps === 0 ? 's.reward.egg.ready' : 's.reward.egg.tap'} className="tv-cer__title" />
    </div>
  )
}
