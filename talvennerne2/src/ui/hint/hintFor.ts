// Which strategy to show after a mistake (SPEC §3.5) and what the lightbulb opens. The skill decides:
// SkillDef.hint(fact, errorTag) gives the misconception's own hint when the child's answer carries
// one, else the skill's standard strategy. A flag never changes the hint. This module only fills
// gaps so the round never shows an empty card: a skill without words gets the round's own sentences
// with the task's numbers, a skill without a picture gets one drawn from the prompt, and the three
// animated misconceptions (digitSwap, forgotCarry, smallerFromLarger) get their film.
import { SKILL_BY_ID } from '../../content/skills'
import type {
  AnswerValue, ErrorTag, Fact, HintSpec, HintVisual, MisconceptionId, Prompt, SkillDef, SpeechPart, Task, TaskKind,
} from '../../engine/types'
import { classifyAnswer } from '../../engine/misconceptions'
import { factsOf, skillRegistry } from '../../engine/registry'
import type { SkillRegistry } from '../../engine/registry'
import { isMisconceptionId } from '../../engine/tasks'
import { compile } from '../../speech/compile'
import { lineRange, promptNums } from '../task/answers'

/** Misconceptions with an animated film in this module (SPEC §4.3 lists eight; these three first). */
export const ANIMATED_HINTS = ['digitSwap', 'forgotCarry', 'smallerFromLarger'] as const
export type AnimatedHint = (typeof ANIMATED_HINTS)[number]
const isAnimated = (m: unknown): m is AnimatedHint => (ANIMATED_HINTS as readonly unknown[]).includes(m)

/** Pictures the round draws itself, next to the contract's HintVisual scenes. */
export type LocalVisual =
  | { scene: 'dotsAdd'; a: number; b: number }
  | { scene: 'dotsSub'; a: number; b: number }
  | { scene: 'tensOnes'; n: number }
  | { scene: 'anim.digitSwap'; n: number; given: number | null }
  | { scene: 'anim.forgotCarry'; a: number; b: number }
  | { scene: 'anim.smallerFromLarger'; a: number; b: number }
  /** The task's own number line with the cards' numbers marked (review r1 P2-7), hops on top. */
  | { scene: 'markedLine'; min: number; max: number; marks: number[]; hops?: number[] }

export type AnyVisual = HintVisual | LocalVisual

/**
 * A strategy on a number line for a choice asked on a number line ("Hvilket tal er størst?") is
 * drawn on the same line, with the numbers of the cards marked: one line, not three unmarked ones.
 */
export function onTaskLine(visual: AnyVisual, task: Task): AnyVisual {
  if (visual.scene !== 'line' || task.prompt.scene !== 'line' || task.kind !== 'choice') return visual
  const marks = task.options.filter((o): o is number => typeof o === 'number')
  if (marks.length === 0) return visual
  return { scene: 'markedLine', min: visual.min, max: visual.max, marks, ...(visual.hops ? { hops: visual.hops } : {}) }
}

export interface ResolvedHint {
  speech: SpeechPart[]
  visual: AnyVisual
  tag: ErrorTag | null
  /** The misconception this hint answers, when it is a specific one. */
  misconception: MisconceptionId | null
  animated: boolean
  /** The words are the skill's own (false: the round's sentences stood in). */
  fromSkill: boolean
}

// ─── Reading the task ───────────────────────────────────────────────────────

interface Sum {
  a: number
  b: number
  op: '+' | '−' | '·' | ':'
}

/** "a op b = ?" from an equation prompt, else null. */
export function sumOf(p: Prompt): Sum | null {
  if (p.scene !== 'equation') return null
  const t = p.terms
  const eq = t.findIndex((x) => 'op' in x && x.op === '=')
  if (eq !== 3 || t.length !== 5 || !('blank' in t[4])) return null
  const [a, op, b] = t
  if (!('n' in a) || !('n' in b) || !('op' in op)) return null
  if (op.op !== '+' && op.op !== '−' && op.op !== '·' && op.op !== ':') return null
  return { a: a.n, b: b.n, op: op.op }
}

