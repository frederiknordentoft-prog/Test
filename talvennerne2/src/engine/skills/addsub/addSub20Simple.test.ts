import { describe, expect, it } from 'vitest'
import addSub20SimpleModule from './addSub20Simple'
import { addsub2Suite, explainSum, findFact, idSum, textOf } from './testing/suite'
import { factsUnderTest, tasksUnderTest } from '../number/testing/harness'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import type { ErrorTag, Fact, SkillDef } from '../../types'

const def: SkillDef = addSub20SimpleModule
const sum = (f: Fact) => idSum(f.id)
const answerOf = (f: Fact) => (sum(f).op === '+' ? sum(f).a + sum(f).b : sum(f).a - sum(f).b)
const instance = (family: string, seed = 1) => def.instance!(def.families.find((x) => x.id === family)!, makeRng(seed), new Set())
const factOf = (id: string): Fact => findFact(def, id)
const hintText = (id: string, tag: ErrorTag | null) => compile(def.hint(factOf(id), tag).speech).text

addsub2Suite(def, {
  families: { addTeen: 20, subTeen: 20, tenPlus: 18 },
  answerOf,
  idFormat: /^as20:\d+[+-]\d+$/,
  explain: (f, v) => explainSum('addSub20Simple', f.family, sum(f).a, sum(f).op, sum(f).b, v),
  formulaValues: (f) => {
    const { a, op, b } = sum(f)
    return [op === '+' ? Math.abs(a - b) : a + b, a, b]
  },
  ceilings: { choice: 3, keypad: 5 },
  swaps: true,
})

describe('addSub20Simple', () => {
  it('draws each family inside its definition, and reaches every instance of it', () => {
    const seen: Record<string, Set<string>> = { addTeen: new Set(), subTeen: new Set(), tenPlus: new Set() }
    for (const f of factsUnderTest(def)) {
      const { a, op, b } = sum(f)
      seen[f.family].add(f.id)
      if (f.family === 'addTeen') expect(op === '+' && a >= 11 && a <= 19 && b >= 1 && (a % 10) + b <= 10, f.id).toBe(true)
      if (f.family === 'subTeen') expect(op === '−' && a >= 11 && a <= 19 && b >= 1 && b <= a % 10, f.id).toBe(true)
      if (f.family === 'tenPlus') expect(op === '+' && (a === 10) !== (b === 10) && Math.min(a, b) >= 1 && Math.max(a, b) === 10, f.id).toBe(true)
    }
    const rng = makeRng(99)
    for (const fam of def.families) for (let i = 0; i < 1500; i++) seen[fam.id].add(def.instance!(fam, rng, new Set()).id)
    expect(Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.size]))).toEqual({ addTeen: 45, subTeen: 45, tenPlus: 18 })
  })

  it('avoids the instances it is told to', () => {
    const fam = def.families.find((x) => x.id === 'tenPlus')!
    const avoid = new Set(['as20:10+1', 'as20:10+2', 'as20:3+10'])
    const rng = makeRng(5)
    for (let i = 0; i < 100; i++) expect(avoid.has(def.instance!(fam, rng, avoid).id)).toBe(false)
  })

  it('asks with numbers on the card and in words, with room for "plus instead of minus" in subTeen', () => {
    const tasks = tasksUnderTest(def)
    const t = (id: string) => tasks.find((x) => x.fact.id === id)?.task
    const add = tasks.find((x) => x.fact.family === 'addTeen')!.task
    expect(add.range).toEqual([0, 20])
    expect(tasks.find((x) => x.fact.family === 'subTeen')!.task.range).toEqual([0, 30])
    expect(textOf(add)).toMatch(/^Hvad er [a-zæøå]+ plus [a-zæøå]+\?$/)
    const twelve = t('as20:12+5') ?? null
    if (twelve) expect(textOf(twelve)).toBe('Hvad er tolv plus fem?')
    expect(compile(def.speech(instance('subTeen'), 'keypad')).text).toMatch(/^Hvad er [a-zæøå]+ minus [a-zæøå]+\?$/)
  })

  it('tags the other operation, the numbers asked and the forgotten ten', () => {
    const tag = (id: string, v: number) => def.candidates(factOf(id)).find((c) => c.value === v)?.tag
    expect(tag('as20:12+5', 7)).toBe('wrongOperation')
    expect(tag('as20:12+3', 9)).toBe('wrongOperation')
    expect(tag('as20:12+3', 5)).toBe('near') // the ten forgotten
    expect(tag('as20:17-4', 21)).toBe('wrongOperation')
    expect(tag('as20:17-4', 3)).toBe('near')
    expect(tag('as20:10+5', 5)).toBe('ambiguous') // 10 − 5, or the 5 repeated (A9)
    expect(tag('as20:10+6', 10)).toBe('operand')
  })

  it('keeps the ten and works the ones', () => {
    expect(hintText('as20:12+5', null)).toBe('Læg enerne sammen. To og fem giver syv. Ti og syv giver sytten.')
    expect(hintText('as20:13+7', 'near')).toBe('Læg enerne sammen. Tre og syv giver ti. Ti og ti giver tyve.')
    expect(hintText('as20:17-4', null)).toBe('Tag enerne væk. Syv minus fire giver tre. Ti og tre giver tretten.')
    expect(hintText('as20:6+10', null)).toBe('En fuld ti-ramme er ti. Ti og seks giver seksten.')
    expect(hintText('as20:17-4', 'wrongOperation')).toMatch(/^Minus betyder, at nogle bliver taget væk\. Tag enerne væk\./)
    expect(def.hint(factOf('as20:17-4'), null).visual).toEqual({ scene: 'objects', n: 13, layout: 'tenframe', thing: 'ball' })
  })
})
