import { describe, expect, it } from 'vitest'
import div2510Module from './div2510'
import { algebra2Suite, explainBy, findFact, hintText, taskOf, textOf } from '../algebra/testing/suite'
import { classifyAnswer } from '../../misconceptions'
import { compile } from '../../../speech/compile'
import { canShare } from '../../../ui/task/share/logic'
import { fastMsOf } from '../../../ui/screens/child/play/prepare'
import { skillRegistry } from '../../registry'
import type { AnswerValue, Fact, MisconceptionId, SkillDef } from '../../types'

const def: SkillDef = div2510Module

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
  families: { d2: 10, d5: 10, d10: 10 },
  answerOf: (f) => cd(f)[0] / cd(f)[1],
  idFormat: /^div:\d+\/\d+$/,
  explain: (f, v: AnswerValue) => explainBy(v, cd(f)[0] / cd(f)[1], formulas(f), cd(f)),
  formulaValues: (f) => [...formulas(f).map(([, v]) => v), ...cd(f)],
  ceilings: { choice: 3, keypad: 5, share: 3 },
})

describe('div2510', () => {
  it('is c : d for d = 2, 5, 10 and every quotient 1–10', () => {
    const facts = def.enumerate()
    const want = [2, 5, 10].flatMap((d) => Array.from({ length: 10 }, (_, i) => `div:${d * (i + 1)}/${d}`))
    expect(facts.map((f) => f.id)).toEqual(want)
    for (const f of facts) expect(f.family).toBe(`d${cd(f)[1]}`)
  })

  it('reads ":" as "divideret med" (SPEC A19): "Hvad er tyve divideret med fem?"', () => {
    const t = taskOf(def, 'div:20/5', 'keypad')
    expect(t.prompt).toEqual({ scene: 'equation', terms: [{ n: 20 }, { op: ':' }, { n: 5 }, { op: '=' }, { blank: true }] })
    expect(textOf(t)).toBe('Hvad er tyve divideret med fem?')
    for (const f of def.enumerate()) {
      for (const kind of def.kinds) {
        const parts = [...def.speech(f, kind), ...def.hint(f, null, kind).speech]
        expect(parts.some((p) => 'clip' in p && p.clip === 'frag.muldiv.delt_med'), `${f.id} ${kind}`).toBe(false)
      }
    }
  })

  it('bridges the two words in every hint, and thinks of the times table backwards over the array', () => {
    expect(hintText(def, 'div:20/5', null))
      .toBe('Divideret med betyder det samme som delt med. Hvad gange fem giver tyve? Fire gange fem giver tyve. Tyve divideret med fem giver fire.')
    expect(def.hint(findFact(def, 'div:20/5'), null).visual).toEqual({ scene: 'array', rows: 4, cols: 5 })
    for (const f of def.enumerate()) {
      for (const tag of [null, 'near', 'operand', 'other', 'tableNeighbour', 'wrongOperation', 'shareUnequal'] as const) {
        for (const kind of [undefined, ...def.kinds]) {
          expect(compile(def.hint(f, tag, kind).speech).clips[0], `${f.id} ${tag} ${kind}`).toBe('hint.div2510.bridge')
        }
      }
    }
    expect(hintText(def, 'div:20/5', 'tableNeighbour'))
      .toBe('Divideret med betyder det samme som delt med. Prøv at gange dit svar med fem. Det skal give tyve. Fire gange fem giver tyve. Tyve divideret med fem giver fire.')
    expect(def.hint(findFact(def, 'div:20/5'), 'tableNeighbour')).toMatchObject({ misconception: 'tableNeighbour', animated: true })
    expect(hintText(def, 'div:20/5', 'wrongOperation')).toMatch(/^Divideret med betyder det samme som delt med\. Vi deler i lige store dele\. Hvad gange fem/)
  })

  it('reads 20 : 5 → 3 or 5 as tableNeighbour, 15 and 100 as wrongOperation, 10 : 5 → 5 as ambiguous (A9)', () => {
    const t = taskOf(def, 'div:20/5', 'keypad')
    expect(classifyAnswer(t, 3)).toBe('tableNeighbour')
    expect(classifyAnswer(t, 5)).toBe('ambiguous') // q + 1, and the 5 of the question
    expect(classifyAnswer(t, 15)).toBe('wrongOperation')
    expect(classifyAnswer(t, 100)).toBe('wrongOperation')
    expect(classifyAnswer(t, 20)).toBe('operand')
    expect(classifyAnswer(t, 6)).toBe('near')
    expect(classifyAnswer(taskOf(def, 'div:10/5', 'keypad'), 5)).toBe('ambiguous')
    expect(classifyAnswer(taskOf(def, 'div:6/2', 'keypad'), 4)).toBe('ambiguous') // q + 1 and c − d
  })

  it('deals the pile on the share view (not production), with the dealing of 2. klasse said "divideret med"', () => {
    const t = taskOf(def, 'div:12/2', 'share')
    expect(canShare(t)).toBe(true)
    expect(t.distractorTags).toEqual({})
    expect(classifyAnswer(t, -1)).toBe('shareUnequal')
    expect(hintText(def, 'div:12/2', null, 'share')).toBe(
      'Divideret med betyder det samme som delt med. Læg en på hver tallerken ad gangen, rundt og rundt, til der ikke er flere. ' +
      'På hver tallerken ligger der nu seks. Tolv divideret med to giver seks.',
    )
    expect(def.hint(findFact(def, 'div:12/2'), null, 'share').visual).toEqual({ scene: 'groups', groups: 2, size: 6, thing: 'carrot' })
    expect(hintText(def, 'div:12/2', 'shareUnequal', 'share')).toMatch(/^Divideret med betyder det samme som delt med\. Der skal ligge lige mange på alle tallerknerne\./)
    // a pile of more than 40 is asked on the keypad instead (the share view's limit), with the times table
    expect(canShare(taskOf(def, 'div:50/5', 'share'))).toBe(false)
    expect(canShare(taskOf(def, 'div:40/10', 'share'))).toBe(true)
    expect(def.hint(findFact(def, 'div:40/10'), null, 'share').visual).toMatchObject({ scene: 'groups', groups: 10, size: 4 })
    expect(def.hint(findFact(def, 'div:50/5'), null, 'share').visual).toEqual({ scene: 'array', rows: 10, cols: 5 })
    expect(hintText(def, 'div:50/5', null, 'share')).toMatch(/^Divideret med betyder det samme som delt med\. Hvad gange fem giver halvtreds\?/)
  })

  it('gives a deal as long as the share scene does: 3 s and 0.8 s a thing', () => {
    const reg = skillRegistry()
    expect(fastMsOf(taskOf(def, 'div:12/2', 'share'), reg)).toBe(3_000 + 800 * 12)
    expect(fastMsOf(taskOf(def, 'div:12/2', 'keypad'), reg)).toBeUndefined()
  })
})
