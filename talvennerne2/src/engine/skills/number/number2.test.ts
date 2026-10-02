// Tests for the number skills of 1.–2. klasse: hear100, order100, numberLine100, hear1000, order1000
// and numberLine1000 (SK2-NUM). The shared contract (testing/harness.ts) runs every fact, 200
// seeded instances per family and every kind through the real task builder; the blocks below add
// independent answers, the misconceptions and A9, production and ceilings per kind, and the regions.
import { describe, expect, it } from 'vitest'
import hear100Module from './hear100'
import hear1000Module from './hear1000'
import order100Module from './order100'
import order1000Module from './order1000'
import numberLine100Module from './numberLine100'
import numberLine1000Module from './numberLine1000'
import tensOnesModule from '../place/tensOnes'
import placeValue1000Module from '../place/placeValue1000'
import { factsUnderTest, globalIdCheck, skillContract, speechProblems, tasksUnderTest } from './testing/harness'
import { buildTask } from '../../tasks'
import { classifyAnswer, digitSwapOf } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, guessP, isProduction } from '../../kinds'
import { keysForNode } from '../../registry'
import { planRound } from '../../plan'
import { newProfile } from '../../testing/profile'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import { NODES } from '../../../content/curriculum'
import { SKILL_BY_ID } from '../../../content/skills'
import { isMisconception as isMisconceptionTag } from './kit'
import type { AnswerValue, Fact, Prompt, SkillDef, Task, TaskKind } from '../../types'

// Through the frozen contract, as the engine calls them.
const hear100: SkillDef = hear100Module
const hear1000: SkillDef = hear1000Module
const order100: SkillDef = order100Module
const order1000: SkillDef = order1000Module
const numberLine100: SkillDef = numberLine100Module
const numberLine1000: SkillDef = numberLine1000Module
const tensOnesDef: SkillDef = tensOnesModule
const placeValue1000Def: SkillDef = placeValue1000Module

const text = (t: Task) => compile(t.speech).text
const words = (n: number) => compile([{ num: n, form: 'end' }]).text.replace(/\.$/, '').toLowerCase()
const lastNumber = (id: string) => Number(id.slice(id.lastIndexOf(':') + 1))
const row = (p: Prompt) => {
  if (p.scene !== 'row') throw new Error(`expected a row, got ${p.scene}`)
  return p
}
const build = (def: SkillDef, id: string, kind: TaskKind, seed = 1): Task => buildTask(def, findById(def, id), kind, makeRng(seed), 0).task

/** hear1000's family by digits, written independently of the skill. */
function hear1000Family(n: number): string {
  const [h, t, o] = String(n).padStart(3, '0').split('').map(Number)
  if (n === 1000 || (t === 0 && o === 0)) return 'hundreds'
  if (t === 0) return 'h0o'
  if (t === 1) return o === 0 ? 'hT0' : 'hTeen'
  return o === 0 ? 'hT0' : h > 0 ? 'hTO' : '?'
}

/**
 * A fact by id: canonical, or made from the id with an independent answer — every skill here reads
 * its instance back from the id (a drawn instance may be rare: 69 and 102 is one in 80 000).
 */
function findById(def: SkillDef, id: string): Fact {
  const canon = def.enumerate().find((f) => f.id === id)
  if (canon) return canon
  const bits = id.split(':')
  const n = lastNumber(id)
  const family = def.id === 'hear100' ? `d${Math.floor(n / 10)}x` : def.id === 'hear1000' ? hear1000Family(n) : bits[1]
  const answer = def.id.startsWith('order') ? orderAnswer(id) : n
  return { id, skill: def.id, family, operands: bits.slice(2).filter((b) => /^\d+$/.test(b)).map(Number), answer, rank: 0 }
}

// ─── Independent answers ────────────────────────────────────────────────────

/** order100 and order1000 ±: the answer from the id, without the skill's own code. */
function orderAnswer(id: string): number {
  const bits = id.split(':')
  const family = bits[1]
  const n = Number(bits.at(-1))
  if (family === 'crossTen') return bits[2] === 'after' ? n + 1 : n - 1
  if (family === 'crossHundred') return n + ({ plus1: 1, plus10: 10, minus1: -1, minus10: -10 } as Record<string, number>)[bits[2]]
  if (family.startsWith('bigger')) return Math.max(...bits.slice(2).map(Number))
  const m = /^(plus|minus)(\d+)$/.exec(family)!
  return n + (m[1] === 'plus' ? 1 : -1) * Number(m[2])
}

/** A sortOrder answer checked against its stones: counting on or back from the first stone, or biggest first. */
function sortProblems(t: Task): string[] {
  const cards = String(t.answer).split('|').map(Number)
  const stones = row(t.prompt).cells
  if (cards.length < 4) return [`${t.factId}: ${cards.length} cards`]
  if (stones[0] === null) return [...cards].sort((a, b) => b - a).join('|') === cards.join('|') ? [] : [`${t.factId}: not biggest first`]
  const d = cards[0] - (stones[0] as number)
  const steady = cards.every((c, i) => c - (i === 0 ? (stones[0] as number) : cards[i - 1]) === d)
  return steady && [1, -1, 10, -10, 100, -100].includes(d) ? [] : [`${t.factId}: stones ${stones.join(',')} cards ${cards.join(',')}`]
}

