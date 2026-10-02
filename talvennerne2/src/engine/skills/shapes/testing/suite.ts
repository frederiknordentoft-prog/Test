// Test helpers for the shapes and fraction skills of 1.–2. klasse (SK2-GEO). The contract of
// number/testing/harness.ts, run over every fact (procedure: the canonical facts plus 200 seeded
// instances per family) and every kind, with what these skills add: answers worked out again in each
// test file (never with the skill's own code), the hierarchy rule (no card that is also right, every
// member in a "tryk på alle" answer), the perceptual contrast of sortShapes and halfShape, production and
// ceilings per kind (SPEC §3.3), A9, and hints that come out the same for a fact the round screen
// rebuilds from its task (id only). Lives in a subfolder so the registry never imports it.
import { describe, expect, it } from 'vitest'
import { SKILL_BY_ID } from '../../../../content/skills'
import { classifyAnswer } from '../../../misconceptions'
import { isCorrect } from '../../../answer'
import { ceilingFor, guessP, isProduction } from '../../../kinds'
import { registeredSkills, validateSkill } from '../../../registry'
import { compile } from '../../../../speech/compile'
import { hasClip } from '../../../../speech/catalog'
import { factsUnderTest, speechProblems, tasksUnderTest } from '../../number/testing/harness'
import { isMisconception } from '../../number/kit'
import type { AnswerValue, ErrorTag, Fact, MisconceptionId, SkillDef, Task, TaskKind } from '../../../types'

export interface GeoOptions {
  /** Facts per family from enumerate(): recall exactly, procedure the canonical facts. */
  families: Readonly<Record<string, number>>
  /** Fact ids: one prefix, the documented format. */
  idFormat: RegExp
  /** The answer, computed without the skill's own code. */
  answerOf(fact: Fact, kind: TaskKind, task: Task): AnswerValue
  /** Is an option right for the task, by the test's own reading (the hierarchy, the property …)? */
  isRight?(fact: Fact, task: Task, option: AnswerValue): boolean
  /** Highest box a right answer can reach, per kind (SPEC §3.3). */
  ceilings: Partial<Record<TaskKind, 2 | 3 | 5>>
  /** The perceptual misconception the skill's contrast items test, if any. */
  perceptual?: MisconceptionId
}

const PLAIN_TAGS: readonly (ErrorTag | null)[] = [null, 'near', 'operand', 'other', 'ambiguous']

