// Oracle tests for the measure skills of 1.–2. klasse (SPEC §15.1): every canonical fact and 200 seeded
// instances per family, every kind, compared with measure2.oracle.ts — the length counted on the row of
// units and read off the ruler, the heaviest thing by what a child knows, the chart read as the question
// asks, the unit a thing is measured in; wrong answers by pædagogik §3.2.
import { describe, expect, it, vi } from 'vitest'
import { isCorrect } from '../../answer'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { registeredSkills } from '../../registry'
import { masteryKeyOf } from '../../tasks'
import { makeRng } from '../../rng'
import type { AnswerValue, Fact, SkillId, Task } from '../../types'
import { setValue } from '../../../ui/task/answers'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PromptScene } from '../../../ui/scenes/PromptScene'
import { clipText } from '../../../speech/catalog'
import {
  answerProblems, cardProblems, first, hintProblems, registeredSkill, spokenText, tagsToHint, taskSpeechProblems, type Built,
} from '../number/number.oracle'
import {
  avoidProblemsB, cardMisconceptions, detectableReachProblems, expectB, instanceIdProblems, normalisationProblems, specificHintProblems,
  prefixProblems, productionProblemsB, specKindProblemsB, sweepB, tagCheck, typedSwap, type WhyB,
} from '../clock/clock.oracle'
import {
  HEAVY_THINGS, THING_UNIT, UNIT_KIND, UNIT_NAME, biggerThanTeddy, chartAnswer, chartAsked, chartFamily, drawnBiggest, explainChart,
  explainLay, explainWeigh, heavierThanTeddy, heaviest, parseChartId, parseLay, parseUnitsRow, rulerMarks, scaleOf,
  thingOfNoun, unitAskedAll, unitQuestion, unitsAsked, weighContrast,
} from './measure2.oracle'

vi.setConfig({ testTimeout: 240_000 })

/** Fact ids: the oracle's reading of the id, one meaning per id, the mastery key of the mode. */
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

/** Classification of every number card and every typed number (0 to what the keys take) against the oracle. */
function numberClassification(built: readonly Built[], explain: (b: Built, v: number) => WhyB): string[] {
  const out: string[] = []
  for (const b of built) {
    const { task } = b
    const values = task.kind === 'choice' ? task.options.map(Number) : task.kind === 'keypad' ? Array.from({ length: 10 ** task.maxDigits }, (_, v) => v) : []
    for (const v of values) {
      if (v === task.answer) continue
      const p = tagCheck(task, v, explain(b, v), task.kind === 'choice' ? 'card' : 'typed')
      if (p) out.push(p)
    }
  }
  return out
}

/** Every non-empty selection of the things, as the multiSelect view hands it in (src/ui/task/answers.ts setValue). */
const selections = (t: Task): string[] =>
  Array.from({ length: 2 ** t.options.length - 1 }, (_, m) => setValue(t.options.filter((_, i) => (m + 1) & (1 << i)), t))

const reach = (t: Task, v: AnswerValue): boolean =>
  t.kind === 'keypad' ? typeof v === 'number' && v < 10 ** t.maxDigits
    : t.kind === 'multiSelect' ? typeof v === 'string' && v.split('|').every((x) => t.options.map(String).includes(x)) : true

const ids = (skill: SkillId) => registeredSkill(skill)

// ─── measureUnits ───────────────────────────────────────────────────────────

