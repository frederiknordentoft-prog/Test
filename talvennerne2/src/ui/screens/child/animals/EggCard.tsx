// The egg in Dyrehaven (SPEC §5.7, §6.2): its warmth as a meter without numbers, the species it will
// become (the child picks among the unlocked ones and may change it until it hatches), and the hatch:
// three taps on a warm egg, and the new friend pops out to be named. Nothing here can be lost — a
// half-tapped egg simply waits, warm.
import { useState } from 'react'
import type { Animal, SpeciesId } from '../../../../engine/types'
import { playSfx } from '../../../../audio/sfx'
import { HATCH_TAPS } from '../../../../meta/ceremonyQueue'
import type { Reward } from '../../../../meta/rewards'
import { useMeta } from '../../../../state/useMeta'
import { Button } from '../../../design/Button'
import { Meter } from '../../../design/Meter'
import { SpokenText } from '../../../design/SpokenText'
import { pop } from '../../../design/motion'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { Figure, type SpeciesDefs } from './art'
import { EggArt } from './EggArt'
import type { EggModel } from './model'

export interface EggCardProps {
  egg: EggModel
  defs: SpeciesDefs
  onHatched(animal: Animal): void
}

export function EggCard({ egg, defs, onHatched }: EggCardProps) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const [taps, setTaps] = useState(0)
  const [picking, setPicking] = useState(false)
  const choosing = egg.species === null && egg.options.length > 1

  const tap = (el: HTMLElement) => {
    if (!egg.ready) {
      pop(el, 1.04)
      speech.speak([{ clip: 's.ui.meter.egg' }])
      return
    }
    if (!egg.species) {
      setPicking(true)
      speech.speak([{ clip: 's.reward.egg.choose' }])
      return
    }
    const n = taps + 1
    if (n < HATCH_TAPS) {
      setTaps(n)
      playSfx('pop')
      speech.speak([{ clip: 's.reward.egg.tap' }])
      return
    }
    const rewards = useMeta.getState().openEgg(egg.species)
    const hatch = rewards?.find((r): r is Extract<Reward, { t: 'hatch' }> => r.t === 'hatch')
    setTaps(0)
    if (!hatch) return
    playSfx('klaek')
    onHatched(hatch.animal)
  }

  const pick = (species: SpeciesId) => {
    useMeta.getState().chooseEggSpecies(species)
    setPicking(false)
    speech.speak([{ clip: `name.species.${species}` }])
  }

  const prompt = egg.ready ? (egg.species ? (taps === 0 ? 's.reward.egg.ready' : 's.reward.egg.tap') : 's.reward.egg.choose') : null

  return (
    <section className={cx('zoo-eggcard', egg.ready && 'is-ready')} data-egg-card={egg.ready ? 'ready' : 'warming'}>
      <button
        type="button"
        className="zoo-eggcard__egg tv-touch"
        aria-label={speech.text(prompt ?? 's.ui.meter.egg')}
        onClick={(e) => tap(e.currentTarget)}
        data-egg=""
        {...pressProps}
      >
        <EggArt taps={taps} ready={egg.ready && !!egg.species} key={taps} className={cx(taps > 0 && 'is-tapped')} />
      </button>
      <div className="zoo-eggcard__info">
        <SpokenText as="h2" clip="s.zoo.egg" className="zoo-h2" />
        <Meter kind="egg" value={egg.warmth} size="md" className="zoo-eggcard__meter" />
        {prompt && <SpokenText clip={prompt} className="zoo-eggcard__prompt" />}
        {egg.allFound && <SpokenText clip="s.zoo.egg.allFound" className="zoo-eggcard__note" />}
        {egg.species && !picking && (
          <div className="zoo-eggcard__species">
            <SpokenText clip="s.zoo.egg.becomes" className="zoo-eggcard__becomes" />
            <span className="zoo-eggcard__chip">
              <Figure look={{ species: egg.species }} def={defs[egg.species]} crop="head" px={56} className="zoo-eggcard__chipfig" />
              <SpokenText clip={`name.species.${egg.species}`} />
            </span>
            {egg.options.length > 1 && <Button clip="s.zoo.egg.change" size="md" variant="quiet" onClick={() => setPicking(true)} data-egg-change="" />}
          </div>
        )}
      </div>
      {(choosing || picking) && egg.options.length > 0 && (
        <div className="zoo-eggcard__pick" data-egg-pick="">
          <SpokenText as="h3" clip="s.reward.egg.choose" className="zoo-h3" />
          <div className="zoo-eggcard__options">
            {egg.options.map((s) => (
              <SpeciesOption key={s} species={s} on={s === egg.species} defs={defs} onPick={() => pick(s)} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function SpeciesOption({ species, on, defs, onPick }: { species: SpeciesId; on: boolean; defs: SpeciesDefs; onPick(): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  return (
    <button
      type="button"
      className={cx('zoo-option tv-touch', on && 'is-on')}
      aria-pressed={on}
      aria-label={speech.text(`name.species.${species}`)}
      onClick={onPick}
      data-species-option={species}
      {...pressProps}
    >
      <Figure look={{ species }} def={defs[species]} crop="head" px={72} className="zoo-option__fig" />
      <SpokenText clip={`name.species.${species}`} silent className="zoo-option__label" />
    </button>
  )
}
