import { describe, expect, it } from 'vitest'
import divAllModule from './divAll'
import { algebra2Suite, explainBy, findFact, hintText, taskOf, textOf } from '../algebra/testing/suite'
import { classifyAnswer } from '../../misconceptions'
import { getSkill } from '../../registry'
import type { AnswerValue, Fact, MisconceptionId, SkillDef } from '../../types'

const def: SkillDef = divAllModule

/** c and d of `div:<c>/<d>`, read independently of the module. */
function cd(f: Pick<Fact, 'id'>): [number, number] {
  const m = /^div:(\d+)\/(\d+)$/.exec(f.id)!
  return [Number(m[1]), Number(m[2])]
}

/** pædagogik §3.2 for division: the quotient ± 1 inside the table (1–10), and c − d or c · d. */
function formulas(f: Pick<Fact, 'id'>): [MisconceptionId, number][] {
  const [c, d] = cd(f)
  const q = c / d
  return [
    ...[q - 1, q + 1].filter((v) => v >= 1 && v <= 10).map((v): [MisconceptionId, number] => ['tableNeighbour', v]),
    ['wrongOperation', c - d], ['wrongOperation', c * d],
  ]
}

algebra2Suite(def, {
  families: { d3: 10, d4: 10, d6: 10, d7: 10, d8: 10, d9: 10 },
  answerOf: (f) => cd(f)[0] / cd(f)[1],
  idFormat: /^div:\d+\/\d+$/,
  explain: (f, v: AnswerValue) => explainBy(v, cd(f)[0] / cd(f)[1], formulas(f), cd(f)),
  formulaValues: (f) => [...formulas(f).map(([, v]) => v), ...cd(f)],
  ceilings: { choice: 3, keypad: 5 },
})

describe('divAll', () => {
  it('is c : d for d = 3, 4, 6–9 and every quotient 1–10; with div2510 every division of the small table once', () => {
    const facts = def.enumerate()
    expect(facts).toHaveLength(60)
    for (const f of facts) {
      const [c, d] = cd(f)
      expect([3, 4, 6, 7, 8, 9]).toContain(d)
      expect(c % d === 0 && c / d >= 1 && c / d <= 10, f.id).toBe(true)
      expect(f.family).toBe(`d${d}`)
    }
    const both = [...facts, ...getSkill('div2510')!.enumerate()].map((f) => f.id)
    expect(new Set(both).size).toBe(90)
    for (let d = 2; d <= 10; d++) for (let q = 1; q <= 10; q++) expect(both).toContain(`div:${d * q}/${d}`)
  })

  it('reads ":" as "divideret med" (SPEC A19): "Hvad er seksoghalvtreds divideret med otte?"', () => {
    const t = taskOf(def, 'div:56/8', 'keypad')
    expect(t.prompt).toEqual({ scene: 'equation', terms: [{ n: 56 }, { op: ':' }, { n: 8 }, { op: '=' }, { blank: true }] })
    expect(textOf(t)).toBe('Hvad er seksoghalvtreds divideret med otte?')
    expect(t.range).toEqual([0, 100])
  })

  it('thinks of the times table backwards over the array of q rows of d', () => {
    expect(hintText(def, 'div:56/8', null))
      .toBe('Hvad gange otte giver seksoghalvtreds? Syv gange otte giver seksoghalvtreds. Så giver seksoghalvtreds divideret med otte syv.')
    expect(def.hint(findFact(def, 'div:56/8'), null).visual).toEqual({ scene: 'array', rows: 7, cols: 8 })
    expect(hintText(def, 'div:56/8', 'tableNeighbour'))
      .toBe('Prøv at gange dit svar med otte. Det skal give seksoghalvtreds. Syv gange otte giver seksoghalvtreds. Så giver seksoghalvtreds divideret med otte syv.')
    expect(def.hint(findFact(def, 'div:56/8'), 'tableNeighbour')).toMatchObject({ misconception: 'tableNeighbour', animated: true })
    expect(hintText(def, 'div:56/8', 'wrongOperation')).toMatch(/^Divideret med betyder, at vi deler i lige store dele\. Hvad gange otte/)
    expect(def.hint(findFact(def, 'div:56/8'), 'wrongOperation')).toMatchObject({ misconception: 'wrongOperation' })
  })

  it('reads 56 : 8 → 6 or 8 by the table, 48 and 448 as wrongOperation, 12 : 3 → 3 as ambiguous (A9)', () => {
    const t = taskOf(def, 'div:56/8', 'keypad')
    expect(classifyAnswer(t, 6)).toBe('tableNeighbour')
    expect(classifyAnswer(t, 8)).toBe('ambiguous') // q + 1, and the 8 of the question
    expect(classifyAnswer(t, 48)).toBe('wrongOperation')
    expect(classifyAnswer(t, 448)).toBe('wrongOperation')
    expect(classifyAnswer(t, 56)).toBe('operand')
    expect(classifyAnswer(t, 9)).toBe('near')
    expect(classifyAnswer(taskOf(def, 'div:12/3', 'keypad'), 3)).toBe('ambiguous')
    expect(classifyAnswer(taskOf(def, 'div:12/3', 'keypad'), 5)).toBe('tableNeighbour')
  })
})
