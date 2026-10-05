// Independent oracle for convertCmM (Centimeter og meter, 3. klasse), ORK3c. Written by another agent than the
// generator (SPEC A5, §15.1): every right answer is worked out here from what the child is given — the card's
// lengths with their unit words, the question as said ("Hvor mange centimeter er to meter og fem centimeter?") —
// and from 1 m = 100 cm, never from the generator code. Wrong answers are explained with pædagogik §3.2's formulas
// as SPEC §4.2 gives them, carried over to lengths:
//   tensZero           "nul droppet eller ekstra nul" (3 · 40 → 12 or 1200): a meter taken as ten centimeter or as a
//                      thousand — 3 m → 30 or 3000, 2 m 35 cm → 55 or 2035, 235 cm → 23 whole meters (the extra
//                      zero there is 0 m, which says nothing: a child who is lost types 0)
//   zeroPlaceholder    "304 → 34 eller 340": 2 m 5 cm written without the tens' zero (25) or with it moved (250)
//   digitComplement10  "100 − 37 → 73": a meter minus 37 cm made up digit by digit (from one meter only, as change
//                      from100 and missingPart100 toHundred)
//   wrongOperation     "modsat regneart": the lengths added when the question asks how much longer
// and SPEC §4.1 with A9 (a number on the card) and A11 (the typed answer with its tens and ones swapped).
// The registry skips *.oracle.ts files, so none of this reaches the app.
import type { MisconceptionId, Prompt } from '../../types'
import { numbersIn } from '../number/number2.oracle'
import { digitComplement } from '../algebra/algebra2.oracle'
import type { WhyC } from '../clock/clock3.oracle'

export type CmFamily = 'mToCm' | 'mCmToCm' | 'cmToMCm' | 'compareMixed'

export interface CmQ {
  family: CmFamily
  /** Meters (mToCm, mCmToCm, compareMixed) or centimeter (cmToMCm). */
  a: number
  /** The centimeter beside the meters (mCmToCm, compareMixed), else 0. */
  c: number
}

/**
 * cmm:mToCm:<m> (1–9 m) · cmm:mCmToCm:<m>:<c> (1–9 m and 1–99 cm) · cmm:cmToMCm:<n> (100–999 cm) ·
 * cmm:compareMixed:<m>:<c> (one or two meters against 1–99 cm): pædagogik §1.3's four families.
 */
export function cmOf(id: string): CmQ | null {
  const m = /^cmm:(mToCm|mCmToCm|cmToMCm|compareMixed):(\d+)(?::(\d+))?$/.exec(id)
  if (!m) return null
  const family = m[1] as CmFamily
  const a = Number(m[2])
  const c = m[3] === undefined ? null : Number(m[3])
  switch (family) {
    case 'mToCm': return c === null && a >= 1 && a <= 9 ? { family, a, c: 0 } : null
    case 'cmToMCm': return c === null && a >= 100 && a <= 999 ? { family, a, c: 0 } : null
    case 'mCmToCm': return c !== null && a >= 1 && a <= 9 && c >= 1 && c <= 99 ? { family, a, c } : null
    case 'compareMixed': return c !== null && a >= 1 && a <= 2 && c >= 1 && c <= 99 ? { family, a, c } : null
  }
}

/** 1 m = 100 cm: the centimeter of a meter count, the whole meters of a centimeter count, how much longer. */
export function cmAnswer(q: CmQ): number {
  switch (q.family) {
    case 'mToCm': return 100 * q.a
    case 'mCmToCm': return 100 * q.a + q.c
    case 'cmToMCm': return Math.floor(q.a / 100)
    case 'compareMixed': return 100 * q.a - q.c
  }
}

/** The numbers written on the card (what A9 calls a number from the question). */
export function cmCardNumbers(q: CmQ): number[] {
  if (q.family === 'cmToMCm') return q.a % 100 ? [q.a, q.a % 100] : [q.a]
  return q.family === 'mToCm' ? [q.a] : [q.a, q.c]
}

