// Shared by the plus and minus skills of 1.–2. klasse (doubles … addSub1000Round): the equation and
// its question, seeded instance draws for the procedure families, the misconception formulas of
// pædagogik §3.2 worked out per column, and the strategy hints (hops on the empty number line, the
// columns, whole tens). Clips live in src/speech/clips/skills/addsub2.ts. The registry skips this
// file (no SkillDef default export).
//
// Misconception formulas (one value each, or none when the formula gives the answer itself):
//   forgotCarry        the ones' ten is not carried: a + b − 10 (8 + 5 → 3, 38 + 45 → 73, 67 + 58 → 115);
//                      round numbers drop the hundred instead (370 + 50 → 320)
//   smallerFromLarger  per column |x − y| (53 − 27 → 34, 13 − 5 → 12, 100 − 37 → 137)
//   borrowNoDecrement  a column borrows ten but the next column is never lowered
//                      (53 − 27 → 36, 13 − 5 → 18, 100 − 37 → 173)
//   digitComplement10  100 − TO: each digit of TO to ten (100 − 37 → 73)
//   placeMisalign      a one-digit number added to the tens: a + 10·b (38 + 5 → 88)
//   wrongOperation     the other operation, kept ≥ 0: |a − b| for plus, a + b for minus
//   countFromFirst     the start counted as the first hop: plus answer − 1, minus answer + 1
//   tensZero           a whole-ten answer with its zero lost or doubled: answer : 10, answer · 10
import type { Fact, FamilyDef, HintVisual, Prompt, Rng, SkillId, SpeechPart, Term } from '../../types'
import { hashSeed, makeRng } from '../../rng'
import { equationSpeech } from '../../../speech/equation'
import { num, say } from '../number/kit'

export type Sign = '+' | '−'

// ─── The question ───────────────────────────────────────────────────────────

export const sumTerms = (a: number, op: Sign, b: number): Term[] => [{ n: a }, { op }, { n: b }, { op: '=' }, { blank: true }]
/** a + b = □ / a − b = □ */
export const sumPrompt = (a: number, op: Sign, b: number): Prompt => ({ scene: 'equation', terms: sumTerms(a, op, b) })
/** "Hvad er otteogtredive plus femogfyrre?" (SPEC §10.1: the = of a question is not read). */
export const sumSpeech = (a: number, op: Sign, b: number): SpeechPart[] => equationSpeech(sumTerms(a, op, b))
export const result = (a: number, op: Sign, b: number): number => (op === '+' ? a + b : a - b)

/** `<prefix>:<a>+<b>` / `<prefix>:<a>-<b>` (CONVENTIONS: one prefix per skill, the sum as written). */
export const sumId = (prefix: string, a: number, op: Sign, b: number): string => `${prefix}:${a}${op === '+' ? '+' : '-'}${b}`

/** The sign of a fact id written by sumId (the operands do not tell plus from minus). */
export const signOf = (f: Fact): Sign => (f.id.slice(f.id.indexOf(':') + 1).includes('+') ? '+' : '−')

// ─── Procedure instances ────────────────────────────────────────────────────

/** A family's instances: a seeded draw and the facts it makes. */
export interface Drawer {
  /** One instance of the family, or null when this draw missed (it is retried). */
  draw(family: string, rng: Rng): Fact | null
}

/** Draws before an instance in `avoid` is given anyway (the family has none left). */
const DRAWS = 240

/** A fresh instance of a family that is not in `avoid` (if the family has one left). */
export function drawInstance(d: Drawer, family: FamilyDef, rng: Rng, avoid: ReadonlySet<string>): Fact {
  let last: Fact | null = null
  for (let i = 0; i < DRAWS; i++) {
    const f = d.draw(family.id, rng)
    if (!f) continue
    last = f
    if (!avoid.has(f.id)) return f
  }
  if (!last) throw new Error(`no instance of ${family.id}`)
  return last
}

