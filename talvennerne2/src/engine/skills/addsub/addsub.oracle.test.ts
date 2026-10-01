// Oracle tests for addTo10, subTo10 and tenFriends (SPEC §15.1): every fact, every kind, several card
// deals, compared with addsub.oracle.ts (answers from the id, the recorded question and the equation;
// wrong answers from pædagogik §3.2's formulas).
import { describe, expect, it } from 'vitest'
import { masteryKeyOf } from '../../tasks'
import { compile } from '../../../speech/compile'
import {
  answerProblems, cardProblems, classificationProblems, diagnosticProblems, first, hintProblems, operandClashProblems,
  productionProblems, registeredSkill, sceneOf, specKindProblems, spokenText, tagsToHint, taskSpeechProblems, tasksOf, type Built,
} from '../number/number.oracle'
import {
  addsubAnswer, answerFromEquation, answerFromQuestion, expectedIds, explainAddSub, familyOf, idParts, type AddSubSkill,
} from './addsub.oracle'

/** The largest card each skill may show: answers stay within 10; subTo10's "plus instead of minus" reaches 20. */
const SKILLS: readonly { id: AddSubSkill; maxCard: number }[] = [
  { id: 'addTo10', maxCard: 10 },
  { id: 'subTo10', maxCard: 20 },
  { id: 'tenFriends', maxCard: 10 },
]

describe('addsub oracle helpers', () => {
  it('read the recorded questions and the equations the way a child does (a check of the oracle itself)', () => {
    expect(answerFromQuestion('Hvad er tre plus fire?')).toBe(7)
    expect(answerFromQuestion('Hvad er ni minus fem?')).toBe(4)
    expect(answerFromQuestion('Fire plus hvad giver ti?')).toBe(6)
    expect(answerFromQuestion('Hvad er en minus to?')).toBeNull()
    expect(answerFromEquation({ scene: 'equation', terms: [{ n: 9 }, { op: '−' }, { n: 5 }, { op: '=' }, { blank: true }] })).toBe(4)
    expect(answerFromEquation({ scene: 'equation', terms: [{ n: 4 }, { op: '+' }, { blank: true }, { op: '=' }, { n: 10 }] })).toBe(6)
    expect(explainAddSub('add:5+3', 7).mis).toEqual(['countFromFirst'])
    expect(explainAddSub('add:5+3', 2).mis).toEqual(['wrongOperation'])
    expect(explainAddSub('sub:9-3', 7).mis).toEqual(['countFromFirst'])
    expect(explainAddSub('sub:9-3', 12).mis).toEqual(['wrongOperation'])
    expect(explainAddSub('ten:4', 14).mis).toEqual([])
  })
})

for (const { id, maxCard } of SKILLS) {
  describe(`${id} oracle`, () => {
    const def = registeredSkill(id)
    const facts = def.enumerate()
    const built = tasksOf(def, facts, 8)
    const explain = (b: Built, v: number) => explainAddSub(b.fact.id, v)

    it('has exactly the facts of SPEC §2.2, in the CONVENTIONS id format and the families the labels describe', () => {
      expect(facts.map((f) => f.id).sort()).toEqual(expectedIds(id).sort())
      for (const f of facts) {
        expect(f.answer, f.id).toBe(addsubAnswer(f.id))
        expect(f.family, f.id).toBe(familyOf(f.id))
        expect(masteryKeyOf(def, f), f.id).toBe(f.id)
        const { a, b } = idParts(f.id)
        expect([...f.operands], f.id).toEqual(id === 'tenFriends' ? [a, 10] : [a, b])
      }
    })

    it('asks the recorded question q.<factId>, and the id, the question and the equation give the task’s answer', () => {
      const problems: string[] = []
      for (const { fact, kind, task } of built) {
        const where = `${fact.id} ${kind}`
        const want = addsubAnswer(fact.id)
        const text = spokenText(task.speech)
        if (task.answer !== want) problems.push(`${where}: answer ${String(task.answer)}, oracle ${want}`)
        if (answerFromQuestion(text) !== want) problems.push(`${where}: "${text}" does not ask for ${want}`)
        if (compile(task.speech).clips.join(' ') !== `q.${fact.id}`) problems.push(`${where}: clips ${compile(task.speech).clips}`)
        if (kind === 'pair') {
          // the ten-frame holds the given number; the partner bubble fills it
          const frame = sceneOf(task.prompt, 'objects')
          if (frame.layout !== 'tenframe' || 10 - frame.n !== want) problems.push(`${where}: ${frame.layout} with ${frame.n}`)
        } else if (answerFromEquation(task.prompt) !== want) {
          problems.push(`${where}: the equation ${JSON.stringify(task.prompt)} does not ask for ${want}`)
        }
      }
      expect(first(problems)).toEqual([])
    })

    it(`deals valid cards (0–${maxCard}), a diagnostic one whenever there is one, and keeps every answer right`, () => {
      const problems = built.flatMap((b) => [...cardProblems(b.task, (c) => c <= maxCard), ...answerProblems(b.task)])
      expect(first(problems)).toEqual([])
      expect(first(diagnosticProblems(built, explain))).toEqual([])
    })

    it('classifies cards and typed answers by pædagogik §3.2 (countFromFirst, wrongOperation, operands, near misses)', () => {
      expect(first(classificationProblems(built, explain))).toEqual([])
    })

    if (id !== 'tenFriends') {
      // SPEC A9: when the one misconception value is also a number from the question (5 + 1 → 5,
      // 4 + 2 → 2, 5 − 1 → 5, 5 − 3 → 3) it is 'ambiguous' and never evidence (number/kit.ts tagged()).
      it('SPEC A9: a misconception value that is also a number from the question is ambiguous', () => {
        expect(first(operandClashProblems(built, explain, 'ambiguous'))).toEqual([])
      })
    }

    it('has SPEC’s production kinds and ceilings (keypad box 5, cards and bubbles box 3)', () => {
      expect(first([...productionProblems(built), ...specKindProblems(def, built)])).toEqual([])
    })

    it('speaks every task and hint with recorded clips and no digits', () => {
      const tags = tagsToHint(def, facts)
      expect(first([...taskSpeechProblems(built), ...facts.flatMap((f) => hintProblems(def, f, tags))])).toEqual([])
    })
  })
}
