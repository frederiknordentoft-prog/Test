// Independent oracles for the plus and minus skills of 3. klasse (add1000, sub1000), ORK3a, and the small
// wave-3 kit the muldiv3 oracle shares: a strict classification check over every value a card or the keys
// can give (four keys: 999 − 7 typed as 1006 is wrongOperation), the opportunities those values make, and a
// simulated child who keeps one misconception — worked out from the card by the oracle's own formulas, not
// from the generator's tags — through the real diagnostics (SPEC §4.3).
//
// Written by another agent than the generators (SPEC A5, §15.1): the right answers come from the fact id
// and the card, the families from the contract's words (SPEC §2.2, pædagogik §1.3, the module headers), the
// wrong answers from pædagogik §3.2's formulas worked out column by column, and the column walk — what the
// hint says and what the borrow film writes above the columns — from the written algorithm a child uses
// (ones first; a column that is too small takes ten from the nearest column to its left that has
// something, and a zero in between gets ten and gives one on). The registry skips *.oracle.ts files.
import type { AnswerLogEntry, AnswerValue, ErrorTag, Fact, MisconceptionId, SkillDef, SkillId, Task, TaskKind } from '../../types'
import { classifyAnswer, detectableOf, flaggedIds, updateMisconceptions, type MisconceptionStates } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { isProduction } from '../../kinds'
import { hashSeed, makeRng } from '../../rng'
import { keysForNode } from '../../registry'
import { NODE_BY_ID } from '../../../content/curriculum'
import type { ColumnPlan } from '../../../ui/hint/Columns'
import type { Built } from '../number/number.oracle'
import { isMis, sentences, spokenTokens, statementTrue, typedSwapOf } from '../algebra/algebra2.oracle'

// ═══ The wave-3 kit (ORK3a) ═══════════════════════════════════════════════════

/** 200 seeded instances per family, from the oracle's own seeds (SPEC §15.1). */
export function instances3(def: SkillDef, perFamily = 200): Map<string, Fact[]> {
  const out = new Map<string, Fact[]>()
  for (const fam of def.families) {
    const rng = makeRng(hashSeed(`ork3a:${def.id}/${fam.id}`))
    out.set(fam.id, Array.from({ length: perFamily }, () => def.instance!(fam, rng, new Set())))
  }
  return out
}

/**
 * Draws with a growing avoid set (SPEC §5.1: a new instance avoids the ones already asked): the distinct
 * ids `n` draws give. A family with at least `n` instances must give `n` different ones.
 */
export function freshDraws(def: SkillDef, family: string, n: number): string[] {
  const fam = def.families.find((f) => f.id === family)!
  const rng = makeRng(hashSeed(`ork3a-fresh:${def.id}/${family}`))
  const seen = new Set<string>()
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const f = def.instance!(fam, rng, seen)
    out.push(f.id)
    seen.add(f.id)
  }
  return out
}

/** What explains a wrong value: the misconceptions it fits and whether it is a number from the question. */
export interface Why {
  mis: readonly MisconceptionId[]
  operand: boolean
}

/** A number explanation as the wave-2 kit takes it (any value; a token is explained by nothing). */
export const onNumbers = (why: (b: Built, v: number) => Why) => (b: Built, v: AnswerValue): Why =>
  typeof v === 'number' ? why(b, v) : { mis: [], operand: false }

/**
 * The tag SPEC §4.1 gives a wrong value, strictly: two misconceptions are 'ambiguous'; one is its own tag
 * unless it is also a number from the question (A9) or the typed answer with its tens and ones swapped
 * where a swap can happen (A11) — then 'ambiguous'; a number from the question alone is 'operand'; the
 * typed swap alone is 'digitSwap' (globalChecks); anything else is plain ('near' or 'other': the skill
 * lists its own near misses, and plain tags are never evidence).
 */
export function want3(t: Task, v: AnswerValue, why: Why): ErrorTag | 'plain' {
  const mis = [...new Set(why.mis)]
  const swap = typeof v === 'number' && typedSwapOf(t) === v
  if (mis.length > 1) return 'ambiguous'
  if (mis.length === 1) return why.operand || swap ? 'ambiguous' : mis[0]
  if (why.operand) return 'operand'
  if (swap) return 'digitSwap'
  return 'plain'
}

