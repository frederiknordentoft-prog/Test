// Oracle tests for mul34, mul6to9, div2510, divAll and mulTens (SPEC §2.2, §3, §4.1 with A9/A11, §10.1,
// §15.1, A12, A19), ORK3a, against muldiv3.oracle.ts, the wave-3 kit in addsub3.oracle.ts and the wave-1/2
// kits. Also: the three times-table skills cover the small table without overlap (and the two division
// skills its divisions), ":" is read "delt med" in every task and hint of 0.–2. klasse and "divideret med"
// in 3. klasse, and mulTens' prefix `mt:` never meets unitChoice's `mt:<thing>` answer tokens.
import { describe, expect, it } from 'vitest'
import { defaultFastMs } from '../../kinds'
import { hashSeed, makeRng } from '../../rng'
import { masteryKeyOf } from '../../tasks'
import { keyInfo, keysForSkills, registeredSkills, skillKeyIndex } from '../../registry'
import { compile } from '../../../speech/compile'
import type { ErrorTag, Fact, SkillDef, SkillId, Task } from '../../types'
import { canShare, MAX_THINGS } from '../../../ui/task/share/logic'
import {
  answerProblems, cardProblems, first, hintProblems, registeredSkill, spokenText, tagsToHint, taskSpeechProblems, tasksOf,
  type Built,
} from '../number/number.oracle'
import { numberWordProblems, numbersIn } from '../number/number2.oracle'
import {
  animationChecks, cardAnswer, diagnosticCards, hintArithmetic, idChecks, productionChecks, sentences, specKindChecks, spokenAnswer,
  typedSwapOf,
} from '../algebra/algebra2.oracle'
import { classify3, detectable3, freshDraws, instances3, onNumbers } from '../addsub/addsub3.oracle'
import { mulMis } from './muldiv.oracle'
import {
  allTens, cardOf, divFactOf, divMis, explainDiv, explainTens, explainTimes, mulFactOf, smallDivisions, smallTable, tensFactOf, tensMis,
} from './muldiv3.oracle'

const TIMEOUT = 300_000

/** SPEC §3.2: choice 5 s + 1.5 s per digit over one; keypad 6 s + 2 s per digit over one (mulTens 10 s); share 3 s + 0.8 s per thing. */
function specFast(t: Task): number {
  const extra = String(t.answer).length - 1
  if (t.kind === 'keypad') return t.skill === 'mulTens' ? 10_000 : 6_000 + 2_000 * extra
  if (t.kind === 'share') return 3_000 + 800 * (cardOf(t)?.x ?? 0)
  return 5_000 + 1_500 * extra
}

/** Speed as SPEC §3.2 says it: keypad and share exactly, cards never less (a family may give them more, as 2. klasse does). */
function fastProblems(def: SkillDef, built: readonly Built[]): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) {
    const ms = def.fastMs?.(fact, kind) ?? defaultFastMs(task)
    if (kind === 'choice' ? ms < specFast(task) : ms !== specFast(task)) out.add(`${fact.id} ${kind}: ${ms} ms, SPEC ${specFast(task)}`)
  }
  return [...out]
}

/**
 * Each misconception the skill tags gets its own hint; a plain tag the standard one. digitSwap only counts
 * where a typed swap can happen at all (SPEC §4.1): never on a quotient 1–10 or a product of whole tens.
 */
function ownHintProblems(def: SkillDef, facts: readonly Fact[], tags: readonly (ErrorTag | null)[], built: readonly Built[]): string[] {
  const out = new Set<string>()
  const swaps = built.some((b) => typedSwapOf(b.task) !== null)
  for (const f of facts) {
    for (const tag of tags) {
      if (tag === 'digitSwap' && !swaps) continue
      const h = def.hint(f, tag)
      const own = tag !== null && !['near', 'operand', 'other', 'ambiguous', 'shareUnequal'].includes(tag)
      if (own && h.misconception !== tag) out.add(`${f.id} hint(${tag}): the standard hint`)
      if (!own && h.misconception !== undefined) out.add(`${f.id} hint(${String(tag)}): the ${h.misconception} hint`)
    }
  }
  return [...out]
}

