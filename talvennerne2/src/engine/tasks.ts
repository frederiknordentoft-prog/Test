import {
  MISCONCEPTION_IDS, SPOKEN_OPTION_VIEWS,
  type AnswerType, type AnswerValue, type Box, type Candidate, type ClipId, type ErrorTag, type Fact,
  type MisconceptionId, type Prompt, type RoundMode, type SkillDef, type SkillId, type Task, type TaskKind,
} from './types'
import type { Rng } from './rng'
import { isCorrect } from './answer'
import { PRODUCTION_GUESS_LIMIT } from './kinds'
import { extrasOf } from './skills/types'

/**
 * One generic task builder for every skill (SPEC §3, §4.1). A SkillDef says what the question is —
 * prompt, answer, tagged wrong answers — and this module turns that into a card set the child can
 * actually be tested with: which wrong answers are shown, how precise a number line has to be,
 * how many digits the keypad takes. Keeping those rules in one place is what makes the 72 skills
 * behave alike, and what lets the diagnostics trust a logged answer.
 */

/** Choice cards: the answer, one diagnostic distractor and one near miss (SPEC §4.1). */
export const CHOICE_CARDS = 3
/** Pair bubbles (tenFriends): the partner and three others. */
export const PAIR_BUBBLES = 4

/** Kinds where the child picks one of the shown options as the answer. */
export const PICK_KINDS: ReadonlySet<TaskKind> = new Set<TaskKind>(['choice', 'pair', 'trueFalse'])

/** Rounds that test rather than teach: no manipulatives on screen (SPEC §5.4, §8). */
const NO_SCAFFOLD: ReadonlySet<string> = new Set(['trial', 'finale', 'placement', 'golden'])

/** "et hundrede og fire" typed as 1004 must fit on the keypad to be seen (SPEC §3.1). */
const WIDE_KEYPAD: ReadonlySet<SkillId> = new Set<SkillId>(['hear1000', 'placeValue1000'])

const MISCONCEPTIONS: ReadonlySet<string> = new Set(MISCONCEPTION_IDS)
export const isMisconceptionId = (tag: unknown): tag is MisconceptionId => typeof tag === 'string' && MISCONCEPTIONS.has(tag)

/** recall: one key per fact · procedure: one key per family (SPEC §2.4). */
export const masteryKeyOf = (def: Pick<SkillDef, 'id' | 'mode'>, fact: Pick<Fact, 'id' | 'family'>): string =>
  def.mode === 'recall' ? fact.id : `${def.id}/${fact.family}`

export type Operation = '+' | '−' | '·' | ':'
const ARITHMETIC: ReadonlySet<string> = new Set(['+', '−', '·', ':'])

/** The arithmetic operation a prompt shows, for the "not more than three in a row" rule. */
export function operationOfPrompt(p: Prompt): Operation | null {
  const terms = p.scene === 'equation' ? p.terms : p.scene === 'balance' ? [...p.left, ...p.right] : []
  for (const t of terms) if ('op' in t && ARITHMETIC.has(t.op)) return t.op as Operation
  return null
}

export interface TaskContext {
  /** Box of the task's mastery key: the manipulative scaffold only shows at box 0. */
  box?: Box
  mode?: RoundMode | 'golden'
  /** How often each misconception has been offered to this profile so far (profile.offeredTags + this plan). */
  offered?: Partial<Record<MisconceptionId, number>>
  /** Prefer these misconceptions for the diagnostic distractor (the targeted slot). */
  target?: readonly MisconceptionId[]
}

export interface BuiltTask {
  task: Task
  /**
   * Misconceptions shown as a card. The data layer counts profile.offeredTags when the answer is
   * recorded (offeredTagsOf(task)); a plan only uses this for its own rotation within the round.
   */
  offered: MisconceptionId[]
}

/**
 * The tag a value gets when several candidates share it. One misconception wins over 'near' and
 * 'operand' — countFromFirst is always a ±1 answer, so it could never be seen otherwise — but two
 * misconceptions on one value make it 'ambiguous', and an ambiguous answer is never evidence.
 */
export function resolveTag(tags: readonly ErrorTag[]): ErrorTag {
  const mis = [...new Set(tags.filter(isMisconceptionId))]
  if (mis.length === 1) return mis[0]
  if (mis.length > 1) return 'ambiguous'
  return tags[0] ?? 'other'
}

