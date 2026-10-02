// Independent oracles for the number skills of 1.–2. klasse (hear100, order100, numberLine100,
// hear1000, order1000, numberLine1000), plus the small wave-2 oracle kit that the place and addsub2
// oracles share. Written by another agent than the generators (SPEC A5, §15.1): every right answer
// is worked out here from what the child is given — the fact id, the spoken question, the stones, the
// line, the cards — and never from the generator code. Wrong answers are explained with pædagogik
// §3.2's formulas, worked out here. The registry skips *.oracle.ts files, so none of this reaches the app.
import type { AnswerValue, ErrorTag, Fact, MisconceptionId, Prompt, SkillDef, SkillId, Task, TaskKind } from '../../types'
import { classifyAnswer } from '../../misconceptions'
import { ceilingFor, guessP, isProduction } from '../../kinds'
import { masteryKeyOf } from '../../tasks'
import { hashSeed, makeRng } from '../../rng'
import { answerProblems as answerProblemsW1, spokenText, tasksOf, type Built } from './number.oracle'

// ═══ The wave-2 oracle kit ════════════════════════════════════════════════════

// ─── Danish numbers 0–1000, as the child hears them (SPEC §10.1) ───────────

const UNITS: Readonly<Record<string, number>> = {
  nul: 0, en: 1, et: 1, to: 2, tre: 3, fire: 4, fem: 5, seks: 6, syv: 7, otte: 8, ni: 9, ti: 10, elleve: 11, tolv: 12,
  tretten: 13, fjorten: 14, femten: 15, seksten: 16, sytten: 17, atten: 18, nitten: 19,
}
const TENS: Readonly<Record<string, number>> = {
  tyve: 20, tredive: 30, fyrre: 40, halvtreds: 50, tres: 60, halvfjerds: 70, firs: 80, halvfems: 90,
}

/** One word 0–99: "syv", "fjorten", "fyrre", "syvogfyrre" (21–99 are one word). */
export function word99(w: string): number | null {
  if (w in UNITS) return UNITS[w]
  if (w in TENS) return TENS[w]
  const m = /^(en|to|tre|fire|fem|seks|syv|otte|ni)og([a-zæøå]+)$/.exec(w)
  return m && m[2] in TENS ? UNITS[m[1]] + TENS[m[2]] : null
}

const words = (text: string): string[] => text.toLowerCase().replace(/[.,?!]/g, ' ').split(/\s+/).filter((w) => w !== '')

/**
 * Every number in a stretch of speech, in order: "tre hundrede og syvogfyrre" is one number,
 * "tredive og fyrre" two, "et hundrede og to hundrede" two (an "og" before a new hundred starts a new
 * number). Words that are not numbers are skipped; "hundrede" alone ("hundrede mere end") is not one.
 */
export function numbersIn(text: string): number[] {
  const w = words(text)
  const out: number[] = []
  for (let i = 0; i < w.length; i++) {
    if (w[i] === 'tusind') {
      out.push(1000)
      continue
    }
    const h = w[i] === 'et' ? 1 : UNITS[w[i]]
    if (h !== undefined && h >= 1 && h <= 9 && w[i + 1] === 'hundrede') {
      let n = h * 100
      i += 1
      const rest = w[i + 2] !== undefined ? word99(w[i + 2]) : null
      if (w[i + 1] === 'og' && rest !== null && rest >= 1 && w[i + 3] !== 'hundrede') {
        n += rest
        i += 2
      }
      out.push(n)
      continue
    }
    const n = word99(w[i])
    if (n !== null) out.push(n)
  }
  return out
}

/** The text after a lead phrase, or null when the sentence does not start with it. */
export const after = (text: string, lead: string): string | null => (text.startsWith(lead) ? text.slice(lead.length) : null)

/** The one number after a lead phrase ("Find tallet tre hundrede og fire." → 304), or null. */
export function numberAfter(text: string, lead: string): number | null {
  const rest = after(text, lead)
  if (rest === null) return null
  const n = numbersIn(rest)
  return n.length === 1 ? n[0] : null
}

// ─── Digits ─────────────────────────────────────────────────────────────────

export const digitsOf = (n: number): number[] => String(n).split('').map(Number)
const fromDigits = (ds: readonly number[]): number => Number(ds.join(''))

/** Tens and ones swapped, the hundreds kept (47 → 74, 345 → 354); null without two different non-zero digits there. */
export function swapTO(n: number): number | null {
  if (!Number.isInteger(n) || n < 10) return null
  const t = Math.floor(n / 10) % 10
  const o = n % 10
  return t === 0 || o === 0 || t === o ? null : n - 10 * t - o + 10 * o + t
}

/** Round half up to a multiple of `step` (345 → 350, 350 → 400 for 100). */
export const roundHalfUp = (n: number, step: number): number => step * Math.floor(n / step + 0.5)

// ─── Instances ──────────────────────────────────────────────────────────────

/** 200 seeded instances per family, from the oracle's own seeds (SPEC §15.1). */
export function drawInstances(def: SkillDef, perFamily = 200): Map<string, Fact[]> {
  const out = new Map<string, Fact[]>()
  for (const fam of def.families) {
    const rng = makeRng(hashSeed(`ork2a:${def.id}/${fam.id}`))
    out.set(fam.id, Array.from({ length: perFamily }, () => def.instance!(fam, rng, new Set())))
  }
  return out
}

