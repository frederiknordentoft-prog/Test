// Independent oracles for the plus and minus skills of 1.–2. klasse (doubles, halves, addTo20, subTo20,
// addSub20Simple, tens100, add100NoCarry, sub100NoBorrow, add100Carry, sub100Borrow, addSub1000Round).
// A fact's answer is read from its id and from what the child gets — the recorded or composed question
// ("Hvad er otte plus fem?", "Hvad er det dobbelte af seks?"), the equation on the card, the pile to
// share — and all must agree with the task. Wrong answers follow pædagogik §3.2, with the column
// arithmetic done here digit by digit (not with the skills' calc.ts). The registry skips *.oracle.ts
// files, so none of this reaches the app.
import type { MisconceptionId, Prompt, SkillId, Task } from '../../types'
import { spokenText } from '../number/number.oracle'
import { after, numberAfter, numbersIn, swapTO, type Why } from '../number/number2.oracle'

export type AddSub2Skill = Extract<SkillId,
  'doubles' | 'halves' | 'addTo20' | 'subTo20' | 'addSub20Simple' | 'tens100' | 'add100NoCarry' | 'sub100NoBorrow' |
  'add100Carry' | 'sub100Borrow' | 'addSub1000Round'>

/** One question: a ± b (doubles: a + a; halves: n : 2, written as the whole n). */
export interface Sum {
  skill: AddSub2Skill
  a: number
  b: number
  op: '+' | '−' | 'dbl' | 'hlf'
  answer: number
  family: string
}

// ─── Columns, digit by digit ────────────────────────────────────────────────

/** The digits of a number, ones first: 538 → [8, 3, 5]. */
const columnsOf = (n: number): number[] => String(n).split('').reverse().map(Number)
const fromColumns = (cols: readonly number[]): number => cols.reduce((sum, d, i) => sum + d * 10 ** i, 0)
const width = (a: number, b: number) => Math.max(String(a).length, String(b).length)
const col = (n: number, i: number) => columnsOf(n)[i] ?? 0

/** Does any column of a + b make ten or more (counting a carry in)? */
export function carries(a: number, b: number): boolean[] {
  const out: boolean[] = []
  let carry = 0
  for (let i = 0; i < width(a, b); i++) {
    const s = col(a, i) + col(b, i) + carry
    out.push(s >= 10)
    carry = s >= 10 ? 1 : 0
  }
  return out
}

/**
 * pædagogik §3.2 forgotCarry (38 + 45 → 73, 8 + 5 → 3): the ten a column makes is not carried on. The
 * leading column is written as it is (67 + 58 → 115; 72 + 51 has nothing to forget, its tens are
 * just written as 12), and two one-digit numbers lose the filled ten (8 + 5 → 3). Null when nothing
 * is carried, or forgetting gives the answer.
 */
export function forgotCarry(a: number, b: number): number | null {
  if (a < 10 && b < 10) return a + b >= 10 ? a + b - 10 : null
  const w = width(a, b)
  const digits: number[] = []
  for (let i = 0; i < w; i++) {
    const s = col(a, i) + col(b, i)
    // a column's own sum, without the carry from the right; the last column keeps its whole sum
    digits.push(i === w - 1 ? s : s % 10)
  }
  const v = digits.reduce((sum, d, i) => sum + d * 10 ** i, 0)
  return v === a + b ? null : v
}

/** pædagogik §3.2 smallerFromLarger: each column the smaller digit from the larger (53 − 27 → 34, 13 − 5 → 12). */
export function smallerFromLarger(a: number, b: number): number {
  return fromColumns(Array.from({ length: width(a, b) }, (_, i) => Math.abs(col(a, i) - col(b, i))))
}

/** pædagogik §3.2 borrowNoDecrement: a column borrows ten, the next is never lowered (53 − 27 → 36, 13 − 5 → 18). */
export function borrowNoDecrement(a: number, b: number): number {
  return fromColumns(Array.from({ length: width(a, b) }, (_, i) => (col(a, i) >= col(b, i) ? col(a, i) - col(b, i) : 10 + col(a, i) - col(b, i))))
}

