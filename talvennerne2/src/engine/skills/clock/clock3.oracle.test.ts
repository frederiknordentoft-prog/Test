// Oracle tests for the clock skills of 3. klasse (SPEC §2.2, §3, §4.1 with A9, §10.1, §15.1), ORK3c, against
// clock3.oracle.ts: every canonical fact and 200 seeded instances per family, both kinds, several card deals and one
// deal aimed at each misconception. The time is read from what the child hears (the five-minute phrase with its
// "halv" form, the digital reading in 12 and 24 hours with the time of day) and from the hands and digits drawn on
// the prompt and the cards; wrong clocks are explained by pædagogik §3.2's formulas per skill; the hints are read
// sentence by sentence and must say true things about the clock they show.
import { describe, expect, it } from 'vitest'
import { isCorrect } from '../../answer'
import { classifyAnswer } from '../../misconceptions'
import { masteryKeyOf } from '../../tasks'
import type { AnswerValue, ErrorTag, Fact, HintSpec, SkillDef, Task } from '../../types'
import { factFor } from '../../../ui/hint/hintFor'
import {
  answerProblems, cardProblems, first, globalIdProblems, hintProblems, registeredSkill, spokenText, tagsToHint, taskSpeechProblems, type Built,
} from '../number/number.oracle'
import { registeredSkills } from '../../registry'
import { sentences } from '../algebra/algebra2.oracle'
import { word99 } from '../number/number2.oracle'
import { avoidProblemsB, onDial, prefixProblems, specificHintProblems } from './clock.oracle'
import {
  CLOCK_STEP3, FIVE_PAST, askedDigital, askedElapsed, askedFive, classifyC, countsAs, dayPartOf, detectableC, diagnosticCardsC,
  digital12, digital24, digitalIdeas, digitalOf, divisionWordProblems, drawnAnalog, drawnDigital, elapsedIdeas, elapsedOf, explainDigital,
  explainElapsed, explainFive, fastProblemsC, fiveIdeas, fiveOf, fivePhrase, hourAt3, hourPassed, instanceProblems, markupOfCard,
  markupOfPrompt, normalisationProblems3, productionProblemsC, setSwapped, spec101Clock5, spec101Digital, specKindProblemsC, swappedClocks,
  sweepC, tellApart, timeOfDigital, timeOfPhrase5, type DigitalAsk, type ElapsedAsk, type WhyC,
} from './clock3.oracle'

const TIMEOUT = 600_000

const said = (t: Task): string => spokenText(t.speech)
const lower1 = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1)

/** Every tag a hint can be asked for: the plain ones and each misconception the skill tags anywhere. */
const hintTags = (def: SkillDef, facts: readonly Fact[]): (ErrorTag | null)[] => tagsToHint(def, facts)

/**
 * The tags a fact's hint is shown for (SPEC §3.5: the hint follows the error tag of the answer, and a flag never
 * changes it): the plain ones and the misconceptions the fact's own wrong answers carry, on any kind.
 */
function ownTags(def: SkillDef, f: Fact): (ErrorTag | null)[] {
  const mis = new Set<ErrorTag>()
  const ext = def as SkillDef & { candidatesFor?: (f: Fact, k: Task['kind']) => { tag: ErrorTag }[] }
  for (const kind of def.kinds) for (const c of ext.candidatesFor ? ext.candidatesFor(f, kind) : def.candidates(f)) mis.add(c.tag)
  for (const c of def.candidates(f)) mis.add(c.tag)
  return [null, 'near', 'operand', 'other', 'ambiguous', ...[...mis].filter((m) => !['near', 'operand', 'other', 'ambiguous'].includes(m))]
}

/**
 * The strategy hint the round screen shows is the one for the fact rebuilt from the task (ui/hint/hintFor.ts factFor):
 * it must be the hint of the fact itself, for every tag and the task's kind.
 */
function rebuiltHintProblems(def: SkillDef, built: readonly Built[], tags: readonly (ErrorTag | null)[]): string[] {
  const out = new Set<string>()
  for (const { fact, kind, task } of built) {
    const again = factFor(def, task)
    for (const tag of tags) {
      const want = JSON.stringify(def.hint(fact, tag, kind))
      const got = JSON.stringify(def.hint(again, tag, kind))
      if (got !== want) out.add(`${fact.id} ${kind} hint(${String(tag)}): rebuilt from the task it is ${got.slice(0, 160)}`)
    }
  }
  return [...out]
}

/** The dial starts on its step (Task.dialStart, GENFIX2), never on the answer, never on a clock the oracle counts as a misconception. */
function dialStartProblems(built: readonly Built[], why: (b: Built, v: AnswerValue) => WhyC): string[] {
  const out = new Set<string>()
  for (const b of built) {
    const t = b.task
    if (t.kind !== 'clockSet') continue
    const s = t.dialStart
    const step = CLOCK_STEP3[t.skill]!
    if (s === undefined || s % step !== 0 || s < 0 || s >= 720) out.add(`${t.factId}: dialStart ${String(s)}`)
    else if (isCorrect(t, s)) out.add(`${t.factId}: the dial starts on the answer ${s}`)
    else if (countsAs(t, s, why(b, s)) !== null) out.add(`${t.factId}: the dial starts on ${s}, ${countsAs(t, s, why(b, s))} for the oracle`)
  }
  return [...out]
}

