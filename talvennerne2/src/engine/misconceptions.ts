// Misconception diagnostics (SPEC §4). The signatures of classifyAnswer, detectableOf, natureFor and
// updateMisconceptions are frozen by the integrator — the data layer calls them for every answer.
import {
  PERCEPTUAL_MISCONCEPTIONS,
  type AnswerLogEntry, type AnswerValue, type ErrorTag, type LearningEvent, type MisconceptionId,
  type MisconceptionState, type Prompt, type SkillId, type Task,
} from './types'
import { isCorrect } from './answer'
import { daysBetween } from './learningDay'
import { isMisconceptionId, PICK_KINDS } from './tasks'

/**
 * The app tells a parent "we have seen signs of …" with its authority behind it, so it must not
 * conclude from noise. Evidence is weighed (a typed answer says more than a tapped card), has to
 * recur across facts and days, and has to beat what guessing would produce. A child who is
 * guessing (under 40 % first-try accuracy in the skill) gives no choice evidence at all.
 */

export type MisconceptionStates = Partial<Record<MisconceptionId, MisconceptionState>>

/** In these skills reversing the digits is about how Danish says numbers — a concept, not a slip. */
export const DIGIT_SWAP_CONCEPT_SKILLS: readonly SkillId[] = ['hear20', 'hear100', 'hear1000', 'tensOnes', 'placeValue1000']

const SLIPS: ReadonlySet<MisconceptionId> = new Set<MisconceptionId>([
  'tableNeighbour', 'countFromFirst', 'hourHandMisread', 'skipStepOne', 'wrongOperation',
])

/** The perceptual misconception a contrast task in each skill tests (pædagogik-forslaget §3.2). */
export const PERCEPTUAL_BY_SKILL: Readonly<Partial<Record<SkillId, MisconceptionId>>> = {
  compareLength: 'lengthByEnd',
  weightCompare: 'sizeIsWeight',
  halfShape: 'unequalParts',
  fractionShape: 'unequalParts',
  shapes2D: 'prototypeOnly',
  sortShapes: 'prototypeOnly',
}

/** Evidence window in learning days, and how much of it a state keeps (SPEC §4.3, types.ts). */
export const WINDOW_DAYS = 30
const MAX_HITS = 40
const MAX_OPPS = 80

/** Below this first-try accuracy in the skill the child is guessing: choice evidence is ignored. */
export const GUESSING_BELOW = 0.4

// ─── Classification ─────────────────────────────────────────────────────────

/** 53 → 35: the tens and ones of a number swapped (null when the swap is not a different two-digit ending). */
export function digitSwapOf(n: number): number | null {
  if (!Number.isInteger(n) || n < 10) return null
  const ones = n % 10
  const tens = Math.floor(n / 10) % 10
  if (ones === tens || ones === 0 || tens === 0) return null
  return n - 10 * tens - ones + 10 * ones + tens
}

/** Numbers the child can see in the prompt: a swapped answer that is also one of them is an operand, not a swap. */
export function promptNumbers(p: Prompt): number[] {
  const fromTerms = (terms: readonly unknown[]) =>
    terms.flatMap((t) => (t && typeof t === 'object' && 'n' in t && typeof t.n === 'number' ? [t.n] : []))
  switch (p.scene) {
    case 'equation': return fromTerms(p.terms)
    case 'balance': return fromTerms([...p.left, ...p.right])
    case 'row': return p.cells.filter((c): c is number => typeof c === 'number')
    case 'story': return [...p.nums]
    case 'groups': return [p.groups, p.size]
    case 'array': return [p.rows, p.cols]
    case 'share': return [p.total, p.recipients]
    case 'objects': return [p.n]
    default: return []
  }
}

/**
 * A reversed answer only counts as digitSwap where it can be told apart from other errors: in the
 * hear/place skills, and on typed answers of 13 or more with two different non-zero digits, where the
 * reversed number is not also on screen (38 + 45 answered 38 is an operand, SPEC §4.1).
 */
function digitSwapPossible(task: Task): boolean {
  if (typeof task.answer !== 'number') return false
  const swapped = digitSwapOf(task.answer)
  if (swapped === null) return false
  if (DIGIT_SWAP_CONCEPT_SKILLS.includes(task.skill)) return true
  return task.kind === 'keypad' && task.answer >= 13 && !promptNumbers(task.prompt).includes(swapped)
}

const dialKey = (task: Task, v: AnswerValue): string =>
  typeof v === 'number' && task.modulo ? String(((v % task.modulo) + task.modulo) % task.modulo) : String(v)

