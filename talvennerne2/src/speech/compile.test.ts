import { describe, expect, it } from 'vitest'
import type { SpeechPart } from '../engine/types'
import { allClips, clipText, hasClip } from './catalog'
import { GAP_MS, compile, isQuestion, toDanishText } from './compile'
import { DENOMINATORS } from './fractions'

describe('compile', () => {
  it('turns the V1 sum into clips, gaps and text', () => {
    const c = compile([{ clip: 'frag.hvad_er' }, { num: 38, form: 'mid' }, { clip: 'op.plus' }, { num: 45, form: 'end' }])
    expect(c.clips).toEqual(['frag.hvad_er', 'n.mid.38', 'op.plus', 'n.end.45'])
    expect(c.gapsMs).toEqual([GAP_MS.phrase, GAP_MS.mid, GAP_MS.phrase])
    expect(c.text).toBe('Hvad er otteogtredive plus femogfyrre?')
    expect(c.missing).toEqual([])
  })

  it('puts 20 ms at the hundred seam and 250 ms between sentences', () => {
    const c = compile([{ clip: 'frag.find_tallet' }, { num: 304, form: 'end' }, { clip: 'frag.find_tallet' }, { num: 1, form: 'end' }])
    expect(c.clips).toEqual(['frag.find_tallet', 'hog.300', 'n.end.4', 'frag.find_tallet', 'n.end.1'])
    expect(c.gapsMs).toEqual([GAP_MS.phrase, GAP_MS.seam, GAP_MS.sentence, GAP_MS.phrase])
    expect(c.text).toBe('Find tallet tre hundrede og fire. Find tallet en.')
  })

  it('binds a unit noun tightly to its number', () => {
    const c = compile([{ money: { ore: 1250, form: 'end' } }])
    expect(c.gapsMs).toEqual([GAP_MS.bound, GAP_MS.phrase, GAP_MS.bound])
    expect(c.text).toBe('Tolv kroner og halvtreds øre.')
  })

  it('reads clocks, measures and fractions', () => {
    expect(toDanishText([{ clip: 'frag.stil_uret_saa_klokken_er' }, { clock: { minutes: 145, style: 'analog', form: 'end' } }]))
      .toBe('Stil uret, så klokken er fem minutter i halv tre.')
    expect(toDanishText([{ clip: 'frag.klokken_er' }, { clock: { minutes: 870, style: 'analog', form: 'mid' } }, { clip: 't.part.eftermiddag' }]))
      .toBe('Klokken er halv tre om eftermiddagen.')
    expect(toDanishText([{ measure: { value: 1, unit: 'kg', form: 'end' } }])).toBe('Et kilogram.')
    expect(toDanishText([{ frac: { n: 3, d: 4, form: 'end' } }])).toBe('Tre fjerdedele.')
  })

  it('keeps whole question clips as sentences', () => {
    const c = compile([{ clip: 'q.add:3+4' }])
    expect(c.text).toBe('Hvad er tre plus fire?')
    expect(c.gapsMs).toEqual([])
    expect(compile([{ clip: 'q.add:3+4' }, { clip: 'q.sub:9-5' }]).gapsMs).toEqual([GAP_MS.sentence])
  })

  it('splits free text into its own utterance and reads its digits as words', () => {
    const c = compile([{ clip: 'frag.det_er' }, { free: 'Sofie 2' }, { clip: 'q.add:3+4' }])
    expect(c.utterances).toEqual([
      { kind: 'clips', clips: ['frag.det_er'], gapsMs: [] },
      { kind: 'free', text: 'Sofie to' },
      { kind: 'clips', clips: ['q.add:3+4'], gapsMs: [] },
    ])
    expect(c.clips).toEqual(['frag.det_er', 'q.add:3+4'])
    expect(c.gapsMs).toEqual([GAP_MS.sentence])
    expect(c.text).toBe('Det er Sofie to. Hvad er tre plus fire?')
  })

  it('reports clips that are not in the catalogue', () => {
    const c = compile([{ clip: 's.findes.ikke' }, { num: 5000, form: 'end' }])
    expect(c.missing).toEqual(['s.findes.ikke', 'n.end.5000'])
    expect(c.text).toBe('Fem tusind.')
  })

  it('detects questions', () => {
    expect(isQuestion('fire plus hvad giver ti')).toBe(true)
    expect(isQuestion('hvilket tal kommer efter tre')).toBe(true)
    expect(isQuestion('er tre større end fire')).toBe(true)
    expect(isQuestion('tre plus fire er lig med syv')).toBe(false)
    expect(isQuestion('find tallet fem')).toBe(false)
  })
})

describe('toDanishText never contains digits', () => {
  it('for numbers, clocks, money, measures, fractions, free text and every catalogue clip', () => {
    const parts: SpeechPart[][] = []
    for (let n = 0; n <= 1000; n++) {
      parts.push([{ num: n, form: 'mid' }], [{ num: n, form: 'end', gender: 'n' }])
      parts.push([{ measure: { value: n, unit: n % 2 ? 'g' : 'cm', form: 'end' } }])
    }
    for (let m = 0; m < 1440; m++) {
      parts.push([{ clock: { minutes: m, style: 'digital', form: 'end' } }])
      parts.push([{ clock: { minutes: m, style: m % 2 ? 'analog' : 'analogHalfForm', form: m % 3 ? 'end' : 'mid' } }])
    }
    for (let ore = 0; ore <= 100000; ore += 25) parts.push([{ money: { ore, form: 'end' } }])
    for (const d of DENOMINATORS) for (let n = 0; n <= 2 * d; n++) parts.push([{ frac: { n, d, form: 'end' } }])
    parts.push([{ free: 'Emma 7 år og 12 dage' }], [{ num: 123456, form: 'end' }], [{ num: -3.25, form: 'end' }])
    for (const c of allClips()) parts.push([{ clip: c.id }])
    for (const p of parts) expect(toDanishText(p), JSON.stringify(p)).not.toMatch(/\d/)
  })
})

describe('every clip compile() can produce exists in the catalogue', () => {
  const check = (parts: SpeechPart[]) => {
    for (const id of compile(parts).clips) if (!hasClip(id)) throw new Error(`${JSON.stringify(parts)} → ${id}`)
  }

  it('numbers 0–1000 in both forms and genders', () => {
    for (let n = 0; n <= 1000; n++) {
      for (const form of ['mid', 'end'] as const) {
        for (const gender of ['c', 'n'] as const) check([{ num: n, form, gender }])
      }
    }
  })

  it('money, measures and fractions', () => {
    for (let ore = 0; ore <= 100000; ore += 50) for (const form of ['mid', 'end'] as const) check([{ money: { ore, form } }])
    for (let ore = 1; ore < 200; ore++) check([{ money: { ore, form: 'end' } }])
    for (let v = 0; v <= 1000; v++) {
      for (const unit of ['cm', 'm', 'g', 'kg'] as const) check([{ measure: { value: v, unit, form: 'end' } }])
    }
    for (const d of DENOMINATORS) {
      for (let n = 0; n <= 2 * d; n++) for (const form of ['mid', 'end'] as const) check([{ frac: { n, d, form } }])
    }
  })

  it('keeps the catalogue text of a single clip', () => {
    for (const c of allClips()) {
      const text = compile([{ clip: c.id }]).text.toLowerCase()
      expect(text.includes(clipText(c.id).toLowerCase().replace(/[.?!]$/, '')), c.id).toBe(true)
    }
  })
})
