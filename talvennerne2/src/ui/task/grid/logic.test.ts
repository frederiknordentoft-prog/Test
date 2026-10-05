import { describe, expect, it } from 'vitest'
import { isCorrect } from '../../../engine/answer'
import { classifyAnswer } from '../../../engine/misconceptions'
import type { Task } from '../../../engine/types'
import { EXAMPLES } from '../../../dev/tasks/examples'
import { canGrid, gridOwnsPrompt, gridSetup, placeValue, pointOf, readValue } from './logic'
import { CELL, PAD, axisAt, crossingAt, frameOf, layers, stepped, ux, uy } from './geometry'

const ex = (id: string): Task => {
  const e = Object.values(EXAMPLES).flat().find((x) => x.id === id)
  if (!e) throw new Error(id)
  return e.task
}
const place = ex('grid-place') // (3, 2) to set
const read = ex('grid-read') // (2, 5) drawn

describe('what a grid task asks', () => {
  it('sets a named point or reads a drawn one, on the net of the prompt', () => {
    expect(gridSetup(place)).toEqual({ w: 6, h: 6, mode: 'place', point: { x: 3, y: 2 } })
    expect(gridSetup(read)).toEqual({ w: 6, h: 6, mode: 'read', point: { x: 2, y: 5 } })
    expect(gridOwnsPrompt(place)).toBe(true)
    expect(gridOwnsPrompt(read)).toBe(true)
  })

  it('plays only points (SPEC A21): a count, a cell set, a point off the net or no drawn point falls back', () => {
    // symmetry: "Hvor mange felter mangler?" over a net of squares
    expect(canGrid({ ...place, prompt: { scene: 'grid', w: 4, h: 4, filled: [0, 3], axis: 'v' }, answer: 2, answerType: 'int' })).toBe(false)
    expect(canGrid({ ...place, answer: '3|7|12' })).toBe(false)
    expect(canGrid({ ...place, answer: 'pt:7,2' })).toBe(false)
    expect(canGrid({ ...place, answerType: 'token' })).toBe(false)
    expect(canGrid({ ...place, prompt: { scene: 'grid', w: 6, h: 6, filled: [] } })).toBe(false)
    expect(canGrid({ ...read, prompt: { scene: 'grid', w: 6, h: 6, filled: [], coords: true } })).toBe(false)
    expect(canGrid({ ...read, answer: 'y:5|x:2' })).toBe(false)
  })

  it('reads a point from either answer form, the axis tokens in any order', () => {
    expect(pointOf('pt:3,2')).toEqual({ x: 3, y: 2 })
    expect(pointOf('x:2|y:5')).toEqual({ x: 2, y: 5 })
    expect(pointOf('y:5|x:2')).toEqual({ x: 2, y: 5 })
    expect(pointOf('x:2')).toBeNull()
    expect(pointOf(4)).toBeNull()
    expect(pointOf(null)).toBeNull()
  })
})

describe('what the view hands in', () => {
  it('is one token for a point set, two for a point read, compared as a set', () => {
    expect(placeValue({ x: 3, y: 2 })).toBe('pt:3,2')
    expect(isCorrect(place, placeValue({ x: 3, y: 2 }))).toBe(true)
    expect(isCorrect(place, placeValue({ x: 2, y: 3 }))).toBe(false)
    expect(classifyAnswer(place, placeValue({ x: 2, y: 3 }))).toBe('other')
    expect(readValue(2, 5)).toBe('x:2|y:5')
    expect(isCorrect(read, readValue(2, 5))).toBe(true)
    // the order of the taps never matters
    expect(isCorrect(read, 'y:5|x:2')).toBe(true)
    expect(isCorrect(read, readValue(5, 2))).toBe(false)
  })

  it('answers every harness example right with its answer and wrong with its wrong answer', () => {
    for (const e of EXAMPLES.grid) {
      const p = pointOf(e.task.answer)!
      const mode = gridSetup(e.task)!.mode
      expect(isCorrect(e.task, mode === 'place' ? placeValue(p) : readValue(p.x, p.y)), e.id).toBe(true)
      const w = pointOf(e.wrong)!
      expect(isCorrect(e.task, mode === 'place' ? placeValue(w) : readValue(w.x, w.y)), e.id).toBe(false)
    }
    expect(EXAMPLES.grid.length).toBeGreaterThanOrEqual(3)
  })
})

describe('where things are on the drawing', () => {
  it('puts the crossings a square apart, 0 at the bottom left', () => {
    const { W, H } = frameOf(6, 6)
    expect([W, H]).toEqual([PAD.l + 6 * CELL + PAD.r, PAD.t + 6 * CELL + PAD.b])
    expect([ux(0), uy(6, 0), ux(6), uy(6, 6)]).toEqual([PAD.l, PAD.t + 6 * CELL, PAD.l + 6 * CELL, PAD.t])
  })

  it('snaps a press to the nearest crossing and keeps it on the net', () => {
    expect(crossingAt(ux(3) + 15, uy(6, 2) - 12, 6, 6)).toEqual({ x: 3, y: 2 })
    expect(crossingAt(ux(3) + 21, uy(6, 2) - 21, 6, 6)).toEqual({ x: 4, y: 3 })
    expect(crossingAt(-50, 9999, 6, 6)).toEqual({ x: 0, y: 0 })
    expect(crossingAt(9999, -50, 6, 6)).toEqual({ x: 6, y: 6 })
  })

  it('picks the nearest number along an axis', () => {
    expect(axisAt('x', ux(4) - 18, 6, 6)).toBe(4)
    expect(axisAt('x', ux(4) + 22, 6, 6)).toBe(5)
    expect(axisAt('y', uy(6, 5) + 10, 6, 6)).toBe(5)
    expect(axisAt('y', 9999, 6, 6)).toBe(0)
  })

  it('lays the net and the two strips of numbers over the drawing, the strips at least 60 px deep on a phone', () => {
    const box = layers(6, 6)
    expect(box.board).toEqual({ left: '14.371%', top: '1.796%', width: '83.832%', height: '83.832%' })
    const { W } = frameOf(6, 6)
    // the smallest figure the CSS draws: a 375 px phone (16 px gutters, 12 px padding)
    const scale = (375 - 2 * 16 - 24) / W
    expect(PAD.b * scale).toBeGreaterThanOrEqual(60)
    expect(PAD.l * scale).toBeGreaterThanOrEqual(60)
    expect(parseFloat(box.x.height) * (375 - 56) / 100).toBeGreaterThanOrEqual(60)
    expect(parseFloat(box.y.width) * (375 - 56) / 100).toBeGreaterThanOrEqual(60)
  })

  it('moves a point one square per arrow key and keeps it on the net', () => {
    expect(stepped({ x: 3, y: 2 }, 'ArrowRight', 6, 6)).toEqual({ x: 4, y: 2 })
    expect(stepped({ x: 3, y: 2 }, 'ArrowUp', 6, 6)).toEqual({ x: 3, y: 3 })
    expect(stepped({ x: 0, y: 0 }, 'ArrowLeft', 6, 6)).toEqual({ x: 0, y: 0 })
    expect(stepped({ x: 6, y: 6 }, 'ArrowUp', 6, 6)).toEqual({ x: 6, y: 6 })
    expect(stepped({ x: 3, y: 2 }, 'Enter', 6, 6)).toBeNull()
  })
})