/** Canonical facts (several card deals each) and 200 seeded instances per family (one deal each, plus aimed deals). */
export function sweep(def: SkillDef, seeds = 3) {
  const canon = def.enumerate()
  const instances = def.mode === 'procedure' ? drawInstances(def) : new Map<string, Fact[]>()
  const drawn = [...instances.values()].flat()
  const all: Fact[] = [...canon, ...drawn]
  const built: Built[] = [...tasksOf(def, canon, seeds), ...tasksOf(def, drawn, 1)]
  return { canon, instances, all, built }
}

/** Avoided instances are avoided while the family has others left (SPEC §5.1). */
export function avoidProblems(def: SkillDef, instances: ReadonlyMap<string, readonly Fact[]>): string[] {
  const out: string[] = []
  for (const fam of def.families) {
    const pool = [...new Set((instances.get(fam.id) ?? []).map((f) => f.id))]
    if (pool.length < 4) continue
    const avoid = new Set(pool.slice(0, Math.floor(pool.length / 2)))
    const rng = makeRng(hashSeed(`ork2a-avoid:${def.id}/${fam.id}`))
    for (let i = 0; i < 40; i++) {
      const f = def.instance!(fam, rng, avoid)
      if (avoid.has(f.id)) out.push(`${def.id}/${fam.id}: drew avoided ${f.id}`)
    }
  }
  return out
}

/**
 * Fact ids (CONVENTIONS): the expected shape, the family the id names, an answer the oracle agrees with,
 * one meaning per id (the same id is always the same instance), and the mastery key of the mode.
 */
export function idProblems(def: SkillDef, facts: readonly Fact[], shape: RegExp, oracle: (id: string) => { family: string; answer: AnswerValue } | null): string[] {
  const out: string[] = []
  const meaning = new Map<string, string>()
  for (const f of facts) {
    const where = `${def.id} ${f.id}`
    if (!shape.test(f.id)) out.push(`${where}: not in the id format ${shape}`)
    if (f.skill !== def.id) out.push(`${where}: skill ${f.skill}`)
    const o = oracle(f.id)
    if (!o) out.push(`${where}: not an instance the skill describes`)
    else {
      if (o.family !== f.family) out.push(`${where}: family ${f.family}, the id says ${o.family}`)
      if (o.answer !== f.answer) out.push(`${where}: answer ${String(f.answer)}, oracle ${String(o.answer)}`)
    }
    const key = JSON.stringify([f.family, f.operands, f.answer, f.data ?? null])
    if ((meaning.get(f.id) ?? key) !== key) out.push(`${where}: two different instances share the id`)
    meaning.set(f.id, key)
    const want = def.mode === 'recall' ? f.id : `${def.id}/${f.family}`
    if (masteryKeyOf(def, f) !== want) out.push(`${where}: mastery key ${masteryKeyOf(def, f)}`)
  }
  return out
}

// ─── SPEC §2.2: kinds and production kinds (the *) of the 19 wave-2 skills ─

export const SPEC_KINDS2: Readonly<Partial<Record<SkillId, { kinds: readonly TaskKind[]; production: readonly TaskKind[] }>>> = {
  hear100: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  order100: { kinds: ['choice', 'keypad', 'sortOrder'], production: ['keypad', 'sortOrder'] },
  numberLine100: { kinds: ['numberline', 'choice', 'keypad'], production: ['numberline', 'keypad'] },
  hear1000: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  order1000: { kinds: ['choice', 'keypad', 'sortOrder'], production: ['keypad', 'sortOrder'] },
  numberLine1000: { kinds: ['numberline', 'choice', 'keypad'], production: ['numberline', 'keypad'] },
  tensOnes: { kinds: ['choice', 'keypad', 'buildBase', 'fillSlots'], production: ['keypad', 'buildBase'] },
  placeValue1000: { kinds: ['choice', 'keypad', 'buildBase', 'fillSlots'], production: ['keypad', 'buildBase', 'fillSlots'] },
  doubles: { kinds: ['choice', 'keypad', 'numberline'], production: ['keypad', 'numberline'] },
  halves: { kinds: ['choice', 'keypad', 'share'], production: ['keypad'] },
  addSub20Simple: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  addTo20: { kinds: ['choice', 'keypad', 'numberline'], production: ['keypad', 'numberline'] },
  subTo20: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  tens100: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  add100NoCarry: { kinds: ['choice', 'keypad', 'buildBase'], production: ['keypad'] },
  sub100NoBorrow: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  add100Carry: { kinds: ['choice', 'keypad', 'numberline'], production: ['keypad', 'numberline'] },
  sub100Borrow: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  addSub1000Round: { kinds: ['choice', 'keypad'], production: ['keypad'] },
}

// ─── SPEC §3.2–3.3: guess rate, production and ceiling ─────────────────────

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1))

/** The line a numberline task is answered on: the prompt's line, else the task's range (the line view does the same). */
export function lineOf(t: Task): [number, number] {
  const p = t.prompt
  return p.scene === 'line' && p.max > p.min ? [p.min, p.max] : [t.range[0], t.range[1]]
}

/** "Hvilket tal er størst, seks eller otte?" names its candidates; null for any other question. */
export function namedCandidates(t: Task): number[] | null {
  const rest = after(spokenText(t.speech), 'Hvilket tal er størst, ')
  return rest === null ? null : numbersIn(rest)
}

