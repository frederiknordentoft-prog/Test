// Test harness for the 0. klasse skills: the contract every skill keeps (SPEC §15.1), run through the
// real task builder over all facts (procedure: the canonical facts plus 200 seeded instances per
// family) and every kind. Domain tests call skillContract() and add their own independent checks.
// Lives in a subfolder so the registry's skills/*/*.ts glob never imports it into the app.
import { describe, expect, it } from 'vitest'
import { SKILL_BY_ID } from '../../../../content/skills'
import { buildTask } from '../../../tasks'
import { classifyAnswer, detectableOf, flaggedIds, updateMisconceptions, type MisconceptionStates, swapDisambiguated } from '../../../misconceptions'
import { isCorrect } from '../../../answer'
import { isProduction } from '../../../kinds'
import { registeredSkills, validateSkill } from '../../../registry'
import { hashSeed, makeRng } from '../../../rng'
import { compile } from '../../../../speech/compile'
import { hasClip } from '../../../../speech/catalog'
import type { AnswerLogEntry, AnswerValue, ErrorTag, Fact, HintSpec, MisconceptionId, SkillDef, SpeechPart, Task, TaskKind } from '../../../types'
import { isMisconception } from '../kit'

export const INSTANCES_PER_FAMILY = 200

/** Recall: every fact. Procedure: the canonical facts plus 200 seeded instances per family. */
export function factsUnderTest(def: SkillDef, perFamily = INSTANCES_PER_FAMILY): Fact[] {
  const canon = [...def.enumerate()]
  if (def.mode === 'recall' || !def.instance) return canon
  const rng = makeRng(hashSeed(`sk1:${def.id}`))
  return [...canon, ...def.families.flatMap((fam) => Array.from({ length: perFamily }, () => def.instance!(fam, rng, new Set())))]
}

/** A built task for every fact, kind and a few seeds (recall facts are few, so they get more seeds). */
export function tasksUnderTest(def: SkillDef, seeds = def.mode === 'recall' ? 6 : 1): { fact: Fact; kind: TaskKind; task: Task }[] {
  const out: { fact: Fact; kind: TaskKind; task: Task }[] = []
  for (const [i, fact] of factsUnderTest(def).entries()) {
    for (const kind of def.kinds) {
      for (let s = 0; s < seeds; s++) {
        const rng = makeRng(hashSeed(`${fact.id}|${kind}|${s}|${i}`))
        out.push({ fact, kind, task: buildTask(def, fact, kind, rng, i).task })
      }
    }
  }
  return out
}

/** Problems with a spoken script: unknown clips, digits in the text, nothing said. */
export function speechProblems(parts: readonly SpeechPart[]): string[] {
  const c = compile(parts)
  const out: string[] = []
  if (c.missing.length > 0) out.push(`missing clips ${c.missing.join(', ')}`)
  if (/\d/.test(c.text)) out.push(`digits in "${c.text}"`)
  if (c.text.trim() === '') out.push('empty text')
  if (parts.some((p) => 'free' in p)) out.push('free text (unrecorded) in a skill script')
  return out
}

const PLAIN_TAGS: readonly (ErrorTag | null)[] = [null, 'near', 'operand', 'other', 'ambiguous']

export interface ContractOptions {
  /** Expected facts per family from enumerate(): recall exactly, procedure the canonical facts. */
  families: Readonly<Record<string, number>>
  /** The answer, computed without the skill's own generator. Return undefined to skip a kind. */
  answerOf?(fact: Fact, kind: TaskKind, task: Task): AnswerValue | undefined
}

