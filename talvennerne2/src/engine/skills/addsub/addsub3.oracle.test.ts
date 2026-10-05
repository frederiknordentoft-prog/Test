// Oracle tests for add1000 and sub1000 (SPEC §2.2, §3, §4.1 with A9/A11, §10.1, §15.1), ORK3a, against
// addsub3.oracle.ts and the wave-1/2 kits. The borrow film (ui/hint/Columns.tsx regroupPlan) is checked
// on every three-digit subtraction of sub1000's families, step by step.
import { describe, expect, it } from 'vitest'
import { classifyAnswer } from '../../misconceptions'
import { defaultFastMs } from '../../kinds'
import { masteryKeyOf } from '../../tasks'
import type { ErrorTag, Fact, Task } from '../../types'
import { regroupPlan } from '../../../ui/hint/Columns'
import {
  answerProblems, cardProblems, first, hintProblems, registeredSkill, sceneOf, spokenText, tagsToHint, taskSpeechProblems, tasksOf,
  type Built,
} from '../number/number.oracle'
import { numberWordProblems } from '../number/number2.oracle'
import {
  animationChecks, cardAnswer, diagnosticCards, hintArithmetic, idChecks, productionChecks, specKindChecks, spokenAnswer, typedSwapOf,
} from '../algebra/algebra2.oracle'
import {
  add1000Family, classify3, detectable3, digit, onNumbers, explainSum, filmProblems, firstExchangeTakes, freshDraws, instances3, minusSaidProblems,
  minusWalk, plusSaidProblems, plusWalk, readColumns, sub1000Family, sum3Of, sumMis, type Sum3,
} from './addsub3.oracle'

const TIMEOUT = 300_000

const FAMILIES = {
  add1000: ['HTOplusOcarry', 'HTOplusTO', 'HTOplusTOcarry1', 'HTOplusTOcarry10', 'HTOplusHTO', 'HTOplusHTOcarry'],
  sub1000: ['HTOminusOborrow', 'HTOminusTO', 'HTOminusTOborrow', 'HTOminusHTO', 'HTOminusHTOborrow', 'acrossZero'],
} as const

type Skill3 = keyof typeof FAMILIES

const familyOf = (skill: Skill3, s: Sum3): string | null => (skill === 'add1000' ? add1000Family(s.a, s.b) : sub1000Family(s.a, s.b))

function setup(skill: Skill3) {
  const def = registeredSkill(skill)
  const canon = def.enumerate()
  const drawn = instances3(def)
  const instances = [...drawn.values()].flat()
  // the canonical facts with four card deals each (plus one aimed at each misconception), and every
  // instance once per kind
  const built: Built[] = [...tasksOf(def, canon, 4), ...tasksOf(def, instances, 1)]
  return { def, canon, drawn, instances, built }
}

const sumOfTask = (b: Built): Sum3 => sum3Of(b.fact.id)!
const why = (b: Built, v: number) => explainSum(sumOfTask(b), v)
/** The values the oracle explains: its misconception values and the two numbers of the question. */
const specials = (b: Built): number[] => {
  const s = sumOfTask(b)
  return [...sumMis(s).map(([v]) => v), s.a, s.b]
}

/** SPEC §3.2: choice 5 s + 1.5 s per digit over one, keypad 25 s in add1000 and sub1000. */
const specFast = (t: Task): number => (t.kind === 'keypad' ? 25_000 : 5_000 + 1_500 * (String(t.answer).length - 1))