/**
 * The chance of a right answer by luck, from what the child is shown (SPEC §3.2) and what the question
 * gives away (SPEC §3.3: a question naming two numbers is a coin flip on any kind). `rightFillings`:
 * how many fillings of a fillSlots task are right (the oracle counts them).
 */
export function oracleGuessP(t: Task, rightFillings = 1): number {
  const named = t.kind === 'choice' ? null : namedCandidates(t)
  const heard = named && named.length > 1 && typeof t.answer === 'number' && named.includes(t.answer) ? 1 / new Set(named).size : 0
  return Math.max(shownGuessP(t, rightFillings), heard)
}

function shownGuessP(t: Task, rightFillings: number): number {
  switch (t.kind) {
    case 'choice':
      return 1 / t.options.length
    case 'keypad':
      return 1 / (t.range[1] - t.range[0] + 1)
    case 'numberline': {
      const [lo, hi] = lineOf(t)
      return Math.min(1, (2 * t.tolerance + 1) / (hi - lo + 1))
    }
    case 'sortOrder':
      return 1 / factorial(t.options.length)
    case 'fillSlots':
      return rightFillings / t.options.length ** String(t.answer).split('|').length
    case 'buildBase':
    case 'share':
      return 0.01
    default:
      throw new Error(`no oracle guess rate for ${t.kind}`)
  }
}

const MANIPULATIVE_ONLY_FOR: Readonly<Partial<Record<TaskKind, readonly SkillId[]>>> = {
  share: ['shareEqually', 'fractionOfSet'], buildBase: ['tensOnes', 'placeValue1000'], countTap: ['count10', 'count20'],
}
export const oracleProduction = (t: Task, rightFillings = 1): boolean =>
  oracleGuessP(t, rightFillings) <= 0.12 && (MANIPULATIVE_ONLY_FOR[t.kind]?.includes(t.skill) ?? true)
export const oracleCeiling = (t: Task, rightFillings = 1): 2 | 3 | 5 =>
  oracleProduction(t, rightFillings) ? 5 : oracleGuessP(t, rightFillings) >= 0.5 ? 2 : 3

/** The engine's guessP, isProduction and ceilingFor against the oracle's, per task. */
export function productionProblems2(built: readonly Built[], rightFillings: (t: Task) => number = () => 1): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) {
    const where = `${fact.skill} ${fact.id} ${kind}`
    const r = kind === 'fillSlots' ? rightFillings(task) : 1
    const want = oracleGuessP(task, r)
    if (Math.abs(guessP(task) - want) > 1e-12) out.add(`${where}: guessP ${guessP(task)}, oracle ${want}`)
    if (isProduction(task) !== oracleProduction(task, r)) out.add(`${where}: isProduction ${isProduction(task)}, oracle ${oracleProduction(task, r)}`)
    if (ceilingFor(task) !== oracleCeiling(task, r)) out.add(`${where}: ceiling ${ceilingFor(task)}, oracle ${oracleCeiling(task, r)}`)
  }
  return [...out]
}

/**
 * SPEC §2.2/§3.3 per skill: the kinds are SPEC's; a starred kind is production for ≥ 90 % of its tasks
 * (a question that names its candidates is a coin flip on any kind and is left out of that share); an
 * unstarred kind never is, so its cards stay at box 3 (or 2 on a coin flip). Choice tasks lift at most
 * to box 3, and to box 2 when the guess is 1 in 2 or likelier.
 */
export function specKindProblems2(def: SkillDef, built: readonly Built[], rightFillings: (t: Task) => number = () => 1): string[] {
  const spec = SPEC_KINDS2[def.id]
  if (!spec) return [`${def.id}: not in the oracle's SPEC §2.2 table`]
  const out: string[] = []
  if ([...def.kinds].sort().join(',') !== [...spec.kinds].sort().join(',')) out.push(`${def.id}: kinds ${def.kinds}, SPEC ${spec.kinds}`)
  for (const kind of def.kinds) {
    const own = built.filter((b) => b.kind === kind && !(namedCandidates(b.task)?.length ?? 0))
    if (own.length === 0) continue
    const prod = own.filter((b) => oracleProduction(b.task, kind === 'fillSlots' ? rightFillings(b.task) : 1)).length / own.length
    if (spec.production.includes(kind) && prod < 0.9) out.push(`${def.id} ${kind}: production for ${(prod * 100).toFixed(1)} %, SPEC wants ≥ 90 %`)
    if (!spec.production.includes(kind) && prod > 0) out.push(`${def.id} ${kind}: production for ${(prod * 100).toFixed(1)} %, SPEC says never`)
  }
  for (const { fact, task } of built) {
    if (task.kind !== 'choice') continue
    const cap = guessP(task) >= 0.5 ? 2 : 3
    if (ceilingFor(task) > cap) out.push(`${fact.id} choice: ceiling ${ceilingFor(task)}, at most ${cap}`)
  }
  return out
}

// ─── SPEC §4.1 and A9: what a wrong value must be classified as ────────────

/** What explains a wrong value: misconceptions, a number from the question, a near miss, a typed reversal. */
export interface Why {
  mis: readonly MisconceptionId[]
  /** A number the child was given (said, or on screen). */
  operand?: boolean
  near?: boolean
  /** Another plain explanation (the wrong place, the wrong stretch): a skill may list it, which stops the digitSwap check. */
  plain?: boolean
  /** A typed answer with tens and ones swapped (SPEC §4.1 globalChecks: a slip outside hear/place). */
  swap?: boolean
}

