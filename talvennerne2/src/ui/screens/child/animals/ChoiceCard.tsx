// A golden or rainbow animal waiting to be picked (SPEC §6.2, pendingChoices): a gold medal lets the
// child choose one golden animal among the species of the medal's world, three stars on every stone
// of a region one rainbow animal. Tapping a species says its name; "Vælg den" takes it home. The
// choice waits as long as it takes — it never runs out.
import { useState } from 'react'
import type { Animal, SpeciesId } from '../../../../engine/types'
import { playSfx } from '../../../../audio/sfx'
import type { PendingChoice } from '../../../../meta/animals'
import { useMeta } from '../../../../state/useMeta'
import { useProfile } from '../../../../state/useProfile'
import { Button } from '../../../design/Button'
import { Icon } from '../../../design/Icon'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { Figure, type SpeciesDefs } from './art'

export interface ChoiceCardProps {
  choice: PendingChoice
  defs: SpeciesDefs
  onChosen(animal: Animal): void
}

export function ChoiceCard({ choice, defs, onChosen }: ChoiceCardProps) {
  const speech = useSpeech()
  const [selected, setSelected] = useState<SpeciesId | null>(choice.options.length === 1 ? choice.options[0] : null)
  const gold = choice.kind === 'gold'

  const take = () => {
    if (!selected) return
    const ok = gold ? useMeta.getState().chooseGolden(selected) : useMeta.getState().chooseRainbow(selected)
    if (!ok) return
    const animal = useProfile.getState().profile?.animals.find((a) => a.uid === `${choice.kind}-${selected}`)
    playSfx(gold ? 'guld' : 'glimmer')
    setSelected(null)
    if (animal) onChosen(animal)
  }

  return (
    <section className={cx('zoo-choice', `zoo-choice--${choice.kind}`)} data-choice={`${choice.kind}-${choice.world}`}>
      <div className="zoo-choice__head">
        <span className="zoo-choice__badge" aria-hidden>
          <Icon name={gold ? 'medal' : 'star'} solid size={30} />
        </span>
        <div className="zoo-choice__titles">
          <SpokenText as="h2" clip={gold ? 's.reward.gold.choose' : 's.reward.rainbow.choose'} className="zoo-h2" />
          <SpokenText clip={gold ? 's.zoo.magic.gold.about' : 's.zoo.magic.rainbow.about'} className="zoo-choice__about" />
        </div>
      </div>
      <div className="zoo-choice__options">
        {choice.options.map((s) => (
          <MagicOption
            key={s}
            species={s}
            kind={choice.kind}
            on={s === selected}
            defs={defs}
            onPick={() => {
              setSelected(s)
              speech.speak([{ clip: `name.species.${s}` }])
            }}
          />
        ))}
      </div>
      <Button clip="s.zoo.magic.pick" icon="check" variant={gold ? 'star' : 'primary'} size="md" disabled={!selected} onClick={take} data-choice-take="" />
    </section>
  )
}

function MagicOption({ species, kind, on, defs, onPick }: { species: SpeciesId; kind: 'gold' | 'rainbow'; on: boolean; defs: SpeciesDefs; onPick(): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  return (
    <button
      type="button"
      className={cx('zoo-option zoo-option--magic tv-touch', on && 'is-on')}
      aria-pressed={on}
      aria-label={speech.text(`name.species.${species}`)}
      onClick={onPick}
      data-magic-option={species}
      {...pressProps}
    >
      <Figure look={{ species, colorway: kind }} def={defs[species]} crop="fit" px={80} mood="happy" className="zoo-option__fig" />
      <SpokenText clip={`name.species.${species}`} silent className="zoo-option__label" />
    </button>
  )
}
