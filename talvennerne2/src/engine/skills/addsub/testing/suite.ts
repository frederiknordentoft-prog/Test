// Test helpers for the plus and minus skills of 1.–2. klasse. The misconception formulas of pædagogik
// §3.2 are worked out again here on digit strings — not with calc.ts — and every skill runs the same
// suite: the shared contract (number/testing/harness.ts), the id format, the A9 rule, production and
// ceilings per kind, and the diagnostic card. Lives in a subfolder so the registry never imports it.
import { describe, expect, it } from 'vitest'
import { buildTask } from '../../../tasks'
import { classifyAnswer, digitSwapOf } from '../../../misconceptions'
import { ceilingFor, guessP, isProduction } from '../../../kinds'
import { compile } from '../../../../speech/compile'
import { makeRng } from '../../../rng'
import { SKILL_BY_ID } from '../../../../content/skills'
import { factsUnderTest, skillContract, tasksUnderTest, type ContractOptions } from '../../number/testing/harness'
import type { ErrorTag, Fact, MisconceptionId, SkillDef, Task, TaskKind } from '../../../types'

// ─── Independent formulas (digit strings) ───────────────────────────────────

const pad = (a: number, b: number): [string, string] => {
  const w = Math.max(String(a).length, String(b).length)
  return [String(a).padStart(w, '0'), String(b).padStart(w, '0')]
}

/** Per column |x − y|. */
export function sfl(a: number, b: number): number {
  const [x, y] = pad(a, b)
  return Number([...x].map((c, i) => String(Math.abs(Number(c) - Number(y[i])))).join(''))
}

/** Each column on its own, a borrowed ten never taken from the next column. */
export function bnd(a: number, b: number): number {
  const [x, y] = pad(a, b)
  return Number([...x].map((c, i) => String((Number(c) - Number(y[i]) + 10) % 10)).join(''))
}

/** "100 − 37 → 73": the digits of TO each made up to ten. */
export function dc10(a: number, b: number): number | null {
  const s = String(b)
  if (a !== 100 || s.length !== 2 || s[1] === '0') return null
  return Number(`${10 - Number(s[0])}${10 - Number(s[1])}`)
}

export interface Explanation {
  mis: MisconceptionId[]
  operand: boolean
}

export type Sign = '+' | '−'

/** The numbers of a fact id `<prefix>:<a>+<b>` / `<prefix>:<a>-<b>` (or dbl:a / hlf:n). */
export function idSum(id: string): { prefix: string; a: number; op: Sign; b: number } {
  const m = /^([a-z0-9]+):(\d+)([+-])(\d+)$/.exec(id)
  if (!m) throw new Error(`not a sum id: ${id}`)
  return { prefix: m[1], a: Number(m[2]), op: m[3] === '+' ? '+' : '−', b: Number(m[4]) }
}

/**
 * What explains a wrong value for a sum or difference, by the skill's catalogue entries (pædagogik
 * §3.2, SPEC §4.2) and the extensions the modules document (tensZero for whole tens and hundreds).
 */
export function explainSum(skill: string, family: string, a: number, op: Sign, b: number, value: number): Explanation {
  const answer = op === '+' ? a + b : a - b
  const mis: MisconceptionId[] = []
  const add = (id: MisconceptionId, v: number | null) => {
    if (v !== null && v === value && v !== answer) mis.push(id)
  }
  add('wrongOperation', op === '+' ? Math.abs(a - b) : a + b)
  if (skill === 'addTo20') {
    add('countFromFirst', answer - 1)
    add('forgotCarry', answer - 10)
  }
  if (skill === 'subTo20') {
    add('countFromFirst', answer + 1)
    add('smallerFromLarger', sfl(a, b))
    add('borrowNoDecrement', bnd(a, b))
  }
  if (skill === 'add100NoCarry' && b < 10) add('placeMisalign', a + 10 * b)
  if (skill === 'add100Carry') {
    if ((a % 10) + (b % 10) >= 10) add('forgotCarry', answer - 10)
    if (b < 10) add('placeMisalign', a + 10 * b)
  }
  if (skill === 'sub100Borrow') {
    add('smallerFromLarger', sfl(a, b))
    add('borrowNoDecrement', bnd(a, b))
    if (family === 'fromTen') add('digitComplement10', dc10(a, b))
  }
  if (skill === 'tens100' || (skill === 'addSub1000Round' && answer % 10 === 0)) {
    add('tensZero', answer / 10)
    add('tensZero', answer * 10)
  }
  if (skill === 'addSub1000Round' && family === 'HTplusTcarry') add('forgotCarry', answer - 100)
  return { mis: [...new Set(mis)], operand: value === a || value === b }
}

