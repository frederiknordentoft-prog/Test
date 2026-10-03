// Oracle tests for halfShape and fractionShape (SPEC §2.2, §3, §4.1–4.3, §10.1, §15.1, CONVENTIONS
// "Opgavetyperne fra bølge 2"), compared with fractions.oracle.ts: halves measured on the drawing,
// fractions compared as values.
import { describe, expect, it } from 'vitest'
import { classifyAnswer } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { guessP, isProduction } from '../../kinds'
import { masteryKeyOf } from '../../tasks'
import type { Task } from '../../types'
import {
  answerProblems, cardProblems, first, hintProblems, optionProblems, registeredSkill, sceneOf, spokenText, tagsToHint,
  taskSpeechProblems, tasksOf, type Built,
} from '../number/number.oracle'
import { classifyAll, detectableChecks, productionChecks, specKindChecks } from '../algebra/algebra2.oracle'
import { cutX, figure, partsAt } from '../shapes/shapes2.oracle'
import { cutIntoHalves, fracSlots, fracToken, fractionShapeId, halfShapeId, sameValue, spokenFraction, type Frac } from './fractions.oracle'

const TIMEOUT = 240_000
const said = (t: Task) => spokenText(t.speech)
const PLAIN = ['near', 'other', 'operand']

function setup(id: Parameters<typeof registeredSkill>[0], seeds = 4) {
  const def = registeredSkill(id)
  const facts = def.enumerate()
  return { def, facts, built: tasksOf(def, facts, seeds) as Built[] }
}

describe('fractions oracle helpers (a check of the oracle itself)', () => {
  it('measures halves on the drawing and reads fractions as values', () => {
    expect(cutIntoHalves('triangle', 0, 'equal')).toBe(true)
    expect(cutIntoHalves('triangle', 0, 'unequal')).toBe(false)
    expect(cutIntoHalves('circle', 0, 'equal')).toBe(true)
    expect(cutIntoHalves('square', 0, undefined)).toBe(false)
    expect(spokenFraction('tre fjerdedele')).toEqual({ n: 3, d: 4 })
    expect(spokenFraction('en halv')).toEqual({ n: 1, d: 2 })
    expect(spokenFraction('to fjerdedel')).toBeNull()
    expect(sameValue({ n: 2, d: 4 }, { n: 1, d: 2 })).toBe(true)
    expect(sameValue({ n: 2, d: 3 }, { n: 3, d: 4 })).toBe(false)
  })
})

// ═══ halfShape ══════════════════════════════════════════════════════════════

