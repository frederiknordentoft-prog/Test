// Oracle tests for the algebra skills of 1.–2. klasse (SPEC §2.2, §3, §4.1 with A9/A11, §10.1, §15.1):
// missingPart10, skipCount, equalSides, inverseOps and missingPart100, compared with algebra2.oracle.ts —
// answers read off the id, the card and the voice; wrong answers explained by pædagogik §3.2.
import { describe, expect, it } from 'vitest'
import { masteryKeyOf } from '../../tasks'
import type { AnswerValue, Fact, Task } from '../../types'
import {
  cardProblems, first, hintProblems, optionProblems, registeredSkill, sceneOf, spokenText, tagsToHint, taskSpeechProblems, tasksOf,
  answerProblems, globalIdProblems, type Built,
} from '../number/number.oracle'
import { registeredSkills } from '../../registry'
import { numberWordProblems, numbersIn } from '../number/number2.oracle'
import {
  animationChecks, answerComesNowSays, avoidChecks, detectableChecks, hintArithmetic, balanceTokens, cardAnswer, cardNumbers, classifyAll, continueStones, diagnosticCards, distinctIds,
  equalSidesAnswer, equalSidesOf, equalSidesShapeOk, equalsAsAnswerValues, explainMissingPart10, explainSkip, idChecks, instancesOf3,
  inverseAnswer, inverseOf, inverseWrongOps, missing100Mis, missing100Numbers, missing100Of, missing100Tokens, missingPart10Of,
  productionChecks, sentences, skipNext, skipRowOf, solveTokens, specKindChecks, spokenAnswer, spokenTokens, statementTrue, swapped,
  typedSwapOf, wantTag, type Expl,
} from './algebra2.oracle'

const TIMEOUT = 240_000

/** Canonical facts with three deals each, 200 seeded instances per family with one deal each. */
function sweep(id: Parameters<typeof registeredSkill>[0]) {
  const def = registeredSkill(id)
  const canon = def.enumerate()
  const instances = def.mode === 'procedure' ? instancesOf3(def) : new Map<string, Fact[]>()
  const drawn = [...instances.values()].flat()
  const built: Built[] = [...tasksOf(def, canon, 3), ...tasksOf(def, drawn, 1)]
  return { def, canon, instances, drawn, built }
}

/** Generic card, answer and speech checks every task must pass. */
function genericProblems(built: readonly Built[]): string[] {
  const out: string[] = []
  for (const b of built) out.push(...answerProblems(b.task), ...cardProblems(b.task), ...optionProblems(b.task))
  return out
}

