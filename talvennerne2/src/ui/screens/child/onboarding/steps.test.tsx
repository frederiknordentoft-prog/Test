// The onboarding's egg and grade steps as markup (review P1-2, P2-9, P2-10): each egg carries the
// breed and colour its baby hatches with, only the offered starters are there, and the grade step
// says that everyone starts in Engdalen.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { clipText } from '../../../../speech/catalog'
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
})
