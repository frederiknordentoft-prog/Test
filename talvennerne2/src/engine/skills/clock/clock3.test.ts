// Tests for the clock skills of 3. klasse: clockFive, clockDigital and clockElapsed (SK3-MAAL). The shared
// contract (number/testing/harness.ts) runs every fact, 200 seeded instances per family and every kind
// through the real task builder, with the answer read back from the spoken Danish (and, where the child
// reads an analog clock, from the clock shown); the blocks below add the dial (modulo 720, 24 hours on the
// digital cards), the misconceptions and their hints, production per kind and the clips.
import { describe, expect, it } from 'vitest'
import clockFiveModule from './clockFive'
import clockDigitalModule from './clockDigital'
import clockElapsedModule from './clockElapsed'
import { swappedHands } from './kit'
import { factsUnderTest, globalIdCheck, skillContract, speechProblems, tasksUnderTest } from '../number/testing/harness'
import { isMisconception } from '../number/kit'
import { buildTask } from '../../tasks'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, guessP, isProduction } from '../../kinds'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import { clipInfo } from '../../../speech/catalog'
import { clips as CLOCK3 } from '../../../speech/clips/skills/clock3'
import type { Fact, SkillDef, Task, TaskKind } from '../../types'

const five: SkillDef = clockFiveModule
const digital: SkillDef = clockDigitalModule
const elapsed: SkillDef = clockElapsedModule
const ALL = [five, digital, elapsed] as const

const dial = (m: number) => ((m % 720) + 720) % 720

// ─── Danish times, read without src/speech ────────────────────────────────

const SMALL = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten', 'tyve']
const TENS: Readonly<Record<string, number>> = { tyve: 20, tredive: 30, fyrre: 40, halvtreds: 50 }

/** "femogfyrre" → 45, "et" → 1. */
function wordNumber(w: string): number {
  if (w === 'et') return 1
  if (SMALL.includes(w)) return SMALL.indexOf(w)
  if (w in TENS) return TENS[w]
  const m = /^(en|to|tre|fire|fem|seks|syv|otte|ni)og(tyve|tredive|fyrre|halvtreds)$/.exec(w)
  if (!m) throw new Error(`no number in "${w}"`)
  return SMALL.indexOf(m[1]) + TENS[m[2]]
}

/** An analog phrase on the dial: "fem minutter i halv tre" is 2:25, "ti minutter over halv tre" 2:40. */
function phraseMinutes(phrase: string): number {
  const w = phrase.split(' ')
  const hour = (wordNumber(w[w.length - 1]) % 12) * 60
  const base = w.includes('halv') ? hour - 30 : hour
  if (w[0] === 'kvart') return dial(base + (w[1] === 'over' ? 15 : -15))
  if (w[1] !== 'minutter') return dial(base)
  return dial(base + (w[2] === 'over' ? 1 : -1) * wordNumber(w[0]))
}

/** A digital time as said: "fjorten femogfyrre" 14:45, "tolv nul fem" 12:05. */
function digitalMinutes(words: string): number {
  const w = words.split(' ')
  return wordNumber(w[0]) * 60 + wordNumber(w[1] === 'nul' ? w[2] : w[1])
}

const text = (t: Task) => compile(t.speech).text

/** The time a task asks for, worked out from what the child hears, or the analog clock it reads. */
function asked(def: SkillDef, task: Task): number {
  const s = text(task)
  if (def === five) return phraseMinutes(/klokken (?:er )?(.+)\.$/.exec(s)![1])
  if (def === digital) {
    const shown = /^Det digitale ur viser (.+)\. Stil/.exec(s)
    if (shown) return task.family === 'digital24' ? digitalMinutes(shown[1]) : dial(digitalMinutes(shown[1]))
    const said = /^Klokken er (.+) om (eftermiddagen|aftenen)\./.exec(s)
    if (said) return phraseMinutes(said[1]) + 720
    return task.prompt.scene === 'clock' && task.prompt.minutes !== null ? task.prompt.minutes : NaN
  }
  const start = phraseMinutes(/^Klokken er (.+?)\. /.exec(s)![1])
  const d = /om en time/.test(s) ? 60 : /om en halv time/.test(s) ? 30 : /om et kvarter/.test(s) ? 15 : /for en halv time siden/.test(s) ? -30 : NaN
  return dial(start + d)
}

