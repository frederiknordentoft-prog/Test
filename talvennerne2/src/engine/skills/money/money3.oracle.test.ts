// Oracle tests for kronerOre (SPEC §2.2, §3 with A14, §4.1 with A9/A11, §10.1, §15.1), ORK3c, against money3.oracle.ts
// and the wave-3 kit in clock/clock3.oracle.ts: every canonical fact and 200 seeded instances per family, both kinds,
// the money read from the price tag drawn and the price said, the halvtredsører on the table, the coins on the cards;
// and the 3. klasse families Markedet plays of payExact (fewestCoins) and change (from100), against money.oracle.ts.
import { describe, expect, it } from 'vitest'
import { isCorrect } from '../../answer'
import { classifyAnswer } from '../../misconceptions'
import { masteryKeyOf } from '../../tasks'
import type { AnswerValue, ErrorTag, Fact, HintSpec, SkillDef, Task } from '../../types'
import { knownObject } from '../../../ui/scenes/objects'
import { purseOf } from '../../../ui/task/pay/logic'
import { factFor } from '../../../ui/hint/hintFor'
import {
  answerProblems, cardProblems, first, hintProblems, registeredSkill, spokenText, tagsToHint, taskSpeechProblems, type Built,
} from '../number/number.oracle'
import { sentences, spokenTokens, statementTrue } from '../algebra/algebra2.oracle'
import { avoidProblemsB, prefixProblems, specificHintProblems } from '../clock/clock.oracle'
import {
  classifyC, detectableC, diagnosticCardsC, divisionWordProblems, drawnCoins, fastProblemsC, fewestCount, instanceProblems, markupOfCard,
  markupOfPrompt, normalisationProblems3, productionProblemsC, specKindProblemsC, sweepC, sweepFamilies, typedSwapC, type WhyC,
} from '../clock/clock3.oracle'
import { amountsIn, digitComplementKr, explainChange, fewestWays, parsePurchase, parseSale, priceAsked, saleAsked, setPieces, setToken } from './money.oracle'
import { SHOP_COINS, askedKronerOre, coinStatement, exactTraysC, explainKronerOre, kronerOreOf, setAmount } from './money3.oracle'

const TIMEOUT = 600_000
const said = (t: Task): string => spokenText(t.speech)
const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0)

/** An amount drawn on a card or a tag ("12,50 kr.", "29 kr."), in øre. */
function drawnAmount(html: string): number | null {
  const m = /(\d+)(?:,(\d\d))? kr\./.exec(html.replace(/<[^>]*>/g, ' '))
  return m ? Number(m[1]) * 100 + Number(m[2] ?? 0) : null
}

/** The fact a task rebuilt from its id gets the same hint (ui/hint/hintFor.ts factFor). */
function rebuiltHintProblems(def: SkillDef, built: readonly Built[], tags: readonly (ErrorTag | null)[]): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) {
    const again = factFor(def, task)
    for (const tag of tags) if (JSON.stringify(def.hint(again, tag, kind)) !== JSON.stringify(def.hint(fact, tag, kind))) out.add(`${fact.id} ${kind} hint(${String(tag)}): another hint when rebuilt from the task`)
  }
  return [...out]
}

/** The tags a fact's hint is shown for: the plain ones and the misconceptions of the fact's own wrong answers. */
const ownTags = (def: SkillDef, f: Fact): (ErrorTag | null)[] => [null, 'near', 'operand', 'other', 'ambiguous', ...new Set(def.candidates(f).map((c) => c.tag))]

// ═══ kronerOre ══════════════════════════════════════════════════════════════