/** Every value the child can hand in on a task that the oracle cares about (the rest are plain by construction). */
function valuesOf(b: Built, specials: readonly number[]): number[] {
  const t = b.task
  if (t.kind === 'choice' || t.kind === 'pair') return t.options.filter((o): o is number => typeof o === 'number')
  if (t.kind === 'share') return typeof t.answer === 'number' ? [t.answer, -1] : [-1]
  if (t.kind !== 'keypad') return []
  const top = 10 ** t.maxDigits - 1
  const swap = typedSwapOf(t)
  const all = [...specials, ...Object.keys(t.distractorTags).map(Number), ...(swap !== null ? [swap] : [])]
  return [...new Set(all)].filter((v) => Number.isInteger(v) && v >= 0 && v <= top)
}

/**
 * classifyAnswer against want3 for every card, the share view's two hand-ins, and every value the keys take
 * that the skill tags or the oracle explains (a value neither knows is 'other' or the typed swap, which the
 * oracle's specials include): so this is the whole keypad, 0 up to what its digits take.
 */
export function classify3(built: readonly Built[], why: (b: Built, v: number) => Why, specials: (b: Built) => readonly number[]): string[] {
  const out = new Set<string>()
  for (const b of built) {
    const t = b.task
    for (const v of valuesOf(b, specials(b))) {
      if (isCorrect(t, v)) {
        if (classifyAnswer(t, v) !== null) out.add(`${t.factId} ${t.kind} ${v}: right, classified ${classifyAnswer(t, v)}`)
        continue
      }
      const got = classifyAnswer(t, v)
      if (t.kind === 'share') {
        if (v === -1 && got !== 'shareUnequal') out.add(`${t.factId} share −1: ${got}, expected shareUnequal`)
        continue
      }
      const want = want3(t, v, why(b, v))
      const where = `${t.factId} ${t.kind} ${v} (answer ${String(t.answer)})`
      if (got === null) out.add(`${where}: classified as right`)
      else if (want === 'plain') {
        if (got !== 'near' && got !== 'other') out.add(`${where}: ${got}, the oracle has a plain error`)
      } else if (got !== want) out.add(`${where}: ${got}, expected ${want}`)
    }
  }
  return [...out]
}

/**
 * SPEC §4.3 "Mulighed": exactly the misconceptions some value the task takes can show (a card dealt, a
 * number the keys take, a deal of the pile), and the typed digit swap where one can happen.
 */
export function detectable3(built: readonly Built[], why: (b: Built, v: number) => Why, specials: (b: Built) => readonly number[]): string[] {
  const out = new Set<string>()
  for (const b of built) {
    const t = b.task
    const want = new Set<MisconceptionId>()
    if (t.kind !== 'share') {
      for (const v of valuesOf(b, specials(b))) {
        if (isCorrect(t, v)) continue
        const tag = want3(t, v, why(b, v))
        if (isMis(tag)) want.add(tag)
      }
    }
    const got = new Set(detectableOf(t))
    const show = (s: Set<MisconceptionId>) => [...s].sort().join(',') || '∅'
    if (show(got) !== show(want)) out.add(`${t.factId} ${t.kind} [${t.options.join(', ')}]: detectable ${show(got)}, the oracle ${show(want)}`)
  }
  return [...out]
}

// ─── A child through the real diagnostics (SPEC §4.3) ──────────────────────

/** What a simulated child hands in on a task (the task index for seeded choices). */
export type Child = (t: Task, i: number) => AnswerValue

export interface Simulation {
  /** Misconceptions flagged at any point, with the answer count when each was first flagged. */
  flagged: Map<MisconceptionId, number>
}

/**
 * Answers to the real pipeline: tasks from the node's keys for one skill (planned afresh every ten tasks,
 * as a round does), a seeded key and kind per task, the child's answer classified, logged and folded into
 * the misconception states. `accuracy: 'real'` gives the diagnostics the child's own first-try accuracy
 * over the last 20 answers (SPEC §4.3 rule 6: choice evidence is ignored below 40 %); a number fixes it
 * (0.7 never ignores a card, the harder test for a guesser).
 */
