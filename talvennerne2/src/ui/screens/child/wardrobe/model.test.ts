import { describe, expect, it } from 'vitest'
import { ITEMS, ITEM_BY_ID } from '../../../../content/catalog'
import { REGION_BY_ID, WORLD_BY_ID, NODE_BY_ID } from '../../../../content/curriculum'
import { SLOTS } from '../../../../engine/types'
import type { ItemSource } from '../../../../engine/types'
import { clipText } from '../../../../speech/catalog'
import { compile } from '../../../../speech/compile'
import { child, wearing, withAnimal } from './fixtures'
import {
  animalsInOrder, canWishFor, cardAction, colorAction, guideItem, howToGet, howToGetColor, itemsOfSlot, pickAnimal,
  shownText, slotModel, startSlot,
} from './model'

/**
 * The wardrobe as data (SPEC §7–8): every thing has its one way to be earned, read aloud; only the
 * child's own things (and their own colours) can be chosen; a new thing opens its own tab.
 */

describe('"Sådan får du den"', () => {
  it('has a complete spoken sentence for every one of the 74 things, with every clip recorded', () => {
    expect(ITEMS).toHaveLength(74)
    for (const item of ITEMS) {
      const parts = howToGet(item.source)
      const c = compile(parts)
      expect(c.missing, item.id).toEqual([])
      expect(c.text.length, item.id).toBeGreaterThan(10)
      expect(c.text, item.id).not.toMatch(/\d/)
      expect(c.text, item.id).toMatch(/[.!?]$/)
      // the shown line has the same words, with the numbers as digits
      expect(shownText(parts, clipText), item.id).toMatch(/[.!?]$/)
    }
  })

  it('names the level, the chest\'s place, the world of the finale, the medals and the price', () => {
    const say = (s: ItemSource) => compile(howToGet(s)).text
    const shown = (s: ItemSource) => shownText(howToGet(s), clipText)
    expect(say(ITEM_BY_ID['hverdag-head'].source)).toBe('Den får du på niveau to.')
    expect(shown(ITEM_BY_ID['milepael-krone'].source)).toBe('Den får du på niveau 50.')
    expect(shown(ITEM_BY_ID['opdager-hand'].source)).toMatch(/^Den ligger i kisten i \S+\.$/)

    const chest = ITEM_BY_ID['opdager-head'].source as Extract<ItemSource, { kind: 'chest' }>
    const region = REGION_BY_ID[NODE_BY_ID[chest.nodeId].region!]
    expect(say(chest)).toBe(`Den ligger i kisten i ${region.name}.`)

    const finale = ITEM_BY_ID['opdager-body'].source as Extract<ItemSource, { kind: 'finale' }>
    expect(say(finale)).toBe(`Den får du til den store fest i ${WORLD_BY_ID[finale.world].name}.`)

    expect(say(ITEM_BY_ID['talmagiker-head'].source)).toBe('Den får du, når du har fået en guldmedalje.')
    expect(say(ITEM_BY_ID['talmagiker-hand'].source)).toBe('Den får du, når du har fået tre guldmedaljer.')
    expect(say(ITEM_BY_ID['ridder-head'].source)).toBe('Den får du, når du har fået to sølvmedaljer.')

    expect(say(ITEM_BY_ID['pirat-body'].source)).toBe('Den kan du købe i butikken for et hundrede og firs perler.')
    expect(shown(ITEM_BY_ID['pirat-face'].source)).toBe('Den kan du købe i butikken for 80 perler.')
    expect(compile(howToGetColor()).text).toBe('Den farve kan du købe i butikken for femogtyve perler.')
  })

  it('covers every kind of source', () => {
    expect(new Set(ITEMS.map((i) => i.source.kind))).toEqual(new Set(['level', 'chest', 'finale', 'medal', 'shop']))
  })
})

describe('one slot', () => {
  it('splits every slot into the child\'s things and the rest, and loses none', () => {
    const p = child()
    let total = 0
    for (const slot of SLOTS) {
      const m = slotModel(p, p.animals[0], slot)
      total += m.owned.length + m.others.length
      expect(m.owned.length + m.others.length).toBe(itemsOfSlot(slot).length)
      for (const o of m.owned) expect(p.inventory[o.meta.id], o.meta.id).toBeDefined()
      for (const o of m.others) expect(p.inventory[o.id], o.id).toBeUndefined()
    }
    expect(total).toBe(74)
    const neck = slotModel(p, p.animals[0], 'neck')
    expect(neck.owned.map((o) => o.meta.id)).toEqual(['hverdag-neck'])
    expect(slotModel(p, p.animals[0], 'body').owned[0].colors).toEqual([0, 2])
    expect(slotModel(p, p.animals[0], 'hand').owned).toEqual([])
  })

  it('knows what the animal wears, and that wings fill the back of a pegasus', () => {
    const p = wearing(child(), 'starter-rabbit', { head: { item: 'hverdag-head', color: 0 } })
    expect(slotModel(p, p.animals[0], 'head').worn).toEqual({ item: 'hverdag-head', color: 0 })
    const q = withAnimal(p, 'pegasus', 'peg')
    expect(slotModel(q, q.animals[1], 'back').locked).toBe(true)
    expect(slotModel(q, q.animals[1], 'head').locked).toBe(false)
    expect(slotModel(q, q.animals[0], 'back').locked).toBe(false)
  })
})