describe('number skills of 1.–2. klasse: the contract', () => {
  globalIdCheck()

  skillContract(hear100, {
    families: { d2x: 10, d3x: 10, d4x: 10, d5x: 10, d6x: 10, d7x: 10, d8x: 10, d9x: 10 },
    answerOf: (f) => lastNumber(f.id),
  })
  skillContract(hear1000, { families: { hundreds: 10, h0o: 20, hTeen: 20, hT0: 20, hTO: 20 }, answerOf: (f) => lastNumber(f.id) })
  skillContract(order100, {
    families: { plus1: 20, minus1: 20, plus10: 20, minus10: 20, crossTen: 18, biggerDiffTens: 20, biggerSwapped: 20 },
    answerOf: (f, kind) => (kind === 'sortOrder' ? undefined : orderAnswer(f.id)),
  })
  skillContract(order1000, {
    families: { plus1: 20, plus10: 20, plus100: 20, minus1: 20, minus10: 20, minus100: 20, crossHundred: 20, bigger3: 20, biggerMixed: 20 },
    answerOf(f, kind) {
      if (kind === 'sortOrder') return undefined
      if (kind === 'choice' && f.family === 'biggerMixed') {
        const [x, y] = f.id.split(':').slice(2).map(Number)
        return x < y ? 'cmp:<' : 'cmp:>'
      }
      return orderAnswer(f.id)
    },
  })
  skillContract(numberLine100, { families: { placeTens: 9, placeAny: 20, readArrow: 19 }, answerOf: (f) => lastNumber(f.id) })
  skillContract(numberLine1000, {
    families: { placeHundreds: 9, placeAny: 20, round10: 20, round100: 20 },
    answerOf(f) {
      const n = lastNumber(f.id)
      if (f.family === 'round10') return n % 10 >= 5 ? n - (n % 10) + 10 : n - (n % 10)
      if (f.family === 'round100') return n % 100 >= 50 ? n - (n % 100) + 100 : n - (n % 100)
      return n
    },
  })
})

// ─── hear100 ────────────────────────────────────────────────────────────────

describe('hear100', () => {
  const tasks = tasksUnderTest(hear100, 3)

  it('has every number 20–99 once, ten per decade', () => {
    const ids = hear100.enumerate().map((f) => f.id).sort()
    expect(ids).toEqual(Array.from({ length: 80 }, (_, i) => `h100:${i + 20}`).sort())
    for (const f of hear100.enumerate()) expect(f.family).toBe(`d${Math.floor((f.answer as number) / 10)}x`)
  })

  it('only says the number, on cards and on the keypad', () => {
    for (const { fact, kind, task } of tasks) {
      expect(task.prompt).toEqual({ scene: 'hear' })
      expect(text(task)).toBe(`${kind === 'keypad' ? 'Skriv' : 'Find'} tallet ${words(lastNumber(fact.id))}.`)
    }
  })

  it('shows the reversed number as the diagnostic card and reads it as digitSwap', () => {
    for (const { fact, kind, task } of tasks) {
      const n = lastNumber(fact.id)
      const swap = digitSwapOf(n)
      if (kind === 'choice' && swap !== null) {
        expect(task.options, fact.id).toContain(swap)
        expect(task.distractorTags[String(swap)]).toBe('digitSwap')
      }
    }
    const t = build(hear100, 'h100:47', 'keypad')
    expect(classifyAnswer(t, 74)).toBe('digitSwap')
    expect(classifyAnswer(t, 46)).toBe('near')
    expect(classifyAnswer(t, 37)).toBe('near')
    expect(classifyAnswer(t, 12)).toBe('other')
    const seventy = build(hear100, 'h100:77', 'keypad')
    expect(classifyAnswer(seventy, 57)).toBe('other') // halvtreds for halvfjerds
    expect(classifyAnswer(seventy, 97)).toBe('other')
  })

  it('explains tens first, and the swap with the film', () => {
    const f = (n: number) => hear100.enumerate().find((x) => x.answer === n)!
    expect(compile(hear100.hint(f(47), null).speech).text).toBe('Syvogfyrre er fire tiere og syv enere. Vi skriver tierne først.')
    const swap = hear100.hint(f(53), 'digitSwap')
    expect(compile(swap.speech).text).toBe('Treoghalvtreds er fem tiere og tre enere. Vi siger tre først, men vi skriver tierne først.')
    expect(swap).toMatchObject({ misconception: 'digitSwap', animated: true, visual: { scene: 'base', t: 5, o: 3 } })
    expect(compile(hear100.hint(f(50), null).speech).text).toBe('Halvtreds er fem tiere. Der er ingen enere, så vi skriver et nul til sidst.')
    expect(compile(hear100.hint(f(21), null).speech).text).toBe('Enogtyve er to tiere og en ener. Vi skriver tierne først.')
  })
})

