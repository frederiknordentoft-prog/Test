// Oracle tests for count10, count20, hear20 and order20 (SPEC §15.1), plus the fact-id check across
// every registered skill. The right answers come from number.oracle.ts — the id, the picture and
// the spoken question — and are compared with the tasks the real task builder deals.
import { describe, expect, it } from 'vitest'
import { registeredSkills } from '../../registry'
import { masteryKeyOf } from '../../tasks'
import { ceilingFor } from '../../kinds'
import { hashSeed, makeRng } from '../../rng'
import { THING_IDS } from '../../../art/materials/Things'
import type { Fact } from '../../types'
import {
  answerProblems, cardProblems, classificationProblems, countOutSentence, diagnosticProblems, explainCount, explainHeard,
  explainOrder20, first, globalIdProblems, heardNumber, hintProblems, howManyQuestion, idNumber, instancesOf, optionProblems,
  orderings, order20Answer, order20FromSpeech, order20Numbers, order20SortFromSpeech, productionProblems, registeredSkill as skill,
  reversed, rowNumbers, sceneOf, specKindProblems, specTag, spokenNumbers, spokenText, tagProblem, tagsToHint,
  taskSpeechProblems, tasksOf, type Built,
} from './number.oracle'

// ─── count10 ────────────────────────────────────────────────────────────────

