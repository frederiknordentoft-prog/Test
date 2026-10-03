// Tests for the clock skills of 1.–2. klasse: clockHour, clockHalf and clockQuarter (SK2-CM). The shared
// contract (number/testing/harness.ts) runs every fact and kind through the real task builder; the
// blocks below add the answer read back from the spoken Danish, the dial (modulo 720), the
// misconceptions and their hints, production and ceilings per kind, and the clock regions.
import { describe, expect, it } from 'vitest'
import clockHourModule from './clockHour'
import clockHalfModule from './clockHalf'
import clockQuarterModule from './clockQuarter'
import { swappedHands } from './kit'
import { flagsRaised, globalIdCheck, skillContract, speechProblems, tasksUnderTest } from '../number/testing/harness'
import { isMisconception } from '../number/kit'
import { buildTask } from '../../tasks'
import { classifyAnswer, detectableOf } from '../../misconceptions'
import { isCorrect } from '../../answer'
import { ceilingFor, guessP, isProduction } from '../../kinds'
import { keysForNode } from '../../registry'
import { planRound } from '../../plan'
import { newProfile } from '../../testing/profile'
import { makeRng } from '../../rng'
import { compile } from '../../../speech/compile'
import { clipInfo } from '../../../speech/catalog'
import { clips as CLOCK_CLIPS } from '../../../speech/clips/skills/clock'
import { NODES } from '../../../content/curriculum'
import type { AnswerValue, Fact, SkillDef, Task, TaskKind } from '../../types'

const clockHour: SkillDef = clockHourModule
const clockHalf: SkillDef = clockHalfModule
const clockQuarter: SkillDef = clockQuarterModule
const ALL = [clockHour, clockHalf, clockQuarter] as const

