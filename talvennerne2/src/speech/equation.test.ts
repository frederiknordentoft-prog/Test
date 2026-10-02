// Equation speech (SPEC §10.1 "Regnetegn"): one sentence per question, closed where the question
// ends (UI-fund 13).
import { describe, expect, it } from 'vitest'
import type { Term } from '../engine/types'
import { compile } from './compile'
import { equationSpeech } from './equation'

const say = (terms: Term[]) => compile(equationSpeech(terms)).text

describe('equationSpeech', () => {
  it('reads a blank after the last number as part of the one question', () => {
    const terms: Term[] = [{ n: 7 }, { op: '+' }, { n: 2 }, { op: '=' }, { n: 9 }, { op: '+' }, { blank: true }]
    expect(say(terms)).toBe('Syv plus to er lig med ni plus hvad?')
    // the 9 is said mid-sentence, so its voice does not fall as at a full stop
    expect(equationSpeech(terms).filter((p) => 'num' in p && p.form === 'end')).toEqual([])
  })

  it('keeps the house forms of the other sums', () => {
    expect(say([{ n: 3 }, { op: '+' }, { n: 4 }, { op: '=' }, { blank: true }])).toBe('Hvad er tre plus fire?')
    expect(say([{ n: 3 }, { op: '+' }, { blank: true }, { op: '=' }, { n: 7 }])).toBe('Tre plus hvad giver syv?')
    expect(say([{ n: 8 }, { op: '+' }, { n: 4 }, { op: '=' }, { blank: true }, { op: '+' }, { n: 5 }])).toBe('Otte plus fire er lig med hvad plus fem?')
    expect(say([{ n: 3 }, { op: '+' }, { n: 4 }, { op: '=' }, { n: 7 }])).toBe('Tre plus fire er lig med syv.')
  })
})
