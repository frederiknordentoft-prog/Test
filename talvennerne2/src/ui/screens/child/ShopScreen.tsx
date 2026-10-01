// The `shop` route (SPEC §5.7, §13): the child's perler at the top, the wish with its bar, and three
// shelves — the four shop sets at their fixed prices, new colours for the child's own things, and
// decor for the animal garden. A tap on a thing opens a sheet that asks first ("Vil du købe den?")
// with a clear yes and no; without enough perler it says, warmly, that perler come from doing sums
// and offers to make the thing the wish. No countdown, no "today only", no rarity, no real money.
// Buying goes through useMeta, the one place perler go down, so a refused purchase changes nothing.
import { useEffect, useState } from 'react'
import { useNav } from '../../../app/nav'
import type { RouteOf } from '../../../app/routes'
import type { ScreenProps } from '../../../app/screens'
import { useMeta } from '../../../state/useMeta'
import { useProfile } from '../../../state/useProfile'
import { SpokenText } from '../../design/SpokenText'
import { useSpeech } from '../../design/speech'
import { TopBar } from '../../shell/TopBar'
import {
  canWishInShop, colorRows, decorRows, doneClip, openingSpeech, setShelves, sheetStage, wishView,
  type Purchase, type Shelf, type SheetStage,
} from './shop/model'
import { buy } from './shop/buy'
import { BuySheet, ClothesShelf, ColorsShelf, DecorShelf, PerlerBadge, ShelfTabs, WishCard } from './shop/ShopView'
import './shop/shop.css'

export default function ShopScreen(_props: ScreenProps<RouteOf<'shop'>>) {
  const profile = useProfile((s) => s.profile)
  const speech = useSpeech()
  const [shelf, setShelf] = useState<Shelf>('clothes')
  const [open, setOpen] = useState<{ x: Purchase; stage: SheetStage } | null>(null)

  useEffect(() => {
    if (!profile) useNav.getState().root({ id: 'profiles' }, 'back')
  }, [profile])

  if (!profile) return null

  const show = (x: Purchase) => {
    const p = useProfile.getState().profile ?? profile
    const stage = sheetStage(p, x)
    speech.speak(openingSpeech(stage, x))
    setOpen({ x, stage })
  }

  const yes = () => {
    if (!open || open.stage !== 'ask') return
    const { x } = open
    if (buy(x)) {
      speech.speak([{ clip: doneClip(x) }])
      setOpen({ x, stage: 'done' })
    } else {
      // something changed under the sheet (perler, a purchase elsewhere): say how it stands now
      show(x)
    }
  }

  const go = () => {
    if (!open) return
    const { x } = open
    setOpen(null)
    if (x.kind === 'decor') {
      useNav.getState().go({ id: 'animals' })
      return
    }
    // a new colour goes straight on the buddy; a new thing is pointed at in the wardrobe
    if (x.kind === 'color' && profile.buddyUid) useMeta.getState().wear(profile.buddyUid, x.item, x.color)
    useNav.getState().go({ id: 'wardrobe', item: x.item })
  }

  const wish = wishView(profile)
  const x = open?.x ?? null
  const wishItem = x && x.kind === 'item' ? x.item : null

  return (
    <div className="tv-shop" data-shop="">
      <TopBar
        leading="back"
        onLeading={() => useNav.getState().back()}
        center={<SpokenText as="h1" clip="s.shop.title" className="tv-shop-title" />}
        extra={<PerlerBadge perler={profile.economy.perler} />}
        className="tv-shop__top"
      />
      <div className="tv-shop__body">
        <div className="tv-shop__inner">
          <WishCard
            wish={wish}
            onOpen={() => wish && show({ kind: 'item', item: wish.item })}
            onRemove={() => useMeta.getState().setWish(null)}
          />
          <div className="tv-shop__tabs">
            <ShelfTabs active={shelf} onPick={setShelf} />
          </div>
          {shelf === 'clothes' && <ClothesShelf shelves={setShelves(profile)} onPick={show} />}
          {shelf === 'colors' && <ColorsShelf rows={colorRows(profile)} onPick={show} />}
          {shelf === 'decor' && <DecorShelf rows={decorRows(profile)} onPick={show} />}
        </div>
      </div>
      <BuySheet
        purchase={x}
        stage={open?.stage ?? 'ask'}
        wished={!!wishItem && profile.economy.wish === wishItem}
        canWish={!!wishItem && canWishInShop(profile, wishItem)}
        onYes={yes}
        onNo={() => setOpen(null)}
        onWish={() => {
          if (wishItem && useMeta.getState().setWish(wishItem)) speech.speak([{ clip: 's.shop.wish.set' }])
        }}
        onGo={go}
        onClose={() => setOpen(null)}
      />
    </div>
  )
}