/** Cards a child can tell apart, and exactly one drawn showing `want` (analog: the hands; digital: the digits). */
function drawnCardProblems(t: Task, want: number | string, digital: boolean): string[] {
  const out: string[] = []
  const drawn = t.options.map((o) => (digital ? drawnDigital(markupOfCard(t, o)) : drawnAnalog(markupOfCard(t, o))))
  const where = `${t.factId} ${t.kind} [${t.options.join(', ')}]`
  if (drawn.some((d) => d === null)) out.push(`${where}: a card is not drawn as one ${digital ? 'digital' : 'analog'} clock`)
  const hits = t.options.filter((_, i) => drawn[i] === want)
  if (hits.length !== 1 || hits[0] !== t.answer) out.push(`${where}: drawn ${JSON.stringify(drawn)}, the time asked is ${String(want)}`)
  if (new Set(drawn).size !== drawn.length) out.push(`${where}: two cards are drawn alike ${JSON.stringify(drawn)}`)
  if (!digital) {
    t.options.forEach((a, i) => t.options.forEach((b, j) => {
      if (i < j && !tellApart(Number(a), Number(b))) out.push(`${where}: cards ${a} and ${b} look alike`)
    }))
  }
  return out
}

describe('the clock3 oracle itself', () => {
  it('says and reads every five-minute time as SPEC §10.1’s table, with the half form of :20 and :40', () => {
    expect(spec101Clock5(185)).toBe('fem minutter over tre')
    expect(spec101Clock5(200)).toBe('tyve minutter over tre')
    expect(spec101Clock5(145)).toBe('fem minutter i halv tre')
    expect(spec101Clock5(155)).toBe('fem minutter over halv tre')
    expect(spec101Clock5(160)).toBe('tyve minutter i tre')
    expect(spec101Clock5(175)).toBe('fem minutter i tre')
    expect(spec101Clock5(140, true)).toBe('ti minutter i halv tre')
    expect(spec101Clock5(160, true)).toBe('ti minutter over halv tre')
    expect(spec101Clock5(55)).toBe('fem minutter i et')
    expect(spec101Clock5(5)).toBe('fem minutter over tolv')
    expect(spec101Clock5(30)).toBe('halv et')
    for (let t = 0; t < 720; t += 5) {
      expect(timeOfPhrase5(spec101Clock5(t))?.minutes, `${t}`).toBe(t)
      if (t % 60 === 20 || t % 60 === 40) expect(timeOfPhrase5(spec101Clock5(t, true))?.minutes, `${t} half form`).toBe(t)
    }
    expect(timeOfPhrase5('ti minutter over halv tre')).toMatchObject({ minutes: 160, hour: 3, ref: 150, dir: 'over', halv: true })
    expect(spec101Digital(14, 45)).toBe('fjorten femogfyrre')
    expect(spec101Digital(14, 5)).toBe('fjorten nul fem')
    expect(spec101Digital(13, 0)).toBe('tretten nul nul')
    expect(spec101Digital(1, 5)).toBe('et nul fem')
    expect(timeOfDigital('tolv nul fem')).toEqual({ h: 12, m: 5 })
    expect(timeOfDigital('tre tyve')).toEqual({ h: 3, m: 20 })
    expect([dayPartOf(9), dayPartOf(14), dayPartOf(20), dayPartOf(2)]).toEqual(['om morgenen', 'om eftermiddagen', 'om aftenen', null])
    expect([digital12(5), digital12(165), digital24(885)]).toEqual(['12:05', '2:45', '14:45'])
  })

  it('swaps the hands as pædagogik §3.2 says (3:00 → 12:15) and explains the wrong clocks of each skill', () => {
    expect(swappedClocks(180)).toEqual([15])
    expect(setSwapped(180)).toBe(15)
    // 2:45 set from its digits: the long hand on 2, the short one on 9
    expect(setSwapped(165)).toBe(550)
    const iHalv = timeOfPhrase5('fem minutter i halv tre')!
    expect(explainFive(iHalv, 155).mis).toEqual(['quarterDirection'])
    expect(explainFive(iHalv, 205).mis).toEqual(['halfPastNext'])
    expect(explainFive(iHalv, 180)).toMatchObject({ mis: [], operand: true })
    const i = timeOfPhrase5('ti minutter i tre')!
    expect(explainFive(i, 110).mis).toEqual(['hourHandMisread'])
    expect(explainFive(i, 190).mis).toEqual(['quarterDirection'])
    const q = askedElapsed('Klokken er kvart i fire. Hvad er klokken om en halv time?', 'choice')!
    expect([q.s, q.a]).toEqual([225, 255])
    expect(explainElapsed(q, 195)).toMatchObject({ mis: ['wrongOperation'], slip: true })
    const m = askedElapsed('Klokken er halv fire. Stil uret, så det viser, hvad klokken var for en halv time siden.', 'clockSet')!
    expect(explainElapsed(m, 240).mis).toEqual(['wrongOperation', 'halfPastNext'])
  })
})

// ═══ clockFive ══════════════════════════════════════════════════════════════