/** The fact a task was built from: recall facts by id, procedure instances rebuilt from the prompt. */
export function factFor(def: SkillDef, task: Task): Fact {
  const known = factsOf(def).find((f) => f.id === task.factId)
  if (known) return known
  return { id: task.factId, skill: task.skill, family: task.family, operands: operandsOf(task), answer: task.answer, rank: 0 }
}

/**
 * The numbers a task was built from. Mostly they stand in the prompt; a choice asked on a bare number
 * line ("Hvilket tal er størst?") carries them on its cards: the answer and the card tagged as the
 * other operand (review r1 P2-7: without them the strategy's line had no hops).
 */
function operandsOf(task: Task): number[] {
  const nums = promptNums(task.prompt)
  if (nums.length > 0 || task.prompt.scene !== 'line' || typeof task.answer !== 'number') return nums
  const others = task.options.filter((o): o is number => typeof o === 'number' && o !== task.answer && task.distractorTags[String(o)] === 'operand')
  return others.length > 0 ? [task.answer, ...others] : nums
}

/** SkillDef.hint(fact, tag, kind?) — the kind is the SK1 addition; older skills ignore it. */
function skillHint(def: SkillDef, task: Task, tag: ErrorTag | null): HintSpec {
  const hint = def.hint as (fact: Fact, tag: ErrorTag | null, kind?: TaskKind) => HintSpec
  return hint.call(def, factFor(def, task), tag, task.kind)
}

function safely<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch (err) {
    console.error(err)
    return null
  }
}

// ─── Pictures drawn from the prompt ─────────────────────────────────────────

/** A standard picture for a task whose skill gave none (also the lightbulb's scaffold). */
export function defaultVisual(task: Task): AnyVisual {
  const p = task.prompt
  // countTap's prompt is the pile, not the amount: the picture is the target, in a ten-frame
  if (task.kind === 'countTap' && typeof task.answer === 'number' && task.answer <= 20) {
    return { scene: 'objects', n: task.answer, layout: 'tenframe', thing: p.scene === 'objects' ? p.thing : 'ball' }
  }
  // numbers to put in order: where they lie on a number line, hop by hop
  if (task.kind === 'sortOrder' && typeof task.answer === 'string') {
    const nums = task.answer.split('|').map(Number)
    if (nums.length > 1 && nums.every((v) => Number.isFinite(v) && v >= 0)) {
      const top = Math.max(...nums)
      const max = top <= 10 ? 10 : top <= 20 ? 20 : top <= 100 ? Math.ceil(top / 10) * 10 : Math.ceil(top / 100) * 100
      return { scene: 'line', min: 0, max, hops: nums }
    }
  }
  // a place on the number line: hop to the ten (or hundred) first, then the rest of the way
  if (task.kind === 'numberline' && typeof task.answer === 'number') {
    const [min, max] = lineRange(task)
    const n = task.answer
    if (max > min && n >= min && n <= max) {
      const step = max - min > 100 ? 100 : max - min > 20 ? 10 : 0
      const base = step ? min + Math.floor((n - min) / step) * step : min
      return { scene: 'line', min, max, hops: [...new Set([min, base, n])] }
    }
  }
  const s = sumOf(p)
  if (s) {
    const { a, b, op } = s
    if (op === '+') {
      if (a + b <= 10) return { scene: 'dotsAdd', a, b }
      if (a <= 10 && b <= 10 && a + b <= 20) return { scene: 'makeTen', a: Math.max(a, b), b: Math.min(a, b) }
      if (a + b < 1000) return { scene: 'columns', a, b, op: '+', carry: (a % 10) + (b % 10) >= 10 }
    }
    if (op === '−' && b <= a) {
      if (a <= 10) return { scene: 'dotsSub', a, b }
      if (a <= 20 && a - b < 10 && b > a - 10) return { scene: 'backToTen', a, b }
      if (a < 1000) return { scene: 'columns', a, b, op: '−', carry: a % 10 < b % 10 }
    }
    if (op === '·' && a <= 10 && b <= 10) return { scene: 'array', rows: a, cols: b }
    if (op === ':' && b > 0 && a % b === 0 && a <= 100) return { scene: 'array', rows: a / b, cols: b }
  }
  if (p.scene === 'hear' && typeof task.answer === 'number' && task.answer < 1000) return { scene: 'tensOnes', n: task.answer }
  if (p.scene === 'objects' && p.n <= 20) return { scene: 'objects', n: p.n, layout: 'tenframe', thing: p.thing }
  if (p.scene === 'equation' || p.scene === 'hear') return { scene: 'none' }
  return p
}

