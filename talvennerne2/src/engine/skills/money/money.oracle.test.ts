// Oracle tests for the money skills of 1.–2. klasse (SPEC §15.1): every canonical fact and 200 seeded
// instances per family, every kind, compared with money.oracle.ts — the amount read from the coins in
// the picture and the spoken question, the fewest pieces counted out, wrong amounts by pædagogik §3.2.
import { describe, expect, it, vi } from 'vitest'
import { isCorrect } from '../../answer'
import { classifyAnswer } from '../../misconceptions'
import { registeredSkills } from '../../registry'
import { masteryKeyOf } from '../../tasks'
import { makeRng } from '../../rng'
import type { AnswerValue, Fact, SkillId, Task } from '../../types'
import {
  answerProblems, cardProblems, first, hintProblems, registeredSkill, spokenText, tagsToHint, taskSpeechProblems, type Built,
} from '../number/number.oracle'
import {
  avoidProblemsB, cardMisconceptions, detectableReachProblems, expectB, instanceIdProblems, normalisationProblems, specificHintProblems,
  prefixProblems, productionProblemsB, specKindProblemsB, sweepB, tagCheck, typedSwap, type WhyB,
} from '../clock/clock.oracle'
import {
  amountsIn, askedPiece, coinNamesOracle, coinWord, digitComplementKr, exactTrays, explainChange, explainPile, fewestWays,
  isCoin, isPiece, parsePile, parsePurchase, parseSale, pileProblems, priceAsked, saleAsked, setPieces, setToken, shopOf,
  tokenPiece,
} from './money.oracle'

vi.setConfig({ testTimeout: 240_000 })

const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0)

/** Typed values on a kroner keypad: every number the keys take, as øre. */
const typedOre = (t: Task): number[] => Array.from({ length: 10 ** t.maxDigits }, (_, kr) => kr * 100)

/**
 * Keypad answers in kroner (SPEC §3.1): entryScale 100, the suffix 'kr', as many digits as the range's
 * kroner, whole kroner only.
 */
function keypadProblems(t: Task): string[] {
  if (t.kind !== 'keypad') return []
  const out: string[] = []
  if (t.entryScale !== 100 || t.unit !== 'kr') out.push(`${t.factId} keypad: entryScale ${t.entryScale}, unit ${t.unit}`)
  if (t.maxDigits !== String(Math.floor(t.range[1] / 100)).length) out.push(`${t.factId} keypad: ${t.maxDigits} digits for ${t.range[1] / 100} kr`)
  if (typeof t.answer !== 'number' || t.answer % 100 !== 0) out.push(`${t.factId} keypad: answer ${String(t.answer)} is not whole kroner`)
  return out
}

/** The answer checks of the wave-1 kit, with SPEC §3.1's kroner keypad. */
const answerChecks = (t: Task): string[] => [...answerProblems(t).filter((p) => !/ digits for the range /.test(p)), ...keypadProblems(t)]

/** Classification of every card, every typed amount, every tray sum against the oracle's explanation (swapped kroner left to their own test). */
function moneyClassification(built: readonly Built[], explain: (b: Built, v: number) => WhyB): string[] {
  const out: string[] = []
  for (const b of built) {
    const { task } = b
    if (typeof task.answer !== 'number') continue
    const values = task.kind === 'choice' ? task.options.map(Number)
      : task.kind === 'keypad' ? typedOre(task)
        : task.kind === 'pay' ? Array.from({ length: task.range[1] / 100 + 1 }, (_, kr) => kr * 100) : []
    for (const v of values) {
      if (v === task.answer) continue
      const w = explain(b, v)
      if (w.swap && expectB(w) === 'digitSwap') continue
      const p = tagCheck(task, v, w, task.kind === 'choice' ? 'card' : task.kind === 'pay' ? 'tray' : 'typed')
      if (p) out.push(p)
    }
  }
  return out
}

