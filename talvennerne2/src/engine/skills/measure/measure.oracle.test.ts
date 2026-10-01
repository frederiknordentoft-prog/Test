// Oracle tests for compareLength (SPEC §4.3, §15.1): every fact, both kinds, ten deals each, compared
// with measure.oracle.ts — the answer read off the scene's lengths and starts and the spoken question.
import { describe, expect, it } from 'vitest'
import { detectableOf } from '../../misconceptions'
import { masteryKeyOf } from '../../tasks'
import { makeRng } from '../../rng'
import { LONG_IDS } from '../../../ui/scenes/objects'
import {
  answerProblems, cardProblems, first, hintProblems, optionProblems, productionProblems, registeredSkill, specKindProblems,
  spokenText, tagProblem, tagsToHint, taskSpeechProblems, tasksOf,
} from '../number/number.oracle'
import { byLength, endsAnswer, explainLength, lineupOf, misleads, objToken, questionOf, rightAnswer } from './measure.oracle'

/** Every order of the given cards. */
function orderings(items: readonly string[]): string[][] {
  if (items.length <= 1) return [[...items]]
  return items.flatMap((x, i) => orderings([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]))
}

describe('compareLength oracle', () => {
  const def = registeredSkill('compareLength')
  const facts = def.enumerate()
  const built = tasksOf(def, facts, 10)
  const questionFor = (kind: string, text: string) => {
    const q = questionOf(text)
    if (!q || q.order !== (kind === 'sortOrder')) throw new Error(`${kind}: "${text}" is not a length question for it`)
    return q
  }

  it('has SPEC §2.2’s 16 facts: 8 lined up and 8 moved sideways, four different long things each', () => {
    expect(facts.filter((f) => f.family === 'aligned').length).toBe(8)
    expect(facts.filter((f) => f.family === 'offset').length).toBe(8)
    expect(new Set(facts.map((f) => f.id)).size).toBe(16)
    for (const f of facts) {
      expect(masteryKeyOf(def, f), f.id).toBe(f.id)
      const l = lineupOf(def.prompt(f, 'choice', makeRng(1)))
      expect(l.objects.length, f.id).toBe(4)
      expect(new Set(l.objects).size, f.id).toBe(4)
      for (const o of l.objects) expect(LONG_IDS as readonly string[], `${f.id} ${o}`).toContain(o)
      if (f.family === 'aligned') expect(l.aligned && l.starts.every((s) => s === 0), f.id).toBe(true)
      else expect(!l.aligned && l.starts.some((s) => s > 0), f.id).toBe(true)
    }
  })

  it('asks fair questions: one clear answer at least two units ahead, no two lengths or ends alike', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const l = lineupOf(task.prompt)
      const q = questionFor(kind, spokenText(task.speech))
      const [best, next] = byLength(l, q.longest)
      if (Math.abs(l.sizes[best] - l.sizes[next]) < 2) problems.push(`${fact.id}: ${l.sizes[best]} vs ${l.sizes[next]}`)
      if (new Set(l.sizes).size !== 4) problems.push(`${fact.id}: two things are equally long (${l.sizes})`)
      if (new Set(l.sizes.map((s, i) => s + l.starts[i])).size !== 4) problems.push(`${fact.id}: two things end at the same place`)
      if (l.sizes.some((s) => !(s > 0)) || l.starts.some((s) => s < 0)) problems.push(`${fact.id}: sizes ${l.sizes}, starts ${l.starts}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('answers every task as the scene and the spoken question say', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const l = lineupOf(task.prompt)
      const want = rightAnswer(l, questionFor(kind, spokenText(task.speech)))
      if (task.answer !== want) problems.push(`${fact.id} ${kind}: answer ${String(task.answer)}, the scene says ${want}`)
    }
    // the same fact asks the same question however the things are shuffled on the screen
    for (const f of facts) {
      const answers = new Set(built.filter((b) => b.fact.id === f.id && b.kind === 'choice').map((b) => String(b.task.answer)))
      expect(answers.size, f.id).toBe(1)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals three of the four things as cards and all four for the order, and keeps every answer right', () => {
    const problems: string[] = []
    for (const { fact, task } of built) {
      problems.push(...cardProblems(task), ...optionProblems(task), ...answerProblems(task))
      const things = lineupOf(task.prompt).objects.map(objToken)
      const outside = task.options.filter((o) => !things.includes(String(o)))
      if (outside.length > 0) problems.push(`${fact.id} ${task.kind}: ${outside} is not in the scene`)
      if (task.kind === 'sortOrder' && task.options.length !== 4) problems.push(`${fact.id}: ${task.options.length} cards to order`)
    }
    expect(first(problems)).toEqual([])
  })

  it('has at least six conflict and six congruent items (SPEC §4.3), marked so, with the far-end card on every conflict deal', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const l = lineupOf(task.prompt)
      const q = questionFor(kind, spokenText(task.speech))
      const conflict = misleads(l, q)
      if (task.contrast !== (conflict ? 'conflict' : 'congruent')) problems.push(`${fact.id} ${kind}: contrast ${String(task.contrast)}`)
      if (detectableOf(task).join() !== 'lengthByEnd') problems.push(`${fact.id} ${kind}: detectable ${detectableOf(task)}`)
      if (kind === 'choice' && conflict && !task.options.includes(endsAnswer(l, q))) problems.push(`${fact.id}: no far-end card in [${task.options}]`)
      if (l.aligned && conflict) problems.push(`${fact.id}: lined-up things cannot mislead`)
    }
    const contrastOf = (id: string) => built.find((b) => b.fact.id === id && b.kind === 'choice')!.task.contrast
    expect(facts.filter((f) => contrastOf(f.id) === 'conflict').length).toBeGreaterThanOrEqual(6)
    expect(facts.filter((f) => contrastOf(f.id) === 'congruent').length).toBeGreaterThanOrEqual(6)
    expect(first(problems)).toEqual([])
  })

  it('classifies the far-end answer as lengthByEnd and every other wrong answer as a plain error (all cards, all 24 orders)', () => {
    const problems: string[] = []
    for (const { kind, task } of built) {
      const l = lineupOf(task.prompt)
      const q = questionFor(kind, spokenText(task.speech))
      const things = l.objects.map(objToken)
      const given = kind === 'sortOrder' ? orderings(things).map((o) => o.join('|')) : things
      for (const g of given) {
        if (g === task.answer) continue
        const p = tagProblem(task, g, explainLength(l, q, g), true)
        if (p) problems.push(p)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('has SPEC’s production kinds and ceilings (four things in order: 1 in 24; three cards: box 3)', () => {
    expect(first([...productionProblems(built), ...specKindProblems(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits; the hint lines the same things up', () => {
    const tags = tagsToHint(def, facts)
    const problems = [...taskSpeechProblems(built), ...facts.flatMap((f) => hintProblems(def, f, tags))]
    for (const f of facts) {
      const shown = lineupOf(def.prompt(f, 'choice', makeRng(1)))
      for (const tag of [null, 'lengthByEnd'] as const) {
        const v = def.hint(f, tag).visual
        if (v.scene !== 'compareObjects') {
          problems.push(`${f.id}: hint shows ${v.scene}`)
          continue
        }
        const hinted = lineupOf(v)
        const pairs = (l: typeof shown) => l.objects.map((o, i) => `${o}:${l.sizes[i]}`).sort().join()
        if (!hinted.aligned || hinted.starts.some((s) => s !== 0) || pairs(hinted) !== pairs(shown)) problems.push(`${f.id}: hint ${JSON.stringify(v)}`)
      }
    }
    expect(first(problems)).toEqual([])
  })
})