/**
 * Number-line tolerance: 5 % of the span (0–100: 5, 0–1000: 50), shrunk until a tap still counts as
 * production (guess rate ≤ 12 %). A 0–20 line is therefore exact: ±1 would make it a 3-in-21 guess.
 */
export function lineTolerance(span: number): number {
  let t = Math.max(0, Math.floor(span / 20))
  while (t > 0 && (2 * t + 1) / (span + 1) > PRODUCTION_GUESS_LIMIT) t--
  return t
}

/**
 * Clip id that reads an option card aloud when the skill does not name one: 'unit:cm' →
 * 'noun.unit.cm', 'cmp:<' → 'op.lt', numbers → 'n.end.N'. Skills override it with `optionClip`.
 */
export function defaultOptionClip(value: AnswerValue): ClipId {
  if (typeof value === 'number') return `n.end.${value}`
  if (value === 'yes' || value === 'no') return `s.${value === 'yes' ? 'ja' : 'nej'}`
  const cut = value.indexOf(':')
  const prefix = cut > 0 ? value.slice(0, cut) : ''
  const body = cut > 0 ? value.slice(cut + 1) : value
  if (prefix === 'cmp') return `op.${body === '<' ? 'lt' : body === '>' ? 'gt' : 'eq'}`
  const safe = body.replace(/[^A-Za-z0-9]+/g, '_')
  return prefix ? `noun.${prefix}.${safe}` : `noun.${safe}`
}

const digitsOf = (n: number): number => String(Math.floor(Math.abs(n))).length
const numify = (s: string): AnswerValue => (/^\d+$/.test(s) ? Number(s) : s)

interface Tagged { key: string; value: AnswerValue; tag: ErrorTag }

