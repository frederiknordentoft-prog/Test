// Independent oracles for the plus and minus skills of 0. klasse (addTo10, subTo10, tenFriends). A
// fact's answer is read three ways — from its id (CONVENTIONS: add:a+b, sub:a-b, ten:a), from the
// recorded question ("Hvad er tre plus fire?") and from the equation on screen — and all three must
// agree with the task. Wrong answers are explained with pædagogik §3.2's formulas, worked out here,
// not taken from the skills. The registry skips *.oracle.ts files, so none of this reaches the app.
import type { MisconceptionId, Prompt, SkillId, Task } from '../../types'
import { isNear, spokenNumbers, type Explanation } from '../number/number.oracle'

export type AddSubSkill = Extract<SkillId, 'addTo10' | 'subTo10' | 'tenFriends'>

/** The numbers of a fact id: add:<a>+<b> → [a, b], sub:<a>-<b> → [a, b], ten:<a> → [a]. */
export function idParts(id: string): { prefix: 'add' | 'sub' | 'ten'; a: number; b: number } {
  const add = /^add:(\d+)\+(\d+)$/.exec(id)
  if (add) return { prefix: 'add', a: Number(add[1]), b: Number(add[2]) }
  const sub = /^sub:(\d+)-(\d+)$/.exec(id)
  if (sub) return { prefix: 'sub', a: Number(sub[1]), b: Number(sub[2]) }
  const ten = /^ten:(\d+)$/.exec(id)
  if (ten) return { prefix: 'ten', a: Number(ten[1]), b: 10 - Number(ten[1]) }
  throw new Error(`not an addsub fact id: ${id}`)
}

/** add:a+b → a + b · sub:a-b → a − b · ten:a → the partner of a to ten. */
export function addsubAnswer(id: string): number {
  const { prefix, a, b } = idParts(id)
  return prefix === 'add' ? a + b : prefix === 'sub' ? a - b : 10 - a
}

/** Every fact id SPEC §2.2 and CONVENTIONS give each skill. */
export function expectedIds(skill: AddSubSkill): string[] {
  const out: string[] = []
  for (let a = 0; a <= 10; a++) {
    if (skill === 'tenFriends') out.push(`ten:${a}`)
    for (let b = 0; b <= 10; b++) {
      if (skill === 'addTo10' && a + b <= 10) out.push(`add:${a}+${b}`)
      if (skill === 'subTo10' && b <= a) out.push(`sub:${a}-${b}`)
    }
  }
  return out
}

/** The family the metadata labels describe: addTo10 "Til 5" / "Til 10", subTo10 "Fra højst 5" / "Fra 6–10". */
export function familyOf(id: string): string {
  const { prefix, a, b } = idParts(id)
  if (prefix === 'add') return a + b <= 5 ? 'small' : 'big'
  if (prefix === 'sub') return a <= 5 ? 'small' : 'big'
  return 'pairs'
}

/**
 * The answer a child hears: "Hvad er tre plus fire?" → 7, "Hvad er ni minus fem?" → 4,
 * "Fire plus hvad giver ti?" → 6. Null when the sentence is none of these.
 */
export function answerFromQuestion(text: string): number | null {
  const n = spokenNumbers(text)
  if (/^Hvad er [a-zæøå]+ plus [a-zæøå]+\?$/.test(text) && n.length === 2) return n[0] + n[1]
  if (/^Hvad er [a-zæøå]+ minus [a-zæøå]+\?$/.test(text) && n.length === 2 && n[0] >= n[1]) return n[0] - n[1]
  if (/^[A-ZÆØÅ][a-zæøå]* plus hvad giver [a-zæøå]+\?$/.test(text) && n.length === 2 && n[1] >= n[0]) return n[1] - n[0]
  return null
}

/** The number for the box in a + b = □, a − b = □ or a + □ = c. */
export function answerFromEquation(p: Prompt): number | null {
  if (p.scene !== 'equation') return null
  const t = p.terms
  const num = (i: number) => {
    const term = t[i]
    return term && 'n' in term ? term.n : null
  }
  const op = (i: number) => {
    const term = t[i]
    return term && 'op' in term ? term.op : null
  }
  const blank = (i: number) => {
    const term = t[i]
    return term !== undefined && 'blank' in term
  }
  if (t.length !== 5 || op(3) !== '=') return null
  const [a, b, c] = [num(0), num(2), num(4)]
  if (a !== null && b !== null && blank(4)) return op(1) === '+' ? a + b : op(1) === '−' && a >= b ? a - b : null
  if (a !== null && c !== null && blank(2) && op(1) === '+' && c >= a) return c - a
  return null
}

/** Numbers the question shows or says: the two numbers of a sum or difference, the number and the ten. */
export function questionNumbers(id: string): number[] {
  const { prefix, a, b } = idParts(id)
  return prefix === 'ten' ? [a, 10] : [a, b]
}

/**
 * pædagogik §3.2 for a wrong answer to a fact:
 *  - countFromFirst (addTo10, subTo10): the start number counted as the first hop — plus: the answer
 *    − 1, minus: the answer + 1. Only where there is counting: plus needs both numbers ≥ 1 (counting
 *    on starts at a and hops b times), minus needs something taken away.
 *  - wrongOperation (every arithmetic skill): the other operation, kept ≥ 0 — plus: |a − b|,
 *    minus: a + b. A missing addend (a + ? = 10) has no other operation that is not the answer.
 *  - a number from the question ('operand') and near misses (±1, ±2, ±10).
 * tenFriends has no misconception in the catalogue (equalsAsAnswer belongs to missingPart10).
 */
export function explainAddSub(id: string, value: number): Explanation {
  const { prefix, a, b } = idParts(id)
  const answer = addsubAnswer(id)
  const mis: MisconceptionId[] = []
  if (prefix === 'add') {
    if (a >= 1 && b >= 1 && value === answer - 1) mis.push('countFromFirst')
    if (value === Math.abs(a - b) && value !== answer) mis.push('wrongOperation')
  }
  if (prefix === 'sub') {
    if (b >= 1 && value === answer + 1) mis.push('countFromFirst')
    if (value === a + b && value !== answer) mis.push('wrongOperation')
  }
  return { mis, operand: questionNumbers(id).includes(value), near: isNear(value, answer) }
}

/** The task's answer is a number; every addsub task asks for one. */
export const numericAnswer = (t: Task): number => {
  if (typeof t.answer !== 'number') throw new Error(`${t.factId}: answer ${String(t.answer)} is not a number`)
  return t.answer
}
