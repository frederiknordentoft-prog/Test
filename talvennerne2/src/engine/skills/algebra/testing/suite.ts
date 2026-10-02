// Test helpers for the algebra and muldiv skills of 1.–2. klasse (SK2-ALG): every skill runs the shared
// contract (number/testing/harness.ts) and this suite — the id format, the candidates' tags against
// formulas worked out again in each test file (never with the skill's own code), the A9 rule,
// production and ceilings per kind, the diagnostic card, and hints that come out the same for a fact
// the round screen rebuilds from its task (id only). Lives in a subfolder so the registry never
// imports it into the app.
import { describe, expect, it } from 'vitest'
import { buildTask } from '../../../tasks'
import { classifyAnswer, digitSwapOf } from '../../../misconceptions'
import { ceilingFor, guessP, isProduction } from '../../../kinds'
import { compile } from '../../../../speech/compile'
import { makeRng } from '../../../rng'
import { SKILL_BY_ID } from '../../../../content/skills'
import { factsUnderTest, skillContract, speechProblems, tasksUnderTest, type ContractOptions } from '../../number/testing/harness'
import { isMisconception } from '../../number/kit'
import type { AnswerValue, ErrorTag, Fact, MisconceptionId, SkillDef, Task, TaskKind } from '../../../types'

/** Why a wrong value could be given: the misconceptions whose formula gives it, and whether it is on the card. */
export interface Explanation {
  mis: MisconceptionId[]
  operand: boolean
}

/** SPEC §4.1 with A9: two misconceptions, or one on a number from the question, are 'ambiguous'. */
export function expectedTag(e: Explanation): ErrorTag | 'plain' {
  const mis = [...new Set(e.mis)]
  if (mis.length > 1) return 'ambiguous'
  if (mis.length === 1) return e.operand ? 'ambiguous' : mis[0]
  return e.operand ? 'operand' : 'plain'
}

/** An Explanation from formula values: each [misconception, value] that hits, and the numbers on the card. */
export function explainBy(value: AnswerValue, answer: AnswerValue, formulas: readonly (readonly [MisconceptionId, AnswerValue | null])[], shown: readonly number[]): Explanation {
  const mis = formulas.filter(([, v]) => v !== null && v === value && v !== answer).map(([m]) => m)
  return { mis, operand: typeof value === 'number' && shown.includes(value) }
}

export interface SuiteOptions extends ContractOptions {
  /** Fact ids: one prefix, the documented format. */
  idFormat: RegExp
  /** Explanation of a wrong value for a fact (numbers for cards and keypad, strings for fillSlots and trueFalse). */
  explain(f: Fact, value: AnswerValue): Explanation
  /** Every value the formulas give for a fact (misconception values and the numbers shown). */
  formulaValues(f: Fact): AnswerValue[]
  /** Highest box a right answer can reach, per kind (SPEC §3.3). */
  ceilings: Partial<Record<TaskKind, 2 | 3 | 5>>
}

/** A value fits a task when it has the answer's type (a set answer takes '|'-joined strings). */
const fitsTask = (t: Task, v: AnswerValue) =>
  typeof t.answer === 'number' ? typeof v === 'number' && v >= 0 : typeof v === 'string' && (t.answerType === 'set' || !v.includes('|'))

