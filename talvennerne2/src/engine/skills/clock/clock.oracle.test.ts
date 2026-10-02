// Oracle tests for the clock skills of 1.–2. klasse (SPEC §15.1): every fact, both kinds, several deals
// each plus one deal aimed at each misconception, compared with clock.oracle.ts — the time read from
// the spoken question, the hands worked out from what the words mean, the wrong clocks from pædagogik §3.2.
import { describe, expect, it, vi } from 'vitest'
import { isCorrect } from '../../answer'
import { classifyAnswer } from '../../misconceptions'
import { registeredSkills } from '../../registry'
import { masteryKeyOf } from '../../tasks'
import type { SkillId } from '../../types'
import { handAngles } from '../../../art/materials/Clock'
import {
  answerProblems, cardProblems, first, hintProblems, registeredSkill, spokenText, tagsToHint, taskSpeechProblems,
} from '../number/number.oracle'
import {
  CLOCK_IDS, CLOCK_STEP, angleGap, askedTime, cardMisconceptions, clockIdOracle, clockMisValues, detectableReachProblems,
  explainClock, expectB, handsAt, handsOfPhrase, isSwappedClock, lookDifferent, normalisationProblems, onDial,
  prefixProblems, productionProblemsB, settable, spec101Clock, specKindProblemsB, sweepB, tagCheck, timeOfPhrase,
} from './clock.oracle'

vi.setConfig({ testTimeout: 240_000 })

const CLOCKS = [
  { id: 'clockHour', prefix: 'hel', facts: 12, families: { hour: 12 } },
  { id: 'clockHalf', prefix: 'halv', facts: 12, families: { half: 12 } },
  { id: 'clockQuarter', prefix: 'kvart', facts: 24, families: { quarterPast: 12, quarterTo: 12 } },
] as const satisfies readonly { id: SkillId; prefix: string; facts: number; families: Record<string, number> }[]

describe('the clock oracle itself', () => {
  it('reads the Danish half form and the quarters as SPEC §10.1 says them', () => {
    expect(timeOfPhrase('tre')?.minutes).toBe(180)
    expect(timeOfPhrase('tolv')?.minutes).toBe(0)
    expect(timeOfPhrase('et')?.minutes).toBe(60)
    expect(timeOfPhrase('halv tre')?.minutes).toBe(150)
    expect(timeOfPhrase('halv et')?.minutes).toBe(30)
    expect(timeOfPhrase('kvart over tre')?.minutes).toBe(195)
    expect(timeOfPhrase('kvart i tre')?.minutes).toBe(165)
    expect(timeOfPhrase('kvart i et')?.minutes).toBe(45)
    expect(timeOfPhrase('kvart over tolv')?.minutes).toBe(15)
    expect(spec101Clock(150)).toBe('halv tre')
    expect(spec101Clock(30)).toBe('halv et')
    expect(spec101Clock(165)).toBe('kvart i tre')
    expect(spec101Clock(75)).toBe('kvart over et')
    expect(spec101Clock(0)).toBe('tolv')
    expect(handsOfPhrase(timeOfPhrase('halv tre')!)).toEqual({ long: 180, short: 75 })
    expect(handsOfPhrase(timeOfPhrase('kvart i tre')!)).toEqual({ long: 270, short: 82.5 })
    // pædagogik §3.2: 3:00 → 12:15
    expect(isSwappedClock(180, 15)).toBe(true)
    expect(isSwappedClock(180, 14)).toBe(false)
    expect(isSwappedClock(180, 30)).toBe(false)
    // halv seks and halv syv: both hands point down, a swapped clock looks like the answer
    expect([...Array(720).keys()].filter((v) => isSwappedClock(390, v))).toEqual([])
  })
})

