import { describe, expect, it } from 'vitest'
import mul6to9Module from './mul6to9'
import { algebra2Suite, explainBy, findFact, hintText, taskOf, textOf } from '../algebra/testing/suite'
import { classifyAnswer } from '../../misconceptions'
import { getSkill } from '../../registry'
import type { AnswerValue, Fact, MisconceptionId, SkillDef } from '../../types'

const def: SkillDef = mul6to9Module

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
  families: { t6: 2, t7: 3, t8: 4, t9: 5 },
  answerOf: (f) => ab(f)[0] * ab(f)[1],
  idFormat: /^mul:\d+x\d+$/,
  explain: (f, v: AnswerValue) => explainBy(v, ab(f)[0] * ab(f)[1], formulas(f), ab(f)),
  formulaValues: (f) => [...formulas(f).map(([, v]) => v), ...ab(f)],
  ceilings: { choice: 3, keypad: 5 },
})

describe('mul6to9', () => {
  it('is 6 · 6 … 9 · 9 and the ones, each product in its bigger table', () => {
    const want = ['mul:1x6', 'mul:1x7', 'mul:1x8', 'mul:1x9']
    for (let a = 6; a <= 9; a++) for (let b = a; b <= 9; b++) want.push(`mul:${a}x${b}`)
    const facts = def.enumerate()
    expect(facts.map((f) => f.id).sort()).toEqual(want.sort())
    for (const f of facts) expect(f.family, f.id).toBe(`t${Math.max(...ab(f))}`)
    expect(facts.map((f) => f.id)).toEqual([
      'mul:1x6', 'mul:6x6', 'mul:1x7', 'mul:6x7', 'mul:7x7', 'mul:1x8', 'mul:6x8', 'mul:7x8', 'mul:8x8',
      'mul:1x9', 'mul:6x9', 'mul:7x9', 'mul:8x9', 'mul:9x9',
    ])
  })

  it('with mul2510 and mul34 covers the small table once: 54 products, all but 1 · 1 (pædagogik §1.3)', () => {
    const ids = ['mul2510', 'mul34', 'mul6to9'].flatMap((s) => getSkill(s as 'mul2510')!.enumerate().map((f) => f.id))
    expect(ids).toHaveLength(54)
    expect(new Set(ids).size).toBe(54)
    const all: string[] = []
    for (let a = 1; a <= 10; a++) for (let b = a; b <= 10; b++) all.push(`mul:${a}x${b}`)
    expect(all.filter((id) => !ids.includes(id))).toEqual(['mul:1x1'])
  })

  it('shows the table number second: "Hvad er syv gange otte?"', () => {
    const t = taskOf(def, 'mul:7x8', 'keypad')
    expect(t.prompt).toEqual({ scene: 'equation', terms: [{ n: 7 }, { op: '·' }, { n: 8 }, { op: '=' }, { blank: true }] })
    expect(textOf(t)).toBe('Hvad er syv gange otte?')
    expect(textOf(taskOf(def, 'mul:1x9', 'keypad'))).toBe('Hvad er en gange ni?')
  })

  it('reads 7 · 8 → 48, 63, 64, 49 as tableNeighbour, 15 as mulAsAdd; 6 · 9 → 45 is ambiguous (A11)', () => {
    const t = taskOf(def, 'mul:7x8', 'keypad')
    for (const v of [48, 63, 64, 49]) expect(classifyAnswer(t, v), String(v)).toBe('tableNeighbour')
    expect(classifyAnswer(t, 15)).toBe('mulAsAdd')
    expect(classifyAnswer(t, 8)).toBe('operand')
    expect(classifyAnswer(t, 65)).toBe('digitSwap')
    // 45 is 5 · 9, but also 54 written the way it is said (femoghalvtreds): no evidence either way
    expect(classifyAnswer(taskOf(def, 'mul:6x9', 'keypad'), 45)).toBe('ambiguous')
    expect(classifyAnswer(taskOf(def, 'mul:1x7', 'keypad'), 1)).toBe('ambiguous')
  })

  it('splits the array in five rows and the rest: 7 · 8 = 5 · 8 + 2 · 8', () => {
    expect(hintText(def, 'mul:7x8', null))
      .toBe('Del rækkerne op i fem og resten. Fem gange otte giver fyrre. To gange otte giver seksten. Fyrre plus seksten giver seksoghalvtreds.')
    expect(def.hint(findFact(def, 'mul:7x8'), null).visual).toEqual({ scene: 'splitArray', rows: 7, cols: 8, split: 5 })
    expect(hintText(def, 'mul:6x6', null))
      .toBe('Del rækkerne op i fem og resten. Fem gange seks giver tredive. En gange seks giver seks. Tredive plus seks giver seksogtredive.')
    expect(hintText(def, 'mul:1x7', null)).toBe('Når vi ganger med en, får vi tallet selv. En gange syv giver syv.')
    expect(def.hint(findFact(def, 'mul:1x7'), null).visual).toEqual({ scene: 'array', rows: 1, cols: 7 })
    expect(hintText(def, 'mul:7x8', 'tableNeighbour')).toMatch(/^Tæl efter, hvor mange rækker der er\. Del rækkerne op/)
    expect(def.hint(findFact(def, 'mul:7x8'), 'tableNeighbour')).toMatchObject({ misconception: 'tableNeighbour', animated: true })
    expect(hintText(def, 'mul:7x8', 'mulAsAdd')).toMatch(/^Vi skal ikke lægge de to tal sammen\./)
    expect(hintText(def, 'mul:7x8', 'digitSwap')).toBe('Vi skriver tierne først og så enerne. Svaret er seksoghalvtreds.')
  })
})
