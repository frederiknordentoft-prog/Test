import { describe, expect, it } from 'vitest'
import shapes2DModule from './shapes2D'
import { drawnClass, isA, type Figure } from './isA'
import { flagsRaised, skillContract, tasksUnderTest } from '../number/testing/harness'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { keysForNode } from '../../registry'
import { NODE_BY_ID } from '../../../content/curriculum'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import type { AnswerValue, Fact, Prompt, ShapeId, SkillDef, Task } from '../../types'

const shapes2D: SkillDef = shapes2DModule

/**
 * What each materials variant draws, read off src/art/materials/Shapes.tsx by hand (independent of
 * isA.ts): the generic firkant is a 66 x 56 rectangle, a square turned 45° (variant 1) or a skew
 * four-sided figure (variant 2); small, patterned and outline reuse variant 0's geometry.
 */
const DRAWN: Partial<Record<ShapeId, Record<number, ShapeId>>> = {
  quadrilateral: { 0: 'rectangle', 1: 'square', 2: 'quadrilateral', 3: 'rectangle', 4: 'rectangle', 5: 'rectangle' },
}
const drawn = (shape: ShapeId, variant: number): ShapeId => DRAWN[shape]?.[variant] ?? shape

/** The mathematical classes, written out: every class a figure belongs to. */
const CLASSES: Record<ShapeId, ShapeId[]> = {
  circle: ['circle'],
  semicircle: ['semicircle'],
  triangle: ['triangle'],
  quadrilateral: ['quadrilateral'],
  rectangle: ['rectangle', 'quadrilateral'],
  rhombus: ['rhombus', 'quadrilateral'],
  square: ['square', 'rectangle', 'rhombus', 'quadrilateral'],
  trapezoid: ['trapezoid', 'quadrilateral'],
  pentagon: ['pentagon'],
  hexagon: ['hexagon'],
  octagon: ['octagon'],
}
const member = (shape: ShapeId, variant: number, target: ShapeId) => CLASSES[drawn(shape, variant)].includes(target)

const parseToken = (t: string): [ShapeId, number] => {
  const [, shape, variant] = t.split(':')
  return [shape as ShapeId, Number(variant)]
}
const targetOf = (f: Fact): [ShapeId, number] => parseToken(f.id.replace(/^shp:/, 'shape:'))
const items = (t: Task) => (t.prompt as Extract<Prompt, { scene: 'shapes' }>).items

describe('shapes of 0.–1. klasse', () => {
  skillContract(shapes2D, {
    families: { basic: 18, squareRect: 12, polygons: 12 },
    answerOf(f, kind, task) {
      const [shape, variant] = targetOf(f)
      if (kind === 'choice') return `shape:${shape}:${variant}`
      return items(task).filter((i) => member(i.shape, i.variant, shape)).map((i) => i.id).sort().join('|')
    },
  })
})

describe('isA (SPEC §2.3)', () => {
  it('knows that a square is a rectangle and a rhombus, and both are quadrilaterals', () => {
    for (const [x, ys] of Object.entries(CLASSES)) {
      for (const y of Object.keys(CLASSES)) expect(isA(x as Figure, y as Figure), `${x} ⊂ ${y}`).toBe(ys.includes(y as ShapeId))
    }
    expect(isA('cube', 'cuboid')).toBe(true)
    expect(isA('cuboid', 'cube')).toBe(false)
    expect(isA('rectangle', 'square')).toBe(false)
  })

  it('classifies the materials variants the way they are drawn', () => {
    for (const shape of Object.keys(CLASSES) as ShapeId[]) {
      for (let v = 0; v < 6; v++) expect(drawnClass(shape, v), `${shape} ${v}`).toBe(drawn(shape, v))
    }
  })
})