export function skillContract(def: SkillDef, opts: ContractOptions): void {
  describe(`${def.id}: contract`, () => {
    const facts = factsUnderTest(def)
    const tasks = tasksUnderTest(def)

    it('agrees with SKILL_BY_ID and is registered', () => {
      expect(validateSkill(def)).toEqual([])
      expect(registeredSkills().find((d) => d.id === def.id)).toBe(def)
      expect(hasClip(def.canDo), def.canDo).toBe(true)
      expect(compile([{ clip: def.canDo }]).text).toMatch(/^Jeg (kan|kender) /)
    })

    it('enumerates the expected facts with unique ids', () => {
      const canon = def.enumerate()
      const counts: Record<string, number> = {}
      for (const f of canon) counts[f.family] = (counts[f.family] ?? 0) + 1
      expect(counts).toEqual(opts.families)
      expect(new Set(canon.map((f) => f.id)).size).toBe(canon.length)
      for (const f of facts) {
        expect(f.skill).toBe(def.id)
        expect(def.families.map((fam) => fam.id)).toContain(f.family)
        expect(f.operands.every((o) => Number.isInteger(o) && o >= 0), f.id).toBe(true)
      }
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
      for (const { fact, kind, task } of tasks) {
        expect(isCorrect(task, task.answer)).toBe(true)
        const want = opts.answerOf?.(fact, kind, task)
        if (want !== undefined) expect(task.answer, `${fact.id} ${kind}`).toEqual(want)
      }
    })

    it('has one tag per candidate value, never the answer itself', () => {
      for (const f of facts) {
        const cands = def.candidates(f)
        const keys = cands.map((c) => String(c.value))
        expect(new Set(keys).size, f.id).toBe(keys.length)
        for (const c of cands) {
          expect(c.value, f.id).not.toEqual(f.answer)
          if (typeof c.value === 'number') expect(Number.isInteger(c.value) && c.value >= 0, `${f.id} ${c.value}`).toBe(true)
        }
      }
    })

    it('classifies every candidate as its own tag on every kind (the uniqueness rule)', () => {
      for (const { fact, task } of tasks) {
        for (const c of def.candidates(fact)) {
          const key = String(c.value)
          if (!(key in task.distractorTags)) continue
          // a misconception's value that is also the answer reversed is 'ambiguous' (SPEC A11)
          const want = swapDisambiguated(task, c.value, c.tag)
          expect(task.distractorTags[key], `${fact.id} ${task.kind} ${key}`).toBe(want)
          expect(classifyAnswer(task, c.value), `${fact.id} ${task.kind} ${key}`).toBe(want)
        }
      }
    })

    it('deals valid cards: unique, one right, wrong ones ≥ 0, in range and tagged', () => {
      for (const { fact, task } of tasks) {
        if (task.kind !== 'choice' && task.kind !== 'pair') continue
        const where = `${fact.id} ${task.kind}`
        expect(task.options.length, where).toBe(task.kind === 'pair' ? 4 : 3)
        expect(new Set(task.options.map(String)).size, where).toBe(task.options.length)
        expect(task.options.filter((o) => isCorrect(task, o)), where).toEqual([task.answer])
        for (const o of task.options) {
          if (o === task.answer) continue
          if (typeof o === 'number') {
            expect(o, where).toBeGreaterThanOrEqual(Math.max(0, task.range[0]))
            expect(o, where).toBeLessThanOrEqual(task.range[1])
          }
          expect(task.distractorTags[String(o)], `${where} ${String(o)}`).toBeDefined()
        }
      }
    })

    it('deals multiSelect, sortOrder and fillSlots options that fit the answer', () => {
      for (const { fact, task } of tasks) {
        const where = `${fact.id} ${task.kind}`
        const parts = String(task.answer).split('|')
        if (task.kind === 'sortOrder') {
          expect(task.options.length, where).toBeGreaterThanOrEqual(4)
          expect([...task.options.map(String)].sort(), where).toEqual([...parts].sort())
          expect(task.options.map(String).join('|'), where).not.toBe(task.answer)
        }
        if (task.kind === 'multiSelect') {
          expect(task.options.length, where).toBeGreaterThanOrEqual(5)
          for (const p of parts) expect(task.options.map(String), where).toContain(p)
          expect([...parts].sort().join('|'), where).toBe(task.answer)
          expect(parts.length, where).toBeGreaterThanOrEqual(2)
          expect(task.options.length - parts.length, where).toBeGreaterThanOrEqual(2)
        }
        if (task.kind === 'fillSlots') {
          expect(parts.length, where).toBeGreaterThanOrEqual(2)
          for (const p of parts) expect(task.options.map(String), where).toContain(p)
          expect(new Set(task.options.map(String)).size, where).toBe(task.options.length)
        }
      }
    })

    it('has a production kind for at least 90 % of its instances', () => {
      const production = SKILL_BY_ID[def.id].production.filter((k) => def.kinds.includes(k))
      expect(production.length).toBeGreaterThan(0)
      const shares = production.map((kind) => {
        const own = tasks.filter((t) => t.kind === kind)
        return own.filter((t) => isProduction(t.task)).length / own.length
      })
      expect(Math.max(...shares)).toBeGreaterThanOrEqual(0.9)
    })

    it('speaks every task with recorded clips and no digits', () => {
      const problems = new Set<string>()
      for (const { fact, kind, task } of tasks) {
        for (const p of speechProblems(task.speech)) problems.add(`${fact.id} ${kind}: ${p}`)
      }
      expect([...problems].slice(0, 10)).toEqual([])
    })

    it('has a spoken strategy hint for every fact and every tag it can meet', () => {
      const problems = new Set<string>()
      const mis = new Set<ErrorTag>()
      for (const f of facts) for (const c of def.candidates(f)) if (isMisconception(c.tag)) mis.add(c.tag)
      for (const f of facts) {
        for (const tag of [...PLAIN_TAGS, ...mis]) {
          const h: HintSpec = def.hint(f, tag)
          for (const p of speechProblems(h.speech)) problems.add(`${f.id} ${String(tag)}: ${p}`)
          if (!h.visual || typeof h.visual.scene !== 'string') problems.add(`${f.id}: no visual`)
          if (h.misconception && h.misconception !== tag) problems.add(`${f.id}: hint for ${h.misconception} on tag ${String(tag)}`)
          if (!isMisconception(tag) && h.misconception) problems.add(`${f.id}: misconception hint without one`)
        }
      }
      expect([...problems].slice(0, 10)).toEqual([])
    })

    it('marks contrast only for a perceptual skill, and only conflict or congruent', () => {
      for (const { fact, task } of tasks) {
        if (task.contrast === undefined) continue
        expect(['conflict', 'congruent'], fact.id).toContain(task.contrast)
        expect(['compareLength', 'shapes2D']).toContain(def.id)
      }
    })
  })
}

