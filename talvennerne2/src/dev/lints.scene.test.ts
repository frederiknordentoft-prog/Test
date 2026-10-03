// Scenearkenes pixel-lint (review G2-r2 §5.1): en flade, der ikke blev tegnet (helt ensfarvet i arkets papirfarve),
// fanges, mens himlens gradient, scenens egne lyse flader (fjerne bakker i start) og små hvide ting ikke gør.
import { describe, expect, it } from 'vitest'
import { BLANK_CELL, BLANK_MAX_SHARE, blankArea, paperLike } from './lints'

const W = 400
const H = 400

/** Et "tegnet" billede: en lodret himmelgradient med lidt dither og en farvet bakke i den nederste halvdel. */
function scene(): Uint8ClampedArray {
  const px = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4
      const dither = (x * 7 + y * 13) % 3 === 0 ? 1 : 0
      const sky = y < H / 2
      px[p] = sky ? 236 + Math.floor((y / H) * 38) + dither : 120
      px[p + 1] = sky ? 228 + Math.floor((y / H) * 20) : 200
      px[p + 2] = sky ? 251 - dither : 90
      px[p + 3] = 255
    }
  return px
}

function fill(px: Uint8ClampedArray, x0: number, y0: number, w: number, h: number, [r, g, b]: [number, number, number]) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const p = (y * W + x) * 4
      px[p] = r
      px[p + 1] = g
      px[p + 2] = b
    }
}

const ALL = { x: 0, y: 0, w: W, h: H }

describe('scenearkets lint for tomme papirflader', () => {
  it('arkets papir, cellens hvide og himlens flade bund tæller som tomme, ikke skyerne eller de blege bakker i start', () => {
    expect(paperLike(255, 243, 220)).toBe(true)
    expect(paperLike(0xff, 0xf8, 0xec)).toBe(true)
    expect(paperLike(255, 255, 255)).toBe(true)
    expect(paperLike(0xbf, 0xe6, 0xff)).toBe(false)
    expect(paperLike(251, 253, 255)).toBe(false)
    expect(paperLike(229, 242, 240)).toBe(false)
    expect(paperLike(120, 200, 90)).toBe(false)
  })

  it('en tegnet scene (gradient, dither og farvede flader, også store blege) har ingen tom flade', () => {
    const px = scene()
    fill(px, 0, 200, W, 120, [229, 242, 240])
    expect(blankArea(px, W, ALL, BLANK_CELL).share).toBe(0)
  })

  it('en flise i papirfarve fanges, med sin boks', () => {
    const px = scene()
    fill(px, 96, 160, 128, 96, [0xff, 0xf8, 0xec])
    const r = blankArea(px, W, ALL, BLANK_CELL)
    expect(r.share).toBeGreaterThan(BLANK_MAX_SHARE)
    expect(r.box).toEqual({ x: 96, y: 160, w: 128, h: 96 })
  })

  it('en lille hvid ting (blomster, uld) er under grænsen, og skitsens flader tæller ikke', () => {
    const px = scene()
    fill(px, 40, 40, 40, 32, [255, 255, 255])
    expect(blankArea(px, W, ALL, BLANK_CELL).share).toBeLessThan(BLANK_MAX_SHARE)
    fill(px, 96, 160, 128, 96, [255, 255, 255])
    expect(blankArea(px, W, ALL, BLANK_CELL, [{ x: 90, y: 150, w: 140, h: 110 }]).share).toBeLessThan(BLANK_MAX_SHARE)
  })
})
