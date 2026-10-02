import { describe, expect, it } from 'vitest'
import { DECOR, ITEMS, PRICE_BY_SLOT, RECOLOR_PRICE } from '../../../../content/catalog'
import { SHOP_SET_PRICE } from '../../../../content/economy'
import type { ItemId } from '../../../../engine/types'
import { compile } from '../../../../speech/compile'
import { AVAILABLE_ITEMS } from '../../../../art/items/registry'
import { everyItemDrawn, isItemDrawn, type DrawnItem } from '../wardrobe/drawn'
import { child } from '../wardrobe/fixtures'
import {
  SHOP_SETS, canBuy, canWishInShop, colorRows, decorRows, isOwned, openingSpeech, priceOf, setShelves, sheetStage, wishView,
  type Purchase, type SheetStage,
} from './model'

/**
 * The shop as data (SPEC §5.7): four sets at fixed prices by slot, new colours at one price for the
 * child's own things, eight pieces of decor, and a wish — nothing else, and nothing that changes.
 * The shop's own rules are tested with every thing counted as drawn (everyItemDrawn); what the filter
 * on drawings does is tested on its own at the end.
 */

describe('the shelves', () => {
  it('sells the four shop sets, six things each, at the fixed price of their slot', () => {
    expect(SHOP_SETS).toEqual(['pirat', 'fodbold', 'vinter', 'fest'])
    const shelves = setShelves(child({}), everyItemDrawn)
    expect(shelves).toHaveLength(4)
    for (const s of shelves) {
      expect(s.items).toHaveLength(6)
      for (const it of s.items) expect(it.price, it.meta.id).toBe(PRICE_BY_SLOT[it.meta.slot])
      expect(s.items.reduce((sum, it) => sum + it.price, 0)).toBe(SHOP_SET_PRICE)
      expect(SHOP_SET_PRICE).toBe(760)
    }
  })

  it('marks the child\'s own things and the wish', () => {
    const p = child({ 'pirat-head': [0] })
    const pirat = setShelves({ ...p, economy: { ...p.economy, wish: 'pirat-hand' } }, everyItemDrawn)[0]
    expect(pirat.items.find((i) => i.meta.id === 'pirat-head')).toMatchObject({ owned: true, wished: false })
    expect(pirat.items.find((i) => i.meta.id === 'pirat-hand')).toMatchObject({ owned: false, wished: true })
    expect(pirat.complete).toBe(false)
    const all = child(Object.fromEntries(ITEMS.filter((i) => i.set === 'fest').map((i) => [i.id, [0]])))
    expect(setShelves(all, everyItemDrawn)[3]).toMatchObject({ set: 'fest', complete: true })
  })

  it('offers new colours only for things the child has, at one price', () => {
    const p = child({ 'hverdag-head': [0], 'hverdag-body': [0, 2], 'opdager-hand': [0, 1, 2] })
    const rows = colorRows(p, everyItemDrawn)
    expect(rows.map((r) => r.meta.id)).toEqual(['hverdag-head', 'hverdag-body', 'opdager-hand'])
    expect(rows[1].colors).toEqual([{ color: 0, owned: true }, { color: 1, owned: false }, { color: 2, owned: true }])
    expect(rows[2].all).toBe(true)
    expect(priceOf({ kind: 'color', item: 'hverdag-head', color: 1 })).toBe(RECOLOR_PRICE)
    expect(priceOf({ kind: 'color', item: 'hverdag-head', color: 0 })).toBeNull()
    expect(colorRows(child({}), everyItemDrawn)).toEqual([])
  })

  it('sells the eight pieces of decor at their fixed prices', () => {
    const rows = decorRows({ ...child(), decor: { 'pynt-baenk': { at: 0, x: 0.5, y: 0.7 } } })
    expect(rows.map((r) => r.meta.price)).toEqual(DECOR.map((d) => d.price))
    expect(rows.reduce((sum, r) => sum + r.meta.price, 0)).toBe(770)
    expect(rows.filter((r) => r.owned).map((r) => r.meta.id)).toEqual(['pynt-baenk'])
  })

  it('has no price for what the shop does not sell', () => {
    expect(priceOf({ kind: 'item', item: 'hverdag-head' })).toBeNull()
    expect(priceOf({ kind: 'item', item: 'talmagiker-head' })).toBeNull()
    expect(priceOf({ kind: 'item', item: 'pirat-back' })).toBe(180)
  })
})