const fact = (def: SkillDef, id: string): Fact => {
  const canon = def.enumerate().find((f) => f.id === id)
  if (canon) return canon
  // an instance, rebuilt from its id the way the round screen does (src/ui/hint/hintFor.ts factFor)
  return { id, skill: def.id, family: id.split(':')[1], operands: [], answer: Number(id.split(':')[2]), rank: 0 }
}
const build = (def: SkillDef, id: string, kind: TaskKind, seed = 1): Task => buildTask(def, fact(def, id), kind, makeRng(seed), 0).task

describe('clock skills of 3. klasse: the contract', () => {
  globalIdCheck()
  const answerOf = (def: SkillDef) => (_f: Fact, _k: TaskKind, task: Task) => asked(def, task)
  skillContract(five, { families: { over: 20, iHalv: 12, overHalv: 12, i: 20, halfForm: 20 }, answerOf: answerOf(five) })
  skillContract(digital, { families: { analogToDigital: 20, digital24: 20 }, answerOf: answerOf(digital) })
  skillContract(elapsed, { families: { plusHour: 20, plusHalf: 20, plusQuarter: 20, minusHalf: 20 }, answerOf: answerOf(elapsed) })
})

// ─── Facts ──────────────────────────────────────────────────────────────────

describe('the facts', () => {
  it('clockFive: the five-minute times of each family, on the dial, named fem:<family>:<m>', () => {
    const past = { over: [5, 10, 20], iHalv: [25], overHalv: [35], i: [40, 50, 55], halfForm: [20, 40] } as Record<string, number[]>
    const seen: Record<string, Set<number>> = {}
    for (const f of factsUnderTest(five)) {
      const t = Number(f.answer)
      expect(f.id).toBe(`fem:${f.family}:${t}`)
      expect(t >= 0 && t < 720, f.id).toBe(true)
      expect(past[f.family], f.id).toContain(t % 60)
      ;(seen[f.family] ??= new Set()).add(t)
    }
    // every hour and every minute of the family comes up among the instances
    for (const [family, minutes] of Object.entries(past)) expect(seen[family].size, family).toBe(12 * minutes.length)
    expect(five.enumerate().filter((f) => f.family === 'iHalv').map((f) => f.answer).sort((a, b) => Number(a) - Number(b)))
      .toEqual(Array.from({ length: 12 }, (_, h) => h * 60 + 25))
  })

  it('clockDigital: 12-hour times in five-minute steps, and afternoon and evening times 13:00–23:55', () => {
    for (const f of factsUnderTest(digital)) {
      const t = Number(f.answer)
      expect(f.id).toBe(`dig:${f.family}:${t}`)
      expect(t % 5, f.id).toBe(0)
      if (f.family === 'digital24') expect(t >= 780 && t <= 1435, f.id).toBe(true)
      else expect(t >= 0 && t < 720, f.id).toBe(true)
    }
  })

  it('clockElapsed: a quarter-hour start and the time a fixed step away', () => {
    const step = { plusHour: 60, plusHalf: 30, plusQuarter: 15, minusHalf: -30 } as Record<string, number>
    for (const f of factsUnderTest(elapsed)) {
      const s = Number(f.id.split(':')[2])
      expect(f.id).toBe(`tid:${f.family}:${s}`)
      expect(s % 15 === 0 && s >= 0 && s < 720, f.id).toBe(true)
      expect(f.answer, f.id).toBe(dial(s + step[f.family]))
    }
  })

  it('introduces the families in SPEC order', () => {
    for (const def of ALL) {
      const order = [...def.enumerate()].sort((a, b) => a.rank - b.rank).map((f) => f.family)
      expect([...new Set(order)]).toEqual(def.families.map((fam) => fam.id))
    }
  })
})

// ─── Tasks ──────────────────────────────────────────────────────────────────