/** SPEC §2.4: 20 canonical facts per family (all of them when the family has fewer), seeded and stable. */
export function canonicalFacts(skill: SkillId, d: Drawer, families: readonly FamilyDef[], perFamily = 20): Fact[] {
  return families.flatMap((fam) => {
    const rng = makeRng(hashSeed(`${skill}/${fam.id}`))
    const out = new Map<string, Fact>()
    for (let i = 0; i < 4000 && out.size < perFamily; i++) {
      const f = d.draw(fam.id, rng)
      if (f && !out.has(f.id)) out.set(f.id, f)
    }
    return [...out.values()]
  })
}

/** An integer in [lo, hi], or null when the interval is empty. */
export const between = (rng: Rng, lo: number, hi: number): number | null => (lo > hi ? null : rng.between(lo, hi))

// ─── Column arithmetic ──────────────────────────────────────────────────────

/** Per column |x − y|, b's missing columns as 0 (pædagogik §3.2 smallerFromLarger). */
export function smallerFromLarger(a: number, b: number): number {
  let out = 0
  for (let p = 1; a > 0 || b > 0; p *= 10) {
    out += Math.abs((a % 10) - (b % 10)) * p
    a = Math.floor(a / 10)
    b = Math.floor(b / 10)
  }
  return out
}

/** Column subtraction that borrows ten for a column and never lowers the next one (borrowNoDecrement). */
export function borrowNoDecrement(a: number, b: number): number {
  let out = 0
  for (let p = 1; a > 0 || b > 0; p *= 10) {
    const x = a % 10
    const y = b % 10
    out += (x >= y ? x - y : x + 10 - y) * p
    a = Math.floor(a / 10)
    b = Math.floor(b / 10)
  }
  return out
}

/** 100 − 37 → 73: each digit of a two-digit number with ones to ten, null otherwise (digitComplement10). */
export function digitComplement10(a: number, b: number): number | null {
  if (a !== 100 || b < 11 || b > 99 || b % 10 === 0) return null
  return (10 - Math.floor(b / 10)) * 10 + (10 - (b % 10))
}

/** The ones make ten or more. */
export const onesCarry = (a: number, b: number): boolean => (a % 10) + (b % 10) >= 10
/** The tens make ten or more (370 + 50). */
export const tensCarry = (a: number, b: number): boolean => (Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10) >= 10
/** A column of the subtraction needs a borrowed ten. */
export const needsBorrow = (a: number, b: number): boolean => smallerFromLarger(a, b) !== a - b

/** The other operation, kept ≥ 0 (wrongOperation). */
export const otherOperation = (a: number, op: Sign, b: number): number => (op === '+' ? Math.abs(a - b) : a + b)

/** answer ± each step. */
export const around = (answer: number, steps: readonly number[]): number[] => steps.flatMap((s) => [answer + s, answer - s])

// ─── Strategy hints ─────────────────────────────────────────────────────────

/** "Hop to frem til" / "Hop tyve tilbage til": recorded for 1–9 and the whole tens 10–90 (clips/skills/addsub2.ts). */
export const hopClip = (d: number): string => `hint.addsub2.${d > 0 ? 'fwd' : 'back'}.${Math.abs(d)}`

/**
 * Stops on the empty number line for a + b, from a (2. klasse): up to the next ten first when the ones
 * cross it, then the whole tens, then the rest — 38 + 45: 38, 40, 80, 83. Without a crossing: the tens,
 * then the ones. `compensate` (46 + 9, 46 + 19): one ten too many, then one back.
 */
export function plusStops(a: number, b: number, compensate = false): number[] {
  if (compensate) return [a, a + b + 1, a + b]
  const stops = [a]
  const at = () => stops[stops.length - 1]
  let rest = b
  if (a % 10 !== 0 && onesCarry(a, b)) {
    const fill = 10 - (a % 10)
    stops.push(a + fill)
    rest -= fill
  }
  const tens = rest - (rest % 10)
  if (tens > 0) stops.push(at() + tens)
  if (rest % 10 > 0) stops.push(at() + (rest % 10))
  return stops
}