/** Error tag for a wrong answer (null when correct). Uses the task's tagged candidates first. */
export function classifyAnswer(task: Task, given: AnswerValue): ErrorTag | null {
  if (isCorrect(task, given)) return null
  // the share view reports an uneven deal as −1 (SPEC §3.2)
  if (task.kind === 'share' && given === -1) return 'shareUnequal'
  // A value the skill tagged wins — including 'near' and 'operand' — and stops here: an operand
  // must never be read as a reversed number just because it happens to be one.
  const tagged = task.distractorTags[dialKey(task, given)]
  if (tagged) return tagged
  if (typeof given === 'number' && typeof task.answer === 'number' && digitSwapPossible(task) && digitSwapOf(task.answer) === given) {
    return 'digitSwap'
  }
  return 'other'
}

/**
 * Misconceptions this task could reveal (the opportunities). A card task can only show the ideas on
 * its cards; a typed or built answer can show any the skill has a candidate for. A contrast task
 * always counts for its perceptual misconception — the congruent items are what prove the child
 * can do the task when the eye does not mislead.
 */
export function detectableOf(task: Task): MisconceptionId[] {
  const out = new Set<MisconceptionId>()
  const swapped = typeof task.answer === 'number' && digitSwapPossible(task) ? digitSwapOf(task.answer) : null
  if (PICK_KINDS.has(task.kind)) {
    for (const o of task.options) {
      const tag = task.distractorTags[dialKey(task, o)]
      if (isMisconceptionId(tag)) out.add(tag)
      else if (swapped !== null && o === swapped && !tag) out.add('digitSwap')
    }
  } else {
    for (const tag of Object.values(task.distractorTags)) if (isMisconceptionId(tag)) out.add(tag)
    if (swapped !== null && !(String(swapped) in task.distractorTags)) out.add('digitSwap')
  }
  const perceptual = PERCEPTUAL_BY_SKILL[task.skill]
  if (task.contrast && perceptual) out.add(perceptual)
  return [...out]
}

/** 'concept' or 'slip'; digitSwap is a concept only in hear*, tensOnes and placeValue1000. */
export function natureFor(id: MisconceptionId, skill: SkillId): 'concept' | 'slip' {
  if (id === 'digitSwap') return DIGIT_SWAP_CONCEPT_SKILLS.includes(skill) ? 'concept' : 'slip'
  return SLIPS.has(id) ? 'slip' : 'concept'
}

// ─── Evidence and flags ─────────────────────────────────────────────────────

export interface ObserveContext {
  /** First-try accuracy in this skill over the last 20 answers, 0–1 (choice evidence is ignored below 0.4). */
  skillAccuracy20: number
  /** 'YYYY-MM-DD' learning day of the answer. */
  day: string
  /**
   * Task.contrast of the answered task. Perceptual misconceptions are only concluded from contrast,
   * and AnswerLogEntry does not carry it (proposed for types.ts).
   */
  contrast?: 'conflict' | 'congruent'
}

type Hit = MisconceptionState['hits'][number]
/**
 * An opportunity, plus two fields the frozen type does not have yet (proposed for types.ts): when it
 * happened, so "new opportunities since the flag" can be counted, and the contrast of the task.
 */
type Opp = MisconceptionState['opps'][number] & { ts?: number; contrast?: 'conflict' | 'congruent' }

const PERCEPTUAL: ReadonlySet<MisconceptionId> = new Set(PERCEPTUAL_MISCONCEPTIONS)

/** Retries, answers after help, placement, a silent device and the golden egg are never evidence. */
export function countsAsEvidence(e: Pick<AnswerLogEntry, 'mode' | 'retryOf' | 'assisted' | 'audioUnverified'>): boolean {
  if (e.retryOf || e.assisted || e.audioUnverified) return false
  return e.mode !== 'retry' && e.mode !== 'placement' && e.mode !== 'golden'
}

/** Evidence weight of a hit: typed 1.0, card 0.5, true/false 0.25. */
export const evidenceWeight = (e: Pick<AnswerLogEntry, 'production' | 'kind'>): number =>
  e.production ? 1 : e.kind === 'trueFalse' ? 0.25 : 0.5

/** Chance of landing on a given wrong answer by guessing. */
export const guessChance = (e: Pick<AnswerLogEntry, 'production' | 'kind' | 'optionsCount'>): number =>
  e.production ? 0 : e.kind === 'trueFalse' ? 0.5 : e.optionsCount > 0 ? 1 / e.optionsCount : 0.25

const emptyState = (): MisconceptionState => ({ status: 'watching', hits: [], opps: [], flaggedAt: null, resolvedAt: null })

function prune(s: MisconceptionState, day: string): MisconceptionState {
  const inside = (d: string) => daysBetween(d, day) < WINDOW_DAYS
  const hits = s.hits.filter((h) => inside(h.day))
  const opps = s.opps.filter((o) => inside(o.day))
  return hits.length === s.hits.length && opps.length === s.opps.length ? s : { ...s, hits, opps }
}

