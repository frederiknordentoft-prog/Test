// Independent oracles for the algebra skills of 1.–2. klasse (missingPart10, skipCount, equalSides,
// inverseOps, missingPart100), and the small wave-2 kit the muldiv, shapes2 and fractions oracles share
// (ORK2c). Written by another agent than the generators (SPEC A5, §15.1): every right answer is worked
// out here from what the child is given — the fact id, the equation or balance on the card, the row of
// stones, the spoken question — and never from the generator code. Wrong answers are explained with
// pædagogik §3.2's formulas, worked out here, and classified by SPEC §4.1 with A9 and A11. The registry
// skips *.oracle.ts files, so none of this reaches the app.
import { MISCONCEPTION_IDS } from '../../types'
import type { AnswerValue, ErrorTag, Fact, MisconceptionId, Prompt, SkillDef, SkillId, Task, TaskKind, Term } from '../../types'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, guessP, isProduction } from '../../kinds'
import { hashSeed, makeRng } from '../../rng'
import { masteryKeyOf } from '../../tasks'
import { spokenText, type Built } from '../number/number.oracle'
import { word99 } from '../number/number2.oracle'

// ═══ The wave-2 kit (ORK2c) ═══════════════════════════════════════════════════

const MISCONCEPTIONS: ReadonlySet<string> = new Set(MISCONCEPTION_IDS)
export const isMis = (tag: unknown): tag is MisconceptionId => typeof tag === 'string' && MISCONCEPTIONS.has(tag)

/** 200 seeded instances per family, from the oracle's own seeds (SPEC §15.1). */
export function instancesOf3(def: SkillDef, perFamily = 200): Map<string, Fact[]> {
  const out = new Map<string, Fact[]>()
  for (const fam of def.families) {
    const rng = makeRng(hashSeed(`ork2c:${def.id}/${fam.id}`))
    out.set(fam.id, Array.from({ length: perFamily }, () => def.instance!(fam, rng, new Set())))
  }
  return out
}

// ─── Spoken arithmetic, as the child hears it (SPEC §10.1) ─────────────────

export type Tok = number | '+' | '−' | '·' | ':' | '=' | '?'

const UNIT_HEADS: Readonly<Record<string, number>> = { et: 1, en: 1, to: 2, tre: 3, fire: 4, fem: 5, seks: 6, syv: 7, otte: 8, ni: 9 }

/**
 * A Danish arithmetic sentence as numbers and signs: "Tre plus hvad giver syv?" → [3, '+', '?', '=', 7];
 * "Hvad er tolv delt med fire?" → ['?', '=', 12, ':', 4]; "… er lig med …" and "giver" are '='.
 * Numbers to 1000 ("et hundrede og femogtyve") are one token. Other words are skipped.
 */
export function spokenTokens(sentence: string): Tok[] {
  const w = sentence.toLowerCase().replace(/[.,?!]/g, ' ').split(/\s+/).filter((x) => x !== '')
  const out: Tok[] = []
  for (let i = 0; i < w.length; i++) {
    const x = w[i]
    if (x === 'tusind') out.push(1000)
    else if (x in UNIT_HEADS && w[i + 1] === 'hundrede') {
      let n = UNIT_HEADS[x] * 100
      i += 1
      const rest = w[i + 2] !== undefined ? word99(w[i + 2]) : null
      if (w[i + 1] === 'og' && rest !== null && rest >= 1) {
        n += rest
        i += 2
      }
      out.push(n)
    } else if (x === 'plus') out.push('+')
    else if (x === 'minus') out.push('−')
    else if (x === 'gange') out.push('·')
    else if ((x === 'delt' || x === 'divideret') && w[i + 1] === 'med') {
      out.push(':')
      i += 1
    } else if (x === 'giver') out.push('=')
    else if (x === 'er' && w[i + 1] === 'lig' && w[i + 2] === 'med') {
      out.push('=')
      i += 2
    } else if (x === 'er') out.push('=')
    else if (x === 'hvad') out.push('?')
    else {
      const n = word99(x)
      if (n !== null) out.push(n)
    }
  }
  return out
}

const apply = (x: number, op: Tok, y: number): number | null => {
  switch (op) {
    case '+': return x + y
    case '−': return x - y
    case '·': return x * y
    case ':': return y !== 0 && x % y === 0 ? x / y : null
    default: return null
  }
}

/** A side "n", "n op m" (left to right) with '?' standing for `x`; null when it is not one. */
function sideValue(side: readonly Tok[], x: number): number | null {
  const val = (t: Tok | undefined): number | null => (t === '?' ? x : typeof t === 'number' ? t : null)
  let acc = val(side[0])
  for (let i = 1; acc !== null && i < side.length; i += 2) {
    const next = val(side[i + 1])
    acc = next === null ? null : apply(acc, side[i], next)
  }
  return side.length % 2 === 1 ? acc : null
}

/** Both sides of an equation of tokens; null without exactly one '='. */
export function sidesOf(toks: readonly Tok[]): [Tok[], Tok[]] | null {
  const at = toks.indexOf('=')
  if (at < 0 || toks.indexOf('=', at + 1) >= 0) return null
  return [toks.slice(0, at), toks.slice(at + 1)]
}

/** The one whole number 0–1000 that makes the equation true ('?' the unknown), or null (none or several). */
export function solveTokens(toks: readonly Tok[]): number | null {
  const s = sidesOf(toks)
  if (!s || !toks.includes('?')) return null
  const hits: number[] = []
  for (let x = 0; x <= 1000 && hits.length < 2; x++) {
    const l = sideValue(s[0], x)
    const r = sideValue(s[1], x)
    if (l !== null && r !== null && l === r) hits.push(x)
  }
  return hits.length === 1 ? hits[0] : null
}