export function simulate(
  node: string,
  skill: SkillId,
  child: Child,
  n: number,
  opts: { perDay?: number; accuracy?: 'real' | number; kinds?: readonly TaskKind[]; seed?: string } = {},
): Simulation {
  const perDay = opts.perDay ?? 12
  const def = NODE_BY_ID[node]
  if (!def) throw new Error(`no node ${node}`)
  const rng = makeRng(hashSeed(`ork3a-sim:${node}:${skill}:${opts.seed ?? ''}`))
  const plan = () => keysForNode(def, { states: {}, audioVerified: true }).filter((k) => k.skill === skill)
  let keys = plan()
  if (keys.length === 0) throw new Error(`${skill} is not played on ${node}`)
  let states: MisconceptionStates = {}
  const flagged = new Map<MisconceptionId, number>()
  const recent: boolean[] = []
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % 10 === 0) keys = plan()
    const key = keys[rng.int(keys.length)]
    const kinds = opts.kinds?.filter((k) => key.kinds.includes(k)) ?? key.kinds
    const t = key.build(rng.pick(kinds), makeRng(hashSeed(`ork3a-task:${node}:${skill}:${i}`)), i)
    const given = child(t, i)
    const correct = isCorrect(t, given)
    recent.push(correct)
    if (recent.length > 20) recent.shift()
    const day = `2026-11-${String(1 + Math.floor(i / perDay)).padStart(2, '0')}`
    const entry: AnswerLogEntry = {
      profileId: 'ork3a', ts: 1_000 + i, day, sessionId: 's', roundId: `r${Math.floor(i / 10)}`, nodeId: node, mode: 'round',
      skill: t.skill, family: t.family, factId: t.factId, masteryKey: t.masteryKey, kind: t.kind, optionsCount: t.options.length,
      production: isProduction(t), given, answer: t.answer, correct, ms: 4_000, fast: true, errorTag: classifyAnswer(t, given),
      detectable: detectableOf(t), boxBefore: 1, boxAfter: 1, scaffold: false, replays: 0, retryOf: null, assisted: false,
      audioUnverified: false,
    }
    const accuracy = opts.accuracy === undefined || opts.accuracy === 'real' ? recent.filter(Boolean).length / recent.length : opts.accuracy
    states = updateMisconceptions(states, entry, { skillAccuracy20: accuracy, day })
    for (const id of flaggedIds(states)) if (!flagged.has(id)) flagged.set(id, i + 1)
  }
  return { flagged }
}

/**
 * A child who keeps one misconception: `values` are what the idea gives on this task (from the card, by
 * the oracle's formula; none when it gives the answer itself). On cards the child taps such a value when
 * one is dealt and any card otherwise; on the keys it types one (seeded) when the keys take it; a deal on
 * the share view is dealt right (dealing one by one has no misconception).
 */
export function keeps(values: (t: Task) => readonly number[], seed: string): Child {
  const rng = makeRng(hashSeed(`ork3a-child:${seed}`))
  return (t) => {
    const own = values(t).filter((v) => v !== t.answer && v >= 0 && Number.isInteger(v))
    if (t.kind === 'choice' || t.kind === 'pair') {
      const hit = t.options.filter((o) => typeof o === 'number' && own.includes(o))
      return hit.length > 0 ? rng.pick(hit) : rng.pick(t.options)
    }
    if (t.kind === 'keypad') {
      const typed = own.filter((v) => v < 10 ** t.maxDigits)
      return typed.length > 0 ? rng.pick(typed) : t.answer
    }
    return t.answer
  }
}

export const answersRight: Child = (t) => t.answer

/** Taps a random card, types a random number the keys take inside the range, deals at random (even or −1). */
export function guesses(seed: string): Child {
  const rng = makeRng(hashSeed(`ork3a-guess:${seed}`))
  return (t) => {
    if (t.kind === 'choice' || t.kind === 'pair') return rng.pick(t.options)
    if (t.kind === 'share') return rng.next() < 0.5 ? t.answer : -1
    return rng.between(t.range[0], t.range[1])
  }
}

