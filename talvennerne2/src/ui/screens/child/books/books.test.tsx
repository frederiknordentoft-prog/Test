// The four books rendered for a new and an experienced child: what each one shows, the plain counts,
// the empty pages that invite instead of scold, and the house rules (no rarity, no percentages, no
// comparison, never "only N more", no times or divide sign).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BOOK_IDS, type BookId } from '../../../../app/routes'
import type { ProfileDoc } from '../../../../engine/types'
import { cat } from '../../../../art/species/cat'
import { horse } from '../../../../art/species/horse'
import { rabbit } from '../../../../art/species/rabbit'
import { unicorn } from '../../../../art/species/unicorn'
import { ArtContext } from '../animals/art'
import { zooDemoProfile, zooNewProfile } from '../animals/testing/demo'
import { BooksView } from './BooksView'

const species = { rabbit, cat, horse, unicorn }
const noop = () => {}

function render(profile: ProfileDoc, book: BookId | null): string {
  return renderToStaticMarkup(
    <ArtContext.Provider value={{ species }}>
      <BooksView profile={profile} book={book} onOpen={noop} onBack={noop} onVisit={noop} />
    </ArtContext.Provider>,
  )
}

const ida = zooDemoProfile()
const bo = zooNewProfile()
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length

describe('the shelf', () => {
  it('shows the four books with a plain count on each cover', () => {
    const html = render(ida, null)
    for (const id of BOOK_IDS) expect(html).toContain(`data-cover="${id}"`)
    for (const title of ['Samlebogen', 'Kan-bogen', 'Stempelbogen', 'Trofæerne']) expect(html).toContain(title)
    expect(html).toMatch(/data-cover="collection"[\s\S]*?>16<\/span>/)
    expect(html).toMatch(/data-cover="trophies"[\s\S]*?>8<\/span>/)
  })
})

describe('Samlebogen', () => {
  it('counts what an experienced child has found and opens on the buddy’s species', () => {
    const html = render(ida, 'collection')
    expect(html).toContain('Fundet 16 af 177')
    expect(html).toContain('data-page="rabbit"')
    expect(html).toContain('Fundet 5 af 20')
    expect(count(html, /data-species-tab="/g)).toBe(16)
    // the rabbit page: 18 breed cards, a golden and a rainbow one; 5 found, 15 silhouettes
    expect(count(html, /data-card="rabbit:/g)).toBe(20)
    expect(count(html, /data-card="rabbit:[^"]+" data-found=""/g)).toBe(5)
    expect(html).toContain('Kløver')
    expect(html).toContain('Vædderkanin'.toLowerCase())
  })

  it('shows a new child its starter among silhouettes', () => {
    const html = render(bo, 'collection')
    expect(html).toContain('Fundet 1 af 177')
    expect(count(html, /data-found=""/g)).toBe(1)
    expect(count(html, /bk-card__q/g)).toBe(19)
  })
})

describe('Kan-bogen', () => {
  it('lists gold, silver and bronze in the child’s own words', () => {
    const html = render(ida, 'can')
    expect(html).toContain('Det kan jeg selv')
    expect(html).toContain('Jeg kan tælle til ti.')
    expect(html).toContain('Jeg kan lægge sammen til ti.')
    expect(html.indexOf('data-tier="gold"')).toBeLessThan(html.indexOf('data-tier="silver"'))
    expect(html.indexOf('data-tier="silver"')).toBeLessThan(html.indexOf('data-tier="bronze"'))
    expect(count(html, /data-skill="/g)).toBe(9)
  })

  it('invites a new child to fill it', () => {
    const html = render(bo, 'can')
    expect(html).toContain('data-empty=""')
    expect(html).toContain('Når du bliver god til noget, kommer det i bogen her.')
  })
})

describe('Stempelbogen', () => {
  it('shows the days in total, the stamps in order and the three goals', () => {
    const html = render(ida, 'stamps')
    expect(html).toContain('Dage spillet i alt')
    expect(html).toMatch(/class="[^"]*bk-days__n[^"]*"[^>]*>16</)
    expect(count(html, /class="bk-stamp"/g)).toBe(11)
    expect(count(html, /data-goal="/g)).toBe(3)
    expect(html).toContain('Spil Blandet øvelse.')
    expect(html).toContain('Tag en tur forbi Tællelunden.')
  })

  it('starts at zero for a new child, without a stamp', () => {
    const html = render(bo, 'stamps')
    expect(html).toMatch(/bk-days__n[^"]*"[^>]*>0</)
    expect(html).toContain('Klar et mål, så får du dit første stempel.')
    expect(count(html, /class="bk-stamp"/g)).toBe(0)
  })
})

describe('Trofæerne', () => {
  it('shows all 34: earned ones in colour, the rest as outlines with what earns them', () => {
    const html = render(ida, 'trophies')
    expect(count(html, /data-trophy="/g)).toBe(34)
    expect(count(html, /data-earned=""/g)).toBe(8)
    expect(count(html, /bk-trophy__how/g)).toBe(26)
    expect(html).toContain('Trofæer 8 af 34')
    expect(html).toContain('Regn på tredive forskellige dage.')
    expect(count(html, /class="bk-bar"/g)).toBeGreaterThan(0)
  })

  it('shows a new child every trophy still to come', () => {
    const html = render(bo, 'trophies')
    expect(count(html, /data-earned=""/g)).toBe(0)
    expect(count(html, /bk-trophy__how/g)).toBe(34)
  })
})

describe('house rules in every book', () => {
  it('never shows rarity, percentages, comparison, a times or divide sign, or "only N more"', () => {
    for (const p of [ida, bo]) {
      for (const book of [null, ...BOOK_IDS] as const) {
        const text = render(p, book).replace(/<[^>]+>/g, ' ')
        expect(text).not.toMatch(/sjælden|procent|%|bedre end|flere end din|[\u00d7\u00f7]/i)
        expect(text).not.toMatch(/\bkun (\d+|en|et|to|tre|fire|fem) (til|mere)\b/i)
      }
    }
  })
})