const HOURS = ['et', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve', 'tolv']
const dial = (m: number) => ((m % 720) + 720) % 720

/**
 * The time a sentence names, read from the Danish words alone (not from the skill's code): "… klokken
 * tre." is 3:00, "halv tre" 2:30, "kvart over tre" 3:15, "kvart i tre" 2:45.
 */
function minutesSaid(text: string): number {
  const m = /klokken (?:er )?(halv |kvart over |kvart i )?([a-zæøå]+)\.$/.exec(text)
  if (!m) throw new Error(`no time in "${text}"`)
  const hour = HOURS.indexOf(m[2]) + 1
  if (hour === 0) throw new Error(`no hour in "${text}"`)
  const whole = (hour % 12) * 60
  const shift = m[1] === 'halv ' ? -30 : m[1] === 'kvart over ' ? 15 : m[1] === 'kvart i ' ? -15 : 0
  return dial(whole + shift)
}

const text = (t: Task) => compile(t.speech).text
const fact = (def: SkillDef, id: string): Fact => {
  const f = def.enumerate().find((x) => x.id === id)
  if (!f) throw new Error(`${def.id} has no ${id}`)
  return f
}
const build = (def: SkillDef, id: string, kind: TaskKind, seed = 1): Task => buildTask(def, fact(def, id), kind, makeRng(seed), 0).task

describe('clock skills of 1.–2. klasse: the contract', () => {
  globalIdCheck()
  const said = (_f: Fact, _k: TaskKind, task: Task) => minutesSaid(text(task))
  skillContract(clockHour, { families: { hour: 12 }, answerOf: said })
  skillContract(clockHalf, { families: { half: 12 }, answerOf: said })
  skillContract(clockQuarter, { families: { quarterPast: 12, quarterTo: 12 }, answerOf: said })
})

describe('the facts', () => {
  it('has every whole, half and quarter hour once, named by its dial position', () => {
    const ids = (def: SkillDef) => def.enumerate().map((f) => f.id).sort()
    const every = (prefix: string, offset: number) => HOURS.map((_, i) => `${prefix}:${dial((i + 1) * 60 + offset)}`).sort()
    expect(ids(clockHour)).toEqual(every('hel', 0))
    expect(ids(clockHalf)).toEqual(every('halv', -30))
    expect(ids(clockQuarter)).toEqual([...every('kvart', 15), ...every('kvart', -15)].sort())
    for (const f of clockQuarter.enumerate()) expect(f.family).toBe(Number(f.answer) % 60 === 15 ? 'quarterPast' : 'quarterTo')
    expect(fact(clockHalf, 'halv:150').operands).toEqual([3])
  })

  it('introduces the hours the dial is built on first', () => {
    const first = (def: SkillDef) => [...def.enumerate()].sort((a, b) => a.rank - b.rank).slice(0, 4).map((f) => f.operands[0])
    for (const def of ALL) expect(first(def)).toEqual([3, 6, 9, 12])
    const quarter = [...clockQuarter.enumerate()].sort((a, b) => a.rank - b.rank)
    expect(quarter.slice(0, 12).every((f) => f.family === 'quarterPast')).toBe(true)
  })
})

// ─── Tasks ──────────────────────────────────────────────────────────────────

describe('the tasks', () => {
  const tasks = ALL.flatMap((def) => tasksUnderTest(def).map((t) => ({ ...t, def })))
  const STEP = { clockHour: 60, clockHalf: 30, clockQuarter: 15 } as const

  it('asks with the voice on cards and on an empty dial in clockSet, at the skill\'s step, analog', () => {
    for (const { def, kind, task } of tasks) {
      expect(task.answerType).toBe('minutes')
      expect(task.modulo).toBe(720)
      expect(task.range).toEqual([0, 719])
      expect(task.optionView).toBe('clock')
      if (kind === 'clockSet') {
        expect(task.prompt).toEqual({ scene: 'clock', minutes: null, step: STEP[def.id as keyof typeof STEP], h24: false })
        expect(text(task)).toMatch(/^Stil uret, så klokken er /)
      } else {
        expect(task.prompt).toEqual({ scene: 'hear' })
        expect(text(task)).toMatch(/^Find uret, der viser klokken /)
      }
    }
    expect(text(build(clockHalf, 'halv:150', 'choice'))).toBe('Find uret, der viser klokken halv tre.')
    expect(text(build(clockQuarter, 'kvart:165', 'clockSet'))).toBe('Stil uret, så klokken er kvart i tre.')
    expect(text(build(clockHour, 'hel:60', 'clockSet'))).toBe('Stil uret, så klokken er et.')
    expect(text(build(clockQuarter, 'kvart:15', 'choice'))).toBe('Find uret, der viser klokken kvart over tolv.')
  })

  it('never shows a card that is the answer on the dial, and every card is a different clock', () => {
    for (const { task } of tasks) {
      const dials = task.options.map((o) => dial(Number(o)))
      expect(new Set(dials).size).toBe(task.options.length)
      for (const o of task.options) {
        if (o === task.answer) continue
        expect(dial(Number(o))).not.toBe(dial(Number(task.answer)))
        expect(isCorrect(task, Number(o) + 720)).toBe(false)
      }
      // 15:00 on an analog dial is 3:00
      expect(isCorrect(task, Number(task.answer) + 720)).toBe(true)
    }
  })

  it('keeps every candidate on the dial (0–719), so a tag never hides behind modulo', () => {
    for (const def of ALL) {
      for (const f of def.enumerate()) {
        for (const c of def.candidates(f)) {
          expect(Number(c.value)).toBeGreaterThanOrEqual(0)
          expect(Number(c.value)).toBeLessThan(720)
          expect(c.value).not.toBe(f.answer)
        }
      }
    }
  })

  it('shows a diagnostic card on every choice where the fact has one', () => {
    for (const { fact: f, kind, task } of tasks) {
      if (kind !== 'choice') continue
      const has = Object.values(task.distractorTags).some((t) => isMisconception(t))
      const shown = task.options.some((o) => isMisconception(task.distractorTags[String(o)]))
      expect(shown, f.id).toBe(has)
    }
  })

  it('is production on the dial and capped at box 3 on cards', () => {
    for (const { def, kind, task } of tasks) {
      if (kind === 'clockSet') {
        expect(guessP(task)).toBeCloseTo(STEP[def.id as keyof typeof STEP] / 720)
        expect(isProduction(task)).toBe(true)
        expect(ceilingFor(task)).toBe(5)
      } else {
        expect(guessP(task)).toBeCloseTo(1 / 3)
        expect(isProduction(task)).toBe(false)
        expect(ceilingFor(task)).toBe(3)
      }
    }
  })

  it('speaks every task with recorded clips and no digits', () => {
    for (const { task } of tasks) expect(speechProblems(task.speech)).toEqual([])
  })
})

// ─── Misconceptions ─────────────────────────────────────────────────────────

describe('misconceptions', () => {
  it('reads halv tre set to 3:30 as halfPastNext, on the dial and on cards (also as 15:30)', () => {
    for (const kind of ['clockSet', 'choice'] as const) {
      const t = build(clockHalf, 'halv:150', kind)
      expect(classifyAnswer(t, 210)).toBe('halfPastNext')
      expect(classifyAnswer(t, 930)).toBe('halfPastNext')
      expect(classifyAnswer(t, 90)).toBe('hourHandMisread')
      expect(classifyAnswer(t, 180)).toBe('operand')
      expect(classifyAnswer(t, 120)).toBe('near')
      // the swapped clock (about 6:13) is a card; the dial's half-hour step can never set it
      expect(classifyAnswer(t, 373)).toBe(kind === 'choice' ? 'handsSwapped' : 'other')
      expect(classifyAnswer(t, 150 + 720)).toBeNull()
      expect(classifyAnswer(t, 500)).toBe('other')
    }
    for (const f of clockHalf.enumerate()) {
      const t = buildTask(clockHalf, f, 'clockSet', makeRng(1), 0).task
      expect(classifyAnswer(t, dial(Number(f.answer) + 60))).toBe('halfPastNext')
    }
  })

  it('reads kvart over and kvart i swapped as quarterDirection, and the short hand an hour off on kvart i', () => {
    const over = build(clockQuarter, 'kvart:195', 'clockSet')
    expect(classifyAnswer(over, 165)).toBe('quarterDirection')
    expect(classifyAnswer(over, 180)).toBe('operand')
    expect(classifyAnswer(over, 210)).toBe('near')
    const to = build(clockQuarter, 'kvart:165', 'clockSet')
    expect(classifyAnswer(to, 195)).toBe('quarterDirection')
    expect(classifyAnswer(to, 105)).toBe('hourHandMisread')
    expect(classifyAnswer(to, 180)).toBe('operand')
    expect(classifyAnswer(to, 150)).toBe('near')
    // kvart i et (12:45) and kvart over tolv (12:15) across twelve
    expect(classifyAnswer(build(clockQuarter, 'kvart:45', 'clockSet'), 75)).toBe('quarterDirection')
    expect(classifyAnswer(build(clockQuarter, 'kvart:15', 'clockSet'), 705)).toBe('quarterDirection')
  })

  it('reads the hands swapped as handsSwapped: 3:00 → 12:15, 9:00 → 11:45, never for 12:00', () => {
    expect(swappedHands(180)).toBe(15)
    expect(swappedHands(540)).toBe(705)
    expect(swappedHands(0)).toBeNull()
    expect(swappedHands(150)).toBe(373)
    // halv syv: both hands point down either way, too alike for a card
    expect(swappedHands(390)).toBeNull()
    const three = build(clockHour, 'hel:180', 'choice')
    expect(classifyAnswer(three, 15)).toBe('handsSwapped')
    expect(classifyAnswer(three, 240)).toBe('near')
    expect(classifyAnswer(three, 120)).toBe('near')
    for (const f of clockHour.enumerate()) {
      const tags = clockHour.candidates(f).filter((c) => c.tag === 'handsSwapped')
      expect(tags.length, f.id).toBe(f.answer === 0 ? 0 : 1)
    }
  })

  it('never needs A9: no wrong clock is both a misconception and the hour that was said', () => {
    for (const def of ALL) {
      for (const f of def.enumerate()) {
        const cands = def.candidates(f)
        expect(cands.some((c) => c.tag === 'ambiguous'), f.id).toBe(false)
        const said = dial(f.operands[0] * 60)
        const operand = cands.find((c) => c.value === said)
        if (said !== f.answer) expect(operand?.tag, f.id).toBe('operand')
      }
    }
  })

  it('offers each misconception where the catalogue puts it, on the dial only what the step can set', () => {
    const detectable = (def: SkillDef, kind: TaskKind) => new Set(tasksUnderTest(def).filter((t) => t.kind === kind).flatMap((t) => detectableOf(t.task)))
    // the swapped hands (12:15, about 6:13) fall between the dial's whole and half hours: cards only
    expect([...detectable(clockHour, 'clockSet')]).toEqual([])
    expect([...detectable(clockHalf, 'clockSet')].sort()).toEqual(['halfPastNext', 'hourHandMisread'])
    expect([...detectable(clockQuarter, 'clockSet')].sort()).toEqual(['hourHandMisread', 'quarterDirection'])
    expect([...detectable(clockHour, 'choice')]).toEqual(['handsSwapped'])
    expect([...detectable(clockHalf, 'choice')].sort()).toEqual(['halfPastNext', 'handsSwapped', 'hourHandMisread'])
    for (const def of ALL) {
      for (const f of def.enumerate()) {
        const t = buildTask(def, f, 'clockSet', makeRng(1), 0).task
        const step = t.prompt.scene === 'clock' ? t.prompt.step : 0
        expect(Object.keys(t.distractorTags).filter((k) => Number(k) % step !== 0), f.id).toEqual([])
      }
    }
  })

  it('flags a child who sets halv tre to 3:30 every time, and never a child who guesses', () => {
    const facts = clockHalf.enumerate()
    const halfTask = (i: number) => buildTask(clockHalf, facts[i % facts.length], 'clockSet', makeRng(i), i).task
    expect(flagsRaised(halfTask, 40, (t) => dial(Number(t.answer) + 60))).toContain('halfPastNext')
    const quarters = clockQuarter.enumerate().filter((f) => f.family === 'quarterTo')
    const toTask = (i: number) => buildTask(clockQuarter, quarters[i % quarters.length], 'clockSet', makeRng(i), i).task
    expect(flagsRaised(toTask, 40, (t) => dial(Number(t.answer) + 30))).toContain('quarterDirection')
    for (const def of ALL) {
      const all = def.enumerate()
      const rng = makeRng(99)
      const kinds: TaskKind[] = ['clockSet', 'choice']
      const guessTask = (i: number) => buildTask(def, all[i % all.length], kinds[i % 2], makeRng(1000 + i), i).task
      const guess = (t: Task): AnswerValue => (t.kind === 'choice' ? rng.pick(t.options) : rng.int(720 / (t.prompt.scene === 'clock' ? t.prompt.step : 60)) * (t.prompt.scene === 'clock' ? t.prompt.step : 60))
      expect([...flagsRaised(guessTask, 500, guess)], def.id).toEqual([])
    }
  })
})

// ─── Hints ──────────────────────────────────────────────────────────────────

describe('strategy hints', () => {
  const said = (def: SkillDef, id: string, tag: string | null) => compile(def.hint(fact(def, id), tag as never).speech).text

  it('says where the hands point, in whole sentences', () => {
    expect(said(clockHour, 'hel:180', null)).toBe('Ved hele timer peger den lange viser på tolv. Den lille viser peger på tre.')
    expect(said(clockHour, 'hel:60', 'near')).toBe('Ved hele timer peger den lange viser på tolv. Den lille viser peger på et.')
    expect(said(clockHalf, 'halv:150', null)).toBe('Halv tre betyder halvvejs hen mod tre. Den lange viser peger på seks, og den lille viser står midt mellem to og tre.')
    expect(said(clockHalf, 'halv:30', null)).toBe('Halv et betyder halvvejs hen mod et. Den lange viser peger på seks, og den lille viser står midt mellem tolv og et.')
    expect(said(clockQuarter, 'kvart:195', null)).toBe('Kvart over tre er et kvarter efter tre. Den lange viser peger på tre, og den lille viser er lige gået forbi tre.')
    expect(said(clockQuarter, 'kvart:165', null)).toBe('Kvart i tre er et kvarter før tre. Den lange viser peger på ni, og den lille viser er næsten ved tre.')
  })

  it('answers each misconception with its own words; halfPastNext is the animated sweep from the whole hour', () => {
    const half = clockHalf.hint(fact(clockHalf, 'halv:150'), 'halfPastNext')
    expect(compile(half.speech).text).toBe('Halv tre er en halv time før tre. Den lille viser står midt mellem to og tre.')
    expect(half).toMatchObject({ misconception: 'halfPastNext', animated: true, visual: { scene: 'clockMove', from: 120, to: 150 } })
    expect(said(clockHalf, 'halv:150', 'hourHandMisread')).toBe('Se godt på den lille viser. Ved halv tre står den midt mellem to og tre.')
    expect(said(clockQuarter, 'kvart:165', 'hourHandMisread')).toBe('Se godt på den lille viser. Ved kvart i tre er den næsten ved tre.')
    expect(said(clockQuarter, 'kvart:165', 'quarterDirection')).toMatch(/^Kvart over er et kvarter efter den hele time\. Kvart i er et kvarter før\. Kvart i tre/)
    expect(said(clockHour, 'hel:180', 'handsSwapped')).toMatch(/^Den lille viser er timeviseren, og den lange viser er minutviseren\./)
    for (const def of ALL) {
      for (const f of def.enumerate()) {
        for (const c of def.candidates(f)) {
          const h = def.hint(f, c.tag)
          expect(h.misconception ?? null).toBe(isMisconception(c.tag) ? c.tag : null)
          expect(h.animated ?? false).toBe(c.tag === 'halfPastNext')
          expect(speechProblems(h.speech)).toEqual([])
        }
      }
    }
  })

  it('pictures the answer: the clock itself, or the minute hand sweeping to it', () => {
    expect(clockHour.hint(fact(clockHour, 'hel:180'), null).visual).toEqual({ scene: 'clock', minutes: 180, step: 60 })
    expect(clockQuarter.hint(fact(clockQuarter, 'kvart:195'), null).visual).toEqual({ scene: 'clockMove', from: 180, to: 195 })
    expect(clockQuarter.hint(fact(clockQuarter, 'kvart:165'), null).visual).toEqual({ scene: 'clock', minutes: 165, step: 15 })
    expect(clockHalf.hint(fact(clockHalf, 'halv:30'), null).visual).toEqual({ scene: 'clockMove', from: 0, to: 30 })
  })
})

// ─── Clips ──────────────────────────────────────────────────────────────────

describe('clips', () => {
  it('are wave 2 sentences without digits, and every one is used', () => {
    const used = new Set<string>()
    for (const def of ALL) {
      used.add(def.canDo)
      for (const f of def.enumerate()) {
        for (const kind of def.kinds) for (const p of def.speech(f, kind)) if ('clip' in p) used.add(p.clip)
        for (const c of [null, ...def.candidates(f)]) for (const p of def.hint(f, c ? c.tag : null).speech) if ('clip' in p) used.add(p.clip)
      }
    }
    for (const [id, words] of Object.entries(CLOCK_CLIPS)) {
      expect(words).not.toMatch(/\d/)
      expect(clipInfo(id)).toMatchObject({ wave: 2, pack: 'clock-2' })
      expect(used.has(id), id).toBe(true)
    }
    // the times are the catalogue's own phrases, in wave 2
    for (const def of ALL) {
      for (const f of def.enumerate()) expect(clipInfo(`t.end.${String(f.answer)}`)?.wave, f.id).toBe(2)
    }
  })
})

// ─── Regions ────────────────────────────────────────────────────────────────

describe('Urtårnet (w1-klokken) and Urtårnets top (w2-klokken)', () => {
  const regionNodes = NODES.filter((n) => n.region === 'w1-klokken' || n.region === 'w2-klokken')
  const profile = newProfile({ grade: 2, unlocked: { worlds: ['eng', 'bakke', 'skov'], regions: ['w1-klokken', 'w2-klokken'] } })
  const ctx = { day: '2026-10-02', sessionId: 's', audioVerified: true }

  it('has keys on every node that build every kind', () => {
    expect(regionNodes).toHaveLength(12)
    for (const node of regionNodes) {
      const keys = keysForNode(node, { states: {}, audioVerified: true })
      expect(keys.length, node.id).toBeGreaterThan(0)
      for (const k of keys) {
        for (const kind of k.kinds) {
          const t = k.build(kind, makeRng(k.rank + 1), 0)
          expect(speechProblems(t.speech), `${t.factId} ${kind}`).toEqual([])
        }
      }
    }
  })

  it('plans a whole round on every node, and a production-only trial on the dial', () => {
    for (const node of regionNodes) {
      for (let r = 0; r < 3; r++) {
        const plan = planRound(node, { ...profile, roundIndex: 20 + r }, ctx)
        expect(plan.tasks.length, node.id).toBe(node.size)
        const skills = new Set(node.skills.map((s) => s.skill))
        for (const t of plan.tasks) {
          expect(skills.has(t.skill), `${node.id} ${t.skill}`).toBe(true)
          expect(speechProblems(t.speech), t.factId).toEqual([])
          if (node.slot === 'trial') expect(t.kind, `${node.id} ${t.factId}`).toBe('clockSet')
        }
      }
    }
  })
})