describe('what the sheet says', () => {
  const p = child({ 'hverdag-head': [0], 'pirat-face': [0] })

  it('asks when the child has the perler, says "later" warmly when not, and knows what is theirs', () => {
    expect(sheetStage(p, { kind: 'item', item: 'pirat-body' })).toBe('ask')
    expect(sheetStage({ ...p, economy: { ...p.economy, perler: 179 } }, { kind: 'item', item: 'pirat-body' })).toBe('later')
    expect(sheetStage({ ...p, economy: { ...p.economy, perler: 180 } }, { kind: 'item', item: 'pirat-body' })).toBe('ask')
    expect(sheetStage(p, { kind: 'item', item: 'pirat-face' })).toBe('owned')
    expect(sheetStage(p, { kind: 'color', item: 'hverdag-head', color: 2 })).toBe('ask')
    expect(sheetStage(p, { kind: 'color', item: 'hverdag-head', color: 0 })).toBe('owned')
    expect(sheetStage({ ...p, economy: { ...p.economy, perler: 0 } }, { kind: 'decor', id: 'pynt-lygte' })).toBe('later')
  })

  it('says how to get a wished thing that is earned, never a price for it', () => {
    expect(sheetStage(p, { kind: 'item', item: 'milepael-regnbuehue' })).toBe('how')
    expect(sheetStage(p, { kind: 'item', item: 'ridder-head' })).toBe('how')
    expect(sheetStage(p, { kind: 'item', item: 'hverdag-head' })).toBe('owned')
    expect(compile(openingSpeech('how', { kind: 'item', item: 'milepael-regnbuehue' })).text).toBe('Regnbuehue. Den får du på niveau ti.')
  })

  it('never offers what cannot be bought', () => {
    expect(canBuy(p, { kind: 'item', item: 'hverdag-neck' })).toBe(false)
    expect(canBuy(p, { kind: 'item', item: 'pirat-face' })).toBe(false)
    expect(canBuy(p, { kind: 'color', item: 'pirat-head', color: 1 })).toBe(false)
    expect(isOwned(p, { kind: 'color', item: 'pirat-face', color: 0 })).toBe(true)
  })

  it('reads every sheet from recorded clips: name, price, the question or where perler come from', () => {
    const all: Purchase[] = [
      ...ITEMS.filter((i) => i.source.kind === 'shop').map((i): Purchase => ({ kind: 'item', item: i.id })),
      { kind: 'color', item: 'hverdag-head', color: 1 },
      ...DECOR.map((d): Purchase => ({ kind: 'decor', id: d.id })),
    ]
    for (const x of all) {
      for (const stage of ['ask', 'later', 'owned', 'done', 'how'] as SheetStage[]) {
        const c = compile(openingSpeech(stage, x))
        expect(c.missing, `${JSON.stringify(x)} ${stage}`).toEqual([])
        expect(c.text).not.toMatch(/\d/)
      }
    }
    expect(compile(openingSpeech('ask', { kind: 'item', item: 'pirat-head' })).text).toBe(
      'Pirathat. Den koster et hundrede og tyve perler. Vil du købe den?',
    )
    expect(compile(openingSpeech('later', { kind: 'decor', id: 'pynt-lygte' })).text).toBe(
      'Lygte. Den koster fyrre perler. Den kan du købe, når du har samlet flere perler. Perler får du, når du regner. Hver gang du svarer rigtigt, får du en perle.',
    )
  })
})

