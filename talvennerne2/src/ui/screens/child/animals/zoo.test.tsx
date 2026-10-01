// Dyrehaven rendered for an experienced and a new child, with the drawn species handed in up front:
// at most three animated rigs (the buddy and two more), still pictures for everyone else, the neutral
// shadow for species that are not drawn yet, the decor, the egg and the waiting golden pick — and a
// meadow far inside the DOM budget of SPEC §6.4.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { cat } from '../../../../art/species/cat'
import { horse } from '../../../../art/species/horse'
import { rabbit } from '../../../../art/species/rabbit'
import { unicorn } from '../../../../art/species/unicorn'
import { hverdagBody } from '../../../../art/items/hverdag/hverdag-body'
import { hverdagHead } from '../../../../art/items/hverdag/hverdag-head'
import type { SpeciesDefs } from './art'
import { ArtContext } from './art'
import { MAX_ANIMATED } from './model'
import { DEMO_NOW, zooDemoProfile, zooNewProfile } from './testing/demo'
import { ZooView } from './ZooView'
import { AVAILABLE_SPECIES } from '../../../../art/species/registry'

const species: SpeciesDefs = { rabbit, cat, horse, unicorn }
const items = { 'hverdag-head': hverdagHead, 'hverdag-body': hverdagBody }

function render(el: ReactElement): string {
  return renderToStaticMarkup(<ArtContext.Provider value={{ species, items }}>{el}</ArtContext.Provider>)
}

const rigs = (html: string) => [...html.matchAll(/<svg[^>]*class="rig[ "][^>]*>/g)].map((m) => m[0])
const animatedRigs = (html: string) => rigs(html).filter((tag) => !tag.includes('data-static'))
/** Every SVG element in the markup (the <img> pictures hold their SVG outside the DOM). */
const svgElements = (html: string) => {
  let n = 0
  for (const svg of html.match(/<svg[\s\S]*?<\/svg>/g) ?? []) n += (svg.match(/<[a-zA-Z][^\s/>]*/g) ?? []).length
  return n
}

describe('Dyrehaven', () => {
  const ida = zooDemoProfile()
  const html = render(<ZooView profile={ida} now={DEMO_NOW} onDress={() => {}} />)

  it('animates the buddy and at most two others; everyone else is a still picture', () => {
    const live = animatedRigs(html)
    expect(live.length).toBeLessThanOrEqual(MAX_ANIMATED)
    expect(live).toHaveLength(3)
    const animatedCells = [...html.matchAll(/data-uid="([^"]+)" data-animated=""/g)].map((m) => m[1])
    // the fox (not drawn yet) cannot move its parts, so the slot goes to the next drawn animal
    expect(animatedCells).toEqual(['starter-rabbit', 'egg-6', 'rainbow-rabbit'])
    // the other drawn animals are <img> pictures (blob URLs), the undrawn ones shadows — which
    // species those are changes as the art lands, so it is read from the art registry
    const drawn = new Set<string>(AVAILABLE_SPECIES)
    const undrawn = ida.animals.filter((a) => !drawn.has(a.species))
    expect((html.match(/<img class="zoo-fig__img"/g) ?? []).length).toBeGreaterThanOrEqual(ida.animals.length - 3 - undrawn.length)
    for (const sp of new Set(undrawn.map((a) => a.species))) expect(html).toContain(`data-standin="${sp}"`)
    for (const sp of drawn) expect(html).not.toContain(`data-standin="${sp}"`)
  })

  it('stays far inside the DOM budget of 1 500 SVG elements', () => {
    const n = svgElements(html)
    expect(n).toBeLessThan(1500)
    expect(n).toBeLessThan(900)
  })

  it('shows every animal by name, the buddy first, and the decor', () => {
    const cells = [...html.matchAll(/data-uid="([^"]+)"/g)].map((m) => m[1])
    expect(cells).toHaveLength(ida.animals.length)
    expect(cells[0]).toBe('starter-rabbit')
    for (const a of ida.animals) expect(html).toContain(`aria-label="${a.name}"`)
    for (const d of ['pynt-blomsterbed', 'pynt-baenk', 'pynt-dam', 'pynt-traehus']) expect(html).toContain(`data-decor="${d}"`)
    expect(html).toContain('Ny</span>')
  })

  it('offers the golden pick and the warm egg', () => {
    expect(html).toContain('data-choice="gold-eng"')
    expect(html).toContain('Vælg et gyldent dyr.')
    for (const s of ['rabbit', 'puppy', 'hedgehog']) expect(html).toContain(`data-magic-option="${s}"`)
    expect(html).toContain('data-egg-card="ready"')
    expect(html).toContain('Ægget er klar! Tryk på det.')
    expect(html).toContain('role="meter"')
  })

  it('has no hunger, care, guilt or numbers of currency', () => {
    const text = html.replace(/<[^>]+>/g, ' ')
    expect(text).not.toMatch(/sulten|savner|ked af det|venter på dig|glem ikke|kom tilbage|din ven bliver|perler/i)
    expect(text).not.toMatch(/[\u00d7\u00f7%]/)
  })

  it('shows a new child its one friend and an egg that is warming', () => {
    const bo = render(<ZooView profile={zooNewProfile()} now={DEMO_NOW} onDress={() => {}} />)
    expect(animatedRigs(bo)).toHaveLength(1)
    expect(bo).toContain('data-egg-card="warming"')
    expect(bo).not.toContain('data-choice=')
    expect(bo).not.toContain('Ny</span>')
  })
})
