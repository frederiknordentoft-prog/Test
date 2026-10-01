// The parts of the shop (SPEC §5.7): the child's perler, the wish with its bar (no numbers), the three
// shelves (clothes in four sets, new colours, decor) with their fixed prices, and the sheet that asks
// before anything is bought — or says, warmly, that perler come from doing sums. Props in, taps out.
import { useEffect, useRef } from 'react'
import { ITEM_BY_ID } from '../../../../content/catalog'
import type { DecorId, ItemColor, ItemId, SpeechPart } from '../../../../engine/types'
import { Button, IconButton } from '../../../design/Button'
import { Icon } from '../../../design/Icon'
import { Meter } from '../../../design/Meter'
import { Pill } from '../../../design/Pill'
import { Sheet } from '../../../design/Sheet'
import { SpokenText } from '../../../design/SpokenText'
import { pop } from '../../../design/motion'
import { useSpeech } from '../../../design/speech'
import { cx } from '../../../design/cx'
import { DecorGlyph, Glyph, PALETTE_GLYPH } from '../wardrobe/glyphs'
import { ItemThumb } from '../wardrobe/ItemThumb'
import { howToGetItem, shownText, sourceBadge } from '../wardrobe/model'
import { Tap, useLastShown } from '../wardrobe/Tap'
import { DECOR_TONE, toneStyle } from '../wardrobe/tones'
import {
  costSpeech, perlerSpeech, priceOf, type ColorRow, type DecorRow, type Purchase, type SetShelf, type Shelf, type SheetStage, type WishView,
} from './model'

// ─── Perler ─────────────────────────────────────────────────────────────────

export function PerlerBadge({ perler }: { perler: number }) {
  const speech = useSpeech()
  const parts = perlerSpeech(perler)
  return (
    <Tap label={shownText(parts, speech.text)} className="tv-store-perler" onTap={() => speech.speak(parts)} data-perler={perler}>
      <span className="tv-store-perler__icon" aria-hidden>
        <Icon name="pearl" size="100%" strokeWidth={2.2} />
      </span>
      <span className="tv-store-perler__n">{perler}</span>
    </Tap>
  )
}

/** A price tag: a pearl and the number (read aloud by the sheet the tag opens). */
export function Price({ price }: { price: number }) {
  return (
    <span className="tv-store-price" aria-hidden>
      <Icon name="pearl" size={19} strokeWidth={2.4} className="tv-store-price__pearl" />
      <span className="tv-store-price__n">{price}</span>
    </span>
  )
}

// ─── The wish ───────────────────────────────────────────────────────────────

export function WishCard({ wish, onOpen, onRemove }: { wish: WishView | null; onOpen(): void; onRemove(): void }) {
  const speech = useSpeech()
  if (!wish) {
    return (
      <div className="tv-store-wish is-empty" data-wish="">
        <span className="tv-store-wish__pin" aria-hidden>
          <Icon name="pin" size={28} strokeWidth={2.2} />
        </span>
        <SpokenText clip="s.shop.wish.none" className="tv-store-wish__text" />
      </div>
    )
  }
  const meta = ITEM_BY_ID[wish.item]
  return (
    <div className={cx('tv-store-wish', wish.buyable && 'is-ready')} data-wish={wish.item}>
      <Tap label={speech.text(meta.nameClip)} className="tv-store-wish__thing" onTap={onOpen} data-wish-open="">
        <ItemThumb item={wish.item} className="tv-store-wish__pic" />
        <span className="tv-store-wish__pinned" aria-hidden>
          <Icon name="pin" size={14} strokeWidth={2.6} />
        </span>
      </Tap>
      <div className="tv-store-wish__mid">
        <span className="tv-store-wish__names">
          <SpokenText clip="s.shop.wish.title" className="tv-store-wish__label" />
          <SpokenText clip={meta.nameClip} className="tv-store-wish__name" />
        </span>
        {wish.buyable ? (
          <SpokenText clip="s.shop.wish.ready" className="tv-store-wish__ready" />
        ) : (
          <Meter kind="wish" value={wish.progress} size="sm" clip="s.shop.wish.meter" className="tv-store-wish__meter" />
        )}
      </div>
      <IconButton icon="close" clip="s.shop.wish.remove" variant="quiet" sayLabel onClick={onRemove} data-wish-remove="" />
    </div>
  )
}