// ─── hear1000 ───────────────────────────────────────────────────────────────

describe('hear1000', () => {
  const tasks = tasksUnderTest(hear1000)

  it('draws every family inside its own numbers (100–1000)', () => {
    const seen: Record<string, Set<number>> = {}
    for (const f of factsUnderTest(hear1000)) {
      const n = lastNumber(f.id)
      expect(n).toBeGreaterThanOrEqual(100)
      expect(n).toBeLessThanOrEqual(1000)
      expect(hear1000Family(n), f.id).toBe(f.family)
      ;(seen[f.family] ??= new Set()).add(n)
    }
    expect([...seen.hundreds].sort((a, b) => a - b)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])
    expect(seen.h0o.size).toBeGreaterThan(60) // of 81
  })

  it('takes five digits on the keypad, so 1004 and 30045 can be typed and seen', () => {
    for (const { kind, task } of tasks) {
      expect(task.prompt).toEqual({ scene: 'hear' })
      if (kind === 'keypad') expect(task.maxDigits).toBe(Math.max(5, String(task.answer).length + 2))
    }
    const t104 = build(hear1000, 'h1000:104', 'keypad')
    expect(classifyAnswer(t104, 1004)).toBe('concatNumberWords')
    expect(classifyAnswer(t104, 14)).toBe('zeroPlaceholder')
    expect(classifyAnswer(t104, 140)).toBe('zeroPlaceholder')
    expect(classifyAnswer(t104, 105)).toBe('near')
    expect(text(t104)).toBe('Skriv tallet et hundrede og fire.')
    const t345 = build(hear1000, findById(hear1000, 'h1000:345').id, 'keypad')
    expect(classifyAnswer(t345, 30045)).toBe('concatNumberWords')
    expect(classifyAnswer(t345, 354)).toBe('digitSwap')
    expect(classifyAnswer(t345, 445)).toBe('near')
    const t320 = build(hear1000, findById(hear1000, 'h1000:320').id, 'keypad')
    expect(classifyAnswer(t320, 32)).toBe('zeroPlaceholder')
    expect(classifyAnswer(t320, 302)).toBe('zeroPlaceholder')
    expect(classifyAnswer(t320, 30020)).toBe('concatNumberWords')
    const t213 = build(hear1000, findById(hear1000, 'h1000:213').id, 'keypad')
    expect(classifyAnswer(t213, 231)).toBe('digitSwap')
    expect(classifyAnswer(build(hear1000, 'h1000:1000', 'keypad'), 100)).toBe('zeroPlaceholder')
  })

  it('rotates the diagnostic card to the misconception offered least', () => {
    const f = findById(hear1000, 'h1000:304')
    const card = (offered: Record<string, number>) =>
      buildTask(hear1000, f, 'choice', makeRng(3), 0, { offered }).task.options.filter((o) => o !== 304)
    const tags = (opts: AnswerValue[], t: Task) => opts.map((o) => t.distractorTags[String(o)])
    const t1 = buildTask(hear1000, f, 'choice', makeRng(3), 0, { offered: { zeroPlaceholder: 4 } }).task
    expect(tags(card({ zeroPlaceholder: 4 }), t1)).toContain('concatNumberWords')
    const t2 = buildTask(hear1000, f, 'choice', makeRng(3), 0, { offered: { concatNumberWords: 4 } }).task
    expect(tags(card({ concatNumberWords: 4 }), t2)).toContain('zeroPlaceholder')
  })

  it('explains hundreds, tens and ones, with the misconception’s own sentence', () => {
    const hint = (id: string, tag: Parameters<SkillDef['hint']>[1]) => hear1000.hint(findById(hear1000, id), tag)
    expect(compile(hint('h1000:104', 'concatNumberWords').speech).text)
      .toBe('Et hundrede og fire er et hundrede nul tiere og fire enere. Det skriver vi med tre cifre.')
    expect(hint('h1000:104', 'concatNumberWords').misconception).toBe('concatNumberWords')
    expect(compile(hint('h1000:304', 'zeroPlaceholder').speech).text)
      .toBe('Tre hundrede og fire er tre hundreder nul tiere og fire enere. Nullet holder tiernes plads.')
    expect(compile(hint('h1000:345', 'digitSwap').speech).text)
      .toBe('Tre hundrede og femogfyrre er tre hundreder fire tiere og fem enere. Vi siger fem først, men vi skriver tierne først.')
    expect(compile(hint('h1000:345', null).speech).text)
      .toBe('Tre hundrede og femogfyrre er tre hundreder fire tiere og fem enere. Vi skriver hundrederne først, så tierne og så enerne.')
    expect(compile(hint('h1000:1000', null).speech).text).toBe('Tusind er ti hundreder.')
    expect(hint('h1000:345', null).visual).toEqual({ scene: 'base', h: 3, t: 4, o: 5, order: 'hto' })
  })
})