/** SPEC §4.2 digitComplement10: 100 − TO, each digit to ten (100 − 37 → 73); only for a two-digit TO with ones. */
export function digitComplement10(a: number, b: number): number | null {
  if (a !== 100 || b < 11 || b > 99 || b % 10 === 0) return null
  return 10 * (10 - Math.floor(b / 10)) + (10 - (b % 10))
}

// ─── Fact ids ───────────────────────────────────────────────────────────────

const PREFIX: Readonly<Record<AddSub2Skill, string>> = {
  doubles: 'dbl', halves: 'hlf', addTo20: 'add', subTo20: 'sub', addSub20Simple: 'as20', tens100: 't100',
  add100NoCarry: 'a100', sub100NoBorrow: 's100', add100Carry: 'a100c', sub100Borrow: 's100b', addSub1000Round: 'r1000',
}

/** CONVENTIONS' id formats: dbl:<a>, hlf:<n>, add:<a>+<b>, sub:<a>-<b>; the procedure skills <prefix>:<a>±<b>. */
export const idShape = (skill: AddSub2Skill): RegExp =>
  skill === 'doubles' ? /^dbl:\d+$/ : skill === 'halves' ? /^hlf:\d+$/ : new RegExp(`^${PREFIX[skill]}:\\d+[+-]\\d+$`)

const tens = (n: number) => Math.floor(n / 10) % 10
const ones = (n: number) => n % 10
const twoDigit = (n: number) => n >= 10 && n <= 99

/**
 * The family each instance belongs to, from its numbers alone (pædagogik §1.3), or null when the
 * numbers are no instance of the skill.
 */
function familyOf(skill: AddSub2Skill, a: number, op: '+' | '−', b: number): string | null {
  const s = op === '+' ? a + b : a - b
  switch (skill) {
    case 'addSub20Simple':
      // 12 + 5, 17 − 4, 10 + 6: the ones never cross the ten
      if (op === '+' && (a === 10 || b === 10) && Math.min(a, b) >= 1 && Math.min(a, b) <= 9) return 'tenPlus'
      if (op === '+' && a >= 11 && a <= 19 && b >= 1 && ones(a) + b <= 10) return 'addTeen'
      if (op === '−' && a >= 11 && a <= 19 && b >= 1 && b <= ones(a)) return 'subTeen'
      return null
    case 'tens100':
      if (a % 10 !== 0 || b % 10 !== 0 || a < 10 || b < 10) return null
      return op === '+' ? (s <= 100 ? 'addTens' : null) : b < a && a <= 100 ? 'subTens' : null
    case 'add100NoCarry':
      // no column reaches ten; a two-digit number with ones
      if (op !== '+' || !twoDigit(a) || ones(a) === 0 || carries(a, b).some(Boolean)) return null
      if (b >= 1 && b <= 9) return 'TOplusO'
      if (b % 10 === 0 && b >= 10 && b <= 90) return 'TOplusT0'
      return twoDigit(b) && ones(b) > 0 ? 'TOplusTO' : null
    case 'sub100NoBorrow':
      if (op !== '−' || !twoDigit(a) || ones(a) === 0 || b < 1 || smallerFromLarger(a, b) !== s) return null
      if (b <= 9) return 'TOminusO'
      if (b % 10 === 0 && tens(b) < tens(a)) return 'TOminusT0'
      return twoDigit(b) && ones(b) > 0 && tens(b) < tens(a) ? 'TOminusTO' : null
    case 'add100Carry': {
      if (op !== '+' || !twoDigit(a) || ones(a) === 0 || !carries(a, b)[0] && s <= 100) return null
      if (b >= 1 && b <= 9 && s % 10 === 0) return 'toNextTen'
      if ((b === 9 || b === 19) && s <= 100) return 'nearTen'
      if (s > 100) return twoDigit(b) && ones(b) > 0 && s <= 198 ? 'TOplusTOover100' : null
      if (b >= 2 && b <= 8 && ones(a) + b >= 11) return 'TOplusOcarry'
      return twoDigit(b) && ones(b) > 0 && carries(a, b)[0] ? 'TOplusTOcarry' : null
    }
    case 'sub100Borrow': {
      if (op !== '−' || b < 1 || b >= a || a > 100 || smallerFromLarger(a, b) === s) return null
      if (a % 10 === 0 && a >= 20 && ones(b) >= 1) return 'fromTen'
      if (b === 9 || b === 19) return 'nearTen'
      if (b <= 9) return twoDigit(a) && b >= 2 ? 'TOminusOborrow' : null
      return twoDigit(a) && twoDigit(b) && tens(b) < tens(a) ? 'TOminusTOborrow' : null
    }
    case 'addSub1000Round': {
      const H = (n: number) => n % 100 === 0 && n >= 100
      const HT = (n: number) => n > 100 && n < 1000 && n % 10 === 0 && tens(n) > 0
      if (H(a) && H(b)) return op === '+' ? (s <= 1000 ? 'HplusH' : null) : b < a && a <= 1000 ? 'HminusH' : null
      if (op === '+' && H(a) && a <= 900 && twoDigit(b) && ones(b) > 0) return 'HplusTO'
      if (HT(a) && b % 10 === 0 && b >= 10 && b <= 90) {
        if (op === '−') return tens(b) <= tens(a) ? 'HTminusT' : null
        return tens(a) + tens(b) >= 10 ? (s <= 1000 ? 'HTplusTcarry' : null) : 'HTplusT'
      }
      return null
    }
    default:
      return null
  }
}

