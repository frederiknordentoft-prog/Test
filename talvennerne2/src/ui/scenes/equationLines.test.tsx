// inverseOps' two equations (UI-fund 12): one line each, so they stay readable on a 393 px phone.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { keysForSkills, skillRegistry } from '../../engine/registry'
import { makeRng } from '../../engine/rng'
import type { Term } from '../../engine/types'
import { PromptScene, equationEm, equationLines } from './PromptScene'

const pair: Term[] = [
  { n: 15 }, { op: '−' }, { n: 6 }, { op: '=' }, { n: 9 }, { text: 'frag.inverseOps.so' }, { n: 9 }, { op: '+' }, { n: 6 }, { op: '=' }, { blank: true },
]

describe('two equations on two lines', () => {
  it('splits at the word, which opens the second line', () => {
    const lines = equationLines(pair)!
    expect(lines[0]).toEqual(pair.slice(0, 5))
    expect(lines[1][0]).toEqual({ text: 'frag.inverseOps.so' })
    const html = renderToStaticMarkup(<PromptScene prompt={{ scene: 'equation', terms: pair }} />)
    expect((html.match(/class="tv-eq /g) ?? []).length).toBe(2)
    expect(html).toContain('tv-scene--lines')
    // sized by the wider line, not by both on one line
    const em = Number(/--eq-em:([\d.]+)/.exec(html)![1])
    expect(em).toBeLessThan(equationEm(pair) * 0.65)
  })

  it('leaves one equation on one line', () => {
    const one: Term[] = [{ n: 3 }, { op: '+' }, { n: 4 }, { op: '=' }, { blank: true }]
    expect(equationLines(one)).toBeNull()
    const html = renderToStaticMarkup(<PromptScene prompt={{ scene: 'equation', terms: one }} />)
    expect((html.match(/class="tv-eq /g) ?? []).length).toBe(1)
  })

  it('splits every inverseOps task', () => {
    const reg = skillRegistry()
    const keys = keysForSkills([{ skill: 'inverseOps' }], { skills: reg, states: {}, audioVerified: true, mode: 'round' })
    expect(keys.length).toBeGreaterThan(0)
    for (const k of keys) {
      for (const kind of k.kinds) {
        const t = k.build(kind, makeRng(2), 0)
        if (t.prompt.scene === 'equation') expect(equationLines(t.prompt.terms), `${t.factId}`).not.toBeNull()
      }
    }
  })
})