// ─── order100 ───────────────────────────────────────────────────────────────

describe('order100', () => {
  const tasks = tasksUnderTest(order100)

  it('counts on or back from the first stone, or puts four numbers biggest first', () => {
    const problems = tasks.filter((t) => t.kind === 'sortOrder').flatMap((t) => sortProblems(t.task))
    expect(problems.slice(0, 5)).toEqual([])
    for (const { fact, task } of tasks) {
      if (task.kind !== 'sortOrder') continue
      const cards = String(task.answer).split('|').map(Number)
      for (const c of cards) expect(c >= 0 && c <= 100, fact.id).toBe(true)
      if (!fact.family.startsWith('bigger')) expect(cards, fact.id).toContain(orderAnswer(fact.id))
      else for (const n of fact.operands) expect(cards).toContain(n)
    }
  })

  it('asks on the 100-board with cards, on stepping stones with the keypad', () => {
    for (const { fact, task } of tasks) {
      const p = task.prompt
      if (task.kind === 'choice') {
        expect(p.scene, fact.id).toBe('board')
        if (p.scene !== 'board') continue
        if (fact.family.startsWith('bigger')) expect([...p.highlight].sort()).toEqual(task.options.map(Number).sort())
        else expect(p).toEqual({ scene: 'board', highlight: [fact.operands[0]], blank: task.answer })
      }
      if (task.kind === 'keypad') expect(p.scene).toBe('row')
    }
  })

  it('never shows a card bigger than the answer to "which is biggest"', () => {
    for (const { fact, task } of tasks) {
      if (!fact.family.startsWith('bigger') || task.kind !== 'choice') continue
      for (const o of task.options) expect(o as number).toBeLessThanOrEqual(task.answer as number)
    }
  })

  it('reads the questions in plain Danish', () => {
    const say = (id: string, kind: TaskKind) => text(build(order100, findById(order100, id).id, kind))
    expect(say('o100:plus10:46', 'keypad')).toBe('Hvilket tal er ti mere end seksogfyrre?')
    expect(say('o100:minus10:46', 'choice')).toBe('Hvilket tal er ti mindre end seksogfyrre?')
    expect(say('o100:crossTen:after:39', 'keypad')).toBe('Hvilket tal kommer efter niogtredive?')
    expect(say('o100:crossTen:before:70', 'choice')).toBe('Hvilket tal kommer før halvfjerds?')
    expect(say('o100:plus10:46', 'sortOrder')).toBe('Tæl videre i tiere fra seksogfyrre.')
    expect(say('o100:biggerSwapped:46:64', 'keypad')).toBe('Hvilket tal er størst, seksogfyrre eller fireogtres?')
    expect(say('o100:biggerSwapped:46:64', 'choice')).toBe('Hvilket tal er størst?')
  })

  it('tags the slips over a new ten', () => {
    const after = build(order100, 'o100:crossTen:after:39', 'keypad')
    expect(classifyAnswer(after, 30)).toBe('near')
    expect(classifyAnswer(after, 39)).toBe('operand')
    const before = build(order100, 'o100:crossTen:before:70', 'keypad')
    expect(classifyAnswer(before, 79)).toBe('near')
    expect(classifyAnswer(build(order100, findById(order100, 'o100:biggerSwapped:46:64').id, 'keypad'), 46)).toBe('operand')
  })

  it('explains with the board', () => {
    const hint = (id: string) => order100.hint(findById(order100, id), null)
    expect(compile(hint('o100:plus10:46').speech).text).toBe('Ti mere er en tier mere. På hundredetavlen står det lige nedenunder.')
    expect(hint('o100:plus10:46').visual).toEqual({ scene: 'board', highlight: [46, 56] })
    expect(compile(hint('o100:crossTen:after:39').speech).text).toBe('Efter niogtredive kommer fyrre. Ti enere bliver til en tier.')
    expect(compile(hint('o100:crossTen:after:99').speech).text).toBe('Efter nioghalvfems kommer et hundrede. Ti tiere bliver til et hundrede.')
    expect(compile(hint('o100:biggerSwapped:46:64').speech).text).toBe('Se på tierne først. Fireogtres har seks tiere.')
  })
})

// ─── order1000 ──────────────────────────────────────────────────────────────

