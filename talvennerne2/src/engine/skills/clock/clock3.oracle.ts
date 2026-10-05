// Independent oracles for the clock skills of 3. klasse (clockFive, clockDigital, clockElapsed), ORK3c, and the
// small wave-3 kit the kronerOre and convertCmM oracles share: the oracle's own seeds and sweep, SPEC §2.2's kinds,
// guess rates and §3.2's speed for the dial, the purse and the keys, SPEC §10.1's phrases for every five-minute
// time (the "halv" form too), digital readings in 12 and 24 hours, amounts and lengths, and a child kept to one
// idea — worked out by the oracle, set on the dial, paid from the purse — for the real diagnostics.
//
// Written by another agent than the generators (SPEC A5, §15.1): every right answer is worked out here from what
// the child is given — the fact id, the time said, the hands and digits drawn on the prompt and on the cards —
// and never from the generator code. Wrong clocks are explained with pædagogik §3.2's formulas, per skill as
// SPEC §4.2 (pædagogik §3.2's skill column) gives them:
//   clockFive     quarterDirection  "over" and "i" swapped: the time mirrored around the hour or half hour the
//                                   phrase counts from (fem minutter over tre ↔ fem minutter i tre)
//                 halfPastNext      a "halv" phrase with "halv tre" taken as 3:30: + 60
//                 hourHandMisread   past the half hour the short hand is near the next number: the clock an hour
//                                   earlier is the one that looks like the time (pædagogik: "aflæsning")
//                 handsSwapped      the clock with the hands' roles swapped (isSwappedClock); on the dial it can
//                                   only be set where it falls on the step
//   clockDigital  hourHandMisread   reading the analog clock onto a digital card: + 60; setting the dial from the
//                                   digital clock: − 60 (the short hand put on the hour number)
//                 handsSwapped      reading: the swapped clock; setting: the long hand on the hour number and the
//                                   short hand on the minutes' number (3:00 → 12:15)
//                 halfPastNext      only the 24-hour cards, where the time is said and the phrase has "halv"
//   clockElapsed  wrongOperation    the hands turned the other way ("om lidt" ↔ "for lidt siden"), unless the
//                                   same clock is the likelier slip of leaving the hour behind across the hour
//                 halfPastNext      a start on "halv", taken as the hour after
// The registry skips *.oracle.ts files, so none of this reaches the app.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AnswerLogEntry, AnswerValue, ErrorTag, Fact, MisconceptionId, SkillDef, SkillId, SpeechPart, Task, TaskKind } from '../../types'
import { classifyAnswer, detectableOf, flaggedIds, updateMisconceptions, type MisconceptionStates } from '../../misconceptions'
import { keysForNode } from '../../registry'
import { NODE_BY_ID } from '../../../content/curriculum'
import { isCorrect } from '../../answer'
import { ceilingFor, defaultFastMs, guessP, isProduction } from '../../kinds'
import { hashSeed, makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import { clipText, hasClip } from '../../../speech/catalog'
import { OptionFace } from '../../../ui/task/faces'
import { PromptScene } from '../../../ui/scenes/PromptScene'
import { purseOf } from '../../../ui/task/pay/logic'
import { isMisconception, tasksOf, type Built } from '../number/number.oracle'
import { spec101Words, word99 } from '../number/number2.oracle'
import { cardNumbers, swapped } from '../algebra/algebra2.oracle'
import type { Child } from '../addsub/addsub3.oracle'
import { isSwappedClock, lookDifferent, handsAt, onDial, spec101Measure, spec101Money } from './clock.oracle'

// ═══ The wave-3 kit (ORK3c) ═══════════════════════════════════════════════════

/** 200 seeded instances per family, from this oracle's own seeds (SPEC §15.1). */
export function instancesC(def: SkillDef, perFamily = 200): Map<string, Fact[]> {
  const out = new Map<string, Fact[]>()
  for (const fam of def.families) {
    const rng = makeRng(hashSeed(`ork3c:${def.id}/${fam.id}`))
    out.set(fam.id, Array.from({ length: perFamily }, () => def.instance!(fam, rng, new Set())))
  }
  return out
}

/** The canonical facts (several deals each) and 200 instances per family (one deal each), plus a deal aimed at each misconception. */
export function sweepC(def: SkillDef, seeds = 3) {
  const canon = def.enumerate()
  const instances = def.mode === 'procedure' ? instancesC(def) : new Map<string, Fact[]>()
  const drawn = [...instances.values()].flat()
  return { canon, instances, all: [...canon, ...drawn], built: [...tasksOf(def, canon, seeds), ...tasksOf(def, drawn, 1)] }
}

/** Facts of the families a region plays (Markedet's 3. klasse families of 2. klasse skills), swept like sweepC. */
export function sweepFamilies(def: SkillDef, families: readonly string[], seeds = 3) {
  const canon = def.enumerate().filter((f) => families.includes(f.family))
  const drawn = def.mode === 'procedure' ? [...instancesC(def).entries()].filter(([fam]) => families.includes(fam)).flatMap(([, fs]) => fs) : []
  return { canon, all: [...canon, ...drawn], built: [...tasksOf(def, canon, seeds), ...tasksOf(def, drawn, 1)] }
}

/** Instance ids: one id never names two instances, and every family draws many different ones. */
export function instanceProblems(def: SkillDef, instances: ReadonlyMap<string, readonly Fact[]>, atLeast: (family: string) => number): string[] {
  const out: string[] = []
  const seen = new Map<string, string>()
  for (const [fam, facts] of instances) {
    for (const f of facts) {
      const key = JSON.stringify([f.family, f.operands, f.answer, f.data ?? null])
      if ((seen.get(f.id) ?? key) !== key) out.push(`${def.id} ${f.id}: two different instances share the id`)
      seen.set(f.id, key)
    }
    const distinct = new Set(facts.map((f) => f.id)).size
    if (distinct < atLeast(fam)) out.push(`${def.id}/${fam}: ${distinct} different instances in ${facts.length} draws, expected ≥ ${atLeast(fam)}`)
  }
  return out
}

// ─── SPEC §2.2: the kinds of the five skills and the 3. klasse families Markedet plays ───

export const SPEC_KINDS_C: Readonly<Partial<Record<SkillId, { kinds: readonly TaskKind[]; production: readonly TaskKind[] }>>> = {
  clockFive: { kinds: ['choice', 'clockSet'], production: ['clockSet'] },
  clockDigital: { kinds: ['choice', 'clockSet'], production: ['clockSet'] },
  clockElapsed: { kinds: ['choice', 'clockSet'], production: ['clockSet'] },
  kronerOre: { kinds: ['choice', 'pay'], production: ['pay'] },
  convertCmM: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  payExact: { kinds: ['pay', 'choice'], production: ['pay'] },
  change: { kinds: ['choice', 'keypad', 'pay'], production: ['keypad', 'pay'] },
  unitChoice: { kinds: ['choice', 'multiSelect'], production: ['multiSelect'] },
}

/**
 * The minute hand's step on each 3. klasse dial (SPEC §3.2 clockSet: "snapper til skillens trin"): five minutes
 * for clockFive and clockDigital, whose times are any five minutes; a quarter for clockElapsed, whose starts and
 * answers are quarter hours (pædagogik §1.3: "start på kvarter").
 */
export const CLOCK_STEP3: Readonly<Partial<Record<SkillId, 15 | 5>>> = { clockFive: 5, clockDigital: 5, clockElapsed: 15 }

// ─── SPEC §3.2–3.3 and A14: guess rate, production, ceiling and speed ──────

const MANIPULATIVE_ONLY_FOR: Readonly<Partial<Record<TaskKind, readonly SkillId[]>>> = {
  share: ['shareEqually', 'fractionOfSet'], buildBase: ['tensOnes', 'placeValue1000'], countTap: ['count10', 'count20'],
}

/**
 * SPEC §3.2's guessP read off what the child is given: one in the cards; the dial's step out of the 720
 * minutes it shows (a 24-hour time is set on the same dial, CONVENTIONS); 0.01 for paying from a purse; one in
 * the numbers the keys take — in kroner on a money keypad (A14: 0–100 kr is 101 answers, not 10001); one in
 * the non-empty subsets of the things.
 */
export function guessC(t: Task): number {
  switch (t.kind) {
    case 'choice':
      return 1 / t.options.length
    case 'clockSet':
      return CLOCK_STEP3[t.skill]! / 720
    case 'pay':
      return 0.01
    case 'keypad': {
      const scale = t.answerType === 'ore' ? 100 : 1
      return 1 / (Math.floor(t.range[1] / scale) - Math.ceil(t.range[0] / scale) + 1)
    }
    case 'multiSelect':
      return 1 / (2 ** t.options.length - 1)
    default:
      throw new Error(`no oracle guess rate for ${t.kind}`)
  }
}
export const productionC = (t: Task): boolean => guessC(t) <= 0.12 && (MANIPULATIVE_ONLY_FOR[t.kind]?.includes(t.skill) ?? true)
export const ceilingC = (t: Task): 2 | 3 | 5 => (productionC(t) ? 5 : guessC(t) >= 0.5 ? 2 : 3)

/** The engine's guessP, isProduction and ceilingFor against the oracle's, per task. */
export function productionProblemsC(built: readonly Built[]): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) {
    const where = `${fact.skill} ${fact.id} ${kind}`
    if (Math.abs(guessP(task) - guessC(task)) > 1e-12) out.add(`${where}: guessP ${guessP(task)}, oracle ${guessC(task)}`)
    if (isProduction(task) !== productionC(task)) out.add(`${where}: isProduction ${isProduction(task)}, oracle ${productionC(task)}`)
    if (ceilingFor(task) !== ceilingC(task)) out.add(`${where}: ceiling ${ceilingFor(task)}, oracle ${ceilingC(task)}`)
  }
  return [...out]
}