/**
 * SPEC §4.1 with A9: one misconception is its tag; two, or one that is also a number from the question,
 * make it 'ambiguous'; a typed reversal with no other explanation is 'digitSwap'; anything else is
 * plain ('near', 'operand' or 'other' — plain tags are never evidence, so the oracle does not insist
 * on which).
 */
export function expectedTag(w: Why): ErrorTag | 'plain' {
  const mis = [...new Set(w.mis)]
  if (mis.length > 1) return 'ambiguous'
  if (mis.length === 1) return w.operand ? 'ambiguous' : mis[0]
  if (w.swap && !w.operand && !w.near && !w.plain) return 'digitSwap'
  return 'plain'
}

const PLAIN: ReadonlySet<string> = new Set(['near', 'operand', 'other'])

export function tagIssue(task: Task, value: AnswerValue, w: Why, shown: boolean): string | null {
  const got = classifyAnswer(task, value)
  const where = `${task.factId} ${task.kind} ${shown ? 'card' : 'typed'} ${String(value)} (answer ${String(task.answer)})`
  if (got === null) return `${where}: classified as right`
  const want = expectedTag(w)
  if (want === 'plain') return got !== null && PLAIN.has(got) ? null : `${where}: ${got}, expected a plain tag`
  return got === want ? null : `${where}: ${got}, expected ${want}`
}

/** Values a keypad task is checked with: 0 up to `upTo` (capped by the keys), plus every value the oracle or the skill names. */
export function typedValues(t: Task, upTo: number, extra: readonly number[] = []): number[] {
  const top = 10 ** t.maxDigits - 1
  const vals = new Set<number>()
  for (let v = 0; v <= Math.min(upTo, top); v++) vals.add(v)
  for (const v of extra) if (Number.isInteger(v) && v >= 0 && v <= top) vals.add(v)
  for (const k of Object.keys(t.distractorTags)) if (/^\d+$/.test(k) && Number(k) <= top) vals.add(Number(k))
  return [...vals]
}

/**
 * Classification of every card and every typed or placed value against the oracle's explanation. A
 * number-line value inside the oracle's tolerance is right (`rightAt`), and is checked to be right.
 */
export function classifyProblems2(
  built: readonly Built[],
  explain: (b: Built, value: AnswerValue) => Why,
  opts: { upTo?: number; extra?: (b: Built) => number[]; rightAt?: (b: Built, v: number) => boolean } = {},
): string[] {
  const out: string[] = []
  for (const b of built) {
    const { task } = b
    if (task.kind === 'choice') {
      for (const o of task.options) {
        if (o === task.answer) continue
        const p = tagIssue(task, o, explain(b, o), true)
        if (p) out.push(p)
      }
    } else if (task.kind === 'keypad' || task.kind === 'buildBase') {
      // a built answer is a value like a typed one: what the blocks are worth
      for (const v of typedValues(task, opts.upTo ?? 1000, opts.extra?.(b) ?? [])) {
        if (v === task.answer) continue
        const p = tagIssue(task, v, explain(b, v), false)
        if (p) out.push(p)
      }
    } else if (task.kind === 'numberline') {
      const [lo, hi] = lineOf(task)
      for (let v = lo; v <= hi; v++) {
        const right = opts.rightAt ? opts.rightAt(b, v) : v === task.answer
        if (right) {
          if (classifyAnswer(task, v) !== null) out.push(`${task.factId} numberline ${v}: right by the oracle, classified ${classifyAnswer(task, v)}`)
          continue
        }
        const p = tagIssue(task, v, explain(b, v), false)
        if (p) out.push(p)
      }
    }
  }
  return out
}

/**
 * SPEC §4.1: a card set shows a diagnostic card (one misconception, real evidence) whenever the oracle
 * knows such a value inside the card range — the rotation only decides which one.
 */
export function diagnosticCardProblems(built: readonly Built[], known: (b: Built) => number[], explain: (b: Built, v: AnswerValue) => Why): string[] {
  const out: string[] = []
  for (const b of built) {
    const t = b.task
    if (t.kind !== 'choice' || typeof t.answer !== 'number') continue
    const evidence = (v: number) => {
      const tag = expectedTag(explain(b, v))
      return v !== t.answer && v >= t.range[0] && v <= t.range[1] && tag !== 'plain' && tag !== 'ambiguous'
    }
    const available = [...new Set(known(b))].filter(evidence)
    if (available.length > 0 && !numberCards(t).some(evidence)) out.push(`${t.factId}: no diagnostic card among [${t.options}] (could be ${available})`)
  }
  return out
}

// ─── Spoken questions, solved as the child hears them ─────────────────────

/** Number cards of a task. */
export const numberCards = (t: Task): number[] => t.options.filter((o): o is number => typeof o === 'number')

/**
 * The answer of an order or number question as the child works it out from the spoken question (and,
 * where the question names none, the cards): after/before, ten or a hundred more or less, the biggest.
 */
