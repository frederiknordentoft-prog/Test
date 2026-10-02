// Pure answer building for every kind (SPEC §3.1–3.2): what the child did on screen becomes the
// AnswerValue that useRound.submit() compares with Task.answer. Kept free of React so each rule is
// tested on its own (answers.test.ts).
import type { AnswerValue, Prompt, SpeechPart, Task } from '../../engine/types'
import { DENOMINATORS, type Denominator } from '../../speech/fractions'
import { shapeClip, solidClip } from '../../speech/nouns'
import { SHAPE_IDS } from '../../art/materials/Shapes'
import { SOLID_IDS } from '../../art/materials/Solids'
import { pieceOfToken } from './pay/logic'

// ─── Tokens ─────────────────────────────────────────────────────────────────

/** 's0|s3|s5' → ['s0','s3','s5']; numbers come back as numbers ('3|7|12' → [3, 7, 12]). */
export function splitTokens(v: AnswerValue): AnswerValue[] {
  if (typeof v === 'number') return [v]
  if (v === '') return []
  return v.split('|').map((s) => (/^-?\d+$/.test(s) ? Number(s) : s))
}

const naturalOrder = (a: AnswerValue, b: AnswerValue) =>
  String(a).localeCompare(String(b), 'da', { numeric: true, sensitivity: 'base' })

/** Number of answer slots of a fillSlots or sortOrder task ('3|7|12' has three). */
export function slotCount(task: Task): number {
  return typeof task.answer === 'string' ? Math.max(1, task.answer.split('|').length) : 1
}

const matches = (task: Task, v: AnswerValue) => v === task.answer || task.accept.includes(v)

/**
 * A multiSelect selection as the set token. The contract says "sorted tokens joined by '|'" without
 * fixing the order, so every reasonable order is tried and the one the skill used wins: the order
 * of the options on screen, natural order (s2 before s10) and plain string order. A wrong selection
 * is wrong in any order; it is reported in natural order.
 */
export function setValue(selected: readonly AnswerValue[], task: Task): string {
  const keys = new Set(selected.map(String))
  const byOptions = task.options.filter((o) => keys.has(String(o))).map(String)
  const extra = [...keys].filter((k) => !byOptions.includes(k))
  const candidates = [
    [...byOptions, ...extra],
    [...keys].sort((a, b) => naturalOrder(a, b)),
    [...keys].sort(),
  ].map((list) => list.join('|'))
  return candidates.find((c) => matches(task, c)) ?? candidates[1]
}

/** sortOrder: the cards in the order they were placed. */
export function orderValue(placed: readonly AnswerValue[]): string {
  return placed.map(String).join('|')
}

/** fillSlots: the slots left to right; null until every slot is filled. */
export function slotsValue(slots: readonly (AnswerValue | null)[]): string | null {
  if (slots.length === 0 || slots.some((s) => s === null)) return null
  return slots.map(String).join('|')
}

// ─── Numbers ────────────────────────────────────────────────────────────────

/** Keypad digits → the answer (kroner typed on a whole-krone money task are sent as øre). */
export function keypadValue(digits: string, task: Pick<Task, 'entryScale'>): number | null {
  if (!/^\d+$/.test(digits)) return null
  return Number(digits) * task.entryScale
}

/** Whether one more digit fits (maxDigits; a leading zero is replaced, never prefixed). */
export function keypadPress(digits: string, key: string, task: Pick<Task, 'maxDigits'>): string {
  if (key === 'del') return digits.slice(0, -1)
  if (!/^\d$/.test(key)) return digits
  if (digits === '0') return key
  if (digits.length >= Math.max(1, task.maxDigits)) return digits
  return digits + key
}

/** buildBase: flats, rods and units counted as they lie — nothing is regrouped (SPEC §3.2). */
export function baseValue(pieces: { h: number; t: number; o: number }): number {
  return 100 * pieces.h + 10 * pieces.t + pieces.o
}

/** Which blocks the buildBase tray offers: flats only when hundreds are in play. */
export function baseKinds(task: Task): ('flat' | 'rod' | 'unit')[] {
  const top = Math.max(task.range[1], typeof task.answer === 'number' ? task.answer : 0)
  return top >= 100 ? ['flat', 'rod', 'unit'] : ['rod', 'unit']
}

