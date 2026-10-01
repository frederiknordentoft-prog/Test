// Oracle tests for shapes2D (SPEC §2.3, §15.1): every fact, both kinds, ten card deals each, compared
// with shapes.oracle.ts — the figure a card or item is, measured on the materials' own drawing, and
// the figure the spoken question asks for.
import { describe, expect, it } from 'vitest'
import { detectableOf } from '../../misconceptions'
import { masteryKeyOf } from '../../tasks'
import type { ShapeId, Task } from '../../types'
import {
  answerProblems, cardProblems, first, hintProblems, optionProblems, productionProblems, registeredSkill, sceneOf, specKindProblems,
  spokenText, tagProblem, tagsToHint, taskSpeechProblems, tasksOf, type Explanation,
} from '../number/number.oracle'
import { askedFor, drawn, factFigure, isMember, isPrototypical, shapeToken, specIsA } from './shapes.oracle'

const FIGURES: readonly ShapeId[] = ['circle', 'triangle', 'quadrilateral', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon']
const VARIANTS = [0, 1, 2, 3, 4, 5]

/** Items of a multiSelect task (from its prompt). */
const itemsOf = (t: Task) => sceneOf(t.prompt, 'shapes').items

/** Every non-empty choice of items, as the sorted ids the answer is compared on. */
function selections(ids: readonly string[]): string[] {
  const out: string[] = []
  for (let mask = 1; mask < 2 ** ids.length; mask++) out.push(ids.filter((_, i) => mask & (2 ** i)).sort().join('|'))
  return out
}

describe('shapes2D oracle', () => {
  const def = registeredSkill('shapes2D')
  const facts = def.enumerate()
  const built = tasksOf(def, facts, 10)

  it('measures the materials as the definitions say (a check of the oracle itself)', () => {
    for (const shape of FIGURES) for (const v of VARIANTS) expect(isMember(drawn(shape, v), shape), `${shape} ${v}`).toBe(true)
    for (const v of VARIANTS) {
      expect(isMember(drawn('square', v), 'rectangle'), `square ${v}`).toBe(true)
      expect(isMember(drawn('square', v), 'quadrilateral'), `square ${v}`).toBe(true)
      expect(isMember(drawn('rectangle', v), 'square'), `rectangle ${v}`).toBe(false)
      expect(isMember(drawn('triangle', v), 'quadrilateral'), `triangle ${v}`).toBe(false)
    }
    for (const v of [0, 1, 2]) {
      expect(isMember(drawn('rhombus', v), 'rectangle'), `rhombus ${v}`).toBe(false)
      expect(isMember(drawn('trapezoid', v), 'rectangle'), `trapezoid ${v}`).toBe(false)
    }
    // the generic firkant: a 66 by 56 rectangle, a turned square, and one skew figure
    expect(isMember(drawn('quadrilateral', 1), 'square')).toBe(true)
    expect(isMember(drawn('quadrilateral', 0), 'rectangle') && !isMember(drawn('quadrilateral', 0), 'square')).toBe(true)
    expect(isMember(drawn('quadrilateral', 2), 'rectangle')).toBe(false)
  })

  it('has SPEC §2.2’s 42 facts: 3 figures in 6 variants, kvadrat and rektangel in 6, 5-, 6- and 8-kant in 4', () => {
    const byFamily = (fam: string) => facts.filter((f) => f.family === fam).map((f) => factFigure(f.id))
    const shapes = (fam: string) => [...new Set(byFamily(fam).map((f) => f.shape))].sort()
    expect(shapes('basic')).toEqual(['circle', 'quadrilateral', 'triangle'])
    expect(shapes('squareRect')).toEqual(['rectangle', 'square'])
    expect(shapes('polygons')).toEqual(['hexagon', 'octagon', 'pentagon'])
    expect([byFamily('basic').length, byFamily('squareRect').length, byFamily('polygons').length]).toEqual([18, 12, 12])
    expect(new Set(facts.map((f) => f.id)).size).toBe(42)
    // pædagogik §1.3: non-prototypical variants are obligatory — every figure is met turned and stretched
    for (const shape of FIGURES) {
      const variants = facts.map((f) => factFigure(f.id)).filter((f) => f.shape === shape).map((f) => f.variant)
      expect(variants.includes(1) && variants.includes(2), shape).toBe(true)
      expect(new Set(variants).size, shape).toBe(variants.length)
    }
    for (const f of facts) expect(masteryKeyOf(def, f), f.id).toBe(f.id)
  })

  it('asks for the fact’s figure by name, and the right answer is that figure', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const fig = factFigure(fact.id)
      const asked = askedFor(spokenText(task.speech))
      if (!asked || asked.target !== fig.shape || asked.all !== (kind === 'multiSelect')) problems.push(`${where}: "${spokenText(task.speech)}"`)
      if (kind === 'choice') {
        // the name is only heard (types.ts: a shapes2D choice asks with { scene: 'hear' })
        if (task.prompt.scene !== 'hear') problems.push(`${where}: a ${task.prompt.scene} scene`)
        if (task.answer !== `shape:${fig.shape}:${fig.variant}`) problems.push(`${where}: answer ${String(task.answer)}`)
      } else {
        const own = itemsOf(task).filter((i) => i.shape === fig.shape && i.variant === fig.variant)
        if (own.length !== 1 || !String(task.answer).split('|').includes(own[0].id)) problems.push(`${where}: the fact’s own figure is not one of the answers`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('never deals a wrong card that is also the figure asked for (isA, by name and measured on the drawing)', () => {
    const problems: string[] = []
    for (const { fact, task } of built) {
      if (task.kind !== 'choice') continue
      problems.push(...cardProblems(task), ...answerProblems(task))
      const target = factFigure(fact.id).shape
      const members = task.options.filter((o) => {
        const { shape, variant } = shapeToken(String(o))
        return isMember(drawn(shape, variant), target)
      })
      if (members.length !== 1 || members[0] !== task.answer) problems.push(`${fact.id}: cards [${task.options}] hold ${members.length} ${target}s`)
      for (const o of task.options) {
        if (o !== task.answer && specIsA(shapeToken(String(o)).shape, target)) problems.push(`${fact.id}: ${String(o)} is a ${target} by SPEC §2.3`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('makes the multiSelect answer exactly the items that are the figure — “alle rektangler” includes the squares', () => {
    const problems: string[] = []
    for (const { fact, task } of built) {
      if (task.kind !== 'multiSelect') continue
      problems.push(...optionProblems(task), ...answerProblems(task))
      const target = factFigure(fact.id).shape
      const items = itemsOf(task)
      const members = items.filter((i) => isMember(drawn(i.shape, i.variant), target))
      const want = members.map((i) => i.id).sort().join('|')
      if (task.answer !== want) problems.push(`${fact.id}: answer ${String(task.answer)}, the drawn ${target}s are ${want}`)
      if (task.options.map(String).sort().join() !== items.map((i) => i.id).sort().join()) problems.push(`${fact.id}: options are not the items`)
      if (new Set(items.map((i) => i.id)).size !== items.length) problems.push(`${fact.id}: an item id twice`)
      // pædagogik §2: 5–8 things with at least two to find and two to leave
      if (items.length < 5 || items.length > 8 || members.length < 2 || items.length - members.length < 2) {
        problems.push(`${fact.id}: ${items.length} items, ${members.length} to find`)
      }
      if (target === 'rectangle' && !members.some((i) => isMember(drawn(i.shape, i.variant), 'square'))) problems.push(`${fact.id}: no square among the rectangles`)
    }
    expect(first(problems)).toEqual([])
  })

  it('shows only circles, triangles and firkanter in 0. klasse (SPEC §2.3)', () => {
    const problems: string[] = []
    for (const { fact, task } of built) {
      if (fact.family !== 'basic') continue
      const shown = task.kind === 'choice' ? task.options.map((o) => shapeToken(String(o)).shape) : itemsOf(task).map((i) => i.shape)
      for (const s of shown) if (!['circle', 'triangle', 'quadrilateral'].includes(s)) problems.push(`${fact.id} ${task.kind}: ${s}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('marks turned, stretched and small figures as conflict items and reads only their prototype-only answers as prototypeOnly', () => {
    const problems: string[] = []
    for (const { fact, task } of built) {
      const fig = factFigure(fact.id)
      const conflict = !isPrototypical(fig.shape, fig.variant)
      if (task.contrast !== (conflict ? 'conflict' : 'congruent')) problems.push(`${fact.id}: contrast ${String(task.contrast)}`)
      const detectable = detectableOf(task)
      if (detectable.join() !== 'prototypeOnly') problems.push(`${fact.id} ${task.kind}: detectable ${detectable}`)
      if (task.kind === 'choice') {
        // whichever other card is tapped, the turned triangle was not seen as a triangle
        const e: Explanation = { mis: conflict ? ['prototypeOnly'] : [] }
        for (const o of task.options) if (o !== task.answer) problems.push(tagProblem(task, o, e, true) ?? '')
        continue
      }
      // multiSelect: leaving out only figures that do not stand nicely, and choosing nothing else
      const members = itemsOf(task).filter((i) => isMember(drawn(i.shape, i.variant), fig.shape))
      const proto = members.filter((i) => isPrototypical(i.shape, i.variant)).map((i) => i.id)
      const memberIds = members.map((i) => i.id)
      for (const s of selections(itemsOf(task).map((i) => i.id))) {
        if (s === task.answer) continue
        const chosen = s.split('|')
        const protoOnly = chosen.every((id) => memberIds.includes(id)) && proto.every((id) => chosen.includes(id)) && chosen.length < memberIds.length
        problems.push(tagProblem(task, s, { mis: protoOnly ? ['prototypeOnly'] : [] }, true) ?? '')
      }
    }
    expect(first(problems.filter((p) => p !== ''))).toEqual([])
  })

  it('has at least six conflict and six congruent facts (SPEC §4.3), also in 0. klasse’s basic family alone', () => {
    const conflict = (fam?: string) => facts.filter((f) => (!fam || f.family === fam) && !isPrototypical(factFigure(f.id).shape, factFigure(f.id).variant)).length
    const all = (fam?: string) => facts.filter((f) => !fam || f.family === fam).length
    for (const fam of [undefined, 'basic']) {
      expect(conflict(fam), fam ?? 'all').toBeGreaterThanOrEqual(6)
      expect(all(fam) - conflict(fam), fam ?? 'all').toBeGreaterThanOrEqual(6)
    }
  })

  it('has SPEC’s production kinds and ceilings (six items to choose among: 1 in 63)', () => {
    expect(first([...productionProblems(built), ...specKindProblems(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits; the rectangle hint says a square is one too', () => {
    const tags = tagsToHint(def, facts)
    const problems = [...taskSpeechProblems(built), ...facts.flatMap((f) => hintProblems(def, f, tags))]
    for (const f of facts.filter((x) => factFigure(x.id).shape === 'rectangle')) {
      const text = spokenText(def.hint(f, null).speech)
      if (!text.includes('Et kvadrat er også et rektangel.')) problems.push(`${f.id}: hint "${text}"`)
    }
    expect(first(problems)).toEqual([])
  })
})
