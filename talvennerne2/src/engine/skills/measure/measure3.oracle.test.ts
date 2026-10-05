// Oracle tests for convertCmM (SPEC §2.2, §3, §4.1 with A9/A11, §10.1, §15.1), ORK3c, against measure3.oracle.ts and
// the wave-3 kit in clock/clock3.oracle.ts: every canonical fact and 200 seeded instances per family, both kinds, the
// answer worked out from the card's lengths and unit words and from the question as said (1 m = 100 cm); and
// unitChoice's 3. klasse family (weight) as Markedet plays it, against measure2.oracle.ts.
import { describe, expect, it } from 'vitest'
import { classifyAnswer } from '../../misconceptions'
import { masteryKeyOf } from '../../tasks'
import type { AnswerValue, ErrorTag, Fact, HintSpec, SkillDef, Task } from '../../types'
import { clipText } from '../../../speech/catalog'
import { factFor } from '../../../ui/hint/hintFor'
import {
  answerProblems, cardProblems, first, hintProblems, registeredSkill, spokenText, tagsToHint, taskSpeechProblems, type Built,
} from '../number/number.oracle'
import { numbersIn } from '../number/number2.oracle'
import { sentences, spokenTokens, statementTrue } from '../algebra/algebra2.oracle'
import { avoidProblemsB, prefixProblems, specificHintProblems } from '../clock/clock.oracle'
import {
  classifyC, detectableC, diagnosticCardsC, divisionWordProblems, fastProblemsC, instanceProblems, normalisationProblems3, productionProblemsC,
  specKindProblemsC, sweepC, sweepFamilies, type WhyC,
} from '../clock/clock3.oracle'
import { THING_UNIT, unitAskedAll, unitQuestion } from './measure2.oracle'
import { cardCm, cmAnswer, cmCardNumbers, cmMis, cmOf, explainCm, heardCm, type CmQ } from './measure3.oracle'

const TIMEOUT = 600_000
const said = (t: Task): string => spokenText(t.speech)

/** The tags a fact's hint is shown for: the plain ones and the misconceptions of the fact's own wrong answers. */
const ownTags = (def: SkillDef, f: Fact): (ErrorTag | null)[] => [null, 'near', 'operand', 'other', 'ambiguous', ...new Set(def.candidates(f).map((c) => c.tag))]

/** The unit words the card shows, in order (pædagogik §1.3: the units as words, the answer's unit after the blank). */
const CARD_UNITS: Readonly<Record<CmQ['family'], (q: CmQ) => string>> = {
  mToCm: () => 'm,cm',
  mCmToCm: () => 'm,cm,cm',
  cmToMCm: (q) => (q.a % 100 ? 'cm,m,cm' : 'cm,m'),
  compareMixed: () => 'm,cm,cm',
}

// ═══ convertCmM ═════════════════════════════════════════════════════════════

