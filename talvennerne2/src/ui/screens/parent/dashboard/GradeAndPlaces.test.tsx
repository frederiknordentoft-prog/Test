// The grade and places sections tell the truth about where a child starts and which worlds are not
// there yet, both before Stjernefjeldet is released and after (a build where it is ready).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ITEMS } from '../../../../content/catalog'
import { skillRegistry } from '../../../../engine/registry'
import { SPECIES_IDS, WORLD_IDS } from '../../../../engine/types'
import { profile } from '../../../../parent/fixtures'
import { GradeSection, PlacesSection } from './GradeAndPlaces'
import { worldReady, type Drawn } from './openings'

const registered = new Set(skillRegistry().all.map((d) => d.id))
/** A build where every world is drawn and released: Stjernefjeldet is ready. */
const ALL_READY: Drawn = { species: new Set(SPECIES_IDS), items: new Set(ITEMS.map((i) => i.id)), released: new Set(WORLD_IDS) }
/** The same build before Stjernefjeldet is released (independent of RELEASED_WORLDS today). */
const NOT_YET: Drawn = { ...ALL_READY, released: new Set(WORLD_IDS.filter((w) => w !== 'fjeld')) }

const grade = (drawn?: Drawn, grade: 0 | 1 | 2 | 3 = 1) =>
  renderToStaticMarkup(<GradeSection profile={profile({ grade })} registered={registered} drawn={drawn} />)
const places = (drawn?: Drawn) => renderToStaticMarkup(<PlacesSection profile={profile({ grade: 1 })} registered={registered} drawn={drawn} />)
/** The HTML of one world's panel. */
const panel = (html: string, world: string) => html.split('data-world-row="').find((p) => p.startsWith(`${world}"`)) ?? ''

describe('where a child starts (GradeSection)', () => {
  it('says that everyone starts in Engdalen while Stjernefjeldet is not ready', () => {
    expect(worldReady('fjeld', registered, NOT_YET)).toBe(false)
    for (const g of [0, 1, 2, 3] as const) {
      const html = grade(NOT_YET, g)
      expect(html).toContain('Alle børn starter i Engdalen. Fra 1. klasse åbner klassetrinnet alle steder i verdenerne under det.')
      expect(html).not.toContain('indtil indplaceringen er klar')
      expect(html).not.toContain('vise Pip')
    }
  })

  it('says that 0.–2. klasse start in Engdalen and 3. klasse can show Pip first, once Stjernefjeldet is ready', () => {
    expect(worldReady('fjeld', registered, ALL_READY)).toBe(true)
    const html = grade(ALL_READY)
    expect(html).toContain(
      'Børn i 0.–2. klasse starter i Engdalen. I 3. klasse kan barnet først vise Pip, hvad det kan, og starter så der, hvor det passer. ' +
        'Fra 1. klasse åbner klassetrinnet alle steder i verdenerne under det. Et lavere klassetrin lukker ikke noget igen.',
    )
    expect(html).not.toContain('Alle børn starter i Engdalen')
  })
})

describe('worlds that are not there yet (PlacesSection)', () => {
  it('says "kommer i en senere version" only about a world that is not ready: Stjernefjeldet before its release', () => {
    const html = places(NOT_YET)
    expect(html.match(/Verdenen kommer i en senere version/g)).toHaveLength(1)
    expect(panel(html, 'fjeld')).toContain('Verdenen kommer i en senere version.')
    for (const w of ['eng', 'bakke', 'skov']) expect(panel(html, w)).not.toContain('senere version')
    expect(panel(html, 'fjeld')).not.toContain('data-place=')
  })

  it('lists a ready Stjernefjeldet with its places to open, and nothing "later"', () => {
    const html = places(ALL_READY)
    expect(html).not.toContain('senere version')
    expect(html).not.toContain('Kommer senere')
    const fjeld = panel(html, 'fjeld')
    for (const name of ['Tabeltoppen', 'Trecifret bro', 'Minuttårnet', 'Delekløften', 'Markedet', 'Arealhaven', 'Brøkbageriet']) expect(fjeld).toContain(name)
    expect(fjeld).toContain('Åbn hele Stjernefjeldet')
  })
})