/** Is a statement without unknowns true ("Ni plus to giver elleve")? null when it is not a statement. */
export function statementTrue(toks: readonly Tok[]): boolean | null {
  const s = sidesOf(toks)
  if (!s || toks.includes('?')) return null
  const l = sideValue(s[0], 0)
  const r = sideValue(s[1], 0)
  return l === null || r === null ? null : l === r
}

/** The sentences of a spoken text. */
export const sentences = (text: string): string[] => text.split(/(?<=[.?!])\s+/).filter((s) => s.trim() !== '')

/** The terms of an equation card as tokens ('?' for the blank); text terms ("så") split it. */
export function termTokens(terms: readonly Term[]): Tok[][] {
  const out: Tok[][] = [[]]
  for (const t of terms) {
    if ('n' in t) out[out.length - 1].push(t.n)
    else if ('blank' in t) out[out.length - 1].push('?')
    else if ('op' in t) out[out.length - 1].push(t.op === '<' || t.op === '>' ? '=' : (t.op as Tok))
    else out.push([])
  }
  return out.filter((x) => x.length > 0)
}

/** Every number written on an equation, balance, row, groups or share card (what the child sees). */
export function cardNumbers(p: Prompt): number[] {
  const of = (terms: readonly Term[]) => terms.flatMap((t) => ('n' in t ? [t.n] : []))
  switch (p.scene) {
    case 'equation': return of(p.terms)
    case 'balance': return of([...p.left, ...p.right])
    case 'row': return p.cells.filter((c): c is number => typeof c === 'number')
    case 'groups': return [p.groups, p.size]
    case 'share': return [p.total, p.recipients]
    default: return []
  }
}

// ─── SPEC §4.1 with A9 and A11: the tag a wrong value must get ─────────────

/** Tens and ones swapped (two different non-zero digits, two-digit ending), else null. */
export function swapped(n: number): number | null {
  if (!Number.isInteger(n) || n < 10) return null
  const t = Math.floor(n / 10) % 10
  const o = n % 10
  return t === 0 || o === 0 || t === o ? null : n - 10 * t - o + 10 * o + t
}

/**
 * SPEC §4.1 globalChecks outside the hear and place skills: a typed answer of 13 or more can be a digit
 * swap when its reversal is a different number that is not on the card. Only there does A11 apply.
 */
export function typedSwapOf(t: Task): number | null {
  if (t.kind !== 'keypad' || typeof t.answer !== 'number' || t.answer < 13) return null
  const s = swapped(t.answer)
  return s !== null && !cardNumbers(t.prompt).includes(s) ? s : null
}

/** What explains a wrong value: the misconceptions it fits (pædagogik §3.2) and whether the question gave it. */
export interface Expl {
  mis: readonly MisconceptionId[]
  operand?: boolean
}

/**
 * The tag SPEC §4.1 gives: one misconception is its own tag; two make it 'ambiguous' (never evidence),
 * and so does one that is also a number from the question (A9) or the answer with its digits swapped
 * where a swap can happen (A11). Anything else is plain — 'near', 'operand', 'other' or a typed digit
 * swap — and plain tags are never evidence, so the oracle does not insist on which.
 */
export function wantTag(t: Task, value: AnswerValue, e: Expl): ErrorTag | 'plain' {
  const mis = [...new Set(e.mis)]
  if (mis.length > 1) return 'ambiguous'
  if (mis.length === 1) {
    const swap = typeof value === 'number' && typedSwapOf(t) === value
    return e.operand || swap ? 'ambiguous' : mis[0]
  }
  return 'plain'
}

const PLAIN: ReadonlySet<string> = new Set(['near', 'operand', 'other', 'digitSwap'])

/** classifyAnswer against the oracle's tag; a problem or null. */
export function tagCheck(t: Task, value: AnswerValue, e: Expl, how: string): string | null {
  const got = classifyAnswer(t, value)
  const where = `${t.factId} ${t.kind} ${how} ${String(value)} (answer ${String(t.answer)})`
  if (got === null) return `${where}: classified as right`
  const want = wantTag(t, value, e)
  if (want === 'plain') return PLAIN.has(got) ? null : `${where}: ${got}, the oracle has a plain error`
  return got === want ? null : `${where}: ${got}, expected ${want}`
}

/**
 * Every card (choice), every typed value (keypad: 0 up to what the keys take, at most 0–999) and every
 * filling of the slots (fillSlots) against the oracle's explanation. A value the oracle says is right
 * (`right`) must be classified right; the task's own answer is skipped.
 */
export function classifyAll(
  built: readonly Built[],
  explain: (b: Built, v: AnswerValue) => Expl,
  right: (b: Built, v: AnswerValue) => boolean = (b, v) => v === b.task.answer,
): string[] {
  const out: string[] = []
  for (const b of built) {
    const t = b.task
    const values: AnswerValue[] = []
    let how = 'card'
    if (t.kind === 'choice' || t.kind === 'trueFalse') values.push(...t.options)
    else if (t.kind === 'keypad') {
      how = 'typed'
      for (let v = 0; v <= Math.min(999, 10 ** t.maxDigits - 1); v++) values.push(v)
    } else if (t.kind === 'fillSlots') {
      how = 'filled'
      const slots = String(t.answer).split('|').length
      let fills: string[] = ['']
      for (let i = 0; i < slots; i++) fills = fills.flatMap((f) => t.options.map((o) => (f === '' ? String(o) : `${f}|${String(o)}`)))
      values.push(...fills)
    }
    for (const v of values) {
      if (right(b, v)) {
        if (classifyAnswer(t, v) !== null) out.push(`${t.factId} ${t.kind} ${how} ${String(v)}: right by the oracle, classified ${classifyAnswer(t, v)}`)
        continue
      }
      const p = tagCheck(t, v, explain(b, v), how)
      if (p) out.push(p)
    }
  }
  return out
}

