// Samlebogen (SPEC §6.1): one page per species, picked from a strip of all sixteen. A page shows
// every breed in its six colours plus the golden and rainbow animal (and the Stjernefølet on the
// unicorn's page). Found animals are in colour with their name; the others are silhouettes, and a tap
// reads "Sådan får du den". The count is plain: found of all, never a percentage, never a rarity.
import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Animal, ProfileDoc, SpeciesId, SpeechPart } from '../../../../engine/types'
import { SPECIES } from '../../../../content/catalog'
import { Button } from '../../../design/Button'
import { Icon } from '../../../design/Icon'
import { Sheet } from '../../../design/Sheet'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { Figure, isDrawn, useSpeciesDefs, type SpeciesDefs } from '../animals/art'
import { kindClips, lineText, nameParts, sentenceText } from '../animals/model'
import { collectionModel, type CollectionCard, type CollectionPage } from './model'

const ALL_SPECIES = SPECIES.map((s) => s.id)

/** Found and all, as one spoken line: "Fundet fire af tyve". */
export function foundParts(found: number, total: number): SpeechPart[] {
  return [{ clip: 's.books.found' }, { num: found, form: 'mid' }, { clip: 's.books.of' }, { num: total, form: 'end' }]
}

function firstSpecies(p: ProfileDoc, pages: readonly CollectionPage[]): SpeciesId {
  const buddy = p.animals.find((a) => a.uid === p.buddyUid)
  if (buddy) return buddy.species
  return pages.find((pg) => pg.found > 0)?.species ?? 'rabbit'
}

export function CollectionBook({ profile, onVisit }: { profile: ProfileDoc; onVisit(uid: string): void }) {
  const speech = useSpeech()
  const model = useMemo(() => collectionModel(profile), [profile.animals, profile.skillMedals, profile.nodes])
  const [species, setSpecies] = useState<SpeciesId>(() => firstSpecies(profile, model.pages))
  const [card, setCard] = useState<CollectionCard | null>(null)
  const defs = useSpeciesDefs(ALL_SPECIES)
  const page = model.pages.find((pg) => pg.species === species) ?? model.pages[0]
  const total = foundParts(model.found, model.total)

  return (
    <div className="bk-collection" data-book="collection">
      <SpokenText parts={total} text={lineText(total, speech.text)} className="bk-count" />
      <div className="bk-tabs" role="tablist">
        {model.pages.map((pg) => (
          <SpeciesTab key={pg.species} page={pg} on={pg.species === species} defs={defs} profile={profile} onPick={() => setSpecies(pg.species)} />
        ))}
      </div>
      <SpeciesPage page={page} defs={defs} onCard={setCard} />
      <CardSheet card={card} defs={defs} onClose={() => setCard(null)} onVisit={onVisit} />
    </div>
  )
}

function SpeciesTab({ page, on, defs, profile, onPick }: { page: CollectionPage; on: boolean; defs: SpeciesDefs; profile: ProfileDoc; onPick(): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const owned = profile.animals.find((a) => a.species === page.species && (a.colorway !== 'gold' && a.colorway !== 'rainbow'))
    ?? profile.animals.find((a) => a.species === page.species)
  const clip = `name.species.${page.species}`
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      className={cx('bk-tab tv-touch', on && 'is-on')}
      aria-label={speech.text(clip)}
      onClick={() => {
        speech.speak([{ clip }])
        onPick()
      }}
      data-species-tab={page.species}
      {...pressProps}
    >
      <Figure
        look={owned ? { species: page.species, breed: owned.breed, colorway: owned.colorway } : { species: page.species }}
        def={defs[page.species]}
        silhouette={!owned && isDrawn(page.species)}
        crop="head"
        px={64}
        className={cx('bk-tab__fig', !owned && 'is-missing')}
      />
      <SpokenText parts={[{ num: page.found, form: 'end' }]} text={String(page.found)} silent className="bk-tab__n" />
    </button>
  )
}

