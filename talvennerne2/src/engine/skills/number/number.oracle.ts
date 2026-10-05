// Independent oracles for the number skills of 0. klasse (count10, count20, hear20, order20), and the
// small oracle kit the other domains' oracle tests share. Written by another agent than the
// generators (SPEC A5, §15.1): every right answer here is worked out from what the child is given —
// the fact id, the picture, the stones, the spoken question — and never from the generator code, so
// one mistake cannot hide in both. The kit lives in number/ because each agent owns only its own
// folders (like number/kit.ts); the registry skips *.oracle.ts files, so none of this reaches the app.
import { MISCONCEPTION_IDS, SPOKEN_OPTION_VIEWS } from '../../types'
import type {
  AnswerValue, ErrorTag, Fact, MisconceptionId, Prompt, SkillDef, SkillId, SpeechPart, Task, TaskKind,
} from '../../types'
import { buildTask } from '../../tasks'
import { getSkill } from '../../registry'
import { classifyAnswer } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, guessP, isProduction } from '../../kinds'
import { hashSeed, makeRng } from '../../rng'
import { compile } from '../../../speech/compile'

// ═══ The oracle kit (shared by every domain's oracle test) ═══════════════════

// ─── Danish number words: what the child hears ──────────────────────────────

const NUMBER_WORDS: ReadonlyMap<string, number> = new Map([
  ['nul', 0], ['en', 1], ['et', 1], ['to', 2], ['tre', 3], ['fire', 4], ['fem', 5], ['seks', 6], ['syv', 7],
  ['otte', 8], ['ni', 9], ['ti', 10], ['elleve', 11], ['tolv', 12], ['tretten', 13], ['fjorten', 14],
  ['femten', 15], ['seksten', 16], ['sytten', 17], ['atten', 18], ['nitten', 19], ['tyve', 20],
])

/** The number words 0–20 of a Danish sentence, in order: "Hvad er tre plus fire?" → [3, 4]. */
export function spokenNumbers(text: string): number[] {
  return text
    .toLowerCase()
    .split(/[^a-zæøå]+/)
    .flatMap((w) => (NUMBER_WORDS.has(w) ? [NUMBER_WORDS.get(w)!] : []))
}

/** The Danish text a task's speech becomes (what the voice says and the screen shows). */
export const spokenText = (parts: readonly SpeechPart[]): string => compile(parts).text

/** Problems with a spoken script (SPEC §10.1): unknown clips, digits in the text, nothing said, free text. */
export function speechProblems(parts: readonly SpeechPart[]): string[] {
  const c = compile(parts)
  const out: string[] = []
  if (c.missing.length > 0) out.push(`clips missing from the catalogue: ${c.missing.join(', ')}`)
  if (/[0-9]/.test(c.text)) out.push(`digits in "${c.text}"`)
  if (c.text.trim() === '') out.push('nothing is said')
  if (parts.some((p) => 'free' in p)) out.push('unrecorded free text')
  return out
}

// ─── Prompt scenes ──────────────────────────────────────────────────────────

/** The prompt as the given scene, or an error naming what it was. */
export function sceneOf<S extends Prompt['scene']>(p: Prompt, scene: S): Extract<Prompt, { scene: S }> {
  if (p.scene !== scene) throw new Error(`expected a ${scene} scene, got ${p.scene}`)
  return p as Extract<Prompt, { scene: S }>
}

/** Empty places (null cells) of a row of stones or beads. */
export const blanksOf = (p: Prompt): number => sceneOf(p, 'row').cells.filter((c) => c === null).length

// ─── SPEC §2.2: kinds, and which of them are production (the *) ────────────

export const SPEC_KINDS: Readonly<Partial<Record<SkillId, { kinds: readonly TaskKind[]; production: readonly TaskKind[] }>>> = {
  count10: { kinds: ['choice', 'countTap', 'keypad'], production: ['countTap', 'keypad'] },
  count20: { kinds: ['choice', 'keypad', 'countTap'], production: ['keypad', 'countTap'] },
  hear20: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  order20: { kinds: ['choice', 'numberline', 'keypad', 'sortOrder'], production: ['numberline', 'keypad', 'sortOrder'] },
  addTo10: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  subTo10: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  tenFriends: { kinds: ['pair', 'choice', 'keypad'], production: ['keypad'] },
  patterns: { kinds: ['choice', 'fillSlots'], production: ['fillSlots'] },
  shapes2D: { kinds: ['choice', 'multiSelect'], production: ['multiSelect'] },
  compareLength: { kinds: ['choice', 'sortOrder'], production: ['sortOrder'] },
}

// ─── SPEC §3.2–3.3: guess rate, production and ceiling ─────────────────────

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1))