describe('order1000', () => {
  const tasks = tasksUnderTest(order1000)

  it('counts on or back over the stones, and every card stays inside 0–1000', () => {
    const problems = tasks.filter((t) => t.kind === 'sortOrder').flatMap((t) => sortProblems(t.task))
    expect(problems.slice(0, 5)).toEqual([])
    for (const { fact, task } of tasks) {
      if (task.kind !== 'sortOrder') continue
      const cards = String(task.answer).split('|').map(Number)
      for (const c of cards) expect(c >= 0 && c <= 1000, `${fact.id} ${c}`).toBe(true)
      if (!fact.family.startsWith('bigger')) expect(cards, fact.id).toContain(orderAnswer(fact.id))
    }
  })

  it('keeps ±1, ±10 and ±100 inside a hundred, and crosses one in crossHundred', () => {
    for (const f of factsUnderTest(order1000)) {
      const n = lastNumber(f.id)
      const a = orderAnswer(f.id)
      if (/^(plus|minus)(1|10)$/.test(f.family)) expect(Math.floor(n / 100), f.id).toBe(Math.floor(a / 100))
      if (f.family === 'crossHundred') expect(Math.floor(n / 100), f.id).not.toBe(Math.floor(a / 100))
      if (f.family === 'bigger3') {
        const nums = f.operands
        expect(new Set(nums).size).toBe(3)
        for (const v of nums) expect(v >= 100 && v <= 999).toBe(true)
      }
      if (f.family === 'biggerMixed') {
        const [small, big] = [...f.operands].sort((x, y) => x - y)
        expect(small >= 10 && small <= 99 && big >= 100 && big <= 999, f.id).toBe(true)
        expect(Number(String(small)[0])).toBeGreaterThan(Number(String(big)[0]))
      }
    }
  })

  it('asks biggerMixed on cards as the sign between the numbers, read aloud', () => {
    for (const { fact, task } of tasks) {
      if (fact.family !== 'biggerMixed' || task.kind !== 'choice') continue
      const [x, y] = fact.operands
      expect(task.prompt).toEqual({ scene: 'equation', terms: [{ n: x }, { blank: true }, { n: y }] })
      expect(task.optionView).toBe('relation')
      expect([...task.options].sort()).toEqual(['cmp:<', 'cmp:=', 'cmp:>'])
      expect(task.optionClips).toEqual(task.options.map((o) => ({ 'cmp:<': 'op.mindre_end', 'cmp:>': 'op.stoerre_end', 'cmp:=': 'op.er_lig_med' })[o as string]))
      const wrong = x < y ? 'cmp:>' : 'cmp:<'
      expect(task.distractorTags[wrong]).toBe('firstDigitCompare')
      expect(classifyAnswer(task, wrong)).toBe('firstDigitCompare')
      expect(text(task)).toBe(`Hvilket tegn skal stå mellem ${words(x)} og ${words(y)}?`)
    }
  })

  it('reads the order by first digit as firstDigitCompare, and the other number of the question as ambiguous (A9)', () => {
    const f = findById(order1000, 'o1000:biggerMixed:69:102')
    const sort = build(order1000, f.id, 'sortOrder')
    const cards = String(sort.answer).split('|').map(Number)
    const byFirst = [...cards].sort((a, b) => Number(String(b)[0]) - Number(String(a)[0])).join('|')
    expect(byFirst).not.toBe(sort.answer)
    expect(classifyAnswer(sort, byFirst)).toBe('firstDigitCompare')
    const typed = build(order1000, f.id, 'keypad')
    expect(classifyAnswer(typed, 69)).toBe('ambiguous')
    expect(typed.guessFloor).toBe(0.5)
    expect(ceilingFor(typed)).toBe(2)
  })

  it('deals the three numbers of bigger3 as the cards, marked on a 0–1000 line', () => {
    for (const { fact, task } of tasks) {
      if (fact.family !== 'bigger3' || task.kind !== 'choice') continue
      expect(task.prompt).toEqual({ scene: 'line', min: 0, max: 1000 })
      expect([...task.options].map(Number).sort()).toEqual([...fact.operands].sort())
    }
  })

  it('reads the questions in plain Danish', () => {
    const say = (id: string, kind: TaskKind) => text(build(order1000, findById(order1000, id).id, kind))
    expect(say('o1000:plus100:345', 'keypad')).toBe('Hvilket tal er hundrede mere end tre hundrede og femogfyrre?')
    expect(say('o1000:crossHundred:plus1:399', 'choice')).toBe('Hvilket tal kommer efter tre hundrede og nioghalvfems?')
    expect(say('o1000:crossHundred:minus10:405', 'sortOrder')).toBe('Tæl baglæns i tiere fra fire hundrede og femogtyve.')
    expect(say('o1000:minus100:345', 'sortOrder')).toBe('Tæl baglæns i hundreder fra fire hundrede og femogfyrre.')
  })

  it('explains over a new hundred', () => {
    const hint = (id: string, tag: Parameters<SkillDef['hint']>[1] = null) => order1000.hint(findById(order1000, id), tag)
    expect(compile(hint('o1000:crossHundred:plus1:399').speech).text)
      .toBe('Efter tre hundrede og nioghalvfems kommer fire hundrede. Ti tiere bliver til et hundrede.')
    expect(compile(hint('o1000:crossHundred:minus10:405').speech).text)
      .toBe('Ti mindre end fire hundrede og fem er tre hundrede og femoghalvfems. Et hundrede bliver til ti tiere.')
    expect(hint('o1000:crossHundred:plus1:399').visual).toEqual({ scene: 'line', min: 390, max: 410, hops: [399, 400] })
    const fdc = hint('o1000:biggerMixed:69:102', 'firstDigitCompare')
    expect(fdc.misconception).toBe('firstDigitCompare')
    expect(compile(fdc.speech).text).toBe('Det første ciffer siger ikke det hele. Et tal med tre cifre er større end et tal med to cifre.')
  })
})

