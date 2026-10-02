// Independent oracles for the clock skills of 1.–2. klasse (clockHour, clockHalf, clockQuarter), plus
// the small kit the money and measure2 oracles share (ORK2b). Written by another agent than the
// generators (SPEC A5, §15.1): every right answer is worked out here from what the child is given —
// the fact id, the spoken time, the hands on the cards — and never from the generator code. Wrong
// clocks are explained with pædagogik §3.2's formulas, worked out here for "find the clock" and
// "set the clock" tasks. The registry skips *.oracle.ts files, so none of this reaches the app.
import { readFileSync } from 'node:fs'
import type { AnswerValue, ErrorTag, Fact, MisconceptionId, SkillDef, SkillId, SpeechPart, Task, TaskKind } from '../../types'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { ceilingFor, guessP, isProduction } from '../../kinds'
import { hashSeed, makeRng } from '../../rng'
import { clipText, hasClip } from '../../../speech/catalog'
import { compile } from '../../../speech/compile'
import { isMisconception, tasksOf, type Built } from '../number/number.oracle'
import { spec101Words } from '../number/number2.oracle'

// ═══ Kit for the wave-2 clock, money and measure oracles ═════════════════════

// ─── Instances ──────────────────────────────────────────────────────────────

/** 200 seeded instances per family (SPEC §15.1), from this oracle's own seeds. */
export function instancesB(def: SkillDef, perFamily = 200): Map<string, Fact[]> {
  const out = new Map<string, Fact[]>()
  for (const fam of def.families) {
    const rng = makeRng(hashSeed(`ork2b:${def.id}/${fam.id}`))
    out.set(fam.id, Array.from({ length: perFamily }, () => def.instance!(fam, rng, new Set())))
  }
  return out
}

/** Canonical facts (several deals each, plus one deal aimed at each misconception) and 200 instances per family. */
export function sweepB(def: SkillDef, seeds = 3) {
  const canon = def.enumerate()
  const instances = def.mode === 'procedure' ? instancesB(def) : new Map<string, Fact[]>()
  const drawn = [...instances.values()].flat()
  const all: Fact[] = [...canon, ...drawn]
  const built: Built[] = [...tasksOf(def, canon, seeds), ...tasksOf(def, drawn, 1)]
  return { canon, instances, all, built }
}

/** Instance ids are unique within a family: one id never names two different instances. */
export function instanceIdProblems(def: SkillDef, facts: readonly Fact[]): string[] {
  const out: string[] = []
  const seen = new Map<string, string>()
  for (const f of facts) {
    const key = JSON.stringify([f.family, f.operands, f.answer, f.data ?? null])
    const prev = seen.get(f.id)
    if (prev !== undefined && prev !== key) out.push(`${def.id} ${f.id}: two different instances share the id`)
    seen.set(f.id, key)
  }
  return out
}

/** Avoided instances are avoided while the family has others left (SPEC §5.1: a new instance avoids the recent ones). */
export function avoidProblemsB(def: SkillDef, instances: ReadonlyMap<string, readonly Fact[]>): string[] {
  const out: string[] = []
  for (const fam of def.families) {
    const pool = [...new Set((instances.get(fam.id) ?? []).map((f) => f.id))]
    if (pool.length < 4) continue
    const avoid = new Set(pool.slice(0, Math.floor(pool.length / 2)))
    const rng = makeRng(hashSeed(`ork2b-avoid:${def.id}/${fam.id}`))
    for (let i = 0; i < 40; i++) {
      const f = def.instance!(fam, rng, avoid)
      if (avoid.has(f.id)) out.push(`${def.id}/${fam.id}: drew avoided ${f.id}`)
    }
  }
  return out
}

/**
 * CONVENTIONS "Fact-id'er": a skill outside the table picks one short prefix and documents it in its
 * module. The skill's facts all carry `prefix`, and the module's source names it (`prefix:` in backticks).
 */