/**
 * SPEC §3.2, column guessP: the chance of a right answer by luck, read off what the child is shown —
 * the cards, the pile, the line, the slots — wherever the screen says it.
 */
export function oracleGuessP(t: Task): number {
  return Math.max(shownGuessP(t), heardGuessP(t))
}

/**
 * What the question itself gives away: "Hvilket tal er størst, seks eller otte?" names both
 * candidates, so on a keypad or a line the child picks one of two (SPEC §3.3: a coin flip).
 */
function heardGuessP(t: Task): number {
  return t.factId.startsWith('o20:bigger:') && (t.kind === 'keypad' || t.kind === 'numberline') ? 0.5 : 0
}

function shownGuessP(t: Task): number {
  switch (t.kind) {
    case 'choice':
    case 'pair':
      return 1 / t.options.length
    case 'keypad':
      return 1 / (t.range[1] - t.range[0] + 1)
    case 'countTap':
      // anything from none to the whole pile can end up in the basket
      return 1 / (sceneOf(t.prompt, 'objects').n + 1)
    case 'numberline': {
      const line = sceneOf(t.prompt, 'line')
      return (2 * t.tolerance + 1) / (line.max - line.min + 1)
    }
    case 'trueFalse':
      return 0.5
    case 'sortOrder':
      return 1 / factorial(t.options.length)
    case 'multiSelect':
      return 1 / (2 ** sceneOf(t.prompt, 'shapes').items.length - 1)
    case 'fillSlots':
      return 1 / t.options.length ** blanksOf(t.prompt)
    default:
      throw new Error(`no oracle guess rate for ${t.kind}`)
  }
}

/** SPEC §3.3: manipulatives only count as production in the skill they belong to. */
const MANIPULATIVE_ONLY_FOR: Readonly<Partial<Record<TaskKind, readonly SkillId[]>>> = {
  share: ['shareEqually', 'fractionOfSet'],
  buildBase: ['tensOnes', 'placeValue1000'],
  countTap: ['count10', 'count20'],
}

export const oracleProduction = (t: Task): boolean =>
  oracleGuessP(t) <= 0.12 && (MANIPULATIVE_ONLY_FOR[t.kind]?.includes(t.skill) ?? true)

/** SPEC §3.3: production reaches box 5; a guessable answer box 3, a coin flip box 2. */
export const oracleCeiling = (t: Task): 2 | 3 | 5 => (oracleProduction(t) ? 5 : oracleGuessP(t) >= 0.5 ? 2 : 3)

// ─── SPEC §4.1: error tags ──────────────────────────────────────────────────

const MISCONCEPTIONS: ReadonlySet<string> = new Set(MISCONCEPTION_IDS)
export const isMisconception = (tag: unknown): tag is MisconceptionId => typeof tag === 'string' && MISCONCEPTIONS.has(tag)

/** What could explain a wrong value: misconceptions (pædagogik §3.2), a number from the question, a near miss. */
export interface Explanation {
  mis: readonly MisconceptionId[]
  operand?: boolean
  near?: boolean
}

/**
 * SPEC §4.1 (classifyError): one misconception wins over 'near' and 'operand'; two on one value make
 * it 'ambiguous' (never evidence); otherwise a number from the question, a near miss, or 'other'.
 */
export function specTag(e: Explanation): ErrorTag {
  const mis = [...new Set(e.mis)]
  if (mis.length === 1) return mis[0]
  if (mis.length > 1) return 'ambiguous'
  if (e.operand) return 'operand'
  if (e.near) return 'near'
  return 'other'
}

/** One misconception on a number from the question (5 + 1 answered 5): SPEC §4.1 says the misconception. */
export const isOperandClash = (e: Explanation): boolean => new Set(e.mis).size === 1 && e.operand === true

/** A near miss on a number answer: ±1, ±2 or ±10 (SPEC §4.1: "1 near (±1 eller ±10)"). */
export const isNear = (value: number, answer: number): boolean => [1, 2, 10].includes(Math.abs(value - answer))

/** 53 → 35 for two-digit numbers with two different non-zero digits, else null. */
export function reversed(n: number): number | null {
  if (!Number.isInteger(n) || n < 10 || n > 99) return null
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return tens === ones || ones === 0 ? null : ones * 10 + tens
}

/** SPEC §4.1/§4.2: skills where reversing the digits is about how Danish says numbers (a concept). */
const SWAP_SKILLS: readonly SkillId[] = ['hear20', 'hear100', 'hear1000', 'tensOnes', 'placeValue1000']

/**
 * SPEC §4.1 globalChecks: a reversed answer is digitSwap in the hear and place skills, and on typed
 * answers of 13 or more whose reversal is not a number on the screen.
 */