/** A card set shows the diagnostic card whenever the oracle knows one inside the cards' range. */
function diagnosticProblems(built: readonly Built[], known: (b: Built) => number[], explain: (b: Built, v: number) => WhyB): string[] {
  const out: string[] = []
  for (const b of built) {
    const t = b.task
    if (t.kind !== 'choice' || typeof t.answer !== 'number') continue
    const real = known(b).filter((v) => {
      const tag = expectB(explain(b, v))
      return v !== t.answer && v >= t.range[0] && v <= t.range[1] && tag !== 'plain' && tag !== 'ambiguous' && tag !== 'digitSwap'
    })
    if (real.length > 0 && cardMisconceptions(t).length === 0) out.push(`${t.factId}: no diagnostic card among [${t.options}] (could be ${real})`)
  }
  return out
}

/** A value a non-card task can be answered with: whole kroner the keys take, a sum or set the purse can pay, a subset of the things. */
function reach(t: Task, v: AnswerValue): boolean {
  if (t.kind === 'keypad') return typeof v === 'number' && v % 100 === 0 && v / 100 < 10 ** t.maxDigits
  if (t.kind === 'pay') {
    const purse = shopOf(t.prompt)?.purse ?? []
    if (typeof v === 'number') return fewestWays(v, purse).some((w) => w.length <= 24)
    return (setPieces(v) ?? [NaN]).every((p) => purse.includes(p))
  }
  if (t.kind === 'multiSelect') return typeof v === 'string' && v.split('|').every((x) => t.options.map(String).includes(x))
  return true
}

/** Fact ids of a procedure skill: the format, the family the id names, the oracle's answer, one meaning per id. */
function idChecks(def: ReturnType<typeof registeredSkill>, facts: readonly Fact[], oracle: (f: Fact) => { family: string; answer: AnswerValue } | null): string[] {
  const out = instanceIdProblems(def, facts)
  for (const f of facts) {
    const o = oracle(f)
    if (!o) out.push(`${def.id} ${f.id}: not an instance the skill describes`)
    else {
      if (o.family !== f.family) out.push(`${f.id}: family ${f.family}, the id says ${o.family}`)
      if (o.answer !== f.answer) out.push(`${f.id}: answer ${String(f.answer)}, oracle ${String(o.answer)}`)
    }
    const key = def.mode === 'recall' ? f.id : `${def.id}/${f.family}`
    if (masteryKeyOf(def, f) !== key) out.push(`${f.id}: mastery key ${masteryKeyOf(def, f)}`)
  }
  return out
}

describe('the money oracle itself', () => {
  it('reads amounts and coin names the Danish way, and counts the fewest pieces', () => {
    expect(amountsIn('Betal sytten kroner.')).toEqual([1700])
    expect(amountsIn('tolv kroner og halvtreds øre')).toEqual([1250])
    expect(amountsIn('en krone')).toEqual([100])
    expect(amountsIn('halvtreds øre')).toEqual([50])
    expect(amountsIn('et hundrede kroner')).toEqual([10000])
    expect(amountsIn('Det koster tretten kroner. Du betaler med en tyvekrone.')).toEqual([1300])
    expect(coinWord('femkronen')).toEqual({ ore: 500, form: 'def' })
    expect(coinWord('tyvekroner')).toEqual({ ore: 2000, form: 'pl' })
    expect(coinWord('halvtredskroneseddel')).toEqual({ ore: 5000, form: 'indef' })
    expect(coinWord('hundredkronesedlen')).toEqual({ ore: 10000, form: 'def' })
    expect(coinWord('halvtredsører')).toEqual({ ore: 50, form: 'pl' })
    expect(tokenPiece('c0500')).toBe(500)
    expect(fewestWays(2700, [5000, 2000, 1000, 500, 200, 100])).toEqual([[2000, 500, 200]])
    expect(fewestWays(600, [500, 200])).toEqual([[200, 200, 200]])
    expect(digitComplementKr(37)).toBe(73)
    expect(digitComplementKr(55)).toBe(55)
    expect(digitComplementKr(40)).toBeNull()
  })
})

// ─── coinNames ──────────────────────────────────────────────────────────────