function SpeciesPage({ page, defs, onCard }: { page: CollectionPage; defs: SpeciesDefs; onCard(card: CollectionCard): void }) {
  const speech = useSpeech()
  const count = foundParts(page.found, page.total)
  return (
    <section className="bk-page" data-page={page.species}>
      <header className="bk-page__head">
        <SpokenText as="h2" clip={`name.species.${page.species}`} className="bk-h2" />
        <SpokenText parts={count} text={lineText(count, speech.text)} className="bk-page__count" />
      </header>
      {page.sections.map((sec) => (
        <div key={sec.title ?? sec.kind} className={cx('bk-section', sec.kind === 'magic' && 'bk-section--magic')}>
          {sec.title && <SpokenText as="h3" clip={sec.title} className="bk-h3" />}
          <div className="bk-cards">
            {sec.cards.map((c) => (
              <Card key={c.key} card={c} defs={defs} onTap={() => onCard(c)} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

const colorClip = (c: Pick<CollectionCard, 'species' | 'colorway'>) => `name.color.${c.species}.${c.colorway}`

function Card({ card, defs, onTap }: { card: CollectionCard; defs: SpeciesDefs; onTap(): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const owned = card.owned
  const magic = card.colorway === 'gold' || card.colorway === 'rainbow' || card.colorway === 'starwhite'
  const label = owned ? owned.name : card.colorway === 'starwhite' ? speech.text('s.books.starfoal') : speech.text(colorClip(card))
  return (
    <button
      type="button"
      className={cx('bk-card tv-touch', owned ? 'is-found' : 'is-missing', magic && `bk-card--${card.colorway}`)}
      aria-label={label}
      onClick={() => {
        speech.speak(owned ? [...nameParts(owned.name), ...kindClips(owned).map((clip) => ({ clip }))] : [{ clip: 's.books.how' }, ...(card.how ?? [])])
        onTap()
      }}
      data-card={card.key}
      data-found={owned ? '' : undefined}
      {...pressProps}
    >
      <Figure
        look={{ species: card.species, breed: card.breed, colorway: card.colorway, stage: owned ? undefined : 2 }}
        def={defs[card.species]}
        silhouette={!owned}
        crop="fit"
        px={96}
        mood={owned ? 'happy' : 'idle'}
        className="bk-card__fig"
      />
      <span className="bk-card__label">
        {owned ? (
          <SpokenText parts={nameParts(owned.name)} text={owned.name} silent />
        ) : (
          <SpokenText clip={card.colorway === 'starwhite' ? 's.books.starfoal' : colorClip(card)} silent />
        )}
      </span>
      {!owned && (
        <span className="bk-card__q" aria-hidden>
          <Icon name="question" size={18} strokeWidth={2.6} />
        </span>
      )}
    </button>
  )
}

/** The card, large: a found animal with its name and a way to it, or how to find one. */
function CardSheet({ card, defs, onClose, onVisit }: { card: CollectionCard | null; defs: SpeciesDefs; onClose(): void; onVisit(uid: string): void }) {
  const speech = useSpeech()
  const owned: Animal | null = card?.owned ?? null
  return (
    <Sheet open={!!card} onClose={onClose} title={card && !owned ? 's.books.how' : undefined}>
      {card && (
        <div className="bk-detail" data-detail={card.key}>
          <div className="bk-detail__stage">
            <Figure
              look={{ species: card.species, breed: card.breed, colorway: card.colorway }}
              def={defs[card.species]}
              silhouette={!owned}
              px={200}
              mood={owned ? 'happy' : 'idle'}
              className={cx(!owned && 'is-missing')}
            />
          </div>
          {owned ? (
            <>
              <SpokenText as="h2" parts={nameParts(owned.name)} text={owned.name} className="bk-detail__name" />
              <KindLine animal={owned} />
              <Button clip="s.books.visit" icon="paw" size="md" variant="primary" onClick={() => onVisit(owned.uid)} data-visit="" />
            </>
          ) : (
            <>
              <SpokenText parts={card.how ?? []} text={sentenceText(card.how ?? [], speech.text)} className="bk-detail__how" />
              {card.breedSteps !== null && (
                <span className="bk-steps" aria-hidden>
                  {[0, 1].map((i) => (
                    <span key={i} className={cx('bk-steps__dot', i < (card.breedSteps ?? 0) && 'is-on')} style={{ '--i': i } as CSSProperties}>
                      <Icon name="paw" size={22} solid={i < (card.breedSteps ?? 0)} />
                    </span>
                  ))}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}

function KindLine({ animal }: { animal: Animal }) {
  const speech = useSpeech()
  const parts = kindClips(animal).map((clip) => ({ clip }))
  return <SpokenText parts={parts} text={lineText(parts, speech.text, ', ')} className="bk-detail__kind" />
}