export function swapIsEvidence(skill: SkillId, kind: TaskKind, answer: number, onScreen: readonly number[]): boolean {
  const swap = reversed(answer)
  if (swap === null) return false
  if (SWAP_SKILLS.includes(skill)) return true
  return kind === 'keypad' && answer >= 13 && !onScreen.includes(swap)
}

/**
 * classifyAnswer compared with the oracle's explanation of a wrong value; a problem or null.
 * Misconceptions, 'ambiguous' and 'operand' must match exactly. A plain tag must match exactly on a
 * card the child was shown; a typed value outside the skill's list only has to stay plain ('near' or
 * 'other' — the skill lists its own near misses). One misconception on a number from the question
 * is left to the SPEC §4.1 test of its own (the generator makes it 'ambiguous').
 */
export function tagProblem(task: Task, value: AnswerValue, e: Explanation, shown: boolean): string | null {
  const got = classifyAnswer(task, value)
  const want = specTag(e)
  const where = `${task.factId} ${task.kind} ${String(value)}`
  if (got === null) return `${where}: classified as right`
  if (isOperandClash(e)) return got === want || got === 'ambiguous' ? null : `${where}: ${got}, expected ${want}`
  if (shown || want === 'ambiguous' || want === 'operand' || isMisconception(want)) {
    return got === want ? null : `${where}: ${got}, expected ${want}`
  }
  return got === 'near' || got === 'other' ? null : `${where}: ${got}, expected a plain tag (near/other)`
}

// ─── Building tasks ─────────────────────────────────────────────────────────

export interface Built {
  fact: Fact
  kind: TaskKind
  task: Task
}

/** Seeded instances of every family of a procedure skill (SPEC §15.1: 200 per family). */
export function instancesOf(def: SkillDef, perFamily = 200): Map<string, Fact[]> {
  const out = new Map<string, Fact[]>()
  for (const fam of def.families) {
    const rng = makeRng(hashSeed(`oracle:${def.id}/${fam.id}`))
    out.set(fam.id, Array.from({ length: perFamily }, () => def.instance!(fam, rng, new Set())))
  }
  return out
}

/**
 * A task for every fact, kind and seed, plus one card deal aimed at each misconception the fact can
 * show (so every diagnostic card is dealt at least once, whatever the rotation would pick).
 */
export function tasksOf(def: SkillDef, facts: readonly Fact[], seeds: number): Built[] {
  const out: Built[] = []
  facts.forEach((fact, i) => {
    for (const kind of def.kinds) {
      for (let s = 0; s < seeds; s++) {
        out.push({ fact, kind, task: buildTask(def, fact, kind, makeRng(hashSeed(`oracle|${fact.id}|${kind}|${s}`)), i).task })
      }
      if (kind !== 'choice' && kind !== 'pair') continue
      const aims = new Set(def.candidates(fact).map((c) => c.tag).filter(isMisconception))
      for (const m of aims) {
        const rng = makeRng(hashSeed(`oracle|${fact.id}|${kind}|aim:${m}`))
        out.push({ fact, kind, task: buildTask(def, fact, kind, rng, i, { target: [m] }).task })
      }
    }
  })
  return out
}

/** Every order of the given cards (sortOrder: what the child can lay down). */
export function orderings<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]]
  return items.flatMap((x, i) => orderings([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]))
}

/** Every value a keypad, line or basket answer can take (0 up to what the keys or the pile allow). */
export function typeableValues(t: Task): number[] {
  const top = t.kind === 'keypad' ? 10 ** t.maxDigits - 1 : t.range[1]
  return Array.from({ length: top + 1 }, (_, v) => v)
}

// ─── Generic checks: each returns its problems (none is good) ──────────────

/** The registered SkillDef of a skill (the oracles test what the app uses, through the frozen contract). */
export function registeredSkill(id: SkillId): SkillDef {
  const def = getSkill(id)
  if (!def) throw new Error(`${id} is not registered`)
  return def
}

/** Problems as a short list, so a failure shows the first few instead of thousands. */
export const first = (problems: Iterable<string>, n = 12): string[] => [...new Set(problems)].slice(0, n)

/**
 * Classification of every numeric card and every value a keypad, number line or basket can give,
 * against the oracle's explanation (tagProblem).
 */
export function classificationProblems(built: readonly Built[], explain: (b: Built, value: number) => Explanation): string[] {
  const out: string[] = []
  for (const b of built) {
    const { task } = b
    for (const o of task.options) {
      if (o === task.answer || typeof o !== 'number') continue
      const p = tagProblem(task, o, explain(b, o), true)
      if (p) out.push(p)
    }
    if (task.kind === 'keypad' || task.kind === 'countTap' || task.kind === 'numberline') {
      for (const v of typeableValues(task)) {
        if (v === task.answer) continue
        const p = tagProblem(task, v, explain(b, v), false)
        if (p) out.push(p)
      }
    }
  }
  return out
}