export function prefixProblems(def: SkillDef, facts: readonly Fact[], prefix: string): string[] {
  const out: string[] = []
  for (const f of facts) if (!f.id.startsWith(`${prefix}:`)) out.push(`${def.id} ${f.id}: not under the prefix ${prefix}:`)
  const source = readFileSync(new URL(`../${def.domain}/${def.id}.ts`, import.meta.url), 'utf8')
  if (!source.includes(`\`${prefix}:`)) out.push(`${def.id}: the module does not document its prefix ${prefix}:`)
  return out
}

// ─── SPEC §2.2: kinds and production kinds (the *) of the 12 skills ──────

export const SPEC_KINDS_B: Readonly<Partial<Record<SkillId, { kinds: readonly TaskKind[]; production: readonly TaskKind[] }>>> = {
  clockHour: { kinds: ['choice', 'clockSet'], production: ['clockSet'] },
  clockHalf: { kinds: ['choice', 'clockSet'], production: ['clockSet'] },
  clockQuarter: { kinds: ['choice', 'clockSet'], production: ['clockSet'] },
  coinNames: { kinds: ['choice', 'multiSelect'], production: ['multiSelect'] },
  countCoins: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  payExact: { kinds: ['pay', 'choice'], production: ['pay'] },
  change: { kinds: ['choice', 'keypad', 'pay'], production: ['keypad', 'pay'] },
  weightCompare: { kinds: ['choice', 'multiSelect'], production: ['multiSelect'] },
  measureUnits: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  rulerRead: { kinds: ['choice', 'keypad'], production: ['keypad'] },
  unitChoice: { kinds: ['choice', 'multiSelect'], production: ['multiSelect'] },
  readChart: { kinds: ['choice', 'keypad'], production: ['keypad'] },
}

/** The minute hand's step per clock skill (SPEC §3.2 clockSet: whole, half and quarter hours). */
export const CLOCK_STEP: Readonly<Partial<Record<SkillId, 60 | 30 | 15>>> = { clockHour: 60, clockHalf: 30, clockQuarter: 15 }

// ─── SPEC §3.2–3.3: guess rate, production and ceiling ─────────────────────

/** Whole kroner a money keypad can take: the child types kroner (entryScale 100), not øre. */
const keypadValues = (t: Task): number => Math.floor(t.range[1] / t.entryScale) - Math.ceil(t.range[0] / t.entryScale) + 1

/**
 * SPEC §3.2, column guessP, read off what the child is shown: one in the cards; one in the numbers the
 * keypad can take (kroner for money); the clock's step out of 720 dial minutes; any non-empty subset of
 * the multiSelect things; 0.01 for paying from a purse. None of the twelve skills' questions names its
 * candidates, so there is no coin flip to add (Task.guessFloor is only the kroner keypad's).
 */
export function oracleGuessB(t: Task): number {
  switch (t.kind) {
    case 'choice':
      return 1 / t.options.length
    case 'keypad':
      return 1 / keypadValues(t)
    case 'clockSet':
      return CLOCK_STEP[t.skill]! / 720
    case 'multiSelect':
      return 1 / (2 ** t.options.length - 1)
    case 'pay':
      return 0.01
    default:
      throw new Error(`no oracle guess rate for ${t.kind}`)
  }
}

const MANIPULATIVE_ONLY_FOR: Readonly<Partial<Record<TaskKind, readonly SkillId[]>>> = {
  share: ['shareEqually', 'fractionOfSet'], buildBase: ['tensOnes', 'placeValue1000'], countTap: ['count10', 'count20'],
}
export const oracleProductionB = (t: Task): boolean => oracleGuessB(t) <= 0.12 && (MANIPULATIVE_ONLY_FOR[t.kind]?.includes(t.skill) ?? true)
/** SPEC §3.3: production reaches box 5, a guessable answer box 3, a coin flip box 2. */
export const oracleCeilingB = (t: Task): 2 | 3 | 5 => (oracleProductionB(t) ? 5 : oracleGuessB(t) >= 0.5 ? 2 : 3)

