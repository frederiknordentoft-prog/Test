// Independent oracles for gange og division in 2. klasse (groupsOf, mul2510, shareEqually), ORK2c.
// Written by another agent than the generators (SPEC A5, §15.1): the right answer is worked out from the
// fact id, the picture (groups, the card, the pile and the animals) and the spoken question; the wrong
// answers from pædagogik §3.2's formulas (mulAsAdd a + b, tableNeighbour (a ± 1)·b, a·(b ± 1), a², b²;
// wrongOperation for sharing), classified by SPEC §4.1 with A9 and A11 (algebra2.oracle.ts). The share
// view is simulated as the child uses it: every way to deal the whole pile. The registry skips
// *.oracle.ts files, so none of this reaches the app.
import type { AnswerValue, MisconceptionId } from '../../types'
import type { Expl } from '../algebra/algebra2.oracle'

// ─── groupsOf: g groups of s ───────────────────────────────────────────────

/** grp:<g>x<s> (g groups of s, g, s = 2–5; the order is the picture, so 3 of 4 and 4 of 3 are two facts). */
export function groupsOfId(id: string): { g: number; s: number; answer: number } | null {
  const m = /^grp:(\d+)x(\d+)$/.exec(id)
  if (!m) return null
  const g = Number(m[1])
  const s = Number(m[2])
  return g >= 2 && g <= 5 && s >= 2 && s <= 5 ? { g, s, answer: g * s } : null
}

/** pædagogik §3.2 mulAsAdd ("3 grupper med 4 → 7"): the two numbers added. */
export const explainGroups = (g: number, s: number, v: AnswerValue): Expl => ({ mis: v === g + s ? ['mulAsAdd'] : [], operand: v === g || v === s })

// ─── mul2510: the 2-, 5- and 10-table ──────────────────────────────────────

export const TABLES = [2, 5, 10] as const

/** The table a product belongs to: the biggest of 2, 5, 10 that is one of its factors (2 · 5 is the 5-table's). */
export function tableOf(a: number, b: number): number | null {
  const own = TABLES.filter((t) => t === a || t === b)
  return own.length > 0 ? Math.max(...own) : null
}

/** Every product of the three tables with factors 1–10, smallest factor first (CONVENTIONS mul:<a>x<b>). */
export function mul2510Ids(): Set<string> {
  const out = new Set<string>()
  for (const t of TABLES) for (let n = 1; n <= 10; n++) out.add(`mul:${Math.min(n, t)}x${Math.max(n, t)}`)
  return out
}

/** mul:<a>x<b> → the factors, the table (family t<table>) and the product. */
export function mulId(id: string): { a: number; b: number; table: number; answer: number } | null {
  const m = /^mul:(\d+)x(\d+)$/.exec(id)
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2])
  const table = tableOf(a, b)
  return a <= b && b <= 10 && a >= 1 && table !== null ? { a, b, table, answer: a * b } : null
}

/**
 * pædagogik §3.2: tableNeighbour — a product from the neighbouring row or column, or a square ((a ± 1)·b,
 * a·(b ± 1), a², b²; never 0); mulAsAdd — a + b.
 */
export function mulMis(a: number, b: number): [number, MisconceptionId][] {
  const neighbours = [(a + 1) * b, (a - 1) * b, a * (b + 1), a * (b - 1), a * a, b * b].filter((v) => v > 0)
  return [...neighbours.map((v) => [v, 'tableNeighbour'] as [number, MisconceptionId]), [a + b, 'mulAsAdd']]
}

export function explainMul(a: number, b: number, v: AnswerValue): Expl {
  return { mis: [...new Set(mulMis(a, b).filter(([x]) => x === v).map(([, m]) => m))], operand: v === a || v === b }
}

// ─── shareEqually: share a pile between animals ────────────────────────────

/** shr:<total>:<g> (g = 2–5 animals, 1–5 each) → each animal's share. */
export function shareId(id: string): { total: number; g: number; answer: number } | null {
  const m = /^shr:(\d+):(\d+)$/.exec(id)
  if (!m) return null
  const total = Number(m[1])
  const g = Number(m[2])
  const q = total / g
  return g >= 2 && g <= 5 && Number.isInteger(q) && q >= 1 && q <= 5 ? { total, g, answer: q } : null
}

/** wrongOperation on sharing (another operation on the two numbers: 12 between 3 → 9 or 15). */
export const explainShare = (total: number, g: number, v: AnswerValue): Expl => ({
  mis: v === total - g || v === total + g ? ['wrongOperation'] : [],
  operand: v === total || v === g,
})

/**
 * Every way the share view can be handed in (SPEC §3.2: the tick comes when the pile is empty): each
 * deal of `total` things on `plates` plates reports the count every plate got when they are all the
 * same, else −1. Returns the distinct values, with how many deals give each.
 */
export function shareOutcomes(total: number, plates: number): Map<number, number> {
  const out = new Map<number, number>()
  const deal = (left: number, plate: number, counts: number[]) => {
    if (plate === plates - 1) {
      const all = [...counts, left]
      const v = all.every((c) => c === all[0]) ? all[0] : -1
      out.set(v, (out.get(v) ?? 0) + 1)
      return
    }
    for (let c = 0; c <= left; c++) deal(left - c, plate + 1, [...counts, c])
  }
  deal(total, 0, [])
  return out
}