/** SPEC §2.2 per skill: its kinds; a starred kind production for ≥ 90 % of its tasks, the others never. */
export function specKindProblemsC(def: SkillDef, built: readonly Built[]): string[] {
  const spec = SPEC_KINDS_C[def.id]
  if (!spec) return [`${def.id}: not in the oracle's SPEC §2.2 table`]
  const out: string[] = []
  if ([...def.kinds].sort().join(',') !== [...spec.kinds].sort().join(',')) out.push(`${def.id}: kinds ${def.kinds}, SPEC ${spec.kinds}`)
  for (const kind of def.kinds) {
    const own = built.filter((b) => b.kind === kind)
    if (own.length === 0) continue
    const share = own.filter((b) => productionC(b.task)).length / own.length
    if (spec.production.includes(kind) && share < 0.9) out.push(`${def.id} ${kind}: production for ${(share * 100).toFixed(1)} %, SPEC wants ≥ 90 %`)
    if (!spec.production.includes(kind) && share > 0) out.push(`${def.id} ${kind}: production for ${(share * 100).toFixed(1)} %, SPEC says never`)
  }
  return out
}

const digitCount = (n: number): number => String(Math.floor(Math.abs(n))).length

const fewestTables = new Map<string, number[]>()
/** Pieces in the fewest way to pay `ore` from `purse` (counted, not greedy); Infinity when it cannot. */
export function fewestCount(ore: number, purse: readonly number[]): number {
  if (!Number.isInteger(ore) || ore < 0 || ore % 50 !== 0) return Infinity
  const key = [...purse].sort((a, b) => a - b).join(',')
  let best = fewestTables.get(key)
  if (!best || best.length <= ore / 50) {
    const size = Math.max(ore / 50 + 1, 2 * (best?.length ?? 0), 401)
    best = new Array<number>(size).fill(Infinity)
    best[0] = 0
    for (let i = 1; i < size; i++) for (const p of purse) if (p % 50 === 0 && p > 0 && p / 50 <= i) best[i] = Math.min(best[i], best[i - p / 50] + 1)
    fewestTables.set(key, best)
  }
  return best[ore / 50]
}

/**
 * SPEC §3.2's speed for a task: choice 5 s + 1.5 s per digit over one (a number or an amount on the card; a clock
 * or a coin set has no digits to read, so 5 s); keypad 6 s + 2 s per digit over one (SPEC's family list:
 * add100Carry/sub100Borrow 15 s, add1000/sub1000 25 s, mulTens 10 s); clockSet 12 s on whole and half hours, 18 s
 * on quarters and five minutes; pay 5 s + 2.5 s per piece in the fewest payment; multiSelect 2 s a thing.
 */