/** The question an id stands for, or null when the id is not an instance of the skill. */
export function parseSum(skill: AddSub2Skill, id: string): Sum | null {
  if (skill === 'doubles') {
    const m = /^dbl:(\d+)$/.exec(id)
    const a = m ? Number(m[1]) : NaN
    return a >= 1 && a <= 10 ? { skill, a, b: a, op: 'dbl', answer: 2 * a, family: a <= 5 ? 'to5' : 'to10' } : null
  }
  if (skill === 'halves') {
    const m = /^hlf:(\d+)$/.exec(id)
    const n = m ? Number(m[1]) : NaN
    return n >= 2 && n <= 20 && n % 2 === 0 ? { skill, a: n, b: 2, op: 'hlf', answer: n / 2, family: n <= 10 ? 'to10' : 'to20' } : null
  }
  const m = new RegExp(`^${PREFIX[skill]}:(\\d+)([+-])(\\d+)$`).exec(id)
  if (!m) return null
  const [a, b] = [Number(m[1]), Number(m[3])]
  const op = m[2] === '+' ? '+' : '−'
  const answer = op === '+' ? a + b : a - b
  if (skill === 'addTo20') return op === '+' && a >= 2 && a <= 9 && b >= 2 && b <= 9 && answer >= 11 ? { skill, a, b, op, answer, family: 'bridge10' } : null
  if (skill === 'subTo20') return op === '−' && a >= 11 && a <= 18 && b >= 2 && b <= 9 && answer >= 2 && answer <= 9 ? { skill, a, b, op, answer, family: 'bridge10' } : null
  const family = familyOf(skill, a, op, b)
  return family ? { skill, a, b, op, answer, family } : null
}

// ─── What the child hears and sees ──────────────────────────────────────────

/**
 * The answer from the spoken question: "Hvad er A plus B?", "Hvad er A minus B?", "Hvad er det dobbelte
 * af A?", "Hvad er halvdelen af N?". Null for any other sentence.
 */
export function answerFromSpeech(text: string): number | null {
  const doubled = after(text, 'Hvad er det dobbelte af ')
  if (doubled !== null) {
    const n = numbersIn(doubled)
    return n.length === 1 ? 2 * n[0] : null
  }
  const halved = after(text, 'Hvad er halvdelen af ')
  if (halved !== null) {
    const n = numbersIn(halved)
    return n.length === 1 && n[0] % 2 === 0 ? n[0] / 2 : null
  }
  const rest = after(text, 'Hvad er ')
  if (rest === null || !rest.endsWith('?')) return null
  for (const [word, sign] of [[' plus ', 1], [' minus ', -1]] as const) {
    const parts = rest.slice(0, -1).split(word)
    if (parts.length !== 2) continue
    const [x, y] = [numbersIn(parts[0]), numbersIn(parts[1])]
    if (x.length === 1 && y.length === 1) return x[0] + sign * y[0]
  }
  return null
}

