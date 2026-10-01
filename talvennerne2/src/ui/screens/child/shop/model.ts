// The shop as data (SPEC §5.7, §13): the four shop sets at their fixed prices, new colours for the
// child's own things, the decor, and the wish. Pure functions over the profile; buying itself goes
// through useMeta (the only place perler go down), so nothing here can take anything away.
// Fixed integer prices only — no rotation, no sale, no countdown, no rarity, no real money.
import { DECOR, ITEMS, ITEM_BY_ID, type DecorMeta, type ItemMeta } from '../../../../content/catalog'
import { RECOLOR_PRICE } from '../../../../content/economy'
import { SET_IDS } from '../../../../engine/types'
import type { DecorId, ItemColor, ItemId, ProfileDoc, SetId, SpeechPart } from '../../../../engine/types'
import { wishProgress } from '../../../../meta/actions'
import { COLORS, ownedColors, owns } from '../wardrobe/model'

type Shopper = Pick<ProfileDoc, 'inventory' | 'decor' | 'economy'>

/** Sets sold in the shop (every one of their six things has a shop price). */
export const SHOP_SETS: readonly SetId[] = SET_IDS.filter((set) => {
  const items = ITEMS.filter((i) => i.set === set)
  return items.length > 0 && items.every((i) => i.source.kind === 'shop')
})

export type Shelf = 'clothes' | 'colors' | 'decor'
export const SHELVES: readonly Shelf[] = ['clothes', 'colors', 'decor']

// ─── What can be bought ─────────────────────────────────────────────────────

export type Purchase =
  | { kind: 'item'; item: ItemId }
  | { kind: 'color'; item: ItemId; color: ItemColor }
  | { kind: 'decor'; id: DecorId }

/** The fixed price of a purchase (null for a thing the shop does not sell). */
export function priceOf(x: Purchase): number | null {
  if (x.kind === 'color') return x.color === 0 ? null : RECOLOR_PRICE
  if (x.kind === 'decor') return DECOR.find((d) => d.id === x.id)?.price ?? null
  const s = ITEM_BY_ID[x.item]?.source
  return s?.kind === 'shop' ? s.price : null
}

export function isOwned(p: Shopper, x: Purchase): boolean {
  if (x.kind === 'item') return owns(p, x.item)
  if (x.kind === 'color') return ownedColors(p, x.item).includes(x.color)
  return !!p.decor[x.id]
}

/** Enough perler, and the thing is for sale and not the child's already (what useMeta checks too). */
export function canBuy(p: Shopper, x: Purchase): boolean {
  const price = priceOf(x)
  if (price === null || isOwned(p, x)) return false
  if (x.kind === 'color' && !owns(p, x.item)) return false
  return p.economy.perler >= price
}

// ─── The shelves ────────────────────────────────────────────────────────────

export interface ShelfItem {
  meta: ItemMeta
  price: number
  owned: boolean
  wished: boolean
}

export interface SetShelf {
  set: SetId
  items: ShelfItem[]
  /** All six are the child's (the set's trophy). */
  complete: boolean
}

export function setShelves(p: Shopper): SetShelf[] {
  return SHOP_SETS.map((set) => {
    const items = ITEMS.filter((i) => i.set === set).map((meta) => ({
      meta,
      price: priceOf({ kind: 'item', item: meta.id }) ?? 0,
      owned: owns(p, meta.id),
      wished: p.economy.wish === meta.id,
    }))
    return { set, items, complete: items.every((i) => i.owned) }
  })
}

export interface ColorRow {
  meta: ItemMeta
  colors: { color: ItemColor; owned: boolean }[]
  /** Every colour is the child's. */
  all: boolean
}

/** New colours for every thing the child has (any source), in catalogue order. */
export function colorRows(p: Shopper): ColorRow[] {
  return ITEMS.filter((meta) => owns(p, meta.id)).map((meta) => {
    const have = ownedColors(p, meta.id)
    const colors = COLORS.map((color) => ({ color, owned: have.includes(color) }))
    return { meta, colors, all: colors.every((c) => c.owned) }
  })
}

export interface DecorRow {
  meta: DecorMeta
  owned: boolean
}

export function decorRows(p: Shopper): DecorRow[] {
  return DECOR.map((meta) => ({ meta, owned: !!p.decor[meta.id] }))
}

// ─── The wish ───────────────────────────────────────────────────────────────

export interface WishView {
  item: ItemId
  /** 0–1 (a bar without numbers). */
  progress: number
  /** A shop thing the child can buy right now. */
  buyable: boolean
}

export function wishView(p: ProfileDoc): WishView | null {
  const item = p.economy.wish
  if (!item || !ITEM_BY_ID[item]) return null
  return { item, progress: wishProgress(p) ?? 0, buyable: canBuy(p, { kind: 'item', item }) }
}

/** Only things for sale are wished for in the shop (the wardrobe also offers level and medal things). */
export function canWishInShop(p: Shopper, item: ItemId): boolean {
  return ITEM_BY_ID[item]?.source.kind === 'shop' && !owns(p, item) && p.economy.wish !== item
}

// ─── Spoken lines ───────────────────────────────────────────────────────────

export const perlerSpeech = (n: number): SpeechPart[] => [{ clip: 's.shop.perler.have' }, { num: n, form: 'mid' }, { clip: 's.shop.perler.end' }]

/** "Den koster 120 perler." / "En ny farve koster 25 perler." */
export function costSpeech(x: Purchase): SpeechPart[] {
  const price = priceOf(x) ?? 0
  return [{ clip: x.kind === 'color' ? 's.shop.color.cost' : 's.shop.cost' }, { num: price, form: 'mid' }, { clip: 's.shop.perler.end' }]
}

export function nameSpeech(x: Purchase): SpeechPart[] {
  return [{ clip: x.kind === 'decor' ? `name.decor.${x.id}` : ITEM_BY_ID[x.item].nameClip }]
}

export type SheetStage = 'ask' | 'later' | 'owned' | 'done'

/** What the sheet says first: the question, the friendly "later", or that it is the child's. */
export function sheetStage(p: Shopper, x: Purchase): Exclude<SheetStage, 'done'> {
  if (isOwned(p, x)) return 'owned'
  return canBuy(p, x) ? 'ask' : 'later'
}

/** Read aloud when the sheet opens (a reply to the child's tap). */
export function openingSpeech(stage: SheetStage, x: Purchase): SpeechPart[] {
  const name = nameSpeech(x)
  if (stage === 'owned') return [...name, { clip: x.kind === 'decor' ? 's.shop.decor.owned' : x.kind === 'color' ? 's.shop.color.owned' : 's.shop.owned.about' }]
  if (stage === 'ask') return [...name, ...costSpeech(x), { clip: 's.shop.buy.ask' }]
  if (stage === 'later') return [...name, ...costSpeech(x), { clip: 's.shop.later' }, { clip: 's.shop.earn' }]
  return [{ clip: doneClip(x) }]
}

export const doneClip = (x: Purchase) => (x.kind === 'decor' ? 's.shop.decor.bought' : x.kind === 'color' ? 's.shop.color.bought' : 's.shop.bought')