export function orderAnswerFromSpeech(text: string, cards: readonly number[]): number | null {
  const steps: readonly [string, number][] = [
    ['Hvilket tal kommer efter ', 1], ['Hvilket tal kommer før ', -1],
    ['Hvilket tal er ti mere end ', 10], ['Hvilket tal er ti mindre end ', -10],
    ['Hvilket tal er hundrede mere end ', 100], ['Hvilket tal er hundrede mindre end ', -100],
  ]
  for (const [lead, d] of steps) {
    const n = numberAfter(text, lead)
    if (n !== null) return n + d
  }
  const named = after(text, 'Hvilket tal er størst, ')
  if (named !== null) {
    const ns = numbersIn(named)
    return ns.length >= 2 ? Math.max(...ns) : null
  }
  if (text === 'Hvilket tal er størst?' && cards.length > 0) return Math.max(...cards)
  return null
}

/** sortOrder: the cards in the order the instruction asks for — count on or back in ones, tens or hundreds, or biggest first. */
export function sortFromSpeech(text: string, cards: readonly number[]): number[] | null {
  const counts: readonly [string, number][] = [
    ['Tæl videre fra ', 1], ['Tæl baglæns fra ', -1], ['Tæl videre i tiere fra ', 10], ['Tæl baglæns i tiere fra ', -10],
    ['Tæl videre i hundreder fra ', 100], ['Tæl baglæns i hundreder fra ', -100],
  ]
  for (const [lead, d] of counts) {
    const n = numberAfter(text, lead)
    if (n !== null) return Array.from({ length: cards.length }, (_, i) => n + d * (i + 1))
  }
  if (text === 'Sæt tallene i rækkefølge. Start med det største.') return [...cards].sort((a, b) => b - a)
  return null
}

/** The stones of a row prompt (null = an empty stone). */
export const rowCells = (p: Prompt): (number | string | null)[] | null => (p.scene === 'row' ? p.cells : null)

// ═══ Number skills ═════════════════════════════════════════════════════════

// ─── hear100, hear1000 ──────────────────────────────────────────────────────

/** "Find tallet syvogfyrre." (cards) / "Skriv tallet syvogfyrre." (keypad) → 47. */
export function heardNumber2(text: string, kind: TaskKind): number | null {
  return numberAfter(text, kind === 'keypad' ? 'Skriv tallet ' : 'Find tallet ')
}

/** h100:<n> → n, family d<tens>x, n = 20–99 (SPEC §2.2: 8 families d2x…d9x of ten numbers). */
export function hear100Oracle(id: string): { family: string; answer: number } | null {
  const m = /^h100:(\d+)$/.exec(id)
  const n = m ? Number(m[1]) : NaN
  return n >= 20 && n <= 99 ? { family: `d${Math.floor(n / 10)}x`, answer: n } : null
}

/** The family a number 100–1000 belongs to (pædagogik §1.3: hundreds, h0o 104, hTeen 213, hT0 320, hTO). */
export function hear1000Family(n: number): string {
  const [t, o] = [Math.floor(n / 10) % 10, n % 10]
  if (n % 100 === 0) return 'hundreds'
  if (t === 0) return 'h0o'
  if (t === 1 && o > 0) return 'hTeen'
  if (o === 0) return 'hT0'
  return 'hTO'
}

export function hear1000Oracle(id: string): { family: string; answer: number } | null {
  const m = /^h1000:(\d+)$/.exec(id)
  const n = m ? Number(m[1]) : NaN
  return n >= 100 && n <= 1000 ? { family: hear1000Family(n), answer: n } : null
}

/** pædagogik §3.2 concatNumberWords: "tre hundrede og femogfyrre" written word by word → 30045 (H·10^(d+2) + rest). */
export function concatWords(n: number): number | null {
  const rest = n % 100
  if (n >= 1000 || n < 100 || rest === 0) return null
  return Math.floor(n / 100) * 10 ** (String(rest).length + 2) + rest
}

/**
 * pædagogik §3.2 zeroPlaceholder: the zero dropped or moved (304 → 34 or 340). One zero is left out
 * or put in another place; a round hundred said as "tre hundrede" may also be written as its digit
 * alone (300 → 30 or 3); "tusind" loses one zero (1000 → 100).
 */
export function zeroSlips(n: number): number[] {
  const ds = digitsOf(n)
  const out = new Set<number>()
  ds.forEach((d, i) => {
    if (d !== 0) return
    const without = ds.filter((_, j) => j !== i)
    out.add(fromDigits(without))
    for (let j = 1; j <= without.length; j++) {
      const moved = [...without.slice(0, j), 0, ...without.slice(j)]
      if (moved[0] !== 0) out.add(fromDigits(moved))
    }
  })
  if (n >= 100 && n <= 900 && n % 100 === 0) out.add(n / 100)
  out.delete(n)
  return [...out]
}

export const NEAR_STEPS = [1, 2, 10, 100]
const isNearBy = (v: number, answer: number, steps: readonly number[] = NEAR_STEPS) => steps.includes(Math.abs(v - answer))

/** A heard number: the Danish ones-first order (digitSwap, a concept in hear*), near misses; nothing else is said. */
export function explainHeard100(n: number, v: AnswerValue): Why {
  if (typeof v !== 'number') return { mis: [] }
  return { mis: v === swapTO(n) ? ['digitSwap'] : [], near: isNearBy(v, n) }
}

export function explainHeard1000(n: number, v: AnswerValue): Why {
  if (typeof v !== 'number') return { mis: [] }
  const mis: MisconceptionId[] = []
  if (v === concatWords(n)) mis.push('concatNumberWords')
  if (zeroSlips(n).includes(v)) mis.push('zeroPlaceholder')
  if (n < 1000 && v === swapTO(n)) mis.push('digitSwap')
  return { mis, near: isNearBy(v, n) }
}