describe('halfShape oracle', () => {
  const { def, facts, built } = setup('halfShape')
  const items = (t: Task) => sceneOf(t.prompt, 'shapes').items

  it('has SPEC §2.2’s 16 facts: 8 figures cut in halves and the same 8 cut unequally', () => {
    expect(facts.length).toBe(16)
    const shapes = (equal: boolean) => facts.map((f) => halfShapeId(f.id)!).filter((h) => h.equal === equal).map((h) => h.shape).sort()
    expect(shapes(true)).toEqual(shapes(false))
    expect(new Set(shapes(true)).size).toBe(8)
    for (const f of facts) {
      expect(f.family, f.id).toBe(halfShapeId(f.id)!.equal ? 'equal' : 'unequal')
      expect(masteryKeyOf(def, f)).toBe(f.id)
    }
  })

  it('answers every task by measuring the cut: yes when the two parts are equally big; on a plate, exactly the figures cut in halves', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const id = halfShapeId(fact.id)!
      const where = `${fact.id} ${kind}`
      if (kind === 'trueFalse') {
        const p = sceneOf(task.prompt, 'shape')
        if (p.shape !== id.shape || said(task) !== 'Er figuren delt i to halve?') problems.push(`${where}: shows a ${p.shape}, says "${said(task)}"`)
        const want = cutIntoHalves(p.shape, p.variant, p.cut) ? 'yes' : 'no'
        if (task.answer !== want || want !== (id.equal ? 'yes' : 'no')) problems.push(`${where}: answer ${String(task.answer)}, measured ${want}`)
      } else {
        const its = items(task)
        const want = its.filter((i) => cutIntoHalves(i.shape, i.variant, i.cut)).map((i) => i.id).sort().join('|')
        if (task.answer !== want) problems.push(`${where}: answer ${String(task.answer)}, measured ${want}`)
        if (said(task) !== 'Tryk på alle figurer, der er delt i to halve.') problems.push(`${where}: says "${said(task)}"`)
        if (!its.some((i) => i.shape === id.shape && i.cut === (id.equal ? 'equal' : 'unequal'))) problems.push(`${where}: the fact’s own figure is not on the plate`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('draws every cut across its figure: both parts can be seen (each at least a tenth of the figure)', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const cut = kind === 'trueFalse' ? [sceneOf(task.prompt, 'shape')] : items(task)
      for (const c of cut) {
        if (!c.cut) continue
        const x = cutX(c.shape, c.variant, c.cut)
        const [l, r] = x === null ? [0, 0] : partsAt(figure(c.shape, c.variant), x)
        if (Math.min(l, r) < 0.1 * (l + r)) problems.push(`${fact.id} ${kind}: a ${c.shape} ${c.variant} cut ${c.cut} into ${l.toFixed(0)} and ${r.toFixed(0)}`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('unequalParts: "yes" to an unequal cut, and every cut figure taken as halves, are the misconception; the rest is plain', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      if (kind === 'trueFalse') {
        const wrong = task.answer === 'yes' ? 'no' : 'yes'
        const want = wrong === 'yes' ? 'unequalParts' : 'plain'
        const got = classifyAnswer(task, wrong)
        if (want === 'plain' ? !PLAIN.includes(String(got)) : got !== want) problems.push(`${fact.id}: "${wrong}" is ${got}, expected ${want}`)
        continue
      }
      const its = items(task)
      const cutOnes = its.filter((i) => i.cut).map((i) => i.id).sort().join('|')
      for (let mask = 1; mask < 2 ** its.length; mask++) {
        const s = its.filter((_, i) => mask & (2 ** i)).map((i) => i.id).sort().join('|')
        const right = s === task.answer
        const got = classifyAnswer(task, s)
        if (right !== isCorrect(task, s)) problems.push(`${fact.id}: ${s} right ${isCorrect(task, s)}`)
        else if (!right) {
          const want = s === cutOnes ? 'unequalParts' : 'plain'
          if (want === 'plain' ? !PLAIN.includes(String(got)) : got !== want) problems.push(`${fact.id}: ${s} is ${got}, expected ${want}`)
        }
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('counts unequalParts as an opportunity where an answer can show it, and on every contrast task (SPEC §4.3)', () => {
    expect(first(detectableChecks(built, (b, v) => {
      const t = b.task
      if (t.kind === 'trueFalse') return { mis: v === 'yes' && t.answer === 'no' ? ['unequalParts'] : [] }
      const cut = items(t).filter((i) => i.cut).map((i) => i.id).sort().join('|')
      return { mis: v === cut && cut !== t.answer ? ['unequalParts'] : [] }
    }))).toEqual([])
  })

  it('marks a task conflict exactly when an unequal cut is shown (SPEC §4.3), with six or more of each', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const unequal = kind === 'trueFalse'
        ? (() => { const p = sceneOf(task.prompt, 'shape'); return !!p.cut && !cutIntoHalves(p.shape, p.variant, p.cut) })()
        : items(task).some((i) => i.cut && !cutIntoHalves(i.shape, i.variant, i.cut))
      if ((task.contrast === 'conflict') !== unequal) problems.push(`${fact.id} ${kind}: contrast ${task.contrast}, an unequal cut ${unequal ? 'is' : 'is not'} shown`)
    }
    expect(first(problems)).toEqual([])
    const tf = built.filter((b) => b.kind === 'trueFalse')
    expect(new Set(tf.filter((b) => b.task.contrast === 'conflict').map((b) => b.fact.id)).size).toBeGreaterThanOrEqual(6)
    expect(new Set(tf.filter((b) => b.task.contrast === 'congruent').map((b) => b.fact.id)).size).toBeGreaterThanOrEqual(6)
  })

  it('hints on the fact’s own figure with its own cut', () => {
    const problems: string[] = []
    for (const f of facts) {
      const id = halfShapeId(f.id)!
      for (const tag of tagsToHint(def, facts)) for (const kind of [undefined, ...def.kinds]) {
        const v = def.hint(f, tag, kind).visual
        if (v.scene !== 'shape' || v.shape !== id.shape || v.cut !== (id.equal ? 'equal' : 'unequal')) problems.push(`${f.id} hint(${String(tag)}, ${kind}): ${JSON.stringify(v)}`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid options and has SPEC’s production kinds and ceilings (true/false box 2, six figures to choose among box 5)', () => {
    expect(first(built.flatMap((b) => [...answerProblems(b.task), ...optionProblems(b.task)]))).toEqual([])
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(facts.flatMap((f) => hintProblems(def, f, tagsToHint(def, facts))))).toEqual([])
  })
}, TIMEOUT)

// ═══ fractionShape ══════════════════════════════════════════════════════════

describe('fractionShape oracle', () => {
  const { def, facts, built } = setup('fractionShape')

  it('has SPEC §2.2’s 18 facts: 1/2, 1/3, 1/4, 2/4 (2. kl.) and 3/4, 2/3 (3. kl.) of a cirkel, rektangel and stang', () => {
    const want = new Set<string>()
    for (const f of ['1/2', '1/3', '1/4', '2/4', '3/4', '2/3']) for (const s of ['circle', 'rect', 'bar']) want.add(`frs:${f}:${s}`)
    expect(new Set(facts.map((f) => f.id))).toEqual(want)
    for (const f of facts) {
      const q = fractionShapeId(f.id)!
      expect(f.family, f.id).toBe(['3/4', '2/3'].includes(`${q.frac.n}/${q.frac.d}`) ? 'nonUnit' : 'basic')
      expect(f.answer, f.id).toBe(`frac:${q.frac.n}/${q.frac.d}`)
      expect(masteryKeyOf(def, f)).toBe(f.id)
    }
    expect(def.families.find((f) => f.id === 'nonUnit')?.grade).toBe(3)
  })

  it('answers every task from the figure and the voice: coloured parts over parts, or the fraction asked to colour (colored: 0)', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const q = fractionShapeId(fact.id)!
      const p = sceneOf(task.prompt, 'fraction')
      const where = `${fact.id} ${kind}`
      if (p.shape !== q.shape || p.parts !== q.frac.d || !p.equal) problems.push(`${where}: a ${p.shape} in ${p.parts} ${p.equal ? 'equal' : 'unequal'} parts`)
      if (kind === 'colorParts') {
        if (p.colored !== 0) problems.push(`${where}: ${p.colored} parts already coloured`)
        const m = /^Farv (.+)\.$/.exec(said(task))
        const asked = m ? spokenFraction(m[1]) : null
        if (!asked || !sameValue(asked, q.frac) || task.answer !== `frac:${asked.n}/${asked.d}`) problems.push(`${where}: says "${said(task)}", answer ${String(task.answer)}`)
      } else {
        const shown: Frac = { n: p.colored, d: p.parts }
        const right = kind === 'fillSlots' ? fracSlots(task.answer) : fracToken(task.answer)
        if (!right || right.n !== shown.n || right.d !== shown.d) problems.push(`${where}: shows ${shown.n}/${shown.d}, answer ${String(task.answer)}`)
        const text = kind === 'fillSlots' ? 'Skriv brøken for den farvede del.' : 'Hvor stor en del af figuren er farvet?'
        if (said(task) !== text) problems.push(`${where}: says "${said(task)}"`)
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('accepts exactly the equal fractions: every colouring, filling and card is right when, and only when, it is the same value', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const q = fractionShapeId(fact.id)!.frac
      for (const a of task.accept) {
        const v = kind === 'fillSlots' ? fracSlots(a) : fracToken(a)
        if (!v || !sameValue(v, q)) problems.push(`${fact.id} ${kind}: accepts ${String(a)}`)
      }
      const values: string[] = []
      if (kind === 'colorParts') {
        // what the colouring hands in: frac:<coloured>/<parts>, for 0 … all parts
        const parts = sceneOf(task.prompt, 'fraction').parts
        for (let k = 0; k <= parts; k++) values.push(`frac:${k}/${parts}`)
      } else if (kind === 'fillSlots') {
        for (const a of task.options) for (const b of task.options) values.push(`${String(a)}|${String(b)}`)
      } else values.push(...task.options.map(String))
      for (const v of values) {
        const f = kind === 'fillSlots' ? fracSlots(v) : fracToken(v)
        const want = !!f && sameValue(f, q)
        if (isCorrect(task, v) !== want) problems.push(`${fact.id} ${kind}: ${v} is ${isCorrect(task, v) ? 'right' : 'wrong'}`)
        const got = classifyAnswer(task, v)
        if (!want && !PLAIN.includes(String(got))) problems.push(`${fact.id} ${kind}: ${v} is ${got}, no misconception fits`)
      }
      if (kind === 'choice') {
        for (const o of task.options) {
          const f = fracToken(o)
          if (!f || f.n > f.d || f.d > 8) problems.push(`${fact.id}: the card ${String(o)} is not a fraction of one whole with a denominator to 8`)
        }
      }
    }
    expect(first(problems)).toEqual([])
  })

  it('deals valid cards (three, one right, never an equal fraction wrong) and a fillSlots palette 1–8', () => {
    expect(first(built.flatMap((b) => [...answerProblems(b.task), ...cardProblems(b.task), ...optionProblems(b.task)]))).toEqual([])
    for (const { task } of built) if (task.kind === 'fillSlots') expect(task.options).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('has SPEC’s production kinds and ceilings: fillSlots box 5 (also counting every equal filling as right), colorParts and cards box 3', () => {
    expect(first(productionChecks(built))).toEqual([])
    expect(first(specKindChecks(def, built))).toEqual([])
    for (const { fact, task } of built) {
      if (task.kind === 'colorParts') expect(isProduction(task), fact.id).toBe(false)
      if (task.kind !== 'fillSlots') continue
      // 1/2 is right as 1|2, 2|4, 3|6 and 4|8: four of 64 fillings, still far below 12 %
      const q = fractionShapeId(fact.id)!.frac
      let right = 0
      for (let a = 1; a <= 8; a++) for (let b = 1; b <= 8; b++) if (sameValue({ n: a, d: b }, q)) right++
      expect(right / 64, fact.id).toBeLessThanOrEqual(0.12)
      // kinds.ts counts the accepted equal fillings since UIFIX2 (UI-fund 8): the oracle's own count
      expect(guessP(task), fact.id).toBeCloseTo(right / 64)
    }
  })

  it('classifies every wrong card, colouring and filling as plain (no catalogue misconception fits equal parts)', () => {
    expect(first(detectableChecks(built, () => ({ mis: [] })))).toEqual([])
    expect(first(classifyAll(built.filter((b) => b.kind !== 'colorParts'), () => ({ mis: [] }), (b, v) => {
      const q = fractionShapeId(b.fact.id)!.frac
      const f = b.kind === 'fillSlots' ? fracSlots(v) : fracToken(v)
      return !!f && sameValue(f, q)
    }))).toEqual([])
  })

  it('speaks every task and hint with recorded clips and no digits; the fraction to colour as SPEC §10.1 says it', () => {
    expect(first(taskSpeechProblems(built))).toEqual([])
    expect(first(facts.flatMap((f) => hintProblems(def, f, tagsToHint(def, facts))))).toEqual([])
  })

  it('hints on the fact’s figure with its parts coloured, and names the fraction (“Det er en fjerdedel.”)', () => {
    const problems: string[] = []
    for (const f of facts) {
      const q = fractionShapeId(f.id)!
      for (const kind of [undefined, ...def.kinds]) {
        const h = def.hint(f, null, kind)
        const where = `${f.id} hint(${kind ?? ''})`
        const v = h.visual
        if (v.scene !== 'fraction' || v.shape !== q.shape || v.parts !== q.frac.d || v.colored !== q.frac.n || !v.equal) problems.push(`${where}: ${JSON.stringify(v)}`)
        const m = /Det er ([a-zæøå]+ [a-zæøå]+)\.$/.exec(spokenText(h.speech))
        const named = m ? spokenFraction(m[1]) : null
        if (!named || named.n !== q.frac.n || named.d !== q.frac.d) problems.push(`${where}: "${spokenText(h.speech)}"`)
      }
    }
    expect(first(problems)).toEqual([])
  })
}, TIMEOUT)
