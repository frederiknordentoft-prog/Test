// The onboarding's egg and grade steps as markup (review P1-2, P2-9, P2-10): each egg carries the
// breed and colour its baby hatches with, only the offered starters are there, and the grade step
// says that everyone starts in Engdalen (or, for 3. klasse with the ladder, where the child starts).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { clipInfo, clipText } from '../../../../speech/catalog'
import { NEXT_CLIPS } from '../../../../speech/clips/ui/placement'
import { offeredStarters, starterLooks } from './flow'
import { EggChoice, GradeStep } from './steps'

type Attrs = Record<string, string>
const buttons = (html: string): Attrs[] =>
  [...html.matchAll(/<button\b([^>]*)>/g)].map((m) => Object.fromEntries([...m[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map((a) => [a[1], a[2] ?? ''])))

describe('the eggs', () => {
  it('show every offered starter in the breed and colour it will hatch with', () => {
    const starters = offeredStarters(() => true)
    const looks = starterLooks('p_test', starters)
    const html = renderToStaticMarkup(<EggChoice help={false} starters={starters} looks={looks} onPick={() => undefined} />)
    const eggs = buttons(html).filter((b) => 'data-species' in b)
    expect(eggs.map((b) => b['data-species'])).toEqual(['rabbit', 'cat', 'puppy', 'horse'])
    for (const b of eggs) {
      const look = looks[b['data-species'] as 'cat']!
      expect(b['data-breed'], b['data-species']).toBe(look.breed)
      expect(b['data-colorway'], b['data-species']).toBe(look.colorway)
    }
    expect(html).toContain('data-count="4"')
  })

  it('leave out a starter that is not drawn', () => {
    const starters = offeredStarters((s) => s !== 'puppy')
    const html = renderToStaticMarkup(<EggChoice help={false} starters={starters} looks={starterLooks('p_test', starters)} onPick={() => undefined} />)
    expect(buttons(html).filter((b) => 'data-species' in b).map((b) => b['data-species'])).toEqual(['rabbit', 'cat', 'horse'])
    expect(html).toContain('data-count="3"')
  })
})

describe('the grade', () => {
  it('says under the four grades that everyone starts in Engdalen', () => {
    const html = renderToStaticMarkup(<GradeStep grade={2} onGrade={() => undefined} />)
    expect(buttons(html).filter((b) => 'data-grade' in b)).toHaveLength(4)
    expect(html).toContain('data-grade-start=""')
    expect(html).toContain(clipText('s.onb.grade.start'))
    expect(clipText('s.onb.grade.start')).toBe('Alle starter i Engdalen.')
  })

  it('says where the child starts instead, when 3. klasse is offered "Vis Pip hvad du kan"', () => {
    const html = renderToStaticMarkup(<GradeStep grade={3} onGrade={() => undefined} start="s.place.grade" />)
    expect(html).toContain('data-grade-start="s.place.grade"')
    expect(html).toContain(clipText('s.place.grade'))
    expect(html).not.toContain(clipText('s.onb.grade.start'))
    // the placement's sentences: their own wave-3 sprite, never preloaded with the UI
    for (const id of ['s.place.grade', 's.place.intro', 's.place.intro.stop', 's.place.start', 's.place.enough', 's.place.done']) {
      expect(clipInfo(id), id).toMatchObject({ wave: 3, pack: 'placement-3', file: 'ui/placement.ts' })
    }
    expect(NEXT_CLIPS.length).toBeGreaterThan(1)
    expect(clipText(NEXT_CLIPS[0])).toBe('Godt, næste!')
  })
})