// ─── order100, order1000 ────────────────────────────────────────────────────

export interface OrderQ {
  family: string
  /** The number said (±, crossTen, crossHundred) … */
  n?: number
  /** … and the signed step asked for. */
  step?: number
  /** The numbers to compare (bigger families), in the spoken order. */
  nums?: number[]
}

const hundredOf = (n: number) => Math.floor(n / 100)
const tenOf = (n: number) => Math.floor(n / 10)

/**
 * order100 ids: plus1/minus1/plus10/minus10:<n> inside a ten (±1) or the 100-board, crossTen:after|before:<n>
 * over a new ten (39 + 1, 70 − 1), biggerDiffTens:<x>:<y> (different tens, the smaller has the bigger
 * ones digit) and biggerSwapped:<x>:<y> (the same two digits swapped). pædagogik §1.3.
 */
export function parseOrder100(id: string): OrderQ | null {
  const p = id.split(':')
  if (p[0] !== 'o100') return null
  const num = (s: string | undefined) => (s !== undefined && /^\d+$/.test(s) ? Number(s) : NaN)
  const steps: Record<string, number> = { plus1: 1, minus1: -1, plus10: 10, minus10: -10 }
  if (p[1] in steps && p.length === 3) {
    const n = num(p[2])
    const a = n + steps[p[1]]
    const ok = n >= 1 && a >= 1 && a <= 100 && n <= 100 && (Math.abs(steps[p[1]]) === 10 || tenOf(n) === tenOf(a))
    return ok ? { family: p[1], n, step: steps[p[1]] } : null
  }
  if (p[1] === 'crossTen' && p.length === 4) {
    const n = num(p[3])
    const d = p[2] === 'after' ? 1 : p[2] === 'before' ? -1 : 0
    const a = n + d
    return d !== 0 && a >= 1 && a <= 100 && tenOf(n) !== tenOf(a) ? { family: 'crossTen', n, step: d } : null
  }
  if ((p[1] === 'biggerDiffTens' || p[1] === 'biggerSwapped') && p.length === 4) {
    const [x, y] = [num(p[2]), num(p[3])]
    if (!(x >= 10 && x <= 99 && y >= 10 && y <= 99 && x !== y)) return null
    const [lo, hi] = x < y ? [x, y] : [y, x]
    const ok = p[1] === 'biggerSwapped' ? swapTO(lo) === hi : tenOf(lo) !== tenOf(hi) && lo % 10 > hi % 10
    return ok ? { family: p[1], nums: [x, y] } : null
  }
  return null
}

/**
 * order1000 ids: plus1/minus1/plus10/minus10:<n> inside a hundred, plus100/minus100:<n>,
 * crossHundred:<plus1|plus10|minus1|minus10>:<n> over a new hundred (399 + 1, 395 + 10, 400 − 1, 405 − 10),
 * bigger3:<a>:<b>:<c> (three three-digit numbers) and biggerMixed:<x>:<y> (a two-digit number with the
 * bigger first digit against a three-digit one, 69 and 102). pædagogik §1.3.
 */
export function parseOrder1000(id: string): OrderQ | null {
  const p = id.split(':')
  if (p[0] !== 'o1000') return null
  const num = (s: string | undefined) => (s !== undefined && /^\d+$/.test(s) ? Number(s) : NaN)
  const steps: Record<string, number> = { plus1: 1, minus1: -1, plus10: 10, minus10: -10, plus100: 100, minus100: -100 }
  if (p[1] in steps && p.length === 3) {
    const n = num(p[2])
    const s = steps[p[1]]
    const a = n + s
    const inside = Math.abs(s) === 100 || hundredOf(n) === hundredOf(a)
    return n >= 100 && n <= 999 && a >= 100 && a <= 999 && inside ? { family: p[1], n, step: s } : null
  }
  if (p[1] === 'crossHundred' && p.length === 4 && ['plus1', 'plus10', 'minus1', 'minus10'].includes(p[2])) {
    const n = num(p[3])
    const s = steps[p[2]]
    const a = n + s
    return n >= 100 && n <= 1000 && a >= 100 && a <= 1000 && hundredOf(n) !== hundredOf(a) ? { family: 'crossHundred', n, step: s } : null
  }
  if (p[1] === 'bigger3' && p.length === 5) {
    const nums = p.slice(2).map(num)
    const ok = nums.every((v) => v >= 100 && v <= 999) && new Set(nums).size === 3
    return ok ? { family: 'bigger3', nums } : null
  }
  if (p[1] === 'biggerMixed' && p.length === 4) {
    const nums = [num(p[2]), num(p[3])]
    const small = nums.find((v) => v >= 10 && v <= 99)
    const big = nums.find((v) => v >= 100 && v <= 999)
    const ok = small !== undefined && big !== undefined && digitsOf(small)[0] > digitsOf(big)[0]
    return ok ? { family: 'biggerMixed', nums } : null
  }
  return null
}

/** The number answer of an order question (the biggest for the bigger families). */
export const orderAnswer = (q: OrderQ): number => (q.nums ? Math.max(...q.nums) : q.n! + q.step!)

/** biggerMixed on cards: the sign between the two numbers in the spoken order. */
export const signToken = (x: number, y: number): string => (x < y ? 'cmp:<' : x > y ? 'cmp:>' : 'cmp:=')