/** The equation on a card, a op b = □, or null. */
export function cardSum(t: Task): { a: number; op: string; b: number } | null {
  const p = t.prompt
  if (p.scene !== 'equation' || p.terms.length !== 5) return null
  const [a, op, b, eq, blank] = p.terms
  if (!('n' in a) || !('op' in op) || !('n' in b) || !('op' in eq) || eq.op !== '=' || !('blank' in blank)) return null
  return { a: a.n, op: op.op, b: b.n }
}

// ═══ add1000 and sub1000 ══════════════════════════════════════════════════════

/** The digit of n at place p (0 ones, 1 tens, 2 hundreds). */
export const digit = (n: number, p: number): number => Math.floor(n / 10 ** p) % 10
const widthOf = (n: number): number => String(n).length

export interface Sum3 {
  op: '+' | '−'
  a: number
  b: number
  answer: number
}

/** a1000:<a>+<b> → a + b · s1000:<a>-<b> → a − b (numbers written plainly, as the card shows them). */
export function sum3Of(id: string): Sum3 | null {
  const m = /^(a1000|s1000):(\d+)([+-])(\d+)$/.exec(id)
  if (!m || (m[1] === 'a1000') !== (m[3] === '+')) return null
  const a = Number(m[2])
  const b = Number(m[4])
  if (String(a) !== m[2] || String(b) !== m[4]) return null
  return m[3] === '+' ? { op: '+', a, b, answer: a + b } : a > b ? { op: '−', a, b, answer: a - b } : null
}

// ─── The column walk ────────────────────────────────────────────────────────

export interface PlusColumn {
  x: number
  y: number
  carryIn: number
  sum: number
  carries: boolean
}

/** a + b column by column, ones first: the digits, the ten carried in, the column's sum, whether it carries. */
export function plusWalk(a: number, b: number): PlusColumn[] {
  const out: PlusColumn[] = []
  let carry = 0
  for (let p = 0; p < Math.max(widthOf(a), widthOf(b)); p++) {
    const x = digit(a, p)
    const y = digit(b, p)
    const sum = x + y + carry
    out.push({ x, y, carryIn: carry, sum, carries: sum >= 10 })
    carry = sum >= 10 ? 1 : 0
  }
  return out
}

/** How a column of a − b got the ten it needed: from the tens, across a zero ten, or the tens from the hundreds. */
export type Exchange = 'ones' | 'acrossZero' | 'tens'

export interface MinusColumn {
  /** a's digit, the digit the column ends up working with, b's digit, and what it gives. */
  x: number
  top: number
  y: number
  diff: number
  exchange: Exchange | null
}

export interface MinusWalk {
  cols: MinusColumn[]
  /** The digits written above each column (place 0 = ones), in the order a child writes them. */
  marks: { value: number; kind: 'lent' | 'got' }[][]
}

/**
 * a − b the written way, ones first. A column that is too small takes ten from the nearest column to its
 * left that has something; every zero in between first gets ten and then gives one on (403 − 158: the
 * hundreds 4 → 3, the tens 0 → 10 → 9, the ones 3 → 13). Two exchanges in a row write a digit twice
 * (512 − 278: the tens 1 → 0, then 0 → 10).
 */
export function minusWalk(a: number, b: number): MinusWalk {
  const w = widthOf(a)
  const top = Array.from({ length: w }, (_, p) => digit(a, p))
  const marks: MinusWalk['marks'] = Array.from({ length: w }, () => [])
  const cols: MinusColumn[] = []
  for (let p = 0; p < w; p++) {
    const y = digit(b, p)
    let exchange: Exchange | null = null
    if (top[p] < y) {
      let lender = p + 1
      while (lender < w && top[lender] === 0) lender++
      if (lender >= w) throw new Error(`${a} − ${b}: nothing to exchange from`)
      exchange = p === 0 ? (lender === 1 ? 'ones' : 'acrossZero') : 'tens'
      for (let q = lender; q > p; q--) {
        top[q] -= 1
        marks[q].push({ value: top[q], kind: 'lent' })
        top[q - 1] += 10
        marks[q - 1].push({ value: top[q - 1], kind: 'got' })
      }
    }
    cols.push({ x: digit(a, p), top: top[p], y, diff: top[p] - y, exchange })
  }
  return { cols, marks }
}