describe('wave-2 kit (ORK2c)', () => {
  it('hears and solves Danish arithmetic the way the oracles need it (a check of the oracle itself)', () => {
    expect(spokenTokens('Tre plus hvad giver syv?')).toEqual([3, '+', '?', '=', 7])
    expect(spokenTokens('Hvad er et hundrede minus syvogtredive?')).toEqual(['?', '=', 100, '−', 37])
    expect(spokenTokens('Hvad er tolv delt med fire?')).toEqual(['?', '=', 12, ':', 4])
    expect(spokenTokens('Otte plus fire er lig med hvad plus fem?')).toEqual([8, '+', 4, '=', '?', '+', 5])
    expect(spokenTokens('To hundrede og tyve tre hundrede og tyve.')).toEqual([220, 320])
    expect(solveTokens(spokenTokens('Otte plus fire er lig med hvad plus fem?'))).toBe(7)
    expect(solveTokens(spokenTokens('Hvad minus syvogtyve giver otteogtredive?'))).toBe(65)
    expect(solveTokens(['?', '=', 12, ':', 5])).toBeNull()
    expect(statementTrue(spokenTokens('Ni plus to giver elleve.'))).toBe(true)
    expect(statementTrue(spokenTokens('Ni plus to giver tolv.'))).toBe(false)
    expect(sentences('Ni plus to giver elleve. Hvad er elleve minus ni?')).toEqual(['Ni plus to giver elleve.', 'Hvad er elleve minus ni?'])
    expect([swapped(45), swapped(40), swapped(44), swapped(345)]).toEqual([54, null, null, 354])
    expect(equalsAsAnswerValues([[8, '+', 4], ['?', '+', 5]])).toEqual([12, 17])
    expect(equalsAsAnswerValues([[12, '−', 5], ['?', '−', 3]])).toEqual([7, 4])
    expect(answerComesNowSays([[7, '+', 2], [9, '+', 2]])).toBe('yes')
    expect(answerComesNowSays([[9], [7, '+', 2]])).toBe('no')
    expect(answerComesNowSays([[7, '+', 2], [4, '+', 5]])).toBe('no')
  })

  it('reads SPEC A9 and A11 into the tag a value must get', () => {
    const keypad = { kind: 'keypad', answer: 18, factId: 'x', prompt: { scene: 'equation', terms: [{ n: 9 }, { op: '·' }, { n: 2 }] } } as unknown as Task
    expect(typedSwapOf(keypad)).toBe(81)
    expect(wantTag(keypad, 81, { mis: ['tableNeighbour'] })).toBe('ambiguous') // A11: 9 · 2 → 81 is 9², and 18 reversed
    expect(wantTag(keypad, 9, { mis: ['tableNeighbour'], operand: true })).toBe('ambiguous') // A9
    expect(wantTag(keypad, 20, { mis: ['tableNeighbour'] })).toBe('tableNeighbour')
    expect(wantTag(keypad, 11, { mis: ['mulAsAdd', 'tableNeighbour'] })).toBe('ambiguous')
    expect(wantTag({ ...keypad, kind: 'choice' } as Task, 81, { mis: ['tableNeighbour'] })).toBe('tableNeighbour') // no swap on a card
  })
})

describe('fact ids of the 15 wave-2 skills of algebra, muldiv, shapes and fractions (CONVENTIONS)', () => {
  const MINE = ['missingPart10', 'skipCount', 'equalSides', 'inverseOps', 'missingPart100', 'groupsOf', 'mul2510', 'shareEqually',
    'sidesCorners', 'shapes3D', 'sortShapes', 'symmetry', 'composeShapes', 'halfShape', 'fractionShape']

  it('are unique across every registered skill, in the CONVENTIONS format, one prefix per skill', () => {
    const all = registeredSkills()
    expect(MINE.every((id) => all.some((d) => d.id === id))).toBe(true)
    const prefixes = new Map<string, string>()
    for (const d of all) for (const f of d.enumerate()) prefixes.set(f.id.slice(0, f.id.indexOf(':')), d.id)
    const mine = (p: string) => MINE.some((id) => new RegExp(`\\b${id}\\b`).test(p)) || [...prefixes].some(([pre, id]) => MINE.includes(id) && p.includes(`${pre}:`))
    expect(first(globalIdProblems(all).filter(mine))).toEqual([])
  }, TIMEOUT)
})

// ═══ missingPart10 ══════════════════════════════════════════════════════════

