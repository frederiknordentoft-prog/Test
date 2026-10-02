// The fraction skills of 1.–2. klasse (SK2-GEO): halfShape and fractionShape. Answers are worked out
// again here from the ids and the drawn figures, never with the skills' own code.
import { describe, expect, it } from 'vitest'
import halfShapeModule from './halfShape'
import fractionShapeModule from './fractionShape'
import { geoSuite, factById, textOf } from '../shapes/testing/suite'
import { tasksUnderTest } from '../number/testing/harness'
import { buildTask } from '../../tasks'
import { isCorrect } from '../../answer'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import type { Prompt, SkillDef, Task } from '../../types'

const halfShape: SkillDef = halfShapeModule
const fractionShape: SkillDef = fractionShapeModule

type CutItem = { id: string; cut?: 'equal' | 'unequal' }
const items = (t: Task) => (t.prompt as Extract<Prompt, { scene: 'shapes' }>).items as CutItem[]
const fracOf = (id: string) => /^frs:(\d)\/(\d):/.exec(id)!.slice(1).map(Number) as [number, number]

describe('fractions of 1.–2. klasse (SK2-GEO)', () => {
  geoSuite(halfShape, {
    families: { equal: 8, unequal: 8 },
    idFormat: /^hlv:(circle|square|rectangle|triangle|hexagon|octagon|rhombus|trapezoid):[eu]$/,
    answerOf(f, kind, task) {
      if (kind === 'multiSelect') return items(task).filter((i) => i.cut === 'equal').map((i) => i.id).sort().join('|')
      return f.id.endsWith(':e') ? 'yes' : 'no'
    },
    isRight: (_f, task, o) => items(task).find((i) => i.id === o)?.cut === 'equal',
    ceilings: { trueFalse: 2, multiSelect: 5 },
    perceptual: 'unequalParts',
  })

  geoSuite(fractionShape, {
    families: { basic: 12, nonUnit: 6 },
    idFormat: /^frs:[1-3]\/[2-4]:(circle|rect|bar)$/,
    answerOf(f, kind) {
      const [n, d] = fracOf(f.id)
      return kind === 'fillSlots' ? `${n}|${d}` : `frac:${n}/${d}`
    },
    isRight(f, _t, o) {
      const [n, d] = fracOf(f.id)
      const m = /^frac:(\d+)\/(\d+)$/.exec(String(o))
      return !!m && Number(m[1]) * d === n * Number(m[2])
    },
    ceilings: { choice: 3, colorParts: 3, fillSlots: 5 },
  })
})

const task = (def: SkillDef, id: string, kind: Task['kind'], seed = 1) => buildTask(def, factById(def, id), kind, makeRng(seed), 0).task

describe('halfShape', () => {
  it('asks on the cut figure (true/false) and on six figures (multiSelect)', () => {
    const t = task(halfShape, 'hlv:circle:u', 'trueFalse')
    expect(t.prompt).toEqual({ scene: 'shape', shape: 'circle', variant: 0, cut: 'unequal' })
    expect([textOf(t), t.answer, t.options]).toEqual(['Er figuren delt i to halve?', 'no', ['yes', 'no']])
    const m = task(halfShape, 'hlv:circle:u', 'multiSelect')
    expect(textOf(m)).toBe('Tryk på alle figurer, der er delt i to halve.')
    expect(items(m)).toHaveLength(6)
  })

  it('reads "two parts are halves" as unequalParts, only on the unequal (conflict) facts', () => {
    for (const { fact, task: t } of tasksUnderTest(halfShape)) {
      const unequal = fact.id.endsWith(':u')
      expect(t.contrast).toBe(unequal ? 'conflict' : 'congruent')
      expect(detectableOf(t)).toContain('unequalParts')
      if (t.kind === 'trueFalse') {
        expect(classifyAnswer(t, unequal ? 'yes' : 'no')).toBe(unequal ? 'unequalParts' : 'other')
        continue
      }
      // every cut figure taken for halves
      const cut = items(t).filter((i) => i.cut).map((i) => i.id).sort().join('|')
      if (unequal) expect(classifyAnswer(t, cut)).toBe('unequalParts')
      else expect(isCorrect(t, cut)).toBe(true)
    }
  })

  it('explains halves, and the misconception on its own', () => {
    const f = factById(halfShape, 'hlv:square:u')
    expect(compile(halfShape.hint(f, null, 'trueFalse').speech).text)
      .toBe('Forestil dig, at du folder figuren langs stregen. Den ene del er større end den anden, så det er ikke to halve.')
    const h = halfShape.hint(f, 'unequalParts', 'trueFalse')
    expect(h.misconception).toBe('unequalParts')
    expect(compile(h.speech).text).toBe('To dele er ikke altid to halve. Halve er to lige store dele. Den ene del er større end den anden, så det er ikke to halve.')
    expect(h.visual).toEqual({ scene: 'shape', shape: 'square', variant: 0, cut: 'unequal' })
  })
})

describe('fractionShape', () => {
  it('colours parts on the figure with nothing coloured, and accepts equal fractions (CONVENTIONS)', () => {
    const t = task(fractionShape, 'frs:2/4:circle', 'colorParts')
    expect(t.prompt).toEqual({ scene: 'fraction', shape: 'circle', parts: 4, colored: 0, equal: true })
    expect([t.answer, textOf(t)]).toEqual(['frac:2/4', 'Farv to fjerdedele.'])
    expect(t.accept).toContain('frac:1/2')
    expect(isCorrect(t, 'frac:1/2')).toBe(true)
    expect(textOf(task(fractionShape, 'frs:1/3:bar', 'colorParts'))).toBe('Farv en tredjedel.')
  })

  it('writes the fraction from a palette 1–8 as numerator over denominator', () => {
    const t = task(fractionShape, 'frs:1/4:rect', 'fillSlots')
    expect([t.answer, t.options, t.optionView, textOf(t)]).toEqual(['1|4', [1, 2, 3, 4, 5, 6, 7, 8], 'fraction', 'Skriv brøken for den farvede del.'])
    expect(t.prompt).toEqual({ scene: 'fraction', shape: 'rect', parts: 4, colored: 1, equal: true })
    expect(isCorrect(task(fractionShape, 'frs:2/4:bar', 'fillSlots'), '1|2')).toBe(true)
    expect(t.distractorTags['4|1']).toBe('other')
    expect(t.distractorTags['3|4']).toBe('other')
  })

  it('never deals a half as the wrong card for two quarters', () => {
    for (const { fact, task: t } of tasksUnderTest(fractionShape, 8)) {
      if (t.kind !== 'choice' || !fact.id.startsWith('frs:2/4')) continue
      expect(t.options).not.toContain('frac:1/2')
    }
  })

  it('explains in plain Danish', () => {
    expect(textOf(task(fractionShape, 'frs:1/4:circle', 'choice'))).toBe('Hvor stor en del af figuren er farvet?')
    expect(compile(fractionShape.hint(factById(fractionShape, 'frs:1/4:circle'), null, 'choice').speech).text)
      .toBe('Figuren er delt i fire lige store dele. En af dem er farvet. Det er en fjerdedel.')
    expect(compile(fractionShape.hint(factById(fractionShape, 'frs:3/4:bar'), null, 'colorParts').speech).text)
      .toBe('Figuren er delt i fire lige store dele. Farv tre af dem. Det er tre fjerdedele.')
  })
})