// ─── numberLine100 and numberLine1000 ───────────────────────────────────────

describe('numberLine100 and numberLine1000', () => {
  const t100 = tasksUnderTest(numberLine100, 2)
  const t1000 = tasksUnderTest(numberLine1000)

  it('places with ±5 on 0–100 and ±50 on 0–1000, the ticks of readArrow exactly, and is always production', () => {
    for (const { fact, task } of [...t100, ...t1000]) {
      if (task.kind !== 'numberline') continue
      const want = { placeTens: 5, placeAny: 5, readArrow: 2, placeHundreds: 50, round10: 4, round100: 25 }[fact.family as 'placeTens']
      const tol = fact.skill === 'numberLine1000' && fact.family === 'placeAny' ? 50 : want
      expect(task.tolerance, fact.id).toBe(tol)
      expect(isProduction(task), fact.id).toBe(true)
      expect(guessP(task)).toBeLessThanOrEqual(0.12)
      // nothing tagged lies inside the tolerance: a wrong answer is never a right one
      for (const key of Object.keys(task.distractorTags)) expect(isCorrect(task, Number(key)), `${fact.id} ${key}`).toBe(false)
    }
  })

  it('puts the rounding line on the hundred’s own stretch, and counts the guess there', () => {
    for (const { fact, task } of t1000) {
      if (fact.family !== 'round10' || task.kind !== 'numberline') continue
      const n = lastNumber(fact.id)
      const lo = Math.floor(n / 100) * 100
      expect(task.prompt).toEqual({ scene: 'line', min: lo, max: lo + 100 })
      expect(task.range).toEqual([lo, lo + 100])
      expect(guessP(task)).toBeCloseTo(9 / 101)
    }
  })

  it('asks the cards about a stretch of the line that only the answer lies in', () => {
    for (const { fact, task } of [...t100, ...t1000]) {
      if (task.kind !== 'choice' || fact.family.startsWith('round')) continue
      const m = /ligger (midt )?mellem (.+) og (.+)\?$/.exec(text(task))
      expect(m, `${fact.id}: ${text(task)}`).not.toBeNull()
      const nums = task.options.map(Number)
      const lo = Math.min(...nums.filter((v) => v !== task.answer).concat(task.answer as number))
      expect(lo).toBeGreaterThanOrEqual(0)
      // the answer's stretch from the prompt words: every wrong card is outside it or not its middle
      const answer = task.answer as number
      const step = fact.skill === 'numberLine100' ? 10 : 100
      for (const v of nums) {
        if (v === answer) continue
        const inside = Math.floor(v / step) === Math.floor(answer / step) && v % step !== 0 && answer % step !== 0 && !m![1]
        expect(inside, `${fact.id}: card ${v} lies in the stretch`).toBe(false)
      }
    }
  })

  it('reads an arrow on a tick, and a hop from the ten (hundred) below for any other number', () => {
    for (const { fact, task } of [...t100, ...t1000]) {
      if (task.kind !== 'keypad' || fact.family.startsWith('round')) continue
      const p = task.prompt
      if (p.scene !== 'line') throw new Error('expected a line')
      const n = task.answer as number
      if (fact.family === 'placeAny') {
        const step = fact.skill === 'numberLine100' ? 10 : 100
        expect(p.hops, fact.id).toEqual([n % step === 0 ? n - step : n - (n % step), n])
        expect(text(task)).toMatch(/^Hoppet starter ved .+\. Hvor lander det\?$/)
      } else {
        expect(p.arrowAt).toBe(n)
        expect(text(task)).toBe('Hvilket tal peger pilen på?')
      }
    }
  })

  it('reads the questions in plain Danish', () => {
    const say = (def: SkillDef, id: string, kind: TaskKind) => text(build(def, findById(def, id).id, kind))
    expect(say(numberLine100, 'nl100:placeAny:37', 'numberline')).toBe('Sæt nålen ved syvogtredive.')
    expect(say(numberLine100, 'nl100:placeAny:37', 'choice')).toBe('Hvilket tal ligger mellem tredive og fyrre?')
    expect(say(numberLine100, 'nl100:readArrow:35', 'choice')).toBe('Hvilket tal ligger midt mellem tredive og fyrre?')
    expect(say(numberLine100, 'nl100:placeTens:70', 'choice')).toBe('Hvilket tal ligger midt mellem tres og firs?')
    expect(say(numberLine100, 'nl100:placeAny:37', 'keypad')).toBe('Hoppet starter ved tredive. Hvor lander det?')
    expect(say(numberLine1000, 'nl1000:placeAny:345', 'choice')).toBe('Hvilket tal ligger mellem tre hundrede og fire hundrede?')
    expect(say(numberLine1000, 'nl1000:round10:347', 'keypad')).toBe('Hvilken tier ligger tre hundrede og syvogfyrre tættest på?')
    expect(say(numberLine1000, 'nl1000:round100:347', 'numberline')).toBe('Sæt nålen ved det hundrede, der ligger tættest på tre hundrede og syvogfyrre.')
  })

  it('explains: find the tens around the number, then walk on', () => {
    const hint = (def: SkillDef, id: string) => compile(def.hint(findById(def, id), null).speech).text
    expect(hint(numberLine100, 'nl100:placeAny:37')).toBe('Syvogtredive ligger mellem tredive og fyrre. Start ved tredive og gå syv frem.')
    expect(hint(numberLine100, 'nl100:readArrow:35')).toBe('Femogtredive ligger midt mellem tredive og fyrre.')
    expect(hint(numberLine100, 'nl100:placeTens:70')).toBe('Halvfjerds er syv tiere. Hop ti ad gangen fra nul.')
    expect(hint(numberLine1000, 'nl1000:placeHundreds:400')).toBe('Fire hundrede er fire hundreder. Hop hundrede ad gangen fra nul.')
    expect(hint(numberLine1000, 'nl1000:round10:345')).toBe('Tre hundrede og femogfyrre ligger mellem tre hundrede og fyrre og tre hundrede og halvtreds. Ligger tallet lige i midten, runder vi op.')
  })
})