describe('the tasks', () => {
  const tasks = ALL.flatMap((def) => tasksUnderTest(def).map((t) => ({ ...t, def })))

  it('clockFive asks with the voice on cards and on an empty five-minute dial, the half form with "halv"', () => {
    for (const { def, kind, task } of tasks) {
      if (def !== five) continue
      expect([task.answerType, task.modulo, task.optionView]).toEqual(['minutes', 720, 'clock'])
      expect(task.prompt).toEqual(kind === 'clockSet' ? { scene: 'clock', minutes: null, step: 5, h24: false } : { scene: 'hear' })
    }
    expect(text(build(five, 'fem:iHalv:145', 'clockSet'))).toBe('Stil uret, så klokken er fem minutter i halv tre.')
    expect(text(build(five, 'fem:over:185', 'choice'))).toBe('Find uret, der viser klokken fem minutter over tre.')
    expect(text(build(five, 'fem:i:170', 'choice'))).toBe('Find uret, der viser klokken ti minutter i tre.')
    expect(text(build(five, 'fem:overHalv:155', 'clockSet'))).toBe('Stil uret, så klokken er fem minutter over halv tre.')
    expect(text(build(five, 'fem:over:200', 'clockSet'))).toBe('Stil uret, så klokken er tyve minutter over tre.')
    expect(text(build(five, 'fem:halfForm:200', 'clockSet'))).toBe('Stil uret, så klokken er ti minutter i halv fire.')
    expect(text(build(five, 'fem:halfForm:220', 'choice'))).toBe('Find uret, der viser klokken ti minutter over halv fire.')
    expect(compile(build(five, 'fem:halfForm:220', 'choice').speech).clips).toContain('t.half.220')
  })

  it('clockDigital reads an analog clock onto digital cards, and sets the dial from a digital clock read aloud', () => {
    for (const { def, kind, fact: f, task } of tasks) {
      if (def !== digital) continue
      const t = Number(f.answer)
      const h24 = f.family === 'digital24'
      expect(task.answerType).toBe('minutes')
      if (kind === 'choice') {
        expect(task.prompt).toEqual({ scene: 'clock', minutes: t, step: 5 })
        expect(task.optionView).toBe('clockDigital')
        // the digital cards count 24 hours: 2:45 is no answer to 14:45
        expect(task.modulo).toBe(h24 ? 1440 : 720)
        if (h24) expect(isCorrect(task, t - 720)).toBe(false)
      } else {
        expect(task.prompt).toEqual({ scene: 'clock', minutes: t, step: 5, digital: true, h24 })
        expect(task.modulo).toBe(720)
        // the dial cannot tell 2:45 from 14:45 (CONVENTIONS)
        expect(isCorrect(task, dial(t))).toBe(true)
      }
    }
    expect(text(build(digital, 'dig:digital24:885', 'clockSet'))).toBe('Det digitale ur viser fjorten femogfyrre. Stil uret, så det viser det samme.')
    expect(text(build(digital, 'dig:digital24:885', 'choice'))).toBe('Klokken er kvart i tre om eftermiddagen. Find det digitale ur, der viser det samme.')
    expect(text(build(digital, 'dig:digital24:1230', 'choice'))).toBe('Klokken er halv ni om aftenen. Find det digitale ur, der viser det samme.')
    expect(text(build(digital, 'dig:analogToDigital:5', 'clockSet'))).toBe('Det digitale ur viser tolv nul fem. Stil uret, så det viser det samme.')
    expect(text(build(digital, 'dig:analogToDigital:165', 'clockSet'))).toBe('Det digitale ur viser to femogfyrre. Stil uret, så det viser det samme.')
    expect(text(build(digital, 'dig:analogToDigital:165', 'choice'))).toBe('Find det digitale ur, der viser det samme.')
  })

  it('clockElapsed shows and says the start, and asks for the time a step later or earlier', () => {
    for (const { def, kind, fact: f, task } of tasks) {
      if (def !== elapsed) continue
      expect(task.prompt).toEqual({ scene: 'clock', minutes: Number(f.id.split(':')[2]), step: 15 })
      expect([task.modulo, task.optionView]).toEqual([720, 'clock'])
      expect(text(task)).toMatch(kind === 'clockSet' ? /^Klokken er .+\. Stil uret, så det viser, hvad klokken / : /^Klokken er .+\. Hvad (er|var) klokken /)
    }
    expect(text(build(elapsed, 'tid:plusHalf:195', 'choice'))).toBe('Klokken er kvart over tre. Hvad er klokken om en halv time?')
    expect(text(build(elapsed, 'tid:minusHalf:150', 'clockSet'))).toBe('Klokken er halv tre. Stil uret, så det viser, hvad klokken var for en halv time siden.')
    expect(build(elapsed, 'tid:plusQuarter:705', 'choice').answer).toBe(0)
  })

  it('never shows a card that is the answer on the clock face, and every card is a different clock', () => {
    for (const { task } of tasks) {
      if (task.kind !== 'choice') continue
      const face = (v: number) => (task.modulo === 1440 ? v : dial(v))
      expect(new Set(task.options.map((o) => face(Number(o)))).size).toBe(3)
      for (const o of task.options) if (o !== task.answer) expect(isCorrect(task, o)).toBe(false)
    }
  })

  it('is production on the dial (its step out of 720) and capped at box 3 on cards', () => {
    for (const { def, kind, task } of tasks) {
      if (kind === 'clockSet') {
        expect(guessP(task)).toBeCloseTo((def === elapsed ? 15 : 5) / 720)
        expect([isProduction(task), ceilingFor(task)]).toEqual([true, 5])
      } else {
        expect(guessP(task)).toBeCloseTo(1 / 3)
        expect(ceilingFor(task)).toBe(3)
      }
    }
  })

  it('starts the dial on its step, never on the answer or a misconception\'s clock', () => {
    for (const { kind, task } of tasks) {
      if (kind !== 'clockSet') continue
      const step = task.prompt.scene === 'clock' ? task.prompt.step : 0
      const s = task.dialStart!
      expect(s % step, task.factId).toBe(0)
      expect(isCorrect(task, s), task.factId).toBe(false)
      expect(isMisconception(classifyAnswer(task, s)), task.factId).toBe(false)
    }
  })

  it('uses only five-minute clocks the dial can set as its misconceptions there', () => {
    for (const { kind, task } of tasks) {
      if (kind !== 'clockSet') continue
      const step = task.prompt.scene === 'clock' ? task.prompt.step : 0
      expect(Object.keys(task.distractorTags).filter((k) => Number(k) % step !== 0), task.factId).toEqual([])
    }
  })
})

