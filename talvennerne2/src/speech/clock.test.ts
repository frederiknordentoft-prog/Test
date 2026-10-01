import { describe, expect, it } from 'vitest'
import { hasClip } from './catalog'
import { clockClips, clockWords, dayPart, dayPartClip, dayPartWords, digitalWords } from './clock'

// Independent reference: the SPEC §10.1 table written out by hand, hours spelled by hand.
const HOUR = ['tolv', 'et', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve', 'tolv']
const TABLE: Record<number, (h: string, next: string) => string> = {
  0: (h) => h,
  5: (h) => `fem minutter over ${h}`,
  10: (h) => `ti minutter over ${h}`,
  15: (h) => `kvart over ${h}`,
  20: (h) => `tyve minutter over ${h}`,
  25: (_, n) => `fem minutter i halv ${n}`,
  30: (_, n) => `halv ${n}`,
  35: (_, n) => `fem minutter over halv ${n}`,
  40: (_, n) => `tyve minutter i ${n}`,
  45: (_, n) => `kvart i ${n}`,
  50: (_, n) => `ti minutter i ${n}`,
  55: (_, n) => `fem minutter i ${n}`,
}
const HALF: Record<number, (next: string) => string> = {
  20: (n) => `ti minutter i halv ${n}`,
  40: (n) => `ti minutter over halv ${n}`,
}

describe('clockWords (analog)', () => {
  it('reads all 144 five-minute times on the dial', () => {
    let count = 0
    for (let hour = 0; hour < 12; hour++) {
      for (let m = 0; m < 60; m += 5) {
        const h = HOUR[hour === 0 ? 12 : hour]
        const next = HOUR[hour + 1]
        const expected = TABLE[m](h, next)
        expect(clockWords(hour * 60 + m, 'analog'), `${hour}:${m}`).toBe(expected)
        // 24-hour minutes read the same on the dial
        expect(clockWords((hour + 12) * 60 + m, 'analog')).toBe(expected)
        count++
      }
    }
    expect(count).toBe(144)
  })

  it('reads the 24 half-hour forms at :20 and :40', () => {
    let count = 0
    for (let hour = 0; hour < 12; hour++) {
      for (const m of [20, 40]) {
        expect(clockWords(hour * 60 + m, 'analogHalfForm'), `${hour}:${m}`).toBe(HALF[m](HOUR[hour + 1]))
        count++
      }
      // the half form only changes :20 and :40
      expect(clockWords(hour * 60 + 25, 'analogHalfForm')).toBe(clockWords(hour * 60 + 25, 'analog'))
    }
    expect(count).toBe(24)
  })

  it('says "et" for one o\'clock and wraps twelve to one', () => {
    expect(clockWords(60, 'analog')).toBe('et')
    expect(clockWords(12 * 60 + 30, 'analog')).toBe('halv et')
    expect(clockWords(45, 'analog')).toBe('kvart i et')
    expect(clockWords(11 * 60 + 40, 'analog')).toBe('tyve minutter i tolv')
    expect(clockWords(11 * 60 + 40, 'analogHalfForm')).toBe('ti minutter over halv tolv')
    expect(clockWords(2 * 60 + 25, 'analog')).toBe('fem minutter i halv tre')
  })
})

describe('clockWords (digital)', () => {
  it('reads hours and minutes as numbers, single-digit minutes with "nul"', () => {
    expect(digitalWords(14 * 60 + 23)).toBe('fjorten treogtyve')
    expect(digitalWords(14 * 60 + 5)).toBe('fjorten nul fem')
    expect(digitalWords(14 * 60)).toBe('fjorten nul nul')
    expect(digitalWords(60 + 1)).toBe('et nul et')
    expect(digitalWords(0)).toBe('nul nul nul')
    expect(digitalWords(23 * 60 + 59)).toBe('treogtyve nioghalvtreds')
    expect(digitalWords(7 * 60 + 30)).toBe('syv tredive')
    expect(clockWords(21 * 60 + 41, 'digital')).toBe('enogtyve enogfyrre')
  })
})

describe('time of day', () => {
  it('follows 5–11 morgen, 12–17 eftermiddag, 18–23 aften', () => {
    const at = (h: number) => dayPart(h * 60 + 30)
    expect([4, 5, 11, 12, 17, 18, 23].map(at)).toEqual(['nat', 'morgen', 'morgen', 'eftermiddag', 'eftermiddag', 'aften', 'aften'])
    expect(dayPartWords(14 * 60 + 30)).toBe('om eftermiddagen')
    expect(dayPartClip(8 * 60)).toBe('t.part.morgen')
  })
})

describe('clockClips', () => {
  it('uses whole phrases in end form and lead-in + hour in mid form', () => {
    expect(clockClips(2 * 60 + 25, 'analog', 'end')).toEqual(['t.end.145'])
    expect(clockClips(14 * 60 + 25, 'analog', 'end')).toEqual(['t.end.145'])
    expect(clockClips(3 * 60 + 20, 'analogHalfForm', 'end')).toEqual(['t.half.200'])
    expect(clockClips(3 * 60 + 20, 'analog', 'end')).toEqual(['t.end.200'])
    expect(clockClips(2 * 60 + 30, 'analog', 'mid')).toEqual(['t.part.halv', 'n.mid.3'])
    expect(clockClips(12 * 60 + 30, 'analog', 'mid')).toEqual(['t.part.halv', 'n.mid.1.et'])
    expect(clockClips(60, 'analog', 'mid')).toEqual(['n.mid.1.et'])
    expect(clockClips(14 * 60 + 5, 'digital', 'end')).toEqual(['n.mid.14', 'n.mid.0', 'n.end.5'])
    expect(clockClips(14 * 60, 'digital', 'end')).toEqual(['n.mid.14', 'n.mid.0', 'n.end.0'])
  })

  it('has a catalogue clip for every 5-minute time in every style and form', () => {
    for (let m = 0; m < 1440; m += 5) {
      for (const style of ['analog', 'analogHalfForm', 'digital'] as const) {
        for (const form of ['mid', 'end'] as const) {
          for (const id of clockClips(m, style, form)) expect(hasClip(id), `${m} ${style} ${form}: ${id}`).toBe(true)
        }
      }
    }
    for (let m = 0; m < 1440; m++) {
      for (const id of clockClips(m, 'digital', 'end')) expect(hasClip(id), id).toBe(true)
    }
  })
})