function sharedChecks(skill: Skill3, ctx: ReturnType<typeof setup>) {
  const { def, canon, drawn, instances, built } = ctx
  const all = [...canon, ...instances]

  it(`has SPEC §2.2's six families, 20 canonical facts each (SPEC §2.4), and every fact and 200 instances per family read off its id`, () => {
    expect(def.families.map((f) => f.id)).toEqual([...FAMILIES[skill]])
    expect(def.mode).toBe('procedure')
    for (const fam of FAMILIES[skill]) expect(canon.filter((f) => f.family === fam).length, fam).toBe(20)
    const format = skill === 'add1000' ? /^a1000:\d+\+\d+$/ : /^s1000:\d+-\d+$/
    expect(first(idChecks(def, all, format, (id) => {
      const s = sum3Of(id)
      const family = s && familyOf(skill, s)
      return s && family ? { family, answer: s.answer } : null
    }))).toEqual([])
    for (const f of all) expect(masteryKeyOf(def, f)).toBe(`${skill}/${f.family}`)
    // every sum stays inside 0–999 and both numbers are on the card as written
    expect(first(all.filter((f) => typeof f.answer !== 'number' || f.answer < 0 || f.answer > 999).map((f) => f.id))).toEqual([])
  })

  it('draws a fresh instance every time while the family has one left (SPEC §5.1), and instance ids never name two sums', () => {
    const problems: string[] = []
    for (const fam of FAMILIES[skill]) {
      const ids = freshDraws(def, fam, 200)
      if (new Set(ids).size !== ids.length) problems.push(`${fam}: ${ids.length - new Set(ids).size} repeats in 200 draws with avoid`)
      for (const id of ids) {
        const s = sum3Of(id)
        if (!s || familyOf(skill, s) !== fam) problems.push(`${fam}: drew ${id}`)
      }
    }
    expect(first(problems)).toEqual([])
    // the same 200 draws without avoid: one id, one sum, one family
    const seen = new Map<string, string>()
    for (const [fam, facts] of drawn) {
      for (const f of facts) {
        const prev = seen.get(f.id)
        if (prev && prev !== fam) problems.push(`${f.id} in ${prev} and ${fam}`)
        seen.set(f.id, fam)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('shows the sum on the card (a op b = □) and says it ("Hvad er … plus/minus …?"): card and voice give the answer', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const s = sum3Of(fact.id)!
      const where = `${fact.id} ${kind}`
      const terms = sceneOf(task.prompt, 'equation').terms
      const want = JSON.stringify([{ n: s.a }, { op: s.op }, { n: s.b }, { op: '=' }, { blank: true }])
      if (JSON.stringify(terms) !== want) problems.push(`${where}: card ${JSON.stringify(terms)}`)
      if (cardAnswer(task.prompt) !== s.answer || task.answer !== s.answer) problems.push(`${where}: card ${cardAnswer(task.prompt)}, task ${String(task.answer)}`)
      const heard = spokenAnswer(task)
      if (heard.answer !== s.answer || heard.problems.length > 0) problems.push(`${where}: heard ${heard.answer} ${heard.problems}`)
      if (!/^Hvad er .+ (plus|minus) .+\?$/.test(spokenText(task.speech))) problems.push(`${where}: "${spokenText(task.speech)}"`)
    }
    expect(first(problems)).toEqual([])
    expect(first(numberWordProblems(built))).toEqual([])
  })

  it('deals three valid cards inside 0–1000 (one right, all tagged and classified as tagged, one idea per set) and a diagnostic card whenever one counts', () => {
    expect(first(built.flatMap((b) => [...answerProblems(b.task), ...cardProblems(b.task, (c) => c >= 0 && c <= 1000)]))).toEqual([])
    expect(first(diagnosticCards(built, (b) => sumMis(sumOfTask(b)).map(([v]) => v), onNumbers(why)))).toEqual([])
  })

  it('classifies every card and every value the four keys take by pædagogik §3.2, with A9 and A11', () => {
    expect(first(classify3(built, why, specials))).toEqual([])
  })

  it('counts as an opportunity (detectableOf) exactly the misconceptions its cards or keys can show', () => {
    expect(first(detectable3(built, why, specials))).toEqual([])
  })

  it('has SPEC’s production kinds and ceilings (keypad 0–1000 box 5, cards box 3) and SPEC §3.2’s speed (keypad 25 s)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const ms = def.fastMs?.(fact, kind) ?? defaultFastMs(task)
      // keypad as SPEC §3.2 lists it; a family may give cards more time (as 2. klasse does), never less
      if (kind === 'keypad' ? ms !== specFast(task) : ms < specFast(task)) problems.push(`${fact.id} ${kind}: ${ms} ms, SPEC ${specFast(task)}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits, numbers as SPEC §10.1 says them', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    const tags = [...tagsToHint(def, canon), 'digitSwap' as ErrorTag]
    expect(first(all.slice(0, 400).flatMap((f) => hintProblems(def, f, tags)))).toEqual([])
  })

  it('gives each misconception its own hint, animated exactly as SPEC §4.3 lists, and only true arithmetic', () => {
    const tags = [...tagsToHint(def, canon), 'digitSwap' as ErrorTag]
    expect(first(animationChecks(def, all, tags))).toEqual([])
    expect(first(hintArithmetic(def, all, tags))).toEqual([])
    const problems: string[] = []
    for (const f of canon) {
      for (const tag of tags) {
        const h = def.hint(f, tag)
        const own = tag !== null && !['near', 'operand', 'other', 'ambiguous'].includes(tag)
        if (own && h.misconception !== tag) problems.push(`${f.id} hint(${tag}): the standard hint`)
        if (!own && h.misconception !== undefined) problems.push(`${f.id} hint(${String(tag)}): the ${h.misconception} hint`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('pictures the fact’s own sum in the columns (with the carry or exchange drawn exactly when there is one), digitSwap as the answer’s blocks', () => {
    const problems: string[] = []
    for (const f of all) {
      const s = sum3Of(f.id)!
      const regroup = s.op === '+' ? plusWalk(s.a, s.b).some((c) => c.carries) : minusWalk(s.a, s.b).cols.some((c) => c.exchange !== null)
      for (const tag of [...tagsToHint(def, canon)]) {
        const v = def.hint(f, tag).visual
        const want = { scene: 'columns', a: s.a, b: s.b, op: s.op, carry: regroup }
        if (JSON.stringify(v) !== JSON.stringify(want)) problems.push(`${f.id} hint(${String(tag)}): ${JSON.stringify(v)}`)
      }
      const swap = def.hint(f, 'digitSwap').visual
      const n = s.answer
      if (swap.scene !== 'base' || swap.h !== digit(n, 2) || swap.t !== digit(n, 1) || swap.o !== digit(n, 0)) problems.push(`${f.id} hint(digitSwap): ${JSON.stringify(swap)}`)
    }
    expect(first(problems)).toEqual([])
  })
}

// ═══ add1000 ════════════════════════════════════════════════════════════════

describe('add1000 oracle', () => {
  const ctx = setup('add1000')
  sharedChecks('add1000', ctx)
  const { def, canon, instances, built } = ctx

  it('reaches the cases the families are about: one carry and two in HTOplusHTOcarry, the ones carrying or not in HTOplusTOcarry10, b = 2–9', () => {
    // a bigger sample than the 200: b = 2 needs a's ones 8 or 9, about one draw in forty
    const cases = (fam: string) => freshDraws(def, fam, 2_000).map((id) => sum3Of(id)!)
    const carries = (s: Sum3) => plusWalk(s.a, s.b).filter((c) => c.carries).length
    expect(new Set(cases('HTOplusHTOcarry').map(carries))).toEqual(new Set([1, 2]))
    expect(new Set(cases('HTOplusTOcarry10').map(carries))).toEqual(new Set([1, 2]))
    expect(new Set(cases('HTOplusOcarry').map((s) => s.b))).toEqual(new Set([2, 3, 4, 5, 6, 7, 8, 9]))
  })

  it('classifies the textbook cases: 378 + 45 → 313 forgotCarry, 247 + 6 → 307 placeMisalign, 247 + 6 → 241 wrongOperation, 247 typed back as an operand', () => {
    const typed = (a: number, b: number) => {
      const fact: Fact = { id: `a1000:${a}+${b}`, skill: 'add1000', family: add1000Family(a, b)!, operands: [a, b], answer: a + b, rank: 0 }
      return tasksOf(def, [fact], 1).find((x) => x.kind === 'keypad')!.task
    }
    expect(classifyAnswer(typed(378, 45), 313)).toBe('forgotCarry')
    expect(classifyAnswer(typed(247, 6), 307)).toBe('placeMisalign')
    expect(classifyAnswer(typed(247, 6), 243)).toBe('forgotCarry')
    expect(classifyAnswer(typed(247, 6), 241)).toBe('wrongOperation')
    expect(classifyAnswer(typed(247, 6), 247)).toBe('operand')
    // 146 + 8 = 154 typed as 145: the tens and ones swapped (SPEC §4.1 globalChecks), a slip
    expect(typedSwapOf(typed(146, 8))).toBe(145)
    expect(classifyAnswer(typed(146, 8), 145)).toBe('digitSwap')
  })

  it('says the columns right: each column’s digits and the ten carried in, "goes over" exactly where it carries, the answer (every tag)', () => {
    const problems: string[] = []
    for (const f of [...canon, ...instances]) {
      const s = sum3Of(f.id)!
      for (const tag of [null, 'near', 'operand', 'other', 'ambiguous', 'placeMisalign', 'wrongOperation'] as (ErrorTag | null)[]) {
        const said = readColumns(spokenText(def.hint(f, tag).speech))
        for (const p of plusSaidProblems(s.a, s.b, said, 'walk')) problems.push(`${f.id} hint(${String(tag)}): ${p}`)
      }
      for (const p of plusSaidProblems(s.a, s.b, readColumns(spokenText(def.hint(f, 'forgotCarry').speech)), 'rules')) problems.push(`${f.id} hint(forgotCarry): ${p}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('films the carry (regroupPlan) truly for every sum of add1000’s families', () => {
    const problems: string[] = []
    let n = 0
    for (let a = 100; a <= 999; a++) {
      for (let b = 1; a + b <= 999; b++) {
        if (add1000Family(a, b) === null) continue
        n++
        problems.push(...filmProblems(a, b, '+', regroupPlan(a, b, '+')))
        if (problems.length > 20) break
      }
    }
    expect(first(problems)).toEqual([])
    expect(n).toBeGreaterThan(100_000)
  })

  it('keeps its tasks honest about who is tested: cards and keys built for every instance', () => {
    expect(built.filter((b) => b.kind === 'keypad').length).toBeGreaterThanOrEqual(1_200)
  })
}, TIMEOUT)

// ═══ sub1000 ════════════════════════════════════════════════════════════════

describe('sub1000 oracle', () => {
  const ctx = setup('sub1000')
  sharedChecks('sub1000', ctx)
  const { def, canon, drawn, instances } = ctx

  it('reaches the cases the families are about: across a zero with a one-, two- and three-digit b, one exchange and two (also two in a row)', () => {
    const cases = (fam: string) => drawn.get(fam)!.map((f) => sum3Of(f.id)!)
    expect(new Set(cases('acrossZero').map((s) => String(s.b).length))).toEqual(new Set([1, 2, 3]))
    const exchanges = (s: Sum3) => minusWalk(s.a, s.b).cols.filter((c) => c.exchange !== null).length
    // two in a row: the tens lend to the ones and are then too few themselves (512 − 278: 1 → 0 → 10)
    const inARow = (s: Sum3) => minusWalk(s.a, s.b).marks[1].map((m) => m.kind).join() === 'lent,got'
    for (const fam of ['HTOminusTOborrow', 'HTOminusHTOborrow']) {
      expect(new Set(cases(fam).map(exchanges)), fam).toEqual(new Set([1, 2]))
      expect(cases(fam).some(inARow), fam).toBe(true)
    }
    expect(minusWalk(512, 278).marks.map((m) => m.map((x) => `${x.value}${x.kind}`))).toEqual([['12got'], ['0lent', '10got'], ['4lent']])
    expect(minusWalk(403, 158).marks.map((m) => m.map((x) => `${x.value}${x.kind}`))).toEqual([['13got'], ['10got', '9lent'], ['3lent']])
  })

  it('classifies the textbook cases: 423 − 158 → 335 and 375, 402 − 7 → 405 ambiguous (both ideas), 243 − 6 → 243 ambiguous (A9)', () => {
    const typed = (a: number, b: number) => {
      const fact: Fact = { id: `s1000:${a}-${b}`, skill: 'sub1000', family: sub1000Family(a, b)!, operands: [a, b], answer: a - b, rank: 0 }
      return tasksOf(def, [fact], 1).find((x) => x.kind === 'keypad')!.task
    }
    expect(classifyAnswer(typed(423, 158), 335)).toBe('smallerFromLarger')
    expect(classifyAnswer(typed(423, 158), 375)).toBe('borrowNoDecrement')
    expect(classifyAnswer(typed(423, 158), 581)).toBe('wrongOperation')
    expect(classifyAnswer(typed(402, 7), 405)).toBe('ambiguous')
    // |3 − 6| = 3: the smaller digit from the larger gives 243, the number on the card
    expect(classifyAnswer(typed(243, 6), 243)).toBe('ambiguous')
    expect(classifyAnswer(typed(999, 7), 1006)).toBe('wrongOperation')
  })

  it('says the columns right: each exchange as it happens (across a zero, two in a row), the digit worked with, the answer (every tag)', () => {
    const problems: string[] = []
    for (const f of [...canon, ...instances]) {
      const s = sum3Of(f.id)!
      for (const tag of [null, 'near', 'operand', 'other', 'ambiguous', 'wrongOperation'] as (ErrorTag | null)[]) {
        const said = readColumns(spokenText(def.hint(f, tag).speech))
        for (const p of minusSaidProblems(s.a, s.b, said, 'walk')) problems.push(`${f.id} hint(${String(tag)}): ${p}`)
      }
      for (const tag of ['smallerFromLarger', 'borrowNoDecrement'] as const) {
        const text = spokenText(def.hint(f, tag).speech)
        for (const p of minusSaidProblems(s.a, s.b, readColumns(text), 'exchanges')) problems.push(`${f.id} hint(${tag}): ${p}`)
      }
      // borrowNoDecrement says first which column has one less: a ten when the ones take from the tens,
      // a hundred when the first exchange takes a hundred (across a zero, or the tens)
      const lead = spokenText(def.hint(f, 'borrowNoDecrement').speech)
      const takes = firstExchangeTakes(s.a, s.b)
      const want = takes === 'ten' ? 'Når du veksler en tier, er der en tier mindre tilbage.' : 'Når du veksler et hundrede, er der et hundrede mindre tilbage.'
      if (takes !== null && !lead.startsWith(want)) problems.push(`${f.id} hint(borrowNoDecrement): "${lead.slice(0, 60)}…"`)
    }
    expect(first(problems)).toEqual([])
  })

  it('says the columns right on every subtraction across a zero and every two exchanges in a row (all of them, not a sample)', () => {
    const problems: string[] = []
    let n = 0
    for (let a = 100; a <= 999; a++) {
      for (let b = 1; b < a; b++) {
        const fam = sub1000Family(a, b)
        if (fam === null) continue
        const walk = minusWalk(a, b)
        const special = walk.cols[0].exchange === 'acrossZero' || walk.marks[1].map((m) => m.kind).join() === 'lent,got'
        if (!special) continue
        n++
        const fact: Fact = { id: `s1000:${a}-${b}`, skill: 'sub1000', family: fam, operands: [a, b], answer: a - b, rank: 0 }
        for (const p of minusSaidProblems(a, b, readColumns(spokenText(def.hint(fact, null).speech)), 'walk')) problems.push(`${fact.id}: ${p}`)
        if (problems.length > 20) break
      }
    }
    expect(first(problems)).toEqual([])
    expect(n).toBeGreaterThan(10_000)
  })

  it('films the exchanges (regroupPlan) truly in every step for every three-digit subtraction of sub1000’s families', () => {
    const problems: string[] = []
    let n = 0
    const seen = new Set<string>()
    for (let a = 100; a <= 999; a++) {
      for (let b = 1; b < a; b++) {
        const fam = sub1000Family(a, b)
        if (fam === null) continue
        n++
        seen.add(fam)
        problems.push(...filmProblems(a, b, '−', regroupPlan(a, b, '−')))
        if (problems.length > 20) break
      }
    }
    expect(first(problems)).toEqual([])
    expect([...seen].sort()).toEqual([...FAMILIES.sub1000].sort())
    expect(n).toBeGreaterThan(100_000)
  })
}, TIMEOUT)

// ═══ The oracle itself ═══════════════════════════════════════════════════════

describe('addsub3 oracle kit (a check of the oracle itself)', () => {
  it('walks the columns the written way', () => {
    expect(plusWalk(378, 45).map((c) => c.sum)).toEqual([13, 12, 4])
    expect(minusWalk(402, 7).cols.map((c) => `${c.top}-${c.y}`)).toEqual(['12-7', '9-0', '3-0'])
    expect(minusWalk(500, 36).cols.map((c) => c.diff)).toEqual([4, 6, 4])
    expect(minusWalk(300, 120).cols.map((c) => c.exchange)).toEqual([null, 'tens', null])
  })

  it('reads the families off the numbers as the contract words them', () => {
    expect([add1000Family(247, 6), add1000Family(342, 25), add1000Family(348, 25), add1000Family(372, 54), add1000Family(234, 352), add1000Family(278, 345)])
      .toEqual(['HTOplusOcarry', 'HTOplusTO', 'HTOplusTOcarry1', 'HTOplusTOcarry10', 'HTOplusHTO', 'HTOplusHTOcarry'])
    expect([sub1000Family(243, 7), sub1000Family(368, 25), sub1000Family(352, 27), sub1000Family(587, 234), sub1000Family(523, 278), sub1000Family(402, 7), sub1000Family(500, 36), sub1000Family(403, 158)])
      .toEqual(['HTOminusOborrow', 'HTOminusTO', 'HTOminusTOborrow', 'HTOminusHTO', 'HTOminusHTOborrow', 'acrossZero', 'acrossZero', 'acrossZero'])
    expect([add1000Family(295, 7), sub1000Family(247, 5), sub1000Family(300, 200), sub1000Family(125, 42)]).toEqual([null, null, null, null])
  })

  it('reads a column hint and catches a false one', () => {
    const said = readColumns('Regn enerne først. Otte plus fem giver tretten. En tier går med over til tierne. Regn så tierne. Syv plus fire plus en giver tolv. Et hundrede går med over til hundrederne. Regn så hundrederne. Tre plus en giver fire. Svaret er fire hundrede og treogtyve.')
    expect(plusSaidProblems(378, 45, said, 'walk')).toEqual([])
    expect(plusSaidProblems(378, 46, said, 'walk').length).toBeGreaterThan(0)
    const wrong = readColumns('Regn enerne først. Der er ikke enere nok. Veksl en tier til ti enere. Tolv minus syv giver fem. Regn så tierne. Nul minus nul giver nul. Hundrederne er de samme. Svaret er fire hundrede og fem.')
    expect(minusSaidProblems(402, 7, wrong, 'walk').length).toBeGreaterThan(0)
  })

  it('catches a film that forgets to lower the lender', () => {
    const plan = regroupPlan(523, 278, '−')
    const broken = { ...plan, marks: plan.marks.map((m) => m.filter((x) => x.kind !== 'lent')) }
    expect(filmProblems(523, 278, '−', broken).length).toBeGreaterThan(0)
    expect(filmProblems(523, 278, '−', plan)).toEqual([])
  })
})

