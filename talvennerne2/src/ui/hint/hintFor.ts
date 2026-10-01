// Which strategy to show after a mistake (SPEC §3.5) and what the lightbulb opens. The skill decides:
// SkillDef.hint(fact, errorTag) gives the misconception's own hint when the child's answer carries
// one, else the skill's standard strategy. A flag never changes the hint. This module only fills
// gaps so the round never shows an empty card: a skill without words gets the round's own sentences
// with the task's numbers, a skill without a picture gets one drawn from the prompt, and the three
// animated misconceptions (digitSwap, forgotCarry, smallerFromLarger) get their film.
import type {
  AnswerValue, ErrorTag, Fact, HintSpec, HintVisual, MisconceptionId, Prompt, SkillDef, SpeechPart, Task, TaskKind,
} from '../../engine/types'
import { classifyAnswer } from '../../engine/misconceptions'
import { factsOf, skillRegistry } from '../../engine/registry'
import type { SkillRegistry } from '../../engine/registry'
import { isMisconceptionId } from '../../engine/tasks'
import { compile } from '../../speech/compile'
import { promptNums } from '../task/answers'

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

export type AnyVisual = HintVisual | LocalVisual

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
  return { id: task.factId, skill: task.skill, family: task.family, operands: promptNums(task.prompt), answer: task.answer, rank: 0 }
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
      return [clip('s.round.hint.count'), clip('s.round.hint.thereAre'), num(visual.n, 'end')]
    case 'array':
      return [clip('s.round.hint.array')]
    case 'splitArray':
      return [clip('s.round.hint.splitArray')]
    case 'coinsSum':
      return [clip('s.round.hint.coinsSum'), clip('frag.det_er'), { money: { ore: visual.ore.reduce((x, y) => x + y, 0), form: 'end' } }]
    case 'clockMove':
      return [clip('s.round.hint.clockMove')]
    case 'line':
      return [clip('s.round.hint.line')]
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
    visual,
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
  if (spec && spec.visual.scene !== 'none') return spec.visual
  return defaultVisual(task)
}
