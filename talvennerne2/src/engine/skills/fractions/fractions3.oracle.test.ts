// Oracle tests for fractionOfSet and fractionCompare (SPEC §2.2, §3, §4.1 with A9/A11, §10.1, §15.1, A19),
// ORK3b, against fractions3.oracle.ts and the wave-3b kit in shapes3.oracle.ts: the fraction and the heap
// heard in the question, the plates of the share view, the fraction cards compared as numbers, the bars of
// the hint read as drawn — never the generator's own numbers.
import { describe, expect, it } from 'vitest'
import { classifyAnswer } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, guessP, isProduction } from '../../kinds'
import type { AnswerValue, ErrorTag, Task } from '../../types'
import { countsOf, shareSetup, shareValue } from '../../../ui/task/share/logic'
import {
  answerProblems, cardProblems, first, hintProblems, optionProblems, registeredSkill, spokenText, tagsToHint, taskSpeechProblems, tasksOf,
  type Built,
} from '../number/number.oracle'
import { numbersIn } from '../number/number2.oracle'
import { animationChecks, idChecks, sentences } from '../algebra/algebra2.oracle'
import { PLAIN, classifyB, dealsOf, detectableB, freshIds, instancesB, productionB3, specKindB, speedProblems, typedSwap } from '../shapes/shapes3.oracle'
import {
  byDenominator, byValue, cardFrac, cmpAsk, cmpIdOf, compareFrac, heardFraction, readBars, setAsk, setIdOf, setTags, shareTags,
} from './fractions3.oracle'

const TIMEOUT = 300_000
const said = (t: Task) => spokenText(t.speech)

function setup(id: 'fractionOfSet' | 'fractionCompare', seeds = 2) {
  const def = registeredSkill(id)
  const canon = def.enumerate()
  const instances = instancesB(def)
  const drawn = [...instances.values()].flat()
  const built: Built[] = [...tasksOf(def, canon, seeds), ...tasksOf(def, drawn, 1)]
  return { def, canon, instances, drawn, built }
}

describe('the fractions oracle itself', () => {
  it('hears fractions and compares them as numbers', () => {
    expect(heardFraction('en fjerdedel')).toEqual({ n: 1, d: 4 })
    expect(heardFraction('tre fjerdedele')).toEqual({ n: 3, d: 4 })
    expect(heardFraction('halvdelen')).toEqual({ n: 1, d: 2 })
    expect(heardFraction('to ottendedele')).toEqual({ n: 2, d: 8 })
    expect(setAsk('Hvor mange er en fjerdedel af tolv jordbær?')).toEqual({ how: 'of', n: 1, d: 4, total: 12, thing: 'strawberry' })
    expect(setAsk('Del tolv æbler på de to tallerkener. Den ene skal have tre fjerdedele og den anden resten.')).toEqual({ how: 'twoPlates', n: 3, d: 4, total: 12, thing: 'apple' })
    expect(compareFrac({ n: 1, d: 8 }, { n: 1, d: 4 })).toBeLessThan(0)
    expect(compareFrac({ n: 2, d: 4 }, { n: 3, d: 6 })).toBe(0)
    expect(byValue(['frac:1/8', 'frac:1/2', 'frac:1/4'], true)).toEqual(['frac:1/2', 'frac:1/4', 'frac:1/8'])
    expect(byDenominator(['frac:1/8', 'frac:1/2', 'frac:1/4'], true)).toEqual(['frac:1/8', 'frac:1/4', 'frac:1/2'])
    expect(readBars(['1/2', '3/4', '2/8'])).toEqual([{ n: 1, d: 2 }, { n: 3, d: 4 }, { n: 2, d: 8 }])
    expect(dealsOf(4, 2)).toEqual(['4|0', '3|1', '2|2'])
  })
})

// ═══ fractionOfSet ════════════════════════════════════════════════════════════