/** The box in a + b = □ or a − b = □, or the share of a pile between two friends. */
export function answerFromPrompt(p: Prompt): number | null {
  if (p.scene === 'share') return p.recipients === 2 && p.total % 2 === 0 ? p.total / 2 : null
  if (p.scene !== 'equation' || p.terms.length !== 5) return null
  const [x, o, y, eq, blank] = p.terms
  if (!('n' in x) || !('op' in o) || !('n' in y) || !('op' in eq) || eq.op !== '=' || !('blank' in blank)) return null
  if (o.op === '+') return x.n + y.n
  return o.op === '−' && x.n >= y.n ? x.n - y.n : null
}

// ─── Wrong answers ──────────────────────────────────────────────────────────

/** The skills where pædagogik §3.2 lists each misconception (wrongOperation: every arithmetic skill). */
const COUNT_FROM_FIRST: readonly AddSub2Skill[] = ['addTo20', 'subTo20']
const FORGOT_CARRY: readonly AddSub2Skill[] = ['addTo20', 'add100Carry', 'addSub1000Round']
const BORROWING: readonly AddSub2Skill[] = ['subTo20', 'sub100Borrow']
const PLACE_MISALIGN: readonly AddSub2Skill[] = ['add100NoCarry', 'add100Carry']
/** tensZero belongs to mulTens in pædagogik; the integrator's brief extends it to whole-ten sums (: 10 and · 10). */
const TENS_ZERO: readonly AddSub2Skill[] = ['tens100', 'addSub1000Round']

/** The numbers the child is given: both numbers of the sum, the number to double, the pile to halve. */
export const givenNumbers = (s: Sum): number[] => (s.op === 'dbl' ? [s.a] : s.op === 'hlf' ? [s.a] : [s.a, s.b])

/** Near misses: ±1, ±2, ±10, and ±100 for a whole hundred. */
const nearSteps = (answer: number): number[] => (answer % 100 === 0 && answer >= 100 ? [1, 2, 10, 100] : [1, 2, 10])

/** Every misconception pædagogik §3.2 explains a value with, for a sum. */
export function misconceptionsFor(s: Sum, v: number): MisconceptionId[] {
  const out: MisconceptionId[] = []
  const { skill, a, b, answer } = s
  if (s.op === 'dbl') {
    // the mix-up of Dobbeltdalen: halving instead of doubling
    if (a % 2 === 0 && v === a / 2) out.push('wrongOperation')
    return out
  }
  if (s.op === 'hlf') {
    if (v === 2 * a) out.push('wrongOperation')
    return out
  }
  const plus = s.op === '+'
  if (v === (plus ? Math.abs(a - b) : a + b) && v !== answer) out.push('wrongOperation')
  if (COUNT_FROM_FIRST.includes(skill) && v === (plus ? answer - 1 : answer + 1)) out.push('countFromFirst')
  if (plus && FORGOT_CARRY.includes(skill) && v === forgotCarry(a, b)) out.push('forgotCarry')
  if (!plus && BORROWING.includes(skill)) {
    if (v === smallerFromLarger(a, b) && v !== answer) out.push('smallerFromLarger')
    if (v === borrowNoDecrement(a, b) && v !== answer) out.push('borrowNoDecrement')
  }
  if (!plus && skill === 'sub100Borrow' && v === digitComplement10(a, b)) out.push('digitComplement10')
  if (plus && PLACE_MISALIGN.includes(skill) && b <= 9 && v === a + 10 * b) out.push('placeMisalign')
  if (TENS_ZERO.includes(skill) && answer > 0 && answer % 10 === 0 && (v === answer / 10 || v === answer * 10)) out.push('tensZero')
  return out
}

/**
 * A wrong answer explained (SPEC §4.1 with A9): the misconceptions above, a number from the question,
 * a near miss, and a typed reversal (the global digitSwap slip, on a keypad answer of 13 or more whose
 * reversal is not on the screen).
 */