/** A value only one misconception explains, and no number from the question: real evidence. */
export const isDiagnostic = (e: Explanation): boolean => new Set(e.mis).size === 1 && !e.operand

/**
 * SPEC §4.1: a card set shows a diagnostic card whenever the oracle knows a misconception value
 * inside the card range (the rotation decides which one).
 */
export function diagnosticProblems(built: readonly Built[], explain: (b: Built, value: number) => Explanation): string[] {
  const out: string[] = []
  for (const b of built) {
    const { task } = b
    if ((task.kind !== 'choice' && task.kind !== 'pair') || typeof task.answer !== 'number') continue
    const answer = task.answer
    const available: number[] = []
    for (let v = Math.max(0, task.range[0]); v <= task.range[1]; v++) if (v !== answer && isDiagnostic(explain(b, v))) available.push(v)
    const dealt = task.options.filter((o) => typeof o === 'number' && o !== answer && isDiagnostic(explain(b, o)))
    if (available.length > 0 && dealt.length === 0) out.push(`${task.factId} ${task.kind}: no diagnostic card among [${task.options}] (could be ${available})`)
  }
  return out
}

/**
 * The typed values where one misconception meets a number from the question (5 + 1 → 5). SPEC A9
 * (integrator, 1/10): such a value is 'ambiguous' and never evidence, because typing a number from
 * the question is a likelier reading than the misconception. `rule: 'misconception'` checks the
 * original §4.1 wording instead (the misconception wins). Returns the values classified otherwise.
 */
export function operandClashProblems(
  built: readonly Built[],
  explain: (b: Built, value: number) => Explanation,
  rule: 'ambiguous' | 'misconception' = 'ambiguous',
): string[] {
  const out: string[] = []
  for (const b of built) {
    const { task } = b
    if (task.kind !== 'keypad') continue
    for (const v of typeableValues(task)) {
      const e = explain(b, v)
      if (v === task.answer || !isOperandClash(e)) continue
      const got = classifyAnswer(task, v)
      const want = rule === 'ambiguous' ? 'ambiguous' : specTag(e)
      if (got !== want) out.push(`${task.factId} ${v}: ${String(got)}, expected ${want}`)
    }
  }
  return out
}

/** A task's own answer is right and never an error; a set answer stays right in any tapping order. */
export function answerProblems(t: Task): string[] {
  const out: string[] = []
  const where = `${t.factId} ${t.kind}`
  if (!isCorrect(t, t.answer)) out.push(`${where}: its own answer ${String(t.answer)} is not right`)
  if (classifyAnswer(t, t.answer) !== null) out.push(`${where}: its own answer is classified as an error`)
  for (const a of t.accept) if (classifyAnswer(t, a) !== null) out.push(`${where}: the accepted ${String(a)} is classified as an error`)
  if (t.kind === 'multiSelect' && typeof t.answer === 'string') {
    const flipped = t.answer.split('|').reverse().join('|')
    if (classifyAnswer(t, flipped) !== null) out.push(`${where}: the right set tapped in another order is an error`)
  }
  // SPEC §3.1: a number answer lies inside the task's range, and the keypad takes digits(range max) digits
  if (typeof t.answer === 'number' && (t.answer < t.range[0] || t.answer > t.range[1])) out.push(`${where}: answer ${t.answer} outside ${t.range.join('–')}`)
  if (t.kind === 'keypad' && t.maxDigits !== String(t.range[1]).length) out.push(`${where}: ${t.maxDigits} digits for the range ${t.range.join('–')}`)
  return out
}

/**
 * The cards of a choice or pair task (SPEC §4.1, §15.1): 3 cards (pair: 4 bubbles), all different,
 * exactly one right — also by isCorrect, so no tolerance or accepted equivalent makes a second card
 * right — the wrong ones whole numbers ≥ 0 inside the task's range and `allowed`, each tagged and
 * classified as its tag, and never two different misconceptions in one card set.
 */
