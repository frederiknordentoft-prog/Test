// The parts of the wardrobe (SPEC §7): the animal picker, the dressed animal on its spot, the three
// colours of the thing it wears, the six slot tabs, the panel with the child's things (choosable)
// and everything else as outlines, and the "Sådan får du den" sheet. Props in, taps out; the screen
// holds the state and talks to the game layer.
import { ITEM_BY_ID } from '../../../../content/catalog'
import type { Animal, ItemColor, ItemId, Mood, Slot, SpeechPart } from '../../../../engine/types'
import { Rig } from '../../../../art/rig/Rig'
import type { Stage } from '../../../../art/rig/types'
import { Button, IconButton } from '../../../design/Button'
import { Icon } from '../../../design/Icon'
import { Pill } from '../../../design/Pill'
import { Sheet } from '../../../design/Sheet'
import { SpokenText } from '../../../design/SpokenText'
import { isCalm } from '../../../design/motion'
import { useSpeech } from '../../../design/speech'
import { cx } from '../../../design/cx'
import { AnimalPicture, useOutfit, useSpeciesDef } from '../map/art'
import { SlotGlyph } from './glyphs'
import { ItemThumb } from './ItemThumb'
import { COLORS, SLOTS, SLOT_CLIP, animalNameSpeech, shownText, sourceBadge, type SlotModel } from './model'
import { Tap, useLastShown } from './Tap'

// ─── Animals ────────────────────────────────────────────────────────────────

export function AnimalPicker({ animals, selected, buddyUid, onPick }: {
  animals: readonly Animal[]
  selected: string | null
  buddyUid: string | null
  onPick(animal: Animal): void
}) {
  const speech = useSpeech()
  return (
    <div className="tv-wr-animals" role="radiogroup" aria-label={speech.text('s.wardrobe.title')} data-animals="">
      {animals.map((a) => (
        <Tap
          key={a.uid}
          role="radio"
          aria-checked={a.uid === selected}
          label={a.name}
          className={cx('tv-wr-animal', a.uid === selected && 'is-on')}
          onTap={() => {
            speech.speak(animalNameSpeech(a))
            onPick(a)
          }}
          data-animal={a.uid}
        >
          <AnimalPicture animal={a} size={46} crop="head" mood="happy" className="tv-wr-animal__pic" />
          {a.uid === buddyUid && (
            <span className="tv-wr-animal__heart" aria-hidden>
              <Icon name="heart" size={13} solid strokeWidth={2} />
            </span>
          )}
        </Tap>
      ))}
    </div>
  )
}

/** The animal on its spot in the middle, dressed (things that are not drawn yet stay off the picture). */
export function DressedAnimal({ animal, mood }: { animal: Animal | null; mood: Mood }) {
  const def = useSpeciesDef(animal?.species)
  const outfit = useOutfit(animal)
  const calm = isCalm()
  const stage = (animal ? (animal.shown === 'star' ? 3 : animal.shown) : 2) as Stage
  return (
    <div className="tv-wr-figure" data-figure={animal?.species ?? ''} data-mood={mood}>
      <span className="tv-wr-figure__light" aria-hidden />
      <span className="tv-wr-figure__floor" aria-hidden />
      {def && animal ? (
        <Rig
          species={def}
          breed={animal.breed}
          stage={stage}
          colorway={animal.colorway}
          star={animal.shown === 'star'}
          mood={mood}
          outfit={outfit}
          seed={7}
          size="100%"
          crop="full"
          className={cx('tv-wr-figure__rig', calm && 'rig-calm')}
        />
      ) : (
        <span className="tv-wr-figure__stand" aria-hidden>
          <Icon name="paw" size="58%" strokeWidth={2} />
        </span>
      )}
    </div>
  )
}

// ─── The three colours of the thing that is on ─────────────────────────────