function animatedVisual(tag: AnimatedHint, task: Task, given: AnswerValue | null): AnyVisual | null {
  const s = sumOf(task.prompt)
  if (tag === 'digitSwap' && typeof task.answer === 'number' && task.answer >= 10 && task.answer < 100) {
    return { scene: 'anim.digitSwap', n: task.answer, given: typeof given === 'number' ? given : null }
  }
  if (tag === 'forgotCarry' && s && s.op === '+' && s.a + s.b < 1000) return { scene: 'anim.forgotCarry', a: s.a, b: s.b }
  if (tag === 'smallerFromLarger' && s && s.op === '−' && s.a < 1000 && s.b <= s.a) return { scene: 'anim.smallerFromLarger', a: s.a, b: s.b }
  return null
}

// ─── The round's own words ──────────────────────────────────────────────────

const num = (n: number, form: 'mid' | 'end' = 'mid'): SpeechPart => ({ num: n, form })
const clip = (id: string): SpeechPart => ({ clip: id })

function tensOnesWords(n: number): SpeechPart[] {
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return [num(tens), clip(tens === 1 ? 's.round.word.ten' : 's.round.word.tens'), clip('op.og'), num(ones), clip(ones === 1 ? 's.round.word.one' : 's.round.word.ones'), clip('op.giver'), num(n, 'end')]
}

/** Spoken explanation for a picture, with the task's own numbers ("8 og 2 giver 10. 10 og 3 giver 13."). */
export function speechFor(visual: AnyVisual, task: Task): SpeechPart[] {
  switch (visual.scene) {
    case 'dotsAdd':
      return [clip('s.round.hint.add'), num(visual.a), clip('op.og'), num(visual.b), clip('op.giver'), num(visual.a + visual.b, 'end')]
    case 'dotsSub':
      return [clip('s.round.hint.sub'), num(visual.a), clip('op.minus'), num(visual.b), clip('op.giver'), num(visual.a - visual.b, 'end')]
    case 'makeTen': {
      const fill = 10 - visual.a
      const rest = visual.b - fill
      return [clip('s.round.hint.makeTen'), num(visual.a), clip('op.og'), num(fill), clip('op.giver'), num(10, 'end'), num(10), clip('op.og'), num(rest), clip('op.giver'), num(visual.a + visual.b, 'end')]
    }
    case 'backToTen': {
      const down = visual.a - 10
      const rest = visual.b - down
      return [clip('s.round.hint.backToTen'), num(visual.a), clip('op.minus'), num(down), clip('op.giver'), num(10, 'end'), num(10), clip('op.minus'), num(rest), clip('op.giver'), num(visual.a - visual.b, 'end')]
    }
    case 'columns': {
      const result = visual.op === '+' ? visual.a + visual.b : visual.a - visual.b
      return [clip('s.round.hint.columns'), num(visual.a), clip(visual.op === '+' ? 'op.plus' : 'op.minus'), num(visual.b), clip('op.giver'), num(result, 'end')]
    }
    case 'anim.forgotCarry':
      return [clip('s.round.hint.forgotCarry'), num(visual.a), clip('op.plus'), num(visual.b), clip('op.giver'), num(visual.a + visual.b, 'end')]
    case 'anim.smallerFromLarger':
      return [clip('s.round.hint.smallerFromLarger'), num(visual.a), clip('op.minus'), num(visual.b), clip('op.giver'), num(visual.a - visual.b, 'end')]
    case 'anim.digitSwap':
      return [clip('s.round.hint.digitSwap'), ...tensOnesWords(visual.n)]
    case 'tensOnes':
      return [clip('s.round.hint.tensFirst'), ...tensOnesWords(visual.n)]
    case 'objects':
      if (task.kind === 'countTap') return [clip('s.round.hint.countOut'), clip('s.round.hint.shouldBe'), num(visual.n, 'end')]
      return [clip('s.round.hint.count'), clip('s.round.hint.thereAre'), num(visual.n, 'end')]
    case 'array':
      return [clip('s.round.hint.array')]
    case 'splitArray':
      return [clip('s.round.hint.splitArray')]
    case 'coinsSum':
      return [clip('s.round.hint.coinsSum'), clip('frag.det_er'), { money: { ore: visual.ore.reduce((x, y) => x + y, 0), form: 'end' } }]
    case 'clockMove':
      return [clip('s.round.hint.clockMove')]
    case 'line': {
      if (task.kind === 'sortOrder') return [clip('s.round.hint.orderLine')]
      const n = task.answer
      if (task.kind !== 'numberline' || typeof n !== 'number') return [clip('s.round.hint.line')]
      if (n > 10 && n < 100 && n % 10 !== 0) return [clip('s.round.hint.line'), ...tensOnesWords(n)]
      return [clip('s.round.hint.line'), clip('s.round.hint.answerIs'), num(n, 'end')]
    }
    default:
      return typeof task.answer === 'number' && task.answerType === 'int' ? [clip('s.round.hint.look'), clip('s.round.hint.answerIs'), num(task.answer, 'end')] : [clip('s.round.hint.look')]
  }
}