export function cardProblems(t: Task, allowed?: (card: number) => boolean): string[] {
  if (t.kind !== 'choice' && t.kind !== 'pair') return []
  const out: string[] = []
  const where = `${t.factId} ${t.kind} [${t.options.join(', ')}]`
  const want = t.kind === 'pair' ? 4 : 3
  if (t.options.length !== want) out.push(`${where}: ${t.options.length} cards, expected ${want}`)
  if (new Set(t.options.map(String)).size !== t.options.length) out.push(`${where}: the same card twice`)
  const right = t.options.filter((o) => isCorrect(t, o))
  if (right.length !== 1 || right[0] !== t.answer) out.push(`${where}: right cards [${right.join(', ')}], expected only ${String(t.answer)}`)
  const mis = new Set<MisconceptionId>()
  for (const o of t.options) {
    if (o === t.answer) continue
    if (typeof o === 'number') {
      if (!Number.isInteger(o) || o < 0) out.push(`${where}: card ${o} is not a whole number ≥ 0`)
      if (o < t.range[0] || o > t.range[1]) out.push(`${where}: card ${o} outside the task's range ${t.range.join('–')}`)
      if (allowed && !allowed(o)) out.push(`${where}: card ${o} outside what this skill may show`)
    }
    const tag = t.distractorTags[String(o)]
    const got = classifyAnswer(t, o)
    if (tag === undefined) out.push(`${where}: card ${String(o)} has no tag`)
    else if (got !== tag) out.push(`${where}: card ${String(o)} is tagged ${tag} but classified ${String(got)}`)
    if (isMisconception(tag)) mis.add(tag)
  }
  if (mis.size > 1) out.push(`${where}: one card set tests ${[...mis].join(' and ')}`)
  return out
}

/**
 * Cards for sortOrder, multiSelect and fillSlots: sortOrder cards are the answer's parts, never
 * dealt already in order; multiSelect items are distinct and hold the answer set; a fillSlots
 * palette is distinct and holds every bead of the answer.
 */
export function optionProblems(t: Task): string[] {
  const out: string[] = []
  const where = `${t.factId} ${t.kind}`
  const parts = String(t.answer).split('|')
  const opts = t.options.map(String)
  if (t.kind === 'sortOrder') {
    if ([...opts].sort().join('|') !== [...parts].sort().join('|')) out.push(`${where}: cards [${opts}] are not the answer's parts [${parts}]`)
    if (opts.join('|') === parts.join('|')) out.push(`${where}: the cards are dealt in the right order already`)
    if (new Set(opts).size !== opts.length) out.push(`${where}: the same card twice`)
  }
  if (t.kind === 'multiSelect' || t.kind === 'fillSlots') {
    if (new Set(opts).size !== opts.length) out.push(`${where}: the same option twice`)
    for (const p of parts) if (!opts.includes(p)) out.push(`${where}: ${p} of the answer is not among [${opts}]`)
  }
  return out
}

/** SPEC §3.2–3.3, per task: the engine's guess rate, production and ceiling are the oracle's. */
export function productionProblems(built: readonly Built[]): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) {
    const where = `${fact.skill} ${fact.id} ${kind}`
    const g = guessP(task)
    const want = oracleGuessP(task)
    if (Math.abs(g - want) > 1e-12) out.add(`${where}: guessP ${g}, oracle ${want}`)
    if (isProduction(task) !== oracleProduction(task)) out.add(`${where}: isProduction ${isProduction(task)}, oracle ${oracleProduction(task)}`)
    if (ceilingFor(task) !== oracleCeiling(task)) out.add(`${where}: ceiling ${ceilingFor(task)}, oracle ${oracleCeiling(task)}`)
  }
  return [...out]
}

/**
 * SPEC §2.2 and §3.3 per skill: its kinds are SPEC's, every starred kind is production for at least
 * 90 % of its tasks (by the oracle), the others never are (so cards stay at box 3, or 2 on a coin flip).
 */
export function specKindProblems(def: SkillDef, built: readonly Built[]): string[] {
  const spec = SPEC_KINDS[def.id]
  if (!spec) return [`${def.id}: not in the oracle's SPEC §2.2 table`]
  const out: string[] = []
  if ([...def.kinds].sort().join(',') !== [...spec.kinds].sort().join(',')) out.push(`${def.id}: kinds ${def.kinds}, SPEC ${spec.kinds}`)
  for (const kind of def.kinds) {
    // a question that names its candidates is a coin flip on any kind (order20 'bigger'); that family
    // proves itself on sortOrder, so it is left out of the kind's production share
    const own = built.filter((b) => b.kind === kind && heardGuessP(b.task) === 0)
    if (own.length === 0) continue
    const share = own.filter((b) => oracleProduction(b.task)).length / own.length
    if (spec.production.includes(kind) && share < 0.9) out.push(`${def.id} ${kind}: production for ${(share * 100).toFixed(1)} %, SPEC wants ≥ 90 %`)
    if (!spec.production.includes(kind) && share > 0) out.push(`${def.id} ${kind}: production for ${(share * 100).toFixed(1)} %, SPEC says never`)
  }
  return out
}

/**
 * Spoken scripts of every task (SPEC §10.1): recorded clips only, no digits in the text. Cards that
 * are read aloud (SPEC §3.4: unit words, relations, tokens) carry one recorded clip each; number,
 * figure, bead and picture cards are what the task tests and are never read aloud.
 */