export function ColorBar({ item, owned, on, onPick }: {
  item: ItemId
  owned: readonly ItemColor[]
  on: ItemColor | null
  onPick(color: ItemColor): void
}) {
  const speech = useSpeech()
  const name = speech.text(ITEM_BY_ID[item].nameClip)
  return (
    <div className="tv-wr-colors" role="group" aria-label={speech.text('s.wardrobe.colors')} data-colors={item}>
      {COLORS.map((c) => {
        const have = owned.includes(c)
        return (
          <Tap
            key={c}
            label={`${name} ${c + 1}`}
            aria-pressed={on === c}
            className={cx('tv-wr-color', have ? 'is-owned' : 'is-shop', on === c && 'is-on')}
            onTap={() => onPick(c)}
            data-color={c}
            data-owned={have ? '' : undefined}
          >
            <ItemThumb item={item} color={c} className="tv-wr-color__pic" />
            {!have && (
              <span className="tv-wr-color__badge" aria-hidden>
                <Icon name="shop" size={15} strokeWidth={2.4} />
              </span>
            )}
          </Tap>
        )
      })}
    </div>
  )
}

/** "Tag af": the thing that is on comes off (a tap on its card does the same). */
export function OffButton({ item, onOff }: { item: ItemId; onOff(): void }) {
  return <IconButton icon="close" clip="s.wardrobe.off" variant="card" className="tv-wr-off" onClick={onOff} data-off={item} />
}

// ─── The six slots ──────────────────────────────────────────────────────────

export function SlotTabs({ active, worn, locked, onPick }: {
  active: Slot
  worn: Partial<Record<Slot, boolean>>
  locked: Partial<Record<Slot, boolean>>
  onPick(slot: Slot): void
}) {
  const speech = useSpeech()
  return (
    <div className="tv-wr-tabs" role="tablist" aria-label={speech.text('s.wardrobe.title')}>
      {SLOTS.map((slot) => (
        <Tap
          key={slot}
          role="tab"
          aria-selected={slot === active}
          label={speech.text(SLOT_CLIP[slot])}
          className={cx('tv-wr-tab', slot === active && 'is-on')}
          onTap={() => {
            speech.speak([{ clip: SLOT_CLIP[slot] }])
            onPick(slot)
          }}
          data-slot={slot}
          data-active={slot === active ? '' : undefined}
        >
          <span className="tv-wr-tab__face">
            <SlotGlyph slot={slot} size={28} strokeWidth={2.2} className="tv-wr-tab__glyph" />
            <SpokenText clip={SLOT_CLIP[slot]} silent className="tv-wr-tab__label" />
          </span>
          {worn[slot] && <span className="tv-wr-tab__dot" aria-hidden />}
          {locked[slot] && (
            <span className="tv-wr-tab__lock" aria-hidden>
              <Icon name="lock" size={14} strokeWidth={2.4} />
            </span>
          )}
        </Tap>
      ))}
    </div>
  )
}

// ─── The panel of one slot ──────────────────────────────────────────────────

export interface SlotPanelProps {
  model: SlotModel
  /** Pointed at: a soft ring, and a hand while it is not on. */
  guide: ItemId | null
  /** The colour a card shows when the thing is not on (the last one picked). */
  colorOf(item: ItemId): ItemColor
  onCard(item: ItemId): void
  onOther(item: ItemId): void
}