// ─── All eight skills of SK2-NUM ────────────────────────────────────────────

const ALL: readonly SkillDef[] = [hear100, order100, numberLine100, tensOnesDef, hear1000, order1000, numberLine1000, placeValue1000Def]

describe('the eight number and place-value skills of 1.–2. klasse', () => {
  const built = new Map(ALL.map((def) => [def.id, tasksUnderTest(def)]))

  /** Share of production tasks per kind (1 = every task, 0 = none) and the highest ceiling of the others. */
  const PRODUCTION: Readonly<Record<string, Partial<Record<TaskKind, number>>>> = {
    hear100: { choice: 0, keypad: 1 },
    hear1000: { choice: 0, keypad: 1 },
    // "Hvilket tal er størst, a eller b?" on a keypad is a coin flip: 5 of 7 (7 of 9) families
    order100: { choice: 0, sortOrder: 1, keypad: 5 / 7 },
    order1000: { choice: 0, sortOrder: 1, keypad: 7 / 9 },
    numberLine100: { numberline: 1, choice: 0, keypad: 1 },
    numberLine1000: { numberline: 1, choice: 0, keypad: 1 },
    // fillSlots is no production kind in tensOnes (SPEC §2.2): two digits to put in order
    tensOnes: { choice: 0, keypad: 1, buildBase: 1, fillSlots: 0 },
    placeValue1000: { choice: 0, keypad: 1, buildBase: 1, fillSlots: 1 },
  }

  it('has the production kinds of SPEC §2.2 and keeps every other task at box 3 or below', () => {
    for (const def of ALL) {
      const tasks = built.get(def.id)!
      for (const kind of def.kinds) {
        const own = tasks.filter((t) => t.kind === kind)
        const families = new Set(own.map((t) => t.fact.family))
        const prodFamilies = [...families].filter((fam) => own.filter((t) => t.fact.family === fam).every((t) => isProduction(t.task)))
        expect(prodFamilies.length / families.size, `${def.id} ${kind}`).toBeCloseTo(PRODUCTION[def.id][kind]!, 5)
        for (const { fact, task } of own) {
          if (isProduction(task)) continue
          expect(ceilingFor(task), `${fact.id} ${kind}`).toBeLessThanOrEqual(3)
          expect(guessP(task)).toBeGreaterThan(0.12)
        }
      }
      // SPEC §3.3: a kind that is production for at least 90 % of the instances, and it comes first
      const meta = SKILL_BY_ID[def.id]
      const first = def.kinds.find((k) => meta.production.includes(k))!
      const tasks1 = tasks.filter((t) => t.kind === first)
      expect(tasks1.filter((t) => isProduction(t.task)).length / tasks1.length, `${def.id} ${first}`).toBe(1)
    }
  })

  it('never tags a number from the question as a misconception: that is ambiguous (A9)', () => {
    for (const def of ALL) {
      for (const f of factsUnderTest(def)) {
        for (const c of def.candidates(f)) {
          if (!isMisconceptionTag(c.tag) || typeof c.value !== 'number') continue
          expect(f.operands, `${f.id}: ${c.value} is ${c.tag}`).not.toContain(c.value)
        }
      }
    }
  })

  it('classifies the A9 cases as ambiguous on the keypad', () => {
    const cases: [SkillDef, string, number][] = [
      [tensOnesDef, 'to:build:40', 4], // 4 rods and no cubes: the rods counted, or 4 + 0
      [tensOnesDef, 'to:decompose:tens:40', 40], // the tens' value, or the number in the question
      [placeValue1000Def, 'pv:buildHTO:300', 3], // three plates: counted, added, or the zeros dropped
      [placeValue1000Def, 'pv:expand:t:477', 7], // the digit for its value, or the 7 of + 7
      [placeValue1000Def, 'pv:expand:h:474', 4],
      [order1000, 'o1000:biggerMixed:69:102', 69], // the first digit, or the other number
    ]
    for (const [def, id, given] of cases) {
      const t = build(def, findById(def, id).id, 'keypad')
      expect(classifyAnswer(t, given), `${id} ${given}`).toBe('ambiguous')
    }
  })

  it('builds the same hint from a fact the round screen rebuilds from the task (id only)', () => {
    for (const def of ALL) {
      for (const { fact, kind, task } of built.get(def.id)!.filter((_, i) => i % 5 === 0)) {
        const rebuilt: Fact = { id: task.factId, skill: task.skill, family: task.family, operands: [], answer: task.answer, rank: 0 }
        const tags = [null, ...new Set(Object.values(task.distractorTags))]
        for (const tag of tags) {
          const want = def.hint(fact, tag, kind)
          const got = def.hint(rebuilt, tag, kind)
          expect(compile(got.speech).text, `${fact.id} ${kind} ${String(tag)}`).toBe(compile(want.speech).text)
          expect(got.visual).toEqual(want.visual)
        }
      }
    }
  })

  it('speaks every hint for every tag with recorded clips, without digits, and only names its own misconception', () => {
    for (const def of ALL) {
      for (const { fact, kind, task } of built.get(def.id)!.filter((_, i) => i % 3 === 0)) {
        for (const tag of [null, 'near', 'operand', 'other', ...new Set(Object.values(task.distractorTags))] as const) {
          const h = def.hint(fact, tag, kind)
          expect(speechProblems(h.speech), `${fact.id} ${kind} ${String(tag)}`).toEqual([])
          if (h.misconception) expect(h.misconception).toBe(tag)
        }
      }
    }
  })
})

