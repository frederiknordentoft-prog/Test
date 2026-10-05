// Oracle tests for groupsOf, mul2510 and shareEqually (SPEC §2.2, §3, §4.1 with A9/A11, §10.1, §15.1),
// compared with muldiv.oracle.ts and the wave-2 kit in algebra2.oracle.ts.
import { describe, expect, it } from 'vitest'
import { classifyAnswer, detectableOf, updateMisconceptions, type MisconceptionStates } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { isProduction } from '../../kinds'
import { masteryKeyOf } from '../../tasks'
import { registeredSkills } from '../../registry'
import type { AnswerLogEntry, AnswerValue, Fact, SkillDef, SpeechPart, Task } from '../../types'
import {
  answerProblems, cardProblems, first, hintProblems, registeredSkill, sceneOf, spokenText, tagsToHint, taskSpeechProblems, tasksOf,
  type Built,
} from '../number/number.oracle'
import { numberWordProblems, numbersIn } from '../number/number2.oracle'
import {
  animationChecks, cardAnswer, classifyAll, detectableChecks, diagnosticCards, hintArithmetic, idChecks, instancesOf3, productionChecks, sentences, specKindChecks, spokenAnswer, typedSwapOf, wantTag,
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

  it('counts as an opportunity (detectableOf) exactly the misconceptions its cards or keys can show', () => {
    expect(first(detectableChecks(built, (b, v) => { const q = groupsOfId(b.fact.id)!; return explainGroups(q.g, q.s, v) }))).toEqual([])
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

  it('says only true arithmetic in every hint and counts group by group to the answer on the fact’s own groups', () => {
    expect(first(hintArithmetic(def, facts, [...tagsToHint(def, facts), 'digitSwap']))).toEqual([])
    expect(first(animationChecks(def, facts, tagsToHint(def, facts)))).toEqual([])
    const problems: string[] = []
    for (const f of facts) {
      const q = groupsOfId(f.id)!
      for (const tag of tagsToHint(def, facts)) {
        const h = def.hint(f, tag)
        if (h.visual.scene !== 'groups' || h.visual.groups !== q.g || h.visual.size !== q.s) problems.push(`${f.id} hint(${String(tag)}): ${JSON.stringify(h.visual)}`)
        // "Fire. Otte. Tolv." — the running count ends on the answer
        const counts = numbersIn(spokenText(h.speech))
        if (!counts.includes(q.answer)) problems.push(`${f.id} hint(${String(tag)}): never says ${q.answer}`)
      }
    }
    expect(first(problems)).toEqual([])
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
    expect(first(detectableChecks(built, (b, v) => { const q = mulId(b.fact.id)!; return explainMul(q.a, q.b, v) }))).toEqual([])
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

  it('marks the tableNeighbour hint animated, as SPEC §4.3 does for its eight misconceptions', () => {
    // GENERATOR DEVIATION (mul2510.ts hint()) — Rettet: hintOf(…, 'tableNeighbour') was without `animated: true`;
    // SPEC §4.3 lists tableNeighbour among the eight animated hints (HintSpec.animated, types.ts). The digitSwap
    // and mulAsAdd hints are flagged right. No effect today: ui/hint/hintFor.ts films three of the eight.
    expect(first(animationChecks(def, facts, [...tagsToHint(def, facts), 'digitSwap']))).toEqual([])
  })

  it('says only true arithmetic in every hint; the array or the hops picture the fact’s own product', () => {
    expect(first(hintArithmetic(def, facts, [...tagsToHint(def, facts), 'digitSwap']))).toEqual([])
    const problems: string[] = []
    for (const f of facts) {
      const q = mulId(f.id)!
      const v = def.hint(f, null).visual
      const ok = v.scene === 'array' ? v.rows * v.cols === q.answer && [v.rows, v.cols].sort((x, y) => x - y).join() === `${q.a},${q.b}`
        : v.scene === 'line' ? (v.hops ?? []).at(-1) === q.answer && (v.hops ?? []).every((x, i) => x === i * q.table) : false
      if (!ok) problems.push(`${f.id}: ${JSON.stringify(v)}`)
    }
    expect(first(problems)).toEqual([])
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

  it('counts as an opportunity on cards and keys exactly the misconceptions they can show', () => {
    const explain = (b: Built, v: AnswerValue) => { const q = shareId(b.fact.id)!; return explainShare(q.total, q.g, v) }
    expect(first(detectableChecks(built.filter((b) => b.kind !== 'share'), explain))).toEqual([])
  })

  it('share: a deal hands in the share or −1 (shareUnequal), so it is no wrongOperation opportunity', () => {
    // GENERATOR BUG (shareEqually.ts, no candidatesFor) — Rettet: the share task inherited the card/keypad
    // candidates (total ± animals → wrongOperation), so detectableOf(shr:12:3 share) was [wrongOperation],
    // although the share view can only hand in 4 or −1. Now SkillExtras.candidatesFor(fact, 'share') is [].
    const explain = (b: Built, v: AnswerValue) => { const q = shareId(b.fact.id)!; return explainShare(q.total, q.g, v) }
    expect(first(detectableChecks(built.filter((b) => b.kind === 'share'), explain))).toEqual([])
  })

  it('a flagged wrongOperation is not lifted by right deals alone, which cannot show it (SPEC §4.3 "Løst")', () => {
    // The consequence of the bug above (Rettet with it): after a flag from typed 12 − 3 → 9 style answers, six
    // even deals were six "right opportunities" and isResolved (misconceptions.ts) lifted the flag.
    const task = (id: string, kind: Task['kind']) => built.find((b) => b.fact.id === id && b.kind === kind)!.task
    let ts = 1_000
    const log = (t: Task, given: AnswerValue, day: string): AnswerLogEntry => ({
      profileId: 'p', ts: ts++, day, sessionId: 's', roundId: 'r', nodeId: 'n', mode: 'round', skill: t.skill, family: t.family,
      factId: t.factId, masteryKey: t.masteryKey, kind: t.kind, optionsCount: t.options.length, production: isProduction(t), given,
      answer: t.answer, correct: isCorrect(t, given), ms: 4_000, fast: true, errorTag: classifyAnswer(t, given), detectable: detectableOf(t),
      boxBefore: 2, boxAfter: 2, scaffold: false, replays: 0, retryOf: null, assisted: false, audioUnverified: false,
    })
    let s: MisconceptionStates = {}
    const feed = (e: AnswerLogEntry) => { s = updateMisconceptions(s, e, { skillAccuracy20: 0.8, day: e.day }) }
    // typed wrongOperation on four facts over two days: flagged
    for (const [id, day] of [['shr:12:3', '2026-10-01'], ['shr:15:3', '2026-10-01'], ['shr:20:4', '2026-10-02'], ['shr:16:4', '2026-10-02']] as const) {
      const t = task(id, 'keypad')
      const q = shareId(id)!
      expect(classifyAnswer(t, q.total - q.g), id).toBe('wrongOperation')
      feed(log(t, q.total - q.g, day))
    }
    expect(s.wrongOperation?.status).toBe('flagged')
    // six right deals the next day
    for (const id of ['shr:6:2', 'shr:8:2', 'shr:9:3', 'shr:12:4', 'shr:10:5', 'shr:15:5']) feed(log(task(id, 'share'), shareId(id)!.answer, '2026-10-03'))
    expect(s.wrongOperation?.status).toBe('flagged')
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

  it('says only true arithmetic in every hint (also after shareUnequal), showing each animal’s equal share', () => {
    expect(first(hintArithmetic(def, facts, [...tagsToHint(def, facts), 'shareUnequal']))).toEqual([])
    expect(first(animationChecks(def, facts, tagsToHint(def, facts)))).toEqual([])
    const problems: string[] = []
    for (const f of facts) {
      const q = shareId(f.id)!
      const v = def.hint(f, null).visual
      if (v.scene !== 'groups' || v.groups !== q.g || v.size !== q.answer) problems.push(`${f.id}: ${JSON.stringify(v)}`)
    }
    expect(first(problems)).toEqual([])
  })
}, TIMEOUT)

// ═══ How ':' is read (SPEC A12) ══════════════════════════════════════════════

describe('division read aloud (SPEC A12: ":" is "delt med" in 2. klasse, "divideret med" from 3. klasse)', () => {
  // ORK2c's finding: inverseOps (mulToDiv, "Hvad er tolv delt med fire?" under 12 : 4 = □) and shareEqually's hint
  // ("Tolv delt med tre giver fire.") say frag.muldiv.delt_med, while speech/equation.ts reads ':' as
  // op.divideret_med (§10.1). SPEC A12 keeps "delt med" for 2. klasse, where division is sharing, and leaves
  // "divideret med" to 3. klasse: a child of 0.–2. klasse must never hear the sign read both ways.
  const said = (parts: readonly SpeechPart[], clip: string) => parts.some((p) => 'clip' in p && p.clip === clip)

  it('says "delt med" for every division in inverseOps and shareEqually', () => {
    // SPEC A19 (5/10, SK3-TAL): inverseOps/mulToDiv is 3. klasse and now reads ":" "divideret med", so the
    // "delt med" line covers the families of 0.–2. klasse; mulToDiv is held to "divideret med" below
    const grade2 = (def: SkillDef, f: Fact) => (def.families.find((fam) => fam.id === f.family)?.grade ?? def.grade) <= 2
    const problems: string[] = []
    for (const id of ['inverseOps', 'shareEqually'] as const) {
      const def = registeredSkill(id)
      const facts = [...def.enumerate(), ...(def.mode === 'procedure' ? [...instancesOf3(def, 20).values()].flat() : [])]
      for (const f of facts.filter((x) => grade2(def, x))) {
        for (const kind of def.kinds) {
          const parts = [...def.speech(f, kind), ...def.hint(f, null, kind).speech]
          if (said(parts, 'op.divideret_med')) problems.push(`${f.id} ${kind}: "${spokenText(parts)}"`)
        }
      }
    }
    expect(first(problems)).toEqual([])
    const share = registeredSkill('shareEqually')
    expect(share.enumerate().every((f) => said(share.hint(f, null).speech, 'frag.muldiv.delt_med'))).toBe(true)
    const inv = registeredSkill('inverseOps')
    const mulToDiv = inv.enumerate().filter((f) => f.family === 'mulToDiv')
    expect(mulToDiv.length).toBeGreaterThan(0)
    for (const f of mulToDiv) {
      for (const kind of inv.kinds) {
        const parts = [...inv.speech(f, kind), ...inv.hint(f, null, kind).speech]
        expect([said(parts, 'op.divideret_med'), said(parts, 'frag.muldiv.delt_med')], `${f.id} ${kind}`).toEqual([true, false])
      }
    }
  })

  it('never says "divideret med" in a task or hint of any skill in 0.–2. klasse', () => {
    const problems: string[] = []
    const checked = new Set<string>()
    for (const def of registeredSkills()) {
      const grade3 = new Set(def.families.filter((fam) => (fam.grade ?? def.grade) > 2).map((fam) => fam.id))
      if (def.grade > 2 && grade3.size === def.families.length) continue
      const facts = def.enumerate().filter((f) => (def.families.find((fam) => fam.id === f.family)?.grade ?? def.grade) <= 2)
      for (const { fact, kind, task } of tasksOf(def, facts, 1)) {
        checked.add(def.id)
        if (said([...task.speech, ...def.hint(fact, null, kind).speech], 'op.divideret_med')) problems.push(`${def.id} ${fact.id} ${kind}`)
      }
    }
    expect(first(problems)).toEqual([])
    expect(checked.size, 'the skills of waves 1–2').toBeGreaterThanOrEqual(56)
  })
}, TIMEOUT)