export function taskSpeechProblems(built: readonly Built[]): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) {
    const where = `${fact.id} ${kind}`
    for (const p of speechProblems(task.speech)) out.add(`${where}: ${p}`)
    const spoken = SPOKEN_OPTION_VIEWS.includes(task.optionView) && task.options.length > 0
    if (spoken !== (task.optionClips !== null)) out.add(`${where}: ${task.optionView} cards with optionClips ${JSON.stringify(task.optionClips)}`)
    if (task.optionClips && task.optionClips.length !== task.options.length) out.add(`${where}: ${task.optionClips.length} clips for ${task.options.length} cards`)
    for (const clip of task.optionClips ?? []) for (const p of speechProblems([{ clip }])) out.add(`${where} card clip: ${p}`)
  }
  return [...out]
}

/**
 * Strategy hints for a fact and each tag it can meet (and each kind): recorded and digit-free, a
 * picture to look at, and a misconception hint only for that misconception.
 */
export function hintProblems(def: SkillDef, fact: Fact, tags: readonly (ErrorTag | null)[]): string[] {
  const out: string[] = []
  for (const tag of tags) {
    for (const kind of [undefined, ...def.kinds]) {
      const h = def.hint(fact, tag, kind)
      const where = `${fact.id} hint(${String(tag)}${kind ? `, ${kind}` : ''})`
      for (const p of speechProblems(h.speech)) out.push(`${where}: ${p}`)
      if (!h.visual || typeof h.visual.scene !== 'string') out.push(`${where}: nothing to look at`)
      if (h.misconception !== undefined && h.misconception !== tag) out.push(`${where}: the ${h.misconception} hint`)
    }
  }
  return out
}

/** Tags any fact can meet: plain ones and every misconception the skill tags anywhere. */
export function tagsToHint(def: SkillDef, facts: readonly Fact[]): (ErrorTag | null)[] {
  const mis = new Set<ErrorTag>()
  for (const f of facts) for (const c of def.candidates(f)) if (isMisconception(c.tag)) mis.add(c.tag)
  return [null, 'near', 'operand', 'other', 'ambiguous', ...mis]
}

// ─── Fact ids across every registered skill (CONVENTIONS "Fact-id'er") ────

/**
 * The fixed id formats of the CONVENTIONS table, and (wave 3, ORK3a) the formats SK3-TAL's procedure skills
 * document in their modules (CONVENTIONS: "Andre skills vælger et kort præfiks pr. skill og dokumenterer det").
 */
const CONVENTION_IDS: Readonly<Partial<Record<SkillId, RegExp>>> = {
  addTo10: /^add:\d+\+\d+$/, addTo20: /^add:\d+\+\d+$/, subTo10: /^sub:\d+-\d+$/, subTo20: /^sub:\d+-\d+$/,
  tenFriends: /^ten:\d+$/, doubles: /^dbl:\d+$/, halves: /^hlf:\d+$/, missingPart10: /^mp:\d+\+\?=\d+$/,
  mul2510: /^mul:\d+x\d+$/, mul34: /^mul:\d+x\d+$/, mul6to9: /^mul:\d+x\d+$/, div2510: /^div:\d+\/\d+$/, divAll: /^div:\d+\/\d+$/,
  add1000: /^a1000:\d+\+\d+$/, sub1000: /^s1000:\d+-\d+$/, mulTens: /^mt:\d+x\d+$/,
}
/** Prefixes CONVENTIONS lets several skills share (the recall tables of 0.–3. klasse). */
const SHARED_PREFIXES: Readonly<Record<string, readonly SkillId[]>> = {
  add: ['addTo10', 'addTo20'], sub: ['subTo10', 'subTo20'], mul: ['mul2510', 'mul34', 'mul6to9'], div: ['div2510', 'divAll'],
}

/**
 * Fact ids are mastery keys and clip ids (`q.<factId>`): unique across all registered skills, in the
 * CONVENTIONS format where the table names one, and one short prefix per skill otherwise.
 */
