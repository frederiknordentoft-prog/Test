import { describe, expect, it } from 'vitest'
import missingPart100Module from './missingPart100'
import { algebra2Suite, explainBy, findFact, hintText, taskOf, textOf } from './testing/suite'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { factsUnderTest } from '../number/testing/harness'
import type { AnswerValue, Fact, MisconceptionId, SkillDef } from '../../types'

const def: SkillDef = missingPart100Module

/** "100 − 37 → 73": each digit of a two-digit number made up to ten (on digit strings). */
const dc10 = (a: number): number | null => {
  const s = String(a)
  return s.length === 2 && s[1] !== '0' ? Number(`${10 - Number(s[0])}${10 - Number(s[1])}`) : null
}

/** The instance read independently of the module: answer, numbers shown, misconception formulas. */
function read(f: Pick<Fact, 'id'>): { x: number; shown: number[]; formulas: [MisconceptionId, number | null][] } {
  let m = /^mp100:(\d+)\+\?=(\d+)$/.exec(f.id)
  if (m) {
    const a = Number(m[1])
    const c = Number(m[2])
    const formulas: [MisconceptionId, number | null][] = [['equalsAsAnswer', a + c]]
    if (c === 100) formulas.push(['digitComplement10', dc10(a)])
    return { x: c - a, shown: [a, c], formulas }
  }
  if ((m = /^mp100:100-(\d+)=\?$/.exec(f.id))) {
    const a = Number(m[1])
    return { x: 100 - a, shown: [100, a], formulas: [['wrongOperation', 100 + a], ['digitComplement10', dc10(a)]] }
  }
  if ((m = /^mp100:(\d+)-\?=(\d+)$/.exec(f.id))) {
    const c = Number(m[1])
    const d = Number(m[2])
    return { x: c - d, shown: [c, d], formulas: [['wrongOperation', c + d]] }
  }
  m = /^mp100:\?-(\d+)=(\d+)$/.exec(f.id)!
  const b = Number(m[1])
  const d = Number(m[2])
  return { x: b + d, shown: [b, d], formulas: [['wrongOperation', Math.abs(d - b)]] }
}

algebra2Suite(def, {
  families: { addendCross20: 20, toHundred: 20, subtrahend: 20, minuend: 20 },
  answerOf: (f) => read(f).x,
  idFormat: /^mp100:(\d+\+\?=\d+|100-\d+=\?|\d+-\?=\d+|\?-\d+=\d+)$/,
  explain: (f, v: AnswerValue) => {
    const r = read(f)
    return explainBy(v, r.x, r.formulas, r.shown)
  },
  formulaValues: (f) => {
    const r = read(f)
    return [...r.formulas.map(([, v]) => v).filter((v): v is number => v !== null), ...r.shown]
  },
  ceilings: { choice: 3, keypad: 5 },
})