export function buildTask(def: SkillDef, fact: Fact, kind: TaskKind, rng: Rng, occurrence: number, ctx: TaskContext = {}): BuiltTask {
  const ext = extrasOf(def)
  if (!def.kinds.includes(kind)) throw new Error(`${def.id} has no ${kind} tasks (${fact.id})`)

  const answer = ext.answer ? ext.answer(fact, kind) : fact.answer
  const answerType: AnswerType = ext.answerTypeFor ? ext.answerTypeFor(fact, kind) : def.answerType(fact)
  const numeric = typeof answer === 'number'

  // Keypad is for numbers only, and for money only in whole kroner (SPEC §3.1).
  if (kind === 'keypad') {
    if (answerType !== 'int' && answerType !== 'ore') throw new Error(`keypad needs an int or øre answer: ${fact.id} is ${answerType}`)
    if (answerType === 'ore' && (typeof answer !== 'number' || answer % 100 !== 0)) throw new Error(`keypad takes whole kroner only: ${fact.id} (${String(answer)} øre)`)
  }

  const prompt = def.prompt(fact, kind, rng)
  const optionView = def.optionView(fact, kind)
  const range = def.range(fact, kind)
  const speech = def.speech(fact, kind)
  const accept = ext.accept ? ext.accept(fact, kind) : []

  const tolerance = kind === 'numberline' ? (ext.tolerance ? ext.tolerance(fact, kind) : lineTolerance(range[1] - range[0])) : 0
  const h24 = (prompt.scene === 'clock' && prompt.h24 === true) || (typeof answer === 'number' && answer >= 720)
  const modulo: 0 | 720 | 1440 = answerType === 'minutes' ? (h24 ? 1440 : 720) : 0
  const entryScale: 1 | 100 = kind === 'keypad' && answerType === 'ore' ? 100 : 1
  const unit = answerType === 'ore' ? 'kr' : (ext.unit ? ext.unit(fact, kind) : null)
  let maxDigits = digitsOf(range[1] / entryScale)
  if (WIDE_KEYPAD.has(def.id) && typeof answer === 'number') maxDigits = Math.max(maxDigits, digitsOf(answer) + 2)

  // A clock set to 15:00 on an analog face is the same answer as 3:00: compare on the dial.
  const norm = (v: AnswerValue): AnswerValue => (typeof v === 'number' && modulo ? ((v % modulo) + modulo) % modulo : v)
  const keyOf = (v: AnswerValue) => String(norm(v))
  const probe: Task = {
    id: '', factId: fact.id, masteryKey: '', skill: def.id, family: fact.family, kind, prompt, answer, answerType,
    accept, tolerance, modulo, options: [], optionView, distractorTags: {}, optionClips: null, unit, entryScale,
    range, maxDigits, scaffold: false, speech, retryOf: null,
  }
  const isRight = (v: AnswerValue) => isCorrect(probe, v)

  // Candidates must look like an answer to this task: numbers for numbers, a set for a set.
  const multi = answerType === 'set' || (typeof answer === 'string' && answer.includes('|'))
  const fits = (v: AnswerValue): boolean =>
    numeric
      ? typeof v === 'number' && Number.isFinite(v) && v >= 0
      : typeof v === 'string' && v !== '' && (multi || !v.includes('|'))
  const shows = (v: AnswerValue): boolean => {
    if (!fits(v) || isRight(v)) return false
    if (typeof v !== 'number') return true
    const n = norm(v) as number
    return n >= range[0] && n <= range[1]
  }

  // Every tagged wrong answer goes into distractorTags — also the ones never shown — so that a
  // typed keypad answer can be classified as well as a tapped card.
  const groups = new Map<string, { value: AnswerValue; tags: ErrorTag[] }>()
  for (const c of def.candidates(fact) as readonly Candidate[]) {
    if (!fits(c.value) || isRight(c.value)) continue
    const k = keyOf(c.value)
    const g = groups.get(k)
    if (g) g.tags.push(c.tag)
    else groups.set(k, { value: norm(c.value), tags: [c.tag] })
  }
  const distractorTags: Record<string, ErrorTag> = {}
  const tagged: Tagged[] = []
  for (const [key, g] of groups) {
    const tag = resolveTag(g.tags)
    distractorTags[key] = tag
    tagged.push({ key, value: g.value, tag })
  }

  let options: AnswerValue[] = []
  if (kind === 'choice' || kind === 'pair') {
    const want = kind === 'pair' ? PAIR_BUBBLES - 1 : CHOICE_CARDS - 1
    const chosen = chooseDistractors(want, tagged.filter((t) => shows(t.value)), {
      rng, offered: ctx.offered ?? {}, target: ctx.target ?? [], numeric, answer, answerType, shows, keyOf, distractorTags,
    })
    if (chosen.length === 0) throw new Error(`${def.id}: no distractor for ${fact.id}`)
    for (const c of chosen) if (!(c.key in distractorTags)) distractorTags[c.key] = c.tag
    options = rng.shuffle([answer, ...chosen.map((c) => c.value)])
  } else if (kind === 'trueFalse') {
    options = ['yes', 'no']
  } else if (kind === 'multiSelect' || kind === 'sortOrder' || kind === 'fillSlots') {
    options = listOptions(def, fact, kind, answer, prompt, rng)
  }

  const optionClips = SPOKEN_OPTION_VIEWS.includes(optionView) && options.length > 0
    ? options.map((v) => (ext.optionClip ? ext.optionClip(fact, v) : defaultOptionClip(v)))
    : null

  const rawContrast = ext.contrast ? ext.contrast(fact) : fact.data?.contrast
  const contrast = rawContrast === 'conflict' || rawContrast === 'congruent' ? rawContrast : undefined
  const scaffold = (ctx.box ?? 0) === 0 && !NO_SCAFFOLD.has(ctx.mode ?? 'round')

  const task: Task = {
    ...probe,
    id: `${fact.id}#${occurrence}`,
    masteryKey: masteryKeyOf(def, fact),
    options,
    distractorTags,
    optionClips,
    scaffold,
    ...(contrast ? { contrast } : {}),
  }
  return { task, offered: offeredTagsOf(task) }
}

/** Misconceptions a task shows as a card: what the data layer adds to profile.offeredTags on the first try. */
export function offeredTagsOf(task: Task): MisconceptionId[] {
  if (!PICK_KINDS.has(task.kind)) return []
  const out = new Set<MisconceptionId>()
  for (const o of task.options) {
    const tag = task.distractorTags[String(o)]
    if (isMisconceptionId(tag)) out.add(tag)
  }
  return [...out]
}

