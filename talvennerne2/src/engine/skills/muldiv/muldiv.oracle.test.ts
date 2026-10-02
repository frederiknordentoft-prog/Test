// Oracle tests for groupsOf, mul2510 and shareEqually (SPEC §2.2, §3, §4.1 with A9/A11, §10.1, §15.1),
// compared with muldiv.oracle.ts and the wave-2 kit in algebra2.oracle.ts.
import { describe, expect, it } from 'vitest'
import { classifyAnswer } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { masteryKeyOf } from '../../tasks'
import type { AnswerValue } from '../../types'
import {
  answerProblems, cardProblems, first, hintProblems, registeredSkill, sceneOf, spokenText, tagsToHint, taskSpeechProblems, tasksOf,
  type Built,
} from '../number/number.oracle'
import { numberWordProblems, numbersIn } from '../number/number2.oracle'
import {
  cardAnswer, classifyAll, diagnosticCards, idChecks, productionChecks, sentences, specKindChecks, spokenAnswer, typedSwapOf, wantTag,
} from '../algebra/algebra2.oracle'
import {
  explainGroups, explainMul, explainShare, groupsOfId, mul2510Ids, mulId, mulMis, shareId, shareOutcomes,
} from './muldiv.oracle'
import { canShare, MAX_PLATES, MAX_THINGS } from '../../../ui/task/share/logic'

const TIMEOUT = 240_000

function setup(id: Parameters<typeof registeredSkill>[0]) {
  const def = registeredSkill(id)
  const facts = def.enumerate()
  const built: Built[] = tasksOf(def, facts, 4)
  return { def, facts, built }
}

const generic = (built: readonly Built[]) => built.flatMap((b) => [...answerProblems(b.task), ...cardProblems(b.task)])

// ═══ groupsOf ═══════════════════════════════════════════════════════════════

describe('groupsOf oracle', () => {
  const { def, facts, built } = setup('groupsOf')

  it('has SPEC §2.2’s 16 facts: g groups of s for g, s = 2–5, ids grp:<g>x<s>, answers g · s', () => {
    const want = new Set<string>()
    for (let g = 2; g <= 5; g++) for (let s = 2; s <= 5; s++) want.add(`grp:${g}x${s}`)
    expect(new Set(facts.map((f) => f.id))).toEqual(want)
    expect(facts.length).toBe(16)
    expect(first(idChecks(def, facts, /^grp:\d+x\d+$/, (id) => {
      const q = groupsOfId(id)
      return q && { family: 'groups', answer: q.answer }
    }))).toEqual([])
    for (const f of facts) expect(masteryKeyOf(def, f)).toBe(f.id)
  })

  it('shows and says the fact’s groups: the picture holds the answer’s number of things, the voice the same groups', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const q = groupsOfId(fact.id)!
      const p = sceneOf(task.prompt, 'groups')
      const where = `${fact.id} ${kind}`
      if (p.groups !== q.g || p.size !== q.s || p.groups * p.size !== task.answer || task.answer !== q.answer) problems.push(`${where}: ${p.groups} groups of ${p.size}, answer ${String(task.answer)}`)
      const said = numbersIn(sentences(spokenText(task.speech))[0])
      if (said.join() !== `${q.g},${q.s}`) problems.push(`${where}: says ${said}`)
      if (!task.speech.some((s) => 'clip' in s && s.clip === `noun.thing.${p.thing}.pl`)) problems.push(`${where}: the voice does not name the ${p.thing} shown`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards inside 0–30 and shows mulAsAdd (g + s) whenever it is a wrong answer', () => {
    expect(first(generic(built))).toEqual([])
    const explain = (b: Built, v: AnswerValue) => { const q = groupsOfId(b.fact.id)!; return explainGroups(q.g, q.s, v) }
    expect(first(diagnosticCards(built, (b) => { const q = groupsOfId(b.fact.id)!; return [q.g + q.s] }, explain))).toEqual([])
  })

  it('classifies cards and typed values: mulAsAdd, the numbers of the question, everything else plain', () => {
    expect(first(classifyAll(built, (b, v) => { const q = groupsOfId(b.fact.id)!; return explainGroups(q.g, q.s, v) }))).toEqual([])
  })

  it('has SPEC’s production kinds and ceilings (keypad 0–30 box 5, cards box 3)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(numberWordProblems(built))).toEqual([])
    expect(first(facts.flatMap((f) => hintProblems(def, f, tagsToHint(def, facts))))).toEqual([])
  })
}, TIMEOUT)