describe('missingPart100', () => {
  it('keeps each family to its shape: crossing a ten, to a hundred, the start or the part taken missing', () => {
    for (const f of factsUnderTest(def)) {
      const r = read(f)
      expect(r.x, f.id).toBeGreaterThan(0)
      expect(Math.max(...r.shown, r.x), f.id).toBeLessThanOrEqual(100)
      if (f.family === 'addendCross20') {
        const [a, c] = r.shown
        expect(c > 20 && c < 100, f.id).toBe(true)
        expect((a % 10) + (r.x % 10), f.id).toBeGreaterThanOrEqual(10)
      }
      if (f.family === 'toHundred') expect(r.shown, f.id).toContain(100)
      if (f.family === 'minuend') expect(f.id, f.id).toMatch(/^mp100:\?-/)
      if (f.family === 'subtrahend') expect(f.id, f.id).toMatch(/^mp100:\d+-\?=/)
    }
  })

  it('reads the four forms aloud as questions', () => {
    expect(textOf(taskOf(def, 'mp100:38+?=45', 'keypad'))).toBe('Otteogtredive plus hvad giver femogfyrre?')
    expect(textOf(taskOf(def, 'mp100:100-37=?', 'keypad'))).toBe('Hvad er et hundrede minus syvogtredive?')
    expect(textOf(taskOf(def, 'mp100:37+?=100', 'keypad'))).toBe('Syvogtredive plus hvad giver et hundrede?')
    expect(textOf(taskOf(def, 'mp100:52-?=38', 'keypad'))).toBe('Tooghalvtreds minus hvad giver otteogtredive?')
    expect(textOf(taskOf(def, 'mp100:?-27=38', 'keypad'))).toBe('Hvad minus syvogtyve giver otteogtredive?')
  })

  it('tells the misconceptions apart (SPEC §4.2, A9)', () => {
    const t = taskOf(def, 'mp100:37+?=100', 'keypad')
    expect(classifyAnswer(t, 73)).toBe('digitComplement10')
    expect(classifyAnswer(t, 137)).toBe('equalsAsAnswer')
    expect(classifyAnswer(t, 37)).toBe('operand')
    expect([...detectableOf(t)].sort()).toEqual(['digitComplement10', 'digitSwap', 'equalsAsAnswer']) // 63 typed as 36
    expect(classifyAnswer(taskOf(def, 'mp100:100-37=?', 'keypad'), 137)).toBe('wrongOperation')
    expect(classifyAnswer(taskOf(def, 'mp100:100-37=?', 'keypad'), 73)).toBe('digitComplement10')
    expect(classifyAnswer(taskOf(def, 'mp100:55+?=100', 'keypad'), 55)).toBe('ambiguous') // 5 and 5 up to ten, or the 55
    expect(classifyAnswer(taskOf(def, 'mp100:38+?=45', 'keypad'), 83)).toBe('equalsAsAnswer')
    expect(classifyAnswer(taskOf(def, 'mp100:52-?=38', 'keypad'), 90)).toBe('wrongOperation')
    expect(classifyAnswer(taskOf(def, 'mp100:?-27=38', 'keypad'), 11)).toBe('wrongOperation')
  })

  it('counts up on the empty number line; the start is found by hopping the part back on', () => {
    expect(hintText(def, 'mp100:38+?=45', null)).toBe('Start på otteogtredive. Hop to frem til fyrre. Hop fem frem til femogfyrre. Hoppene giver tilsammen syv.')
    expect(hintText(def, 'mp100:100-37=?', null)).toBe('Start på syvogtredive. Hop tre frem til fyrre. Hop tres frem til et hundrede. Hoppene giver tilsammen treogtres.')
    expect(hintText(def, 'mp100:52-?=38', null)).toBe('Start på otteogtredive. Hop to frem til fyrre. Hop ti frem til halvtreds. Hop to frem til tooghalvtreds. Hoppene giver tilsammen fjorten.')
    expect(hintText(def, 'mp100:?-27=38', null)).toBe('Start på otteogtredive. Hop to frem til fyrre. Hop tyve frem til tres. Hop fem frem til femogtres. Svaret er femogtres.')
    expect(def.hint(findFact(def, 'mp100:38+?=45'), null).visual).toEqual({ scene: 'line', min: 30, max: 50, hops: [38, 40, 45] })
    expect(hintText(def, 'mp100:37+?=100', 'digitComplement10')).toMatch(/^Tæl hele vejen op til hundrede\./)
    expect(def.hint(findFact(def, 'mp100:38+?=45'), 'equalsAsAnswer')).toMatchObject({
      misconception: 'equalsAsAnswer', animated: true, visual: { scene: 'balance', left: [{ n: 38 }, { op: '+' }, { n: 7 }], right: [{ n: 45 }] },
    })
    expect(hintText(def, 'mp100:?-27=38', 'wrongOperation')).toMatch(/^Vi leder efter det tal, vi startede med\./)
    expect(hintText(def, 'mp100:52-?=38', 'wrongOperation')).toMatch(/^Minus betyder, at nogle bliver taget væk\./)
  })

  it('gives cards 10 s and the keypad 15 s, also for drawn instances', () => {
    for (const fam of def.families) expect(fam.fastMs, fam.id).toEqual({ choice: 10_000, keypad: 15_000 })
  })
})
