// Oracle tests for the number skills of 1.–2. klasse (SPEC §15.1): every canonical fact and 200 seeded
// instances per family, every kind, compared with number2.oracle.ts — answers from the id and from
// the spoken question and the picture, wrong answers from pædagogik §3.2's formulas.
import { describe, expect, it, vi } from 'vitest'

// every value of every instance is classified: give the sweeps room on a loaded container (CONVENTIONS)
vi.setConfig({ testTimeout: 240_000 })
import { isCorrect } from '../../answer'
import { classifyAnswer } from '../../misconceptions'
import { registeredSkills } from '../../registry'
import type { Fact, SkillId } from '../../types'
import {
  cardProblems, first, hintProblems, optionProblems, orderings, registeredSkill, spokenText, tagsToHint,
  taskSpeechProblems, type Built,
} from './number.oracle'
import {
  answerProblems2, avoidProblems, byFirstDigit, classifyProblems2, concatWords, drawInstances, explainHeard100, explainHeard1000,
  explainLine, explainOrder, hear1000Family, hear1000Oracle, hear100Oracle, heardNumber2, idProblems, lineAnswerFromTask, lineOf,
  numberCards, numbersIn, numberWordProblems, orderAnswer, orderAnswerFromSpeech, parseLine100, parseLine1000, parseOrder100,
  parseOrder1000, productionProblems2, roundHalfUp, rowCells, signFromSpeech, signToken, sortFromSpeech, spec101Words,
  specKindProblems2, swapTO, sweep, zeroSlips, type LineQ, type OrderQ,
} from './number2.oracle'

const WAVE2: readonly SkillId[] = [
  'hear100', 'order100', 'numberLine100', 'hear1000', 'order1000', 'numberLine1000', 'tensOnes', 'placeValue1000',
  'doubles', 'halves', 'addTo20', 'subTo20', 'addSub20Simple', 'tens100', 'add100NoCarry', 'sub100NoBorrow', 'add100Carry',
  'sub100Borrow', 'addSub1000Round',
]

describe('fact ids of the 19 wave-2 skills across every registered skill (CONVENTIONS)', () => {
  it('are unique across all registered skills, one prefix per skill, shared only where CONVENTIONS shares it', () => {
    const owner = new Map<string, SkillId>()
    const prefixes = new Map<string, Set<SkillId>>()
    const problems: string[] = []
    for (const def of registeredSkills()) {
      const ids = def.mode === 'procedure'
        ? [...def.enumerate(), ...[...drawInstances(def, WAVE2.includes(def.id) ? 200 : 50).values()].flat()].map((f) => f.id)
        : def.enumerate().map((f) => f.id)
      const own = new Set<string>()
      for (const id of new Set(ids)) {
        const prev = owner.get(id)
        if (prev !== undefined && prev !== def.id) problems.push(`${id}: ${prev} and ${def.id}`)
        owner.set(id, def.id)
        own.add(id.slice(0, id.indexOf(':')))
      }
      if (WAVE2.includes(def.id) && own.size !== 1) problems.push(`${def.id}: prefixes ${[...own]}`)
      for (const p of own) prefixes.set(p, (prefixes.get(p) ?? new Set()).add(def.id))
    }
    const SHARED: Record<string, string> = { add: 'addTo10,addTo20', sub: 'subTo10,subTo20' }
    for (const [p, skills] of prefixes) {
      if (skills.size > 1 && [...skills].some((s) => WAVE2.includes(s)) && [...skills].sort().join(',') !== SHARED[p]) problems.push(`prefix ${p}: ${[...skills]}`)
    }
    for (const id of WAVE2) if (!registeredSkills().some((d) => d.id === id)) problems.push(`${id} is not registered`)
    expect(first(problems)).toEqual([])
  })
})

