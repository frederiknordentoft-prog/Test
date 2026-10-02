// The child never sees another animal than its own (review P1-2): the buddy beside the task, on the
// map and at the end of a round is the child's own drawn animal, and a species without a drawing is
// the neutral egg-shaped stand-in — never the rabbit. The stand-in turns into the drawing by itself
// once the species file exists, so these tests read the art registry instead of naming species.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AVAILABLE_SPECIES } from '../../../../art/species/registry'
import { SPECIES, SPECIES_BY_ID } from '../../../../content/catalog'
import type { Animal, SpeciesId } from '../../../../engine/types'
import { AnimalPicture, ItemPicture } from '../map/art'
import { DressedAnimal } from '../wardrobe/WardrobeView'
import { Buddy, isDrawnSpecies, preloadBuddy } from './Buddy'

const animal = (species: SpeciesId): Animal => ({
  uid: `starter-${species}`, species, breed: SPECIES_BY_ID[species].breeds[0], colorway: 'c2', name: 'Fido',
  friendship: 0, stage: 1, star: false, shown: 1, outfit: {}, foundAt: 0, source: 'starter',
})

const drawn = SPECIES.map((s) => s.id).filter((id) => isDrawnSpecies(id))
/** A species without a drawing (the later worlds have several until their art lands). */
const undrawn = SPECIES.map((s) => s.id).find((id) => !isDrawnSpecies(id))
const speciesIn = (html: string) => [...html.matchAll(/data-species="(\w+)"/g)].map((m) => m[1])

describe('the buddy (review P1-2)', () => {
  it('reads which species are drawn from the art registry', () => {
    for (const s of SPECIES) expect(isDrawnSpecies(s.id), s.id).toBe((AVAILABLE_SPECIES as readonly string[]).includes(s.id))
    expect(drawn).toContain('rabbit')
  })

  it('is the child\'s own drawn animal, in its own colour, and nothing else', async () => {
    for (const id of drawn) {
      await preloadBuddy(id)
      const html = renderToStaticMarkup(<Buddy animal={animal(id)} mood="happy" />)
      expect(speciesIn(html), id).toEqual([id])
      expect(html).not.toContain('data-critter')
      expect(html).not.toContain('data-standin')
    }
  })

  it('is the neutral egg form for a species without a drawing, never the rabbit', async () => {
    if (!undrawn) return
    await preloadBuddy('rabbit')
    for (const mood of ['happy', 'think', 'oops', 'cheer'] as const) {
      const html = renderToStaticMarkup(<Buddy animal={animal(undrawn)} mood={mood} />)
      expect(html).toContain('data-critter')
      expect(html).toContain(`data-buddy="${undrawn}"`)
      expect(speciesIn(html)).toEqual([])
    }
  })

  it('is the neutral egg form without a buddy at all', async () => {
    await preloadBuddy('rabbit')
    const html = renderToStaticMarkup(<Buddy animal={null} mood="wave" />)
    expect(html).toContain('data-critter')
    expect(speciesIn(html)).toEqual([])
  })

  it('never shows the stand-in or another animal for a drawn species, loaded or not', () => {
    for (const id of drawn) {
      const html = renderToStaticMarkup(<Buddy animal={animal(id)} mood="happy" />)
      expect(html, id).not.toContain('data-critter')
      expect(speciesIn(html).every((s) => s === id), id).toBe(true)
    }
  })
})

describe('pictures of the child\'s animals (review P1-2)', () => {
  it('draws the stand-in on the map and at the end of a round, never a paw or another animal', () => {
    if (!undrawn) return
    for (const crop of ['head', 'fit'] as const) {
      const html = renderToStaticMarkup(<AnimalPicture animal={animal(undrawn)} size={64} crop={crop} />)
      expect(html, crop).toContain('data-critter')
      expect(html).not.toContain('<img')
    }
    expect(renderToStaticMarkup(<AnimalPicture species={undrawn} size={64} />)).toContain('data-critter')
  })

  it('shows the stand-in in the map\'s top bar for a child without a buddy, not the rabbit', () => {
    const html = renderToStaticMarkup(<AnimalPicture animal={null} size={52} crop="head" />)
    expect(html).toContain('data-critter')
  })

  it('keeps an empty place while a drawn species loads', () => {
    const html = renderToStaticMarkup(<AnimalPicture animal={animal('rabbit')} size={64} />)
    expect(html).not.toContain('data-critter')
  })

  it('dresses the stand-in in the wardrobe for a species without a drawing', () => {
    if (!undrawn) return
    const html = renderToStaticMarkup(<DressedAnimal animal={animal(undrawn)} mood="happy" />)
    expect(html).toContain('data-critter')
    expect(html).toContain(`data-figure="${undrawn}"`)
  })
})

describe('a thing without a drawing (review P1-3)', () => {
  it('is a wrapped gift in its set\'s colour in ceremonies and chests', () => {
    const html = renderToStaticMarkup(<ItemPicture item="pirat-back" size={120} />)
    expect(html).toContain('data-gift="pirat-back"')
    expect(html).toContain('--tone:var(--color-d-clock)')
  })
})
