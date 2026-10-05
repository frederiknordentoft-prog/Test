import { describe, expect, it } from 'vitest'
import mulTensModule from './mulTens'
import { algebra2Suite, explainBy, findFact, hintText, taskOf, textOf } from '../algebra/testing/suite'
import { classifyAnswer } from '../../misconceptions'
import { factsUnderTest } from '../number/testing/harness'
import { makeRng } from '../../rng'
import type { AnswerValue, Fact, MisconceptionId, SkillDef, TaskKind } from '../../types'

const def: SkillDef = mulTensModule

/** The factors of `mt:<x>x<y>` as on the card, read independently of the module: a one-digit, T a whole ten. */
function factors(f: Pick<Fact, 'id'>): { x: number; y: number; a: number; T: number } {
  const m = /^mt:(\d+)x(\d+)$/.exec(f.id)!
  const x = Number(m[1])
  const y = Number(m[2])
  return x < 10 ? { x, y, a: x, T: y } : { x, y, a: y, T: x }
}

/** pædagogik §3.2: tensZero (the zero lost or doubled), mulAsAdd a + T, tableNeighbour of the small fact. */
function formulas(f: Pick<Fact, 'id'>): [MisconceptionId, number][] {
  const { a, T } = factors(f)
  const p = a * T
  const neighbours = [(a + 1) * T, (a - 1) * T, a * (T + 10), a * (T - 10)].filter((v) => v > 0)
  return [['tensZero', p / 10], ['tensZero', p * 10], ['mulAsAdd', a + T], ...neighbours.map((v): [MisconceptionId, number] => ['tableNeighbour', v])]
}

algebra2Suite(def, {
  families: { oneDigitTimesTens: 20, tensTimesOneDigit: 20 },
  answerOf: (f) => factors(f).a * factors(f).T,
  idFormat: /^mt:\d+x\d+$/,
  explain: (f, v: AnswerValue) => explainBy(v, factors(f).a * factors(f).T, formulas(f), [factors(f).x, factors(f).y]),
  formulaValues: (f) => [...formulas(f).map(([, v]) => v), factors(f).x, factors(f).y],
  ceilings: { choice: 3, keypad: 5 },
})

describe('mulTens', () => {
  it('multiplies 2–5 by the whole tens 20–90, in both orders: 32 products per family', () => {
    for (const fam of def.families) {
      const seen = new Set<string>()
      const rng = makeRng(5)
      for (let i = 0; i < 2000; i++) seen.add(def.instance!(fam, rng, new Set()).id)
      expect(seen.size, fam.id).toBe(32)
    }
    for (const f of factsUnderTest(def)) {
      const { x, y, a, T } = factors(f)
      expect(a >= 2 && a <= 5 && T % 10 === 0 && T >= 20 && T <= 90, f.id).toBe(true)
      expect(f.family, f.id).toBe(x === a ? 'oneDigitTimesTens' : 'tensTimesOneDigit')
      expect(f.answer).toBe(x * y)
    }
  })

  it('asks "Hvad er tre gange fyrre?" over 3 · 40 = □, with four digits on the keypad', () => {
    const t = taskOf(def, 'mt:3x40', 'keypad')
    expect(t.prompt).toEqual({ scene: 'equation', terms: [{ n: 3 }, { op: '·' }, { n: 40 }, { op: '=' }, { blank: true }] })
    expect(textOf(t)).toBe('Hvad er tre gange fyrre?')
    expect(textOf(taskOf(def, 'mt:40x3', 'keypad'))).toBe('Hvad er fyrre gange tre?')
    expect([t.range, t.maxDigits]).toEqual([[0, 1000], 4])
  })

  it('reads 3 · 40 → 12 and 1200 as tensZero, 43 as mulAsAdd, 160 as tableNeighbour; 2 · 40 → 40 is ambiguous (A9)', () => {
    const t = taskOf(def, 'mt:3x40', 'keypad')
    expect(classifyAnswer(t, 12)).toBe('tensZero')
    expect(classifyAnswer(t, 1200)).toBe('tensZero')
    expect(classifyAnswer(t, 43)).toBe('mulAsAdd')
    for (const v of [80, 160, 90, 150]) expect(classifyAnswer(t, v), String(v)).toBe('tableNeighbour')
    expect(classifyAnswer(t, 130)).toBe('near')
    expect(classifyAnswer(t, 40)).toBe('operand')
    expect(classifyAnswer(taskOf(def, 'mt:2x40', 'keypad'), 40)).toBe('ambiguous')
  })

  it('counts whole tens as tens on the rods; the zero comes off and goes back on for tensZero', () => {
    expect(hintText(def, 'mt:3x40', null)).toBe('Fyrre består af fire tiere. Tre gange fire tiere giver tolv tiere. Svaret er et hundrede og tyve.')
    expect(hintText(def, 'mt:40x3', null)).toBe('Fyrre består af fire tiere. Fire tiere gange tre giver tolv tiere. Svaret er et hundrede og tyve.')
    expect(def.hint(findFact(def, 'mt:3x40'), null).visual).toEqual({ scene: 'base', h: 0, t: 12, o: 0, order: 'hto' })
    expect(hintText(def, 'mt:3x40', 'tensZero')).toBe('Gang først uden nullet. Tre gange fire giver tolv. Sæt så nullet på igen. Svaret er et hundrede og tyve.')
    expect(hintText(def, 'mt:40x3', 'tensZero')).toBe('Gang først uden nullet. Fire gange tre giver tolv. Sæt så nullet på igen. Svaret er et hundrede og tyve.')
    expect(hintText(def, 'mt:3x40', 'tableNeighbour'))
      .toBe('Tæl springene, så du ved, hvornår du skal stoppe. Tæl i spring med fyrre. Fyrre. Firs. Et hundrede og tyve. Tre gange fyrre giver et hundrede og tyve.')
    expect(def.hint(findFact(def, 'mt:3x40'), 'tableNeighbour')).toMatchObject({
      misconception: 'tableNeighbour', animated: true, visual: { scene: 'line', min: 0, max: 200, hops: [0, 40, 80, 120] },
    })
    expect(hintText(def, 'mt:3x40', 'mulAsAdd')).toMatch(/^Vi skal ikke lægge de to tal sammen\. Gange er grupper med lige mange i hver\. Fyrre består af/)
  })

  it('gives whole tens 10 s on the keypad and 8 s on cards (SPEC §3.2), also for drawn instances', () => {
    for (const fam of def.families) expect(fam.fastMs, fam.id).toEqual({ choice: 8_000, keypad: 10_000 })
    const drawn = def.instance!(def.families[1], makeRng(3), new Set())
    expect((['choice', 'keypad'] as TaskKind[]).map((k) => def.fastMs!(drawn, k))).toEqual([8_000, 10_000])
  })
})
