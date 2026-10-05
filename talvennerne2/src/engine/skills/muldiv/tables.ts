// Shared by the times tables and the division of 3. klasse (mul34, mul6to9, div2510, divAll): the recall
// facts, the wrong answers of pædagogik §3.2 and the division strategy — the times table backwards, with
// ":" read "divideret med" (SPEC A19). Clips in src/speech/clips/skills/muldiv3.ts. The registry skips
// this file (no SkillDef default export).
import type { Candidate, Fact, HintVisual, SkillId, SpeechPart, Term } from '../../types'
import { num, say, tagged } from '../number/kit'
import { equationSpeech } from '../../../speech/equation'

// ─── Times tables ───────────────────────────────────────────────────────────

/**
 * Recall facts `mul:<a>x<b>` (smaller factor first, CONVENTIONS) of each table times `others`, family
 * `t<table>`. A product in two of the tables belongs to the bigger one, as in mul2510 (3 · 4 is the
 * 4-table's). The card shows the table's number second, the way the table is said ("seks gange tre"), so
 * the operands are [n, table]. Ranked by table, then by the other factor.
 */
export function tableFacts(skill: SkillId, tables: readonly number[], others: readonly number[]): Fact[] {
  const out = new Map<string, Fact>()
  for (const [ti, t] of [...tables.entries()].reverse()) {
    for (const n of others) {
      const id = `mul:${Math.min(n, t)}x${Math.max(n, t)}`
      if (!out.has(id)) out.set(id, { id, skill, family: `t${t}`, operands: [n, t], answer: n * t, rank: ti * 20 + n })
    }
  }
  return [...out.values()].sort((a, b) => a.rank - b.rank)
}

/** [n, table] as on the card, looked up by id (also for a fact the round screen rebuilt from its task). */
export function factorsOf(byId: ReadonlyMap<string, Fact>, f: Pick<Fact, 'id' | 'skill'>): [number, number] {
  const known = byId.get(f.id)
  if (!known) throw new Error(`not a ${f.skill} fact: ${f.id}`)
  return [known.operands[0], known.operands[1]]
}

/** n · t = □ */
export const timesTerms = (n: number, t: number): Term[] => [{ n }, { op: '·' }, { n: t }, { op: '=' }, { blank: true }]

/**
 * pædagogik §3.2 for the times tables: tableNeighbour — a product from the neighbouring row or column, or
 * a square ((a ± 1) · b, a · (b ± 1), a², b²; never 0); mulAsAdd — a + b; the numbers of the question and
 * near misses (±1). A value with two explanations is 'ambiguous' (A9): 1 · 7 → 1 is 1² and the 1 of the
 * question.
 */
export function timesCandidates(a: number, b: number): Candidate[] {
  const x = a * b
  const neighbours = [(a + 1) * b, a * (b + 1), a * a, b * b, ...(a > 1 ? [(a - 1) * b] : []), ...(b > 1 ? [a * (b - 1)] : [])]
  return tagged(x, [
    ...neighbours.map((v) => [v, 'tableNeighbour'] as const),
    [a + b, 'mulAsAdd'],
    [a, 'operand'], [b, 'operand'],
    [x + 1, 'near'], [x - 1, 'near'],
  ])
}

/** "Fem gange otte giver fyrre." */
export const timesSays = (n: number, t: number): SpeechPart[] => [num(n, 'mid'), say('op.gange'), num(t, 'mid'), say('op.giver'), num(n * t)]

// ─── Division ───────────────────────────────────────────────────────────────

/** Recall facts `div:<c>/<d>` (CONVENTIONS): c = d · q for q = 1–10, family `d<d>`, ranked by divisor, then by q. */
export function divisionFacts(skill: SkillId, divisors: readonly number[]): Fact[] {
  return divisors.flatMap((d, di) =>
    Array.from({ length: 10 }, (_, i) => ({
      id: `div:${d * (i + 1)}/${d}`, skill, family: `d${d}`, operands: [d * (i + 1), d], answer: i + 1, rank: di * 20 + i + 1,
    })),
  )
}

/** c, d and the quotient from the id (also for a fact the round screen rebuilt from its task). */
export function divisionOf(f: Pick<Fact, 'id'>): { c: number; d: number; q: number } {
  const m = /^div:(\d+)\/(\d+)$/.exec(f.id)
  if (!m) throw new Error(`not a division fact: ${f.id}`)
  const c = Number(m[1])
  const d = Number(m[2])
  return { c, d, q: c / d }
}

/** c : d = □ */
export const divisionTerms = (c: number, d: number): Term[] => [{ n: c }, { op: ':' }, { n: d }, { op: '=' }, { blank: true }]

/**
 * pædagogik §3.2 for division: tableNeighbour — the quotient ± 1, when that is still a fact of the table
 * (1–10); wrongOperation — another operation on the two numbers, c − d or c · d (the two dots of ":" read
 * as the one of "·"); the numbers of the question; near misses ± 2. A value with two explanations is
 * 'ambiguous' (A9): 12 : 3 → 3 is the quotient − 1 and the 3 of the question.
 */
export function divisionCandidates(c: number, d: number): Candidate[] {
  const q = c / d
  return tagged(q, [
    ...[q - 1, q + 1].filter((v) => v >= 1 && v <= 10).map((v) => [v, 'tableNeighbour'] as const),
    [c - d, 'wrongOperation'], [c * d, 'wrongOperation'],
    [c, 'operand'], [d, 'operand'],
    ...[q - 2, q + 2].filter((v) => v >= 1).map((v) => [v, 'near'] as const),
  ])
}

/**
 * The times table backwards: "Hvad gange fem giver tyve? Fire gange fem giver tyve. Så giver tyve
 * divideret med fem fire." (op.divideret_med: 3. klasse, SPEC A19).
 */
export function divisionStrategy(c: number, d: number): SpeechPart[] {
  return [...equationSpeech([{ blank: true }, { op: '·' }, { n: d }, { op: '=' }, { n: c }]), ...timesSays(c / d, d), ...soDivided(c, d)]
}

/** "Så giver tyve divideret med fem fire." */
export const soDivided = (c: number, d: number): SpeechPart[] => [say('hint.div.soGives'), num(c, 'mid'), say('op.divideret_med'), num(d, 'mid'), num(c / d)]

/** tableNeighbour: check the answer by multiplying — "Prøv at gange dit svar med fem. Det skal give tyve." */
export const checkByTimes = (c: number, d: number): SpeechPart[] => [say('hint.div.check'), num(d), say('hint.div.shouldGive'), num(c)]

/** The quotient's rows of the divisor: four rows of five for 20 : 5. */
export const divisionArray = (c: number, d: number): HintVisual => ({ scene: 'array', rows: c / d, cols: d })
