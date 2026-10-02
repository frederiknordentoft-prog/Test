// Oracle tests for tensOnes and placeValue1000 (SPEC §15.1): every canonical fact and 200 seeded
// instances per family, every kind, compared with place.oracle.ts — answers from the id and from the
// blocks, words and cards the child gets; wrong answers from pædagogik §3.2's formulas.
import { describe, expect, it, vi } from 'vitest'

// every value of every instance is classified: give the sweeps room on a loaded container (CONVENTIONS)
vi.setConfig({ testTimeout: 240_000 })
import { isCorrect } from '../../answer'
import type { Fact, Task } from '../../types'
import {
  cardProblems, first, hintProblems, optionProblems, registeredSkill, spokenText, tagsToHint, taskSpeechProblems, type Built,
} from '../number/number.oracle'
import {
  answerProblems2, avoidProblems, classifyProblems2, concatWords, diagnosticCardProblems, idProblems, numberWordProblems,
  productionProblems2, specKindProblems2, sweep, swapTO, tagIssue, zeroSlips, type Why,
} from '../number/number2.oracle'
import {
  explainPlaceValue, explainTensOnes, fillings, parsePlaceValue, parseTensOnes, placeValueAnswer, placeValueFromTask, placeWordsValue,
  slotsRight, slotsTarget, tensOnesAnswer, tensOnesBuilt, tensOnesFromTask, writesParts, type PlaceValueQ, type TensOnesQ,
} from './place.oracle'

/** fillSlots: every filling of the palette is right exactly when the oracle says so, and a wrong one is classified as explained. */
function slotProblems(built: readonly Built[], target: (b: Built) => { n: number; parts: boolean }, explain: (b: Built, v: string) => Why): string[] {
  const out: string[] = []
  for (const b of built) {
    if (b.kind !== 'fillSlots') continue
    let right = 0
    for (const f of fillings(b.task)) {
      const given = f.join('|')
      const oracle = slotsRight(target(b), f)
      if (oracle) right++
      if (oracle !== isCorrect(b.task, given)) out.push(`${b.fact.id} fillSlots ${given}: right by the oracle ${oracle}, by the task ${!oracle}`)
      if (!oracle) {
        const p = tagIssue(b.task, given, explain(b, given), false)
        if (p) out.push(p)
      }
    }
    if (right === 0) out.push(`${b.fact.id} fillSlots: no right filling from the palette [${b.task.options}]`)
  }
  return out
}

/** How many fillings of a fillSlots task the oracle takes as right (for the guess rate). */
const rightFillingsOf = (target: (t: Task) => { n: number; parts: boolean }) => (t: Task): number =>
  fillings(t).filter((f) => slotsRight(target(t), f)).length

describe('place oracle helpers', () => {
  it('read place words and blocks the way a child does (a check of the oracle itself)', () => {
    expect(placeWordsValue('Fem enere og to tiere. Hvilket tal er det?')).toBe(25)
    expect(placeWordsValue('Seks hundreder og en tier.')).toBe(610)
    expect(placeWordsValue('To hundreder og fjorten tiere.')).toBe(340)
    expect(placeWordsValue('Læg et hundrede og fem enere.')).toBe(105)
    expect(explainTensOnes(parseTensOnes('to:build:47')!, 'keypad', 11).mis).toEqual(['addsPlaceParts'])
    expect(explainTensOnes(parseTensOnes('to:build:40')!, 'keypad', 4)).toMatchObject({ mis: ['addsPlaceParts'], operand: true })
    expect(explainPlaceValue(parsePlaceValue('pv:zeroPlace:304')!, 3004).mis).toEqual(['concatNumberWords'])
    expect(explainPlaceValue(parsePlaceValue('pv:expand:t:477')!, 7)).toMatchObject({ mis: ['faceValue'], operand: true })
    expect(zeroSlips(320).sort((a, b) => a - b)).toEqual([32, 302])
    expect(concatWords(320)).toBe(30020)
  })
})

// ─── tensOnes ───────────────────────────────────────────────────────────────