describe('convertCmM oracle', () => {
  const def = registeredSkill('convertCmM')
  const { canon, instances, all, built } = sweepC(def, 3)
  const q = (f: Fact): CmQ => cmOf(f.id)!
  const why = (b: Built, v: AnswerValue): WhyC => (typeof v === 'number' ? explainCm(q(b.fact), v) : { mis: [] })
  const specials = (b: Built) => [...cmMis(q(b.fact)).map(([v]) => v), ...cmCardNumbers(q(b.fact))]
  const tags = tagsToHint(def, all)

  it('has pædagogik §1.3’s four families and cmm:<family>:<a>[:<c>] ids the oracle reads; mToCm all nine meters', () => {
    expect(def.families.map((f) => f.id)).toEqual(['mToCm', 'mCmToCm', 'cmToMCm', 'compareMixed'])
    expect(def.families.map((fam) => canon.filter((f) => f.family === fam.id).length)).toEqual([9, 20, 20, 20])
    const problems: string[] = []
    for (const f of all) {
      const c = cmOf(f.id)
      if (!c || c.family !== f.family || f.answer !== cmAnswer(c) || f.skill !== 'convertCmM') problems.push(`${f.id}: family ${f.family}, answer ${String(f.answer)}`)
      if (masteryKeyOf(def, f) !== `convertCmM/${f.family}`) problems.push(`${f.id}: mastery key ${masteryKeyOf(def, f)}`)
    }
    problems.push(...prefixProblems(def, all, 'cmm'), ...avoidProblemsB(def, instances))
    problems.push(...instanceProblems(def, instances, (fam) => ({ mToCm: 9, mCmToCm: 150, cmToMCm: 150, compareMixed: 120 })[fam] ?? 1))
    expect(first(problems)).toEqual([])
  })

  it('shows the lengths of the id with their unit words, and card and voice give the answer (1 m = 100 cm)', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const c = q(fact)
      const card = cardCm(task.prompt)
      const terms = task.prompt.scene === 'equation' ? task.prompt.terms : []
      const nums = terms.flatMap((t) => ('n' in t ? [t.n] : []))
      const units = terms.flatMap((t) => ('text' in t ? [clipText(t.text)] : []))
      if (!card || card.answer !== cmAnswer(c) || task.answer !== card.answer) problems.push(`${where}: the card gives ${card?.answer}, the task ${String(task.answer)}`)
      else if (card.units.join() !== CARD_UNITS[c.family](c) || card.blankUnit !== (c.family === 'cmToMCm' ? 'm' : 'cm')) problems.push(`${where}: units ${card.units} (blank in ${card.blankUnit})`)
      if (nums.join() !== cmCardNumbers(c).join()) problems.push(`${where}: the card's numbers ${nums}`)
      if (units.some((u) => u !== 'meter' && u !== 'centimeter')) problems.push(`${where}: unit words ${units}`)
      if (heardCm(said(task)) !== cmAnswer(c)) problems.push(`${where}: "${said(task)}" gives ${heardCm(said(task))}`)
      // the keys take the answer and a zero too many (3 m typed as 3000); cmToMCm's whole meters are 0–99
      const top = c.family === 'cmToMCm' ? 99 : c.family === 'compareMixed' ? 999 : 9999
      if (task.answerType !== 'int' || task.range.join() !== `0,${top}` || task.unit !== null) problems.push(`${where}: ${task.answerType} range ${task.range} unit ${task.unit}`)
      if (kind === 'keypad') for (const [v] of cmMis(c)) if (v > 10 ** task.maxDigits - 1) problems.push(`${where}: ${v} cannot be typed (${task.maxDigits} keys)`)
      problems.push(...answerProblems(task))
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('deals three number cards inside the range, exactly one right, a diagnostic card whenever one counts', () => {
    const choice = built.filter((b) => b.kind === 'choice')
    expect(first([
      ...choice.flatMap((b) => cardProblems(b.task)),
      ...diagnosticCardsC(choice, (b) => cmMis(q(b.fact)).map(([v]) => v), why),
    ])).toEqual([])
  }, TIMEOUT)

  it('classifies every card and typed value by pædagogik §3.2: tensZero, zeroPlaceholder, digitComplement10, wrongOperation, A9 and A11', () => {
    expect(first(classifyC(built, why, specials))).toEqual([])
  }, TIMEOUT)

  it('counts as an opportunity exactly the misconceptions a card or the keys can show (and the typed swap)', () => {
    expect(first(detectableC(built, why, specials))).toEqual([])
  }, TIMEOUT)

  it('has SPEC’s production kind (keypad: 1 in the numbers the keys take) and ceilings (three cards: box 3)', () => {
    expect(first([...productionProblemsC(built), ...specKindProblemsC(def, built)])).toEqual([])
  })

  // ORK3c finding (convertCmM, fastMs): SPEC §3.2 gives the keypad 6 s + 2 s per digit over one, and lists the skills that
  // may differ (add100Carry/sub100Borrow, add1000/sub1000, mulTens); pædagogik §4.1 lets a family give more time, never
  // less ("tærsklerne skal være fair"). convertCmM's fastMs gives mToCm's keypad 8 000 ms, where every answer has three
  // digits (100–900 cm): SPEC gives 10 000 ms. A child who types "300" for 3 m in 9 s is right but not fast.
  it.fails('gives every task at least SPEC §3.2’s time to count as fast (mToCm keypad: 10 s for three digits)', () => {
    expect(first(fastProblemsC(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, every length as SPEC §10.1 says it ("en meter", "fem centimeter")', () => {
    const facts = [...canon, ...all.slice(canon.length).filter((_, i) => i % 4 === 0)]
    expect(first([
      ...taskSpeechProblems(built), ...facts.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, facts),
      ...normalisationProblems3(def, built, facts, tags), ...divisionWordProblems(def, built, facts, tags),
    ])).toEqual([])
  }, TIMEOUT)

  it('says only true conversions in every hint and draws a line that holds the meters and the rest', () => {
    const problems = new Set<string>()
    for (const f of all) for (const tag of ownTags(def, f)) for (const p of convertHintProblems(q(f), tag, def.hint(f, tag))) problems.add(`${f.id} hint(${String(tag)}): ${p}`)
    expect(first([...problems])).toEqual([])
  }, TIMEOUT)

  it('gives a task rebuilt from its id the same hint', () => {
    const problems = new Set<string>()
    for (const { fact, kind, task } of built.filter((_, i) => i % 3 === 0)) {
      for (const tag of tags) if (JSON.stringify(def.hint(factFor(def, task), tag, kind)) !== JSON.stringify(def.hint(fact, tag, kind))) problems.add(`${fact.id} ${kind} hint(${String(tag)})`)
    }
    expect(first([...problems])).toEqual([])
  }, TIMEOUT)

  it('makes A9 happen where it must (a check of the oracle and the skill): 1 m − 55 cm made up digit by digit is 55, on the card', () => {
    expect(explainCm(cmOf('cmm:compareMixed:1:55')!, 55)).toEqual({ mis: ['digitComplement10'], operand: true })
    expect(explainCm(cmOf('cmm:compareMixed:1:55')!, 54)).toEqual({ mis: [], operand: false, plain: true })
    expect(explainCm(cmOf('cmm:cmToMCm:333')!, 33)).toEqual({ mis: ['tensZero'], operand: true })
    expect(explainCm(cmOf('cmm:mCmToCm:2:5')!, 25)).toEqual({ mis: ['tensZero', 'zeroPlaceholder'], operand: false })
    // every A9 value the instances meet is 'ambiguous' on the keys
    const clashes = built.filter((b) => b.kind === 'keypad' && cmMis(q(b.fact)).some(([v]) => cmCardNumbers(q(b.fact)).includes(v)))
    for (const b of clashes) for (const [v] of cmMis(q(b.fact))) if (cmCardNumbers(q(b.fact)).includes(v)) expect(classifyAnswer(b.task, v), `${b.fact.id} ${v}`).toBe('ambiguous')
  })
})

/**
 * convertCmM's hint, read sentence by sentence: "En meter er hundrede centimeter." (tensZero: "…, og hundrede har to
 * nuller."), "<X meter> er <100X centimeter>." / "<100X centimeter> er <X meter>.", "Læg <c centimeter> til.", "Det er
 * <x centimeter>.", "Der er <r centimeter> til overs.", "<A> minus <c> giver <x>." — each true for the fact, and the
 * misconceptions' own sentences where they belong. The picture: a line from 0 with a hop for every meter and one for
 * the rest (compareMixed: from the centimeter up to the meters), every hop on the line.
 */
function convertHintProblems(q: CmQ, tag: ErrorTag | null, h: HintSpec): string[] {
  const out: string[] = []
  const text = spokenText(h.speech)
  const all = sentences(text)
  const x = cmAnswer(q)
  const lengths = (s: string): number | null => {
    const m = /^(.+) (meter|centimeter)$/.exec(s.trim().toLowerCase())
    const n = m ? numbersIn(m[1]) : []
    return m && n.length === 1 ? n[0] * (m[2] === 'meter' ? 100 : 1) : null
  }
  const opening = tag === 'tensZero' ? 'En meter er hundrede centimeter, og hundrede har to nuller.' : 'En meter er hundrede centimeter.'
  const lead = tag === 'wrongOperation' ? 'Når du skal finde ud af, hvor meget længere noget er, skal du trække fra.' : null
  let rest = all
  if (lead) {
    if (rest[0] !== lead) out.push(`opens "${rest[0]}"`)
    rest = rest.slice(1)
  }
  if (rest[0] !== opening) out.push(`says "${rest[0]}" first`)
  for (const s of rest.slice(1)) {
    const is = /^(.+) er (.+)\.$/.exec(s)
    const same = is && !/^Det er /.test(s) && !/^Der er /.test(s) ? [lengths(is[1]), lengths(is[2])] : null
    if (same) {
      if (same[0] === null || same[1] === null || same[0] !== same[1]) out.push(`"${s}" is not true`)
      continue
    }
    if (/^Læg (.+) til\.$/.test(s)) {
      if (q.family !== 'mCmToCm' || lengths(/^Læg (.+) til\.$/.exec(s)![1]) !== q.c) out.push(`"${s}"`)
    } else if (/^Det er (.+)\.$/.test(s)) {
      if (lengths(/^Det er (.+)\.$/.exec(s)![1]) !== x) out.push(`"${s}", the answer is ${x}`)
    } else if (/^Der er (.+) til overs\.$/.test(s)) {
      if (q.family !== 'cmToMCm' || lengths(/^Der er (.+) til overs\.$/.exec(s)![1]) !== q.a % 100) out.push(`"${s}"`)
    } else if (/ minus /.test(s)) {
      const toks = spokenTokens(s)
      if (statementTrue(toks) !== true || toks[toks.length - 1] !== x || toks[2] !== q.c) out.push(`"${s}"`)
    } else if (s === 'Der er ingen tiere, så der står et nul på tiernes plads.') {
      if (tag !== 'zeroPlaceholder' || q.c >= 10) out.push(`"${s}" for ${q.c} cm`)
    } else if (s === 'Træk ikke cifrene fra hver for sig. Tæl op til hundrede.' || s === 'Tæl op til hundrede.' || s === 'Træk ikke cifrene fra hver for sig.') {
      if (tag !== 'digitComplement10') out.push(`"${s}"`)
    } else out.push(`says "${s}"`)
  }
  if (q.family === 'compareMixed' && !/ minus /.test(text)) out.push(`never takes away: "${text}"`)
  if (q.family === 'mCmToCm' && lengthsSaid(text) !== x) out.push(`never says the answer: "${text}"`)
  const v = h.visual
  if (v.scene !== 'line') return [...out, `shows ${JSON.stringify(v)}`]
  const hops = v.hops ?? []
  if (v.min !== 0 || hops.some((p, i) => p < v.min || p > v.max || (i > 0 && p <= hops[i - 1]))) out.push(`shows ${JSON.stringify(v)}`)
  const meters = q.family === 'cmToMCm' ? x : q.a
  if (q.family === 'compareMixed') {
    if (v.max !== 100 * q.a || hops.join() !== `${q.c},${100 * q.a}`) out.push(`shows ${JSON.stringify(v)}, from ${q.c} up to ${100 * q.a}`)
  } else {
    const end = q.family === 'cmToMCm' ? q.a : x
    const want = [...Array.from({ length: meters + 1 }, (_, i) => 100 * i), ...(end > 100 * meters ? [end] : [])]
    if (v.max !== end || hops.join() !== want.join()) out.push(`shows ${JSON.stringify(v)}, want hops ${want}`)
  }
  return out
}

/** The answer said last ("Det er … centimeter."), for the families that add. */
const lengthsSaid = (text: string): number | null => {
  const m = /Det er (.+) centimeter\.$/.exec(text)
  const n = m ? numbersIn(m[1]) : []
  return n.length === 1 ? n[0] : null
}

// ═══ Markedet: unitChoice's 3. klasse family (weight) ═══════════════════════

describe('unitChoice weight (3. klasse, Markedet)', () => {
  const def = registeredSkill('unitChoice')
  const { all, built } = sweepFamilies(def, ['weight'], 6)
  const tags = tagsToHint(def, all)

  it('asks what a thing is weighed in, g or kg as a child knows it, and taps every thing weighed in the unit asked; plain errors only', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const text = said(task)
      if (kind === 'choice') {
        const qn = unitQuestion(text)
        if (!qn || qn.kind !== 'weight' || task.answer !== `unit:${THING_UNIT[qn.thing][0]}`) problems.push(`${where}: "${text}", answer ${String(task.answer)}`)
      } else {
        const unit = unitAskedAll(text)
        const want = task.options.map(String).filter((o) => THING_UNIT[o.replace(/^mt:/, '')]?.[0] === unit).sort().join('|')
        if (!unit || (unit !== 'g' && unit !== 'kg') || String(task.answer) !== want) problems.push(`${where}: "${text}" over [${task.options}], answer ${String(task.answer)}, oracle ${want}`)
      }
      for (const o of task.options) {
        if (o === task.answer || kind !== 'choice') continue
        const tag = classifyAnswer(task, o)
        if (tag !== 'near' && tag !== 'other') problems.push(`${where}: card ${String(o)} is ${tag}`)
      }
      problems.push(...answerProblems(task))
    }
    problems.push(...productionProblemsC(built), ...specKindProblemsC(def, built), ...fastProblemsC(def, built))
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('speaks every task and hint with recorded clips and no digits, every card read aloud with its own clip', () => {
    expect(first([...taskSpeechProblems(built), ...all.flatMap((f) => hintProblems(def, f, tags))])).toEqual([])
  }, TIMEOUT)
})