describe('measureUnits oracle', () => {
  const def = ids('measureUnits')
  const { canon, instances, all, built } = sweepB(def)
  const row = (f: Fact) => parseUnitsRow(f.id)!

  it('has the families cubes (2–12) and clips (2–10), ids naming the row, the number of units as answer', () => {
    expect(def.families.map((f) => f.id)).toEqual(['cubes', 'clips'])
    expect(first([...idChecks(def, all, (f) => {
      const r = parseUnitsRow(f.id)
      return r ? { family: r.family, answer: r.n } : null
    }), ...prefixProblems(def, all, 'maal'), ...avoidProblemsB(def, instances)])).toEqual([])
    // the strategy picture is the same row of units
    for (const f of all) for (const tag of [null, 'near', 'other'] as const) expect(def.hint(f, tag).visual, f.id).toEqual(def.prompt(f, 'keypad', makeRng(1)))
  })

  it('lies the thing over as many units as the answer, of the unit the question names', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const r = row(fact)
      const p = task.prompt
      const unit = unitsAsked(spokenText(task.speech))
      if (p.scene !== 'unitsRow' || p.length !== task.answer || p.object !== r.thing || p.unit !== unit) problems.push(`${where}: "${spokenText(task.speech)}" over ${JSON.stringify(p)}, answer ${String(task.answer)}`)
      if (unit !== (r.family === 'cubes' ? 'cube' : 'clip')) problems.push(`${where}: asks for ${unit}`)
      if (task.answerType !== 'int') problems.push(`${where}: ${task.answerType}`)
      problems.push(...answerProblems(task), ...cardProblems(task, (c) => c >= 1))
    }
    expect(first(problems)).toEqual([])
  })

  it('draws as many units under the thing as the answer (the scene rendered)', () => {
    const problems: string[] = []
    const seen = new Set<string>()
    for (const { fact, task } of built) {
      if (seen.has(fact.id)) continue
      seen.add(fact.id)
      const html = renderToStaticMarkup(createElement(PromptScene, { prompt: task.prompt, task }))
      const units = (html.match(/<g transform="translate\(-?[\d.]+ 52\) scale\(1\)">/g) ?? []).length
      if (units !== task.answer) problems.push(`${fact.id}: draws ${units} units, answer ${String(task.answer)}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('classifies every card and typed number as a plain error (SPEC §4.2 has no misconception for measuring with units)', () => {
    expect(first(numberClassification(built, (b, v) => ({ mis: [], swap: typedSwap(b.task, v, []) })))).toEqual([])
  })

  it('has SPEC’s production kind (keypad 0–15: 1 in 16) and ceilings (three cards: box 3)', () => {
    expect(first([...productionProblemsB(built), ...specKindProblemsB(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    const tags = tagsToHint(def, canon)
    expect(first([...taskSpeechProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, canon), ...normalisationProblems(def, built, canon, tags)])).toEqual([])
  })
})

// ─── rulerRead ──────────────────────────────────────────────────────────────

describe('rulerRead oracle', () => {
  const def = ids('rulerRead')
  const { canon, instances, all, built } = sweepB(def)
  const lay = (f: Fact) => parseLay(f.id)!
  const explain = (b: Built, v: number) => explainLay(lay(b.fact), b.task, v)

  it('has the families from0 and offset (2. kl.), ids naming where the thing lies, its length as answer', () => {
    expect(def.families.map((f) => [f.id, f.grade ?? def.grade])).toEqual([['from0', 1], ['offset', 2]])
    expect(first([...idChecks(def, all, (f) => {
      const l = parseLay(f.id)
      return l ? { family: l.family, answer: l.len } : null
    }), ...prefixProblems(def, all, 'lin'), ...avoidProblemsB(def, instances)])).toEqual([])
  })

  it('counts every centimetre from start to end in the strategy picture; rulerEnd moves the thing to nul', () => {
    const problems: string[] = []
    for (const f of all) {
      const l = lay(f)
      for (const tag of [null, 'rulerEnd', 'operand', 'near', 'other'] as const) {
        const v = def.hint(f, tag).visual
        const where = `${f.id} hint(${String(tag)}): ${JSON.stringify(v)}`
        if (tag === 'rulerEnd') {
          const m = rulerMarks(v as Task['prompt'])
          if (!m || m.start !== 0 || m.end !== l.len) problems.push(where)
        } else if (v.scene !== 'line' || !v.hops || v.hops[0] !== l.start || v.hops[v.hops.length - 1] !== l.start + l.len || v.hops.length !== l.len + 1 || v.max < l.start + l.len) problems.push(where)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('reads the length off the ruler: from the mark where the thing starts to the mark where it ends', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const l = lay(fact)
      const marks = rulerMarks(task.prompt)
      if (!marks || marks.start !== l.start || task.prompt.scene !== 'ruler' || task.prompt.object !== l.thing) problems.push(`${where}: prompt ${JSON.stringify(task.prompt)}`)
      else if (marks.end - marks.start !== task.answer || marks.end > 20) problems.push(`${where}: from ${marks.start} to ${marks.end}, answer ${String(task.answer)}`)
      if (spokenText(task.speech) !== 'Hvor mange centimeter lang er tingen?') problems.push(`${where}: "${spokenText(task.speech)}"`)
      if (kind === 'keypad' && task.unit !== 'cm') problems.push(`${where}: keypad suffix ${task.unit}`)
      problems.push(...answerProblems(task), ...cardProblems(task, (c) => c >= 1 && c <= 20))
    }
    expect(first(problems)).toEqual([])
  })

  it('draws a ruler long enough to read the end mark (the scene rendered)', () => {
    const problems: string[] = []
    const seen = new Set<string>()
    for (const { fact, task } of built) {
      if (seen.has(fact.id)) continue
      seen.add(fact.id)
      const html = renderToStaticMarkup(createElement(PromptScene, { prompt: task.prompt, task }))
      const marks = (html.replace(/<[^>]*>/g, ' ').match(/\d+/g) ?? []).map(Number)
      const l = lay(fact)
      if (!marks.includes(l.start) || !marks.includes(l.start + l.len)) problems.push(`${fact.id}: the ruler shows [${[...new Set(marks)]}]`)
    }
    expect(first(problems)).toEqual([])
  })

  it('classifies cards and typed lengths by pædagogik §3.2: rulerEnd (end mark, marks counted) on offset, A9 on the start mark', () => {
    const known = (b: Built) => (lay(b.fact).family === 'offset' ? [lay(b.fact).start + lay(b.fact).len, lay(b.fact).len + 1] : [])
    const problems = [...numberClassification(built, explain)]
    for (const b of built) {
      if (b.kind !== 'choice') continue
      const real = known(b).filter((v) => {
        const tag = expectB(explain(b, v))
        return v !== b.task.answer && tag === 'rulerEnd'
      })
      if (real.length > 0 && cardMisconceptions(b.task).length === 0) problems.push(`${b.fact.id}: no rulerEnd card among [${b.task.options}]`)
    }
    expect(first(problems)).toEqual([])
    // A9 does happen: start 5, length 4 — four marks plus one is the start mark
    const clash = built.filter((b) => b.kind === 'keypad' && lay(b.fact).family === 'offset' && lay(b.fact).len + 1 === lay(b.fact).start)
    for (const b of clash) expect(classifyAnswer(b.task, lay(b.fact).start), b.fact.id).toBe('ambiguous')
  })

  it('has SPEC’s production kind (keypad 0–20) and ceilings (three cards: box 3)', () => {
    expect(first([...productionProblemsB(built), ...specKindProblemsB(def, built), ...detectableReachProblems(built, reach)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, lengths as SPEC §10.1 says them', () => {
    const tags = tagsToHint(def, canon)
    expect(first([...taskSpeechProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, canon), ...normalisationProblems(def, built, canon, tags)])).toEqual([])
  })
})

// ─── weightCompare ──────────────────────────────────────────────────────────

describe('weightCompare oracle', () => {
  const def = ids('weightCompare')
  const facts = def.enumerate()
  const built = sweepB(def, 8).built

  it('has SPEC §2.2’s 12 facts: six congruent, six conflict (SPEC §4.3: at least six of each)', () => {
    expect(facts.map((f) => f.id).sort()).toEqual(['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map((x) => `vgt:${x}`))
    for (const f of facts) {
      expect(f.family, f.id).toBe(f.id.startsWith('vgt:g') ? 'congruent' : 'conflict')
      expect(masteryKeyOf(def, f), f.id).toBe(f.id)
    }
    expect(prefixProblems(def, facts, 'vgt')).toEqual([])
  })

  it('weighs the things on the pan scale (prompt.weights) as a child knows them: the heavy thing over the rest, heavy over the teddy and light under it', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const p = task.prompt as Task['prompt'] & { weights?: number[] }
      if (p.scene !== 'compareObjects' || !p.weights) continue
      const w = (thing: string) => p.weights![p.objects.indexOf(thing)]
      if (kind === 'multiSelect') {
        for (const o of p.objects.slice(1)) if (HEAVY_THINGS.has(o) !== w(o) > w(p.objects[0])) problems.push(`${fact.id} ${kind}: ${o} weighs ${w(o)} g, the teddy ${w(p.objects[0])} g`)
      } else {
        const heavy = p.objects.find((o) => HEAVY_THINGS.has(o))!
        for (const o of p.objects) if (o !== heavy && w(o) >= w(heavy)) problems.push(`${fact.id} ${kind}: ${o} weighs ${w(o)} g, ${heavy} ${w(heavy)} g`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('answers the heaviest thing (one heavy among light ones) and all things heavier than the teddy, with the contrast the picture has', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const s = scaleOf(task.prompt)
      const multi = kind === 'multiSelect'
      const text = spokenText(task.speech)
      if (!s) {
        problems.push(`${where}: prompt ${task.prompt.scene}`)
        continue
      }
      if (text !== (multi ? 'Tryk på alle de ting, der er tungere end bamsen.' : 'Hvilken ting er tungest?')) problems.push(`${where}: "${text}"`)
      const want = multi ? heavierThanTeddy(s) : heaviest(s)
      if (want === null || want === '' || task.answer !== want) problems.push(`${where}: answer ${String(task.answer)}, oracle ${String(want)} for ${s.objects}`)
      if (multi && (task.options.join() !== s.objects.slice(1).map((_, i) => `o${i}`).join() || s.objects.length !== 7)) problems.push(`${where}: options [${task.options}] for ${s.objects}`)
      if (!multi && (s.objects.length !== 3 || drawnBiggest(s) === null)) problems.push(`${where}: ${s.objects} drawn ${s.sizes}`)
      // perception: on a congruent picture the biggest is the heaviest, on a conflict picture it is not
      const contrast = weighContrast(s, multi)
      if (task.contrast !== contrast || contrast !== fact.family) problems.push(`${where}: contrast ${String(task.contrast)}, the picture is ${contrast}, the family ${fact.family}`)
      if (!detectableOf(task).includes('sizeIsWeight')) problems.push(`${where}: detectable ${detectableOf(task)}`)
      if (!multi) problems.push(...cardProblems(task))
      problems.push(...answerProblems(task))
    }
    expect(first(problems)).toEqual([])
  })

  it('classifies the size answer as sizeIsWeight on conflict pictures (every card, every selection) and nothing else as a misconception', () => {
    const problems: string[] = []
    for (const { kind, task } of built) {
      const s = scaleOf(task.prompt)!
      const multi = kind === 'multiSelect'
      const given = multi ? selections(task) : task.options.map(String)
      for (const g of given) {
        if (isCorrect(task, g)) {
          if (classifyAnswer(task, g) !== null) problems.push(`${task.factId} ${kind} ${g}: right, classified ${classifyAnswer(task, g)}`)
          continue
        }
        const p = tagCheck(task, g, explainWeigh(s, multi, g), multi ? 'set' : 'card')
        if (p) problems.push(p)
      }
      // the conflict card is always dealt: it is what the item is for
      const bySize = multi ? biggerThanTeddy(s) : drawnBiggest(s)
      if (!multi && task.contrast === 'conflict' && !task.options.includes(bySize!)) problems.push(`${task.factId}: no biggest-thing card in [${task.options}]`)
    }
    expect(first(problems)).toEqual([])
  })

  it('has SPEC’s production kind (six things: 1 in 63) and ceilings (three cards: box 3)', () => {
    expect(first([...productionProblemsB(built), ...specKindProblemsB(def, built), ...detectableReachProblems(built, reach)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    const tags = tagsToHint(def, facts)
    expect(first([...taskSpeechProblems(built), ...facts.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, facts)])).toEqual([])
  })
})

// ─── readChart ──────────────────────────────────────────────────────────────

describe('readChart oracle', () => {
  const def = ids('readChart')
  const { canon, instances, all, built } = sweepB(def)
  const valuesOf = (t: Task) => (t.prompt.scene === 'chart' ? t.prompt.data.map((d) => d.n) : [])
  const explain = (b: Built, v: number) => explainChart(valuesOf(b.task), chartAsked(spokenText(b.task.speech))!.q, b.task, v)

  it('has the families readPicto, readBar, mostLeast and difference, ids naming the chart and the question', () => {
    expect(def.families.map((f) => f.id)).toEqual(['readPicto', 'readBar', 'mostLeast', 'difference'])
    expect(first([...idChecks(def, all, (f) => {
      const c = parseChartId(f.id)
      const a = c ? chartAnswer(c.values, c.q) : null
      return c && a !== null ? { family: c.family, answer: a } : null
    }), ...prefixProblems(def, all, 'diag'), ...avoidProblemsB(def, instances)])).toEqual([])
  })

  it('shows the same chart in the strategy picture, or the difference as a hop from the lowest to the highest number', () => {
    const problems: string[] = []
    for (const f of all) {
      const c = parseChartId(f.id)!
      const chart = def.prompt(f, 'keypad', makeRng(1))
      for (const tag of [null, 'operand', 'near', 'wrongOperation'] as const) {
        const v = def.hint(f, tag).visual
        const where = `${f.id} hint(${String(tag)}): ${JSON.stringify(v)}`
        if (c.q === 'diff') {
          if (v.scene !== 'line' || !v.hops || v.hops[0] !== Math.min(...c.values) || v.hops[v.hops.length - 1] !== Math.max(...c.values) || v.max < Math.max(...c.values)) problems.push(where)
        } else if (JSON.stringify(v) !== JSON.stringify(chart)) problems.push(where)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('answers what the question asks of the chart’s own data: a row or bar by place, an extreme, or the difference', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const text = spokenText(task.speech)
      const asked = chartAsked(text)
      const p = task.prompt
      if (!asked || p.scene !== 'chart') {
        problems.push(`${where}: "${text}" over ${p.scene}`)
        continue
      }
      const values = p.data.map((d) => d.n)
      const want = chartAnswer(values, asked.q)
      if (want === null || task.answer !== want) problems.push(`${where}: "${text}" of [${values}] is ${want}, task ${String(task.answer)}`)
      if (p.kind !== asked.chart) problems.push(`${where}: a ${p.kind} chart asked about ${asked.chart === 'picto' ? 'rows of stars' : 'bars'}`)
      if (chartFamily(asked) !== fact.family) problems.push(`${where}: "${text}" is ${chartFamily(asked)}, family ${fact.family}`)
      const c = parseChartId(fact.id)
      if (!c || c.values.join() !== values.join()) problems.push(`${where}: the chart shows [${values}], the id says [${c?.values}]`)
      if (values.length < 3 || values.length > 4 || new Set(values).size !== values.length || values.some((v) => v < 1 || v > 10)) problems.push(`${where}: values [${values}]`)
      if (new Set(p.data.map((d) => d.cat)).size !== values.length) problems.push(`${where}: categories ${p.data.map((d) => d.cat)}`)
      if (typeof asked.q === 'number' && asked.q > values.length) problems.push(`${where}: asks for place ${asked.q} of ${values.length}`)
      problems.push(...answerProblems(task), ...cardProblems(task, (v) => v >= 0 && v <= 20))
    }
    expect(first(problems)).toEqual([])
  })

  it('classifies cards and typed numbers: another row’s number is plain, the added numbers wrongOperation (A9 when the sum is in the chart)', () => {
    const problems = numberClassification(built, explain)
    for (const b of built) {
      if (b.kind !== 'choice') continue
      const values = valuesOf(b.task)
      const asked = chartAsked(spokenText(b.task.speech))!
      if (asked.q !== 'diff') continue
      const sumV = Math.max(...values) + Math.min(...values)
      if (expectB(explain(b, sumV)) === 'wrongOperation' && cardMisconceptions(b.task).length === 0) problems.push(`${b.fact.id}: no wrongOperation card among [${b.task.options}]`)
    }
    expect(first(problems)).toEqual([])
  })

  it('has SPEC’s production kind (keypad 0–20) and ceilings (three cards: box 3)', () => {
    expect(first([...productionProblemsB(built), ...specKindProblemsB(def, built), ...detectableReachProblems(built, reach)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    const tags = tagsToHint(def, canon)
    expect(first([...taskSpeechProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, canon)])).toEqual([])
  })
})

// ─── unitChoice ─────────────────────────────────────────────────────────────

describe('unitChoice oracle', () => {
  const def = ids('unitChoice')
  const facts = def.enumerate()
  const built = sweepB(def, 6).built
  const thingOf = (f: Fact) => f.id.slice(f.id.lastIndexOf(':') + 1)

  it('has SPEC §2.2’s 24 facts: 16 lengths (cm or m) and 8 weights (g or kg, 3. kl.), the unit as answer', () => {
    expect(facts.length).toBe(24)
    expect(def.families.map((f) => [f.id, f.grade ?? def.grade])).toEqual([['length', 2], ['weight', 3]])
    const problems: string[] = []
    for (const f of facts) {
      const m = /^enh:(length|weight):([a-z]+)$/.exec(f.id)
      const u = m ? THING_UNIT[m[2]]?.[0] : undefined
      if (!m || !u || UNIT_KIND[u] !== m[1] || f.family !== m[1] || f.answer !== `unit:${u}`) problems.push(`${f.id}: ${f.family}, ${String(f.answer)}, oracle ${u}`)
      if (masteryKeyOf(def, f) !== f.id) problems.push(`${f.id}: mastery key`)
    }
    expect(facts.filter((f) => f.family === 'length').length).toBe(16)
    problems.push(...prefixProblems(def, facts, 'enh'))
    expect(first(problems)).toEqual([])
  })

  it('asks for the unit of the thing named, and for all things measured in the unit named; the cards are read aloud as what they are', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const text = spokenText(task.speech)
      const thing = thingOf(fact)
      const unit = THING_UNIT[thing][0]
      const said = (i: number) => clipText(task.optionClips?.[i] ?? '').toLowerCase().replace(/[.,]/g, '').trim()
      if (kind === 'choice') {
        const q = unitQuestion(text)
        if (!q || q.thing !== thing || q.kind !== UNIT_KIND[unit]) problems.push(`${where}: "${text}"`)
        if (task.answer !== `unit:${unit}` || task.optionView !== 'unitWord') problems.push(`${where}: answer ${String(task.answer)} (${task.optionView})`)
        problems.push(...cardProblems(task))
        const units = task.options.map((o) => String(o).replace(/^unit:/, ''))
        if (!units.every((u) => u in UNIT_NAME)) problems.push(`${where}: cards [${task.options}]`)
        if (!units.some((u) => u !== unit && UNIT_KIND[u] === UNIT_KIND[unit])) problems.push(`${where}: no card with the other ${UNIT_KIND[unit]} unit in [${task.options}]`)
        units.forEach((u, i) => {
          if (said(i) !== UNIT_NAME[u]) problems.push(`${where}: the ${u} card is read "${said(i)}"`)
        })
      } else {
        const asked = unitAskedAll(text)
        if (asked !== unit) problems.push(`${where}: "${text}" asks for ${asked}, the thing is measured in ${unit}`)
        const things = task.options.map((o) => String(o).replace(/^mt:/, ''))
        const want = task.options.filter((_, i) => THING_UNIT[things[i]]?.[0] === unit).map(String)
        if (!things.every((t) => t in THING_UNIT && UNIT_KIND[THING_UNIT[t][0]] === UNIT_KIND[unit])) problems.push(`${where}: things [${things}]`)
        if (!things.includes(thing) || task.options.length !== 6 || new Set(things).size !== 6) problems.push(`${where}: options [${task.options}]`)
        if (want.length < 2 || want.length > 4 || !isCorrect(task, want.join('|')) || !isCorrect(task, [...want].reverse().join('|'))) problems.push(`${where}: answer ${String(task.answer)}, oracle ${want.join('|')}`)
        things.forEach((t, i) => {
          if (thingOfNoun(said(i)) !== t) problems.push(`${where}: the ${t} card is read "${said(i)}"`)
        })
      }
      problems.push(...answerProblems(task))
    }
    expect(first(problems)).toEqual([])
  })

  it('classifies every card and every selection as a plain error (SPEC §4.2 has no misconception for units)', () => {
    const problems: string[] = []
    for (const { kind, task } of built) {
      const given = kind === 'multiSelect' ? selections(task) : task.options.map(String)
      for (const g of given) {
        if (isCorrect(task, g)) continue
        const p = tagCheck(task, g, { mis: [] }, kind === 'choice' ? 'card' : 'set')
        if (p) problems.push(p)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('has SPEC’s production kind (six things: 1 in 63) and ceilings (three cards: box 3)', () => {
    expect(first([...productionProblemsB(built), ...specKindProblemsB(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    const tags = tagsToHint(def, facts)
    expect(first([...taskSpeechProblems(built), ...facts.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, facts)])).toEqual([])
  })
})

describe('measure fact ids across every registered skill (CONVENTIONS)', () => {
  it('are unique across all registered skills, and each wave-2 measure skill has a prefix of its own', () => {
    const MEASURE: readonly SkillId[] = ['measureUnits', 'rulerRead', 'weightCompare', 'readChart', 'unitChoice']
    const owner = new Map<string, SkillId>()
    const prefixes = new Map<string, Set<SkillId>>()
    const problems: string[] = []
    for (const def of registeredSkills()) {
      const facts = [...def.enumerate(), ...(MEASURE.includes(def.id) && def.mode === 'procedure' ? sweepB(def, 1).all : [])]
      for (const f of facts) {
        const prev = owner.get(f.id)
        if (prev !== undefined && prev !== def.id) problems.push(`${f.id}: ${prev} and ${def.id}`)
        owner.set(f.id, def.id)
        const p = f.id.slice(0, f.id.indexOf(':'))
        prefixes.set(p, (prefixes.get(p) ?? new Set()).add(def.id))
      }
    }
    for (const id of MEASURE) {
      const own = [...prefixes].filter(([, s]) => s.has(id))
      if (own.length !== 1 || own[0][1].size !== 1) problems.push(`${id}: prefixes ${own.map(([p, s]) => `${p} (${[...s]})`)}`)
    }
    expect(first(problems)).toEqual([])
  })
})