/** The engine's guessP, isProduction and ceilingFor against the oracle's, per task; guessFloor only on a kroner keypad. */
export function productionProblemsB(built: readonly Built[]): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) {
    const where = `${fact.skill} ${fact.id} ${kind}`
    const want = oracleGuessB(task)
    if (Math.abs(guessP(task) - want) > 1e-12) out.add(`${where}: guessP ${guessP(task)}, oracle ${want}`)
    if (isProduction(task) !== oracleProductionB(task)) out.add(`${where}: isProduction ${isProduction(task)}, oracle ${oracleProductionB(task)}`)
    if (ceilingFor(task) !== oracleCeilingB(task)) out.add(`${where}: ceiling ${ceilingFor(task)}, oracle ${oracleCeilingB(task)}`)
    const kroner = kind === 'keypad' && task.entryScale === 100
    if (!kroner && task.guessFloor !== undefined) out.add(`${where}: guessFloor ${task.guessFloor} where the question names no candidates`)
  }
  return [...out]
}

/**
 * SPEC §2.2/§3.3 per skill: the kinds are SPEC's; a starred kind is production for ≥ 90 % of its tasks,
 * an unstarred one never; cards lift at most to box 3 (box 2 when the guess is a coin flip or likelier).
 */
export function specKindProblemsB(def: SkillDef, built: readonly Built[]): string[] {
  const spec = SPEC_KINDS_B[def.id]
  if (!spec) return [`${def.id}: not in the oracle's SPEC §2.2 table`]
  const out: string[] = []
  if ([...def.kinds].sort().join(',') !== [...spec.kinds].sort().join(',')) out.push(`${def.id}: kinds ${def.kinds}, SPEC ${spec.kinds}`)
  for (const kind of def.kinds) {
    const own = built.filter((b) => b.kind === kind)
    if (own.length === 0) continue
    const share = own.filter((b) => oracleProductionB(b.task)).length / own.length
    if (spec.production.includes(kind) && share < 0.9) out.push(`${def.id} ${kind}: production for ${(share * 100).toFixed(1)} %, SPEC wants ≥ 90 %`)
    if (!spec.production.includes(kind) && share > 0) out.push(`${def.id} ${kind}: production for ${(share * 100).toFixed(1)} %, SPEC says never`)
  }
  for (const { fact, task } of built) {
    if (task.kind !== 'choice') continue
    const cap = oracleGuessB(task) >= 0.5 ? 2 : 3
    if (ceilingFor(task) > cap) out.push(`${fact.id} choice: ceiling ${ceilingFor(task)}, at most ${cap}`)
  }
  return out
}

// ─── SPEC §4.1, A9 and A11: what a wrong value must be classified as ───────

/** What explains a wrong value. */
export interface WhyB {
  mis: readonly MisconceptionId[]
  /** A number from the question (said, written on a coin, marked on the ruler where the thing starts …). */
  operand?: boolean
  /** The answer with tens and ones swapped, where SPEC §4.1's digitSwap can happen at all. */
  swap?: boolean
}

/**
 * SPEC §4.1 with A9 and A11: two misconceptions make a value 'ambiguous'; one is its tag, unless the value
 * is also a number from the question (A9) or the answer with its digits swapped (A11) — then 'ambiguous';
 * a swap with no other explanation is 'digitSwap'; anything else is plain ('near', 'operand' or 'other',
 * never evidence, so the oracle does not insist on which).
 */
export function expectB(w: WhyB): ErrorTag | 'plain' {
  const mis = [...new Set(w.mis)]
  if (mis.length > 1) return 'ambiguous'
  if (mis.length === 1) return w.operand || w.swap ? 'ambiguous' : mis[0]
  if (w.swap && !w.operand) return 'digitSwap'
  return 'plain'
}

const PLAIN: ReadonlySet<string> = new Set(['near', 'operand', 'other'])

/** classifyAnswer against the oracle's expectation; a problem or null. */
export function tagCheck(task: Task, value: AnswerValue, w: WhyB, how: string): string | null {
  const got = classifyAnswer(task, value)
  const where = `${task.factId} ${task.kind} ${how} ${String(value)} (answer ${String(task.answer)})`
  if (got === null) return `${where}: classified as right`
  const want = expectB(w)
  if (want === 'plain') return PLAIN.has(got) ? null : `${where}: ${got}, expected a plain tag`
  return got === want ? null : `${where}: ${got}, expected ${want}`
}