export function specFastC(t: Task): number {
  const n = typeof t.answer === 'number' ? t.answer : null
  switch (t.kind) {
    case 'choice':
      if (n === null || t.answerType === 'minutes') return 5_000
      return 5_000 + 1_500 * ((t.answerType === 'ore' ? digitCount(n / 100) + (n % 100 ? 2 : 0) : digitCount(n)) - 1)
    case 'keypad':
      return 6_000 + 2_000 * (digitCount((n ?? 0) / (t.answerType === 'ore' ? 100 : 1)) - 1)
    case 'clockSet':
      return (CLOCK_STEP3[t.skill] ?? 60) >= 30 ? 12_000 : 18_000
    case 'pay': {
      const amount = n ?? String(t.answer).split('|').reduce((s, tok) => s + Number(tok.slice(1)), 0)
      const pieces = n === null ? String(t.answer).split('|').length : fewestCount(amount, purseOf(t))
      return 5_000 + 2_500 * pieces
    }
    case 'multiSelect':
      return 2_000 * t.options.length
    default:
      throw new Error(`no SPEC speed for ${t.kind}`)
  }
}

/**
 * pædagogik §4.1 "Hastighed": the demand is locked (slow-but-right gives no progress), so a threshold must be
 * fair — never under SPEC §3.2's. A skill or family may give more time ("Familier kan overstyre tærsklen").
 */
export function fastProblemsC(def: SkillDef, built: readonly Built[]): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) {
    const ms = def.fastMs?.(fact, kind) ?? defaultFastMs(task)
    if (ms < specFastC(task)) out.add(`${fact.id} ${kind}: ${ms} ms to count as fast, SPEC §3.2 gives ${specFastC(task)} ms`)
  }
  return [...out]
}

// ─── SPEC §4.1 with A9 and A11: the tag a wrong value must get ─────────────

/** The numbers the child can see, in the units the keys take: an equation's numbers, the price tag and the money in kroner. */
function screenNumbers(t: Task): number[] {
  const p = t.prompt
  if (p.scene === 'shop') return [p.priceOre / 100, ...(p.paidOre !== undefined ? [p.paidOre / 100] : [])]
  if (p.scene === 'coins') return p.ore.map((o) => o / 100)
  return cardNumbers(p)
}

/**
 * SPEC §4.1 globalChecks outside the hear and place skills, on what the keys show: a typed answer of 13 or more
 * with its tens and ones swapped, when the swapped number is not on the screen. On a kroner keypad (entryScale 100)
 * the child types kroner: 63 kr typed as 36 is the swap (3600 øre), though 6300 øre itself has no tens to swap.
 */
export function typedSwapC(t: Task): number | null {
  if (t.kind !== 'keypad' || typeof t.answer !== 'number') return null
  const typed = t.answer / t.entryScale
  const s = Number.isInteger(typed) && typed >= 13 ? swapped(typed) : null
  return s !== null && !screenNumbers(t).includes(s) ? s * t.entryScale : null
}

/** What explains a wrong value. */
export interface WhyC {
  mis: readonly MisconceptionId[]
  /** A number from the question: the hour heard, the start clock, the price of one, a number on the card. */
  operand?: boolean
  /** A likelier plain slip gives the same value (the hour hand left behind across the hour): never evidence. */
  slip?: boolean
  /** A misconception the value may or may not be counted as (a swap on the dial between two steps). */
  maybe?: MisconceptionId
  /**
   * A plain error the oracle also knows for the value (the card's numbers taken away as they stand): where it meets
   * the typed swap, SPEC §4.1 stops at the skill's own candidate before globalChecks, so the swap may be plain.
   */
  plain?: boolean
}

/**
 * SPEC §4.1 with A9 and A11: two misconceptions make a value 'ambiguous'; one is its own tag unless the value is
 * also a number from the question (A9) or the typed answer with its tens and ones swapped (A11) — then
 * 'ambiguous' — or a likelier plain slip (never evidence: 'ambiguous' or a plain tag); a number from the question
 * alone is 'operand'; the typed swap alone 'digitSwap'; anything else plain ('near' or 'other').
 */
export function expectC(t: Task, v: AnswerValue, w: WhyC): readonly ErrorTag[] | 'plain' {
  const mis = [...new Set(w.mis)]
  const swap = typeof v === 'number' && typedSwapC(t) === v
  if (mis.length > 1) return ['ambiguous']
  if (mis.length === 1) {
    if (w.operand || swap) return ['ambiguous']
    if (w.slip) return ['ambiguous', 'near', 'other']
    return w.maybe ? [mis[0], 'ambiguous'] : [mis[0]]
  }
  if (w.maybe) return [w.maybe, 'ambiguous', 'near', 'other', ...(w.operand ? ['operand' as const] : []), ...(swap ? ['digitSwap' as const] : [])]
  if (w.operand) return ['operand']
  if (swap) return w.plain ? ['digitSwap', 'near', 'other'] : ['digitSwap']
  return 'plain'
}

/** classifyAnswer against the oracle; a problem or null. */
export function tagCheckC(t: Task, v: AnswerValue, w: WhyC, how: string): string | null {
  const got = classifyAnswer(t, v)
  const where = `${t.factId} ${t.kind} ${how} ${String(v)} (answer ${String(t.answer)})`
  if (got === null) return `${where}: classified as right`
  const want = expectC(t, v, w)
  if (want === 'plain') return got === 'near' || got === 'other' ? null : `${where}: ${got}, the oracle has a plain error`
  return want.includes(got) ? null : `${where}: ${got}, expected ${want.join(' or ')}`
}

/** The misconception a value counts as for the oracle (null when none is certain). */
export function countsAs(t: Task, v: AnswerValue, w: WhyC): MisconceptionId | null {
  const want = expectC(t, v, w)
  return want !== 'plain' && want.length === 1 && isMisconception(want[0]) ? want[0] : null
}

/**
 * Every value a task can be answered with that the oracle or the skill has anything to say about: the cards; the
 * dial's steps (and the same clock once more round); trays the purse can pay, in øre (whole kroner without
 * halvtredsører); on the keys, the values the skill tags, the oracle's own and the typed swap (every other typed
 * value is 'other' by construction, and plain for the oracle too).
 */
