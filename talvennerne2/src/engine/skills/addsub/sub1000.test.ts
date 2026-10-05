import { describe, expect, it } from 'vitest'
import sub1000Module from './sub1000'
import { algebra2Suite, explainBy, textOf } from '../algebra/testing/suite'
import { bnd, idSum, sfl } from './testing/suite'
import { factsUnderTest } from '../number/testing/harness'
import { buildTask } from '../../tasks'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { compile } from '../../../speech/compile'
import { makeRng } from '../../rng'
import type { AnswerValue, ErrorTag, Fact, MisconceptionId, SkillDef, Task, TaskKind } from '../../types'

const def: SkillDef = sub1000Module
const sum = (f: Pick<Fact, 'id'>) => idSum(f.id)

/** pædagogik §3.2 on digit strings (addsub/testing/suite.ts): smallerFromLarger, borrowNoDecrement, and a + b. */
function formulas(f: Pick<Fact, 'id'>): [MisconceptionId, number | null][] {
  const { a, b } = sum(f)
  const d = a - b
  return [
    ['smallerFromLarger', sfl(a, b) === d ? null : sfl(a, b)],
    ['borrowNoDecrement', bnd(a, b) === d ? null : bnd(a, b)],
    ['wrongOperation', a + b],
  ]
}

algebra2Suite(def, {
  families: { HTOminusOborrow: 20, HTOminusTO: 20, HTOminusTOborrow: 20, HTOminusHTO: 20, HTOminusHTOborrow: 20, acrossZero: 20 },
  answerOf: (f) => sum(f).a - sum(f).b,
  idFormat: /^s1000:\d{3}-\d{1,3}$/,
  explain: (f, v: AnswerValue) => explainBy(v, sum(f).a - sum(f).b, formulas(f), [sum(f).a, sum(f).b]),
  formulaValues: (f) => [...formulas(f).flatMap(([, v]) => (v === null ? [] : [v])), sum(f).a, sum(f).b],
  ceilings: { choice: 3, keypad: 5 },
})

/** a's digit at place p (0 ones, 1 tens), on the digit string. */
const digit = (n: number, p: number) => Number(String(n).padStart(3, '0')[2 - p])

/** The family a difference belongs to, from its numbers alone (the families are disjoint). */
function familyOf(a: number, b: number): string {
  const ones = digit(a, 0) < digit(b, 0)
  const borrow = sfl(a, b) !== a - b
  if (ones && digit(a, 1) === 0) return 'acrossZero'
  if (b < 10) return 'HTOminusOborrow'
  if (b < 100) return borrow ? 'HTOminusTOborrow' : 'HTOminusTO'
  return borrow ? 'HTOminusHTOborrow' : 'HTOminusHTO'
}

const factOf = (a: number, b: number): Fact => ({ id: `s1000:${a}-${b}`, skill: 'sub1000', family: familyOf(a, b), operands: [a, b], answer: a - b, rank: 0 })
const taskOf = (a: number, b: number, kind: TaskKind = 'keypad'): Task => buildTask(def, factOf(a, b), kind, makeRng(1), 0).task
const hintSaid = (a: number, b: number, tag: ErrorTag | null): string => compile(def.hint(factOf(a, b), tag).speech).text