interface Choosing {
  rng: Rng
  offered: Partial<Record<MisconceptionId, number>>
  target: readonly MisconceptionId[]
  numeric: boolean
  answer: AnswerValue
  answerType: AnswerType
  shows(v: AnswerValue): boolean
  keyOf(v: AnswerValue): string
  distractorTags: Readonly<Record<string, ErrorTag>>
}

/**
 * The diagnostic card rotates to the misconception this profile has been offered least, so every
 * misconception gets its chances to show; the near card keeps the set honest (a lone odd value is
 * easy to rule out). Further cards prefer plain wrong answers over a second misconception, so one
 * card set never tests two ideas at once.
 */
function chooseDistractors(want: number, pool: readonly Tagged[], c: Choosing): Tagged[] {
  const { rng } = c
  const chosen: Tagged[] = []
  const has = (key: string) => chosen.some((x) => x.key === key)

  const diagnostic = pool.filter((t) => isMisconceptionId(t.tag))
  if (diagnostic.length > 0 && want > 0) {
    const ids = [...new Set(diagnostic.map((t) => t.tag as MisconceptionId))]
    const aimed = c.target.filter((m) => ids.includes(m))
    const among = aimed.length > 0 ? aimed : ids
    const least = Math.min(...among.map((m) => c.offered[m] ?? 0))
    const id = rng.pick(among.filter((m) => (c.offered[m] ?? 0) === least))
    chosen.push(rng.pick(diagnostic.filter((t) => t.tag === id)))
  }

  if (chosen.length < want) {
    const near = pool.filter((t) => t.tag === 'near' && !has(t.key))
    const pick = near.length > 0 ? rng.pick(near) : nearMiss(c, has)
    if (pick) chosen.push(pick)
  }

  while (chosen.length < want) {
    const plain = pool.filter((t) => !has(t.key) && !isMisconceptionId(t.tag) && t.tag !== 'ambiguous')
    const other = pool.filter((t) => !has(t.key))
    const pick = plain.length > 0 ? rng.pick(plain) : nearMiss(c, has) ?? (other.length > 0 ? rng.pick(other) : null)
    if (!pick) break
    chosen.push(pick)
  }
  return chosen
}

/** A near miss the skill did not list: ±1, ±10, ±2 (an hour or half for clocks, a krone for money). */
function nearMiss(c: Choosing, has: (key: string) => boolean): Tagged | null {
  if (!c.numeric || typeof c.answer !== 'number') return null
  const steps = c.answerType === 'minutes' ? [60, 30, 15] : c.answerType === 'ore' ? [100, 50, 1000] : [1, 10, 2]
  // prefer a value that is not itself a misconception, so the near card stays a near card
  for (const allowTagged of [false, true]) {
    for (const step of steps) {
      for (const sign of c.rng.shuffle([1, -1])) {
        const value = c.answer + sign * step
        if (!c.shows(value)) continue
        const key = c.keyOf(value)
        if (has(key)) continue
        const tag = c.distractorTags[key]
        if (tag && isMisconceptionId(tag) && !allowTagged) continue
        return { key, value, tag: tag ?? 'near' }
      }
    }
  }
  return null
}

function listOptions(def: SkillDef, fact: Fact, kind: TaskKind, answer: AnswerValue, prompt: Prompt, rng: Rng): AnswerValue[] {
  const hook = extrasOf(def).options
  if (hook) return hook(fact, kind, rng)
  const data = fact.data ?? {}
  if (kind === 'sortOrder') {
    const parts = String(answer).split('|').map(numify)
    // never deal the cards already in order: tapping them left to right would be a free answer
    let dealt = rng.shuffle(parts)
    for (let i = 0; i < 12 && parts.length > 1 && dealt.join('|') === parts.join('|'); i++) dealt = rng.shuffle(parts)
    return dealt
  }
  if (kind === 'multiSelect') {
    if (prompt.scene === 'shapes') return prompt.items.map((i) => i.id)
    if (Array.isArray(data.options)) return [...(data.options as AnswerValue[])]
  }
  if (kind === 'fillSlots' && Array.isArray(data.palette)) return [...(data.palette as AnswerValue[])]
  throw new Error(`${def.id}: no options for ${kind} (${fact.id}); add an options() hook`)
}