/** SPEC §4.1 with A9: two misconceptions, or one on a number from the question, are 'ambiguous'. */
export function expectedTag(e: Explanation): ErrorTag | 'plain' {
  if (e.mis.length > 1) return 'ambiguous'
  if (e.mis.length === 1) return e.operand ? 'ambiguous' : e.mis[0]
  return e.operand ? 'operand' : 'plain'
}

// ─── The suite ──────────────────────────────────────────────────────────────

export interface SuiteOptions extends ContractOptions {
  /** Fact ids: one prefix, the CONVENTIONS format. */
  idFormat: RegExp
  /** Explanation of a wrong value for a fact. */
  explain(f: Fact, value: number): Explanation
  /** Every value the formulas give for a fact (misconception values and the operands). */
  formulaValues(f: Fact): number[]
  /** Highest box a right answer can reach, per kind (SPEC §3.3). */
  ceilings: Partial<Record<TaskKind, 2 | 3 | 5>>
  /** Typed answers can come out as digitSwap (an answer of 13 or more with two different digits). */
  swaps: boolean
}

export function addsub2Suite(def: SkillDef, opts: SuiteOptions): void {
  skillContract(def, opts)

  describe(`${def.id}: plus and minus of 1.–2. klasse`, () => {
    const facts = factsUnderTest(def)
    const tasks = tasksUnderTest(def)

    it('names every fact in the documented format, with one prefix', () => {
      const prefixes = new Set<string>()
      for (const f of facts) {
        expect(f.id, f.id).toMatch(opts.idFormat)
        prefixes.add(f.id.slice(0, f.id.indexOf(':')))
      }
      expect(prefixes.size).toBe(1)
    })

    it('tags every candidate as the independent formulas explain it (SPEC §4.1, A9)', () => {
      const problems: string[] = []
      for (const f of facts) {
        const answer = f.answer as number
        const cands = new Map(def.candidates(f).map((c) => [String(c.value), c.tag]))
        for (const [key, tag] of cands) {
          const want = expectedTag(opts.explain(f, Number(key)))
          const ok = want === 'plain' ? tag === 'near' || tag === 'other' : tag === want
          if (!ok) problems.push(`${f.id} ${key}: ${tag}, expected ${want}`)
        }
        // every formula value is a candidate (or the answer itself, or negative)
        for (const v of opts.formulaValues(f)) {
          if (v === answer || v < 0 || !Number.isInteger(v)) continue
          const want = expectedTag(opts.explain(f, v))
          if (want === 'plain') continue
          if (cands.get(String(v)) !== want) problems.push(`${f.id} ${v}: ${String(cands.get(String(v)))}, expected ${want}`)
        }
      }
      expect(problems.slice(0, 10)).toEqual([])
    })

    it('classifies typed misconception values as their tag, and the ambiguous ones never as evidence', () => {
      const problems: string[] = []
      for (const { fact, task } of tasks) {
        if (task.kind !== 'keypad') continue
        for (const v of opts.formulaValues(fact)) {
          if (v === task.answer || v < 0) continue
          const want = expectedTag(opts.explain(fact, v))
          if (want === 'plain') continue
          const got = classifyAnswer(task, v)
          if (got !== want) problems.push(`${fact.id} ${v}: ${String(got)}, expected ${want}`)
        }
      }
      expect(problems.slice(0, 10)).toEqual([])
    })

    it('has SPEC §2.2 production kinds and the ceilings of SPEC §3.3 on every kind', () => {
      const production = SKILL_BY_ID[def.id].production
      const problems: string[] = []
      for (const { fact, kind, task } of tasks) {
        const prod = isProduction(task)
        if (prod !== production.includes(kind)) problems.push(`${fact.id} ${kind}: production ${prod} (guessP ${guessP(task)})`)
        const want = opts.ceilings[kind]
        if (ceilingFor(task) !== want) problems.push(`${fact.id} ${kind}: ceiling ${ceilingFor(task)}, expected ${want}`)
      }
      expect(problems.slice(0, 10)).toEqual([])
      expect(Object.keys(opts.ceilings).sort()).toEqual([...def.kinds].sort())
    })

    it('deals a diagnostic card whenever a misconception value fits the card range', () => {
      const problems: string[] = []
      for (const { fact, task } of tasks) {
        if (task.kind !== 'choice') continue
        const diagnostic = (v: number) => {
          const t = expectedTag(opts.explain(fact, v))
          return t !== 'plain' && t !== 'operand' && t !== 'ambiguous'
        }
        const fits = opts.formulaValues(fact).filter((v) => v !== task.answer && v >= task.range[0] && v <= task.range[1] && diagnostic(v))
        const dealt = task.options.filter((o) => typeof o === 'number' && o !== task.answer && diagnostic(o))
        if (fits.length > 0 && dealt.length !== 1) problems.push(`${fact.id}: cards [${task.options}] (could show ${fits})`)
      }
      expect(problems.slice(0, 10)).toEqual([])
    })

    it('aims the diagnostic card at each of its misconceptions in turn', () => {
      const tags = new Set<MisconceptionId>()
      for (const f of facts) for (const c of def.candidates(f)) if (isMis(c.tag)) tags.add(c.tag)
      for (const target of tags) {
        const f = facts.find((x) => def.candidates(x).some((c) => c.tag === target && typeof c.value === 'number' && inRange(def, x, c.value as number)))
        if (!f) continue
        const t = buildTask(def, f, 'choice', makeRng(3), 0, { target: [target] }).task
        expect(Object.entries(t.distractorTags).some(([k, tag]) => tag === target && t.options.map(String).includes(k)), `${f.id} ${target}`).toBe(true)
      }
    })

    it('meets a swapped typed answer with the tens-first hint (digitSwap, SPEC §4.1)', () => {
      let seen = 0
      for (const { fact, task } of tasks) {
        if (task.kind !== 'keypad' || typeof task.answer !== 'number') continue
        const swapped = digitSwapOf(task.answer)
        if (swapped === null || classifyAnswer(task, swapped) !== 'digitSwap') continue
        seen++
        const h = def.hint(fact, 'digitSwap', 'keypad')
        expect(h.misconception, fact.id).toBe('digitSwap')
        expect(compile(h.speech).missing, fact.id).toEqual([])
        expect(compile(h.speech).text, fact.id).toMatch(/^Vi skriver tierne først og så enerne\. Svaret er /)
      }
      expect(seen > 0).toBe(opts.swaps)
    })

    it('reads every question and hint without a missing clip', () => {
      const missing = new Set<string>()
      for (const { task } of tasks.slice(0, 400)) for (const m of compile(task.speech).missing) missing.add(m)
      expect([...missing]).toEqual([])
    })
  })
}