// ─── Families, read off the numbers (SPEC §2.2, pædagogik §1.3, the module contract) ───

/**
 * The add1000 family a sum belongs to, or null: a three-digit a, every sum at most 999;
 * HTOplusOcarry b = 2–9, the ones carry, a's tens 0–8 (one carry) · HTOplusTO b two-digit with ones ≥ 1,
 * nothing carried · HTOplusTOcarry1 only the ones carry · HTOplusTOcarry10 the tens carry (the ones may) ·
 * HTOplusHTO b three-digit, neither number whole hundreds, nothing carried · HTOplusHTOcarry one carry or two.
 */
export function add1000Family(a: number, b: number): string | null {
  if (a < 100 || a > 999 || b < 1 || a + b > 999) return null
  const cols = plusWalk(a, b)
  const ones = cols[0].carries
  const tens = cols[1]?.carries ?? false
  if (b <= 9) return b >= 2 && ones && digit(a, 1) <= 8 ? 'HTOplusOcarry' : null
  if (b <= 99) {
    if (digit(b, 0) === 0) return null
    if (!ones && !tens) return 'HTOplusTO'
    return tens ? 'HTOplusTOcarry10' : 'HTOplusTOcarry1'
  }
  if (a % 100 === 0 || b % 100 === 0) return null
  return ones || tens ? 'HTOplusHTOcarry' : 'HTOplusHTO'
}

/**
 * The sub1000 family a difference belongs to, or null (a three-digit, b < a):
 * HTOminusOborrow b = 1–9 above a's ones, a's tens ≥ 1 · HTOminusTO b two-digit with ones ≥ 1, nothing
 * exchanged · HTOminusTOborrow the same with one exchange or two, never across a zero ten, the answer
 * three-digit · HTOminusHTO b three-digit, not whole hundreds, fewer hundreds than a, nothing exchanged ·
 * HTOminusHTOborrow b three-digit, not whole hundreds, one exchange or two, never across a zero ten ·
 * acrossZero a's tens 0 and the ones exchange across them (402 − 7, 500 − 36, 403 − 158), the answer
 * three-digit for a one- or two-digit b.
 */
export function sub1000Family(a: number, b: number): string | null {
  if (a < 100 || a > 999 || b < 1 || b >= a) return null
  const ex = minusWalk(a, b).cols.map((c) => c.exchange)
  const exchanges = ex.filter((e) => e !== null).length
  if (ex[0] === 'acrossZero') return b > 99 || a - b >= 100 ? 'acrossZero' : null
  if (b <= 9) return ex[0] === 'ones' ? 'HTOminusOborrow' : null
  if (b <= 99) {
    if (digit(b, 0) === 0) return null
    if (exchanges === 0) return 'HTOminusTO'
    return a - b >= 100 ? 'HTOminusTOborrow' : null
  }
  if (b % 100 === 0) return null
  if (exchanges === 0) return digit(b, 2) < digit(a, 2) ? 'HTOminusHTO' : null
  return 'HTOminusHTOborrow'
}

// ─── Misconceptions (pædagogik §3.2, SPEC §4.2) ─────────────────────────────

/**
 * add1000: forgotCarry — every column's own sum, nothing carried (the top column whole: 378 + 45 → 313);
 * placeMisalign — a one-digit b added to the tens, a + 10 · b (pædagogik: add1000 HTOplusO); wrongOperation
 * — the other operation, |a − b|. None when it gives the answer itself.
 */
export function plusMis(a: number, b: number): [number, MisconceptionId][] {
  const cols = plusWalk(a, b)
  const noCarry = cols.reduce((s, c, p) => s + (p === cols.length - 1 ? c.x + c.y : (c.x + c.y) % 10) * 10 ** p, 0)
  const out: [number, MisconceptionId][] = [[noCarry, 'forgotCarry'], [Math.abs(a - b), 'wrongOperation']]
  if (b <= 9) out.push([a + 10 * b, 'placeMisalign'])
  return out.filter(([v]) => v !== a + b)
}

/**
 * sub1000: smallerFromLarger — per column the smaller digit from the larger (423 − 158 → 335);
 * borrowNoDecrement — a column too small takes ten, and no column is ever lowered (423 − 158 → 375,
 * 402 − 7 → 405); wrongOperation — a + b.
 */