/** 47 → 74 (two different non-zero digits), else null. */
export function swapped2(n: number): number | null {
  if (!Number.isInteger(n) || n < 10 || n > 99) return null
  const t = Math.floor(n / 10)
  const o = n % 10
  return t === o || o === 0 ? null : 10 * o + t
}

/**
 * SPEC §4.1 globalChecks, outside the hear and place skills: a typed answer of 13 or more with two different
 * digits, written back to front, when the reversed number is not on the screen. The typed number is what
 * the keys show — kroner on a money keypad (entryScale 100).
 */
export function typedSwap(task: Task, value: number, onScreen: readonly number[]): boolean {
  if (task.kind !== 'keypad' || typeof task.answer !== 'number') return false
  const typed = task.answer / task.entryScale
  const rev = swapped2(typed)
  return rev !== null && typed >= 13 && !onScreen.includes(rev) && value === rev * task.entryScale
}

/**
 * Every misconception a task lists as detectable (an opportunity, SPEC §4.3) can actually be given on it:
 * a card dealt, a number the keys can type, a time the dial's step can set, a sum the purse can pay, a
 * subset of the things. `reach` says whether a value can be given on this task.
 */
export function detectableReachProblems(built: readonly Built[], reach: (t: Task, v: AnswerValue) => boolean): string[] {
  const out = new Set<string>()
  for (const { fact, task } of built) {
    if (task.kind === 'choice') continue
    for (const m of detectableOf(task)) {
      const values = Object.entries(task.distractorTags).filter(([, tag]) => tag === m).map(([k]) => (/^\d+$/.test(k) ? Number(k) : k))
      if (values.length > 0 && !values.some((v) => reach(task, v))) {
        out.add(`${fact.skill} ${fact.id} ${task.kind}: ${m} is detectable, but none of its values (${values.join(', ')}) can be given here`)
      }
    }
  }
  return [...out]
}

// ─── SPEC §3.5 and §4.3: the strategy after a mistake ─────────────────────

/** SPEC §4.3: the eight misconceptions with an animated hint; the others get a spoken specific hint. */
export const ANIMATED_MISCONCEPTIONS: readonly MisconceptionId[] = [
  'digitSwap', 'forgotCarry', 'smallerFromLarger', 'borrowNoDecrement', 'equalsAsAnswer', 'halfPastNext', 'tableNeighbour', 'concatNumberWords',
]

/**
 * SPEC §3.5/§4.3: every misconception a skill tags gets its own hint (hint.misconception is that tag), on
 * every kind; it is animated only for SPEC's eight, and a plain tag never gets a misconception's hint.
 */
export function specificHintProblems(def: SkillDef, facts: readonly Fact[]): string[] {
  const out = new Set<string>()
  for (const f of facts) {
    const mis = new Set(def.candidates(f).map((c) => c.tag).filter(isMisconception))
    for (const kind of [undefined, ...def.kinds]) {
      for (const tag of mis) {
        const h = def.hint(f, tag, kind)
        if (h.misconception !== tag) out.add(`${def.id} ${f.id} hint(${tag}${kind ? `, ${kind}` : ''}): misconception ${String(h.misconception)}`)
        if ((h.animated === true) !== ANIMATED_MISCONCEPTIONS.includes(tag)) out.add(`${def.id} ${f.id} hint(${tag}): animated ${String(h.animated)}`)
      }
      for (const tag of [null, 'near', 'operand', 'other', 'ambiguous'] as const) {
        const h = def.hint(f, tag, kind)
        if (h.misconception !== undefined || h.animated) out.add(`${def.id} ${f.id} hint(${String(tag)}): the ${String(h.misconception)} hint`)
      }
    }
  }
  return [...out]
}

// ─── SPEC §10.1: clock times, money and measurements as said ───────────────

/** "et" before neuter nouns and in "klokken et" (SPEC §10.1 Køn). */
const hourWord = (h: number): string => spec101Words(h, h === 1 ? 'n' : 'c')