/** Fold one logged answer into the per-profile misconception states (flag/resolve rules, SPEC §4.3). */
export function updateMisconceptions(prev: MisconceptionStates, entry: AnswerLogEntry, ctx: ObserveContext): MisconceptionStates {
  if (!countsAsEvidence(entry) || entry.detectable.length === 0) return prev
  // a child who is guessing taps the diagnostic card as often as any other
  if (!entry.production && ctx.skillAccuracy20 < GUESSING_BELOW) return prev

  const next: MisconceptionStates = { ...prev }
  const pGuess = guessChance(entry)
  const w = evidenceWeight(entry)
  for (const id of new Set(entry.detectable)) {
    const s = prune(prev[id] ?? emptyState(), ctx.day)
    const contrast = PERCEPTUAL.has(id) ? ctx.contrast : undefined
    const hit = !entry.correct && entry.errorTag === id
    const opp: Opp = { day: entry.day, pGuess, hit, correct: entry.correct, ts: entry.ts, ...(contrast ? { contrast } : {}) }
    const hits: Hit[] = hit ? [...s.hits, { day: entry.day, factId: entry.factId, w, production: entry.production }].slice(-MAX_HITS) : s.hits
    let state: MisconceptionState = { ...s, hits, opps: [...s.opps, opp].slice(-MAX_OPPS) }

    if (state.status === 'flagged') {
      if (isResolved(state)) state = { ...state, status: 'resolved', resolvedAt: entry.ts, hits: [], opps: [] }
    } else if (meetsFlag(id, state)) {
      state = { ...state, status: 'flagged', flaggedAt: entry.ts, resolvedAt: null }
    }
    next[id] = state
  }
  return next
}

/** The six conditions (SPEC §4.3), with the countFromFirst and contrast special rules. */
export function meetsFlag(id: MisconceptionId, s: Pick<MisconceptionState, 'hits' | 'opps'>): boolean {
  const { hits } = s
  const opps = s.opps as readonly Opp[]
  const weight = hits.reduce((sum, h) => sum + h.w, 0)
  if (new Set(hits.map((h) => h.factId)).size < 3) return false
  if (new Set(hits.map((h) => h.day)).size < 2) return false
  // choice evidence alone never flags: every skill has a production kind (SPEC §3.3)
  if (hits.filter((h) => h.production).length < 2) return false

  if (id === 'countFromFirst') {
    // ±1 slips are common in both directions; only a steady "one short" pattern is counting from the first number
    if (weight < 4) return false
    const errors = opps.filter((o) => !o.correct).length
    const expected = opps.filter((o) => o.hit).length
    if (errors === 0 || expected / errors < 0.7) return false
    return beatsGuessing(opps)
  }
  if (weight < 3) return false
  if (PERCEPTUAL.has(id)) return contrastHolds(opps)
  return beatsGuessing(opps)
}

function beatsGuessing(opps: readonly Opp[]): boolean {
  if (opps.length === 0) return false
  const rate = opps.filter((o) => o.hit).length / opps.length
  const meanGuess = opps.reduce((sum, o) => sum + o.pGuess, 0) / opps.length
  return rate >= Math.min(0.9, meanGuess + 0.35)
}

/**
 * Perceptual misconceptions: the child must get the congruent items right (≥ 80 % of ≥ 6) and pick
 * the misleading answer on the conflict items (≥ 60 % of ≥ 6). A guesser fails the first half.
 */
function contrastHolds(opps: readonly Opp[]): boolean {
  const congruent = opps.filter((o) => o.contrast === 'congruent')
  const conflict = opps.filter((o) => o.contrast !== 'congruent')
  if (congruent.length < 6 || conflict.length < 6) return false
  const congruentRight = congruent.filter((o) => o.correct).length / congruent.length
  const misled = conflict.filter((o) => o.hit).length / conflict.length
  return congruentRight >= 0.8 && misled >= 0.6
}

/** After a flag: ≥ 6 new opportunities, ≥ 5 of them right, and no evidence in the last 6. */
function isResolved(s: MisconceptionState): boolean {
  const since = s.flaggedAt ?? 0
  const after = (s.opps as readonly Opp[]).filter((o) => (o.ts ?? 0) > since)
  if (after.length < 6) return false
  if (after.filter((o) => o.correct).length < 5) return false
  return !s.opps.slice(-6).some((o) => o.hit)
}

/** Misconceptions currently flagged (they steer the targeted slot in roundBuilder). */
export function flaggedIds(states: MisconceptionStates): MisconceptionId[] {
  return (Object.keys(states) as MisconceptionId[]).filter((id) => states[id]?.status === 'flagged')
}

/** 'misconceptionResolved' for every flag that the last answers lifted. */
export function misconceptionEvents(prev: MisconceptionStates, next: MisconceptionStates): LearningEvent[] {
  const out: LearningEvent[] = []
  for (const id of Object.keys(next) as MisconceptionId[]) {
    if (prev[id]?.status === 'flagged' && next[id]?.status === 'resolved') out.push({ t: 'misconceptionResolved', id })
  }
  return out
}
