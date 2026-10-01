// Oracle tests for patterns (SPEC §15.1): the canonical instances and 200 seeded instances per family,
// every kind, compared with algebra.oracle.ts — a blind reading of the row and each family's rule
// built from the id.
import { describe, expect, it } from 'vitest'
import { masteryKeyOf } from '../../tasks'
import { hashSeed, makeRng } from '../../rng'
import type { Fact } from '../../types'
import {
  answerProblems, blanksOf, cardProblems, first, hintProblems, instancesOf, optionProblems, productionProblems, registeredSkill,
  sceneOf, specKindProblems, spokenText, tagProblem, tagsToHint, taskSpeechProblems, tasksOf,
} from '../number/number.oracle'
import {
  PATTERN_FAMILIES, bead, beadKind, beadName, beadsOf, continueRow, explainBeads, parsePatternId, patternRow, periodOf, ruleOf,
} from './algebra.oracle'

describe('patterns oracle', () => {
  const def = registeredSkill('patterns')
  const canon = def.enumerate()
  const instances = instancesOf(def, 200)
  const drawn = [...instances.values()].flat()
  const all: Fact[] = [...canon, ...drawn]
  const built = [...tasksOf(def, canon, 4), ...tasksOf(def, drawn, 1)]

  it('has SPEC §2.2’s five families, 20 canonical instances each', () => {
    expect(def.families.map((f) => f.id)).toEqual([...PATTERN_FAMILIES])
    for (const fam of PATTERN_FAMILIES) expect(canon.filter((f) => f.family === fam).length, fam).toBe(20)
    expect(new Set(canon.map((f) => f.id)).size).toBe(canon.length)
  })

  it('draws 200 seeded instances per family: each id one instance of its family, two whole repeats shown', () => {
    const problems: string[] = []
    const meaning = new Map<string, string>()
    for (const f of all) {
      const { family, units, shown } = parsePatternId(f.id)
      if (family !== f.family) problems.push(`${f.id}: in family ${f.family}`)
      if (units.length !== beadsOf(family) || new Set(units).size !== units.length) problems.push(`${f.id}: beads ${units}`)
      // two whole repeats (growing: two whole groups, A B and A B B, and part of the third)
      const least = family === 'growing' ? 6 : 2 * periodOf(family)
      if (shown < least) problems.push(`${f.id}: only ${shown} beads shown`)
      if (f.answer !== bead(patternRow(family, units, shown + 1)[shown])) problems.push(`${f.id}: answer ${String(f.answer)}`)
      const key = JSON.stringify([f.family, f.operands, f.answer, f.data ?? null])
      if ((meaning.get(f.id) ?? key) !== key) problems.push(`${f.id}: two different instances share the id`)
      meaning.set(f.id, key)
      if (masteryKeyOf(def, f) !== `patterns/${f.family}`) problems.push(`${f.id}: mastery key ${masteryKeyOf(def, f)}`)
    }
    expect(first(problems)).toEqual([])
    for (const fam of PATTERN_FAMILIES) expect(new Set(instances.get(fam)!.map((f) => f.id)).size, fam).toBeGreaterThan(40)
  })

  it('moves the gap through every place of the repeat, so the answer is not always the first bead', () => {
    for (const fam of PATTERN_FAMILIES) {
      const period = periodOf(fam)
      const places = new Set(instances.get(fam)!.map((f) => (period ? parsePatternId(f.id).shown % period : parsePatternId(f.id).shown)))
      expect(places.size, fam).toBeGreaterThanOrEqual(period || 3)
      const answers = new Set(instances.get(fam)!.map((f) => {
        const { units } = parsePatternId(f.id)
        return units.indexOf(beadName(String(f.answer)))
      }))
      expect(answers.size, fam).toBeGreaterThanOrEqual(2)
    }
  })

  it('avoids the instances it is told to avoid', () => {
    for (const fam of def.families) {
      const avoid = new Set(instances.get(fam.id)!.slice(0, 100).map((f) => f.id))
      const rng = makeRng(hashSeed(`oracle-avoid:${fam.id}`))
      for (let i = 0; i < 50; i++) expect(avoid.has(def.instance!(fam, rng, avoid).id), fam.id).toBe(false)
    }
  })

  it('answers every task as the blind reading of the row and the family rule from the id both do', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const { family, units, shown } = parsePatternId(fact.id)
      const row = sceneOf(task.prompt, 'row')
      const k = blanksOf(task.prompt)
      const beads = row.cells.slice(0, row.cells.length - k)
      if (row.cells.slice(beads.length).some((c) => c !== null) || beads.some((c) => typeof c !== 'string')) {
        problems.push(`${where}: the gap is not at the end of [${row.cells}]`)
        continue
      }
      const names = (beads as string[]).map(beadName)
      const fromId = patternRow(family, units, shown + k)
      if (names.length !== shown || names.join() !== fromId.slice(0, shown).join()) problems.push(`${where}: row [${names}] is not the ${family} row of ${units}`)
      const blind = continueRow(names, k)
      if (!blind || blind.rule !== ruleOf(family)) problems.push(`${where}: the row reads as ${blind?.rule ?? 'nothing'}, not ${ruleOf(family)}`)
      if (kind === 'choice' && k !== 1) problems.push(`${where}: ${k} gaps for one card`)
      // SPEC §3.3: fillSlots is production only with palette^k ≥ 9, so at least two slots
      if (kind === 'fillSlots' && k < 2) problems.push(`${where}: ${k} slot`)
      const want = fromId.slice(shown).map(bead).join('|')
      if (task.answer !== want || blind?.next.map(bead).join('|') !== want) problems.push(`${where}: answer ${String(task.answer)}, oracle ${want}`)
      const text = spokenText(task.speech)
      if (text !== (kind === 'choice' ? 'Hvad kommer så?' : 'Fortsæt mønstret.')) problems.push(`${where}: "${text}"`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals three different beads of one kind (never red with green): the pattern’s own and one from outside', () => {
    const problems: string[] = []
    for (const { fact, task } of built) {
      problems.push(...cardProblems(task), ...optionProblems(task), ...answerProblems(task))
      const { units } = parsePatternId(fact.id)
      const names = task.options.map((o) => beadName(String(o)))
      const kinds = new Set([...names, ...units].map(beadKind))
      if (kinds.size !== 1 || kinds.has(null)) problems.push(`${fact.id} ${task.kind}: beads of kinds ${[...kinds]}`)
      if (names.includes('red') && names.includes('green')) problems.push(`${fact.id} ${task.kind}: red and green together`)
      const outside = names.filter((n) => !units.includes(n))
      // the pattern's beads plus one from outside (ABC already has three)
      if (new Set(names).size !== 3 || !units.every((u) => names.includes(u)) || outside.length !== 3 - units.length) {
        problems.push(`${fact.id} ${task.kind}: options [${names}] for beads [${units}]`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('classifies every card and every filling of the slots as a plain error — patterns have no misconception', () => {
    const problems: string[] = []
    for (const { fact, task } of built) {
      const k = blanksOf(task.prompt)
      let fillings: string[] = task.options.map(String)
      for (let i = 1; i < k; i++) fillings = fillings.flatMap((f) => task.options.map((o) => `${f}|${String(o)}`))
      for (const given of fillings) {
        if (given === task.answer) continue
        const p = tagProblem(task, given, explainBeads(fact.id, given, k), true)
        if (p) problems.push(p)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('has SPEC’s production kinds and ceilings (three beads in two or three slots: 1 in 9 or 27)', () => {
    expect(first([...productionProblems(built), ...specKindProblems(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits; the hint shows the row completed', () => {
    const tags = tagsToHint(def, canon)
    const problems = [...taskSpeechProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags))]
    for (const f of all) {
      const { family, units } = parsePatternId(f.id)
      const visual = def.hint(f, null).visual
      if (visual.scene !== 'row') {
        problems.push(`${f.id}: hint shows ${visual.scene}`)
        continue
      }
      const cells = visual.cells.map((c) => beadName(String(c)))
      if (cells.join() !== patternRow(family, units, cells.length).join() || cells.length <= parsePatternId(f.id).shown) {
        problems.push(`${f.id}: hint row [${cells}]`)
      }
    }
    expect(first(problems)).toEqual([])
  })
})