describe('count10 oracle', () => {
  const def = skill('count10')
  const facts = def.enumerate()
  const built = tasksOf(def, facts, 8)

  it('has SPEC §2.2’s 28 facts: 1–10 spread out, 1–6 flashed on a die, fingers and a ten-frame', () => {
    const shown = facts.map((f) => {
      const p = sceneOf(def.prompt(f, 'choice', makeRng(1)), 'objects')
      return `${p.layout}:${p.n}`
    })
    const want = [
      ...Array.from({ length: 10 }, (_, i) => `scatter:${i + 1}`),
      ...['dice', 'fingers', 'tenframe'].flatMap((l) => Array.from({ length: 6 }, (_, i) => `${l}:${i + 1}`)),
    ]
    expect(shown.sort()).toEqual(want.sort())
    expect(new Set(facts.map((f) => f.id)).size).toBe(28)
    for (const f of facts) {
      expect(f.id, f.id).toMatch(/^c10:[a-z]+:\d+$/)
      expect(f.answer, f.id).toBe(idNumber(f.id))
      expect(masteryKeyOf(def, f)).toBe(f.id)
    }
  })

  it('asks for the number in the id: the picture shows it, the question fits the picture, the basket target is said', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const n = idNumber(fact.id)
      const where = `${fact.id} ${kind}`
      if (task.answer !== n) problems.push(`${where}: answer ${String(task.answer)}, oracle ${n}`)
      const p = sceneOf(task.prompt, 'objects')
      const text = spokenText(task.speech)
      if (kind === 'countTap') {
        // the pile to take from is always bigger than ten, so "all of them" is never the answer
        if (p.n <= 10 || p.n <= n) problems.push(`${where}: pile of ${p.n} for a target of ${n}`)
        if (!(THING_IDS as readonly string[]).includes(p.thing)) problems.push(`${where}: ${p.thing} cannot be drawn`)
        if (text !== countOutSentence(n, p.thing)) problems.push(`${where}: "${text}", expected "${countOutSentence(n, p.thing)}"`)
        continue
      }
      const layout = fact.id.split(':')[1]
      if (p.n !== n || p.layout !== layout) problems.push(`${where}: picture ${p.layout} ${p.n}`)
      // SPEC §2.2: 1–6 on a die, fingers and a ten-frame are flashed for 1,5 s; spread things stay
      const flash = layout !== 'scatter'
      if (flash !== (p.flashMs === 1500) || (!flash && p.flashMs !== undefined)) problems.push(`${where}: flashMs ${String(p.flashMs)}`)
      if (layout === 'scatter' && !(THING_IDS as readonly string[]).includes(p.thing)) problems.push(`${where}: ${p.thing} cannot be drawn`)
      if (text !== howManyQuestion(p)) problems.push(`${where}: "${text}", expected "${howManyQuestion(p)}"`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards (0–10) and keeps every task’s own answer right', () => {
    const problems = built.flatMap((b) => [...cardProblems(b.task, (c) => c <= 10), ...answerProblems(b.task)])
    expect(first(problems)).toEqual([])
  })

  it('classifies cards, typed counts and baskets as the oracle explains them (near misses only)', () => {
    const explain = (b: Built, v: number) => explainCount('count10', b.task, v, idNumber(b.fact.id))
    expect(first(classificationProblems(built, explain))).toEqual([])
  })

  it('has SPEC’s production kinds and ceilings (countTap and keypad: box 5, cards: box 3)', () => {
    expect(first([...productionProblems(built), ...specKindProblems(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    const tags = tagsToHint(def, facts)
    expect(first([...taskSpeechProblems(built), ...facts.flatMap((f) => hintProblems(def, f, tags))])).toEqual([])
  })
})

// ─── count20 ────────────────────────────────────────────────────────────────

describe('count20 oracle', () => {
  const def = skill('count20')
  const facts = def.enumerate()
  const built = tasksOf(def, facts, 8)

  it('has SPEC §2.2’s 20 facts: 11–20 in two ten-frames and 11–20 loose', () => {
    const shown = facts.map((f) => {
      const p = sceneOf(def.prompt(f, 'choice', makeRng(1)), 'objects')
      return `${p.layout === 'tenframe' ? 'tenframe' : 'loose'}:${p.n}`
    })
    const want = ['tenframe', 'loose'].flatMap((l) => Array.from({ length: 10 }, (_, i) => `${l}:${i + 11}`))
    expect(shown.sort()).toEqual(want.sort())
    expect(new Set(facts.map((f) => f.id)).size).toBe(20)
    for (const f of facts) {
      expect(f.id, f.id).toMatch(/^c20:[a-z]+:\d+$/)
      expect(f.answer, f.id).toBe(idNumber(f.id))
    }
  })

  it('asks for the number in the id: the picture shows it, the question fits, the basket target is said', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const n = idNumber(fact.id)
      const where = `${fact.id} ${kind}`
      if (task.answer !== n) problems.push(`${where}: answer ${String(task.answer)}, oracle ${n}`)
      const p = sceneOf(task.prompt, 'objects')
      const text = spokenText(task.speech)
      if (kind === 'countTap') {
        if (p.n <= 20 || p.n <= n) problems.push(`${where}: pile of ${p.n} for a target of ${n}`)
        if (!(THING_IDS as readonly string[]).includes(p.thing)) problems.push(`${where}: ${p.thing} cannot be drawn`)
        if (text !== countOutSentence(n, p.thing)) problems.push(`${where}: "${text}", expected "${countOutSentence(n, p.thing)}"`)
        continue
      }
      // nothing flashes in count20: counting on from the ten needs time
      if (p.n !== n || p.flashMs !== undefined) problems.push(`${where}: picture ${p.layout} ${p.n} flash ${String(p.flashMs)}`)
      if (fact.family === 'tenframe' ? p.layout !== 'tenframe' : p.layout !== 'scatter') problems.push(`${where}: ${fact.family} drawn as ${p.layout}`)
      if (text !== howManyQuestion(p)) problems.push(`${where}: "${text}", expected "${howManyQuestion(p)}"`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards (0–20) and keeps every task’s own answer right', () => {
    const problems = built.flatMap((b) => [...cardProblems(b.task, (c) => c <= 20), ...answerProblems(b.task)])
    expect(first(problems)).toEqual([])
  })

  it('classifies as the oracle explains: near misses and the forgotten ten; a typed 41 for 14 is digitSwap', () => {
    const explain = (b: Built, v: number) => explainCount('count20', b.task, v, idNumber(b.fact.id))
    expect(first(classificationProblems(built, explain))).toEqual([])
    // the slip the engine adds on top of the skill's list (SPEC §4.1 globalChecks)
    const typed = built.find((b) => b.fact.id === 'c20:tenframe:14' && b.kind === 'keypad')!
    expect(tagProblem(typed.task, 41, explainCount('count20', typed.task, 41, 14), false)).toBeNull()
    expect(specTag(explainCount('count20', typed.task, 41, 14))).toBe('digitSwap')
  })

  it('has SPEC’s production kinds and ceilings', () => {
    expect(first([...productionProblems(built), ...specKindProblems(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    const tags = tagsToHint(def, facts)
    expect(first([...taskSpeechProblems(built), ...facts.flatMap((f) => hintProblems(def, f, tags))])).toEqual([])
  })
})

// ─── hear20 ─────────────────────────────────────────────────────────────────

describe('hear20 oracle', () => {
  const def = skill('hear20')
  const facts = def.enumerate()
  const built = tasksOf(def, facts, 8)

  it('has SPEC §2.2’s 21 facts, 0–20, with 11–19 ranked last', () => {
    expect(facts.map((f) => idNumber(f.id)).sort((a, b) => a - b)).toEqual(Array.from({ length: 21 }, (_, i) => i))
    for (const f of facts) {
      expect(f.id, f.id).toMatch(/^h20:\d+$/)
      expect(f.answer).toBe(idNumber(f.id))
      // the metadata's families: "Tal 0–10" and "Tal 11–20"
      expect(f.family, f.id).toBe(idNumber(f.id) <= 10 ? 'small' : 'teens')
    }
    const rank = (n: number) => facts.find((f) => idNumber(f.id) === n)!.rank
    const teens = Array.from({ length: 9 }, (_, i) => rank(11 + i))
    const others = [...Array.from({ length: 11 }, (_, i) => rank(i)), rank(20)]
    expect(Math.min(...teens)).toBeGreaterThan(Math.max(...others))
  })

  it('only says the number (nothing on screen shows it), and asks for what it said', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const text = spokenText(task.speech)
      if (task.prompt.scene !== 'hear') problems.push(`${where}: the ${task.prompt.scene} scene can show the number`)
      if (heardNumber(text) !== idNumber(fact.id) || task.answer !== idNumber(fact.id)) problems.push(`${where}: "${text}" for answer ${String(task.answer)}`)
      if (!text.startsWith(kind === 'keypad' ? 'Skriv tallet ' : 'Find tallet ')) problems.push(`${where}: "${text}"`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards with the reversed teen as the diagnostic card for 13–19, and keeps every answer right', () => {
    const problems = built.flatMap((b) => [...cardProblems(b.task), ...answerProblems(b.task)])
    expect(first(problems)).toEqual([])
    const explain = (b: Built, v: number) => explainHeard(v, idNumber(b.fact.id))
    expect(first(diagnosticProblems(built, explain))).toEqual([])
    for (let n = 13; n <= 19; n++) {
      const cards = built.filter((b) => idNumber(b.fact.id) === n && b.kind === 'choice')
      expect(cards.every((b) => b.task.options.includes(reversed(n)!)), `h20:${n}`).toBe(true)
    }
  })

  // GENERATOR BUG (hear20.ts, range()): the card range 0–99 that lets the reversed teen through
  // (19 → 91) also lets the near miss n + 2 through, so "Find tallet nitten" can deal 21 — a number
  // outside the skill's 0–20. Expected: cards ≤ 20 except the reversed number.
  it('never deals a card above 20 except the reversed teen', () => {
    const problems = built.flatMap((b) => cardProblems(b.task, (c) => c <= 20 || c === reversed(idNumber(b.fact.id))))
    expect(first(problems)).toEqual([])
  })

  it('classifies a reversed number as digitSwap (a concept here) and the rest as near or other', () => {
    const explain = (b: Built, v: number) => explainHeard(v, idNumber(b.fact.id))
    expect(first(classificationProblems(built, explain))).toEqual([])
  })

  it('has SPEC’s production kinds and ceilings', () => {
    expect(first([...productionProblems(built), ...specKindProblems(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    const tags = tagsToHint(def, facts)
    expect(first([...taskSpeechProblems(built), ...facts.flatMap((f) => hintProblems(def, f, tags))])).toEqual([])
  })
})

// ─── order20 ────────────────────────────────────────────────────────────────

describe('order20 oracle', () => {
  const def = skill('order20')
  const canon = def.enumerate()
  const instances = instancesOf(def, 200)
  const all: Fact[] = [...canon, ...[...instances.values()].flat()]
  const built = [...tasksOf(def, canon, 4), ...tasksOf(def, [...instances.values()].flat(), 1)]

  /** The instances SPEC §2.2 and pædagogik §1.3 describe, per family. */
  const valid = (f: Fact): boolean => {
    const n = f.id.split(':').slice(2).map(Number)
    switch (f.family) {
      case 'after':
        return n.length === 1 && n[0] >= 0 && n[0] <= 19
      case 'before':
        return n.length === 1 && n[0] >= 1 && n[0] <= 20
      case 'between':
        return n.length === 2 && n[0] >= 0 && n[1] === n[0] + 2 && n[1] <= 20
      case 'bigger':
        return n.length === 2 && n.every((v) => v >= 0 && v <= 20) && Math.abs(n[0] - n[1]) >= 1 && Math.abs(n[0] - n[1]) <= 3
      default:
        return false
    }
  }

  it('has the four families with every possible after, before and between, and 20 bigger pairs', () => {
    const count = (fam: string) => canon.filter((f) => f.family === fam).length
    expect({ after: count('after'), before: count('before'), between: count('between'), bigger: count('bigger') })
      .toEqual({ after: 20, before: 20, between: 19, bigger: 20 })
    expect(new Set(canon.map((f) => f.id)).size).toBe(canon.length)
  })

  it('draws 200 seeded instances per family inside the family, each id meaning one instance', () => {
    const problems: string[] = []
    const meaning = new Map<string, string>()
    for (const f of all) {
      if (f.id.split(':')[1] !== f.family || !valid(f)) problems.push(`${f.family}: ${f.id} is not an instance of the family`)
      if (f.answer !== order20Answer(f.id)) problems.push(`${f.id}: answer ${String(f.answer)}, oracle ${order20Answer(f.id)}`)
      const key = JSON.stringify([f.family, f.operands, f.answer, f.data ?? null])
      if ((meaning.get(f.id) ?? key) !== key) problems.push(`${f.id}: two different instances share the id`)
      meaning.set(f.id, key)
      if (masteryKeyOf(def, f) !== `order20/${f.family}`) problems.push(`${f.id}: mastery key ${masteryKeyOf(def, f)}`)
    }
    expect(first(problems)).toEqual([])
    // the seeded draws reach every after/before/between instance and well over half of the 112 bigger pairs
    const distinct = (fam: string) => new Set(instances.get(fam)!.map((f) => f.id)).size
    expect([distinct('after'), distinct('before'), distinct('between')]).toEqual([20, 20, 19])
    expect(distinct('bigger')).toBeGreaterThan(56)
  })

  it('avoids the instances it is told to avoid', () => {
    for (const fam of def.families) {
      const pool = [...new Set(instances.get(fam.id)!.map((f) => f.id))]
      const avoid = new Set(pool.slice(0, Math.floor(pool.length / 2)))
      const rng = makeRng(hashSeed(`oracle-avoid:${fam.id}`))
      for (let i = 0; i < 50; i++) expect(avoid.has(def.instance!(fam, rng, avoid).id), fam.id).toBe(false)
    }
  })

  it('answers every task as the child works it out from what is said and shown', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const text = spokenText(task.speech)
      if (kind === 'sortOrder') {
        const row = sceneOf(task.prompt, 'row')
        const want = order20SortFromSpeech(text, row.cells, task.options)
        if (!want || task.answer !== want.join('|')) problems.push(`${where}: "${text}" on [${row.cells}] → ${String(want)}, task ${String(task.answer)}`)
        // four cards onto four stones: a real ordering task for the same instance
        if (task.options.length !== 4 || row.cells.filter((c) => c === null).length !== 4) problems.push(`${where}: ${task.options.length} cards`)
        const order = String(task.answer).split('|').map(Number)
        const about = fact.family === 'bigger' ? fact.operands : [order20Answer(fact.id)]
        if (!about.every((v) => order.includes(v))) problems.push(`${where}: ${String(task.answer)} leaves out ${about}`)
        continue
      }
      const want = order20Answer(fact.id)
      const heard = order20FromSpeech(text, task.options)
      if (task.answer !== want || heard !== want) problems.push(`${where}: "${text}" → ${String(heard)}, oracle ${want}, task ${String(task.answer)}`)
      const x = fact.operands[0]
      const y = fact.operands[1]
      const cells = task.prompt.scene === 'row' ? task.prompt.cells : null
      const stones: Record<string, unknown[]> = { after: [x, null], before: [null, x], between: [x, null, y], bigger: [x, y] }
      if (kind === 'numberline' || (fact.family === 'bigger' && kind === 'choice')) {
        const line = sceneOf(task.prompt, 'line')
        if (line.min !== 0 || ![10, 20].includes(line.max) || Math.max(...order20Numbers(fact.id)) > line.max) problems.push(`${where}: line ${line.min}–${line.max}`)
      } else if (JSON.stringify(cells) !== JSON.stringify(stones[fact.family])) {
        problems.push(`${where}: stones ${JSON.stringify(cells)}`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('keeps every shown number within 0–10 when the instance is (Tællelunden’s max 10)', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      if (Math.max(...order20Numbers(fact.id)) > 10) continue
      const shown = [...task.options.filter((o): o is number => typeof o === 'number'), ...rowNumbers(task.prompt)]
      if (task.prompt.scene === 'line') shown.push(task.prompt.max)
      if (Math.max(...shown) > 10) problems.push(`${fact.id} ${kind}: shows ${Math.max(...shown)}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards (0–20) and valid sortOrder cards, and keeps every answer right', () => {
    const problems = built.flatMap((b) => [...cardProblems(b.task, (c) => c <= 20), ...optionProblems(b.task), ...answerProblems(b.task)])
    expect(first(problems)).toEqual([])
  })

  it('classifies wrong numbers as the oracle explains them (the given numbers, near misses, a typed reversal)', () => {
    const explain = (b: Built, v: number) => explainOrder20(b.fact.id, b.task, v)
    expect(first(classificationProblems(built.filter((b) => b.kind !== 'sortOrder'), explain))).toEqual([])
  })

  it('takes only the asked order as right: every other order of the four cards is a plain error', () => {
    const problems: string[] = []
    for (const { task } of built) {
      if (task.kind !== 'sortOrder') continue
      for (const order of orderings(task.options.map(String))) {
        const given = order.join('|')
        if (given === task.answer) continue
        const p = tagProblem(task, given, { mis: [] }, true)
        if (p) problems.push(p)
      }
    }
    expect(first(problems)).toEqual([])
  })

  // SPEC §3.3 IN SPIRIT (order20.ts, family 'bigger' on keypad and number line): "Hvilket tal er
  // størst, seks eller otte?" names both candidates, so typing or tapping one of them is right half
  // the time — the generator's own header calls it a coin flip — yet by SPEC §3.2's formula (1/range)
  // it counts as production, ceiling box 5. pickKind asks sortOrder first from box 3, but a repeat slot
  // (roundBuilder kindFor) can pick keypad or numberline, so order20/bigger can reach box 4–5 on guesses.
  it('never lets a coin flip count as production (keypad and number-line "bigger" name both numbers)', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      if (kind !== 'keypad' && kind !== 'numberline') continue
      const named = spokenNumbers(spokenText(task.speech))
      if (named.length < 2 || !named.includes(task.answer as number)) continue
      // a guess among the numbers the question names: 1 in named.length
      const ceiling = 1 / named.length >= 0.5 ? 2 : 3
      if (ceilingFor(task) > ceiling) problems.push(`${fact.id} ${kind}: ceiling ${ceilingFor(task)} for a 1-in-${named.length} guess`)
    }
    expect(first(problems)).toEqual([])
  })

  it('makes the 0–10 and 0–20 lines exact, and has SPEC’s production kinds and ceilings', () => {
    const lines = built.filter((b) => b.kind === 'numberline')
    expect(lines.filter((b) => b.task.tolerance !== 0).map((b) => b.fact.id)).toEqual([])
    expect(first([...productionProblems(built), ...specKindProblems(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    const tags = tagsToHint(def, canon)
    expect(first([...taskSpeechProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags))])).toEqual([])
  })
})

// ─── Fact ids across all skills ─────────────────────────────────────────────

describe('fact ids across every registered skill', () => {
  it('are unique, in the CONVENTIONS format, one prefix per skill', () => {
    expect(first(globalIdProblems(registeredSkills()))).toEqual([])
  })

  it('are stable: the same facts every time, and the same instances from the same seed', () => {
    for (const def of registeredSkills()) {
      const facts = (d: typeof def) => d.enumerate().map((f) => `${f.id}=${String(f.answer)}`)
      expect(facts(def), def.id).toEqual(facts(def))
      if (def.mode !== 'procedure') continue
      const drawn = () => [...instancesOf(def, 30).values()].flat().map((f) => f.id)
      expect(drawn(), def.id).toEqual(drawn())
    }
  })

  it('reads Danish number words the way the oracles need them', () => {
    expect(spokenNumbers('Hvad er en plus tolv?')).toEqual([1, 12])
    expect(spokenNumbers('Læg et æble i kurven.')).toEqual([1])
    expect(spokenNumbers('Sæt tallene i rækkefølge. Start med det største.')).toEqual([])
  })
})