// ─── The regions ────────────────────────────────────────────────────────────

describe('Hundredemarken (w1-tal100) and Stortalsbjerget (w2-tal1000)', () => {
  const regionNodes = NODES.filter((n) => n.region === 'w1-tal100' || n.region === 'w2-tal1000' || n.id === 'bakke-finale' || n.id === 'skov-finale')
  const profile = newProfile({ grade: 1, unlocked: { worlds: ['eng', 'bakke', 'skov'], regions: ['w1-tal100', 'w2-tal1000'] } })
  const ctx = { day: '2026-10-02', sessionId: 's', audioVerified: true }

  it('has keys on every node that build every kind', () => {
    for (const node of regionNodes.filter((n) => n.region)) {
      const keys = keysForNode(node, { states: {}, audioVerified: true })
      expect(keys.length, node.id).toBeGreaterThan(0)
      for (const k of keys) {
        for (const kind of k.kinds) {
          for (let i = 0; i < 6; i++) {
            const t = k.build(kind, makeRng(i * 13 + 1), i)
            expect(speechProblems(t.speech), `${t.factId} ${kind}`).toEqual([])
          }
        }
      }
    }
  })

  it('plans a whole round on every node, a production-only trial, and the world finales', () => {
    for (const node of regionNodes) {
      for (let r = 0; r < 4; r++) {
        const plan = planRound(node, { ...profile, roundIndex: 20 + r }, ctx)
        expect(plan.tasks.length, node.id).toBe(node.size)
        const skills = new Set(node.skills.map((s) => s.skill))
        for (const t of plan.tasks) {
          expect(skills.has(t.skill), `${node.id} ${t.skill}`).toBe(true)
          const families = node.skills.find((s) => s.skill === t.skill)?.families
          if (families) expect(families).toContain(t.family)
          expect(speechProblems(t.speech), t.factId).toEqual([])
          if (node.slot === 'trial' || node.slot === 'finale') expect(isProduction(t), `${node.id} ${t.factId} ${t.kind}`).toBe(true)
        }
      }
    }
  })

  it('leaves the 3. klasse families (regroup, round10, round100) out of Stortalsbjerget', () => {
    for (const node of regionNodes.filter((n) => n.region === 'w2-tal1000')) {
      for (const k of keysForNode(node, { states: {}, audioVerified: true })) {
        expect(['placeValue1000/regroup', 'numberLine1000/round10', 'numberLine1000/round100']).not.toContain(k.key)
      }
    }
  })
})
