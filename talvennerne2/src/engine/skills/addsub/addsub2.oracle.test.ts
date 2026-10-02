// Oracle tests for the plus and minus skills of 1.–2. klasse (SPEC §15.1): every recall fact (several
// card deals), every procedure family's canonical facts and 200 seeded instances, every kind, compared
// with addsub2.oracle.ts — answers from the id, the question and the card; wrong answers from
// pædagogik §3.2's formulas worked out column by column.
import { describe, expect, it, vi } from 'vitest'

// every value of every instance is classified: give the sweeps room on a loaded container (CONVENTIONS)
vi.setConfig({ testTimeout: 240_000 })
import { isCorrect } from '../../answer'
import { classifyAnswer } from '../../misconceptions'
import { compile } from '../../../speech/compile'
import type { Fact } from '../../types'
import { cardProblems, first, hintProblems, registeredSkill, tagsToHint, taskSpeechProblems, type Built } from '../number/number.oracle'
import {
  answerProblems2, avoidProblems, classifyProblems2, expectedTag, idProblems, lineOf, numberCards, numberWordProblems,
  productionProblems2, specKindProblems2, swapTO, sweep, typedValues,
} from '../number/number2.oracle'
import {
  answerFromPrompt, answerFromSpeech, borrowNoDecrement, digitComplement10, explainSum, forgotCarry, givenNumbers, idShape, lineFor,
  misconceptionsFor, parseSum, RECALL2, smallerFromLarger, textOf, type AddSub2Skill, type Sum,
} from './addsub2.oracle'

describe('addsub2 oracle helpers', () => {
  it('work the columns and read the questions the way a child does (a check of the oracle itself)', () => {
    expect(forgotCarry(38, 45)).toBe(73)
    expect(forgotCarry(8, 5)).toBe(3)
    expect(forgotCarry(67, 58)).toBe(115)
    expect(forgotCarry(72, 51)).toBeNull()
    expect(forgotCarry(370, 50)).toBe(320)
    expect(forgotCarry(970, 30)).toBe(900)
    expect(forgotCarry(37, 3)).toBe(30)
    expect(smallerFromLarger(53, 27)).toBe(34)
    expect(smallerFromLarger(13, 5)).toBe(12)
    expect(smallerFromLarger(100, 37)).toBe(137)
    expect(borrowNoDecrement(53, 27)).toBe(36)
    expect(borrowNoDecrement(13, 5)).toBe(18)
    expect(borrowNoDecrement(100, 37)).toBe(173)
    expect(digitComplement10(100, 37)).toBe(73)
    expect(digitComplement10(60, 24)).toBeNull()
    expect(answerFromSpeech('Hvad er otteogtredive plus femogfyrre?')).toBe(83)
    expect(answerFromSpeech('Hvad er et hundrede minus syvogtredive?')).toBe(63)
    expect(answerFromSpeech('Hvad er det dobbelte af seks?')).toBe(12)
    expect(answerFromSpeech('Hvad er halvdelen af fjorten?')).toBe(7)
    expect(answerFromSpeech('Hvad er tre hundrede plus fire hundrede?')).toBe(700)
    expect(parseSum('add100Carry', 'a100c:67+58')?.family).toBe('TOplusTOover100')
    expect(parseSum('add100Carry', 'a100c:37+3')?.family).toBe('toNextTen')
    expect(parseSum('add100Carry', 'a100c:46+19')?.family).toBe('nearTen')
    expect(parseSum('sub100Borrow', 's100b:100-37')?.family).toBe('fromTen')
    expect(parseSum('addSub1000Round', 'r1000:370+50')?.family).toBe('HTplusTcarry')
    expect(misconceptionsFor(parseSum('doubles', 'dbl:6')!, 3)).toEqual(['wrongOperation'])
    expect(misconceptionsFor(parseSum('halves', 'hlf:14')!, 28)).toEqual(['wrongOperation'])
  })
})

const SKILLS: readonly AddSub2Skill[] = [
  'doubles', 'halves', 'addTo20', 'subTo20', 'addSub20Simple', 'tens100', 'add100NoCarry', 'sub100NoBorrow', 'add100Carry',
  'sub100Borrow', 'addSub1000Round',
]

/** SPEC §2.2's recall facts, as ids: doubles 1–10, halves of 2–20, addTo20 and subTo20 over the ten (V1, 36 each). */
function recallIds(skill: AddSub2Skill): string[] {
  const out: string[] = []
  for (let a = 1; a <= 20; a++) {
    if (skill === 'doubles' && a <= 10) out.push(`dbl:${a}`)
    if (skill === 'halves' && a % 2 === 0) out.push(`hlf:${a}`)
    for (let b = 1; b <= 20; b++) {
      if (skill === 'addTo20' && a >= 2 && a <= 9 && b >= 2 && b <= 9 && a + b > 10) out.push(`add:${a}+${b}`)
      if (skill === 'subTo20' && a >= 11 && b >= 2 && b <= 9 && a - b >= 2 && a - b <= 9) out.push(`sub:${a}-${b}`)
    }
  }
  return out
}