/**
 * SPEC §4.1: a card set shows a diagnostic card (one misconception that counts) whenever the oracle
 * knows such a value among the values a card may show (inside the range) — the rotation picks which.
 */
export function diagnosticCards(built: readonly Built[], known: (b: Built) => readonly AnswerValue[], explain: (b: Built, v: AnswerValue) => Expl): string[] {
  const out: string[] = []
  for (const b of built) {
    const t = b.task
    if (t.kind !== 'choice') continue
    const counts = (v: AnswerValue) => {
      if (isCorrect(t, v)) return false
      if (typeof v === 'number' && (v < t.range[0] || v > t.range[1])) return false
      const w = wantTag(t, v, explain(b, v))
      return w !== 'plain' && w !== 'ambiguous'
    }
    const could = [...new Set(known(b))].filter(counts)
    if (could.length > 0 && !t.options.some(counts)) out.push(`${t.factId}: no diagnostic card among [${t.options.join(', ')}] (could be ${could.join(', ')})`)
  }
  return out
}

/** Every non-empty choice of options, as the sorted ids a multiSelect answer is compared on. */
export function selectionsOf(ids: readonly string[]): string[] {
  const out: string[] = []
  for (let mask = 1; mask < 2 ** ids.length; mask++) out.push(ids.filter((_, i) => mask & (2 ** i)).sort().join('|'))
  return out
}

/**
 * What the child can hand in on this task (SPEC §3.2): the cards; any number the keys take (at most
 * 0–999); every filling of the slots; every selection; a deal of the whole pile (the even share, or
 * −1); every colouring (frac:k/parts). A 'grid' count is typed.
 */
export function producible(t: Task): AnswerValue[] {
  switch (t.kind) {
    case 'choice':
    case 'pair':
    case 'trueFalse':
      return [...t.options]
    case 'keypad':
    case 'grid':
      return Array.from({ length: Math.min(1000, 10 ** t.maxDigits) }, (_, v) => v)
    case 'fillSlots': {
      let fills: string[] = ['']
      for (let i = 0; i < String(t.answer).split('|').length; i++) fills = fills.flatMap((f) => t.options.map((o) => (f === '' ? String(o) : `${f}|${String(o)}`)))
      return fills
    }
    case 'multiSelect':
      return selectionsOf(t.options.map(String))
    case 'share': {
      if (t.prompt.scene !== 'share') return []
      const each = t.prompt.total / t.prompt.recipients
      return Number.isInteger(each) ? [each, -1] : [-1]
    }
    case 'colorParts': {
      const parts = t.prompt.scene === 'fraction' ? t.prompt.parts : 0
      return Array.from({ length: parts + 1 }, (_, k) => `frac:${k}/${parts}`)
    }
    default:
      throw new Error(`no producible values for ${t.kind}`)
  }
}

/** The perceptual misconception a contrast task in each skill tests (SPEC §4.3, pædagogik §3.2). */
const PERCEPTUAL3: Readonly<Partial<Record<SkillId, MisconceptionId>>> = {
  halfShape: 'unequalParts', fractionShape: 'unequalParts', sortShapes: 'prototypeOnly', shapes2D: 'prototypeOnly',
}

/**
 * SPEC §4.3 "Mulighed": the misconceptions a task gives the child the chance to show — those the oracle
 * finds among the values the task can actually be answered with (a card shown, a number typed, a deal,
 * a selection), a typed digit swap where one can happen, and a contrast task's perceptual misconception.
 * detectableOf must agree: an opportunity that no answer can hit dilutes the flag rate and lets right
 * answers lift a flag they say nothing about (isResolved).
 */
export function detectableChecks(built: readonly Built[], explain: (b: Built, v: AnswerValue) => Expl): string[] {
  const out = new Set<string>()
  for (const b of built) {
    const t = b.task
    const want = new Set<MisconceptionId>()
    for (const v of producible(t)) {
      if (isCorrect(t, v)) continue
      const tag = wantTag(t, v, explain(b, v))
      if (isMis(tag)) want.add(tag)
    }
    const swap = typedSwapOf(t)
    if (swap !== null && wantTag(t, swap, explain(b, swap)) === 'plain' && !explain(b, swap).operand) want.add('digitSwap')
    const perceptual = PERCEPTUAL3[t.skill]
    if (t.contrast && perceptual) want.add(perceptual)
    const got = new Set(detectableOf(t))
    const show = (s: Set<MisconceptionId>) => [...s].sort().join(',') || '∅'
    if (show(got) !== show(want)) out.add(`${t.factId} ${t.kind}: detectable ${show(got)}, the answers it takes can show ${show(want)}`)
  }
  return [...out]
}

// ─── SPEC §3.2–3.3: guess rate, production and ceiling ─────────────────────

const MANIPULATIVE_ONLY_FOR: Readonly<Partial<Record<TaskKind, readonly SkillId[]>>> = {
  share: ['shareEqually', 'fractionOfSet'], buildBase: ['tensOnes', 'placeValue1000'], countTap: ['count10', 'count20'],
}

