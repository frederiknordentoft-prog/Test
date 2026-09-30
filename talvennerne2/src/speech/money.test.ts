import { describe, expect, it } from 'vitest'
import { clipText, hasClip } from './catalog'
import { DENOMINATIONS, coinClip, coinWords, moneyClips, moneyWords } from './money'
import { measureClips, measureWords } from './measure'
import { fractionClips, fractionWords, type Denominator } from './fractions'

// 40 hand-written amounts (øre → words), SPEC §10.1.
const AMOUNTS: [number, string][] = [
  [0, 'nul kroner'],
  [50, 'halvtreds øre'],
  [25, 'femogtyve øre'],
  [1, 'en øre'],
  [100, 'en krone'],
  [150, 'en krone og halvtreds øre'],
  [200, 'to kroner'],
  [250, 'to kroner og halvtreds øre'],
  [300, 'tre kroner'],
  [500, 'fem kroner'],
  [550, 'fem kroner og halvtreds øre'],
  [700, 'syv kroner'],
  [950, 'ni kroner og halvtreds øre'],
  [1000, 'ti kroner'],
  [1100, 'elleve kroner'],
  [1250, 'tolv kroner og halvtreds øre'],
  [1300, 'tretten kroner'],
  [1550, 'femten kroner og halvtreds øre'],
  [1700, 'sytten kroner'],
  [2000, 'tyve kroner'],
  [2100, 'enogtyve kroner'],
  [2150, 'enogtyve kroner og halvtreds øre'],
  [2500, 'femogtyve kroner'],
  [3000, 'tredive kroner'],
  [3450, 'fireogtredive kroner og halvtreds øre'],
  [4000, 'fyrre kroner'],
  [4999, 'niogfyrre kroner og nioghalvfems øre'],
  [5000, 'halvtreds kroner'],
  [6050, 'tres kroner og halvtreds øre'],
  [7500, 'femoghalvfjerds kroner'],
  [8800, 'otteogfirs kroner'],
  [9900, 'nioghalvfems kroner'],
  [10000, 'et hundrede kroner'],
  [10100, 'et hundrede og en krone'],
  [10150, 'et hundrede og en krone og halvtreds øre'],
  [12500, 'et hundrede og femogtyve kroner'],
  [20000, 'to hundrede kroner'],
  [34750, 'tre hundrede og syvogfyrre kroner og halvtreds øre'],
  [50000, 'fem hundrede kroner'],
  [100000, 'tusind kroner'],
]

describe('moneyWords', () => {
  it('reads 40 amounts', () => {
    expect(AMOUNTS).toHaveLength(40)
    for (const [ore, words] of AMOUNTS) expect(moneyWords(ore), String(ore)).toBe(words)
  })

  it('builds the same words from clips, all of them in the catalogue', () => {
    for (const [ore, words] of AMOUNTS) {
      for (const form of ['mid', 'end'] as const) {
        const ids = moneyClips(ore, form)
        for (const id of ids) expect(hasClip(id), id).toBe(true)
        expect(ids.map(clipText).join(' '), String(ore)).toBe(words)
      }
    }
    expect(moneyClips(1250, 'end')).toEqual(['n.mid.12', 'noun.unit.kroner_og', 'n.mid.50', 'noun.unit.ore.end'])
    expect(moneyClips(100, 'end')).toEqual(['n.mid.1', 'noun.unit.krone.end'])
  })

  it('names coins and notes in three cases', () => {
    expect(coinWords(2000, 'indef')).toBe('en tyvekrone')
    expect(coinWords(50, 'def')).toBe('halvtredsøren')
    expect(coinWords(10000, 'pl')).toBe('hundredkronesedler')
    expect(coinWords(5000, 'def')).toBe('halvtredskronesedlen')
    for (const ore of DENOMINATIONS) {
      for (const kind of ['indef', 'def', 'pl'] as const) {
        expect(clipText(coinClip(ore, kind, 'end'))).toBe(coinWords(ore, kind))
      }
    }
  })
})

describe('measureWords', () => {
  it('uses "en" for meter and centimeter, "et" for gram and kilogram', () => {
    expect(measureWords(1, 'm')).toBe('en meter')
    expect(measureWords(1, 'cm')).toBe('en centimeter')
    expect(measureWords(1, 'g')).toBe('et gram')
    expect(measureWords(1, 'kg')).toBe('et kilogram')
    expect(measureWords(101, 'g')).toBe('et hundrede og et gram')
    expect(measureWords(120, 'cm')).toBe('et hundrede og tyve centimeter')
    expect(measureWords(500, 'g')).toBe('fem hundrede gram')
    expect(measureClips(1, 'g', 'end')).toEqual(['n.mid.1.et', 'noun.unit.g.end'])
    expect(measureClips(347, 'cm', 'end')).toEqual(['hog.300', 'n.mid.47', 'noun.unit.cm.end'])
  })
})

describe('fractionWords', () => {
  it('reads the eight named fractions and composes the rest', () => {
    const named: [number, Denominator, string][] = [
      [1, 2, 'en halv'], [1, 3, 'en tredjedel'], [1, 4, 'en fjerdedel'], [2, 3, 'to tredjedele'],
      [3, 4, 'tre fjerdedele'], [1, 5, 'en femtedel'], [1, 6, 'en sjettedel'], [1, 8, 'en ottendedel'],
    ]
    for (const [n, d, words] of named) {
      expect(fractionWords(n, d)).toBe(words)
      expect(fractionClips(n, d, 'end')).toEqual([`noun.frac.${n}_${d}.end`])
      expect(clipText(`noun.frac.${n}_${d}.end`)).toBe(words)
    }
    expect(fractionWords(5, 8)).toBe('fem ottendedele')
    expect(fractionClips(5, 8, 'end')).toEqual(['n.mid.5', 'noun.frac.d8.pl.end'])
    expect(fractionWords(2, 4)).toBe('to fjerdedele')
  })
})
