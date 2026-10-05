import { describe, expect, it } from 'vitest'
import mul34Module from './mul34'
import { algebra2Suite, explainBy, findFact, hintText, taskOf, textOf } from '../algebra/testing/suite'
import { classifyAnswer } from '../../misconceptions'
import type { AnswerValue, Fact, MisconceptionId, SkillDef } from '../../types'

const def: SkillDef = mul34Module

/** The factors of `mul:<a>x<b>`, read independently of the module. */
function ab(f: Pick<Fact, 'id'>): [number, number] {
  const m = /^mul:(\d+)x(\d+)$/.exec(f.id)!
  return [Number(m[1]), Number(m[2])]
}

/** pædagogik §3.2: (a ± 1) · b, a · (b ± 1), a², b² (a zero product left out), and a + b. */
function formulas(f: Pick<Fact, 'id'>): [MisconceptionId, number][] {
  const [a, b] = ab(f)
  const near = [(a + 1) * b, (a - 1) * b, a * (b + 1), a * (b - 1), a * a, b * b].filter((v) => v > 0)
  return [...near.map((v): [MisconceptionId, number] => ['tableNeighbour', v]), ['mulAsAdd', a + b]]
}

algebra2Suite(def, {
  families: { t3: 6, t4: 7 },
  answerOf: (f) => ab(f)[0] * ab(f)[1],
  idFormat: /^mul:\d+x\d+$/,
  explain: (f, v: AnswerValue) => explainBy(v, ab(f)[0] * ab(f)[1], formulas(f), ab(f)),
  formulaValues: (f) => [...formulas(f).map(([, v]) => v), ...ab(f)],
  ceilings: { choice: 3, keypad: 5 },
})

describe('mul34', () => {
  it('is the 13 products of the 3- and 4-table that are not in the 2-, 5- and 10-table, a shared one in the 4-table', () => {
    const want = new Set<string>()
    for (const t of [3, 4]) {
      for (let n = 1; n <= 10; n++) if (![2, 5, 10].includes(n)) want.add(`mul:${Math.min(n, t)}x${Math.max(n, t)}`)
    }
    const facts = def.enumerate()
    expect(facts.map((f) => f.id).sort()).toEqual([...want].sort())
    expect(facts).toHaveLength(13)
    for (const f of facts) {
      const [a, b] = ab(f)
      expect(a, f.id).toBeLessThanOrEqual(b)
      expect(f.family, f.id).toBe(a === 4 || b === 4 ? 't4' : 't3')
    }
    // the 3-table comes first, each table from its smallest product
    expect(facts.map((f) => f.id).slice(0, 2)).toEqual(['mul:1x3', 'mul:3x3'])
    expect(facts[facts.length - 1].id).toBe('mul:4x9')
  })

  it('shows the table number second, as the table is said: "Hvad er seks gange tre?"', () => {
    const t = taskOf(def, 'mul:3x6', 'keypad')
    expect(t.prompt).toEqual({ scene: 'equation', terms: [{ n: 6 }, { op: '·' }, { n: 3 }, { op: '=' }, { blank: true }] })
    expect(textOf(t)).toBe('Hvad er seks gange tre?')
    expect(textOf(taskOf(def, 'mul:3x4', 'keypad'))).toBe('Hvad er tre gange fire?')
    expect(textOf(taskOf(def, 'mul:4x9', 'keypad'))).toBe('Hvad er ni gange fire?')
    expect(t.range).toEqual([0, 100])
  })

  it('reads a neighbouring product as tableNeighbour, a + b as mulAsAdd, 1 · 3 → 1 as ambiguous (A9)', () => {
    const t = taskOf(def, 'mul:4x7', 'keypad')
    for (const v of [24, 32, 21, 35, 49, 16]) expect(classifyAnswer(t, v), String(v)).toBe('tableNeighbour')
    expect(classifyAnswer(t, 11)).toBe('mulAsAdd')
    expect(classifyAnswer(t, 7)).toBe('operand')
    expect(classifyAnswer(t, 29)).toBe('near')
    expect(classifyAnswer(t, 82)).toBe('digitSwap')
    expect(classifyAnswer(taskOf(def, 'mul:1x3', 'keypad'), 1)).toBe('ambiguous')
  })

  it('skip counts by the table number over the array, a row per hop', () => {
    expect(hintText(def, 'mul:3x6', null)).toBe('Tæl i spring med tre. Tre. Seks. Ni. Tolv. Femten. Atten. Seks gange tre giver atten.')
    expect(def.hint(findFact(def, 'mul:3x6'), null).visual).toEqual({ scene: 'array', rows: 6, cols: 3 })
    expect(def.hint(findFact(def, 'mul:4x9'), null).visual).toEqual({ scene: 'array', rows: 9, cols: 4 })
    expect(hintText(def, 'mul:4x7', 'tableNeighbour')).toMatch(/^Tæl springene, så du ved, hvornår du skal stoppe\. Tæl i spring med fire\./)
    expect(def.hint(findFact(def, 'mul:4x7'), 'tableNeighbour')).toMatchObject({ misconception: 'tableNeighbour', animated: true })
    expect(hintText(def, 'mul:4x7', 'mulAsAdd')).toMatch(/^Vi skal ikke lægge de to tal sammen\. Gange er grupper/)
    expect(def.hint(findFact(def, 'mul:4x7'), 'mulAsAdd').animated).toBeUndefined()
    expect(hintText(def, 'mul:4x7', 'digitSwap')).toBe('Vi skriver tierne først og så enerne. Svaret er otteogtyve.')
  })
})