describe('missingPart10 oracle', () => {
  const { def, canon, built } = sweep('missingPart10')

  it('has SPEC §2.2’s 36 facts: every a + ? = c with 1 ≤ a < c ≤ 9, ids mp:<a>+?=<c>, answers c − a', () => {
    const want = new Set<string>()
    for (let c = 2; c <= 9; c++) for (let a = 1; a < c; a++) want.add(`mp:${a}+?=${c}`)
    expect(new Set(canon.map((f) => f.id))).toEqual(want)
    expect(canon.length).toBe(36)
    expect(first(idChecks(def, canon, /^mp:\d+\+\?=\d+$/, (id) => {
      const q = missingPart10Of(id)
      return q && { family: 'missing', answer: q.answer }
    }))).toEqual([])
    for (const f of canon) expect(masteryKeyOf(def, f)).toBe(f.id)
  })

  it('asks what the id says: the card and the voice both give the task’s answer', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const q = missingPart10Of(fact.id)!
      if (cardAnswer(task.prompt) !== q.answer || task.answer !== q.answer) problems.push(`${fact.id} ${kind}: card ${cardAnswer(task.prompt)}, task ${String(task.answer)}`)
      const heard = spokenAnswer(task)
      if (heard.answer !== q.answer || heard.problems.length) problems.push(`${fact.id} ${kind}: heard ${heard.answer} ${heard.problems}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards inside 0–20 and shows equalsAsAnswer (a + c) whenever it fits on a card', () => {
    expect(first(genericProblems(built))).toEqual([])
    const explain = (b: Built, v: AnswerValue) => {
      const q = missingPart10Of(b.fact.id)!
      return explainMissingPart10(q.a, q.c, v)
    }
    expect(first(diagnosticCards(built, (b) => { const q = missingPart10Of(b.fact.id)!; return [q.a + q.c] }, explain))).toEqual([])
  })

  it('classifies every card and typed value by pædagogik §3.2 (a + c is equalsAsAnswer, never a number of the question)', () => {
    const explain = (b: Built, v: AnswerValue) => {
      const q = missingPart10Of(b.fact.id)!
      return explainMissingPart10(q.a, q.c, v)
    }
    expect(first(classifyAll(built, explain))).toEqual([])
    // SPEC §4.3: the opportunities are what the cards or keys can show
    expect(first(detectableChecks(built, explain))).toEqual([])
  })

  it('has SPEC’s production kinds and ceilings (keypad 0–20: 1 in 21, box 5; cards box 3)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(numberWordProblems(built))).toEqual([])
    expect(first(canon.flatMap((f) => hintProblems(def, f, tagsToHint(def, canon))))).toEqual([])
  })

  it('says only true arithmetic in every strategy hint, for every tag and kind', () => {
    const tags = [...tagsToHint(def, canon), 'digitSwap' as const]
    expect(first(hintArithmetic(def, canon, tags))).toEqual([])
    expect(first(animationChecks(def, canon, tags))).toEqual([])
  })
})

// ═══ skipCount ══════════════════════════════════════════════════════════════

describe('skipCount oracle', () => {
  const { def, canon, instances, drawn, built } = sweep('skipCount')
  const rowOf = (f: Pick<Fact, 'id'>) => skipRowOf(f.id)!

  it('has SPEC §2.2’s seven families (step100 in 2. kl., step25 in 3. kl.) and 20 canonical instances each (all, when fewer)', () => {
    const fams = def.families.map((f) => `${f.id}${f.grade !== undefined ? `:${f.grade}` : ''}`)
    expect(fams.sort()).toEqual(['back10', 'step10', 'step100:2', 'step10offset', 'step2', 'step25:3', 'step5'])
    for (const fam of def.families) {
      const own = canon.filter((f) => f.family === fam.id)
      const seen = new Set([...own, ...(instances.get(fam.id) ?? [])].map((f) => f.id))
      expect(own.length, fam.id).toBe(Math.min(20, seen.size))
      expect(distinctIds(own), fam.id).toBe(own.length)
    }
    // step10 shows 3–5 stones from 0, 10 … 60 with both next stones ≤ 100: 7 + 6 + 5 = 18 rows in all
    const step10 = new Set<string>()
    for (let start = 0; start <= 100; start += 10) for (let shown = 3; shown <= 5; shown++) if (start + (shown + 1) * 10 <= 100) step10.add(`skc:step10:${start}:${shown}`)
    expect(new Set(canon.filter((f) => f.family === 'step10').map((f) => f.id))).toEqual(step10)
  })

  it('names one row of stones per id, by the family’s rule, and the answer is the next stone', () => {
    const oracle = (id: string) => {
      const r = skipRowOf(id)
      return r && { family: r.family, answer: skipNext(r, 1)[0] }
    }
    expect(first(idChecks(def, [...canon, ...drawn], /^skc:[A-Za-z0-9]+:\d+:\d+$/, oracle))).toEqual([])
    // instance ids name the instance: 200 draws give many different rows, each of its own family
    for (const [fam, facts] of instances) {
      expect(facts.every((f) => f.family === fam), fam).toBe(true)
      expect(distinctIds(facts), fam).toBeGreaterThanOrEqual(8)
    }
    expect(first(avoidChecks(def, instances))).toEqual([])
  })

  it('answers every task as the stones and the voice say: the same hop, on from the last stone (two for fillSlots)', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const r = rowOf(fact)
      const k = kind === 'fillSlots' ? 2 : 1
      const want = skipNext(r, k)
      const cells = sceneOf(task.prompt, 'row').cells
      const blind = continueStones(cells, k)
      const where = `${fact.id} ${kind}`
      if (cells.filter((c) => c === null).length !== k) problems.push(`${where}: ${cells.filter((c) => c === null).length} empty stones for ${k} answers`)
      if (JSON.stringify(cells.filter((c) => c !== null)) !== JSON.stringify(r.row)) problems.push(`${where}: stones ${JSON.stringify(cells)}, the id says ${r.row}`)
      if (!blind || blind.join('|') !== want.join('|')) problems.push(`${where}: the stones give ${blind}, the id ${want}`)
      if (String(task.answer) !== want.join('|')) problems.push(`${where}: answer ${String(task.answer)}, oracle ${want.join('|')}`)
      // the voice reads the stones, number by number
      const said = numbersIn(sentences(spokenText(task.speech))[0])
      if (said.join() !== r.row.join()) problems.push(`${where}: says ${said}, the stones are ${r.row}`)
      for (const v of want) if (v < task.range[0] || v > task.range[1]) problems.push(`${where}: ${v} outside ${task.range}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards and a palette that holds both answers and the skipStepOne pair (5–6 numbers)', () => {
    expect(first(genericProblems(built))).toEqual([])
    const problems: string[] = []
    for (const { fact, task } of built) {
      if (task.kind !== 'fillSlots') continue
      const r = rowOf(fact)
      const last = r.row[r.row.length - 1]
      const s = Math.sign(r.step)
      for (const v of [last + s, last + 2 * s]) if (!task.options.includes(v)) problems.push(`${fact.id}: the skipStepOne ${v} is not on the palette`)
      if (task.options.length < 5) problems.push(`${fact.id}: a palette of ${task.options.length}`)
    }
    expect(first(problems)).toEqual([])
    const explain = (b: Built, v: AnswerValue) => explainSkip(rowOf(b.fact), v)
    expect(first(diagnosticCards(built, (b) => { const r = rowOf(b.fact); return [r.row[r.row.length - 1] + Math.sign(r.step)] }, explain))).toEqual([])
  })

  it('keeps every palette number inside the skill’s range (step10/step10offset 0–100, step100 0–1000, step25 0–300)', () => {
    // GENERATOR BUG (skipCount.ts palette()) — Rettet: the near numbers are the two answers + 1, so when the
    // second answer is the family's top the palette offered one past it: skc:step10:60:3 [81, 82, 90, 91, 100,
    // 101], skc:step100:500:4 [801, 802, 900, 901, 1000, 1001], skc:step25:200:3 [251, 252, 275, 276, 300, 301].
    // Now the palette keeps to the family's range (five numbers there, the skipStepOne pair among them).
    const problems: string[] = []
    for (const { fact, task } of built) {
      if (task.kind !== 'fillSlots') continue
      const out = task.options.filter((o) => typeof o !== 'number' || o < task.range[0] || o > task.range[1])
      if (out.length) problems.push(`${fact.id}: palette [${task.options}] has ${out} outside ${task.range.join('–')}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('classifies cards, typed values and every filling: skipStepOne on in ones, the stones as operands, A11 on a typed swap', () => {
    expect(first(classifyAll(built, (b, v) => explainSkip(rowOf(b.fact), v)))).toEqual([])
    expect(first(detectableChecks(built, (b, v) => explainSkip(rowOf(b.fact), v)))).toEqual([])
  })

  it('has SPEC’s production kinds and ceilings (keypad and fillSlots box 5, cards box 3)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(numberWordProblems(built))).toEqual([])
    expect(first(canon.flatMap((f) => hintProblems(def, f, tagsToHint(def, canon))))).toEqual([])
  })

  it('says only true arithmetic in every strategy hint (and "Svaret er" the answer), for every tag and kind, also on drawn instances', () => {
    const tags = [...tagsToHint(def, canon), 'digitSwap' as const]
    expect(first(hintArithmetic(def, [...canon, ...drawn.filter((_, i) => i % 5 === 0)], tags))).toEqual([])
    // SPEC §4.3: equalsAsAnswer and digitSwap hints are animated, the others are not
    expect(first(animationChecks(def, canon, tags))).toEqual([])
  })
}, TIMEOUT)

// ═══ equalSides ═════════════════════════════════════════════════════════════

describe('equalSides oracle', () => {
  const { def, canon, instances, drawn, built } = sweep('equalSides')
  const eq = (f: Pick<Fact, 'id'>) => equalSidesOf(f.id)!

  it('has SPEC §2.2’s four families (balanceSub and balanceMixed in 3. kl.), 20 canonical instances each', () => {
    const fams = def.families.map((f) => `${f.id}${f.grade !== undefined ? `:${f.grade}` : ''}`)
    expect(fams.sort()).toEqual(['balanceAdd', 'balanceMixed:3', 'balanceSub:3', 'trueFalse'])
    for (const fam of def.families) expect(canon.filter((f) => f.family === fam.id).length, fam.id).toBe(20)
  })

  it('names one true equation per id, of the family’s shape, numbers to 20, and the answer balances it', () => {
    const oracle = (id: string) => {
      const e = equalSidesOf(id)
      const x = e && equalSidesAnswer(e)
      return e && x !== null ? { family: e.family, answer: x } : null
    }
    expect(first(idChecks(def, [...canon, ...drawn], /^eqs:(tf|add|sub|mix):[0-9_+-]+=[0-9_+-]+:\d+$/, oracle))).toEqual([])
    const problems: string[] = []
    for (const f of [...canon, ...drawn]) {
      const e = eq(f)
      if (!equalSidesShapeOk(e)) problems.push(`${f.id}: not a ${e.family} equation`)
      const nums = [...e.left, ...e.right, f.answer].filter((x): x is number => typeof x === 'number')
      if (nums.some((n) => n < 0 || n > 20)) problems.push(`${f.id}: a number outside 0–20`)
    }
    expect(first(problems)).toEqual([])
    for (const [fam, facts] of instances) expect(distinctIds(facts), fam).toBeGreaterThanOrEqual(20)
    expect(first(avoidChecks(def, instances))).toEqual([])
  })

  it('answers every task from the seesaw and the voice: the balancing number, or whether the shown sides weigh the same', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const e = eq(fact)
      const x = equalSidesAnswer(e)!
      const where = `${fact.id} ${kind}`
      const sides = balanceTokens(task.prompt)
      if (!sides) {
        problems.push(`${where}: not a balance`)
        continue
      }
      if (kind === 'trueFalse') {
        if (sides[0].includes('?') || sides[1].includes('?')) problems.push(`${where}: a blank on a true/false card`)
        const same = statementTrue([...sides[0], '=', ...sides[1]])
        const want = same ? 'yes' : 'no'
        if (task.answer !== want || want !== (e.shown === x ? 'yes' : 'no')) problems.push(`${where}: answer ${String(task.answer)}, the seesaw says ${want}`)
        const said = statementTrue(spokenTokens(sentences(spokenText(task.speech))[0]))
        if (said !== same) problems.push(`${where}: the voice says sides that ${said ? 'balance' : 'do not balance'}`)
      } else {
        if (cardAnswer(task.prompt) !== x || task.answer !== x) problems.push(`${where}: card ${cardAnswer(task.prompt)}, task ${String(task.answer)}, oracle ${x}`)
        const heard = spokenAnswer(task)
        if (heard.answer !== x || heard.problems.length) problems.push(`${where}: heard ${heard.answer} ${heard.problems}`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards and shows equalsAsAnswer whenever it fits on a card and counts', () => {
    expect(first(genericProblems(built))).toEqual([])
    const explain = (b: Built, v: AnswerValue) => explainBalance(b.task, v)
    expect(first(diagnosticCards(built, (b) => (b.kind === 'choice' ? equalsAsAnswerValues(balanceTokens(b.task.prompt)!) : []), explain))).toEqual([])
  })

  it('classifies cards and typed values by pædagogik §3.2; a whole-side value that is on the card is ambiguous (A9)', () => {
    expect(first(classifyAll(built, (b, v) => explainBalance(b.task, v)))).toEqual([])
    expect(first(detectableChecks(built, (b, v) => explainBalance(b.task, v)))).toEqual([])
    // the trap "7 + 2 = 9 + □": 9 is the side's value and on the card
    const traps = built.filter((b) => b.kind === 'keypad' && equalsAsAnswerValues(balanceTokens(b.task.prompt)!).some((v) => cardNumbers(b.task.prompt).includes(v) && v !== b.task.answer))
    expect(traps.length).toBeGreaterThan(0)
  })

  it('tags the wrong true/false judgment equalsAsAnswer exactly when "the answer comes now" gives it', () => {
    const problems: string[] = []
    let tagged = 0
    for (const { fact, task } of built) {
      if (task.kind !== 'trueFalse') continue
      const wrong = task.answer === 'yes' ? 'no' : 'yes'
      const reader = answerComesNowSays(balanceTokens(task.prompt)!)
      const want = reader === wrong ? 'equalsAsAnswer' : 'plain'
      const got = task.distractorTags[wrong]
      if (want === 'equalsAsAnswer' ? got !== want : got === 'equalsAsAnswer') problems.push(`${fact.id}: "${wrong}" is ${String(got)}, the reader says ${reader}`)
      if (want === 'equalsAsAnswer') tagged++
    }
    expect(first(problems)).toEqual([])
    expect(tagged).toBeGreaterThan(0)
  })

  it('has SPEC’s production kinds and ceilings (keypad box 5, cards box 3, true/false box 2)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(numberWordProblems(built))).toEqual([])
    expect(first(canon.flatMap((f) => hintProblems(def, f, tagsToHint(def, canon))))).toEqual([])
  })

  it('says only true arithmetic in every strategy hint (and "Svaret er" the answer), for every tag and kind, also on drawn instances', () => {
    const tags = [...tagsToHint(def, canon), 'digitSwap' as const]
    expect(first(hintArithmetic(def, [...canon, ...drawn.filter((_, i) => i % 5 === 0)], tags))).toEqual([])
    // SPEC §4.3: equalsAsAnswer and digitSwap hints are animated, the others are not
    expect(first(animationChecks(def, canon, tags))).toEqual([])
  })
}, TIMEOUT)

/** equalSides: a typed or card value against the seesaw on the card; a true/false judgment against the reader. */
function explainBalance(t: Task, v: AnswerValue): Expl {
  const sides = balanceTokens(t.prompt)!
  if (t.kind === 'trueFalse') return { mis: answerComesNowSays(sides) === v ? ['equalsAsAnswer'] : [] }
  return { mis: equalsAsAnswerValues(sides).includes(v as number) ? ['equalsAsAnswer'] : [], operand: cardNumbers(t.prompt).includes(v as number) }
}

// ═══ inverseOps ═════════════════════════════════════════════════════════════

describe('inverseOps oracle', () => {
  const { def, canon, instances, drawn, built } = sweep('inverseOps')
  const inv = (f: Pick<Fact, 'id'>) => inverseOf(f.id)!

  it('has SPEC §2.2’s three families (mulToDiv in 3. kl.), 20 canonical instances each', () => {
    const fams = def.families.map((f) => `${f.id}${f.grade !== undefined ? `:${f.grade}` : ''}`)
    expect(fams.sort()).toEqual(['addToSub', 'mulToDiv:3', 'subToAdd'])
    for (const fam of def.families) expect(canon.filter((f) => f.family === fam.id).length, fam.id).toBe(20)
  })

  it('names a known fact and its inverse per id (one family of numbers), and the answer is the asked number', () => {
    const oracle = (id: string) => {
      const q = inverseOf(id)
      return q && { family: q.family, answer: inverseAnswer(q) }
    }
    expect(first(idChecks(def, [...canon, ...drawn], /^inv:\d+[+x-]\d+:\d+[-+/]\d+$/, oracle))).toEqual([])
    const problems = [...canon, ...drawn].filter((f) => Math.max(...cardNumbersOfId(f.id)) > 100).map((f) => `${f.id}: over 100`)
    expect(first(problems)).toEqual([])
    for (const [fam, facts] of instances) expect(distinctIds(facts), fam).toBeGreaterThanOrEqual(20)
    expect(first(avoidChecks(def, instances))).toEqual([])
  })

  it('answers every task from the card and the voice: the known fact is true, the asked one solved', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const x = inverseAnswer(inv(fact))
      const where = `${fact.id} ${kind}`
      const eqs = task.prompt.scene === 'equation' ? (sceneOf(task.prompt, 'equation').terms.some((t) => 'text' in t) ? 2 : 1) : 0
      if (eqs !== 2) problems.push(`${where}: the card does not show the known fact and the asked one`)
      const known = cardKnown(task)
      if (known !== true) problems.push(`${where}: the known fact on the card is ${known === false ? 'false' : 'not an equation'}`)
      if (cardAnswer(task.prompt) !== x || task.answer !== x) problems.push(`${where}: card ${cardAnswer(task.prompt)}, task ${String(task.answer)}, oracle ${x}`)
      const heard = spokenAnswer(task)
      if (heard.answer !== x || heard.problems.length) problems.push(`${where}: heard ${heard.answer} ${heard.problems}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards inside 0–100 and shows wrongOperation whenever it fits on a card and counts', () => {
    expect(first(genericProblems(built))).toEqual([])
    const explain = (b: Built, v: AnswerValue) => explainInverse(b.task, v)
    expect(first(diagnosticCards(built, (b) => inverseWrongOps(inv(b.fact)), explain))).toEqual([])
  })

  it('classifies cards and typed values: wrongOperation; on a number of the card it is ambiguous (A9), on the reversed answer too (A11)', () => {
    expect(first(classifyAll(built, (b, v) => explainInverse(b.task, v)))).toEqual([])
    expect(first(detectableChecks(built, (b, v) => explainInverse(b.task, v)))).toEqual([])
  })

  it('has SPEC’s production kinds and ceilings (keypad box 5, cards box 3)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(numberWordProblems(built))).toEqual([])
    expect(first(canon.flatMap((f) => hintProblems(def, f, tagsToHint(def, canon))))).toEqual([])
  })

  it('says only true arithmetic in every strategy hint (and "Svaret er" the answer), for every tag and kind, also on drawn instances', () => {
    const tags = [...tagsToHint(def, canon), 'digitSwap' as const]
    expect(first(hintArithmetic(def, [...canon, ...drawn.filter((_, i) => i % 5 === 0)], tags))).toEqual([])
    // SPEC §4.3: equalsAsAnswer and digitSwap hints are animated, the others are not
    expect(first(animationChecks(def, canon, tags))).toEqual([])
  })
}, TIMEOUT)

const cardNumbersOfId = (id: string): number[] => (id.match(/\d+/g) ?? []).map(Number)

/** Is the first equation on an inverseOps card true? */
function cardKnown(t: Task): boolean | null {
  if (t.prompt.scene !== 'equation') return null
  const terms = t.prompt.terms
  const cut = terms.findIndex((x) => 'text' in x)
  if (cut < 0) return null
  const toks = terms.slice(0, cut).map((x) => ('n' in x ? x.n : 'op' in x ? x.op : '?'))
  return statementTrue(toks as Parameters<typeof statementTrue>[0])
}

function explainInverse(t: Task, v: AnswerValue): Expl {
  return { mis: inverseWrongOps(inverseOf(t.factId)!).includes(v as number) ? ['wrongOperation'] : [], operand: cardNumbers(t.prompt).includes(v as number) }
}

// ═══ missingPart100 ═════════════════════════════════════════════════════════

describe('missingPart100 oracle', () => {
  const { def, canon, instances, drawn, built } = sweep('missingPart100')
  const mq = (f: Pick<Fact, 'id'>) => missing100Of(f.id)!

  it('has SPEC §2.2’s four families (addendCross20, toHundred, subtrahend, minuend), 20 canonical instances each', () => {
    expect(def.families.map((f) => f.id).sort()).toEqual(['addendCross20', 'minuend', 'subtrahend', 'toHundred'])
    for (const fam of def.families) expect(canon.filter((f) => f.family === fam.id).length, fam.id).toBe(20)
  })

  it('names one equation per id, of its family (a ten crossed, up to a hundred, the part or the start missing), numbers to 100', () => {
    const oracle = (id: string) => {
      const q = missing100Of(id)
      const x = q && solveTokens(missing100Tokens(q))
      return q && x !== null ? { family: q.family, answer: x } : null
    }
    expect(first(idChecks(def, [...canon, ...drawn], /^mp100:(\d+|\?)[+-](\d+|\?)=(\d+|\?)$/, oracle))).toEqual([])
    const problems: string[] = []
    for (const f of [...canon, ...drawn]) {
      const q = mq(f)
      const x = f.answer as number
      if (Math.max(...missing100Numbers(q), x) > 100 || x < 1) problems.push(`${f.id}: outside 1–100`)
      if (q.family === 'addendCross20' && ((q.a % 10) + (x % 10) < 10 || q.c < 21 || q.a < 10)) problems.push(`${f.id}: no ten crossed`)
      if (q.family === 'toHundred' && (q.a < 10 || q.a > 90)) problems.push(`${f.id}: not a two-digit number to a hundred`)
    }
    expect(first(problems)).toEqual([])
    for (const [fam, facts] of instances) expect(distinctIds(facts), fam).toBeGreaterThanOrEqual(20)
    expect(first(avoidChecks(def, instances))).toEqual([])
  })

  it('answers every task as the card and the voice say', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const x = solveTokens(missing100Tokens(mq(fact)))
      const where = `${fact.id} ${kind}`
      if (cardAnswer(task.prompt) !== x || task.answer !== x) problems.push(`${where}: card ${cardAnswer(task.prompt)}, task ${String(task.answer)}, oracle ${x}`)
      const heard = spokenAnswer(task)
      if (heard.answer !== x || heard.problems.length) problems.push(`${where}: heard ${heard.answer} ${heard.problems}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards inside 0–100 and shows a misconception card whenever one fits and counts', () => {
    expect(first(genericProblems(built))).toEqual([])
    const explain = (b: Built, v: AnswerValue) => explainMissing100(b.task, v)
    expect(first(diagnosticCards(built, (b) => missing100Mis(mq(b.fact)).map(([v]) => v), explain))).toEqual([])
  })

  it('classifies cards and typed values (137 can be typed): equalsAsAnswer, digitComplement10, wrongOperation, with A9 and A11', () => {
    expect(first(classifyAll(built, (b, v) => explainMissing100(b.task, v)))).toEqual([])
    expect(first(detectableChecks(built, (b, v) => explainMissing100(b.task, v)))).toEqual([])
    // 55 + ? = 100 → 55 is digitComplement10 and the number of the question: ambiguous, never evidence
    const fifty5 = built.filter((b) => b.kind === 'keypad' && /^mp100:(55\+\?=100|100-55=\?)$/.test(b.fact.id))
    for (const b of fifty5) expect(wantTag(b.task, 55, explainMissing100(b.task, 55))).toBe('ambiguous')
  })

  it('has SPEC’s production kinds and ceilings (keypad box 5, cards box 3)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(numberWordProblems(built))).toEqual([])
    expect(first(canon.flatMap((f) => hintProblems(def, f, tagsToHint(def, canon))))).toEqual([])
  })

  it('says only true arithmetic in every strategy hint (and "Svaret er" the answer), for every tag and kind, also on drawn instances', () => {
    const tags = [...tagsToHint(def, canon), 'digitSwap' as const]
    expect(first(hintArithmetic(def, [...canon, ...drawn.filter((_, i) => i % 5 === 0)], tags))).toEqual([])
    // SPEC §4.3: equalsAsAnswer and digitSwap hints are animated, the others are not
    expect(first(animationChecks(def, canon, tags))).toEqual([])
  })
}, TIMEOUT)

function explainMissing100(t: Task, v: AnswerValue): Expl {
  const q = missing100Of(t.factId)!
  return { mis: missing100Mis(q).filter(([x]) => x === v).map(([, m]) => m), operand: missing100Numbers(q).includes(v as number) }
}