/** firstDigitCompare (pædagogik §3.2): the numbers ordered by their first digit, as if 69 > 102. */
export const byFirstDigit = (nums: readonly number[]): number[] =>
  [...nums].sort((a, b) => digitsOf(b)[0] - digitsOf(a)[0] || b - a)

/** "Hvilket tegn skal stå mellem niogtres og et hundrede og to?" → the sign. */
export function signFromSpeech(text: string): string | null {
  const rest = after(text, 'Hvilket tegn skal stå mellem ')
  if (rest === null) return null
  const ns = numbersIn(rest)
  return ns.length === 2 ? signToken(ns[0], ns[1]) : null
}

/**
 * A wrong number for an order question: a number from the question ('operand': the said number, or the
 * numbers to compare), a near miss (±1, ±2, ±10, ±100: the hundred or ten not changed is one), the wrong
 * place (+1 for +10), and a typed reversal (the global digitSwap slip). biggerMixed: the two-digit number
 * is firstDigitCompare — and a number from the question, so 'ambiguous' (A9).
 */
export function explainOrder(q: OrderQ, task: Task, v: AnswerValue): Why {
  const answer = orderAnswer(q)
  if (typeof v === 'string') {
    // biggerMixed cards: the sign the first digits would give is firstDigitCompare; '=' is plainly wrong
    if (q.family !== 'biggerMixed' || !q.nums) return { mis: [] }
    const [x, y] = q.nums
    return { mis: v === signToken(digitsOf(x)[0], digitsOf(y)[0]) ? ['firstDigitCompare'] : [] }
  }
  const given = q.nums ?? [q.n!]
  const mis: MisconceptionId[] = []
  if (q.family === 'biggerMixed' && q.nums && v === Math.min(...q.nums)) mis.push('firstDigitCompare')
  const operand = given.includes(v)
  const near = isNearBy(v, answer)
  const wrongPlace = q.n !== undefined && q.step !== undefined && [1, 10, 100].some((s) => s !== Math.abs(q.step!) && v === q.n! + Math.sign(q.step!) * s)
  const swap = task.kind === 'keypad' && answer >= 13 && v === swapTO(answer)
  return { mis, operand, near, plain: wrongPlace, swap }
}

// ─── numberLine100, numberLine1000 ──────────────────────────────────────────

export interface LineQ {
  family: string
  n: number
  answer: number
  /** One step of the line's ticks: 10 on 0–100, 100 on 0–1000; the rounding step for round10/round100. */
  step: number
}

/** nl100:placeTens:<10…90> · placeAny:<1–99> · readArrow:<5, 10 … 95> (pædagogik §1.3). */
export function parseLine100(id: string): LineQ | null {
  const m = /^nl100:(placeTens|placeAny|readArrow):(\d+)$/.exec(id)
  if (!m) return null
  const n = Number(m[2])
  const ok = m[1] === 'placeTens' ? n % 10 === 0 && n >= 10 && n <= 90 : m[1] === 'placeAny' ? n >= 1 && n <= 99 : n % 5 === 0 && n >= 5 && n <= 95
  return ok ? { family: m[1], n, answer: n, step: 10 } : null
}

/** nl1000:placeHundreds:<100…900> · placeAny:<1–999> · round10:<n> → nearest ten · round100:<n> → nearest hundred (five rounds up). */
export function parseLine1000(id: string): LineQ | null {
  const m = /^nl1000:(placeHundreds|placeAny|round10|round100):(\d+)$/.exec(id)
  if (!m) return null
  const n = Number(m[2])
  switch (m[1]) {
    case 'placeHundreds':
      return n % 100 === 0 && n >= 100 && n <= 900 ? { family: m[1], n, answer: n, step: 100 } : null
    case 'placeAny':
      return n >= 1 && n <= 999 ? { family: m[1], n, answer: n, step: 100 } : null
    case 'round10':
      return n >= 101 && n <= 999 && n % 10 !== 0 ? { family: m[1], n, answer: roundHalfUp(n, 10), step: 10 } : null
    default:
      return n >= 101 && n <= 999 && n % 100 !== 0 ? { family: m[1], n, answer: roundHalfUp(n, 100), step: 100 } : null
  }
}

/**
 * The answer as the child works it out: "Sæt nålen ved X" → X; the arrow or the end of the hop read off
 * the line; "Hvilket tal ligger mellem A og B?" → the one card between them; "… midt mellem A og B?" →
 * the middle; rounding: the nearest ten or hundred of the said number (five rounds up).
 */
