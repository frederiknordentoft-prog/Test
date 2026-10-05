// Shared by the plus and minus skills of 3. klasse (add1000, sub1000): the column strategy with three
// digits, said column by column the way the columns picture draws it (HintVisual 'columns'): ones first,
// what goes over or is exchanged, then the tens and the hundreds. Exchanging a hundred is said as well,
// also across a zero (402 − 7: a hundred to ten tens, then a ten to ten ones). The clips are
// src/speech/clips/skills/addsub3.ts plus the column words of 2. klasse (clips/skills/addsub2.ts). The
// registry skips this file (no SkillDef default export).
//
// Misconception formulas with three digits (one value each, none when it gives the answer itself):
//   forgotCarry        each column's own sum, no ten carried on (378 + 45 → 313; the top column is written
//                      whole) — the 2. klasse formula, column by column
//   smallerFromLarger  per column |x − y| (calc.ts: 423 − 158 → 335)
//   borrowNoDecrement  a column borrows ten, the next is never lowered (calc.ts: 423 − 158 → 375, 402 − 7 → 405)
import type { SpeechPart } from '../../types'
import { num, say } from '../number/kit'
import { answerIs } from './calc'

/** The digit of n at place p (0 ones, 1 tens, 2 hundreds). */
export const digitAt = (n: number, p: number): number => Math.floor(n / 10 ** p) % 10

const placesOf = (a: number, b: number): number => Math.max(String(a).length, String(b).length)

/** "Regn enerne først." / "Regn så tierne." / "Regn så hundrederne." */
const INTRO = ['hint.addsub2.onesFirst', 'hint.addsub2.tensThen', 'hint.addsub3.hundredsThen'] as const
/** A column with nothing to add or take: "Tierne er de samme." */
const SAME = ['hint.addsub2.onesSame', 'hint.addsub2.tensSame', 'hint.addSub1000Round.hundredsSame'] as const

/** The tens carried into each column of a + b (0 or 1), ones first. */
export function carriesIn(a: number, b: number): number[] {
  const out: number[] = []
  let carry = 0
  for (let p = 0; p < placesOf(a, b); p++) {
    out.push(carry)
    carry = digitAt(a, p) + digitAt(b, p) + carry >= 10 ? 1 : 0
  }
  return out
}

/** Does column p (0 ones, 1 tens) make ten or more, counting what is carried in? */
export const carriesOut = (a: number, b: number, p: number): boolean => digitAt(a, p) + digitAt(b, p) + carriesIn(a, b)[p] >= 10

/** forgotCarry: every column's own sum without the carried ten; the top column is written whole (378 + 45 → 313). */
export function noCarrySum(a: number, b: number): number {
  const w = placesOf(a, b)
  let out = 0
  for (let p = 0; p < w; p++) {
    const s = digitAt(a, p) + digitAt(b, p)
    out += (p === w - 1 ? s : s % 10) * 10 ** p
  }
  return out
}

/** "Syv plus fire plus en giver tolv." — the column's digits and the ten carried in (none said when 0). */
export function columnSum(x: number, y: number, carry: number): SpeechPart[] {
  const out: SpeechPart[] = [num(x, 'mid')]
  if (y > 0) out.push(say('op.plus'), num(y, 'mid'))
  if (carry > 0) out.push(say('op.plus'), num(carry, 'mid'))
  return [...out, say('op.giver'), num(x + y + carry)]
}

/** "Tretten minus otte giver fem." */
const columnDifference = (x: number, y: number): SpeechPart[] => [num(x, 'mid'), say('op.minus'), num(y, 'mid'), say('op.giver'), num(x - y)]

/**
 * a + b in columns, ones first, ending with the answer: "Regn enerne først. Otte plus fem giver tretten.
 * En tier går med over til tierne. Regn så tierne. Syv plus fire plus en giver tolv. Et hundrede går med
 * over til hundrederne. Regn så hundrederne. Tre plus en giver fire. Svaret er fire hundrede og treogtyve."
 * A column with nothing to add is "the same".
 */
export function plusColumns(a: number, b: number): SpeechPart[] {
  const out: SpeechPart[] = []
  const carries = carriesIn(a, b)
  for (let p = 0; p < carries.length; p++) {
    const y = digitAt(b, p)
    if (y === 0 && carries[p] === 0) {
      out.push(say(SAME[p]))
      continue
    }
    out.push(say(INTRO[p]), ...columnSum(digitAt(a, p), y, carries[p]))
    if (carriesOut(a, b, p)) out.push(say(p === 0 ? 'hint.add1000.tenOver' : 'hint.add1000.hundredOver'))
  }
  return [...out, ...answerIs(a + b)]
}

/**
 * forgotCarry: for each column that makes ten or more, the rule and that column's sum — "Når enerne giver
 * ti eller mere, skal tieren med over til tierne. Otte plus fem giver tretten." — then the answer.
 */
export function carryRules(a: number, b: number): SpeechPart[] {
  const out: SpeechPart[] = []
  const carries = carriesIn(a, b)
  for (const p of [0, 1]) {
    if (p >= carries.length || !carriesOut(a, b, p)) continue
    out.push(say(p === 0 ? 'hint.addsub2.carryTen' : 'hint.add1000.carryHundred'), ...columnSum(digitAt(a, p), digitAt(b, p), carries[p]))
  }
  return [...out, ...answerIs(a + b)]
}

/** Where a − b first exchanges: the ones from the tens, the ones across a zero ten, the tens, or nowhere. */
export function firstExchange(a: number, b: number): 'ones' | 'acrossZero' | 'tens' | null {
  if (digitAt(a, 0) < digitAt(b, 0)) return digitAt(a, 1) === 0 ? 'acrossZero' : 'ones'
  return digitAt(a, 1) < digitAt(b, 1) ? 'tens' : null
}

/**
 * a − b in columns, ones first, ending with the answer: "Regn enerne først. Der er ikke enere nok. Veksl
 * en tier til ti enere. Tretten minus otte giver fem. Regn så tierne. Der er ikke tiere nok. Veksl et
 * hundrede til ti tiere. Elleve minus fem giver seks. Regn så hundrederne. Tre minus en giver to. Svaret
 * er to hundrede og femogtres." A column that lent is said with its new digit ("Tre minus nul giver
 * tre."); one with nothing taken and nothing lent is "the same".
 */
export function minusColumns(a: number, b: number): SpeechPart[] {
  const w = placesOf(a, b)
  const top = Array.from({ length: w }, (_, p) => digitAt(a, p))
  const out: SpeechPart[] = []
  for (let p = 0; p < w; p++) {
    const y = digitAt(b, p)
    if (top[p] < y) {
      if (p === 0 && top[1] === 0) {
        out.push(say(INTRO[0]), say('hint.sub1000.acrossZero'))
        top[2] -= 1
        top[1] = 9
      } else if (p === 0) {
        out.push(say(INTRO[0]), say('hint.addsub2.borrowTen'))
        top[1] -= 1
      } else {
        out.push(say(INTRO[p]), say('hint.sub1000.borrowHundred'))
        top[p + 1] -= 1
      }
      top[p] += 10
      out.push(...columnDifference(top[p], y))
      continue
    }
    if (y === 0 && top[p] === digitAt(a, p)) {
      out.push(say(SAME[p]))
      continue
    }
    out.push(say(INTRO[p]), ...columnDifference(top[p], y))
  }
  return [...out, ...answerIs(a - b)]
}