/** The number line a numberline task is answered on: the prompt's line, else the task range. */
export function lineRange(task: Task): [number, number] {
  const p = task.prompt
  if (p.scene === 'line' && p.max > p.min) return [p.min, p.max]
  const [lo, hi] = task.range
  return hi > lo ? [lo, hi] : [0, Math.max(10, hi)]
}

/**
 * An empty number line: only its ends are numbered (UI-fund 2). The materials' NumberLine has
 * `endsOnly`, but the line prompt does not carry it in the contract yet (proposed: `endsOnly?: boolean`
 * on `{ scene: 'line' }` in src/engine/types.ts), so the views read it here once a skill sets it.
 */
export function lineEndsOnly(p: Extract<Prompt, { scene: 'line' }>): boolean {
  return 'endsOnly' in p && p.endsOnly === true
}

/** A position on the line (0–1) → the value it stands for, rounded to whole numbers and clamped. */
export function lineValue(ratio: number, min: number, max: number): number {
  const r = Math.min(1, Math.max(0, ratio))
  return Math.round(min + r * (max - min))
}

/** Where a value sits on the line (0–1). */
export function lineRatio(v: number, min: number, max: number): number {
  return max > min ? Math.min(1, Math.max(0, (v - min) / (max - min))) : 0
}

/** The prompt has an answer blank the keypad can type into (equation or balance terms). */
export function hasBlank(p: Prompt): boolean {
  const terms = p.scene === 'equation' ? p.terms : p.scene === 'balance' ? [...p.left, ...p.right] : []
  return terms.some((t) => 'blank' in t)
}

/** Numbers the child can see in a prompt, in reading order. */
export function promptNums(p: Prompt): number[] {
  switch (p.scene) {
    case 'equation':
      return p.terms.flatMap((t) => ('n' in t ? [t.n] : []))
    case 'balance':
      return [...p.left, ...p.right].flatMap((t) => ('n' in t ? [t.n] : []))
    case 'row':
      return p.cells.filter((c): c is number => typeof c === 'number')
    case 'story':
      return [...p.nums]
    case 'objects':
      return [p.n]
    case 'line':
      return p.hops ? [...p.hops] : []
    default:
      return []
  }
}

/** pair (tenFriends): the given number the child finds a partner for, and the sum they make. */
export function pairSum(task: Task): { anchor: number | null; total: number } {
  const nums = promptNums(task.prompt)
  const p = task.prompt
  if (p.scene === 'equation') {
    // a + ? = total: the total stands after "=", the anchor before it
    const eq = p.terms.findIndex((t) => 'op' in t && t.op === '=')
    const before = p.terms.slice(0, eq < 0 ? p.terms.length : eq).flatMap((t) => ('n' in t ? [t.n] : []))
    const after = eq < 0 ? [] : p.terms.slice(eq + 1).flatMap((t) => ('n' in t ? [t.n] : []))
    const total = after[0] ?? 10
    return { anchor: before[0] ?? null, total }
  }
  const anchor = nums[0] ?? (typeof task.answer === 'number' ? 10 - task.answer : null)
  return { anchor, total: 10 }
}

/**
 * countTap: how many things lie in the pile. The skills draw the pile as the prompt's `objects`
 * (always more than the target, SK1 convention); without one, a pile a few larger than the answer.
 */
export function supplyCount(task: Task): number {
  const p = task.prompt
  if (p.scene === 'objects' && p.n > 0) return Math.min(30, p.n)
  const want = typeof task.answer === 'number' ? task.answer : 0
  const top = Math.max(task.range[1], want)
  return Math.min(24, Math.max(want + 3, Math.min(top, want + 5), 6))
}

/** countTap: the thing to count (the prompt's, else carrots on the meadow). */
export function thingOf(task: Task): string {
  const p = task.prompt
  if (p.scene === 'objects' || p.scene === 'groups' || p.scene === 'share') return p.thing
  if (p.scene === 'shop') return p.thing
  return 'carrot'
}

// ─── Speech for an answer value (the confirm button: "Tryk på 13") ──────────

const isDenominator = (d: number): d is Denominator => (DENOMINATORS as readonly number[]).includes(d)
const MEASURE_UNITS = ['cm', 'm', 'g', 'kg'] as const