/**
 * Stops for a − b, from a: back to the ten first when the ones are too few (53 − 27: 53, 50, 30, 26),
 * then the whole tens, then the rest. Without a borrow: the tens, then the ones. `compensate`
 * (52 − 9, 52 − 19): one ten too many back, then one forward.
 */
export function minusStops(a: number, b: number, compensate = false): number[] {
  if (compensate) return [a, a - b - 1, a - b]
  const stops = [a]
  const at = () => stops[stops.length - 1]
  const borrow = a % 10 < b % 10
  const first = borrow ? a % 10 : 0
  if (first > 0) stops.push(a - first)
  const tens = b - (b % 10)
  if (tens > 0) stops.push(at() - tens)
  const ones = (b % 10) - first
  if (ones > 0) stops.push(at() - ones)
  return stops
}

/** "Start på otteogtredive. Hop to frem til fyrre. Hop fyrre frem til firs. Hop tre frem til treogfirs." */
export function hopSpeech(stops: readonly number[]): SpeechPart[] {
  const out: SpeechPart[] = [say('hint.addsub2.startOn'), num(stops[0])]
  for (let i = 1; i < stops.length; i++) out.push(say(hopClip(stops[i] - stops[i - 1])), num(stops[i]))
  return out
}

/** The stops drawn as hops on a line from the ten below to the ten above them. */
export function hopLine(stops: readonly number[]): HintVisual {
  const min = Math.floor(Math.min(...stops) / 10) * 10
  const max = Math.max(min + 10, Math.ceil(Math.max(...stops) / 10) * 10)
  return { scene: 'line', min, max, hops: [...stops] }
}

/** "tre tiere" (whole clips, so the number and the noun are said as one phrase). */
export const tensWords = (n: number): SpeechPart => say(`hint.addsub2.tens.${n}`)

/** "Tre tiere og fire tiere giver syv tiere." for whole tens (a, b and the result in tens). */
export function tensSum(a: number, op: Sign, b: number): SpeechPart[] {
  return [tensWords(a), say(op === '+' ? 'op.plus' : 'op.minus'), tensWords(b), say('op.giver'), tensWords(result(a, op, b))]
}

/** "Fire plus fem giver ni." */
export const digitSum = (x: number, op: Sign, y: number): SpeechPart[] => [
  num(x, 'mid'), say(op === '+' ? 'op.plus' : 'op.minus'), num(y, 'mid'), say('op.giver'), num(result(x, op, y)),
]

/** The operation's meaning, said before the strategy when the child used the other one. */
export const meaningOf = (op: Sign): SpeechPart => say(op === '+' ? 'hint.addsub2.plusMore' : 'hint.addsub2.minusLess')

/** "Svaret er treogfirs." */
export const answerIs = (n: number): SpeechPart[] => [say('hint.addsub2.answerIs'), num(n)]

/** The column picture of a ± b (with the carry or borrow drawn when there is one). */
export const columns = (a: number, op: Sign, b: number): HintVisual => ({
  scene: 'columns', a, b, op, carry: op === '+' ? onesCarry(a, b) || tensCarry(a, b) : needsBorrow(a, b),
})

/** Ones first, then tens; a column that does not change is said to stay. */
export function noCarryColumns(a: number, op: Sign, b: number): SpeechPart[] {
  const ones = b % 10
  const tens = Math.floor(b / 10)
  const out: SpeechPart[] = []
  if (ones > 0) out.push(say('hint.addsub2.onesFirst'), ...digitSum(a % 10, op, ones))
  if (tens > 0) out.push(say(ones > 0 ? 'hint.addsub2.tensThen' : 'hint.addsub2.tensOnly'), ...tensSum(Math.floor(a / 10), op, tens))
  else out.push(say('hint.addsub2.tensSame'))
  if (ones === 0) out.push(say('hint.addsub2.onesSame'))
  return [...out, ...answerIs(result(a, op, b))]
}