/**
 * SPEC §3.2's guessP, read off what the child is shown: the cards, the keys, the items, the palette and
 * slots, the parts to colour, the grid. A 'grid' task whose answer is a number (a count) is typed on the
 * keys (the fallback until wave 3's grid view), so its chance is the keypad's, not the cells'.
 */
export function guess3(t: Task): number {
  switch (t.kind) {
    case 'choice':
      return 1 / t.options.length
    case 'keypad':
      return 1 / (t.range[1] - t.range[0] + 1)
    case 'trueFalse':
      return 0.5
    case 'multiSelect': {
      const items = t.prompt.scene === 'shapes' ? t.prompt.items.length : t.options.length
      return 1 / (2 ** items - 1)
    }
    case 'fillSlots':
      return 1 / t.options.length ** String(t.answer).split('|').length
    case 'share':
      return 0.01
    case 'colorParts':
      if (t.prompt.scene !== 'fraction') throw new Error(`colorParts without a figure: ${t.factId}`)
      return 1 / (t.prompt.parts + 1)
    case 'grid':
      // a count ("how many squares are missing?") is typed, whatever the scene: the keypad's chance
      if (typeof t.answer === 'number' || t.prompt.scene !== 'grid') return 1 / (t.range[1] - t.range[0] + 1)
      return t.prompt.coords ? 1 / (t.prompt.w * t.prompt.h) : 1 / 2 ** (t.prompt.w * t.prompt.h)
    default:
      throw new Error(`no oracle guess rate for ${t.kind}`)
  }
}
export const production3 = (t: Task): boolean => guess3(t) <= 0.12 && (MANIPULATIVE_ONLY_FOR[t.kind]?.includes(t.skill) ?? true)
export const ceiling3 = (t: Task): 2 | 3 | 5 => (production3(t) ? 5 : guess3(t) >= 0.5 ? 2 : 3)

/** The engine's guessP, isProduction and ceilingFor against the oracle's, per task (`only`: compare these). */
export function productionChecks(built: readonly Built[], only: ReadonlySet<'guess' | 'production' | 'ceiling'> = new Set(['guess', 'production', 'ceiling'])): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) {
    const where = `${fact.skill} ${fact.id} ${kind}`
    if (only.has('guess') && Math.abs(guessP(task) - guess3(task)) > 1e-12) out.add(`${where}: guessP ${guessP(task)}, oracle ${guess3(task)}`)
    if (only.has('production') && isProduction(task) !== production3(task)) out.add(`${where}: isProduction ${isProduction(task)}, oracle ${production3(task)}`)
    if (only.has('ceiling') && ceilingFor(task) !== ceiling3(task)) out.add(`${where}: ceiling ${ceilingFor(task)}, oracle ${ceiling3(task)}`)
  }
  return [...out]
}

/** SPEC §2.2's kinds per skill, and the starred (production) ones. */
export const SPEC_KINDS3: Readonly<Partial<Record<SkillId, { kinds: readonly TaskKind[]; production: readonly TaskKind[] }>>> = {
  missingPart10: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  skipCount: { kinds: ['choice', 'keypad', 'fillSlots'], production: ['keypad', 'fillSlots'] },
  missingPart100: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  inverseOps: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  equalSides: { kinds: ['trueFalse', 'choice', 'keypad'], production: ['keypad'] },
  groupsOf: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  mul2510: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  shareEqually: { kinds: ['share', 'choice', 'keypad'], production: ['share', 'keypad'] },
  sidesCorners: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  shapes3D: { kinds: ['choice', 'multiSelect', 'keypad'], production: ['multiSelect', 'keypad'] },
  sortShapes: { kinds: ['multiSelect'], production: ['multiSelect'] },
  symmetry: { kinds: ['trueFalse', 'multiSelect', 'grid'], production: ['multiSelect', 'grid'] },
  composeShapes: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  halfShape: { kinds: ['trueFalse', 'multiSelect'], production: ['multiSelect'] },
  fractionShape: { kinds: ['choice', 'colorParts', 'fillSlots'], production: ['fillSlots'] },
}

/**
 * SPEC §2.2/§3.3 per skill: the kinds are SPEC's; a starred kind is production for ≥ 90 % of its tasks,
 * an unstarred one never; a choice task lifts at most to box 3, and to box 2 on a coin flip or worse.
 */
export function specKindChecks(def: SkillDef, built: readonly Built[]): string[] {
  const spec = SPEC_KINDS3[def.id]
  if (!spec) return [`${def.id}: not in the oracle's SPEC §2.2 table`]
  const out: string[] = []
  if ([...def.kinds].sort().join(',') !== [...spec.kinds].sort().join(',')) out.push(`${def.id}: kinds ${def.kinds}, SPEC ${spec.kinds}`)
  for (const kind of def.kinds) {
    const own = built.filter((b) => b.kind === kind)
    if (own.length === 0) continue
    const share = own.filter((b) => production3(b.task)).length / own.length
    if (spec.production.includes(kind) && share < 0.9) out.push(`${def.id} ${kind}: production for ${(share * 100).toFixed(1)} %, SPEC wants ≥ 90 %`)
    if (!spec.production.includes(kind) && share > 0) out.push(`${def.id} ${kind}: production for ${(share * 100).toFixed(1)} %, SPEC says never`)
  }
  for (const { task } of built) {
    if (task.kind !== 'choice' && task.kind !== 'trueFalse') continue
    const cap = guessP(task) >= 0.5 ? 2 : 3
    if (ceilingFor(task) > cap) out.push(`${task.factId} ${task.kind}: ceiling ${ceilingFor(task)}, at most ${cap}`)
  }
  return out
}