const speakable = (parts: readonly SpeechPart[]) => parts.length > 0 && compile(parts).missing.length === 0

// ─── Resolution ─────────────────────────────────────────────────────────────

/**
 * The strategy after a mistake with `given` (null: the standard strategy, as for the lightbulb).
 * `skills` defaults to the registered skills; tests and the harness pass their own.
 */
export function hintFor(task: Task, given: AnswerValue | null, skills?: SkillRegistry): ResolvedHint {
  const tag = given === null ? null : safely(() => classifyAnswer(task, given))
  const def = (skills ?? skillRegistry()).get(task.skill)
  const spec: HintSpec | null = def ? safely(() => skillHint(def, task, tag)) : null
  const misconception = spec?.misconception ?? (isMisconceptionId(tag) ? tag : null)

  let visual: AnyVisual = spec && spec.visual.scene !== 'none' ? spec.visual : defaultVisual(task)
  let animated = false
  // The film replaces a skill's still picture only for the child's own misconception.
  const anim = isAnimated(misconception) && misconception === tag ? animatedVisual(misconception, task, given) : null
  if (anim && (spec?.animated || !spec || spec.visual.scene === 'none' || spec.misconception === misconception)) {
    visual = anim
    animated = true
  }

  const own = spec && speakable(spec.speech) && !(animated && !spec.misconception)
  return {
    speech: own ? spec.speech : speechFor(visual, task),
    visual: onTaskLine(visual, task),
    tag,
    misconception: isMisconceptionId(misconception) ? misconception : null,
    animated,
    fromSkill: !!own,
  }
}

/** What the lightbulb shows (SPEC §3.5): the skill's standard picture, never a film. */
export function scaffoldFor(task: Task, skills?: SkillRegistry): AnyVisual {
  const def = (skills ?? skillRegistry()).get(task.skill)
  const spec = def ? safely(() => skillHint(def, task, null)) : null
  if (spec && spec.visual.scene !== 'none') return onTaskLine(spec.visual, task)
  return onTaskLine(defaultVisual(task), task)
}

// ─── Support on a new key, without the answer (review r1 P2-5) ─────────────
//
// A key in box 0 is shown with some support from the start (Task.scaffold). That support helps the
// child work the answer out; it never shows it. The counters of a sum, the things to count laid out
// in a row, a number line to count along with the given number marked: all fine. A hop that lands
// on the answer, the answer's amount next to a number the child only heard, its digits or the right
// figure: those give the answer away, so they stay behind the lightbulb, which the child opens
// (SPEC §3.5: it never opens by itself) and which logs the answer as assisted — it then never
// moves the box (SPEC §5.1).