for (const skill of SKILLS) {
  describe(`${skill} oracle`, () => {
    const def = registeredSkill(skill)
    const recall = RECALL2.includes(skill)
    const { canon, instances, all, built } = sweep(def, recall ? 8 : 3)
    const sum = (f: Pick<Fact, 'id'>): Sum => parseSum(skill, f.id)!
    const oracle = (id: string) => {
      const s = parseSum(skill, id)
      return s ? { family: s.family, answer: s.answer } : null
    }
    const explain = (b: Built, v: number | string) => explainSum(sum(b.fact), b.task, v)
    const rightAt = (b: Built, v: number) => Math.abs(v - sum(b.fact).answer) <= lineFor(sum(b.fact)).tolerance
    const classified = classifyProblems2(built, explain, { upTo: def.range(canon[0], 'keypad')[1], rightAt, extra: (b) => [sum(b.fact).answer * 10] })

    it('has SPEC §2.2’s facts or families, ids in the CONVENTIONS format, and answers worked out from the id', () => {
      if (recall) expect(canon.map((f) => f.id).sort()).toEqual(recallIds(skill).sort())
      else {
        for (const fam of def.families) {
          const n = canon.filter((f) => f.family === fam.id).length
          // SPEC §2.4: 20 canonical facts per family, all of them when the family has fewer (tenPlus: 18)
          expect(n, fam.id).toBe(fam.id === 'tenPlus' ? 18 : 20)
        }
      }
      expect(first([...idProblems(def, all, idShape(skill), oracle), ...avoidProblems(def, instances)])).toEqual([])
    })

    it('asks what the id says: the question and the card give the task’s answer', () => {
      const problems: string[] = []
      for (const { fact, kind, task } of built) {
        const where = `${fact.id} ${kind}`
        const want = sum(fact).answer
        const text = textOf(task)
        if (task.answer !== want) problems.push(`${where}: answer ${String(task.answer)}, oracle ${want}`)
        if (answerFromSpeech(text) !== want) problems.push(`${where}: "${text}" does not ask for ${want}`)
        if (answerFromPrompt(task.prompt) !== want) problems.push(`${where}: the card ${JSON.stringify(task.prompt)} does not ask for ${want}`)
        // the recall skills ask their recorded sentence q.<factId> (SPEC §10.2)
        if (recall && compile(task.speech).clips.join(' ') !== `q.${fact.id}`) problems.push(`${where}: clips ${compile(task.speech).clips}`)
      }
      expect(first(problems)).toEqual([])
    })

    it('deals valid cards inside the task’s range and keeps every answer right', () => {
      const problems = built.flatMap((b) => [...cardProblems(b.task), ...answerProblems2(b.task)])
      expect(first(problems)).toEqual([])
    })

    it('shows a diagnostic card whenever pædagogik §3.2 has one inside the card range (the rotation picks which)', () => {
      const problems: string[] = []
      for (const b of built) {
        if (b.kind !== 'choice') continue
        const s = sum(b.fact)
        const evidence = (v: number) => v !== s.answer && expectedTag(explainSum(s, b.task, v)) !== 'plain' && expectedTag(explainSum(s, b.task, v)) !== 'ambiguous'
        const available: number[] = []
        for (let v = b.task.range[0]; v <= b.task.range[1]; v++) if (evidence(v)) available.push(v)
        if (available.length > 0 && !numberCards(b.task).some(evidence)) problems.push(`${b.fact.id}: no diagnostic card among [${b.task.options}] (could be ${available})`)
      }
      expect(first(problems)).toEqual([])
    })

    /** Documented below: a misconception value that is also the typed answer reversed (22 + 5 → 72). */
    const alsoSwapped = (p: string) => {
      const m = /^\S+ keypad typed (\d+) \(answer (\d+)\): (\w+), expected ambiguous$/.exec(p)
      return m !== null && m[3] !== 'digitSwap' && swapTO(Number(m[2])) === Number(m[1])
    }

    it('classifies cards, typed and placed answers by pædagogik §3.2; a misconception on a given number is ambiguous (A9)', () => {
      expect(first(classified.filter((p) => !alsoSwapped(p)))).toEqual([])
    })

    if (['add100NoCarry', 'add100Carry', 'sub100Borrow'].includes(skill)) {
      // GENERATOR BUG (calc.ts leaves digitSwap to the engine's global check, which never runs on a value
      // the skill tagged; SPEC §4.1 "Entydighed", the reasoning of A9): a typed misconception value that is
      // also the answer with tens and ones swapped has two explanations, but is classified as the
      // misconception — false concept evidence from the commonest Danish slip. add100NoCarry: a100:22+5
      // (27) typed 72 → placeMisalign (22 + 50 = 72, every a = 11, 22 … 88 with a one-digit b);
      // add100Carry: a100c:55+9 (64) typed 46 → wrongOperation (55 − 9); sub100Borrow: s100b:44-18 (26)
      // typed 62 → wrongOperation (44 + 18). Expected 'ambiguous'.
      it.fails('a misconception value that is also the answer reversed is ambiguous', () => {
        expect(first(classified.filter(alsoSwapped))).toEqual([])
      })
    }

    it('SPEC A9: every typed value where one misconception meets a number from the question is ambiguous', () => {
      const clashes: string[] = []
      for (const b of built) {
        if (b.kind !== 'keypad') continue
        const s = sum(b.fact)
        for (const v of typedValues(b.task, b.task.range[1])) {
          const w = explainSum(s, b.task, v)
          if (v === s.answer || new Set(w.mis).size !== 1 || !w.operand) continue
          const got = classifyAnswer(b.task, v)
          clashes.push(got === 'ambiguous' ? '' : `${b.fact.id} ${v}: ${String(got)}, expected ambiguous`)
        }
      }
      expect(first(clashes.filter((c) => c !== ''))).toEqual([])
    })

    if (def.kinds.includes('numberline')) {
      it('places the answer on the task’s line: 0–20 exact, 0–100 ±5, 0–200 ±10, the answer on the line', () => {
        const problems: string[] = []
        for (const { fact, task } of built) {
          if (task.kind !== 'numberline') continue
          const s = sum(fact)
          const [lo, hi] = lineOf(task)
          const want = lineFor(s)
          if (lo !== 0 || hi !== want.max || task.tolerance !== want.tolerance) problems.push(`${fact.id}: line ${lo}–${hi} ±${task.tolerance}, expected 0–${want.max} ±${want.tolerance}`)
          if (s.answer < lo || s.answer > hi) problems.push(`${fact.id}: ${s.answer} is off the line ${lo}–${hi}`)
        }
        expect(first(problems)).toEqual([])
      })

      const operandsRight = built
        .filter((b) => b.kind === 'numberline')
        .flatMap((b) => givenNumbers(sum(b.fact)).filter((v) => v !== sum(b.fact).answer && isCorrect(b.task, v)).map((v) => `${b.fact.id}: the given ${v} is right (answer ${sum(b.fact).answer}, ±${b.task.tolerance})`))
      if (skill === 'add100Carry') {
        // GENERATOR BUG (add100Carry.ts, numberline with SPEC's ±5 on 0–100): when the number added is 5 or
        // less, the first number of the sum is itself within the tolerance, so putting the needle on the
        // number from the question counts as right — production evidence without adding anything.
        // "Hvad er syvogtredive plus tre?" (a100c:37+3, answer 40): 37 is right; likewise every toNextTen
        // instance with ones ≥ 5 and TOplusOcarry with b ≤ 5 (38 + 5 → 38). A line task needs a tolerance
        // below the smallest addend, or these instances should not be asked on the line.
        it.fails('a number from the question is never right on the line', () => {
          expect(first(operandsRight)).toEqual([])
        })
      } else {
        it('a number from the question is never right on the line', () => {
          expect(first(operandsRight)).toEqual([])
        })
      }
    }

    if (def.kinds.includes('share')) {
      it('share: an even deal is the answer, an uneven one (−1) is shareUnequal, and it is never production here', () => {
        const problems: string[] = []
        for (const { fact, task } of built) {
          if (task.kind !== 'share') continue
          if (!isCorrect(task, sum(fact).answer)) problems.push(`${fact.id}: the even deal is wrong`)
          if (classifyAnswer(task, -1) !== 'shareUnequal') problems.push(`${fact.id}: −1 is ${String(classifyAnswer(task, -1))}`)
        }
        expect(first(problems)).toEqual([])
      })
    }

    it('has SPEC’s production kinds and ceilings (keypad and line box 5; cards box 3; share and buildBase never production here)', () => {
      expect(first([...productionProblems2(built), ...specKindProblems2(def, built)])).toEqual([])
    })

    it('speaks every task and hint with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
      const tags = tagsToHint(def, canon)
      expect(first([...taskSpeechProblems(built), ...numberWordProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags))])).toEqual([])
    })
  })
}