describe('wave-2 oracle kit', () => {
  it('reads Danish numbers 0–1000 the way the oracles need them (a check of the oracle itself)', () => {
    expect(numbersIn('Find tallet syvogfyrre.')).toEqual([47])
    expect(numbersIn('Hvilket tal ligger mellem tredive og fyrre?')).toEqual([30, 40])
    expect(numbersIn('mellem et hundrede og to hundrede')).toEqual([100, 200])
    expect(numbersIn('fire hundrede og treoghalvfems og fireogfirs')).toEqual([493, 84])
    expect(numbersIn('størst, to hundrede og firs tre hundrede og seksoghalvtreds eller tre hundrede og enogtres?')).toEqual([280, 356, 361])
    expect(numbersIn('Hvilket tal er hundrede mere end tusind')).toEqual([1000])
    expect(numbersIn('fire hundrede og en')).toEqual([401])
    expect(concatWords(104)).toBe(1004)
    expect(concatWords(345)).toBe(30045)
    expect(zeroSlips(304).sort((a, b) => a - b)).toEqual([34, 340])
    expect(zeroSlips(320).sort((a, b) => a - b)).toEqual([32, 302])
    expect(zeroSlips(300).sort((a, b) => a - b)).toEqual([3, 30])
    expect(zeroSlips(1000)).toEqual([100])
    expect(swapTO(345)).toBe(354)
    expect(swapTO(47)).toBe(74)
    expect(roundHalfUp(345, 10)).toBe(350)
    expect(roundHalfUp(350, 100)).toBe(400)
    expect(byFirstDigit([69, 102, 98, 345])).toEqual([98, 69, 345, 102])
    expect(orderAnswerFromSpeech('Hvilket tal er ti mindre end tre hundrede og fem?', [])).toBe(295)
    expect(sortFromSpeech('Tæl baglæns i tiere fra halvtreds.', [1, 2, 3, 4])).toEqual([40, 30, 20, 10])
    expect(signFromSpeech('Hvilket tegn skal stå mellem niogtres og et hundrede og to?')).toBe('cmp:<')
    expect(spec101Words(105)).toBe('et hundrede og fem')
    expect(spec101Words(220)).toBe('to hundrede og tyve')
    expect(spec101Words(47)).toBe('syvogfyrre')
    expect(spec101Words(21)).toBe('enogtyve')
    expect(spec101Words(1, 'n')).toBe('et')
  })
})

// ─── hear100, hear1000 ──────────────────────────────────────────────────────

const HEAR = [
  { id: 'hear100', oracle: hear100Oracle, explain: explainHeard100, shape: /^h100:\d+$/, families: 8, top: 99 },
  { id: 'hear1000', oracle: hear1000Oracle, explain: explainHeard1000, shape: /^h1000:\d+$/, families: 5, top: 1000 },
] as const

for (const h of HEAR) {
  describe(`${h.id} oracle`, () => {
    const def = registeredSkill(h.id)
    const { canon, instances, all, built } = sweep(def)
    const n = (f: Fact) => h.oracle(f.id)!.answer

    it('has SPEC §2.2’s families, ids in the h:<n> format, and answers the number in the id', () => {
      expect(def.families.length).toBe(h.families)
      expect(first([...idProblems(def, all, h.shape, h.oracle), ...avoidProblems(def, instances)])).toEqual([])
      if (h.id === 'hear100') {
        // all 80 numbers 20–99 are canonical, ten per family
        expect(canon.map((f) => Number(f.answer)).sort((a, b) => a - b)).toEqual(Array.from({ length: 80 }, (_, i) => i + 20))
      } else {
        // the families split 100–1000 by the number's shape (pædagogik §1.3); all ten hundreds are canonical
        expect(canon.filter((f) => f.family === 'hundreds').map((f) => Number(f.answer)).sort((a, b) => a - b))
          .toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])
        for (const fam of def.families) expect(new Set(instances.get(fam.id)!.map((f) => hear1000Family(Number(f.answer)))), fam.id).toEqual(new Set([fam.id]))
      }
    })

    it('only says the number — nothing on screen shows it — and the spoken number is the answer', () => {
      const problems: string[] = []
      for (const { fact, kind, task } of built) {
        const text = spokenText(task.speech)
        if (task.prompt.scene !== 'hear') problems.push(`${fact.id} ${kind}: a ${task.prompt.scene} scene can show the number`)
        if (heardNumber2(text, kind) !== n(fact) || task.answer !== n(fact)) problems.push(`${fact.id} ${kind}: "${text}" for answer ${String(task.answer)}`)
      }
      expect(first(problems)).toEqual([])
    })

    it('deals valid cards and keeps every answer right', () => {
      const problems = built.flatMap((b) => [...cardProblems(b.task, (c) => c <= h.top || c === concatWords(n(b.fact))), ...answerProblems2(b.task)])
      expect(first(problems)).toEqual([])
    })

    it('shows a diagnostic card whenever the number has one (the rotation picks which)', () => {
      const problems: string[] = []
      for (const b of built) {
        if (b.kind !== 'choice') continue
        const v = n(b.fact)
        const known = [swapTO(v), ...(h.id === 'hear1000' ? [concatWords(v), ...zeroSlips(v)] : [])].filter((x): x is number => x !== null)
        if (known.length > 0 && !numberCards(b.task).some((c) => known.includes(c))) problems.push(`${b.fact.id}: no diagnostic card among [${b.task.options}]`)
      }
      expect(first(problems)).toEqual([])
    })

    it('classifies cards and typed numbers by pædagogik §3.2 (digitSwap is a concept here; concatNumberWords, zeroPlaceholder)', () => {
      const explain = (b: Built, v: number | string) => h.explain(n(b.fact), v)
      const extra = (b: Built) => [concatWords(n(b.fact)) ?? 0, ...zeroSlips(n(b.fact)), swapTO(n(b.fact)) ?? 0]
      expect(first(classifyProblems2(built, explain, { upTo: h.top, extra }))).toEqual([])
    })

    it('has SPEC’s production kinds and ceilings (keypad box 5, five digits for hear1000; cards box 3)', () => {
      expect(first([...productionProblems2(built), ...specKindProblems2(def, built)])).toEqual([])
      if (h.id === 'hear1000') expect(built.filter((b) => b.kind === 'keypad' && b.task.maxDigits < 5).map((b) => b.fact.id)).toEqual([])
    })

    it('speaks every task and hint with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
      const tags = tagsToHint(def, canon)
      expect(first([...taskSpeechProblems(built), ...numberWordProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags))])).toEqual([])
    })
  })
}