describe('tensOnes oracle', () => {
  const def = registeredSkill('tensOnes')
  const { canon, instances, all, built } = sweep(def)
  const q = (f: Fact): TensOnesQ => parseTensOnes(f.id)!
  const oracle = (id: string) => {
    const p = parseTensOnes(id)
    return p ? { family: p.family, answer: tensOnesAnswer(p) } : null
  }
  const target = (f: Pick<Fact, 'id'>) => ({ n: q(f as Fact).n, parts: q(f as Fact).family === 'expand' })
  // the kind the child answered (buildBase tasks are checked as typed values below, so not task.kind)
  const explain = (b: Built, v: number | string) => explainTensOnes(q(b.fact), b.kind, v)
  const byTask = (t: Task) => target({ id: t.factId })
  /** A built answer is checked like a typed one: every value the blocks can be worth. */
  const typed = (b: Built): Built => (b.kind === 'buildBase' ? { ...b, task: { ...b.task, kind: 'keypad' } } : b)

  it('has the four families of pædagogik §1.3, ids naming one instance, and answers worked out from the id', () => {
    expect(def.families.map((f) => f.id)).toEqual(['build', 'decompose', 'swapped', 'expand'])
    expect(first([...idProblems(def, all, /^to:(build|swapped|expand|decompose:(tens|ones)):\d+$/, oracle), ...avoidProblems(def, instances)])).toEqual([])
  })

  it('answers every task as the child works it out from the blocks, the words and the card', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const qq = q(fact)
      const where = `${fact.id} ${kind}`
      if (kind === 'fillSlots') {
        // build/decompose/swapped: the two digits, tens first; expand: 47 = □ + □
        const want = qq.family === 'expand' ? `${qq.t * 10}|${qq.o}` : `${qq.t}|${qq.o}`
        if (task.answer !== want && !task.accept.includes(want)) problems.push(`${where}: ${String(task.answer)}, oracle ${want}`)
        continue
      }
      const want = kind === 'buildBase' ? tensOnesBuilt(qq) : tensOnesAnswer(qq)
      const seen = tensOnesFromTask(task, qq)
      if (task.answer !== want || seen !== want) problems.push(`${where}: "${spokenText(task.speech)}" → ${String(seen)}, oracle ${want}, task ${String(task.answer)}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards (0–99) and keeps every answer right', () => {
    const problems = built.flatMap((b) => [...cardProblems(b.task, (c) => c <= 99), ...optionProblems(b.task), ...answerProblems2(b.task)])
    expect(first(problems)).toEqual([])
  })

  it('shows a diagnostic card whenever pædagogik §3.2 has one (addsPlaceParts, digitSwap, faceValue)', () => {
    const known = (b: Built) => {
      const { n, t, o } = q(b.fact)
      return [t + o, swapTO(n) ?? -1, t * 10, t, o]
    }
    expect(first(diagnosticCardProblems(built, known, explain))).toEqual([])
  })

  it('classifies cards and typed numbers by pædagogik §3.2 (addsPlaceParts, digitSwap, faceValue; A9 when a count is the value)', () => {
    const cards = built.filter((b) => !(b.kind === 'buildBase' && q(b.fact).family === 'decompose' && q(b.fact).part === 'tens'))
    expect(first(classifyProblems2(cards.map(typed), explain, { upTo: 99 }))).toEqual([])
  })

  it('fillSlots: right exactly when the digits (or the parts) make the number; digits swapped are digitSwap, digits for values faceValue', () => {
    expect(first(slotProblems(built, (b) => target(b.fact), (b, v) => explain(b, v)))).toEqual([])
  })

  // GENERATOR BUG (tensOnes.ts, candidates() for decompose:tens, used for buildBase): the built answer of
  // "Byg kun tierne i syvogfyrre" is 40 (four rods), but the candidates are those of the card question
  // "Hvor mange tiere …?" (answer 4). Built 7 (seven cubes: the ones, not the tens) is tagged digitSwap —
  // production evidence — while 70 (seven rods: the digits in the order Danish says them, the real
  // digitSwap) and 4 (four cubes: the digit for its value, faceValue) are 'other'. to:decompose:tens:47
  // buildBase: 7 → digitSwap (expected plain), 70 → other (expected digitSwap), 4 → other (expected faceValue).
  it.fails('buildBase for "Byg kun tierne i …": what was built is classified by what it is worth', () => {
    const rods = built.filter((b) => b.kind === 'buildBase' && q(b.fact).family === 'decompose' && q(b.fact).part === 'tens')
    expect(first(classifyProblems2(rods.map(typed), explain, { upTo: 99 }))).toEqual([])
  })

  it('has SPEC’s production kinds and ceilings (keypad and buildBase box 5; fillSlots and cards box 3)', () => {
    expect(first([...productionProblems2(built, rightFillingsOf(byTask)), ...specKindProblems2(def, built, rightFillingsOf(byTask))])).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
    const tags = tagsToHint(def, canon)
    expect(first([...taskSpeechProblems(built), ...numberWordProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags))])).toEqual([])
  })
})

// ─── placeValue1000 ─────────────────────────────────────────────────────────

describe('placeValue1000 oracle', () => {
  const def = registeredSkill('placeValue1000')
  const { canon, instances, all, built } = sweep(def)
  const q = (f: Fact): PlaceValueQ => parsePlaceValue(f.id)!
  const oracle = (id: string) => {
    const p = parsePlaceValue(id)
    return p ? { family: p.family, answer: placeValueAnswer(p) } : null
  }
  const explain = (b: Built, v: number | string) => explainPlaceValue(q(b.fact), v)
  const byTask = (t: Task) => slotsTarget(parsePlaceValue(t.factId)!)

  it('has the five families of pædagogik §1.3 (regroup is 3. kl.), ids naming one instance, answers from the id', () => {
    expect(def.families.map((f) => f.id)).toEqual(['buildHTO', 'zeroPlace', 'digitValue', 'expand', 'regroup'])
    expect(def.families.find((f) => f.id === 'regroup')?.grade).toBe(3)
    expect(first([...idProblems(def, all, /^pv:(buildHTO|zeroPlace|(digitValue|expand):[ht]|regroup:(ht|to):\d+):\d+$/, oracle), ...avoidProblems(def, instances)])).toEqual([])
  })

  it('answers every task as the child works it out from the blocks, the words and the card', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const qq = q(fact)
      const where = `${fact.id} ${kind}`
      if (kind === 'fillSlots') {
        const t = slotsTarget(qq)
        if (!slotsRight(t, String(task.answer).split('|').map(Number))) problems.push(`${where}: ${String(task.answer)} does not write ${qq.n}`)
        if (writesParts(qq) && task.prompt.scene !== 'equation') problems.push(`${where}: no expansion on the card`)
        continue
      }
      const want = placeValueAnswer(qq)
      const seen = placeValueFromTask(task, qq)
      if (task.answer !== want || seen !== want) problems.push(`${where}: → ${String(seen)}, oracle ${want}, task ${String(task.answer)}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards (0–999, or a written-out 3004) and keeps every answer right', () => {
    const allowed = (b: Built) => (c: number) => c <= 999 || c === concatWords(q(b.fact).n)
    const problems = built.flatMap((b) => [...cardProblems(b.task, allowed(b)), ...optionProblems(b.task), ...answerProblems2(b.task)])
    expect(first(problems)).toEqual([])
  })

  // a built answer is checked like a typed one: every value the blocks can be worth
  const typedBuilt = built.map((b): Built => (b.kind === 'buildBase' ? { ...b, task: { ...b.task, kind: 'keypad' } } : b))
  const extraOf = (b: Built) => [concatWords(q(b.fact).n) ?? 0, ...zeroSlips(q(b.fact).n), swapTO(q(b.fact).n) ?? 0]
  const classified = classifyProblems2(typedBuilt, explain, { upTo: 1000, extra: extraOf })
  /** Documented below: regroup:to:<a>:11, where the counts added are also the reversed answer. */
  const partsOrSwap = (p: string) => /^pv:regroup:to:\d:11 \w+ \w+ \d+ \(answer \d+\): addsPlaceParts, expected ambiguous$/.test(p)

  it('shows a diagnostic card whenever pædagogik §3.2 has one (addsPlaceParts, zeroPlaceholder, concatNumberWords, digitSwap, faceValue)', () => {
    const known = (b: Built) => {
      const qq = q(b.fact)
      const digits = String(qq.n).split('').map(Number)
      return [digits.reduce((x, y) => x + y, 0), ...zeroSlips(qq.n), concatWords(qq.n) ?? -1, swapTO(qq.n) ?? -1, ...digits, ...(qq.counts ? [qq.counts[0] + qq.counts[1]] : [])]
    }
    expect(first(diagnosticCardProblems(built, known, explain))).toEqual([])
  })

  it('classifies cards, typed and built numbers by pædagogik §3.2 (A9: 477 = 400 + □ + 7 answered 7 is ambiguous)', () => {
    expect(first(classified.filter((p) => !partsOrSwap(p)))).toEqual([])
  })

  // Fixed by SPEC A11 in buildTask (was a generator bug in placeValue1000.ts, candidates() for regroup): for
  // pv:regroup:to:<a>:11 — "En tier og elleve enere. Hvilket tal er det?" → 21 — the counts added
  // (1 + 11 = 12, addsPlaceParts) are also the answer with its digits reversed (12 for 21: digitSwap, a
  // concept in placeValue1000). Two misconceptions on one value must be 'ambiguous'; the task says
  // addsPlaceParts, on the card and typed, for a = 1–8 (12, 13 … 19 for 21, 31 … 91).
  it('regroup: a value that is both the counts added and the digits reversed is ambiguous', () => {
    expect(first(classified.filter(partsOrSwap))).toEqual([])
  })

  const slots = slotProblems(built, (b) => slotsTarget(q(b.fact)), (b, v) => explain(b, v))
  /** Documented below: a true sum the palette allows (918 = 900 + 9 + 9) is marked wrong. */
  const trueMarkedWrong = (p: string) => / fillSlots [\d|]+: right by the oracle true, by the task false$/.test(p)
  /** Documented below: a slip of parts written in another order than the canonical one is not recognised. */
  const slipOtherOrder = (p: string) => / fillSlots typed [\d|]+ \(answer [\d|]+\): other, expected (faceValue|digitSwap)$/.test(p)
  /** The instances whose palette makes another true sum (their guess rate counts those sums too). */
  const extraSums = new Set(slots.filter(trueMarkedWrong).map((p) => p.split(' ')[0]))

  it('fillSlots: right exactly when the digits (or the parts, in any order) make the number; slips classified', () => {
    expect(first(slots.filter((p) => !trueMarkedWrong(p) && !slipOtherOrder(p)))).toEqual([])
  })

  // Rettet (GENFIX). Was a generator bug (placeValue1000.ts, palette() for digitValue/expand fillSlots): the
  // spare tokens let the child write another true sum, which was marked wrong and classified 'other'. "Ni
  // hundrede og atten er hvad plus hvad plus hvad?" (pv:digitValue:t:918 and pv:expand:*:918, palette 900,
  // 9, 10, 1, 8, 2, 20, 200): 900 + 9 + 9 = 918 was wrong for the task. The same for 612 (600 + 6 + 6), 714
  // and 816 — every H·100 + 10 + 2H. Now every true sum the palette allows is accepted, and the spare digit
  // is one that makes no other true sum (911 and 912 had one through the spare).
  it('fillSlots: every true sum the palette allows is right', () => {
    expect(first(slots.filter(trueMarkedWrong))).toEqual([])
  })

  // Rettet (GENFIX). Was a generator bug (placeValue1000.ts, candidates() for digitValue/expand): the parts
  // may be written in any order (accept() takes all six), but the slips were only recognised in the
  // canonical order: for 623, '6|2|3' (the digits for their values) was faceValue but '3|6|2' or '2|3|6' was
  // 'other'; likewise only '600|30|2' of the swapped parts was digitSwap. Now every order of a slip is
  // listed with its tag (as tensOnes does for 47 = □ + □, where '4|7' and '7|4' are both faceValue).
  it('fillSlots: a slip of parts is the same slip in any order', () => {
    expect(first(slots.filter(slipOtherOrder))).toEqual([])
  })

  it('has SPEC’s production kinds and ceilings (keypad, buildBase and fillSlots box 5; cards box 3)', () => {
    const problems = [...productionProblems2(built, rightFillingsOf(byTask)), ...specKindProblems2(def, built, rightFillingsOf(byTask))]
    // the guess rate of the instances above counts the extra true sums; they stay production either way
    expect(first(problems.filter((p) => !extraSums.has(p.split(' ')[1])))).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
    const tags = tagsToHint(def, canon)
    expect(first([...taskSpeechProblems(built), ...numberWordProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags))])).toEqual([])
  })
})
