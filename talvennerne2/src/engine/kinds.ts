import type { Prompt, SkillId, Task, TaskKind } from './types'

/**
 * How likely a child is to hit the right answer by luck, per task (SPEC §3.2–3.3). This one number
 * decides what a task can prove: a guessable answer can carry a key to box 3 (box 2 when the odds
 * are a coin flip), and only production — a guess rate of at most 12 % — can reach boxes 4 and 5.
 */
export const PRODUCTION_GUESS_LIMIT = 0.12

/** Manipulative kinds only count as production where they are the skill's own representation. */
const MANIPULATIVE_ONLY_FOR: Partial<Record<TaskKind, readonly SkillId[]>> = {
  share: ['shareEqually', 'fractionOfSet'],
  buildBase: ['tensOnes', 'placeValue1000'],
  countTap: ['count10', 'count20'],
}

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1))
const rangeSize = (t: Task) => Math.max(1, t.range[1] - t.range[0] + 1)
/** fillSlots and sortOrder answers are tokens joined by '|', one per slot. */
const slotCount = (t: Task) => (typeof t.answer === 'string' ? t.answer.split('|').length : 1)

function promptOf<S extends Prompt['scene']>(t: Task, scene: S): Extract<Prompt, { scene: S }> | null {
  return t.prompt.scene === scene ? (t.prompt as Extract<Prompt, { scene: S }>) : null
}

export function guessP(t: Task): number {
  return Math.max(kindGuessP(t), t.guessFloor ?? 0)
}

function kindGuessP(t: Task): number {
  switch (t.kind) {
    case 'choice':
    case 'pair':
      return 1 / Math.max(1, t.options.length)
    case 'keypad':
    case 'countTap':
      return 1 / rangeSize(t)
    case 'numberline':
      return Math.min(1, (2 * t.tolerance + 1) / rangeSize(t))
    case 'trueFalse':
      return 0.5
    case 'sortOrder':
      return 1 / factorial(Math.max(1, t.options.length))
    case 'multiSelect':
      return 1 / (2 ** Math.max(1, t.options.length) - 1)
    case 'fillSlots':
      return 1 / Math.max(1, t.options.length) ** slotCount(t)
    case 'buildBase':
    case 'pay':
    case 'share':
      return 0.01
    case 'clockSet': {
      const step = promptOf(t, 'clock')?.step ?? 60
      return step / (t.modulo || 720)
    }
    case 'colorParts': {
      const parts = promptOf(t, 'fraction')?.parts ?? 2
      return 1 / (parts + 1)
    }
    case 'grid': {
      const g = promptOf(t, 'grid')
      const cells = g ? g.w * g.h : 16
      // single point: one of w·h cells; multi: any subset of the cells
      return g?.coords ? 1 / cells : 1 / 2 ** cells
    }
  }
}

export function isProduction(t: Task): boolean {
  const only = MANIPULATIVE_ONLY_FOR[t.kind]
  return guessP(t) <= PRODUCTION_GUESS_LIMIT && (only ? only.includes(t.skill) : true)
}

/** Highest box a correct answer on this task can lead to. */
export function ceilingFor(t: Task): number {
  if (isProduction(t)) return 5
  return guessP(t) >= 0.5 ? 2 : 3
}

// ─── Speed ──────────────────────────────────────────────────────────────────

/** Skills whose keypad answers get more time than the default formula (SPEC §3.2). */
const KEYPAD_FAST_MS: Partial<Record<SkillId, number>> = {
  add100Carry: 15_000,
  sub100Borrow: 15_000,
  add1000: 25_000,
  sub1000: 25_000,
  mulTens: 10_000,
}

const digits = (v: unknown): number => (typeof v === 'number' ? String(Math.abs(Math.round(v))).length : 1)

/** Danish coins and notes in øre, largest first. */
const DENOMINATIONS = [50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100, 50]

/** Pieces in the fewest-coins way to pay an amount. */
export function fewestPieces(ore: number): number {
  let left = ore
  let n = 0
  for (const d of DENOMINATIONS) {
    n += Math.floor(left / d)
    left %= d
  }
  return n
}

/**
 * How quickly a correct answer must come to count as recalled (ms). The clock starts when the
 * question is shown and read out; replays add their own duration on top (SPEC §3.2).
 */
export function defaultFastMs(t: Task): number {
  const extra = Math.max(0, digits(t.answer) - 1)
  switch (t.kind) {
    case 'choice':
      return 5_000 + 1_500 * extra
    case 'keypad':
      return KEYPAD_FAST_MS[t.skill] ?? 6_000 + 2_000 * extra
    case 'countTap':
      return 2_000 + 700 * (typeof t.answer === 'number' ? t.answer : 1)
    case 'pair':
      return 7_000
    case 'numberline':
      return t.range[1] <= 20 ? 8_000 : t.range[1] <= 100 ? 10_000 : 12_000
    case 'trueFalse':
      return 5_000
    case 'sortOrder':
      return 2_500 * Math.max(1, t.options.length)
    case 'multiSelect':
      return 2_000 * Math.max(1, t.options.length)
    case 'fillSlots':
      return 3_500 * slotCount(t)
    case 'buildBase': {
      const n = typeof t.answer === 'number' ? t.answer : 0
      const pieces = Math.floor(n / 100) + Math.floor((n % 100) / 10) + (n % 10)
      return 4_000 + 1_200 * pieces
    }
    case 'clockSet': {
      const step = promptOf(t, 'clock')?.step ?? 60
      return step >= 30 ? 12_000 : 18_000
    }
    case 'pay': {
      // a set answer names its pieces; an amount is paid with the fewest
      const pieces = typeof t.answer === 'number' ? fewestPieces(t.answer) : t.answer.split('|').filter((x) => x !== '').length
      return 5_000 + 2_500 * pieces
    }
    case 'share': {
      const total = promptOf(t, 'share')?.total ?? 0
      return 3_000 + 800 * total
    }
    case 'colorParts':
      return 3_000 + 1_000 * (promptOf(t, 'fraction')?.parts ?? 2)
    case 'grid': {
      const g = promptOf(t, 'grid')
      if (g?.coords) return 8_000
      const cells = typeof t.answer === 'string' && t.answer ? t.answer.split('|').length : 1
      return 5_000 + 1_500 * cells
    }
  }
}
