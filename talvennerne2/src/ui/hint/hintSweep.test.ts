// Every strategy the round can show, for every registered skill (Plan 13/10, the patterns hint in
// Formhaven): tasks are built the way a round builds them (keysForSkills → key.build, a fresh
// instance per draw for a procedure skill), and the hint is asked for the way the round asks: after
// no answer (the lightbulb and the support on a new key), after each tagged wrong answer and after an
// untagged one (hintFor), and the skill's own hint for every error tag the task can carry, on the fact
// the round rebuilds from the task (factFor: the id, but no `data`). Nothing may throw, and nothing
// may be logged: hintFor's safely() turns a throw into console.error and a generic picture, which the
// child sees as the wrong help. And the rebuilt fact must give the very strategy the instance itself
// gives: order20's "biggest first" lost its pair on sortOrder's empty stones and drew a bare line.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { swappedAnswer } from '../../engine/misconceptions'
import { factsOf, keysForSkills, skillRegistry } from '../../engine/registry'
import type { KeyOption } from '../../engine/roundBuilder'
import { makeRng } from '../../engine/rng'
import { buildTask } from '../../engine/tasks'
import type { AnswerValue, ErrorTag, SkillDef, Task } from '../../engine/types'
import { fastMsOf } from '../screens/child/play/prepare'
import { factFor, hintFor, scaffoldFor, supportFor } from './hintFor'

const reg = skillRegistry()
const SEEDS = [0, 1, 2, 3]
/** Recall skills have a key per fact; this many per family, spread over it, is enough to sweep. */
const RECALL_PER_FAMILY = 3

/** The keys a round draws from for a skill: every family, a few facts of each for a recall skill. */
function keysOf(def: SkillDef): KeyOption[] {
  const keys = keysForSkills([{ skill: def.id }], { skills: reg, states: {}, audioVerified: true, mode: 'round' })
  if (def.mode !== 'recall') return keys
  return def.families.flatMap((fam) => {
    const own = keys.filter((k) => k.family === fam.id)
    if (own.length <= RECALL_PER_FAMILY) return own
    return Array.from({ length: RECALL_PER_FAMILY }, (_, i) => own[Math.round((i * (own.length - 1)) / (RECALL_PER_FAMILY - 1))])
  })
}

/** A wrong answer of the task's own type that no distractor carries (classified 'other'). */
function untagged(task: Task): AnswerValue {
  if (typeof task.answer === 'number') {
    const [lo, hi] = task.range
    for (let v = lo; v <= hi; v++) if (v !== task.answer && !(String(v) in task.distractorTags) && v !== swappedAnswer(task)) return v
    return hi + 1
  }
  return 'sweep:none'
}

/** The wrong answers a child can give: each tagged one, an untagged one and (share) an uneven deal. */
function wrongAnswers(task: Task): AnswerValue[] {
  const numeric = typeof task.answer === 'number'
  const tagged = Object.keys(task.distractorTags).map((k) => (numeric ? Number(k) : k))
  const swapped = swappedAnswer(task)
  return [...tagged, untagged(task), ...(swapped !== null ? [swapped] : []), ...(task.kind === 'share' ? [-1] : [])]
}

/** The error tags a task can carry: its distractors', 'other', and the two the round adds itself. */
function tagsOf(task: Task): (ErrorTag | null)[] {
  return [
    null,
    ...new Set<ErrorTag>([
      ...Object.values(task.distractorTags),
      'other',
      ...(swappedAnswer(task) !== null ? (['digitSwap'] as const) : []),
      ...(task.kind === 'share' ? (['shareUnequal'] as const) : []),
    ]),
  ]
}

describe('every hint of every skill, the way the round asks for it', () => {
  let errors: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    errors.mockRestore()
  })

  it('never throws and never logs an error, for every skill, family, kind, tag and several draws', () => {
    const failures = new Set<string>()
    const fail = (where: string, err: unknown) => failures.add(`${where}: ${err instanceof Error ? err.message : String(err)}`)
    const seen = { skills: 0, families: 0, tasks: 0, hints: 0 }
    for (const def of reg.all) {
      seen.skills++
      const families = new Set<string>()
      for (const k of keysOf(def)) {
        families.add(k.family ?? k.key)
        for (const kind of k.kinds) {
          for (const seed of SEEDS) {
            const where = `${def.id}/${k.family} ${kind} #${seed}`
            let task: Task
            try {
              task = k.build(kind, makeRng(seed), seed)
            } catch (err) {
              fail(`${where} (build)`, err)
              continue
            }
            seen.tasks++
            const at = `${where} ${task.factId}`
            const logged = errors.mock.calls.length
            try {
              // the skill's own strategy for every tag, on the fact the round rebuilds from the task
              const fact = factFor(def, task)
              for (const tag of tagsOf(task)) {
                try {
                  def.hint(fact, tag, task.kind)
                  seen.hints++
                } catch (err) {
                  fail(`${at} hint(${tag})`, err)
                }
              }
              // what the round shows: the lightbulb, the support on a new key, the strategy after each mistake
              supportFor(task, reg, scaffoldFor(task, reg))
              for (const given of [null, ...wrongAnswers(task)]) hintFor(task, given, reg)
              // the speed threshold reads the same rebuilt fact
              fastMsOf(task, reg)
            } catch (err) {
              fail(at, err)
            }
            if (errors.mock.calls.length > logged) fail(`${at} (console.error)`, errors.mock.calls[logged][0])
          }
        }
      }
      seen.families += families.size
    }
    expect([...failures]).toEqual([])
    expect(errors).not.toHaveBeenCalled()
    // the sweep reaches every registered skill and family
    expect(seen.skills).toBe(reg.all.length)
    expect(seen.families).toBe(reg.all.reduce((n, d) => n + d.families.length, 0))
    expect(seen.tasks).toBeGreaterThan(2000)
    expect(seen.hints).toBeGreaterThan(seen.tasks * 2)
  })

  it('gives the same strategy on the fact the round rebuilds as on the drawn instance itself', () => {
    const differ = new Set<string>()
    let compared = 0
    for (const def of reg.all) {
      if (def.mode !== 'procedure' || !def.instance) continue
      const canon = new Set(factsOf(def).map((f) => f.id))
      for (const fam of def.families) {
        // fresh instances, away from the canonical facts (factFor finds those with all their data)
        const rng = makeRng(17 + fam.rank)
        for (let i = 0; i < 12; i++) {
          const fact = def.instance(fam, rng, canon)
          for (const kind of def.kinds) {
            let task: Task
            try {
              task = buildTask(def, fact, kind, makeRng(i), 0).task
            } catch {
              // a kind this instance does not suit (the round draws one that does)
              continue
            }
            const rebuilt = factFor(def, task)
            for (const tag of tagsOf(task)) {
              const own = JSON.stringify(def.hint(fact, tag, kind))
              let again: string
              try {
                again = JSON.stringify(def.hint(rebuilt, tag, kind))
              } catch (err) {
                again = `throws ${err instanceof Error ? err.message : String(err)}`
              }
              if (again !== own) differ.add(`${def.id}/${fam.id} ${kind} ${tag} ${fact.id}: ${again.slice(0, 160)} (own: ${own.slice(0, 160)})`)
              compared++
            }
          }
        }
      }
    }
    expect([...differ]).toEqual([])
    expect(errors).not.toHaveBeenCalled()
    expect(compared).toBeGreaterThan(5000)
  })
})
