import { describe, expect, it } from 'vitest'
import mul2510Module from './mul2510'
import { algebra2Suite, explainBy, findFact, hintText, taskOf, textOf } from '../algebra/testing/suite'
import { classifyAnswer } from '../../misconceptions'
import type { AnswerValue, Fact, MisconceptionId, SkillDef } from '../../types'

const def: SkillDef = mul2510Module

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
  families: { t2: 8, t5: 9, t10: 10 },
  answerOf: (f) => ab(f)[0] * ab(f)[1],
  idFormat: /^mul:\d+x\d+$/,
  explain: (f, v: AnswerValue) => explainBy(v, ab(f)[0] * ab(f)[1], formulas(f), ab(f)),
  formulaValues: (f) => [...formulas(f).map(([, v]) => v), ...ab(f)],
  ceilings: { choice: 3, keypad: 5 },
})

describe('mul2510', () => {
  it('is the 27 products of the 2-, 5- and 10-table, smaller factor first, a shared product in the bigger table', () => {
    const facts = def.enumerate()
    const want = new Set<string>()
    for (const t of [2, 5, 10]) for (let n = 1; n <= 10; n++) want.add(`mul:${Math.min(n, t)}x${Math.max(n, t)}`)
    expect(facts.map((f) => f.id).sort()).toEqual([...want].sort())
    expect(facts).toHaveLength(27)
    for (const f of facts) {
      const [a, b] = ab(f)
      expect(a, f.id).toBeLessThanOrEqual(b)
      const table = [10, 5, 2].find((t) => a === t || b === t)
      expect(f.family, f.id).toBe(`t${table}`)
    }
  })

  it('shows the table number second, as the table is said: "Hvad er tre gange fem?"', () => {
    const t = taskOf(def, 'mul:3x5', 'keypad')
    expect(t.prompt).toEqual({ scene: 'equation', terms: [{ n: 3 }, { op: '·' }, { n: 5 }, { op: '=' }, { blank: true }] })
    expect(textOf(t)).toBe('Hvad er tre gange fem?')
    expect(textOf(taskOf(def, 'mul:2x5', 'keypad'))).toBe('Hvad er to gange fem?')
    expect(textOf(taskOf(def, 'mul:5x10', 'keypad'))).toBe('Hvad er fem gange ti?')
    expect(textOf(taskOf(def, 'mul:2x7', 'keypad'))).toBe('Hvad er syv gange to?')
  })

  it('reads a neighbouring product as tableNeighbour, a + b as mulAsAdd, 1 · 5 → 1 as ambiguous (A9)', () => {
    const t = taskOf(def, 'mul:3x5', 'keypad')
    for (const v of [10, 20, 12, 18, 9, 25]) expect(classifyAnswer(t, v), String(v)).toBe('tableNeighbour')
    expect(classifyAnswer(t, 8)).toBe('mulAsAdd')
    expect(classifyAnswer(t, 5)).toBe('operand')
    expect(classifyAnswer(taskOf(def, 'mul:1x5', 'keypad'), 1)).toBe('ambiguous')
    expect(classifyAnswer(taskOf(def, 'mul:7x10', 'keypad'), 7)).toBe('operand')
  })

  it('skip counts by the table number', () => {
    expect(hintText(def, 'mul:3x5', null)).toBe('Tæl i spring med fem. Fem. Ti. Femten. Tre gange fem giver femten.')
    expect(def.hint(findFact(def, 'mul:3x5'), null).visual).toEqual({ scene: 'array', rows: 3, cols: 5 })
    expect(def.hint(findFact(def, 'mul:7x10'), null).visual).toEqual({ scene: 'line', min: 0, max: 70, hops: [0, 10, 20, 30, 40, 50, 60, 70] })
    expect(hintText(def, 'mul:3x5', 'tableNeighbour')).toMatch(/^Tæl springene, så du ved, hvornår du skal stoppe\./)
    expect(hintText(def, 'mul:3x5', 'mulAsAdd')).toMatch(/^Vi skal ikke lægge de to tal sammen\. Gange er grupper/)
    // tableNeighbour is one of SPEC §4.3's eight animated hints; mulAsAdd is spoken over the picture
    expect(def.hint(findFact(def, 'mul:3x5'), 'tableNeighbour')).toMatchObject({ misconception: 'tableNeighbour', animated: true })
    expect(def.hint(findFact(def, 'mul:3x5'), 'mulAsAdd').animated).toBeUndefined()
    // 54 is 6 · 9, but also 45 written the way it is said (femogfyrre): no evidence either way (SPEC A11)
    expect(classifyAnswer(taskOf(def, 'mul:5x9', 'keypad'), 54)).toBe('ambiguous')
    expect(classifyAnswer(taskOf(def, 'mul:5x9', 'keypad'), 36)).toBe('tableNeighbour') // 4 · 9
    expect(classifyAnswer(taskOf(def, 'mul:2x7', 'keypad'), 41)).toBe('digitSwap')
    expect(hintText(def, 'mul:2x7', 'digitSwap')).toBe('Vi skriver tierne først og så enerne. Svaret er fjorten.')
  })
})