/** pædagogik §3.2's formulas for a conversion, worked out: each value with the misconception it comes from. */
export function cmMis(q: CmQ): [number, MisconceptionId][] {
  const out: [number, MisconceptionId][] = []
  switch (q.family) {
    case 'mToCm':
      out.push([10 * q.a, 'tensZero'], [1000 * q.a, 'tensZero'])
      break
    case 'mCmToCm':
      out.push([10 * q.a + q.c, 'tensZero'], [1000 * q.a + q.c, 'tensZero'])
      if (q.c < 10) out.push([10 * q.a + q.c, 'zeroPlaceholder'], [100 * q.a + 10 * q.c, 'zeroPlaceholder'])
      break
    case 'cmToMCm':
      out.push([Math.floor(q.a / 10), 'tensZero'])
      break
    case 'compareMixed': {
      out.push([100 * q.a + q.c, 'wrongOperation'])
      const dc = q.a === 1 ? digitComplement(q.c) : null
      if (dc !== null) out.push([dc, 'digitComplement10'])
      break
    }
  }
  return out.filter(([v]) => v !== cmAnswer(q))
}

export function explainCm(q: CmQ, v: number): WhyC {
  return { mis: [...new Set(cmMis(q).filter(([x]) => x === v).map(([, m]) => m))], operand: cmCardNumbers(q).includes(v) }
}

const UNIT_CLIP: Readonly<Record<string, 'm' | 'cm'>> = { 'noun.unit.m.end': 'm', 'noun.unit.cm.end': 'cm' }

/**
 * The card as the child reads it: lengths (a number and its unit word) on each side of '=', a '−' between two
 * lengths, the blank with its unit. The blank solved in centimeter: "2 m 35 cm = □ cm" → 235; "235 cm = □ m 35 cm"
 * → 2; "1 m − 37 cm = □ cm" → 63. Null when the card is not such an equation or the blank has no single answer.
 */
export function cardCm(p: Prompt): { answer: number; blankUnit: 'm' | 'cm'; units: ('m' | 'cm')[] } | null {
  if (p.scene !== 'equation') return null
  const sides: { cm: number; blank: 'm' | 'cm' | null; sign: 1 | -1 }[] = [{ cm: 0, blank: null, sign: 1 }]
  const units: ('m' | 'cm')[] = []
  let pending: number | 'blank' | null = null
  for (const term of p.terms) {
    const side = sides[sides.length - 1]
    if ('n' in term) {
      if (pending !== null) return null
      pending = term.n
    } else if ('blank' in term) {
      if (pending !== null) return null
      pending = 'blank'
    } else if ('text' in term) {
      const unit = UNIT_CLIP[term.text]
      if (!unit || pending === null) return null
      units.push(unit)
      if (pending === 'blank') {
        if (side.blank !== null) return null
        side.blank = unit
      } else side.cm += side.sign * pending * (unit === 'm' ? 100 : 1)
      pending = null
    } else if (term.op === '=') {
      if (pending !== null || sides.length > 1) return null
      sides.push({ cm: 0, blank: null, sign: 1 })
    } else if (term.op === '−') {
      if (pending !== null) return null
      side.sign = -1
    } else return null
  }
  if (pending !== null || sides.length !== 2) return null
  const [left, right] = sides
  const holder = right.blank !== null ? right : left
  const other = holder === right ? left : right
  if (left.blank !== null && right.blank !== null) return null
  if (holder.blank === null) return null
  const per = holder.blank === 'm' ? 100 : 1
  const rest = other.cm - holder.cm
  // whole meters: the rest written beside the blank is under a meter, so one number fits
  if (rest < 0 || rest % per !== 0) return null
  return { answer: rest / per, blankUnit: holder.blank, units }
}

/**
 * The question as the child hears it: "Hvor mange centimeter er to meter og fem centimeter?" · "Hvor mange hele meter
 * er to hundrede og femogtredive centimeter?" · "Hvor mange centimeter længere er en meter end syvogtredive
 * centimeter?" → the answer, worked out from the lengths said.
 */
export function heardCm(text: string): number | null {
  const lengths = (s: string): number | null => {
    let cm = 0
    let found = false
    for (const m of s.matchAll(/([a-zæøå ]+?) (meter|centimeter)(?= og |$| end )/g)) {
      const n = numbersIn(m[1])
      if (n.length !== 1) return null
      cm += n[0] * (m[2] === 'meter' ? 100 : 1)
      found = true
    }
    return found ? cm : null
  }
  let m = /^Hvor mange centimeter længere er (.+) end (.+)\?$/.exec(text)
  if (m) {
    const [x, y] = [lengths(m[1]), lengths(m[2])]
    return x !== null && y !== null && x > y ? x - y : null
  }
  m = /^Hvor mange hele meter er (.+)\?$/.exec(text)
  if (m) {
    const x = lengths(m[1])
    return x === null ? null : Math.floor(x / 100)
  }
  m = /^Hvor mange centimeter er (.+)\?$/.exec(text)
  return m ? lengths(m[1]) : null
}