export function algebra2Suite(def: SkillDef, opts: SuiteOptions): void {
  skillContract(def, opts)

  describe(`${def.id}: SK2-ALG suite`, () => {
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
        const cands = new Map(def.candidates(f).map((c) => [String(c.value), c]))
        for (const [key, c] of cands) {
          const want = expectedTag(opts.explain(f, c.value))
          const ok = want === 'plain' ? c.tag === 'near' || c.tag === 'other' : c.tag === want
          if (!ok) problems.push(`${f.id} ${key}: ${c.tag}, expected ${want}`)
        }
        for (const v of opts.formulaValues(f)) {
          if (v === f.answer || (typeof v === 'number' && (v < 0 || !Number.isInteger(v)))) continue
          const want = expectedTag(opts.explain(f, v))
          if (want === 'plain') continue
          if (cands.get(String(v))?.tag !== want) problems.push(`${f.id} ${String(v)}: ${String(cands.get(String(v))?.tag)}, expected ${want}`)
        }
      }
      expect(problems.slice(0, 10)).toEqual([])
    })

    it('classifies given misconception values as their tag on every kind, the ambiguous ones never as evidence', () => {
      const problems: string[] = []
      for (const { fact, task } of tasks) {
        for (const v of opts.formulaValues(fact)) {
          if (!fitsTask(task, v) || v === task.answer) continue
          const want = expectedTag(opts.explain(fact, v))
          if (want === 'plain') continue
          const got = classifyAnswer(task, v)
          if (got !== want) problems.push(`${fact.id} ${task.kind} ${String(v)}: ${String(got)}, expected ${want}`)
        }
      }
      expect(problems.slice(0, 10)).toEqual([])
    })

    it('has the production kinds of SPEC §2.2 and the ceilings of SPEC §3.3 on every kind', () => {
      const production = SKILL_BY_ID[def.id].production
      const problems: string[] = []
      for (const { fact, kind, task } of tasks) {
        const prod = isProduction(task)
        if (prod !== production.includes(kind)) problems.push(`${fact.id} ${kind}: production ${prod} (guessP ${guessP(task)})`)
        if (ceilingFor(task) !== opts.ceilings[kind]) problems.push(`${fact.id} ${kind}: ceiling ${ceilingFor(task)}, expected ${opts.ceilings[kind]}`)
      }
      expect(problems.slice(0, 10)).toEqual([])
      expect(Object.keys(opts.ceilings).sort()).toEqual([...def.kinds].sort())
    })

    it('deals one diagnostic card whenever a misconception value fits the card range', () => {
      const problems: string[] = []
      for (const { fact, task } of tasks) {
        if (task.kind !== 'choice') continue
        const diagnostic = (v: AnswerValue) => isMisconception(expectedTag(opts.explain(fact, v)) as ErrorTag)
        const fits = opts.formulaValues(fact).filter((v) => typeof v === 'number' && v !== task.answer && v >= task.range[0] && v <= task.range[1] && diagnostic(v))
        const dealt = task.options.filter((o) => o !== task.answer && diagnostic(o))
        if (fits.length > 0 && dealt.length !== 1) problems.push(`${fact.id}: cards [${task.options.join(', ')}] (could show ${fits.join(', ')})`)
        if (new Set(task.options.map(String)).size !== task.options.length) problems.push(`${fact.id}: repeated card`)
      }
      expect(problems.slice(0, 10)).toEqual([])
    })

    it('aims the diagnostic card at each of its misconceptions in turn', () => {
      const tags = new Set<MisconceptionId>()
      for (const f of facts) for (const c of def.candidates(f)) if (isMisconception(c.tag)) tags.add(c.tag)
      for (const target of tags) {
        const f = facts.find((x) => def.candidates(x).some((c) => {
          if (c.tag !== target || typeof c.value !== 'number') return false
          const [lo, hi] = def.range(x, 'choice')
          return c.value >= lo && c.value <= hi
        }))
        if (!f || !def.kinds.includes('choice')) continue
        const t = buildTask(def, f, 'choice', makeRng(3), 0, { target: [target] }).task
        expect(Object.entries(t.distractorTags).some(([k, tag]) => tag === target && t.options.map(String).includes(k)), `${f.id} ${target}`).toBe(true)
      }
    })

    it('builds the same hint from a fact the round screen rebuilds from its task (id only)', () => {
      const problems: string[] = []
      for (const [i, { fact, kind, task }] of tasks.entries()) {
        if (i % 3 !== 0) continue
        const rebuilt: Fact = { id: task.factId, skill: task.skill, family: task.family, operands: [], answer: task.answer, rank: 0 }
        for (const tag of [null, ...new Set(Object.values(task.distractorTags))]) {
          const want = def.hint(fact, tag, kind)
          const got = def.hint(rebuilt, tag, kind)
          if (compile(got.speech).text !== compile(want.speech).text || JSON.stringify(got.visual) !== JSON.stringify(want.visual)) {
            problems.push(`${fact.id} ${kind} ${String(tag)}`)
          }
        }
      }
      expect(problems.slice(0, 10)).toEqual([])
    })

    it('speaks the hint for every kind and every tag a task can meet, with recorded clips and no digits', () => {
      const problems = new Set<string>()
      for (const [i, { fact, kind, task }] of tasks.entries()) {
        if (i % 2 !== 0) continue
        const swapped = typeof task.answer === 'number' && task.kind === 'keypad' ? digitSwapOf(task.answer) : null
        const tags: (ErrorTag | null)[] = [null, 'near', 'operand', 'other', 'ambiguous', ...new Set(Object.values(task.distractorTags))]
        if (swapped !== null && classifyAnswer(task, swapped) === 'digitSwap') tags.push('digitSwap')
        for (const tag of tags) {
          const h = def.hint(fact, tag, kind)
          for (const p of speechProblems(h.speech)) problems.add(`${fact.id} ${kind} ${String(tag)}: ${p}`)
          if (h.misconception && h.misconception !== tag) problems.add(`${fact.id} ${kind}: hint for ${h.misconception} on ${String(tag)}`)
          if (isMisconception(tag) && tag !== 'digitSwap' && h.misconception !== tag) problems.add(`${fact.id} ${kind}: no specific hint for ${tag}`)
        }
      }
      expect([...problems].slice(0, 10)).toEqual([])
    })
  })
}

/** A fact by id: a canonical one, or an instance drawn until it turns up. */
export function findFact(def: SkillDef, id: string): Fact {
  const canon = def.enumerate().find((f) => f.id === id)
  if (canon) return canon
  for (const fam of def.families) {
    const rng = makeRng(7)
    for (let i = 0; i < 40000 && def.instance; i++) {
      const f = def.instance(fam, rng, new Set())
      if (f.id === id) return f
    }
  }
  throw new Error(`${def.id}: no instance ${id}`)
}

/** A task of a fact by id. */
export const taskOf = (def: SkillDef, id: string, kind: TaskKind, seed = 1): Task => buildTask(def, findFact(def, id), kind, makeRng(seed), 0).task

/** The spoken text of a task or a hint. */
export const textOf = (t: Pick<Task, 'speech'>): string => compile(t.speech).text
export const hintText = (def: SkillDef, id: string, tag: ErrorTag | null, kind?: TaskKind): string =>
  compile(def.hint(findFact(def, id), tag, kind).speech).text