// ═══ mul2510 ════════════════════════════════════════════════════════════════

describe('mul2510 oracle', () => {
  const { def, facts, built } = setup('mul2510')

  it('has SPEC §2.2’s 27 facts: every product of the 2-, 5- and 10-table, mul:<a>x<b> smallest first, in the bigger table', () => {
    expect(new Set(facts.map((f) => f.id))).toEqual(mul2510Ids())
    expect(facts.length).toBe(27)
    expect(first(idChecks(def, facts, /^mul:\d+x\d+$/, (id) => {
      const q = mulId(id)
      return q && { family: `t${q.table}`, answer: q.answer }
    }))).toEqual([])
    for (const f of facts) expect(masteryKeyOf(def, f)).toBe(f.id)
    expect(facts.filter((f) => f.family === 't2').length).toBe(8)
    expect(facts.filter((f) => f.family === 't5').length).toBe(9)
    expect(facts.filter((f) => f.family === 't10').length).toBe(10)
  })

  it('shows the fact on the card with the table’s number second, and card and voice give the product', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const q = mulId(fact.id)!
      const terms = sceneOf(task.prompt, 'equation').terms
      const shown = terms.flatMap((t) => ('n' in t ? [t.n] : []))
      const where = `${fact.id} ${kind}`
      if ([...shown].sort((x, y) => x - y).join() !== `${q.a},${q.b}` || shown[1] !== q.table) problems.push(`${where}: card ${shown.join(' · ')}`)
      if (cardAnswer(task.prompt) !== q.answer || task.answer !== q.answer) problems.push(`${where}: card ${cardAnswer(task.prompt)}, task ${String(task.answer)}`)
      const heard = spokenAnswer(task)
      if (heard.answer !== q.answer || heard.problems.length) problems.push(`${where}: heard ${heard.answer} ${heard.problems}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards inside 0–100 and shows a tableNeighbour or mulAsAdd card whenever one counts', () => {
    expect(first(generic(built))).toEqual([])
    const explain = (b: Built, v: AnswerValue) => { const q = mulId(b.fact.id)!; return explainMul(q.a, q.b, v) }
    expect(first(diagnosticCards(built, (b) => { const q = mulId(b.fact.id)!; return mulMis(q.a, q.b).map(([v]) => v) }, explain))).toEqual([])
  })

  it('classifies cards and typed values by pædagogik §3.2 with A9 (1 · 5 → 1) and A11 (9 · 2 → 81, 9 · 5 → 54)', () => {
    expect(first(classifyAll(built, (b, v) => { const q = mulId(b.fact.id)!; return explainMul(q.a, q.b, v) }))).toEqual([])
    const typed = (id: string) => built.find((b) => b.fact.id === id && b.kind === 'keypad')!.task
    expect(classifyAnswer(typed('mul:1x5'), 1)).toBe('ambiguous')
    for (const [id, v] of [['mul:2x9', 81], ['mul:5x9', 54]] as const) {
      const t = typed(id)
      expect(typedSwapOf(t), id).toBe(v)
      expect(wantTag(t, v, explainMul(mulId(id)!.a, mulId(id)!.b, v)), id).toBe('ambiguous')
      expect(classifyAnswer(t, v), id).toBe('ambiguous')
    }
  })

  it('has SPEC’s production kinds and ceilings (keypad box 5, cards box 3)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(numberWordProblems(built))).toEqual([])
    expect(first(facts.flatMap((f) => hintProblems(def, f, tagsToHint(def, facts))))).toEqual([])
  })
}, TIMEOUT)

// ═══ shareEqually ═══════════════════════════════════════════════════════════

describe('shareEqually oracle', () => {
  const { def, facts, built } = setup('shareEqually')

  it('has SPEC §2.2’s 20 facts: 2–5 animals, 1–5 each, ids shr:<total>:<animals>, answers the share', () => {
    const want = new Set<string>()
    for (let g = 2; g <= 5; g++) for (let q = 1; q <= 5; q++) want.add(`shr:${g * q}:${g}`)
    expect(new Set(facts.map((f) => f.id))).toEqual(want)
    expect(facts.length).toBe(20)
    expect(first(idChecks(def, facts, /^shr:\d+:\d+$/, (id) => {
      const q = shareId(id)
      return q && { family: 'share', answer: q.answer }
    }))).toEqual([])
  })

  it('shows the pile and the animals and says them: the share times the animals is the pile, within the share view’s 40 things and 10 plates', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const q = shareId(fact.id)!
      const p = sceneOf(task.prompt, 'share')
      const where = `${fact.id} ${kind}`
      if (p.total !== q.total || p.recipients !== q.g || (task.answer as number) * p.recipients !== p.total) problems.push(`${where}: ${p.total} among ${p.recipients}, answer ${String(task.answer)}`)
      if (p.total > MAX_THINGS || p.recipients > MAX_PLATES || !canShare(task)) problems.push(`${where}: the share view cannot deal it`)
      const said = numbersIn(sentences(spokenText(task.speech))[0])
      if (said.join() !== `${q.total},${q.g}`) problems.push(`${where}: says ${said}`)
      if (!task.speech.some((s) => 'clip' in s && s.clip === `noun.thing.${p.thing}.pl`)) problems.push(`${where}: the voice does not name the ${p.thing} shown`)
    }
    expect(first(problems)).toEqual([])
  })

  it('share: every deal of the whole pile is the answer when even and shareUnequal (−1) otherwise, never a wrong count', () => {
    const problems: string[] = []
    for (const { fact, task } of built) {
      if (task.kind !== 'share') continue
      const p = sceneOf(task.prompt, 'share')
      for (const [v, deals] of shareOutcomes(p.total, p.recipients)) {
        if (v === -1) {
          if (classifyAnswer(task, -1) !== 'shareUnequal' || isCorrect(task, -1)) problems.push(`${fact.id}: an uneven deal is ${classifyAnswer(task, -1)}`)
        } else if (v !== task.answer || deals !== 1 || classifyAnswer(task, v) !== null) problems.push(`${fact.id}: an even deal of ${v} each (${deals} ways) against ${String(task.answer)}`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards inside 0–30 and shows wrongOperation whenever it fits and counts', () => {
    expect(first(generic(built))).toEqual([])
    const explain = (b: Built, v: AnswerValue) => { const q = shareId(b.fact.id)!; return explainShare(q.total, q.g, v) }
    expect(first(diagnosticCards(built, (b) => { const q = shareId(b.fact.id)!; return [q.total - q.g, q.total + q.g] }, explain))).toEqual([])
  })

  it('classifies cards and typed values: wrongOperation, and 6 between 3 → 3 (also the animals) is ambiguous (A9)', () => {
    expect(first(classifyAll(built, (b, v) => { const q = shareId(b.fact.id)!; return explainShare(q.total, q.g, v) }))).toEqual([])
    const t = built.find((b) => b.fact.id === 'shr:6:3' && b.kind === 'keypad')!.task
    expect(classifyAnswer(t, 3)).toBe('ambiguous')
  })

  it('has SPEC’s production kinds and ceilings (share and keypad box 5, cards box 3)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it('speaks every task and hint (also after shareUnequal) with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(numberWordProblems(built))).toEqual([])
    expect(first(facts.flatMap((f) => hintProblems(def, f, [...tagsToHint(def, facts), 'shareUnequal'])))).toEqual([])
  })
}, TIMEOUT)