/** Fact ids are mastery keys and clip ids (`q.<factId>`): unique across every registered skill. */
export function globalIdCheck(): void {
  it('has fact ids that are unique across all registered skills', () => {
    const seen = new Map<string, string>()
    for (const def of registeredSkills()) {
      for (const f of factsUnderTest(def, 50)) {
        expect(seen.get(f.id) ?? def.id, f.id).toBe(def.id)
        seen.set(f.id, def.id)
      }
    }
  })
}

/**
 * A simulated child: `n` first-try answers on the tasks `build(i)` gives, `perDay` a learning day, run
 * through the real diagnostics (classifyAnswer, detectableOf, updateMisconceptions). Returns every
 * misconception flagged at some point — a flag can lift again later in the run.
 */
export function flagsRaised(build: (i: number) => Task, n: number, answer: (t: Task, i: number) => AnswerValue, perDay = 16): Set<MisconceptionId> {
  let states: MisconceptionStates = {}
  const flagged = new Set<MisconceptionId>()
  for (let i = 0; i < n; i++) {
    const t = build(i)
    const given = answer(t, i)
    const correct = isCorrect(t, given)
    const day = `2026-10-${String(1 + Math.floor(i / perDay)).padStart(2, '0')}`
    const entry = {
      profileId: 'p', ts: i + 1, day, sessionId: 's', roundId: 'r', nodeId: 'n', mode: 'round', skill: t.skill,
      family: t.family, factId: t.factId, masteryKey: t.masteryKey, kind: t.kind, optionsCount: t.options.length,
      production: isProduction(t), given, answer: t.answer, correct, ms: 3000, fast: true,
      errorTag: classifyAnswer(t, given), detectable: detectableOf(t), boxBefore: 0, boxAfter: 0,
      scaffold: false, replays: 0, retryOf: null, assisted: false, audioUnverified: false, ...(t.contrast ? { contrast: t.contrast } : {}),
    } satisfies AnswerLogEntry
    states = updateMisconceptions(states, entry, { skillAccuracy20: 0.7, day, ...(t.contrast ? { contrast: t.contrast } : {}) })
    for (const id of flaggedIds(states)) flagged.add(id)
  }
  return flagged
}