// ─── Ids and family sets ────────────────────────────────────────────────────

/** Fact ids: in the format, unique per meaning, the family and answer the oracle reads off the id. */
export function idChecks(def: SkillDef, facts: readonly Fact[], format: RegExp, oracle: (id: string) => { family: string; answer: AnswerValue } | null): string[] {
  const out: string[] = []
  const meaning = new Map<string, string>()
  for (const f of facts) {
    const where = `${def.id} ${f.id}`
    if (!format.test(f.id)) out.push(`${where}: not in the format ${format}`)
    if (f.skill !== def.id) out.push(`${where}: skill ${f.skill}`)
    const o = oracle(f.id)
    if (!o) out.push(`${where}: the oracle cannot read the id`)
    else {
      if (o.family !== f.family) out.push(`${where}: family ${f.family}, the id says ${o.family}`)
      if (o.answer !== f.answer) out.push(`${where}: answer ${String(f.answer)}, oracle ${String(o.answer)}`)
    }
    const key = JSON.stringify([f.family, f.operands, f.answer])
    if ((meaning.get(f.id) ?? key) !== key) out.push(`${where}: one id, two instances`)
    meaning.set(f.id, key)
    // SPEC §2.4: a recall fact is its own mastery key, a procedure is mastered per family
    const want = def.mode === 'recall' ? f.id : `${def.id}/${f.family}`
    if (masteryKeyOf(def, f) !== want) out.push(`${where}: mastery key ${masteryKeyOf(def, f)}, SPEC §2.4 ${want}`)
  }
  return out
}

/** Instance ids are unique within the family: how many different ones 200 draws gave. */
export const distinctIds = (facts: readonly Fact[]): number => new Set(facts.map((f) => f.id)).size

/** The instances avoid the ids they are told to avoid while the family has others (SPEC §5.1). */
export function avoidChecks(def: SkillDef, instances: ReadonlyMap<string, readonly Fact[]>): string[] {
  const out: string[] = []
  for (const fam of def.families) {
    const pool = [...new Set((instances.get(fam.id) ?? []).map((f) => f.id))]
    if (pool.length < 4) continue
    const avoid = new Set(pool.slice(0, Math.floor(pool.length / 2)))
    const rng = makeRng(hashSeed(`ork2c-avoid:${def.id}/${fam.id}`))
    for (let i = 0; i < 40; i++) {
      const f = def.instance!(fam, rng, avoid)
      if (avoid.has(f.id)) out.push(`${def.id}/${fam.id}: drew the avoided ${f.id}`)
    }
  }
  return out
}

// ═══ missingPart10: a + ? = c ════════════════════════════════════════════════

/** mp:<a>+?=<c> → the missing part (CONVENTIONS); 1 ≤ a < c ≤ 9 (c = 10 is tenFriends). */
export function missingPart10Of(id: string): { a: number; c: number; answer: number } | null {
  const m = /^mp:(\d+)\+\?=(\d+)$/.exec(id)
  if (!m) return null
  const a = Number(m[1])
  const c = Number(m[2])
  return a >= 1 && a < c && c <= 9 ? { a, c, answer: c - a } : null
}

/** pædagogik §3.2 equalsAsAnswer ("3 + □ = 7 → 10"): the two numbers added. */
export function explainMissingPart10(a: number, c: number, v: AnswerValue): Expl {
  return { mis: v === a + c ? ['equalsAsAnswer'] : [], operand: v === a || v === c }
}

// ═══ skipCount: the next stone(s) ════════════════════════════════════════════

/** The step of each family (pædagogik §1.3: step2, step5, step10, step10offset 3, 13, 23, back10, step100, step25). */
export const SKIP_STEP: Readonly<Record<string, number>> = {
  step2: 2, step5: 5, step10: 10, step10offset: 10, back10: -10, step100: 100, step25: 25,
}

export interface SkipRow {
  family: string
  start: number
  shown: number
  step: number
  row: number[]
}

/** skc:<family>:<start>:<shown> → the row of stones, or null when the family's rule does not hold. */
export function skipRowOf(id: string): SkipRow | null {
  const m = /^skc:([A-Za-z0-9]+):(\d+):(\d+)$/.exec(id)
  if (!m || !(m[1] in SKIP_STEP)) return null
  const family = m[1]
  const start = Number(m[2])
  const shown = Number(m[3])
  const step = SKIP_STEP[family]
  const fits: Readonly<Record<string, boolean>> = {
    step2: start % 2 === 0, step5: start % 5 === 0, step10: start % 10 === 0, step10offset: start % 10 !== 0,
    back10: true, step100: start % 10 === 0, step25: start % 25 === 0,
  }
  if (!fits[family] || shown < 3) return null
  return { family, start, shown, step, row: Array.from({ length: shown }, (_, i) => start + i * step) }
}

/** The next k numbers after the row. */
export const skipNext = (r: SkipRow, k: number): number[] => Array.from({ length: k }, (_, i) => r.start + (r.shown + i) * r.step)

/**
 * Read blind off the stones, as the child does: the same hop between every two stones, then on from the
 * last. Null when the hops differ.
 */
export function continueStones(cells: readonly (number | string | null)[], k: number): number[] | null {
  const nums = cells.filter((c): c is number => typeof c === 'number')
  if (nums.length < 2) return null
  const hop = nums[1] - nums[0]
  if (nums.some((n, i) => i > 0 && n - nums[i - 1] !== hop)) return null
  return Array.from({ length: k }, (_, i) => nums[nums.length - 1] + (i + 1) * hop)
}

