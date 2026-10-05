// Independent oracles for gange og division in 3. klasse (mul34, mul6to9, div2510, divAll, mulTens), ORK3a.
// Written by another agent than the generators (SPEC A5, §15.1): which products and quotients each skill
// owns is worked out from SPEC §2.2 and pædagogik §1.3 (the small table is the tables 2–10 times 1–10;
// 2-, 5- and 10-table in mul2510, the rest of the 3- and 4-table in mul34, the rest of the 6–9-tables in
// mul6to9; a product in two tables belongs to the bigger one), the right answer from the fact id and the
// card, the wrong answers from pædagogik §3.2's formulas — tableNeighbour (a ± 1)·b, a·(b ± 1), a², b² and,
// for division, the quotient ± 1; mulAsAdd a + b; wrongOperation the other operation on the two numbers;
// tensZero the zero lost or doubled — and classified by SPEC §4.1 with A9 and A11 (addsub3.oracle.ts).
// The registry skips *.oracle.ts files, so none of this reaches the app.
import type { MisconceptionId, SkillId, Task } from '../../types'
import type { Why } from '../addsub/addsub3.oracle'
import { mulMis } from './muldiv.oracle'

// ─── The small table and who owns each product ─────────────────────────────

/** The times-table skills in the order a child meets them, each with its tables (SPEC §2.2). */
export const TABLE_SKILLS: readonly { skill: SkillId; tables: readonly number[] }[] = [
  { skill: 'mul2510', tables: [2, 5, 10] },
  { skill: 'mul34', tables: [3, 4] },
  { skill: 'mul6to9', tables: [6, 7, 8, 9] },
]

/** The products of the small table: the tables 2–10 times 1–10, as ids mul:<a>x<b>, smaller factor first (54). */
export function smallTable(): Set<string> {
  const out = new Set<string>()
  for (let t = 2; t <= 10; t++) for (let n = 1; n <= 10; n++) out.add(`mul:${Math.min(n, t)}x${Math.max(n, t)}`)
  return out
}

/** The skill that owns a · b — the first that has one of the factors as a table — and its family t<table> (the biggest). */
export function mulOwner(a: number, b: number): { skill: SkillId; table: number } | null {
  for (const { skill, tables } of TABLE_SKILLS) {
    const own = tables.filter((t) => t === a || t === b)
    if (own.length > 0) return { skill, table: Math.max(...own) }
  }
  return null
}

export interface MulFact {
  a: number
  b: number
  answer: number
  skill: SkillId
  table: number
}

/** mul:<a>x<b> (1 ≤ a ≤ b ≤ 10, a product of the small table) → its owner, family table and product. */
export function mulFactOf(id: string): MulFact | null {
  const m = /^mul:([1-9]|10)x([1-9]|10)$/.exec(id)
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2])
  const owner = mulOwner(a, b)
  return a <= b && owner ? { a, b, answer: a * b, ...owner } : null
}

// ─── Division ───────────────────────────────────────────────────────────────

/** The divisions of the small table: c : d for d = 2–10 and q = 1–10, as ids div:<c>/<d> (90). */
export function smallDivisions(): Set<string> {
  const out = new Set<string>()
  for (let d = 2; d <= 10; d++) for (let q = 1; q <= 10; q++) out.add(`div:${d * q}/${d}`)
  return out
}

export interface DivFact {
  c: number
  d: number
  q: number
  skill: SkillId
}

/** div:<c>/<d> → the quotient and its owner: divisor 2, 5 or 10 in div2510, 3, 4, 6–9 in divAll. */
export function divFactOf(id: string): DivFact | null {
  const m = /^div:(\d+)\/(\d+)$/.exec(id)
  if (!m || String(Number(m[1])) !== m[1]) return null
  const c = Number(m[1])
  const d = Number(m[2])
  const q = c / d
  if (d < 2 || d > 10 || !Number.isInteger(q) || q < 1 || q > 10) return null
  return { c, d, q, skill: [2, 5, 10].includes(d) ? 'div2510' : 'divAll' }
}

/**
 * pædagogik §3.2 for division: tableNeighbour — the quotient ± 1 while it is still a quotient of the small
 * table (1–10); wrongOperation — the other operation on the two numbers (c · d) or ":" read as minus
 * (c − d, as wave 2's inverseOps oracle accepts it).
 */
