// The grown-ups' gate as pure logic (SPEC §8 "Voksen-gate"): a two-digit number times a one-digit
// number, 12–19 · 6–9, written with the house dot. Typing is digits only, at most three of them
// (the largest product is 19 · 9 = 171). A wrong answer always brings a different sum.
import type { Rng } from '../../engine/rng'

export const GATE_FACTOR_A = { min: 12, max: 19 } as const
export const GATE_FACTOR_B = { min: 6, max: 9 } as const
/** Digits the keypad accepts (the answer has two or three). */
export const GATE_MAX_DIGITS = 3

export interface GateProblem {
  a: number
  b: number
  answer: number
}

/** "14 · 7": the multiplication dot, never the cross. */
export function gateText(p: Pick<GateProblem, 'a' | 'b'>): string {
  return `${p.a} · ${p.b}`
}

/** A new sum, never the same as `previous`. */
export function gateProblem(rng: Rng, previous?: Pick<GateProblem, 'a' | 'b'> | null): GateProblem {
  for (;;) {
    const a = rng.between(GATE_FACTOR_A.min, GATE_FACTOR_A.max)
    const b = rng.between(GATE_FACTOR_B.min, GATE_FACTOR_B.max)
    if (previous && previous.a === a && previous.b === b) continue
    return { a, b, answer: a * b }
  }
}

/** The entry after one key: a digit is appended (no leading zero, at most three), 'del' removes one. */
export function gateKey(entry: string, key: string): string {
  if (key === 'del') return entry.slice(0, -1)
  if (!/^\d$/.test(key)) return entry
  if (entry.length >= GATE_MAX_DIGITS) return entry
  if (entry === '' && key === '0') return entry
  return entry + key
}

export function gateSolved(p: GateProblem, entry: string): boolean {
  return entry !== '' && Number(entry) === p.answer
}