/** SPEC §10.1 Klokken for whole, half and quarter hours: "tre", "kvart over tre", "halv tre", "kvart i tre". */
export function spec101Clock(minutes: number): string {
  const dial = ((minutes % 720) + 720) % 720
  const h = Math.floor(dial / 60) || 12
  const next = (h % 12) + 1
  switch (dial % 60) {
    case 0: return hourWord(h)
    case 15: return `kvart over ${hourWord(h)}`
    case 30: return `halv ${hourWord(next)}`
    case 45: return `kvart i ${hourWord(next)}`
    default: throw new Error(`the oracle only says whole, half and quarter hours (${minutes})`)
  }
}

/** SPEC §10.1 Penge: 1250 → "tolv kroner og halvtreds øre", 100 → "en krone", 50 → "halvtreds øre", 10000 → "et hundrede kroner". */
export function spec101Money(ore: number): string {
  const kr = Math.floor(ore / 100)
  const o = ore % 100
  const krone = kr === 1 ? 'en krone' : `${spec101Words(kr)} kroner`
  if (kr > 0 && o > 0) return `${krone} og ${spec101Words(o)} øre`
  return kr > 0 ? krone : `${spec101Words(o)} øre`
}

const UNIT_WORDS: Readonly<Record<string, readonly [word: string, gender: 'c' | 'n']>> = {
  cm: ['centimeter', 'c'], m: ['meter', 'c'], g: ['gram', 'n'], kg: ['kilogram', 'n'],
}
/** "syv centimeter", "en meter", "et gram" (SPEC §10.1: "et" before neuter units). */
export const spec101Measure = (value: number, unit: string): string => `${spec101Words(value, UNIT_WORDS[unit][1])} ${UNIT_WORDS[unit][0]}`

const bare = (s: string): string => s.toLowerCase().replace(/[.,?!]/g, ' ').replace(/\s+/g, ' ').trim()

/** The phrase SPEC §10.1 wants for a clock, money or measure part (null for other parts). */
export function specPhrase(part: SpeechPart): string | null {
  if ('clock' in part) return part.clock.style === 'digital' ? null : spec101Clock(part.clock.minutes)
  if ('money' in part) return spec101Money(part.money.ore)
  if ('measure' in part) return spec101Measure(part.measure.value, part.measure.unit)
  return null
}

/**
 * SPEC §10.1 normalisation of times, amounts and measurements: the text a part compiles to is SPEC's
 * phrase, and so is what its recorded clips say (their catalogue texts in a row). No digits, no missing clip.
 */
export function normalisedPartProblems(parts: readonly SpeechPart[], where: string): string[] {
  const out: string[] = []
  for (const part of parts) {
    const want = specPhrase(part)
    if (want === null) continue
    const c = compile([part])
    if (bare(c.text) !== want) out.push(`${where}: ${JSON.stringify(part)} says "${c.text}", SPEC §10.1 "${want}"`)
    if (c.missing.length > 0) out.push(`${where}: ${JSON.stringify(part)} has no clip ${c.missing}`)
    const recorded = bare(c.clips.map((id) => (hasClip(id) ? clipText(id) : `<${id}>`)).join(' '))
    if (recorded !== want) out.push(`${where}: the clips of ${JSON.stringify(part)} say "${recorded}", SPEC §10.1 "${want}"`)
    if (/\d/.test(c.text)) out.push(`${where}: digits in "${c.text}"`)
  }
  return out
}

/** Every time, amount and measurement a task or one of its hints says is SPEC §10.1's phrase. */
export function normalisationProblems(def: SkillDef, built: readonly Built[], facts: readonly Fact[], tags: readonly (ErrorTag | null)[]): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) for (const p of normalisedPartProblems(task.speech, `${fact.id} ${kind}`)) out.add(p)
  for (const f of facts) {
    for (const tag of tags) {
      for (const kind of [undefined, ...def.kinds]) {
        for (const p of normalisedPartProblems(def.hint(f, tag, kind).speech, `${f.id} hint(${String(tag)}${kind ? `, ${kind}` : ''})`)) out.add(p)
      }
    }
  }
  return [...out]
}

