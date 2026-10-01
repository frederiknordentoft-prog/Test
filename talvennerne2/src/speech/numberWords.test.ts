import { describe, expect, it } from 'vitest'
import { clipText, hasClip } from './catalog'
import { numberClips, numberWords } from './numberWords'

// An independent parser for Danish number words 0–1000, written as a token state machine instead
// of the generator's recursive composition. It is strict: it rejects "en hundrede", "og" anywhere
// but before the last group, and two number words in a row.
const ONES: Record<string, number> = {
  nul: 0, en: 1, et: 1, to: 2, tre: 3, fire: 4, fem: 5, seks: 6, syv: 7, otte: 8, ni: 9, ti: 10,
  elleve: 11, tolv: 12, tretten: 13, fjorten: 14, femten: 15, seksten: 16, sytten: 17, atten: 18, nitten: 19,
}
const TENS: Record<string, number> = {
  tyve: 20, tredive: 30, fyrre: 40, halvtreds: 50, tres: 60, halvfjerds: 70, firs: 80, halvfems: 90,
}
const COMPOUND = new RegExp(`^(en|to|tre|fire|fem|seks|syv|otte|ni)og(${Object.keys(TENS).join('|')})$`)

function wordValue(word: string): number {
  if (word in ONES) return ONES[word]
  if (word in TENS) return TENS[word]
  const m = COMPOUND.exec(word)
  if (!m) throw new Error(`ukendt talord: ${word}`)
  return ONES[m[1]] + TENS[m[2]]
}

function parseDanish(text: string): number {
  const tokens = text.split(' ')
  if (tokens.length === 1 && tokens[0] === 'tusind') return 1000
  let value = 0
  let state: 'start' | 'number' | 'hundred' | 'og' | 'done' = 'start'
  for (const t of tokens) {
    if (t === 'hundrede') {
      if (state !== 'number' || value < 1 || value > 9) throw new Error(`hundrede efter ${value}: ${text}`)
      if (value === 1 && !text.startsWith('et ')) throw new Error(`"et hundrede" skal have et: ${text}`)
      value *= 100
      state = 'hundred'
    } else if (t === 'og') {
      if (state !== 'hundred') throw new Error(`"og" uden hundrede: ${text}`)
      state = 'og'
    } else {
      if (state === 'number' || state === 'done' || state === 'hundred') throw new Error(`to talord i træk: ${text}`)
      const v = wordValue(t)
      if (state === 'og') {
        if (v === 0) throw new Error(`"og nul": ${text}`)
        value += v
        state = 'done'
      } else {
        value = v
        state = 'number'
      }
    }
  }
  if (state === 'og') throw new Error(`ender på og: ${text}`)
  return value
}

// Hand-written reference values (SPEC §10.1, pædagogik §6.1).
const TABLE: [number, string][] = [
  [0, 'nul'], [1, 'en'], [2, 'to'], [3, 'tre'], [7, 'syv'], [10, 'ti'], [11, 'elleve'], [12, 'tolv'],
  [13, 'tretten'], [14, 'fjorten'], [15, 'femten'], [16, 'seksten'], [17, 'sytten'], [18, 'atten'],
  [19, 'nitten'], [20, 'tyve'], [21, 'enogtyve'], [22, 'toogtyve'], [30, 'tredive'], [34, 'fireogtredive'],
  [38, 'otteogtredive'], [40, 'fyrre'], [45, 'femogfyrre'], [50, 'halvtreds'], [57, 'syvoghalvtreds'],
  [60, 'tres'], [68, 'otteogtres'], [70, 'halvfjerds'], [71, 'enoghalvfjerds'], [80, 'firs'],
  [83, 'treogfirs'], [90, 'halvfems'], [99, 'nioghalvfems'], [100, 'et hundrede'],
  [101, 'et hundrede og en'], [105, 'et hundrede og fem'], [110, 'et hundrede og ti'],
  [120, 'et hundrede og tyve'], [200, 'to hundrede'], [220, 'to hundrede og tyve'],
  [304, 'tre hundrede og fire'], [347, 'tre hundrede og syvogfyrre'], [500, 'fem hundrede'],
  [611, 'seks hundrede og elleve'], [999, 'ni hundrede og nioghalvfems'], [1000, 'tusind'],
]

describe('numberWords', () => {
  it('matches the hand-written table', () => {
    for (const [n, words] of TABLE) expect(numberWords(n), String(n)).toBe(words)
  })

  it('round-trips every number 0–1000 through an independent parser, in both genders', () => {
    for (let n = 0; n <= 1000; n++) {
      expect(parseDanish(numberWords(n)), numberWords(n)).toBe(n)
      expect(parseDanish(numberWords(n, 'n')), numberWords(n, 'n')).toBe(n)
    }
  })

  it('says "et" only for a final standalone 1 in neuter', () => {
    expect(numberWords(1, 'n')).toBe('et')
    expect(numberWords(101, 'n')).toBe('et hundrede og et')
    expect(numberWords(21, 'n')).toBe('enogtyve')
    expect(numberWords(100, 'c')).toBe('et hundrede')
    expect(numberWords(1, 'c')).toBe('en')
  })

  it('writes 21–99 as one word and never uses digits', () => {
    for (let n = 21; n <= 99; n++) expect(numberWords(n)).not.toContain(' ')
    for (let n = 0; n <= 1000; n++) expect(numberWords(n)).not.toMatch(/\d/)
  })

  it('reads numbers outside 0–1000 without digits', () => {
    expect(numberWords(2026)).toBe('to tusind og seksogtyve')
    expect(numberWords(1234)).toBe('tusind to hundrede og fireogtredive')
    expect(numberWords(-5)).toBe('minus fem')
    expect(numberWords(2.5)).toBe('to komma fem')
    expect(numberWords(1.05)).toBe('en komma nul fem')
  })
})

describe('numberClips', () => {
  it('uses whole clips for 0–100 and 1000, head + tail above 100, and round hundreds', () => {
    expect(numberClips(47, 'end')).toEqual(['n.end.47'])
    expect(numberClips(100, 'mid')).toEqual(['n.mid.100'])
    expect(numberClips(347, 'end')).toEqual(['hog.300', 'n.end.47'])
    expect(numberClips(304, 'mid')).toEqual(['hog.300', 'n.mid.4'])
    expect(numberClips(300, 'end')).toEqual(['h.end.300'])
    expect(numberClips(1000, 'end')).toEqual(['n.end.1000'])
    expect(numberClips(1, 'end', 'n')).toEqual(['n.end.1.et'])
    expect(numberClips(101, 'end', 'n')).toEqual(['hog.100', 'n.end.1.et'])
  })

  it('spells the same words as numberWords for every number and gender', () => {
    for (let n = 0; n <= 1000; n++) {
      for (const g of ['c', 'n'] as const) {
        for (const form of ['mid', 'end'] as const) {
          const ids = numberClips(n, form, g)
          for (const id of ids) expect(hasClip(id), id).toBe(true)
          expect(ids.map(clipText).join(' '), `${n} ${g}`).toBe(numberWords(n, g))
        }
      }
    }
  })

  it('gives numbers without recordings ids that are not in the catalogue', () => {
    expect(numberClips(1234, 'end').some(hasClip)).toBe(false)
    expect(numberClips(2.5, 'end')).toEqual(['n.mid.2', 'op.komma', 'n.end.5'])
  })
})