export function minusMis(a: number, b: number): [number, MisconceptionId][] {
  let sfl = 0
  let bnd = 0
  for (let p = 0; p < widthOf(a); p++) {
    const x = digit(a, p)
    const y = digit(b, p)
    sfl += Math.abs(x - y) * 10 ** p
    bnd += (x >= y ? x - y : x + 10 - y) * 10 ** p
  }
  const out: [number, MisconceptionId][] = [[sfl, 'smallerFromLarger'], [bnd, 'borrowNoDecrement'], [a + b, 'wrongOperation']]
  return out.filter(([v]) => v !== a - b)
}

export const sumMis = (s: Sum3): [number, MisconceptionId][] => (s.op === '+' ? plusMis(s.a, s.b) : minusMis(s.a, s.b))

export function explainSum(s: Sum3, v: number): Why {
  return { mis: [...new Set(sumMis(s).filter(([x]) => x === v).map(([, m]) => m))], operand: v === s.a || v === s.b }
}

// ─── The hint's words, column by column ────────────────────────────────────

const PLACE_INTRO: Readonly<Record<string, number>> = { 'Regn enerne først.': 0, 'Regn så tierne.': 1, 'Regn så hundrederne.': 2 }
const PLACE_SAME: Readonly<Record<string, number>> = { 'Enerne er de samme.': 0, 'Tierne er de samme.': 1, 'Hundrederne er de samme.': 2 }
const CARRY_OVER: Readonly<Record<string, number>> = { 'En tier går med over til tierne.': 0, 'Et hundrede går med over til hundrederne.': 1 }
const CARRY_RULE: Readonly<Record<string, number>> = {
  'Når enerne giver ti eller mere, skal tieren med over til tierne.': 0,
  'Når tierne giver ti eller mere, skal hundredet med over til hundrederne.': 1,
}
/** What an exchange is said as: the column it is for, and how. */
const EXCHANGE: Readonly<Record<string, [number, Exchange]>> = {
  'Der er ikke enere nok.': [0, 'ones'],
  'Der er ikke enere nok, og der er ingen tiere.': [0, 'acrossZero'],
  'Der er ikke tiere nok.': [1, 'tens'],
}
const EXCHANGE_DO: Readonly<Record<Exchange, string>> = {
  ones: 'Veksl en tier til ti enere.',
  acrossZero: 'Veksl først et hundrede til ti tiere, og så en tier til ti enere.',
  tens: 'Veksl et hundrede til ti tiere.',
}

interface Said {
  /** Per place: the statement said for it ("x plus y giver z" as tokens), "the same", carries and exchanges said. */
  statements: Map<number, (number | string)[]>
  same: Set<number>
  carried: Set<number>
  rules: Set<number>
  exchanged: Map<number, Exchange>
  answer: number | null
  problems: string[]
}

/** Reads a column hint sentence by sentence: which place each statement is about, and what is said about it. */
export function readColumns(text: string): Said {
  const said: Said = { statements: new Map(), same: new Set(), carried: new Set(), rules: new Set(), exchanged: new Map(), answer: null, problems: [] }
  let place: number | null = null
  const all = sentences(text)
  for (let i = 0; i < all.length; i++) {
    const s = all[i]
    if (s in PLACE_INTRO) place = PLACE_INTRO[s]
    else if (s in PLACE_SAME) said.same.add(PLACE_SAME[s])
    else if (s in CARRY_OVER) said.carried.add(CARRY_OVER[s])
    else if (s in CARRY_RULE) {
      place = CARRY_RULE[s]
      said.rules.add(place)
    } else if (s in EXCHANGE) {
      const [p, how] = EXCHANGE[s]
      place = p
      said.exchanged.set(p, how)
      if (all[i + 1] !== EXCHANGE_DO[how]) said.problems.push(`"${s}" is not followed by "${EXCHANGE_DO[how]}"`)
      else i += 1
    } else if (/^Svaret er /.test(s)) {
      const n = spokenTokens(s.slice('Svaret er '.length))
      said.answer = n.length === 1 && typeof n[0] === 'number' ? n[0] : null
    } else {
      const toks = spokenTokens(s)
      if (toks.includes('=') && toks.some((x) => x === '+' || x === '−')) {
        if (place === null) said.problems.push(`"${s}" is said before any column`)
        else if (said.statements.has(place)) said.problems.push(`two statements for place ${place}: "${s}"`)
        else said.statements.set(place, toks)
        if (statementTrue(toks) !== true) said.problems.push(`"${s}" is not true`)
      }
    }
  }
  return said
}