// ─── order100, order1000 ────────────────────────────────────────────────────

const ORDER = [
  { id: 'order100', parse: parseOrder100, shape: /^o100:[A-Za-z]+\d*(:(after|before))?(:\d+)+$/, top: 100, families: 7 },
  { id: 'order1000', parse: parseOrder1000, shape: /^o1000:[A-Za-z]+\d*(:(plus|minus)(1|10))?(:\d+)+$/, top: 1000, families: 9 },
] as const

for (const o of ORDER) {
  describe(`${o.id} oracle`, () => {
    const def = registeredSkill(o.id)
    const { canon, instances, all, built } = sweep(def)
    const q = (f: Fact): OrderQ => o.parse(f.id)!
    const oracle = (id: string) => {
      const p = o.parse(id)
      return p ? { family: p.family, answer: orderAnswer(p) } : null
    }

    it('has the families of pædagogik §1.3, ids naming one instance, and answers worked out from the id', () => {
      expect(def.families.length).toBe(o.families)
      expect(first([...idProblems(def, all, o.shape, oracle), ...avoidProblems(def, instances)])).toEqual([])
    })

    it('answers every task as the child works it out from what is said and shown', () => {
      const problems: string[] = []
      for (const { fact, kind, task } of built) {
        const where = `${fact.id} ${kind}`
        const text = spokenText(task.speech)
        const qq = q(fact)
        if (kind === 'sortOrder') {
          const cards = numberCards(task)
          const want = sortFromSpeech(text, cards)
          if (!want || task.answer !== want.join('|')) problems.push(`${where}: "${text}" → ${String(want)}, task ${String(task.answer)}`)
          const cells = rowCells(task.prompt)
          // four stones to fill; a start stone, when shown, is the number said
          if (task.options.length !== 4 || !cells || cells.filter((c) => c === null).length !== 4) problems.push(`${where}: ${task.options.length} cards on ${JSON.stringify(cells)}`)
          const said = numbersIn(text)
          if (cells && cells.length === 5 && cells[0] !== said[0]) problems.push(`${where}: start stone ${String(cells[0])} for "${text}"`)
          // the sorting is about this instance: its answer, or its numbers, are among the cards
          const about = qq.nums ?? [orderAnswer(qq)]
          if (!about.every((v) => cards.includes(v))) problems.push(`${where}: cards [${cards}] leave out ${about}`)
          if (cards.some((c) => c < 0 || c > o.top)) problems.push(`${where}: cards [${cards}] outside 0–${o.top}`)
          continue
        }
        if (qq.family === 'biggerMixed' && kind === 'choice') {
          const [x, y] = qq.nums!
          if (task.answer !== signToken(x, y) || signFromSpeech(text) !== task.answer) problems.push(`${where}: "${text}" → ${signFromSpeech(text)}, task ${String(task.answer)}`)
          const p = task.prompt
          const shown = p.scene === 'equation' ? p.terms.map((t) => ('n' in t ? t.n : 'blank' in t ? '□' : '?')) : null
          if (JSON.stringify(shown) !== JSON.stringify([x, '□', y])) problems.push(`${where}: ${JSON.stringify(p)}`)
          continue
        }
        const want = orderAnswer(qq)
        const heard = orderAnswerFromSpeech(text, numberCards(task))
        if (task.answer !== want || heard !== want) problems.push(`${where}: "${text}" → ${String(heard)}, oracle ${want}, task ${String(task.answer)}`)
        const p = task.prompt
        if (qq.nums) {
          // the biggest of numbers that are all shown: the cards carry them (the board lights them), or the stones hold them
          if (kind === 'choice') {
            if (!qq.nums.every((v) => numberCards(task).includes(v))) problems.push(`${where}: cards [${task.options}] leave out ${qq.nums}`)
            if (p.scene === 'board' && [...p.highlight].sort().join() !== numberCards(task).sort().join()) problems.push(`${where}: board ${p.highlight} for cards ${task.options}`)
          } else if (JSON.stringify(rowCells(p)) !== JSON.stringify(qq.nums)) problems.push(`${where}: stones ${JSON.stringify(p)}`)
        } else if (p.scene === 'board') {
          if (!p.highlight.includes(qq.n!) || p.blank !== want) problems.push(`${where}: board ${JSON.stringify(p)}`)
        } else {
          const wantCells = qq.step! > 0 ? [qq.n, null] : [null, qq.n]
          if (JSON.stringify(rowCells(p)) !== JSON.stringify(wantCells)) problems.push(`${where}: stones ${JSON.stringify(p)}`)
        }
      }
      expect(first(problems)).toEqual([])
    })

    it('deals valid cards, valid sortOrder cards, and keeps every answer right', () => {
      const problems = built.flatMap((b) => [...cardProblems(b.task, (c) => c <= o.top), ...optionProblems(b.task), ...answerProblems2(b.task)])
      expect(first(problems)).toEqual([])
    })

    const explain = (b: Built, v: number | string) => explainOrder(q(b.fact), b.task, v)
    const classified = classifyProblems2(built.filter((b) => b.kind !== 'sortOrder'), explain, { upTo: o.top })
    /** The one documented generator bug below: ±1 typed as ±10 (the wrong place) read as a digit swap. */
    const wrongPlaceSwap = (p: string) => /^o1000:(plus1|minus1):\d+ keypad typed \d+ \(answer \d+\): digitSwap, expected a plain tag$/.test(p)

    it('classifies wrong numbers: the given numbers, near misses, a typed reversal; biggerMixed’s 69 is ambiguous (A9)', () => {
      expect(first(classified.filter((p) => !wrongPlaceSwap(p)))).toEqual([])
    })

    if (o.id === 'order1000') {
      // GENERATOR BUG (order1000.ts, candidates() for plus1/minus1): the wrong place — ten more or less
      // instead of one, which order100 lists as 'near' (n + 10) and order1000 lists for its ±10 and ±100
      // families — is missing for ±1 (it lists the answer ± 10 instead). When the answer's ones digit is
      // one more (plus1) or one less (minus1) than its tens digit, n ± 10 is also the answer with tens and
      // ones swapped, so the global check reads it as digitSwap evidence: "Hvilket tal kommer efter syv
      // hundrede og otteogfirs?" (o1000:plus1:788, answer 789) typed 798 → 'digitSwap'; o1000:minus1:755
      // typed 745 → 'digitSwap'. Expected a plain tag ('near'/'other'), as for the same slip elsewhere.
      it.fails('±1 typed as ±10 (the wrong place) is never read as a digit swap', () => {
        expect(first(classified.filter(wrongPlaceSwap))).toEqual([])
      })
    }

    it('takes only the asked order as right; the first-digit order of biggerMixed is firstDigitCompare, others plain', () => {
      const problems: string[] = []
      for (const { fact, task } of built) {
        if (task.kind !== 'sortOrder') continue
        const cards = numberCards(task)
        const firstDigit = q(fact).family === 'biggerMixed' ? byFirstDigit(cards).join('|') : null
        for (const order of orderings(cards)) {
          const given = order.join('|')
          if (given === task.answer) continue
          const got = classifyAnswer(task, given)
          const ok = given === firstDigit ? got === 'firstDigitCompare' : got !== null && ['near', 'other', 'operand'].includes(got)
          if (!ok) problems.push(`${fact.id} sortOrder ${given}: ${String(got)}, expected ${given === firstDigit ? 'firstDigitCompare' : 'a plain tag'}`)
        }
      }
      expect(first(problems)).toEqual([])
      // the order by first digit is always another order than the right one, so it can be seen
      const mixed = built.filter((b) => b.kind === 'sortOrder' && q(b.fact).family === 'biggerMixed')
      expect(mixed.filter((b) => byFirstDigit(numberCards(b.task)).join('|') === b.task.answer).map((b) => b.fact.id)).toEqual([])
    })

    it('reads sign cards aloud (relation view) and offers the first-digit sign as the diagnostic card', () => {
      const signs = built.filter((b) => b.kind === 'choice' && q(b.fact).family === 'biggerMixed')
      const problems: string[] = []
      for (const { fact, task } of signs) {
        if (task.optionView !== 'relation' || !task.optionClips) problems.push(`${fact.id}: ${task.optionView} cards without clips`)
        const [x, y] = q(fact).nums!
        const firstDigit = signToken(Number(String(x)[0]), Number(String(y)[0]))
        if (!task.options.includes(firstDigit) || classifyAnswer(task, firstDigit) !== 'firstDigitCompare') problems.push(`${fact.id}: [${task.options}]`)
        // each card says its own sign (SPEC §10.1 Regnetegn: mindre end, større end, er lig med)
        const SAID: Record<string, string> = { 'cmp:<': 'mindre end', 'cmp:>': 'større end', 'cmp:=': 'er lig med' }
        task.options.forEach((o, i) => {
          const said = spokenText([{ clip: task.optionClips?.[i] ?? '' }]).toLowerCase().replace(/[.,?!]/g, '').trim()
          if (said !== SAID[String(o)]) problems.push(`${fact.id}: card ${String(o)} says "${said}"`)
        })
      }
      expect(signs.length > 0).toBe(o.id === 'order1000')
      expect(first(problems)).toEqual([])
    })

    it('has SPEC’s production kinds and ceilings; a keypad question naming its numbers is a 1-in-2 or 1-in-3 guess', () => {
      expect(first([...productionProblems2(built), ...specKindProblems2(def, built)])).toEqual([])
    })

    it('speaks every task and hint with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
      const tags = tagsToHint(def, canon)
      expect(first([...taskSpeechProblems(built), ...numberWordProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags))])).toEqual([])
    })
  })
}

