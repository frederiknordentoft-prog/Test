import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { hverdagBody } from '../items/hverdag/hverdag-body'
import { hverdagHead } from '../items/hverdag/hverdag-head'
import { rabbit } from '../species/rabbit'
import { rigElement } from './Rig'
import type { RigProps } from './Rig'
import { rigKey, rigToSvg, toMarkup } from './staticSvg'

const cases: RigProps[] = [
  { species: rabbit, mode: 'static' },
  { species: rabbit, breed: 'lionhead', stage: 3, colorway: 'rainbow', mood: 'sleep', mode: 'static', star: true },
  { species: rabbit, stage: 1, colorway: 'c4', mood: 'oops', mode: 'animated', size: 96 },
  { species: rabbit, colorway: 'gold', mood: 'think', mode: 'static', crop: 'head', outfit: { head: { item: hverdagHead, colorway: 2 }, body: { item: hverdagBody } } },
  { species: rabbit, silhouette: true, mode: 'static' },
]

describe('staticSvg', () => {
  it('den lille serialisering giver præcis samme markup som renderToStaticMarkup', () => {
    for (const p of cases) {
      const el = rigElement(p, { uid: 'Q' })
      expect(toMarkup(el)).toBe(renderToStaticMarkup(el))
    }
  })

  it('rigToSvg er et selvstændigt, statisk SVG-dokument med størrelse', () => {
    const svg = rigToSvg({ species: rabbit, mood: 'happy' })
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toMatch(/ width="200" height="240"/)
    expect(svg).toContain('data-static=""')
    expect(svg).not.toMatch(/class="[^"]*a-/)
  })

  it('cachenøglen skelner alt, der ændrer billedet', () => {
    const a = rigKey({ species: rabbit })
    expect(rigKey({ species: rabbit, colorway: 'c1', stage: 2 })).toBe(a)
    expect(rigKey({ species: rabbit, stage: 3 })).not.toBe(a)
    expect(rigKey({ species: rabbit, outfit: { head: { item: hverdagHead } } })).not.toBe(a)
    expect(rigKey({ species: rabbit, outfit: { head: { item: hverdagHead, colorway: 1 } } })).not.toBe(
      rigKey({ species: rabbit, outfit: { head: { item: hverdagHead } } }),
    )
  })
})