/** pædagogik §3.2 skipStepOne ("5, 10, 15 → 16"): on in ones (back: one less) from the last stone. */
export function explainSkip(r: SkipRow, v: AnswerValue): Expl {
  const s = Math.sign(r.step)
  const last = r.row[r.row.length - 1]
  const one = typeof v === 'number' ? v === last + s : v === `${last + s}|${last + 2 * s}`
  return { mis: one ? ['skipStepOne'] : [], operand: typeof v === 'number' && r.row.includes(v) }
}

// ═══ equalSides: the balance ═════════════════════════════════════════════════

export type EqSide = (number | '_' | '+' | '−')[]

export interface EqParsed {
  family: string
  left: EqSide
  right: EqSide
  shown: number
}

const EQ_FAMILY: Readonly<Record<string, string>> = { tf: 'trueFalse', add: 'balanceAdd', sub: 'balanceSub', mix: 'balanceMixed' }

/** eqs:<tf|add|sub|mix>:<left>=<right>:<shown>, '_' the number asked for. */
export function equalSidesOf(id: string): EqParsed | null {
  const m = /^eqs:([a-z]+):([0-9_+-]+)=([0-9_+-]+):(\d+)$/.exec(id)
  if (!m || !EQ_FAMILY[m[1]]) return null
  const side = (s: string): EqSide | null => {
    const p = /^(\d+|_)(?:([+-])(\d+|_))?$/.exec(s)
    if (!p) return null
    const t = (x: string): number | '_' => (x === '_' ? '_' : Number(x))
    return p[2] ? [t(p[1]), p[2] === '+' ? '+' : '−', t(p[3])] : [t(p[1])]
  }
  const left = side(m[2])
  const right = side(m[3])
  if (!left || !right) return null
  const probes = [...left, ...right].filter((x) => x === '_').length
  return probes === 1 ? { family: EQ_FAMILY[m[1]], left, right, shown: Number(m[4]) } : null
}

const eqTokens = (e: EqParsed): Tok[] => [...e.left, '=', ...e.right].map((x) => (x === '_' ? '?' : x)) as Tok[]

/** The number that balances the seesaw (0–40), from the id. */
export const equalSidesAnswer = (e: EqParsed): number | null => solveTokens(eqTokens(e))

/** The family's shape (pædagogik §1.3): trueFalse 7+2 = 9+0, balanceAdd 8+4 = ?+5, balanceSub with minus, balanceMixed one of each. */
export function equalSidesShapeOk(e: EqParsed): boolean {
  const ops = [...e.left, ...e.right].filter((x) => x === '+' || x === '−')
  switch (e.family) {
    case 'trueFalse': return ops.every((o) => o === '+') && ops.length >= 1
    case 'balanceAdd': return ops.length === 2 && ops.every((o) => o === '+')
    case 'balanceSub': return ops.length === 2 && ops.every((o) => o === '−')
    case 'balanceMixed': return ops.length === 2 && ops.includes('+') && ops.includes('−')
    default: return false
  }
}

/** A balance card as two sides of tokens ('?' for a blank). */
export function balanceTokens(p: Prompt): [Tok[], Tok[]] | null {
  if (p.scene !== 'balance') return null
  const side = (terms: readonly Term[]): Tok[] => termTokens(terms)[0] ?? []
  return [side(p.left), side(p.right)]
}

/**
 * pædagogik §3.2 equalsAsAnswer ("8 + 4 = □ + 5 → 12 or 17"): the whole side's value written in the
 * blank, and that value carried on with the blank's side ("□ + 5" → 17, "□ − 3" → the value − 3).
 */
export function equalsAsAnswerValues(sides: [Tok[], Tok[]]): number[] {
  const [l, r] = sides
  const full = l.includes('?') ? r : l
  const part = l.includes('?') ? l : r
  const v = sideValue(full, 0)
  if (v === null) return []
  const out = [v]
  if (part.length === 3) {
    const d = part[0] === '?' ? part[2] : part[0]
    if (typeof d === 'number' && part[1] === '+') out.push(v + d)
    if (typeof d === 'number' && part[1] === '−' && part[0] === '?') out.push(v - d)
  }
  return out
}

/**
 * A child who reads = as "the answer comes now" judges the statement as shown: right when the left side
 * is a sum or difference and the first number after = is its result ("7 + 2 = 9 + 2" looks right), wrong
 * otherwise ("9 = 7 + 2" and "7 + 2 = 4 + 5" look wrong).
 */
export function answerComesNowSays(sides: [Tok[], Tok[]]): 'yes' | 'no' {
  const [l, r] = sides
  if (l.length < 3) return 'no'
  return sideValue(l, 0) === r[0] ? 'yes' : 'no'
}

// ═══ inverseOps: regnefamilier ═══════════════════════════════════════════════

export type Inverse =
  | { family: 'addToSub'; a: number; b: number; c: number; s: number }
  | { family: 'subToAdd'; c: number; b: number; p: number; q: number }
  | { family: 'mulToDiv'; a: number; b: number; c: number; s: number }

