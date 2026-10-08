// QA3b: pictures larger than the prompt card. Coins are made smaller only when they would not fit the
// card (rowFit), and an equation with long unit words is sized by them (equationEm).
import { describe, expect, it } from 'vitest'
import { clipText } from '../../speech/catalog'
import type { Term } from '../../engine/types'
import { equationEm, rowFit } from './PromptScene'

describe('coins in the card (rowFit)', () => {
  const coin = { w: 49, h: 49 }

  it('keeps the size of pieces that fit, in one row or wrapped', () => {
    expect(rowFit([coin, coin, coin], { w: 320, h: 60 })).toBe(1)
    // 12 coins of 49 px: six to a row of 330 px (6 · 49 + 5 · 6 = 324), two rows in 110 px
    expect(rowFit(Array(12).fill(coin), { w: 330, h: 110 })).toBe(1)
  })

  it('makes twenty halvtredsører small enough for a card the error flow shrinks', () => {
    const room = { w: 340, h: 90 }
    const k = rowFit(Array(20).fill(coin), room)
    expect(k).toBeLessThan(1)
    // at that scale they fit: rows of as many as the width takes, no taller than the room
    const s = 49 * k
    const perRow = Math.floor((room.w + 6) / (s + 6))
    const rows = Math.ceil(20 / perRow)
    expect(rows * s + (rows - 1) * 6).toBeLessThanOrEqual(room.h + 0.01)
    // and not much smaller than they must be
    expect(rowFit(Array(20).fill(coin), { w: 340, h: 90 / 0.9 })).toBeGreaterThan(k)
  })
})

describe('the width of an equation with unit words (equationEm)', () => {
  const M: Term = { text: 'noun.unit.m.end' }
  const CM: Term = { text: 'noun.unit.cm.end' }
  const terms: Term[] = [{ n: 9 }, M, { n: 63 }, CM, { op: '=' }, { blank: true }, CM]

  it('counts "centimeter" as wider than a short word, so "9 meter 63 centimeter = ? centimeter" fits its card', () => {
    expect(clipText('noun.unit.cm.end').length).toBeGreaterThan(7)
    expect(equationEm(terms, 1, clipText)).toBeGreaterThan(equationEm(terms))
  })

  it('leaves short words (inverseOps "så") and equations without words as before', () => {
    const so: Term[] = [{ n: 15 }, { op: '−' }, { n: 6 }, { op: '=' }, { n: 9 }, { text: 'frag.inverseOps.so' }, { n: 9 }, { op: '+' }, { n: 6 }, { op: '=' }, { blank: true }]
    expect(equationEm(so, 1, clipText)).toBe(equationEm(so))
    const plain: Term[] = [{ n: 3 }, { op: '+' }, { n: 4 }, { op: '=' }, { blank: true }]
    expect(equationEm(plain, 1, clipText)).toBe(equationEm(plain))
  })
})
