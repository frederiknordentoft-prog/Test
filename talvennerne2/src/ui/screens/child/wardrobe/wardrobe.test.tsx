import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import type { RouteOf } from '../../../../app/routes'
import { ITEMS } from '../../../../content/catalog'
import type { ItemId, ProfileDoc } from '../../../../engine/types'
import { useProfile } from '../../../../state/useProfile'
import WardrobeScreen, { Wardrobe } from '../WardrobeScreen'
import { AVAILABLE_ITEMS } from '../../../../art/items/registry'
import { everyItemDrawn, type DrawnItem } from './drawn'
import { child, wearing, withAnimal } from './fixtures'
import { itemsOfSlot } from './model'

/**
 * The wardrobe screen as the child first sees it (SPEC §7–8): the tab of the thing the route brings
 * is open and the thing is pointed at; only the child's own things — and their own colours — can be
 * chosen, everything else is an outline that tells how to get it.
 */

type Attrs = Record<string, string>

/** Every <button> of the markup with its attributes. */
function buttons(html: string): Attrs[] {
  return [...html.matchAll(/<button\b([^>]*)>/g)].map((m) => Object.fromEntries([...m[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map((a) => [a[1], a[2] ?? ''])))
}

function render(profile: ProfileDoc, route: Omit<RouteOf<'wardrobe'>, 'id'> = {}, drawn?: DrawnItem): string {
  return renderToStaticMarkup(<Wardrobe profile={profile} route={{ id: 'wardrobe', ...route }} drawn={drawn} />)
}

afterEach(() => {
  useProfile.setState({ profile: null })
})

const tab = (html: string) => buttons(html).find((b) => b.role === 'tab' && b['aria-selected'] === 'true')?.['data-slot']
const cards = (html: string, attr: string) => buttons(html).filter((b) => attr in b && 'data-item' in b).map((b) => b['data-item'])

describe('the tab the wardrobe opens', () => {
  it('is the slot of the thing in the route, for every slot', () => {
    const p = child({ 'hverdag-head': [0], 'hverdag-neck': [0], 'hverdag-body': [0], 'hverdag-hand': [0], 'hverdag-face': [0], 'hverdag-back': [0] })
    for (const item of ['hverdag-head', 'hverdag-face', 'hverdag-neck', 'hverdag-body', 'hverdag-back', 'hverdag-hand'] as ItemId[]) {
      const html = render(p, { item })
      const slot = ITEMS.find((i) => i.id === item)!.slot
      expect(tab(html), item).toBe(slot)
      expect(html).toContain(`data-panel="${slot}"`)
      // the new thing is pointed at: a ring and a hand, nothing more
      const card = buttons(html).find((b) => b['data-item'] === item)!
      expect(card, item).toHaveProperty('data-guide')
      expect(card['aria-pressed']).toBe('false')
    }
  })

  it('opens the tab of a thing the child does not have yet without pointing at it', () => {
    const html = render(child(), { item: 'pirat-back' })
    expect(tab(html)).toBe('back')
    expect(buttons(html).some((b) => 'data-guide' in b)).toBe(false)
  })

  it('opens on the hat and points at the Hverdag hat the very first time', () => {
    const html = render(child({ 'hverdag-head': [0] }))
    expect(tab(html)).toBe('head')
    expect(buttons(html).find((b) => b['data-item'] === 'hverdag-head')).toHaveProperty('data-guide')
  })

  it('does not point when the thing from the route is already on (the ceremony put it on)', () => {
    const p = wearing(child(), 'starter-rabbit', { neck: { item: 'hverdag-neck', color: 0 } })
    const card = buttons(render(p, { item: 'hverdag-neck' })).find((b) => b['data-item'] === 'hverdag-neck')!
    expect(card['aria-pressed']).toBe('true')
    expect(card).toHaveProperty('data-guide')
  })
})

describe('what can be chosen', () => {
  it('lets the child choose only their own things; the rest are outlines that tell how to get them', () => {
    const p = child({ 'hverdag-head': [0], 'fest-head': [0, 1], 'milepael-regnbuehue': [0], 'pirat-face': [0] })
    const html = render(p, { item: 'fest-head' }, everyItemDrawn)
    expect(cards(html, 'data-owned').sort()).toEqual(['fest-head', 'hverdag-head', 'milepael-regnbuehue'])
    const others = cards(html, 'data-how')
    expect(others).toHaveLength(itemsOfSlot('head').length - 3)
    for (const id of others) expect(p.inventory[id as ItemId], id).toBeUndefined()
    // nothing the child does not own is marked as choosable anywhere on the screen
    for (const b of buttons(html)) if ('data-owned' in b && 'data-item' in b) expect(p.inventory[b['data-item'] as ItemId]).toBeDefined()
  })

  it('offers only drawn things under "Det kan du få", and keeps the child\'s own things without a drawing', () => {
    const p = child({ 'hverdag-head': [0], 'pirat-head': [0] })
    const html = render(p, { item: 'hverdag-head' })
    expect(cards(html, 'data-owned').sort()).toEqual(['hverdag-head', 'pirat-head'])
    for (const id of cards(html, 'data-how')) expect(AVAILABLE_ITEMS, id).toContain(id)
    const drawnHats = itemsOfSlot('head').filter((i) => AVAILABLE_ITEMS.includes(i.id) && !p.inventory[i.id]).map((i) => i.id)
    expect(cards(html, 'data-how').sort()).toEqual(drawnHats.sort())
  })

  it('has no colour bar for a thing without a drawing (its colours are not sold)', () => {
    const p = wearing(child({ 'pirat-neck': [0] }), 'starter-rabbit', { neck: { item: 'pirat-neck', color: 0 } })
    const none: DrawnItem = () => false
    const html = render(p, { item: 'pirat-neck' }, none)
    expect(html).toContain('data-off="pirat-neck"')
    expect(html).not.toContain('data-colors=')
  })

  it('shows the three colours of the thing that is on: the child\'s own to choose, the others in the shop', () => {
    const p = wearing(child(), 'starter-rabbit', { body: { item: 'hverdag-body', color: 2 } })
    const html = render(p, { item: 'hverdag-body' })
    const colors = buttons(html).filter((b) => 'data-color' in b)
    expect(colors.map((b) => b['data-color'])).toEqual(['0', '1', '2'])
    expect(colors.filter((b) => 'data-owned' in b).map((b) => b['data-color'])).toEqual(['0', '2'])
    expect(colors.find((b) => b['aria-pressed'] === 'true')?.['data-color']).toBe('2')
    expect(html).toContain('data-off="hverdag-body"')
  })

  it('says that a pegasus keeps its back for its own wings', () => {
    const p = withAnimal({ ...child(), inventory: { ...child().inventory, 'hverdag-back': { at: 0, colors: [0] } } }, 'pegasus', 'peg')
    const html = render(p, { uid: 'peg', item: 'hverdag-back' })
    expect(html).toContain('data-locked=""')
    expect(cards(html, 'data-owned')).toEqual([])
    expect(buttons(html).find((b) => b['data-slot'] === 'back')?.['aria-label']).toBe('Ryg')
  })

  it('lets the child pick which animal to dress, the buddy first', () => {
    const p = withAnimal(child(), 'cat', 'egg-1')
    const html = render(p, { uid: 'egg-1' })
    const picks = buttons(html).filter((b) => b.role === 'radio')
    expect(picks.map((b) => b['data-animal'])).toEqual(['starter-rabbit', 'egg-1'])
    expect(picks.find((b) => b['aria-checked'] === 'true')?.['data-animal']).toBe('egg-1')
    expect(html).toContain('data-wardrobe="egg-1"')
  })

  it('shows nothing without a child', () => {
    useProfile.setState({ profile: null })
    expect(renderToStaticMarkup(<WardrobeScreen route={{ id: 'wardrobe' }} />)).toBe('')
  })
})