export function givenValues(t: Task, specials: readonly number[] = []): AnswerValue[] {
  if (t.kind === 'choice') return [...t.options]
  if (t.kind === 'clockSet') {
    const step = CLOCK_STEP3[t.skill] ?? 60
    return Array.from({ length: (2 * 720) / step }, (_, i) => i * step)
  }
  if (t.kind === 'pay') {
    if (typeof t.answer !== 'number') return []
    const purse = purseOf(t)
    const unit = Math.min(...purse)
    return Array.from({ length: Math.floor(t.range[1] / unit) + 1 }, (_, i) => i * unit).filter((v) => fewestCount(v, purse) <= 24)
  }
  if (t.kind === 'keypad') {
    const top = 10 ** t.maxDigits * t.entryScale - 1
    const swap = typedSwapC(t)
    const keys = Object.keys(t.distractorTags).filter((k) => /^\d+$/.test(k)).map(Number)
    const all = [...specials, ...keys, ...(swap !== null ? [swap] : [])]
    return [...new Set(all)].filter((v) => Number.isInteger(v) && v >= 0 && v <= top && v % t.entryScale === 0)
  }
  return []
}

/** Classification of every value the task can be given, by the oracle. `right` overrides what counts as right. */
export function classifyC(built: readonly Built[], why: (b: Built, v: AnswerValue) => WhyC, specials: (b: Built) => readonly number[] = () => []): string[] {
  const out = new Set<string>()
  for (const b of built) {
    const t = b.task
    for (const v of givenValues(t, specials(b))) {
      if (isCorrect(t, v)) {
        if (classifyAnswer(t, v) !== null) out.add(`${t.factId} ${t.kind} ${String(v)}: right, classified ${classifyAnswer(t, v)}`)
        continue
      }
      const p = tagCheckC(t, v, why(b, v), t.kind === 'choice' ? 'card' : t.kind === 'clockSet' ? 'set' : t.kind === 'pay' ? 'paid' : 'typed')
      if (p) out.add(p)
    }
  }
  return [...out]
}

/**
 * SPEC §4.3 "Mulighed": the misconceptions some value the task takes can show (a card dealt, a clock the dial
 * sets, a sum the purse pays, a number the keys take), exactly — a value the oracle is unsure of ('maybe') may
 * be counted or not.
 */
export function detectableC(built: readonly Built[], why: (b: Built, v: AnswerValue) => WhyC, specials: (b: Built) => readonly number[] = () => []): string[] {
  const out = new Set<string>()
  for (const b of built) {
    const t = b.task
    const must = new Set<MisconceptionId>()
    const may = new Set<MisconceptionId>()
    for (const v of givenValues(t, specials(b))) {
      if (isCorrect(t, v)) continue
      const w = why(b, v)
      const m = countsAs(t, v, w)
      if (m) must.add(m)
      if (w.maybe && expectC(t, v, w) !== 'plain') may.add(w.maybe)
      const want = expectC(t, v, w)
      if (want !== 'plain' && want.length > 1) for (const x of want) if (isMisconception(x)) may.add(x)
    }
    const got = new Set(detectableOf(t))
    const show = (s: Iterable<MisconceptionId>) => [...s].sort().join(',') || '∅'
    const missing = [...must].filter((m) => !got.has(m))
    const extra = [...got].filter((m) => !must.has(m) && !may.has(m))
    if (missing.length > 0 || extra.length > 0) out.add(`${t.factId} ${t.kind} [${t.options.join(', ')}]: detectable ${show(got)}, the oracle ${show(must)}${may.size ? ` (may: ${show(may)})` : ''}`)
  }
  return [...out]
}

/** A card set shows a diagnostic card whenever the oracle knows one among the values a card may show. */
export function diagnosticCardsC(built: readonly Built[], known: (b: Built) => readonly AnswerValue[], why: (b: Built, v: AnswerValue) => WhyC): string[] {
  const out: string[] = []
  for (const b of built) {
    const t = b.task
    if (t.kind !== 'choice') continue
    const shows = (v: AnswerValue) => {
      if (isCorrect(t, v)) return false
      if (typeof v === 'number') {
        const n = t.modulo ? ((v % t.modulo) + t.modulo) % t.modulo : v
        if (n < t.range[0] || n > t.range[1]) return false
      }
      const w = why(b, v)
      // a card the oracle allows as diagnostic (a swap on the edge between two geared clocks) counts too
      return countsAs(t, v, w) !== null || (w.maybe !== undefined && classifyAnswer(t, v) === w.maybe)
    }
    const could = [...new Set(known(b))].filter(shows)
    if (could.length > 0 && !t.options.some(shows)) out.push(`${t.factId}: no diagnostic card among [${t.options.join(', ')}] (could be ${could.join(', ')})`)
  }
  return out
}

// ─── SPEC §10.1: times, amounts and lengths as said ────────────────────────

const DIAL = 720
/** The dial position of a whole hour 1–12. */
export const hourAt3 = (h: number): number => (h % 12) * 60
/** "et" in "klokken et" and "halv et" (SPEC §10.1 Køn); the other hours as numbers. */
const hourWord = (h: number): string => spec101Words(h, h === 1 ? 'n' : 'c')
/** The hour the short hand has passed, 1–12. */
export const hourPassed = (t: number): number => Math.floor(onDial(t) / 60) || 12

/** SPEC §10.1 Klokken, every five minutes: the lead-in and whether it names the next hour. */
const LEADS: readonly (readonly [lead: string, next: boolean])[] = [
  ['', false], ['fem minutter over', false], ['ti minutter over', false], ['kvart over', false], ['tyve minutter over', false],
  ['fem minutter i halv', true], ['halv', true], ['fem minutter over halv', true], ['tyve minutter i', true], ['kvart i', true],
  ['ti minutter i', true], ['fem minutter i', true],
]

/** SPEC §10.1's analog phrase for a five-minute time; `halfForm` says :20 and :40 with "halv" (the table's parenthesis). */
export function spec101Clock5(minutes: number, halfForm = false): string {
  const t = onDial(minutes)
  const m = t % 60
  if (m % 5 !== 0) throw new Error(`SPEC §10.1 has analog phrases in five-minute steps only (${minutes})`)
  const h = hourPassed(t)
  const next = (h % 12) + 1
  if (halfForm && m === 20) return `ti minutter i halv ${hourWord(next)}`
  if (halfForm && m === 40) return `ti minutter over halv ${hourWord(next)}`
  const [lead, toNext] = LEADS[m / 5]
  const hour = hourWord(toNext ? next : h)
  return lead ? `${lead} ${hour}` : hour
}

/** A time as the child hears it. */
export interface Said5 {
  /** The time on the dial, 0–719. */
  minutes: number
  /** The hour the phrase names, 1–12 ("halv tre" names three). */
  hour: number
  /** What the phrase counts from: the hour named, or the half hour before it ("halv"). */
  ref: number
  dir: 'over' | 'i' | null
  by: number
  halv: boolean
}