export function globalIdProblems(defs: readonly SkillDef[]): string[] {
  const out: string[] = []
  const owner = new Map<string, SkillId>()
  const prefixOwners = new Map<string, Set<SkillId>>()
  for (const def of defs) {
    const facts = [...def.enumerate(), ...(def.mode === 'procedure' && def.instance ? [...instancesOf(def, 50).values()].flat() : [])]
    const own = new Set<string>()
    for (const f of facts) {
      const prev = owner.get(f.id)
      if (prev !== undefined && prev !== def.id) out.push(`${f.id} belongs to ${prev} and ${def.id}`)
      owner.set(f.id, def.id)
      const cut = f.id.indexOf(':')
      const prefix = cut > 0 ? f.id.slice(0, cut) : ''
      if (!prefix) out.push(`${def.id}: ${f.id} has no prefix`)
      own.add(prefix)
      prefixOwners.set(prefix, (prefixOwners.get(prefix) ?? new Set()).add(def.id))
      const format = CONVENTION_IDS[def.id]
      if (format && !format.test(f.id)) out.push(`${def.id}: ${f.id} is not in the CONVENTIONS format ${format}`)
    }
    if (own.size !== 1) out.push(`${def.id}: ${own.size} prefixes (${[...own].join(', ')}), CONVENTIONS wants one`)
  }
  for (const [prefix, skills] of prefixOwners) {
    if (skills.size < 2) continue
    const may = SHARED_PREFIXES[prefix] ?? []
    if (![...skills].every((s) => may.includes(s))) out.push(`prefix ${prefix}: shared by ${[...skills].join(', ')}`)
  }
  return out
}

// ═══ Number skills ═════════════════════════════════════════════════════════

/** count10 c10:<layout>:<n>, count20 c20:<family>:<n>, hear20 h20:<n>: the number the id ends on. */
export const idNumber = (id: string): number => Number(id.slice(id.lastIndexOf(':') + 1))

/** What one thing and several are called, and whether "et" goes with one ("et æble", "en gulerod"). */
export const THING_WORDS: Readonly<Record<string, { sg: string; pl: string; neuter: boolean }>> = {
  carrot: { sg: 'gulerod', pl: 'gulerødder', neuter: false },
  apple: { sg: 'æble', pl: 'æbler', neuter: true },
  strawberry: { sg: 'jordbær', pl: 'jordbær', neuter: true },
  chestnut: { sg: 'kastanje', pl: 'kastanjer', neuter: false },
  flower: { sg: 'blomst', pl: 'blomster', neuter: false },
  fish: { sg: 'fisk', pl: 'fisk', neuter: false },
  mushroom: { sg: 'svamp', pl: 'svampe', neuter: false },
  leaf: { sg: 'blad', pl: 'blade', neuter: true },
  star: { sg: 'stjerne', pl: 'stjerner', neuter: false },
  ball: { sg: 'bold', pl: 'bolde', neuter: false },
  cube: { sg: 'klods', pl: 'klodser', neuter: false },
}

/**
 * The question a counting picture should come with: the thing's plural for spread-out things, the
 * pips, fingers or dots for the dice, fingers and ten-frame — and "så du" when the picture flashes.
 */
export function howManyQuestion(p: Extract<Prompt, { scene: 'objects' }>): string {
  const flash = p.flashMs !== undefined
  if (p.layout === 'dice') return flash ? 'Hvor mange øjne så du på terningen?' : 'Hvor mange øjne er der på terningen?'
  if (p.layout === 'fingers') return flash ? 'Hvor mange fingre så du?' : 'Hvor mange fingre er der?'
  if (p.layout === 'tenframe') return flash ? 'Hvor mange prikker så du?' : 'Hvor mange prikker er der?'
  return `Hvor mange ${THING_WORDS[p.thing]?.pl ?? `<${p.thing}>`} er der?`
}

/** "Læg syv gulerødder i kurven." / "Læg et æble i kurven." — the count-out sentence for a target and a thing. */
export function countOutSentence(target: number, thing: string): string {
  const w = THING_WORDS[thing]
  if (!w) return `<unknown thing ${thing}>`
  if (target === 1) return `Læg ${w.neuter ? 'et' : 'en'} ${w.sg} i kurven.`
  const word = [...NUMBER_WORDS].find(([k, v]) => v === target && k !== 'et')?.[0]
  return `Læg ${word ?? `<${target}>`} ${w.pl} i kurven.`
}

/**
 * Where a wrong count comes from: one or two too many or too few, or (count20) the forgotten ten —
 * near misses all, counting has no misconception. A typed count of 13 or more written back to front
 * is a digitSwap slip (SPEC §4.1 globalChecks).
 */
export function explainCount(skill: SkillId, task: Task, value: number, answer: number): Explanation {
  const near = isNear(value, answer)
  const swap = !near && value === reversed(answer) && swapIsEvidence(skill, task.kind, answer, [answer])
  return { mis: swap ? ['digitSwap'] : [], near }
}

// ─── hear20 ─────────────────────────────────────────────────────────────────

/**
 * Where a wrong number for a heard one comes from: the digits written in the order Danish says them
 * ("fjorten" → 41: digitSwap, a concept in hear20), or a near miss (±1, ±2, the forgotten ten).
 */