// ─── The three shelves ──────────────────────────────────────────────────────

const SHELF: Record<Shelf, { clip: string; icon: 'shirt' | 'palette' | 'sparkle' }> = {
  clothes: { clip: 's.shop.tab.clothes', icon: 'shirt' },
  colors: { clip: 's.shop.tab.colors', icon: 'palette' },
  decor: { clip: 's.shop.tab.decor', icon: 'sparkle' },
}

export function ShelfTabs({ active, onPick }: { active: Shelf; onPick(shelf: Shelf): void }) {
  const speech = useSpeech()
  return (
    <div className="tv-store-tabs" role="tablist" aria-label={speech.text('s.shop.title')}>
      {(Object.keys(SHELF) as Shelf[]).map((shelf) => {
        const s = SHELF[shelf]
        return (
          <Tap
            key={shelf}
            role="tab"
            aria-selected={shelf === active}
            label={speech.text(s.clip)}
            className={cx('tv-store-tab', shelf === active && 'is-on')}
            onTap={() => {
              speech.speak([{ clip: s.clip }])
              onPick(shelf)
            }}
            data-shelf={shelf}
          >
            {s.icon === 'shirt' && <Icon name="shirt" size={28} strokeWidth={2.2} />}
            {s.icon === 'palette' && <Glyph def={PALETTE_GLYPH} size={28} strokeWidth={2.2} />}
            {s.icon === 'sparkle' && <Icon name="sparkle" size={28} strokeWidth={2.2} />}
            <SpokenText clip={s.clip} silent className="tv-store-tab__label" />
          </Tap>
        )
      })}
    </div>
  )
}