export function lineAnswerFromTask(t: Task): number | null {
  const text = spokenText(t.speech)
  const nearest: readonly [string, number][] = [
    ['Sæt nålen ved den tier, der ligger tættest på ', 10], ['Sæt nålen ved det hundrede, der ligger tættest på ', 100],
  ]
  for (const [lead, step] of nearest) {
    const n = numberAfter(text, lead)
    if (n !== null) return roundHalfUp(n, step)
  }
  for (const [lead, step] of [['Hvilken tier ligger ', 10], ['Hvilket hundrede ligger ', 100]] as const) {
    const rest = after(text, lead)
    if (rest !== null && rest.endsWith(' tættest på?')) {
      const ns = numbersIn(rest)
      return ns.length === 1 ? roundHalfUp(ns[0], step) : null
    }
  }
  const placed = numberAfter(text, 'Sæt nålen ved ')
  if (placed !== null) return placed
  const p = t.prompt
  if (text === 'Hvilket tal peger pilen på?') return p.scene === 'line' && p.arrowAt !== undefined ? p.arrowAt : null
  const hop = after(text, 'Hoppet starter ved ')
  if (hop !== null) {
    const ns = numbersIn(hop)
    const hops = p.scene === 'line' ? p.hops ?? [] : []
    return ns.length === 1 && hops.length === 2 && hops[0] === ns[0] && text.endsWith('Hvor lander det?') ? hops[1] : null
  }
  const midway = after(text, 'Hvilket tal ligger midt mellem ')
  if (midway !== null) {
    const ns = numbersIn(midway)
    return ns.length === 2 && (ns[0] + ns[1]) % 2 === 0 ? (ns[0] + ns[1]) / 2 : null
  }
  const between = after(text, 'Hvilket tal ligger mellem ')
  if (between !== null) {
    const ns = numbersIn(between)
    if (ns.length !== 2) return null
    const inside = numberCards(t).filter((c) => c > ns[0] && c < ns[1])
    return inside.length === 1 ? inside[0] : null
  }
  return null
}

const saidCache = new WeakMap<Task, number[]>()
/** The numbers a line question says (the stretch's ends, the hop's start, the number to round). */
export function saidNumbers(t: Task): number[] {
  let said = saidCache.get(t)
  if (!said) saidCache.set(t, (said = numbersIn(spokenText(t.speech))))
  return said
}

/**
 * A wrong number on a line: a number the question says ('operand'), a near miss (±1, ±2, ±5, ±10 on
 * 0–100; ±50, ±100 on 0–1000; rounding: the other way or the wrong place), and a typed reversal (the
 * global digitSwap slip). No misconception from the catalogue belongs to the line.
 */
export function explainLine(q: LineQ, t: Task, v: AnswerValue): Why {
  if (typeof v !== 'number') return { mis: [] }
  const said = saidNumbers(t)
  const scale = q.step >= 100 || q.answer > 100 ? [1, 2, 10, 50, 100] : [1, 2, 5, 10]
  const near = isNearBy(v, q.answer, scale)
  const rounding = q.family.startsWith('round')
  const plain = rounding && (v === roundHalfUp(q.n, q.step === 10 ? 100 : 10) || Math.abs(v - q.answer) === q.step)
  const swap = t.kind === 'keypad' && q.answer >= 13 && v === swapTO(q.answer)
  return { mis: [], operand: said.includes(v) || v === q.n, near, plain, swap }
}

// ─── SPEC §10.1: how a number is said ───────────────────────────────────────

const WORDS_0_20 = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten',
  'femten', 'seksten', 'sytten', 'atten', 'nitten', 'tyve']
const TENS_WORDS = ['', '', 'tyve', 'tredive', 'fyrre', 'halvtreds', 'tres', 'halvfjerds', 'firs', 'halvfems']

/**
 * SPEC §10.1 Talord: 0–20 as words, the tens, 21–99 as one word (enogtyve), 100–999 "[et|to|…] hundrede"
 * with "og" only before the last group, 1000 "tusind"; 1 alone is "en", or "et" before a neuter noun.
 */
export function spec101Words(n: number, gender: 'c' | 'n' = 'c'): string {
  if (n === 1000) return 'tusind'
  if (n >= 100) {
    const h = Math.floor(n / 100)
    const rest = n % 100
    const head = `${h === 1 ? 'et' : WORDS_0_20[h]} hundrede`
    return rest === 0 ? head : `${head} og ${spec101Words(rest)}`
  }
  if (n === 1) return gender === 'n' ? 'et' : 'en'
  if (n <= 20) return WORDS_0_20[n]
  const o = n % 10
  return o === 0 ? TENS_WORDS[Math.floor(n / 10)] : `${WORDS_0_20[o]}og${TENS_WORDS[Math.floor(n / 10)]}`
}

/** Every number a task says is said as SPEC §10.1 writes it (the compiled text of each number part). */
export function numberWordProblems(built: readonly Built[]): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) {
    for (const part of task.speech) {
      if (!('num' in part)) continue
      const said = spokenText([part]).toLowerCase().replace(/[.,?!]/g, '').trim()
      const want = spec101Words(part.num, part.gender)
      if (said !== want) out.add(`${fact.id} ${kind}: ${part.num} said "${said}", SPEC §10.1 "${want}"`)
    }
  }
  return [...out]
}

// ─── Shared answer checks ─────────────────────────────────────────────────

/** SPEC §3.1: the keypad takes digits(range max) digits — in hear1000 and placeValue1000 two more than the answer has, so 1004 fits. */
const WIDE: readonly SkillId[] = ['hear1000', 'placeValue1000']
export function keypadDigits(t: Task): number {
  const top = String(t.range[1]).length
  return WIDE.includes(t.skill) && typeof t.answer === 'number' ? Math.max(top, String(t.answer).length + 2) : top
}

/** The wave-1 answer checks with SPEC §3.1's keypad width (the wave-1 kit has no wide-keypad rule). */
export function answerProblems2(t: Task): string[] {
  const out = answerProblemsW1(t).filter((p) => !/ digits for the range /.test(p))
  if (t.kind === 'keypad' && t.maxDigits !== keypadDigits(t)) out.push(`${t.factId} keypad: ${t.maxDigits} digits, SPEC §3.1 ${keypadDigits(t)}`)
  return out
}
