// Pictograms for unitChoice's thing cards (QA2 P3-8, SPEC §3.4): every length thing is drawn in the
// compact style of src/ui/scenes/objects.tsx within the element budget, and objects.tsx passes the
// source lints of src/art/art-lint.test.tsx, which only scans src/art.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UNIT_THINGS } from '../../engine/skills/measure/kit2'
import { ObjectIcon, knownObject } from '../scenes/objects'

const LENGTH = Object.keys(UNIT_THINGS.length)
/** Elements inside the root svg, its group included (art-lint.test.tsx counts the same way). */
const count = (markup: string) => (markup.match(/<[a-zA-Z]/g) ?? []).length - 1

describe('the things unitChoice measures in centimetres and metres', () => {
  it('are the 16 length things', () => {
    expect(LENGTH).toEqual(['pencil', 'fork', 'spoon', 'shoe', 'carrot', 'comb', 'worm', 'leaf', 'bus', 'train', 'lorry', 'ship', 'whale', 'plane', 'bridge', 'house'])
  })

  it.each(LENGTH)('%s can be drawn, in at most 14 SVG elements', (id) => {
    expect(knownObject(id)).toBe(true)
    expect(count(renderToStaticMarkup(<ObjectIcon id={id} />))).toBeLessThanOrEqual(14)
  })

  it('draws every thing differently (none falls back to the plain dot)', () => {
    const marks = LENGTH.map((id) => renderToStaticMarkup(<ObjectIcon id={id} />))
    expect(new Set(marks).size).toBe(LENGTH.length)
    expect(marks).not.toContain(renderToStaticMarkup(<ObjectIcon id="no-such-thing" />))
  })
})

// Mirrors the source scans of src/art/art-lint.test.tsx for the object drawings in src/ui.
describe('kildescanninger · objects.tsx', () => {
  const file = path.resolve(import.meta.dirname, '../scenes/objects.tsx')
  const src = readFileSync(file, 'utf8')

  it('ingen rå hex', () => {
    expect([...src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0])).toEqual([])
  })

  it('ingen lange path-literaler (> 40 tegn)', () => {
    const pathish = /(['"`])(M[-\d\s.,MmLlHhVvCcSsQqTtAaZz]{40,})\1/g
    const attr = /\bd=(["'])([^"']{41,})\1/g
    expect([...src.matchAll(pathish), ...src.matchAll(attr)].map((m) => m[2].slice(0, 30))).toEqual([])
  })

  it('ingen emoji (\\p{Extended_Pictographic}) og ingen gange-/divisionstegn', () => {
    expect(/\p{Extended_Pictographic}|[×÷]/u.test(src)).toBe(false)
  })
})