export function explainHeard(value: number, answer: number): Explanation {
  return { mis: value === reversed(answer) ? ['digitSwap'] : [], near: isNear(value, answer) }
}

/** "Find tallet fjorten." (cards) / "Skriv tallet fjorten." (keypad): the number heard. */
export function heardNumber(text: string): number | null {
  const m = /^(Find|Skriv) tallet ([a-zæøå]+)\.$/.exec(text)
  return m && NUMBER_WORDS.has(m[2]) ? NUMBER_WORDS.get(m[2])! : null
}

// ─── order20 ────────────────────────────────────────────────────────────────

export type Order20Family = 'after' | 'before' | 'between' | 'bigger'

/** o20:after:<n> → n + 1 · before:<n> → n − 1 · between:<a>:<c> → the one number between · bigger:<x>:<y> → the larger. */
export function order20Answer(id: string): number {
  const [prefix, family, ...rest] = id.split(':')
  const n = rest.map(Number)
  if (prefix !== 'o20' || n.some((v) => !Number.isInteger(v) || v < 0 || v > 20)) throw new Error(`not an order20 id: ${id}`)
  switch (family) {
    case 'after':
      return n[0] + 1
    case 'before':
      return n[0] - 1
    case 'between':
      if (n[1] - n[0] !== 2) throw new Error(`${id}: more than one number between`)
      return n[0] + 1
    case 'bigger':
      if (n[0] === n[1]) throw new Error(`${id}: no bigger number`)
      return Math.max(n[0], n[1])
    default:
      throw new Error(`unknown order20 family in ${id}`)
  }
}

/** The numbers an order20 instance is about (its id's numbers and its answer). */
export const order20Numbers = (id: string): number[] => [...id.split(':').slice(2).map(Number), order20Answer(id)]

/**
 * The answer a child works out from the spoken order20 question. "Hvilket tal er størst?" names no
 * number: the cards carry them, and the biggest card is the answer.
 */
export function order20FromSpeech(text: string, cards: readonly AnswerValue[]): number | null {
  const n = spokenNumbers(text)
  if (text.startsWith('Hvilket tal kommer efter ') && n.length === 1) return n[0] + 1
  if (text.startsWith('Hvilket tal kommer før ') && n.length === 1) return n[0] - 1
  if (text.startsWith('Hvilket tal ligger mellem ') && n.length === 2) return n[1] - n[0] === 2 ? n[0] + 1 : null
  if (text.startsWith('Hvilket tal er størst, ') && n.length === 2) return Math.max(n[0], n[1])
  if (text === 'Hvilket tal er størst?' && cards.every((c) => typeof c === 'number')) return Math.max(...(cards as number[]))
  return null
}

/**
 * sortOrder: the cards in the order the spoken instruction asks for on these stones — count on or
 * back from the first stone, fill the stones between two numbers, or the biggest first.
 */
export function order20SortFromSpeech(text: string, cells: readonly (number | string | null)[], cards: readonly AnswerValue[]): number[] | null {
  const n = spokenNumbers(text)
  const blanks = cells.filter((c) => c === null).length
  const steps = (from: number, dir: 1 | -1) => Array.from({ length: blanks }, (_, i) => from + dir * (i + 1))
  if (text.startsWith('Tæl videre fra ') && n.length === 1 && cells[0] === n[0]) return steps(n[0], 1)
  if (text.startsWith('Tæl baglæns fra ') && n.length === 1 && cells[0] === n[0]) return steps(n[0], -1)
  if (text.startsWith('Hvilke tal ligger mellem ') && n.length === 2 && cells[0] === n[0] && cells[cells.length - 1] === n[1]) {
    const between = steps(n[0], 1)
    return between[between.length - 1] === n[1] - 1 ? between : null
  }
  if (text === 'Sæt tallene i rækkefølge. Start med det største.' && cards.every((c) => typeof c === 'number')) {
    return [...(cards as number[])].sort((a, b) => b - a)
  }
  return null
}

/** Where a wrong order20 number comes from: a number from the question, or a near miss. No misconceptions. */
export function explainOrder20(id: string, task: Task, value: number): Explanation {
  const answer = order20Answer(id)
  const operands = id.split(':').slice(2).map(Number)
  const onScreen = [...operands, ...rowNumbers(task.prompt)]
  const operand = operands.includes(value)
  const near = isNear(value, answer)
  const swap = !operand && !near && value === reversed(answer) && swapIsEvidence('order20', task.kind, answer, onScreen)
  return { mis: swap ? ['digitSwap'] : [], operand, near }
}

/** Numbers on the stones of a row prompt. */
export const rowNumbers = (p: Prompt): number[] => (p.scene === 'row' ? p.cells.filter((c): c is number => typeof c === 'number') : [])
