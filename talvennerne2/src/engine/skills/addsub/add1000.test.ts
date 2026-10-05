import { describe, expect, it } from 'vitest'
import add1000Module from './add1000'
import { algebra2Suite, explainBy, textOf } from '../algebra/testing/suite'
import { idSum } from './testing/suite'
import { factsUnderTest } from '../number/testing/harness'
import { buildTask } from '../../tasks'
import { classifyAnswer, detectableOf, digitSwapOf } from '../../misconceptions'
import { compile } from '../../../speech/compile'
import { makeRng } from '../../rng'
import type { AnswerValue, ErrorTag, Fact, MisconceptionId, SkillDef, Task, TaskKind } from '../../types'

const def: SkillDef = add1000Module
const sum = (f: Pick<Fact, 'id'>) => idSum(f.id)

/** The digits of a and b in columns, ones first, worked out on digit strings (not with calc3.ts). */
function cols(a: number, b: number): [number, number][] {
  const w = Math.max(String(a).length, String(b).length)
  const [x, y] = [String(a).padStart(w, '0'), String(b).padStart(w, '0')]
  return [...x].map((c, i): [number, number] => [Number(c), Number(y[i])]).reverse()
}

/** pædagogik §3.2 forgotCarry: each column's own sum, nothing carried on; the top column is written whole. */
function forgot(a: number, b: number): number {
  const c = cols(a, b)
  const digits = c.map(([x, y], i) => String(i === c.length - 1 ? x + y : (x + y) % 10)).reverse()
  return Number(digits.join(''))
}

/** Does any column make ten or more, counting the ten carried in? */
function carries(a: number, b: number): boolean[] {
  let carry = 0
  return cols(a, b).map(([x, y]) => {
    const s = x + y + carry
    carry = s >= 10 ? 1 : 0
    return s >= 10
  })
}

function formulas(f: Pick<Fact, 'id'>): [MisconceptionId, number | null][] {
  const { a, b } = sum(f)
  return [
    ['forgotCarry', forgot(a, b) === a + b ? null : forgot(a, b)],
    ['placeMisalign', b < 10 ? a + 10 * b : null],
    ['wrongOperation', Math.abs(a - b)],
  ]
}

algebra2Suite(def, {
  families: { HTOplusOcarry: 20, HTOplusTO: 20, HTOplusTOcarry1: 20, HTOplusTOcarry10: 20, HTOplusHTO: 20, HTOplusHTOcarry: 20 },
  answerOf: (f) => sum(f).a + sum(f).b,
  idFormat: /^a1000:\d{3}\+\d{1,3}$/,
  explain: (f, v: AnswerValue) => explainBy(v, sum(f).a + sum(f).b, formulas(f), [sum(f).a, sum(f).b]),
  formulaValues: (f) => [...formulas(f).flatMap(([, v]) => (v === null ? [] : [v])), sum(f).a, sum(f).b],
  ceilings: { choice: 3, keypad: 5 },
})

/** The family a sum belongs to, from its numbers alone (the families are disjoint). */
function familyOf(a: number, b: number): string {
  const [ones, tens] = carries(a, b)
  if (b < 10) return 'HTOplusOcarry'
  if (b < 100) return tens ? 'HTOplusTOcarry10' : ones ? 'HTOplusTOcarry1' : 'HTOplusTO'
  return ones || tens ? 'HTOplusHTOcarry' : 'HTOplusHTO'
}

/** A fact of any sum, as the round screen rebuilds it from its task (the skill reads the id). */
const factOf = (a: number, b: number): Fact => ({ id: `a1000:${a}+${b}`, skill: 'add1000', family: familyOf(a, b), operands: [a, b], answer: a + b, rank: 0 })
const taskOf = (a: number, b: number, kind: TaskKind = 'keypad'): Task => buildTask(def, factOf(a, b), kind, makeRng(1), 0).task
const hintSaid = (a: number, b: number, tag: ErrorTag | null): string => compile(def.hint(factOf(a, b), tag).speech).text