export function divMis(c: number, d: number): [number, MisconceptionId][] {
  const q = c / d
  const out: [number, MisconceptionId][] = [
    ...[q - 1, q + 1].filter((v) => v >= 1 && v <= 10).map((v) => [v, 'tableNeighbour'] as [number, MisconceptionId]),
    [c * d, 'wrongOperation'], [c - d, 'wrongOperation'],
  ]
  return out.filter(([v]) => v !== q && v >= 0)
}

export const explainDiv = (c: number, d: number, v: number): Why => ({
  mis: [...new Set(divMis(c, d).filter(([x]) => x === v).map(([, m]) => m))],
  operand: v === c || v === d,
})

/** The times tables' wrong answers on the card n · t (pædagogik §3.2, wave 2's formulas). */
export const explainTimes = (n: number, t: number, v: number): Why => ({
  mis: [...new Set(mulMis(n, t).filter(([x]) => x === v).map(([, m]) => m))],
  operand: v === n || v === t,
})

// ─── mulTens ────────────────────────────────────────────────────────────────

export interface TensFact {
  family: 'oneDigitTimesTens' | 'tensTimesOneDigit'
  /** The factors as on the card, the one-digit factor and the whole ten. */
  first: number
  second: number
  a: number
  T: number
  answer: number
}

const isTen = (n: number) => n >= 20 && n <= 90 && n % 10 === 0
const isSmall = (n: number) => n >= 2 && n <= 5

/** mt:<a>x<T> (oneDigitTimesTens) · mt:<T>x<a> (tensTimesOneDigit), a = 2–5 and T = 20–90 whole tens (SPEC §2.2, pædagogik §1.3). */
export function tensFactOf(id: string): TensFact | null {
  const m = /^mt:(\d+)x(\d+)$/.exec(id)
  if (!m) return null
  const first = Number(m[1])
  const second = Number(m[2])
  if (String(first) !== m[1] || String(second) !== m[2]) return null
  if (isSmall(first) && isTen(second)) return { family: 'oneDigitTimesTens', first, second, a: first, T: second, answer: first * second }
  if (isTen(first) && isSmall(second)) return { family: 'tensTimesOneDigit', first, second, a: second, T: first, answer: first * second }
  return null
}

/** Every mulTens instance of a family (32 each). */
export function allTens(family: TensFact['family']): Set<string> {
  const out = new Set<string>()
  for (let a = 2; a <= 5; a++) for (let T = 20; T <= 90; T += 10) out.add(family === 'oneDigitTimesTens' ? `mt:${a}x${T}` : `mt:${T}x${a}`)
  return out
}

/**
 * pædagogik §3.2 for whole tens: tensZero — the zero lost or one too many (3 · 40 → 12, 1200); mulAsAdd —
 * a + T (43); tableNeighbour — a neighbouring small fact with its zero: (a ± 1) · T and a · (T ± 10)
 * (3 · 40 → 80, 160, 90, 150).
 */
export function tensMis(a: number, T: number): [number, MisconceptionId][] {
  const x = a * T
  const out: [number, MisconceptionId][] = [
    [x / 10, 'tensZero'], [x * 10, 'tensZero'], [a + T, 'mulAsAdd'],
    ...[(a + 1) * T, (a - 1) * T, a * (T + 10), a * (T - 10)].map((v) => [v, 'tableNeighbour'] as [number, MisconceptionId]),
  ]
  return out.filter(([v]) => v !== x && v > 0)
}

export const explainTens = (q: TensFact, v: number): Why => ({
  mis: [...new Set(tensMis(q.a, q.T).filter(([x]) => x === v).map(([, m]) => m))],
  operand: v === q.first || v === q.second,
})

/** The card of a times or division task: n op m = □. */
export function cardOf(t: Task): { x: number; op: string; y: number } | null {
  const p = t.prompt
  if (p.scene !== 'equation' || p.terms.length !== 5) return null
  const [x, op, y, eq, blank] = p.terms
  if (!('n' in x) || !('op' in op) || !('n' in y) || !('op' in eq) || eq.op !== '=' || !('blank' in blank)) return null
  return { x: x.n, op: op.op, y: y.n }
}