// ─── Misconceptions ─────────────────────────────────────────────────────────

describe('misconceptions', () => {
  it('clockFive: "over" and "i" swapped, "halv" as the hour after, the short hand near the hour, the hands swapped', () => {
    for (const kind of ['clockSet', 'choice'] as const) {
      const iHalv = build(five, 'fem:iHalv:145', kind)
      expect(classifyAnswer(iHalv, 205)).toBe('halfPastNext')
      expect(classifyAnswer(iHalv, 205 + 720)).toBe('halfPastNext')
      expect(classifyAnswer(iHalv, 155)).toBe('quarterDirection')
      expect(classifyAnswer(iHalv, 180)).toBe('operand')
      expect(classifyAnswer(iHalv, 150)).toBe('near')
      expect(classifyAnswer(iHalv, 500)).toBe('other')
      const i = build(five, 'fem:i:170', kind)
      expect(classifyAnswer(i, 190)).toBe('quarterDirection')
      expect(classifyAnswer(i, 110)).toBe('hourHandMisread')
      expect(classifyAnswer(i, 180)).toBe('operand')
      const half = build(five, 'fem:halfForm:200', kind)
      expect([classifyAnswer(half, 260), classifyAnswer(half, 220), classifyAnswer(half, 240)]).toEqual(['halfPastNext', 'quarterDirection', 'operand'])
      // fem minutter over tre with the hands swapped is 1:15: on five minutes, so the dial can set it too
      expect(swappedHands(185)).toBe(75)
      expect(classifyAnswer(build(five, 'fem:over:185', kind), 75)).toBe('handsSwapped')
      expect(classifyAnswer(build(five, 'fem:over:185', kind), 175)).toBe('quarterDirection')
    }
    // ti minutter over tre swapped is 4:01–4:02: a card, never a dial
    const ten = swappedHands(190)!
    expect(ten % 5).not.toBe(0)
    expect(classifyAnswer(build(five, 'fem:over:190', 'choice'), ten)).toBe('handsSwapped')
    expect(classifyAnswer(build(five, 'fem:over:190', 'clockSet'), ten)).toBe('other')
  })

  it('clockDigital: the short hand read as the next hour, the hands swapped, "halv", and 24 hours read as 12', () => {
    const read = build(digital, 'dig:analogToDigital:165', 'choice')
    expect(classifyAnswer(read, 225)).toBe('hourHandMisread')
    expect(classifyAnswer(read, 129)).toBe('other')
    const set = build(digital, 'dig:analogToDigital:165', 'clockSet')
    expect(classifyAnswer(set, 105)).toBe('hourHandMisread')
    expect(classifyAnswer(set, 550)).toBe('handsSwapped')
    expect(classifyAnswer(build(digital, 'dig:analogToDigital:130', 'clockSet'), 170)).toBe('other')
    const after = build(digital, 'dig:digital24:885', 'choice')
    expect(classifyAnswer(after, 165)).toBe('operand')
    expect(classifyAnswer(after, 285)).toBe('other')
    expect(classifyAnswer(after, 945)).toBe('near')
    expect(classifyAnswer(build(digital, 'dig:digital24:870', 'choice'), 930)).toBe('halfPastNext')
    const set24 = build(digital, 'dig:digital24:885', 'clockSet')
    expect(classifyAnswer(set24, 165)).toBeNull()
    expect([classifyAnswer(set24, 105), classifyAnswer(set24, 550), classifyAnswer(set24, 285)]).toEqual(['hourHandMisread', 'handsSwapped', 'other'])
  })

  it('clockElapsed: the hands turned the wrong way, a "halv" start taken as the hour after, the clock not moved', () => {
    for (const kind of ['clockSet', 'choice'] as const) {
      const t = build(elapsed, 'tid:plusHalf:195', kind)
      expect(t.answer).toBe(225)
      expect([classifyAnswer(t, 165), classifyAnswer(t, 195), classifyAnswer(t, 240)]).toEqual(['wrongOperation', 'operand', 'near'])
      // 3:45 + ½ h set as 3:15 is the hour forgotten as likely as the hands turned back: never evidence
      expect(classifyAnswer(build(elapsed, 'tid:plusHalf:225', kind), 195)).toBe('near')
      const half = build(elapsed, 'tid:plusHour:150', kind)
      expect([classifyAnswer(half, 270), classifyAnswer(half, 90)]).toEqual(['halfPastNext', 'wrongOperation'])
      expect(classifyAnswer(build(elapsed, 'tid:minusHalf:165', kind), 195)).toBe('wrongOperation')
      // halv tre minus a half hour: 3:00 is the hands turned forward and halv tre taken as 3:30 alike
      expect(classifyAnswer(build(elapsed, 'tid:minusHalf:150', kind), 180)).toBe('ambiguous')
    }
  })

  it('offers on the dial what the dial can set, and on cards what the cards show', () => {
    const detectable = (def: SkillDef, kind: TaskKind) => new Set(tasksUnderTest(def).filter((t) => t.kind === kind).flatMap((t) => detectableOf(t.task)))
    expect([...detectable(five, 'clockSet')].sort()).toEqual(['halfPastNext', 'handsSwapped', 'hourHandMisread', 'quarterDirection'])
    expect([...detectable(digital, 'clockSet')].sort()).toEqual(['handsSwapped', 'hourHandMisread'])
    expect([...detectable(digital, 'choice')].sort()).toEqual(['halfPastNext', 'handsSwapped', 'hourHandMisread'])
    expect([...detectable(elapsed, 'clockSet')].sort()).toEqual(['halfPastNext', 'wrongOperation'])
  })

  it('clockFive never needs A9: no two misconceptions share a clock, and none is the hour that was said', () => {
    for (const f of factsUnderTest(five)) {
      const cands = five.candidates(f)
      expect(cands.some((c) => c.tag === 'ambiguous'), f.id).toBe(false)
      expect(cands.filter((c) => c.tag === 'operand'), f.id).toHaveLength(1)
    }
  })
})