export function geoSuite(def: SkillDef, opts: GeoOptions): void {
  describe(`${def.id}: contract (SK2-GEO)`, () => {
    const facts = factsUnderTest(def)
    const tasks = tasksUnderTest(def)

    it('agrees with SKILL_BY_ID, is registered and has its Kan-bog line', () => {
      expect(validateSkill(def)).toEqual([])
      expect(registeredSkills().find((d) => d.id === def.id)).toBe(def)
      expect(hasClip(def.canDo), def.canDo).toBe(true)
      expect(compile([{ clip: def.canDo }]).text).toMatch(/^Jeg (kan|kender) /)
    })

    it('enumerates the expected facts with unique ids in the documented format', () => {
      const counts: Record<string, number> = {}
      for (const f of def.enumerate()) counts[f.family] = (counts[f.family] ?? 0) + 1
      expect(counts).toEqual(opts.families)
      expect(new Set(def.enumerate().map((f) => f.id)).size).toBe(def.enumerate().length)
      const prefixes = new Set<string>()
      for (const f of facts) {
        expect(f.id, f.id).toMatch(opts.idFormat)
        expect(f.skill).toBe(def.id)
        expect(def.families.map((x) => x.id)).toContain(f.family)
        prefixes.add(f.id.slice(0, f.id.indexOf(':')))
      }
      expect(prefixes.size).toBe(1)
    })

    it('gives each instance id one meaning (same id, same fact)', () => {
      const seen = new Map<string, string>()
      for (const f of facts) {
        const key = JSON.stringify([f.family, f.operands, f.answer, f.data ?? null])
        expect(seen.get(f.id) ?? key, f.id).toBe(key)
        seen.set(f.id, key)
      }
    })

    it('answers right, by an independent computation', () => {
      const problems: string[] = []
      for (const { fact, kind, task } of tasks) {
        if (!isCorrect(task, task.answer)) problems.push(`${fact.id} ${kind}: own answer wrong`)
        const want = opts.answerOf(fact, kind, task)
        if (JSON.stringify(task.answer) !== JSON.stringify(want)) problems.push(`${fact.id} ${kind}: ${String(task.answer)}, expected ${String(want)}`)
      }
      expect(problems.slice(0, 10)).toEqual([])
    })

    it('has one tag per candidate value, never the answer itself', () => {
      for (const f of facts) {
        const keys = def.candidates(f).map((c) => String(c.value))
        expect(new Set(keys).size, f.id).toBe(keys.length)
        for (const c of def.candidates(f)) expect(c.value, f.id).not.toEqual(f.answer)
      }
    })

    it('classifies every candidate as its own tag on every kind (SPEC §4.1, A9)', () => {
      const problems: string[] = []
      for (const { fact, task } of tasks) {
        for (const c of def.candidates(fact)) {
          const key = String(c.value)
          if (!(key in task.distractorTags)) continue
          if (task.distractorTags[key] !== c.tag) problems.push(`${fact.id} ${task.kind} ${key}: dealt as ${task.distractorTags[key]}`)
          if (classifyAnswer(task, c.value) !== c.tag) problems.push(`${fact.id} ${task.kind} ${key}: classified ${String(classifyAnswer(task, c.value))}`)
          // A9: a misconception value that is also a number from the question is never evidence
          if (isMisconception(c.tag) && typeof c.value === 'number' && fact.operands.includes(c.value)) problems.push(`${fact.id}: ${key} is an operand`)
        }
      }
      expect(problems.slice(0, 10)).toEqual([])
    })

    it('deals three unique cards with one right answer, and never a card that is also right', () => {
      const problems: string[] = []
      for (const { fact, task } of tasks) {
        if (task.kind !== 'choice') continue
        const where = `${fact.id} ${task.kind} [${task.options.join(', ')}]`
        if (task.options.length !== 3) problems.push(`${where}: ${task.options.length} cards`)
        if (new Set(task.options.map(String)).size !== task.options.length) problems.push(`${where}: repeated card`)
        if (task.options.filter((o) => isCorrect(task, o)).length !== 1) problems.push(`${where}: not one right card`)
        for (const o of task.options) {
          if (o === task.answer) continue
          if (task.distractorTags[String(o)] === undefined) problems.push(`${where}: untagged ${String(o)}`)
          if (opts.isRight?.(fact, task, o)) problems.push(`${where}: ${String(o)} is also right`)
        }
      }
      expect(problems.slice(0, 10)).toEqual([])
    })

    it('puts every member, and only members, in a "tryk på alle" answer (≥ 5 things, ≥ 2 right, ≥ 2 wrong)', () => {
      const problems: string[] = []
      for (const { fact, task } of tasks) {
        if (task.kind !== 'multiSelect') continue
        const parts = String(task.answer).split('|')
        const where = `${fact.id}`
        if (task.options.length < 5 || parts.length < 2 || task.options.length - parts.length < 2) problems.push(`${where}: ${task.options.length} options, ${parts.length} right`)
        if (new Set(task.options.map(String)).size !== task.options.length) problems.push(`${where}: repeated option`)
        for (const o of task.options) {
          const member = parts.includes(String(o))
          if (opts.isRight && opts.isRight(fact, task, o) !== member) problems.push(`${where}: ${String(o)} member ${member}`)
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

    it('speaks every task with recorded clips and no digits', () => {
      const problems = new Set<string>()
      for (const { fact, kind, task } of tasks) for (const p of speechProblems(task.speech)) problems.add(`${fact.id} ${kind}: ${p}`)
      expect([...problems].slice(0, 10)).toEqual([])
    })

    it('has a spoken strategy for every tag a task can meet, the specific one for a misconception', () => {
      const problems = new Set<string>()
      for (const [i, { fact, kind, task }] of tasks.entries()) {
        if (i % 2 !== 0) continue
        for (const tag of new Set<ErrorTag | null>([...PLAIN_TAGS, ...Object.values(task.distractorTags)])) {
          const h = def.hint(fact, tag, kind)
          for (const p of speechProblems(h.speech)) problems.add(`${fact.id} ${kind} ${String(tag)}: ${p}`)
          if (!h.visual || typeof h.visual.scene !== 'string') problems.add(`${fact.id}: no visual`)
          if (h.misconception && h.misconception !== tag) problems.add(`${fact.id} ${kind}: hint for ${h.misconception} on ${String(tag)}`)
          if (isMisconception(tag) && h.misconception !== tag) problems.add(`${fact.id} ${kind}: no specific hint for ${tag}`)
        }
      }
      expect([...problems].slice(0, 10)).toEqual([])
    })

    it('builds the same hint from a fact the round screen rebuilds from its task (id only)', () => {
      const problems: string[] = []
      for (const [i, { fact, kind, task }] of tasks.entries()) {
        if (i % 3 !== 0) continue
        const rebuilt: Fact = { id: task.factId, skill: task.skill, family: task.family, operands: [], answer: task.answer, rank: 0 }
        for (const tag of [null, ...new Set(Object.values(task.distractorTags))]) {
          const want = def.hint(fact, tag, kind)
          const got = def.hint(rebuilt, tag, kind)
          if (compile(got.speech).text !== compile(want.speech).text || JSON.stringify(got.visual) !== JSON.stringify(want.visual)) problems.push(`${fact.id} ${kind} ${String(tag)}`)
        }
      }
      expect(problems.slice(0, 10)).toEqual([])
    })

    it('marks contrast only for its perceptual misconception, with both kinds of items', () => {
      const seen = new Set<string>()
      for (const { fact, task } of tasks) {
        if (task.contrast === undefined) continue
        expect(opts.perceptual, fact.id).toBeDefined()
        seen.add(task.contrast)
      }
      if (opts.perceptual) expect(seen).toEqual(new Set(['conflict', 'congruent']))
    })
  })
}

/** A task of a fact by id. */
export function factById(def: SkillDef, id: string): Fact {
  const f = factsUnderTest(def, 20).find((x) => x.id === id) ?? def.enumerate().find((x) => x.id === id)
  if (!f) throw new Error(`${def.id}: no fact ${id}`)
  return f
}

export const textOf = (t: Pick<Task, 'speech'>): string => compile(t.speech).text