describe('fractionOfSet oracle', () => {
  const { def, canon, instances, built } = setup('fractionOfSet')
  const q = (t: Task) => setIdOf(t.factId)!

  it('has SPEC §2.2’s four families: n/d of a heap of strawberries, apples or carrots, id fos:n/d:total:thing', () => {
    const all = [...canon, ...[...instances.values()].flat()]
    expect(first(idChecks(def, all, /^fos:\d\/\d:\d+:[a-z]+$/, (id) => {
      const s = setIdOf(id)
      return s && { family: s.family, answer: s.answer }
    }))).toEqual([])
    const heaps: Record<string, Set<number>> = {}
    for (const f of all) (heaps[f.family] ??= new Set()).add(setIdOf(f.id)!.total)
    // pædagogik §1.3 / the module header: halves of 4–20, quarters of 8–24, thirds of 6–24, three quarters of 4–24
    const range = (from: number, to: number, step: number) => Array.from({ length: (to - from) / step + 1 }, (_, i) => from + i * step)
    expect(Object.fromEntries(Object.entries(heaps).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]))).toEqual({
      halfOf: range(4, 20, 2), quarterOf: range(8, 24, 4), thirdOf: range(6, 24, 3), threeQuartersOf: range(4, 24, 4),
    })
    for (const f of all) expect(f.operands, f.id).toEqual([setIdOf(f.id)!.total])
    // a key keeps five recent instances (SPEC §5.1): every family has more, so draws stay fresh
    for (const fam of def.families) expect(new Set(freshIds(def, fam.id, 12)).size, fam.id).toBe(12)
  }, TIMEOUT)

  it('asks what it shows: the heard fraction and heap are the id’s; the heap on the card, the plates on the share view', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const s = q(task)
      const ask = setAsk(said(task))
      const where = `${fact.id} ${kind}`
      if (!ask || ask.n !== s.n || ask.d !== s.d || ask.total !== s.total || ask.thing !== s.thing) {
        problems.push(`${where}: "${said(task)}"`)
        continue
      }
      const p = task.prompt
      if (kind === 'share') {
        const plates = s.n > 1 ? 2 : s.d
        if (ask.how !== (s.n > 1 ? 'twoPlates' : 'deal')) problems.push(`${where}: "${said(task)}"`)
        if (p.scene !== 'share' || p.total !== s.total || p.recipients !== plates || p.thing !== s.thing) problems.push(`${where}: ${JSON.stringify(p)}`)
        if (!shareSetup(task)) problems.push(`${where}: the share view cannot deal it`)
      } else {
        if (ask.how !== 'of') problems.push(`${where}: "${said(task)}"`)
        if (p.scene !== 'objects' || p.n !== s.total || p.thing !== s.thing) problems.push(`${where}: ${JSON.stringify(p)}`)
      }
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('answers n/d of the heap; three quarters dealt on two plates is the deal itself, largest first (9|3), in any order', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const s = q(task)
      const where = `${fact.id} ${kind}`
      if (kind === 'share' && s.n > 1) {
        const deal = `${s.answer}|${s.rest}`
        if (task.answer !== deal || task.answerType !== 'set') problems.push(`${where}: answer ${String(task.answer)}, the deal is ${deal}`)
        // what the plates hand in, either plate first, is right; the even deal or the reverse fractions are not
        if (!isCorrect(task, shareValue(task, [s.answer, s.rest])) || !isCorrect(task, shareValue(task, [s.rest, s.answer]))) problems.push(`${where}: the deal ${deal} handed in is wrong`)
        if (!isCorrect(task, `${s.rest}|${s.answer}`)) problems.push(`${where}: ${s.rest}|${s.answer} is wrong`)
        if (isCorrect(task, shareValue(task, [s.total / 2, s.total / 2]))) problems.push(`${where}: the even deal is right`)
        if (countsOf(task, deal)?.join() !== `${s.answer},${s.rest}`) problems.push(`${where}: the confirm button shows ${countsOf(task, deal)}`)
      } else if (task.answer !== s.answer || task.answerType !== 'int') problems.push(`${where}: answer ${String(task.answer)} (${task.answerType}), n/d of the heap is ${s.answer}`)
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('deals valid cards 0–24 and classifies the denominator as denominatorAsAnswer (A9: not when it is the heap), the heap as operand', () => {
    expect(first(built.flatMap((b) => [...answerProblems(b.task), ...cardProblems(b.task, (c) => c >= 0 && c <= 24)]))).toEqual([])
    const judge = (b: Built, v: AnswerValue): readonly ErrorTag[] => {
      if (b.task.kind === 'share') return shareTags(b.task, v)
      return typeof v === 'number' ? setTags(q(b.task), v, typedSwap(b.task, [q(b.task).total])) : PLAIN
    }
    const right = (b: Built, v: AnswerValue) => {
      const s = q(b.task)
      if (b.task.kind === 'share' && s.n > 1) return typeof v === 'string' && [`${s.answer}|${s.rest}`, `${s.rest}|${s.answer}`].includes(v)
      return v === s.answer
    }
    expect(first(classifyB(built, judge, right))).toEqual([])
    expect(first(detectableB(built, judge))).toEqual([])
  }, TIMEOUT)

  it('shows the denominatorAsAnswer card whenever the denominator is evidence', () => {
    const problems: string[] = []
    for (const { task } of built) {
      if (task.kind !== 'choice') continue
      const s = q(task)
      if (s.d !== s.answer && s.d !== s.total && !task.options.includes(s.d)) problems.push(`${task.factId}: cards [${task.options}]`)
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('has SPEC’s kinds and ceilings: share (0.01, production only here), keypad 0–24 (production), choice (box 3)', () => {
    // a deal asked as itself on two plates (three quarters) is the it.fails test below; SPEC §3.3's own rule
    // (a kind production for ≥ 90 % of the instances) holds by the keypad whatever its share tasks are
    const even = built.filter((b) => !(b.kind === 'share' && b.task.answerType === 'set'))
    expect(first(productionB3(even))).toEqual([])
    expect(first(specKindB(def, even))).toEqual([])
    expect(first(speedProblems(def, built))).toEqual([])
    expect(built.filter((b) => b.kind === 'keypad').every((b) => isProduction(b.task))).toBe(true)
  }, TIMEOUT)

  /**
   * SPEC §3.2 gives the share view 0.01: dealing a heap evenly by luck is unlikely, and its hand-in is the
   * count or −1. A deal asked as itself on two plates hands in the deal: the view takes only an empty pile,
   * so the child hands in one of ⌊total/2⌋ + 1 deals (3/4 of 4: 4|0, 3|1 or 2|2 — one in three). Counted
   * as A14 counts what the child can enter (and as keypad, choice and grid do), three quarters of 4, 8 and
   * 12 are guessed 1 in 3, 5 and 7: above 12 %, no production, and a lucky deal must not lift the key past
   * box 3. (16 and up are 1 in 9 or less: production either way.) GENERATOR BUG — Rettet (fractionOfSet.ts
   * guessFloor): the deal was guessP 0.01, production with box 5, on every heap.
   */
  it('lifts a two-plate deal of three quarters to box 5 only when the deals the view takes make a guess unlikely (A14’s rule)', () => {
    const problems: string[] = []
    for (const { task } of built) {
      if (task.kind !== 'share' || task.answerType !== 'set') continue
      const s = q(task)
      const deals = dealsOf(s.total, 2).length
      if (1 / deals > 0.12 && (isProduction(task) || ceilingFor(task) > 3)) {
        problems.push(`${task.factId}: guessP ${guessP(task)}, production ${isProduction(task)}, ceiling ${ceilingFor(task)}; the view takes ${deals} deals (1 in ${deals})`)
      }
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('speaks every task and hint with recorded clips, no digits, the fractions as §10.1 words', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    const tags = [...tagsToHint(def, canon), 'shareUnequal'] as (ErrorTag | null)[]
    expect(first(canon.flatMap((f) => hintProblems(def, f, tags)))).toEqual([])
    expect(first(animationChecks(def, canon, tags))).toEqual([])
    for (const { task } of built) {
      const fr = task.speech.filter((p) => 'frac' in p)
      for (const p of fr) if ('frac' in p) expect([p.frac.n, p.frac.d], task.factId).toEqual([q(task).n, q(task).d])
    }
  }, TIMEOUT)

  it('hints by dealing into d equal heaps, says only true arithmetic, and on two plates puts the deal 9|3', () => {
    const problems = new Set<string>()
    for (const f of canon) {
      const s = setIdOf(f.id)!
      for (const tag of [null, 'near', 'other', 'operand', 'ambiguous', 'denominatorAsAnswer', 'shareUnequal'] as (ErrorTag | null)[]) {
        for (const kind of [undefined, ...def.kinds]) {
          const h = def.hint(f, tag, kind)
          const text = spokenText(h.speech)
          const where = `${f.id} hint(${String(tag)}, ${kind ?? '-'})`
          const v = h.visual
          if (v.scene !== 'groups' || v.groups !== s.d || v.size !== s.unit || v.thing !== s.thing) problems.add(`${where}: ${JSON.stringify(v)}`)
          const ss = sentences(text)
          const deal = ss.find((x) => /^Del de .+ i .+ lige store bunker\.$/.test(x))
          if (!deal || numbersIn(deal).join() !== `${s.total},${s.d}`) problems.add(`${where}: "${deal}"`)
          const each = ss.find((x) => /^Der er .+ i hver bunke\.$/.test(x))
          if (!each || numbersIn(each).join() !== `${s.unit}`) problems.add(`${where}: "${each}"`)
          if (s.n === 1) {
            // "En fjerdedel af tolv er tre." / "Halvdelen af tolv er seks."
            const m = ss.map((x) => /^(.+) af (\S+) er (\S+)\.$/.exec(x)).find(Boolean)
            const fr = m ? heardFraction(m[1]) : null
            if (!m || !fr || fr.n !== 1 || fr.d !== s.d || numbersIn(`${m[2]} ${m[3]}`).join() !== `${s.total},${s.answer}`) problems.add(`${where}: "${text}"`)
          } else {
            // "Tre fjerdedele er tre af bunkerne. Tre gange tre giver ni."
            const three = ss.find((x) => / er (\S+) af bunkerne\.$/.test(x))
            const times = ss.find((x) => / gange .+ giver /.test(x))
            if (!three || numbersIn(three.replace(/^.+ er /, '')).join() !== `${s.n}`) problems.add(`${where}: "${three}"`)
            if (!times || numbersIn(times).join() !== `${s.n},${s.unit},${s.answer}`) problems.add(`${where}: "${times}"`)
          }
          const put = ss.find((x) => /^Læg .+ på den ene tallerken og .+ på den anden\.$/.test(x))
          if ((kind === 'share' && s.n > 1) !== (put !== undefined)) problems.add(`${where}: "${text}"`)
          if (put && numbersIn(put).join() !== `${s.answer},${s.rest}`) problems.add(`${where}: "${put}" for the deal ${s.answer}|${s.rest}`)
          const own = tag === 'denominatorAsAnswer'
          if (own !== text.startsWith('Brøken fortæller, hvor mange lige store bunker du skal dele i. Den fortæller ikke svaret.')) problems.add(`${where}: "${text}"`)
          if ((h.misconception ?? null) !== (own ? 'denominatorAsAnswer' : null)) problems.add(`${where}: misconception ${h.misconception}`)
          if (tag === 'shareUnequal' && !text.startsWith('Alle bunker skal have lige mange.')) problems.add(`${where}: "${text}"`)
        }
      }
    }
    expect(first([...problems])).toEqual([])
  }, TIMEOUT)

  it('never says "delt med" or "divideret med" (A19: the heap is dealt, no ":" is read)', () => {
    for (const { task } of built) expect(said(task), task.factId).not.toMatch(/delt med|divideret/)
  })
})

// ═══ fractionCompare ══════════════════════════════════════════════════════════

describe('fractionCompare oracle', () => {
  const { def, canon, instances, built } = setup('fractionCompare')
  const q = (t: Task) => cmpIdOf(t.factId)!

  it('has SPEC §2.2’s three families over the denominators 2, 3, 4, 5, 6 and 8: 14 pairs each way and 21 rows of four', () => {
    const all = [...canon, ...[...instances.values()].flat()]
    // a fact's answer is its sortOrder deal: its four cards from the family's end (pairBigger the biggest
    // first, pairSmaller and order4 the smallest first), holding the pair, or the four of order4
    expect(first(idChecks(def, all, /^fcm:([bs]:\d,\d|o:\d:\d,\d,\d,\d)$/, (id) => {
      const c = cmpIdOf(id)
      const f = all.find((x) => x.id === id)!
      const cards = String(f.answer).split('|')
      return c && { family: c.family, answer: byValue(cards, c.family === 'pairBigger').join('|') }
    }))).toEqual([])
    for (const f of all) {
      const c = cmpIdOf(f.id)!
      const ds = String(f.answer).split('|').map((x) => cardFrac(x)!)
      if (ds.length !== 4 || ds.some((x) => x.n !== c.k)) throw new Error(`${f.id}: ${String(f.answer)}`)
      if (c.pair && !c.pair.every((d) => ds.some((x) => x.d === d))) throw new Error(`${f.id}: ${String(f.answer)} lacks its pair`)
      if (c.four && ds.map((x) => x.d).sort((a, b) => a - b).join() !== c.four.join()) throw new Error(`${f.id}: ${String(f.answer)}`)
    }
    const fresh = Object.fromEntries(def.families.map((fam) => [fam.id, new Set(freshIds(def, fam.id, 40)).size]))
    expect(fresh).toEqual({ pairBigger: 14, pairSmaller: 14, order4: 21 })
    // the pairs: a < b with a third card possible on the far side (pairBigger needs one smaller than 1/a, pairSmaller one bigger than 1/b)
    const want = (fam: 'b' | 's') => {
      const out = new Set<string>()
      for (const a of [2, 3, 4, 5, 6, 8]) for (const b of [2, 3, 4, 5, 6, 8]) {
        if (a >= b) continue
        const third = [2, 3, 4, 5, 6, 8].some((d) => d !== a && d !== b && (fam === 'b' ? d > a : d < b))
        if (third) out.add(`fcm:${fam}:${a},${b}`)
      }
      return out
    }
    expect(new Set(freshIds(def, 'pairBigger', 40))).toEqual(want('b'))
    expect(new Set(freshIds(def, 'pairSmaller', 40))).toEqual(want('s'))
  }, TIMEOUT)

  it('asks for the biggest or smallest card (choice) or the order (sortOrder), and the answer is the cards compared as numbers', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const c = q(task)
      const ask = cmpAsk(said(task))
      const where = `${fact.id} ${kind} [${task.options.join(' ')}]`
      const fracs = task.options.map(cardFrac)
      if (!ask || fracs.some((f) => !f)) {
        problems.push(`${where}: "${said(task)}"`)
        continue
      }
      // the family decides the direction (module header): pairSmaller the smallest, pairBigger the biggest,
      // order4 the biggest card and the order from the smallest
      const biggest = c.family === 'pairBigger' || (c.family === 'order4' && kind === 'choice')
      if (ask.biggest !== biggest || ask.sort !== (kind === 'sortOrder')) problems.push(`${where}: "${said(task)}"`)
      const values = fracs.map((f) => `${f!.n}/${f!.d}`)
      if (new Set(values).size !== values.length || fracs.some((f, i) => fracs.some((g, j) => i !== j && compareFrac(f!, g!) === 0))) problems.push(`${where}: two cards of one value`)
      if (fracs.some((f) => f!.n !== c.k)) problems.push(`${where}: a card with another numerator than ${c.k}`)
      const want = kind === 'sortOrder' ? byValue(task.options, ask.biggest).join('|') : byValue(task.options, ask.biggest)[0]
      if (task.answer !== want) problems.push(`${where}: answer ${String(task.answer)}, the cards say ${want}`)
      if (kind === 'choice') {
        if (task.options.length !== 3 || task.prompt.scene !== 'hear') problems.push(`${where}: ${task.options.length} cards over ${task.prompt.scene}`)
        // a pair's own answer stays the answer: the third card is on the far side
        if (c.pair && task.answer !== `frac:1/${c.family === 'pairBigger' ? c.pair[0] : c.pair[1]}`) problems.push(`${where}: the pair ${c.pair} is answered ${String(task.answer)}`)
        if (c.pair && !c.pair.every((d) => task.options.includes(`frac:1/${d}`))) problems.push(`${where}: the pair ${c.pair} is not on the cards`)
        if (c.four && !task.options.every((o) => c.four!.includes(cardFrac(o)!.d))) problems.push(`${where}: a card not of ${c.four}`)
      } else {
        if (task.options.length !== 4 || task.prompt.scene !== 'row' || task.prompt.cells.length !== 4) problems.push(`${where}: ${task.options.length} cards on ${JSON.stringify(task.prompt)}`)
        if (c.four && [...task.options].map((o) => cardFrac(o)!.d).sort((a, b) => a - b).join() !== c.four.join()) problems.push(`${where}: not the four of the id`)
        if (c.pair && !c.pair.every((d) => task.options.includes(`frac:1/${d}`))) problems.push(`${where}: the pair ${c.pair} is not among the cards`)
      }
      if (task.optionView !== 'fraction' || task.optionClips !== null) problems.push(`${where}: ${task.optionView} cards read aloud ${JSON.stringify(task.optionClips)}`)
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  /** biggerDenominator: the card (or the order) the bigger denominator gives; every other value plain. */
  const judge = (b: Built, v: AnswerValue): readonly ErrorTag[] => {
    const t = b.task
    const ask = cmpAsk(said(t))!
    const mis = t.kind === 'sortOrder' ? byDenominator(t.options, ask.biggest).join('|') : byDenominator(t.options, ask.biggest)[0]
    return v === mis ? ['biggerDenominator'] : ['near', 'other']
  }

  it('deals its cards once each, and classifies the bigger denominator taken for the bigger fraction as biggerDenominator', () => {
    expect(first(built.flatMap((b) => [...answerProblems(b.task), ...cardProblems(b.task), ...optionProblems(b.task)]))).toEqual([])
    expect(first(classifyB(built, judge, (b, v) => v === b.task.answer))).toEqual([])
    expect(first(detectableB(built, judge))).toEqual([])
    // every task can show it: the misconception's card is always dealt, the reversed order always possible
    for (const { task } of built) expect(Object.values(task.distractorTags).includes('biggerDenominator') && classifyAnswer(task, byDenominator(task.options, cmpAsk(said(task))!.biggest)[0]) !== null, task.factId).toBe(true)
  }, TIMEOUT)

  it('has SPEC’s kinds and ceilings: choice 1 in 3 (box 3), sortOrder of four cards 1 in 24 (production, box 5)', () => {
    expect(first(productionB3(built))).toEqual([])
    expect(first(specKindB(def, built))).toEqual([])
    expect(first(speedProblems(def, built))).toEqual([])
    for (const { task } of built) if (task.kind === 'sortOrder') expect([guessP(task), ceilingFor(task)], task.factId).toEqual([1 / 24, 5])
  }, TIMEOUT)

  it('speaks every task and hint with recorded clips and no digits, and never reads a fraction card aloud', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(canon.flatMap((f) => hintProblems(def, f, tagsToHint(def, canon))))).toEqual([])
    expect(first(animationChecks(def, canon, tagsToHint(def, canon)))).toEqual([])
  }, TIMEOUT)

  it('hints with fraction bars that show the task’s own cards (k of d equal parts) and names the right end or order', () => {
    const problems = new Set<string>()
    const seen = new Set<string>()
    for (const { fact, kind, task } of built) {
      if (seen.has(`${fact.id}|${kind}`)) continue
      seen.add(`${fact.id}|${kind}`)
      const ask = cmpAsk(said(task))!
      for (const tag of [null, 'near', 'other', 'biggerDenominator'] as (ErrorTag | null)[]) {
        const h = def.hint(fact, tag, kind)
        const where = `${fact.id} hint(${String(tag)}, ${kind})`
        const text = spokenText(h.speech)
        if (h.visual.scene !== 'fractionBars') {
          problems.add(`${where}: ${JSON.stringify(h.visual)}`)
          continue
        }
        // the bars as drawn are the cards: each k of d equal parts
        const bars = readBars(h.visual.fracs)
        const cards = task.options.map((o) => cardFrac(o)!)
        for (const bar of bars) if (typeof bar === 'string') problems.add(`${where}: ${bar}`)
        const drawn = bars.filter((x): x is { n: number; d: number } => typeof x !== 'string').map((x) => `${x.n}/${x.d}`).sort()
        if (drawn.join() !== cards.map((c) => `${c.n}/${c.d}`).sort().join()) problems.add(`${where}: bars ${drawn}, cards ${cards.map((c) => `${c.n}/${c.d}`)}`)
        const ss = sentences(text)
        if (!ss.includes('Jo flere lige store dele en hel er delt i, jo mindre bliver hver del.')) problems.add(`${where}: "${text}"`)
        if (kind === 'sortOrder') {
          // "Fra den største er de en halv, en tredjedel, en fjerdedel og en ottendedel."
          const m = ss.map((x) => /^Fra den (største|mindste) er de (.+)\.$/.exec(x)).find(Boolean)
          const named = m ? m[2].split(/, | og /).map((w) => heardFraction(w)) : []
          const want = byValue(task.options, ask.biggest).map((o) => cardFrac(o)!)
          if (!m || (m[1] === 'største') !== ask.biggest || named.length !== want.length || named.some((f, i) => !f || f.n !== want[i].n || f.d !== want[i].d)) problems.add(`${where}: "${text}", the order is ${want.map((f) => `${f.n}/${f.d}`)}`)
        } else {
          // "En halv er størst." over the cards of the task
          const m = ss.map((x) => /^(.+) er (størst|mindst)\.$/.exec(x)).find(Boolean)
          const f = m ? heardFraction(m[1]) : null
          const want = cardFrac(byValue(task.options, ask.biggest)[0])!
          if (!m || !f || (m[2] === 'størst') !== ask.biggest || f.n !== want.n || f.d !== want.d) problems.add(`${where}: "${text}", the ${ask.biggest ? 'biggest' : 'smallest'} card is ${want.n}/${want.d}`)
        }
        const own = tag === 'biggerDenominator'
        if (own !== text.startsWith('Et stort tal under brøkstregen betyder små dele. Det er ikke en stor brøk.')) problems.add(`${where}: "${text}"`)
        if ((h.misconception ?? null) !== (own ? 'biggerDenominator' : null)) problems.add(`${where}: misconception ${h.misconception}`)
      }
    }
    expect(first([...problems])).toEqual([])
  }, TIMEOUT)

  it('never says "delt med" or "divideret med" (A19)', () => {
    for (const { fact, kind, task } of built) {
      expect(said(task), task.factId).not.toMatch(/delt med|divideret/)
      expect(spokenText(def.hint(fact, 'biggerDenominator', kind).speech), task.factId).not.toMatch(/delt med|divideret/)
    }
  })
})