describe('add1000', () => {
  it('adds to a three-digit a, sums to 999, and the numbers alone say the family', () => {
    for (const f of factsUnderTest(def)) {
      const { a, op, b } = sum(f)
      expect(op).toBe('+')
      expect(a >= 100 && a <= 999 && a + b <= 999, f.id).toBe(true)
      expect(f.family, f.id).toBe(familyOf(a, b))
      if (f.family === 'HTOplusOcarry') expect(carries(a, b)[0] && b >= 2, f.id).toBe(true)
      if (b >= 10 && b < 100) expect(b % 10, f.id).not.toBe(0)
      if (b >= 100) expect(a % 100 !== 0 && b % 100 !== 0, f.id).toBe(true)
    }
  })

  it('asks "Hvad er to hundrede og syvogfyrre plus seks?" on cards and keys 0–1000', () => {
    const t = taskOf(247, 6)
    expect(t.prompt).toEqual({ scene: 'equation', terms: [{ n: 247 }, { op: '+' }, { n: 6 }, { op: '=' }, { blank: true }] })
    expect(textOf(t)).toBe('Hvad er to hundrede og syvogfyrre plus seks?')
    expect([t.range, t.maxDigits]).toEqual([[0, 1000], 4])
  })

  it('reads 378 + 45 → 313 as forgotCarry, 247 + 6 → 307 as placeMisalign, 333 as wrongOperation', () => {
    const t = taskOf(378, 45)
    expect(classifyAnswer(t, 313)).toBe('forgotCarry')
    expect(classifyAnswer(t, 333)).toBe('wrongOperation')
    expect(classifyAnswer(t, 378)).toBe('operand')
    expect(classifyAnswer(t, 413)).toBe('near')
    expect(classifyAnswer(t, 432)).toBe('digitSwap')
    expect([...detectableOf(t)].sort()).toEqual(['digitSwap', 'forgotCarry', 'wrongOperation'])
    const o = taskOf(247, 6)
    expect(classifyAnswer(o, 243)).toBe('forgotCarry')
    expect(classifyAnswer(o, 307)).toBe('placeMisalign')
    expect(classifyAnswer(o, 241)).toBe('wrongOperation')
  })

  it('makes a misconception that is also the answer reversed ambiguous (SPEC A11)', () => {
    let seen = 0
    for (const f of factsUnderTest(def)) {
      const t = buildTask(def, f, 'keypad', makeRng(2), 0).task
      const swapped = digitSwapOf(f.answer as number)
      if (swapped === null || !def.candidates(f).some((c) => c.value === swapped && c.tag !== 'near' && c.tag !== 'operand')) continue
      seen++
      expect(classifyAnswer(t, swapped), f.id).toBe('ambiguous')
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('walks the columns, ones first, with the ten or the hundred that goes over', () => {
    expect(hintSaid(378, 45, null)).toBe(
      'Regn enerne først. Otte plus fem giver tretten. En tier går med over til tierne. Regn så tierne. Syv plus fire plus en giver tolv. ' +
      'Et hundrede går med over til hundrederne. Regn så hundrederne. Tre plus en giver fire. Svaret er fire hundrede og treogtyve.',
    )
    expect(hintSaid(234, 352, null)).toBe(
      'Regn enerne først. Fire plus to giver seks. Regn så tierne. Tre plus fem giver otte. Regn så hundrederne. To plus tre giver fem. ' +
      'Svaret er fem hundrede og seksogfirs.',
    )
    expect(hintSaid(247, 6, null)).toBe(
      'Regn enerne først. Syv plus seks giver tretten. En tier går med over til tierne. Regn så tierne. Fire plus en giver fem. ' +
      'Hundrederne er de samme. Svaret er to hundrede og treoghalvtreds.',
    )
    expect(def.hint(factOf(378, 45), null).visual).toEqual({ scene: 'columns', a: 378, b: 45, op: '+', carry: true })
  })

  it('says the rule of each carrying column for forgotCarry (the carry film plays there)', () => {
    expect(hintSaid(378, 45, 'forgotCarry')).toBe(
      'Når enerne giver ti eller mere, skal tieren med over til tierne. Otte plus fem giver tretten. ' +
      'Når tierne giver ti eller mere, skal hundredet med over til hundrederne. Syv plus fire plus en giver tolv. Svaret er fire hundrede og treogtyve.',
    )
    expect(hintSaid(372, 54, 'forgotCarry'))
      .toBe('Når tierne giver ti eller mere, skal hundredet med over til hundrederne. Syv plus fem giver tolv. Svaret er fire hundrede og seksogtyve.')
    expect(def.hint(factOf(378, 45), 'forgotCarry')).toMatchObject({ misconception: 'forgotCarry', animated: true })
    expect(hintSaid(247, 6, 'placeMisalign')).toMatch(/^Det lille tal er enere\. Læg det til enerne, ikke til tierne\. Regn enerne først\./)
    expect(hintSaid(378, 45, 'wrongOperation')).toMatch(/^Plus betyder, at der kommer flere til\. Regn enerne først\./)
    expect(hintSaid(378, 45, 'digitSwap')).toBe('Vi skriver tierne først og så enerne. Svaret er fire hundrede og treogtyve.')
  })

  it('gives a three-digit sum 25 s on the keypad and 12 s on cards (SPEC §3.2), also for drawn instances', () => {
    for (const fam of def.families) expect(fam.fastMs, fam.id).toEqual({ choice: 12_000, keypad: 25_000 })
    const drawn = def.instance!(def.families[4], makeRng(11), new Set())
    expect((['choice', 'keypad'] as TaskKind[]).map((k) => def.fastMs!(drawn, k))).toEqual([12_000, 25_000])
  })
})