const said = (parts: Parameters<typeof spokenText>[0]) => spokenText(parts)

// ═══ The times tables: mul34 and mul6to9 ═════════════════════════════════════

function timesSuite(skill: 'mul34' | 'mul6to9', size: number) {
  const def = registeredSkill(skill)
  const facts = def.enumerate()
  const built: Built[] = tasksOf(def, facts, 6)
  const card = (b: Built) => cardOf(b.task)!
  const why = (b: Built, v: number) => explainTimes(card(b).x, card(b).y, v)
  const specials = (b: Built) => [...mulMis(card(b).x, card(b).y).map(([v]) => v), card(b).x, card(b).y]
  const tags = [...tagsToHint(def, facts), 'digitSwap' as ErrorTag]

  it(`has the ${size} products of the small table its tables own (SPEC §2.2), mul:<a>x<b> smallest first, family t<the bigger table>`, () => {
    const want = [...smallTable()].filter((id) => mulFactOf(id)?.skill === skill)
    expect(new Set(facts.map((f) => f.id))).toEqual(new Set(want))
    expect(facts.length).toBe(size)
    expect(first(idChecks(def, facts, /^mul:\d+x\d+$/, (id) => {
      const q = mulFactOf(id)
      return q && q.skill === skill ? { family: `t${q.table}`, answer: q.answer } : null
    }))).toEqual([])
    for (const f of facts) expect(masteryKeyOf(def, f)).toBe(f.id)
  })

  it('shows the fact with its table’s number second ("seks gange tre"), and card and voice give the product', () => {
    const problems: string[] = []
    for (const b of built) {
      const q = mulFactOf(b.fact.id)!
      const c = card(b)
      const where = `${b.fact.id} ${b.kind}`
      if (c.op !== '·' || c.y !== q.table || [c.x, c.y].sort((x, y) => x - y).join() !== `${q.a},${q.b}`) problems.push(`${where}: card ${c.x} ${c.op} ${c.y}`)
      if (cardAnswer(b.task.prompt) !== q.answer || b.task.answer !== q.answer) problems.push(`${where}: card ${cardAnswer(b.task.prompt)}, task ${String(b.task.answer)}`)
      const heard = spokenAnswer(b.task)
      if (heard.answer !== q.answer || heard.problems.length > 0 || !/^Hvad er .+ gange .+\?$/.test(said(b.task.speech))) problems.push(`${where}: "${said(b.task.speech)}"`)
    }
    expect(first(problems)).toEqual([])
    expect(first(numberWordProblems(built))).toEqual([])
  })

  it('deals three valid cards inside 0–100 and a tableNeighbour or mulAsAdd card whenever one counts', () => {
    expect(first(built.flatMap((b) => [...answerProblems(b.task), ...cardProblems(b.task, (v) => v >= 0 && v <= 100)]))).toEqual([])
    expect(first(diagnosticCards(built, (b) => mulMis(card(b).x, card(b).y).map(([v]) => v), onNumbers(why)))).toEqual([])
  })

  it('classifies every card and typed value by pædagogik §3.2 with A9 (1 · 3 → 1) and A11 (6 · 9 → 45)', () => {
    expect(first(classify3(built, why, specials))).toEqual([])
    expect(first(detectable3(built, why, specials))).toEqual([])
  })

  it('has SPEC’s production kinds, ceilings and speed (keypad 0–100 box 5, cards box 3)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
    expect(first(fastProblems(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(facts.flatMap((f) => hintProblems(def, f, tags)))).toEqual([])
  })

  it('gives each misconception its own hint (tableNeighbour animated, SPEC §4.3) and says only true arithmetic', () => {
    expect(first(ownHintProblems(def, facts, tags, built))).toEqual([])
    expect(first(animationChecks(def, facts, tags))).toEqual([])
    expect(first(hintArithmetic(def, facts, tags))).toEqual([])
  })

  it(skill === 'mul34'
    ? 'counts in hops of the table over the fact’s own array: t, 2t … up to the product'
    : 'splits the fact’s own array in five rows and the rest (7 · 8 = 5 · 8 + 2 · 8), one row for 1 · t', () => {
    const problems: string[] = []
    for (const f of facts) {
      const q = mulFactOf(f.id)!
      const n = q.a * q.b / q.table
      for (const tag of tags) {
        if (tag === 'digitSwap') continue
        const h = def.hint(f, tag)
        const v = h.visual
        const text = said(h.speech)
        if (skill === 'mul34') {
          if (v.scene !== 'array' || v.rows !== n || v.cols !== q.table) problems.push(`${f.id} hint(${String(tag)}): ${JSON.stringify(v)}`)
          const hops = Array.from({ length: n }, (_, i) => (i + 1) * q.table).join()
          if (!numbersIn(text).join().includes(hops)) problems.push(`${f.id} hint(${String(tag)}): never counts ${hops}`)
        } else if (n === 1) {
          if (v.scene !== 'array' || v.rows !== 1 || v.cols !== q.table) problems.push(`${f.id} hint(${String(tag)}): ${JSON.stringify(v)}`)
        } else {
          if (v.scene !== 'splitArray' || v.rows !== n || v.cols !== q.table || v.split !== 5) problems.push(`${f.id} hint(${String(tag)}): ${JSON.stringify(v)}`)
          const sums = sentences(text).filter((s) => / giver /.test(s)).map((s) => numbersIn(s))
          const want = [[5, q.table, 5 * q.table], [n - 5, q.table, (n - 5) * q.table], [5 * q.table, (n - 5) * q.table, q.answer]].map((x) => x.join())
          if (!want.every((w) => sums.some((s) => s.join() === w))) problems.push(`${f.id} hint(${String(tag)}): "${text}"`)
        }
      }
    }
    expect(first(problems)).toEqual([])
  })
}

describe('mul34 oracle', () => timesSuite('mul34', 13), TIMEOUT)
describe('mul6to9 oracle', () => timesSuite('mul6to9', 14), TIMEOUT)

describe('the small table (pædagogik §1.3: 27 + 13 + 14 products, SPEC §2.2)', () => {
  it('mul2510, mul34 and mul6to9 cover every product of the tables 2–10 exactly once, with CONVENTIONS’ shared prefix mul:', () => {
    const owner = new Map<string, SkillId[]>()
    for (const id of ['mul2510', 'mul34', 'mul6to9'] as const) {
      for (const f of registeredSkill(id).enumerate()) owner.set(f.id, [...(owner.get(f.id) ?? []), id])
    }
    const twice = [...owner].filter(([, s]) => s.length > 1).map(([id, s]) => `${id}: ${s}`)
    expect(twice).toEqual([])
    expect(new Set(owner.keys())).toEqual(smallTable())
    expect(owner.size).toBe(54)
    // 1 · 1 is no table's product (the tables are 2–10): SPEC's 54 leaves it out
    expect(owner.has('mul:1x1')).toBe(false)
  })

  it('div2510 and divAll cover every division of the tables 2–10 exactly once (30 + 60), div:<c>/<d>', () => {
    const owner = new Map<string, SkillId[]>()
    for (const id of ['div2510', 'divAll'] as const) {
      for (const f of registeredSkill(id).enumerate()) owner.set(f.id, [...(owner.get(f.id) ?? []), id])
    }
    expect([...owner].filter(([, s]) => s.length > 1)).toEqual([])
    expect(new Set(owner.keys())).toEqual(smallDivisions())
    // every division is a times-table product read backwards: c = d · q is a product of the small table
    for (const id of owner.keys()) {
      const q = divFactOf(id)!
      expect(smallTable().has(`mul:${Math.min(q.d, q.q)}x${Math.max(q.d, q.q)}`), id).toBe(true)
    }
  })

  it('no other registered skill uses the prefixes mul: and div: (CONVENTIONS shares them only within the tables)', () => {
    const users = new Map<string, Set<SkillId>>()
    for (const def of registeredSkills()) {
      for (const f of def.enumerate()) {
        const p = f.id.slice(0, f.id.indexOf(':'))
        if (p === 'mul' || p === 'div') users.set(p, (users.get(p) ?? new Set()).add(def.id))
      }
    }
    expect([...(users.get('mul') ?? [])].sort()).toEqual(['mul2510', 'mul34', 'mul6to9'])
    expect([...(users.get('div') ?? [])].sort()).toEqual(['div2510', 'divAll'])
  })
})

// ═══ Division: div2510 and divAll ════════════════════════════════════════════

function divisionSuite(skill: 'div2510' | 'divAll', size: number) {
  const def = registeredSkill(skill)
  const facts = def.enumerate()
  const built: Built[] = tasksOf(def, facts, 6)
  const card = (b: Built) => cardOf(b.task)!
  const why = (b: Built, v: number) => explainDiv(card(b).x, card(b).y, v)
  const specials = (b: Built) => [...divMis(card(b).x, card(b).y).map(([v]) => v), card(b).x, card(b).y]
  const tags = [...tagsToHint(def, facts), 'digitSwap' as ErrorTag, ...(skill === 'div2510' ? ['shareUnequal' as ErrorTag] : [])]

  it(`has the ${size} divisions its divisors own (SPEC §2.2), div:<c>/<d>, family d<d>, answer the quotient`, () => {
    const want = [...smallDivisions()].filter((id) => divFactOf(id)?.skill === skill)
    expect(new Set(facts.map((f) => f.id))).toEqual(new Set(want))
    expect(facts.length).toBe(size)
    expect(first(idChecks(def, facts, /^div:\d+\/\d+$/, (id) => {
      const q = divFactOf(id)
      return q && q.skill === skill ? { family: `d${q.d}`, answer: q.q } : null
    }))).toEqual([])
    for (const f of facts) expect(masteryKeyOf(def, f)).toBe(f.id)
  })

  it('shows c : d = □ and says "Hvad er … divideret med …?" (A19); card and voice give the quotient', () => {
    const problems: string[] = []
    for (const b of built) {
      const q = divFactOf(b.fact.id)!
      const c = card(b)
      const where = `${b.fact.id} ${b.kind}`
      if (c.op !== ':' || c.x !== q.c || c.y !== q.d) problems.push(`${where}: card ${c.x} ${c.op} ${c.y}`)
      if (cardAnswer(b.task.prompt) !== q.q || b.task.answer !== q.q) problems.push(`${where}: card ${cardAnswer(b.task.prompt)}, task ${String(b.task.answer)}`)
      const heard = spokenAnswer(b.task)
      if (heard.answer !== q.q || heard.problems.length > 0 || !/^Hvad er .+ divideret med .+\?$/.test(said(b.task.speech))) problems.push(`${where}: "${said(b.task.speech)}"`)
    }
    expect(first(problems)).toEqual([])
    expect(first(numberWordProblems(built))).toEqual([])
  })

  it('deals three valid cards inside 0–100 and a tableNeighbour or wrongOperation card whenever one counts', () => {
    expect(first(built.flatMap((b) => [...answerProblems(b.task), ...cardProblems(b.task, (v) => v >= 0 && v <= 100)]))).toEqual([])
    expect(first(diagnosticCards(built, (b) => divMis(card(b).x, card(b).y).map(([v]) => v), onNumbers(why)))).toEqual([])
  })

  it('classifies cards, typed values and deals by pædagogik §3.2 with A9 (10 : 5 → 5) and A11; a deal is the share or shareUnequal', () => {
    expect(first(classify3(built, why, specials))).toEqual([])
    expect(first(detectable3(built, why, specials))).toEqual([])
  })

  it('has SPEC’s production kinds, ceilings and speed (keypad box 5; cards and the share view box 3, SPEC §3.3)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
    expect(first(fastProblems(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(facts.flatMap((f) => hintProblems(def, f, tags)))).toEqual([])
  })

  it('gives each misconception its own hint (tableNeighbour animated) and says only true arithmetic, the times table backwards over q rows of d', () => {
    expect(first(ownHintProblems(def, facts, tags, built))).toEqual([])
    expect(first(animationChecks(def, facts, tags))).toEqual([])
    expect(first(hintArithmetic(def, facts, tags))).toEqual([])
    const problems: string[] = []
    for (const f of facts) {
      const q = divFactOf(f.id)!
      for (const tag of tags) {
        for (const kind of def.kinds) {
          const h = def.hint(f, tag, kind)
          const v = h.visual
          const text = said(h.speech)
          const dealt = skill === 'div2510' && ((kind === 'share' && q.c <= MAX_THINGS) || tag === 'shareUnequal')
          if (dealt) {
            if (v.scene !== 'groups' || v.groups !== q.d || v.size !== q.q) problems.push(`${f.id} hint(${String(tag)}, ${kind}): ${JSON.stringify(v)}`)
          } else if (v.scene !== 'array' || v.rows !== q.q || v.cols !== q.d) problems.push(`${f.id} hint(${String(tag)}, ${kind}): ${JSON.stringify(v)}`)
          // "… Så giver tyve divideret med fem fire." / "Tolv divideret med tre giver fire." — the fact said whole
          if (tag !== 'digitSwap' && !sentences(text).some((s) => numbersIn(s).join() === `${q.c},${q.d},${q.q}` && /divideret med/.test(s))) {
            problems.push(`${f.id} hint(${String(tag)}, ${kind}): never says ${q.c} divideret med ${q.d} giver ${q.q}: "${text}"`)
          }
        }
      }
    }
    expect(first(problems)).toEqual([])
  })
}

describe('div2510 oracle', () => {
  divisionSuite('div2510', 30)

  it('bridges in every hint (SPEC A19: the first division hint says "Divideret med betyder det samme som delt med.")', () => {
    const def = registeredSkill('div2510')
    const problems: string[] = []
    for (const f of def.enumerate()) {
      for (const tag of [...tagsToHint(def, def.enumerate()), 'shareUnequal' as ErrorTag]) {
        for (const kind of [undefined, ...def.kinds]) {
          const text = said(def.hint(f, tag, kind).speech)
          if (!text.startsWith('Divideret med betyder det samme som delt med.')) problems.push(`${f.id} hint(${String(tag)}, ${kind}): "${text.slice(0, 50)}…"`)
        }
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('asks a pile on the share view only when the view can deal it (≤ 40 things), so a share task is never shown as keys', () => {
    // GENERATOR BUG (div2510.ts) — Rettet (kindsFor): kinds were ['choice', 'keypad', 'share'] for all 30 facts; the 8 facts with more than
    // MAX_THINGS (40) things (div:45/5, div:50/5, div:50/10 … div:100/10) are built as share tasks too (buildTask,
    // keysForSkills and the round builder's other kinds). The share view cannot deal them (canShare false), so
    // ui/task/registry.ts shownKind falls back to the keypad, but the task stays kind 'share': state/useRound.ts
    // logs production = isProduction(task) = false and ceiling 3 (the keypad the child sees is production, box 5),
    // fast within 3 s + 0.8 s per thing (up to 83 s for div:100/10, SPEC's keypad is 8 s) and, from
    // candidatesFor(share) = [], every typed wrong answer as 'other' with no opportunity (detectableOf []).
    // Expected: such a fact is never asked as share (or is built as the keypad task it is shown as).
    const def = registeredSkill('div2510')
    const big = def.enumerate().filter((f) => divFactOf(f.id)!.c > MAX_THINGS)
    expect(big.map((f) => f.id).sort()).toEqual(['div:100/10', 'div:45/5', 'div:50/10', 'div:50/5', 'div:60/10', 'div:70/10', 'div:80/10', 'div:90/10'])
    const keys = keysForSkills([{ skill: 'div2510' }], { states: {}, audioVerified: true })
    const shown = keys.filter((k) => big.some((f) => f.id === k.key)).filter((k) => k.kinds.includes('share'))
      .map((k) => k.build('share', makeRngFor(k.key), 0)).filter((t) => t.kind === 'share' && !canShare(t))
    expect(shown.map((t) => t.factId)).toEqual([])
  })
}, TIMEOUT)

describe('divAll oracle', () => divisionSuite('divAll', 60), TIMEOUT)

// ═══ mulTens ════════════════════════════════════════════════════════════════

describe('mulTens oracle', () => {
  const def = registeredSkill('mulTens')
  const canon = def.enumerate()
  const instances = [...instances3(def).values()].flat()
  const all = [...canon, ...instances]
  const built: Built[] = [...tasksOf(def, canon, 6), ...tasksOf(def, instances, 1)]
  const q = (b: Built) => tensFactOf(b.fact.id)!
  const why = (b: Built, v: number) => explainTens(q(b), v)
  const specials = (b: Built) => [...tensMis(q(b).a, q(b).T).map(([v]) => v), q(b).first, q(b).second]
  const tags = [...tagsToHint(def, canon), 'digitSwap' as ErrorTag]

  it('has SPEC §2.2’s two families of 32 (a = 2–5 times a whole ten 20–90, both orders), 20 canonical each, ids mt:<first>x<second>', () => {
    expect(def.families.map((f) => f.id)).toEqual(['oneDigitTimesTens', 'tensTimesOneDigit'])
    for (const fam of ['oneDigitTimesTens', 'tensTimesOneDigit'] as const) {
      expect(canon.filter((f) => f.family === fam).length, fam).toBe(20)
      // with the asked ones avoided, 32 draws give the whole family
      expect(new Set(freshDraws(def, fam, 32)), fam).toEqual(allTens(fam))
    }
    expect(first(idChecks(def, all, /^mt:\d+x\d+$/, (id) => {
      const t = tensFactOf(id)
      return t && { family: t.family, answer: t.answer }
    }))).toEqual([])
    for (const f of all) expect(masteryKeyOf(def, f)).toBe(`mulTens/${f.family}`)
  })

  it('shows the factors in the id’s order and says them; card and voice give the product', () => {
    const problems: string[] = []
    for (const b of built) {
      const t = q(b)
      const c = cardOf(b.task)!
      const where = `${b.fact.id} ${b.kind}`
      if (c.op !== '·' || c.x !== t.first || c.y !== t.second) problems.push(`${where}: card ${c.x} ${c.op} ${c.y}`)
      if (cardAnswer(b.task.prompt) !== t.answer || b.task.answer !== t.answer) problems.push(`${where}: answer ${String(b.task.answer)}`)
      const heard = spokenAnswer(b.task)
      if (heard.answer !== t.answer || heard.problems.length > 0) problems.push(`${where}: "${said(b.task.speech)}"`)
    }
    expect(first(problems)).toEqual([])
    expect(first(numberWordProblems(built))).toEqual([])
  })

  it('deals three valid cards inside 0–1000 and a tensZero, tableNeighbour or mulAsAdd card whenever one counts', () => {
    expect(first(built.flatMap((b) => [...answerProblems(b.task), ...cardProblems(b.task, (v) => v >= 0 && v <= 1000)]))).toEqual([])
    expect(first(diagnosticCards(built, (b) => tensMis(q(b).a, q(b).T).map(([v]) => v), onNumbers(why)))).toEqual([])
  })

  it('classifies every card and every value the four keys take (3 · 40 → 12 and 1200 tensZero, 43 mulAsAdd, 2 · 40 → 40 ambiguous)', () => {
    expect(first(classify3(built, why, specials))).toEqual([])
    expect(first(detectable3(built, why, specials))).toEqual([])
  })

  it('has SPEC’s production kinds, ceilings and speed (keypad 10 s, box 5; cards box 3)', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
    expect(first(fastProblems(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits; each misconception its own hint; only true arithmetic', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(all.slice(0, 200).flatMap((f) => hintProblems(def, f, tags)))).toEqual([])
    expect(first(ownHintProblems(def, all, tags, built))).toEqual([])
    expect(first(animationChecks(def, all, tags))).toEqual([])
    expect(first(hintArithmetic(def, all, tags))).toEqual([])
  })

  it('pictures the product as its tens (a · t rods) and counts the tableNeighbour hops of the whole ten to the product', () => {
    const problems: string[] = []
    for (const f of all) {
      const t = tensFactOf(f.id)!
      for (const tag of tags) {
        if (tag === 'digitSwap') continue
        const v = def.hint(f, tag).visual
        const text = said(def.hint(f, tag).speech)
        if (tag === 'tableNeighbour') {
          const hops = Array.from({ length: t.a + 1 }, (_, i) => i * t.T)
          if (v.scene !== 'line' || JSON.stringify(v.hops) !== JSON.stringify(hops) || v.min > 0 || v.max < t.answer) problems.push(`${f.id} hint(tableNeighbour): ${JSON.stringify(v)}`)
          if (!numbersIn(text).join().includes(hops.slice(1).join())) problems.push(`${f.id} hint(tableNeighbour): "${text}"`)
        } else if (v.scene !== 'base' || v.h !== 0 || v.o !== 0 || v.t * 10 !== t.answer) problems.push(`${f.id} hint(${String(tag)}): ${JSON.stringify(v)}`)
        if (!new RegExp(`^.*Svaret er|giver`).test(text)) problems.push(`${f.id} hint(${String(tag)}): no answer said`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('keeps mt: its own: no other skill’s fact id, mastery key or clip meets it, and unitChoice’s mt:<thing> are answer tokens only', () => {
    const problems: string[] = []
    // fact ids: only mulTens uses the prefix, and only as mt:<number>x<number>
    for (const d of registeredSkills()) {
      const facts = [...d.enumerate(), ...(d.mode === 'procedure' && d.instance ? [...instances3(d, 20).values()].flat() : [])]
      for (const f of facts) {
        if (f.id.startsWith('mt:') && (d.id !== 'mulTens' || tensFactOf(f.id) === null)) problems.push(`${d.id}: fact ${f.id}`)
        if (d.id === 'mulTens' && !f.id.startsWith('mt:')) problems.push(`mulTens: fact ${f.id}`)
      }
    }
    // unitChoice deals mt:<thing> cards and answers with them; none is a mulTens id
    const uc = registeredSkill('unitChoice')
    const tokens = new Set<string>()
    for (const { task } of tasksOf(uc, uc.enumerate(), 2)) {
      for (const v of [task.answer, ...task.options, ...task.accept]) for (const tok of String(v).split('|')) if (tok.startsWith('mt:')) tokens.add(tok)
    }
    expect(tokens.size).toBeGreaterThan(0)
    for (const tok of tokens) if (!/^mt:[a-z]+$/i.test(tok) || tensFactOf(tok) !== null) problems.push(`unitChoice token ${tok}`)
    // mastery keys are unique across skills, mulTens' are mulTens/<family>, and a token is no key
    const owner = new Map<string, SkillId>()
    for (const [skill, keys] of Object.entries(skillKeyIndex())) {
      for (const k of keys ?? []) {
        if (owner.has(k) && owner.get(k) !== skill) problems.push(`key ${k}: ${owner.get(k)} and ${skill}`)
        owner.set(k, skill as SkillId)
      }
    }
    for (const tok of tokens) if (keyInfo(tok) !== undefined) problems.push(`token ${tok} reads as the key of ${keyInfo(tok)!.skill}`)
    expect(skillKeyIndex().mulTens).toEqual(['mulTens/oneDigitTimesTens', 'mulTens/tensTimesOneDigit'])
    // the clips: mulTens never says a q.<id> clip, and unitChoice's noun.mt.<thing> clips stay things
    for (const { task } of built) for (const p of task.speech) if ('clip' in p && /^(q\.mt:|noun\.mt\.)/.test(p.clip)) problems.push(`mulTens says ${p.clip}`)
    for (const tok of tokens) if (compile([{ clip: `noun.mt.${tok.slice(3)}` }]).missing.length > 0) problems.push(`no clip for ${tok}`)
    // the round reads mulTens as multiplication (registry PREFIX_OPS falls back to the card)
    const ops = new Set(keysForSkills([{ skill: 'mulTens' }], { states: {}, audioVerified: true }).map((k) => k.op))
    expect([...ops]).toEqual(['·'])
    expect(first(problems)).toEqual([])
  })
}, TIMEOUT)

// ═══ ":" read aloud: A12 (0.–2. klasse) and A19 (3. klasse) ══════════════════

describe('division read aloud in every registered skill (SPEC A12 for 0.–2. klasse, A19 for 3. klasse)', () => {
  /** The one sentence of 3. klasse that may say "delt med": div2510's bridge to 2. klasse (A19). */
  const BRIDGE = 'Divideret med betyder det samme som delt med.'

  it('never says "divideret med" in 0.–2. klasse, and in 3. klasse never "delt med" but the bridge — every task, every hint, every tag and kind', () => {
    const problems: string[] = []
    let divided3 = 0
    let shared2 = 0
    for (const def of registeredSkills()) {
      const gradeOf = (f: Fact) => def.families.find((fam) => fam.id === f.family)?.grade ?? def.grade
      const facts = [...def.enumerate(), ...(def.mode === 'procedure' && def.instance ? [...instances3(def, 10).values()].flat() : [])]
      const tags = [...tagsToHint(def, facts), 'digitSwap', 'shareUnequal'] as (ErrorTag | null)[]
      for (const { fact, kind, task } of tasksOf(def, facts, 1)) {
        const g = gradeOf(fact)
        const texts = [said(task.speech), ...tags.map((tag) => said(def.hint(fact, tag, kind).speech))]
        for (const text of texts) {
          for (const s of sentences(text)) {
            if (g <= 2 && /divideret/i.test(s)) problems.push(`${def.id} ${fact.id} ${kind} (${g}. kl.): "${s}"`)
            if (g === 3 && /delt med/i.test(s) && !(def.id === 'div2510' && s === BRIDGE)) problems.push(`${def.id} ${fact.id} ${kind} (3. kl.): "${s}"`)
          }
        }
        // ":" on the card is read the grade's way
        const c = cardOf(task)
        if (c?.op === ':') {
          const text = said(task.speech)
          if (g === 3 && !/divideret med/.test(text)) problems.push(`${def.id} ${fact.id} ${kind}: ":" read as "${text}"`)
          if (g <= 2 && !/delt med/.test(text)) problems.push(`${def.id} ${fact.id} ${kind}: ":" read as "${text}"`)
          if (g === 3) divided3++
          else shared2++
        }
      }
    }
    expect(first(problems)).toEqual([])
    // the division cards of 3. klasse are there to be read (div2510, divAll, inverseOps/mulToDiv)
    expect(divided3).toBeGreaterThan(90)
    expect(shared2).toBe(0)
  })

  it('reads inverseOps/mulToDiv (3. klasse) "divideret med" and its other families, and shareEqually, never so (A19 over A12)', () => {
    const inv = registeredSkill('inverseOps')
    const problems: string[] = []
    const facts = [...inv.enumerate(), ...[...instances3(inv, 20).values()].flat()]
    for (const f of facts) {
      const grade = inv.families.find((fam) => fam.id === f.family)?.grade ?? inv.grade
      for (const kind of inv.kinds) {
        for (const tag of [...tagsToHint(inv, facts), 'digitSwap'] as (ErrorTag | null)[]) {
          const text = `${said(inv.speech(f, kind))} ${said(inv.hint(f, tag, kind).speech)}`
          if (f.family === 'mulToDiv' && (grade !== 3 || !/divideret med/.test(text) || /delt med/.test(text))) problems.push(`${f.id} ${kind} hint(${String(tag)}): "${text}"`)
          if (f.family !== 'mulToDiv' && /divideret|delt med/.test(text)) problems.push(`${f.id} ${kind} hint(${String(tag)}): "${text}"`)
        }
      }
    }
    const share = registeredSkill('shareEqually')
    for (const f of share.enumerate()) {
      for (const tag of [...tagsToHint(share, share.enumerate()), 'shareUnequal'] as (ErrorTag | null)[]) {
        const text = said(share.hint(f, tag).speech)
        if (/divideret/.test(text)) problems.push(`${f.id} hint(${String(tag)}): "${text}"`)
      }
    }
    expect(first(problems)).toEqual([])
  })
}, TIMEOUT)

/** A seeded rng per key, for building one task outside a round. */
const makeRngFor = (key: string) => makeRng(hashSeed(`ork3a-share:${key}`))