// ─── numberLine100, numberLine1000 ──────────────────────────────────────────

const LINES = [
  { id: 'numberLine100', parse: parseLine100, shape: /^nl100:[A-Za-z]+:\d+$/, top: 100, families: 3 },
  { id: 'numberLine1000', parse: parseLine1000, shape: /^nl1000:[A-Za-z0-9]+:\d+$/, top: 1000, families: 4 },
] as const

for (const l of LINES) {
  describe(`${l.id} oracle`, () => {
    const def = registeredSkill(l.id)
    const { canon, instances, all, built } = sweep(def)
    const q = (f: Fact): LineQ => l.parse(f.id)!
    const oracle = (id: string) => {
      const p = l.parse(id)
      return p ? { family: p.family, answer: p.answer } : null
    }

    it('has the families of pædagogik §1.3 and answers worked out from the id (five rounds up)', () => {
      expect(def.families.length).toBe(l.families)
      expect(first([...idProblems(def, all, l.shape, oracle), ...avoidProblems(def, instances)])).toEqual([])
    })

    it('answers every task as the child works it out, on a line that holds the answer', () => {
      const problems: string[] = []
      for (const { fact, kind, task } of built) {
        const where = `${fact.id} ${kind}`
        const want = q(fact).answer
        const text = spokenText(task.speech)
        const seen = lineAnswerFromTask(task)
        if (task.answer !== want || seen !== want) problems.push(`${where}: "${text}" → ${String(seen)}, oracle ${want}, task ${String(task.answer)}`)
        if (kind !== 'choice') {
          const [lo, hi] = lineOf(task)
          if (want < lo || want > hi || lo < 0 || hi > l.top) problems.push(`${where}: line ${lo}–${hi} for ${want}`)
          const p = task.prompt
          if (p.scene === 'line' && p.arrowAt !== undefined && (p.arrowAt < lo || p.arrowAt > hi)) problems.push(`${where}: arrow at ${p.arrowAt} off the line`)
        } else if (text.startsWith('Hvilket tal ligger mellem ')) {
          // "mellem A og B": only the answer lies between the two — no wrong card in that stretch
          // ("midt mellem" has one middle, so its near cards may lie inside)
          const [a, b] = numbersIn(text)
          const inside = numberCards(task).filter((c) => c > a && c < b)
          if (inside.length !== 1) problems.push(`${where}: cards [${task.options}] inside ${a}–${b}: [${inside}]`)
        }
      }
      expect(first(problems)).toEqual([])
    })

    it('places with SPEC’s tolerance (±5 on 0–100, ±50 on 0–1000); an asked tick or rounding reaches no other tick', () => {
      const problems: string[] = []
      for (const { fact, task } of built) {
        if (task.kind !== 'numberline') continue
        const qq = q(fact)
        if (qq.family.startsWith('place') && task.tolerance !== (qq.step === 10 ? 5 : 50)) problems.push(`${fact.id}: tolerance ${task.tolerance}`)
        if (qq.family === 'readArrow' && 2 * task.tolerance >= 5) problems.push(`${fact.id}: tolerance ${task.tolerance} reaches the next tick`)
        if (qq.family.startsWith('round') && 2 * task.tolerance >= qq.step) problems.push(`${fact.id}: tolerance ${task.tolerance} reaches the next ${qq.step}`)
      }
      expect(first(problems)).toEqual([])
    })

    it('deals valid cards (0–top) and keeps every answer right', () => {
      const problems = built.flatMap((b) => [...cardProblems(b.task, (c) => c <= l.top), ...answerProblems2(b.task)])
      expect(first(problems)).toEqual([])
    })

    it('classifies cards, typed and placed numbers as the oracle explains them (no misconception on the line)', () => {
      const explain = (b: Built, v: number | string) => explainLine(q(b.fact), b.task, v)
      const rightAt = (b: Built, v: number) => Math.abs(v - q(b.fact).answer) <= b.task.tolerance
      expect(first(classifyProblems2(built, explain, { upTo: l.top, rightAt }))).toEqual([])
    })

    if (l.id === 'numberLine1000') {
      // Rettet (GENFIX). Was a generator bug (numberLine1000.ts, tolerance() for round10/round100 on the
      // numberline): the needle put on the number itself counted as the rounded answer. "Sæt nålen ved
      // den tier, der ligger tættest på fire hundrede og treogtres" (nl1000:round10:463, answer 460, ±4)
      // took 463 as right — as did every round10 instance whose ones digit is not 5 — and round100 took
      // 320 for 300 (±25). Not rounding at all then counted as production evidence toward box 4–5.
      it('rounding on the line: the unrounded number itself is never right', () => {
        const problems = built
          .filter((b) => b.kind === 'numberline' && q(b.fact).family.startsWith('round') && isCorrect(b.task, q(b.fact).n))
          .map((b) => `${b.fact.id}: ${q(b.fact).n} is right (answer ${String(b.task.answer)}, ±${b.task.tolerance})`)
        expect(first(problems)).toEqual([])
      })
    }

    it('has SPEC’s production kinds and ceilings (numberline and keypad box 5, cards box 3)', () => {
      expect(first([...productionProblems2(built), ...specKindProblems2(def, built)])).toEqual([])
    })

    it('speaks every task and hint with recorded clips, no digits, and numbers as SPEC §10.1 says them', () => {
      const tags = tagsToHint(def, canon)
      expect(first([...taskSpeechProblems(built), ...numberWordProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags))])).toEqual([])
    })
  })
}