describe('sub1000', () => {
  it('takes from a three-digit a, keeps a three-digit answer for a smaller b, and the numbers say the family', () => {
    const seen = new Set<string>()
    for (const f of factsUnderTest(def)) {
      const { a, op, b } = sum(f)
      expect(op).toBe('−')
      expect(a >= 100 && a <= 999 && b >= 1 && b < a, f.id).toBe(true)
      expect(f.family, f.id).toBe(familyOf(a, b))
      if (b < 100) expect(a - b, f.id).toBeGreaterThanOrEqual(100)
      if (b >= 10 && b < 100) expect(b % 10, f.id).not.toBe(0)
      if (b >= 100) expect(b % 100, f.id).not.toBe(0)
      if (f.family === 'acrossZero') seen.add(b < 10 ? 'O' : b < 100 ? 'TO' : 'HTO')
    }
    // across a zero: 402 − 7, 500 − 36 and 403 − 158 alike
    expect([...seen].sort()).toEqual(['HTO', 'O', 'TO'])
  })

  it('asks "Hvad er fire hundrede og to minus syv?" on cards and keys 0–1000', () => {
    const t = taskOf(402, 7)
    expect(t.prompt).toEqual({ scene: 'equation', terms: [{ n: 402 }, { op: '−' }, { n: 7 }, { op: '=' }, { blank: true }] })
    expect(textOf(t)).toBe('Hvad er fire hundrede og to minus syv?')
    expect([t.range, t.maxDigits]).toEqual([[0, 1000], 4])
  })

  it('reads 423 − 158 → 335 as smallerFromLarger, 375 as borrowNoDecrement, 581 as wrongOperation', () => {
    const t = taskOf(423, 158)
    expect(classifyAnswer(t, 335)).toBe('smallerFromLarger')
    expect(classifyAnswer(t, 375)).toBe('borrowNoDecrement')
    expect(classifyAnswer(t, 581)).toBe('wrongOperation')
    expect(classifyAnswer(t, 158)).toBe('operand')
    expect(classifyAnswer(t, 255)).toBe('near')
    expect(classifyAnswer(t, 256)).toBe('digitSwap')
    expect([...detectableOf(t)].sort()).toEqual(['borrowNoDecrement', 'digitSwap', 'smallerFromLarger', 'wrongOperation'])
    // 402 − 7 → 405 is both: the smaller digit from the larger, and a ten borrowed but never taken
    expect(classifyAnswer(taskOf(402, 7), 405)).toBe('ambiguous')
    // 500 − 36 → 536 is the digits taken smaller from larger, and 500 + 36 too
    expect(classifyAnswer(taskOf(500, 36), 536)).toBe('ambiguous')
    expect(classifyAnswer(taskOf(500, 36), 574)).toBe('borrowNoDecrement')
    expect(classifyAnswer(taskOf(600, 245), 445)).toBe('smallerFromLarger')
    expect(classifyAnswer(taskOf(600, 245), 465)).toBe('borrowNoDecrement')
  })

  it('walks the columns with the exchanges, also two in a row and across a zero', () => {
    expect(hintSaid(423, 158, null)).toBe(
      'Regn enerne først. Der er ikke enere nok. Veksl en tier til ti enere. Tretten minus otte giver fem. ' +
      'Regn så tierne. Der er ikke tiere nok. Veksl et hundrede til ti tiere. Elleve minus fem giver seks. ' +
      'Regn så hundrederne. Tre minus en giver to. Svaret er to hundrede og femogtres.',
    )
    expect(hintSaid(402, 7, null)).toBe(
      'Regn enerne først. Der er ikke enere nok, og der er ingen tiere. Veksl først et hundrede til ti tiere, og så en tier til ti enere. ' +
      'Tolv minus syv giver fem. Regn så tierne. Ni minus nul giver ni. Regn så hundrederne. Tre minus nul giver tre. ' +
      'Svaret er tre hundrede og femoghalvfems.',
    )
    expect(hintSaid(368, 25, null)).toBe(
      'Regn enerne først. Otte minus fem giver tre. Regn så tierne. Seks minus to giver fire. Hundrederne er de samme. Svaret er tre hundrede og treogfyrre.',
    )
    expect(def.hint(factOf(512, 278), null).visual).toEqual({ scene: 'columns', a: 512, b: 278, op: '−', carry: true })
  })

  it('says what went wrong before the columns, with the borrow film for smallerFromLarger and borrowNoDecrement', () => {
    expect(hintSaid(423, 158, 'smallerFromLarger')).toMatch(/^Vi trækker altid det nederste tal fra det øverste\. Er det øverste for lille, veksler vi\. Regn enerne først\./)
    expect(def.hint(factOf(423, 158), 'smallerFromLarger')).toMatchObject({ misconception: 'smallerFromLarger', animated: true })
    expect(hintSaid(423, 158, 'borrowNoDecrement')).toMatch(/^Når du veksler en tier, er der en tier mindre tilbage\. Regn enerne først\./)
    expect(hintSaid(402, 17, 'borrowNoDecrement')).toMatch(/^Når du veksler et hundrede, er der et hundrede mindre tilbage\. Regn enerne først\./)
    expect(hintSaid(325, 42, 'borrowNoDecrement')).toMatch(/^Når du veksler et hundrede, er der et hundrede mindre tilbage\. Regn enerne først\./)
    expect(def.hint(factOf(423, 158), 'borrowNoDecrement')).toMatchObject({ misconception: 'borrowNoDecrement', animated: true })
    expect(hintSaid(423, 158, 'wrongOperation')).toMatch(/^Minus betyder, at nogle bliver taget væk\. Regn enerne først\./)
    expect(hintSaid(423, 158, 'digitSwap')).toBe('Vi skriver tierne først og så enerne. Svaret er to hundrede og femogtres.')
  })

  it('gives a three-digit difference 25 s on the keypad and 12 s on cards (SPEC §3.2), also for drawn instances', () => {
    for (const fam of def.families) expect(fam.fastMs, fam.id).toEqual({ choice: 12_000, keypad: 25_000 })
    const drawn = def.instance!(def.families[5], makeRng(11), new Set())
    expect((['choice', 'keypad'] as TaskKind[]).map((k) => def.fastMs!(drawn, k))).toEqual([12_000, 25_000])
  })
})