// ─── Hints ──────────────────────────────────────────────────────────────────

describe('strategy hints', () => {
  const said = (def: SkillDef, id: string, tag: string | null) => compile(def.hint(fact(def, id), tag as never).speech).text

  it('says what the phrase counts from and where the long hand points', () => {
    expect(said(five, 'fem:over:185', null)).toBe('Fem minutter over tre er fem minutter efter tre. Den lange viser peger på et.')
    expect(said(five, 'fem:i:170', null)).toBe('Ti minutter i tre er ti minutter før tre. Den lange viser peger på ti.')
    expect(said(five, 'fem:iHalv:145', null)).toBe('Fem minutter i halv tre er fem minutter før halv tre. Den lange viser peger på fem.')
    expect(said(five, 'fem:halfForm:220', null)).toBe('Ti minutter over halv fire er ti minutter efter halv fire. Den lange viser peger på otte.')
    expect(said(five, 'fem:i:710', null)).toBe('Ti minutter i tolv er ti minutter før tolv. Den lange viser peger på ti.')
    expect(said(five, 'fem:i:170', 'quarterDirection')).toBe('Over betyder efter, og i betyder før. Ti minutter i tre er ti minutter før tre. Den lange viser peger på ti.')
    expect(said(five, 'fem:i:170', 'hourHandMisread')).toBe('Se godt på den lille viser. Ved ti minutter i tre er den endnu ikke nået til tre.')
    expect(said(five, 'fem:iHalv:145', 'halfPastNext')).toMatch(/^Halv tre er en halv time før tre\. Fem minutter i halv tre/)
    expect(five.hint(fact(five, 'fem:iHalv:145'), 'halfPastNext')).toMatchObject({ animated: true, visual: { scene: 'clockMove', from: 120, to: 145 } })
    expect(five.hint(fact(five, 'fem:over:185'), null).visual).toEqual({ scene: 'clockMove', from: 180, to: 185 })
    expect(five.hint(fact(five, 'fem:i:170'), null).visual).toEqual({ scene: 'clock', minutes: 170, step: 5 })
  })

  it('reads the analog clock in hours and minutes, and 24 hours as hours after twelve', () => {
    expect(said(digital, 'dig:analogToDigital:165', null)).toBe('Den lille viser er gået forbi to. Den lange viser peger på ni og det er femogfyrre minutter. Det digitale ur viser to femogfyrre.')
    expect(said(digital, 'dig:analogToDigital:180', null)).toBe('Den lille viser peger på tre. Den lange viser peger på tolv og det er nul minutter. Det digitale ur viser tre nul nul.')
    expect(said(digital, 'dig:digital24:885', null)).toBe('Fjorten minus tolv giver to. Så er klokken kvart i tre om eftermiddagen.')
    expect(said(digital, 'dig:digital24:1230', 'halfPastNext')).toBe('Halv ni er en halv time før ni. Tyve minus tolv giver otte. Så er klokken halv ni om aftenen.')
    expect(said(digital, 'dig:analogToDigital:165', 'hourHandMisread')).toBe('Se godt på den lille viser. Ved kvart i tre er den endnu ikke nået til tre.')
  })

  it('counts the time on from the start (or back), with the minute hand\'s sweep', () => {
    expect(said(elapsed, 'tid:plusHalf:195', null)).toBe('En halv time efter kvart over tre er klokken kvart i fire. Den lange viser går en halv gang rundt.')
    expect(said(elapsed, 'tid:minusHalf:165', 'wrongOperation')).toBe('For lidt siden er tidligere, så viserne går tilbage. En halv time før kvart i tre var klokken kvart over to. Den lange viser går en halv gang tilbage.')
    expect(said(elapsed, 'tid:plusHour:150', 'halfPastNext')).toBe('Halv tre er en halv time før tre. En time efter halv tre er klokken halv fire. Den lange viser går en hel gang rundt.')
    expect(elapsed.hint(fact(elapsed, 'tid:plusHalf:195'), null).visual).toEqual({ scene: 'clockMove', from: 195, to: 225 })
    expect(elapsed.hint(fact(elapsed, 'tid:minusHalf:165'), null).visual).toEqual({ scene: 'clockMove', from: 135, to: 165 })
  })

  it('answers each misconception with its own hint, animated only for halfPastNext, the same from a rebuilt fact', () => {
    for (const def of ALL) {
      for (const { fact: f, kind, task } of tasksUnderTest(def).filter((_, i) => i % 3 === 0)) {
        const rebuilt: Fact = { id: task.factId, skill: task.skill, family: task.family, operands: [], answer: task.answer, rank: 0 }
        for (const tag of [null, 'near', 'operand', 'other', 'ambiguous', ...new Set(Object.values(task.distractorTags))] as const) {
          const h = def.hint(f, tag, kind)
          expect(h.misconception ?? null, `${f.id} ${String(tag)}`).toBe(isMisconception(tag) ? tag : null)
          expect(h.animated ?? false).toBe(tag === 'halfPastNext')
          expect(speechProblems(h.speech)).toEqual([])
          expect(def.hint(rebuilt, tag, kind)).toEqual(h)
        }
      }
    }
  })
})

// ─── Clips ──────────────────────────────────────────────────────────────────

describe('clips', () => {
  it('are wave 3 in the clock sprite of wave 3, without digits, and the times are the catalogue\'s', () => {
    for (const [id, words] of Object.entries(CLOCK3)) {
      expect(words, id).not.toMatch(/\d/)
      expect(clipInfo(id), id).toMatchObject({ wave: 3, pack: 'clock-3' })
    }
    for (const f of factsUnderTest(five, 30)) {
      const t = Number(f.answer)
      expect(clipInfo(f.family === 'halfForm' ? `t.half.${t}` : `t.end.${t}`)?.wave, f.id).toBe(3)
    }
  })
})
