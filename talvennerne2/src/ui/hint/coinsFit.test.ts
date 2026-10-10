// QA3c P2-2: the lightbulb's coins keep their own sizes while the card has room, and get smaller only
// when they would not fit, all by the same factor (a fixed cap made 2 kr. as small as 1 kr.). In a card
// too short for coins over their sum (an iPhone SE's keypad, the error flow) they stand beside it.
import { describe, expect, it } from 'vitest'
import { COIN_MM } from '../../art/materials'
import type { CoinOre } from '../../art/materials'
import { helpCoinsScale } from './HintVisual'

/** A coin as the help draws it (Coin mm={2.3}: 100 wide, 106.5 high in its viewBox). */
const coin = (ore: CoinOre) => ({ w: COIN_MM[ore] * 2.3, h: COIN_MM[ore] * 2.3 * 1.065 })
const SUM = { w: 71.5, h: 42.8 }

describe("the help's coins in the round's card (helpCoinsScale)", () => {
  it('keeps a 2-krone bigger than a 1-krone: one factor for all, never a cap per coin', () => {
    const sizes = [coin(200), coin(200), coin(200), coin(100)]
    const { k } = helpCoinsScale(sizes, { width: 329, coinsH: sizes[0].h, helpH: sizes[0].h + 10 + SUM.h, sum: SUM, gap: 10, over: 8, ch: 190 })
    expect(k).toBeLessThan(1)
    expect(k).toBeGreaterThan(0.8)
    expect(sizes[0].w * k).toBeGreaterThan(sizes[3].w * k + 8)
  })

  it('on a phone with the keypad, six coins of biggestFirst stay over their sum in one smaller row', () => {
    const sizes = [coin(2000), coin(2000), coin(2000), coin(1000), coin(500), coin(100)]
    const coinsH = coin(500).h * 2 + 4
    const r = helpCoinsScale(sizes, { width: 325, coinsH, helpH: coinsH + 10 + SUM.h, sum: SUM, gap: 10, over: 73, ch: 190 })
    expect(r.beside).toBe(false)
    // one row: as wide as the help allows
    expect(sizes.reduce((w, s) => w + s.w * r.k, 0) + 5 * 4).toBeLessThanOrEqual(325)
    expect(r.k).toBeGreaterThan(0.8)
  })

  it('on an iPhone SE with the keypad (a 102 px card), three 1-kroner stand beside "3 kr." at their own size', () => {
    const sizes = [coin(100), coin(100), coin(100)]
    const coinsH = sizes[0].h
    // the picture (41), the card's gap (12), the help's line (10), the coins, 10, the sum; the card 134 - 8
    const over = 41 + 12 + 10 + coinsH + 10 + SUM.h - (134 - 8)
    const r = helpCoinsScale(sizes, { width: 319, coinsH, helpH: coinsH + 10 + SUM.h, sum: SUM, gap: 10, over, ch: 102 })
    expect(r.beside).toBe(true)
    expect(r.k).toBe(1)
  })

  it('in the error flow on an iPhone SE, "4,50 kr." twice: six coins beside "9 kr.", smaller but in their sizes', () => {
    const sizes = [coin(200), coin(200), coin(200), coin(200), coin(50), coin(50)]
    const coinsH = coin(200).h * 2 + 4
    const helpH = coinsH + 10 + SUM.h
    // a 93 px card (QA3c): the picture 37, 12, 10 and the help in 113 - 8
    const over = 37 + 12 + 10 + helpH - (113 - 8)
    const r = helpCoinsScale(sizes, { width: 319, coinsH, helpH, sum: SUM, gap: 10, over, ch: 93 })
    expect(r.beside).toBe(true)
    expect(helpH - over).toBeGreaterThanOrEqual(SUM.h)
    expect(sizes.reduce((w, s) => w + s.w * r.k, 0) + 5 * 4 + SUM.w + 10).toBeLessThanOrEqual(319 + 0.5)
    expect(coin(200).w * r.k).toBeGreaterThan(coin(50).w * r.k)
  })

  it('in a card too short even for that (the tag over the thing counted too), they stand beside "9 kr." as high as it', () => {
    const sizes = [coin(200), coin(200), coin(200), coin(200), coin(50), coin(50)]
    const coinsH = coin(200).h * 2 + 4
    const helpH = coinsH + 10 + SUM.h
    // the picture 37 and its tag 2 · 7 over it, 12, 10 and the help in a 113 px card (93 inside)
    const over = 37 + 14 + 12 + 10 + helpH - (113 - 8)
    expect(helpH - over).toBeLessThan(SUM.h)
    const r = helpCoinsScale(sizes, { width: 319, coinsH, helpH, sum: SUM, gap: 10, over, ch: 93 })
    expect(r.beside).toBe(true)
    expect(coin(200).h * r.k).toBeLessThanOrEqual(SUM.h + 0.5)
    expect(coin(200).w * r.k).toBeGreaterThan(30)
    expect(coin(200).w * r.k).toBeGreaterThan(coin(50).w * r.k)
  })

  it('never makes the biggest coin smaller than a sixth of the card high', () => {
    const sizes = [coin(500), coin(100)]
    // over their sum (beside it, the sum's own height keeps them bigger)
    const r = helpCoinsScale(sizes, { width: 100, coinsH: coin(500).h, helpH: coin(500).h + 10 + SUM.h, sum: null, gap: 10, over: 200, ch: 100 })
    expect(r.beside).toBe(false)
    expect(coin(500).h * r.k).toBeCloseTo(18, 1)
    const b = helpCoinsScale(sizes, { width: 300, coinsH: coin(500).h, helpH: coin(500).h + 10 + SUM.h, sum: SUM, gap: 10, over: 200, ch: 100 })
    expect(b.beside).toBe(true)
    expect(coin(500).h * b.k).toBeGreaterThanOrEqual(18)
  })
})
