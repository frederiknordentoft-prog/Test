import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PRICE_BY_SLOT } from '../../../../content/catalog'
import { clipText, hasClip } from '../../../../speech/catalog'
import { clips as shopClips } from '../../../../speech/clips/ui/shop'
import { clips as wardrobeClips } from '../../../../speech/clips/ui/wardrobe'
import { AVAILABLE_ITEMS } from '../../../../art/items/registry'
import { Shop } from '../ShopScreen'
import { everyItemDrawn } from '../wardrobe/drawn'
import { child } from '../wardrobe/fixtures'

/**
 * The shop as the child sees it (SPEC §5.7, §13): the perler at the top, fixed prices, the child's own
 * things marked, and none of the tricks — no countdown, no "today only", no rarity, no money.
 */

type Attrs = Record<string, string>
function tags(html: string, tag: string): Attrs[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'g'))].map((m) =>
    Object.fromEntries([...m[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map((a) => [a[1], a[2] ?? ''])),
  )
}

describe('the shop', () => {
  it('shows the child\'s perler at the top', () => {
    const html = renderToStaticMarkup(<Shop profile={child()} />)
    const top = html.slice(0, html.indexOf('</header>'))
    expect(top).toContain('data-perler="300"')
    expect(top).toMatch(/tv-store-perler__n">300</)
  })

  it('lists four sets with the fixed price of every slot, and marks what the child has', () => {
    const p = child({ 'pirat-head': [0] })
    const html = renderToStaticMarkup(<Shop profile={p} drawn={everyItemDrawn} />)
    const cards = tags(html, 'button').filter((b) => 'data-buy' in b)
    expect(cards).toHaveLength(24)
    expect(cards.filter((b) => 'data-owned' in b).map((b) => b['data-buy'])).toEqual(['pirat-head'])
    // every price on the shelf is a fixed price of a slot; the child's own thing shows none
    const prices = [...html.matchAll(/tv-store-price__n">(\d+)</g)].map((m) => Number(m[1]))
    expect(prices).toHaveLength(23)
    for (const n of prices) expect(Object.values(PRICE_BY_SLOT)).toContain(n)
  })

  it('shows the wish with a bar and no numbers', () => {
    const p = child()
    const html = renderToStaticMarkup(<Shop profile={{ ...p, economy: { ...p.economy, wish: 'pirat-body', perler: 90 } }} drawn={everyItemDrawn} />)
    const meter = tags(html, 'button').find((b) => b.role === 'meter')!
    expect(meter['aria-valuenow']).toBe('0.5')
    const wish = html.slice(html.indexOf('data-wish="pirat-body"'), html.indexOf('tv-store__tabs'))
    expect(wish).not.toMatch(/>\s*\d+\s*</)
  })
})

describe('only drawn things in the shop (review P1-3)', () => {
  it('sells only things whose drawing exists, and keeps the child\'s own in view', () => {
    const p = child({ 'pirat-face': [0], 'fest-head': [0] })
    const html = renderToStaticMarkup(<Shop profile={p} />)
    const cards = tags(html, 'button').filter((b) => 'data-buy' in b)
    expect(cards.length).toBeGreaterThan(0)
    for (const b of cards) {
      const item = b['data-buy'] as never
      // for sale only when drawn; an undrawn thing on the shelf is the child's own, never with a price
      if (!AVAILABLE_ITEMS.includes(item)) expect('data-owned' in b, b['data-buy']).toBe(true)
    }
    // a set with no drawn thing is not on the shelf at all
    const sets = [...html.matchAll(/data-set="(\w+)"/g)].map((m) => m[1])
    for (const set of sets) expect(AVAILABLE_ITEMS.some((id) => id.startsWith(`${set}-`)), set).toBe(true)
  })

  it('hides a wish for a thing that is not drawn yet', () => {
    const p = child()
    const undrawn = (['pirat-body', 'vinter-back', 'fodbold-hand'] as const).find((id) => !AVAILABLE_ITEMS.includes(id))
    if (!undrawn) return
    const html = renderToStaticMarkup(<Shop profile={{ ...p, economy: { ...p.economy, wish: undrawn, perler: 90 } }} />)
    expect(html).not.toContain(`data-wish="${undrawn}"`)
    expect(html).toContain('data-wish=""')
  })
})

describe('guardrails (SPEC §13)', () => {
  const words = [...Object.values(shopClips), ...Object.values(wardrobeClips)]

  it('has no countdown, no time-limited offer, no rarity, no money and no guilt in what the screens say', () => {
    const banned = /\bkun\b|i dag|tilbud|udsalg|rabat|sjælden|eksklusiv|skynd|nedtælling|udløber|snart væk|sidste chance|kr\.|kroner|penge|betal|savner|ked af det|venter på dig|glem ikke|kom tilbage|din ven bliver/i
    for (const w of words) expect(w).not.toMatch(banned)
    const html = renderToStaticMarkup(<Shop profile={child()} />)
    expect(html.replace(/<[^>]+>/g, ' ')).not.toMatch(banned)
  })

  it('uses only recorded clips in the wardrobe and the shop, and every clip of theirs is used', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const files = [
      ...['../WardrobeScreen.tsx', '../ShopScreen.tsx'].map((f) => path.join(here, f)),
      ...['../wardrobe', '.'].flatMap((d) => readdirSync(path.join(here, d)).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f)).map((f) => path.join(here, d, f))),
    ]
    const source = files.map((f) => readFileSync(f, 'utf8')).join('\n')
    const used = new Set([...source.matchAll(/['"](s\.(?:wardrobe|shop)\.[\w.]+)['"]/g)].map((m) => m[1]))
    for (const id of used) expect(hasClip(id), id).toBe(true)
    for (const id of [...Object.keys(shopClips), ...Object.keys(wardrobeClips)]) expect(used.has(id), `${id} is not used`).toBe(true)
    expect(clipText('s.shop.buy.ask')).toBe('Vil du købe den?')
  })
})