/** The numbers a picture points at as an answer: hop ends, the target dot and the arrow. */
const lineMarks = (v: Extract<AnyVisual, { scene: 'line' }>): number[] => [
  ...(v.hops ?? []), ...(v.target !== undefined ? [v.target] : []), ...(v.arrowAt !== undefined ? [v.arrowAt] : []),
]

/** Does the picture show more than the question already does? (A bare copy of its line does not.) */
export function addsToPrompt(v: AnyVisual, task: Task): boolean {
  if (v.scene === 'none') return false
  if (task.prompt.scene === 'line' && (v.scene === 'line' || v.scene === 'markedLine')) return (v.hops?.length ?? 0) > 1
  return true
}

/** Does the picture give the task's answer away? */
export function revealsAnswer(v: AnyVisual, task: Task): boolean {
  switch (v.scene) {
    case 'none':
    case 'dotsAdd':
    case 'dotsSub':
    case 'array':
    case 'splitArray':
      // counters to count: the child still does the counting
      return false
    case 'line': {
      const marks = lineMarks(v)
      if (typeof task.answer !== 'number') return marks.length > 1
      return marks.includes(task.answer)
    }
    case 'markedLine':
      // the cards' numbers are marked alike; a hop that lands on one of them points at it
      return (v.hops?.length ?? 0) > 0
    case 'objects': {
      // the very picture the child counts, laid out again, is the task itself; the amount of the
      // answer beside a number that was only heard (or a pile to count out) is the answer
      const p = task.prompt
      return !(p.scene === 'objects' && task.kind !== 'countTap' && p.n === v.n)
    }
    default:
      return true
  }
}

/**
 * A number line to count along, from 0 to 10 or 20, with the number the question starts from marked
 * (the 7 of "Hvilket tal kommer efter 7?"); null when the answer is no number up to 20, or when the
 * task is asked on a number line already.
 */
export function countingLine(task: Task): AnyVisual | null {
  const p = task.prompt
  if (p.scene === 'line') return null
  // tens and ones are not counted along a line: "74 = □ tiere og □ enere" (7|4) or the blocks of
  // 748 have digits for an answer, and a 0–10 line under them helps nobody (UI-fund 5)
  if (p.scene === 'base' || SKILL_BY_ID[task.skill]?.domain === 'place') return null
  const answer = typeof task.answer === 'number' ? [task.answer] : String(task.answer).split('|').map(Number)
  if (task.answerType !== 'int' && task.answerType !== 'set') return null
  if (answer.some((n) => !Number.isInteger(n) || n < 0)) return null
  const given = p.scene === 'row' ? p.cells.filter((c): c is number => typeof c === 'number') : []
  // a sum is counted on from its bigger number (a difference back from its first): that one is marked
  const sum = sumOf(p)
  const start = sum && (sum.op === '+' || sum.op === '−') ? (sum.op === '+' ? Math.max(sum.a, sum.b) : sum.a) : null
  if (start !== null) given.push(start)
  const top = Math.max(...answer, ...given)
  if (top > 20) return null
  const line: Extract<AnyVisual, { scene: 'line' }> = { scene: 'line', min: 0, max: top <= 10 ? 10 : 20 }
  // marking one of two candidates ("seks eller otte?") would point at or away from the answer
  if (given.length > 0 && !answer.some((n) => given.includes(n))) line.arrowAt = given[0]
  return line
}

/**
 * The support a new key is shown with: the skill's own picture when it leaves the answer to the
 * child, else a number line to count along, else nothing.
 */
/** Prompts that are a scale themselves: a bare counting line under them adds nothing. */
const SCALE_SCENES: ReadonlySet<Task['prompt']['scene']> = new Set(['ruler', 'chart', 'unitsRow'])

export function supportFor(task: Task, skills?: SkillRegistry): AnyVisual | null {
  const full = scaffoldFor(task, skills)
  if (!addsToPrompt(full, task)) return null
  if (!revealsAnswer(full, task)) return full
  if (SCALE_SCENES.has(task.prompt.scene)) return null
  const line = countingLine(task)
  return line && !revealsAnswer(line, task) ? line : null
}