export function ClothesShelf({ shelves, onPick }: { shelves: readonly SetShelf[]; onPick(x: Purchase): void }) {
  const speech = useSpeech()
  return (
    <div className="tv-store-shelf" data-shelf-body="clothes">
      <SpokenText as="p" clip="s.shop.clothes.about" className="tv-store-about" />
      {shelves.map((s) => (
        <section key={s.set} className="tv-store-set" data-set={s.set}>
          <div className="tv-store-set__head">
            <SpokenText as="h2" clip={`name.set.${s.set}`} className="tv-store-h" />
            {s.complete && (
              <Pill tone="star" icon="trophy" size="sm">
                <SpokenText clip="s.shop.set.done" silent />
              </Pill>
            )}
          </div>
          <div className="tv-store-grid">
            {s.items.map((it) => (
              <Tap
                key={it.meta.id}
                label={it.owned ? `${speech.text(it.meta.nameClip)}, ${speech.text('s.shop.owned')}` : speech.text(it.meta.nameClip)}
                className={cx('tv-store-card', it.owned && 'is-owned')}
                onTap={() => onPick({ kind: 'item', item: it.meta.id })}
                data-buy={it.meta.id}
                data-owned={it.owned ? '' : undefined}
              >
                <span className="tv-store-card__face">
                  <ItemThumb item={it.meta.id} className="tv-store-card__pic" />
                  {it.owned ? (
                    <span className="tv-store-card__mine" aria-hidden>
                      <Icon name="check" size={16} strokeWidth={3} />
                    </span>
                  ) : (
                    <Price price={it.price} />
                  )}
                </span>
                {it.wished && (
                  <span className="tv-store-card__wish" aria-hidden>
                    <Icon name="pin" size={15} strokeWidth={2.6} />
                  </span>
                )}
              </Tap>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function ColorsShelf({ rows, onPick }: { rows: readonly ColorRow[]; onPick(x: Purchase): void }) {
  const speech = useSpeech()
  if (rows.length === 0) {
    return (
      <div className="tv-store-shelf" data-shelf-body="colors">
        <SpokenText as="p" clip="s.shop.colors.none" className="tv-store-about is-note" />
      </div>
    )
  }
  return (
    <div className="tv-store-shelf" data-shelf-body="colors">
      <SpokenText as="p" clip="s.shop.colors.about" className="tv-store-about" />
      <div className="tv-store-rows">
        {rows.map((r) => (
          <div key={r.meta.id} className="tv-store-row" data-recolor={r.meta.id}>
            <div className="tv-store-row__head">
              <SpokenText clip={r.meta.nameClip} className="tv-store-row__name" />
              {r.all && (
                <Pill tone="good" icon="check" size="sm">
                  <SpokenText clip="s.shop.colors.all" silent />
                </Pill>
              )}
            </div>
            <div className="tv-store-row__colors">
              {r.colors.map(({ color, owned }) => (
                <Tap
                  key={color}
                  label={`${speech.text(r.meta.nameClip)} ${color + 1}`}
                  className={cx('tv-store-card', 'is-color', owned && 'is-owned')}
                  onTap={() => onPick({ kind: 'color', item: r.meta.id, color })}
                  data-color={color}
                  data-owned={owned ? '' : undefined}
                >
                  <span className="tv-store-card__face">
                    <ItemThumb item={r.meta.id} color={color} className="tv-store-card__pic" />
                    {owned ? (
                      <span className="tv-store-card__mine" aria-hidden>
                        <Icon name="check" size={16} strokeWidth={3} />
                      </span>
                    ) : (
                      <Price price={priceOf({ kind: 'color', item: r.meta.id, color }) ?? 0} />
                    )}
                  </span>
                </Tap>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DecorShelf({ rows, onPick }: { rows: readonly DecorRow[]; onPick(x: Purchase): void }) {
  const speech = useSpeech()
  return (
    <div className="tv-store-shelf" data-shelf-body="decor">
      <SpokenText as="p" clip="s.shop.decor.about" className="tv-store-about" />
      <div className="tv-store-grid is-decor">
        {rows.map((r) => (
          <Tap
            key={r.meta.id}
            label={speech.text(`name.decor.${r.meta.id}`)}
            className={cx('tv-store-card', 'is-decor', r.owned && 'is-owned')}
            onTap={() => onPick({ kind: 'decor', id: r.meta.id })}
            data-decor={r.meta.id}
            data-owned={r.owned ? '' : undefined}
          >
            <span className="tv-store-card__face">
              <DecorTile id={r.meta.id} className="tv-store-card__pic" />
              {r.owned ? (
                <span className="tv-store-card__mine" aria-hidden>
                  <Icon name="check" size={16} strokeWidth={3} />
                </span>
              ) : (
                <Price price={r.meta.price} />
              )}
            </span>
          </Tap>
        ))}
      </div>
    </div>
  )
}

/** Decor as a picture: its glyph in its own colour on a soft round tile. */
export function DecorTile({ id, className }: { id: DecorId; className?: string }) {
  return (
    <span className={cx('tv-store-decor', className)} style={toneStyle(DECOR_TONE[id])} aria-hidden data-decor-pic={id}>
      <DecorGlyph id={id} size="64%" strokeWidth={2} />
    </span>
  )
}

// ─── The sheet: ask first, never push ───────────────────────────────────────

export interface BuySheetProps {
  purchase: Purchase | null
  stage: SheetStage
  /** The purchase completed a set (and brought its trophy). */
  setDone?: boolean
  /** The purchase's thing is the wish. */
  wished: boolean
  /** The purchase's thing can be wished for (a shop thing the child does not have). */
  canWish: boolean
  onYes(): void
  onNo(): void
  onWish(): void
  /** "Prøv den på" (clothes) or "Se Dyrehaven" (decor). */
  onGo(): void
  onClose(): void
}

function PurchasePic({ x, done }: { x: Purchase; done: boolean }) {
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (done && box.current) pop(box.current, 1.12)
  }, [done])
  const color: ItemColor = x.kind === 'color' ? x.color : 0
  return (
    <span ref={box} className={cx('tv-store-sheet__pic', done && 'is-done')}>
      {x.kind === 'decor' ? <DecorTile id={x.id} /> : <ItemThumb item={x.item} color={color} />}
    </span>
  )
}

/** "Sådan får du den" for a wished thing that is earned, not sold (a level or a medal thing). */
function HowLine({ item }: { item: ItemId }) {
  const speech = useSpeech()
  const parts = howToGetItem(item)
  return (
    <div className="tv-store-sheet__how">
      <span className="tv-store-sheet__howicon" aria-hidden>
        <Icon name={sourceBadge(ITEM_BY_ID[item].source)} size={28} strokeWidth={2.2} />
      </span>
      <SpokenText parts={parts} text={shownText(parts, speech.text)} className="tv-store-sheet__line" />
    </div>
  )
}

export function BuySheet({ purchase: current, stage, setDone, wished, canWish, onYes, onNo, onWish, onGo, onClose }: BuySheetProps) {
  const speech = useSpeech()
  const purchase = useLastShown(current)
  const title = purchase ? (purchase.kind === 'decor' ? `name.decor.${purchase.id}` : ITEM_BY_ID[purchase.item].nameClip) : undefined
  const cost: SpeechPart[] = purchase ? costSpeech(purchase) : []
  const said = (clip: string) => <SpokenText as="p" clip={clip} className="tv-store-sheet__line" />
  return (
    <Sheet open={!!current} onClose={onClose} title={title} className="tv-store-sheet">
      {purchase && (
        <div className={cx('tv-store-sheet__body', `is-${stage}`)} data-sheet={stage}>
          <PurchasePic x={purchase} done={stage === 'done'} />
          {(stage === 'ask' || stage === 'later') && (
            <Tap label={shownText(cost, speech.text)} className="tv-store-sheet__cost" onTap={() => speech.speak(cost)} data-cost={priceOf(purchase) ?? 0}>
              <Price price={priceOf(purchase) ?? 0} />
            </Tap>
          )}
          {stage === 'ask' && (
            <>
              {said('s.shop.buy.ask')}
              <div className="tv-store-sheet__yesno">
                <Button clip="s.shop.buy.yes" icon="check" variant="good" size="lg" silent onClick={onYes} data-buy-yes="" />
                <Button clip="s.shop.buy.no" variant="quiet" size="lg" onClick={onNo} data-buy-no="" />
              </div>
            </>
          )}
          {stage === 'later' && (
            <div className="tv-store-sheet__later">
              {said('s.shop.later')}
              <div className="tv-store-sheet__earn">
                <span className="tv-store-sheet__earnicon" aria-hidden>
                  <Icon name="pearl" size={32} strokeWidth={2.2} />
                </span>
                <SpokenText as="p" clip="s.shop.earn" className="tv-store-sheet__line" />
              </div>
            </div>
          )}
          {stage === 'how' && purchase.kind === 'item' && <HowLine item={purchase.item} />}
          {stage === 'done' && said(purchase.kind === 'decor' ? 's.shop.decor.bought' : purchase.kind === 'color' ? 's.shop.color.bought' : 's.shop.bought')}
          {stage === 'done' && setDone && (
            <Pill tone="star" icon="trophy" className="tv-store-sheet__trophy">
              <SpokenText clip="s.shop.set.done" silent />
            </Pill>
          )}
          {stage === 'owned' && said(purchase.kind === 'decor' ? 's.shop.decor.owned' : purchase.kind === 'color' ? 's.shop.color.owned' : 's.shop.owned.about')}
          {(stage === 'done' || stage === 'owned') && (
            <Button
              clip={purchase.kind === 'decor' ? 's.shop.decor.see' : 's.shop.tryOn'}
              icon={purchase.kind === 'decor' ? 'paw' : 'shirt'}
              variant="star"
              size="md"
              block
              onClick={onGo}
              data-go=""
            />
          )}
          {purchase.kind === 'item' && stage !== 'owned' && stage !== 'done' && (
            wished ? (
              <Pill tone="primary" icon="pin" className="tv-store-sheet__wished">
                <SpokenText clip="s.shop.wish.title" silent />
              </Pill>
            ) : canWish ? (
              <Button clip="s.shop.wish" icon="pin" variant="secondary" size="md" block onClick={onWish} data-wish-set="" />
            ) : null
          )}
        </div>
      )}
    </Sheet>
  )
}