for (const c of CLOCKS) {
  describe(`${c.id} oracle`, () => {
    const def = registeredSkill(c.id)
    const step = CLOCK_STEP[c.id]!
    const { canon, built } = sweepB(def, 4)
    const said = (text: string, kind: Parameters<typeof askedTime>[1]) => askedTime(text, kind)

    it(`has SPEC §2.2’s ${c.facts} facts in the ${CLOCK_IDS[c.id]} format, one per time, every hour 1–12 named`, () => {
      expect(canon.length).toBe(c.facts)
      const problems: string[] = []
      const ids = new Set<string>()
      for (const f of canon) {
        const o = clockIdOracle(c.id, f.id)
        if (!o) problems.push(`${f.id}: not a time of ${c.id}`)
        else {
          if (o.family !== f.family) problems.push(`${f.id}: family ${f.family}, the id says ${o.family}`)
          if (o.answer !== f.answer) problems.push(`${f.id}: answer ${String(f.answer)}, the id says ${o.answer}`)
        }
        if (ids.has(f.id)) problems.push(`${f.id} twice`)
        ids.add(f.id)
        if (masteryKeyOf(def, f) !== f.id) problems.push(`${f.id}: mastery key ${masteryKeyOf(def, f)}`)
      }
      for (const [family, n] of Object.entries(c.families)) {
        const own = canon.filter((f) => f.family === family)
        if (own.length !== n) problems.push(`${family}: ${own.length} facts, expected ${n}`)
        const hours = new Set(own.map((f) => spec101Clock(Number(f.answer)).split(' ').pop()))
        if (hours.size !== 12) problems.push(`${family}: names ${hours.size} hours`)
      }
      problems.push(...prefixProblems(def, canon, c.prefix))
      expect(first(problems)).toEqual([])
    })

    it('answers every task with the time the question says, on the 12-hour dial (0–719, modulo 720)', () => {
      const problems: string[] = []
      for (const { fact, kind, task } of built) {
        const text = spokenText(task.speech)
        const s = said(text, kind)
        const where = `${fact.id} ${kind}`
        if (!s) problems.push(`${where}: "${text}" is not a clock question`)
        else if (task.answer !== s.minutes) problems.push(`${where}: "${text}" is ${s.minutes}, the task says ${String(task.answer)}`)
        if (task.answerType !== 'minutes' || task.modulo !== 720) problems.push(`${where}: ${task.answerType}, modulo ${task.modulo}`)
        if (task.range[0] !== 0 || task.range[1] !== 719) problems.push(`${where}: range ${task.range}`)
        if (task.tolerance !== 0) problems.push(`${where}: tolerance ${task.tolerance}`)
        problems.push(...answerProblems(task))
        // the same time read on the dial a second time round (14:30 set as halv tre) is right
        if (!isCorrect(task, Number(task.answer) + 720) || classifyAnswer(task, Number(task.answer) + 720) !== null) problems.push(`${where}: ${Number(task.answer) + 720} is not right`)
      }
      expect(first(problems)).toEqual([])
    })

    it('shows the hands of the time said: the right card’s hands, an empty dial to set with the skill’s step, hints at the time', () => {
      const problems: string[] = []
      for (const { fact, kind, task } of built) {
        const s = said(spokenText(task.speech), kind)
        if (!s) continue
        const want = handsOfPhrase(s)
        const where = `${fact.id} ${kind}`
        if (kind === 'choice') {
          if (task.prompt.scene !== 'hear') problems.push(`${where}: a ${task.prompt.scene} prompt beside the clock cards`)
          for (const o of task.options) {
            const drawn = handAngles(Number(o))
            const shows = angleGap(drawn.minute, want.long) < 0.01 && angleGap(drawn.hour, want.short) < 0.01
            if (shows !== isCorrect(task, o)) problems.push(`${where}: card ${String(o)} draws ${JSON.stringify(drawn)}, "${spec101Clock(s.minutes)}" is ${JSON.stringify(want)}`)
          }
        } else {
          const p = task.prompt
          if (p.scene !== 'clock' || p.minutes !== null || p.step !== step || p.h24 === true || p.digital === true) problems.push(`${where}: prompt ${JSON.stringify(p)}`)
        }
      }
      for (const f of canon) {
        for (const tag of [null, ...new Set(def.candidates(f).map((x) => x.tag))]) {
          const v = def.hint(f, tag).visual
          const at = v.scene === 'clock' ? v.minutes : v.scene === 'clockMove' ? v.to : undefined
          if (at === undefined || at === null || onDial(at) !== f.answer) problems.push(`${f.id} hint(${String(tag)}): ${JSON.stringify(v)}`)
        }
      }
      expect(first(problems)).toEqual([])
    })

    it('deals three clocks a child can tell apart, exactly one right, with a diagnostic clock whenever the time has one', () => {
      const problems: string[] = []
      for (const { fact, kind, task } of built) {
        if (kind !== 'choice') continue
        problems.push(...cardProblems(task, (card) => Number.isInteger(card) && card >= 0 && card < 720))
        const cards = task.options.map((o) => handsAt(Number(o)))
        cards.forEach((a, i) => cards.forEach((b, j) => {
          if (i < j && !lookDifferent(a, b)) problems.push(`${fact.id}: cards ${task.options[i]} and ${task.options[j]} look alike`)
        }))
        const s = askedTime(spokenText(task.speech), kind)!
        const known = clockMisValues(c.id, s).filter((v) => {
          const tag = expectB(explainClock(c.id, s, v))
          return tag !== 'plain' && tag !== 'ambiguous'
        })
        if (known.length > 0 && cardMisconceptions(task).length === 0) problems.push(`${fact.id}: no diagnostic clock among [${task.options}] (could be ${known})`)
      }
      expect(first(problems)).toEqual([])
    })

    it('classifies every card and every clock the dial can set by pædagogik §3.2 (A9: the hour heard is ambiguous with a misconception)', () => {
      const problems: string[] = []
      for (const { kind, task } of built) {
        const s = askedTime(spokenText(task.speech), kind)!
        const values = kind === 'choice' ? task.options.map(Number) : settable(step)
        for (const v of values) {
          if (onDial(v) === s.minutes) {
            if (classifyAnswer(task, v) !== null) problems.push(`${task.factId} ${kind} ${v}: the right time classified ${classifyAnswer(task, v)}`)
            continue
          }
          const p = tagCheck(task, v, explainClock(c.id, s, v), kind === 'choice' ? 'card' : 'set')
          if (p) problems.push(p)
        }
      }
      expect(first(problems)).toEqual([])
    })

    it('has SPEC’s production kind (clockSet: step/720) and ceilings (three clocks: box 3)', () => {
      expect(first([...productionProblemsB(built), ...specKindProblemsB(def, built)])).toEqual([])
    })

    it('speaks every task and hint with recorded clips, no digits, and every time as SPEC §10.1 says it', () => {
      const tags = tagsToHint(def, canon)
      expect(first([...taskSpeechProblems(built), ...canon.flatMap((f) => hintProblems(def, f, tags)), ...normalisationProblems(def, built, canon, tags)])).toEqual([])
    })

    /** A clock the dial can be set to: the minute hand on the step. */
    const reach = (_t: unknown, v: number | string) => typeof v === 'number' && onDial(v) % step === 0
    // ORK2b finding (clockHour, clockHalf): handsSwapped is listed as detectable on clockSet, but a dial that
    // snaps to whole (60) or half (30) hours can never show the swapped clock (12:15, 6:13). Every clockSet
    // task is a fake opportunity, and since a flag needs ≥ 2 production hits (SPEC §4.3), handsSwapped can
    // never be flagged in these skills. candidatesFor(fact, 'clockSet') could leave it out.
    const reachTest = c.id === 'clockQuarter' ? it : it.fails
    reachTest('lists only misconceptions the dial can set as clockSet opportunities (SPEC §4.3)', () => {
      expect(first(detectableReachProblems(built.filter((b) => b.kind === 'clockSet'), reach))).toEqual([])
    })
  })
}