describe('the wish', () => {
  it('shows a bar towards a shop thing and says when it can be bought', () => {
    const p = child()
    expect(wishView(p, everyItemDrawn)).toBeNull()
    const w = (item: ItemId, perler: number) => wishView({ ...p, economy: { ...p.economy, wish: item, perler } }, everyItemDrawn)
    expect(w('pirat-body', 90)).toEqual({ item: 'pirat-body', progress: 0.5, buyable: false })
    expect(w('pirat-body', 400)).toEqual({ item: 'pirat-body', progress: 1, buyable: true })
    // a level thing fills with XP and is never "bought"
    expect(w('milepael-hjertebriller', 1000)?.buyable).toBe(false)
  })

  it('is offered in the shop only for things for sale that the child does not have', () => {
    const p = child({ 'pirat-head': [0] })
    expect(canWishInShop(p, 'pirat-body', everyItemDrawn)).toBe(true)
    expect(canWishInShop(p, 'pirat-head', everyItemDrawn)).toBe(false)
    expect(canWishInShop(p, 'hverdag-hand', everyItemDrawn)).toBe(false)
    expect(canWishInShop({ ...p, economy: { ...p.economy, wish: 'pirat-body' } }, 'pirat-body', everyItemDrawn)).toBe(false)
  })
})

describe('only drawn things are sold (review P1-3)', () => {
  /** Drawn in this test: the Fest hat and the pirate hat, nothing else. */
  const some: DrawnItem = (item) => item === 'fest-head' || item === 'pirat-head'

  it('shows a set only once one of its things is drawn, and only its drawn things', () => {
    const shelves = setShelves(child({}), some)
    expect(shelves.map((s) => s.set)).toEqual(['pirat', 'fest'])
    expect(shelves.map((s) => s.items.map((i) => i.meta.id))).toEqual([['pirat-head'], ['fest-head']])
    expect(setShelves(child({}), () => false)).toEqual([])
  })

  it('keeps the child\'s own things in view, drawn or not, and counts all six for the set', () => {
    const p = child({ 'pirat-face': [0], 'fodbold-head': [0] })
    const shelves = setShelves(p, some)
    const pirat = shelves.find((s) => s.set === 'pirat')!
    expect(pirat.items.map((i) => [i.meta.id, i.owned])).toEqual([['pirat-head', false], ['pirat-face', true]])
    // a set with nothing drawn stays off the shelf even when the child owns some of it: it is in the wardrobe
    expect(shelves.some((s) => s.set === 'fodbold')).toBe(false)
    const all = child(Object.fromEntries(ITEMS.filter((i) => i.set === 'pirat').map((i) => [i.id, [0]])))
    expect(setShelves(all, some).find((s) => s.set === 'pirat')).toMatchObject({ complete: true })
  })

  it('sells new colours only for drawn things', () => {
    const p = child({ 'fest-head': [0], 'pirat-face': [0], 'hverdag-head': [0] })
    expect(colorRows(p, some).map((r) => r.meta.id)).toEqual(['fest-head'])
  })

  it('does not show or offer a wish for a thing that is not drawn yet', () => {
    const p = child()
    const wish = (item: ItemId) => ({ ...p, economy: { ...p.economy, wish: item, perler: 500 } })
    expect(wishView(wish('pirat-body'), some)).toBeNull()
    expect(wishView(wish('pirat-head'), some)).toMatchObject({ item: 'pirat-head', buyable: true })
    expect(canWishInShop(p, 'pirat-body', some)).toBe(false)
    expect(canWishInShop(p, 'pirat-head', some)).toBe(true)
  })

  it('reads the drawings from the art registry, so the filter goes away as they land', () => {
    for (const item of ITEMS) expect(isItemDrawn(item.id), item.id).toBe(AVAILABLE_ITEMS.includes(item.id))
    const shelves = setShelves(child({}))
    for (const s of shelves) {
      expect(s.items.length, s.set).toBeGreaterThan(0)
      for (const it of s.items) expect(AVAILABLE_ITEMS, it.meta.id).toContain(it.meta.id)
    }
    const expected = SHOP_SETS.filter((set) => ITEMS.some((i) => i.set === set && AVAILABLE_ITEMS.includes(i.id)))
    expect(shelves.map((s) => s.set)).toEqual(expected)
  })
})
