// Small helpers shared by the 0. klasse skills (number, addsub, shapes, algebra, measure): the
// metadata from SKILL_BY_ID, tagged candidate lists that keep one tag per value, and speech parts.
// It lives in number/ because every worker owns only its domain folders; the registry skips it
// (it has no SkillDef default export). The integrator may move it to src/engine/skills/kit.ts.
import { SKILL_BY_ID } from '../../../content/skills'
import {
  MISCONCEPTION_IDS,
  type AnswerValue, type Candidate, type ClipId, type ErrorTag, type HintSpec, type HintVisual, type MisconceptionId,
  type SkillId, type SpeechForm, type SpeechPart,
} from '../../types'

/** The fields every SkillDef copies from the metadata table (validateSkill compares them). */
export function metaOf(id: SkillId) {
  const m = SKILL_BY_ID[id]
  return {
    id,
    domain: m.domain,
    grade: m.grade,
    stage: m.stage,
    mode: m.mode,
    label: m.label,
    canDo: `s.cando.${id}` as ClipId,
    families: m.families,
  }
}

const MISCONCEPTIONS: ReadonlySet<string> = new Set(MISCONCEPTION_IDS)
export const isMisconception = (tag: ErrorTag | null | undefined): tag is MisconceptionId =>
  typeof tag === 'string' && MISCONCEPTIONS.has(tag)

/** An explanation of a wrong answer that competes with others: a misconception, or echoing a number. */
const strong = (tag: ErrorTag) => tag === 'operand' || isMisconception(tag)

export type Entry = readonly [value: AnswerValue, tag: ErrorTag]

/**
 * Candidates with exactly one tag per value, so classifying a value always gives its candidate's
 * tag (the uniqueness rule, SPEC §4.1). Values equal to the answer, negative numbers and empty
 * strings are dropped. When a value has two competing explanations — two misconceptions, or a
 * misconception and a number from the question (5 + 1 answered 5: counted from the first number,
 * or just repeated it?) — it becomes 'ambiguous' and is never evidence. A specific explanation
 * beats a plain 'near'/'other' for the same value.
 */
export function tagged(answer: AnswerValue, entries: Iterable<Entry>): Candidate[] {
  const out = new Map<string, Candidate>()
  for (const [value, tag] of entries) {
    if (value === answer) continue
    if (typeof value === 'number' && (!Number.isInteger(value) || value < 0)) continue
    if (typeof value === 'string' && value === '') continue
    const key = String(value)
    const prev = out.get(key)
    if (!prev) {
      out.set(key, { value, tag })
      continue
    }
    if (prev.tag === tag || prev.tag === 'ambiguous') continue
    if (strong(prev.tag) && strong(tag)) out.set(key, { value, tag: 'ambiguous' })
    else if (strong(tag)) out.set(key, { value, tag })
  }
  return [...out.values()]
}

// ─── Speech parts ───────────────────────────────────────────────────────────

export const say = (clip: ClipId): SpeechPart => ({ clip })
export const num = (n: number, form: SpeechForm = 'end', gender?: 'c' | 'n'): SpeechPart =>
  gender ? { num: n, form, gender } : { num: n, form }

/** A hint; `misconception` marks the specific explanation for the child's current error. */
export function hintOf(speech: SpeechPart[], visual: HintVisual, misconception?: MisconceptionId, animated?: boolean): HintSpec {
  return {
    speech,
    visual,
    ...(misconception ? { misconception } : {}),
    ...(animated ? { animated: true } : {}),
  }
}

/** Every integer from `from` to `to`, both included, in either direction. */
export function walk(from: number, to: number): number[] {
  const step = to >= from ? 1 : -1
  const out: number[] = []
  for (let v = from; step > 0 ? v <= to : v >= to; v += step) out.push(v)
  return out
}
