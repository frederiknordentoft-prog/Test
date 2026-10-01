// The meadow of Dyrehaven (SPEC §6, §11): every animal the child has, the buddy first and largest,
// then the newest friend first, with the decor on its fixed places in between. Animals in the
// animation plan are rigs that move their parts; all others are still pictures that only breathe as
// a whole (transform), so the meadow holds any number of friends inside the DOM budget.
import type { CSSProperties } from 'react'
import { hashSeed } from '../../../../engine/rng'
import type { Animal, DecorId } from '../../../../engine/types'
import type { Outfit } from '../../../../art/rig/types'
import { Icon } from '../../../design/Icon'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { Figure, lookOf, seedOf, type SpeciesDefs } from './art'
import { DecorArt } from './Decor'
import { nameParts, type AnimationPlan, type MeadowCell } from './model'

export interface MeadowProps {
  cells: readonly MeadowCell[]
  plan: AnimationPlan
  defs: SpeciesDefs
  outfits: Readonly<Record<string, Outfit | undefined>>
  /** The newest animal gets a small "Ny" flag. */
  newest: string | null
  /** The animal tapped last hops once. */
  hop: { uid: string; n: number } | null
  onAnimal(animal: Animal, el: HTMLElement): void
}

export function Meadow({ cells, plan, defs, outfits, newest, hop, onAnimal }: MeadowProps) {
  return (
    <div className="zoo-meadow" data-meadow={cells.length}>
      <div className="zoo-meadow__grid">
        {cells.map((cell) =>
          cell.kind === 'animal' ? (
            <AnimalCell
              key={cell.animal.uid}
              animal={cell.animal}
              buddy={cell.buddy}
              animated={plan.meadow.has(cell.animal.uid)}
              def={defs[cell.animal.species]}
              outfit={outfits[cell.animal.uid]}
              isNew={cell.animal.uid === newest}
              hopN={hop?.uid === cell.animal.uid ? hop.n : 0}
              onTap={onAnimal}
            />
          ) : (
            <DecorCell key={cell.id} id={cell.id} />
          ),
        )}
      </div>
    </div>
  )
}

/** A small, stable offset per cell so the meadow does not look like a grid. */
const drift = (key: string): CSSProperties => {
  const h = hashSeed(key)
  return { '--dy': `${(h % 15) - 4}px`, '--delay': `${-((h >> 4) % 40) / 10}s` } as CSSProperties
}

function AnimalCell({ animal, buddy, animated, def, outfit, isNew, hopN, onTap }: {
  animal: Animal
  buddy: boolean
  animated: boolean
  def: SpeciesDefs[keyof SpeciesDefs]
  outfit: Outfit | undefined
  isNew: boolean
  hopN: number
  onTap(animal: Animal, el: HTMLElement): void
}) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  return (
    <button
      type="button"
      className={cx('zoo-cell tv-touch', buddy && 'zoo-cell--buddy', animated ? 'is-live' : 'is-still')}
      style={drift(animal.uid)}
      aria-label={animal.name}
      onClick={(e) => {
        speech.speak(nameParts(animal.name))
        onTap(animal, e.currentTarget)
      }}
      data-uid={animal.uid}
      data-animated={animated ? '' : undefined}
      {...pressProps}
    >
      <span className="zoo-cell__stage" key={hopN} data-hop={hopN > 0 ? '' : undefined}>
        <Figure look={lookOf(animal)} def={def} outfit={outfit} animated={animated} mood={buddy ? 'happy' : 'idle'} seed={seedOf(animal.uid)} px={buddy ? 192 : 128} className="zoo-cell__fig" />
        {isNew && (
          <span className="zoo-cell__new">
            <SpokenText clip="s.zoo.new" silent />
          </span>
        )}
      </span>
      <span className="zoo-tag">
        {buddy && <Icon name="heart" solid size={18} className="zoo-tag__heart" />}
        <SpokenText parts={nameParts(animal.name)} text={animal.name} silent className="zoo-tag__name" />
      </span>
    </button>
  )
}

function DecorCell({ id }: { id: DecorId }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const clip = `name.decor.${id}`
  return (
    <button
      type="button"
      className="zoo-cell zoo-cell--decor tv-touch"
      style={drift(id)}
      aria-label={speech.text(clip)}
      onClick={() => speech.speak([{ clip }])}
      data-decor-cell={id}
      {...pressProps}
    >
      <DecorArt id={id} className="zoo-cell__decor" />
    </button>
  )
}