/**
 * What a column hint must say about a + b: for every column, either "the same" (nothing to add) or the
 * column's digits, the ten carried in and their sum; "goes over" exactly for the columns that carry
 * (`rulesOnly`: the forgotCarry hint says the rule and the sum for exactly those, nothing else); the answer.
 */
export function plusSaidProblems(a: number, b: number, said: Said, how: 'walk' | 'rules'): string[] {
  const out = [...said.problems]
  const cols = plusWalk(a, b)
  cols.forEach((c, p) => {
    const st = said.statements.get(p)
    const want = [c.x, ...(c.y > 0 ? ['+', c.y] : []), ...(c.carryIn > 0 ? ['+', c.carryIn] : []), '=', c.sum]
    if (how === 'rules') {
      if (c.carries !== said.rules.has(p)) out.push(`place ${p}: rule said ${said.rules.has(p)}, carries ${c.carries}`)
      if (c.carries && (!st || st.join(' ') !== want.join(' '))) out.push(`place ${p}: says ${st?.join(' ')}, the column is ${want.join(' ')}`)
      return
    }
    const nothing = c.y === 0 && c.carryIn === 0
    if (st) {
      if (st.join(' ') !== want.join(' ')) out.push(`place ${p}: says ${st.join(' ')}, the column is ${want.join(' ')}`)
    } else if (!nothing || !said.same.has(p)) out.push(`place ${p}: nothing said (y ${c.y}, carried in ${c.carryIn})`)
    if (c.carries !== said.carried.has(p)) out.push(`place ${p}: "goes over" said ${said.carried.has(p)}, the column carries ${c.carries}`)
  })
  if (said.answer !== a + b) out.push(`the answer said is ${said.answer}, not ${a + b}`)
  return out
}

/**
 * What a column hint must say about a − b: every column with its exchange (how the ten came) and the
 * digit it works with minus b's digit, or "the same" when nothing is taken or lent; `exchangesOnly`: just
 * the columns that exchange (the smallerFromLarger and borrowNoDecrement hints); the answer.
 */
export function minusSaidProblems(a: number, b: number, said: Said, how: 'walk' | 'exchanges'): string[] {
  const out = [...said.problems]
  const { cols } = minusWalk(a, b)
  cols.forEach((c, p) => {
    const st = said.statements.get(p)
    const want = [c.top, '−', c.y, '=', c.diff]
    const ex = said.exchanged.get(p) ?? null
    if (ex !== c.exchange) out.push(`place ${p}: exchange said ${ex}, the walk ${c.exchange}`)
    if (how === 'exchanges') {
      if (c.exchange !== null && (!st || st.join(' ') !== want.join(' '))) out.push(`place ${p}: says ${st?.join(' ')}, the column is ${want.join(' ')}`)
      if (c.exchange === null && st) out.push(`place ${p}: says ${st.join(' ')}, but nothing is exchanged there`)
      return
    }
    const untouched = c.y === 0 && c.top === c.x
    if (st) {
      if (st.join(' ') !== want.join(' ')) out.push(`place ${p}: says ${st.join(' ')}, the column is ${want.join(' ')}`)
    } else if (!untouched || !said.same.has(p)) out.push(`place ${p}: nothing said (top ${c.top}, y ${c.y})`)
  })
  if (said.answer !== a - b) out.push(`the answer said is ${said.answer}, not ${a - b}`)
  return out
}

/** The first exchange of a − b takes a ten (the ones from the tens) or a hundred (across a zero, or for the tens). */
export function firstExchangeTakes(a: number, b: number): 'ten' | 'hundred' | null {
  const first = minusWalk(a, b).cols.find((c) => c.exchange !== null)?.exchange ?? null
  return first === null ? null : first === 'ones' ? 'ten' : 'hundred'
}