describe('shapes2D', () => {
  const tasks = tasksUnderTest(shapes2D, 8)

  it('has 3 basic figures and 2 + 3 for 1. klasse, each in its variants', () => {
    const ids = shapes2D.enumerate().map((f) => f.id)
    for (const s of ['circle', 'triangle', 'quadrilateral', 'square', 'rectangle']) {
      for (let v = 0; v < 6; v++) expect(ids).toContain(`shp:${s}:${v}`)
    }
    for (const s of ['pentagon', 'hexagon', 'octagon']) for (const v of [0, 1, 2, 5]) expect(ids).toContain(`shp:${s}:${v}`)
    // 0. klasse only knows cirkel, trekant and firkant
    for (const f of shapes2D.enumerate().filter((x) => x.family === 'basic')) {
      expect(['circle', 'triangle', 'quadrilateral']).toContain(targetOf(f)[0])
    }
  })

  it('never deals two wrong cards that look the same (a turned circle is a circle)', () => {
    for (const { task } of tasks) {
      if (task.kind !== 'choice') continue
      const looks = task.options.map((o) => String(o).replace(/^shape:circle:1$/, 'shape:circle:0'))
      expect(new Set(looks).size).toBe(3)
    }
  })

  it('never deals a card that is also the asked figure', () => {
    for (const { fact, task } of tasks) {
      if (task.kind !== 'choice') continue
      const [shape] = targetOf(fact)
      for (const o of task.options) {
        const [s, v] = parseToken(String(o))
        expect(member(s, v, shape), `${fact.id}: ${String(o)}`).toBe(o === task.answer)
      }
    }
  })

  it('puts every member — and only members — in the "tryk på alle" answer', () => {
    let squaresAsRectangles = 0
    for (const { fact, task } of tasks) {
      if (task.kind !== 'multiSelect') continue
      const [shape] = targetOf(fact)
      const answer = String(task.answer).split('|')
      expect(items(task)).toHaveLength(6)
      for (const i of items(task)) expect(answer.includes(i.id), `${fact.id}: ${i.shape} ${i.variant}`).toBe(member(i.shape, i.variant, shape))
      expect(items(task).some((i) => i.shape === targetOf(fact)[0] && i.variant === targetOf(fact)[1])).toBe(true)
      if (shape === 'rectangle') {
        expect(items(task).some((i) => i.shape === 'square' && answer.includes(i.id))).toBe(true)
        squaresAsRectangles++
      }
      for (const i of items(task)) expect(task.options).toContain(i.id)
    }
    expect(squaresAsRectangles).toBeGreaterThan(0)
  })

  it('marks turned, stretched and small figures as conflict, and offers the prototype-only set there', () => {
    for (const { fact, task } of tasks) {
      const [shape, variant] = targetOf(fact)
      const conflict = shape !== 'circle' && [1, 2, 3].includes(variant)
      expect(task.contrast).toBe(conflict ? 'conflict' : 'congruent')
      if (task.kind === 'choice') {
        // on a conflict fact every other card means the turned/stretched/small figure was not recognised
        for (const o of task.options) if (o !== task.answer) expect(task.distractorTags[String(o)]).toBe(conflict ? 'prototypeOnly' : 'other')
        continue
      }
      const proto = Object.entries(task.distractorTags).filter(([k, tag]) => tag === 'prototypeOnly' && !k.startsWith('shape:')).map(([k]) => k)
      expect(proto.length, fact.id).toBe(conflict ? 1 : 0)
      if (!conflict) continue
      const picked = proto[0].split('|')
      const answer = String(task.answer).split('|')
      // a strict, non-empty part of the answer: exactly the members that stand "nicely"
      expect(picked.length).toBeGreaterThan(0)
      expect(picked.length).toBeLessThan(answer.length)
      for (const id of picked) expect(answer).toContain(id)
      for (const i of items(task).filter((x) => answer.includes(x.id))) {
        expect(picked.includes(i.id)).toBe(![1, 2, 3].includes(i.variant))
      }
      expect(classifyAnswer(task, proto[0])).toBe('prototypeOnly')
      expect(detectableOf(task)).toContain('prototypeOnly')
    }
  })

  it('has a conflict and a congruent fact for every non-round figure', () => {
    for (const shape of ['triangle', 'quadrilateral', 'square', 'rectangle', 'pentagon']) {
      const contrasts = new Set(tasks.filter((t) => targetOf(t.fact)[0] === shape).map((t) => t.task.contrast))
      expect(contrasts).toEqual(new Set(['conflict', 'congruent']))
    }
  })

  it('asks in plain Danish', () => {
    const f = shapes2D.enumerate().find((x) => x.id === 'shp:triangle:1')!
    expect(compile(shapes2D.speech(f, 'choice')).text).toBe('Tryk på trekanten.')
    expect(compile(shapes2D.speech(f, 'multiSelect')).text).toBe('Tryk på alle trekanter.')
    const q = shapes2D.enumerate().find((x) => x.id === 'shp:quadrilateral:2')!
    expect(compile(shapes2D.speech(q, 'multiSelect')).text).toBe('Tryk på alle firkanter.')
    const r = shapes2D.enumerate().find((x) => x.id === 'shp:rectangle:0')!
    expect(compile(shapes2D.hint(r, null).speech).text).toBe('Et rektangel har fire sider og fire rette hjørner. Et kvadrat er også et rektangel.')
    const turned = shapes2D.hint(f, 'prototypeOnly')
    expect(compile(turned.speech).text).toBe('Selv om den ser anderledes ud, er det stadig en trekant. En trekant har tre sider og tre hjørner.')
    expect(turned.misconception).toBe('prototypeOnly')
    expect(turned.visual).toEqual({ scene: 'shape', shape: 'triangle', variant: 1, mark: 'corners' })
  })

  it('keeps Formhaven to the basic figures', () => {
    const keys = keysForNode(NODE_BY_ID['w0-former-l1'], { states: {}, audioVerified: true }).filter((k) => k.skill === 'shapes2D')
    expect(keys).toHaveLength(18)
    expect(keys.every((k) => k.family === 'basic')).toBe(true)
  })

  it('flags a child who only knows figures that stand nicely, and not one who knows them or guesses', () => {
    const keys = keysForNode(NODE_BY_ID['w0-former-l3'], { states: {}, audioVerified: true }).filter((k) => k.skill === 'shapes2D')
    const run = (answer: (t: Task) => AnswerValue) =>
      flagsRaised((i) => keys[(i * 7) % keys.length].build(i % 2 === 0 ? 'multiSelect' : 'choice', makeRng(i), i), 72, answer, 18)
    // sees only the figures that stand nicely: misses the turned, stretched or small one
    const nicelyOnly = (t: Task): AnswerValue => {
      if (t.contrast !== 'conflict') return t.answer
      if (t.kind === 'choice') return t.options.find((o) => o !== t.answer)!
      const [shape] = parseToken(t.factId.replace(/^shp:/, 'shape:'))
      return items(t).filter((i) => member(i.shape, i.variant, shape) && ![1, 2, 3].includes(i.variant)).map((i) => i.id).sort().join('|')
    }
    expect([...run(nicelyOnly)]).toContain('prototypeOnly')
    expect([...run((t) => t.answer)]).toEqual([])
    const rng = makeRng(42)
    const guess = (t: Task): AnswerValue =>
      t.kind === 'choice' ? rng.pick(t.options) : t.options.filter(() => rng.next() < 0.5).map(String).sort().join('|') || String(t.options[0])
    expect([...run(guess)]).toEqual([])
  })
})