// ═══ Clock skills ══════════════════════════════════════════════════════════

const DIAL = 720
export const onDial = (m: number): number => ((Math.round(m) % DIAL) + DIAL) % DIAL

const HOURS: Readonly<Record<string, number>> = {
  et: 1, en: 1, to: 2, tre: 3, fire: 4, fem: 5, seks: 6, syv: 7, otte: 8, ni: 9, ti: 10, elleve: 11, tolv: 12,
}
/** Where the hour H is on the dial (12 is 0). */
const hourAt = (h: number): number => (h % 12) * 60

export type ClockForm = 'hel' | 'halv' | 'kvartOver' | 'kvartI'

export interface SaidTime {
  form: ClockForm
  /** The hour the phrase names (1–12): "halv tre" names three. */
  hour: number
  /** The time on the 12-hour dial, 0–719. */
  minutes: number
}

/**
 * A Danish clock phrase as the child hears it: "tre" is three o'clock, "halv tre" half an hour BEFORE
 * three (2:30, the Danish half form), "kvart over tre" 3:15 and "kvart i tre" 2:45.
 */
export function timeOfPhrase(phrase: string): SaidTime | null {
  const w = bare(phrase).split(' ')
  const h = HOURS[w[w.length - 1]]
  if (h === undefined) return null
  const lead = w.slice(0, -1).join(' ')
  const at = (form: ClockForm, delta: number): SaidTime => ({ form, hour: h, minutes: onDial(hourAt(h) + delta) })
  switch (lead) {
    case '': return at('hel', 0)
    case 'halv': return at('halv', -30)
    case 'kvart over': return at('kvartOver', 15)
    case 'kvart i': return at('kvartI', -15)
    default: return null
  }
}

/** "Find uret, der viser klokken halv tre." (choice) · "Stil uret, så klokken er halv tre." (clockSet) → the time asked for. */
export function askedTime(text: string, kind: TaskKind): SaidTime | null {
  const m = kind === 'clockSet' ? /^Stil uret, så klokken er (.+)\.$/.exec(text) : /^Find uret, der viser klokken (.+)\.$/.exec(text)
  return m ? timeOfPhrase(m[1]) : null
}

/** The id formats: hel:<m> (whole hours), halv:<m> (half hours), kvart:<m> (quarter past and to), m = minutes on the dial. */
export const CLOCK_IDS: Readonly<Partial<Record<SkillId, RegExp>>> = {
  clockHour: /^hel:(\d+)$/, clockHalf: /^halv:(\d+)$/, clockQuarter: /^kvart:(\d+)$/,
}

/** The answer and family an id names, or null when the id is not a time of the skill. */
export function clockIdOracle(skill: SkillId, id: string): { family: string; answer: number } | null {
  const m = CLOCK_IDS[skill]?.exec(id)
  if (!m) return null
  const t = Number(m[1])
  if (!(t >= 0 && t < DIAL)) return null
  const past = t % 60
  if (skill === 'clockHour') return past === 0 ? { family: 'hour', answer: t } : null
  if (skill === 'clockHalf') return past === 30 ? { family: 'half', answer: t } : null
  return past === 15 ? { family: 'quarterPast', answer: t } : past === 45 ? { family: 'quarterTo', answer: t } : null
}

// ─── Hands ──────────────────────────────────────────────────────────────────

/** Degrees clockwise from 12. */
export interface Hands {
  long: number
  short: number
}

/**
 * Where the hands point for a phrase, from what the words mean: the long hand at 12, 3, 6 or 9 for
 * whole, kvart over, halv and kvart i; the short hand on the hour, just past it, midway to it, or
 * nearly at it (a geared clock: the short hand goes 30° an hour).
 */
export function handsOfPhrase(s: SaidTime): Hands {
  const at = (deg: number) => ((deg % 360) + 360) % 360
  const h = s.hour % 12
  switch (s.form) {
    case 'hel': return { long: 0, short: at(30 * h) }
    case 'kvartOver': return { long: 90, short: at(30 * h + 7.5) }
    case 'halv': return { long: 180, short: at(30 * h - 15) }
    case 'kvartI': return { long: 270, short: at(30 * h - 7.5) }
  }
}