describe('coinNames oracle', () => {
  const def = registeredSkill('coinNames')
  const { canon, built } = sweepB(def, 6)

  it('has SPEC §2.2’s 10 facts mnt:<øre>, the six coins and the four notes', () => {
    expect(canon.map((f) => f.id).sort()).toEqual([50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].map((o) => `mnt:${o}`).sort())
    expect(first([...idChecks(def, canon, (f) => coinNamesOracle(f.id)), ...prefixProblems(def, canon, 'mnt')])).toEqual([])
    // the strategy shows the piece itself
    for (const f of canon) for (const kind of def.kinds) expect(def.hint(f, null, kind).visual, f.id).toEqual({ scene: 'coins', ore: [f.answer] })
  })

  it('asks for the piece the sentence names: one on the cards, all of them among the things', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const text = spokenText(task.speech)
      const ore = askedPiece(text, kind)
      const where = `${fact.id} ${kind}`
      if (ore !== coinNamesOracle(fact.id)?.answer) problems.push(`${where}: "${text}" names ${ore}`)
      if (task.prompt.scene !== 'hear') problems.push(`${where}: a ${task.prompt.scene} prompt`)
      if (kind === 'choice') {
        if (task.answer !== ore || task.answerType !== 'ore') problems.push(`${where}: answer ${String(task.answer)} (${task.answerType})`)
        problems.push(...cardProblems(task, (c) => isPiece(c)))
      } else {
        // "Tryk på alle femkroner.": the answer is every card showing the piece, and only those
        const pieces = task.options.map(tokenPiece)
        const want = task.options.filter((_, i) => pieces[i] === ore).map(String)
        if (pieces.some((p) => p === null)) problems.push(`${where}: options [${task.options}] are not all pieces`)
        if (task.options.length < 5 || task.options.length > 8) problems.push(`${where}: ${task.options.length} things (SPEC §3.2: 5–8)`)
        if (new Set(task.options.map(String)).size !== task.options.length) problems.push(`${where}: the same token twice`)
        if (want.length < 2 || want.length === task.options.length) problems.push(`${where}: ${want.length} of ${task.options.length} things are the piece`)
        if (task.answerType !== 'set' || !isCorrect(task, want.join('|')) || !isCorrect(task, [...want].reverse().join('|'))) problems.push(`${where}: answer ${String(task.answer)}, oracle ${want.join('|')}`)
      }
      problems.push(...answerChecks(task))
    }
    expect(first(problems)).toEqual([])
  })

  it('classifies every card and every selection as a plain error (no misconception in the catalogue names coins)', () => {
    const problems: string[] = []
    for (const { kind, task } of built) {
      const given: AnswerValue[] = kind === 'choice'
        ? task.options.filter((o) => o !== task.answer)
        : Array.from({ length: 2 ** task.options.length - 1 }, (_, m) => task.options.filter((_, i) => m + 1 & (1 << i)).map(String).join('|'))
      for (const g of given) {
        if (isCorrect(task, g)) continue
        const p = tagCheck(task, g, { mis: [] }, kind === 'choice' ? 'card' : 'set')
        if (p) problems.push(p)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('has SPEC’s production kind (seven things: 1 in 127) and ceilings (three cards: box 3)', () => {
    expect(first([...productionProblemsB(built), ...specKindProblemsB(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, every amount as SPEC §10.1 says it', () => {
    const tags = tagsToHint(def, canon)
    expect(first([...taskSpeechProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, canon), ...normalisationProblems(def, built, canon, tags)])).toEqual([])
  })
})

// ─── countCoins ─────────────────────────────────────────────────────────────

describe('countCoins oracle', () => {
  const def = registeredSkill('countCoins')
  const { canon, instances, all, built } = sweepB(def)
  const pile = (f: Fact) => parsePile(f.id)!
  const explain = (b: Built, v: number) => explainPile(pile(b.fact), b.task, v)

  it('has the four families of pædagogik §1.3, ids naming the coins, the amount as answer', () => {
    expect(def.families.map((f) => f.id)).toEqual(['sameCoins', 'mixedTo20', 'mixedTo100', 'biggestFirst'])
    const problems = idChecks(def, all, (f) => {
      const p = parsePile(f.id)
      return p ? { family: p.family, answer: sum(p.coins) * 100 } : null
    })
    for (const f of all) {
      const p = parsePile(f.id)
      if (p) problems.push(...pileProblems(p).map((x) => `${f.id}: ${x}`))
    }
    expect(canon.filter((f) => f.family === 'sameCoins').length).toBeGreaterThanOrEqual(12)
    for (const fam of def.families) expect(new Set(instances.get(fam.id)!.map((f) => f.id)).size, fam.id).toBeGreaterThan(5)
    problems.push(...prefixProblems(def, all, 'tael'), ...avoidProblemsB(def, instances))
    expect(first(problems)).toEqual([])
  })

  it('shows the coins the id names, and they add up to the answer (SPEC §3.1: øre)', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const p = task.prompt
      const coins = pile(fact).coins.map((c) => c * 100)
      if (p.scene !== 'coins' || p.ore.join() !== coins.join()) problems.push(`${where}: prompt ${JSON.stringify(p)}`)
      else if (sum(p.ore) !== task.answer || !p.ore.every(isCoin)) problems.push(`${where}: coins ${p.ore} make ${sum(p.ore)}, answer ${String(task.answer)}`)
      if (spokenText(task.speech) !== 'Hvor mange penge er der?') problems.push(`${where}: "${spokenText(task.speech)}"`)
      if (task.answerType !== 'ore') problems.push(`${where}: ${task.answerType}`)
      problems.push(...answerChecks(task), ...cardProblems(task, (c) => c % 100 === 0))
    }
    expect(first(problems)).toEqual([])
  })

  it('counts the same coins in every strategy picture, and they add up to the answer', () => {
    const problems: string[] = []
    for (const f of canon) {
      for (const tag of [null, 'coinsAsCount', 'operand', 'near'] as const) {
        const v = def.hint(f, tag).visual
        const coins = pile(f).coins.map((c) => c * 100).sort((a, b) => b - a)
        if (v.scene !== 'coinsSum' || [...v.ore].sort((a, b) => b - a).join() !== coins.join() || sum(v.ore) !== f.answer) problems.push(`${f.id} hint(${String(tag)}): ${JSON.stringify(v)}`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('classifies cards and typed amounts by pædagogik §3.2: coinsAsCount, and A9 where the count is also the number on a coin', () => {
    const known = (b: Built) => [pile(b.fact).coins.length * 100]
    expect(first([...moneyClassification(built, explain), ...diagnosticProblems(built, known, explain)])).toEqual([])
    // A9 does happen here: two 2-krone coins, 5 + 2 …
    const clashes = built.filter((b) => b.kind === 'keypad' && expectB(explain(b, pile(b.fact).coins.length * 100)) === 'ambiguous')
    expect(clashes.length).toBeGreaterThan(0)
    for (const b of clashes) expect(classifyAnswer(b.task, pile(b.fact).coins.length * 100), b.fact.id).toBe('ambiguous')
  })

  it('has SPEC’s production kind (keypad in kroner: guessFloor 1 in the kroner) and ceilings (three cards: box 3)', () => {
    expect(first([...productionProblemsB(built), ...specKindProblemsB(def, built), ...detectableReachProblems(built, reach)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, every amount as SPEC §10.1 says it', () => {
    const tags = tagsToHint(def, canon)
    expect(first([...taskSpeechProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, canon), ...normalisationProblems(def, built, canon, tags)])).toEqual([])
  })
})

// ─── payExact ───────────────────────────────────────────────────────────────

describe('payExact oracle', () => {
  const def = registeredSkill('payExact')
  const { canon, instances, all, built } = sweepB(def)
  const purchase = (f: Fact) => parsePurchase(f.id)!
  const purseOf = (t: Task) => shopOf(t.prompt)?.purse ?? []

  it('has the four families of pædagogik §1.3 and ids naming the price', () => {
    expect(def.families.map((f) => f.id)).toEqual(['to20', 'to50', 'to100', 'fewestCoins'])
    expect(first([...idChecks(def, all, (f) => {
      const p = parsePurchase(f.id)
      return p ? { family: p.family, answer: p.price } : null
    }), ...prefixProblems(def, all, 'pay'), ...avoidProblemsB(def, instances)])).toEqual([])
  })

  it('shows the fewest pieces from the purse that pay the price in every strategy picture', () => {
    const problems: string[] = []
    for (const f of all) {
      const p = purchase(f)
      const shop = shopOf(def.prompt(f, 'pay', makeRng(1)))
      const fewest = fewestWays(p.price, shop?.purse ?? [])[0] ?? []
      for (const tag of [null, 'near', 'other'] as const) {
        const v = def.hint(f, tag).visual
        if (v.scene !== 'coinsSum' || setToken(v.ore) !== setToken(fewest)) problems.push(`${f.id} hint(${String(tag)}): ${JSON.stringify(v)}, oracle ${fewest}`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('asks for the price in the shop, from a purse that can pay it; any exact payment is right, fewestCoins wants the fewest pieces', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const p = purchase(fact)
      const shop = shopOf(task.prompt)
      const asked = priceAsked(spokenText(task.speech))
      if (!asked || asked.price !== p.price || asked.fewest !== (p.family === 'fewestCoins')) problems.push(`${where}: "${spokenText(task.speech)}"`)
      if (!shop || shop.priceOre !== p.price || shop.paidOre !== undefined) problems.push(`${where}: prompt ${JSON.stringify(task.prompt)}`)
      const purse = purseOf(task)
      if (!purse.every(isPiece) || purse.length === 0) problems.push(`${where}: purse ${purse}`)
      const ways = fewestWays(p.price, purse)
      if (ways.length !== 1) problems.push(`${where}: ${ways.length} fewest ways to pay ${p.price} from ${purse}`)
      const fewest = setToken(ways[0] ?? [])
      if (kind === 'pay' && p.family !== 'fewestCoins') {
        if (task.answer !== p.price || task.answerType !== 'ore') problems.push(`${where}: answer ${String(task.answer)} (${task.answerType})`)
        for (const tray of exactTrays(p.price, purse)) if (!isCorrect(task, sum(tray)) || classifyAnswer(task, sum(tray)) !== null) problems.push(`${where}: paying ${tray} is not right`)
      } else {
        if (task.answer !== fewest || task.answerType !== 'set') problems.push(`${where}: answer ${String(task.answer)} (${task.answerType}), oracle ${fewest}`)
        if (kind === 'pay') {
          // the fewest pieces in any order are right; the same money in more pieces is not
          if (!isCorrect(task, [...fewest.split('|')].reverse().join('|'))) problems.push(`${where}: the fewest pieces in another order are wrong`)
          for (const tray of exactTrays(p.price, purse)) if (tray.length > ways[0].length && isCorrect(task, setToken(tray))) problems.push(`${where}: ${tray} (more pieces) is right`)
        }
      }
      if (kind === 'choice') {
        problems.push(...cardProblems(task))
        for (const o of task.options) {
          const pieces = setPieces(o)
          if (!pieces || !pieces.every((x) => purse.includes(x))) {
            problems.push(`${where}: card ${String(o)} is not money from the purse`)
            continue
          }
          const pays = sum(pieces) === p.price
          const right = p.family === 'fewestCoins' ? pays && pieces.length === ways[0]?.length : pays
          if (right !== (o === task.answer)) problems.push(`${where}: card ${String(o)} pays ${sum(pieces)}${right ? ', a right answer marked wrong' : ''}`)
        }
      }
      problems.push(...answerChecks(task))
    }
    expect(first(problems)).toEqual([])
  })

  it('classifies wrong cards, tray sums and trays as plain errors (paying has no misconception in the catalogue)', () => {
    const problems: string[] = [...moneyClassification(built, () => ({ mis: [] }))]
    for (const { task } of built) {
      if (task.answerType !== 'set') continue
      const purse = purseOf(task)
      for (const g of [...task.options, ...exactTrays(amountOfSet(task.answer), purse).map(setToken)]) {
        if (isCorrect(task, g)) continue
        const p = tagCheck(task, g, { mis: [] }, 'set')
        if (p) problems.push(p)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('has SPEC’s production kind (pay: 0.01) and ceilings (three cards: box 3)', () => {
    expect(first([...productionProblemsB(built), ...specKindProblemsB(def, built), ...detectableReachProblems(built, reach)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, every amount as SPEC §10.1 says it', () => {
    const tags = tagsToHint(def, canon)
    expect(first([...taskSpeechProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, canon), ...normalisationProblems(def, built, canon, tags)])).toEqual([])
  })
})

const amountOfSet = (v: AnswerValue): number => sum(setPieces(v) ?? [])

// ─── change ─────────────────────────────────────────────────────────────────

describe('change oracle', () => {
  const def = registeredSkill('change')
  const { canon, instances, all, built } = sweepB(def)
  const sale = (f: Fact) => parseSale(f.id)!
  const explain = (b: Built, v: number) => explainChange(sale(b.fact), b.task, v)

  it('has the four families of pædagogik §1.3 and ids naming the price; the change is what was paid minus the price', () => {
    expect(def.families.map((f) => f.id)).toEqual(['from10', 'from20', 'from50', 'from100'])
    expect(first([...idChecks(def, all, (f) => {
      const s = parseSale(f.id)
      return s ? { family: s.family, answer: s.paid - s.price } : null
    }), ...prefixProblems(def, all, 'byt'), ...avoidProblemsB(def, instances)])).toEqual([])
  })

  it('counts up from the price to what was paid in the strategy picture, and never gives the change away before a mistake', () => {
    const problems: string[] = []
    for (const f of all) {
      const s = sale(f)
      const [price, paid] = [s.price / 100, s.paid / 100]
      for (const tag of [null, 'wrongOperation', 'digitComplement10', 'operand', 'near'] as const) {
        const v = def.hint(f, tag).visual
        const where = `${f.id} hint(${String(tag)}): ${JSON.stringify(v)}`
        if (v.scene !== 'line' || v.min !== 0 || v.max !== paid) problems.push(where)
        else if (tag === null) {
          if (v.arrowAt !== price || v.target !== paid || v.hops !== undefined) problems.push(where)
        } else if (!v.hops || v.hops[0] !== price || v.hops[v.hops.length - 1] !== paid) problems.push(where)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('works the change out from the question and the shop: what it costs, what is paid, a purse to give it from', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const s = sale(fact)
      const asked = saleAsked(spokenText(task.speech))
      if (!asked || asked.price !== s.price || asked.paid !== s.paid) problems.push(`${where}: "${spokenText(task.speech)}"`)
      else if (task.answer !== asked.paid - asked.price) problems.push(`${where}: answer ${String(task.answer)}, the question says ${asked.paid - asked.price}`)
      const shop = shopOf(task.prompt)
      if (!shop || shop.priceOre !== s.price || shop.paidOre !== s.paid) problems.push(`${where}: prompt ${JSON.stringify(task.prompt)}`)
      else if (kind === 'pay') {
        if (!shop.purse.every((x) => isPiece(x) && x < s.paid) || fewestWays(s.paid - s.price, shop.purse).length === 0) problems.push(`${where}: purse ${shop.purse}`)
        for (const tray of exactTrays(s.paid - s.price, shop.purse)) if (!isCorrect(task, sum(tray))) problems.push(`${where}: giving ${tray} is not right`)
      }
      if (task.answerType !== 'ore') problems.push(`${where}: ${task.answerType}`)
      problems.push(...answerChecks(task), ...cardProblems(task, (c) => c % 100 === 0))
    }
    expect(first(problems)).toEqual([])
  })

  it('classifies cards, typed amounts and trays by pædagogik §3.2: wrongOperation, digitComplement10 from a hundred, A9 on the price', () => {
    const known = (b: Built) => {
      const s = sale(b.fact)
      const comp = s.paid === 10000 ? digitComplementKr(s.price / 100) : null
      return [s.price + s.paid, ...(comp === null ? [] : [comp * 100])]
    }
    expect(first([...moneyClassification(built, explain), ...diagnosticProblems(built, known, explain)])).toEqual([])
    // A9 does happen: 100 − 55 made up digit by digit is 55, the price
    const clash = built.find((b) => b.fact.id === 'byt:from100:5500' || (sale(b.fact).paid === 10000 && digitComplementKr(sale(b.fact).price / 100) === sale(b.fact).price / 100))
    if (clash) expect(classifyAnswer(clash.task, sale(clash.fact).price)).toBe('ambiguous')
  })

  it('has SPEC’s production kinds (keypad in kroner, pay) and ceilings (three cards: box 3)', () => {
    expect(first([...productionProblemsB(built), ...specKindProblemsB(def, built), ...detectableReachProblems(built, reach)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, every amount as SPEC §10.1 says it', () => {
    const tags = tagsToHint(def, canon)
    expect(first([...taskSpeechProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, canon), ...normalisationProblems(def, built, canon, tags)])).toEqual([])
  })
})

// ─── SPEC §4.1 globalChecks on a kroner keypad ──────────────────────────────

describe('digitSwap on a kroner keypad (SPEC §4.1 globalChecks)', () => {
  // ORK2b finding: a keypad answer of 13 kr or more typed back to front (47 kr typed as 74) is SPEC §4.1's
  // digitSwap slip, but the engine looks at the answer in øre (4700, whose last digit is 0) and never sees a
  // swap: misconceptions.ts digitSwapPossible() → digitSwapOf(4700) is null, so 7400 is 'other'. Neither
  // countCoins nor change lists the swapped amount as a candidate of its own.
  const swaps = (id: SkillId, explainOf: (f: Fact, t: Task, v: number) => WhyB) => {
    const def = registeredSkill(id)
    const out: string[] = []
    for (const { fact, task } of sweepB(def, 1).built) {
      if (task.kind !== 'keypad') continue
      for (const v of typedOre(task)) {
        const w = explainOf(fact, task, v)
        if (!w.swap || expectB(w) !== 'digitSwap') continue
        const got = classifyAnswer(task, v)
        if (got !== 'digitSwap') out.push(`${fact.id} keypad: ${v / 100} kr typed for ${Number(task.answer) / 100} kr is ${got}, SPEC §4.1 digitSwap`)
      }
    }
    return out
  }
  it('finds swapped kroner to test (a check of the oracle)', () => {
    const pile = parsePile('tael:mixedTo100:20+20+5+2')!
    const fake = { kind: 'keypad', answer: 4700, entryScale: 100 } as Task
    expect(typedSwap(fake, 7400, pile.coins)).toBe(true)
    expect(explainPile(pile, fake, 7400)).toEqual({ mis: [], operand: false, swap: true })
  })
  it.fails('countCoins: a typed amount with its kroner digits swapped is digitSwap', () => {
    expect(first(swaps('countCoins', (f, t, v) => explainPile(parsePile(f.id)!, t, v)))).toEqual([])
  })
  it.fails('change: a typed amount with its kroner digits swapped is digitSwap', () => {
    expect(first(swaps('change', (f, t, v) => explainChange(parseSale(f.id)!, t, v)))).toEqual([])
  })
})

describe('money fact ids across every registered skill (CONVENTIONS)', () => {
  it('are unique across all registered skills, and each money skill has a prefix of its own', () => {
    const MONEY: readonly SkillId[] = ['coinNames', 'countCoins', 'payExact', 'change']
    const owner = new Map<string, SkillId>()
    const prefixes = new Map<string, Set<SkillId>>()
    const problems: string[] = []
    for (const def of registeredSkills()) {
      const facts = [...def.enumerate(), ...(MONEY.includes(def.id) && def.mode === 'procedure' ? sweepB(def, 1).all : [])]
      for (const f of facts) {
        const prev = owner.get(f.id)
        if (prev !== undefined && prev !== def.id) problems.push(`${f.id}: ${prev} and ${def.id}`)
        owner.set(f.id, def.id)
        const p = f.id.slice(0, f.id.indexOf(':'))
        prefixes.set(p, (prefixes.get(p) ?? new Set()).add(def.id))
      }
    }
    for (const id of MONEY) {
      const own = [...prefixes].filter(([, s]) => s.has(id))
      if (own.length !== 1 || own[0][1].size !== 1) problems.push(`${id}: prefixes ${own.map(([p, s]) => `${p} (${[...s]})`)}`)
    }
    expect(first(problems)).toEqual([])
  })
})