describe('clockFive oracle', () => {
  const def = registeredSkill('clockFive')
  const { canon, instances, all, built } = sweepC(def, 3)
  const ask = (b: Built) => askedFive(said(b.task), b.kind)!
  const why = (b: Built, v: AnswerValue): WhyC => (typeof v === 'number' ? explainFive(ask(b).said, v) : { mis: [] })
  const tags = hintTags(def, all)

  it('has SPEC §2.2’s five families and fem:<family>:<m> ids the oracle reads; 20 canonical times a family, all twelve in iHalv and overHalv', () => {
    expect(def.families.map((f) => f.id)).toEqual(['over', 'iHalv', 'overHalv', 'i', 'halfForm'])
    const count = (fam: string) => canon.filter((f) => f.family === fam).length
    expect(def.families.map((f) => count(f.id))).toEqual([20, 12, 12, 20, 20])
    const problems: string[] = []
    for (const f of all) {
      const o = fiveOf(f.id)
      if (!o) problems.push(`${f.id}: not a five-minute time of its family`)
      else if (o.family !== f.family || f.answer !== o.t || f.skill !== 'clockFive') problems.push(`${f.id}: family ${f.family}, answer ${String(f.answer)}`)
      if (masteryKeyOf(def, f) !== `clockFive/${f.family}`) problems.push(`${f.id}: mastery key ${masteryKeyOf(def, f)}`)
    }
    for (const fam of def.families) {
      const hours = new Set(all.filter((f) => f.family === fam.id).map((f) => hourPassed(Number(f.answer))))
      if (hours.size !== 12) problems.push(`${fam.id}: ${hours.size} hours`)
    }
    problems.push(...prefixProblems(def, all, 'fem'), ...avoidProblemsB(def, instances))
    problems.push(...instanceProblems(def, instances, (fam) => Math.min(30, 12 * FIVE_PAST[fam].length)))
    expect(first(problems)).toEqual([])
  })

  it('asks the time of the id in SPEC §10.1’s words — the "halv" form in halfForm, the table’s elsewhere — answered on the dial (modulo 720)', () => {
    const problems: string[] = []
    for (const { fact, kind, task } of built) {
      const where = `${fact.id} ${kind}`
      const a = askedFive(said(task), kind)
      const o = fiveOf(fact.id)!
      if (!a) problems.push(`${where}: "${said(task)}" is not a clock question`)
      else {
        if (a.phrase !== fivePhrase(fact.family, o.t)) problems.push(`${where}: says "${a.phrase}", SPEC §10.1 "${fivePhrase(fact.family, o.t)}"`)
        if (a.said.minutes !== o.t || task.answer !== o.t) problems.push(`${where}: "${a.phrase}" is ${a.said.minutes}, the task's answer ${String(task.answer)}`)
      }
      if (task.answerType !== 'minutes' || task.modulo !== 720 || task.tolerance !== 0 || task.range.join() !== '0,719') problems.push(`${where}: ${task.answerType} modulo ${task.modulo} range ${task.range}`)
      problems.push(...answerProblems(task))
      if (!isCorrect(task, o.t + 720) || classifyAnswer(task, o.t + 720) !== null) problems.push(`${where}: the same time once more round is not right`)
      // nothing on the screen but the voice beside the cards; an empty dial with the five-minute step to set
      const p = task.prompt
      if (kind === 'choice' ? p.scene !== 'hear' : p.scene !== 'clock' || p.minutes !== null || p.step !== 5 || p.digital === true || p.h24 === true) problems.push(`${where}: prompt ${JSON.stringify(p)}`)
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('deals three clocks a child can tell apart, exactly one drawn with the hands of the time said, a diagnostic clock whenever one counts', () => {
    const problems: string[] = []
    const choice = built.filter((b) => b.kind === 'choice')
    for (const b of choice) {
      problems.push(...cardProblems(b.task, (c) => Number.isInteger(c) && c >= 0 && c < 720))
      problems.push(...drawnCardProblems(b.task, ask(b).said.minutes, false))
    }
    const known = (b: Built) => Object.values(fiveIdeas(ask(b).said, null)).flat()
    problems.push(...diagnosticCardsC(choice, known, why))
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('classifies every card and every clock the dial can set by pædagogik §3.2 (A9: the hour heard as a whole hour)', () => {
    expect(first(classifyC(built, why))).toEqual([])
  }, TIMEOUT)

  it('counts as an opportunity (detectableOf) exactly the misconceptions a card or the dial can show', () => {
    expect(first(detectableC(built, why))).toEqual([])
  }, TIMEOUT)

  it('has SPEC’s production kind (clockSet: 5/720), ceilings (three clocks: box 3) and a fair speed (dial 18 s)', () => {
    expect(first([...productionProblemsC(built), ...specKindProblemsC(def, built), ...fastProblemsC(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, every time as SPEC §10.1 says it, never "delt med"', () => {
    const facts = [...canon, ...all.slice(canon.length).filter((_, i) => i % 5 === 0)]
    expect(first([
      ...taskSpeechProblems(built), ...facts.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, facts),
      ...normalisationProblems3(def, built, facts, tags), ...divisionWordProblems(def, built, facts, tags),
    ])).toEqual([])
  }, TIMEOUT)

  it('says only true things about the clock in every hint, and shows that clock', () => {
    const problems = new Set<string>()
    for (const f of all) {
      const o = fiveOf(f.id)!
      const s = timeOfPhrase5(fivePhrase(f.family, o.t))!
      for (const tag of ownTags(def, f)) {
        const h = def.hint(f, tag)
        for (const p of fiveHintProblems(s, f.family, tag, h)) problems.add(`${f.id} hint(${String(tag)}): ${p}`)
      }
    }
    expect(first([...problems])).toEqual([])
  }, TIMEOUT)

  it('starts the dial on its step, never on the answer or a misconception’s clock; a task rebuilt from its id gets the same hint', () => {
    expect(first([...dialStartProblems(built, why), ...rebuiltHintProblems(def, built.filter((_, i) => i % 3 === 0), tags)])).toEqual([])
  }, TIMEOUT)
})

/**
 * clockFive's hint, read: "<time> er <n> minutter efter|før <hour or half hour>." (true, and counting from what the
 * phrase counts from), "Den lange viser peger på <k>." (k the minutes / 5); quarterDirection opens with "Over
 * betyder efter, og i betyder før.", handsSwapped with the hands' roles, halfPastNext with "Halv H er en halv time
 * før H." (H the hour named); hourHandMisread is "Se godt på den lille viser. Ved <time> er den endnu ikke nået til
 * <H>." (H the next number). The picture: the clock at the time, or the long hand's sweep up to it from the hour or
 * half hour.
 */
function fiveHintProblems(s: Said5Like, family: string, tag: ErrorTag | null, h: HintSpec): string[] {
  const out: string[] = []
  const t = s.minutes
  const text = spokenText(h.speech)
  const all = sentences(text)
  const phrase = fivePhrase(family, t)
  if (tag === 'hourHandMisread') {
    if (all[0] !== 'Se godt på den lille viser.') out.push(`"${text}"`)
    const m = /^Ved (.+) er den endnu ikke nået til (\S+)\.$/.exec(all[1] ?? '')
    const next = (hourPassed(t) % 12) + 1
    if (!m || m[1] !== phrase || timeOfPhrase5(m[2])?.minutes !== hourAt3(next) || t % 60 === 0) out.push(`"${all[1]}" at ${t}`)
  } else {
    let rest = all
    const lead = { quarterDirection: 'Over betyder efter, og i betyder før.', handsSwapped: 'Den lille viser er timeviseren, og den lange viser er minutviseren.' } as Record<string, string>
    if (tag !== null && lead[tag]) {
      if (rest[0] !== lead[tag]) out.push(`opens "${rest[0]}"`)
      rest = rest.slice(1)
    }
    if (tag === 'halfPastNext') {
      const m = /^Halv (\S+) er en halv time før (\S+)\.$/.exec(rest[0] ?? '')
      if (!m || m[1] !== m[2] || timeOfPhrase5(m[2])?.hour !== s.hour) out.push(`opens "${rest[0]}", the phrase names ${s.hour}`)
      rest = rest.slice(1)
    }
    const m = /^(.+) er (\S+) minutter (efter|før) (.+)\.$/.exec(rest[0] ?? '')
    const n = m ? word99(m[2]) ?? undefined : undefined
    const ref = m ? timeOfPhrase5(m[4]) : null
    if (!m || lower1(m[1]) !== phrase || n === undefined || !ref || ref.minutes !== s.ref || onDial(ref.minutes + (m[3] === 'efter' ? n : -n)) !== t) out.push(`says "${rest[0]}" of ${t} (counts from ${s.ref})`)
    const k = /^Den lange viser peger på (\S+)\.$/.exec(rest[1] ?? '')
    const at = k ? timeOfPhrase5(k[1])?.hour : undefined
    if (at !== ((t % 60) / 5 || 12)) out.push(`says "${rest[1]}" of ${t}`)
    if (rest.length !== 2) out.push(`says more: "${text}"`)
  }
  const v = h.visual
  if (v.scene === 'clock') {
    if (v.minutes === null || onDial(v.minutes) !== t) out.push(`shows ${JSON.stringify(v)}`)
  } else if (v.scene === 'clockMove') {
    const span = onDial(v.to - v.from)
    if (onDial(v.to) !== t || ![s.ref, t - (t % 60)].map(onDial).includes(onDial(v.from)) || span === 0 || span > 60) out.push(`shows ${JSON.stringify(v)}`)
  } else out.push(`shows ${JSON.stringify(v)}`)
  return out
}
type Said5Like = NonNullable<ReturnType<typeof timeOfPhrase5>>

// ═══ clockDigital ═══════════════════════════════════════════════════════════

describe('clockDigital oracle', () => {
  const def = registeredSkill('clockDigital')
  const { canon, instances, all, built } = sweepC(def, 3)
  const analogOf = (t: Task): number | null => (t.prompt.scene === 'clock' && !t.prompt.digital ? drawnAnalog(markupOfPrompt(t)) : null)
  const askCache = new Map<Task, DigitalAsk | null>()
  const ask = (b: Built): DigitalAsk => {
    if (!askCache.has(b.task)) askCache.set(b.task, askedDigital(b.task, said(b.task), analogOf(b.task)))
    return askCache.get(b.task)!
  }
  const why = (b: Built, v: AnswerValue): WhyC => (typeof v === 'number' ? explainDigital(ask(b), b.kind, v) : { mis: [] })
  const tags = hintTags(def, all)

  it('has SPEC §2.2’s two families: dig:analogToDigital:<m> (12 hours) and dig:digital24:<m> (13:00–23:55), 20 canonical times each', () => {
    expect(def.families.map((f) => f.id)).toEqual(['analogToDigital', 'digital24'])
    expect([canon.filter((f) => f.family === 'analogToDigital').length, canon.filter((f) => f.family === 'digital24').length]).toEqual([20, 20])
    const problems: string[] = []
    for (const f of all) {
      const o = digitalOf(f.id)
      if (!o || o.family !== f.family || f.answer !== o.t) problems.push(`${f.id}: family ${f.family}, answer ${String(f.answer)}`)
      if (masteryKeyOf(def, f) !== `clockDigital/${f.family}`) problems.push(`${f.id}: mastery key ${masteryKeyOf(def, f)}`)
    }
    problems.push(...prefixProblems(def, all, 'dig'), ...avoidProblemsB(def, instances), ...instanceProblems(def, instances, () => 100))
    expect(first(problems)).toEqual([])
  })

  it('asks for the time the child is given — the analog clock drawn, the time said with its time of day, the digital clock read aloud and drawn', () => {
    const problems: string[] = []
    for (const b of built) {
      const { fact, kind, task } = b
      const where = `${fact.id} ${kind}`
      const o = digitalOf(fact.id)!
      const q = ask(b)
      const h24 = fact.family === 'digital24'
      if (!q) {
        problems.push(`${where}: "${said(task)}" with ${JSON.stringify(task.prompt)} asks no one time`)
        continue
      }
      if (q.t !== o.t || task.answer !== o.t || q.h24 !== h24) problems.push(`${where}: the child is asked ${q.t}, the id says ${o.t}, the task ${String(task.answer)}`)
      const modulo = kind === 'choice' && h24 ? 1440 : 720
      if (task.answerType !== 'minutes' || task.modulo !== modulo || task.range[1] !== (h24 ? 1439 : 719)) problems.push(`${where}: ${task.answerType} modulo ${task.modulo} range ${task.range}`)
      problems.push(...answerProblems(task))
      if (kind === 'choice') {
        // the analog clock drawn is the time (the 24-hour time on its dial); the said phrase is that clock
        if (analogOf(task) !== onDial(o.t)) problems.push(`${where}: the clock drawn shows ${analogOf(task)}`)
        if (h24 && q.said?.minutes !== onDial(o.t)) problems.push(`${where}: "${said(task)}"`)
      } else {
        const p = task.prompt
        const shown = drawnDigital(markupOfPrompt(task))
        if (p.scene !== 'clock' || p.digital !== true || p.step !== 5 || shown !== (h24 ? digital24(o.t) : digital12(o.t))) problems.push(`${where}: the digital clock shows ${shown}, prompt ${JSON.stringify(p)}`)
        const heard = /^Det digitale ur viser (.+?)\./.exec(said(task))
        const d = heard ? timeOfDigital(heard[1]) : null
        if (!d || `${d.h}:${String(d.m).padStart(2, '0')}` !== shown) problems.push(`${where}: "${said(task)}" read beside ${shown}`)
      }
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('deals three digital clocks drawn differently, exactly one showing the time (12 or 24 hours), a diagnostic card whenever one counts', () => {
    const problems: string[] = []
    const choice = built.filter((b) => b.kind === 'choice')
    for (const b of choice) {
      const q = ask(b)
      const h24 = b.fact.family === 'digital24'
      if (b.task.optionView !== 'clockDigital') problems.push(`${b.fact.id}: ${b.task.optionView} cards`)
      problems.push(...cardProblems(b.task, (c) => Number.isInteger(c) && c >= 0 && c < (h24 ? 1440 : 720)))
      problems.push(...drawnCardProblems(b.task, h24 ? digital24(q.t) : digital12(q.t), true))
    }
    problems.push(...diagnosticCardsC(choice, (b) => Object.values(digitalIdeas(ask(b), b.kind)).flat(), why))
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('classifies every card and every clock the dial can set by pædagogik §3.2, per presentation', () => {
    expect(first(classifyC(built, why))).toEqual([])
  }, TIMEOUT)

  it('counts as an opportunity exactly the misconceptions a card or the dial can show', () => {
    expect(first(detectableC(built, why))).toEqual([])
  }, TIMEOUT)

  it('has SPEC’s production kind (clockSet: 5/720, a 24-hour time set on the 12-hour dial), ceilings and a fair speed', () => {
    expect(first([...productionProblemsC(built), ...specKindProblemsC(def, built), ...fastProblemsC(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, every time — analog, digital, time of day — as SPEC §10.1 says it', () => {
    const facts = [...canon, ...all.slice(canon.length).filter((_, i) => i % 5 === 0)]
    expect(first([
      ...taskSpeechProblems(built), ...facts.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, facts),
      ...normalisationProblems3(def, built, facts, tags), ...divisionWordProblems(def, built, facts, tags),
    ])).toEqual([])
  }, TIMEOUT)

  it('says only true things in every hint: the hands read off the clock, the digits, "fjorten minus tolv giver to", the time of day', () => {
    const problems = new Set<string>()
    for (const f of all) {
      const o = digitalOf(f.id)!
      for (const tag of ownTags(def, f)) for (const p of digitalHintProblems(o.t, f.family === 'digital24', tag, def.hint(f, tag))) problems.add(`${f.id} hint(${String(tag)}): ${p}`)
    }
    expect(first([...problems])).toEqual([])
  }, TIMEOUT)

  it('starts the dial on its step, never on the answer or a misconception’s clock; a task rebuilt from its id gets the same hint', () => {
    expect(first([...dialStartProblems(built, why), ...rebuiltHintProblems(def, built.filter((_, i) => i % 3 === 0), tags)])).toEqual([])
  }, TIMEOUT)
})

/**
 * clockDigital's hint, read. 12 hours: "Den lille viser er gået forbi H." (or "peger på H." on the hour), "Den lange
 * viser peger på k og det er mm minutter.", "Det digitale ur viser <digital>." 24 hours: "HH minus tolv giver H." and
 * "Så er klokken <phrase> <time of day>." The misconceptions' own sentences open it (hourHandMisread replaces it).
 */
function digitalHintProblems(t: number, h24: boolean, tag: ErrorTag | null, h: HintSpec): string[] {
  const out: string[] = []
  const text = spokenText(h.speech)
  let rest = sentences(text)
  const dial = onDial(t)
  const mm = t % 60
  if (tag === 'hourHandMisread') {
    const m = /^Ved (.+) er den endnu ikke nået til (\S+)\.$/.exec(rest[1] ?? '')
    if (rest[0] !== 'Se godt på den lille viser.' || !m || m[1] !== spec101Clock5(dial) || timeOfPhrase5(m[2])?.hour !== (hourPassed(dial) % 12) + 1 || mm < 30) out.push(`"${text}"`)
    rest = []
  }
  if (tag === 'handsSwapped') {
    if (rest[0] !== 'Den lille viser er timeviseren, og den lange viser er minutviseren.') out.push(`opens "${rest[0]}"`)
    rest = rest.slice(1)
  }
  if (tag === 'halfPastNext') {
    const m = /^Halv (\S+) er en halv time før (\S+)\.$/.exec(rest[0] ?? '')
    if (!m || m[1] !== m[2] || timeOfPhrase5(spec101Clock5(dial))?.hour !== timeOfPhrase5(m[2])?.hour || !/halv/.test(spec101Clock5(dial))) out.push(`opens "${rest[0]}" for ${spec101Clock5(dial)}`)
    rest = rest.slice(1)
  }
  if (rest.length > 0 && !h24) {
    const small = /^Den lille viser (er gået forbi|peger på) (\S+)\.$/.exec(rest[0] ?? '')
    if (!small || timeOfPhrase5(small[2])?.hour !== hourPassed(dial) || (small[1] === 'peger på') !== (mm === 0)) out.push(`says "${rest[0]}" of ${digital12(dial)}`)
    const long = /^Den lange viser peger på (\S+),? og det er (\S+) minutter\.$/.exec(rest[1] ?? '')
    if (!long || timeOfPhrase5(long[1])?.hour !== (mm / 5 || 12) || word99(long[2]) !== mm) out.push(`says "${rest[1]}" of ${digital12(dial)}`)
    const dig = /^Det digitale ur viser (.+)\.$/.exec(rest[2] ?? '')
    const d = dig ? timeOfDigital(dig[1]) : null
    if (!d || `${d.h}:${String(d.m).padStart(2, '0')}` !== digital12(dial)) out.push(`says "${rest[2]}" of ${digital12(dial)}`)
  } else if (rest.length > 0) {
    const sub = /^(\S+) minus tolv giver (\S+)\.$/.exec(rest[0] ?? '')
    const H = Math.floor(t / 60)
    if (!sub || word99(sub[1].toLowerCase()) !== H || timeOfPhrase5(sub[2])?.hour !== H - 12) out.push(`says "${rest[0]}" of ${digital24(t)}`)
    const so = /^Så er klokken (.+) (om morgenen|om eftermiddagen|om aftenen)\.$/.exec(rest[1] ?? '')
    if (!so || so[1] !== spec101Clock5(dial) || so[2] !== dayPartOf(H)) out.push(`says "${rest[1]}" of ${digital24(t)}`)
  }
  const v = h.visual
  if (v.scene !== 'clock' || v.minutes === null || onDial(v.minutes) !== dial) out.push(`shows ${JSON.stringify(v)}`)
  return out
}

// ═══ clockElapsed ═══════════════════════════════════════════════════════════

describe('clockElapsed oracle', () => {
  const def = registeredSkill('clockElapsed')
  const { canon, instances, all, built } = sweepC(def, 3)
  const ask = (b: Built): ElapsedAsk => askedElapsed(said(b.task), b.kind)!
  // SPEC A24 (GENFIX3, approved by the integrator): the dial starts on the start clock (dialStart) and turns the short hand
  // with the long one, so on the dial the hour cannot be left behind; the half hour across the hour is the turn back there
  const why = (b: Built, v: AnswerValue): WhyC => {
    if (typeof v !== 'number') return { mis: [] }
    const w = explainElapsed(ask(b), v)
    return b.kind === 'clockSet' ? { ...w, slip: false } : w
  }
  const tags = hintTags(def, all)

  it('has SPEC §2.2’s four families, tid:<family>:<start> with the start on a quarter hour, 20 canonical starts each', () => {
    expect(def.families.map((f) => f.id)).toEqual(['plusHour', 'plusHalf', 'plusQuarter', 'minusHalf'])
    expect(def.families.map((fam) => canon.filter((f) => f.family === fam.id).length)).toEqual([20, 20, 20, 20])
    const problems: string[] = []
    for (const f of all) {
      const o = elapsedOf(f.id)
      if (!o || o.family !== f.family || f.answer !== o.a) problems.push(`${f.id}: family ${f.family}, answer ${String(f.answer)}`)
      if (masteryKeyOf(def, f) !== `clockElapsed/${f.family}`) problems.push(`${f.id}: mastery key ${masteryKeyOf(def, f)}`)
    }
    problems.push(...prefixProblems(def, all, 'tid'), ...avoidProblemsB(def, instances), ...instanceProblems(def, instances, () => 40))
    expect(first(problems)).toEqual([])
  })

  it('works the answer out from the start said and shown and the time span asked, on the dial (modulo 720)', () => {
    const problems: string[] = []
    for (const b of built) {
      const { fact, kind, task } = b
      const where = `${fact.id} ${kind}`
      const o = elapsedOf(fact.id)!
      const q = askedElapsed(said(task), kind)
      if (!q || q.s !== o.s || q.d !== o.d || task.answer !== q.a) problems.push(`${where}: "${said(task)}" asks ${q?.a}, the task says ${String(task.answer)}`)
      else if (spec101Clock5(q.s) !== bareStart(said(task))) problems.push(`${where}: the start is said "${bareStart(said(task))}", SPEC §10.1 "${spec101Clock5(q.s)}"`)
      const p = task.prompt
      if (p.scene !== 'clock' || p.minutes !== o.s || p.step !== 15 || p.digital === true || drawnAnalog(markupOfPrompt(task)) !== o.s) problems.push(`${where}: the start clock ${JSON.stringify(p)}`)
      if (task.answerType !== 'minutes' || task.modulo !== 720 || task.range.join() !== '0,719') problems.push(`${where}: ${task.answerType} modulo ${task.modulo} range ${task.range}`)
      problems.push(...answerProblems(task))
    }
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('deals three clocks a child can tell apart, exactly one drawn with the answer, a diagnostic clock whenever one counts', () => {
    const problems: string[] = []
    const choice = built.filter((b) => b.kind === 'choice')
    for (const b of choice) {
      problems.push(...cardProblems(b.task, (c) => Number.isInteger(c) && c >= 0 && c < 720))
      problems.push(...drawnCardProblems(b.task, ask(b).a, false))
    }
    problems.push(...diagnosticCardsC(choice, (b) => Object.values(elapsedIdeas(ask(b))).flat(), why))
    expect(first(problems)).toEqual([])
  }, TIMEOUT)

  it('classifies every card and every quarter the dial can set: wrongOperation, halfPastNext from a "halv" start, the start clock an operand', () => {
    expect(first(classifyC(built, why))).toEqual([])
  }, TIMEOUT)

  it('counts as an opportunity exactly the misconceptions a card or the dial can show', () => {
    expect(first(detectableC(built, why))).toEqual([])
  }, TIMEOUT)

  it('has SPEC’s production kind (clockSet: 15/720), ceilings and a fair speed (dial ≥ 18 s)', () => {
    expect(first([...productionProblemsC(built), ...specKindProblemsC(def, built), ...fastProblemsC(def, built)])).toEqual([])
  })

  it('speaks every task and hint with recorded clips, no digits, every time as SPEC §10.1 says it', () => {
    expect(first([
      ...taskSpeechProblems(built), ...all.flatMap((f) => hintProblems(def, f, tags)), ...specificHintProblems(def, all),
      ...normalisationProblems3(def, built, all, tags), ...divisionWordProblems(def, built, all, tags),
    ])).toEqual([])
  }, TIMEOUT)

  it('says the elapsed time truly in every hint and draws the long hand’s sweep between the start and the answer', () => {
    const problems = new Set<string>()
    for (const f of all) {
      const o = elapsedOf(f.id)!
      for (const tag of ownTags(def, f)) for (const p of elapsedHintProblems(o, tag, def.hint(f, tag))) problems.add(`${f.id} hint(${String(tag)}): ${p}`)
    }
    expect(first([...problems])).toEqual([])
  }, TIMEOUT)

  it('starts the dial on its step, never on the answer or a misconception’s clock; a task rebuilt from its id gets the same hint', () => {
    expect(first([...dialStartProblems(built, why), ...rebuiltHintProblems(def, built.filter((_, i) => i % 3 === 0), tags)])).toEqual([])
  }, TIMEOUT)

  // The author's proposal (a dialStart hook, so the dial starts on the start time): GENFIX2's rule for Task.dialStart is
  // on the step, never the answer, never a misconception's clock. The start clock keeps all three for every fact, and
  // a tick without moving the hands is 'operand' (never evidence).
  it('would keep GENFIX2’s three guarantees if the dial started on the start clock (the proposed dialStart hook)', () => {
    const problems: string[] = []
    for (const b of built.filter((x) => x.kind === 'clockSet')) {
      const q = ask(b)
      const t = b.task
      const tag = classifyAnswer(t, q.s)
      if (q.s % 15 !== 0 || isCorrect(t, q.s) || countsAs(t, q.s, why(b, q.s)) !== null || tag !== 'operand') problems.push(`${t.factId}: the start ${q.s} is ${String(tag)}`)
    }
    expect(first(problems)).toEqual([])
  })
})

/** The start as said: "Klokken er kvart over tre. …" → "kvart over tre". */
const bareStart = (text: string): string => (/^Klokken er (.+?)\. /.exec(text)?.[1] ?? '').toLowerCase()

const SPAN_WORDS: Readonly<Record<number, readonly [string, string]>> = {
  60: ['En time efter', 'Den lange viser går en hel gang rundt.'],
  30: ['En halv time efter', 'Den lange viser går en halv gang rundt.'],
  15: ['Et kvarter efter', 'Den lange viser går en kvart gang rundt.'],
  [-30]: ['En halv time før', 'Den lange viser går en halv gang tilbage.'],
}

/**
 * clockElapsed's hint, read: "<span> efter|før <start> er|var klokken <answer>." and the long hand's turn for the span;
 * wrongOperation opens with the direction ("Om lidt er senere, så viserne går frem." / "For lidt siden er tidligere,
 * så viserne går tilbage."), halfPastNext with "Halv H er en halv time før H." for the start's hour. The picture is the
 * long hand's sweep between the start and the answer, exactly the span.
 */
function elapsedHintProblems(o: { s: number; d: number; a: number }, tag: ErrorTag | null, h: HintSpec): string[] {
  const out: string[] = []
  const text = spokenText(h.speech)
  let rest = sentences(text)
  if (tag === 'wrongOperation') {
    const want = o.d > 0 ? 'Om lidt er senere, så viserne går frem.' : 'For lidt siden er tidligere, så viserne går tilbage.'
    if (rest[0] !== want) out.push(`opens "${rest[0]}"`)
    rest = rest.slice(1)
  }
  if (tag === 'halfPastNext') {
    const m = /^Halv (\S+) er en halv time før (\S+)\.$/.exec(rest[0] ?? '')
    if (!m || m[1] !== m[2] || timeOfPhrase5(`halv ${m[2]}`)?.minutes !== o.s) out.push(`opens "${rest[0]}", the start is ${spec101Clock5(o.s)}`)
    rest = rest.slice(1)
  }
  const [lead, hand] = SPAN_WORDS[o.d]
  const m = /^(En time efter|En halv time efter|Et kvarter efter|En halv time før) (.+) (er|var) klokken (.+)\.$/.exec(rest[0] ?? '')
  if (!m || m[1] !== lead || m[2] !== spec101Clock5(o.s) || m[3] !== (o.d > 0 ? 'er' : 'var') || timeOfPhrase5(m[4])?.minutes !== o.a) out.push(`says "${rest[0]}" of ${o.s} ${o.d > 0 ? '+' : ''}${o.d}`)
  if (rest[1] !== hand || rest.length !== 2) out.push(`says "${rest.slice(1).join(' ')}"`)
  const v = h.visual
  const ends = v.scene === 'clockMove' ? [onDial(v.from), onDial(v.to)] : []
  const want = o.d > 0 ? [o.s, o.a] : [o.a, o.s]
  if (v.scene !== 'clockMove' || ends.join() !== want.join() || onDial(v.to - v.from) !== Math.abs(o.d)) out.push(`shows ${JSON.stringify(v)}`)
  return out
}

// ═══ Fact ids across every registered skill (CONVENTIONS) ═══════════════════

describe('fact ids of SK3-MAAL’s five skills (CONVENTIONS, Fact-id’er)', () => {
  const MINE: readonly string[] = ['clockFive', 'clockDigital', 'clockElapsed', 'kronerOre', 'convertCmM']

  it('are unique across every registered skill (instances too), in the format each module documents, one prefix per skill', () => {
    const all = registeredSkills()
    expect(MINE.every((id) => all.some((d) => d.id === id))).toBe(true)
    const prefixes = new Map<string, string>()
    for (const d of all) for (const f of d.enumerate()) prefixes.set(f.id.slice(0, f.id.indexOf(':')), d.id)
    const mine = (p: string) => MINE.some((id) => new RegExp(`\\b${id}\\b`).test(p)) || [...prefixes].some(([pre, id]) => MINE.includes(id) && p.includes(`${pre}:`))
    expect(first(globalIdProblems(all).filter(mine))).toEqual([])
    expect(MINE.map((id) => [...prefixes].filter(([, d]) => d === id).map(([p]) => p))).toEqual([['fem'], ['dig'], ['tid'], ['kro'], ['cmm']])
  }, TIMEOUT)
})

// ═══ The three together (Minuttårnet) ════════════════════════════════════════

describe('the clock skills of 3. klasse together', () => {
  it('ask about different times: a fact id names one skill’s time, and each skill has a prefix of its own', () => {
    const prefixes = new Map<string, string>()
    for (const id of ['clockFive', 'clockDigital', 'clockElapsed'] as const) {
      for (const f of sweepC(registeredSkill(id), 1).all) {
        const p = f.id.slice(0, f.id.indexOf(':'))
        if ((prefixes.get(p) ?? id) !== id) throw new Error(`${p}: ${prefixes.get(p)} and ${id}`)
        prefixes.set(p, id)
      }
    }
    expect([...prefixes].sort()).toEqual([['dig', 'clockDigital'], ['fem', 'clockFive'], ['tid', 'clockElapsed']])
  }, TIMEOUT)
})
