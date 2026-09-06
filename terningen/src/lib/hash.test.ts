import { describe, expect, it } from 'vitest'
import { COMPONENT_IDS } from '../content/model'
import { LAST_BEAT, resolveBeat } from './beats'
import { INITIAL_STATE, parseHash, serializeHash, statesEqual, type ModelState } from './hash'

function allConsistentStates(): ModelState[] {
  const out: ModelState[] = []
  for (let beat = 0; beat <= LAST_BEAT; beat++) {
    const r = resolveBeat(beat)
    for (const bottleneck of [null, ...COMPONENT_IDS]) {
      out.push({ stage: r.stage, openComponent: r.openComponent, beat: r.beat, bottleneck })
    }
  }
  return out
}

describe('URL-hash round-trip', () => {
  it('serialiserer det aftalte format', () => {
    expect(
      serializeHash({ stage: 'exploded', openComponent: 'teknologi', bottleneck: 'governance', beat: 5 }),
    ).toBe('#beat=5&open=teknologi&bottleneck=governance')
    expect(serializeHash(INITIAL_STATE)).toBe('#beat=0')
    expect(serializeHash({ ...INITIAL_STATE, beat: 1, stage: 'exploded' })).toBe('#beat=1')
  })

  it('parse(serialize(state)) giver identisk state for alle konsistente tilstande', () => {
    const states = allConsistentStates()
    expect(states.length).toBe(9 * 8)
    for (const s of states) {
      const back = parseHash(serializeHash(s))
      expect(back).toEqual(s)
      expect(statesEqual(back, s)).toBe(true)
      // og hashen selv er stabil
      expect(serializeHash(back)).toBe(serializeHash(s))
    }
  })

  it('accepterer det eksplicitte eksempel fra specifikationen', () => {
    const s = parseHash('#beat=4&open=teknologi&bottleneck=governance')
    expect(s).toEqual({ stage: 'exploded', openComponent: 'teknologi', bottleneck: 'governance', beat: 4 })
  })

  it('udleder open fra beat og beat fra open', () => {
    expect(parseHash('#beat=2')).toEqual({ stage: 'exploded', openComponent: 'kunde', bottleneck: null, beat: 2 })
    expect(parseHash('#open=maaling')).toEqual({ stage: 'exploded', openComponent: 'maaling', bottleneck: null, beat: 7 })
    expect(parseHash('#open=arbejdsgange')).toEqual({ stage: 'exploded', openComponent: 'arbejdsgange', bottleneck: null, beat: 8 })
    expect(parseHash('#bottleneck=kunde')).toEqual({ ...INITIAL_STATE, bottleneck: 'kunde' })
    expect(parseHash('beat=1')).toEqual({ ...INITIAL_STATE, beat: 1, stage: 'exploded' })
  })

  it('falder tilbage til beat 0 ved ugyldige værdier uden at crashe', () => {
    const invalid = [
      '#beat=9',
      '#beat=-1',
      '#beat=abc',
      '#beat=2.5',
      '#open=nope',
      '#bottleneck=xyz',
      '#beat=3&open=kunde', // modsiger hinanden (kunde er beat 2)
      '#foo=bar',
      '#beat=1&foo=bar',
      '#%E0%A4%A', // ugyldig percent-encoding
      '#=',
      '#&&&',
    ]
    for (const h of invalid) {
      expect(() => parseHash(h)).not.toThrow()
      expect(parseHash(h)).toEqual(INITIAL_STATE)
    }
    expect(parseHash('')).toEqual(INITIAL_STATE)
    expect(parseHash('#')).toEqual(INITIAL_STATE)
    expect(parseHash(null)).toEqual(INITIAL_STATE)
    expect(parseHash(undefined)).toEqual(INITIAL_STATE)
  })
})
