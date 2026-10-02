// The shared skill contract (number/testing/harness.ts skillContract) for a perceptual skill of SK2-MEAS
// (weightCompare). The harness only lets compareLength and shapes2D mark contrast; this copy takes the
// perceptual skills from PERCEPTUAL_BY_SKILL (src/engine/misconceptions.ts) and otherwise runs the same
// checks, plus the id format, production and ceilings per kind and hints rebuilt from the id (as
// algebra/testing/suite.ts). Lives in a subfolder so the registry never imports it.
import { describe, expect, it } from 'vitest'
import { SKILL_BY_ID } from '../../../../content/skills'
import { classifyAnswer, PERCEPTUAL_BY_SKILL } from '../../../misconceptions'
import { isCorrect } from '../../../answer'
import { ceilingFor, guessP, isProduction } from '../../../kinds'
import { registeredSkills, validateSkill } from '../../../registry'
import { compile } from '../../../../speech/compile'
import { hasClip } from '../../../../speech/catalog'
import { factsUnderTest, speechProblems, tasksUnderTest } from '../../number/testing/harness'
import { isMisconception } from '../../number/kit'
import type { AnswerValue, ErrorTag, Fact, SkillDef, Task, TaskKind } from '../../../types'

export interface PerceptualOptions {
  families: Readonly<Record<string, number>>
  idFormat: RegExp
  /** The answer, computed without the skill's own code. */
  answerOf(fact: Fact, kind: TaskKind, task: Task): AnswerValue
  ceilings: Partial<Record<TaskKind, 2 | 3 | 5>>
}

export function perceptualContract(def: SkillDef, opts: PerceptualOptions): void {
  describe(`${def.id}: contract (perceptual)`, () => {
    const facts = factsUnderTest(def)
    const tasks = tasksUnderTest(def)

    it('agrees with SKILL_BY_ID, is registered and names its facts in one format', () => {
      expect(validateSkill(def)).toEqual([])
      expect(registeredSkills().find((d) => d.id === def.id)).toBe(def)
      expect(hasClip(def.canDo), def.canDo).toBe(true)
      expect(compile([{ clip: def.canDo }]).text).toMatch(/^Jeg (kan|kender) /)
      const counts: Record<string, number> = {}
      for (const f of def.enumerate()) counts[f.family] = (counts[f.family] ?? 0) + 1
      expect(counts).toEqual(opts.families)
      expect(new Set(facts.map((f) => f.id)).size).toBe(facts.length)
      for (const f of facts) expect(f.id).toMatch(opts.idFormat)
    })

    it('answers right, by an independent computation', () => {
      for (const { fact, kind, task } of tasks) {
        expect(isCorrect(task, task.answer)).toBe(true)
        expect(task.answer, `${fact.id} ${kind}`).toEqual(opts.answerOf(fact, kind, task))
      }
    })

    it('has one tag per candidate value, never the answer, and classifies each as its tag on every kind', () => {
      for (const f of facts) {
        const keys = def.candidates(f).map((c) => String(c.value))
        expect(new Set(keys).size, f.id).toBe(keys.length)
        for (const c of def.candidates(f)) expect(c.value, f.id).not.toEqual(f.answer)
      }
      for (const { fact, task } of tasks) {
        for (const c of def.candidates(fact)) {
          const key = String(c.value)
          if (!(key in task.distractorTags) || c.value === task.answer) continue
          expect(classifyAnswer(task, c.value), `${fact.id} ${task.kind} ${key}`).toBe(c.tag)
        }
      }
    })

    it('deals three valid cards and multiSelect options that fit the answer', () => {
      for (const { fact, task } of tasks) {
        const where = `${fact.id} ${task.kind}`
        if (task.kind === 'choice') {
          expect(task.options, where).toHaveLength(3)
          expect(new Set(task.options.map(String)).size, where).toBe(3)
          expect(task.options.filter((o) => isCorrect(task, o)), where).toEqual([task.answer])
          for (const o of task.options) if (o !== task.answer) expect(task.distractorTags[String(o)], where).toBeDefined()
        }
        if (task.kind === 'multiSelect') {
          const parts = String(task.answer).split('|')
          expect(task.options.length, where).toBeGreaterThanOrEqual(5)
          for (const p of parts) expect(task.options.map(String), where).toContain(p)
          expect([...parts].sort().join('|'), where).toBe(task.answer)
          expect(parts.length, where).toBeGreaterThanOrEqual(2)
          expect(task.options.length - parts.length, where).toBeGreaterThanOrEqual(2)
        }
      }
    })

    it('has the production kinds of SPEC §2.2 and the ceilings of SPEC §3.3 on every kind', () => {
      const production = SKILL_BY_ID[def.id].production
      for (const { fact, kind, task } of tasks) {
        expect(isProduction(task), `${fact.id} ${kind} (guessP ${guessP(task)})`).toBe(production.includes(kind))
        expect(ceilingFor(task), `${fact.id} ${kind}`).toBe(opts.ceilings[kind])
      }
      expect(Object.keys(opts.ceilings).sort()).toEqual([...def.kinds].sort())
    })

    it('marks contrast on every task, as the skill\'s own perceptual misconception (SPEC §4.3)', () => {
      expect(PERCEPTUAL_BY_SKILL[def.id]).toBeDefined()
      for (const { fact, task } of tasks) expect(['conflict', 'congruent'], fact.id).toContain(task.contrast)
    })

    it('speaks every task and every hint with recorded clips and no digits, the specific hint for its misconception', () => {
      const problems = new Set<string>()
      for (const { fact, kind, task } of tasks) {
        for (const p of speechProblems(task.speech)) problems.add(`${fact.id} ${kind}: ${p}`)
        const tags: (ErrorTag | null)[] = [null, 'near', 'operand', 'other', 'ambiguous', ...new Set(Object.values(task.distractorTags))]
        for (const tag of tags) {
          const h = def.hint(fact, tag, kind)
          for (const p of speechProblems(h.speech)) problems.add(`${fact.id} ${kind} ${String(tag)}: ${p}`)
          if (!h.visual || typeof h.visual.scene !== 'string') problems.add(`${fact.id}: no visual`)
          if ((h.misconception ?? null) !== (isMisconception(tag) ? tag : null)) problems.add(`${fact.id} ${kind}: hint ${String(h.misconception)} on ${String(tag)}`)
        }
      }
      expect([...problems].slice(0, 10)).toEqual([])
    })

    it('builds the same hint from a fact the round screen rebuilds from its task (id only)', () => {
      for (const { fact, kind, task } of tasks) {
        const rebuilt: Fact = { id: task.factId, skill: task.skill, family: task.family, operands: [], answer: task.answer, rank: 0 }
        for (const tag of [null, ...new Set(Object.values(task.distractorTags))]) {
          expect(def.hint(rebuilt, tag, kind), `${fact.id} ${kind} ${String(tag)}`).toEqual(def.hint(fact, tag, kind))
        }
      }
    })
  })
}