export function explainSum(s: Sum, t: Task, v: number | string): Why {
  if (typeof v !== 'number') return { mis: [] }
  const mis = misconceptionsFor(s, v)
  const operand = givenNumbers(s).includes(v)
  const near = nearSteps(s.answer).includes(Math.abs(v - s.answer))
  // a whole ten put on the ones (34 + 20 → 36, 47 − 20 → 45): the mirror of placeMisalign, a plain column slip
  const plain = (s.op === '+' || s.op === '−') && s.b >= 10 && s.b <= 90 && s.b % 10 === 0 && s.a < 100 &&
    v === (s.op === '+' ? s.a + s.b / 10 : s.a - s.b / 10)
  const swap = t.kind === 'keypad' && s.answer >= 13 && v === swapTO(s.answer)
  // a misconception value that is also the typed answer reversed has two explanations: 'ambiguous'
  return { mis: swap && !operand && mis.length > 0 ? [...mis, 'digitSwap'] : mis, operand, near, plain, swap }
}

/** SPEC §2.2 (and the skills' notes): the line a sum is placed on and how close is close enough. */
export function lineFor(s: Sum): { max: number; tolerance: number } {
  if (s.skill === 'add100Carry') return s.family === 'TOplusTOover100' ? { max: 200, tolerance: 10 } : { max: 100, tolerance: 5 }
  return { max: 20, tolerance: 0 }
}

/** The recall skills ask the recorded sentence q.<factId> (SPEC §10.2). */
export const RECALL2: readonly AddSub2Skill[] = ['doubles', 'halves', 'addTo20', 'subTo20']

/** The question as Danish text (for messages). */
export const textOf = (t: Task): string => spokenText(t.speech)

// ─── Strategy hints: what they say must be true ─────────────────────────────

/**
 * Every piece of arithmetic a hint says is true, worked out here: "Otte og to giver ti", "Tretten minus
 * tre giver ti", the hop chain ("Start på otteogtredive. Hop to frem til fyrre. …") landing where it
 * says, the first hop one step from the start, "Hoppene giver tilsammen …", "Så halvdelen af fjorten er
 * syv" — and the hint's last conclusion (a sum, a landing, "Svaret er …", "Det er …") is the answer.
 */
export function hintArithmeticProblems(text: string, answer: number): string[] {
  const out: string[] = []
  let start: number | null = null
  let at: number | null = null
  /** The last number the hint concludes with. */
  let last: number | null = null
  for (const s of text.split(/(?<=[.?!])\s+/)) {
    const bad = (why: string) => out.push(`"${s}" ${why}`)
    const giver = s.split(' giver ')
    if (giver.length === 2) {
      const [left, right] = [numbersIn(giver[0]), numbersIn(giver[1])]
      const want = / minus /.test(giver[0]) ? left[0] - left[1] : left[0] + left[1]
      if (left.length === 2 && right.length === 1) {
        if (want !== right[0]) bad(`is false (${want})`)
        last = right[0]
      }
    }
    const from = numberAfter(s, 'Start på ')
    if (from !== null) [start, at] = [from, from]
    const hop = /^Hop (.+) (frem|tilbage) til (.+)\.$/.exec(s)
    if (hop) {
      const [d, to] = [numbersIn(hop[1]), numbersIn(hop[3])]
      if (at === null || d.length !== 1 || to.length !== 1) bad('is no hop from a start')
      else if (at + (hop[2] === 'frem' ? d[0] : -d[0]) !== to[0]) bad(`lands on ${at + (hop[2] === 'frem' ? d[0] : -d[0])}`)
      at = to.length === 1 ? to[0] : at
      last = at
    }
    for (const [lead, step] of [['Det første hop lander på ', 1], ['Det første hop tilbage lander på ', -1]] as const) {
      const first = numberAfter(s, lead)
      if (first !== null && (start === null || first !== start + step)) bad(`(start ${String(start)})`)
    }
    const sum = numberAfter(s, 'Hoppene giver tilsammen ')
    if (sum !== null) {
      if (start === null || at === null || sum !== at - start) bad(`(hops ${String(start)} → ${String(at)})`)
      last = sum
    }
    const half = /^Så halvdelen af (.+) er (.+)\.$/.exec(s)
    if (half) {
      if (2 * (numbersIn(half[2])[0] ?? NaN) !== numbersIn(half[1])[0]) bad('is false')
      last = numbersIn(half[2])[0] ?? null
    }
    for (const lead of ['Svaret er ', 'Det er ']) {
      const named = numberAfter(s, lead)
      if (named !== null) last = named
    }
  }
  if (last !== null && last !== answer) out.push(`"${text}" concludes ${last}, answer ${answer}`)
  return out
}