const bareWords = (s: string): string[] => s.toLowerCase().replace(/[.,?!]/g, ' ').trim().split(/\s+/).filter((w) => w !== '')

/**
 * A Danish clock phrase: "[N minutter | kvart] [over | i] [halv] H". "halv tre" is half an hour before three
 * (2:30), "fem minutter i halv tre" five minutes before that (2:25), "ti minutter over halv tre" 2:40.
 */
export function timeOfPhrase5(phrase: string): Said5 | null {
  const w = bareWords(phrase)
  const h = w.length > 0 ? word99(w[w.length - 1]) : null
  if (h === null || h < 1 || h > 12) return null
  let i = w.length - 2
  const halv = w[i] === 'halv'
  if (halv) i--
  const ref = onDial(hourAt3(h) - (halv ? 30 : 0))
  if (i < 0) return { minutes: ref, hour: h, ref, dir: null, by: 0, halv }
  const dir = w[i]
  if (dir !== 'over' && dir !== 'i') return null
  let by: number
  if (i === 1 && w[0] === 'kvart') by = 15
  else if (i === 2 && w[1] === 'minutter') {
    const n = word99(w[0])
    if (n === null || n < 1 || n >= 30) return null
    by = n
  } else return null
  return { minutes: onDial(ref + (dir === 'over' ? by : -by)), hour: h, ref, dir, by, halv }
}

/** SPEC §10.1: a digital clock read as it shows the time, "fjorten femogfyrre", "fjorten nul fem", "tretten nul nul". */
export function spec101Digital(h: number, m: number): string {
  const hour = hourWord(h)
  if (m === 0) return `${hour} nul nul`
  return m < 10 ? `${hour} nul ${spec101Words(m)}` : `${hour} ${spec101Words(m)}`
}

/** "fjorten femogfyrre" → 14:45, "tolv nul fem" → 12:05 (hours and minutes as the digits show them). */
export function timeOfDigital(words: string): { h: number; m: number } | null {
  const w = bareWords(words)
  const h = w.length > 0 ? word99(w[0]) : null
  if (h === null || h > 23) return null
  if (w.length === 3 && w[1] === 'nul') {
    const m = w[2] === 'nul' ? 0 : word99(w[2])
    return m !== null && m <= 9 ? { h, m } : null
  }
  const m = w.length === 2 ? word99(w[1]) : null
  return m !== null && m >= 10 && m <= 59 ? { h, m } : null
}

/** SPEC §10.1 Dagtid: 5–11 "om morgenen", 12–17 "om eftermiddagen", 18–23 "om aftenen". */
export function dayPartOf(hour24: number): string | null {
  if (hour24 >= 5 && hour24 <= 11) return 'om morgenen'
  if (hour24 >= 12 && hour24 <= 17) return 'om eftermiddagen'
  if (hour24 >= 18 && hour24 <= 23) return 'om aftenen'
  return null
}

const bare = (s: string): string => bareWords(s).join(' ')

/** The phrase SPEC §10.1 wants for a clock (every style), money or measure part; null for other parts. */
export function specPhrase3(part: SpeechPart): string | null {
  if ('clock' in part) {
    const { minutes, style } = part.clock
    if (style === 'digital') return spec101Digital(Math.floor(minutes / 60) % 24, minutes % 60)
    return spec101Clock5(minutes, style === 'analogHalfForm')
  }
  if ('money' in part) return spec101Money(part.money.ore)
  if ('measure' in part) return spec101Measure(part.measure.value, part.measure.unit)
  if ('num' in part) return spec101Words(part.num, part.gender)
  return null
}

/** Every time, amount, length and number of these parts is SPEC §10.1's phrase, in the text and in the recorded clips. */
export function normalisedProblems3(parts: readonly SpeechPart[], where: string): string[] {
  const out: string[] = []
  for (const part of parts) {
    const want = specPhrase3(part)
    if (want === null) continue
    const c = compile([part])
    if (bare(c.text) !== want) out.push(`${where}: ${JSON.stringify(part)} says "${c.text}", SPEC §10.1 "${want}"`)
    if (c.missing.length > 0) out.push(`${where}: ${JSON.stringify(part)} has no clip ${c.missing}`)
    const recorded = bare(c.clips.map((id) => (hasClip(id) ? clipText(id) : `<${id}>`)).join(' '))
    if (recorded !== want) out.push(`${where}: the clips of ${JSON.stringify(part)} say "${recorded}", SPEC §10.1 "${want}"`)
  }
  return out
}

/** The tasks' and the hints' times, amounts and lengths as SPEC §10.1 says them (every tag, every kind). */
export function normalisationProblems3(def: SkillDef, built: readonly Built[], facts: readonly Fact[], tags: readonly (ErrorTag | null)[]): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) for (const p of normalisedProblems3(task.speech, `${fact.id} ${kind}`)) out.add(p)
  for (const f of facts) {
    for (const tag of tags) {
      for (const kind of [undefined, ...def.kinds]) {
        for (const p of normalisedProblems3(def.hint(f, tag, kind).speech, `${f.id} hint(${String(tag)}${kind ? `, ${kind}` : ''})`)) out.add(p)
      }
    }
  }
  return [...out]
}

/** SPEC A12/A19: no division here, so no task or hint of 3. klasse says "delt med" (and none says "divideret med" either). */
export function divisionWordProblems(def: SkillDef, built: readonly Built[], facts: readonly Fact[], tags: readonly (ErrorTag | null)[]): string[] {
  const out = new Set<string>()
  const texts: [string, string][] = built.map(({ fact, kind, task }) => [`${fact.id} ${kind}`, compile(task.speech).text])
  for (const f of facts) for (const tag of tags) texts.push([`${f.id} hint(${String(tag)})`, compile(def.hint(f, tag).speech).text])
  for (const [where, text] of texts) if (/delt med|divideret med/i.test(text)) out.add(`${where}: "${text}"`)
  return [...out]
}

// ─── What the child sees: the drawn clocks, coins and price tags ───────────

export const markupOfPrompt = (t: Task): string => renderToStaticMarkup(createElement(PromptScene, { prompt: t.prompt, task: t }))
export const markupOfCard = (t: Task, value: AnswerValue): string => renderToStaticMarkup(createElement(OptionFace, { task: t, value, size: 'md' }))