describe('clock fact ids across every registered skill (CONVENTIONS)', () => {
  it('are unique across all registered skills, and each clock skill has a prefix of its own', () => {
    const owner = new Map<string, SkillId>()
    const prefixes = new Map<string, Set<SkillId>>()
    const problems: string[] = []
    for (const def of registeredSkills()) {
      for (const f of def.enumerate()) {
        const prev = owner.get(f.id)
        if (prev !== undefined && prev !== def.id) problems.push(`${f.id}: ${prev} and ${def.id}`)
        owner.set(f.id, def.id)
        const p = f.id.slice(0, f.id.indexOf(':'))
        prefixes.set(p, (prefixes.get(p) ?? new Set()).add(def.id))
      }
    }
    for (const c of CLOCKS) {
      const own = [...prefixes].filter(([, s]) => s.has(c.id))
      if (own.length !== 1 || own[0][1].size !== 1) problems.push(`${c.id}: prefixes ${own.map(([p, s]) => `${p} (${[...s]})`)}`)
    }
    expect(first(problems)).toEqual([])
  })

  it('shows misconception values that look different from the answer and are not the step’s own times (a check of the oracle)', () => {
    // every clockHalf time: halfPastNext and hourHandMisread are half hours, the swapped clock never is
    const half = registeredSkill('clockHalf')
    for (const f of half.enumerate()) {
      const s = timeOfPhrase(spec101Clock(Number(f.answer)))!
      const vals = clockMisValues('clockHalf', s)
      expect(vals.filter((v) => explainClock('clockHalf', s, v).mis.length > 1), f.id).toEqual([])
      expect(vals.filter((v) => v % 30 === 0).sort((a, b) => a - b), f.id).toEqual([onDial(s.minutes - 60), onDial(s.minutes + 60)].sort((a, b) => a - b))
    }
  })
})
