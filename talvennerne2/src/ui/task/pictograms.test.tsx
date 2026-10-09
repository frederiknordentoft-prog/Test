// Pictograms for unitChoice's thing cards (QA2 P3-8, SPEC §3.4): every length thing is drawn in the
// compact style of src/ui/scenes/objects.tsx within the element budget, every `mt:` card of every
// length multiSelect shows its picture and its word in all three face sizes (cards, struck answer,
// confirm button), and objects.tsx passes the source lints of src/art/art-lint.test.tsx, which only
// scans src/art.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { SkillDef, Task } from '../../engine/types'
import { buildTask } from '../../engine/tasks'
import { makeRng } from '../../engine/rng'
import unitChoiceModule from '../../engine/skills/measure/unitChoice'
import { UNIT_THINGS } from '../../engine/skills/measure/kit2'
import { ObjectIcon, knownObject } from '../scenes/objects'
import { OptionFace } from './faces'
import { MultiSelectFace } from './multiSelect/View'

const LENGTH = Object.keys(UNIT_THINGS.length)
/** Elements inside the root svg, its group included (art-lint.test.tsx counts the same way). */
const count = (markup: string) => (markup.match(/<[a-zA-Z]/g) ?? []).length - 1
const SIZES = ['sm', 'md', 'lg'] as const

const unitChoice: SkillDef = unitChoiceModule
/** Every multiSelect of a family, five seeded instances per fact. */
const multiSelects = (family: string): Task[] =>
  unitChoice
    .enumerate()
    .filter((f) => f.family === family)
    .flatMap((f) => [1, 2, 3, 4, 5].map((seed) => buildTask(unitChoice, f, 'multiSelect', makeRng(seed), 0).task))
const nounOf = (o: unknown) => {
  const thing = String(o).slice(3)
  return (UNIT_THINGS.length[thing] ?? UNIT_THINGS.weight[thing])[1]
}

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

describe('the things unitChoice weighs in grams and kilograms', () => {
  const WEIGHT = Object.keys(UNIT_THINGS.weight)

  it('are the 8 weight things', () => {
    expect(WEIGHT).toEqual(['feather', 'strawberry', 'key', 'letter', 'dog', 'bike', 'sofa', 'suitcase'])
  })

  it.each(WEIGHT)('%s can be drawn, in at most 14 SVG elements', (id) => {
    expect(knownObject(id)).toBe(true)
    expect(count(renderToStaticMarkup(<ObjectIcon id={id} />))).toBeLessThanOrEqual(14)
  })

  it('draws every weight thing differently, and none like a length thing', () => {
    const marks = [...WEIGHT, ...LENGTH].map((id) => renderToStaticMarkup(<ObjectIcon id={id} />))
    expect(new Set(marks).size).toBe(WEIGHT.length + LENGTH.length)
  })
})

describe('thing cards (mt:<thing>)', () => {
  const tasks = multiSelects('length')

  it('covers every length thing on the cards', () => {
    expect(tasks).toHaveLength(16 * 5)
    expect(new Set(tasks.flatMap((t) => t.options.map(String)))).toEqual(new Set(LENGTH.map((id) => `mt:${id}`)))
  })

  it('shows every card of every length multiSelect as a picture and its word in sm, md and lg', () => {
    for (const task of tasks) {
      expect(task.optionView).toBe('token')
      for (const o of task.options)
        for (const size of SIZES) {
          const html = renderToStaticMarkup(<OptionFace task={task} value={o} size={size} />)
          expect(html, `${String(o)} ${size}`).toContain(`tv-face__thing is-${size}`)
          expect(html.match(/<svg/g), `${String(o)} ${size}`).toHaveLength(1)
          expect(html, `${String(o)} ${size}`).toContain(`>${nounOf(o)}</span>`)
        }
    }
  })

  it('draws each thing of the struck answer and the confirm button, beside its word (sm)', () => {
    for (const task of tasks.slice(0, 16)) {
      for (const value of [String(task.answer), task.options.join('|')]) {
        const html = renderToStaticMarkup(<MultiSelectFace task={task} value={value} size="sm" />)
        const things = value.split('|')
        expect(html.match(/<svg/g)).toHaveLength(things.length)
        expect(html.match(/tv-face__thing is-sm/g)).toHaveLength(things.length)
        for (const t of things) expect(html).toContain(`>${nounOf(t)}</span>`)
      }
    }
  })

  it('shows the weight things (3. klasse) as a picture and its word too, now that all eight are drawn', () => {
    for (const task of multiSelects('weight'))
      for (const o of task.options) {
        const html = renderToStaticMarkup(<OptionFace task={task} value={o} size="md" />)
        expect(html.match(/<svg/g), String(o)).toHaveLength(1)
        expect(html).toContain('tv-face__thing is-md')
        expect(html).toContain(`>${nounOf(o)}</span>`)
      }
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