const MIS = new Set<string>([
  'forgotCarry', 'smallerFromLarger', 'borrowNoDecrement', 'placeMisalign', 'wrongOperation', 'countFromFirst', 'tensZero',
  'digitComplement10',
])
const isMis = (tag: ErrorTag): tag is MisconceptionId => MIS.has(tag)
const inRange = (def: SkillDef, f: Fact, v: number) => {
  const [lo, hi] = def.range(f, 'choice')
  return v >= lo && v <= hi
}

/** A fact by id: a canonical one, or an instance drawn until it turns up. */
export function findFact(def: SkillDef, id: string): Fact {
  const canon = def.enumerate().find((f) => f.id === id)
  if (canon) return canon
  for (const fam of def.families) {
    const rng = makeRng(7)
    for (let i = 0; i < 6000; i++) {
      const f = def.instance!(fam, rng, new Set())
      if (f.id === id) return f
    }
  }
  throw new Error(`${def.id}: no instance ${id}`)
}

/** The spoken text of a hint. */
export const hintText = (def: SkillDef, id: string, tag: ErrorTag | null): string => compile(def.hint(findFact(def, id), tag).speech).text

/** The tag of a candidate value. */
export const tagOf = (def: SkillDef, id: string, v: number): ErrorTag | undefined => def.candidates(findFact(def, id)).find((c) => c.value === v)?.tag

/** The spoken text of a task. */
export const textOf = (t: Task): string => compile(t.speech).text
