import { describe, expect, it } from 'vitest'
import { isCorrect } from '../../../engine/answer'
import type { Task } from '../../../engine/types'
import { EXAMPLES } from '../../../dev/tasks/examples'
import { gridOf, partCentres, partsGeometry } from './geometry'
import {
  MAX_PARTS, canColorParts, colorPartsOwnsPrompt, fracOf, partsOfValue, partsSetup, partsValue, rememberColouring,
  rememberedColouring,
} from './logic'
import type { PartsShape } from './logic'

const ex = (id: string): Task => {
  const e = Object.values(EXAMPLES).flat().find((x) => x.id === id)
  if (!e) throw new Error(id)
  return e.task
}
const threeQuarters = ex('parts-3/4')
const halfRect = ex('parts-1/2-rect') // 1/2 on four parts, accepts 2/4

describe('the figure', () => {
  it('is the prompt’s fraction scene, else a circle cut into the answer’s denominator', () => {
    expect(partsSetup(threeQuarters)).toEqual({ shape: 'circle', parts: 4, equal: true, target: { n: 3, d: 4 } })
    expect(partsSetup(halfRect)).toMatchObject({ shape: 'rect', parts: 4, target: { n: 1, d: 2 } })
    expect(partsSetup(ex('parts-1/4-square'))).toMatchObject({ shape: 'square', parts: 4 })
    expect(partsSetup({ ...threeQuarters, prompt: { scene: 'hear' }, answer: 'frac:2/3' })).toEqual({ shape: 'circle', parts: 3, equal: true, target: { n: 2, d: 3 } })
    expect(colorPartsOwnsPrompt(threeQuarters)).toBe(true)
    expect(colorPartsOwnsPrompt({ ...threeQuarters, prompt: { scene: 'hear' } })).toBe(false)
  })

  it('reads fraction tokens', () => {
    expect(fracOf('frac:3/4')).toEqual({ n: 3, d: 4 })
    expect(fracOf('frac:5/4')).toBeNull()
    expect(fracOf('3/4')).toBeNull()
    expect(fracOf(3)).toBeNull()
  })
})

describe('what the coloured parts hand in', () => {
  it('is the fraction coloured, frac:<coloured>/<parts>', () => {
    expect(partsValue(threeQuarters, [0, 2, 3], 4)).toBe('frac:3/4')
    expect(isCorrect(threeQuarters, partsValue(threeQuarters, [3, 1, 0], 4))).toBe(true)
    expect(isCorrect(threeQuarters, partsValue(threeQuarters, [0], 4))).toBe(false)
    expect(isCorrect(threeQuarters, partsValue(threeQuarters, [0, 1, 2, 3], 4))).toBe(false)
  })

  it('takes an equal fraction the skill accepts: two of four parts for one half', () => {
    expect(partsValue(halfRect, [1, 2], 4)).toBe('frac:2/4')
    expect(isCorrect(halfRect, 'frac:2/4')).toBe(true)
    expect(isCorrect(halfRect, partsValue(halfRect, [0, 1, 2], 4))).toBe(false)
  })

  it('is the parts themselves when the task asks for particular parts', () => {
    const which: Task = { ...threeQuarters, answer: 'p0|p2', answerType: 'set' }
    expect(partsValue(which, [2, 0], 4)).toBe('p0|p2')
    expect(isCorrect(which, partsValue(which, [2, 0], 4))).toBe(true)
    expect(isCorrect(which, partsValue(which, [1, 3], 4))).toBe(false)
    expect(canColorParts(which)).toBe(true)
    expect(canColorParts({ ...threeQuarters, answer: 4 })).toBe(false)
  })

  it('pictures an answer: the first parts of the figure (a half on four parts is two), or listed parts', () => {
    expect(partsOfValue('frac:3/4', 4)).toEqual([0, 1, 2])
    expect(partsOfValue('frac:1/2', 4)).toEqual([0, 1])
    expect(partsOfValue('p1|p3', 4)).toEqual([1, 3])
    expect(partsOfValue('nope', 4)).toEqual([])
    rememberColouring('t', 'frac:1/4', [3])
    expect(rememberedColouring('t', 'frac:1/4')).toEqual([3])
  })

  it('answers every harness example right with its answer and wrong with its wrong answer', () => {
    for (const e of EXAMPLES.colorParts) {
      const t = e.task
      const { parts } = partsSetup(t)
      expect(isCorrect(t, partsValue(t, partsOfValue(t.answer, parts), parts)), e.id).toBe(true)
      expect(isCorrect(t, partsValue(t, partsOfValue(e.wrong, parts), parts)), e.id).toBe(false)
    }
  })
})

describe('equal parts, each big enough to tap', () => {
  const SHAPES: PartsShape[] = ['circle', 'rect', 'bar', 'square']
  /** The narrowest width each figure is drawn at on a 393 px phone (colorParts.css). */
  const PHONE_PX: Record<PartsShape, number> = { circle: 300, square: 330, rect: 330, bar: 337 }

  it('cuts every figure into exactly the asked number of parts', () => {
    for (const shape of SHAPES) {
      for (let n = 2; n <= MAX_PARTS; n++) {
        const g = partsGeometry(shape, n)
        expect(g.parts, `${shape} ${n}`).toHaveLength(n)
        expect(g.sizes, `${shape} ${n}`).toHaveLength(n)
        expect(partCentres(shape, n), `${shape} ${n}`).toHaveLength(n)
      }
    }
  })

  it('makes the parts equal (same sector angle, same cell)', () => {
    for (const shape of SHAPES) {
      for (let n = 2; n <= MAX_PARTS; n++) {
        const sizes = partsGeometry(shape, n).sizes
        for (const s of sizes) {
          expect(s.w, `${shape} ${n}`).toBeCloseTo(sizes[0].w, 6)
          expect(s.h, `${shape} ${n}`).toBeCloseTo(sizes[0].h, 6)
          expect(s.deg ?? 0, `${shape} ${n}`).toBeCloseTo(sizes[0].deg ?? 0, 6)
        }
      }
    }
  })

  it('draws a deliberately unequal cut unequal', () => {
    const sizes = partsGeometry('bar', 3, false).sizes
    expect(sizes[0].w).toBeGreaterThan(sizes[2].w * 1.5)
  })

  it('keeps every part a 60 px target on a phone for the fractions the skills ask (halves to sixths)', () => {
    for (const shape of SHAPES) {
      for (let n = 2; n <= 6; n++) {
        const g = partsGeometry(shape, n)
        const k = PHONE_PX[shape] / (g.w + 8)
        for (const s of g.sizes) {
          if (s.deg !== undefined) {
            // a sector: its outer arc is the wide end the finger lands on
            expect((2 * Math.PI * s.w * k * s.deg) / 360, `${shape} ${n}`).toBeGreaterThanOrEqual(60)
          } else {
            expect(Math.min(s.w, s.h) * k, `${shape} ${n}`).toBeGreaterThanOrEqual(60)
          }
        }
      }
    }
  })

  it('lays rectangles out in rows that fit a phone', () => {
    expect(gridOf('square', 4)).toEqual([2, 2])
    expect(gridOf('rect', 4)).toEqual([1, 4])
    expect(gridOf('rect', 8)).toEqual([2, 4])
    expect(gridOf('bar', 3)).toEqual([1, 3])
    expect(gridOf('bar', 6)).toEqual([2, 3])
    expect(gridOf('bar', 7)).toEqual([1, 7])
  })
})