/** A geared clock showing `minutes` on the dial (the oracle's own: 0.5° and 6° a minute). */
export const handsAt = (minutes: number): Hands => ({ long: (onDial(minutes) % 60) * 6, short: onDial(minutes) * 0.5 })

export const angleGap = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

/** Two clocks a child can tell apart: one hand at least an hour mark (30°) from where it is on the other. */
export const lookDifferent = (a: Hands, b: Hands): boolean => angleGap(a.long, b.long) >= 30 || angleGap(a.short, b.short) >= 30

/**
 * handsSwapped (pædagogik §3.2, 3:00 → 12:15): the clock whose long hand stands where the answer's short
 * hand stands (to the nearest minute mark) and whose short hand stands where the answer's long hand
 * stands (within half an hour mark, as a geared short hand can), and which looks different from the answer.
 */
export function isSwappedClock(answer: number, v: number): boolean {
  const a = handsAt(answer)
  const s = handsAt(v)
  return angleGap(s.long, a.short) <= 3 && angleGap(s.short, a.long) <= 15 && lookDifferent(a, s)
}

/** Misconceptions pædagogik §3.2 and SPEC §4.2 give each clock skill. */
const CLOCK_MIS: Readonly<Partial<Record<SkillId, readonly MisconceptionId[]>>> = {
  clockHour: ['handsSwapped'],
  clockHalf: ['halfPastNext', 'hourHandMisread', 'handsSwapped'],
  clockQuarter: ['quarterDirection', 'hourHandMisread'],
}

/**
 * Where a wrong clock comes from, for "find the clock showing …" and "set the clock to …" (t the asked
 * time, v the clock picked or set; both on the dial):
 *   handsSwapped      the swapped clock (isSwappedClock)
 *   halfPastNext      "halv tre" as "tre og en halv": v = t + 60 (half hours)
 *   hourHandMisread   the short hand read as the next number when it is near it (from :30 on): the clock
 *                     the child reads as t is the one an hour earlier, v = t − 60 (pædagogik "time ±1")
 *   quarterDirection  kvart over and kvart i swapped around the same hour: v = t − 30 (over) / t + 30 (i)
 *   operand           the hour heard, as a whole hour: v = H:00
 */
export function explainClock(skill: SkillId, s: SaidTime, v: number): WhyB {
  const t = s.minutes
  const own = CLOCK_MIS[skill] ?? []
  const is = (x: number) => onDial(x) === onDial(v)
  const mis: MisconceptionId[] = []
  if (own.includes('handsSwapped') && isSwappedClock(t, v)) mis.push('handsSwapped')
  if (own.includes('halfPastNext') && s.form === 'halv' && is(t + 60)) mis.push('halfPastNext')
  if (own.includes('hourHandMisread') && t % 60 >= 30 && is(t - 60)) mis.push('hourHandMisread')
  if (own.includes('quarterDirection') && ((s.form === 'kvartOver' && is(t - 30)) || (s.form === 'kvartI' && is(t + 30)))) mis.push('quarterDirection')
  return { mis, operand: s.form !== 'hel' && is(hourAt(s.hour)) }
}

/** The misconception values the oracle knows for a time (for the diagnostic-card check). */
export function clockMisValues(skill: SkillId, s: SaidTime): number[] {
  const out: number[] = []
  for (let v = 0; v < DIAL; v++) if (v !== s.minutes && explainClock(skill, s, v).mis.length > 0) out.push(v)
  return out
}

/** The values a clockSet task can be answered with: every step of the minute hand, on the dial and once more round. */
export function settable(step: number): number[] {
  const out: number[] = []
  for (let v = 0; v < 2 * DIAL; v += step) out.push(v)
  return out
}

/** The misconceptions a card set shows (classified tags of the wrong cards). */
export const cardMisconceptions = (t: Task): MisconceptionId[] =>
  t.options.flatMap((o) => {
    const tag = classifyAnswer(t, o)
    return tag !== null && isMisconception(tag) ? [tag] : []
  })