// ─── The borrow and carry film (ui/hint/Columns.tsx regroupPlan) ───────────

/**
 * The film's numbers against the column walk, step by step: the digits of a, b and the result per column;
 * plus — the ten carried into each column; minus — the digits written above each column, in order, each one
 * the column's digit after lending one (one less) or getting ten (ten more), every column's last digit
 * minus b's digit its result digit (0–9), the top row still worth a after every exchange; and the timing —
 * the ones' result first, each column to the left later, a column's exchanges written before its result.
 */
export function filmProblems(a: number, b: number, op: '+' | '−', plan: ColumnPlan): string[] {
  const out: string[] = []
  const where = `${a} ${op} ${b}`
  const result = op === '+' ? a + b : a - b
  const places = plan.places
  const atPlace = (row: readonly number[], p: number) => row[places - 1 - p]
  for (let p = 0; p < places; p++) {
    if (atPlace(plan.A, p) !== digit(a, p) || atPlace(plan.B, p) !== digit(b, p) || atPlace(plan.R, p) !== digit(result, p)) {
      out.push(`${where}: place ${p} shows ${atPlace(plan.A, p)} ${op} ${atPlace(plan.B, p)} → ${atPlace(plan.R, p)}`)
    }
  }
  if (10 ** places <= Math.max(a, b, result)) out.push(`${where}: ${places} places`)
  for (let p = 1; p < places; p++) {
    if (!(plan.resultAt[places - 1 - p] > plan.resultAt[places - p])) out.push(`${where}: place ${p}'s result is not after place ${p - 1}'s`)
  }
  if (op === '+') {
    const walk = plusWalk(a, b)
    for (let p = 0; p < places; p++) {
      const want = walk[p]?.carryIn ?? (p > 0 && walk[p - 1]?.carries ? 1 : 0)
      const got = plan.carries[places - 1 - p] ?? 0
      if (got !== want) out.push(`${where}: carried into place ${p}: ${got}, the walk ${want}`)
    }
    if (plan.marks.some((m) => m.length > 0)) out.push(`${where}: digits written above a sum`)
    return out
  }
  const walk = minusWalk(a, b)
  const top = Array.from({ length: places }, (_, p) => digit(a, p))
  const steps: { p: number; ms: number; kind: 'lent' | 'got'; value: number }[] = []
  for (let p = 0; p < places; p++) {
    const marks = plan.marks[places - 1 - p]
    const want = walk.marks[p] ?? []
    const show = (ms: readonly { value: number; kind: string }[]) => ms.map((m) => `${m.value}${m.kind === 'lent' ? '↓' : '↑'}`).join(' ')
    if (show(marks) !== show(want)) out.push(`${where}: place ${p} written ${show(marks) || '∅'}, the walk ${show(want) || '∅'}`)
    let at = digit(a, p)
    let last = -Infinity
    for (const m of marks) {
      const next = m.kind === 'lent' ? at - 1 : at + 10
      if (m.value !== next || m.value < 0 || m.value > 19) out.push(`${where}: place ${p} goes ${at} → ${m.value} (${m.kind})`)
      at = m.value
      if (m.ms < last) out.push(`${where}: place ${p}'s digits are written out of order`)
      last = m.ms
      if (m.ms > plan.resultAt[places - 1 - p]) out.push(`${where}: place ${p} is written after its result`)
      steps.push({ p, ms: m.ms, kind: m.kind, value: m.value })
    }
    const y = digit(b, p)
    if (at - y !== digit(result, p) || at < y) out.push(`${where}: place ${p} works with ${at} − ${y}, the result digit is ${digit(result, p)}`)
  }
  // replay the exchanges in time order: the top row is worth a after each lent/got pair
  steps.sort((x, y) => x.ms - y.ms || (x.kind === y.kind ? 0 : x.kind === 'lent' ? -1 : 1))
  for (const s of steps) {
    top[s.p] = s.value
    const worth = top.reduce((sum, d, p) => sum + d * 10 ** p, 0)
    if (s.kind === 'got' && worth !== a) out.push(`${where}: after an exchange at ${s.ms} ms the top row is worth ${worth}`)
  }
  return out
}
