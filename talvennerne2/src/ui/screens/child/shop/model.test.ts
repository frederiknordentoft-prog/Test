import { describe, expect, it } from 'vitest'
import { DECOR, ITEMS, PRICE_BY_SLOT, RECOLOR_PRICE } from '../../../../content/catalog'
import { SHOP_SET_PRICE } from '../../../../content/economy'
import type { ItemId } from '../../../../engine/types'
import { compile } from '../../../../speech/compile'
import { child } from '../wardrobe/fixtures'
import {
  SHOP_SETS, canBuy, canWishInShop, colorRows, decorRows, isOwned, openingSpeech, priceOf, setShelves, sheetStage, wishView,
  type Purchase, type SheetStage,
} from './model'

/**
 * The shop as data (SPEC §5.7): four sets at fixed prices by slot, new colours at one price for the
 * child's own things, eight pieces of decor, and a wish — nothing else, and nothing that changes.
 */

describe('the shelves', () => {
  it('sells the four shop sets, six things each, at the fixed price of their slot', () => {
    expect(SHOP_SETS).toEqual(['pirat', 'fodbold', 'vinter', 'fest'])
    const shelves = setShelves(child({}))
    for (const s of shelves) {
      expect(s.items).toHaveLength(6)
      for (const it of s.items) expect(it.price, it.meta.id).toBe(PRICE_BY_SLOT[it.meta.slot])
      expect(s.items.reduce((sum, it) => sum + it.price, 0)).toBe(SHOP_SET_PRICE)
      expect(SHOP_SET_PRICE).toBe(760)
    }
  })

  it('marks the child\'s own things and the wish', () => {
    const p = child({ 'pirat-head': [0] })
    const pirat = setShelves({ ...p, economy: { ...p.economy, wish: 'pirat-hand' } })[0]
    expect(pirat.items.find((i) => i.meta.id === 'pirat-head')).toMatchObject({ owned: true, wished: false })
    expect(pirat.items.find((i) => i.meta.id === 'pirat-hand')).toMatchObject({ owned: false, wished: true })
    expect(pirat.complete).toBe(false)
    const all = child(Object.fromEntries(ITEMS.filter((i) => i.set === 'fest').map((i) => [i.id, [0]])))
    expect(setShelves(all)[3]).toMatchObject({ set: 'fest', complete: true })
  })

  it('offers new colours only for things the child has, at one price', () => {
    const p = child({ 'hverdag-head': [0], 'hverdag-body': [0, 2], 'opdager-hand': [0, 1, 2] })
    const rows = colorRows(p)
    expect(rows.map((r) => r.meta.id)).toEqual(['hverdag-head', 'hverdag-body', 'opdager-hand'])
    expect(rows[1].colors).toEqual([{ color: 0, owned: true }, { color: 1, owned: false }, { color: 2, owned: true }])
    expect(rows[2].all).toBe(true)
    expect(priceOf({ kind: 'color', item: 'hverdag-head', color: 1 })).toBe(RECOLOR_PRICE)
    expect(priceOf({ kind: 'color', item: 'hverdag-head', color: 0 })).toBeNull()
    expect(colorRows(child({}))).toEqual([])
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
      for (const stage of ['ask', 'later', 'owned', 'done'] as SheetStage[]) {
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
    expect(wishView(p)).toBeNull()
    const w = (item: ItemId, perler: number) => wishView({ ...p, economy: { ...p.economy, wish: item, perler } })
    expect(w('pirat-body', 90)).toEqual({ item: 'pirat-body', progress: 0.5, buyable: false })
    expect(w('pirat-body', 400)).toEqual({ item: 'pirat-body', progress: 1, buyable: true })
    // a level thing fills with XP and is never "bought"
    expect(w('milepael-hjertebriller', 1000)?.buyable).toBe(false)
  })

  it('is offered in the shop only for things for sale that the child does not have', () => {
    const p = child({ 'pirat-head': [0] })
    expect(canWishInShop(p, 'pirat-body')).toBe(true)
    expect(canWishInShop(p, 'pirat-head')).toBe(false)
    expect(canWishInShop(p, 'hverdag-hand')).toBe(false)
    expect(canWishInShop({ ...p, economy: { ...p.economy, wish: 'pirat-body' } }, 'pirat-body')).toBe(false)
  })
})