export function SlotPanel({ model, guide, colorOf, onCard, onOther }: SlotPanelProps) {
  const speech = useSpeech()
  if (model.locked) {
    return (
      <div className="tv-wr-panel" data-panel={model.slot} data-locked="">
        <div className="tv-wr-note">
          <Icon name="lock" size={30} strokeWidth={2.2} className="tv-wr-note__icon" />
          <SpokenText clip="s.wardrobe.wings" className="tv-wr-note__text" />
        </div>
      </div>
    )
  }
  return (
    <div className="tv-wr-panel" data-panel={model.slot}>
      {model.owned.length > 0 ? (
        <section className="tv-wr-shelf">
          <SpokenText as="h2" clip="s.wardrobe.mine" className="tv-wr-h" />
          <div className="tv-wr-grid">
            {model.owned.map(({ meta, colors }) => {
              const on = model.worn?.item === meta.id
              const pointed = guide === meta.id
              return (
                <Tap
                  key={meta.id}
                  label={speech.text(meta.nameClip)}
                  aria-pressed={on}
                  className={cx('tv-wr-card', 'is-owned', on && 'is-on', pointed && 'is-guide')}
                  onTap={() => onCard(meta.id)}
                  data-item={meta.id}
                  data-owned=""
                  data-on={on ? '' : undefined}
                  data-guide={pointed ? '' : undefined}
                >
                  <span className="tv-wr-card__face">
                    <ItemThumb item={meta.id} color={on && model.worn ? model.worn.color : colorOf(meta.id)} className="tv-wr-card__pic" />
                    <span className="tv-wr-card__dots" aria-hidden>
                      {COLORS.map((c) => (
                        <span key={c} className={cx('tv-wr-card__dot', colors.includes(c) && 'is-owned')} />
                      ))}
                    </span>
                  </span>
                  {on && (
                    <span className="tv-wr-card__check" aria-hidden>
                      <Icon name="check" size={16} strokeWidth={3} />
                    </span>
                  )}
                  {pointed && (
                    <Pill tone="star" size="sm" icon="sparkle" className="tv-wr-card__new">
                      <SpokenText clip="s.wardrobe.new" silent />
                    </Pill>
                  )}
                  {pointed && !on && (
                    <span className="tv-wr-hand" aria-hidden>
                      <Icon name="hand" size={34} strokeWidth={2.2} />
                    </span>
                  )}
                </Tap>
              )
            })}
          </div>
        </section>
      ) : (
        <SpokenText as="p" clip="s.wardrobe.empty" className="tv-wr-empty" />
      )}
      {model.others.length > 0 && (
        <section className="tv-wr-shelf">
          <SpokenText as="h2" clip="s.wardrobe.more" className="tv-wr-h" />
          <div className="tv-wr-grid">
            {model.others.map((meta) => (
              <Tap
                key={meta.id}
                label={speech.text(meta.nameClip)}
                className={cx('tv-wr-card', 'is-other', meta.source.kind === 'medal' && 'is-gold')}
                onTap={() => onOther(meta.id)}
                data-item={meta.id}
                data-how=""
              >
                <span className="tv-wr-card__face">
                  <ItemThumb item={meta.id} ghost className="tv-wr-card__pic" />
                </span>
                <span className={cx('tv-wr-card__source', `is-${meta.source.kind}`)} aria-hidden>
                  <Icon name={sourceBadge(meta.source)} size={16} strokeWidth={2.4} />
                  {meta.source.kind === 'level' && <span className="tv-wr-card__n">{meta.source.level}</span>}
                </span>
              </Tap>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── "Sådan får du den" ─────────────────────────────────────────────────────

export interface HowTarget {
  item: ItemId
  /** A colour the child does not have yet, or null for the thing itself. */
  color: ItemColor | null
  speech: SpeechPart[]
}

export function HowSheet({ target: current, wished, canWish, onClose, onShop, onWish }: {
  target: HowTarget | null
  wished: boolean
  canWish: boolean
  onClose(): void
  onShop(): void
  onWish(): void
}) {
  const speech = useSpeech()
  const target = useLastShown(current)
  const meta = target ? ITEM_BY_ID[target.item] : null
  const toShop = !!target && (target.color !== null || meta?.source.kind === 'shop')
  return (
    <Sheet open={!!current} onClose={onClose} title={meta?.nameClip} className="tv-wr-how">
      {target && meta && (
        <div className="tv-wr-how__body" data-how-sheet={target.item}>
          <div className={cx('tv-wr-how__pic', meta.source.kind === 'medal' && target.color === null && 'is-gold')}>
            <ItemThumb item={target.item} color={target.color ?? 0} ghost={target.color === null} />
          </div>
          <div className="tv-wr-how__line">
            <span className={cx('tv-wr-how__badge', `is-${target.color === null ? meta.source.kind : 'shop'}`)} aria-hidden>
              <Icon name={target.color === null ? sourceBadge(meta.source) : 'shop'} size={28} strokeWidth={2.2} />
            </span>
            <div className="tv-wr-how__text">
              <SpokenText clip="s.wardrobe.how" className="tv-wr-how__label" />
              <SpokenText parts={target.speech} text={shownText(target.speech, speech.text)} className="tv-wr-how__say" />
            </div>
          </div>
          <div className="tv-wr-how__actions">
            {toShop && <Button clip="s.wardrobe.toShop" icon="shop" variant="primary" size="md" block onClick={onShop} data-to-shop="" />}
            {target.color === null && wished && (
              <Pill tone="primary" icon="pin" className="tv-wr-how__wished">
                <SpokenText clip="s.wardrobe.wished" silent />
              </Pill>
            )}
            {target.color === null && !wished && canWish && (
              <Button clip="s.wardrobe.wish" icon="pin" variant="secondary" size="md" block onClick={onWish} data-wish={target.item} />
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}