/** inv:<a>+<b>:<c>-<s> · inv:<c>-<b>:<p>+<q> · inv:<a>x<b>:<c>/<s>; null when the known fact and the asked one are not one family. */
export function inverseOf(id: string): Inverse | null {
  let m = /^inv:(\d+)\+(\d+):(\d+)-(\d+)$/.exec(id)
  if (m) {
    const [a, b, c, s] = m.slice(1).map(Number)
    return c === a + b && (s === a || s === b) ? { family: 'addToSub', a, b, c, s } : null
  }
  if ((m = /^inv:(\d+)-(\d+):(\d+)\+(\d+)$/.exec(id))) {
    const [c, b, p, q] = m.slice(1).map(Number)
    const parts = [c - b, b].sort((x, y) => x - y).join()
    return c > b && [p, q].sort((x, y) => x - y).join() === parts ? { family: 'subToAdd', c, b, p, q } : null
  }
  if ((m = /^inv:(\d+)x(\d+):(\d+)\/(\d+)$/.exec(id))) {
    const [a, b, c, s] = m.slice(1).map(Number)
    return c === a * b && (s === a || s === b) ? { family: 'mulToDiv', a, b, c, s } : null
  }
  return null
}

/** The asked number. */
export function inverseAnswer(q: Inverse): number {
  switch (q.family) {
    case 'addToSub': return q.c - q.s
    case 'subToAdd': return q.p + q.q
    case 'mulToDiv': return q.c / q.s
  }
}

/**
 * pædagogik §3.2 wrongOperation (the other operation on the numbers asked about): 12 − 5 → 17, 7 + 5 → 2;
 * 12 : 4 → 48, or 8 when the division is read as a subtraction (the generator's reading, kept here).
 */
export function inverseWrongOps(q: Inverse): number[] {
  switch (q.family) {
    case 'addToSub': return [q.c + q.s]
    case 'subToAdd': return [Math.abs(q.p - q.q)]
    case 'mulToDiv': return [q.c * q.s, q.c - q.s]
  }
}

// ═══ missingPart100 ══════════════════════════════════════════════════════════

export type Missing100 =
  | { family: 'addendCross20'; a: number; c: number }
  | { family: 'toHundred'; form: 'addend' | 'difference'; a: number }
  | { family: 'subtrahend'; c: number; d: number }
  | { family: 'minuend'; b: number; d: number }

/** mp100:<a>+?=<c> (c = 100: toHundred) · mp100:100-<a>=? · mp100:<c>-?=<d> · mp100:?-<b>=<d>. */
export function missing100Of(id: string): Missing100 | null {
  let m = /^mp100:(\d+)\+\?=(\d+)$/.exec(id)
  if (m) {
    const a = Number(m[1])
    const c = Number(m[2])
    return c === 100 ? { family: 'toHundred', form: 'addend', a } : { family: 'addendCross20', a, c }
  }
  if ((m = /^mp100:100-(\d+)=\?$/.exec(id))) return { family: 'toHundred', form: 'difference', a: Number(m[1]) }
  if ((m = /^mp100:(\d+)-\?=(\d+)$/.exec(id))) return { family: 'subtrahend', c: Number(m[1]), d: Number(m[2]) }
  if ((m = /^mp100:\?-(\d+)=(\d+)$/.exec(id))) return { family: 'minuend', b: Number(m[1]), d: Number(m[2]) }
  return null
}

/** The id's equation as tokens. */
export function missing100Tokens(q: Missing100): Tok[] {
  switch (q.family) {
    case 'addendCross20': return [q.a, '+', '?', '=', q.c]
    case 'toHundred': return q.form === 'addend' ? [q.a, '+', '?', '=', 100] : [100, '−', q.a, '=', '?']
    case 'subtrahend': return [q.c, '−', '?', '=', q.d]
    case 'minuend': return ['?', '−', q.b, '=', q.d]
  }
}

/** SPEC §4.2 digitComplement10 (100 − 37 → 73): each digit made up to ten; none for whole tens. */
export function digitComplement(a: number): number | null {
  const t = Math.floor(a / 10)
  const o = a % 10
  return a >= 11 && a <= 99 && o !== 0 ? 10 * (10 - t) + (10 - o) : null
}

/**
 * pædagogik §3.2 and SPEC §4.2: equalsAsAnswer a + c ("38 + ? = 45 → 83", "37 + ? = 100 → 137"),
 * digitComplement10 in toHundred, wrongOperation — the other operation on the two numbers shown
 * (100 − 37 → 137, 52 − ? = 38 → 90, ? − 27 = 38 → 11).
 */
export function missing100Mis(q: Missing100): [number, MisconceptionId][] {
  switch (q.family) {
    case 'addendCross20': return [[q.a + q.c, 'equalsAsAnswer']]
    case 'toHundred': {
      const dc = digitComplement(q.a)
      const own: [number, MisconceptionId] = q.form === 'addend' ? [q.a + 100, 'equalsAsAnswer'] : [100 + q.a, 'wrongOperation']
      return dc === null ? [own] : [own, [dc, 'digitComplement10']]
    }
    case 'subtrahend': return [[q.c + q.d, 'wrongOperation']]
    case 'minuend': return [[Math.abs(q.d - q.b), 'wrongOperation']]
  }
}

/** The numbers of the question. */
export const missing100Numbers = (q: Missing100): number[] => missing100Tokens(q).filter((t): t is number => typeof t === 'number')

// ─── Shared: the answer of an arithmetic task from its card and its voice ──

/** The asked number read off the card: the equation after "så" (or the only one), solved. */
export function cardAnswer(p: Prompt): number | null {
  if (p.scene === 'equation') {
    const eqs = termTokens(p.terms)
    return solveTokens(eqs[eqs.length - 1])
  }
  const b = balanceTokens(p)
  return b ? solveTokens([...b[0], '=', ...b[1]]) : null
}