/** The spoken form of one answer value, or null when it has none (sets, sequences, pictures). */
export function answerSpeech(task: Task, value: AnswerValue): SpeechPart[] | null {
  if (typeof value === 'number') {
    if (task.answerType === 'ore') return [{ money: { ore: value, form: 'end' } }]
    if (task.answerType === 'minutes') {
      const style = task.optionView === 'clockDigital' || task.modulo === 1440 ? 'digital' : 'analog'
      return [{ clock: { minutes: value, style, form: 'end' } }]
    }
    if (task.unit === 'cm' || task.unit === 'm') return [{ measure: { value, unit: task.unit, form: 'end' } }]
    if (!Number.isInteger(value) || value < 0) return null
    return [{ num: value, form: 'end' }]
  }
  if (value.includes('|')) return null
  const i = task.options.findIndex((o) => o === value)
  if (task.optionClips && i >= 0 && task.optionClips[i]) return [{ clip: task.optionClips[i] }]
  if (value === 'yes') return [{ clip: 's.ui.yes' }]
  if (value === 'no') return [{ clip: 's.ui.no' }]
  const [prefix, body = ''] = value.split(':')
  if (prefix === 'frac') {
    const [n, d] = body.split('/').map(Number)
    if (Number.isInteger(n) && isDenominator(d)) return [{ frac: { n, d, form: 'end' } }]
  }
  const shape = body.split(':')[0]
  if (prefix === 'shape' && (SHAPE_IDS as readonly string[]).includes(shape)) {
    return [{ clip: shapeClip(shape as (typeof SHAPE_IDS)[number], 'indef', 'end') }]
  }
  if (prefix === 'solid' && (SOLID_IDS as readonly string[]).includes(body)) {
    return [{ clip: solidClip(body as (typeof SOLID_IDS)[number], 'indef', 'end') }]
  }
  if (prefix === 'unit') {
    if ((MEASURE_UNITS as readonly string[]).includes(body)) return [{ clip: `noun.unit.${body}.end` }]
    if (body === 'kr') return [{ clip: 'noun.unit.kroner.end' }]
  }
  return null
}

/** "Tryk på 13" (SPEC §3.5), or "Tryk her" when the answer cannot be said in a few words. */
export function confirmSpeech(task: Task): SpeechPart[] {
  const said = answerSpeech(task, task.answer)
  return said ? [{ clip: 'frag.tryk_paa' }, ...said] : [{ clip: 's.round.tapHere' }]
}

// ─── Money and numbers on screen ────────────────────────────────────────────

/**
 * A card's label for assistive tech (never shown): money as amounts ('c5000' and 'c010000' are
 * "50 kr." and "100 kr.", a coin set lists its pieces), numbers as on screen, the rest as it is.
 */
export function optionLabel(task: Pick<Task, 'answerType' | 'optionView'>, value: AnswerValue): string {
  if (typeof value === 'number') return task.answerType === 'ore' || task.optionView === 'coin' ? formatMoney(value) : formatNumber(value)
  const tokens = value.split('|')
  const pieces = tokens.map(pieceOfToken)
  if (pieces.every((p): p is number => p !== null)) return pieces.map(formatMoney).join(', ')
  return value
}

/**
 * Minus is always U+2212, and a whole number is written the way a child writes it: no thousands
 * separator. SPEC §3.1 says so up to 9999 and says nothing else; above that, the only numbers on a
 * card are what a child wrote ("tre hundrede og femogfyrre" as 30045, a 1004 typed with a digit
 * too many), and "30.045" would hide exactly that (UI-fund 6).
 */
export function formatNumber(n: number): string {
  const sign = n < 0 ? '−' : ''
  const abs = Math.abs(n)
  const whole = Math.trunc(abs)
  const s = String(whole)
  const frac = abs - whole
  return frac > 1e-9 ? `${sign}${s},${String(Math.round(frac * 100)).padStart(2, '0').replace(/0$/, '')}` : `${sign}${s}`
}

/** "12,50 kr." / "12 kr." (SPEC §3.1). */
export function formatMoney(ore: number): string {
  const kr = Math.floor(Math.abs(ore) / 100)
  const o = Math.abs(ore) % 100
  return `${ore < 0 ? '−' : ''}${kr}${o ? `,${String(o).padStart(2, '0')}` : ''} kr.`
}