/** The time an analog clock in the markup shows: its two hands (the short one first), on the dial; null when not one geared clock. */
export function drawnAnalog(html: string): number | null {
  const rot = [...html.matchAll(/rotate\((-?[\d.]+) 100 100\)/g)].map((m) => Number(m[1]))
  if (rot.length !== 2) return null
  const t = Math.round(rot[0] * 2)
  return Math.abs((onDial(t) % 60) * 6 - rot[1]) < 0.02 ? onDial(t) : null
}

/** The digits a digital clock in the markup shows ("14:45"), or null. */
export function drawnDigital(html: string): string | null {
  const texts = [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1])
  return texts.length === 2 ? `${texts[0]}:${texts[1]}` : null
}

/** The coins drawn in the markup, read off each coin's own label ("20 KR", "50 ØRE"), in øre. */
export function drawnCoins(html: string): number[] {
  return html.split('<svg').slice(1).flatMap((chunk) => {
    const label = /(\d+) (KR|ØRE)/.exec(chunk.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '))
    return label ? [Number(label[1]) * (label[2] === 'KR' ? 100 : 1)] : []
  })
}

// ═══ The clock skills ════════════════════════════════════════════════════════

/**
 * Two clocks a child tells apart: the long hands more than a few minutes apart (24°, four minutes) or the short hands
 * about an hour apart (24°: a geared short hand an hour on, give or take the minutes). Two cards an hour apart are
 * what hourHandMisread is tested with, so they must count as different.
 */
export const tellApart = (a: number, b: number): boolean => {
  const gap = (x: number, y: number) => Math.min(Math.abs(x - y) % 360, 360 - (Math.abs(x - y) % 360))
  const ha = handsAt(a)
  const hb = handsAt(b)
  return gap(ha.long, hb.long) >= 24 || gap(ha.short, hb.short) >= 24
}

/** The 12-hour reading of a time on the dial, as a 12-hour digital clock shows it ("12:05", "2:45"). */
export const digital12 = (t: number): string => `${hourPassed(t)}:${String(onDial(t) % 60).padStart(2, '0')}`
/** A 24-hour time as a digital clock shows it ("14:45", "9:05"). */
export const digital24 = (m: number): string => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`

/** "Find uret, der viser klokken …" (cards) · "Stil uret, så klokken er …" (dial) → the time said. */
export function askedFive(text: string, kind: TaskKind): { said: Said5; phrase: string } | null {
  const m = kind === 'clockSet' ? /^Stil uret, så klokken er (.+)\.$/.exec(text) : /^Find uret, der viser klokken (.+)\.$/.exec(text)
  const said = m ? timeOfPhrase5(m[1]) : null
  return m && said ? { said, phrase: bare(m[1]) } : null
}

/** fem:<family>:<m>, the five-minute times of pædagogik §1.3 and SPEC §2.2 (halfForm: :20 and :40 said with "halv"). */
export const FIVE_PAST: Readonly<Record<string, readonly number[]>> = { over: [5, 10, 20], iHalv: [25], overHalv: [35], i: [40, 50, 55], halfForm: [20, 40] }

export function fiveOf(id: string): { family: string; t: number } | null {
  const m = /^fem:(over|iHalv|overHalv|i|halfForm):(\d+)$/.exec(id)
  if (!m) return null
  const t = Number(m[2])
  return t < DIAL && FIVE_PAST[m[1]].includes(t % 60) ? { family: m[1], t } : null
}

/** The phrase SPEC §10.1 says for a clockFive family's time: the "halv" form for halfForm, the table's otherwise. */
export const fivePhrase = (family: string, t: number): string => spec101Clock5(t, family === 'halfForm')

const swapCache = new Map<number, number[]>()
/** Every clock that is the time with its hands' roles swapped (normally one; two where a geared short hand sits on the edge). */
export function swappedClocks(t: number): number[] {
  const key = onDial(t)
  let out = swapCache.get(key)
  if (!out) {
    out = []
    for (let v = 0; v < DIAL; v++) if (isSwappedClock(key, v)) out.push(v)
    swapCache.set(key, out)
  }
  return out
}

/** handsSwapped for a value: certain when it is the one swapped clock, 'maybe' when it is one of two. */
function swapWhy(t: number, v: number): { mis: MisconceptionId[]; maybe?: MisconceptionId } {
  const all = swappedClocks(t)
  if (!all.includes(onDial(v))) return { mis: [] }
  return all.length === 1 ? { mis: ['handsSwapped'] } : { mis: [], maybe: 'handsSwapped' }
}

/** clockFive: a wrong clock for the time said (on the dial). */
export function explainFive(s: Said5, v: number): WhyC {
  const t = s.minutes
  const is = (x: number) => onDial(x) === onDial(v)
  const mis: MisconceptionId[] = []
  if (s.dir !== null && is(2 * s.ref - t)) mis.push('quarterDirection')
  if (s.halv && is(t + 60)) mis.push('halfPastNext')
  if (t % 60 > 30 && is(t - 60)) mis.push('hourHandMisread')
  const sw = swapWhy(t, v)
  mis.push(...sw.mis)
  return { mis, operand: is(hourAt3(s.hour)), ...(sw.maybe ? { maybe: sw.maybe } : {}) }
}

/** The clocks each clockFive idea gives for the time said (cards: every swapped clock; dial: the one on the step). */
export function fiveIdeas(s: Said5, step: number | null): Partial<Record<MisconceptionId, number[]>> {
  const t = s.minutes
  const swaps = swappedClocks(t).filter((v) => step === null || v % step === 0)
  return {
    quarterDirection: s.dir !== null ? [onDial(2 * s.ref - t)] : [],
    halfPastNext: s.halv ? [onDial(t + 60)] : [],
    hourHandMisread: t % 60 > 30 ? [onDial(t - 60)] : [],
    handsSwapped: swaps,
  }
}

// ─── clockDigital ───────────────────────────────────────────────────────────

/** dig:analogToDigital:<m> (a five-minute time on the dial) · dig:digital24:<m> (13:00–23:55, minutes after midnight). */
export function digitalOf(id: string): { family: string; t: number } | null {
  const m = /^dig:(analogToDigital|digital24):(\d+)$/.exec(id)
  if (!m) return null
  const t = Number(m[2])
  if (t % 5 !== 0) return null
  if (m[1] === 'analogToDigital') return t < DIAL ? { family: m[1], t } : null
  return t >= 780 && t <= 1435 ? { family: m[1], t } : null
}

export interface DigitalAsk {
  /** The time: on the dial (12-hour presentations) or minutes after midnight (24-hour). */
  t: number
  h24: boolean
  /** The analog phrase said on the 24-hour cards. */
  said?: Said5
}

/**
 * What a clockDigital task asks, from what the child is given: the analog clock drawn (12-hour cards), the time
 * said with its time of day (24-hour cards: "Klokken er kvart i tre om eftermiddagen."), the digital clock read
 * aloud (dial: "Det digitale ur viser fjorten femogfyrre."). Null when the parts disagree.
 */
export function askedDigital(t: Task, text: string, drawnTime: number | null): DigitalAsk | null {
  if (t.kind === 'clockSet') {
    const m = /^Det digitale ur viser (.+)\. Stil uret, så det viser det samme\.$/.exec(text)
    const d = m ? timeOfDigital(m[1]) : null
    if (!d) return null
    const h24 = d.h >= 13
    return { t: h24 ? d.h * 60 + d.m : onDial(d.h * 60 + d.m), h24 }
  }
  if (text === 'Find det digitale ur, der viser det samme.') return drawnTime === null ? null : { t: drawnTime, h24: false }
  const m = /^Klokken er (.+) (om morgenen|om eftermiddagen|om aftenen)\. Find det digitale ur, der viser det samme\.$/.exec(text)
  const said = m ? timeOfPhrase5(m[1]) : null
  if (!m || !said) return null
  // the time of day puts the dial time in the afternoon or the evening
  for (const t24 of [said.minutes + DIAL, said.minutes]) if (dayPartOf(Math.floor(t24 / 60)) === m[2]) return { t: t24, h24: true, said }
  return null
}

/** The hands put the other way round when a time is set from its digits: the long hand on the hour, the short on the minutes' number. */
export function setSwapped(t: number): number | null {
  const h = hourPassed(t)
  const mm = onDial(t) % 60
  const v = onDial(((mm / 5) % 12) * 60 + ((5 * h) % 60))
  return v !== onDial(t) && lookDifferent(handsAt(v), handsAt(t)) ? v : null
}

/** clockDigital: a wrong clock, per presentation (24-hour cards in minutes after midnight, the rest on the dial). */
export function explainDigital(q: DigitalAsk, kind: TaskKind, v: number): WhyC {
  const mm = q.t % 60
  if (kind === 'choice' && q.h24) {
    const mis: MisconceptionId[] = []
    if (q.said?.halv && v === q.t + 60) mis.push('halfPastNext')
    return { mis, operand: v === q.t - DIAL }
  }
  const is = (x: number | null) => x !== null && onDial(x) === onDial(v)
  const mis: MisconceptionId[] = []
  if (kind === 'choice') {
    if (mm >= 30 && is(q.t + 60)) mis.push('hourHandMisread')
    const sw = swapWhy(q.t, v)
    mis.push(...sw.mis)
    return { mis, ...(sw.maybe ? { maybe: sw.maybe } : {}) }
  }
  if (mm >= 30 && is(q.t - 60)) mis.push('hourHandMisread')
  if (is(setSwapped(q.t))) mis.push('handsSwapped')
  return { mis }
}

/** The values each clockDigital idea gives on this task. */
export function digitalIdeas(q: DigitalAsk, kind: TaskKind): Partial<Record<MisconceptionId, number[]>> {
  const mm = q.t % 60
  if (kind === 'choice' && q.h24) return { halfPastNext: q.said?.halv && q.t + 60 < 1440 ? [q.t + 60] : [] }
  if (kind === 'choice') return { hourHandMisread: mm >= 30 ? [onDial(q.t + 60)] : [], handsSwapped: swappedClocks(q.t) }
  const sw = setSwapped(q.t)
  return { hourHandMisread: mm >= 30 ? [onDial(q.t - 60)] : [], handsSwapped: sw === null ? [] : [sw] }
}

// ─── clockElapsed ───────────────────────────────────────────────────────────

const ELAPSED_D: Readonly<Record<string, number>> = { plusHour: 60, plusHalf: 30, plusQuarter: 15, minusHalf: -30 }

/** tid:<family>:<start>, the start a quarter hour on the dial. */
export function elapsedOf(id: string): { family: string; s: number; d: number; a: number } | null {
  const m = /^tid:(plusHour|plusHalf|plusQuarter|minusHalf):(\d+)$/.exec(id)
  if (!m) return null
  const s = Number(m[2])
  const d = ELAPSED_D[m[1]]
  return s < DIAL && s % 15 === 0 ? { family: m[1], s, d, a: onDial(s + d) } : null
}

/** The question's time span as the child hears it. */
const SPANS: readonly (readonly [RegExp, number])[] = [
  [/om en time\?$/, 60], [/om en halv time\?$/, 30], [/om et kvarter\?$/, 15], [/for en halv time siden\?$/, -30],
  [/hvad klokken er om en time\.$/, 60], [/hvad klokken er om en halv time\.$/, 30], [/hvad klokken er om et kvarter\.$/, 15],
  [/hvad klokken var for en halv time siden\.$/, -30],
]

export interface ElapsedAsk {
  said: Said5
  s: number
  d: number
  a: number
}

/** "Klokken er kvart over tre. Hvad er klokken om en halv time?" (or "Stil uret, så det viser, hvad klokken er …") → start, span, answer. */
export function askedElapsed(text: string, kind: TaskKind): ElapsedAsk | null {
  const m = /^Klokken er (.+?)\. (.+)$/.exec(text)
  const said = m ? timeOfPhrase5(m[1]) : null
  if (!m || !said) return null
  const asks = kind === 'clockSet' ? /^Stil uret, så det viser, hvad klokken (er|var) .+\.$/.test(m[2]) : /^Hvad (er|var) klokken .+\?$/.test(m[2])
  const span = SPANS.find(([re]) => re.test(m[2]))
  if (!asks || !span) return null
  return { said, s: said.minutes, d: span[1], a: onDial(said.minutes + span[1]) }
}

/** The minute hand passes twelve between the start and the answer: the hour hand has to move on (or back) a number. */
const crossesHour = (s: number, d: number): boolean => (d > 0 ? (s % 60) + d >= 60 : (s % 60) + d < 0)

/** clockElapsed: a wrong clock for the start and the span (on the dial). */
export function explainElapsed(q: ElapsedAsk, v: number): WhyC {
  const is = (x: number) => onDial(x) === onDial(v)
  const mis: MisconceptionId[] = []
  if (is(q.s - q.d)) mis.push('wrongOperation')
  if (q.said.halv && is(q.a + 60)) mis.push('halfPastNext')
  const slip = crossesHour(q.s, q.d) && is(q.a - Math.sign(q.d) * 60)
  return { mis, operand: is(q.s), slip }
}

export function elapsedIdeas(q: ElapsedAsk): Partial<Record<MisconceptionId, number[]>> {
  return { wrongOperation: [onDial(q.s - q.d)], halfPastNext: q.said.halv ? [onDial(q.a + 60)] : [] }
}

// ─── A child kept to one idea, through the real diagnostics ────────────────

/**
 * A child who keeps one idea: `values` are what the idea gives on this task, worked out by the oracle from what
 * the child hears and sees. On cards the child taps such a card when one is dealt and any card otherwise; on the
 * dial it sets such a clock when the dial's step can show it; from the purse it pays such an amount when the purse
 * can (in at most 24 pieces); on the keys it types it when the keys take it. Otherwise it answers right.
 */
export function keepsC(values: (t: Task) => readonly number[], seed: string): Child {
  const rng = makeRng(hashSeed(`ork3c-child:${seed}`))
  return (t) => {
    const own = values(t).filter((v) => Number.isInteger(v) && v >= 0 && !isCorrect(t, v))
    if (t.kind === 'choice') {
      const hit = t.options.filter((o) => typeof o === 'number' && own.some((v) => isCorrect({ ...t, answer: v, accept: [] }, o)))
      return hit.length > 0 ? rng.pick(hit) : rng.pick(t.options)
    }
    let ok: number[] = []
    if (t.kind === 'clockSet') ok = own.filter((v) => onDial(v) % (CLOCK_STEP3[t.skill] ?? 60) === 0)
    else if (t.kind === 'pay') ok = own.filter((v) => fewestCount(v, purseOf(t)) <= 24)
    else if (t.kind === 'keypad') ok = own.filter((v) => v % t.entryScale === 0 && v / t.entryScale < 10 ** t.maxDigits)
    return ok.length > 0 ? rng.pick(ok) : t.answer
  }
}

/** Taps any card, sets the dial anywhere on its step, pays any amount the purse makes, types any number in range. */
export function guessesC(seed: string): Child {
  const rng = makeRng(hashSeed(`ork3c-guess:${seed}`))
  return (t) => {
    if (t.kind === 'choice') return rng.pick(t.options)
    if (t.kind === 'clockSet') {
      const step = CLOCK_STEP3[t.skill] ?? 60
      return step * rng.int(DIAL / step)
    }
    if (t.kind === 'pay') {
      const purse = purseOf(t)
      // a coin set (fewestCoins) is a tray of pieces; an amount is the tray's sum
      if (typeof t.answer !== 'number') return Array.from({ length: rng.between(1, 5) }, () => `c${rng.pick(purse)}`).join('|')
      return 100 * rng.between(0, Math.floor(t.range[1] / 100))
    }
    if (t.kind === 'multiSelect') return t.options.filter(() => rng.next() < 0.5).map(String).join('|') || String(t.options[0])
    const scale = t.entryScale
    return scale * rng.between(Math.ceil(t.range[0] / scale), Math.floor(t.range[1] / scale))
  }
}

/**
 * Answers to the real pipeline on a map node, as rounds plan it: the node's keys (only `skills`' when given), planned
 * afresh every ten tasks, a seeded key and kind per task; the child's answer classified, logged and folded into the
 * misconception states with the child's own first-try accuracy over its last 20 answers (SPEC §4.3 rule 6), or a
 * fixed one. Returns every misconception flagged, with the answer count when it was first flagged.
 */
export function simulateNode(
  node: string,
  skills: readonly SkillId[],
  child: Child,
  n: number,
  opts: { perDay?: number; accuracy?: number; seed?: string } = {},
): Map<MisconceptionId, number> {
  const def = NODE_BY_ID[node]
  if (!def) throw new Error(`no node ${node}`)
  const perDay = opts.perDay ?? 12
  const rng = makeRng(hashSeed(`ork3c-sim:${node}:${skills.join('+')}:${opts.seed ?? ''}`))
  const plan = () => keysForNode(def, { states: {}, audioVerified: true }).filter((k) => skills.includes(k.skill))
  let keys = plan()
  if (keys.length === 0) throw new Error(`${skills.join(', ')} not played on ${node}`)
  let states: MisconceptionStates = {}
  const flagged = new Map<MisconceptionId, number>()
  const recent: boolean[] = []
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % 10 === 0) keys = plan()
    const key = keys[rng.int(keys.length)]
    const t = key.build(rng.pick(key.kinds), makeRng(hashSeed(`ork3c-task:${node}:${i}:${opts.seed ?? ''}`)), i)
    const given = child(t, i)
    const correct = isCorrect(t, given)
    recent.push(correct)
    if (recent.length > 20) recent.shift()
    const day = `2026-11-${String(1 + Math.floor(i / perDay)).padStart(2, '0')}`
    const entry: AnswerLogEntry = {
      profileId: 'ork3c', ts: 1_000 + i, day, sessionId: 's', roundId: `r${Math.floor(i / 10)}`, nodeId: node, mode: 'round',
      skill: t.skill, family: t.family, factId: t.factId, masteryKey: t.masteryKey, kind: t.kind, optionsCount: t.options.length,
      production: isProduction(t), given, answer: t.answer, correct, ms: 4_000, fast: true, errorTag: classifyAnswer(t, given),
      detectable: detectableOf(t), boxBefore: 1, boxAfter: 1, scaffold: false, replays: 0, retryOf: null, assisted: false,
      audioUnverified: false,
    }
    const accuracy = opts.accuracy ?? recent.filter(Boolean).length / recent.length
    states = updateMisconceptions(states, entry, { skillAccuracy20: accuracy, day })
    for (const id of flaggedIds(states)) if (!flagged.has(id)) flagged.set(id, i + 1)
  }
  return flagged
}

/**
 * The same child on several seeded rounds (the seed picks the keys, kinds and cards; the child's own seed its taps):
 * for each run, when the misconception was first flagged (null: not within `n`) and what else was flagged.
 */
export function flaggedRuns(node: string, skills: readonly SkillId[], child: (seed: string) => Child, m: MisconceptionId, n: number, runs: number) {
  return Array.from({ length: runs }, (_, i) => {
    const flagged = simulateNode(node, skills, child(`${m}:${i}`), n, { seed: `run${i}` })
    return { at: flagged.get(m) ?? null, others: [...flagged.keys()].filter((k) => k !== m) }
  })
}