describe('kronerOre oracle', () => {
  const def = registeredSkill('kronerOre')
  const { canon, instances, all, built } = sweepC(def, 3)
  const coinsOf = (t: Task): number => (t.prompt.scene === 'coins' ? t.prompt.ore.length : 0)
  const why = (b: Built, v: AnswerValue): WhyC => (typeof v === 'number' ? explainKronerOre(kronerOreOf(b.fact.id)!, coinsOf(b.task), v) : { mis: [] })
  const tags = tagsToHint(def, all)

  it('has pædagogik §1.3’s three families and kro:<family>:<øre> ids the oracle reads; fiftiesInKroner all nine amounts', () => {
    expect(def.families.map((f) => f.id)).toEqual(['readAmount', 'fiftiesInKroner', 'addHalves'])
    expect(def.families.map((fam) => canon.filter((f) => f.family === fam.id).length)).toEqual([20, 9, 20])
    const problems: string[] = []
    for (const f of all) {
      const q = kronerOreOf(f.id)
      if (!q || q.family !== f.family || f.answer !== q.total || f.skill !== 'kronerOre') problems.push(`${f.id}: family ${f.family}, answer ${String(f.answer)}`)
      if (masteryKeyOf(def, f) !== `kronerOre/${f.family}`) problems.push(`${f.id}: mastery key ${masteryKeyOf(def, f)}`)
    }
    expect(new Set(canon.filter((f) => f.family === 'fiftiesInKroner').map((f) => f.answer))).toEqual(new Set([200, 300, 400, 500, 600, 700, 800, 900, 1000]))
    problems.push(...prefixProblems(def, all, 'kro'), ...avoidProblemsB(def, instances))
    problems.push(...instanceProblems(def, instances, (fam) => ({ readAmount: 40, fiftiesInKroner: 9, addHalves: 20 })[fam] ?? 1))
    expect(first(problems)).toEqual([])
  })

  it('asks for the money the child is given: the price tag drawn and said, the halvtredsører on the table, two of the price', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const q = kronerOreOf(fact.id)!
      const a = askedKronerOre(said(task), task.prompt)
      if (!a || a.family !== q.family || a.ore !== q.ore || a.pay !== (kind === 'pay')) {
        problems.push(`${where}: "${said(task)}" with ${JSON.stringify(task.prompt)}`)
        continue
      }
      const html = markupOfPrompt(task)
      if (task.prompt.scene === 'shop') {
        // the price tag shows the price said; the purse holds the coins with the halvtredsøre; the thing can be drawn
        if (drawnAmount(html) !== q.ore) problems.push(`${where}: the tag shows ${drawnAmount(html)}`)
        if ([...task.prompt.purse].sort((x, y) => y - x).join() !== SHOP_COINS.join() || !knownObject(task.prompt.thing)) problems.push(`${where}: shop ${JSON.stringify(task.prompt)}`)
      } else {
        const coins = drawnCoins(html)
        if (coins.length < 4 || coins.length > 20 || coins.some((c) => c !== 50) || sum(coins) !== q.ore) problems.push(`${where}: the table shows [${coins}]`)
      }
      if (kind === 'pay') {
        // the tray's sum: any exact payment from the purse is right; "Betal det samme med kroner" offers no halvtredsøre
        const purse = purseOf(task)
        if (task.answer !== a.total || task.answerType !== 'ore') problems.push(`${where}: answer ${String(task.answer)} (${task.answerType}), the child is asked ${a.total}`)
        if (q.family === 'fiftiesInKroner' && (purse.includes(50) || fewestCount(a.total, purse) === Infinity)) problems.push(`${where}: purse ${purse}`)
        if (q.family !== 'fiftiesInKroner' && !purse.includes(50)) problems.push(`${where}: no halvtredsøre in the purse ${purse}`)
        const trays = exactTraysC(a.total, purse)
        if (trays.length === 0) problems.push(`${where}: no exact tray from ${purse}`)
        for (const tray of trays) if (!isCorrect(task, sum(tray)) || classifyAnswer(task, sum(tray)) !== null) problems.push(`${where}: paying ${tray} is not right`)
      } else if (q.family === 'readAmount') {
        // "Hvilke penge er præcis …?": exactly one card is money that makes the price, coins from the shop's purse
        const pays = task.options.filter((o) => setAmount(o) === q.ore)
        if (task.answerType !== 'set' || pays.length !== 1 || pays[0] !== task.answer) problems.push(`${where}: cards [${task.options.join(' / ')}], answer ${String(task.answer)}`)
        for (const o of task.options) if (!(setPieces(o) ?? [NaN]).every((p) => SHOP_COINS.includes(p))) problems.push(`${where}: card ${String(o)} is not coins from the purse`)
      } else if (task.answer !== a.total || task.answerType !== 'ore' || task.optionView !== 'amount') problems.push(`${where}: answer ${String(task.answer)} (${task.answerType}, ${task.optionView})`)
      problems.push(...answerProblems(task))
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('deals three cards drawn as the money they are — coins as coins, amounts as amounts — exactly one right, a coinsAsCount card whenever one counts', () => {
    const problems: string[] = []
    const choice = built.filter((b) => b.kind === 'choice')
    for (const b of choice) {
      const t = b.task
      problems.push(...cardProblems(t, (c) => c % 50 === 0 && c <= 10000))
      for (const o of t.options) {
        const html = markupOfCard(t, o)
        const want = typeof o === 'number' ? o : setAmount(o)
        if (typeof o === 'string') {
          const coins = drawnCoins(html)
          if (/>c\d+</.test(html) || [...coins].sort((x, y) => y - x).join() !== (setPieces(o) ?? []).join()) problems.push(`${t.factId}: the card ${o} draws [${coins}]`)
        } else if (drawnAmount(html) !== want) problems.push(`${t.factId}: the card ${o} reads ${drawnAmount(html)}`)
      }
    }
    problems.push(...diagnosticCardsC(choice, (b) => (b.fact.family === 'fiftiesInKroner' ? [coinsOf(b.task) * 100] : []), why))
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('classifies every card and every tray the purse can pay: coinsAsCount on the table, the price of one and a coin’s 50 øre as numbers from the question', () => {
    expect(first(classifyC(built, why))).toEqual([])
  }, TIMEOUT)

  it('counts as an opportunity exactly the misconceptions a card or the purse can show', () => {
    expect(first(detectableC(built, why))).toEqual([])
  }, TIMEOUT)

  it('has SPEC’s production kind (pay: 0.01), ceilings (three cards: box 3) and a fair speed (pay 5 s + 2.5 s a piece)', () => {
    expect(first([...productionProblemsC(built), ...specKindProblemsC(def, built), ...fastProblemsC(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, every amount as SPEC §10.1 says it (12,50 kr: "tolv kroner og halvtreds øre")', () => {
    expect(first([
      ...taskSpeechProblems(built), ...all.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, all),
      ...normalisationProblems3(def, built, all, tags), ...divisionWordProblems(def, built, all, tags),
    ])).toEqual([])
  }, TIMEOUT)

  it('counts the money truly in every hint and shows coins worth the answer', () => {
    const problems = new Set<string>()
    for (const f of all) {
      const q = kronerOreOf(f.id)!
      for (const tag of ownTags(def, f)) for (const p of kronerOreHintProblems(q, tag, def.hint(f, tag))) problems.add(`${f.id} hint(${String(tag)}): ${p}`)
    }
    expect(first([...problems])).toEqual([])
  }, TIMEOUT)

  it('gives a task rebuilt from its id the same hint', () => {
    expect(first(rebuiltHintProblems(def, built, tags))).toEqual([])
  }, TIMEOUT)

  // The author asks for a misconception for the kroner without the øre (12,50 kr paid as 12 kr). In the contract today it
  // is a near miss, and it is always one of the skill's own near misses: 50 øre short (readAmount) or a krone short
  // (addHalves, the krone the two halvtredsører make). A misconception there would sit on a ±1 value, as countFromFirst
  // does, and need A10's direction rule.
  it('tags the kroner without the øre (12,50 kr as 12 kr; 2,50 + 2,50 as 4 kr) as a near miss, one of the skill’s own', () => {
    const problems: string[] = []
    for (const { fact, task } of built) {
      const q = kronerOreOf(fact.id)!
      if (q.family === 'fiftiesInKroner' || typeof task.answer !== 'number') continue
      const krOnly = q.family === 'readAmount' ? q.ore - 50 : 2 * (q.ore - 50)
      const shortBy = q.total - krOnly
      if (classifyAnswer(task, krOnly) !== 'near' || ![50, 100].includes(shortBy)) problems.push(`${fact.id} ${task.kind}: ${krOnly} is ${classifyAnswer(task, krOnly)} (${shortBy} øre short)`)
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)
})

/**
 * kronerOre's hint, read. readAmount: "Kommaet skiller kronerne fra ørerne. Betal først <kroner> og læg så en
 * halvtredsøre." fiftiesInKroner: "To halvtredsører er en krone. <n> halvtredsører er <amount>." addHalves: "To
 * halvtredsører er en krone. <kr> plus <kr> giver <2 kr>. De to halvtredsører giver en krone mere. Det er <total>."
 * near opens with "Tæl pengene efter.", coinsAsCount with what the coins say. The picture counts coins worth the answer.
 */
function kronerOreHintProblems(q: NonNullable<ReturnType<typeof kronerOreOf>>, tag: ErrorTag | null, h: HintSpec): string[] {
  const out: string[] = []
  const text = spokenText(h.speech)
  let rest = sentences(text)
  if (tag === 'near') {
    if (rest[0] !== 'Tæl pengene efter.') out.push(`opens "${rest[0]}"`)
    rest = rest.slice(1)
  }
  if (tag === 'coinsAsCount') {
    if (rest[0] !== 'Tæl ikke, hvor mange mønter der er, men hvad der står på dem.') out.push(`opens "${rest[0]}"`)
    rest = rest.slice(1)
  }
  const statement = (s: string | undefined) => {
    const c = s ? coinStatement(s) : null
    return c && c.coins * c.piece === c.said ? c : null
  }
  if (q.family === 'readAmount') {
    const m = /^Betal først (.+) og læg så en halvtredsøre\.$/.exec(rest[1] ?? '')
    const kr = m ? amountsIn(m[1]) : []
    if (rest[0] !== 'Kommaet skiller kronerne fra ørerne.' || kr.length !== 1 || kr[0] + 50 !== q.ore || kr[0] % 100 !== 0 || rest.length !== 2) out.push(`"${rest.join(' ')}" for ${q.ore}`)
  } else {
    const two = statement(rest[0])
    if (!two || two.coins !== 2 || two.piece !== 50) out.push(`opens "${rest[0]}"`)
    if (q.family === 'fiftiesInKroner') {
      const n = statement(rest[1])
      if (!n || n.piece !== 50 || n.said !== q.total || rest.length !== 2) out.push(`says "${rest.slice(1).join(' ')}" of ${q.total / 50} halvtredsører`)
    } else {
      const toks = spokenTokens((rest[1] ?? '').replace(/kroner|krone/g, ''))
      const kr = (q.ore - 50) / 100
      if (statementTrue(toks) !== true || toks[0] !== kr || toks[2] !== kr || toks[1] !== '+') out.push(`says "${rest[1]}" of ${q.ore} twice`)
      const total = /^Det er (.+)\.$/.exec(rest[3] ?? '')
      if (rest[2] !== 'De to halvtredsører giver en krone mere.' || !total || amountsIn(total[1])[0] !== q.total || rest.length !== 4) out.push(`says "${rest.slice(2).join(' ')}"`)
    }
  }
  const v = h.visual
  if (v.scene !== 'coinsSum' || sum(v.ore) !== q.total || !v.ore.every((p) => SHOP_COINS.includes(p))) out.push(`shows ${JSON.stringify(v)}`)
  else if (q.family === 'fiftiesInKroner' && (v.ore.length !== q.total / 50 || v.ore.some((p) => p !== 50))) out.push(`shows ${JSON.stringify(v)}, not the halvtredsører on the table`)
  return out
}

// ═══ Markedet: the 3. klasse families of payExact and change ═════════════════

describe('payExact fewestCoins (3. klasse, Markedet)', () => {
  const def = registeredSkill('payExact')
  const { canon, all, built } = sweepFamilies(def, ['fewestCoins'])
  const tags = tagsToHint(def, all)

  it('asks for the price "med så få mønter og sedler som muligt" and wants the one fewest payment from the purse, in any order', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const p = parsePurchase(fact.id)
      const asked = priceAsked(said(task))
      const shop = task.prompt.scene === 'shop' ? task.prompt : null
      if (!p || p.family !== 'fewestCoins' || !asked || !asked.fewest || asked.price !== p.price || !shop || shop.priceOre !== p.price || drawnAmount(markupOfPrompt(task)) !== p.price) {
        problems.push(`${where}: "${said(task)}" with ${JSON.stringify(task.prompt)}`)
        continue
      }
      const ways = fewestWays(p.price, shop.purse)
      if (ways.length !== 1) problems.push(`${where}: ${ways.length} fewest payments from ${shop.purse}`)
      const fewest = setToken(ways[0] ?? [])
      if (task.answer !== fewest || task.answerType !== 'set') problems.push(`${where}: answer ${String(task.answer)}, the fewest ${fewest}`)
      if (kind === 'pay') {
        if (!isCorrect(task, fewest.split('|').reverse().join('|'))) problems.push(`${where}: the fewest pieces in another order are wrong`)
        for (const tray of exactTraysC(p.price, shop.purse)) if (tray.length > (ways[0]?.length ?? 0) && isCorrect(task, setToken(tray))) problems.push(`${where}: ${tray} (more pieces) is right`)
      } else {
        problems.push(...cardProblems(task))
        for (const o of task.options) {
          const pieces = setPieces(o)
          if (!pieces || !pieces.every((x) => shop.purse.includes(x))) problems.push(`${where}: card ${String(o)} is not money from the purse`)
          else if ((sum(pieces) === p.price && pieces.length === ways[0]?.length) !== (o === task.answer)) problems.push(`${where}: card ${String(o)}`)
        }
      }
      problems.push(...answerProblems(task))
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('classifies every wrong card and tray as a plain error (paying has no misconception), with SPEC’s production, ceilings and a fair speed', () => {
    const problems: string[] = []
    for (const { task } of built) {
      const shop = task.prompt.scene === 'shop' ? task.prompt : null
      const given = task.kind === 'choice' ? task.options : exactTraysC(setAmount(task.answer) ?? 0, shop?.purse ?? []).map(setToken)
      for (const g of given) {
        if (isCorrect(task, g)) continue
        const tag = classifyAnswer(task, g)
        if (tag !== 'near' && tag !== 'other') problems.push(`${task.factId} ${task.kind} ${String(g)}: ${tag}`)
      }
    }
    problems.push(...productionProblemsC(built), ...specKindProblemsC(def, built), ...fastProblemsC(def, built))
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('speaks every task and hint with recorded clips, no digits, every amount as SPEC §10.1 says it', () => {
    expect(first([...taskSpeechProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags)), ...normalisationProblems3(def, built, all, tags)])).toEqual([])
  }, TIMEOUT)
})

describe('change from100 (3. klasse, Markedet)', () => {
  const def = registeredSkill('change')
  const { canon, all, built } = sweepFamilies(def, ['from100'])
  const sale = (f: Fact) => parseSale(f.id)!
  const why = (b: Built, v: AnswerValue): WhyC => {
    if (typeof v !== 'number') return { mis: [] }
    const w = explainChange(sale(b.fact), b.task, v)
    return { mis: w.mis, operand: w.operand }
  }
  const known = (b: Built): number[] => {
    const s = sale(b.fact)
    const dc = digitComplementKr(s.price / 100)
    return [s.price + s.paid, ...(dc === null ? [] : [dc * 100])]
  }
  const tags = tagsToHint(def, all)

  it('works the change out from the price said and drawn and the hundred-krone note it is paid with', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const s = parseSale(fact.id)
      const asked = saleAsked(said(task))
      if (!s || s.family !== 'from100' || !asked || asked.paid !== 10000 || asked.price !== s.price || task.answer !== asked.paid - asked.price) problems.push(`${where}: "${said(task)}", answer ${String(task.answer)}`)
      if (drawnAmount(markupOfPrompt(task)) !== s?.price) problems.push(`${where}: the tag shows ${drawnAmount(markupOfPrompt(task))}`)
      // the keys take kroner (A14), three of them: the change and the price and the note added (wrongOperation, ≤ 199 kr)
      const added = (s?.price ?? 0) + 10000
      if (kind === 'keypad' && (task.entryScale !== 100 || task.unit !== 'kr' || task.maxDigits !== 3 || task.range[0] !== 0 || task.range[1] < added || task.range[1] > 99900)) problems.push(`${where}: keypad ${task.entryScale} ${task.unit} ${task.maxDigits} ${task.range}`)
      problems.push(...answerProblems(task).filter((p) => !/ digits for the range /.test(p)), ...cardProblems(task, (c) => c % 100 === 0))
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('classifies every card, every kroner amount typed and every tray: wrongOperation, digitComplement10 (A9 on the price), the swapped kroner (A11)', () => {
    const specials = (b: Built) => [...known(b), sale(b.fact).price, ...(typedSwapC(b.task) !== null ? [typedSwapC(b.task)!] : [])]
    expect(first([...classifyC(built, why, specials), ...detectableC(built, why, specials), ...diagnosticCardsC(built, known, why)])).toEqual([])
  }, TIMEOUT)

  it('has SPEC’s production kinds (keypad in kroner: 1 in 101, A14; pay), ceilings and a fair speed', () => {
    expect(first([...productionProblemsC(built), ...specKindProblemsC(def, built), ...fastProblemsC(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, every amount as SPEC §10.1 says it', () => {
    expect(first([...taskSpeechProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags)), ...normalisationProblems3(def, built, all, tags)])).toEqual([])
  }, TIMEOUT)
})