describe('taps', () => {
  const p = child()
  const rabbit = p.animals[0]

  it('puts an owned thing on at once, in an owned colour', () => {
    expect(cardAction(p, rabbit, 'hverdag-head')).toEqual({ kind: 'wear', item: 'hverdag-head', color: 0 })
    expect(cardAction(p, rabbit, 'hverdag-body', 2)).toEqual({ kind: 'wear', item: 'hverdag-body', color: 2 })
    // a colour the child does not have falls back to one they have
    expect(cardAction(p, rabbit, 'hverdag-body', 1)).toEqual({ kind: 'wear', item: 'hverdag-body', color: 0 })
  })

  it('takes the thing that is on off again', () => {
    const q = wearing(p, rabbit.uid, { neck: { item: 'hverdag-neck', color: 0 } })
    expect(cardAction(q, q.animals[0], 'hverdag-neck')).toEqual({ kind: 'takeOff', slot: 'neck' })
  })

  it('never puts on what the child does not have: it says how to get it instead', () => {
    expect(cardAction(p, rabbit, 'pirat-head')).toEqual({ kind: 'how', item: 'pirat-head', color: null })
    expect(cardAction(p, rabbit, 'milepael-krone')).toEqual({ kind: 'how', item: 'milepael-krone', color: null })
    expect(colorAction(p, rabbit, 'hverdag-head', 1)).toEqual({ kind: 'how', item: 'hverdag-head', color: 1 })
    expect(colorAction(p, rabbit, 'hverdag-body', 2)).toEqual({ kind: 'wear', item: 'hverdag-body', color: 2 })
  })

  it('leaves a colour that is already on as it is, and keeps the wings free', () => {
    const q = wearing(p, rabbit.uid, { body: { item: 'hverdag-body', color: 2 } })
    expect(colorAction(q, q.animals[0], 'hverdag-body', 2)).toEqual({ kind: 'none' })
    const r = withAnimal({ ...p, inventory: { ...p.inventory, 'hverdag-back': { at: 0, colors: [0] } } }, 'dragon', 'drage')
    expect(cardAction(r, r.animals[1], 'hverdag-back')).toEqual({ kind: 'locked' })
  })
})

describe('where the wardrobe starts', () => {
  it('opens the tab of the thing in the route, else the hat', () => {
    for (const item of ITEMS) expect(startSlot(item.id), item.id).toBe(item.slot)
    expect(startSlot(undefined)).toBe('head')
    expect(startSlot(null)).toBe('head')
  })

  it('points at the new thing from the route when the child has it', () => {
    const p = child({ 'hverdag-head': [0], 'hverdag-neck': [0] })
    expect(guideItem(p, 'hverdag-neck', true)).toBe('hverdag-neck')
    expect(guideItem(p, 'pirat-head', false)).toBeNull()
  })

  it('points at the Hverdag hat the very first time, and not again', () => {
    const p = child({ 'hverdag-head': [0] })
    expect(guideItem(p, null, false)).toBe('hverdag-head')
    expect(guideItem(p, null, true)).toBeNull()
    expect(guideItem(wearing(p, 'starter-rabbit', { head: { item: 'hverdag-head', color: 0 } }), null, false)).toBeNull()
    expect(guideItem(child({}), null, false)).toBeNull()
  })

  it('dresses the buddy unless the route names another of the child\'s animals', () => {
    const p = withAnimal(child(), 'cat', 'egg-1')
    expect(pickAnimal(p)?.uid).toBe('starter-rabbit')
    expect(pickAnimal(p, 'egg-1')?.uid).toBe('egg-1')
    expect(pickAnimal(p, 'nobody')?.uid).toBe('starter-rabbit')
    expect(animalsInOrder({ ...p, buddyUid: 'egg-1' }).map((a) => a.uid)).toEqual(['egg-1', 'starter-rabbit'])
  })
})

describe('the wish from the wardrobe', () => {
  it('is offered for things whose bar can move, never for the child\'s own', () => {
    const p = child()
    expect(canWishFor(p, 'pirat-head')).toBe(true)
    expect(canWishFor(p, 'milepael-krone')).toBe(true)
    expect(canWishFor(p, 'ridder-head')).toBe(true)
    expect(canWishFor(p, 'opdager-head')).toBe(false)
    expect(canWishFor(p, 'hverdag-head')).toBe(false)
    expect(canWishFor({ ...p, economy: { ...p.economy, wish: 'pirat-head' } }, 'pirat-head')).toBe(false)
  })
})