/**
 * Strategy hints say only true arithmetic (SPEC §3.5: the hint is how the child is helped): for every
 * tag and kind, each spoken statement "a op b giver c" is true, "Svaret er …" names the answer, and a
 * number line drawn holds its hops.
 */
export function hintArithmetic(def: SkillDef, facts: readonly Fact[], tags: readonly (ErrorTag | null)[]): string[] {
  const out = new Set<string>()
  for (const f of facts) {
    for (const tag of tags) {
      for (const kind of [undefined, ...def.kinds]) {
        const h = def.hint(f, tag, kind)
        const where = `${f.id} hint(${String(tag)}${kind ? `, ${kind}` : ''})`
        // the hops on the empty number line: "Start på 38. Hop to frem til 40. Hop fem frem til 45."
        let at: number | null = null
        let start: number | null = null
        for (const s of sentences(spokenText(h.speech))) {
          const st = /^Start på (.+)\.$/.exec(s)
          if (st) {
            const n = spokenTokens(st[1])
            at = start = n.length === 1 && typeof n[0] === 'number' ? n[0] : null
          }
          const hop = /^Hop (\S+) (frem|tilbage) til (.+)\.$/.exec(s)
          if (hop) {
            const d = spokenTokens(hop[1])[0]
            const to = spokenTokens(hop[3])
            const lands = at !== null && typeof d === 'number' ? at + (hop[2] === 'frem' ? d : -d) : null
            if (lands === null || to.length !== 1 || to[0] !== lands) out.add(`${where}: "${s}" from ${at}`)
            at = to.length === 1 && typeof to[0] === 'number' ? to[0] : null
          }
          const together = /^Hoppene giver tilsammen (.+)\.$/.exec(s)
          if (together && at !== null && start !== null) {
            const n = spokenTokens(together[1])
            if (n.length !== 1 || n[0] !== Math.abs(at - start)) out.add(`${where}: "${s}", the hops go from ${start} to ${at}`)
          }
          const toks = spokenTokens(s)
          if (toks.includes('=') && !toks.includes('?') && statementTrue(toks) === false) out.add(`${where}: "${s}" is not true`)
          // "Svaret er …" and "Hoppene giver tilsammen …" name the answer
          const said = /^(?:Svaret er|Hoppene giver tilsammen) (.+)\.$/.exec(s)
          if (said && typeof f.answer === 'number' && kind !== 'fillSlots') {
            const n = spokenTokens(said[1])
            if (n.length !== 1 || n[0] !== f.answer) out.add(`${where}: "${s}", the answer is ${f.answer}`)
          }
          // "Så giver tolv minus fem syv." (the family's other fact)
          const so = /^Så giver (.+)\.$/.exec(s)
          if (so) {
            const t = spokenTokens(so[1])
            const x = t.length === 4 && typeof t[0] === 'number' && typeof t[2] === 'number' ? apply(t[0], t[1], t[2]) : null
            if (x === null || x !== t[3]) out.add(`${where}: "${s}" is not true`)
          }
          // "Tre grupper med fire er tolv."
          const grp = /^(\S+) grupper med (\S+) er (\S+)\.$/i.exec(s)
          if (grp) {
            const [g, n, x] = [grp[1], grp[2], grp[3]].map((w) => spokenTokens(w)[0])
            if (typeof g !== 'number' || typeof n !== 'number' || g * n !== x) out.add(`${where}: "${s}" is not true`)
          }
        }
        const v = h.visual
        if (v.scene === 'line') {
          if (!(v.min < v.max)) out.add(`${where}: a line ${v.min}–${v.max}`)
          for (const x of v.hops ?? []) if (x < v.min || x > v.max) out.add(`${where}: the hop ${x} is off the line ${v.min}–${v.max}`)
        }
      }
    }
  }
  return [...out]
}

/** SPEC §4.3: the eight misconceptions whose hint is animated. */
export const ANIMATED_HINTS: readonly MisconceptionId[] = [
  'digitSwap', 'forgotCarry', 'smallerFromLarger', 'borrowNoDecrement', 'equalsAsAnswer', 'halfPastNext', 'tableNeighbour', 'concatNumberWords',
]

/** A misconception's own hint is marked animated exactly when SPEC §4.3 lists it. */
export function animationChecks(def: SkillDef, facts: readonly Fact[], tags: readonly (ErrorTag | null)[]): string[] {
  const out = new Set<string>()
  for (const f of facts) {
    for (const tag of tags) {
      for (const kind of [undefined, ...def.kinds]) {
        const h = def.hint(f, tag, kind)
        if (!h.misconception) continue
        const want = ANIMATED_HINTS.includes(h.misconception)
        if (!!h.animated !== want) out.add(`${def.id} hint(${String(tag)}${kind ? `, ${kind}` : ''}): ${h.misconception} ${h.animated ? 'animated' : 'not animated'}`)
      }
    }
  }
  return [...out]
}

/** The asked number from what the voice says: the sentence with "hvad" solved; every other sentence must be true. */
export function spokenAnswer(t: Task): { answer: number | null; problems: string[] } {
  const text = spokenText(t.speech)
  const problems: string[] = []
  let answer: number | null = null
  for (const s of sentences(text)) {
    const toks = spokenTokens(s)
    if (toks.includes('?')) {
      const x = solveTokens(toks)
      if (x === null) problems.push(`"${s}" has no one answer`)
      else answer = x
    } else if (toks.includes('=') && statementTrue(toks) === false) problems.push(`"${s}" is not true`)
  }
  return { answer, problems }
}
